// 알록달록 물감 놀이 — 씬 렌더러. 상태의 읽기 전용 프로젝션.
// 갱신은 재렌더 + replaceChildren(지하철 씬 문법). 연출(붓기·소용돌이·채색
// 차오름·헹굼)은 새로 삽입된 노드에서 시작되는 CSS keyframe이 담당한다.
// 그림은 코드 SVG만 사용(신규 이미지 자산 0) — 칠해질 면은 --pp-fill 변수 fill.

import {
  PAINT_COLORS,
  PAINT_SUBJECTS,
  RAINBOW_COUNT,
  josa
} from "./paint-play-data.mjs";
import {
  currentRound,
  currentSubject,
  equationFor,
  jarColor,
  recipeFor,
  shelfTubes,
  slotKeyDigit
} from "./paint-play.mjs";

function el(document, tag, className, text = null) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== null) node.textContent = text;
  return node;
}

const OUTLINE = "#b9c4d2";   // 회색 윤곽선
const PRIMER = "#eef2f7";    // 초벌(미채색) 면
const DETAIL = "#8d99a8";    // 세부선(창틀·눈 등 — 회색/채색 양쪽에서 읽힘)

// ── 그림 주제 SVG — viewBox 0 0 280 240, 칠해질 면은 pp-fillable ─────────
// 면 fill은 var(--pp-fill)이라 채색 시 CSS 변수 하나로 전체가 차오른다.

const FILL = `fill="var(--pp-fill, ${PRIMER})" stroke="${OUTLINE}" ` +
  `stroke-width="5" stroke-dasharray="12 8" class="pp-fillable"`;

