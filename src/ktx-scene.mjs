// 칙칙폭폭 기관사 — 씬 렌더러 v2. 시뮬 상태의 읽기 전용 프로젝션.
//
// 두 뷰(운전실/바깥)를 동시에 마운트해 두고 data-view로만 바꾼다(파괴·재생성
// 금지). 움직임은 모델이 위치를 주고 CSS transition이 틱 사이를 보간한다.
//
// v2 핵심(협회 설계 2026-08-02):
//   운전실 = CSS perspective 평면(rotateX 84°) 위 침목이 transform으로 흐르고,
//   지물(전차선주·신호기·킬로포스트)은 소실점에서 쌍곡선 keyframes로 날아온다.
//   무봉합 wrap: 점프를 패턴 주기의 정수배로, 시작·목표를 같은 틱에 이동(setLoopSeam).
//   계기 = 바늘 달린 원형 속도계 + 노치 레버(held 표시) + 접근 스트립(정차 단서 단일 원본).

import {
  KTX_SEGMENTS,
  KTX_STATIONS,
  KTX_TRAINS,
  MARKER_FROM_ZONE,
  MAX_SPEED,
  SPEED_MILESTONES
} from "./ktx-route-data.mjs";
import { applyCharacterNumber, characterWebpPath } from "./character-image.mjs";
import {
  activeEvent,
  currentBand,
  distanceToMarker,
  routeSegments,
  routeStations
} from "./ktx-journey.mjs";
import { KTX_ROUTE_LABELS } from "./ktx-route-data.mjs";
import {
  ALL_LANDS,
  ALL_SKIES,
  GROUND_SKINS,
  approachStripSvg,
  cabDashSvg,
  cabFrameSvg,
  cabOncomingSvg,
  cabPlatformSvg,
  cabWiresSvg,
  doorPanelSvg,
  eventSpriteSvg,
  landLayerSvg,
  leverSvg,
  linesideArt,
  midStripSvg,
  nearStripSvg,
  oncomingTrainSvg,
  portalSvg,
  sideTrainSvg,
  skyLayerSvg,
  speedoDialSvg,
  trainCardSvg
} from "./ktx-scene-art.mjs";
import { trainFrontSvg } from "./ktx-train-model.mjs";
import { characterAsset } from "./character-spec.mjs";
import {
  realisticAssetAlt,
  realisticCabAsset,
  realisticEventAsset,
  realisticExteriorAsset
} from "./ktx-realistic-assets.mjs";
import {
  buildRealisticMotionScene,
  updateRealisticMotionScene
} from "./ktx-realistic-motion-scene.mjs";

const WINDOW_SLOTS = 8;
const NEAR_SCALE = 3;          // 3인칭: 1 game m = 3 px
const PLANE_PX_PER_M = 1;      // 1인칭 평면: 1 game m = 1 px (하단 투영 ≈7.6배)
const SKY_RATIO = 0.03;        // L0 하늘 드리프트 (5단 패럴랙스 최상층)
const FAR_RATIO = 0.12;        // 원경 시차 (v2: 0.18→0.12, 원근 대비 강화)
const MID_RATIO = 0.45;        // 중경 시차
const NEAR_RATIO = 1.6;        // 전경(전신주) 시차
const LAND_LOOP = 1000;
const TIE_LOOP = 640;          // 침목 wrap 주기 — 16px 패턴의 정수배
const TRAIN_NOSE_X = 200;
const LINESIDE_POOL = 10;
const POLE_GAP_M = 90;         // 동시 비행 ≤3 (아이 렌즈 상한)
const SIGNAL_GAP_M = 400;
const TUNNEL_LAMP_GAP_M = 60;  // 반증 B3 — 30m는 풀 초과

function el(document, tag, className, text = null) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

function passengerImg(document, number, className) {
  const image = document.createElement("img");
  image.className = className;
  applyCharacterNumber(image, number);
  image.alt = `숫자 ${number} 블록 친구`;
  return image;
}

function realisticImage(document, className, src, alt, onStateChange) {
  const image = document.createElement("img");
  image.className = className;
  image.dataset.assetSrc = src;
  image.src = src;
  image.alt = alt;
  image.decoding = "async";
  image.addEventListener?.("load", () => {
    delete image.dataset.failed;
    delete image.dataset.failedSrc;
    image.dataset.loaded = "true";
    onStateChange?.();
  });
  image.addEventListener?.("error", () => {
    delete image.dataset.loaded;
    image.dataset.failed = "true";
    image.dataset.failedSrc = image.dataset.assetSrc;
    onStateChange?.();
  });
  return image;
}

function buildRealisticScene(document, state, onStateChange) {
  const scene = el(document, "div", "ktx-real-scene");
  const band = currentBand(state);
  if (state.train.id === "srt") {
    scene.append(
      realisticImage(document, "ktx-real-cab-image",
        realisticCabAsset(band.sky, band.land),
        realisticAssetAlt("운전실", `${band.sky} ${band.land}`), onStateChange),
      realisticImage(document, "ktx-real-exterior-image",
        realisticExteriorAsset(state.train.id, band.land),
        realisticAssetAlt("외부", band.land), onStateChange)
    );
  }
  const veil = el(document, "div", "ktx-loading-veil");
  veil.setAttribute("aria-hidden", "true");
  scene.append(veil);
  return scene;
}

function syncRealisticState(root) {
  const images = [...root.querySelectorAll(".ktx-real-scene img")];
  if (images.some(image => image.dataset.failed === "true")) {
    root.dataset.realistic = "fallback";
    root.dataset.loading = "false";
    return;
  }
  const ready = images.length === 2 &&
    images.every(image => image.dataset.loaded === "true");
  const loading = !ready || images.some(image => image.dataset.pendingSrc);
  root.dataset.realistic = ready ? "ready" : "pending";
  root.dataset.loading = String(loading);
}

function updateRealisticImage(image, src, alt, onStateChange) {
  if (!image) return;
  image.alt = alt;
  if (image.dataset.assetSrc === src) {
    if (image.dataset.failedSrc && image.dataset.failedSrc !== src) {
      delete image.dataset.failed;
      delete image.dataset.failedSrc;
    }
    delete image.dataset.pendingSrc;
    delete image.dataset.preloadFailedSrc;
    onStateChange?.();
    return;
  }
  if (image.dataset.pendingSrc === src || image.dataset.preloadFailedSrc === src) return;

  image.dataset.pendingSrc = src;
  const preloader = image.ownerDocument.createElement("img");
  preloader.decoding = "async";
  preloader.addEventListener?.("load", () => {
    if (image.dataset.pendingSrc !== src) return;
    delete image.dataset.pendingSrc;
    delete image.dataset.failed;
    delete image.dataset.failedSrc;
    delete image.dataset.preloadFailedSrc;
    image.dataset.assetSrc = src;
    image.dataset.loaded = "true";
    image.src = src;
    onStateChange?.();
  });
  preloader.addEventListener?.("error", () => {
    if (image.dataset.pendingSrc !== src) return;
    delete image.dataset.pendingSrc;
    image.dataset.failed = "true";
    image.dataset.failedSrc = src;
    image.dataset.preloadFailedSrc = src;
    onStateChange?.();
  });
  preloader.src = src;
  onStateChange?.();
}

