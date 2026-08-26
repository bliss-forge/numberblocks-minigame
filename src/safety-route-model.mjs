import { normalizeDifficulty } from "./game-model.mjs";
import { createSafetyRouteMap } from "./safety-route-layout.mjs";
import {
  advancePatrolMover,
  createPatrolMover,
  moverPoint
} from "./safety-route-movers.mjs";

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 })
});
const SIGNAL_PHASES = Object.freeze([
  Object.freeze({ phase: "vehicle-go", durationMs: 5000 }),
  Object.freeze({ phase: "vehicle-clearance", durationMs: 1000 }),
  Object.freeze({ phase: "pedestrian-go", durationMs: 7000 }),
  Object.freeze({ phase: "pedestrian-clearance", durationMs: 1000 })
]);

const pointKey = ({ x, y }) => `${x},${y}`;
const samePoint = (left, right) => left.x === right.x && left.y === right.y;
const OPPOSITE_HEADINGS = Object.freeze({
  north: "south",
  south: "north",
  east: "west",
  west: "east"
});

function hazardCells(hazard) {
  return hazard.cells?.length ? hazard.cells : [hazard];
}

export const SAFETY_ROUTE_MAPS = Object.freeze({
  easy: createSafetyRouteMap("easy", { seed: 0 }),
  steady: createSafetyRouteMap("steady", { seed: 0 }),
  challenge: createSafetyRouteMap("challenge", { seed: 0 })
});

function cloneMover(definition, mover = {}) {
  return {
    id: definition.id,
    type: definition.type,
    pathIndex: mover.pathIndex ?? 0,
    direction: mover.direction ?? 1,
    elapsedMs: mover.elapsedMs ?? 0,
    pauseMs: mover.pauseMs ?? 0,
    stopped: mover.stopped ?? false,
    heading: mover.heading ?? definition.headings?.[mover.pathIndex ?? 0] ?? null
  };
}

export function createSafetyRouteState(
  difficulty,
  { seed = 0, tourActive = false } = {}
) {
  const normalized = normalizeDifficulty(difficulty);
  const map = createSafetyRouteMap(normalized, { seed });
  return {
    difficulty: normalized,
    seed,
    map,
    position: { ...map.start },
    nextFriend: 2,
    collected: [1],
    signal: { phase: "vehicle-go", elapsedMs: 0 },
    crossingId: null,
    checkedEntrance: null,
    ceremony: null,
    riding: null,
    ridingDest: null,
    tourActive: Boolean(tourActive),
    tick: 0,
    movers: map.trafficPaths.map(path => ({
      ...createPatrolMover(path),
      pathIndex: path.startIndex ?? 0
    }))
  };
}

function pendingBusStop(map, nextFriend, riding, position) {
  if (!map?.busMode || nextFriend <= 5 || riding) return null;
  const roadX = map.zones.road.x;
  const target = map.friends.find(friend => friend.number === nextFriend) ??
    map.goal;
  if (!target) return null;
  const playerLeft = position.x < roadX;
  if (playerLeft === (target.x < roadX)) return null;
  return playerLeft ? map.busStops.board : map.busStops.alight;
}

export function busStopForNextTarget(state) {
  return pendingBusStop(
    state.map,
    state.nextFriend,
    state.riding,
    state.position
  );
}

function crossingForPoint(map, point) {
  return map.crossings.find(crossing =>
    crossing.cells.some(cell => samePoint(cell, point))
  ) ?? null;
}

const CAR_APPROACH_DISTANCE = 4;

function carApproachingCrossing(state, crossing) {
  const rows = crossing.cells.map(cell => cell.y);
  const top = Math.min(...rows);
  const bottom = Math.max(...rows);
  return state.movers.some(mover => {
    if (mover.type !== "car") return false;
    const point = moverPoint(state.map, mover);
    if (!point) return false;
    // 횡단보도 위에 있는 차는 멈춰 있어도 길을 막는다.
    if (point.y >= top && point.y <= bottom) return true;
    // 정지선에 선 차는 위협이 아니다 — 이게 없으면 양보한 차가 스스로
    // "차가 오고 있어요"를 계속 띄워 아이를 가둔다(심층 검토 P1-12).
    if (mover.stopped) return false;
    if (point.y < top - CAR_APPROACH_DISTANCE ||
      point.y > bottom + CAR_APPROACH_DISTANCE) {
      return false;
    }
    return (mover.heading === "north" && point.y > bottom) ||
      (mover.heading === "south" && point.y < top);
  });
}

