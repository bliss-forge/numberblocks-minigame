import test from "node:test";
import assert from "node:assert/strict";
import {
  SAFETY_ROUTE_MAPS,
  advanceSafetyWorld,
  attemptSafetyMove,
  createSafetyRouteState,
  crossingClearance,
  findSafetyPath,
  validateSafetyRouteMap
} from "../src/safety-route-model.mjs";
import { safetyCueForEvent } from "../src/safety-route-controller.mjs";

const pointKey = ({ x, y }) => `${x},${y}`;
const directions = Object.freeze([
  Object.freeze({ name: "up", x: 0, y: -1 }),
  Object.freeze({ name: "down", x: 0, y: 1 }),
  Object.freeze({ name: "left", x: -1, y: 0 }),
  Object.freeze({ name: "right", x: 1, y: 0 })
]);

function crossingEntry(map, crossing) {
  const row = Math.min(...crossing.cells.map(cell => cell.y));
  const firstRoadColumn = Math.min(...crossing.cells.map(cell => cell.x));
  return { x: firstRoadColumn - 1, y: row };
}

function stateAtLeftCrossing({ collected, nextFriend, signal } = {}) {
  const state = createSafetyRouteState("easy", { seed: 42 });
  return {
    ...state,
    position: crossingEntry(state.map, state.map.crossings[0]),
    nextFriend: nextFriend ?? state.nextFriend,
    collected: collected ?? state.collected,
    signal: signal ?? state.signal
  };
}

function statesAtBothCrossings({ collected, nextFriend, signal }) {
  const state = createSafetyRouteState("easy", { seed: 42 });
  return state.map.crossings.map(crossing => ({
    ...state,
    position: crossingEntry(state.map, crossing),
    collected,
    nextFriend,
    signal
  }));
}

function moveInto(map, target) {
  const pedestrian = new Set(map.pedestrianCells.map(pointKey));
  const step = directions.find(direction => pedestrian.has(pointKey({
    x: target.x - direction.x,
    y: target.y - direction.y
  })));
  assert.ok(step, `no pedestrian entry for ${pointKey(target)}`);
  return {
    position: { x: target.x - step.x, y: target.y - step.y },
    direction: step.name
  };
}

test("게임 상태는 한 시드로 생성한 32×16 지도를 유지한다", () => {
  const first = createSafetyRouteState("easy", { seed: 42 });
  const second = createSafetyRouteState("easy", { seed: 42 });
  assert.equal(first.seed, 42);
  assert.deepEqual(first.map, second.map);
  assert.deepEqual(
    { width: first.map.width, height: first.map.height },
    { width: 32, height: 16 }
  );
});

test("2~5 친구 전에는 횡단보도 너머 오른쪽 동네로 갈 수 없다", () => {
  const state = stateAtLeftCrossing({ collected: [1, 2, 3, 4], nextFriend: 5 });
  const result = attemptSafetyMove(state, "right");
  assert.deepEqual(result.event, { type: "blocked", reason: "left-friends-first" });
  assert.deepEqual(result.state.position, state.position);
});

test("5 친구를 만나면 위와 아래 횡단보도를 모두 사용할 수 있다", () => {
  for (const state of statesAtBothCrossings({
    collected: [1, 2, 3, 4, 5],
    nextFriend: 6,
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  })) {
    const carFree = {
      ...state,
      movers: state.movers.filter(mover => mover.type !== "car")
    };
    assert.equal(
      attemptSafetyMove(carFree, "right").event.type,
      "crossing-started"
    );
  }
});

// 감사(2026-08-06)에서 잡힌 결함: 킥보드·자전거만 칸 점유 검사를 받아
// 횡단보도 안에서 자동차가 서 있는 칸으로 그냥 걸어 들어갈 수 있었다.
// 컨트롤러에는 car 경고 문구·safety-car 음성이 이미 준비돼 있었는데
// 그 reason을 만드는 코드가 없어 사문이었다.
function carPointOnCrossing(state, crossing) {
  const cells = new Set(crossing.cells.map(pointKey));
  for (const mover of state.movers) {
    if (mover.type !== "car") continue;
    const path = state.map.trafficPaths.find(item => item.id === mover.id);
    const index = path.points.findIndex(point => cells.has(pointKey(point)));
    if (index >= 0) {
      return { mover: { ...mover, pathIndex: index }, point: path.points[index] };
    }
  }
  return null;
}

