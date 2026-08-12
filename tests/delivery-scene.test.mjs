// 택배 씬 계약 — 네 단계가 정본 §5 레이아웃대로 서고, 손가락 조작이 빠지지 않는다.

import test from "node:test";
import assert from "node:assert/strict";
import {
  DELIVERY_TARGET,
  STREAK_BONUS_SLOTS,
  createDelivery,
  deliverParcel,
  moveCorridorFocus,
  moveTrayFocus,
  pressFloor,
  driveStep,
  ringBell,
  boardElevator,
  passRhythmBox,
} from "../src/delivery-model.mjs";
import { BEAT_MS, RHYTHM_TARGET } from "../src/delivery-rhythm.mjs";
import { DELIVERY_STEPS, deliveryCaption, renderDelivery } from "../src/delivery-scene.mjs";

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
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
    this.innerHTML = "";
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener() {}
}

const document = { createElement(tagName) { return new FakeElement(tagName); } };

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

function byClass(root, className) {
  return descendants(root).filter(node =>
    typeof node.className === "string" && node.className.split(" ").includes(className)
  );
}

function byData(root, key) {
  return descendants(root).filter(node => node.dataset?.[key] !== undefined);
}

function text(root, className) {
  return byClass(root, className).map(node => node.textContent);
}

function markup(root) {
  return descendants(root).map(node => node.innerHTML).join("");
}

// 목표 집까지 몰고 가는 테스트용 조종사.
function driveToTarget(state) {
  const goal = state.order.cell;
  const horizontal = goal.x - state.drive.truck.x;
  const vertical = goal.y - state.drive.truck.y;
  for (let i = 0; i < Math.abs(horizontal); i += 1) driveStep(state, horizontal > 0 ? "right" : "left");
  for (let i = 0; i < Math.abs(vertical); i += 1) driveStep(state, vertical > 0 ? "down" : "up");
}

// 도착 다음은 리듬 하역이다. 하역 자체를 보는 곳이 아니면 정박에 맞춰 끝낸다.
function unload(state) {
  for (let index = 1; index <= RHYTHM_TARGET; index += 1) passRhythmBox(state, index * BEAT_MS);
  boardElevator(state);
  return state;
}

function atRhythm(seed = 31) {
  const state = createDelivery("challenge", seed);
  driveToTarget(state);
  return state;
}

function atElevator(seed = 31) {
  return unload(atRhythm(seed));
}

function atCorridor(seed = 31) {
  const state = atElevator(seed);
  pressFloor(state, state.order.floor);
  return state;
}

function atHandover(seed = 31) {
  const state = atCorridor(seed);
  state.corridor.focus = state.corridor.units.indexOf(state.order.unit);
  ringBell(state);
  return state;
}

/* ── 공통 뼈대 ────────────────────────────────────────────────────── */

test("네 단계 모두 헤더 · 본문 · 하단 안내를 갖춘다", () => {
  const states = [createDelivery("steady", 3), atRhythm(), atElevator(), atCorridor(), atHandover()];
  for (const state of states) {
    const root = renderDelivery(document, state);
    const step = DELIVERY_STEPS[state.phase];

    assert.equal(root.dataset.phase, state.phase);
    assert.equal(byClass(root, "dv-head").length, 1, `${state.phase}: 헤더`);
    assert.equal(byClass(root, "dv-body").length, 1, `${state.phase}: 본문`);
    assert.equal(byClass(root, "dv-foot").length, 1, `${state.phase}: 하단`);
    assert.deepEqual(text(root, "dv-step"), [String(step.index)]);
    assert.deepEqual(text(root, "dv-stepname"), [step.name]);
    assert.equal(byClass(root, "dv-headline")[0].textContent, step.headline);
    assert.deepEqual(text(root, "dv-tip-line"), step.tip);
  }
});

test("마스코트는 기존 캐릭터 자산을 쓴다 — 새 이미지가 없다", () => {
  const root = renderDelivery(document, createDelivery("steady", 3));
  const mascot = byClass(root, "dv-mascot")[0];
  assert.equal(mascot.attributes.get("src"), "assets/characters/nine.png");
  assert.equal(mascot.attributes.get("alt"), "");
});

