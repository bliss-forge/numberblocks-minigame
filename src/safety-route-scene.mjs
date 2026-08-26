import { characterAsset } from "./character-spec.mjs";
import { moverPoint } from "./safety-route-movers.mjs";
import { crossingClearance } from "./safety-route-model.mjs";
import {
  bicycleSvg,
  busShelterSvg,
  busSvg,
  carSvg,
  goalStarSvg,
  raisedHandSvg,
  scooterSvg
} from "./safety-route-art.mjs";
import { renderMinimap, updateMinimap } from "./safety-route-minimap.mjs";
import { busStopForNextTarget } from "./safety-route-model.mjs";

const MOVER_ART = Object.freeze({
  car: carSvg,
  bicycle: bicycleSvg,
  scooter: scooterSvg
});

const PLACE_LABELS = Object.freeze({
  home: "우리 집",
  daycare: "어린이집",
  shops: "상가",
  roadside: "길가",
  park: "공원",
  "bus-stop": "버스 정류장",
  library: "도서관",
  shop: "가게",
  construction: "공사 구간",
  crossing: "횡단보도",
  school: "학교",
  station: "수서역"
});

const HAZARD_LABELS = Object.freeze({
  manhole: "열린 맨홀",
  construction: "공사 차단봉",
  scooter: "헬멧을 쓴 어린이의 킥보드",
  bicycle: "헬멧을 쓴 어린이의 자전거",
  car: "도로 자동차"
});