// 아이가 어느 횡단보도를 건너려고 서 있는지. 무신호 지도에서 자동차가 정지선에
// 설지, 그리고 "지금 건너요" 안내를 띄울지를 이 값 하나로 정한다.
function crossingWaitFor(state) {
  const map = state.map;
  if (!map?.signalless || map.busMode) return null;
  if (state.crossingId) {
    // 건너는 중에는 그 횡단보도를 계속 비워 둔다.
    return map.crossings.find(item => item.id === state.crossingId) ?? null;
  }
  const position = state.position;
  return map.crossings.find(crossing => {
    const firstRoadColumn = Math.min(...crossing.cells.map(cell => cell.x));
    // 아직 이 동네 친구를 다 못 만났으면 건널 차례가 아니다 — 차도 안 선다.
    if (position.x < firstRoadColumn && state.nextFriend <= 5) return false;
    return crossing.cells.some(cell =>
      Math.abs(cell.x - position.x) + Math.abs(cell.y - position.y) <= 1
    );
  }) ?? null;
}

// 아이가 기다리는 횡단보도와, 지금 건너도 되는지. 앱이 "지금 건너요" 음성을
// 한 번만 틀기 위해 매 틱 읽는다.
export function crossingClearance(state) {
  const crossing = crossingWaitFor(state);
  if (!crossing) return { crossingId: null, safe: false, waiting: false };
  return {
    crossingId: crossing.id,
    safe: !carApproachingCrossing(state, crossing),
    waiting: !state.crossingId
  };
}

function transition(state, position, event, extra = {}) {
  return { state: { ...state, position, ...extra }, event };
}

