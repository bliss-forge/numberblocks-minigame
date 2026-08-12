// STEP 2·3·4 건물 안 그림 — 목업 v3 씬 ③·④·⑤ 를 옮겼다.
//   · 샤프트 단면 + 승강기 안        (mockup-v3-3-elevator.html)
//   · 복도·초인종·호 확인            (mockup-v3-4-doorbell.html)
//   · 열린 문과 선물 3택             (mockup-v3-5-gift.html)
//
// v1 은 승강기에 트럭이 탔지만, v3 은 기사님이 카트를 밀고 탄다 — 사람이 타는 편이
// 층 버튼을 누르는 아이의 시점과 맞아 ELEVATOR_RIDER 를 courier 로 뒤집었다.
// 기사님은 목업의 오리지널 아바타라 넘버블럭스로 바꾸지 않는다. 문이 열리고 나면
// 그 자리에 서는 수령인만 저장소의 실제 넘버블럭스 에셋을 쓴다.

import { characterAssetPath, standingCharacterSvg } from "./character-stage-art.mjs";

export const ELEVATOR_RIDER = "courier"; // "truck" | "courier"

// 수령인은 호수의 앞자리(=층) 번호를 가진 넘버블럭스다 — 502호에는 5번이 산다.
// "앞자리를 읽는다"는 이 게임의 학습 훅을 캐릭터가 한 번 더 말해 준다.
export function friendNumberFor(unit) {
  return Math.max(1, Math.min(9, Math.floor(unit / 100)));
}

export function friendImageFor(unit) {
  return characterAssetPath(friendNumberFor(unit));
}

const SHAFT_VIEW_BOX = "0 0 260 620";
const CABIN_VIEW_BOX = "0 0 1040 560";
const HALL_VIEW_BOX = "0 0 1280 620";

// 그림이 무대보다 납작할 때 남는 자리를 채울 색 — 각 장면의 벽과 같은 톤.
export const SHAFT_BACKDROP = "#EAE0CC";
export const CABIN_BACKDROP = "#EFE8D8";
export const HALL_BACKDROP = "#F1E6CF";

/* ── 팔레트 ───────────────────────────────────────────────────────── */

export const HALL_PALETTE = Object.freeze({
  wall: "#F3EDE0",
  panel: "#F9F4E7",
  panelEdge: "#DCCFAF",
  hallTop: "#F8F1E2",
  hallBottom: "#F1E6CF",
  ceiling: "#EFE4CC",
  ceilEdge: "#DDCFB0",
  lamp: "#FFF6D9",
  lampEdge: "#E8D9AE",
  skirt: "#E2D2AE",
  floor: "#D9C094",
  floorLine: "#CBB183",
  plate: "#FFFDF6",
  plateEdge: "#D9CDB2",
  gold: "#F5C531",
  goldSoft: "#FFF3C9",
  goldEdge: "#F5A623",
  goldInk: "#B3541E",
  goldWarm: "#E8A61E",
  coral: "#E86A50",
  coralDoor: "#EE9678",
  coralDoorEdge: "#D67C5E",
  mint: "#8FBFB7",
  mintEdge: "#74A79E",
  mintGlass: "#A8D0C8",
  blue: "#93B7E0",
  blueEdge: "#7A9FC9",
  blueGlass: "#ACC9E8",
  teal: "#7FB6A4",
  shaft: "#DEE7EE",
  shaftEdge: "#C4D2DC",
  slab: "#E2D5B8",
  floorInk: "#AEB9C4",
  floorInkOn: "#8FA3B8",
  landing: "#CBD8E2",
  landingEdge: "#B4C4D0",
  cab: "#FFF6DF",
  cabTop: "#FFE9AE",
  cabEdge: "#E8B84B",
  display: "#3B4450",
  displayOn: "#8FE08A",
  displayOff: "#57626E",
  cartonA: "#E8B368",
  cartonB: "#DDA75A",
  cartonEdge: "#C98F3F",
  metal: "#8A97A3",
  metalDark: "#39434C",
  hub: "#C9D2DA",
  ink: "#4A5560",
  inkSoft: "#8A94A0",
  inkText: "#3E5A68",
  skin: "#F7C6A0",
  vest: "#F5A623",
  shirt: "#FFF1D4",
  cuff: "#E8CFA0",
  cap: "#E86A50",
  boot: "#5B6472",
  star: "#FFD34D",
  halo: "#FFE1D6",
  goldDeep: "#D98A2B",
  mutter: "#7B8A96",
});

// 파일 안에서는 짧게 부른다. 리듬 하역 무대도 같은 팔레트를 쓴다.
const P = HALL_PALETTE;

