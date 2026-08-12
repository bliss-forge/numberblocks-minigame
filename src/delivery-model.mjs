// "택배 왔어요!" 상태 머신 — 목업 v3 의 다섯 단계를 그대로 옮긴 순수 모델.
//
// 한 건의 배송은 목표 호수 하나(예: 702)가 네 단계를 관통한다.
//   ① 단지 운전  : 방향키로 한 칸씩 몰아 702호 집에 도착 (5번 게임과 같은 문법)
//   ② 리듬 하역  : 박자에 맞춰 상자 셋을 카트에 싣기
//   ③ 엘리베이터 : 앞자리 7 을 눌러 7층으로
//   ④ 호수 찾기  : 701·702·703 중 702 문 앞에서 초인종
//   ⑤ 전달 순간  : 친구가 말한 물건을 골라 전달
// 다섯 건을 마치면 끝난다. 어디서 틀려도 벌점은 없다 — 다시 알려 주고 다시 시킨다.
//
// DOM 을 모른다. 씬은 여기서 나온 이벤트 배열만 보고 그린다.

import { mulberry } from "./ktx-route-data.mjs";
import { createRhythm, passBox, rhythmDone, tickBeat } from "./delivery-rhythm.mjs";

export const DELIVERY_TARGET = 5; // 배송 5건이면 하루 끝
export const STREAK_BONUS_SLOTS = 4; // §5 STEP 4 — 연속 성공 보너스 별 네 개

export const PARCELS = Object.freeze([
  Object.freeze({ id: "fruit", label: "과일 상자", emoji: "🍓" }),
  Object.freeze({ id: "cosmetic", label: "화장품 상자", emoji: "🧴" }),
  Object.freeze({ id: "toy", label: "장난감 상자", emoji: "🧸" }),
]);

// 받는 친구 — 디자인 락 §7 은 빨강 1번을 예시로 들고 "다양한 캐릭터가 등장할 수 있다"고 적었다.
// blocks 는 몸을 이루는 정사각 칸 수다 — 시안의 친구는 두 칸짜리다.
export const FRIENDS = Object.freeze([
  Object.freeze({ blocks: 2, color: "#f4544a", edge: "#cd382f" }),
  Object.freeze({ blocks: 2, color: "#ff9a3c", edge: "#d97516" }),
  Object.freeze({ blocks: 3, color: "#5cc45f", edge: "#3d9a41" }),
  Object.freeze({ blocks: 1, color: "#4a9fe8", edge: "#2f7cc0" }),
]);

// 지도 격자 — 디자인 락 §5 STEP 1 의 집 네 채·연못·나무 배치를 그대로 옮겼다.
export const GRID_COLUMNS = 5;
export const GRID_ROWS = 3;
export const TRUCK_START = Object.freeze({ x: 1, y: 1 });

// 집이 서는 칸. 순서는 지도 좌상 → 우 → 아래(601·503·702·401 자리)와 같다.
export const HOUSE_CELLS = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: 2, y: 0 }),
  Object.freeze({ x: 4, y: 0 }),
  Object.freeze({ x: 2, y: 2 }),
]);

// 트럭이 못 지나가는 칸 — 연못과 나무.
export const BLOCKED_CELLS = Object.freeze([
  Object.freeze({ x: 0, y: 2, kind: "pond" }),
  Object.freeze({ x: 4, y: 2, kind: "tree" }),
]);

// 난이도는 층수 범위만 바꾼다. 지도는 그대로다.
// 1층은 쓰지 않는다 — 목표가 1층이면 엘리베이터가 이미 도착해 있어 단계가 사라진다.
export const LOWEST_FLOOR = 2;
const TOP_FLOOR = Object.freeze({ easy: 5, steady: 7, challenge: 7 });

const STEPS = Object.freeze({
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
});

export const DIRECTIONS = Object.freeze(Object.keys(STEPS));

/* ── 격자 도우미 ──────────────────────────────────────────────────── */

function samePoint(a, b) {
  return Boolean(a) && Boolean(b) && a.x === b.x && a.y === b.y;
}

function insideGrid(point) {
  return point.x >= 0 && point.x < GRID_COLUMNS && point.y >= 0 && point.y < GRID_ROWS;
}

export function blockedAt(point) {
  return BLOCKED_CELLS.find(cell => samePoint(cell, point)) ?? null;
}

export function houseAt(state, point) {
  return state.houses.find(house => samePoint(house.cell, point)) ?? null;
}

/* ── 배송 건 만들기 ───────────────────────────────────────────────── */

