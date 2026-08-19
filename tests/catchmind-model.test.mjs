// 슥삭 그림 퀴즈 로직 계약 — 선정·3단계 공개(스케치→형태→완성)·별 판정·오답.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CATCHMIND_ROUNDS,
  GUESS_WINDOW_MS,
  RESCUE_PULSE_MS,
  REVEAL_STEPS,
  STEP_NAMES,
  advanceCatchmind,
  createCatchmind,
  currentCatchmindRound,
  guessCatchmindCard,
  guessCountdown,
  mulberry32,
  normalizeStage,
  overallRevealProgress,
  revealDurationMs,
  stagePlan,
  starsIfNow,
  tickCatchmind
} from "../src/catchmind-model.mjs";
import { CATCHMIND_ITEMS } from "../src/catchmind-data.mjs";

const tick = (model, ms, step = 100) => {
  const events = [];
  let remaining = ms;
  while (remaining > 0) {
    const delta = Math.min(step, remaining);
    events.push(...tickCatchmind(model, delta));
    remaining -= delta;
  }
  return events;
};

// 현재 단계를 끝까지 그리게 한다 — step-done 이 나오는 즉시 멈춰서
// 대기(idle) 시간이 새지 않게 한다.
const finishStep = model => {
  const events = [];
  for (let guard = 0; guard < 2000 && model.phase === "drawing"; guard += 1) {
    events.push(...tickCatchmind(model, 50));
  }
  return events;
};

test("시드가 같으면 같은 판이 나온다", () => {
  const a = createCatchmind(3, 42);
  const b = createCatchmind(3, 42);
  assert.deepEqual(
    a.rounds.map(round => round.item.n),
    b.rounds.map(round => round.item.n)
  );
  assert.deepEqual(
    a.rounds.map(round => round.cards.map(card => card.n)),
    b.rounds.map(round => round.cards.map(card => card.n))
  );
});

test("한 판은 5라운드, 문항 레벨은 판 램프 표를 따른다", () => {
  for (const stage of [1, 2, 3, 4, 5, 9]) {
    const model = createCatchmind(stage, 7);
    assert.equal(model.rounds.length, CATCHMIND_ROUNDS);
    assert.equal(model.stage, stage);
    assert.deepEqual(
      model.rounds.map(round => round.item.l),
      [...stagePlan(stage).levels]
    );
  }
});

test("판 램프 표 — 첫 판은 전부 쉬운 문항, 5판 이후는 상한 고정", () => {
  assert.deepEqual([...stagePlan(1).levels], [1, 1, 1, 1, 1]);
  assert.deepEqual([...stagePlan(4).levels], [2, 2, 3, 3, 3]);
  assert.equal(stagePlan(9), stagePlan(5));
  assert.equal(normalizeStage("abc"), 1);
  assert.equal(normalizeStage(0), 1);
  assert.equal(normalizeStage(7.9), 7);
});

test("시드 1..200에서 정답 중복 0, 같은 카테고리 3회 이상 없음, 카드 규칙 유지", () => {
  for (let seed = 1; seed <= 200; seed += 1) {
    const model = createCatchmind(3, seed);
    const names = model.rounds.map(round => round.item.n);
    assert.equal(new Set(names).size, 5, `seed ${seed}: 정답 중복`);

    const categories = new Map();
    for (const round of model.rounds) {
      categories.set(round.item.c, (categories.get(round.item.c) ?? 0) + 1);
      assert.equal(round.cards.length, 4);
      assert.equal(new Set(round.cards.map(card => card.n)).size, 4);
      assert.equal(round.cards[round.answerIndex].n, round.item.n);
      for (const card of round.cards) {
        assert.equal(card.c, round.item.c, `seed ${seed}: 오답 카드 카테고리`);
      }
    }
    for (const [category, count] of categories) {
      assert.ok(count <= 2, `seed ${seed}: ${category} ${count}회`);
    }
  }
});

test("최근 출제 문항은 다음 판에서 빠진다", () => {
  const first = createCatchmind(3, 11);
  const recent = first.rounds.map(round => round.item.n);
  const second = createCatchmind(3, 12, { recent });
  for (const round of second.rounds) {
    assert.ok(!recent.includes(round.item.n), `재출제: ${round.item.n}`);
  }
});

test("최근 목록이 풀을 다 덮어도 예외 없이 5문항을 채운다", () => {
  const recent = CATCHMIND_ITEMS.map(item => item.n);
  const model = createCatchmind(5, 3, { recent });
  assert.equal(model.rounds.length, 5);
});

test("공개 3단계 — 스케치를 다 그리면 멈추고, 8초 안엔 넘어가지 않는다", () => {
  const model = createCatchmind(3, 5);
  assert.equal(model.phase, "drawing");
  assert.equal(model.step, 1);
  assert.equal(STEP_NAMES.length, REVEAL_STEPS);

  const events = finishStep(model);
  assert.ok(events.some(e => e.type === "step-done" && e.step === 1 && !e.final));
  assert.equal(model.phase, "guess");
  assert.equal(model.step, 1);
  assert.ok(Math.abs(overallRevealProgress(model) - 1 / 3) < 0.01);

  // 8초 전에는 다음 단계로 넘어가지 않고, 카운트다운이 줄어든다.
  tick(model, GUESS_WINDOW_MS - 1000);
  assert.equal(model.step, 1);
  const countdown = guessCountdown(model);
  assert.ok(countdown !== null && countdown > 0 && countdown < 0.2);
});