export const SHADOWS =
  `<filter id="dv-soft" x="-20%" y="-20%" width="140%" height="140%">` +
  `<feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#26424E" flood-opacity="0.16"/></filter>` +
  `<filter id="dv-tiny" x="-30%" y="-30%" width="160%" height="160%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#26424E" flood-opacity="0.18"/></filter>`;

const GLOW_DEFS =
  `<radialGradient id="dv-btnglow" cx="0.5" cy="0.5" r="0.5">` +
  `<stop offset="0.5" stop-color="#FFD34D" stop-opacity="0.7"/>` +
  `<stop offset="1" stop-color="#FFD34D" stop-opacity="0"/></radialGradient>` +
  `<radialGradient id="dv-doorglow" cx="0.5" cy="0.5" r="0.5">` +
  `<stop offset="0.5" stop-color="#FFDF8E" stop-opacity="0.5"/>` +
  `<stop offset="1" stop-color="#FFDF8E" stop-opacity="0"/></radialGradient>` +
  `<filter id="dv-goldglow" x="-35%" y="-35%" width="170%" height="170%">` +
  `<feDropShadow dx="0" dy="0" stdDeviation="10" flood-color="#F5C531" flood-opacity="0.95"/></filter>` +
  `<filter id="dv-pickglow" x="-35%" y="-35%" width="170%" height="170%">` +
  `<feDropShadow dx="0" dy="0" stdDeviation="9" flood-color="#F5A623" flood-opacity="0.9"/></filter>`;

/* ── 공통 조각 ────────────────────────────────────────────────────── */

export function star(cx, cy, size = 1) {
  return `<path transform="translate(${cx} ${cy}) scale(${size})" ` +
    `d="M0 -13 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" fill="${P.star}"/>`;
}

// 택배 상자 + 문패 라벨. 라벨이 없으면 테이프만 있는 민 상자다.
export function parcelBox(x, y, width, height, label = null, tone = P.cartonA) {
  const seam = height * 0.42;
  const plateWidth = width * 0.66;
  const plateHeight = height * 0.36;
  const parts = [
    `<rect x="0" y="0" width="${width}" height="${height}" rx="7" fill="${tone}" ` +
      `stroke="${P.cartonEdge}" stroke-width="3.5"/>`,
    `<path d="M0 ${seam} h${width} M${width / 2} 0 v${seam}" stroke="${P.cartonEdge}" stroke-width="3"/>`,
  ];
  if (label !== null) {
    parts.push(
      `<rect x="${(width - plateWidth) / 2}" y="${seam + 4}" width="${plateWidth}" ` +
        `height="${plateHeight}" rx="4" fill="${P.plate}" stroke="${P.plateEdge}" stroke-width="2"/>`,
      `<text x="${width / 2}" y="${seam + 4 + plateHeight * 0.74}" text-anchor="middle" ` +
        `font-size="${plateHeight * 0.72}" font-weight="800" fill="${P.ink}">${label}</text>`
    );
  }
  return `<g transform="translate(${x} ${y})">${parts.join("")}</g>`;
}

// 손수레 — 기사님이 미는 카트.
export function cart(x, y, width) {
  const wheel = width * 0.06;
  return `<g transform="translate(${x} ${y})">` +
    `<path d="M6 4 q-22 -16 -26 -42" stroke="${P.metal}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<rect x="0" y="0" width="${width}" height="10" rx="4" fill="${P.metal}"/>` +
    `<path d="M14 10 v16 m${width - 28} -16 v16" stroke="${P.metal}" stroke-width="5"/>` +
    `<circle cx="20" cy="32" r="${wheel}" fill="${P.metalDark}"/>` +
    `<circle cx="20" cy="32" r="${wheel * 0.4}" fill="${P.hub}"/>` +
    `<circle cx="${width - 20}" cy="32" r="${wheel}" fill="${P.metalDark}"/>` +
    `<circle cx="${width - 20}" cy="32" r="${wheel * 0.4}" fill="${P.hub}"/></g>`;
}

