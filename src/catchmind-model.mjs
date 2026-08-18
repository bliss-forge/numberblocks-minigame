// 슥삭 그림 퀴즈 — 순수 게임 로직. DOM·오디오·시간을 모른다.
//
// 공개 방식(2026-08-19 사용자 지시): 그림은 단계로 그려진다.
// - 라운드가 시작되면 1단계 — 큰 윤곽(전체 선 길이의 25%)만 그리고 멈춘다.
//   (지도라면 네모부터.) 아이는 그 상태에서 바로 맞혀도 된다.
// - 힌트 1번 = 다음 단계를 마저 그린다(25→40→55→70→85→100%). 힌트는 5번.
// - 가만히 있으면 일정 시간마다 자동으로 다음 단계를 그려 준다(막힌 아이
//   구제 — 자동도 힌트 5번에 포함). 5번을 다 쓰고도 못 고르면 정답 카드가
//   주기적으로 반짝인다. 실패·타임오버는 없다.
// - 별은 시간이 아니라 힌트 수로 판정: 한 번에 정답 + 힌트 ≤1 = ★3,
//   힌트 ≤3 = ★2, 그 외 = ★1. 오답 카드는 라운드 내 영구 비활성.
//
// 설계 문서(catchmind-game-design.md)와 다른 점:
// - 시간 기반 별 판정·오답 제거 힌트 3단계를 폐기하고 위 단계 공개로 대체.
// - 오답 3개는 저작 고정 목록 대신 같은 카테고리에서 시드 난수로 뽑는다.
// - 판마다 서서히 어려워지는 램프(stagePlan)는 내부에만 있고 화면에 단계
//   숫자를 쓰지 않는다 — "단계"라는 말은 그림 공개 단계에만 쓴다.

import { CATCHMIND_ITEMS } from "./catchmind-data.mjs";

export const CATCHMIND_ROUNDS = 5;

// 그림 공개 단계 — 시작하면 [0]까지 그리고 멈춘다. 힌트 n번째 = [n]까지.
export const STEP_FRACTIONS = Object.freeze([0.25, 0.4, 0.55, 0.7, 0.85, 1]);
export const CATCHMIND_HINT_MAX = STEP_FRACTIONS.length - 1; // 5
// 멈춘 채 이 시간이 지나면 자동으로 다음 단계를 그려 준다.
export const AUTO_HINT_IDLE_MS = 10000;
// 힌트 소진 후 이 주기로 정답 카드를 반짝여 준다.
export const RESCUE_PULSE_MS = 10000;

// 판 램프(내부 전용) — 판을 거듭할수록 문항 레벨이 어려워지고 그리기가
// 빨라진다. 5판째에서 상한 — 이후는 같은 난이도로 끝없이 이어진다.
const STAGE_PLANS = Object.freeze([
  Object.freeze({ levels: Object.freeze([1, 1, 1, 1, 1]), durationScale: 1.3 }),
  Object.freeze({ levels: Object.freeze([1, 1, 1, 2, 2]), durationScale: 1.15 }),
  Object.freeze({ levels: Object.freeze([1, 2, 2, 2, 3]), durationScale: 1 }),
  Object.freeze({ levels: Object.freeze([2, 2, 3, 3, 3]), durationScale: 0.9 }),
  Object.freeze({ levels: Object.freeze([3, 3, 3, 3, 3]), durationScale: 0.8 })
]);