test("횡단보도 안에서 자동차가 있는 칸으로는 들어가지 못하고 자동차 경고가 나온다", () => {
  const base = createSafetyRouteState("easy", { seed: 42 });
  const crossing = base.map.crossings[0];
  const car = carPointOnCrossing(base, crossing);
  assert.ok(car, "횡단보도를 지나는 자동차 경로가 있다");

  const walkable = new Set(base.map.walkable.map(pointKey));
  const approach = [
    { from: { x: car.point.x - 1, y: car.point.y }, direction: "right" },
    { from: { x: car.point.x + 1, y: car.point.y }, direction: "left" },
    { from: { x: car.point.x, y: car.point.y - 1 }, direction: "down" },
    { from: { x: car.point.x, y: car.point.y + 1 }, direction: "up" }
  ].find(entry => walkable.has(pointKey(entry.from)));
  assert.ok(approach, "차 옆에 통행 가능한 칸이 있다");

  const state = {
    ...base,
    collected: [1, 2, 3, 4, 5],
    nextFriend: 6,
    position: approach.from,
    crossingId: crossing.id, // 이미 건너는 중 — 게이트를 지난 뒤가 문제였다
    movers: base.movers.map(mover =>
      mover.id === car.mover.id ? car.mover : mover
    )
  };

  const result = attemptSafetyMove(state, approach.direction);
  assert.deepEqual(result.event, { type: "blocked", reason: "car" });
  assert.deepEqual(result.state.position, approach.from, "제자리에 남는다");
});

test("32×16 지도는 자동차 차도와 보행 순찰 경로를 구분한다", () => {
  for (const map of Object.values(SAFETY_ROUTE_MAPS)) {
    const pedestrian = new Set(map.pedestrianCells.map(pointKey));
    const crossings = new Set(map.crossings.flatMap(item => item.cells).map(pointKey));
    for (const path of map.trafficPaths) {
      for (const point of path.points) {
        if (path.type === "car" || path.type === "bus") {
          assert.equal(
            pedestrian.has(pointKey(point)) && !crossings.has(pointKey(point)),
            false,
            `${path.type} ${pointKey(point)} overlaps a sidewalk`
          );
        } else {
          assert.ok(pedestrian.has(pointKey(point)), `${path.type} leaves the sidewalk`);
          assert.equal(crossings.has(pointKey(point)), false, `${path.type} enters a crossing`);
        }
      }
    }
    assert.deepEqual(validateSafetyRouteMap(map), { valid: true, errors: [] });
  }
});

test("모든 친구와 학교는 안전한 보행 경로로 연결된다", () => {
  for (const map of Object.values(SAFETY_ROUTE_MAPS)) {
    let position = map.start;
    for (const target of [...map.friends, map.goal]) {
      const path = findSafetyPath(map, position, target);
      assert.ok(path.length > 0, `${target.number ?? "school"} unreachable`);
      position = target;
    }
  }
});

test("난이도별 생활안전 요소가 생성 지도에 반영된다", () => {
  for (const difficulty of ["easy", "steady", "challenge"]) {
    assert.deepEqual(
      SAFETY_ROUTE_MAPS[difficulty].hazards.map(item => item.type).sort(),
      ["construction", "manhole", "manhole"],
      difficulty
    );
  }
  assert.deepEqual(SAFETY_ROUTE_MAPS.easy.trafficPaths.map(item => item.type).sort(), [
    "bicycle", "car", "car", "scooter"
  ]);
  assert.deepEqual(SAFETY_ROUTE_MAPS.steady.trafficPaths.map(item => item.type).sort(), [
    "bicycle", "bus", "bus", "bus", "bus", "scooter"
  ]);
  assert.deepEqual(SAFETY_ROUTE_MAPS.challenge.trafficPaths.map(item => item.type).sort(), [
    "bicycle", "car", "car", "scooter"
  ]);
  assert.equal(SAFETY_ROUTE_MAPS.challenge.srtMode, true);
});

test("친구는 2부터 순서대로만 수집한다", () => {
  const state = createSafetyRouteState("easy", { seed: 4 });
  const wrongFriend = state.map.friends.find(friend => friend.number === 4);
  const wrongMove = moveInto(state.map, wrongFriend);
  const wrong = attemptSafetyMove({ ...state, ...wrongMove }, wrongMove.direction);
  assert.deepEqual(wrong.event, { type: "wrong-friend", number: 4 });
  assert.equal(wrong.state.nextFriend, 2);
  assert.deepEqual(wrong.state.position, { x: wrongFriend.x, y: wrongFriend.y });

  const correctFriend = state.map.friends.find(friend => friend.number === 2);
  const correctMove = moveInto(state.map, correctFriend);
  const correct = attemptSafetyMove({ ...state, ...correctMove }, correctMove.direction);
  assert.deepEqual(correct.event, { type: "friend", number: 2 });
  assert.equal(correct.state.nextFriend, 3);
  assert.deepEqual(correct.state.collected, [1, 2]);
});