export function attemptSafetyMove(state, direction) {
  const offset = DIRECTIONS[direction];
  if (!offset) return { state, event: { type: "ignored" } };
  if (state.tourActive) return { state, event: { type: "ignored" } };
  if (state.riding) return { state, event: { type: "ignored" } };
  if (state.ceremony && state.ceremony.stage !== "crossing") {
    return { state, event: { type: "ignored" } };
  }

  const candidate = {
    x: state.position.x + offset.x,
    y: state.position.y + offset.y
  };
  const walkable = new Set(state.map.walkable.map(pointKey));
  if (!walkable.has(pointKey(candidate))) {
    return transition(state, { ...state.position }, { type: "blocked", reason: "wall" });
  }

  const hazard = state.map.hazards.find(item =>
    hazardCells(item).some(cell => samePoint(cell, candidate))
  );
  if (hazard) {
    return transition(
      state,
      { ...state.position },
      { type: "blocked", reason: hazard.type }
    );
  }

  // 차·킥보드·자전거가 서 있는 칸으로는 못 들어간다. 자동차는 횡단보도 칸에서만
  // 후보가 될 수 있다(차도는 walkable이 아니다) — 즉 건너는 중에 차가 앞을 막는
  // 상황이고, 이때가 "차가 지나갈 때까지 기다린다"를 가르칠 자리다.
  // 버스는 제외한다: 정차한 버스로 걸어 들어가는 것이 탑승 조작이다(아래 busMode).
  const blocker = state.movers.find(mover => {
    if (mover.type !== "scooter" && mover.type !== "bicycle" &&
        mover.type !== "car") {
      return false;
    }
    // 경로 정의가 없는 mover는 위치가 없다(테스트용 합성 상태 포함) — 건너뛴다
    const point = moverPoint(state.map, mover);
    return Boolean(point) && samePoint(point, candidate);
  });
  if (blocker) {
    return transition(
      state,
      { ...state.position },
      blocker.type === "car"
        ? { type: "blocked", reason: "car" }
        : { type: "blocked", reason: "moving-rider", moverType: blocker.type }
    );
  }

  const entrance = state.map.entrances.find(item => samePoint(item, candidate));
  if (entrance && state.checkedEntrance !== entrance.id) {
    return transition(
      state,
      { ...state.position },
      { type: "blocked", reason: "look-first" },
      { checkedEntrance: entrance.id }
    );
  }

  if (state.map.busMode && !state.riding && state.nextFriend > 5) {
    const targetPath = state.map.trafficPaths.find(path =>
      path.type === "bus" && path.number === state.map.busTarget
    );
    const targetMover = targetPath &&
      state.movers.find(mover => mover.id === targetPath.id);
    if (targetMover?.stopped &&
      samePoint(targetPath.points[targetMover.pathIndex], candidate)) {
      const boardingBack = targetMover.pathIndex === targetPath.alightIndex;
      return transition(state, { ...state.position }, {
        type: "bus-boarded",
        number: state.map.busTarget
      }, {
        riding: targetPath.id,
        ridingDest: boardingBack ? "board" : "alight"
      });
    }
  }

  // 목표가 아닌 버스에 올라타려 할 때. 예전에는 아래 take-the-bus 로 떨어져
  // 이미 정류장에 선 아이에게 "정류장으로 가요"라는 정반대 안내를 했다
  // (심층 검토 P1-10). 번호를 실어 보내 어느 버스인지 짚어 준다.
  if (state.map.busMode && !state.riding && state.nextFriend > 5) {
    const wrongPath = state.map.trafficPaths.find(path => {
      if (path.type !== "bus" || path.number === state.map.busTarget) return false;
      const mover = state.movers.find(item => item.id === path.id);
      return mover?.stopped &&
        samePoint(path.points[mover.pathIndex], candidate);
    });
    if (wrongPath) {
      return transition(state, { ...state.position }, {
        type: "blocked",
        reason: "wrong-bus",
        number: wrongPath.number,
        target: state.map.busTarget
      });
    }
  }

  const crossing = crossingForPoint(state.map, candidate);
  if (crossing) {
    const firstRoadColumn = Math.min(...crossing.cells.map(cell => cell.x));
    if (state.position.x < firstRoadColumn && state.nextFriend <= 5) {
      return transition(
        state,
        { ...state.position },
        { type: "blocked", reason: "left-friends-first" }
      );
    }
    if (!state.crossingId) {
      if (state.map.busMode) {
        return transition(
          state,
          { ...state.position },
          { type: "blocked", reason: "take-the-bus" }
        );
      }
      if (state.map.signalless) {
        if (carApproachingCrossing(state, crossing)) {
          return transition(
            state,
            { ...state.position },
            { type: "blocked", reason: "car-close" }
          );
        }
      } else {
        if (state.signal.phase !== "pedestrian-go") {
          return transition(
            state,
            { ...state.position },
            { type: "blocked", reason: "red-light" }
          );
        }
        if (7000 - state.signal.elapsedMs <= 2000) {
          return transition(
            state,
            { ...state.position },
            { type: "blocked", reason: "green-ending" }
          );
        }
      }
    }
  }

  const moveExtra = {
    checkedEntrance: null,
    crossingId: crossing?.id ?? null,
    ceremony: crossing ? state.ceremony ?? null : null
  };
  if (crossing && !state.crossingId) {
    return transition(state, candidate, { type: "crossing-started" }, {
      ...moveExtra,
      ceremony: { stage: "stopping", elapsedMs: 0 }
    });
  }
  const friend = state.map.friends.find(item => samePoint(item, candidate));
  if (friend?.number === state.nextFriend) {
    return transition(state, candidate, { type: "friend", number: friend.number }, {
      ...moveExtra,
      nextFriend: state.nextFriend + 1,
      collected: [...state.collected, friend.number]
    });
  }
  if (friend && friend.number > state.nextFriend) {
    return transition(state, candidate, { type: "wrong-friend", number: friend.number }, moveExtra);
  }

  const pendingStop = pendingBusStop(
    state.map,
    state.nextFriend,
    state.riding,
    candidate
  );
  if (pendingStop && samePoint(pendingStop, candidate)) {
    return transition(
      state,
      candidate,
      { type: "bus-stop", target: state.map.busTarget },
      moveExtra
    );
  }

  if (samePoint(state.map.goal, candidate)) {
    return transition(
      state,
      candidate,
      state.nextFriend > 10
        ? { type: "complete" }
        : { type: "need-friends", nextFriend: state.nextFriend },
      moveExtra
    );
  }

  return transition(state, candidate, { type: "moved" }, moveExtra);
}

function advanceSignal(signal, elapsedMs) {
  let index = SIGNAL_PHASES.findIndex(item => item.phase === signal.phase);
  if (index < 0) index = 0;
  let elapsed = signal.elapsedMs + Math.max(0, elapsedMs);
  while (elapsed >= SIGNAL_PHASES[index].durationMs) {
    elapsed -= SIGNAL_PHASES[index].durationMs;
    index = (index + 1) % SIGNAL_PHASES.length;
  }
  return { phase: SIGNAL_PHASES[index].phase, elapsedMs: elapsed };
}