const SUBJECT_ART = {
  firetruck: `
    <rect x="30" y="96" width="140" height="80" rx="10" ${FILL}/>
    <path d="M170 176 L170 108 L216 108 C236 120 246 138 248 176z" ${FILL}/>
    <rect x="46" y="70" width="110" height="14" rx="7" ${FILL}/>
    <rect x="184" y="120" width="34" height="26" rx="5" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <line x1="58" y1="77" x2="144" y2="77" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="80" cy="184" r="24" fill="#3a4152"/><circle cx="80" cy="184" r="10" fill="#c8ccd4"/>
    <circle cx="196" cy="184" r="24" fill="#3a4152"/><circle cx="196" cy="184" r="10" fill="#c8ccd4"/>`,
  chick: `
    <path d="M140 44 C196 44 226 86 226 132 C226 182 188 208 140 208 C92 208 54 182 54 132 C54 86 84 44 140 44z" ${FILL}/>
    <path d="M226 118 L256 130 L226 144z" fill="#ff8a3d" stroke="#e8763a" stroke-width="4"/>
    <circle cx="176" cy="108" r="9" fill="#31445b"/>
    <path d="M112 208 L112 226 M132 208 L132 226" stroke="#ff8a3d" stroke-width="6" stroke-linecap="round"/>`,
  bus: `
    <rect x="28" y="64" width="224" height="118" rx="20" ${FILL}/>
    <rect x="48" y="86" width="44" height="38" rx="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <rect x="106" y="86" width="44" height="38" rx="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <rect x="164" y="86" width="44" height="38" rx="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <line x1="36" y1="146" x2="244" y2="146" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="84" cy="188" r="22" fill="#3a4152"/><circle cx="84" cy="188" r="9" fill="#c8ccd4"/>
    <circle cx="196" cy="188" r="22" fill="#3a4152"/><circle cx="196" cy="188" r="9" fill="#c8ccd4"/>`,
  carrot: `
    <path d="M96 92 C120 66 176 66 200 92 C224 116 216 158 178 196 C160 214 136 214 120 196 C84 158 74 116 96 92z"
      transform="rotate(38 148 150)" ${FILL}/>
    <path d="M186 58 C196 38 216 32 232 36 C226 52 210 64 194 66z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>
    <path d="M206 70 C222 58 244 58 258 66 C248 80 228 86 212 82z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>`,
  car: `
    <path d="M30 158 C28 138 36 126 58 122 L84 96 C92 86 104 82 116 82 L186 82 C200 82 210 88 218 98 L238 122 C260 126 268 136 266 154 C265 164 258 170 248 170 L48 170 C38 170 31 166 30 158z" ${FILL}/>
    <path d="M92 96 L112 88 L142 88 L142 118 L84 118z" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <path d="M152 88 L184 88 C194 88 200 92 206 100 L214 118 L152 118z" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="86" cy="176" r="22" fill="#3a4152"/><circle cx="86" cy="176" r="9" fill="#c8ccd4"/>
    <circle cx="210" cy="176" r="22" fill="#3a4152"/><circle cx="210" cy="176" r="9" fill="#c8ccd4"/>`,
  frog: `
    <path d="M140 74 C202 74 238 116 238 158 C238 194 196 212 140 212 C84 212 42 194 42 158 C42 116 78 74 140 74z" ${FILL}/>
    <circle cx="96" cy="74" r="26" ${FILL}/>
    <circle cx="184" cy="74" r="26" ${FILL}/>
    <circle cx="96" cy="72" r="10" fill="#31445b"/>
    <circle cx="184" cy="72" r="10" fill="#31445b"/>
    <path d="M104 158 C124 174 156 174 176 158" fill="none" stroke="#31445b" stroke-width="6" stroke-linecap="round"/>`,
  tractor: `
    <path d="M132 150 L132 92 C132 82 140 76 150 76 L190 76 C200 76 206 82 208 92 L216 150z" ${FILL}/>
    <path d="M40 150 C40 130 56 116 76 116 L216 116 L226 150 L226 168 L40 168z" ${FILL}/>
    <rect x="146" y="88" width="44" height="34" rx="6" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <rect x="60" y="84" width="12" height="34" rx="5" ${FILL}/>
    <circle cx="86" cy="176" r="34" fill="#3a4152"/><circle cx="86" cy="176" r="15" fill="#c8ccd4"/>
    <circle cx="204" cy="184" r="24" fill="#3a4152"/><circle cx="204" cy="184" r="10" fill="#c8ccd4"/>`,
  grape: `
    <circle cx="106" cy="106" r="30" ${FILL}/>
    <circle cx="174" cy="106" r="30" ${FILL}/>
    <circle cx="72" cy="150" r="30" ${FILL}/>
    <circle cx="140" cy="150" r="30" ${FILL}/>
    <circle cx="208" cy="150" r="30" ${FILL}/>
    <circle cx="106" cy="194" r="30" ${FILL}/>
    <circle cx="174" cy="194" r="30" ${FILL}/>
    <path d="M140 76 C140 56 148 44 162 36" fill="none" stroke="#8a6a48" stroke-width="7" stroke-linecap="round"/>
    <path d="M162 40 C182 30 202 34 212 46 C198 58 178 58 164 50z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>`,
  heli: `
    <path d="M74 128 C74 100 100 82 138 82 C182 82 210 104 210 132 C210 156 188 170 154 170 L112 170 C88 170 74 152 74 128z" ${FILL}/>
    <path d="M74 128 L30 116 L30 104 L80 112z" ${FILL}/>
    <rect x="128" y="46" width="12" height="30" rx="5" ${FILL}/>
    <line x1="44" y1="46" x2="224" y2="46" stroke="#3a4152" stroke-width="8" stroke-linecap="round"/>
    <path d="M148 96 L192 96 C202 102 206 112 206 122 L148 122z" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <path d="M96 184 L200 184 M110 170 L110 184 M182 170 L182 184" stroke="#3a4152" stroke-width="7" stroke-linecap="round" fill="none"/>`,
  blossom: `
    <circle cx="140" cy="76" r="34" ${FILL}/>
    <circle cx="204" cy="122" r="34" ${FILL}/>
    <circle cx="180" cy="196" r="34" ${FILL}/>
    <circle cx="100" cy="196" r="34" ${FILL}/>
    <circle cx="76" cy="122" r="34" ${FILL}/>
    <circle cx="140" cy="140" r="26" fill="#ffe07a" stroke="#e8b93a" stroke-width="4"/>`,
  boat: `
    <path d="M40 168 L240 168 L208 212 L72 212z" ${FILL}/>
    <path d="M140 44 L140 160" stroke="#8a6a48" stroke-width="8" stroke-linecap="round"/>
    <path d="M152 56 C196 72 216 108 218 152 L152 152z" ${FILL}/>
    <path d="M128 68 L128 148 L70 148 C76 112 96 84 128 68z" ${FILL}/>`,
  bear: `
    <circle cx="82" cy="72" r="30" ${FILL}/>
    <circle cx="198" cy="72" r="30" ${FILL}/>
    <path d="M140 52 C204 52 236 96 236 142 C236 190 196 214 140 214 C84 214 44 190 44 142 C44 96 76 52 140 52z" ${FILL}/>
    <ellipse cx="140" cy="164" rx="44" ry="34" fill="#f6efe6" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="112" cy="118" r="10" fill="#31445b"/>
    <circle cx="168" cy="118" r="10" fill="#31445b"/>
    <ellipse cx="140" cy="152" rx="13" ry="10" fill="#31445b"/>`,
  rocket: `
    <path d="M140 30 C176 58 190 100 190 146 L190 176 L90 176 L90 146 C90 100 104 58 140 30z" ${FILL}/>
    <path d="M90 140 L54 182 L90 182z" ${FILL}/>
    <path d="M190 140 L226 182 L190 182z" ${FILL}/>
    <circle cx="140" cy="112" r="24" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="5"/>
    <path d="M124 186 C130 206 150 206 156 186 C152 216 128 216 124 186z" fill="#ffb15c" stroke="#e8763a" stroke-width="4"/>
    <circle cx="52" cy="60" r="5" fill="#f4c542"/><circle cx="232" cy="88" r="5" fill="#f4c542"/><circle cx="224" cy="44" r="4" fill="#f4c542"/>`,
  strawberry: `
    <path d="M140 64 C186 64 218 86 218 118 C218 162 182 204 140 214 C98 204 62 162 62 118 C62 86 94 64 140 64z" ${FILL}/>
    <path d="M104 52 C114 38 126 32 140 32 C154 32 166 38 176 52 C164 62 152 66 140 66 C128 66 116 62 104 52z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>
    <ellipse cx="110" cy="112" rx="5" ry="7" fill="${DETAIL}"/>
    <ellipse cx="170" cy="112" rx="5" ry="7" fill="${DETAIL}"/>
    <ellipse cx="140" cy="146" rx="5" ry="7" fill="${DETAIL}"/>
    <ellipse cx="112" cy="172" rx="5" ry="7" fill="${DETAIL}"/>
    <ellipse cx="168" cy="172" rx="5" ry="7" fill="${DETAIL}"/>`,
  banana: `
    <path d="M52 92 C62 152 116 192 186 192 C210 192 228 186 240 174 C234 204 192 226 152 226 C92 226 42 178 38 118 C38 106 42 98 52 92z" ${FILL}/>
    <path d="M40 86 L56 80 L62 96 L46 104z" fill="#8a6a48" stroke="#6f5237" stroke-width="4"/>
    <path d="M238 172 L254 166 L258 182 L244 188z" fill="#8a6a48" stroke="#6f5237" stroke-width="4"/>`,
  whale: `
    <path d="M48 132 C48 96 88 74 140 74 C192 74 226 100 230 134 C231 146 228 156 222 164 L60 164 C52 154 48 144 48 132z" ${FILL}/>
    <path d="M222 148 C238 134 250 132 260 136 C256 148 248 156 238 162 C248 166 254 174 256 184 C244 186 232 182 222 172z" ${FILL}/>
    <path d="M88 66 C82 50 84 38 92 28" stroke="#8fd0f8" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M100 66 C102 50 100 38 92 28" stroke="#8fd0f8" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="94" cy="116" r="8" fill="#31445b"/>
    <path d="M106 142 C118 152 138 152 150 142" fill="none" stroke="#31445b" stroke-width="6" stroke-linecap="round"/>`,
  crow: `
    <ellipse cx="146" cy="146" rx="76" ry="52" ${FILL}/>
    <circle cx="90" cy="98" r="38" ${FILL}/>
    <path d="M196 132 C226 138 244 158 248 182 C232 176 214 168 200 162z" ${FILL}/>
    <path d="M120 156 C150 142 184 142 208 152 C186 172 150 176 124 168z" ${FILL}/>
    <path d="M54 92 L18 100 L54 112z" fill="#ffb15c" stroke="#e8763a" stroke-width="4"/>
    <circle cx="82" cy="88" r="9" fill="#f6f8fc" stroke="${DETAIL}" stroke-width="3"/>
    <circle cx="82" cy="88" r="4" fill="#31445b"/>
    <path d="M112 192 L104 222 M128 194 L124 224" stroke="#ffb15c" stroke-width="7" stroke-linecap="round"/>
    <path d="M96 222 L118 222 M116 224 L136 224" stroke="#ffb15c" stroke-width="6" stroke-linecap="round"/>`,
  // 하양은 흰 도화지에서 안 보인다 — SVG 안에 하늘·눈밭을 고정색으로 깔아
  // 칠해진 면이 대비로 드러나게 한다(다른 그림과 달리 배경이 있는 이유).
  snowman: `
    <rect x="8" y="10" width="264" height="220" rx="16" fill="#bfe2f7"/>
    <path d="M8 196 C70 178 132 186 190 198 C222 204 252 206 272 202 L272 230 L8 230z" fill="#e8f4fb"/>
    <circle cx="140" cy="170" r="54" ${FILL}/>
    <circle cx="140" cy="104" r="38" ${FILL}/>
    <circle cx="140" cy="52" r="27" ${FILL}/>
    <path d="M113 40 L167 40 L167 30 L113 30z" fill="#3a4152"/>
    <path d="M120 30 L160 30 L160 12 L120 12z" fill="#3a4152"/>
    <circle cx="131" cy="48" r="5" fill="#31445b"/>
    <circle cx="151" cy="48" r="5" fill="#31445b"/>
    <path d="M140 56 L162 62 L140 68z" fill="#ff8a3d" stroke="#e8763a" stroke-width="3"/>
    <circle cx="140" cy="96" r="6" fill="#31445b"/>
    <circle cx="140" cy="118" r="6" fill="#31445b"/>
    <path d="M102 104 L58 88" stroke="#8a6a48" stroke-width="7" stroke-linecap="round"/>
    <path d="M178 104 L222 88" stroke="#8a6a48" stroke-width="7" stroke-linecap="round"/>`,
  tangerine: `
    <circle cx="140" cy="146" r="74" ${FILL}/>
    <path d="M140 66 C138 52 130 44 118 40" stroke="#8a6a48" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M146 58 C162 42 184 40 198 50 C188 64 168 68 152 62z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>`,
  plane: `
    <path d="M34 132 C52 114 92 104 148 104 L214 104 C238 104 252 114 250 128 C248 142 234 152 210 152 L72 152 C50 152 38 144 34 132z" ${FILL}/>
    <path d="M202 104 L224 62 L248 62 L232 106z" ${FILL}/>
    <path d="M120 122 L64 172 L96 178 L156 132z" ${FILL}/>
    <path d="M226 112 C238 112 246 118 246 126 L222 126z" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="104" cy="120" r="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="3"/>
    <circle cx="132" cy="120" r="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="3"/>
    <circle cx="160" cy="120" r="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="3"/>`,
  submarine: `
    <ellipse cx="136" cy="152" rx="102" ry="50" ${FILL}/>
    <rect x="108" y="70" width="56" height="46" rx="10" ${FILL}/>
    <path d="M120 70 L120 46 L148 46" stroke="#3a4152" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M238 134 L262 118 L262 186 L238 170z" fill="#c8ccd4" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="92" cy="152" r="13" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="136" cy="154" r="13" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="180" cy="152" r="13" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="226" cy="66" r="6" fill="#8fd0f8"/><circle cx="244" cy="46" r="5" fill="#8fd0f8"/><circle cx="256" cy="70" r="4" fill="#8fd0f8"/>`,
  pig: `
    <circle cx="140" cy="142" r="84" ${FILL}/>
    <path d="M78 88 L62 46 L106 62z" ${FILL}/>
    <path d="M202 88 L218 46 L174 62z" ${FILL}/>
    <ellipse cx="140" cy="160" rx="34" ry="25" fill="#ffd3df" stroke="#e8a3b8" stroke-width="4"/>
    <ellipse cx="128" cy="160" rx="6" ry="8" fill="#b06a80"/>
    <ellipse cx="152" cy="160" rx="6" ry="8" fill="#b06a80"/>
    <circle cx="110" cy="120" r="9" fill="#31445b"/>
    <circle cx="170" cy="120" r="9" fill="#31445b"/>`,
  peach: `
    <path d="M140 72 C190 72 220 106 220 146 C220 186 184 212 140 212 C96 212 60 186 60 146 C60 106 90 72 140 72z" ${FILL}/>
    <path d="M140 76 C132 102 132 132 140 160" stroke="${DETAIL}" stroke-width="4" fill="none"/>
    <path d="M140 70 C138 58 132 50 122 44" stroke="#8a6a48" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M144 62 C158 46 178 42 194 50 C184 64 166 70 150 66z" fill="#cfe3c8" stroke="#9fb89f" stroke-width="4"/>`,
  caterpillar: `
    <circle cx="64" cy="140" r="36" ${FILL}/>
    <circle cx="116" cy="158" r="30" ${FILL}/>
    <circle cx="164" cy="166" r="30" ${FILL}/>
    <circle cx="210" cy="172" r="28" ${FILL}/>
    <path d="M52 106 C46 92 48 80 56 70" stroke="#31445b" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M78 104 C82 90 90 80 100 74" stroke="#31445b" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="56" cy="134" r="6" fill="#31445b"/>
    <circle cx="78" cy="134" r="6" fill="#31445b"/>
    <path d="M56 152 C62 158 72 158 78 152" fill="none" stroke="#31445b" stroke-width="5" stroke-linecap="round"/>`,
  butterfly: `
    <ellipse cx="84" cy="94" rx="48" ry="40" transform="rotate(-18 84 94)" ${FILL}/>
    <ellipse cx="196" cy="94" rx="48" ry="40" transform="rotate(18 196 94)" ${FILL}/>
    <ellipse cx="96" cy="168" rx="36" ry="30" transform="rotate(14 96 168)" ${FILL}/>
    <ellipse cx="184" cy="168" rx="36" ry="30" transform="rotate(-14 184 168)" ${FILL}/>
    <ellipse cx="140" cy="132" rx="12" ry="52" fill="#3a4152"/>
    <path d="M132 84 C126 66 116 54 102 48" stroke="#3a4152" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M148 84 C154 66 164 54 178 48" stroke="#3a4152" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  acorn: `
    <path d="M84 118 L196 118 C196 164 172 200 140 210 C108 200 84 164 84 118z" ${FILL}/>
    <path d="M78 118 C74 82 102 54 140 54 C178 54 206 82 202 118z" ${FILL}/>
    <path d="M102 78 C126 66 154 66 178 78" stroke="${DETAIL}" stroke-width="4" fill="none"/>
    <path d="M140 54 C138 44 132 38 124 34" stroke="#8a6a48" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="140" cy="204" r="6" fill="#8a6a48"/>`,
  pine: `
    <path d="M140 28 L198 104 L82 104z" ${FILL}/>
    <path d="M140 74 L212 160 L68 160z" ${FILL}/>
    <path d="M140 124 L226 214 L54 214z" ${FILL}/>
    <rect x="124" y="214" width="32" height="22" fill="#8a6a48"/>`,
  eggplant: `
    <ellipse cx="150" cy="150" rx="88" ry="60" transform="rotate(32 150 150)" ${FILL}/>
    <path d="M88 96 C76 80 74 64 80 50 C96 56 108 68 114 84 C122 76 134 72 146 74 C138 88 124 98 108 100z" fill="#4f7a4f" stroke="#3d5f3d" stroke-width="4"/>
    <path d="M84 92 C74 80 70 68 72 54" stroke="#4f7a4f" stroke-width="7" fill="none" stroke-linecap="round"/>`,
  // 4색 혼합(스테이지 6). 겹쳐 쌓는 그림은 그리는 순서가 곧 레이어라
  // 팔·다리를 몸통보다 먼저 둔다 — 안 그러면 점선 이음매가 몸을 가로지른다.
  sandcastle: `
    <path d="M16 210 C48 188 96 182 140 182 C184 182 232 188 264 210 C232 224 184 230 140 230 C96 230 48 224 16 210z" ${FILL}/>
    <path d="M40 202 L40 96 L58 96 L58 112 L78 112 L78 96 L96 96 L96 202z" ${FILL}/>
    <path d="M184 202 L184 96 L202 96 L202 112 L222 112 L222 96 L240 96 L240 202z" ${FILL}/>
    <path d="M96 202 L96 74 L114 74 L114 90 L131 90 L131 74 L149 74 L149 90 L166 90 L166 74 L184 74 L184 202z" ${FILL}/>
    <path d="M126 202 L126 166 C126 150 154 150 154 166 L154 202z" fill="#c8ccd4" stroke="${DETAIL}" stroke-width="4"/>
    <rect x="58" y="138" width="20" height="26" rx="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <rect x="202" y="138" width="20" height="26" rx="7" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <line x1="140" y1="90" x2="140" y2="36" stroke="#8a6a48" stroke-width="6" stroke-linecap="round"/>
    <path d="M144 40 L182 52 L144 64z" fill="#ff8a3d" stroke="#e8763a" stroke-width="4"/>
    <circle cx="56" cy="222" r="8" fill="#ffd3df" stroke="#e8a3b8" stroke-width="3"/>
    <circle cx="226" cy="220" r="6" fill="#8fd0f8" stroke="#6fb4e0" stroke-width="3"/>`,
  camel: `
    <path d="M166 154 C172 118 184 88 200 60 L228 70 C216 100 210 128 208 160z" ${FILL}/>
    <rect x="86" y="168" width="24" height="64" rx="12" ${FILL}/>
    <rect x="120" y="170" width="24" height="62" rx="12" ${FILL}/>
    <rect x="164" y="170" width="24" height="62" rx="12" ${FILL}/>
    <rect x="192" y="168" width="24" height="64" rx="12" ${FILL}/>
    <ellipse cx="136" cy="146" rx="78" ry="42" ${FILL}/>
    <path d="M84 118 C92 72 128 72 136 118z" ${FILL}/>
    <path d="M140 118 C148 76 182 76 190 118z" ${FILL}/>
    <ellipse cx="230" cy="56" rx="24" ry="19" ${FILL}/>
    <ellipse cx="254" cy="70" rx="18" ry="13" transform="rotate(22 254 70)" ${FILL}/>
    <ellipse cx="214" cy="34" rx="9" ry="11" transform="rotate(-24 214 34)" ${FILL}/>
    <circle cx="234" cy="50" r="7" fill="#31445b"/>
    <circle cx="262" cy="66" r="4" fill="${DETAIL}"/>
    <path d="M264 76 C270 78 270 84 264 84" stroke="${DETAIL}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path d="M60 138 C46 146 42 162 48 176" stroke="#8a6a48" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  dumptruck: `
    <path d="M34 150 L50 74 L168 74 L168 150z" ${FILL}/>
    <path d="M176 150 L176 96 C176 88 182 82 190 82 L226 82 C235 82 241 87 245 96 L254 120 L254 150z" ${FILL}/>
    <rect x="28" y="150" width="228" height="20" rx="8" ${FILL}/>
    <rect x="190" y="96" width="34" height="26" rx="6" fill="#dfe8f2" stroke="${DETAIL}" stroke-width="4"/>
    <line x1="52" y1="88" x2="168" y2="88" stroke="${DETAIL}" stroke-width="4"/>
    <circle cx="76" cy="182" r="26" fill="#3a4152"/><circle cx="76" cy="182" r="11" fill="#c8ccd4"/>
    <circle cx="134" cy="182" r="26" fill="#3a4152"/><circle cx="134" cy="182" r="11" fill="#c8ccd4"/>
    <circle cx="216" cy="182" r="26" fill="#3a4152"/><circle cx="216" cy="182" r="11" fill="#c8ccd4"/>`,
  elephant: `
    <path d="M38 128 C14 164 18 202 48 212 C68 219 86 210 80 194 C74 182 64 180 56 188 C44 176 52 156 76 140z" ${FILL}/>
    <rect x="96" y="172" width="30" height="60" rx="14" ${FILL}/>
    <rect x="140" y="176" width="30" height="56" rx="14" ${FILL}/>
    <rect x="190" y="172" width="30" height="60" rx="14" ${FILL}/>
    <ellipse cx="158" cy="142" rx="82" ry="58" ${FILL}/>
    <circle cx="84" cy="118" r="54" ${FILL}/>
    <ellipse cx="112" cy="104" rx="34" ry="38" ${FILL}/>
    <circle cx="66" cy="104" r="9" fill="#31445b"/>
    <path d="M238 148 C250 158 252 176 244 188" stroke="${DETAIL}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
  cactus: `
    <rect x="118" y="46" width="46" height="146" rx="23" ${FILL}/>
    <rect x="62" y="96" width="76" height="30" rx="15" ${FILL}/>
    <rect x="62" y="58" width="30" height="58" rx="15" ${FILL}/>
    <rect x="146" y="126" width="72" height="30" rx="15" ${FILL}/>
    <rect x="188" y="84" width="30" height="60" rx="15" ${FILL}/>
    <circle cx="141" cy="40" r="13" fill="#ff9ec4" stroke="#e8a3b8" stroke-width="4"/>
    <path d="M118 148 L108 143 M164 168 L174 163 M164 108 L174 104" stroke="${DETAIL}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <rect x="76" y="176" width="130" height="20" rx="7" fill="#e39b70" stroke="#b86a44" stroke-width="4"/>
    <path d="M86 196 L196 196 L186 226 L96 226z" fill="#d98a5e" stroke="#b86a44" stroke-width="4"/>`
};

