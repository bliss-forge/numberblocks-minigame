// "택배 왔어요!" 상태 머신 계약 — 시드 재현성 · 4단계 진행 · 벌점 없음 · 도달 가능성.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BLOCKED_CELLS,
  DELIVERY_TARGET,
  GRID_COLUMNS,
  GRID_ROWS,
  HOUSE_CELLS,
  LOWEST_FLOOR,
  PARCELS,
  STREAK_BONUS_SLOTS,
  TRUCK_START,
  blockedAt,
  createDelivery,
  deliverParcel,
  houseAt,
  moveCorridorFocus,
  moveTrayFocus,
  boardElevator,
  passRhythmBox,
  pressFloor,
  driveStep,
  ringBell,
} from "../src/delivery-model.mjs";
import { BEAT_MS, RHYTHM_TARGET } from "../src/delivery-rhythm.mjs";

const TOP_FLOOR = { easy: 5, steady: 7, challenge: 7 };

function typesOf(events) {
  return events.map(event => event.type);
}

// 목표 집까지 명령 몇 칸이면 닿는지 — 집 칸은 도착점이라 지나갈 수 없다.
function shortestMoves(goal) {
  const key = point => `${point.x},${point.y}`;
  const isHouse = point => HOUSE_CELLS.some(cell => cell.x === point.x && cell.y === point.y);
  const queue = [{ ...TRUCK_START, steps: 0 }];
  const seen = new Set([key(TRUCK_START)]);

  while (queue.length > 0) {
    const at = queue.shift();
    if (at.x === goal.x && at.y === goal.y) return at.steps;
    if (at.steps > 0 && isHouse(at)) continue; // 집에 들어서면 멈춘다
    for (const step of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }]) {
      const next = { x: at.x + step.x, y: at.y + step.y };
      if (next.x < 0 || next.x >= GRID_COLUMNS || next.y < 0 || next.y >= GRID_ROWS) continue;
      if (blockedAt(next)) continue;
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push({ ...next, steps: at.steps + 1 });
    }
  }
  return Infinity;
}

// 목표 집까지 실제로 몰고 간다. 테스트 전용 최단 경로 조종사.
function driveToTarget(state) {
  const goal = state.order.cell;
  let events = [];
  while (state.drive.truck.x !== goal.x) {
    events = driveStep(state, goal.x > state.drive.truck.x ? "right" : "left");
  }
  while (state.drive.truck.y !== goal.y) {
    events = driveStep(state, goal.y > state.drive.truck.y ? "down" : "up");
  }
  return events;
}

// 도착 다음은 리듬 하역이다. 판정을 시험하는 곳이 아니면 정박에 딱 맞춰 끝낸다.
function unload(state) {
  for (let index = 1; index <= RHYTHM_TARGET; index += 1) {
    passRhythmBox(state, index * BEAT_MS);
  }
  return boardElevator(state);
}

function completeDelivery(state) {
  driveToTarget(state);
  unload(state);
  pressFloor(state, state.order.floor);
  const wanted = state.corridor.units.indexOf(state.order.unit);
  while (state.corridor.focus < wanted) moveCorridorFocus(state, 1);
  ringBell(state);
  const slot = state.handover.tray.indexOf(state.order.parcel);
  while (state.handover.focus < slot) moveTrayFocus(state, 1);
  return deliverParcel(state);
}

/* ── 지도 · 도달 가능성 ──────────────────────────────────────────── */

test("모든 집이 도로를 따라 닿는다", () => {
  for (const cell of HOUSE_CELLS) {
    const steps = shortestMoves(cell);
    assert.ok(Number.isFinite(steps), `(${cell.x},${cell.y}) 로 가는 길이 없다`);
  }
});

test("트럭 출발점은 빈 길이고 격자 안이다", () => {
  assert.equal(blockedAt(TRUCK_START), null);
  assert.equal(HOUSE_CELLS.some(cell => cell.x === TRUCK_START.x && cell.y === TRUCK_START.y), false);
  assert.ok(TRUCK_START.x >= 0 && TRUCK_START.x < GRID_COLUMNS);
  assert.ok(TRUCK_START.y >= 0 && TRUCK_START.y < GRID_ROWS);
});

test("집과 막힌 칸이 겹치지 않는다", () => {
  for (const blocked of BLOCKED_CELLS) {
    assert.equal(
      HOUSE_CELLS.some(cell => cell.x === blocked.x && cell.y === blocked.y),
      false,
      `막힌 칸 (${blocked.x},${blocked.y}) 에 집이 있다`
    );
  }
});

/* ── 배송 건 생성 ────────────────────────────────────────────────── */