function advanceCarMover(definition, mover, signal) {
  const direction = mover.direction === -1 ? -1 : 1;
  if (signal.phase !== "vehicle-go" && definition.stopIndices.includes(mover.pathIndex)) {
    return cloneMover(definition, {
      ...mover,
      stopped: true,
      heading: definition.headings?.[mover.pathIndex] ?? mover.heading
    });
  }
  const pathIndex =
    (mover.pathIndex + direction + definition.points.length) % definition.points.length;
  const stopped =
    signal.phase !== "vehicle-go" && definition.stopIndices.includes(pathIndex);
  return cloneMover(definition, {
    ...mover,
    pathIndex,
    direction,
    stopped,
    heading: definition.headings?.[pathIndex] ?? mover.heading
  });
}

const SIGNALLESS_CAR_INTERVAL_MS = 250;
const BUS_INTERVAL_MS = 250;
const BUS_STOP_PAUSE_MS = 2000;

function advanceBusMover(definition, mover, { elapsedMs, ridingId }) {
  const carrying = ridingId === definition.id;
  const atStop = mover.pathIndex === definition.boardIndex ||
    mover.pathIndex === definition.alightIndex;
  if (atStop && !carrying) {
    const pauseMs = (mover.pauseMs ?? 0) + Math.max(0, elapsedMs);
    if (pauseMs < BUS_STOP_PAUSE_MS) {
      return cloneMover(definition, {
        ...mover,
        pauseMs,
        elapsedMs: 0,
        stopped: true,
        heading: definition.headings?.[mover.pathIndex] ?? mover.heading
      });
    }
    const pathIndex = (mover.pathIndex + 1) % definition.points.length;
    return cloneMover(definition, {
      ...mover,
      pathIndex,
      pauseMs: 0,
      elapsedMs: 0,
      stopped: false,
      heading: definition.headings?.[pathIndex] ?? mover.heading
    });
  }
  const accumulated = (mover.elapsedMs ?? 0) + Math.max(0, elapsedMs);
  if (accumulated < BUS_INTERVAL_MS) {
    return cloneMover(definition, {
      ...mover,
      elapsedMs: accumulated,
      pauseMs: 0,
      stopped: false,
      heading: definition.headings?.[mover.pathIndex] ?? mover.heading
    });
  }
  const pathIndex = (mover.pathIndex + 1) % definition.points.length;
  return cloneMover(definition, {
    ...mover,
    pathIndex,
    elapsedMs: accumulated - BUS_INTERVAL_MS,
    pauseMs: 0,
    stopped: false,
    heading: definition.headings?.[pathIndex] ?? mover.heading
  });
}

// 차가 횡단보도 줄로 "새로" 들어서려는 순간인지. 이미 그 줄 위에 있는 차는
// 계속 가서 횡단보도를 비워 준다 — 멈춰 서면 오히려 길을 막는다.
function entersYieldRow(current, next, yieldRows) {
  return yieldRows.includes(next.y) && !yieldRows.includes(current.y);
}

function advanceSignallessCarMover(
  definition,
  mover,
  { elapsedMs, player, yieldRows = [] }
) {
  const direction = mover.direction === -1 ? -1 : 1;
  const accumulated = (mover.elapsedMs ?? 0) + Math.max(0, elapsedMs);
  if (accumulated < SIGNALLESS_CAR_INTERVAL_MS) {
    return cloneMover(definition, {
      ...mover,
      elapsedMs: accumulated,
      stopped: false,
      heading: definition.headings?.[mover.pathIndex] ?? mover.heading
    });
  }
  const pathIndex =
    (mover.pathIndex + direction + definition.points.length) % definition.points.length;
  // 횡단보도 앞에 아이가 서 있으면 정지선에서 멈춘다(도로교통법 제27조).
  // 무작위 틈을 기다리게 두면 안내를 따르는 아이일수록 오래 갇힌다(P1-12).
  if (yieldRows.length &&
    entersYieldRow(
      definition.points[mover.pathIndex],
      definition.points[pathIndex],
      yieldRows
    )) {
    return cloneMover(definition, {
      ...mover,
      elapsedMs: SIGNALLESS_CAR_INTERVAL_MS,
      stopped: true,
      heading: definition.headings?.[mover.pathIndex] ?? mover.heading
    });
  }
  if (player && samePoint(definition.points[pathIndex], player)) {
    return cloneMover(definition, {
      ...mover,
      elapsedMs: SIGNALLESS_CAR_INTERVAL_MS,
      stopped: true,
      heading: definition.headings?.[mover.pathIndex] ?? mover.heading
    });
  }
  return cloneMover(definition, {
    ...mover,
    pathIndex,
    direction,
    elapsedMs: accumulated - SIGNALLESS_CAR_INTERVAL_MS,
    stopped: false,
    heading: definition.headings?.[pathIndex] ?? mover.heading
  });
}