export function paintSubjectSvg(subjectId) {
  const art = SUBJECT_ART[subjectId] ?? "";
  return `<svg viewBox="0 0 280 240" preserveAspectRatio="xMidYMid meet" ` +
    `aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${art}</svg>`;
}

// ── 렌더 ──────────────────────────────────────────────────────────────────

function buildGallery(document, state) {
  const gallery = el(document, "div", "pp-gallery");
  gallery.append(el(document, "b", "pp-gallery-title", "완성한 그림"));
  const total = state.rounds.length;
  for (let index = 0; index < total; index += 1) {
    const colorId = state.gallery[index]?.colorId;
    const frame = el(document, "span", "pp-frame");
    frame.dataset.filled = colorId ?? "";
    if (colorId) frame.style.setProperty("--frame-color", PAINT_COLORS[colorId].hex);
    gallery.append(frame);
  }
  const distinct = new Set(state.gallery.map(entry => entry.colorId)).size;
  gallery.append(el(
    document, "span", "pp-rainbow-note",
    `🌈 ${Math.min(distinct, RAINBOW_COUNT)}/${RAINBOW_COUNT}색`
  ));
  return gallery;
}

function orderText(state) {
  const round = currentRound(state);
  const subject = currentSubject(state);
  if (!round || !subject) return "";
  const color = PAINT_COLORS[round.colorId].ko;
  if (round.stage === 4) return `${subject.ko}에 어울리는 ${color}! 무엇과 무엇을 섞을까?`;
  return `${subject.ko}${josa(subject.ko, "을", "를")} ` +
    `${color}${josa(color, "으로", "로")} 칠해 볼까?`;
}