test("횡단보도는 빨간불과 초록불 종료 직전에 새 진입을 막는다", () => {
  const signalEntry = stateAtLeftCrossing({ nextFriend: 6, collected: [1, 2, 3, 4, 5] });
  const entry = {
    ...signalEntry,
    map: { ...structuredClone(signalEntry.map), signalless: false }
  };
  const red = attemptSafetyMove({
    ...entry,
    signal: { phase: "vehicle-go", elapsedMs: 0 }
  }, "right");
  assert.deepEqual(red.event, { type: "blocked", reason: "red-light" });

  const ending = attemptSafetyMove({
    ...entry,
    signal: { phase: "pedestrian-go", elapsedMs: 5100 }
  }, "right");
  assert.deepEqual(ending.event, { type: "blocked", reason: "green-ending" });

  const green = attemptSafetyMove({
    ...entry,
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  }, "right");
  assert.equal(green.event.type, "crossing-started");
});

test("고정 장애물은 위치를 유지하고 정확한 안전 이유를 반환한다", () => {
  const state = createSafetyRouteState("steady", { seed: 9 });
  for (const hazard of state.map.hazards) {
    const move = moveInto(state.map, hazard);
    const result = attemptSafetyMove({ ...state, ...move }, move.direction);
    assert.deepEqual(result.event, { type: "blocked", reason: hazard.type });
    assert.deepEqual(result.state.position, move.position);
  }
});

test("맨홀 앞에서는 멈추고 비어 있는 짝 행으로 돌아갈 수 있다", () => {
  const state = createSafetyRouteState("easy", { seed: 8 });
  const manhole = state.map.hazards.find(hazard => hazard.type === "manhole");
  const before = { x: manhole.x - 1, y: manhole.y };
  const after = { x: manhole.x + 1, y: manhole.y };
  const blocked = attemptSafetyMove({ ...state, position: before }, "right");

  assert.deepEqual(blocked.event, { type: "blocked", reason: "manhole" });
  assert.ok(manhole.pairedBypassCell);
  const detour = findSafetyPath(state.map, before, after);
  assert.ok(detour.some(point => pointKey(point) === pointKey(manhole.pairedBypassCell)));
});

test("공사 골목을 만나면 다른 같은 동네 골목으로 우회할 수 있다", () => {
  const state = createSafetyRouteState("steady", { seed: 8 });
  const construction = state.map.hazards.find(hazard => hazard.type === "construction");
  const blockedAlley = state.map.alleys.find(alley => alley.x === construction.x);
  const openAlley = state.map.alleys.find(alley =>
    alley.zone === blockedAlley.zone && alley.id !== blockedAlley.id
  );

  assert.ok(construction.cells?.length > 1);
  const beforeConstruction = { x: construction.x, y: construction.cells[0].y - 1 };
  assert.deepEqual(
    attemptSafetyMove({ ...state, position: beforeConstruction }, "down").event,
    { type: "blocked", reason: "construction" }
  );
  const detour = findSafetyPath(
    state.map,
    { x: openAlley.x, y: openAlley.y + 1 },
    { x: openAlley.x, y: openAlley.y + openAlley.height - 2 }
  );
  assert.ok(detour.length > 0);
  assert.ok(detour.every(point => point.x === openAlley.x));
});

test("다중 셀 장애물은 이동과 길찾기 및 지도 검증에 모두 반영된다", () => {
  const state = createSafetyRouteState("easy", { seed: 3 });
  const map = structuredClone(state.map);
  const blocked = { x: map.start.x + 1, y: map.start.y };
  map.hazards = [{
    id: "wide-construction",
    type: "construction",
    x: map.start.x,
    y: map.start.y,
    cells: [{ ...map.start }, blocked]
  }];
  const result = attemptSafetyMove({ ...state, map }, "right");
  assert.deepEqual(result.event, { type: "blocked", reason: "construction" });
  assert.deepEqual(findSafetyPath(map, map.start, blocked), []);

  map.hazards[0].cells.push({ x: -1, y: map.start.y });
  const validation = validateSafetyRouteMap(map);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes(`out of bounds: -1,${map.start.y}`));
});

test("장애물 발자국이 시작점을 덮으면 지도 검증이 거부한다", () => {
  const map = structuredClone(createSafetyRouteState("easy", { seed: 3 }).map);
  const hazard = map.hazards[0];
  map.hazards[0] = {
    ...hazard,
    cells: [{ ...hazard }, { ...map.start }]
  };

  const validation = validateSafetyRouteMap(map);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes(`blocked route endpoint: ${pointKey(map.start)}`));
});