export function normalizeStage(stage) {
  const parsed = Math.floor(Number(stage));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

export function stagePlan(stage) {
  const index = Math.min(normalizeStage(stage), STAGE_PLANS.length) - 1;
  return STAGE_PLANS[index];
}

// 레벨별 전체 그림 소요 시간(ms). 문서의 T1=6000/T2=8000/T3=10000을 따른다.
// 단계 공개에서는 "쉬지 않고 다 그렸을 때" 걸리는 시간이고, 실제로는
// 단계 경계에서 멈추므로 한 단계는 이 시간의 15~25%씩이다.
const BASE_REVEAL_MS = Object.freeze([6000, 8000, 10000]);

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

export function revealDurationMs(item, stage) {
  return Math.round(BASE_REVEAL_MS[item.l - 1] * stagePlan(stage).durationScale);
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

export function createCatchmind(stage, seed = 1, options = {}) {
  const { recent = [], items = CATCHMIND_ITEMS } = options;
  const normalized = normalizeStage(stage);
  const plan = stagePlan(normalized).levels;
  const rng = mulberry32(seed);
  const answers = chooseAnswers(plan, rng, recent, items);
  const rounds = answers.map(answer => ({
    item: answer,
    ...buildCards(answer, rng, items)
  }));

  const model = {
    stage: normalized,
    seed,
    rng,
    rounds,
    roundIndex: 0,
    // drawing(단계를 그리는 중) → guess(멈추고 대기) → celebrate → result
    phase: "drawing",
    revealFraction: 0,
    revealTarget: STEP_FRACTIONS[0],
    revealMs: 0,
    hintsUsed: 0,
    idleMs: 0,
    rescue: false,
    wrong: [],
    firstTry: true,
    starsEarned: [],
    totalStars: 0
  };
  resetRound(model);
  return model;
}

function resetRound(model) {
  const round = model.rounds[model.roundIndex];
  model.phase = "drawing";
  model.revealFraction = 0;
  model.revealTarget = STEP_FRACTIONS[0];
  model.revealMs = revealDurationMs(round.item, model.stage);
  model.hintsUsed = 0;
  model.idleMs = 0;
  model.rescue = false;
  model.wrong = [];
  model.firstTry = true;
}

export function currentCatchmindRound(model) {
  return model.rounds[model.roundIndex];
}

export function revealFraction(model) {
  return model.revealFraction;
}

export function hintsRemaining(model) {
  return CATCHMIND_HINT_MAX - model.hintsUsed;
}

// 지금 맞히면 얻는 별 수 — 라이브 인디케이터와 판정이 같은 함수를 쓴다.
// 시간 압박 없음: 힌트를 얼마나 썼는지(그림을 얼마나 보여 달라고 했는지)와
// 한 번에 맞혔는지만 본다.
export function starsIfNow(model) {
  if (model.firstTry && model.hintsUsed <= 1) return 3;
  if (model.hintsUsed <= 3) return 2;
  return 1;
}

export function hintButtonReady(model) {
  return model.phase === "guess" && model.hintsUsed < CATCHMIND_HINT_MAX;
}

function fireHint(model, auto) {
  model.hintsUsed += 1;
  model.revealTarget =
    STEP_FRACTIONS[Math.min(model.hintsUsed, STEP_FRACTIONS.length - 1)];
  model.phase = "drawing";
  model.idleMs = 0;
  return [
    {
      type: "hint",
      used: model.hintsUsed,
      remaining: hintsRemaining(model),
      auto
    }
  ];
}

export function useCatchmindHint(model) {
  if (!hintButtonReady(model)) return [];
  return fireHint(model, false);
}

// 매 프레임 진행 — deltaMs는 호출부가 탭 은닉 대비로 상한을 걸어 넘긴다.
export function tickCatchmind(model, deltaMs) {
  if (model.phase === "drawing") {
    model.revealFraction = Math.min(
      model.revealTarget,
      model.revealFraction + deltaMs / model.revealMs
    );
    if (model.revealFraction >= model.revealTarget - 1e-9) {
      // 부동소수 누적 오차를 잘라 정확히 목표에 앉힌다 — 마지막 단계에서
      // 1.0에 못 미치면 장면 쪽 완성 판정(fraction >= 1)이 어긋난다.
      model.revealFraction = model.revealTarget;
      model.phase = "guess";
      model.idleMs = 0;
      return [
        {
          type: "step-done",
          step: model.hintsUsed + 1,
          complete: model.revealTarget >= 1
        }
      ];
    }
    return [];
  }

  if (model.phase !== "guess") return [];

  model.idleMs += deltaMs;
  if (model.hintsUsed < CATCHMIND_HINT_MAX) {
    if (model.idleMs >= AUTO_HINT_IDLE_MS) return fireHint(model, true);
    return [];
  }
  if (model.idleMs >= RESCUE_PULSE_MS) {
    model.idleMs = 0;
    model.rescue = true;
    return [{ type: "rescue-pulse" }];
  }
  return [];
}

export function guessCatchmindCard(model, cardIndex) {
  if (model.phase !== "drawing" && model.phase !== "guess") return [];
  const round = currentCatchmindRound(model);
  if (cardIndex < 0 || cardIndex >= round.cards.length) return [];
  if (model.wrong.includes(cardIndex)) return [];

  if (cardIndex !== round.answerIndex) {
    model.wrong.push(cardIndex);
    model.firstTry = false;
    model.idleMs = 0;
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