// 기사님 아바타 — 목업 v3 의 오리지널 캐릭터. 팔 모양만 자세에 따라 달라진다.
const COURIER_ARMS = {
  idle:
    `<path d="M28 8 q26 16 52 28" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M-28 8 q-14 16 -10 34" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
  bell:
    `<path d="M26 -2 q40 -34 72 -72" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M-28 8 q-14 16 -10 34" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
  "bell-left":
    `<path d="M-26 -2 q-40 -34 -72 -72" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M28 8 q14 16 10 34" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
  cheer:
    `<path d="M28 4 q22 -26 40 -44" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>` +
    `<path d="M-28 4 q-22 -26 -40 -44" stroke="${P.vest}" stroke-width="13" fill="none" stroke-linecap="round"/>`,
};

export function courier(x, y, scale = 1, pose = "idle") {
  return `<g class="dv-courier" filter="url(#dv-tiny)">` +
    `<g transform="translate(${x} ${y}) scale(${scale})">` +
    `<rect x="-34" y="-8" width="68" height="86" rx="18" fill="${P.vest}"/>` +
    `<rect x="-15" y="-8" width="30" height="86" fill="${P.shirt}"/>` +
    `<path d="M-15 22 h30" stroke="${P.cuff}" stroke-width="3"/>` +
    `<circle cx="0" cy="-38" r="27" fill="${P.skin}"/>` +
    `<path d="M-28 -46 a28 28 0 0 1 56 0 z" fill="${P.cap}"/>` +
    `<rect x="24" y="-52" width="22" height="10" rx="5" fill="${P.cap}"/>` +
    `<circle cx="-8" cy="-36" r="3.6" fill="#333333"/><circle cx="10" cy="-36" r="3.6" fill="#333333"/>` +
    `<circle cx="-9.4" cy="-37.4" r="1.4" fill="#FFFFFF" opacity="0.9"/>` +
    `<circle cx="8.6" cy="-37.4" r="1.4" fill="#FFFFFF" opacity="0.9"/>` +
    `<path d="M-6 -25 q7 6 14 0" stroke="${P.goldInk}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="-17" cy="-29" r="4.5" fill="#FF9E8A" opacity="0.6"/>` +
    (COURIER_ARMS[pose] ?? COURIER_ARMS.idle) +
    `<rect x="-24" y="78" width="18" height="26" rx="8" fill="${P.boot}"/>` +
    `<rect x="6" y="78" width="18" height="26" rx="8" fill="${P.boot}"/>` +
    `</g></g>`;
}

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

// 말풍선 — 둥근 상자에 꼬리 하나. 좌표는 상자의 좌상단이고, 화면 밖으로 밀려나면
// 안으로 당겨 앉힌다. 말이 잘려 보이는 것보다 위치가 조금 어긋나는 편이 낫다.
function speech(rawX, y, width, height, textAt, { edge = null, tail = "left", limit = 1280 } = {}) {
  const x = clamp(rawX, 12, limit - width - 12);
  const stroke = edge ? ` stroke="${edge}" stroke-width="3.5"` : "";
  const anchor = { left: 0.28, center: 0.5, right: 0.72 }[tail] ?? 0.28;
  const tailX = x + width * anchor;
  const textMarkup = textAt(x + width / 2);
  return `<g filter="url(#dv-tiny)">` +
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${Math.min(20, height / 2)}" ` +
      `fill="#FFFFFF"${stroke}/>` +
    `<path d="M${tailX - 12} ${y + height - 2} L${tailX + 14} ${y + height - 2} ` +
      `L${tailX - 4} ${y + height + 20} Z" fill="#FFFFFF"${stroke} stroke-linejoin="round"/>` +
    `<rect x="${tailX - 12}" y="${y + height - 7}" width="26" height="8" fill="#FFFFFF"/></g>` +
    textMarkup;
}

// 소리가 퍼지는 표시 — 초인종·버튼음에 공통으로 붙는다.
export function chirp(x, y, color = P.goldWarm) {
  return `<g stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round" ` +
    `transform="translate(${x} ${y})">` +
    `<path d="M0 0 q6 -8 2 -16"/><path d="M14 -4 q8 -10 3 -22"/></g>`;
}

/* ── STEP 2 · 샤프트 단면 ─────────────────────────────────────────── */

const SHAFT_TOP = 34;
const SHAFT_BOTTOM = 596;

function floorBand(floor, topFloor) {
  const step = (SHAFT_BOTTOM - SHAFT_TOP) / topFloor;
  const bottom = SHAFT_BOTTOM - (floor - 1) * step;
  return { top: bottom - step, bottom, center: bottom - step / 2, step };
}