test("자동차 경로가 중앙 도로 밖으로 나가면 지도 검증이 거부한다", () => {
  const map = structuredClone(createSafetyRouteState("easy", { seed: 3 }).map);
  const car = map.trafficPaths.find(path => path.type === "car");
  car.points[0] = { x: 0, y: 0 };

  const validation = validateSafetyRouteMap(map);

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("car outside road: 0,0"));
});

test("출입구는 첫 입력에 좌우 확인하고 다음 입력에 통과한다", () => {
  const state = createSafetyRouteState("steady", { seed: 9 });
  const entrance = state.map.entrances[0];
  const move = moveInto(state.map, entrance);
  const first = attemptSafetyMove({ ...state, ...move }, move.direction);
  assert.deepEqual(first.event, { type: "blocked", reason: "look-first" });
  assert.equal(first.state.checkedEntrance, entrance.id);

  const second = attemptSafetyMove(first.state, move.direction);
  assert.equal(second.event.type, "moved");
  assert.equal(second.state.checkedEntrance, null);
});

test("자동차는 신호에 멈추고 보행 순찰자는 느리게 한 칸씩 움직인다", () => {
  const seeded = createSafetyRouteState("easy", { seed: 7 });
  const start = {
    ...seeded,
    map: { ...structuredClone(seeded.map), signalless: false }
  };
  assert.equal(start.signal.phase, "vehicle-go");
  assert.deepEqual(start.movers.map(mover => mover.pathIndex), [0, 0, 0, 0]);

  const one = advanceSafetyWorld(start, 100);
  assert.equal(one.tick, 100);
  assert.equal(one.signal.phase, "vehicle-go");
  assert.deepEqual(one.movers.map(mover => mover.pathIndex), [1, 1, 0, 0]);

  let walking = one;
  for (let elapsed = 100; elapsed < 6000; elapsed += 100) {
    walking = advanceSafetyWorld(walking, 100);
  }
  assert.equal(walking.tick, 6000);
  assert.equal(walking.signal.phase, "pedestrian-go");
  assert.ok(walking.movers.filter(mover => mover.type === "car").every(mover => mover.stopped));
  assert.ok(walking.movers
    .filter(mover => mover.type !== "car")
    .every(mover => {
      const path = walking.map.trafficPaths.find(item => item.id === mover.id);
      return mover.pathIndex >= 0 && mover.pathIndex < path.points.length;
    }));
});

test("차량 신호가 멈추면 자동차는 현재 위치 다음 횡단보도 정지선까지 접근한다", () => {
  const state = structuredClone(createSafetyRouteState("easy", { seed: 7 }));
  state.map.signalless = false;
  const cars = state.map.trafficPaths.filter(path => path.type === "car");

  state.signal = { phase: "pedestrian-go", elapsedMs: 0 };
  state.movers = state.movers.map(mover => {
    const path = cars.find(candidate => candidate.id === mover.id);
    if (!path) return mover;
    const lowerStopIndex = path.stopIndices.find(index =>
      path.points[index].y === 12 || path.points[index].y === 9
    );
    return {
      ...mover,
      pathIndex: (lowerStopIndex - 1 + path.points.length) % path.points.length,
      stopped: false
    };
  });

  const advanced = advanceSafetyWorld(state, 100);
  for (const mover of advanced.movers.filter(item => item.type === "car")) {
    const path = cars.find(candidate => candidate.id === mover.id);
    const lowerStopIndex = path.stopIndices.find(index =>
      path.points[index].y === 12 || path.points[index].y === 9
    );
    assert.equal(mover.pathIndex, lowerStopIndex);
    assert.equal(mover.stopped, true);
  }
});

test("신호 대기로 위치가 어긋나도 두 자동차 heading은 운행 내내 서로 반대다", () => {
  const opposite = { north: "south", south: "north", east: "west", west: "east" };
  let state = createSafetyRouteState("easy", { seed: 7 });

  for (let tick = 0; tick < 300; tick += 1) {
    state = advanceSafetyWorld(state, 100);
    const cars = state.movers.filter(mover => mover.type === "car");
    assert.equal(
      cars[1].heading,
      opposite[cars[0].heading],
      `headings diverged at tick ${tick + 1}: ${cars[0].heading}/${cars[1].heading}`
    );
  }
});

