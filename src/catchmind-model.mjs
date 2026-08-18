// 슥삭 그림 퀴즈 — 순수 게임 로직. DOM·오디오·시간을 모른다.
//
// 규칙 출처: catchmind-game-design.md (2026-08-18 final)
// - 1판 = 5라운드, 실패·타임오버 없음. 라운드당 별 3/2/1.
// - 별은 절대 시간 기준: 첫 시도(오답 0·H2 미사용)로 재생 시간의 50% 안에
//   맞히면 ★3, 재생 종료 +1초 안(H3 미사용)이면 ★2, 그 외 언제 맞혀도 ★1.
// - 힌트는 오답 카드 제거 3단계(H1 한 장 → H2 50:50 → H3 정답 펄스).
//   버튼은 재생 시작 +3초부터, 자동 발동은 재생 종료 후 +8/16/28초,
//   H3는 이후 10초마다 반복 펄스.
// - 오답 카드는 라운드 내 영구 비활성 — 선택지가 좁혀져 반드시 성공한다.
//
// 문서와 다른 점(이모지 방식 채택에 따른 의도적 단순화):
// - 오답 3개는 저작 고정 목록 대신 같은 카테고리에서 시드 난수로 뽑는다.
//   이모지는 선화와 달리 오독 소지가 없어 금지쌍 테이블이 필요 없다.
// - 연령 2모드 대신 홈 난이도(쉬움/차근차근/도전)를 그대로 쓴다.

import { CATCHMIND_ITEMS } from "./catchmind-data.mjs";

export const CATCHMIND_ROUNDS = 5;

// 라운드별 문항 레벨 배분 — 쉬움은 익숙한 것만, 도전은 어려운 것 위주.
export const LEVEL_PLAN = Object.freeze({
  easy: Object.freeze([1, 1, 1, 1, 2]),
  steady: Object.freeze([1, 1, 2, 2, 3]),
  challenge: Object.freeze([2, 2, 3, 3, 3])
});

// 공개(붓칠) 시간 배속 — 쉬움은 천천히, 도전은 빠르게.
const SPEED = Object.freeze({ easy: 4 / 3, steady: 1, challenge: 0.8 });

// 레벨별 기준 공개 시간(ms). 문서의 T1=6000/T2=8000/T3=10000을 따른다.
const BASE_REVEAL_MS = Object.freeze([6000, 8000, 10000]);

// 힌트 자동 발동 타임라인(공개 종료 뒤 경과 ms)과 H3 반복 주기.
export const HINT_AUTO_MS = Object.freeze([8000, 16000, 28000]);
export const HINT_REPEAT_MS = 10000;
export const HINT_BUTTON_READY_MS = 3000;

// mulberry32 — 시드 고정 재현용 난수(문서 §8-5).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function revealDurationMs(item, difficulty) {
  const speed = SPEED[difficulty] ?? SPEED.steady;
  return Math.round(BASE_REVEAL_MS[item.l - 1] * speed);
}