test("같은 시드는 같은 배송을 만든다", () => {
  const a = createDelivery("steady", 4242);
  const b = createDelivery("steady", 4242);
  assert.deepEqual(a.houses, b.houses);
  assert.equal(a.order.unit, b.order.unit);
  assert.equal(a.order.parcel, b.order.parcel);
});

test("집 네 채는 서로 다른 층을 갖고 난이도 상한을 넘지 않는다", () => {
  for (const [difficulty, topFloor] of Object.entries(TOP_FLOOR)) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = createDelivery(difficulty, seed);
      const floors = state.houses.map(house => house.floor);
      assert.equal(new Set(floors).size, HOUSE_CELLS.length, `${difficulty}/${seed}: 층이 겹친다`);
      for (const floor of floors) {
        assert.ok(
          floor >= LOWEST_FLOOR && floor <= topFloor,
          `${difficulty}/${seed}: ${floor}층은 범위 밖`
        );
      }
    }
  }
});

test("목표 층은 1층이 아니다 — 그러면 엘리베이터 단계가 사라진다", () => {
  for (const difficulty of ["easy", "steady", "challenge"]) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const state = createDelivery(difficulty, seed);
      assert.ok(state.order.floor >= LOWEST_FLOOR, `${difficulty}/${seed}: ${state.order.floor}층`);
      assert.ok(state.elevator.current < state.elevator.target, "출발층과 목표층이 같다");
    }
  }
});

test("목표 호수의 앞자리가 곧 목표 층이고 문패 셋 중 하나다", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const state = createDelivery("challenge", seed);
    assert.equal(Math.floor(state.order.unit / 100), state.order.floor);
    assert.equal(state.elevator.target, state.order.floor);
    assert.ok(state.corridor.units.includes(state.order.unit));
    assert.equal(state.corridor.units.length, 3);
    assert.ok(PARCELS.some(item => item.id === state.order.parcel));
  }
});

test("목표 집은 지도 위 실제 집이다", () => {
  const state = createDelivery("steady", 7);
  const house = houseAt(state, state.order.cell);
  assert.ok(house);
  assert.equal(house.unit, state.order.unit);
});

/* ── ① 단지 운전 ────────────────────────────────────────────────── */

test("방향키 한 번에 한 칸씩 바로 움직인다", () => {
  const state = createDelivery("easy", 3);
  const events = driveStep(state, "right");

  assert.deepEqual(typesOf(events), ["drive-step"]);
  assert.deepEqual(state.drive.truck, { x: TRUCK_START.x + 1, y: TRUCK_START.y });
  assert.equal(state.drive.facing, "right");
});

test("격자 밖이나 막힌 칸으로는 못 간다 — 제자리에서 방향만 돌아본다", () => {
  const state = createDelivery("easy", 5);
  state.drive.truck = { x: 0, y: 1 };
  assert.deepEqual(typesOf(driveStep(state, "left")), ["drive-edge"]);
  assert.deepEqual(state.drive.truck, { x: 0, y: 1 }, "막히면 제자리");
  assert.equal(state.drive.facing, "left", "가려던 쪽은 바라본다");

  const pond = createDelivery("easy", 5);
  pond.drive.truck = { x: 0, y: 1 };
  const blocked = driveStep(pond, "down"); // 연못
  assert.deepEqual(typesOf(blocked), ["drive-blocked"]);
  assert.equal(blocked[0].kind, "pond");
  assert.deepEqual(pond.drive.truck, { x: 0, y: 1 });
});

test("모르는 방향은 조용히 무시된다", () => {
  const state = createDelivery("easy", 3);
  assert.deepEqual(driveStep(state, "northwest"), []);
  assert.deepEqual(state.drive.truck, { ...TRUCK_START });
});

test("다른 집에 들어서면 벌점 없이 다시 하라고 한다", () => {
  const state = createDelivery("steady", 11);
  const other = state.houses.find(house => house.unit !== state.order.unit);
  state.drive.truck = { x: other.cell.x, y: 1 };
  const events = driveStep(state, other.cell.y === 0 ? "up" : "down");

  assert.ok(typesOf(events).includes("drive-miss"));
  assert.equal(state.phase, "drive", "단계는 그대로");
  assert.equal(state.stars, 0, "별을 뺏지 않는다");
  assert.equal(state.delivered, 0);
});

