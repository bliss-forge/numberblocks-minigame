// STEP 1 단지 지도 — 목업 v3 씬 ①(mockups/v3/mockup-v3-1-map.html)의 시각 언어를 옮겼다.
//
// 모델의 5×3 격자가 그림의 도로망과 같은 것을 가리킨다:
//   · 가로 도로 한 줄(row 1)이 단지를 가로지르고
//   · 세로 도로 두 줄이 열 1·3 에서 그 도로와 만난다
//   · 그 사이에 생기는 여섯 구역이 목업의 "여섯 블록"이다 —
//     넷은 동(집), 둘은 연못 공원·나무 공원이라 트럭이 들어갈 수 없다
// 좌표는 CELL_ANCHORS 하나만 고치면 그림과 판정이 함께 움직인다.
//
// 목업의 미니맵은 옮기지 않았다. 목업은 카메라가 트럭을 따라다니는 화면이라
// 미니맵이 "안 보이는 곳"을 알려 주지만, 이 화면은 단지 전체가 한 눈에 들어와
// 같은 그림을 두 번 그리는 꼴이 된다. 카메라가 붙는 날 함께 들어올 물건이다.

import { BLOCKED_CELLS, GRID_COLUMNS, GRID_ROWS } from "./delivery-model.mjs";
import { truckSprite, truckSpriteHeight } from "./delivery-truck-art.mjs";
import { standingCharacterSvg } from "./character-stage-art.mjs";

export const MAP_VIEW_BOX = "0 0 1140 560";
// 그림이 무대보다 납작할 때 남는 위아래를 채울 색 — 잔디와 같은 톤.
export const MAP_BACKDROP = "#A9D977";

const COLUMN_X = [110, 340, 570, 800, 1030];
const ROAD_Y = 276;
const TRUCK_WIDTH = 106;

// 목업 v3 팔레트. 이 표 밖의 색은 지도에 쓰지 않는다.
const P = Object.freeze({
  grass: "#A9D977",
  bush: "#8FCF6B",
  leaf: "#A6DB7E",
  walk: "#E3DCCA",
  walkEdge: "#D2C9B2",
  road: "#606B78",
  lane: "#F6F1E3",
  plate: "#FFFDF6",
  plateEdge: "#D9CDB2",
  gold: "#F5C531",
  goldEdge: "#E8A61E",
  star: "#FFD34D",
  water: "#BFDCEA",
  waterEdge: "#A9C6D6",
  sign: "#3D7BD9",
  ink: "#4A5560",
});

// 윗줄 동과 아랫줄 동은 목업처럼 지붕 색이 다르다 — 줄이 다르면 색이 다르다.
const TONES = Object.freeze({
  north: { wall: "#F6EDD9", edge: "#E3D4B4", roof: "#EE8A6B", ink: "#8AA0B0" },
  south: { wall: "#EFF4DF", edge: "#D8DFBC", roof: "#7FB6A4", ink: "#7E967F" },
});

// 트럭이 칸마다 서는 자리(바닥 중심). 집 칸에서는 문패를 가리지 않게 집 옆에 댄다.
export const CELL_ANCHORS = [
  // row 0 — 위 블록
  [
    { x: COLUMN_X[0] + 108, y: 204 },
    { x: COLUMN_X[1], y: 120 },
    { x: COLUMN_X[2] + 108, y: 204 },
    { x: COLUMN_X[3], y: 120 },
    { x: COLUMN_X[4] - 108, y: 204 },
  ],
  // row 1 — 가로 도로
  COLUMN_X.map(x => ({ x, y: ROAD_Y })),
  // row 2 — 아래 블록
  [
    { x: COLUMN_X[0], y: 440 },
    { x: COLUMN_X[1], y: 440 },
    { x: COLUMN_X[2] + 108, y: 426 },
    { x: COLUMN_X[3], y: 440 },
    { x: COLUMN_X[4], y: 440 },
  ],
];

export function anchorFor(cell) {
  return CELL_ANCHORS[cell.y]?.[cell.x] ?? CELL_ANCHORS[1][0];
}

/* ── 구역(블록) ───────────────────────────────────────────────────── */