test("보행 순찰자가 점유한 칸은 아이의 위치와 수집 상태를 바꾸지 않고 막는다", () => {
  const state = createSafetyRouteState("challenge", { seed: 7 });
  const rider = state.movers.find(mover => mover.type === "scooter");
  const path = state.map.trafficPaths.find(item => item.id === rider.id);
  const target = path.points[rider.pathIndex];
  const move = moveInto(state.map, target);

  const result = attemptSafetyMove({ ...state, ...move }, move.direction);

  assert.deepEqual(result.event, {
    type: "blocked",
    reason: "moving-rider",
    moverType: "scooter"
  });
  assert.deepEqual(result.state.position, move.position);
  assert.deepEqual(result.state.movers, state.movers);
  assert.deepEqual(result.state.collected, state.collected);
});

test("10 친구를 만나기 전에는 학교에 도착할 수 없다", () => {
  const state = createSafetyRouteState("easy", { seed: 5 });
  const move = moveInto(state.map, state.map.goal);
  const early = attemptSafetyMove({ ...state, ...move }, move.direction);
  assert.equal(early.event.type, "need-friends");

  const ready = attemptSafetyMove({
    ...state,
    ...move,
    nextFriend: 11,
    collected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  }, move.direction);
  assert.equal(ready.event.type, "complete");
});

test("벽과 잘못된 방향 입력은 상태를 바꾸지 않는다", () => {
  const state = createSafetyRouteState("easy", { seed: 2 });
  const wall = attemptSafetyMove(state, "left");
  assert.deepEqual(wall.event, { type: "blocked", reason: "wall" });
  assert.deepEqual(wall.state.position, state.position);

  const ignored = attemptSafetyMove(state, "diagonal");
  assert.equal(ignored.event.type, "ignored");
  assert.deepEqual(ignored.state, state);
});

test("잘못된 난이도는 차근차근 지도로 안전하게 정규화한다", () => {
  assert.equal(createSafetyRouteState("unknown").difficulty, "steady");
});

test("초록불 횡단 진입은 crossing-started 이벤트와 연출 상태를 만든다", () => {
  const seeded = createSafetyRouteState("easy", { seed: 1 });
  const base = {
    ...seeded,
    map: { ...structuredClone(seeded.map), signalless: false }
  };
  const crossingCell = base.map.crossings[0].cells
    .find(cell => cell.x === base.map.zones.road.x);
  const state = {
    ...base,
    nextFriend: 6,
    position: { x: crossingCell.x - 1, y: crossingCell.y },
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  };
  const result = attemptSafetyMove(state, "right");
  assert.equal(result.event.type, "crossing-started");
  assert.deepEqual(result.state.ceremony, { stage: "stopping", elapsedMs: 0 });
});

test("연출 stopping/looking 동안 이동 입력은 무시된다", () => {
  const base = createSafetyRouteState("easy", { seed: 1 });
  const state = { ...base, ceremony: { stage: "stopping", elapsedMs: 100 } };
  const result = attemptSafetyMove(state, "right");
  assert.equal(result.event.type, "ignored");
  assert.deepEqual(result.state.position, state.position);
});

test("연출은 시간에 따라 stopping→looking→crossing으로 진행된다", () => {
  const base = createSafetyRouteState("easy", { seed: 1 });
  let state = { ...base, ceremony: { stage: "stopping", elapsedMs: 0 } };
  state = advanceSafetyWorld(state, 600);
  assert.equal(state.ceremony.stage, "looking");
  state = advanceSafetyWorld(state, 800);
  assert.equal(state.ceremony.stage, "crossing");
});

test("횡단보도를 벗어나면 연출이 해제된다", () => {
  const base = createSafetyRouteState("easy", { seed: 1 });
  const crossing = base.map.crossings[0];
  const lastCell = crossing.cells.reduce((a, b) => (b.x > a.x ? b : a));
  const state = {
    ...base,
    nextFriend: 6,
    position: { x: lastCell.x, y: lastCell.y },
    crossingId: crossing.id,
    ceremony: { stage: "crossing", elapsedMs: 0 },
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  };
  const result = attemptSafetyMove(state, "right");
  assert.equal(result.state.ceremony, null);
});

test("tourActive 동안 이동은 무시된다", () => {
  const state = {
    ...createSafetyRouteState("easy", { seed: 1 }),
    tourActive: true
  };
  const result = attemptSafetyMove(state, "right");
  assert.equal(result.event.type, "ignored");
});

