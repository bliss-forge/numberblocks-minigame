// 슥삭 그림 퀴즈 로직 계약 — 선정·단계 공개·힌트 5회·별 판정·오답 처리.

import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_HINT_IDLE_MS,
  CATCHMIND_HINT_MAX,
  CATCHMIND_ROUNDS,
  RESCUE_PULSE_MS,
  STEP_FRACTIONS,
  advanceCatchmind,
  createCatchmind,
  currentCatchmindRound,
  guessCatchmindCard,
  hintButtonReady,
  hintsRemaining,
  mulberry32,
  normalizeStage,
  revealDurationMs,
  revealFraction,
  stagePlan,
  starsIfNow,
  tickCatchmind,
  useCatchmindHint
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

test("단계 공개 — 시작하면 25%(큰 윤곽)까지만 그리고 멈춘다", () => {
  const model = createCatchmind(3, 5);
  assert.equal(model.phase, "drawing");
  assert.equal(model.revealTarget, STEP_FRACTIONS[0]);
  assert.equal(revealFraction(model), 0);

  const events = finishStep(model);
  assert.ok(events.some(e => e.type === "step-done" && e.step === 1));
  assert.equal(model.phase, "guess");
  assert.ok(Math.abs(revealFraction(model) - 0.25) < 0.01);

  // 멈춘 뒤에는 시간이 지나도 더 그려지지 않는다(자동 힌트 전까지).
  tick(model, AUTO_HINT_IDLE_MS - 1000);
  assert.ok(Math.abs(revealFraction(model) - 0.25) < 0.01);
});

test("힌트 = 다음 단계 그리기, 총 5번, 남은 횟수가 줄어든다", () => {
  const model = createCatchmind(3, 9);
  assert.equal(hintButtonReady(model), false); // 그리는 중엔 비활성
  assert.deepEqual(useCatchmindHint(model), []);

  finishStep(model);
  assert.equal(hintButtonReady(model), true);
  assert.equal(hintsRemaining(model), CATCHMIND_HINT_MAX);

  for (let use = 1; use <= CATCHMIND_HINT_MAX; use += 1) {
    const events = useCatchmindHint(model);
    assert.equal(events[0].type, "hint");
    assert.equal(events[0].used, use);
    assert.equal(events[0].auto, false);
    assert.equal(model.phase, "drawing");
    assert.equal(model.revealTarget, STEP_FRACTIONS[use]);
    finishStep(model);
    assert.ok(Math.abs(revealFraction(model) - STEP_FRACTIONS[use]) < 0.01);
  }

  // 5번을 다 쓰면 그림이 완성되고 힌트는 끝.
  assert.equal(revealFraction(model), 1);
  assert.equal(hintsRemaining(model), 0);
  assert.equal(hintButtonReady(model), false);
  assert.deepEqual(useCatchmindHint(model), []);
});

test("별 판정 — 힌트 0~1번+한 번에 ★3, 3번 이내 ★2, 그 외 ★1", () => {
  const model = createCatchmind(3, 5);
  finishStep(model);
  assert.equal(starsIfNow(model), 3); // 힌트 0

  useCatchmindHint(model);
  finishStep(model);
  assert.equal(starsIfNow(model), 3); // 힌트 1

  useCatchmindHint(model);
  finishStep(model);
  assert.equal(starsIfNow(model), 2); // 힌트 2

  useCatchmindHint(model);
  finishStep(model);
  assert.equal(starsIfNow(model), 2); // 힌트 3

  useCatchmindHint(model);
  finishStep(model);
  assert.equal(starsIfNow(model), 1); // 힌트 4

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

test("가만히 있으면 자동으로 다음 단계를 그려 준다(힌트 5번에 포함)", () => {
  const model = createCatchmind(3, 21);
  finishStep(model);
  const events = tick(model, AUTO_HINT_IDLE_MS);
  const auto = events.find(e => e.type === "hint");
  assert.ok(auto, "자동 힌트가 없다");
  assert.equal(auto.auto, true);
  assert.equal(auto.used, 1);
  assert.equal(model.phase, "drawing");
});

test("힌트 소진 후에도 못 고르면 정답 카드가 주기적으로 반짝인다", () => {
  const model = createCatchmind(3, 21);
  finishStep(model);
  for (let use = 0; use < CATCHMIND_HINT_MAX; use += 1) {
    useCatchmindHint(model);
    finishStep(model);
  }
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
      assert.equal(revealFraction(model), 0);
      assert.equal(hintsRemaining(model), CATCHMIND_HINT_MAX);
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
  assert.deepEqual(useCatchmindHint(model), []);
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