test("8초 동안 못 맞히면 자동으로 다음 단계 — 스케치→형태→완성", () => {
  const model = createCatchmind(3, 9);
  finishStep(model);

  let events = tick(model, GUESS_WINDOW_MS);
  assert.ok(events.some(e => e.type === "step" && e.step === 2));
  assert.equal(model.phase, "drawing");
  finishStep(model);
  assert.equal(model.step, 2);

  events = tick(model, GUESS_WINDOW_MS);
  assert.ok(events.some(e => e.type === "step" && e.step === 3));
  events = finishStep(model);
  assert.ok(events.some(e => e.type === "step-done" && e.final));
  assert.equal(overallRevealProgress(model), 1);

  // 3단계 뒤에는 카운트가 없다 — 8초가 지나도 단계가 늘지 않는다.
  assert.equal(guessCountdown(model), null);
  tick(model, GUESS_WINDOW_MS);
  assert.equal(model.step, 3);
});

test("별 판정 — 1단계 한 번에 ★3, 2단계 ★2, 3단계 ★1", () => {
  const model = createCatchmind(3, 5);
  finishStep(model);
  assert.equal(starsIfNow(model), 3); // 스케치 단계

  tick(model, GUESS_WINDOW_MS);
  assert.equal(starsIfNow(model), 2); // 형태 단계(그리는 중 포함)
  finishStep(model);
  assert.equal(starsIfNow(model), 2);

  tick(model, GUESS_WINDOW_MS);
  finishStep(model);
  assert.equal(starsIfNow(model), 1); // 완성 단계

  const round = currentCatchmindRound(model);
  const correct = guessCatchmindCard(model, round.answerIndex);
  assert.equal(correct[0].stars, 1);
});

test("오답이 나오면 ★3이 깨지고, 오답 카드는 라운드 내 영구 비활성", () => {
  const model = createCatchmind(3, 5);
  const round = currentCatchmindRound(model);
  const wrongIndex = round.answerIndex === 0 ? 1 : 0;

  // 그리는 중에도 답할 수 있다.
  const events = guessCatchmindCard(model, wrongIndex);
  assert.deepEqual(events, [{ type: "wrong", index: wrongIndex }]);
  assert.equal(starsIfNow(model), 2);
  assert.deepEqual(guessCatchmindCard(model, wrongIndex), []); // 재입력 무시

  const correct = guessCatchmindCard(model, round.answerIndex);
  assert.equal(correct[0].type, "correct");
  assert.equal(correct[0].stars, 2);
  assert.equal(model.totalStars, 2);
});

test("완성 뒤에도 못 고르면 정답 카드가 주기적으로 반짝인다", () => {
  const model = createCatchmind(3, 21);
  finishStep(model);
  tick(model, GUESS_WINDOW_MS);
  finishStep(model);
  tick(model, GUESS_WINDOW_MS);
  finishStep(model);

  let events = tick(model, RESCUE_PULSE_MS);
  assert.ok(events.some(e => e.type === "rescue-pulse"));
  assert.equal(model.rescue, true);
  events = tick(model, RESCUE_PULSE_MS);
  assert.ok(events.some(e => e.type === "rescue-pulse"), "반복 펄스가 없다");
});

test("5라운드를 다 맞히면 결과로 넘어가고 별이 누적된다", () => {
  const model = createCatchmind(1, 33);
  for (let round = 0; round < 5; round += 1) {
    const events = guessCatchmindCard(
      model,
      currentCatchmindRound(model).answerIndex
    );
    assert.equal(events[0].type, "correct");
    assert.equal(events[0].stars, 3);
    const advanced = advanceCatchmind(model);
    if (round < 4) {
      assert.deepEqual(advanced, [{ type: "round", index: round + 1 }]);
      assert.equal(model.phase, "drawing");
      assert.equal(model.step, 1);
      assert.equal(model.stepProgress, 0);
    } else {
      assert.deepEqual(advanced, [{ type: "result", totalStars: 15 }]);
      assert.equal(model.phase, "result");
    }
  }
  assert.deepEqual(model.starsEarned, [3, 3, 3, 3, 3]);
});

test("축하·결과 중에는 카드 입력이 잠긴다", () => {
  const model = createCatchmind(3, 55);
  guessCatchmindCard(model, currentCatchmindRound(model).answerIndex);
  assert.equal(model.phase, "celebrate");
  assert.deepEqual(guessCatchmindCard(model, 0), []);
  assert.deepEqual(tickCatchmind(model, 100), []);
});

test("전체 그림 시간 — 레벨 6/8/10초에 판 램프 배속, 5판 이후 상한", () => {
  const l1 = { l: 1 };
  const l3 = { l: 3 };
  assert.equal(revealDurationMs(l1, 3), 6000);
  assert.equal(revealDurationMs(l3, 3), 10000);
  assert.equal(revealDurationMs(l1, 1), 7800);
  assert.equal(revealDurationMs(l1, 5), 4800);
  assert.equal(revealDurationMs(l3, 12), revealDurationMs(l3, 5));
});

test("mulberry32 — 같은 시드는 같은 수열", () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});