function updateRealisticScene(root, state, band) {
  if (state.train.id !== "srt") {
    root.dataset.realistic = "fallback";
    root.dataset.loading = "false";
    return;
  }
  updateRealisticImage(
    root.querySelector(".ktx-real-cab-image"),
    realisticCabAsset(band.sky, band.land),
    realisticAssetAlt("운전실", `${band.sky} ${band.land}`),
    () => syncRealisticState(root)
  );
  updateRealisticImage(
    root.querySelector(".ktx-real-exterior-image"),
    realisticExteriorAsset(state.train.id, band.land),
    realisticAssetAlt("외부", band.land),
    () => syncRealisticState(root)
  );
  syncRealisticState(root);
}

// ── 시작 화면: 열차 고르기 ────────────────────────────────────────────────

export function renderKtxPicker(document, selectedIndex = 0) {
  const root = el(document, "div", "ktx-picker");
  root.append(el(document, "h2", "ktx-picker-title", "어떤 기차를 몰까요?"));
  root.append(el(document, "p", "ktx-picker-note", "← → 로 고르고 ⎵ 로 출발!"));
  const row = el(document, "div", "ktx-picker-row");
  KTX_TRAINS.forEach((train, index) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "ktx-train-card";
    card.dataset.trainId = train.id;
    card.dataset.selected = String(index === selectedIndex);
    card.setAttribute("aria-label", `${train.label} 몰기`);
    const face = el(document, "span", "ktx-train-face");
    face.innerHTML = trainCardSvg(train);
    face.setAttribute("aria-hidden", "true");
    card.append(face, el(document, "strong", "ktx-train-name", train.label));
    row.append(card);
  });
  root.append(row);
  return root;
}

export function movePickerSelection(root, selectedIndex) {
  const cards = root.querySelectorAll(".ktx-train-card");
  cards.forEach((card, index) => {
    card.dataset.selected = String(index === selectedIndex);
  });
}

// ── 본 씬 ──────────────────────────────────────────────────────────────────

function buildEnvLayers(document, host, builder, names, kind) {
  for (const name of names) {
    const layer = el(document, "div", `ktx-env ktx-env-${kind}`);
    layer.dataset[kind] = name;
    layer.innerHTML = builder(name);
    host.append(layer);
  }
}

function buildCabView(document, state) {
  const view = el(document, "div", "ktx-view ktx-view-cab");

  const backdrop = el(document, "div", "ktx-cab-backdrop");
  buildEnvLayers(document, backdrop, skyLayerSvg, ALL_SKIES, "sky");
  const horizon = el(document, "div", "ktx-cab-horizon");
  buildEnvLayers(document, horizon, landLayerSvg, ALL_LANDS, "land");
  backdrop.append(horizon);
  view.append(backdrop);

  // 원근 세계 — perspective는 CSS, 여기는 층 구조만
  const world = el(document, "div", "ktx-cab-world");
  const ground = el(document, "div", "ktx-ground3d");
  for (const land of ALL_LANDS) {
    const skin = el(document, "div", "ktx-gskin");
    skin.dataset.land = land;
    skin.style.setProperty("--skin-color", GROUND_SKINS[land]);
    ground.append(skin);
  }
  ground.append(el(document, "div", "ktx-ballast-bed"));
  ground.append(el(document, "div", "ktx-ties"));
  for (const rail of ["own-l", "own-r", "opp-l", "opp-r"]) {
    const railNode = el(document, "div", "ktx-rail3d");
    railNode.dataset.rail = rail;
    ground.append(railNode);
  }
  for (const shade of ["night", "sunset", "dawn"]) {
    const shadeNode = el(document, "div", "ktx-ground-shade");
    shadeNode.dataset.shade = shade;
    ground.append(shadeNode);
  }
  ground.append(el(document, "div", "ktx-headlight"));
  world.append(ground);

  const wires = el(document, "div", "ktx-wires");
  wires.innerHTML = cabWiresSvg();
  world.append(wires);

  const lineside = el(document, "div", "ktx-lineside");
  for (let slot = 0; slot < LINESIDE_POOL; slot += 1) {
    lineside.append(el(document, "div", "ktx-obj"));
  }
  world.append(lineside);

  const oncoming = el(document, "div", "ktx-oncoming-cab");
  ["lead", "mid", "mid"].forEach(part => {
    const car = el(document, "div", "ktx-oncome");
    car.innerHTML = cabOncomingSvg(part);
    oncoming.append(car);
  });
  world.append(oncoming);

  const portal = el(document, "div", "ktx-portal");
  portal.innerHTML = portalSvg();
  world.append(portal);

  const cabPlat = el(document, "div", "ktx-cab-platform");
  cabPlat.innerHTML = cabPlatformSvg();
  cabPlat.append(el(document, "strong", "ktx-cabplat-name", ""));
  cabPlat.append(el(document, "span", "ktx-cabplat-queue"));
  world.append(cabPlat);

  const walls = el(document, "div", "ktx-tunnel-walls");
  view.append(world);
  view.append(walls);

  view.append(el(document, "div", "ktx-horizon-haze"));

  // 경적 응답 미러 — 운전실에서 눌러도 응답이 보인다(아이 렌즈 §3)
  view.append(el(document, "div", "ktx-cab-event"));

  const tunnel = el(document, "div", "ktx-cab-tunnel");
  tunnel.append(el(document, "span", "ktx-cab-lamp"));
  view.append(tunnel);

  view.append(el(document, "div", "ktx-flash"));

  const speedlines = el(document, "div", "ktx-speedlines");
  for (const tier of ["3", "4", "5"]) {
    const line = el(document, "div", "ktx-speedline");
    line.dataset.tier = tier;
    line.append(el(document, "i", "ktx-streak-tex"));
    speedlines.append(line);
  }
  view.append(speedlines);

  const balloon = el(document, "div", "ktx-speed-balloon");
  balloon.append(el(document, "strong", "ktx-balloon-number", ""));
  view.append(balloon);

  const frame = el(document, "div", "ktx-cab-frame");
  frame.innerHTML = cabFrameSvg(state.train);
  view.append(frame);

  const dash = el(document, "div", "ktx-cab-dash");
  dash.innerHTML = cabDashSvg(state.train);
  view.append(dash);

  // 계기 6종 — 표시 전용(협회 R4). 조작키는 ↑↓⎵1/3 그대로.
  const destboard = el(document, "div", "ktx-destboard");
  destboard.append(el(document, "i", "ktx-dest-dot"));
  destboard.append(el(document, "span", "ktx-dest-text", ""));
  view.append(destboard);

  const dial = el(document, "div", "ktx-speedo");
  dial.innerHTML = speedoDialSvg();
  view.append(dial);

  const lever = el(document, "div", "ktx-lever");
  lever.innerHTML = leverSvg();
  view.append(lever);

  const approach = el(document, "div", "ktx-approach");
  approach.innerHTML = approachStripSvg(state.train.color);
  approach.append(el(document, "span", "ktx-palm", "✋"));
  view.append(approach);

  const doorPanel = el(document, "div", "ktx-door-panel");
  doorPanel.innerHTML = doorPanelSvg();
  doorPanel.append(el(document, "span", "ktx-door-lamp"));
  view.append(doorPanel);

  const nextKey = el(document, "div", "ktx-next-key");
  nextKey.append(el(document, "kbd", "ktx-next-kbd", ""));
  nextKey.append(el(document, "span", "ktx-next-word", ""));
  view.append(nextKey);

  return view;
}