// 도로가 잘라 낸 여섯 구역. 목업의 "인도 + 마당" 두 겹을 그대로 쓴다.
const BLOCKS = [
  { key: "0,0", x: 0, y: 0, width: 294, height: 226 },
  { key: "2,0", x: 386, y: 0, width: 368, height: 226 },
  { key: "4,0", x: 846, y: 0, width: 294, height: 226 },
  { key: "0,2", x: 0, y: 326, width: 294, height: 234 },
  { key: "2,2", x: 386, y: 326, width: 368, height: 234 },
  { key: "4,2", x: 846, y: 326, width: 294, height: 234 },
];

function blockPad({ x, y, width, height }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${P.walk}" ` +
    `stroke="${P.walkEdge}" stroke-width="2"/>` +
    `<rect x="${x + 16}" y="${y + 16}" width="${width - 32}" height="${height - 32}" ` +
    `fill="${P.grass}" stroke="${P.walkEdge}" stroke-width="2"/>`;
}

/* ── 동 ───────────────────────────────────────────────────────────── */

const BUILDING_WIDTH = 168;
const BUILDING_HEIGHT = 128;

// 집이 그려지는 자리(좌상단). 위 블록은 도로 위, 아래 블록은 도로 아래.
const HOUSE_BOXES = {
  "0,0": { x: COLUMN_X[0] - BUILDING_WIDTH / 2, y: 40, row: "north" },
  "2,0": { x: COLUMN_X[2] - BUILDING_WIDTH / 2, y: 40, row: "north" },
  "4,0": { x: COLUMN_X[4] - BUILDING_WIDTH / 2, y: 40, row: "north" },
  "2,2": { x: COLUMN_X[2] - BUILDING_WIDTH / 2, y: 366, row: "south" },
};

function building(box, unit, goal) {
  const tone = TONES[box.row];
  const { x, y } = box;
  const w = BUILDING_WIDTH;
  const h = BUILDING_HEIGHT;
  const cx = x + w / 2;

  return `<g>` +
    // 파사드
    `<g filter="url(#dv-soft)">` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${tone.wall}" ` +
      `stroke="${tone.edge}" stroke-width="3.5"/></g>` +
    // 지붕 띠
    `<path d="M${x} ${y + 10} q0 -10 10 -10 h${w - 20} q10 0 10 10 v18 h-${w} z" fill="${tone.roof}"/>` +
    // 큰 호수
    `<text x="${cx}" y="${y + 96}" text-anchor="middle" font-size="52" font-weight="800" ` +
      `fill="${goal ? "#D98A2B" : tone.ink}">${unit}</text>` +
    // 정문 캐노피 + 진입로
    `<rect x="${cx - 36}" y="${y + h}" width="72" height="18" rx="6" fill="${tone.roof}" ` +
      `stroke="${tone.edge}" stroke-width="2"/>` +
    `<rect x="${cx - 16}" y="${y + h + 18}" width="32" height="30" fill="${P.walk}"/>` +
    // 문패 배너
    `<g filter="url(#dv-tiny)"><rect x="${cx - 52}" y="${y + h + 8}" width="104" height="30" rx="8" ` +
      `fill="${P.plate}" stroke="${goal ? P.gold : P.plateEdge}" stroke-width="${goal ? 3.5 : 2.5}"/></g>` +
    `<text x="${cx}" y="${y + h + 29}" text-anchor="middle" font-size="20" font-weight="800" ` +
      `fill="${goal ? "#D98A2B" : tone.ink}">${unit}호</text>` +
    `</g>`;
}

function goalGlow(box) {
  const cx = box.x + BUILDING_WIDTH / 2;
  const cy = box.y + BUILDING_HEIGHT / 2;
  return `<ellipse cx="${cx}" cy="${cy}" rx="170" ry="140" fill="url(#dv-goalglow)"/>`;
}

/* ── 하역 존 ──────────────────────────────────────────────────────── */

