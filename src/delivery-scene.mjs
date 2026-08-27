// "택배 왔어요!" 씬 렌더러 — 상태의 읽기 전용 투영.
// 디자인 정본 락 §5(STEP별 레이아웃) · §6(UI 공통 요소)를 그대로 세운다.
//
// 갱신은 재렌더 + dom.stage.replaceChildren (지하철·물감 씬 문법). 그림은
// delivery-*-art.mjs 가 만든 SVG 문자열을 innerHTML 로 꽂는다.
//
// 헤더의 ⭐·♪ 는 앱 전역 HUD(#star-count, #mute-btn)가 이미 같은 자리에 띄우므로
// 씬 안에서 다시 그리지 않는다 — 같은 정보를 두 번 보여 주지 않기 위한 유일한 조정.

import {
  DELIVERY_TARGET,
  PARCELS,
  STREAK_BONUS_SLOTS,
  parcelById,
} from "./delivery-model.mjs";
import { characterPngPath, characterSrcset } from "./character-image.mjs";
import { MAP_BACKDROP, estateMapSvg } from "./delivery-estate-art.mjs";
import {
  CABIN_BACKDROP,
  HALL_BACKDROP,
  SHAFT_BACKDROP,
  corridorSvg,
  elevatorCabinSvg,
  elevatorShaftSvg,
  handoverSvg,
} from "./delivery-building-art.mjs";
import { FINALE_BACKDROP, finaleSvg } from "./delivery-finale-art.mjs";
import { RHYTHM_BACKDROP, rhythmStageSvg } from "./delivery-rhythm-art.mjs";

const MASCOT_ASSET = "nine.png";

// 디자인 정본 락 §1 — 단계 이름과 문구는 시트 그대로다.
export const DELIVERY_STEPS = Object.freeze({
  drive: {
    index: 1,
    name: "단지 운전",
    headline: "목표 호수로 택배차를 운전해요!",
    emoji: "📦",
    tip: ["방향키로 택배 차를 몰아 목표 호수까지 가세요!", "Space 를 누르면 빵빵 경적을 울려요."],
  },
  rhythm: {
    index: 2,
    name: "리듬 하역",
    headline: "박자에 맞춰 상자를 내려요!",
    emoji: "🎵",
    tip: ["구슬이 가운데 괄호에 들어올 때 Space 를 누르세요!", "박자를 놓쳐도 괜찮아요. 다음 박자에 다시 해요."],
  },
  elevator: {
    index: 3,
    name: "엘리베이터",
    headline: "엘리베이터 버튼을 눌러 목표 층으로!",
    emoji: "📦",
    tip: ["엘리베이터에서 목표 층 버튼을 누르세요!", "표시기가 목표 층에 도착하면 문이 열려요."],
  },
  corridor: {
    index: 4,
    name: "문 앞 전달",
    headline: "정확한 호수를 찾아 택배를 전달해요!",
    emoji: "",
    tip: ["라벨과 같은 호수의 문을 찾아 택배를 전달하세요!", "정확히 찾으면 초인종을 누를 수 있어요."],
  },
  handover: {
    index: 5,
    name: "문 앞 전달 (전달 순간)",
    headline: "올바른 물건을 골라 전달해요!",
    emoji: "",
    tip: ["← → 로 상자를 고르고, Space 로 전달하세요!", "친구가 말한 물건을 맞히면 상자가 열려요."],
  },
  finale: {
    index: 5,
    name: "배달 끝!",
    headline: "택배를 모두 전달했어요!",
    emoji: "🎉",
    tip: ["오늘 배달을 모두 마쳤어요.", "처음으로 돌아가 다른 놀이도 해 봐요!"],
  },
});

function el(document, tag, className, text = null) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function card(document, title) {
  const box = el(document, "div", "dv-card");
  box.append(el(document, "b", "dv-card-title", title));
  return box;
}

function keyButton(document, className, label, dataset, ariaLabel) {
  const button = el(document, "button", className, label);
  button.setAttribute("type", "button");
  if (ariaLabel) button.setAttribute("aria-label", ariaLabel);
  Object.assign(button.dataset, dataset);
  return button;
}

/* ── 헤더 ─────────────────────────────────────────────────────────── */

function header(document, step) {
  const head = el(document, "header", "dv-head");
  head.append(el(document, "span", "dv-step", String(step.index)));
  head.append(el(document, "span", "dv-stepname", step.name));
  const line = el(document, "p", "dv-headline", step.headline);
  if (step.emoji) {
    const mark = el(document, "span", "dv-emoji", step.emoji);
    line.append(mark);
  }
  head.append(line);
  return head;
}

