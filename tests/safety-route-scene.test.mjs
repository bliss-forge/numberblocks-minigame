import test from "node:test";
import assert from "node:assert/strict";
import { createSafetyRouteState } from "../src/safety-route-model.mjs";
import {
  renderSafetyRouteScene,
  updateSafetyRouteScene
} from "../src/safety-route-scene.mjs";

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.dataset = {};
    this.style = new FakeStyle();
    this.children = [];
    this.attributes = new Map();
    this.textContent = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener() {}
}

const document = {
  activeElement: null,
  createElement(tagName) {
    return new FakeElement(tagName);
  }
};

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

function byClass(root, className) {
  return descendants(root).filter(node =>
    node.className.split(/\s+/).includes(className)
  );
}

function signalState(difficulty, options) {
  const seeded = createSafetyRouteState(difficulty, options);
  return { ...seeded, map: { ...structuredClone(seeded.map), signalless: false } };
}

test("길찾기 장면은 목표, 수집 행렬, 지도와 네 방향 버튼을 만든다", () => {
  const scene = renderSafetyRouteScene(
    document,
    createSafetyRouteState("easy")
  );

  assert.equal(scene.className, "safety-route");
  assert.equal(byClass(scene, "safety-grid").length, 1);
  assert.equal(byClass(scene, "safety-goal").length, 1);
  assert.match(byClass(scene, "safety-goal")[0].textContent, /2 친구/);
  assert.equal(byClass(scene, "route-player").length, 1);
  assert.equal(byClass(scene, "route-player")[0].dataset.number, "1");
  assert.equal(byClass(scene, "route-friend").length, 9);

  const directions = descendants(scene)
    .filter(node => node.dataset.routeDirection)
    .map(node => node.dataset.routeDirection)
    .sort();
  assert.deepEqual(directions, ["down", "left", "right", "up"]);
});

