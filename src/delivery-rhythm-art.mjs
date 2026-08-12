// 씬 ② 리듬 하역 — 목업 v3(mockups/v3/mockup-v3-2-rhythm.html)의 사이드뷰 무대.
//
// 동 정문 앞에 트럭 후면과 내려온 경사로가 서고, 바닥의 비트 마커 링이 박자를 센다.
// 기사님이 정박에 상자를 던지면 포물선을 그려 카트에 실린다.
// 사람·상자·카트는 건물 안 그림과 같은 부품을 쓴다 — 같은 기사님, 같은 상자다.

import {
  HALL_PALETTE as P,
  SHADOWS,
  cart,
  courier,
  parcelBox,
  star,
} from "./delivery-building-art.mjs";
import { BEATS_PER_BAR, BEAT_MS, GOOD_WINDOW_MS, PERFECT_WINDOW_MS } from "./delivery-rhythm.mjs";
import { standingCharacterSvg } from "./character-stage-art.mjs";

export const RHYTHM_VIEW_BOX = "0 0 1280 620";
export const RHYTHM_BACKDROP = "#EFF4DF";

const GROUND = 470; // 인도 윗선
const ROAD = 520; // 도로 윗선

/* ── 배경: 동 정문 파사드 ─────────────────────────────────────────── */

function facade(unit) {
  const windows = [];
  for (const x of [96, 256, 416, 576, 896, 1056]) {
    windows.push(
      `<rect x="${x}" y="42" width="60" height="52" rx="6" fill="#C6E0D2" ` +
      `stroke="#AECBB9" stroke-width="3"/>` +
      `<path d="M${x + 30} 42 v52 M${x} 68 h60" stroke="#AECBB9" stroke-width="2"/>`
    );
  }
  for (const x of [96, 416, 1056]) {
    windows.push(
      `<rect x="${x}" y="168" width="60" height="52" rx="6" fill="#C6E0D2" ` +
      `stroke="#AECBB9" stroke-width="3"/>` +
      `<path d="M${x + 30} 168 v52 M${x} 194 h60" stroke="#AECBB9" stroke-width="2"/>`
    );
  }

  // 점등 창 + 구경하는 미니 친구 — 실제 넘버블럭스 에셋.
  const lit =
    `<rect x="576" y="168" width="60" height="52" rx="6" fill="${P.goldSoft}" ` +
      `stroke="#E8CE86" stroke-width="3"/>` +
    standingCharacterSvg({ number: 3, cx: 606, baseY: 218, width: 30, className: "dv-window-friend" });

  return `<rect width="1280" height="${GROUND}" fill="${RHYTHM_BACKDROP}"/>` +
    `<g stroke="#D8DFBC" stroke-width="3" fill="none">` +
      `<path d="M0 130 h1280 M0 256 h1280 M0 382 h1280"/></g>` +
    windows.join("") +
    lit +
    // 정문: 캐노피 + 배너 + 유리문
    `<rect x="700" y="256" width="180" height="${GROUND - 256}" fill="${P.landing}" ` +
      `stroke="${P.landingEdge}" stroke-width="3"/>` +
    `<path d="M790 256 v${GROUND - 256} M700 324 h180 M700 392 h180" ` +
      `stroke="${P.landingEdge}" stroke-width="2.5"/>` +
    `<g filter="url(#dv-tiny)">` +
      `<path d="M686 256 h208 l-14 -32 h-180 z" fill="${P.teal}" stroke="#6BA491" stroke-width="3"/></g>` +
    `<g filter="url(#dv-tiny)"><rect x="712" y="174" width="156" height="40" rx="12" fill="${P.teal}"/></g>` +
    `<text x="790" y="202" text-anchor="middle" font-size="24" font-weight="800" ` +
      `fill="#FFFFFF">${unit}호 가는 길</text>` +
    // 화단
    `<rect x="932" y="424" width="228" height="46" rx="8" fill="#E3DCCA" ` +
      `stroke="#D2C9B2" stroke-width="2.5"/>` +
    `<circle cx="980" cy="422" r="21" fill="#8FCF6B"/><circle cx="1030" cy="416" r="25" fill="#A6DB7E"/>` +
    `<circle cx="1082" cy="422" r="21" fill="#8FCF6B"/>` +
    // 인도 + 도로
    `<rect x="0" y="${GROUND}" width="1280" height="${ROAD - GROUND}" fill="#E3DCCA"/>` +
    `<path d="M0 ${GROUND} h1280" stroke="#D2C9B2" stroke-width="3"/>` +
    `<g stroke="#D2C9B2" stroke-width="3">` +
      `<path d="M160 ${GROUND} v${ROAD - GROUND} M420 ${GROUND} v${ROAD - GROUND} ` +
      `M680 ${GROUND} v${ROAD - GROUND} M940 ${GROUND} v${ROAD - GROUND} ` +
      `M1200 ${GROUND} v${ROAD - GROUND}"/></g>` +
    `<rect x="0" y="${ROAD}" width="1280" height="${620 - ROAD}" fill="#606B78"/>` +
    `<path d="M0 ${ROAD} h1280" stroke="#F6F1E3" stroke-width="4" opacity="0.5"/>`;
}