// 목표 동 정문 앞 도로에 노란 점선 상자를 깐다 — "여기 대면 돼요".
function loadingZone(box) {
  const cx = box.x + BUILDING_WIDTH / 2;
  const width = 260;
  const x = Math.min(Math.max(cx - width / 2, 10), 1140 - width - 10);
  const y = 236;

  return `<g>` +
    `<rect x="${x}" y="${y}" width="${width}" height="80" rx="14" fill="${P.gold}" opacity="0.22"/>` +
    `<rect x="${x}" y="${y}" width="${width}" height="80" rx="14" fill="none" stroke="${P.gold}" ` +
      `stroke-width="6" stroke-dasharray="22 14"/>` +
    `<text x="${x + 60}" y="${y + 62}" text-anchor="middle" font-size="40" font-weight="800" ` +
      `fill="${P.lane}" opacity="0.95">P</text>` +
    `<g filter="url(#dv-tiny)"><rect x="${x + width - 82}" y="${y + 18}" width="44" height="44" rx="10" ` +
      `fill="${P.sign}"/></g>` +
    `<text x="${x + width - 60}" y="${y + 49}" text-anchor="middle" font-size="26" font-weight="800" ` +
      `fill="#FFFFFF">P</text></g>`;
}

/* ── 길찾기 화살표 ────────────────────────────────────────────────── */

const STEPS = [
  { dx: 0, dy: -1, key: "up" },
  { dx: 0, dy: 1, key: "down" },
  { dx: -1, dy: 0, key: "left" },
  { dx: 1, dy: 0, key: "right" },
];

// 목표까지 가장 짧은 길의 첫 걸음. 연못·나무는 못 지나가고, 목표가 아닌 집은
// 들어서는 순간 멈춰 버리므로 길로 세지 않는다 — 모델의 runCommands 와 같은 판단이다.
function firstStepToward(truck, goalCell, houses, targetUnit) {
  const key = point => `${point.x},${point.y}`;
  const walls = new Set(BLOCKED_CELLS.map(key));
  for (const house of houses) {
    if (house.unit !== targetUnit) walls.add(key(house.cell));
  }

  const seen = new Set([key(truck)]);
  let frontier = [{ at: truck, first: null }];

  while (frontier.length > 0) {
    const next = [];
    for (const node of frontier) {
      if (node.at.x === goalCell.x && node.at.y === goalCell.y) return node.first;
      for (const step of STEPS) {
        const at = { x: node.at.x + step.dx, y: node.at.y + step.dy };
        if (at.x < 0 || at.x >= GRID_COLUMNS || at.y < 0 || at.y >= GRID_ROWS) continue;
        if (seen.has(key(at)) || walls.has(key(at))) continue;
        seen.add(key(at));
        next.push({ at, first: node.first ?? step.key });
      }
    }
    frontier = next;
  }
  return null;
}

const ARROW_ROTATION = { up: -90, down: 90, left: 180, right: 0 };

function guideArrow(anchor, direction) {
  if (!direction) return "";
  const offset = { up: [0, -74], down: [0, 74], left: [-84, 0], right: [84, 0] }[direction];
  const x = anchor.x + offset[0];
  const y = anchor.y - 26 + offset[1];
  return `<g class="dv-guide" transform="translate(${x} ${y}) rotate(${ARROW_ROTATION[direction]})" ` +
    `filter="url(#dv-tiny)">` +
    `<path d="M-16 -20 L18 0 L-16 20 L-16 6 L-30 6 L-30 -6 L-16 -6 Z" fill="${P.gold}" ` +
    `stroke="${P.goldEdge}" stroke-width="3" stroke-linejoin="round"/></g>`;
}

/* ── 소품 ─────────────────────────────────────────────────────────── */

function bush(cx, cy, radius) {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${P.bush}"/>` +
    `<circle cx="${cx - radius * 0.4}" cy="${cy - radius * 0.4}" r="${radius * 0.55}" fill="${P.leaf}"/>`;
}

function star(cx, cy, scale = 1) {
  return `<path transform="translate(${cx} ${cy}) scale(${scale})" ` +
    `d="M0 -13 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" fill="${P.star}"/>`;
}