test("모든 조작 버튼은 button 이고 이름이 붙어 있다", () => {
  for (const state of [createDelivery("steady", 3), atRhythm(), atElevator(), atCorridor(), atHandover()]) {
    const root = renderDelivery(document, state);
    const actionable = descendants(root).filter(node =>
      node.dataset.dvDir || node.dataset.dvFloor ||
      node.dataset.dvBell || node.dataset.dvMove || node.dataset.dvBeat ||
      node.dataset.dvHorn
    );
    assert.ok(actionable.length > 0, `${state.phase}: 조작 버튼이 없다`);
    for (const node of actionable) {
      assert.equal(node.tagName, "BUTTON", `${state.phase}: ${node.className} 는 버튼이어야 한다`);
      assert.equal(node.attributes.get("type"), "button");
      assert.ok(node.attributes.get("aria-label"), `${state.phase}: ${node.className} 이름 없음`);
    }
  }
});

/* ── STEP 1 ───────────────────────────────────────────────────────── */

test("운전 화면은 목표·배송 수 카드와 지도, 방향 버튼을 세운다", () => {
  const state = createDelivery("steady", 3);
  const root = renderDelivery(document, state);

  assert.equal(root.dataset.step, "1");
  assert.deepEqual(text(root, "dv-card-title"), ["목표", "배송한 택배", "방향 버튼", "경적"]);
  assert.equal(byClass(root, "dv-goal-num")[0].textContent, `${state.order.unit}호`);
  assert.equal(byClass(root, "dv-progress")[0].textContent, `📦 0 / ${DELIVERY_TARGET}`);
  assert.equal(byClass(root, "dv-slot").length, 0, "명령을 쌓는 칸은 더 없다");
  assert.ok(markup(root).includes("dv-map"), "지도가 없다");
});

test("방향 버튼은 정본대로 네 방향이고, 출발 버튼은 없다", () => {
  const root = renderDelivery(document, createDelivery("steady", 3));
  const dirs = byData(root, "dvDir");
  assert.deepEqual(dirs.map(node => node.dataset.dvDir), ["up", "left", "right", "down"]);
  assert.deepEqual(dirs.map(node => node.textContent), ["↑", "←", "→", "↓"]);
  assert.equal(byData(root, "dvGo").length, 0, "누르면 바로 가므로 출발 버튼이 없다");
  assert.equal(byData(root, "dvHorn").length, 1, "경적 버튼이 없다");
});

test("방향 버튼을 누르면 트럭이 그 자리에서 한 칸 간다", () => {
  const state = createDelivery("steady", 3);
  const before = markup(renderDelivery(document, state));
  driveStep(state, "right");
  const after = markup(renderDelivery(document, state));

  assert.notEqual(before, after, "한 칸 갔으면 지도가 달라져야 한다");
});

test("하단에 배달한 택배 수가 붙는다", () => {
  const state = createDelivery("steady", 3);
  const root = renderDelivery(document, state);
  assert.equal(byClass(root, "dv-foot-extra")[0].textContent, `🚚 배달한 택배: 0 / ${DELIVERY_TARGET}`);
});

/* ── STEP 2 ───────────────────────────────────────────────────────── */

test("엘리베이터 화면은 샤프트 · 승강기 안 · 3×3 층 버튼을 세운다", () => {
  const state = atElevator();
  const root = renderDelivery(document, state);

  assert.equal(root.dataset.step, "3");
  assert.equal(byClass(root, "dv-stage").length, 2, "샤프트와 승강기 안 두 무대");
  assert.equal(byClass(root, "dv-goal-num")[0].textContent, `${state.order.floor}층`);
  assert.deepEqual(
    byData(root, "dvFloor").map(node => node.textContent),
    ["7", "8", "9", "4", "5", "6", "1", "2", "3"]
  );
  assert.ok(markup(root).includes("dv-shaft"));
  assert.ok(markup(root).includes("dv-cabin"));
});

test("누른 층만 켜진다", () => {
  const state = atElevator();
  const wrong = state.order.floor === 9 ? 8 : state.order.floor + 1;
  pressFloor(state, wrong);
  const keys = byData(renderDelivery(document, state), "dvFloor");
  const lit = keys.filter(node => node.dataset.on === "true");

  assert.equal(lit.length, 1);
  assert.equal(lit[0].textContent, String(wrong));
});

/* ── STEP 3 ───────────────────────────────────────────────────────── */