function buildSideView(document, state) {
  const view = el(document, "div", "ktx-view ktx-view-side");

  const backdrop = el(document, "div", "ktx-side-backdrop");
  buildEnvLayers(document, backdrop, skyLayerSvg, ALL_SKIES, "sky");
  view.append(backdrop);

  const far = el(document, "div", "ktx-side-far");
  buildEnvLayers(document, far, landLayerSvg, ALL_LANDS, "land");
  view.append(far);

  const mid = el(document, "div", "ktx-side-mid");
  mid.innerHTML = midStripSvg();
  view.append(mid);

  // 지면 rig — 카메라 변형은 rig에, --loop-px는 자식에(transition 충돌 분리)
  const groundRig = el(document, "div", "ktx-ground-rig");
  groundRig.append(el(document, "div", "ktx-side-ground"));
  view.append(groundRig);

  // 승강장 v2 — 지붕·기둥·역명판·시계·안전선 구조물
  const platform = el(document, "div", "ktx-platform");
  platform.append(el(document, "div", "ktx-platform-roof"));
  // 캐노피 — 지붕이 선로 위까지 드리워 "역 안으로 들어온" 인상
  platform.append(el(document, "div", "ktx-platform-canopy"));
  for (const pos of ["a", "b", "c"]) {
    const pillar = el(document, "div", "ktx-platform-pillar");
    pillar.dataset.pos = pos;
    platform.append(pillar);
  }
  const clock = el(document, "div", "ktx-platform-clock");
  platform.append(clock);
  const sign = el(document, "div", "ktx-platform-sign");
  sign.append(el(document, "strong", "ktx-platform-name", ""));
  platform.append(sign);
  for (const pos of ["a", "b"]) {
    const bench = el(document, "div", "ktx-platform-bench");
    bench.dataset.pos = pos;
    platform.append(bench);
  }
  const marker = el(document, "div", "ktx-stop-marker");
  marker.append(el(document, "span", "ktx-marker-star", "★"));
  platform.append(marker);
  view.append(platform);

  // 교행 열차 — passing 이벤트 때 화면을 가로지른다
  const oncoming = el(document, "div", "ktx-side-oncoming");
  oncoming.innerHTML = oncomingTrainSvg();
  view.append(oncoming);

  // 이벤트 무대 (passing 제외 — 교행은 위 전용 레이어가 담당)
  const events = el(document, "div", "ktx-event-stage");
  view.append(events);

  // 열차 rig — 카메라·틸트는 rig에 걸어 .ktx-train-toot(경적 바운스)의
  // transform 애니메이션과 분리. boarding(platform 모드)에서는 rig 무변형이라
  // 워커의 문 위치 실측(getBoundingClientRect)도 보존된다.
  const trainRig = el(document, "div", "ktx-train-rig");
  const train = el(document, "div", "ktx-side-train");
  train.innerHTML = sideTrainSvg(state.train, WINDOW_SLOTS);
  trainRig.append(train);
  view.append(trainRig);

  // 전경 전신주 — 열차 앞을 스치는 최고 속도 큐 (정차 근접 시 CSS가 숨김)
  const nearRig = el(document, "div", "ktx-near-rig");
  const near = el(document, "div", "ktx-side-near");
  near.innerHTML = nearStripSvg();
  nearRig.append(near);
  view.append(nearRig);

  const queue = el(document, "div", "ktx-queue");
  view.append(queue);

  // 탑승 워커 — ⎵마다 맨 앞 친구가 문까지 걸어간다
  view.append(el(document, "div", "ktx-walker-host"));

  // 서행 표지판 — "저기 표지판!" 안내에 진짜 '저기'가 있어야 한다(협회 5).
  const slowSign = el(document, "div", "ktx-slow-sign");
  slowSign.append(el(document, "b", "ktx-slow-sign-disc", ""));
  slowSign.append(el(document, "i", "ktx-slow-sign-post"));
  view.append(slowSign);

  const streaks = el(document, "div", "ktx-speed-streaks");
  streaks.append(el(document, "i", "ktx-streak-tex"));
  view.append(streaks);
  return view;
}

// 하늘에서 내려다본 분기 지도 — Y 선로, 아래에서 올라온 미니 열차, 좌우 행선지.
// (아트 모듈이 아니라 씬 로컬: 분기 화면 전용 1회성 배경이라 여기 둔다)
function branchMapSvg() {
  const tracks = [
    "M400 500 L400 300",
    "M400 300 C400 220 330 180 220 120",
    "M400 300 C400 220 470 180 580 120"
  ].map(d =>
    `<path d="${d}" fill="none" stroke="#cfc3ad" stroke-width="46"/>` +
    `<path d="${d}" fill="none" stroke="#7a6a55" stroke-width="34" ` +
    `stroke-dasharray="6 14"/>` +
    `<path d="${d}" fill="none" stroke="#8d95a0" stroke-width="4" ` +
    `transform="translate(-8 0)"/>` +
    `<path d="${d}" fill="none" stroke="#8d95a0" stroke-width="4" ` +
    `transform="translate(8 0)"/>`
  ).join("");
  return `<svg viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice" ` +
    `aria-hidden="true" xmlns="http://www.w3.org/2000/svg">` +
    `<defs>` +
    `<linearGradient id="ktx-g-branch-land" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#bfe39a"/><stop offset="1" stop-color="#8fce6f"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="800" height="500" fill="url(#ktx-g-branch-land)"/>` +
    `<rect x="40" y="60" width="150" height="90" rx="16" fill="#a9df7d" opacity=".7"/>` +
    `<rect x="600" y="180" width="160" height="100" rx="16" fill="#cde79d" opacity=".7"/>` +
    `<ellipse cx="120" cy="420" rx="90" ry="34" fill="#9fd0f5" opacity=".8"/>` +
    tracks +
    // 위에서 본 미니 열차 — 분기점 아래 스템 위.
    // 배치는 바깥 g의 속성 transform, 둥실 애니메이션은 안쪽 g의 CSS —
    // CSS transform이 속성 transform을 통째로 대체하므로 반드시 분리한다.
    `<g transform="translate(400 430)"><g class="ktx-branch-train">` +
    `<rect x="-16" y="-60" width="32" height="104" rx="14" fill="#e9edf3"/>` +
    `<rect x="-16" y="-6" width="32" height="50" rx="14" fill="#31445b" opacity=".2"/>` +
    `<path d="M-16 -44 Q-16 -74 0 -78 Q16 -74 16 -44z" fill="#5b2d86"/>` +
    `<rect x="-10" y="-30" width="20" height="60" rx="8" fill="#1d2634" opacity=".85"/>` +
    `</g></g></svg>`;
}