export function elevatorShaftSvg({ topFloor = 7, current = 1, target = 7 }) {
  const numbers = [];
  const slabs = [];
  const landings = [];

  for (let floor = 1; floor <= topFloor; floor += 1) {
    const band = floorBand(floor, topFloor);
    const goal = floor === target;
    const size = goal ? 46 : 40;

    if (floor > 1) {
      slabs.push(`<path d="M12 ${band.bottom} h236"/>`);
    }
    if (goal) {
      numbers.push(`<circle cx="40" cy="${band.center}" r="30" fill="${P.halo}"/>`);
    }
    numbers.push(
      `<text x="40" y="${band.center + size * 0.35}" text-anchor="middle" font-size="${size}" ` +
      `font-weight="800" fill="${goal ? P.coral : floor === current ? P.floorInkOn : P.floorInk}">${floor}</text>`
    );

    // 승강장 문 — 목표 층만 금빛으로 물든다.
    const doorY = band.center - 22;
    landings.push(
      `<rect x="196" y="${doorY}" width="48" height="44" rx="4" ` +
        `fill="${goal ? P.goldSoft : P.landing}" stroke="${goal ? P.gold : P.landingEdge}" ` +
        `stroke-width="${goal ? 4 : 3}"/>` +
      `<path d="M220 ${doorY} v44" stroke="${goal ? P.gold : P.landingEdge}" stroke-width="2.5"/>`
    );
  }

  const carBand = floorBand(current, topFloor);
  const carY = Math.round(carBand.center - 30);
  const rising = current < target;
  const arrows = [0, 1, 2]
    .map(index => {
      const y = carY - 20 - index * 24;
      const opacity = [1, 0.55, 0.3][index];
      return `<path d="M172 ${y} l10 -13 10 13 z" fill="${P.teal}" opacity="${opacity}"/>`;
    })
    .join("");

  return `<svg class="dv-shaft" viewBox="${SHAFT_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="엘리베이터 통로. 지금 ${current}층, 목표는 ${target}층이에요.">` +
    `<defs>${SHADOWS}</defs>` +
    `<rect width="260" height="620" fill="${P.wall}"/>` +
    `<g filter="url(#dv-soft)">` +
      `<rect x="10" y="${SHAFT_TOP - 10}" width="240" height="${SHAFT_BOTTOM - SHAFT_TOP + 20}" rx="12" ` +
      `fill="${P.panel}" stroke="${P.panelEdge}" stroke-width="4"/></g>` +
    `<g stroke="${P.slab}" stroke-width="4" fill="none">${slabs.join("")}</g>` +
    // 샤프트 통로
    `<rect x="82" y="${SHAFT_TOP - 4}" width="104" height="${SHAFT_BOTTOM - SHAFT_TOP + 8}" ` +
      `fill="${P.shaft}" stroke="${P.shaftEdge}" stroke-width="4"/>` +
    `<g stroke="${P.shaftEdge}" stroke-width="3" stroke-dasharray="4 10">` +
      `<path d="M100 ${SHAFT_TOP} v${SHAFT_BOTTOM - SHAFT_TOP}"/>` +
      `<path d="M168 ${SHAFT_TOP} v${SHAFT_BOTTOM - SHAFT_TOP}"/></g>` +
    numbers.join("") +
    landings.join("") +
    // 케이블 + 도르래
    `<circle cx="134" cy="${SHAFT_TOP + 4}" r="9" fill="${P.metal}"/>` +
    `<path d="M134 ${SHAFT_TOP + 4} V${carY}" stroke="${P.metal}" stroke-width="4"/>` +
    (rising ? arrows : "") +
    // 칸 — 여기서는 "지금 몇 층인지"만 읽히면 된다. 기사님은 옆 무대에서 크게 보인다.
    `<g filter="url(#dv-soft)">` +
      `<rect class="dv-car" x="86" y="${carY}" width="96" height="60" rx="10" fill="${P.cab}" ` +
      `stroke="${P.cabEdge}" stroke-width="4"/>` +
      `<rect x="86" y="${carY}" width="96" height="11" rx="5.5" fill="${P.cabTop}"/>` +
      parcelBox(100, carY + 20, 68, 34, null, P.cartonA) +
    `</g>` +
    `</svg>`;
}

/* ── STEP 2 · 승강기 안 ───────────────────────────────────────────── */