test("복도 화면은 찾는 호수와 힌트 라벨 두 장을 상주시킨다", () => {
  const state = atCorridor();
  const root = renderDelivery(document, state);

  assert.equal(root.dataset.step, "4");
  assert.deepEqual(text(root, "dv-card-title"), ["내가 찾는 호수", "힌트 라벨"]);
  assert.deepEqual(text(root, "dv-hint"), [`${state.order.unit}호`, `${state.order.unit}호`]);
  assert.ok(markup(root).includes("dv-corridor"));
});

test("복도에도 손가락으로 쓸 ← 🔔 → 가 있다", () => {
  const root = renderDelivery(document, atCorridor());
  assert.deepEqual(byData(root, "dvMove").map(node => node.dataset.dvMove), ["-1", "1"]);
  assert.equal(byData(root, "dvBell").length, 1);
});

test("고른 문이 그림에 반영된다", () => {
  const state = atCorridor();
  const first = markup(renderDelivery(document, state));
  moveCorridorFocus(state, 1);
  const second = markup(renderDelivery(document, state));
  assert.notEqual(first, second, "초점이 바뀌면 복도 그림도 바뀌어야 한다");
});

/* ── STEP 4 ───────────────────────────────────────────────────────── */

test("전달 화면은 받는 친구 카드 · 조작 방법 · 전달한 수를 세운다", () => {
  const state = atHandover();
  const root = renderDelivery(document, state);

  assert.equal(root.dataset.step, "5");
  assert.equal(byClass(root, "dv-who-unit")[0].textContent, `${state.order.unit}호`);
  assert.deepEqual(text(root, "dv-card-title"), ["조작 방법", "전달한 수"]);
  assert.deepEqual(text(root, "dv-howto-label"), ["선택", "전달"]);
  assert.equal(byClass(root, "dv-goal-num")[0].textContent, `0 / ${DELIVERY_TARGET}`);
  assert.ok(markup(root).includes("dv-handover"));
});

test("고른 상자가 그림에 반영된다", () => {
  const state = atHandover();
  const first = markup(renderDelivery(document, state));
  moveTrayFocus(state, 1);
  const second = markup(renderDelivery(document, state));
  assert.notEqual(first, second);
});

test("연속 성공 보너스 별이 연속 수만큼 켜진다", () => {
  const state = atHandover();
  state.streak = 2;
  const stars = byClass(renderDelivery(document, state), "dv-star");

  assert.equal(stars.length, STREAK_BONUS_SLOTS);
  assert.deepEqual(stars.map(node => node.dataset.on), ["true", "true", "false", "false"]);
});

/* ── 피날레 ───────────────────────────────────────────────────────── */

test("다섯 건을 마치면 피날레 화면이 뜬다", () => {
  const state = createDelivery("steady", 41);
  for (let index = 0; index < DELIVERY_TARGET; index += 1) {
    driveToTarget(state);
    unload(state);
    pressFloor(state, state.order.floor);
    state.corridor.focus = state.corridor.units.indexOf(state.order.unit);
    ringBell(state);
    state.handover.focus = state.handover.tray.indexOf(state.order.parcel);
    deliverParcel(state);
  }

  const root = renderDelivery(document, state);
  assert.equal(root.dataset.phase, "finale");
  assert.equal(byClass(root, "dv-finale-title")[0].textContent, "배달을 모두 마쳤어요!");
  assert.ok(byClass(root, "dv-finale-count")[0].textContent.includes(String(DELIVERY_TARGET)));
});

/* ── 자막 ─────────────────────────────────────────────────────────── */

test("문제 알약 문구가 단계를 알려 준다", () => {
  assert.equal(deliveryCaption(createDelivery("steady", 3)), "1. 단지 운전 — 목표 호수로 택배차를 운전해요!");
  assert.equal(deliveryCaption(atElevator()), "3. 엘리베이터 — 엘리베이터 버튼을 눌러 목표 층으로!");
  assert.equal(deliveryCaption(atCorridor()), "4. 문 앞 전달 — 정확한 호수를 찾아 택배를 전달해요!");
  assert.equal(
    deliveryCaption(atHandover()),
    "5. 문 앞 전달 (전달 순간) — 올바른 물건을 골라 전달해요!"
  );
});