export function renderKtxScene(document, state, view = "cab") {
  const root = el(document, "div", "ktx-game");
  root.dataset.view = view;
  root.dataset.train = state.train.id;

  const stage = el(document, "div", "ktx-stage");
  const band = currentBand(state);
  const motionScene = buildRealisticMotionScene(document, {
    ...state,
    sky: band.sky,
    land: band.land,
    markerDistance: distanceToMarker(state)
  }, status => {
    root.dataset.motionRealistic = status;
  });
  stage.append(buildRealisticScene(document, state, () => syncRealisticState(root)));
  if (motionScene) stage.append(motionScene);
  stage.append(buildCabView(document, state), buildSideView(document, state));
  root.append(stage);

  const hud = el(document, "div", "ktx-hud");
  const plan = el(document, "div", "ktx-plan");
  KTX_STATIONS.forEach(station => {
    const chip = el(document, "span", "ktx-plan-stop");
    chip.dataset.station = station;
    chip.append(el(document, "i", "ktx-plan-dot"));
    chip.append(el(document, "span", "ktx-plan-name", station));
    plan.append(chip);
  });
  hud.append(plan);
  const score = el(document, "div", "ktx-score");
  score.append(el(document, "span", "ktx-star-total", "⭐ 0"));
  score.append(el(document, "span", "ktx-boarded-total", "친구 0"));
  hud.append(score);
  hud.append(el(document, "span", "ktx-boost-badge", ""));
  hud.append(el(document, "span", "ktx-slow-badge", ""));
  const viewKeys = el(document, "div", "ktx-view-keys");
  const cabKey = el(document, "span", "ktx-view-key", "1 운전실");
  cabKey.dataset.viewKey = "cab";
  const sideKey = el(document, "span", "ktx-view-key", "3 바깥");
  sideKey.dataset.viewKey = "side";
  viewKeys.append(cabKey, sideKey);
  hud.append(viewKeys);
  root.append(hud);

  // 문 닫힘 카운트다운 숫자 — 어느 뷰에서든 보인다
  root.append(el(document, "div", "ktx-door-countdown", ""));

  // 하늘 분기 화면 — 동탄에서 부산/목포 갈림길 (data-branch로 켠다)
  const branch = el(document, "div", "ktx-branch");
  const branchMap = el(document, "div", "ktx-branch-map");
  branchMap.innerHTML = branchMapSvg();
  branch.append(branchMap);
  branch.append(el(document, "h2", "ktx-branch-title", "어느 쪽으로 갈까요?"));
  for (const [routeId, pos, word] of [
    ["mokpo", "left", "서쪽 항구"],
    ["busan", "right", "동쪽 바다"]
  ]) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "ktx-branch-choice";
    choice.dataset.route = routeId;
    choice.dataset.pos = pos;
    choice.append(el(document, "kbd", "ktx-branch-key", pos === "left" ? "←" : "→"));
    choice.append(el(document, "strong", "ktx-branch-name", KTX_ROUTE_LABELS[routeId]));
    choice.append(el(document, "span", "ktx-branch-word", word));
    branch.append(choice);
  }
  branch.append(el(document, "p", "ktx-branch-note", "← → 로 고르고 ⎵ 로 정하기!"));
  root.append(branch);

  // 탑승 세기 팝 — 방금 탄 친구가 크게 뜬다
  const pop = el(document, "div", "ktx-board-pop");
  pop.append(el(document, "span", "ktx-board-face"));
  pop.append(el(document, "strong", "ktx-board-count", ""));
  root.append(pop);

  // 종착 피날레
  const finale = el(document, "div", "ktx-finale");
  finale.append(el(document, "h2", "ktx-finale-title", ""));
  const finaleTrain = el(document, "div", "ktx-finale-train");
  finaleTrain.innerHTML = trainFrontSvg(state.train);
  finale.append(finaleTrain);
  finale.append(el(document, "div", "ktx-finale-stops"));
  finale.append(el(document, "div", "ktx-finale-friends"));
  finale.append(el(document, "p", "ktx-finale-words", ""));
  root.append(finale);

  updateKtxScene(root, state, view, []);
  return root;
}

// ── 동기화 프리미티브 ──────────────────────────────────────────────────────

// 무봉합 루프(협회 반증 E 승격): 누적치가 주기를 넘으면 "시작점과 목표점을
// 같은 틱에 주기의 정수배만큼" 되감는다 — 패턴이 불변이라 점프가 안 보이고,
// transition은 정상적으로 새 목표를 향해 달린다(구형 setLoop의 1틱 정지 제거).
// 재마운트·구간 전환의 거대 델타는 가드로 무시(반증 A1).
function setLoopSeam(node, px, period, varName = "--loop-px", sign = -1) {
  const raw = node.dataset.rawPx === undefined ? px : Number(node.dataset.rawPx);
  let acc = Number(node.dataset.accPx ?? 0);
  const delta = px - raw;
  node.dataset.rawPx = String(px);
  if (Math.abs(delta) < period * 4) acc += delta;
  if (acc >= period || acc < 0) {
    const laps = Math.floor(acc / period);
    const rewound = acc - laps * period;
    const shown = Number(node.dataset.accShown ?? 0) - laps * period;
    node.dataset.noTransition = "true";
    node.style.setProperty(varName, `${sign * shown}px`);
    void node.offsetWidth;
    delete node.dataset.noTransition;
    acc = rewound;
  }
  node.dataset.accPx = String(acc);
  node.dataset.accShown = String(acc);
  node.style.setProperty(varName, `${sign * acc}px`);
}

function pulse(node, className) {
  if (!node) return;
  node.classList.remove(className);
  // 강제 리플로우로 애니메이션 재시작 — FakeElement에는 offsetWidth가 없어도 무해
  void node.offsetWidth;
  node.classList.add(className);
}

// ── 계기 판정 (순수 함수) ──────────────────────────────────────────────────

export function leverPosition(state, held = {}) {
  if (held.down || state.phase === "stopping" || state.phase === "correcting") {
    return "brake";
  }
  if (held.up || (state.assist && state.phase === "driving" && state.v < 80)) {
    return "power";
  }
  if (state.phase === "driving" && state.v > 0.5) return "cruise";
  return "neutral";
}

export function speedTier(v) {
  return v === 0 ? 0 : Math.min(5, Math.ceil(v / 60));
}

// 상태 → 3인칭 카메라 모드 — 디자인 팩 TrainState↔카메라 표의 phase 매핑.
// platform(정차·탑승) / approach(역 진입 조망) / rear(저속 후방 사선) /
// side(고속 측면). CSS가 data-camera로 rig 변형을 건다.
export function cameraModeFor(state) {
  if (["boarding", "ready", "stopped", "finale"].includes(state.phase)) {
    return "platform";
  }
  if (state.phase === "stopping" || state.phase === "correcting" ||
    (state.zoneEntered && state.phase === "driving")) {
    return "approach";
  }
  if (state.phase === "driving" && state.v < 180) return "rear";
  return "side"; // 고속주행
}

function destboardText(state) {
  if (state.phase === "branch") return "어느 쪽으로 갈까요?";
  if (state.phase === "boarding") return `여기는 ${state.station}`;
  if (state.phase === "ready") return `${routeStations(state)[state.segIndex + 1]} 출발 준비`;
  if (state.phase === "driving" || state.phase === "stopping" ||
    state.phase === "correcting") {
    return `다음역 ▶ ${routeStations(state)[state.segIndex + 1]}`;
  }
  if (state.phase === "stopped") return `${state.station} 도착`;
  if (state.phase === "finale") return "종착역 부산";
  return "";
}

// 다음 올바른 키 하나만 알려 주는 필 — 프리리더는 kbd 글리프가 실질 정보.
function nextKeyFor(state) {
  if (state.phase === "branch") return { key: "←→", word: "길 고르기", tone: "act" };
  if (state.phase === "boarding") {
    return state.queue.length > 0
      ? { key: "⎵", word: "태우기", tone: "act" }
      : { key: "⎵", word: "문닫기", tone: "act" };
  }
  if (state.phase === "ready") return { key: "↑", word: "출발!", tone: "go" };
  if (state.phase === "stopped") return { key: "⎵", word: "문열기", tone: "act" };
  if (state.phase === "driving") {
    if (state.armed) return { key: "⎵", word: "딱 멈추기", tone: "press" };
    // SRT는 일반 주행 스페이스가 경적이 아니라 부스터다. 라벨이 동작과 어긋나면
    // 글을 못 읽는 아이는 그림과 소리로만 배우므로 끝까지 오해한 채로 논다.
    return state.train.id === "srt"
      ? { key: "⎵", word: "부스터", tone: "dim" }
      : { key: "⎵", word: "빵빵", tone: "dim" };
  }
  return null;
}