function pickDistinctFloors(random, topFloor, count) {
  const pool = Array.from(
    { length: topFloor - LOWEST_FLOOR + 1 },
    (unused, index) => index + LOWEST_FLOOR
  );
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function createHouses(random, difficulty) {
  const topFloor = TOP_FLOOR[difficulty] ?? TOP_FLOOR.steady;
  const floors = pickDistinctFloors(random, topFloor, HOUSE_CELLS.length);
  // 층이 겹치지 않게 뽑은 뒤 집마다 다른 자리에 배치한다 — 앞자리 하나로 층이 정해지도록.
  for (let index = floors.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [floors[index], floors[swap]] = [floors[swap], floors[index]];
  }
  return HOUSE_CELLS.map((cell, index) => {
    const floor = floors[index];
    const room = 1 + Math.floor(random() * 3);
    return { cell, floor, room, unit: floor * 100 + room };
  });
}

function createOrder(state) {
  state.houses = createHouses(state.random, state.difficulty);
  const target = state.houses[Math.floor(state.random() * state.houses.length)];
  const parcel = PARCELS[Math.floor(state.random() * PARCELS.length)];
  const friend = FRIENDS[Math.floor(state.random() * FRIENDS.length)];

  state.order = {
    unit: target.unit,
    floor: target.floor,
    room: target.room,
    cell: target.cell,
    parcel: parcel.id,
    friend,
    mistakes: 0,
    missed: [],
  };

  state.phase = "drive";
  state.drive = { truck: { ...TRUCK_START }, facing: "idle" };
  // 도착하면 트럭 뒤에서 상자를 내린다 — 박자에 맞춰 셋.
  state.rhythm = createRhythm();
  state.elevator = { current: 1, target: target.floor, pressed: null };
  // 복도 문패는 목표 층의 1·2·3 호다. 목표만 빛난다.
  state.corridor = {
    units: [target.floor * 100 + 1, target.floor * 100 + 2, target.floor * 100 + 3],
    focus: 0,
  };
  // 트레이 순서는 디자인 락 §5 STEP 4 그대로 과일 → 화장품 → 장난감 고정.
  state.handover = { tray: PARCELS.map(item => item.id), focus: 0 };
}

export function createDelivery(difficulty = "steady", seed = 1) {
  const state = {
    difficulty,
    seed,
    random: mulberry((Number(seed) || 0) + 17),
    delivered: 0,
    stars: 0,
    streak: 0,
    phase: "drive",
    finale: null,
    houses: [],
    order: null,
    drive: null,
    elevator: null,
    corridor: null,
    handover: null,
  };
  createOrder(state);
  return state;
}

export function currentOrder(state) {
  return state.order;
}

export function parcelById(id) {
  return PARCELS.find(item => item.id === id) ?? null;
}

/* ── ① 단지 운전 ─────────────────────────────────────────────────── */

// 안전한 길찾기(5번)와 같은 문법이다: 방향키 한 번에 한 칸씩, 바로 움직인다.
// 명령을 쌓았다가 한 번에 실행하지 않는다 — 누른 대로 즉시 굴러가야
// 네 살이 "내가 몰고 있다"고 느낀다.
export function driveStep(state, direction) {
  if (state.phase !== "drive" || !STEPS[direction]) return [];

  const step = STEPS[direction];
  const from = state.drive.truck;
  const next = { x: from.x + step.x, y: from.y + step.y };

  // 방향은 못 가는 쪽이라도 돌아본다 — 차가 바라보는 곳이 곧 다음에 갈 곳이다.
  state.drive.facing = direction;

  if (!insideGrid(next)) {
    return [{ type: "drive-edge", direction }];
  }
  const wall = blockedAt(next);
  if (wall) {
    return [{ type: "drive-blocked", direction, kind: wall.kind }];
  }

  state.drive.truck = next;

  const house = houseAt(state, next);
  if (!house) {
    return [{ type: "drive-step", at: { ...next }, facing: direction }];
  }

  if (house.unit !== state.order.unit) {
    // 같은 집을 오갈 때마다 실수가 쌓이면 보너스가 억울하게 끊긴다.
    // 한 배송에서 같은 집은 한 번만 센다.
    const first = !state.order.missed.includes(house.unit);
    if (first) {
      state.order.missed.push(house.unit);
      state.order.mistakes += 1;
    }
    return [
      { type: "drive-step", at: { ...next }, facing: direction },
      { type: "drive-miss", unit: house.unit, want: state.order.unit, first },
    ];
  }

  // 도착 다음은 곧장 엘리베이터가 아니라 하역이다 — 상자를 내려야 실어 올린다.
  state.phase = "rhythm";
  return [
    { type: "drive-step", at: { ...next }, facing: direction },
    { type: "drive-arrived", unit: house.unit, floor: state.order.floor },
  ];
}

/* ── ② 리듬 하역 ─────────────────────────────────────────────────── */

// 무대가 열린 뒤 흐른 밀리초를 앱이 넣어 준다. 모델은 시계를 모른다.
export function passRhythmBox(state, elapsedMs) {
  if (state.phase !== "rhythm") return [];
  return passBox(state.rhythm, elapsedMs);
}

export function tickRhythm(state, elapsedMs) {
  if (state.phase !== "rhythm") return [];
  return tickBeat(state.rhythm, elapsedMs);
}

// 상자를 다 내리면 카트를 밀고 승강기로 간다.
export function boardElevator(state) {
  if (state.phase !== "rhythm" || !rhythmDone(state.rhythm)) return [];
  state.phase = "elevator";
  return [{ type: "rhythm-boarding", floor: state.order.floor }];
}

/* ── ② 엘리베이터 ────────────────────────────────────────────────── */

export function pressFloor(state, digit) {
  if (state.phase !== "elevator") return [];
  const floor = Number(digit);
  if (!Number.isInteger(floor) || floor < 1 || floor > 9) return [];

  if (floor !== state.elevator.target) {
    state.order.mistakes += 1;
    state.elevator.pressed = floor;
    return [{ type: "floor-wrong", digit: floor, target: state.elevator.target }];
  }

  const from = state.elevator.current;
  state.elevator.pressed = floor;
  state.elevator.current = floor;
  state.phase = "corridor";
  return [
    { type: "floor-correct", floor },
    { type: "elevator-arrived", from, to: floor },
  ];
}

/* ── ③ 호수 찾기 ─────────────────────────────────────────────────── */

export function moveCorridorFocus(state, delta) {
  if (state.phase !== "corridor") return [];
  const last = state.corridor.units.length - 1;
  const next = Math.min(last, Math.max(0, state.corridor.focus + Math.sign(delta)));
  if (next === state.corridor.focus) {
    return [{ type: "corridor-edge", index: next }];
  }
  state.corridor.focus = next;
  return [{ type: "corridor-focus", index: next, unit: state.corridor.units[next] }];
}

export function ringBell(state) {
  if (state.phase !== "corridor") return [];
  const unit = state.corridor.units[state.corridor.focus];
  if (unit !== state.order.unit) {
    state.order.mistakes += 1;
    return [{ type: "corridor-wrong", unit, want: state.order.unit }];
  }
  state.phase = "handover";
  return [{ type: "corridor-correct", unit }];
}

/* ── ④ 전달 순간 ─────────────────────────────────────────────────── */

export function moveTrayFocus(state, delta) {
  if (state.phase !== "handover") return [];
  const last = state.handover.tray.length - 1;
  const next = Math.min(last, Math.max(0, state.handover.focus + Math.sign(delta)));
  if (next === state.handover.focus) {
    return [{ type: "tray-edge", index: next }];
  }
  state.handover.focus = next;
  return [{ type: "tray-focus", index: next, parcel: state.handover.tray[next] }];
}

export function deliverParcel(state) {
  if (state.phase !== "handover") return [];
  const picked = state.handover.tray[state.handover.focus];
  if (picked !== state.order.parcel) {
    state.order.mistakes += 1;
    return [{ type: "parcel-wrong", picked, want: state.order.parcel }];
  }

  const perfect = state.order.mistakes === 0;
  state.delivered += 1;
  state.stars += 1;
  state.streak = perfect ? Math.min(STREAK_BONUS_SLOTS, state.streak + 1) : 0;

  const events = [
    { type: "parcel-correct", parcel: picked },
    {
      type: "delivered",
      delivered: state.delivered,
      stars: state.stars,
      streak: state.streak,
      perfect,
    },
  ];

  if (state.delivered >= DELIVERY_TARGET) {
    state.phase = "finale";
    state.finale = { delivered: state.delivered, stars: state.stars, streak: state.streak };
    events.push({ type: "finale", ...state.finale });
    return events;
  }

  createOrder(state);
  events.push({ type: "next-order", unit: state.order.unit, index: state.delivered + 1 });
  return events;
}

/* ── 씬이 쓰는 읽기 전용 조회 ─────────────────────────────────────── */

export function deliveryProgress(state) {
  return { delivered: state.delivered, target: DELIVERY_TARGET };
}

export function focusedUnit(state) {
  return state.phase === "corridor" ? state.corridor.units[state.corridor.focus] : null;
}

export function focusedParcel(state) {
  return state.phase === "handover" ? state.handover.tray[state.handover.focus] : null;
}