function shuffled(list, rng) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickItem(pool, rng) {
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

// 정답 5개 선정 — 레벨 배분을 지키고, 최근 출제·같은 카테고리 3회 이상을
// 피한다. 제약 때문에 후보가 마르면 제약을 순서대로 풀어 항상 5개를 채운다
// (문서 §9-2-5: 무한 루프·예외 금지).
function chooseAnswers(plan, rng, recent, items) {
  const recentSet = new Set(recent);
  const chosen = [];
  const chosenNames = new Set();
  const categoryCount = new Map();

  for (const level of plan) {
    const leveled = items.filter(item => item.l === level);
    const relaxations = [
      item =>
        !chosenNames.has(item.n) &&
        !recentSet.has(item.n) &&
        (categoryCount.get(item.c) ?? 0) < 2,
      item => !chosenNames.has(item.n) && !recentSet.has(item.n),
      item => !chosenNames.has(item.n)
    ];
    let pool = [];
    for (const accepts of relaxations) {
      pool = leveled.filter(accepts);
      if (pool.length > 0) break;
    }
    const item = pickItem(pool.length > 0 ? pool : leveled, rng);
    chosen.push(item);
    chosenNames.add(item.n);
    categoryCount.set(item.c, (categoryCount.get(item.c) ?? 0) + 1);
  }
  return chosen;
}

function buildCards(answer, rng, items) {
  const siblings = items.filter(
    item => item.c === answer.c && item.n !== answer.n
  );
  const distractors = shuffled(siblings, rng).slice(0, 3);
  const cards = shuffled([answer, ...distractors], rng);
  return { cards, answerIndex: cards.findIndex(card => card.n === answer.n) };
}

export function createCatchmind(difficulty, seed = 1, options = {}) {
  const { recent = [], items = CATCHMIND_ITEMS } = options;
  const plan = LEVEL_PLAN[difficulty] ?? LEVEL_PLAN.steady;
  const rng = mulberry32(seed);
  const answers = chooseAnswers(plan, rng, recent, items);
  const rounds = answers.map(answer => ({
    item: answer,
    ...buildCards(answer, rng, items)
  }));

  const model = {
    difficulty,
    seed,
    rng,
    rounds,
    roundIndex: 0,
    phase: "reveal", // reveal → wait → celebrate → (다음 라운드 | result)
    elapsedMs: 0,
    revealMs: 0,
    wrong: [],
    hintLevel: 0,
    hintUsedH2: false,
    hintUsedH3: false,
    firstTry: true,
    nextPulseMs: 0,
    starsEarned: [],
    totalStars: 0
  };
  resetRound(model);
  return model;
}

function resetRound(model) {
  const round = model.rounds[model.roundIndex];
  model.phase = "reveal";
  model.elapsedMs = 0;
  model.revealMs = revealDurationMs(round.item, model.difficulty);
  model.wrong = [];
  model.hintLevel = 0;
  model.hintUsedH2 = false;
  model.hintUsedH3 = false;
  model.firstTry = true;
  model.nextPulseMs = 0;
}

export function currentCatchmindRound(model) {
  return model.rounds[model.roundIndex];
}

export function revealFraction(model) {
  return Math.min(1, model.elapsedMs / model.revealMs);
}

// 지금 맞히면 얻는 별 수 — 라이브 인디케이터와 판정이 같은 함수를 쓴다.
export function starsIfNow(model) {
  if (!model.hintUsedH3) {
    if (
      model.firstTry &&
      !model.hintUsedH2 &&
      model.elapsedMs <= model.revealMs * 0.5
    ) {
      return 3;
    }
    if (model.elapsedMs <= model.revealMs + 1000) return 2;
  }
  return 1;
}

export function hintButtonReady(model) {
  if (model.phase !== "reveal" && model.phase !== "wait") return false;
  if (model.elapsedMs < HINT_BUTTON_READY_MS) return false;
  if (model.hintLevel >= 3) return false;
  // H3(정답 알려주기)는 공개가 끝난 뒤에만 — 그리는 도중 정답 공개는 김빠진다.
  if (model.hintLevel === 2 && model.phase !== "wait") return false;
  return true;
}

function fireHint(model) {
  const level = model.hintLevel + 1;
  model.hintLevel = level;
  if (level === 3) {
    model.hintUsedH3 = true;
    model.nextPulseMs = model.elapsedMs + HINT_REPEAT_MS;
    return [{ type: "hint", level, removedIndex: null }];
  }
  if (level === 2) model.hintUsedH2 = true;
  const round = currentCatchmindRound(model);
  const candidates = round.cards
    .map((card, index) => index)
    .filter(
      index => index !== round.answerIndex && !model.wrong.includes(index)
    );
  if (candidates.length === 0) return [{ type: "hint", level, removedIndex: null }];
  const removedIndex = pickItem(candidates, model.rng);
  model.wrong.push(removedIndex);
  return [{ type: "hint", level, removedIndex }];
}

export function useCatchmindHint(model) {
  if (!hintButtonReady(model)) return [];
  return fireHint(model);
}

// 매 프레임 진행 — deltaMs는 호출부가 탭 은닉 대비로 상한을 걸어 넘긴다.
export function tickCatchmind(model, deltaMs) {
  if (model.phase !== "reveal" && model.phase !== "wait") return [];
  const events = [];
  model.elapsedMs += deltaMs;

  if (model.phase === "reveal" && model.elapsedMs >= model.revealMs) {
    model.phase = "wait";
    events.push({ type: "reveal-done" });
  }

  if (model.phase === "wait") {
    const sinceDone = model.elapsedMs - model.revealMs;
    while (model.hintLevel < 3 && sinceDone >= HINT_AUTO_MS[model.hintLevel]) {
      events.push(...fireHint(model));
    }
    if (model.hintLevel >= 3 && model.elapsedMs >= model.nextPulseMs) {
      model.nextPulseMs = model.elapsedMs + HINT_REPEAT_MS;
      events.push({ type: "hint-pulse" });
    }
  }
  return events;
}

export function guessCatchmindCard(model, cardIndex) {
  if (model.phase !== "reveal" && model.phase !== "wait") return [];
  const round = currentCatchmindRound(model);
  if (cardIndex < 0 || cardIndex >= round.cards.length) return [];
  if (model.wrong.includes(cardIndex)) return [];

  if (cardIndex !== round.answerIndex) {
    model.wrong.push(cardIndex);
    model.firstTry = false;
    return [{ type: "wrong", index: cardIndex }];
  }

  const stars = starsIfNow(model);
  model.starsEarned.push(stars);
  model.totalStars += stars;
  model.phase = "celebrate";
  return [{ type: "correct", index: cardIndex, stars, item: round.item }];
}

// 축하 연출이 끝난 뒤 호출 — 다음 라운드 또는 결과로 넘어간다.
export function advanceCatchmind(model) {
  if (model.phase !== "celebrate") return [];
  if (model.roundIndex + 1 >= model.rounds.length) {
    model.phase = "result";
    return [{ type: "result", totalStars: model.totalStars }];
  }
  model.roundIndex += 1;
  resetRound(model);
  return [{ type: "round", index: model.roundIndex }];
}