export function elevatorCabinSvg({ current = 1, doorsOpen = false } = {}) {
  const doorGap = doorsOpen ? 110 : 0;

  return `<svg class="dv-cabin" viewBox="${CABIN_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" aria-label="엘리베이터 안. 지금 ${current}층.">` +
    `<defs>${SHADOWS}` +
    `<linearGradient id="dv-cabwall" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${P.panel}"/><stop offset="1" stop-color="#EFE8D8"/></linearGradient>` +
    `<linearGradient id="dv-cabdoor" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#D7E2EA"/><stop offset="1" stop-color="${P.landing}"/></linearGradient>` +
    `</defs>` +
    `<rect width="1040" height="560" fill="${P.panel}"/>` +
    // 천장 · 조명
    `<rect x="0" y="0" width="1040" height="66" fill="${P.ceiling}"/>` +
    `<path d="M0 66 h1040" stroke="${P.ceilEdge}" stroke-width="4"/>` +
    `<ellipse cx="330" cy="40" rx="72" ry="17" fill="${P.lamp}" stroke="${P.lampEdge}" stroke-width="3"/>` +
    `<ellipse cx="710" cy="40" rx="72" ry="17" fill="${P.lamp}" stroke="${P.lampEdge}" stroke-width="3"/>` +
    // 벽 · 문
    `<rect x="60" y="66" width="920" height="404" fill="url(#dv-cabwall)" ` +
      `stroke="${P.panelEdge}" stroke-width="4"/>` +
    `<rect x="${300 - doorGap}" y="120" width="220" height="330" rx="6" fill="url(#dv-cabdoor)" ` +
      `stroke="${P.landingEdge}" stroke-width="4"/>` +
    `<rect x="${520 + doorGap}" y="120" width="220" height="330" rx="6" fill="url(#dv-cabdoor)" ` +
      `stroke="${P.landingEdge}" stroke-width="4"/>` +
    `<path d="M${520 + doorGap} 120 v330" stroke="${P.landingEdge}" stroke-width="3"/>` +
    // 층 표시기 — 목업 v3 의 검은 패널 + 초록 숫자
    `<g filter="url(#dv-tiny)"><rect x="392" y="88" width="256" height="76" rx="16" fill="${P.display}"/></g>` +
    `<path d="M432 140 h36 l-18 -24 z" fill="${P.displayOn}"/>` +
    `<path d="M572 116 h36 l-18 24 z" fill="${P.displayOff}"/>` +
    `<text class="dv-floor-readout" x="520" y="148" text-anchor="middle" font-size="56" ` +
      `font-weight="800" fill="${P.displayOn}" ` +
      `style="font-variant-numeric:tabular-nums">${current}</text>` +
    // 손잡이 봉
    `<rect x="96" y="330" width="180" height="12" rx="6" fill="${P.landing}" ` +
      `stroke="${P.landingEdge}" stroke-width="3"/>` +
    `<rect x="764" y="330" width="180" height="12" rx="6" fill="${P.landing}" ` +
      `stroke="${P.landingEdge}" stroke-width="3"/>` +
    // 바닥
    `<rect x="0" y="470" width="1040" height="90" fill="${P.skirt}"/>` +
    `<path d="M0 470 h1040" stroke="${P.floorLine}" stroke-width="4"/>` +
    `<ellipse cx="470" cy="512" rx="200" ry="24" fill="#B9A882" opacity="0.35"/>` +
    // 기사님 + 카트 + 상자
    cart(470, 470, 250) +
    parcelBox(492, 372, 104, 96, null, P.cartonA) +
    parcelBox(608, 396, 92, 72, null, P.cartonB) +
    courier(360, 366, 1.1, "idle") +
    `</svg>`;
}

/* ── STEP 3 · 복도 ────────────────────────────────────────────────── */

// 문 세 짝. 가운데가 목표일 때 가장 보기 좋게 배치를 목업에서 그대로 가져왔다.
const DOOR_SLOTS = [
  { x: 130, tone: { slab: P.mint, edge: P.mintEdge, glass: P.mintGlass, knob: "#5E8A82" }, knobRight: true },
  { x: 542, tone: { slab: P.coralDoor, edge: P.coralDoorEdge, glass: null, knob: "#B35F44" }, knobRight: false },
  { x: 954, tone: { slab: P.blue, edge: P.blueEdge, glass: P.blueGlass, knob: "#5F82AB" }, knobRight: false },
];

const DOOR_WIDTH = 196;
const DOOR_TOP = 130;
const DOOR_HEIGHT = 322;

// 복도 벽·천장·바닥 — 초인종 화면과 선물 화면이 같은 복도를 쓴다.
const HALL_BASE =
  `<rect width="1280" height="620" fill="url(#dv-hallwall)"/>` +
  `<rect x="0" y="0" width="1280" height="48" fill="${P.ceiling}"/>` +
  `<path d="M0 48 h1280" stroke="${P.ceilEdge}" stroke-width="4"/>` +
  `<ellipse cx="380" cy="38" rx="46" ry="13" fill="${P.lamp}" stroke="${P.lampEdge}" stroke-width="3"/>` +
  `<ellipse cx="900" cy="38" rx="46" ry="13" fill="${P.lamp}" stroke="${P.lampEdge}" stroke-width="3"/>` +
  `<rect x="0" y="470" width="1280" height="24" fill="${P.skirt}"/>` +
  `<rect x="0" y="494" width="1280" height="126" fill="${P.floor}"/>` +
  `<g stroke="${P.floorLine}" stroke-width="3" fill="none">` +
  `<path d="M0 538 h1280"/><path d="M0 584 h1280"/>` +
  `<path d="M160 494 v44 M480 494 v44 M800 494 v44 M1120 494 v44"/>` +
  `<path d="M320 538 v46 M640 538 v46 M960 538 v46"/></g>`;

