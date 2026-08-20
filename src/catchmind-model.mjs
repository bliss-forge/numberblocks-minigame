// 슥삭 그림 퀴즈 — 순수 게임 로직. DOM·오디오·시간을 모른다.
//
// 공개 방식(2026-08-19 사용자 지시): 화가가 그리듯 3단계로 그린다.
// - 1단계 스케치: 연한 밑그림만 긋고 멈춘다.
// - 2단계 자세히 그리기: 원본 좌표 그대로 색연필 선으로 꼼꼼히 덧그린다.
// - 3단계 색칠하기: 완성 그림의 색이 위에서 아래로 차오른다.
// 단계를 다 그리면 8초(GUESS_WINDOW_MS) 기다리고, 못 맞히면 자동으로 다음
// 단계를 그린다. 3단계 뒤에는 카운트 없이 무한정 기다린다(구제 반짝임만).
// 별은 몇 단계에서 맞혔는지로 판정: 1단계+한 번에 = ★3, 2단계 = ★2,
// 3단계 = ★1. 오답 카드는 라운드 내 영구 비활성. 실패·타임오버는 없다.
//
// 설계 문서(catchmind-game-design.md)와 다른 점:
// - 시간 기반 별 판정·오답 제거 힌트 3단계를 폐기하고 위 단계 공개로 대체.
// - 오답 3개는 저작 고정 목록 대신 같은 카테고리에서 시드 난수로 뽑는다.
// - 판마다 서서히 어려워지는 램프(stagePlan)는 내부에만 있고 화면에 단계
//   숫자를 쓰지 않는다 — "단계"라는 말은 그림 공개 단계에만 쓴다.

import { CATCHMIND_ITEMS } from "./catchmind-data.mjs";

export const CATCHMIND_ROUNDS = 5;

// 공개 3단계 — 스케치 / 자세히 그리기 / 색칠하기.
export const REVEAL_STEPS = 3;
export const STEP_NAMES = Object.freeze(["스케치", "자세히 그리기", "색칠하기"]);
// 한 단계를 다 그린 뒤 다음 단계로 넘어가기 전까지 기다리는 시간.
export const GUESS_WINDOW_MS = 8000;
// 단계별 그리는 시간 = revealMs × 배분(스케치가 가장 길다).
const STEP_DRAW_SPANS = Object.freeze([0.5, 0.4, 0.45]);
// 3단계까지 다 보여 준 뒤에도 못 고르면 이 주기로 정답 카드를 반짝여 준다.
export const RESCUE_PULSE_MS = 15000;

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
    step: 1,          // 공개 단계 1~3
    stepProgress: 0,  // 현재 단계 안에서의 그리기 진행 0~1
    revealMs: 0,
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
  model.step = 1;
  model.stepProgress = 0;
  model.revealMs = revealDurationMs(round.item, model.stage);
  model.idleMs = 0;
  model.rescue = false;
  model.wrong = [];
  model.firstTry = true;
}

export function currentCatchmindRound(model) {
  return model.rounds[model.roundIndex];
}

// 전체 공개 진행률(0~1) — 진행 막대용. 단계 3개를 같은 폭으로 본다.
export function overallRevealProgress(model) {
  return Math.min(1, (model.step - 1 + model.stepProgress) / REVEAL_STEPS);
}

// 다음 단계까지 남은 대기 비율(1→0). 카운트가 없는 3단계에서는 null.
export function guessCountdown(model) {
  if (model.phase !== "guess" || model.step >= REVEAL_STEPS) return null;
  return Math.max(0, 1 - model.idleMs / GUESS_WINDOW_MS);
}

// 지금 맞히면 얻는 별 수 — 몇 단계까지 봤는지로 판정한다.
// ★3은 스케치(1단계)에서 한 번에 맞혔을 때만 — 카드 마구 누르기 방지.
export function starsIfNow(model) {
  if (model.step === 1 && model.firstTry) return 3;
  if (model.step <= 2) return 2;
  return 1;
}

function stepDurationMs(model) {
  return model.revealMs * STEP_DRAW_SPANS[model.step - 1];
}

// 매 프레임 진행 — deltaMs는 호출부가 탭 은닉 대비로 상한을 걸어 넘긴다.
export function tickCatchmind(model, deltaMs) {
  if (model.phase === "drawing") {
    model.stepProgress = Math.min(
      1,
      model.stepProgress + deltaMs / stepDurationMs(model)
    );
    if (model.stepProgress >= 1 - 1e-9) {
      model.stepProgress = 1; // 부동소수 오차 스냅
      model.phase = "guess";
      model.idleMs = 0;
      return [
        { type: "step-done", step: model.step, final: model.step >= REVEAL_STEPS }
      ];
    }
    return [];
  }

  if (model.phase !== "guess") return [];

  model.idleMs += deltaMs;
  if (model.step < REVEAL_STEPS) {
    // 8초 안에 못 맞히면 다음 단계를 그린다.
    if (model.idleMs >= GUESS_WINDOW_MS) {
      model.step += 1;
      model.stepProgress = 0;
      model.phase = "drawing";
      model.idleMs = 0;
      return [{ type: "step", step: model.step }];
    }
    return [];
  }
  // 3단계 뒤에는 카운트 없음 — 오래 머물면 정답 카드만 반짝여 준다.
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