test("무신호 지도는 차 접근 시 횡단 진입을 막는다", () => {
  const base = createSafetyRouteState("easy", { seed: 4 });
  assert.equal(base.map.signalless, true);

  const crossing = base.map.crossings[0];
  const crossingCell = crossing.cells
    .find(cell => cell.x === base.map.zones.road.x);
  const entry = {
    ...base,
    nextFriend: 6,
    position: { x: crossingCell.x - 1, y: crossingCell.y }
  };
  const carPath = base.map.trafficPaths.find(path => path.type === "car");
  const nearIndex = carPath.points.findIndex(point =>
    point.y === crossingCell.y + 2
  );
  const withNearCar = {
    ...entry,
    movers: entry.movers.map(mover =>
      mover.id === carPath.id
        ? { ...mover, pathIndex: nearIndex, heading: carPath.headings[nearIndex] }
        : mover
    )
  };
  const blocked = attemptSafetyMove(withNearCar, "right");
  assert.deepEqual(blocked.event, { type: "blocked", reason: "car-close" });

  const farIndex = carPath.points.findIndex(point =>
    Math.abs(point.y - crossingCell.y) > 6 &&
    Math.abs(point.y - (crossingCell.y + 7)) > 6
  );
  const withFarCars = {
    ...entry,
    movers: entry.movers
      .filter(mover => mover.type !== "car" || mover.id === carPath.id)
      .map(mover =>
        mover.id === carPath.id
          ? { ...mover, pathIndex: farIndex, heading: carPath.headings[farIndex] }
          : mover
      )
  };
  const allowed = attemptSafetyMove(withFarCars, "right");
  assert.equal(allowed.event.type, "crossing-started");
});

test("무신호 자동차는 정지선에 멈추지 않고 느리게 순환하며 플레이어에게 양보한다", () => {
  const base = createSafetyRouteState("easy", { seed: 4 });
  const withSignalStop = {
    ...base,
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  };
  let state = withSignalStop;
  for (let elapsed = 0; elapsed < 1000; elapsed += 100) {
    state = advanceSafetyWorld(state, 100);
  }
  const cars = state.movers.filter(mover => mover.type === "car");
  assert.ok(cars.every(mover => mover.pathIndex > 0), "cars keep moving on red");
  assert.deepEqual(
    cars.map(mover => mover.pathIndex),
    [4, 4],
    "signalless cars move one cell per 250ms"
  );

  const carPath = base.map.trafficPaths.find(path => path.type === "car");
  const yieldState = {
    ...base,
    position: { ...carPath.points[1] },
    movers: base.movers.map(mover =>
      mover.id === carPath.id ? { ...mover, pathIndex: 0, elapsedMs: 240 } : mover
    )
  };
  const next = advanceSafetyWorld(yieldState, 100);
  const yielding = next.movers.find(mover => mover.id === carPath.id);
  assert.equal(yielding.pathIndex, 0, "car waits for player");
  assert.equal(yielding.stopped, true);
});

test("차근차근 지도는 버스 함대와 목표 번호를 제공하고 횡단보도를 막는다", () => {
  const state = createSafetyRouteState("steady", { seed: 9 });
  assert.equal(state.map.busMode, true);
  assert.ok([11, 85, 101, 105].includes(state.map.busTarget));
  assert.equal(
    state.map.trafficPaths.filter(path => path.type === "bus").length,
    4
  );

  const crossing = state.map.crossings[0];
  const crossingCell = crossing.cells
    .find(cell => cell.x === state.map.zones.road.x);
  const entry = {
    ...state,
    nextFriend: 6,
    position: { x: crossingCell.x - 1, y: crossingCell.y }
  };
  const blocked = attemptSafetyMove(entry, "right");
  assert.deepEqual(blocked.event, { type: "blocked", reason: "take-the-bus" });
});