/* ── 하단 안내 ────────────────────────────────────────────────────── */

function footer(document, step, extra) {
  const foot = el(document, "footer", "dv-foot");
  const mascot = el(document, "img", "dv-mascot");
  mascot.setAttribute("src", characterPngPath(MASCOT_ASSET));
  mascot.setAttribute("srcset", characterSrcset(MASCOT_ASSET));
  mascot.setAttribute("alt", "");
  foot.append(mascot);

  const tip = el(document, "div", "dv-tip");
  tip.append(el(document, "span", "dv-tip-q", "?"));
  const text = el(document, "p", "dv-tip-text");
  text.append(el(document, "b", "dv-tip-title", "게임 방법"));
  step.tip.forEach(line => text.append(el(document, "span", "dv-tip-line", line)));
  tip.append(text);
  foot.append(tip);

  if (extra) foot.append(extra);
  return foot;
}

function progressExtra(document, state) {
  return el(
    document,
    "div",
    "dv-foot-extra",
    `🚚 배달한 택배: ${state.delivered} / ${DELIVERY_TARGET}`
  );
}

function bonusExtra(document, state) {
  const box = el(document, "div", "dv-foot-extra", "🏆 연속 성공 보너스!");
  const stars = el(document, "span", "dv-stars");
  for (let index = 0; index < STREAK_BONUS_SLOTS; index += 1) {
    const mark = el(document, "span", "dv-star", "★");
    mark.dataset.on = String(index < state.streak);
    stars.append(mark);
  }
  box.append(stars);
  return box;
}

/* ── 무대 ─────────────────────────────────────────────────────────── */

function stage(document, className, markup, backdrop) {
  const box = el(document, "div", className);
  box.style.setProperty("--dv-bg", backdrop);
  box.innerHTML = markup;
  return box;
}

/* ── STEP 1 · 단지 운전 ───────────────────────────────────────────── */

function driveSide(document, state) {
  const side = el(document, "aside", "dv-side");

  const goal = card(document, "목표");
  goal.append(el(document, "span", "dv-goal-num", `${state.order.unit}호`));
  side.append(goal);

  const done = card(document, "배송한 택배");
  done.append(
    el(document, "span", "dv-progress", `📦 ${state.delivered} / ${DELIVERY_TARGET}`)
  );
  side.append(done);

  return side;
}

const DIRECTION_MARKS = { up: "↑", left: "←", right: "→", down: "↓" };
const DIRECTION_LABELS = { up: "위로", left: "왼쪽으로", right: "오른쪽으로", down: "아래로" };

// 디자인 정본 락 §10 — §5 패널의 ⬆⬅➡ 와 §6 버튼 시트의 ⬇ 를 합쳐 네 방향이다.
const DIRECTION_ORDER = ["up", "left", "right", "down"];

function drivePanel(document) {
  const panel = el(document, "aside", "dv-panel");

  // 5번 게임과 같은 문법 — 누르면 바로 한 칸 간다. 쌓아 두는 칸도, 출발 버튼도 없다.
  const dirCard = card(document, "방향 버튼");
  const dirs = el(document, "div", "dv-dirs");
  DIRECTION_ORDER.forEach(direction => {
    dirs.append(
      keyButton(
        document,
        "dv-key dv-key-dir",
        DIRECTION_MARKS[direction],
        { dvDir: direction },
        DIRECTION_LABELS[direction]
      )
    );
  });
  dirCard.append(dirs);
  panel.append(dirCard);

  const hornCard = card(document, "경적");
  hornCard.append(
    keyButton(document, "dv-key dv-key-horn", "📣 빵빵!", { dvHorn: "1" }, "경적 울리기")
  );
  panel.append(hornCard);

  return panel;
}

/* ── STEP 2 · 리듬 하역 ──────────────────────────────────────────── */

function rhythmPanel(document, state) {
  const panel = el(document, "aside", "dv-panel");

  const goal = card(document, "실은 상자");
  goal.append(
    el(document, "span", "dv-goal-num", `${state.rhythm.loaded} / ${state.rhythm.target}`)
  );
  const dots = el(document, "div", "dv-dots");
  for (let index = 0; index < state.rhythm.target; index += 1) {
    const dot = el(document, "i", "dv-dot");
    dot.dataset.on = String(index < state.rhythm.loaded);
    dots.append(dot);
  }
  goal.append(dots);
  panel.append(goal);

  const howCard = card(document, "조작 방법");
  const how = el(document, "div", "dv-howto");
  const row = el(document, "div", "dv-howto-row");
  row.append(el(document, "span", "dv-key dv-key-space", "Space"));
  row.append(el(document, "em", "dv-howto-label", "박자에 맞춰"));
  how.append(row);
  howCard.append(how);
  panel.append(howCard);

  panel.append(
    keyButton(document, "dv-key dv-key-go dv-key-beat", "🎵 박자!", { dvBeat: "1" }, "박자에 맞춰 상자 내리기")
  );

  return panel;
}

function rhythmBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "2";
  body.append(
    stage(
      document,
      "dv-stage",
      rhythmStageSvg({
        unit: state.order.unit,
        loaded: state.rhythm.loaded,
        target: state.rhythm.target,
        beat: state.rhythm.beat,
        judge: state.rhythm.judge,
      }),
      RHYTHM_BACKDROP
    )
  );
  body.append(rhythmPanel(document, state));
  return body;
}

/* ── STEP 3 · 엘리베이터 ─────────────────────────────────────────── */

const FLOOR_KEYS = [7, 8, 9, 4, 5, 6, 1, 2, 3];

function elevatorPanel(document, state) {
  const panel = el(document, "aside", "dv-panel");

  const goal = card(document, "목표 층");
  goal.append(el(document, "span", "dv-goal-num", `${state.elevator.target}층`));
  panel.append(goal);

  const padCard = card(document, "누른 버튼");
  const pad = el(document, "div", "dv-pad");
  FLOOR_KEYS.forEach(floor => {
    const key = keyButton(
      document,
      "dv-floorkey",
      String(floor),
      { dvFloor: String(floor) },
      `${floor}층`
    );
    key.dataset.on = String(state.elevator.pressed === floor);
    pad.append(key);
  });
  padCard.append(pad);
  padCard.append(
    keyButton(document, "dv-bell", "🔔", { dvBell: "1" }, "목표 층 다시 알려주기")
  );
  panel.append(padCard);

  return panel;
}

/* ── STEP 3 · 호수 찾기 ──────────────────────────────────────────── */

function corridorPanel(document, state) {
  const panel = el(document, "aside", "dv-panel");

  const goal = card(document, "내가 찾는 호수");
  goal.append(el(document, "span", "dv-goal-num", `${state.order.unit}호`));
  panel.append(goal);

  const hintCard = card(document, "힌트 라벨");
  const hints = el(document, "div", "dv-hints");
  hints.append(el(document, "span", "dv-hint", `${state.order.unit}호`));
  hints.append(el(document, "span", "dv-hint", `${state.order.unit}호`));
  hintCard.append(hints);
  panel.append(hintCard);

  return panel;
}

// ← 🔔 → 는 손가락으로도 놀 수 있어야 하니 복도와 전달 순간이 함께 쓴다.
function pickControls(document, bellLabel) {
  const bar = el(document, "div", "dv-controls");
  bar.append(keyButton(document, "dv-key", "←", { dvMove: "-1" }, "왼쪽"));
  bar.append(keyButton(document, "dv-key dv-key-bell", "🔔", { dvBell: "1" }, bellLabel));
  bar.append(keyButton(document, "dv-key", "→", { dvMove: "1" }, "오른쪽"));
  return bar;
}

/* ── STEP 4 · 전달 순간 ──────────────────────────────────────────── */

function handoverPanel(document, state) {
  const panel = el(document, "aside", "dv-panel");

  const howCard = card(document, "조작 방법");
  const how = el(document, "div", "dv-howto");

  const pickRow = el(document, "div", "dv-howto-row");
  pickRow.append(el(document, "span", "dv-key", "←"));
  pickRow.append(el(document, "span", "dv-key", "→"));
  pickRow.append(el(document, "em", "dv-howto-label", "선택"));
  how.append(pickRow);

  const giveRow = el(document, "div", "dv-howto-row");
  giveRow.append(el(document, "span", "dv-key dv-key-space", "Space"));
  giveRow.append(el(document, "em", "dv-howto-label", "전달"));
  how.append(giveRow);

  howCard.append(how);
  panel.append(howCard);

  const countCard = card(document, "전달한 수");
  countCard.append(
    el(document, "span", "dv-goal-num", `${state.delivered} / ${DELIVERY_TARGET}`)
  );
  const dots = el(document, "div", "dv-dots");
  dots.append(el(document, "span", "dv-dots-truck", "🚚"));
  for (let index = 1; index < DELIVERY_TARGET; index += 1) {
    const dot = el(document, "i", "dv-dot");
    dot.dataset.on = String(index <= state.delivered);
    dots.append(dot);
  }
  countCard.append(dots);
  panel.append(countCard);

  return panel;
}