/* ── 트럭 후면 + 경사로 ───────────────────────────────────────────── */

function truckRear() {
  return `<g filter="url(#dv-soft)">` +
    `<rect x="-60" y="286" width="360" height="220" rx="16" fill="#FFC531" ` +
      `stroke="#E8A61E" stroke-width="4"/>` +
    `<rect x="-60" y="286" width="360" height="26" rx="13" fill="#FFD766"/>` +
    `<rect x="30" y="348" width="50" height="50" rx="8" fill="#FFF6D9" stroke="#E8A61E" stroke-width="3"/>` +
    `<path d="M30 373 h50 M55 348 v25" stroke="#E8A61E" stroke-width="2.5"/>` +
    `<circle cx="48" cy="384" r="3.2" fill="#6B5433"/><circle cx="62" cy="384" r="3.2" fill="#6B5433"/>` +
    `<path d="M49 392 q6 5 12 0" stroke="#6B5433" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
    `<text x="176" y="388" text-anchor="middle" font-size="28" font-weight="800" fill="#8A5A10">포장이</text>` +
    `<path d="M286 296 v200" stroke="#E8A61E" stroke-width="3.5"/>` +
    `<rect x="-60" y="506" width="360" height="16" rx="8" fill="${P.boot}"/>` +
    `<circle cx="222" cy="548" r="26" fill="${P.metalDark}"/>` +
    `<circle cx="222" cy="548" r="11" fill="${P.hub}"/>` +
    `<circle cx="42" cy="548" r="26" fill="${P.metalDark}"/>` +
    `<circle cx="42" cy="548" r="11" fill="${P.hub}"/></g>` +
    // 경사로
    `<g filter="url(#dv-tiny)">` +
      `<path d="M300 494 L556 560 L550 574 L296 506 Z" fill="#FFD766" stroke="#E8A61E" ` +
      `stroke-width="3.5" stroke-linejoin="round"/>` +
      `<path d="M360 511 l-4 12 M424 528 l-4 12 M488 545 l-4 12" stroke="#E8A61E" ` +
      `stroke-width="3" stroke-linecap="round"/></g>`;
}

/* ── 비트 마커 링 · 비트 칩 ───────────────────────────────────────── */

// ── 박자 막대 ─────────────────────────────────────────────────────
// ---[ ● ]--- 표시가 이 화면의 전부다. 구슬이 괄호 한가운데 올 때 Space.
//
// 구슬은 한 박(750ms)에 막대를 왼쪽 끝에서 오른쪽 끝까지 가로지르고,
// 애니메이션을 반 박 당겨 시작해(animation-delay: -375ms) 정박마다 정확히
// 한가운데를 지난다. 무대는 박마다 다시 그려지므로 위상이 다시 맞춰진다.
const TRACK_CX = 640;
const TRACK_HALF = 280; // 한 박에 가로지르는 거리의 절반
// 파사드 한가운데 빈 벽 위에 띄운다 — 바닥에 두면 트럭·카트·기사님에 묻힌다.
const TRACK_Y = 286;

// 시간을 거리로 바꾼다 — 판정 창이 막대 위 어디까지인지 그림이 정직하게 말한다.
function windowHalfWidth(windowMs) {
  return (windowMs / BEAT_MS) * TRACK_HALF * 2;
}

function beatTrack() {
  const goodHalf = windowHalfWidth(GOOD_WINDOW_MS);
  const perfectHalf = windowHalfWidth(PERFECT_WINDOW_MS);
  const left = TRACK_CX - TRACK_HALF;
  const right = TRACK_CX + TRACK_HALF;

  return `<g class="dv-beat-track">` +
    // 받침 카드 — 도로 위에서도 또렷하게 보이도록.
    `<g filter="url(#dv-soft)">` +
      `<rect x="${left - 40}" y="${TRACK_Y - 44}" width="${TRACK_HALF * 2 + 80}" height="88" ` +
      `rx="26" fill="#FFFFFF" opacity="0.97"/></g>` +
    // --- 막대 ---
    `<path d="M${left} ${TRACK_Y} H${right}" stroke="#D9CDB2" stroke-width="10" ` +
      `stroke-linecap="round"/>` +
    // 좋아요 구간(넓은 띠)
    `<rect x="${TRACK_CX - goodHalf}" y="${TRACK_Y - 15}" width="${goodHalf * 2}" height="30" ` +
      `rx="15" fill="${P.goldSoft}"/>` +
    // 딱! 구간 = 대괄호
    `<rect x="${TRACK_CX - perfectHalf}" y="${TRACK_Y - 22}" width="${perfectHalf * 2}" height="44" ` +
      `rx="10" fill="#FFFFFF" stroke="${P.gold}" stroke-width="5"/>` +
    `<path d="M${TRACK_CX - perfectHalf + 12} ${TRACK_Y - 22} h-12 v44 h12" fill="none" ` +
      `stroke="${P.goldEdge}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M${TRACK_CX + perfectHalf - 12} ${TRACK_Y - 22} h12 v44 h-12" fill="none" ` +
      `stroke="${P.goldEdge}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` +
    // 한가운데 눈금
    `<path d="M${TRACK_CX} ${TRACK_Y - 16} v32" stroke="${P.goldEdge}" stroke-width="3" ` +
      `stroke-linecap="round" opacity="0.7"/>` +
    // 달리는 구슬
    `<g class="dv-beat-marker">` +
      `<circle cx="${TRACK_CX}" cy="${TRACK_Y}" r="20" fill="${P.coral}" stroke="#FFFFFF" ` +
      `stroke-width="4"/>` +
      `<circle cx="${TRACK_CX - 6}" cy="${TRACK_Y - 7}" r="6" fill="#FFFFFF" opacity="0.75"/></g>` +
    `</g>`;
}