test("만난 친구는 지도에서 사라지고 상단 행렬에 표시된다", () => {
  const state = {
    ...createSafetyRouteState("easy"),
    collected: [1, 2, 3],
    nextFriend: 4
  };
  const scene = renderSafetyRouteScene(document, state);

  const mapNumbers = byClass(scene, "route-friend")
    .filter(node => !node.hidden)
    .map(node => Number(node.dataset.number))
    .sort((a, b) => a - b);
  const collectedNumbers = byClass(scene, "collected-friend")
    .map(node => Number(node.dataset.number));

  assert.deepEqual(mapNumbers, [4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(collectedNumbers, [1, 2, 3]);
});

test("난이도별 장애물과 두 차선 자동차를 장면에 표시한다", () => {
  const steady = renderSafetyRouteScene(
    document,
    createSafetyRouteState("steady")
  );
  assert.equal(byClass(steady, "route-manhole").length, 2);
  assert.equal(byClass(steady, "route-construction").length, 1);
  assert.equal(byClass(steady, "route-scooter").length, 1);
  assert.equal(byClass(steady, "route-bicycle").length, 1);

  const busScene = renderSafetyRouteScene(
    document,
    createSafetyRouteState("steady")
  );
  assert.equal(byClass(busScene, "route-bus").length, 4);
  assert.equal(byClass(busScene, "route-bus-stop-marker").length, 2);
  assert.equal(byClass(busScene, "route-bus-stop-sign").length, 2);
  byClass(busScene, "route-bus-stop-sign").forEach(sign => {
    assert.match(sign.textContent, /^\d+번 타는 곳$/, "both stops board");
  });
  assert.equal(byClass(busScene, "route-bus-shelter").length, 2);
  byClass(busScene, "route-bus-shelter").forEach(shelter => {
    assert.match(shelter.innerHTML ?? "", /route-art-bus-shelter/);
  });
  byClass(busScene, "route-bus").forEach(node => {
    assert.match(node.innerHTML ?? "", /route-art-bus/);
    assert.match(node.attributes.get("aria-label"), /^\d+번 버스$/);
  });

  const challenge = renderSafetyRouteScene(
    document,
    createSafetyRouteState("challenge")
  );
  assert.equal(byClass(challenge, "route-bicycle").length, 1);
  assert.equal(byClass(challenge, "route-car").length, 2);
  assert.equal(
    byClass(challenge, "route-building-station").length,
    1
  );
  assert.equal(byClass(challenge, "route-building-school").length, 0);
});

test("킥보드와 자전거에는 헬멧을 쓴 탑승자가 함께 표시된다", () => {
  const scene = renderSafetyRouteScene(
    document,
    createSafetyRouteState("easy", { seed: 3 })
  );
  for (const [vehicleClass, label] of [
    ["route-scooter", "헬멧을 쓴 어린이의 킥보드"],
    ["route-bicycle", "헬멧을 쓴 어린이의 자전거"]
  ]) {
    const vehicle = byClass(scene, vehicleClass)[0];
    assert.match(vehicle.innerHTML ?? "", /route-rider-helmet/);
    assert.equal(vehicle.attributes.get("aria-label"), label);
  }
  for (const [hazardClass, label] of [
    ["route-manhole", "열린 맨홀"],
    ["route-construction", "공사 차단봉"],
    ["route-car", "도로 자동차"]
  ]) {
    assert.equal(
      byClass(scene, hazardClass)[0].attributes.get("aria-label"),
      label
    );
  }
});

test("장면은 보도와 차도를 별도 레이어로 만들고 카메라 값을 노출한다", () => {
  const state = createSafetyRouteState("easy");
  const scene = renderSafetyRouteScene(document, state, {
    camera: { x: 3, y: 2, width: 7, height: 5 },
    guidance: [
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 6, y: 3 }
    ],
    targetArrow: { visible: true, x: 6.5, y: 2, angle: 0 }
  });

  assert.equal(byClass(scene, "safety-viewport").length, 1);
  assert.equal(byClass(scene, "safety-world").length, 1);
  assert.ok(byClass(scene, "route-sidewalk").length > 0);
  assert.ok(byClass(scene, "route-road").length > 0);
  assert.ok(byClass(scene, "route-crosswalk").length > 0);
  assert.ok(byClass(scene, "route-stop-line").length > 0);
  assert.equal(byClass(scene, "route-guidance-cell").length, 3);
  assert.equal(byClass(scene, "route-target-arrow").length, 1);

  const world = byClass(scene, "safety-world")[0];
  assert.equal(world.style.values.get("--camera-x"), "3");
  assert.equal(world.style.values.get("--camera-y"), "2");
});

test("장면은 차선과 보행 공간의 역할을 DOM에 표시한다", () => {
  const state = createSafetyRouteState("easy", { seed: 14 });
  const scene = renderSafetyRouteScene(
    document,
    state
  );
  const roadMetadata = {
    14: { lane: "northbound-lane", roadPosition: "outer-left" },
    15: { lane: "northbound-lane", roadPosition: "center-left" },
    16: { lane: "southbound-lane", roadPosition: "center-right" },
    17: { lane: "southbound-lane", roadPosition: "outer-right" }
  };
  const alleyKeys = new Set(state.map.alleys.flatMap(alley =>
    Array.from({ length: alley.width * alley.height }, (_, index) =>
      `${alley.x + (index % alley.width)},${alley.y + Math.floor(index / alley.width)}`
    )
  ));
  const crossingKeys = new Set(state.map.crossings.flatMap(crossing =>
    crossing.cells.map(cell => `${cell.x},${cell.y}`)
  ));

  for (const node of byClass(scene, "route-road")) {
    const x = Number(node.style.values.get("--route-x")) - 1;
    const y = Number(node.style.values.get("--route-y")) - 1;
    assert.equal(node.dataset.lane, roadMetadata[x].lane, `lane for ${x},${y}`);
    assert.equal(
      node.dataset.roadPosition,
      roadMetadata[x].roadPosition,
      `road position for ${x},${y}`
    );
  }
  assert.equal(byClass(scene, "route-crosswalk").length, 16);
  assert.ok(byClass(scene, "route-crosswalk").every(
    node => node.dataset.crossingId
  ));
  const sidewalkNodes = byClass(scene, "route-sidewalk");
  const expectedSidewalkKeys = state.map.pedestrianCells
    .map(cell => `${cell.x},${cell.y}`)
    .filter(key => !crossingKeys.has(key))
    .sort();
  assert.deepEqual(
    sidewalkNodes.map(node =>
      `${Number(node.style.values.get("--route-x")) - 1},${Number(node.style.values.get("--route-y")) - 1}`
    ).sort(),
    expectedSidewalkKeys
  );
  for (const node of sidewalkNodes) {
    const x = Number(node.style.values.get("--route-x")) - 1;
    const y = Number(node.style.values.get("--route-y")) - 1;
    const isAlley = alleyKeys.has(`${x},${y}`);
    assert.equal(
      node.className.split(/\s+/).includes("route-alley"),
      isAlley,
      `alley class for ${x},${y}`
    );
    assert.equal(
      node.className.split(/\s+/).includes("route-walkway"),
      !isAlley,
      `walkway class for ${x},${y}`
    );
  }
});

test("신호 단계를 색 외의 데이터로도 표시한다", () => {
  const vehicle = renderSafetyRouteScene(
    document,
    signalState("easy")
  );
  assert.equal(
    byClass(vehicle, "route-signal-marker")[0].dataset.phase,
    "vehicle-go"
  );

  const pedestrian = renderSafetyRouteScene(
    document,
    {
      ...signalState("easy"),
      signal: { phase: "pedestrian-go", elapsedMs: 0 }
    }
  );
  assert.equal(
    byClass(pedestrian, "route-signal-marker")[0].dataset.phase,
    "pedestrian-go"
  );
});

test("생성 장면은 위아래 횡단보도에 동기화된 보행 신호 표지를 그린다", () => {
  const state = {
    ...signalState("easy", { seed: 4 }),
    signal: { phase: "pedestrian-go", elapsedMs: 0 }
  };
  const scene = renderSafetyRouteScene(document, state);
  const markers = byClass(scene, "route-signal-marker");

  assert.equal(markers.length, 4);
  assert.deepEqual(markers.map(marker => ({
    crossingId: marker.dataset.crossingId,
    side: marker.dataset.side,
    x: marker.style.values.get("--route-x"),
    y: marker.style.values.get("--route-y")
  })), [
    { crossingId: "crossing-1", side: "left", x: "14", y: "4" },
    { crossingId: "crossing-1", side: "right", x: "19", y: "5" },
    { crossingId: "crossing-2", side: "left", x: "14", y: "11" },
    { crossingId: "crossing-2", side: "right", x: "19", y: "12" }
  ]);
  assert.deepEqual(markers.map(marker => marker.dataset.phase), [
    "pedestrian-go",
    "pedestrian-go",
    "pedestrian-go",
    "pedestrian-go"
  ]);
});

test("장면은 좌우 동네와 중앙 2차선 구역을 표시한다", () => {
  const scene = renderSafetyRouteScene(
    document,
    createSafetyRouteState("easy", { seed: 1 })
  );

  assert.equal(byClass(scene, "route-zone-left").length, 1);
  assert.equal(byClass(scene, "route-zone-road").length, 1);
  assert.equal(byClass(scene, "route-zone-right").length, 1);
  assert.equal(byClass(scene, "route-crosswalk").length, 16);
});

test("도로 배경은 이동체 경로가 없어도 전체 도로 칸을 표시한다", () => {
  const state = structuredClone(
    createSafetyRouteState("easy", { seed: 2 })
  );
  state.map.trafficPaths = [];
  state.movers = [];

  const scene = renderSafetyRouteScene(document, state);

  assert.equal(byClass(scene, "route-road").length, state.map.roadCells.length);
});

test("다칸 공사장은 발자국 전부를 막힘 레이어로 표시하고 그림은 한 번만 만든다", () => {
  const state = createSafetyRouteState("steady", { seed: 8 });
  const construction = state.map.hazards.find(
    item => item.type === "construction"
  );
  const scene = renderSafetyRouteScene(document, state);
  const constructionFootprints = byClass(scene, "route-hazard-footprint")
    .filter(node => node.dataset.hazard === "construction");

  assert.equal(constructionFootprints.length, construction.cells.length);
  assert.equal(byClass(scene, "route-construction").length, 1);
});

test("이동체는 방향과 정지 상태를 색 이외 데이터로 노출한다", () => {
  const state = structuredClone(
    createSafetyRouteState("challenge", { seed: 3 })
  );
  const riderIndex = state.movers.findIndex(
    mover => mover.type === "scooter" || mover.type === "bicycle"
  );
  state.movers[riderIndex] = {
    ...state.movers[riderIndex],
    direction: -1,
    stopped: true
  };

  const mover = byClass(
    renderSafetyRouteScene(document, state),
    "route-moving-rider"
  )[0];

  assert.ok(mover);
  assert.equal(mover.dataset.direction, "-1");
  assert.equal(mover.dataset.stopped, "true");
});

test("자동차 그림은 실제 이동 방향을 heading 속성으로 노출한다", () => {
  const state = createSafetyRouteState("easy", { seed: 3 });
  const cars = byClass(
    renderSafetyRouteScene(document, state),
    "route-car"
  );

  assert.deepEqual(cars.map(car => car.dataset.heading), ["north", "south"]);
});

test("지도가 입구 신호 표시를 제공하면 하나의 신호 상태를 두 곳에 그린다", () => {
  const state = structuredClone(signalState("easy", { seed: 4 }));
  state.map.signalMarkers = [
    { x: 13, y: 3 },
    { x: 18, y: 3 }
  ];

  const scene = renderSafetyRouteScene(document, state);

  assert.equal(byClass(scene, "route-signal").length, 0);
  assert.equal(byClass(scene, "route-signal-marker").length, 2);
  assert.deepEqual(
    byClass(scene, "route-signal-marker").map(node => node.dataset.phase),
    ["vehicle-go", "vehicle-go"]
  );
});

test("새로 삽입한 월드는 이전 카메라에서 시작해 다음 프레임에 같은 노드를 목표로 옮긴다", () => {
  const frames = [];
  const scene = renderSafetyRouteScene(
    document,
    createSafetyRouteState("easy", { seed: 5 }),
    {
      camera: { x: 8, y: 6, width: 7, height: 5 },
      cameraStart: { x: 5, y: 6 },
      scheduleFrame: callback => frames.push(callback)
    }
  );
  const stage = document.createElement("div");
  stage.append(scene);
  const world = byClass(stage, "safety-world")[0];

  assert.equal(world.style.values.get("--camera-x"), "5");
  assert.equal(world.style.values.get("--camera-y"), "6");
  assert.equal(frames.length, 1);

  frames[0]();

  assert.equal(byClass(stage, "safety-world")[0], world);
  assert.equal(world.style.values.get("--camera-x"), "8");
  assert.equal(world.style.values.get("--camera-y"), "6");
});

test("장애물과 신호와 이동체 그림은 레이블이 있는 이미지로 노출한다", () => {
  const state = structuredClone(
    createSafetyRouteState("challenge", { seed: 6 })
  );
  state.map.signalMarkers = [{ x: 13, y: 3 }, { x: 18, y: 3 }];
  const scene = renderSafetyRouteScene(document, state);

  for (const illustration of [
    ...byClass(scene, "route-hazard"),
    ...byClass(scene, "route-signal-marker")
  ]) {
    assert.equal(illustration.attributes.get("role"), "img");
    assert.ok(illustration.attributes.get("aria-label"));
  }
  for (const decoration of byClass(scene, "route-hazard-footprint")) {
    assert.equal(decoration.attributes.get("aria-hidden"), "true");
    assert.equal(decoration.attributes.has("role"), false);
  }
});

test("월드 틱 갱신 뒤에도 같은 장면과 방향 버튼이 유지되어 포커스를 잃지 않는다", () => {
  const state = signalState("easy", { seed: 9 });
  const scene = renderSafetyRouteScene(document, state, {
    camera: { x: 0, y: 1, width: 7, height: 5 }
  });
  const world = byClass(scene, "safety-world")[0];
  const button = descendants(scene).find(node => node.dataset.routeDirection === "right");
  const markers = byClass(scene, "route-signal-marker");
  document.activeElement = button;

  assert.equal(markers.length, 4);
  assert.ok(markers.every(marker => marker.attributes.get("role") === "img"));

  const updated = updateSafetyRouteScene(scene, {
    ...state,
    tick: 100,
    signal: { phase: "pedestrian-go", elapsedMs: 0 },
    movers: state.movers.map(mover => ({
      ...mover,
      pathIndex: mover.type === "car" ? 1 : mover.pathIndex
    }))
  }, {
    camera: { x: 1, y: 1, width: 7, height: 5 }
  });

  assert.strictEqual(updated, scene);
  assert.strictEqual(byClass(scene, "safety-world")[0], world);
  assert.strictEqual(
    descendants(scene).find(node => node.dataset.routeDirection === "right"),
    button
  );
  assert.strictEqual(document.activeElement, button);
  assert.equal(world.style.values.get("--camera-x"), "1");
  assert.ok(byClass(scene, "route-signal-marker").every(
    marker => marker.dataset.phase === "pedestrian-go"
  ));
  assert.ok(markers.every(
    marker => marker.attributes.get("aria-label") === "초록 신호"
  ));
});

test("건물은 풋프린트 블록으로 그려지고 학교는 랜드마크다", () => {
  const state = createSafetyRouteState("easy", { seed: 3 });
  const scene = renderSafetyRouteScene(document, state);
  const buildings = byClass(scene, "route-building");
  assert.equal(buildings.length, state.map.places.length);
  buildings.forEach(node => {
    assert.equal(byClass(node, "route-building-roof").length, 1);
    assert.equal(byClass(node, "route-building-door").length, 1);
    assert.ok(byClass(node, "route-building-sign")[0].textContent.length > 0);
  });
  const school = byClass(scene, "route-building-school")[0];
  assert.equal(school.style.values.get("--route-width"), "3");
  assert.equal(school.style.values.get("--route-height"), "3");
  assert.equal(byClass(school, "route-building-school-clock").length, 1);
  assert.equal(byClass(school, "route-building-school-flag").length, 1);
  const mat = byClass(scene, "route-goal-mat")[0];
  assert.match(
    byClass(mat, "route-goal-star")[0].innerHTML,
    /route-art-goal-star/
  );
  assert.equal(byClass(mat, "route-goal-label")[0].textContent, "도착");
  assert.equal(mat.style.values.get("--route-x"), String(state.map.goal.x + 1));
  assert.equal(byClass(scene, "route-place").length, 0);
  assert.equal(byClass(scene, "route-school-goal").length, 0);
  assert.equal(byClass(scene, "route-prop").length, state.map.props.length);
});

test("신호등은 두 램프를 가진 보행자 신호등이다", () => {
  const state = signalState("easy", { seed: 3 });
  const scene = renderSafetyRouteScene(document, state);
  const markers = byClass(scene, "route-signal-marker");
  assert.equal(markers.length, 4);
  markers.forEach(marker => {
    assert.equal(byClass(marker, "route-signal-lamp").length, 2);
    assert.equal(marker.dataset.phase, state.signal.phase);
  });
});

test("이동체와 공사장은 svg 아트로 그려진다", () => {
  const state = createSafetyRouteState("easy", { seed: 5 });
  const scene = renderSafetyRouteScene(document, state);
  const riders = byClass(scene, "route-moving-rider");
  assert.ok(riders.length >= 1);
  riders.forEach(node => {
    assert.match(node.innerHTML ?? "", /route-art-(bicycle|scooter)/);
  });
  const cars = byClass(scene, "route-car");
  assert.equal(cars.length, 2);
  cars.forEach(node => {
    assert.match(node.innerHTML ?? "", /route-art-car/);
  });
  assert.equal(byClass(scene, "route-rider-person").length, 0);
  const manhole = byClass(scene, "route-manhole")[0];
  assert.equal(byClass(manhole, "route-manhole-lid").length, 1);
  assert.equal(byClass(manhole, "route-manhole-cone").length, 1);
});

test("연출 상태가 플레이어 자세와 루트 데이터로 노출된다", () => {
  const state = createSafetyRouteState("easy", { seed: 3 });
  const scene = renderSafetyRouteScene(document, state);
  assert.equal(byClass(scene, "route-player-wrap").length, 1);
  const hand = byClass(scene, "route-player-hand")[0];
  assert.match(hand.innerHTML, /route-art-raised-hand/);
  updateSafetyRouteScene(scene, {
    ...state,
    ceremony: { stage: "looking", elapsedMs: 700 }
  });
  assert.equal(scene.dataset.ceremony, "looking");
  updateSafetyRouteScene(scene, { ...state, ceremony: null });
  assert.equal(scene.dataset.ceremony, "");
});

test("무신호 난이도 장면에는 신호등이 없고 미니맵 신호도 숨긴다", () => {
  for (const difficulty of ["easy", "steady", "challenge"]) {
    const scene = renderSafetyRouteScene(
      document,
      createSafetyRouteState(difficulty, { seed: 6 })
    );
    assert.equal(byClass(scene, "route-signal-marker").length, 0, difficulty);
    assert.equal(byClass(scene, "route-signal").length, 0, difficulty);
    assert.equal(byClass(scene, "route-minimap-signal")[0].hidden, true, difficulty);
  }
});

// 심층 검토 P1-12. 음성을 끈 아이도 "지금 건너도 된다"를 알아야 한다.
test("차가 정지선에 서면 그 횡단보도만 건널 수 있다고 표시한다", () => {
  const base = createSafetyRouteState("easy", { seed: 4 });
  const [first, second] = base.map.crossings;
  const cells = [...first.cells].sort((a, b) => a.x - b.x);
  const waiting = {
    ...base,
    nextFriend: 6,
    collected: [1, 2, 3, 4, 5],
    position: { x: cells[0].x - 1, y: cells[0].y },
    // 차를 모두 횡단보도에서 멀리 세워 둔다 = 양보가 끝난 상태
    movers: base.movers.map(mover =>
      mover.type === "car" ? { ...mover, stopped: true, pathIndex: 8 } : mover
    )
  };
  const scene = renderSafetyRouteScene(document, waiting);
  assert.equal(scene.dataset.crossReady, first.id);

  const ready = descendants(scene)
    .filter(node => node.dataset.crossReady === "true");
  assert.ok(ready.length > 0, "건널 수 있는 횡단보도가 표시된다");
  assert.ok(
    ready.every(node => node.dataset.crossingId === first.id),
    "아이가 서 있는 횡단보도만 초록이 된다"
  );
  assert.ok(
    descendants(scene).some(node => node.dataset.crossingId === second.id),
    "다른 횡단보도도 장면에는 있다"
  );

  updateSafetyRouteScene(scene, base);
  assert.equal(scene.dataset.crossReady, "", "아이가 떠나면 표시가 꺼진다");
});