function placeAt(node, point) {
  node.style.setProperty("--route-x", point.x + 1);
  node.style.setProperty("--route-y", point.y + 1);
  return node;
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function cellsIn(rectangles) {
  return new Set(rectangles.flatMap(rectangle =>
    Array.from({ length: rectangle.width * rectangle.height }, (_, index) => {
      const x = rectangle.x + (index % rectangle.width);
      const y = rectangle.y + Math.floor(index / rectangle.width);
      return `${x},${y}`;
    })
  ));
}

function setWorldCamera(world, camera) {
  world.style.setProperty("--camera-x", camera.x);
  world.style.setProperty("--camera-y", camera.y);
}

function resolvedView(state, requestedView = {}) {
  return {
    camera: {
      x: 0,
      y: Math.max(0, state.map.height - 5),
      width: 7,
      height: 5,
      ...requestedView.camera
    },
    guidance: requestedView.guidance ?? [],
    targetArrow: requestedView.targetArrow ?? { visible: false }
  };
}

function characterImage(document, number, className) {
  const image = document.createElement("img");
  image.className = className;
  image.src = `assets/characters/${characterAsset(number)}`;
  image.alt = `숫자 ${number} 블록 친구`;
  image.dataset.number = String(number);
  image.addEventListener("error", () => {
    const fallback = document.createElement("strong");
    fallback.className = `${className} route-character-fallback`;
    fallback.textContent = String(number);
    fallback.dataset.number = String(number);
    image.replaceWith(fallback);
  }, { once: true });
  return image;
}

function routeCell(document, point, className = "") {
  const cell = document.createElement("div");
  cell.className = `route-cell ${className}`.trim();
  cell.setAttribute("aria-hidden", "true");
  return placeAt(cell, point);
}

function routeZone(document, name, zone, height) {
  const node = document.createElement("div");
  node.className = `route-zone route-zone-${name}`;
  node.setAttribute("aria-hidden", "true");
  node.style.setProperty("--route-x", zone.x + 1);
  node.style.setProperty("--route-y", (zone.y ?? 0) + 1);
  node.style.setProperty("--route-width", zone.width);
  node.style.setProperty("--route-height", zone.height ?? height);
  return node;
}

function signalNode(document, phase, className, point, accessible = false) {
  const signal = document.createElement("div");
  signal.className = className;
  signal.dataset.phase = phase;
  if (accessible) {
    signal.setAttribute("role", "img");
    signal.setAttribute(
      "aria-label",
      phase === "pedestrian-go" ? "초록 신호" : "빨간 신호"
    );
  } else {
    signal.setAttribute("aria-hidden", "true");
  }
  if (className === "route-signal-marker") {
    for (const lamp of ["stop", "go"]) {
      const node = document.createElement("span");
      node.className = `route-signal-lamp route-signal-lamp-${lamp}`;
      node.setAttribute("aria-hidden", "true");
      signal.append(node);
    }
  }
  return placeAt(signal, point);
}

function routePad(document) {
  const pad = document.createElement("div");
  pad.className = "route-pad";
  pad.setAttribute("aria-label", "길찾기 이동");

  for (const [direction, label, symbol] of [
    ["up", "위로 이동", "↑"],
    ["left", "왼쪽으로 이동", "←"],
    ["down", "아래로 이동", "↓"],
    ["right", "오른쪽으로 이동", "→"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.routeDirection = direction;
    button.setAttribute("aria-label", label);
    button.textContent = symbol;
    pad.append(button);
  }
  return pad;
}

export function renderSafetyRouteScene(document, state, requestedView = {}) {
  const view = resolvedView(state, requestedView);
  const root = document.createElement("div");
  root.className = "safety-route";

  const top = document.createElement("div");
  top.className = "safety-route-top";

  const goal = document.createElement("div");
  goal.className = "safety-goal";
  top.append(goal);

  const collected = document.createElement("div");
  collected.className = "safety-collected";
  top.append(collected);
  const minimap = renderMinimap(document, state);
  top.append(minimap);
  root.append(top);

  const viewport = document.createElement("div");
  viewport.className = "safety-grid safety-viewport";
  viewport.style.setProperty("--viewport-cols", view.camera.width);
  viewport.style.setProperty("--viewport-rows", view.camera.height);

  const world = document.createElement("div");
  world.className = "safety-world";
  world.style.setProperty("--world-cols", state.map.width);
  world.style.setProperty("--world-rows", state.map.height);
  const cameraStart = requestedView.cameraStart ?? view.camera;
  setWorldCamera(world, cameraStart);

  for (const name of ["left", "road", "right"]) {
    const zone = state.map.zones?.[name];
    if (zone) world.append(routeZone(document, name, zone, state.map.height));
  }

  const crossingIds = new Map(
    state.map.crossings.flatMap(crossing =>
      crossing.cells.map(point => [pointKey(point), crossing.id])
    )
  );
  const alleyKeys = cellsIn(state.map.alleys);
  const crossingNodes = new Map();
  state.map.roadCells.forEach(point => {
    const crossingId = crossingIds.get(pointKey(point));
    const className = crossingId
      ? "route-road route-crosswalk"
      : "route-road";
    const node = routeCell(document, point, className);
    const lane = state.map.lanes.find(item =>
      point.x >= item.x && point.x < item.x + item.width
    );
    node.dataset.lane = lane?.id ?? "";
    node.dataset.roadPosition = [
      "outer-left", "center-left", "center-right", "outer-right"
    ][point.x - state.map.zones.road.x] ?? "";
    if (crossingId) {
      node.dataset.crossingId = crossingId;
      const group = crossingNodes.get(crossingId) ?? [];
      group.push(node);
      crossingNodes.set(crossingId, group);
    }
    world.append(node);
  });

  state.map.pedestrianCells.forEach(point => {
    if (!crossingIds.has(pointKey(point))) {
      const className = alleyKeys.has(pointKey(point))
        ? "route-sidewalk route-alley"
        : "route-sidewalk route-walkway";
      world.append(routeCell(document, point, className));
    }
  });

  const stopLines = new Set();
  state.map.trafficPaths
    .filter(path => path.type === "car")
    .forEach(path => {
      (path.stopIndices ?? [path.stopIndex]).forEach(index => {
        const stopPoint = path.points[index];
        const key = stopPoint && `${stopPoint.x},${stopPoint.y}`;
        if (stopPoint && !stopLines.has(key)) {
          stopLines.add(key);
          world.append(routeCell(document, stopPoint, "route-stop-line"));
        }
      });
    });

  state.map.entrances.forEach(entrance => {
    world.append(routeCell(document, entrance, "route-entrance"));
  });

  state.map.places.forEach(place => {
    const node = document.createElement("div");
    node.className = `route-building route-building-${place.type}`;
    node.style.setProperty("--route-x", place.x + 1);
    node.style.setProperty("--route-y", place.y + 1);
    node.style.setProperty("--route-width", place.width);
    node.style.setProperty("--route-height", place.height);
    node.setAttribute("role", "img");
    node.setAttribute(
      "aria-label",
      place.label ?? PLACE_LABELS[place.type] ?? place.type
    );

    const roof = document.createElement("div");
    roof.className = "route-building-roof";
    roof.setAttribute("aria-hidden", "true");
    const sign = document.createElement("div");
    sign.className = "route-building-sign";
    sign.textContent = place.label ?? PLACE_LABELS[place.type] ?? place.type;
    sign.setAttribute("aria-hidden", "true");
    const door = document.createElement("div");
    door.className = "route-building-door";
    door.setAttribute("aria-hidden", "true");
    node.append(roof, sign, door);
    for (let index = 0; index < 2; index += 1) {
      const routeWindow = document.createElement("div");
      routeWindow.className = "route-building-window";
      routeWindow.setAttribute("aria-hidden", "true");
      node.append(routeWindow);
    }
    if (place.type === "school") {
      const clock = document.createElement("div");
      clock.className = "route-building-school-clock";
      clock.setAttribute("aria-hidden", "true");
      const flag = document.createElement("div");
      flag.className = "route-building-school-flag";
      flag.setAttribute("aria-hidden", "true");
      node.append(clock, flag);
    }
    if (place.type === "station") {
      const canopy = document.createElement("div");
      canopy.className = "route-building-station-canopy";
      canopy.setAttribute("aria-hidden", "true");
      const logo = document.createElement("div");
      logo.className = "route-building-station-logo";
      logo.textContent = "SRT";
      logo.setAttribute("aria-hidden", "true");
      node.append(canopy, logo);
    }
    world.append(node);
  });

  (state.map.props ?? []).forEach(prop => {
    world.append(routeCell(document, prop, `route-prop route-prop-${prop.type}`));
  });

  let signalMarkers = [];
  if (!state.map.signalless) {
    signalMarkers = state.map.signalMarkers?.length
      ? state.map.signalMarkers.map(marker => {
        const node = signalNode(
          document,
          state.signal.phase,
          "route-signal-marker",
          marker,
          true
        );
        node.dataset.crossingId = marker.crossingId;
        node.dataset.side = marker.side;
        world.append(node);
        return node;
      })
      : [signalNode(
        document,
        state.signal.phase,
        "route-signal",
        state.map.signalGate,
        true
      )];
    if (!state.map.signalMarkers?.length) world.append(signalMarkers[0]);
  }

  state.map.hazards.forEach(hazard => {
    const cells = hazard.cells?.length ? hazard.cells : [hazard];
    cells.forEach(point => {
      const footprint = routeCell(
        document,
        point,
        `route-hazard-footprint route-hazard-footprint-${hazard.type}`
      );
      footprint.dataset.hazard = hazard.type;
      world.append(footprint);
    });

    const node = document.createElement("div");
    node.className = `route-hazard route-${hazard.type}`;
    node.dataset.hazard = hazard.type;
    node.style.setProperty(
      "--hazard-span",
      Math.max(...cells.map(point => point.y)) -
        Math.min(...cells.map(point => point.y)) + 1
    );
    node.setAttribute(
      "aria-label",
      HAZARD_LABELS[hazard.type] ?? hazard.type
    );
    node.setAttribute("role", "img");
    if (hazard.approachAnchor) {
      node.dataset.approachAnchor = pointKey(hazard.approachAnchor);
    }
    if (hazard.type === "manhole") {
      const lid = document.createElement("span");
      lid.className = "route-manhole-lid";
      lid.setAttribute("aria-hidden", "true");
      const cone = document.createElement("span");
      cone.className = "route-manhole-cone";
      cone.setAttribute("aria-hidden", "true");
      node.append(lid, cone);
    }
    world.append(placeAt(node, hazard.approachAnchor ?? hazard));
  });

  const moverNodes = new Map();
  state.movers.forEach(mover => {
    const point = moverPoint(state.map, mover);
    if (!point) return;
    const definition = state.map.trafficPaths.find(
      path => path.id === mover.id
    );
    const node = document.createElement("div");
    const riderClass = mover.type === "scooter" || mover.type === "bicycle"
      ? " route-moving-rider"
      : "";
    node.className = `route-hazard route-${mover.type}${riderClass}`;
    node.dataset.hazard = mover.type;
    if (mover.type === "bus") {
      node.dataset.busNumber = String(definition?.number ?? "");
      node.setAttribute("aria-label", `${definition?.number}번 버스`);
      node.innerHTML = busSvg(definition?.number ?? "");
    } else {
      node.setAttribute(
        "aria-label",
        HAZARD_LABELS[mover.type] ?? mover.type
      );
      node.innerHTML = (MOVER_ART[mover.type] ?? carSvg)();
    }
    node.setAttribute("role", "img");
    world.append(placeAt(node, point));
    moverNodes.set(mover.id, node);
  });

  if (state.map.busMode && state.map.busStops) {
    for (const [stopName, stopPoint] of [
      ["board", state.map.busStops.board],
      ["alight", state.map.busStops.alight]
    ]) {
      const stop = document.createElement("div");
      stop.className = `route-bus-stop-marker route-bus-stop-${stopName}`;
      stop.setAttribute("role", "img");
      stop.setAttribute(
        "aria-label",
        stopName === "board" ? "학교 방향 버스 정류장" : "돌아오는 버스 정류장"
      );
      const shelter = document.createElement("span");
      shelter.className = "route-bus-shelter";
      shelter.innerHTML = busShelterSvg();
      shelter.setAttribute("aria-hidden", "true");
      const sign = document.createElement("span");
      sign.className = "route-bus-stop-sign";
      sign.textContent = `${state.map.busTarget}번 타는 곳`;
      sign.setAttribute("aria-hidden", "true");
      stop.append(shelter, sign);
      world.append(placeAt(stop, stopPoint));
    }
  }

  const friendNodes = new Map();
  state.map.friends.forEach(friend => {
    const image = characterImage(
      document,
      friend.number,
      "route-character route-friend"
    );
    image.dataset.place = friend.place;
    world.append(placeAt(image, friend));
    friendNodes.set(friend.number, image);
  });

  const playerWrap = document.createElement("div");
  playerWrap.className = "route-player-wrap";
  const player = characterImage(
    document,
    1,
    "route-character route-player"
  );
  const playerHand = document.createElement("span");
  playerHand.className = "route-player-hand";
  playerHand.innerHTML = raisedHandSvg();
  playerHand.setAttribute("aria-hidden", "true");
  playerWrap.append(player, playerHand);
  world.append(placeAt(playerWrap, state.position));

  const goalMat = document.createElement("div");
  goalMat.className = "route-goal-mat";
  goalMat.setAttribute("aria-label", "학교 도착점");
  const goalStar = document.createElement("span");
  goalStar.className = "route-goal-star";
  goalStar.innerHTML = goalStarSvg();
  goalStar.setAttribute("aria-hidden", "true");
  const goalLabel = document.createElement("span");
  goalLabel.className = "route-goal-label";
  goalLabel.textContent = "도착";
  goalMat.append(goalStar, goalLabel);
  world.append(placeAt(goalMat, state.map.goal));

  const guidanceNodes = Array.from({ length: 3 }, () => {
    const node = routeCell(document, { x: 0, y: 0 }, "route-guidance-cell");
    node.hidden = true;
    world.append(node);
    return node;
  });

  viewport.append(world);
  const arrow = document.createElement("div");
  arrow.className = "route-target-arrow";
  arrow.setAttribute("aria-label", "다음 친구 방향");
  arrow.hidden = true;
  viewport.append(arrow);

  const pad = routePad(document);
  root.append(viewport, pad);
  root._safetyRouteView = {
    document,
    goal,
    collected,
    minimap,
    viewport,
    world,
    signalNodes: signalMarkers,
    crossingNodes,
    moverNodes,
    friendNodes,
    player: playerWrap,
    guidanceNodes,
    arrow,
    pad
  };
  updateSafetyRouteScene(root, state, {
    ...requestedView,
    camera: cameraStart
  });

  if (
    requestedView.cameraStart &&
    typeof requestedView.scheduleFrame === "function" &&
    (cameraStart.x !== view.camera.x || cameraStart.y !== view.camera.y)
  ) {
    requestedView.scheduleFrame(() => {
      setWorldCamera(world, view.camera);
    });
  }
  return root;
}

export function updateSafetyRouteScene(root, state, requestedView = {}) {
  const nodes = root?._safetyRouteView;
  if (!nodes) throw new TypeError("A mounted safety route scene is required");
  const view = resolvedView(state, requestedView);
  root.dataset.difficulty = state.difficulty;
  root.dataset.ceremony = state.ceremony?.stage ?? "";
  const waitingForBus = Boolean(busStopForNextTarget(state));
  nodes.goal.textContent = state.riding
    ? "버스를 타고 가요!"
    : waitingForBus
      ? `${state.map.busTarget}번 버스를 타요!`
      : state.nextFriend <= 10
        ? `다음은 ${state.nextFriend} 친구를 만나러 가요!`
        : "친구들과 학교로 가요!";
  root.dataset.riding = state.riding ? "true" : "";

  const collectedKey = state.collected.join(",");
  if (nodes.collected.dataset.numbers !== collectedKey) {
    nodes.collected.dataset.numbers = collectedKey;
    nodes.collected.setAttribute("aria-label", `만난 친구 ${collectedKey}`);
    nodes.collected.replaceChildren(...state.collected.map(number =>
      characterImage(nodes.document, number, "collected-friend")
    ));
  }

  nodes.viewport.style.setProperty("--viewport-cols", view.camera.width);
  nodes.viewport.style.setProperty("--viewport-rows", view.camera.height);
  setWorldCamera(nodes.world, view.camera);
  updateMinimap(nodes.minimap, state);

  // 글을 못 읽는 아이에게 "지금 건너도 된다"를 보여 준다 — 차가 정지선에 서면
  // 그 횡단보도만 초록으로 살아난다(심층 검토 P1-12, 음성과 짝).
  const clearance = crossingClearance(state);
  const readyId = clearance.waiting && clearance.safe ? clearance.crossingId : "";
  root.dataset.crossReady = readyId;
  nodes.crossingNodes.forEach((group, crossingId) => {
    group.forEach(node => {
      node.dataset.crossReady = crossingId === readyId ? "true" : "";
    });
  });

  nodes.signalNodes.forEach(node => {
    node.dataset.phase = state.signal.phase;
    node.setAttribute(
      "aria-label",
      state.signal.phase === "pedestrian-go" ? "초록 신호" : "빨간 신호"
    );
  });

  state.movers.forEach(mover => {
    const node = nodes.moverNodes.get(mover.id);
    const point = moverPoint(state.map, mover);
    if (!node || !point) return;
    const definition = state.map.trafficPaths.find(path => path.id === mover.id);
    placeAt(node, point);
    node.dataset.direction = String(mover.direction);
    node.dataset.stopped = String(Boolean(mover.stopped));
    node.dataset.heading =
      mover.heading ?? definition?.headings?.[mover.pathIndex] ?? "";
  });

  nodes.friendNodes.forEach((node, number) => {
    node.hidden = state.collected.includes(number);
  });
  placeAt(nodes.player, state.position);

  nodes.guidanceNodes.forEach((node, index) => {
    const point = view.guidance[index];
    node.hidden = !point;
    if (point) placeAt(node, point);
  });

  nodes.arrow.hidden = !view.targetArrow.visible;
  if (view.targetArrow.visible) {
    nodes.arrow.style.setProperty("--arrow-x", view.targetArrow.x);
    nodes.arrow.style.setProperty("--arrow-y", view.targetArrow.y);
    nodes.arrow.style.setProperty("--arrow-angle", `${view.targetArrow.angle}rad`);
  }
  return root;
}