function buildHost(document, state) {
  const host = el(document, "div", "pp-host");
  const img = document.createElement("img");
  img.className = "pp-host-img";
  img.src = "assets/characters/seven.png";
  img.alt = "무지개 일곱이";
  host.append(img);
  const bubble = el(document, "div", "pp-bubble");
  bubble.append(el(document, "strong", "pp-order-text", orderText(state)));
  const round = currentRound(state);
  if (round) {
    const swatch = el(document, "span", "pp-swatch");
    swatch.style.setProperty("--swatch-color", PAINT_COLORS[round.colorId].hex);
    bubble.append(swatch);
  }
  host.append(bubble);
  return host;
}

function buildEasel(document, state) {
  const easel = el(document, "div", "pp-easel");
  const canvas = el(document, "div", "pp-canvas");
  const round = currentRound(state);
  canvas.dataset.subject = round?.subjectId ?? "";
  canvas.dataset.painted = "false";
  canvas.innerHTML = round ? paintSubjectSvg(round.subjectId) : "";
  easel.append(canvas);
  easel.append(el(document, "div", "pp-easel-legs"));
  return easel;
}

function buildJar(document, state) {
  const zone = el(document, "div", "pp-jarzone");
  const jar = el(document, "div", "pp-jar");
  jar.append(el(document, "span", "pp-jar-cap"));
  jar.append(el(document, "span", "pp-jar-spoon"));
  const glass = el(document, "div", "pp-jar-glass");
  const mixed = jarColor(state);
  state.jar.forEach((colorId, index) => {
    const layer = el(document, "span", "pp-jar-layer");
    layer.dataset.slot = String(index);
    layer.style.setProperty("--layer-color", PAINT_COLORS[colorId].hex);
    glass.append(layer);
  });
  if (mixed) {
    const overlay = el(document, "span", "pp-jar-mixed");
    overlay.style.setProperty("--mix-color", PAINT_COLORS[mixed].hex);
    glass.append(overlay);
  }
  jar.append(glass);
  zone.append(jar);

  // 수식 칩 — "빨강 + 노랑 = ?" 학습의 상시 원본(사용자 강조 지점).
  // 칩 수는 병 내용 + 남은 유닛으로 정해진다 — 해금 지름길이면 칩이 줄어
  // "주황 + 하양 = 살구색"처럼 지름길 문장이 그대로 보인다.
  const equation = el(document, "div", "pp-equation");
  const eq = equationFor(state);
  const slots = eq?.parts ?? [null];
  slots.forEach((name, index) => {
    if (index > 0) equation.append(el(document, "span", "pp-eq-op", "+"));
    equation.append(el(
      document, "span",
      `pp-eq pp-eq-${["a", "b", "c", "d"][index]}`,
      name ?? "?"
    ));
  });
  equation.append(el(document, "span", "pp-eq-op", "="));
  equation.append(el(
    document, "span",
    `pp-eq pp-eq-result${eq?.result ? " pp-eq-solved" : ""}`,
    eq?.result ?? "?"
  ));
  zone.append(equation);
  return zone;
}