const HALL_DEFS =
  `<defs>${SHADOWS}${GLOW_DEFS}` +
  `<linearGradient id="dv-hallwall" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="${P.hallTop}"/><stop offset="1" stop-color="${P.hallBottom}"/></linearGradient>` +
  `<linearGradient id="dv-doorlight" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="#FFF2C8"/><stop offset="1" stop-color="#FFE3A0"/></linearGradient>` +
  `</defs>`;

function closedDoor(slot, unit, goal) {
  const { x, tone } = slot;
  const knobX = slot.knobRight ? x + DOOR_WIDTH - 22 : x + 20;
  const plate =
    `<g${goal ? ` filter="url(#dv-goldglow)"` : ""}>` +
    `<rect x="${x + 46}" y="${DOOR_TOP - 62}" width="104" height="42" rx="10" fill="${goal ? "#FFF9E6" : P.plate}" ` +
      `stroke="${goal ? P.gold : P.plateEdge}" stroke-width="${goal ? 4 : 3}"/></g>` +
    `<text x="${x + DOOR_WIDTH / 2}" y="${DOOR_TOP - 31}" text-anchor="middle" font-size="26" ` +
      `font-weight="800" fill="${goal ? P.goldDeep : P.mutter}">${unit}</text>`;

  const panels = tone.glass
    ? `<rect x="${x + 22}" y="${DOOR_TOP + 28}" width="152" height="120" rx="8" fill="${tone.glass}" opacity="0.6"/>`
    : `<rect x="${x + 24}" y="${DOOR_TOP + 32}" width="148" height="108" rx="8" fill="none" ` +
        `stroke="${tone.edge}" stroke-width="3" opacity="0.8"/>` +
      `<rect x="${x + 24}" y="${DOOR_TOP + 168}" width="148" height="122" rx="8" fill="none" ` +
        `stroke="${tone.edge}" stroke-width="3" opacity="0.8"/>`;

  return `<g>` +
    `<rect x="${x}" y="${DOOR_TOP}" width="${DOOR_WIDTH}" height="${DOOR_HEIGHT}" rx="8" ` +
      `fill="${tone.slab}" stroke="${tone.edge}" stroke-width="5"/>` +
    panels +
    `<circle cx="${knobX}" cy="${DOOR_TOP + 176}" r="9" fill="${tone.knob}"/>` +
    plate +
    `</g>`;
}

// 호 확인 연출 — 라벨의 숫자와 문패의 숫자가 같다는 것을 반짝임으로 짚어 준다.
// 말풍선은 문패 바로 위에 세운다: 옆에 두면 이웃 문패를 덮는다.
function unitMatched(slot) {
  const cx = slot.x + DOOR_WIDTH / 2;
  const y = DOOR_TOP - 62;
  return `<g>` +
      star(slot.x + 10, y - 8, 1) + star(slot.x + DOOR_WIDTH - 10, y + 4, 0.75) + `</g>` +
    `<g stroke="${P.star}" stroke-width="3" stroke-linecap="round">` +
      `<path d="M${slot.x - 8} ${y + 21} h-16 M${slot.x + DOOR_WIDTH + 8} ${y + 21} h16"/></g>` +
    speech(
      cx - 116, 2, 232, 44,
      textX => `<text x="${textX}" y="${32}" text-anchor="middle" font-size="24" font-weight="800" ` +
        `fill="${P.coral}">숫자가 딱 같네!</text>`,
      { tail: "center" }
    );
}