// 경적에 답하는 강아지 — 목업 §5-7 의 주행 변주 소품.
function puppy(x, y) {
  return `<g transform="translate(${x} ${y})">` +
    `<ellipse cx="0" cy="0" rx="16" ry="9" fill="#E8B368" stroke="#C98F3F" stroke-width="2.5"/>` +
    `<circle cx="18" cy="-4" r="8" fill="#E8B368" stroke="#C98F3F" stroke-width="2.5"/>` +
    `<path d="M13 -11 l-3 -7 6 1 z M22 -11 l3 -7 -6 1 z" fill="#C98F3F"/>` +
    `<path d="M-15 -3 q-8 -3 -7 -11" stroke="#C98F3F" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="15" cy="-5" r="1.6" fill="#39434C"/><circle cx="21" cy="-5" r="1.6" fill="#39434C"/></g>`;
}

// 건널목 옆에서 손 흔드는 미니 친구 — 넘버블럭스 2번 에셋을 그대로 세운다.
// 인도 위에 세운다. 횡단보도 위에 두면 "차 앞에 서 있는 아이"가 되어 버린다.
function miniFriend(x, y) {
  return standingCharacterSvg({ number: 2, cx: x, baseY: y, width: 46, className: "dv-mini-friend" });
}

function pond(cx, cy) {
  return `<g><ellipse cx="${cx}" cy="${cy}" rx="86" ry="48" fill="${P.water}" ` +
    `stroke="${P.waterEdge}" stroke-width="3"/>` +
    `<ellipse cx="${cx - 24}" cy="${cy - 14}" rx="26" ry="10" fill="#FFFFFF" opacity="0.45"/>` +
    `<ellipse cx="${cx + 26}" cy="${cy + 12}" rx="14" ry="6" fill="#FFFFFF" opacity="0.3"/></g>`;
}

function playground(cx, cy) {
  return `<g>` +
    `<ellipse cx="${cx}" cy="${cy}" rx="62" ry="34" fill="${P.walk}" stroke="${P.walkEdge}" stroke-width="2.5"/>` +
    `<rect x="${cx - 42}" y="${cy - 26}" width="76" height="14" rx="7" fill="${P.gold}" ` +
      `stroke="${P.goldEdge}" stroke-width="2.5" transform="rotate(24 ${cx} ${cy - 19})"/>` +
    bush(cx + 52, cy - 24, 18) +
    bush(cx - 58, cy + 6, 14) +
    `</g>`;
}

/* ── 도로 ─────────────────────────────────────────────────────────── */

const ROADS =
  `<rect x="0" y="226" width="1140" height="100" fill="${P.road}"/>` +
  `<rect x="294" y="0" width="92" height="560" fill="${P.road}"/>` +
  `<rect x="754" y="0" width="92" height="560" fill="${P.road}"/>`;

const LANES =
  `<g stroke="${P.lane}" stroke-width="6" stroke-dasharray="30 26" opacity="0.9" fill="none">` +
  `<path d="M0 ${ROAD_Y} h1140"/><path d="M340 0 v560"/><path d="M800 0 v560"/></g>`;

// 중앙 교차로 서·북 접근의 횡단보도.
const CROSSWALK =
  `<g fill="${P.lane}" opacity="0.92">` +
  [0, 20, 40, 60, 80]
    .map(offset => `<rect x="${400 + offset}" y="236" width="10" height="80" rx="2"/>`)
    .join("") +
  [0, 20, 40, 60]
    .map(offset => `<rect x="${302 + offset}" y="160" width="10" height="48" rx="2"/>`)
    .join("") +
  `</g>`;

const DEFS =
  `<defs>` +
  `<filter id="dv-soft" x="-20%" y="-20%" width="140%" height="140%">` +
  `<feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#26424E" flood-opacity="0.16"/></filter>` +
  `<filter id="dv-tiny" x="-30%" y="-30%" width="160%" height="160%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#26424E" flood-opacity="0.18"/></filter>` +
  `<radialGradient id="dv-goalglow" cx="0.5" cy="0.5" r="0.5">` +
  `<stop offset="0.5" stop-color="#FFDF8E" stop-opacity="0.5"/>` +
  `<stop offset="1" stop-color="#FFDF8E" stop-opacity="0"/></radialGradient>` +
  `</defs>`;