function beatChips(beat) {
  const chips = [];
  for (let index = 0; index < BEATS_PER_BAR; index += 1) {
    const on = index === beat;
    const cx = 544 + index * 54;
    chips.push(
      `<circle class="dv-beat-chip" cx="${cx}" cy="52" r="${on ? 15 : 11}" ` +
      `fill="${on ? "#FFE08A" : "#F4F1E8"}" stroke="${on ? P.goldEdge : "#BEB6A4"}" ` +
      `stroke-width="${on ? 3 : 2.5}"/>`
    );
  }
  return `<g filter="url(#dv-tiny)"><rect x="492" y="24" width="296" height="56" rx="18" ` +
    `fill="#FFFFFF" opacity="0.97"/></g>` +
    chips.join("") +
    `<path d="M744 62 v-20 l12 -4 v20" stroke="${P.goldWarm}" stroke-width="3" fill="none" ` +
      `stroke-linejoin="round"/>` +
    `<circle cx="741" cy="62" r="4.5" fill="${P.goldWarm}"/>` +
    `<circle cx="753" cy="58" r="4.5" fill="${P.goldWarm}"/>`;
}

/* ── 판정 연출 ────────────────────────────────────────────────────── */

const JUDGE_TEXT = {
  perfect: { text: "박자 딱!", fill: P.coral },
  good: { text: "좋아요!", fill: "#4A7A6A" },
  miss: { text: "다시 한 번!", fill: P.inkText },
};

function passArc(unit) {
  return `<path d="M604 486 Q783 372 962 460" fill="none" stroke="${P.star}" stroke-width="4" ` +
      `stroke-dasharray="3 14" stroke-linecap="round" opacity="0.9"/>` +
    `<g transform="translate(768 418) rotate(-7)" filter="url(#dv-tiny)">` +
      parcelBox(-43, -29, 86, 58, `${unit}호`, P.cartonA) + `</g>` +
    `<g>` + star(690, 400, 1) + star(846, 398, 1) + star(768, 366, 0.8) +
      star(700, 458, 0.75) + star(838, 456, 0.75) + `</g>`;
}

function judgeBubble(judge) {
  const mark = JUDGE_TEXT[judge];
  if (!mark) return "";
  return `<g filter="url(#dv-tiny)">` +
      `<rect x="1010" y="132" width="200" height="58" rx="20" fill="#FFFFFF"/>` +
      `<path d="M1052 188 L1086 188 L1058 212 Z" fill="#FFFFFF"/></g>` +
    `<text class="dv-judge" x="1110" y="170" text-anchor="middle" font-size="26" ` +
      `font-weight="800" fill="${mark.fill}">${mark.text}</text>`;
}

/* ── 무대 ─────────────────────────────────────────────────────────── */

/**
 * @param {{unit:number, loaded:number, target:number, beat:number, judge:string|null}} view
 */
export function rhythmStageSvg({ unit = 0, loaded = 0, target = 3, beat = 0, judge = null } = {}) {
  // 카트에 실린 상자는 왼쪽부터 쌓인다 — 하나 실릴 때마다 눈에 보이게 는다.
  const stacked = Array.from({ length: loaded }, (unused, index) =>
    parcelBox(920 + index * 76, 452 - (index % 2) * 6, 68, 54, null,
      index % 2 === 0 ? P.cartonA : P.cartonB)
  ).join("");

  const remaining = Math.max(0, target - loaded);
  const onRamp = remaining > 0
    ? `<g transform="translate(408 508) rotate(15)" filter="url(#dv-tiny)">` +
      parcelBox(-38, -26, 76, 52, `${unit}호`, P.cartonB) + `</g>`
    : "";

  return `<svg class="dv-rhythm" viewBox="${RHYTHM_VIEW_BOX}" preserveAspectRatio="xMidYMid meet" ` +
    `xmlns="http://www.w3.org/2000/svg" role="img" ` +
    `aria-label="박자에 맞춰 상자를 내려요. ${loaded} / ${target} 개 실었어요.">` +
    `<defs>${SHADOWS}</defs>` +
    facade(unit) +
    truckRear() +
    onRamp +
    beatTrack() +
    (judge && judge !== "miss" ? passArc(unit) : "") +
    courier(628, 468, 0.92, judge === "miss" ? "idle" : "cheer") +
    cart(898, 508, 260) +
    stacked +
    beatChips(beat) +
    judgeBubble(judge) +
    `</svg>`;
}