// ── 부분 갱신자 ────────────────────────────────────────────────────────────

function updateWindows(root, state) {
  const shown = state.boarded.slice(-WINDOW_SLOTS);
  const slots = root.querySelectorAll(".ktx-window-slot");
  slots.forEach((slot, index) => {
    const number = shown[index];
    const key = number === undefined ? "" : String(number);
    if (slot.dataset.filled === key) return;
    slot.dataset.filled = key;
    const previous = slot.querySelector("image");
    if (previous) previous.remove();
    if (number !== undefined) {
      const image = slot.ownerDocument.createElementNS
        ? slot.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "image")
        : null;
      if (image) {
        // 창 유리 62×34 안에 정사각 34×34로 중앙 정렬(모델 v2 비율)
        // SVG <image> 는 srcset 이 없다 — 파생본을 바로 가리킨다.
        image.setAttribute("href", characterWebpPath(characterAsset(number)));
        image.setAttribute("x", "14");
        image.setAttribute("width", "34");
        image.setAttribute("height", "34");
        image.classList.add("ktx-window-face");
        slot.append(image);
      }
    }
  });
}

// 대기줄 — 재생성 대신 diff 갱신: 남은 친구는 --queue-index만 줄어서
// transition으로 스르륵 앞당겨진다(한 역 안에서 번호 중복 없음 — 반증 확인).
function updateQueue(document, root, state) {
  const queueHost = root.querySelector(".ktx-queue");
  const key = state.queue.join(",");
  if (queueHost.dataset.queueKey === key) return;
  queueHost.dataset.queueKey = key;
  const existing = new Map();
  for (const child of [...queueHost.children]) {
    existing.set(child.dataset.number, child);
  }
  const kept = new Set();
  state.queue.forEach((number, index) => {
    const id = String(number);
    let person = existing.get(id);
    if (!person) {
      person = passengerImg(document, number, "ktx-queue-person");
      person.dataset.number = id;
      queueHost.append(person);
    }
    kept.add(id);
    person.style.setProperty("--queue-index", String(index));
  });
  for (const [id, node] of existing) {
    if (!kept.has(id)) node.remove();
  }
}

// 탑승 워커 — 문까지의 델타는 스폰 시 실측(반증 C5), 측정 불가 환경은 74px.
function spawnAlighters(document, root) {
  const host = root.querySelector(".ktx-walker-host");
  if (!host) return;
  // 내리는 친구는 문에서 나와야 한다 — 시작점을 실제 문 좌표에 맞춘다.
  let fromX = 0;
  const doors = root.querySelectorAll(".ktx-motion-door");
  const door = doors[2] ?? doors[0];
  if (door?.getBoundingClientRect && host.getBoundingClientRect) {
    const doorBox = door.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    if (doorBox.width > 0) {
      fromX = Math.round(doorBox.left + doorBox.width / 2 - hostBox.left);
    }
  }
  // 모델과 무관한 연출 — 내리는 사람이 있어야 "역에 섰다"가 산다.
  const count = 1 + Math.floor(Math.random() * 2);
  const nodes = [];
  for (let i = 0; i < count; i += 1) {
    const number = 1 + Math.floor(Math.random() * 10);
    const walker = el(document, "div", "ktx-walker ktx-walker-out");
    walker.style.setProperty("--out-delay", `${i * 420}ms`);
    walker.style.setProperty("--out-from", `${fromX}px`);
    walker.append(passengerImg(document, number, "ktx-walker-img"));
    nodes.push(walker);
  }
  host.replaceChildren(...nodes);
}

function spawnWalker(document, root, event) {
  const host = root.querySelector(".ktx-walker-host");
  if (!host) return;
  const walker = el(document, "div", "ktx-walker");
  walker.append(passengerImg(document, event.number, "ktx-walker-img"));
  let deltaX = 74;
  // 실사 모드에서는 레거시 문이 숨어 있다 — 실제로 보이는 모션 문을 조준해야
  // 워커가 허공이 아니라 문으로 걸어 들어간다(2026-08-10 플레이 관찰).
  const door = root.dataset.motionRealistic === "ready"
    ? root.querySelectorAll(".ktx-motion-door")[2] ?? root.querySelector(".ktx-motion-door")
    : root.querySelector(".ktx-view-side .ktx-door");
  if (door?.getBoundingClientRect && host.getBoundingClientRect) {
    const doorBox = door.getBoundingClientRect();
    const hostBox = host.getBoundingClientRect();
    if (doorBox.width > 0) {
      deltaX = Math.max(30, doorBox.left + doorBox.width / 2 - hostBox.left);
    }
  }
  walker.style.setProperty("--walk-x", `${Math.round(deltaX)}px`);
  host.replaceChildren(walker);
}

// 지물 풀 스폰 — 라운드로빈 재사용, duration은 스폰 순간의 v로 고정(협회 §4.2).
function spawnObj(root, kind, lane, value, v) {
  const host = root.querySelector(".ktx-lineside");
  if (!host || !host.children.length) return;
  const index = Number(host.dataset.next ?? 0);
  const node = host.children[index % host.children.length];
  host.dataset.next = String((index + 1) % host.children.length);
  node.dataset.kind = kind;
  node.dataset.lane = lane;
  node.innerHTML = linesideArt(kind, value);
  const dur = Math.max(1600, Math.min(6500, Math.round(936000 / Math.max(v, 1))));
  node.style.animationDuration = `${dur}ms`;
  pulse(node, "ktx-obj-run");
}

// 터널 포털 트리거 지점 — 구간의 터널 밴드 시작 미터(없으면 null).
function portalStartFor(state) {
  const seg = routeSegments(state)[state.segIndex];
  let from = 0;
  for (const band of seg.bands) {
    if (band.land === "tunnel") return from * seg.length;
    from = band.until;
  }
  return null;
}

function updateLineside(root, state, band, dxM) {
  if (state.phase !== "driving" || dxM <= 0 || state.zoneEntered) return;
  if (band.land === "tunnel") {
    const debt = Number(root.dataset.lampDebt ?? 0) + dxM;
    if (debt >= TUNNEL_LAMP_GAP_M) {
      root.dataset.lampDebt = String(debt - TUNNEL_LAMP_GAP_M);
      const side = root.dataset.lampSide === "l" ? "r" : "l";
      root.dataset.lampSide = side;
      spawnObj(root, "tunnellamp", side, "", state.v);
    } else {
      root.dataset.lampDebt = String(debt);
    }
    return;
  }
  const poleDebt = Number(root.dataset.poleDebt ?? 60) + dxM;
  if (poleDebt >= POLE_GAP_M) {
    root.dataset.poleDebt = String(poleDebt - POLE_GAP_M);
    spawnObj(root, "pole", "r", "", state.v);
  } else {
    root.dataset.poleDebt = String(poleDebt);
  }
  const signalDebt = Number(root.dataset.signalDebt ?? 250) + dxM;
  if (signalDebt >= SIGNAL_GAP_M) {
    root.dataset.signalDebt = String(signalDebt - SIGNAL_GAP_M);
    spawnObj(root, "signal", "l", "", state.v);
  } else {
    root.dataset.signalDebt = String(signalDebt);
  }
  // 킬로포스트 — 남은 km가 줄어드는 순간(세기 카운트다운)
  const remain = distanceToMarker(state);
  const km = Math.ceil(remain / 1000);
  if (km >= 1 && remain > 350 && root.dataset.kmMark !== String(km)) {
    root.dataset.kmMark = String(km);
    spawnObj(root, "kilopost", "r", String(km), state.v);
  }
}