const SCENERY =
  `<rect width="1140" height="560" fill="${P.grass}"/>` +
  BLOCKS.map(blockPad).join("") +
  ROADS +
  LANES +
  CROSSWALK +
  // 연못 공원(0,2)과 나무 공원(4,2) — 트럭이 못 들어가는 칸의 이유를 그림이 말한다.
  pond(110, 440) +
  bush(214, 384, 22) +
  bush(60, 356, 16) +
  playground(1010, 440) +
  bush(940, 380, 20) +
  bush(1096, 372, 16) +
  bush(232, 176, 18) +
  bush(690, 172, 16) +
  bush(920, 178, 18) +
  puppy(700, 214) +
  miniFriend(264, 214);

/* ── 말풍선 ───────────────────────────────────────────────────────── */

function callout(cx, y, unit) {
  const width = 210;
  const height = 52;
  const left = Math.min(Math.max(cx - width / 2, 8), 1140 - width - 8);
  const tail = Math.min(Math.max(cx, left + 34), left + width - 34);
  return `<g filter="url(#dv-tiny)">` +
    `<rect x="${left}" y="${y}" width="${width}" height="${height}" rx="18" fill="${P.plate}" ` +
      `stroke="${P.gold}" stroke-width="3.5"/>` +
    `<path d="M${tail - 12} ${y + height - 2} L${tail + 12} ${y + height - 2} L${tail} ${y + height + 18} Z" ` +
      `fill="${P.plate}" stroke="${P.gold}" stroke-width="3.5" stroke-linejoin="round"/>` +
    `<rect x="${tail - 12}" y="${y + height - 6}" width="24" height="7" fill="${P.plate}"/></g>` +
    `<text x="${left + width / 2}" y="${y + 35}" text-anchor="middle" font-size="22" ` +
    `font-weight="800" fill="#D98A2B">여기가 ${unit}호!</text>`;
}

/**
 * @param {{houses: Array, targetUnit: number, truck: {x:number,y:number}, facing: string}} view
 */
export function estateMapSvg(view) {
  const { houses, targetUnit, truck, facing } = view;
  const anchor = anchorFor(truck);

  const goalHouse = houses.find(item => item.unit === targetUnit);
  const goalBox = goalHouse ? HOUSE_BOXES[`${goalHouse.cell.x},${goalHouse.cell.y}`] : null;

  const buildings = houses
    .map(item => {
      const box = HOUSE_BOXES[`${item.cell.x},${item.cell.y}`];
      if (!box) return "";
      return building(box, item.unit, item.unit === targetUnit);
    })
    .join("");

  const goalMarks = goalBox
    ? goalGlow(goalBox) +
      loadingZone(goalBox) +
      star(goalBox.x + 16, goalBox.y + 34, 1.2) +
      star(goalBox.x + BUILDING_WIDTH - 12, goalBox.y + 22, 0.9)
    : "";
  // 말풍선을 놓을 자리는 줄마다 다르다. 윗줄 동은 위쪽 여백이 66px 이 안 나와
  // 지도 밖으로 밀려나므로 천장에 붙이고, 아랫줄 동은 도로에 띄우면 하역 존을
  // 덮으므로 도로 아래·지붕 바로 위에 앉힌다. 어느 쪽이든 꼬리가 지붕을 짚는다.
  const marker = goalBox
    ? callout(
        goalBox.x + BUILDING_WIDTH / 2,
        goalBox.row === "north" ? 4 : goalBox.y - 30,
        targetUnit
      )
    : "";

  const guide = goalHouse
    ? guideArrow(anchor, firstStepToward(truck, goalHouse.cell, houses, targetUnit))
    : "";

  // 뷰마다 높이가 달라 바닥(바퀴)을 앵커에 맞춘다 — 같은 차가 같은 자리에 선다.
  const height = truckSpriteHeight(facing, TRUCK_WIDTH);
  const sprite = truckSprite(facing, {
    x: anchor.x - TRUCK_WIDTH / 2,
    y: anchor.y + 14 - height,
    width: TRUCK_WIDTH,
  });

  return `<svg class="dv-map" viewBox="${MAP_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="아파트 단지 지도. 목표는 ${targetUnit}호예요.">` +
    DEFS +
    SCENERY +
    // 후광·하역 존은 건물보다 아래에 깔려야 건물이 후광 위로 선다.
    goalMarks +
    buildings +
    marker +
    guide +
    sprite +
    `</svg>`;
}
