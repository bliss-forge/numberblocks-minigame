// 피날레 — 목업 v3 씬 ⑥(mockups/v3/mockup-v3-6-finale.html)의 단지 전경 합창.
//
// 목업은 방문한 동에 3·5·7·9번 친구를 세우지만, 이 게임의 모델은 어느 친구에게
// 배달했는지를 기억하지 않는다(finale 은 delivered·stars·streak 만 남긴다).
// 그래서 배달한 수만큼 1번부터 세운다 — 다섯 번 배달했으면 다섯 친구가 서고,
// 세는 놀이가 마지막 화면에서 한 번 더 나온다. 동 이름은 붙이지 않는다:
// 이 게임은 처음부터 끝까지 "동"이 아니라 "호수"로만 말해 왔다.

import { standingCharacterSvg } from "./character-stage-art.mjs";

export const FINALE_VIEW_BOX = "0 0 1280 560";
export const FINALE_BACKDROP = "#FFD9A8";

const P = Object.freeze({
  plaza: "#E3DCCA",
  plazaLine: "#D2C9B2",
  silhouette: "#D9A88F",
  sun: "#FF9E5E",
  plate: "#FFFDF6",
  plateEdge: "#D9CDB2",
  gold: "#F5C531",
  goldWarm: "#E8A61E",
  star: "#FFD34D",
  coral: "#D95E41",
  garland: "#9DB3BF",
  window: "#BFDCEA",
  windowEdge: "#A9C6D6",
  lit: "#FFF3C9",
  litEdge: "#E8CE86",
  door: "#CBD8E2",
  doorEdge: "#B4C4D0",
});

// 세 동 미니어처 — 지도의 지붕 색 계열을 그대로 이어 받는다.
const BLOCKS = [
  { x: 296, y: 196, wall: "#F6EDD9", edge: "#E3D4B4", roof: "#EE8A6B" },
  { x: 542, y: 174, wall: "#EFF4DF", edge: "#D8DFBC", roof: "#7FB6A4" },
  { x: 788, y: 196, wall: "#EDEBF7", edge: "#D3CFE8", roof: "#8F9FD9" },
];

const BLOCK_WIDTH = 196;

function block({ x, y, wall, edge, roof }, litIndex) {
  const bottom = 432;
  const height = bottom - y;
  const windows = [
    { wx: x + 26, wy: y + 92 },
    { wx: x + 128, wy: y + 92 },
    { wx: x + 26, wy: y + 146 },
    { wx: x + 128, wy: y + 146 },
  ]
    .map((spot, index) => {
      const on = index === litIndex;
      return `<rect x="${spot.wx}" y="${spot.wy}" width="40" height="34" rx="5" ` +
        `fill="${on ? P.lit : P.window}" stroke="${on ? P.litEdge : P.windowEdge}" stroke-width="2.5"/>`;
    })
    .join("");

  return `<g filter="url(#dv-soft)">` +
      `<rect x="${x}" y="${y}" width="${BLOCK_WIDTH}" height="${height}" rx="10" fill="${wall}" ` +
      `stroke="${edge}" stroke-width="3"/></g>` +
    `<path d="M${x} ${y + 10} q0 -10 10 -10 h${BLOCK_WIDTH - 20} q10 0 10 10 v18 h-${BLOCK_WIDTH} z" ` +
      `fill="${roof}"/>` +
    windows +
    `<rect x="${x + 76}" y="${bottom - 62}" width="44" height="62" rx="6" fill="${P.door}" ` +
      `stroke="${P.doorEdge}" stroke-width="2.5"/>` +
    `<path d="M${x + 98} ${bottom - 62} v62" stroke="${P.doorEdge}" stroke-width="2"/>`;
}

function star(cx, cy, size) {
  return `<path transform="translate(${cx} ${cy}) scale(${size})" ` +
    `d="M0 -13 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4 z" fill="${P.star}"/>`;
}

const SKY_STARS = [
  [180, 250, 1.1], [260, 176, 0.85], [520, 128, 0.85], [760, 120, 0.7],
  [1030, 200, 1.1], [1120, 272, 0.85], [96, 352, 0.85], [1204, 396, 0.7],
  [420, 158, 0.7], [900, 148, 0.7],
]
  .map(([cx, cy, size]) => star(cx, cy, size))
  .join("");