test("정류장에서 선 목표 버스 쪽으로 방향키를 누르면 타고, 하차 정류장에 내린다", () => {
  const base = createSafetyRouteState("steady", { seed: 9 });
  const targetPath = base.map.trafficPaths.find(path =>
    path.type === "bus" && path.number === base.map.busTarget
  );
  const otherPath = base.map.trafficPaths.find(path =>
    path.type === "bus" && path.number !== base.map.busTarget
  );

  const waiting = {
    ...base,
    nextFriend: 6,
    position: { ...base.map.busStops.board },
    movers: base.movers.map(mover =>
      mover.id === targetPath.id
        ? { ...mover, pathIndex: targetPath.boardIndex, stopped: true, pauseMs: 100 }
        : mover
    )
  };
  const idle = advanceSafetyWorld(waiting, 100);
  assert.equal(idle.riding, null, "no boarding without a key press");

  const pressed = attemptSafetyMove(waiting, "right");
  assert.equal(pressed.event.type, "bus-boarded");
  assert.equal(pressed.event.number, base.map.busTarget);
  assert.equal(pressed.state.riding, targetPath.id);
  assert.equal(pressed.state.ridingDest, "alight");

  let riding = pressed.state;
  for (let tick = 0; tick < 200 && riding.riding; tick += 1) {
    riding = advanceSafetyWorld(riding, 250);
  }
  assert.equal(riding.riding, null);
  assert.deepEqual(riding.position, base.map.busStops.alight);

  const wrongWaiting = {
    ...base,
    nextFriend: 6,
    position: { ...base.map.busStops.board },
    movers: base.movers.map(mover =>
      mover.id === otherPath.id
        ? { ...mover, pathIndex: otherPath.boardIndex, stopped: true, pauseMs: 100 }
        : mover
    )
  };
  // 오답 버스는 전용 이벤트로 나간다. 예전에는 take-the-bus 로 떨어져 이미
  // 정류장에 선 아이에게 "정류장으로 가요"라는 정반대 안내를 했다(심층 검토 P1-10).
  const wrongPressed = attemptSafetyMove(wrongWaiting, "right");
  assert.equal(wrongPressed.event.type, "blocked");
  assert.equal(wrongPressed.event.reason, "wrong-bus");
  assert.equal(wrongPressed.event.number, otherPath.number, "어느 버스인지 실어 보낸다");
  assert.equal(wrongPressed.event.target, base.map.busTarget, "탈 버스 번호도 함께");
  assert.equal(wrongPressed.state.riding, null, "오답 버스에는 타지 않는다");
});

test("건너편 10번 친구를 데리러 하차 정류장에서 같은 버스를 타고 돌아온다", () => {
  const base = createSafetyRouteState("steady", { seed: 9 });
  const friendTen = base.map.friends.find(friend => friend.number === 10);
  assert.ok(friendTen.x < base.map.zones.road.x, "friend 10 waits across");
  const targetPath = base.map.trafficPaths.find(path =>
    path.type === "bus" && path.number === base.map.busTarget
  );

  const returning = {
    ...base,
    nextFriend: 10,
    position: { ...base.map.busStops.alight },
    movers: base.movers.map(mover =>
      mover.id === targetPath.id
        ? { ...mover, pathIndex: targetPath.alightIndex, stopped: true, pauseMs: 100 }
        : mover
    )
  };
  const pressed = attemptSafetyMove(returning, "left");
  assert.equal(pressed.event.type, "bus-boarded");
  assert.equal(pressed.state.riding, targetPath.id);
  assert.equal(pressed.state.ridingDest, "board");

  let riding = pressed.state;
  for (let tick = 0; tick < 200 && riding.riding; tick += 1) {
    riding = advanceSafetyWorld(riding, 250);
  }
  assert.equal(riding.riding, null);
  assert.deepEqual(riding.position, base.map.busStops.board);
});

test("친구 2~5를 만나기 전에는 버스에 타지 않는다", () => {
  const base = createSafetyRouteState("steady", { seed: 9 });
  const targetPath = base.map.trafficPaths.find(path =>
    path.type === "bus" && path.number === base.map.busTarget
  );
  const early = {
    ...base,
    nextFriend: 3,
    position: { ...base.map.busStops.board },
    movers: base.movers.map(mover =>
      mover.id === targetPath.id
        ? { ...mover, pathIndex: targetPath.boardIndex, stopped: true, pauseMs: 100 }
        : mover
    )
  };
  assert.equal(advanceSafetyWorld(early, 100).riding, null);
  const pressed = attemptSafetyMove(early, "right");
  assert.equal(pressed.event.type, "blocked");
  assert.equal(pressed.event.reason, "left-friends-first");
  assert.equal(pressed.state.riding, null);
});

test("버스 안내 세 가지는 모두 음성을 갖는다 — 글만으로는 전달되지 않는다", () => {
  // 심층 검토 P1-10: bus-stop·bus-boarded 는 voiceKey: null 이었고, 오답 버스는
  // 안내 자체가 정반대였다. 글 못 읽는 아이에게 조작법 전달 수단이 0이었다.
  const stop = safetyCueForEvent({ type: "bus-stop", target: 101 }, 6);
  assert.equal(stop.voiceKey, "safety-bus-stop");
  const boarded = safetyCueForEvent({ type: "bus-boarded", number: 101 }, 6);
  assert.equal(boarded.voiceKey, "safety-bus-boarded");
  const wrong = safetyCueForEvent(
    { type: "blocked", reason: "wrong-bus", number: 85, target: 101 }, 6);
  assert.equal(wrong.voiceKey, "safety-wrong-bus");
  assert.match(wrong.message, /85번이에요/);
  assert.match(wrong.message, /101번을 타요/);
});

