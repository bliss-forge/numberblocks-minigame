// 리듬 하역 계약 — 80BPM 정박 판정과 "벌점 없음" 원칙을 기계적으로 지킨다.

import test from "node:test";
import assert from "node:assert/strict";
import {
  BEATS_PER_BAR,
  BEAT_MS,
  GOOD_WINDOW_MS,
  PERFECT_WINDOW_MS,
  RHYTHM_BPM,
  RHYTHM_TARGET,
  beatIndexAt,
  beatOffsetMs,
  createRhythm,
  judgeAt,
  passBox,
  rhythmDone,
  tickBeat,
} from "../src/delivery-rhythm.mjs";
import {
  boardElevator,
  createDelivery,
  passRhythmBox,
  driveStep,
  tickRhythm,
} from "../src/delivery-model.mjs";
import { rhythmStageSvg } from "../src/delivery-rhythm-art.mjs";

function atRhythm(seed = 21) {
  const state = createDelivery("steady", seed);
  const goal = state.order.cell;
  const dx = goal.x - state.drive.truck.x;
  const dy = goal.y - state.drive.truck.y;
  for (let i = 0; i < Math.abs(dx); i += 1) driveStep(state, dx > 0 ? "right" : "left");
  for (let i = 0; i < Math.abs(dy); i += 1) driveStep(state, dy > 0 ? "down" : "up");
  return state;
}

/* ── 박자 ─────────────────────────────────────────────────────────── */

test("목업이 정한 80BPM 이 한 박 750ms 로 떨어진다", () => {
  assert.equal(RHYTHM_BPM, 80);
  assert.equal(BEAT_MS, 750);
  assert.equal(BEATS_PER_BAR, 4);
});

test("박 번호는 네 박마다 처음으로 돌아온다", () => {
  assert.equal(beatIndexAt(0), 0);
  assert.equal(beatIndexAt(BEAT_MS * 1.5), 1);
  assert.equal(beatIndexAt(BEAT_MS * 3.9), 3);
  assert.equal(beatIndexAt(BEAT_MS * 4), 0, "네 박이면 한 바퀴");
  assert.equal(beatIndexAt(-50), 0, "무대가 열리기 전이면 첫 박");
});

test("정박까지의 거리는 앞이든 뒤든 같은 값으로 센다", () => {
  assert.equal(beatOffsetMs(BEAT_MS), 0);
  assert.equal(beatOffsetMs(BEAT_MS + 100), 100, "박자 뒤 100ms");
  assert.equal(beatOffsetMs(BEAT_MS - 100), 100, "박자 앞 100ms");
});

/* ── 판정 ─────────────────────────────────────────────────────────── */

test("정박에 가까울수록 좋은 판정이 나온다", () => {
  assert.equal(judgeAt(BEAT_MS), "perfect");
  assert.equal(judgeAt(BEAT_MS + PERFECT_WINDOW_MS), "perfect");
  assert.equal(judgeAt(BEAT_MS + PERFECT_WINDOW_MS + 1), "good");
  assert.equal(judgeAt(BEAT_MS + GOOD_WINDOW_MS), "good");
  assert.equal(judgeAt(BEAT_MS + GOOD_WINDOW_MS + 1), "miss");
});

test("성공 구간이 한 박의 절반을 넘는다 — 네 살도 대부분 맞힌다", () => {
  const hitWindow = GOOD_WINDOW_MS * 2; // 정박 앞뒤
  assert.ok(hitWindow / BEAT_MS > 0.5, `성공 구간이 ${(hitWindow / BEAT_MS * 100).toFixed(0)}% 뿐이다`);
});

/* ── 하역 ─────────────────────────────────────────────────────────── */

test("정박에 누르면 상자가 하나씩 실린다", () => {
  const rhythm = createRhythm();
  const events = passBox(rhythm, BEAT_MS);

  assert.equal(events[0].type, "rhythm-pass");
  assert.equal(events[0].judge, "perfect");
  assert.equal(rhythm.loaded, 1);
  assert.equal(rhythm.perfect, 1);
});

