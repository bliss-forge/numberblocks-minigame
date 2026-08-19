// 슥삭 그림 퀴즈 — 장면 렌더. 선 그리기 공개 엔진과 카드·게이지·결과·도감 DOM.
//
// 선 그리기 공개(캐치마인드 방식): 이모지에서 추출한 윤곽선을 화가처럼
// 3단계로 그린다. 세 단계 모두 그림 "전체"를 그리고, 단계마다 정밀도가
// 다르다 — ① 스케치: 심하게 단순화하고 삐뚤빼뚤한 연한 선(엄청 대충 그린
// 밑그림) ② 형태 잡기: 더 정확한 진회색 선으로 덧그리기 ③ 완성: 원본
// 좌표 그대로 색연필 선. 단계가 바뀌면 펜이 처음으로 돌아가 위에 덧그린다.
// 정답을 맞히기 전에는 선 그림뿐이고, 완성 채색본은 정답 후
// paintCatchmindColorIn 이 선 아래에 깔아 준다(설계 문서 §4-4).
//
// 획 순서는 문서 §4-5의 저작 규칙을 따른다: 긴 경로(대개 실루엣)부터
// 그리고 세부 장식이 뒤따른다. 획 색은 그 경계 주변의 원본 색을 어둡게
// 뽑아 쓴다 — 색연필로 그리는 느낌이고, 모양과 색 카테고리(빨강·파랑…)도
// 선만으로 구별된다.

import {
  CATCHMIND_CATEGORIES,
  CATCHMIND_ITEMS
} from "./catchmind-data.mjs";
import {
  CATCHMIND_ROUNDS,
  STEP_NAMES,
  guessCountdown,
  overallRevealProgress,
  starsIfNow
} from "./catchmind-model.mjs";

const CANVAS_SIZE = 300; // 논리 좌표. CSS 크기는 스타일시트가 정한다.

// 공개 3단계의 그리기 스타일 — 세 단계 모두 그림 전체를 긋고 정밀도만
// 다르다. epsilon 은 경로 단순화 강도, jitter 는 손떨림 크기(px).
// final 단계만 획별 원본 색(color: null)을 쓰고, 앞 단계는 연필 톤 단색.
const STAGE_STYLES = Object.freeze([
  // 스케치 — 심하게 단순화 + 크게 삐뚤빼뚤, 연한 가는 선
  Object.freeze({ epsilon: 12, jitter: 3.5, width: 2.5, color: "#c9c1ae" }),
  // 형태 잡기 — 살짝 단순화, 진회색
  Object.freeze({ epsilon: 5, jitter: 1, width: 3.5, color: "#8a7b63" }),
  // 완성 — 원본 좌표 그대로, 색연필
  Object.freeze({ epsilon: 0, jitter: 0, width: 4.5, color: null })
]);