function oppositeHeadings(left, right) {
  return Boolean(left?.heading) && OPPOSITE_HEADINGS[left.heading] === right?.heading;
}

function synchronizeCarHeadings(previousMovers, nextMovers) {
  const carIndices = nextMovers.flatMap((mover, index) =>
    mover.type === "car" ? [index] : []
  );
  if (carIndices.length !== 2) return nextMovers;
  const [leftIndex, rightIndex] = carIndices;
  const previousLeft = previousMovers[leftIndex];
  const previousRight = previousMovers[rightIndex];
  const nextLeft = nextMovers[leftIndex];
  const nextRight = nextMovers[rightIndex];
  if (oppositeHeadings(nextLeft, nextRight)) return nextMovers;

  const holdLeft = { ...previousLeft, stopped: true };
  const holdRight = { ...previousRight, stopped: true };
  if (oppositeHeadings(holdLeft, nextRight)) {
    return nextMovers.map((mover, index) => index === leftIndex ? holdLeft : mover);
  }
  if (oppositeHeadings(nextLeft, holdRight)) {
    return nextMovers.map((mover, index) => index === rightIndex ? holdRight : mover);
  }
  return nextMovers.map((mover, index) => {
    if (index === leftIndex) return holdLeft;
    if (index === rightIndex) return holdRight;
    return mover;
  });
}

export function advanceSafetyWorld(state, elapsedMs = 100) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  const tick = state.tick + elapsed;
  const signal = advanceSignal(state.signal, elapsed);
  const waitingCrossing = crossingWaitFor(state);
  const yieldRows = waitingCrossing
    ? [...new Set(waitingCrossing.cells.map(cell => cell.y))]
    : [];
  const advancedMovers = state.movers.map(mover => {
    const definition = state.map.trafficPaths.find(item => item.id === mover.id);
    if (!definition || definition.points.length === 0) return { ...mover };
    if (definition.type === "scooter" || definition.type === "bicycle") {
      return advancePatrolMover(definition, mover, {
        elapsedMs: elapsed,
        player: state.position
      });
    }
    if (definition.type === "bus") {
      return advanceBusMover(definition, mover, {
        elapsedMs: elapsed,
        ridingId: state.riding
      });
    }
    if (state.map.signalless) {
      return advanceSignallessCarMover(definition, mover, {
        elapsedMs: elapsed,
        player: state.position,
        yieldRows
      });
    }
    return advanceCarMover(definition, mover, signal);
  });
  const movers = state.map.signalless || state.map.busMode
    ? advancedMovers
    : synchronizeCarHeadings(state.movers, advancedMovers);
  let ceremony = state.ceremony;
  if (ceremony && ceremony.stage !== "crossing") {
    const elapsedTotal = ceremony.elapsedMs + elapsed;
    ceremony = elapsedTotal >= 1400
      ? { stage: "crossing", elapsedMs: elapsedTotal }
      : elapsedTotal >= 600
        ? { stage: "looking", elapsedMs: elapsedTotal }
        : { stage: ceremony.stage, elapsedMs: elapsedTotal };
  }
  let riding = state.riding;
  let ridingDest = state.ridingDest ?? null;
  let position = state.position;
  if (state.map.busMode) {
    if (riding) {
      const path = state.map.trafficPaths.find(item => item.id === riding);
      const mover = movers.find(item => item.id === riding);
      if (path && mover) {
        const destKey = ridingDest ?? "alight";
        const destIndex = destKey === "board"
          ? path.boardIndex
          : path.alightIndex;
        if (mover.pathIndex === destIndex) {
          riding = null;
          ridingDest = null;
          position = { ...state.map.busStops[destKey] };
        } else {
          position = { ...path.points[mover.pathIndex] };
        }
      }
    }
  }
  return {
    ...state, tick, signal, movers, ceremony, riding, ridingDest, position
  };
}

