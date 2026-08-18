// 슥삭 그림 퀴즈 — 장면 렌더. 캔버스 붓칠 공개와 카드·게이지·결과·도감 DOM.
//
// 붓칠 공개: 이모지를 오프스크린 캔버스에 크게 그려 두고, 붓이 지나간
// 자리(뱀길 경로 위의 원형 붓자국)만 잘라내어 보이는 캔버스에 옮긴다.
// 완료된 붓자국은 캔버스에 그대로 남으므로 매 프레임은 새 붓자국만 그린다.

import {
  CATCHMIND_CATEGORIES,
  CATCHMIND_ITEMS
} from "./catchmind-data.mjs";
import {
  CATCHMIND_ROUNDS,
  hintButtonReady,
  revealFraction,
  starsIfNow
} from "./catchmind-model.mjs";

const CANVAS_SIZE = 300; // 논리 좌표. CSS 크기는 스타일시트가 정한다.
const DAB_STEP = 8; // 붓자국 간격(논리 px)
const DAB_RADIUS = 30; // 붓자국 반지름 — 줄 간격(약 34px)을 덮는다

function el(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ── 붓길: 좌우로 오가는 뱀길 ────────────────────────────────────────────────
function brushPath() {
  const points = [];
  const rows = 8;
  const top = 30;
  const bottom = 270;
  const left = 24;
  const right = 276;
  for (let row = 0; row < rows; row += 1) {
    const y = top + ((bottom - top) * row) / (rows - 1);
    if (row % 2 === 0) {
      points.push([left, y], [right, y]);
    } else {
      points.push([right, y], [left, y]);
    }
  }
  const segments = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const length = Math.hypot(x1 - x0, y1 - y0);
    segments.push({ x0, y0, x1, y1, start: total, length });
    total += length;
  }
  return { segments, total };
}

function pointAt(path, distance) {
  const clamped = Math.max(0, Math.min(path.total, distance));
  for (const segment of path.segments) {
    if (clamped <= segment.start + segment.length) {
      const t = segment.length === 0 ? 0 : (clamped - segment.start) / segment.length;
      return [
        segment.x0 + (segment.x1 - segment.x0) * t,
        segment.y0 + (segment.y1 - segment.y0) * t
      ];
    }
  }
  const last = path.segments[path.segments.length - 1];
  return [last.x1, last.y1];
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
  const hint = el(document, "button", "cm-hint", "💡");
  hint.type = "button";
  hint.dataset.cmHint = "1";
  hint.append(el(document, "span", "cm-hint-label", "힌트"));
  hint.setAttribute("aria-label", "힌트 — 아닌 그림 카드를 지워요");

  const frame = el(document, "div", "cm-frame");
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", "슥삭이가 그림을 그리는 중");
  const canvas = el(document, "canvas", "cm-canvas");
  const brush = el(document, "span", "cm-brush", "🖌️");
  brush.setAttribute("aria-hidden", "true");
  const banner = el(document, "div", "cm-banner");
  banner.hidden = true;
  frame.append(canvas, brush, banner);

  board.append(hint, frame);

  const gauge = el(document, "div", "cm-gauge");
  const track = el(document, "div", "cm-gauge-track");
  const fill = el(document, "div", "cm-gauge-fill");
  const mark = el(document, "span", "cm-gauge-mark");
  const zoneThree = el(document, "span", "cm-gauge-zone cm-gauge-zone-three", "★★★");
  const zoneTwo = el(document, "span", "cm-gauge-zone cm-gauge-zone-two", "★★");
  track.append(fill, mark);
  gauge.append(zoneThree, zoneTwo, track);

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
export function setupCatchmindReveal(scene, item, globals = globalThis) {
  const canvas = scene.querySelector(".cm-canvas");
  if (typeof canvas?.getContext !== "function") return null;
  const dpr = Math.min(globals.devicePixelRatio || 1, 2);
  canvas.width = CANVAS_SIZE * dpr;
  canvas.height = CANVAS_SIZE * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const emoji = canvas.ownerDocument.createElement("canvas");
  emoji.width = CANVAS_SIZE * dpr;
  emoji.height = CANVAS_SIZE * dpr;
  const emojiCtx = emoji.getContext("2d");
  emojiCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  emojiCtx.textAlign = "center";
  emojiCtx.textBaseline = "middle";
  emojiCtx.font =
    '210px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  emojiCtx.fillText(item.e, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 12);

  return {
    canvas,
    ctx,
    emoji,
    path: brushPath(),
    painted: 0,
    done: false,
    brush: scene.querySelector(".cm-brush")
  };
}

// 진행률만큼 붓자국을 더 그린다. 완료 프레임에서는 전체를 한 번에 찍는다.
export function paintCatchmindReveal(reveal, fraction) {
  if (!reveal || reveal.done) return;
  const { ctx, emoji, path } = reveal;
  const target = fraction * path.total;

  while (reveal.painted < target) {
    const [x, y] = pointAt(path, reveal.painted);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, DAB_RADIUS, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(emoji, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.restore();
    reveal.painted += DAB_STEP;
  }

  if (fraction >= 1) {
    ctx.drawImage(emoji, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    reveal.done = true;
    if (reveal.brush) reveal.brush.hidden = true;
    return;
  }

  if (reveal.brush) {
    const [x, y] = pointAt(path, target);
    reveal.brush.hidden = false;
    reveal.brush.style.left = `${(x / CANVAS_SIZE) * 100}%`;
    reveal.brush.style.top = `${(y / CANVAS_SIZE) * 100}%`;
  }
}

// 매 프레임 DOM 갱신 — 게이지·라이브 별·힌트 버튼·라운드 점.
export function updateCatchmindScene(scene, model) {
  scene.dataset.cmPhase = model.phase;

  const fraction = revealFraction(model);
  const fill = scene.querySelector(".cm-gauge-fill");
  if (fill) fill.style.width = `${Math.round(fraction * 1000) / 10}%`;

  const now = starsIfNow(model);
  scene.querySelectorAll(".cm-live-star").forEach((star, index) => {
    star.classList.toggle("lit", index < now);
  });

  const hint = scene.querySelector(".cm-hint");
  if (hint) {
    const ready = hintButtonReady(model);
    hint.disabled = !ready;
    hint.setAttribute("aria-disabled", String(!ready));
  }

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
        model.hintLevel >= 3 && index === round.answerIndex
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
    ["again", "다시 하기", "🔄"],
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