function el(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ── 윤곽선 추출 — 이모지 비트맵에서 획 경로를 만든다 ──────────────────────
//
// 1) 경계 픽셀 표시: 실루엣(불투명↔투명)과 내부 특징(이웃과 색 차가 큰 곳).
//    완만한 그라데이션은 픽셀당 변화가 작아 경계로 잡히지 않는다.
// 2) 경계 픽셀을 이웃 따라 걷기로 폴리라인으로 잇는다(반지름 2까지 틈 점프).
// 3) 짧은 노이즈를 버리고 RDP 로 단순화한 뒤 긴 경로(실루엣)부터 정렬한다.
//
// 순수 함수 — {width, height, data}만 받으므로 노드 테스트가 가능하다.
export function traceEmojiEdges(image, options = {}) {
  const {
    alphaMin = 64,     // 불투명 판정 문턱
    colorDelta = 96,   // 내부 경계 판정: 이웃과 ΔR+ΔG+ΔB 가 이보다 크면 특징선
    minPoints = 14,    // 이보다 짧은 원시 경로는 노이즈로 버린다
    epsilon = 2,       // RDP 단순화 허용 오차(px)
    maxPaths = 48      // 세부 장식 상한 — 긴 경로부터 남긴다
  } = options;
  const { width, height, data } = image;
  const size = width * height;
  const edge = new Uint8Array(size);
  const opaque = index => data[index * 4 + 3] >= alphaMin;
  const delta = (a, b) =>
    Math.abs(data[a * 4] - data[b * 4]) +
    Math.abs(data[a * 4 + 1] - data[b * 4 + 1]) +
    Math.abs(data[a * 4 + 2] - data[b * 4 + 2]);

  for (let y = 0; y < height - 1; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const here = y * width + x;
      for (const neighbor of [here + 1, here + width]) {
        const hereOpaque = opaque(here);
        const neighborOpaque = opaque(neighbor);
        if (hereOpaque !== neighborOpaque) {
          edge[hereOpaque ? here : neighbor] = 1;
        } else if (hereOpaque && delta(here, neighbor) > colorDelta) {
          edge[here] = 1;
        }
      }
    }
  }

  const visited = new Uint8Array(size);
  const near = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx || dy) near.push([dx, dy]);
    }
  }
  const ring = [];
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push([dx, dy]);
    }
  }

  const nextFrom = (x, y) => {
    for (const offsets of [near, ring]) {
      for (const [dx, dy] of offsets) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const index = ny * width + nx;
        if (edge[index] && !visited[index]) return [nx, ny];
      }
    }
    return null;
  };

  const walk = (startX, startY) => {
    const points = [];
    let x = startX;
    let y = startY;
    for (;;) {
      const found = nextFrom(x, y);
      if (!found) return points;
      [x, y] = found;
      visited[y * width + x] = 1;
      points.push([x, y]);
    }
  };

  const paths = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!edge[index] || visited[index]) continue;
      visited[index] = 1;
      const forward = walk(x, y);
      const backward = walk(x, y).reverse(); // 씨앗이 곡선 중간이면 반대쪽도 걷는다
      const raw = [...backward, [x, y], ...forward];
      if (raw.length < minPoints) continue;

      // 획 색: 경로 주변의 불투명 픽셀 평균을 어둡게 — 색연필 느낌.
      let r = 0;
      let g = 0;
      let b = 0;
      let samples = 0;
      for (let i = 0; i < raw.length; i += 4) {
        const [px, py] = raw[i];
        for (const [dx, dy] of [[0, 0], ...near]) {
          const sx = px + dx;
          const sy = py + dy;
          if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
          const s = sy * width + sx;
          if (!opaque(s)) continue;
          r += data[s * 4];
          g += data[s * 4 + 1];
          b += data[s * 4 + 2];
          samples += 1;
        }
      }
      // 어둡게(×0.62) 한 뒤에도 밝은 이모지(외계인·하양 계열)는 선이 옅어서
      // 크림색 배경에 묻힌다 — 휘도 상한 170으로 한 번 더 눌러 준다.
      let sr = (r / Math.max(1, samples)) * 0.62;
      let sg = (g / Math.max(1, samples)) * 0.62;
      let sb = (b / Math.max(1, samples)) * 0.62;
      const luma = 0.299 * sr + 0.587 * sg + 0.114 * sb;
      if (luma > 170) {
        const scale = 170 / luma;
        sr *= scale;
        sg *= scale;
        sb *= scale;
      }
      const points = simplifyPath(raw, epsilon);
      paths.push({
        points,
        length: pathLength(points),
        color: samples > 0
          ? `rgb(${Math.round(sr)}, ${Math.round(sg)}, ${Math.round(sb)})`
          : "#3a3a3a"
      });
    }
  }

  paths.sort((a, b) => b.length - a.length);
  return paths.slice(0, maxPaths);
}

function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(
      points[i][0] - points[i - 1][0],
      points[i][1] - points[i - 1][1]
    );
  }
  return total;
}