export function corridorSvg({ units = [], focus = 0, targetUnit = 0 }) {
  const index = Math.max(0, Math.min(DOOR_SLOTS.length - 1, focus));
  const slot = DOOR_SLOTS[index];
  const targetIndex = units.indexOf(targetUnit);
  const matched = targetIndex >= 0 && targetIndex === index;

  const doors = units
    .map((unit, position) => {
      const at = DOOR_SLOTS[position];
      return at ? closedDoor(at, unit, unit === targetUnit) : "";
    })
    .join("");

  // 기사님은 고른 문 앞으로 옮겨 선다 — 어느 문을 고르는 중인지 그림이 말한다.
  // 맨 왼쪽 문에서는 오른쪽에 서고 왼팔을 뻗는다: 왼쪽에 서면 화면 밖으로 밀린다.
  const doorCenter = slot.x + DOOR_WIDTH / 2;
  const side = index === 0 ? 1 : -1;
  const standX = doorCenter + side * 124;
  const bellX = doorCenter + side * (DOOR_WIDTH / 2 + 16) - 15;
  const pose = side === 1 ? "bell-left" : "bell";

  return `<svg class="dv-corridor" viewBox="${HALL_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="복도의 문 세 개. ${targetUnit}호를 찾고 있어요.">` +
    HALL_DEFS +
    HALL_BASE +
    doors +
    (matched ? unitMatched(slot) : "") +
    // 초인종
    `<g filter="url(#dv-tiny)">` +
      `<rect x="${bellX}" y="${DOOR_TOP + 140}" width="30" height="44" rx="8" fill="${P.plate}" ` +
      `stroke="${P.plateEdge}" stroke-width="3"/>` +
      `<circle cx="${bellX + 15}" cy="${DOOR_TOP + 162}" r="8" fill="${P.goldEdge}"/>` +
      `<circle cx="${bellX + 15}" cy="${DOOR_TOP + 162}" r="12" fill="none" stroke="${P.goldEdge}" ` +
      `stroke-width="2.5" opacity="0.6"/></g>` +
    chirp(bellX + 4, DOOR_TOP + 128) +
    `<text x="${bellX + 15}" y="${DOOR_TOP + 112}" text-anchor="middle" font-size="20" ` +
      `font-weight="800" fill="${P.goldWarm}">딩동!</text>` +
    courier(standX, DOOR_TOP + 262, 0.94, pose) +
    // 말풍선은 초인종보다 위에 띄운다 — 아래로 내리면 누르는 손과 벨을 가린다.
    speech(
      standX - 125, DOOR_TOP + 20, 250, 52,
      textX => `<text x="${textX}" y="${DOOR_TOP + 55}" text-anchor="middle" font-size="24" ` +
        `font-weight="800" fill="${P.inkText}">택배 왔어요~!</text>`,
      { tail: "center" }
    ) +
    // 카트 + 남은 상자
    cart(150, 560, 190) +
    parcelBox(258, 500, 76, 56, null, P.cartonB) +
    parcelBox(160, 486, 92, 70, `${targetUnit}호`, P.cartonA) +
    `</svg>`;
}

/* ── STEP 4 · 선물 선택 ───────────────────────────────────────────── */

const TRAY_SLOTS = [436, 580, 724];
const TRAY_SIZE = 120;
const TRAY_TOP = 452;

function traySlot(x, item, position, picked) {
  const cx = x + TRAY_SIZE / 2;
  const badgeY = TRAY_TOP;
  const scale = picked ? 1.06 : 1;

  return (picked ? `<circle cx="${cx}" cy="${TRAY_TOP + 62}" r="94" fill="url(#dv-btnglow)"/>` : "") +
    `<g transform="translate(${cx} ${TRAY_TOP + 60}) scale(${scale}) translate(${-cx} ${-(TRAY_TOP + 60)})">` +
      `<g${picked ? ` filter="url(#dv-pickglow)"` : ` filter="url(#dv-tiny)"`}>` +
        `<rect x="${x}" y="${TRAY_TOP}" width="${TRAY_SIZE}" height="${TRAY_SIZE}" rx="14" ` +
        `fill="#FFFFFF" stroke="${picked ? P.gold : P.plateEdge}" stroke-width="${picked ? 4 : 3}"/></g>` +
      `<text x="${cx}" y="${TRAY_TOP + 78}" text-anchor="middle" font-size="58">${item.emoji}</text>` +
      `<text x="${cx}" y="${TRAY_TOP + 106}" text-anchor="middle" font-size="15" font-weight="800" ` +
        `fill="${P.ink}">${item.label}</text>` +
      `<circle cx="${cx}" cy="${badgeY}" r="18" fill="${picked ? P.goldSoft : "#F4F1E8"}" ` +
        `stroke="${picked ? P.goldEdge : "#BEB6A4"}" stroke-width="2.5"/>` +
      `<text x="${cx}" y="${badgeY + 9}" text-anchor="middle" font-size="24" font-weight="800" ` +
        `fill="${picked ? P.goldInk : P.inkText}">${position + 1}</text>` +
    `</g>`;
}