function buildShelf(document, state) {
  const shelf = el(document, "div", "pp-shelf");
  const tubes = shelfTubes(state);
  // 해금 튜브가 많아지면 칩을 줄여 한 줄을 지킨다(CSS가 crowded를 본다)
  shelf.dataset.crowded = String(tubes.length > 7);
  const round = currentRound(state);
  const recipe = round ? recipeFor(round.colorId) : [];
  tubes.forEach((tube, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = tube.unlocked ? "pp-tube pp-tube-mine" : "pp-tube";
    button.dataset.tube = tube.id;
    button.dataset.focus = String(state.focusIndex === index);
    // 힌트: 물방울(레시피 재료 표시) / 반짝(정답 튜브 강조).
    // 기본 레시피 재료만 표시한다 — 해금 지름길은 아이가 발견하는 몫.
    const inRecipe = recipe.includes(tube.id);
    const level = round?.hintLevel ?? 0;
    button.dataset.hint = inRecipe && level >= 2
      ? "sparkle"
      : inRecipe && level >= 1 ? "drop" : "";
    // 배지 = 눌러야 할 숫자키. 열 칸을 넘긴 튜브는 키가 없어 별을 단다
    // (←/→ 로는 늘 닿는다). 마스코트는 색 정체성으로 남는다.
    const digit = slotKeyDigit(index);
    button.setAttribute(
      "aria-label",
      digit
        ? `${PAINT_COLORS[tube.id].ko} 물감 (숫자 ${digit})`
        : `${PAINT_COLORS[tube.id].ko} 물감 (내가 만든 색)`
    );
    const badge = digit
      ? el(document, "span", "pp-tube-num", digit)
      : el(document, "span", "pp-tube-num pp-tube-star", "⭐");
    const body = el(document, "span", "pp-tube-body");
    body.style.setProperty("--tube-color", PAINT_COLORS[tube.id].hex);
    button.append(badge, body);
    if (!tube.unlocked) {
      const mascot = document.createElement("img");
      mascot.className = "pp-tube-mascot";
      mascot.src = `assets/characters/${tube.char}.png`;
      mascot.alt = "";
      button.append(mascot);
    }
    button.append(el(document, "small", "pp-tube-name", PAINT_COLORS[tube.id].ko));
    shelf.append(button);
  });

  // 확인 버튼 없음 — 튜브를 다 고르면 저절로 섞이고 저절로 칠해진다.
  // 남는 버튼은 첫 선택을 무르는 헹구기 하나뿐이다.
  const actions = el(document, "div", "pp-actions");
  const rinse = document.createElement("button");
  rinse.type = "button";
  rinse.className = "pp-action pp-rinse";
  rinse.dataset.focus = String(state.focusIndex === tubes.length);
  rinse.textContent = "💧 다시 담기";
  actions.append(rinse);
  shelf.append(actions);
  return shelf;
}