// Ramer–Douglas–Peucker — 걷기 경로의 지그재그를 곧게 편다.
function simplifyPath(points, epsilon) {
  if (points.length <= 2) return points;
  const [x0, y0] = points[0];
  const [x1, y1] = points[points.length - 1];
  let maxDistance = 0;
  let maxIndex = 0;
  const span = Math.hypot(x1 - x0, y1 - y0) || 0.0001;
  for (let i = 1; i < points.length - 1; i += 1) {
    const [px, py] = points[i];
    const distance =
      Math.abs((x1 - x0) * (y0 - py) - (x0 - px) * (y1 - y0)) / span;
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }
  if (maxDistance <= epsilon) return [points[0], points[points.length - 1]];
  const left = simplifyPath(points.slice(0, maxIndex + 1), epsilon);
  const right = simplifyPath(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

// 경로를 "대충 그린 손그림"으로 만든다 — 세게 단순화한 뒤 점마다 결정적
// 손떨림(좌표 해시 기반이라 매 프레임 같은 모양)을 더한다. 순수 함수.
export function roughenPath(points, { epsilon = 12, jitter = 3 } = {}) {
  const simplified = epsilon > 0 ? simplifyPath(points, epsilon) : points;
  if (jitter <= 0) return simplified;
  return simplified.map(([x, y], index) => {
    const hash = Math.sin(x * 12.9898 + y * 78.233 + index * 37.719) * 43758.5453;
    const angle = (hash - Math.floor(hash)) * Math.PI * 2;
    const spin = hash * 7;
    const radius = (spin - Math.floor(spin)) * jitter;
    return [x + Math.cos(angle) * radius, y + Math.sin(angle) * radius];
  });
}

// ── 라운드 장면 ────────────────────────────────────────────────────────────
export function renderCatchmindRound(document, model) {
  const round = model.rounds[model.roundIndex];
  const root = el(document, "div", "cm-root");
  root.dataset.cmPhase = model.phase;

  const top = el(document, "div", "cm-top");
  const dots = el(document, "div", "cm-dots");
  dots.setAttribute("aria-label", `${CATCHMIND_ROUNDS}판 중 ${model.roundIndex + 1}번째 그림`);
  for (let i = 0; i < CATCHMIND_ROUNDS; i += 1) {
    dots.append(el(document, "span", "cm-dot"));
  }
  const live = el(document, "div", "cm-live");
  live.setAttribute("aria-label", "지금 맞히면 얻는 별");
  for (let i = 0; i < 3; i += 1) {
    live.append(el(document, "span", "cm-live-star", "★"));
  }
  const category = CATCHMIND_CATEGORIES[round.item.c];
  const chip = el(document, "span", "cm-chip");
  chip.append(
    el(document, "span", "cm-chip-icon", category.icon),
    el(document, "span", "cm-chip-label", category.label)
  );
  top.append(dots, chip, live);

  const board = el(document, "div", "cm-board");
  // 지금 몇 단계인지 — 1단계 스케치 / 2단계 형태 잡기 / 3단계 완성.
  const step = el(document, "span", "cm-step");
  step.append(
    el(document, "strong", "cm-step-number", "1단계"),
    el(document, "span", "cm-step-name", STEP_NAMES[0])
  );

  const frame = el(document, "div", "cm-frame");
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", "슥삭이가 그림을 그리는 중");
  const canvas = el(document, "canvas", "cm-canvas");
  const brush = el(document, "span", "cm-brush", "🖌️");
  brush.setAttribute("aria-hidden", "true");
  const banner = el(document, "div", "cm-banner");
  banner.hidden = true;
  frame.append(canvas, brush, banner);

  board.append(step, frame);

  // 얼마나 그려졌는지 보여 주는 진행 막대 — 별 판정과는 무관한 순수 정보.
  const gauge = el(document, "div", "cm-gauge");
  const track = el(document, "div", "cm-gauge-track");
  const fill = el(document, "div", "cm-gauge-fill");
  track.append(fill);
  gauge.append(track);

  const cardsRow = el(document, "div", "cm-cards");
  round.cards.forEach((card, index) => {
    const button = el(document, "button", "cm-card");
    button.type = "button";
    button.dataset.cmCard = String(index);
    button.append(
      el(document, "span", "cm-card-badge", String(index + 1)),
      el(document, "span", "cm-card-emoji", card.e),
      el(document, "span", "cm-card-name", card.n)
    );
    cardsRow.append(button);
  });

  root.append(top, board, gauge, cardsRow);
  return root;
}

// 캔버스 준비 — 브라우저에서만 부른다(테스트의 가짜 DOM은 getContext가 없다).
// 라운드 시작 때 한 번 윤곽선을 추출한다(300×300, 수 ms).
export function setupCatchmindReveal(scene, item, globals = globalThis) {
  const canvas = scene.querySelector(".cm-canvas");
  if (typeof canvas?.getContext !== "function") return null;
  const dpr = Math.min(globals.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const emojiFont =
    '210px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

  // 윤곽 추출용 — 논리 300×300 그대로 그려 좌표계를 캔버스와 일치시킨다.
  const traceCanvas = canvas.ownerDocument.createElement("canvas");
  traceCanvas.width = CANVAS_SIZE;
  traceCanvas.height = CANVAS_SIZE;
  const traceCtx = traceCanvas.getContext("2d", { willReadFrequently: true });
  traceCtx.textAlign = "center";
  traceCtx.textBaseline = "middle";
  traceCtx.font = emojiFont;
  traceCtx.fillText(item.e, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 12);
  const paths = traceEmojiEdges(
    traceCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  );

  // 정답 후 채색용 — 선명하게 DPR 배율로 따로 그려 둔다.
  const emoji = canvas.ownerDocument.createElement("canvas");
  emoji.width = CANVAS_SIZE * dpr;
  emoji.height = CANVAS_SIZE * dpr;
  const emojiCtx = emoji.getContext("2d");
  emojiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  emojiCtx.textAlign = "center";
  emojiCtx.textBaseline = "middle";
  emojiCtx.font = emojiFont;
  emojiCtx.fillText(item.e, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 12);

  // 단계별 경로 세트 — 같은 그림을 정밀도만 다르게 세 벌 준비한다.
  const sets = STAGE_STYLES.map(style => {
    const stagePaths = paths.map(path => {
      const points = roughenPath(path.points, style);
      return { points, color: path.color, length: pathLength(points) };
    });
    return {
      paths: stagePaths,
      totalLength: stagePaths.reduce((sum, path) => sum + path.length, 0) || 1
    };
  });

  return {
    canvas,
    ctx,
    emoji,
    sets,
    stage: 1,      // 지금 긋고 있는 공개 단계(1~3)
    pathIndex: 0,
    segIndex: 0,
    segOffset: 0,
    painted: 0,
    tip: null,
    done: false,
    brush: scene.querySelector(".cm-brush")
  };
}

// 현재 단계의 선을 목표 길이까지 긋는다 — 완료된 선은 캔버스에 남으므로
// 매 프레임 새 구간만 긋는다.
function drawStageTo(reveal, progress) {
  const { ctx } = reveal;
  const style = STAGE_STYLES[reveal.stage - 1];
  const { paths, totalLength } = reveal.sets[reveal.stage - 1];
  const target = Math.min(1, progress) * totalLength;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = style.width;

  while (reveal.painted < target - 0.01 && reveal.pathIndex < paths.length) {
    const path = paths[reveal.pathIndex];
    if (reveal.segIndex >= path.points.length - 1) {
      reveal.pathIndex += 1; // 펜을 들어 다음 획으로
      reveal.segIndex = 0;
      reveal.segOffset = 0;
      continue;
    }
    const [x0, y0] = path.points[reveal.segIndex];
    const [x1, y1] = path.points[reveal.segIndex + 1];
    const segLength = Math.hypot(x1 - x0, y1 - y0) || 0.0001;
    const step = Math.min(segLength - reveal.segOffset, target - reveal.painted);
    const t0 = reveal.segOffset / segLength;
    const t1 = (reveal.segOffset + step) / segLength;

    ctx.strokeStyle = style.color ?? path.color;
    ctx.beginPath();
    ctx.moveTo(x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0);
    ctx.lineTo(x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1);
    ctx.stroke();

    reveal.painted += step;
    reveal.segOffset += step;
    reveal.tip = [x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1];
    if (reveal.segOffset >= segLength - 0.001) {
      reveal.segIndex += 1;
      reveal.segOffset = 0;
    }
  }
}

// 공개 단계를 그린다. 단계가 바뀌면 이전 단계를 즉시 마저 긋고, 펜을 처음으로
// 되돌려 같은 선 위에 진하게 덧그린다 — 스케치 → 형태 → 완성의 화가 흐름.
export function paintCatchmindReveal(reveal, step, progress) {
  if (!reveal || reveal.done) return;

  while (reveal.stage < step) {
    drawStageTo(reveal, 1);
    reveal.stage += 1;
    reveal.pathIndex = 0;
    reveal.segIndex = 0;
    reveal.segOffset = 0;
    reveal.painted = 0;
  }
  drawStageTo(reveal, progress);

  if (step >= STAGE_STYLES.length && progress >= 1) {
    reveal.done = true;
    if (reveal.brush) reveal.brush.hidden = true;
    return;
  }

  if (reveal.brush && reveal.tip) {
    reveal.brush.hidden = false;
    reveal.brush.style.left = `${(reveal.tip[0] / CANVAS_SIZE) * 100}%`;
    reveal.brush.style.top = `${(reveal.tip[1] / CANVAS_SIZE) * 100}%`;
  }
}

// 정답 후 채색 — 완성 이모지를 선 아래(destination-over)에 깔아 준다.
// 작은 alpha 로 여러 번 부르면 서서히 차오르는 연출이 된다.
export function paintCatchmindColorIn(reveal, alpha = 1) {
  if (!reveal) return;
  const { ctx } = reveal;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "destination-over";
  ctx.drawImage(reveal.emoji, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.restore();
}

// 매 프레임 DOM 갱신 — 단계 칩·게이지·라이브 별·라운드 점.
export function updateCatchmindScene(scene, model) {
  scene.dataset.cmPhase = model.phase;

  const number = scene.querySelector(".cm-step-number");
  if (number) number.textContent = `${model.step}단계`;
  const name = scene.querySelector(".cm-step-name");
  if (name) name.textContent = STEP_NAMES[model.step - 1];

  // 게이지: 대기 중(1·2단계 뒤)에는 다음 단계까지 남은 시간이 줄어드는
  // 노란 막대, 그 외에는 전체 그리기 진행을 보여 주는 파란 막대.
  const fill = scene.querySelector(".cm-gauge-fill");
  if (fill) {
    const countdown = guessCountdown(model);
    fill.classList.toggle("countdown", countdown !== null);
    const fraction = countdown ?? overallRevealProgress(model);
    fill.style.width = `${Math.round(fraction * 1000) / 10}%`;
  }

  const now = starsIfNow(model);
  scene.querySelectorAll(".cm-live-star").forEach((star, index) => {
    star.classList.toggle("lit", index < now);
  });

  scene.querySelectorAll(".cm-dot").forEach((dot, index) => {
    dot.classList.toggle("done", index < model.roundIndex);
    dot.classList.toggle("current", index === model.roundIndex);
  });

  const round = model.rounds[model.roundIndex];
  scene.querySelectorAll(".cm-card").forEach((card, index) => {
    const dead = model.wrong.includes(index);
    card.classList.toggle("dead", dead);
    card.disabled = dead || model.phase === "celebrate";
    if (model.phase !== "celebrate") {
      card.classList.toggle(
        "pulse",
        model.rescue && index === round.answerIndex
      );
    }
  });
}

// 정답 축하 — 이름 배너와 카드 확대. 별 팝은 앱이 사운드와 함께 굴린다.
export function showCatchmindCelebrate(scene, item, stars) {
  const banner = scene.querySelector(".cm-banner");
  if (!banner) return;
  banner.hidden = false;
  banner.replaceChildren();
  const doc = scene.ownerDocument ?? document;
  banner.append(
    el(doc, "span", "cm-banner-emoji", item.e),
    el(doc, "span", "cm-banner-name", item.n),
    el(doc, "span", "cm-banner-stars", "★".repeat(stars))
  );
  scene.querySelectorAll(".cm-card").forEach(card => {
    card.classList.remove("pulse");
    card.classList.toggle(
      "won",
      card.querySelector(".cm-card-name")?.textContent === item.n
    );
  });
}

// ── 결과 화면 ──────────────────────────────────────────────────────────────
export function renderCatchmindResult(document, model, best) {
  const root = el(document, "div", "cm-root cm-result");
  const title = el(document, "h2", "cm-result-title", "참 잘했어요!");

  const total = el(document, "div", "cm-result-total");
  total.append(
    el(document, "span", "cm-result-total-stars", `★ ${model.totalStars}`),
    el(
      document,
      "span",
      "cm-result-best",
      model.totalStars >= best ? "👑 최고 기록!" : `👑 최고 ★ ${best}`
    )
  );

  const tiles = el(document, "div", "cm-result-tiles");
  model.rounds.forEach((round, index) => {
    const tile = el(document, "div", "cm-result-tile");
    tile.append(
      el(document, "span", "cm-result-emoji", round.item.e),
      el(document, "span", "cm-result-name", round.item.n),
      el(document, "span", "cm-result-stars", "★".repeat(model.starsEarned[index] ?? 0))
    );
    tiles.append(tile);
  });

  const actions = el(document, "div", "cm-actions");
  for (const [action, label, icon] of [
    ["next", "또 하기", "🔄"],
    ["collection", "그림 도감", "📖"],
    ["home", "처음으로", "🏠"]
  ]) {
    const button = el(document, "button", "cm-action");
    button.type = "button";
    button.dataset.cmAction = action;
    button.append(
      el(document, "span", "cm-action-icon", icon),
      el(document, "span", "cm-action-label", label)
    );
    actions.append(button);
  }

  root.append(title, total, tiles, actions);
  return root;
}

// ── 그림 도감 ──────────────────────────────────────────────────────────────
export function renderCatchmindCollection(document, collectedNames, tab) {
  const activeTab = Object.hasOwn(CATCHMIND_CATEGORIES, tab) ? tab : "animal";
  const root = el(document, "div", "cm-root cm-collection");

  const bar = el(document, "div", "cm-collection-bar");
  const back = el(document, "button", "cm-action cm-back");
  back.type = "button";
  back.dataset.cmAction = "back";
  back.append(
    el(document, "span", "cm-action-icon", "◀"),
    el(document, "span", "cm-action-label", "돌아가기")
  );
  bar.append(back);

  const tabs = el(document, "div", "cm-tabs");
  for (const [key, category] of Object.entries(CATCHMIND_CATEGORIES)) {
    const button = el(document, "button", "cm-tab");
    button.type = "button";
    button.dataset.cmTab = key;
    button.classList.toggle("active", key === activeTab);
    button.append(
      el(document, "span", "cm-tab-icon", category.icon),
      el(document, "span", "cm-tab-label", category.label)
    );
    tabs.append(button);
  }
  bar.append(tabs);

  const items = CATCHMIND_ITEMS.filter(item => item.c === activeTab);
  const owned = items.filter(item => collectedNames.has(item.n)).length;
  bar.append(
    el(document, "span", "cm-collection-count", `${owned}/${items.length}`)
  );

  const grid = el(document, "div", "cm-collection-grid");
  for (const item of items) {
    const cell = el(document, "div", "cm-cell");
    if (collectedNames.has(item.n)) {
      cell.append(
        el(document, "span", "cm-cell-emoji", item.e),
        el(document, "span", "cm-cell-name", item.n)
      );
    } else {
      cell.classList.add("locked");
      cell.append(
        el(document, "span", "cm-cell-emoji", "❔"),
        el(document, "span", "cm-cell-name", "???")
      );
    }
    grid.append(cell);
  }

  root.append(bar, grid);
  return root;
}