test("같은 집을 오가도 실수는 한 번만 센다", () => {
  // 실시간 주행이라 잘못 든 집을 몇 번이고 드나들 수 있다.
  // 드나든 횟수만큼 실수가 쌓이면 연속 성공 보너스가 억울하게 끊긴다.
  const state = createDelivery("steady", 2);
  const other = state.houses.find(house => house.unit !== state.order.unit && house.cell.y === 0);
  state.drive.truck = { x: other.cell.x, y: 1 };

  const first = driveStep(state, "up");
  assert.equal(first.find(event => event.type === "drive-miss").first, true);
  assert.equal(state.order.mistakes, 1);

  driveStep(state, "down");
  const again = driveStep(state, "up");
  assert.equal(again.find(event => event.type === "drive-miss").first, false);
  assert.equal(state.order.mistakes, 1, "같은 집을 또 밟았다고 실수가 늘면 안 된다");
});

test("목표 집에 닿으면 하역으로, 상자를 다 내리면 엘리베이터로 넘어간다", () => {
  const state = createDelivery("steady", 21);
  const events = driveToTarget(state);
  assert.ok(typesOf(events).includes("drive-arrived"));
  assert.equal(state.phase, "rhythm", "도착 다음은 하역이다");
  assert.deepEqual(state.drive.truck, { ...state.order.cell });

  assert.deepEqual(typesOf(unload(state)), ["rhythm-boarding"]);
  assert.equal(state.phase, "elevator");
});

test("도착한 뒤에는 방향키가 먹지 않는다", () => {
  const state = createDelivery("steady", 21);
  driveToTarget(state);
  assert.deepEqual(driveStep(state, "left"), [], "하역 중에 트럭이 움직이면 안 된다");
});

/* ── ② 엘리베이터 ───────────────────────────────────────────────── */

test("다른 층을 눌러도 벌점 없이 다시 누를 수 있다", () => {
  const state = createDelivery("challenge", 8);
  driveToTarget(state);
  unload(state);
  const wrong = state.order.floor === 9 ? 8 : state.order.floor + 1;

  const events = pressFloor(state, wrong);
  assert.deepEqual(typesOf(events), ["floor-wrong"]);
  assert.equal(state.phase, "elevator");
  assert.equal(state.stars, 0);

  assert.deepEqual(typesOf(pressFloor(state, state.order.floor)), ["floor-correct", "elevator-arrived"]);
  assert.equal(state.phase, "corridor");
  assert.equal(state.elevator.current, state.order.floor);
});

test("층 버튼은 1~9만 받는다", () => {
  const state = createDelivery("easy", 9);
  driveToTarget(state);
  unload(state);
  assert.deepEqual(pressFloor(state, 0), []);
  assert.deepEqual(pressFloor(state, 10), []);
  assert.deepEqual(pressFloor(state, "x"), []);
  assert.equal(state.phase, "elevator");
});

/* ── ③ 호수 찾기 ────────────────────────────────────────────────── */

test("복도 초점은 문 셋 사이에서만 움직인다", () => {
  const state = createDelivery("steady", 12);
  driveToTarget(state);
  unload(state);
  pressFloor(state, state.order.floor);

  assert.deepEqual(typesOf(moveCorridorFocus(state, -1)), ["corridor-edge"]);
  assert.equal(state.corridor.focus, 0);
  moveCorridorFocus(state, 1);
  moveCorridorFocus(state, 1);
  assert.equal(state.corridor.focus, 2);
  assert.deepEqual(typesOf(moveCorridorFocus(state, 1)), ["corridor-edge"]);
  assert.equal(state.corridor.focus, 2);
});

test("틀린 문에서 초인종을 눌러도 벌점이 없다", () => {
  const state = createDelivery("steady", 12);
  driveToTarget(state);
  unload(state);
  pressFloor(state, state.order.floor);
  const wrongIndex = state.corridor.units.findIndex(unit => unit !== state.order.unit);
  state.corridor.focus = wrongIndex;

  assert.deepEqual(typesOf(ringBell(state)), ["corridor-wrong"]);
  assert.equal(state.phase, "corridor");
  assert.equal(state.stars, 0);

  state.corridor.focus = state.corridor.units.indexOf(state.order.unit);
  assert.deepEqual(typesOf(ringBell(state)), ["corridor-correct"]);
  assert.equal(state.phase, "handover");
});

/* ── ④ 전달 순간 ────────────────────────────────────────────────── */

test("트레이 순서는 과일 · 화장품 · 장난감 고정이다", () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const state = createDelivery("steady", seed);
    assert.deepEqual(state.handover.tray, ["fruit", "cosmetic", "toy"]);
  }
});