const CONFETTI = [
  [230, 300, 24, "#FF8FA8"], [486, 206, -18, "#7CC9F0"], [694, 190, 30, "#A6DB7E"],
  [964, 250, -24, "#C7A6E8"], [1082, 334, 18, "#FFC96B"], [150, 430, -12, "#7CC9F0"],
  [560, 280, 40, "#FF8FA8"], [1180, 190, -32, "#A6DB7E"],
]
  .map(([x, y, angle, fill]) =>
    `<rect x="${x}" y="${y}" width="11" height="11" rx="2" fill="${fill}" ` +
    `transform="rotate(${angle} ${x + 5} ${y + 5})"/>`)
  .join("");

const GARLAND =
  `<path d="M30 118 Q335 236 640 180 Q945 236 1250 118" fill="none" stroke="${P.garland}" stroke-width="3"/>` +
  [
    [120, 150, "#FF8FA8", "#B34D66"], [226, 178, "#7CC9F0", "#3F7FA6"],
    [336, 196, "#A6DB7E", "#5F8A3C"], [448, 200, "#C7A6E8", "#7A5CA8"],
    [560, 192, "#FFC96B", "#B37A24"], [700, 192, "#FF8FA8", "#B34D66"],
    [812, 200, "#7CC9F0", "#3F7FA6"], [924, 196, "#A6DB7E", "#5F8A3C"],
    [1034, 178, "#C7A6E8", "#7A5CA8"], [1140, 150, "#FFC96B", "#B37A24"],
  ]
    .map(([x, y, fill, edge]) =>
      `<path d="M${x} ${y} l11 30 12 -27 z" fill="${fill}" stroke="${edge}" stroke-width="2"/>`)
    .join("");

// 배달을 받은 친구들 — 저장소의 실제 넘버블럭스 에셋을 번호 순으로 세운다.
function chorus(count) {
  const shown = Math.max(1, Math.min(5, count));
  const spread = 132;
  const startX = 640 - ((shown - 1) * spread) / 2;

    return Array.from({ length: shown }, (unused, index) => {
    const number = index + 1;
    const x = startX + index * spread;
    // 폭을 조금씩 키운다 — 번호가 커질수록 몸집도 커 보이게.
    return standingCharacterSvg({
      number,
      cx: x,
      baseY: 500,
      width: 62 + number * 7,
      className: "dv-chorus",
    });
  }).join("");
}

// 포장이가 광장 앞을 좌에서 우로 지나간다 — 목업의 마지막 컷.
function passingTruck() {
  return `<g transform="translate(36 424) scale(0.54)" filter="url(#dv-soft)">` +
    `<rect x="0" y="0" width="240" height="130" rx="16" fill="#FFC531" stroke="#E8A61E" stroke-width="4"/>` +
    `<rect x="0" y="0" width="240" height="30" rx="15" fill="#FFD766"/>` +
    `<rect x="38" y="44" width="52" height="52" rx="8" fill="#FFF6D9" stroke="#E8A61E" stroke-width="3"/>` +
    `<path d="M38 70 h52 M64 44 v26" stroke="#E8A61E" stroke-width="2.5"/>` +
    `<circle cx="57" cy="80" r="3.4" fill="#6B5433"/><circle cx="71" cy="80" r="3.4" fill="#6B5433"/>` +
    `<path d="M58 88 q6 5 12 0" stroke="#6B5433" stroke-width="2.5" fill="none" stroke-linecap="round"/>` +
    `<text x="162" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="#8A5A10">포장이</text>` +
    `<path d="M240 30 h84 q22 0 28 20 l10 34 q4 22 -18 24 h-104 z" fill="#FFC531" ` +
      `stroke="#E8A61E" stroke-width="4"/>` +
    `<path d="M252 40 h56 q14 0 18 13 l7 21 h-81 z" fill="#DDF1FB" stroke="#B9DCEC" stroke-width="3"/>` +
    `<circle cx="354" cy="78" r="12" fill="#FFF6D9" stroke="#E8A61E" stroke-width="3"/>` +
    `<circle cx="357" cy="78" r="5" fill="#39434C"/>` +
    `<path d="M338 98 q12 10 22 2" stroke="#B3541E" stroke-width="5" fill="none" stroke-linecap="round"/>` +
    `<circle cx="330" cy="88" r="6" fill="#FF9E8A" opacity="0.7"/>` +
    `<rect x="-8" y="124" width="376" height="16" rx="8" fill="#5B6472"/>` +
    `<circle cx="68" cy="140" r="26" fill="#39434C"/><circle cx="68" cy="140" r="11" fill="#C9D2DA"/>` +
    `<circle cx="240" cy="140" r="26" fill="#39434C"/><circle cx="240" cy="140" r="11" fill="#C9D2DA"/>` +
    `<circle cx="330" cy="140" r="26" fill="#39434C"/><circle cx="330" cy="140" r="11" fill="#C9D2DA"/>` +
    `</g>` +
    `<g stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" opacity="0.8">` +
      `<path d="M14 474 h60"/><path d="M2 502 h76"/></g>` +
    `<g filter="url(#dv-tiny)">` +
      `<path d="M196 372 q0 -14 14 -14 h84 q14 0 14 14 v22 q0 14 -14 14 h-20 l18 22 -44 -22 h-38 ` +
      `q-14 0 -14 -14 z" fill="#FFFFFF"/></g>` +
    `<text x="252" y="394" text-anchor="middle" font-size="24" font-weight="800" fill="#E86A50">빵빵!</text>`;
}