test("도전 지도의 목표 안내는 학교가 아니라 기차역을 말한다", () => {
  // 심층 검토 P1-7: 실제 목적지는 수서역인데 모든 안내가 "학교"였다.
  const school = safetyCueForEvent({ type: "friend", number: 10 }, 11, "school");
  assert.equal(school.voiceKey, "safety-next-10");
  const station = safetyCueForEvent({ type: "friend", number: 10 }, 11, "station");
  assert.equal(station.voiceKey, "safety-next-station");
  assert.match(station.message, /기차역/);
});

// 심층 검토 P1-12. 무신호 횡단보도에는 안전한 틈이 무작위로만 생겼고, 막힐 때마다
// "차가 지나간 다음에 건너요"라고만 안내했다. 그래서 안내를 잘 따르는 아이일수록
// 오래 갇혔다 — 계속 누르는 아이는 3.1초, 2초씩 기다리는 아이는 29.1초가 걸렸다.
// 실제 도로교통법(제27조)대로 차가 정지선에서 양보하게 만들어 기다림을 유한하게 한다.
function obedientCrossingMs(difficulty, seed) {
  let state = createSafetyRouteState(difficulty, { seed });
  const cells = [...state.map.crossings[0].cells].sort((a, b) => a.x - b.x);
  const entry = { x: cells[0].x - 1, y: cells[0].y };
  const exitX = cells[cells.length - 1].x + 1;
  state = {
    ...state,
    position: entry,
    nextFriend: 6,
    collected: [1, 2, 3, 4, 5],
    checkedEntrance:
      state.map.entrances.find(item => item.x === entry.x && item.y === entry.y)
        ?.id ?? null
  };
  let elapsed = 0;
  let cooldown = 0;
  while (elapsed < 60000 && state.position.x < exitX) {
    if (cooldown <= 0) {
      const result = attemptSafetyMove(state, "right");
      state = result.state;
      // 안내를 들은 아이는 2초쯤 기다렸다가 다시 누른다
      if (result.event.type === "blocked") cooldown = 2000;
    } else {
      cooldown -= 100;
    }
    state = advanceSafetyWorld(state, 100);
    elapsed += 100;
  }
  return state.position.x >= exitX ? elapsed : Number.POSITIVE_INFINITY;
}

test("기다리라는 안내를 따르는 아이도 10초 안에 무신호 횡단보도를 건넌다", () => {
  for (const difficulty of ["easy", "challenge"]) {
    for (let seed = 0; seed < 6; seed += 1) {
      const elapsed = obedientCrossingMs(difficulty, seed);
      assert.ok(
        elapsed <= 10000,
        `${difficulty}/seed ${seed}: 기다리는 아이가 ${elapsed}ms 갇혔다`
      );
    }
  }
});

test("횡단보도 앞에 아이가 서면 자동차가 정지선에 서고 건널 수 있다", () => {
  const base = createSafetyRouteState("easy", { seed: 4 });
  const cells = [...base.map.crossings[0].cells].sort((a, b) => a.x - b.x);
  let state = {
    ...base,
    nextFriend: 6,
    collected: [1, 2, 3, 4, 5],
    position: { x: cells[0].x - 1, y: cells[0].y }
  };
  for (let elapsed = 0; elapsed < 3000; elapsed += 100) {
    state = advanceSafetyWorld(state, 100);
  }
  const cars = state.movers.filter(mover => mover.type === "car");
  assert.ok(
    cars.some(mover => mover.stopped),
    "아이가 기다리면 자동차가 정지선에 선다"
  );
  const clearance = crossingClearance(state);
  assert.equal(clearance.crossingId, base.map.crossings[0].id);
  assert.equal(clearance.safe, true, "양보가 끝나면 건널 수 있다");
  assert.equal(attemptSafetyMove(state, "right").event.type, "crossing-started");
});

test("아이가 멀리 있으면 자동차는 양보하지 않고 계속 달린다", () => {
  let state = createSafetyRouteState("easy", { seed: 4 });
  for (let elapsed = 0; elapsed < 3000; elapsed += 100) {
    state = advanceSafetyWorld(state, 100);
  }
  const cars = state.movers.filter(mover => mover.type === "car");
  assert.ok(
    cars.every(mover => !mover.stopped),
    "빈 횡단보도에서는 차가 멈추지 않는다"
  );
  assert.equal(crossingClearance(state).crossingId, null);
});