test("다른 물건을 건네도 벌점 없이 다시 고를 수 있다", () => {
  const state = createDelivery("steady", 14);
  driveToTarget(state);
  unload(state);
  pressFloor(state, state.order.floor);
  state.corridor.focus = state.corridor.units.indexOf(state.order.unit);
  ringBell(state);

  state.handover.focus = state.handover.tray.findIndex(id => id !== state.order.parcel);
  assert.deepEqual(typesOf(deliverParcel(state)), ["parcel-wrong"]);
  assert.equal(state.phase, "handover");
  assert.equal(state.delivered, 0);
  assert.equal(state.stars, 0);
});

test("맞는 물건을 건네면 한 건이 끝나고 다음 배송이 온다", () => {
  const state = createDelivery("steady", 15);
  const events = completeDelivery(state);

  assert.ok(typesOf(events).includes("parcel-correct"));
  assert.ok(typesOf(events).includes("delivered"));
  assert.ok(typesOf(events).includes("next-order"));
  assert.equal(state.delivered, 1);
  assert.equal(state.stars, 1);
  assert.equal(state.phase, "drive", "다음 건은 다시 운전부터");
  assert.deepEqual(state.drive.truck, { ...TRUCK_START });
});

test("연속 성공 보너스는 실수 없이 끝낸 건만 센다", () => {
  const clean = createDelivery("steady", 16);
  completeDelivery(clean);
  assert.equal(clean.streak, 1);
  completeDelivery(clean);
  assert.equal(clean.streak, 2);

  // 같은 시드로 다시 시작해 층을 한 번 틀려 본다.
  const slipped = createDelivery("steady", 16);
  driveToTarget(slipped);
  unload(slipped);
  pressFloor(slipped, slipped.order.floor === 9 ? 8 : slipped.order.floor + 1); // 틀린 층
  pressFloor(slipped, slipped.order.floor);
  slipped.corridor.focus = slipped.corridor.units.indexOf(slipped.order.unit);
  ringBell(slipped);
  slipped.handover.focus = slipped.handover.tray.indexOf(slipped.order.parcel);
  deliverParcel(slipped);
  assert.equal(slipped.streak, 0, "실수한 건은 연속이 끊긴다");
  assert.equal(slipped.stars, 1, "그래도 별은 받는다");
});

test("보너스 별은 네 개를 넘지 않는다", () => {
  const state = createDelivery("steady", 17);
  for (let index = 0; index < DELIVERY_TARGET; index += 1) completeDelivery(state);
  assert.ok(state.streak <= STREAK_BONUS_SLOTS);
});

test("다섯 건을 마치면 피날레로 끝난다", () => {
  const state = createDelivery("steady", 18);
  let last = [];
  for (let index = 0; index < DELIVERY_TARGET; index += 1) last = completeDelivery(state);

  assert.equal(state.delivered, DELIVERY_TARGET);
  assert.equal(state.phase, "finale");
  assert.ok(typesOf(last).includes("finale"));
  assert.equal(typesOf(last).includes("next-order"), false);
  assert.deepEqual(state.finale, {
    delivered: DELIVERY_TARGET,
    stars: DELIVERY_TARGET,
    streak: state.streak,
  });
});

/* ── 단계 게이팅 · 벌점 없음 ─────────────────────────────────────── */

test("단계에 맞지 않는 조작은 조용히 무시된다", () => {
  const state = createDelivery("steady", 19);
  assert.deepEqual(pressFloor(state, 5), [], "운전 중에는 층 버튼이 없다");
  assert.deepEqual(ringBell(state), []);
  assert.deepEqual(moveCorridorFocus(state, 1), []);
  assert.deepEqual(moveTrayFocus(state, 1), []);
  assert.deepEqual(deliverParcel(state), []);

  driveToTarget(state);
  unload(state);
  assert.deepEqual(driveStep(state, "up"), [], "엘리베이터에서는 트럭이 움직이지 않는다");
});

test("어떤 실수도 별과 배송 수를 깎지 않는다", () => {
  const state = createDelivery("challenge", 20);
  completeDelivery(state);
  const stars = state.stars;
  const delivered = state.delivered;

  // 모든 단계에서 한 번씩 틀려 본다.
  state.drive.truck = { x: 0, y: 1 };
  driveStep(state, "left"); // 격자 밖 — 막힌다
  driveToTarget(state);
  unload(state);
  pressFloor(state, state.order.floor === 9 ? 8 : state.order.floor + 1);
  pressFloor(state, state.order.floor);
  state.corridor.focus = state.corridor.units.findIndex(unit => unit !== state.order.unit);
  ringBell(state);
  state.corridor.focus = state.corridor.units.indexOf(state.order.unit);
  ringBell(state);
  state.handover.focus = state.handover.tray.findIndex(id => id !== state.order.parcel);
  deliverParcel(state);

  assert.equal(state.stars, stars);
  assert.equal(state.delivered, delivered);
});