export function updateKtxScene(root, state, view, events = [], held = {}) {
  const document = root.ownerDocument ?? globalThis.document;
  const band = currentBand(state);
  root.dataset.view = view;
  root.dataset.phase = state.phase;
  root.dataset.sky = band.sky;
  root.dataset.land = band.land;
  updateRealisticMotionScene(root, {
    ...state,
    markerDistance: distanceToMarker(state)
  }, band);
  updateRealisticScene(root, state, band);
  root.dataset.doors = state.doors;
  root.dataset.tunnel = String(band.land === "tunnel");
  root.dataset.armed = String(state.armed && state.phase === "driving");
  root.dataset.moving = String(state.phase === "driving" || state.phase === "stopping");
  root.dataset.speedTier = String(speedTier(state.v));
  root.dataset.lever = leverPosition(state, held);
  root.dataset.camera = cameraModeFor(state);
  const boostRemainingMs = Number.isFinite(state.boostRemainingMs)
    ? Math.max(0, state.boostRemainingMs)
    : 0;
  const boostCooldownMs = Number.isFinite(state.boostCooldownMs)
    ? Math.max(0, state.boostCooldownMs)
    : 0;
  let boostMode = "unavailable";
  // 배지 문구는 전부 한글이다 — 이 게임을 하는 나이대는 영어를 못 읽는다.
  let boostText = "부스터 없음";
  if (state.train.id === "srt") {
    if (boostRemainingMs > 0) {
      boostMode = "active";
      boostText = `부스터 ${Math.ceil(boostRemainingMs / 1000)}`;
    } else if (boostCooldownMs > 0) {
      boostMode = "cooldown";
      boostText = `충전 ${Math.ceil(boostCooldownMs / 1000)}`;
    } else {
      boostMode = "ready";
      boostText = "부스터 준비";
    }
  }
  root.dataset.boost = boostMode;
  const boostBadge = root.querySelector(".ktx-boost-badge");
  if (boostBadge && boostBadge.textContent !== boostText) {
    boostBadge.textContent = boostText;
  }
  // 서행 표지 배지 — 예고 순간부터 존 종료까지 제한 숫자를 계속 보여 준다.
  // 글을 못 읽는 아이도 "동그라미 숫자 = 속도계 숫자를 그 밑으로"를 배운다.
  const slowZone = state.slowZones?.[state.segIndex];
  const slowActive = Boolean(state.slow);
  const slowComing = Boolean(slowZone) && state.slowWarned && !state.zoneEntered &&
    state.phase === "driving" &&
    state.x / routeSegments(state)[state.segIndex].length < slowZone.until;
  let slowMode = "off";
  if (slowActive) {
    slowMode = state.v <= state.slow.limit + state.slow.grace ? "calm" : "over";
  } else if (slowComing) {
    slowMode = "coming";
  }
  root.dataset.slow = slowMode;
  const slowBadge = root.querySelector(".ktx-slow-badge");
  const slowText = slowMode === "off" ? "" : String(slowZone.limit);
  if (slowBadge && slowBadge.textContent !== slowText) {
    slowBadge.textContent = slowText;
  }
  root.dataset.zone = String(state.zoneEntered &&
    ["driving", "stopping", "correcting"].includes(state.phase));
  if (root.dataset.zone === "true") {
    const approach = root.querySelector(".ktx-approach");
    if (approach) {
      const dApp = Math.max(0, Math.min(120, distanceToMarker(state)));
      approach.style.setProperty("--approach-px",
        `${(154 - 1.3833 * dApp).toFixed(1)}px`);
    }
  }
  root.dataset.doorWarning = String(
    state.doorCountdownMs !== null && state.doorCountdownMs !== undefined &&
    state.doorCountdownMs > 0 && state.doorCountdownMs <= 3200);
  root.dataset.branch = String(state.phase === "branch");
  root.dataset.routePick = state.selectedRoute ?? "busan";
  // 노선이 정해지면 계획 스트립을 그 노선의 역들로 다시 짠다
  if (root.dataset.route !== (state.route ?? "busan")) {
    root.dataset.route = state.route ?? "busan";
    const plan = root.querySelector(".ktx-plan");
    if (plan) {
      plan.replaceChildren();
      for (const station of routeStations(state)) {
        const chip = el(document, "span", "ktx-plan-stop");
        chip.dataset.station = station;
        chip.append(el(document, "i", "ktx-plan-dot"));
        chip.append(el(document, "span", "ktx-plan-name", station));
        plan.append(chip);
      }
    }
  }

  // 속도계 — 디지털 숫자 + 바늘(0~300 → ±120°)
  const speedNode = root.querySelector(".ktx-speed-number");
  const speed = Math.round(state.v);
  if (speedNode.textContent !== String(speed)) {
    speedNode.textContent = String(speed);
  }
  const needleSpeed = Math.min(MAX_SPEED, Math.max(0, state.v));
  root.style.setProperty("--needle-deg", `${(needleSpeed * 0.8 - 120).toFixed(1)}deg`);

  // 계기 텍스트 — 전광판·다음 키 필
  const destText = root.querySelector(".ktx-dest-text");
  const board = destboardText(state);
  if (destText && destText.textContent !== board) destText.textContent = board;
  const nextKey = nextKeyFor(state);
  root.dataset.hint = nextKey ? nextKey.tone : "none";
  if (nextKey) {
    const kbd = root.querySelector(".ktx-next-kbd");
    const word = root.querySelector(".ktx-next-word");
    if (kbd && kbd.textContent !== nextKey.key) kbd.textContent = nextKey.key;
    if (word && word.textContent !== nextKey.word) word.textContent = nextKey.word;
  }

  // 움직임 — 모델 주도 위치, CSS transition이 보간, wrap은 무봉합
  const planePx = (state.segIndex * 100000 + state.x) * PLANE_PX_PER_M;
  const worldPx = (state.segIndex * 100000 + state.x) * NEAR_SCALE;
  const ties = root.querySelector(".ktx-ties");
  if (ties) setLoopSeam(ties, planePx, TIE_LOOP, "--tie-px", 1);
  // L0 하늘 드리프트 — .ktx-env 5장을 겹친 컨테이너째 움직여 크로스페이드와 무관
  const skyDrift = root.querySelector(".ktx-side-backdrop");
  if (skyDrift) setLoopSeam(skyDrift, worldPx * SKY_RATIO, LAND_LOOP);
  root.querySelectorAll(".ktx-env-land").forEach(layer => {
    setLoopSeam(layer, worldPx * FAR_RATIO, LAND_LOOP);
  });
  const mid = root.querySelector(".ktx-side-mid");
  if (mid) setLoopSeam(mid, worldPx * MID_RATIO, LAND_LOOP);
  const ground = root.querySelector(".ktx-side-ground");
  if (ground) setLoopSeam(ground, worldPx, 240);
  const near = root.querySelector(".ktx-side-near");
  if (near) setLoopSeam(near, worldPx * NEAR_RATIO, 480);

  // 지물 스폰 — 이동 델타(m). 구간 전환·정차 리셋의 거대 점프는 가드.
  const prevSpawn = root.dataset.spawnPrevPx === undefined
    ? planePx
    : Number(root.dataset.spawnPrevPx);
  let dxM = planePx - prevSpawn;
  root.dataset.spawnPrevPx = String(planePx);
  if (Math.abs(dxM) >= 50) dxM = 0;
  updateLineside(root, state, band, dxM);

  // 터널 포털 — 진입 2.2초 전(속도 반영) 1회 발사
  const portalKey = `${state.route ?? "busan"}-${state.segIndex}`;
  if (root.dataset.portalSeg !== portalKey) {
    root.dataset.portalSeg = portalKey;
    const at = portalStartFor(state);
    root.dataset.portalAt = at === null ? "" : String(at);
    root.dataset.portalFired = "false";
  }
  if (state.phase === "driving" && root.dataset.portalAt !== "" &&
    root.dataset.portalFired !== "true") {
    const at = Number(root.dataset.portalAt);
    if (state.x >= at - (state.v / 3.6) * 2.2) {
      root.dataset.portalFired = "true";
      pulse(root.querySelector(".ktx-portal"), "ktx-portal-run");
    }
  }

  // 터널 출구 번쩍 (상한 opacity .32 — 아이 렌즈)
  if (root.dataset.prevLand === "tunnel" && band.land !== "tunnel") {
    pulse(root.querySelector(".ktx-flash"), "ktx-flash-run");
  }
  root.dataset.prevLand = band.land;

  // 승강장 — 존에 들어오면 화면 안으로 (3인칭) + 소실점에서 성장 (1인칭)
  const platform = root.querySelector(".ktx-platform");
  const driving = state.phase === "driving" || state.phase === "stopping" ||
    state.phase === "correcting";
  const distance = driving ? distanceToMarker(state) : 0;
  const nearStop = !driving || distance < 320;
  platform.dataset.visible = String(nearStop);
  root.dataset.nearStop = String(nearStop);
  const sideView = root.querySelector(".ktx-view-side");
  sideView.dataset.nearStop = String(nearStop);
  // 열차는 스테이지 %폭인데 승강장·대기줄은 설계 px(스테이지 1217 기준)라서,
  // 다른 창 크기에서는 같은 비율로 함께 스케일해야 문 앞 정렬이 유지된다.
  const stage = root.querySelector(".ktx-stage");
  const sideScale = stage && stage.clientWidth ? stage.clientWidth / 1217 : 1;
  sideView.style.setProperty("--side-scale", sideScale.toFixed(4));
  const stationName = driving
    ? routeStations(state)[state.segIndex + 1]
    : state.station;
  if (nearStop) {
    const markerX = TRAIN_NOSE_X + distance * NEAR_SCALE;
    const shift = (markerX - MARKER_FROM_ZONE * NEAR_SCALE) * sideScale;
    sideView.style.setProperty("--platform-x", `${shift.toFixed(1)}px`);
    const name = root.querySelector(".ktx-platform-name");
    if (name.textContent !== stationName) name.textContent = stationName;
  }
  const cabPlat = root.querySelector(".ktx-cab-platform");
  if (cabPlat) {
    cabPlat.dataset.visible = String(nearStop);
    if (nearStop) {
      // t 하한 클램프 — 오버런(d<0)에서 폭주 금지(반증 B5)
      const t = 1 - Math.max(0, Math.min(distance, 320)) / 320;
      cabPlat.style.setProperty("--plat-x", `${(12 + 96 * t * t).toFixed(1)}px`);
      cabPlat.style.setProperty("--plat-y", `${(6 + 120 * t * t).toFixed(1)}px`);
      cabPlat.style.setProperty("--plat-s", (0.07 + 2.13 * t ** 3).toFixed(3));
      const cabName = root.querySelector(".ktx-cabplat-name");
      if (cabName && cabName.textContent !== stationName) {
        cabName.textContent = stationName;
        const waitHost = root.querySelector(".ktx-cabplat-queue");
        if (waitHost) {
          waitHost.replaceChildren();
          const waiting = (state.manifest.stops[stationName] ?? []).slice(0, 3);
          for (const number of waiting) {
            waitHost.append(passengerImg(document, number, "ktx-cabplat-person"));
          }
        }
      }
    }
  }
  updateQueue(document, root, state);
  updateWindows(root, state);

  // 계획 스트립 — 지나온 역·현재 역
  const arrivedCount = state.stars.length;
  root.querySelectorAll(".ktx-plan-stop").forEach((chip, index) => {
    chip.dataset.done = String(index <= arrivedCount &&
      !(index === arrivedCount && state.phase === "driving"));
    chip.dataset.here = String(
      (state.phase === "driving" || state.phase === "stopping")
        ? index === arrivedCount + 1
        : index === arrivedCount
    );
  });

  // 점수
  const starTotal = state.stars.reduce((sum, count) => sum + count, 0);
  const starNode = root.querySelector(".ktx-star-total");
  if (starNode.textContent !== `⭐ ${starTotal}`) {
    starNode.textContent = `⭐ ${starTotal}`;
  }
  const boardedNode = root.querySelector(".ktx-boarded-total");
  const boardedText = `친구 ${state.boarded.length}`;
  if (boardedNode.textContent !== boardedText) {
    boardedNode.textContent = boardedText;
  }

  // 속도 풍선 — 존 안에서는 억제(시선 깔때기, 아이 렌즈 §6).
  // 300 링은 뺀다 — 최고속 부근에서 "300" 동그라미가 경고판처럼 읽힌다는
  // 피드백(2026-08-10). 세기 놀이용 낮은 마일스톤(50~250)만 띄운다.
  const nextMilestone = SPEED_MILESTONES.find(milestone =>
    !state.milestones.includes(milestone) && milestone > state.v - 1);
  const balloon = root.querySelector(".ktx-speed-balloon");
  const balloonOn = state.phase === "driving" && nextMilestone !== undefined &&
    nextMilestone < 300 &&
    nextMilestone - state.v <= 20 && !state.zoneEntered &&
    // 서행 안내 중에는 다른 숫자 풍선을 띄우지 않는다 — "100까지 천천히"
    // 옆에 "200" 풍선이 뜨면 제한 숫자와 혼선(협회 D).
    !state.slow && !state.slowWarned;
  balloon.dataset.on = String(balloonOn);
  if (balloonOn) {
    const numberNode = root.querySelector(".ktx-balloon-number");
    if (numberNode.textContent !== String(nextMilestone)) {
      numberNode.textContent = String(nextMilestone);
    }
  }

  // 이벤트 무대 — passing은 전용 교행 레이어가 담당하므로 제외
  const stageHost = root.querySelector(".ktx-event-stage");
  const active = activeEvent(state);
  const eventKey = active?.type ?? "";
  const stageKey = eventKey === "passing" || realisticEventAsset(eventKey)
    ? "" : eventKey;
  if (stageHost.dataset.event !== stageKey) {
    stageHost.dataset.event = stageKey;
    stageHost.innerHTML = stageKey ? eventSpriteSvg(stageKey) : "";
  }
  // 운전실 미러 — 경적 응답 상대가 운전실에서도 보인다
  const cabEvent = root.querySelector(".ktx-cab-event");
  const mirrorKey = ["river", "cows", "seagull"].includes(eventKey) ? eventKey : "";
  if (cabEvent && cabEvent.dataset.event !== mirrorKey) {
    cabEvent.dataset.event = mirrorKey;
    cabEvent.innerHTML = mirrorKey ? eventSpriteSvg(mirrorKey) : "";
  }

  // 순간 연출 — 틱 이벤트를 data 속성 펄스로 넘긴다(CSS 애니메이션 재생)
  for (const event of events) {
    if (event.type === "horn") {
      stageHost.dataset.hornLevel = String(event.level);
      pulse(stageHost, "ktx-horn-pulse");
      pulse(root.querySelector(".ktx-side-train"), "ktx-train-toot");
      if (cabEvent && mirrorKey) {
        cabEvent.dataset.hornLevel = String(event.level);
        pulse(cabEvent, "ktx-horn-pulse");
      }
      pulse(root.querySelector(".ktx-cab-frame"), "ktx-wiper-go");
      if (event.response === "passing") {
        pulse(root.querySelector(".ktx-oncoming-cab"), "ktx-oncome-run");
        pulse(root.querySelector(".ktx-side-oncoming"), "ktx-oncoming-run");
      }
    }
    if (event.type === "event") {
      // 실사 스프라이트가 있는 종류만 월드 스윕으로 — 없으면 기존 평면 연출.
      const sprite = realisticEventAsset(event.event);
      const host = root.querySelector(".ktx-motion-event");
      if (sprite && host) {
        host.dataset.kind = event.event;
        host.style.setProperty("--event-image", `url("${sprite}")`);
        // 빠를수록 짧게 스친다 — 고정 시간이면 300km/h에서 느릿해 보인다.
        const seconds = Math.max(1.1, Math.min(4.2, 620 / Math.max(state.v, 40)));
        host.style.setProperty("--event-sweep-ms", `${Math.round(seconds * 1000)}ms`);
        pulse(host, "ktx-event-go");
      }
    }
    if (event.type === "event" && event.event === "passing") {
      pulse(root.querySelector(".ktx-oncoming-cab"), "ktx-oncome-run");
      pulse(root.querySelector(".ktx-side-oncoming"), "ktx-oncoming-run");
      pulse(root.querySelector(".ktx-cab-world"), "ktx-cab-shake");
      // 실사 교행 — 건너편 선로의 파란 KTX가 반대 방향으로 스친다
      pulse(root.querySelector(".ktx-motion-oncoming"), "ktx-oncoming-go");
    }
    if (event.type === "zone-enter") {
      spawnObj(root, "speed35", "l", "", state.v);
    }
    // sprint300의 "300" 경고판 소환은 뺐다 — 실사 배경 위에 뜬 표지판이
    // 경고처럼 읽힌다는 피드백(2026-08-10). 문구 힌트("300까지 가 볼까?")만 남긴다.
    if (event.type === "boarded") {
      const pop = root.querySelector(".ktx-board-pop");
      const face = root.querySelector(".ktx-board-face");
      face.replaceChildren(passengerImg(document, event.number, "ktx-board-img"));
      root.querySelector(".ktx-board-count").textContent = String(event.ordinal);
      pop.dataset.guest = String(Boolean(event.guest));
      pulse(pop, "ktx-board-show");
      spawnWalker(document, root, event);
    }
    if (event.type === "door-countdown") {
      const counter = root.querySelector(".ktx-door-countdown");
      if (counter) {
        counter.textContent = String(event.secondsLeft);
        pulse(counter, "ktx-count-pop");
      }
    }
    if (event.type === "stopped") {
      root.dataset.lastStars = String(event.stars);
      pulse(root.querySelector(".ktx-hud"), "ktx-stars-pop");
      // 도착 임팩트 — 역명판이 크게 튀고 장면이 한 번 밝게 숨쉰다
      pulse(root.querySelector(".ktx-motion-station-sign"), "ktx-sign-pop");
      pulse(root.querySelector(".ktx-motion-scene"), "ktx-arrive-flash");
    }
    if (event.type === "doors-open") {
      // 문이 열리면 안에서 친구가 내린다 — "역에 섰다"의 체감
      spawnAlighters(document, root);
    }
    if (event.type === "milestone") {
      pulse(root.querySelector(".ktx-speedo"), "ktx-speed-pop");
      pulse(balloon, "ktx-balloon-pop");
    }
    if (event.type === "slow-warn") {
      const sign = root.querySelector(".ktx-slow-sign");
      // "저기 표지판!" 순간 표지판이 보여야 한다 — 운전실이면 바깥 컷
      // (도착 컷과 같은 관례, 협회 D). 뷰 상태는 앱이 관리하므로 여기서는
      // updateKtxScene 호출자가 넘긴 view를 바꿀 수 없다 — 앱 배선에서 처리.
      void 0;
      if (sign) {
        sign.querySelector(".ktx-slow-sign-disc").textContent = String(event.limit);
        pulse(sign, "ktx-slow-sign-go");
      }
    }
    if (event.type === "overrun") {
      // "뒤로 통통~" 약속의 실체 — 무대 바운스(협회 D: correcting 연출 부재)
      pulse(root, "ktx-wobble");
    }
    if (event.type === "slow-wobble") {
      // 무섭지 않은 통통 바운스 — 벌이 아니라 "속도를 봐 달라"는 신호
      pulse(root, "ktx-wobble");
      pulse(root.querySelector(".ktx-slow-badge"), "ktx-balloon-pop");
    }
    if (event.type === "slow-clear" && event.success) {
      pulse(root.querySelector(".ktx-hud"), "ktx-stars-pop");
    }
    if (event.type === "finale") {
      showFinale(document, root, event, state);
    }
  }
  return root;
}