test("빗나가도 벌점이 없다 — 상자는 그대로 있고 다시 누르면 된다", () => {
  const rhythm = createRhythm();
  const missed = passBox(rhythm, BEAT_MS / 2); // 박과 박 사이

  assert.deepEqual(missed.map(event => event.type), ["rhythm-miss"]);
  assert.equal(rhythm.loaded, 0, "빗나갔다고 실은 상자가 줄면 안 된다");
  assert.equal(rhythm.judge, "miss");

  passBox(rhythm, BEAT_MS * 2);
  assert.equal(rhythm.loaded, 1, "다음 박자에 다시 하면 실린다");
});

test("목표한 수를 채우면 하역이 끝난다", () => {
  const rhythm = createRhythm();
  for (let index = 1; index < RHYTHM_TARGET; index += 1) {
    const events = passBox(rhythm, index * BEAT_MS);
    assert.equal(events.some(event => event.type === "rhythm-done"), false, "아직 끝나면 안 된다");
  }
  const last = passBox(rhythm, RHYTHM_TARGET * BEAT_MS);

  assert.ok(last.some(event => event.type === "rhythm-done"));
  assert.ok(rhythmDone(rhythm));
  assert.deepEqual(passBox(rhythm, (RHYTHM_TARGET + 1) * BEAT_MS), [], "다 실은 뒤엔 조용하다");
});

test("박자 시계는 박이 넘어갈 때만 말한다", () => {
  const rhythm = createRhythm();
  assert.deepEqual(tickBeat(rhythm, 10), [], "같은 박에서는 아무 일도 없다");
  assert.deepEqual(tickBeat(rhythm, BEAT_MS + 10), [{ type: "rhythm-beat", beat: 1 }]);
  assert.deepEqual(tickBeat(rhythm, BEAT_MS + 200), [], "같은 박을 두 번 알리지 않는다");
});

/* ── 상태 머신 ────────────────────────────────────────────────────── */

test("도착하면 하역이 열리고, 다 내려야 승강기로 간다", () => {
  const state = atRhythm();
  assert.equal(state.phase, "rhythm");
  assert.equal(state.rhythm.loaded, 0);

  assert.deepEqual(boardElevator(state), [], "덜 내렸는데 올라가면 안 된다");
  assert.equal(state.phase, "rhythm");

  for (let index = 1; index <= RHYTHM_TARGET; index += 1) passRhythmBox(state, index * BEAT_MS);
  assert.deepEqual(boardElevator(state), [{ type: "rhythm-boarding", floor: state.order.floor }]);
  assert.equal(state.phase, "elevator");
});

test("하역 단계가 아니면 박자 입력이 조용히 무시된다", () => {
  const state = createDelivery("steady", 21);
  assert.deepEqual(passRhythmBox(state, BEAT_MS), []);
  assert.deepEqual(tickRhythm(state, BEAT_MS), []);
});

/* ── 그림 ─────────────────────────────────────────────────────────── */

test("하역 무대는 실은 수만큼 상자를 쌓고 지금 박을 켠다", () => {
  const svg = rhythmStageSvg({ unit: 502, loaded: 2, target: 3, beat: 1, judge: "perfect" });

  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.equal((svg.match(/class="dv-beat-chip"/g) ?? []).length, BEATS_PER_BAR);
  assert.ok(svg.includes("박자 딱!"), "정박 판정 문구가 없다");
  assert.match(svg, /aria-label="[^"]*2 \/ 3 개 실었어요/);
  assert.match(svg, /class="dv-beat-marker"/, "박자 구슬이 없다");
  assert.match(svg, /class="dv-beat-track"/, "박자 막대가 없다");
});

test("빗나간 순간에는 상자가 날아가지 않는다", () => {
  const passed = rhythmStageSvg({ unit: 502, loaded: 1, target: 3, beat: 0, judge: "good" });
  const missed = rhythmStageSvg({ unit: 502, loaded: 1, target: 3, beat: 0, judge: "miss" });

  assert.ok(passed.includes("stroke-dasharray=\"3 14\""), "패스 포물선이 없다");
  assert.equal(missed.includes("stroke-dasharray=\"3 14\""), false, "빗나갔는데 상자가 날아간다");
  assert.ok(missed.includes("다시 한 번!"));
});