// 수취인의 생각 말풍선 — 구름 네 덩이 위에 기다리는 물건이 뜬다.
function thoughtBubble(cx, cy, emoji, tint) {
  return `<g>` +
    `<circle cx="${cx - 96}" cy="${cy + 94}" r="10" fill="#FFFFFF" stroke="${tint}" stroke-width="2.5"/>` +
    `<circle cx="${cx - 118}" cy="${cy + 120}" r="6" fill="#FFFFFF" stroke="${tint}" stroke-width="2.5"/>` +
    `<g filter="url(#dv-tiny)">` +
      `<g stroke="${tint}" stroke-width="3" fill="#FFFFFF">` +
        `<ellipse cx="${cx}" cy="${cy}" rx="88" ry="62"/>` +
        `<circle cx="${cx - 58}" cy="${cy - 40}" r="30"/>` +
        `<circle cx="${cx + 6}" cy="${cy - 56}" r="34"/>` +
        `<circle cx="${cx + 66}" cy="${cy - 32}" r="28"/></g>` +
      `<g fill="#FFFFFF">` +
        `<ellipse cx="${cx}" cy="${cy}" rx="85" ry="59"/>` +
        `<circle cx="${cx - 58}" cy="${cy - 40}" r="27"/>` +
        `<circle cx="${cx + 6}" cy="${cy - 56}" r="31"/>` +
        `<circle cx="${cx + 66}" cy="${cy - 32}" r="25"/></g></g>` +
    `<circle cx="${cx}" cy="${cy - 6}" r="46" fill="${P.halo}"/>` +
    `<text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="56">${emoji}</text></g>`;
}

export function handoverSvg({ tray = [], focus = 0, wanted = null, unit = 0, friend = null }) {
  const index = Math.max(0, Math.min(tray.length - 1, focus));
  const tint = friend?.color ?? P.mutter;
  const item = wanted ?? tray[0] ?? { label: "선물", emoji: "🎁" };

  const doorX = 530;
  const doorY = 120;
  const doorWidth = 220;
  const doorHeight = 344;

  const floor = Math.floor(unit / 100);
  const neighbours = [1, 2, 3].map(room => floor * 100 + room).filter(other => other !== unit);

  const slots = tray
    .map((entry, position) => traySlot(TRAY_SLOTS[position] ?? TRAY_SLOTS[0], entry, position, position === index))
    .join("");

  return `<svg class="dv-handover" viewBox="${HALL_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="${unit}호 문이 열렸어요. 친구가 기다리는 선물을 고르세요.">` +
    HALL_DEFS +
    HALL_BASE +
    // 이웃 문 둘 — 같은 층의 나머지 두 호수다.
    closedDoor(DOOR_SLOTS[0], neighbours[0], false) +
    closedDoor(DOOR_SLOTS[2], neighbours[1], false) +
    // 열린 문
    `<ellipse cx="640" cy="330" rx="330" ry="280" fill="url(#dv-doorglow)"/>` +
    `<rect x="${doorX}" y="${doorY}" width="${doorWidth}" height="${doorHeight}" rx="8" ` +
      `fill="#E8D9B6" stroke="#D2BE92" stroke-width="5"/>` +
    `<rect x="${doorX + 14}" y="${doorY + 14}" width="${doorWidth - 28}" height="${doorHeight - 18}" ` +
      `rx="6" fill="url(#dv-doorlight)"/>` +
    `<g filter="url(#dv-tiny)">` +
      `<path d="M${doorX + 206} ${doorY + 14} L${doorX + 290} ${doorY + 44} L${doorX + 290} ${doorY + 374} ` +
      `L${doorX + 206} ${doorY + 340} Z" fill="${P.coralDoor}" stroke="${P.coralDoorEdge}" ` +
      `stroke-width="5" stroke-linejoin="round"/>` +
      `<circle cx="${doorX + 226}" cy="${doorY + 192}" r="8" fill="#B35F44"/></g>` +
    `<g filter="url(#dv-tiny)"><rect x="576" y="62" width="128" height="48" rx="12" fill="#FFF9E6" ` +
      `stroke="${P.gold}" stroke-width="4"/></g>` +
    `<text x="640" y="98" text-anchor="middle" font-size="30" font-weight="800" ` +
      `fill="${P.goldDeep}">${unit}</text>` +
    // 수취인 — 5번 게임과 같은 공식 넘버블럭스 에셋을 문간 바닥에 세운다.
    standingCharacterSvg({ number: friendNumberFor(unit), cx: 640, baseY: 466, width: 128 }) +
    // 생각 말풍선 + 시선 유도
    thoughtBubble(870, 118, item.emoji, tint) +
    `<path d="M900 214 Q930 380 700 452" fill="none" stroke="${tint}" stroke-width="3.5" ` +
      `stroke-dasharray="1 12" stroke-linecap="round"/>` +
    speech(
      146, 232, 320, 54,
      cx => `<text x="${cx}" y="${267}" text-anchor="middle" font-size="21" font-weight="800" ` +
        `fill="${P.inkText}">나는 ${item.label}를 기다리고 있었어!</text>`,
      { edge: tint, tail: "right" }
    ) +
    // 카트 트레이 3택
    cart(428, 572, 424) +
    slots +
    courier(300, 400, 0.9, "idle") +
    `</svg>`;
}