function inBounds(map, point) {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

export function findSafetyPath(map, start, goal) {
  const walkable = new Set(map.pedestrianCells.map(pointKey));
  const blockers = new Set(map.hazards.flatMap(hazardCells).map(pointKey));
  const startKey = pointKey(start);
  const goalKey = pointKey(goal);
  if (
    !walkable.has(startKey) ||
    !walkable.has(goalKey) ||
    blockers.has(startKey) ||
    blockers.has(goalKey)
  ) {
    return [];
  }
  const previous = new Map([[startKey, null]]);
  const queue = [{ ...start }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (samePoint(current, goal)) break;
    Object.values(DIRECTIONS).forEach(offset => {
      const next = { x: current.x + offset.x, y: current.y + offset.y };
      const nextKey = pointKey(next);
      if (
        inBounds(map, next) &&
        walkable.has(nextKey) &&
        !blockers.has(nextKey) &&
        !previous.has(nextKey)
      ) {
        previous.set(nextKey, current);
        queue.push(next);
      }
    });
  }

  if (!previous.has(goalKey)) return [];
  const path = [];
  for (let point = goal; point; point = previous.get(pointKey(point))) {
    path.push({ x: point.x, y: point.y });
  }
  return path.reverse();
}

export function validateSafetyRouteMap(map) {
  const errors = [];
  if (!map || !Number.isInteger(map.width) || !Number.isInteger(map.height)) {
    return { valid: false, errors: ["invalid dimensions"] };
  }

  const friends = map.friends ?? [];
  const hazards = map.hazards ?? [];
  const pedestrianCells = map.pedestrianCells ?? [];
  const crossings = map.crossings ?? [];
  const trafficPaths = map.trafficPaths ?? [];
  const numbers = friends.map(friend => friend.number).sort((left, right) => left - right);
  if (JSON.stringify(numbers) !== JSON.stringify([2, 3, 4, 5, 6, 7, 8, 9, 10])) {
    errors.push("friends must contain 2 through 10 exactly once");
  }

  const pedestrianKeys = new Set(pedestrianCells.map(pointKey));
  const crossingKeys = new Set(crossings.flatMap(crossing => crossing.cells).map(pointKey));
  const roadKeys = new Set((map.roadCells ?? []).map(pointKey));
  const hazardKeys = new Set(hazards.flatMap(hazardCells).map(pointKey));
  [map.start, ...friends, map.goal].filter(Boolean).forEach(point => {
    if (hazardKeys.has(pointKey(point))) {
      errors.push(`blocked route endpoint: ${pointKey(point)}`);
    }
  });
  const pedestrianOccupied = [
    map.start,
    map.goal,
    map.signalGate,
    ...friends,
    ...hazards.flatMap(hazardCells),
    ...(map.entrances ?? [])
  ].filter(Boolean);
  pedestrianOccupied.forEach(point => {
    if (!inBounds(map, point)) errors.push(`out of bounds: ${pointKey(point)}`);
    if (!pedestrianKeys.has(pointKey(point))) errors.push(`not pedestrian: ${pointKey(point)}`);
  });

  trafficPaths.forEach(path => {
    path.points.forEach(point => {
      if (!inBounds(map, point)) errors.push(`traffic out of bounds: ${pointKey(point)}`);
      const key = pointKey(point);
      if (path.type === "car") {
        if (!roadKeys.has(key)) errors.push(`car outside road: ${key}`);
        if (pedestrianKeys.has(key) && !crossingKeys.has(key)) {
          errors.push(`traffic overlaps sidewalk: ${key}`);
        }
      } else if (path.type === "bus") {
        if (!roadKeys.has(key)) errors.push(`bus outside road: ${key}`);
      } else if (path.type === "scooter" || path.type === "bicycle") {
        if (!pedestrianKeys.has(key) || crossingKeys.has(key)) {
          errors.push(`patrol leaves safe sidewalk: ${key}`);
        }
      } else {
        errors.push(`unknown traffic type: ${path.type}`);
      }
    });
  });

  let previousTarget = map.start;
  [...friends, map.goal].filter(Boolean).forEach(point => {
    if (findSafetyPath(map, previousTarget, point).length === 0) {
      errors.push(`unreachable: ${pointKey(point)}`);
    }
    previousTarget = point;
  });

  return { valid: errors.length === 0, errors };
}