/**
 * @param {{delivered: number, stars: number, streak: number}} finale
 */
export function finaleSvg({ delivered = 5 } = {}) {
  return `<svg class="dv-finale-art" viewBox="${FINALE_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="단지 광장에서 친구들이 고맙다고 인사해요. 택배 ${delivered}개를 배달했어요.">` +
    `<defs>` +
    `<linearGradient id="dv-dusk" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#FFC28A"/><stop offset="1" stop-color="#FFE3B8"/></linearGradient>` +
    `<filter id="dv-soft" x="-20%" y="-20%" width="140%" height="140%">` +
    `<feDropShadow dx="0" dy="5" stdDeviation="7" flood-color="#26424E" flood-opacity="0.16"/></filter>` +
    `<filter id="dv-tiny" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#26424E" flood-opacity="0.18"/></filter>` +
    `</defs>` +
    `<rect width="1280" height="560" fill="url(#dv-dusk)"/>` +
    `<circle cx="164" cy="150" r="52" fill="${P.sun}" opacity="0.35"/>` +
    `<circle cx="164" cy="150" r="38" fill="${P.sun}"/>` +
    `<g fill="${P.silhouette}">` +
      `<rect x="-10" y="316" width="120" height="116" rx="6"/>` +
      `<rect x="96" y="350" width="86" height="82" rx="6"/>` +
      `<rect x="170" y="330" width="104" height="102" rx="6"/>` +
      `<rect x="1004" y="344" width="96" height="88" rx="6"/>` +
      `<rect x="1086" y="316" width="120" height="116" rx="6"/>` +
      `<rect x="1194" y="352" width="96" height="80" rx="6"/></g>` +
    `<rect x="0" y="432" width="1280" height="128" fill="${P.plaza}"/>` +
    `<path d="M0 432 h1280" stroke="${P.plazaLine}" stroke-width="3"/>` +
    `<g stroke="${P.plazaLine}" stroke-width="2.5" fill="none">` +
      `<path d="M0 488 h1280 M0 534 h1280"/>` +
      `<path d="M140 432 v56 M420 432 v56 M700 432 v56 M980 432 v56 M1240 432 v56"/>` +
      `<path d="M280 488 v46 M560 488 v46 M840 488 v46 M1120 488 v46"/></g>` +
    BLOCKS.map((entry, index) => block(entry, index)).join("") +
    GARLAND +
    SKY_STARS +
    CONFETTI +
    // 합창 배너
    `<g filter="url(#dv-soft)">` +
      `<rect x="286" y="26" width="708" height="70" rx="35" fill="${P.plate}" ` +
      `stroke="${P.gold}" stroke-width="5"/></g>` +
    `<text x="640" y="72" text-anchor="middle" font-size="32" font-weight="800" ` +
      `fill="${P.coral}">멋진 꼬마 택배기사님, 고마워요!</text>` +
    `<g stroke="${P.goldWarm}" stroke-width="3" fill="none" stroke-linecap="round">` +
      `<path d="M318 62 q-6 -10 2 -18"/><path d="M334 70 q-10 -14 -2 -28"/>` +
      `<path d="M962 62 q6 -10 -2 -18"/><path d="M946 70 q10 -14 2 -28"/></g>` +
    chorus(delivered) +
    passingTruck() +
    `</svg>`;
}