// 피날레 = 전시회 벽. 내가 칠한 그림들이 도화지로 벽에 붙고 화가님 멘트가 나온다.
function buildFinale(document, state) {
  const finale = el(document, "div", "pp-finale");
  finale.dataset.on = String(state.finale);
  if (!state.finale) return finale;
  finale.append(el(
    document, "h2", "pp-finale-title",
    state.rainbow ? "🌈 무지개 화가 탄생!" : "🖼️ 오늘의 전시회 완성!"
  ));
  const wall = el(document, "div", "pp-wall");
  state.gallery.forEach(entry => {
    const paper = el(document, "figure", "pp-paper");
    const art = el(document, "div", "pp-paper-art");
    art.style.setProperty("--pp-fill", PAINT_COLORS[entry.colorId].hex);
    art.innerHTML = paintSubjectSvg(entry.subjectId);
    const subject = PAINT_SUBJECTS.find(item => item.id === entry.subjectId);
    paper.append(art);
    paper.append(el(
      document, "figcaption", "pp-paper-name",
      `${PAINT_COLORS[entry.colorId].ko} ${subject?.ko ?? ""}`.trim()
    ));
    wall.append(paper);
  });
  finale.append(wall);
  finale.append(el(
    document, "p", "pp-finale-note",
    `별 ${state.stars}개 — 정말 멋진 화가님이에요!`
  ));
  return finale;
}

export function renderPaintPlay(document, state) {
  const root = el(document, "div", "paint-play");
  const round = currentRound(state);
  root.dataset.stage = String(round?.stage ?? 0);
  root.dataset.finale = String(state.finale);
  root.append(buildGallery(document, state));
  root.append(buildHost(document, state));
  root.append(buildEasel(document, state));
  root.append(buildJar(document, state));
  root.append(buildShelf(document, state));
  root.append(buildFinale(document, state));
  return root;
}

// 갱신 = 재렌더 + 교체(지하철 씬 문법 — FakeElement·실DOM 양쪽 동작)
export function updatePaintPlay(root, state, document) {
  const rebuilt = renderPaintPlay(document, state);
  root.dataset.stage = rebuilt.dataset.stage;
  root.dataset.finale = rebuilt.dataset.finale;
  root.replaceChildren(...rebuilt.children);
  return root;
}

// 성공 순간의 채색 상태 — 앱이 성공 이벤트 직후 캔버스에 칠을 입힐 때 사용.
export function paintCanvasNode(canvas, colorHex) {
  canvas.dataset.painted = "true";
  canvas.style.setProperty("--pp-fill", colorHex);
}

export { PAINT_COLORS };