function showFinale(document, root, event, state) {
  const finale = root.querySelector(".ktx-finale");
  finale.dataset.on = "true";
  const title = root.querySelector(".ktx-finale-title");
  // 종착역은 노선 따라 다르다 — 목포 완주가 "부산 도착"으로 뜨던 결함(협회 D).
  const terminus = state ? routeStations(state).at(-1) : "부산";
  title.textContent = event.perfect
    ? "⭐ 퍼펙트 기관사! ⭐"
    : `${terminus}에 도착했어요!`;
  // 정차 결과 — 역별 별 줄 (Canonical 정면 뷰 아래)
  const stopsHost = root.querySelector(".ktx-finale-stops");
  if (stopsHost && state) {
    stopsHost.replaceChildren();
    const stations = routeStations(state);
    event.stars.forEach((count, index) => {
      const chip = el(document, "span", "ktx-finale-stop");
      chip.append(el(document, "b", "ktx-finale-stop-name", stations[index + 1]));
      chip.append(el(document, "span", "ktx-finale-stop-stars", "⭐".repeat(count)));
      stopsHost.append(chip);
    });
    // 반짝 배지도 여기 보여야 HUD 합계와 피날레 문구가 어긋나지 않는다
    // (협회 후반 검수 6 — 배지 +1이 전역 합계에만 더해져 12 vs 13이 났다).
    if (event.bonuses?.length) {
      const chip = el(document, "span", "ktx-finale-stop");
      chip.append(el(document, "b", "ktx-finale-stop-name", "반짝 배지"));
      chip.append(el(document, "span", "ktx-finale-stop-stars",
        `✨ +${event.bonuses.length}`));
      stopsHost.append(chip);
    }
  }
  const friends = root.querySelector(".ktx-finale-friends");
  friends.replaceChildren();
  for (const number of event.boarded) {
    friends.append(passengerImg(document, number, "ktx-finale-friend"));
  }
  const total = event.stars.reduce((sum, count) => sum + count, 0);
  root.querySelector(".ktx-finale-words").textContent =
    `별 ${total}개 · 친구 ${event.boarded.length}명 — 고마워요, 기관사님!`;
}