function whoCard(document, state) {
  const box = el(document, "div", "dv-who");
  box.append(el(document, "span", "dv-who-label", "받는 친구"));
  box.append(el(document, "b", "dv-who-unit", `${state.order.unit}호`));
  return box;
}

/* ── 피날레 ───────────────────────────────────────────────────────── */

function finaleBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "1";
  body.append(stage(document, "dv-stage dv-stage-finale", finaleSvg(state.finale), FINALE_BACKDROP));

  const panel = el(document, "div", "dv-finale");
  panel.append(el(document, "p", "dv-finale-title", "배달을 모두 마쳤어요!"));
  panel.append(
    el(document, "p", "dv-finale-count", `택배 ${state.finale.delivered}개 · 별 ${state.finale.stars}개`)
  );

  const stars = el(document, "span", "dv-stars dv-stars-big");
  for (let index = 0; index < STREAK_BONUS_SLOTS; index += 1) {
    const mark = el(document, "span", "dv-star", "★");
    mark.dataset.on = String(index < state.finale.streak);
    stars.append(mark);
  }
  panel.append(stars);
  panel.append(
    keyButton(document, "dv-key dv-key-go dv-finale-home", "🏠 처음으로", { dvHome: "1" }, "처음 화면으로")
  );

  body.append(panel);
  return body;
}

/* ── 조립 ─────────────────────────────────────────────────────────── */

function driveBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "3";
  body.append(driveSide(document, state));
  body.append(
    stage(
      document,
      "dv-stage",
      estateMapSvg({
        houses: state.houses,
        targetUnit: state.order.unit,
        truck: state.drive.truck,
        facing: state.drive.facing,
      }),
      MAP_BACKDROP
    )
  );
  body.append(drivePanel(document));
  return body;
}

function elevatorBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "elev";
  const topFloor = Math.max(7, state.elevator.target);
  body.append(
    stage(
      document,
      "dv-stage dv-stage-shaft",
      elevatorShaftSvg({
        topFloor,
        current: state.elevator.current,
        target: state.elevator.target,
      }),
      SHAFT_BACKDROP
    )
  );
  body.append(
    stage(
      document,
      "dv-stage",
      elevatorCabinSvg({ current: state.elevator.current }),
      CABIN_BACKDROP
    )
  );
  body.append(elevatorPanel(document, state));
  return body;
}

function corridorBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "2";
  const hall = stage(
    document,
    "dv-stage",
    corridorSvg({
      units: state.corridor.units,
      focus: state.corridor.focus,
      targetUnit: state.order.unit,
    }),
    HALL_BACKDROP
  );
  hall.append(pickControls(document, "초인종 누르기"));
  body.append(hall);
  body.append(corridorPanel(document, state));
  return body;
}

function handoverBody(document, state) {
  const body = el(document, "div", "dv-body");
  body.dataset.cols = "2";
  const scene = stage(
    document,
    "dv-stage",
    handoverSvg({
      tray: state.handover.tray.map(id => parcelById(id) ?? PARCELS[0]),
      focus: state.handover.focus,
      wanted: parcelById(state.order.parcel) ?? PARCELS[0],
      unit: state.order.unit,
      friend: state.order.friend,
    }),
    HALL_BACKDROP
  );
  scene.append(whoCard(document, state));
  scene.append(pickControls(document, "전달하기"));
  body.append(scene);
  body.append(handoverPanel(document, state));
  return body;
}

const BODY_BY_PHASE = {
  drive: driveBody,
  rhythm: rhythmBody,
  elevator: elevatorBody,
  corridor: corridorBody,
  handover: handoverBody,
  finale: finaleBody,
};

const EXTRA_BY_PHASE = {
  drive: progressExtra,
  handover: bonusExtra,
};

export function renderDelivery(document, state) {
  const step = DELIVERY_STEPS[state.phase] ?? DELIVERY_STEPS.drive;
  const root = el(document, "div", "dv-scene");
  root.dataset.phase = state.phase;
  root.dataset.step = String(step.index);

  root.append(header(document, step));
  root.append((BODY_BY_PHASE[state.phase] ?? driveBody)(document, state));

  const makeExtra = EXTRA_BY_PHASE[state.phase];
  root.append(footer(document, step, makeExtra ? makeExtra(document, state) : null));

  return root;
}

// 화면 낭독용 한 줄 — 단계가 바뀔 때 문제 알약에 넣는다.
export function deliveryCaption(state) {
  const step = DELIVERY_STEPS[state.phase] ?? DELIVERY_STEPS.drive;
  if (state.phase === "finale") return "택배를 모두 전달했어요!";
  return `${step.index}. ${step.name} — ${step.headline}`;
}
