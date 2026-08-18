// 슥삭 그림 퀴즈 로직 계약 — 선정·별 판정·힌트·오답 처리.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CATCHMIND_ROUNDS,
  HINT_AUTO_MS,
  HINT_REPEAT_MS,
  advanceCatchmind,
  createCatchmind,
  currentCatchmindRound,
  guessCatchmindCard,
  hintButtonReady,
  mulberry32,
  normalizeStage,
  revealDurationMs,
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

test("한 판은 5라운드, 문항 레벨은 단계 표를 따른다", () => {
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

test("단계 표 — 1단계는 전부 쉬운 문항, 5단계 이후는 상한 고정", () => {
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

test("별 판정 — 절대 시간 기준 3/2/1", () => {
  const model = createCatchmind(3, 5);
  const half = model.revealMs * 0.5;

  // 첫 시도 + 50% 이내 = ★3
  tick(model, half - 100);
  assert.equal(starsIfNow(model), 3);

  // 50%를 넘기면 ★2
  tick(model, 200);
  assert.equal(starsIfNow(model), 2);

  // 공개 종료 +1초까지 ★2, 그 뒤는 ★1
  tick(model, model.revealMs - model.elapsedMs + 1000);
  assert.equal(starsIfNow(model), 2);
  tick(model, 100);
  assert.equal(starsIfNow(model), 1);
});

test("오답이 나오면 첫 시도 조건이 깨져 50% 이내라도 ★2", () => {
  const model = createCatchmind(3, 5);
  const round = currentCatchmindRound(model);
  const wrongIndex = round.answerIndex === 0 ? 1 : 0;
  tick(model, 500);
  const events = guessCatchmindCard(model, wrongIndex);
  assert.deepEqual(events, [{ type: "wrong", index: wrongIndex }]);
  assert.equal(starsIfNow(model), 2);

  // 오답 카드는 라운드 내 영구 비활성 — 다시 눌러도 무반응.
  assert.deepEqual(guessCatchmindCard(model, wrongIndex), []);

  // 정답은 언제든 가능 — 이 시점엔 ★2.
  const correct = guessCatchmindCard(model, round.answerIndex);
  assert.equal(correct[0].type, "correct");
  assert.equal(correct[0].stars, 2);
  assert.equal(model.totalStars, 2);
});

test("힌트 버튼 — 3초 전 비활성, H1·H2는 오답 제거, H3는 공개 종료 후에만", () => {
  const model = createCatchmind(3, 9);
  const round = currentCatchmindRound(model);

  assert.equal(hintButtonReady(model), false);
  assert.deepEqual(useCatchmindHint(model), []);

  // 정확히 3000ms — 버튼이 열리는 시점이자 레벨1 문항의 ★3 마감(50%) 직전.
  tick(model, 3000);
  assert.equal(hintButtonReady(model), true);

  const h1 = useCatchmindHint(model);
  assert.equal(h1[0].level, 1);
  assert.notEqual(h1[0].removedIndex, round.answerIndex);
  assert.equal(starsIfNow(model), 3); // H1은 무감점

  const h2 = useCatchmindHint(model);
  assert.equal(h2[0].level, 2);
  assert.equal(starsIfNow(model), 2); // H2는 상한 ★2

  // 공개가 끝나기 전에는 H3를 쏠 수 없다.
  assert.equal(hintButtonReady(model), false);
  tick(model, model.revealMs);
  assert.equal(hintButtonReady(model), true);
  const h3 = useCatchmindHint(model);
  assert.equal(h3[0].level, 3);
  assert.equal(starsIfNow(model), 1); // H3 뒤에는 ★1

  // 남은 카드는 정답 + 오답 1 — 오답을 눌러도 결국 정답에 도달한다.
  const active = round.cards
    .map((card, index) => index)
    .filter(index => !model.wrong.includes(index));
  assert.equal(active.length, 2);
  assert.ok(active.includes(round.answerIndex));
});

test("자동 힌트 — 공개 종료 후 8/16/28초, 이후 10초마다 펄스", () => {
  const model = createCatchmind(3, 21);
  tick(model, model.revealMs); // 공개 종료

  let events = tick(model, HINT_AUTO_MS[0]);
  assert.ok(events.some(event => event.type === "hint" && event.level === 1));

  events = tick(model, HINT_AUTO_MS[1] - HINT_AUTO_MS[0]);
  assert.ok(events.some(event => event.type === "hint" && event.level === 2));

  events = tick(model, HINT_AUTO_MS[2] - HINT_AUTO_MS[1]);
  assert.ok(events.some(event => event.type === "hint" && event.level === 3));

  events = tick(model, HINT_REPEAT_MS);
  assert.ok(events.some(event => event.type === "hint-pulse"));
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
      assert.equal(model.phase, "reveal");
      assert.equal(model.elapsedMs, 0);
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

test("공개 시간 — 레벨 6/8/10초에 단계 배속, 5단계 이후 상한", () => {
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
