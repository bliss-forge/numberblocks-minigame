import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("실사 장면은 승인된 구도와 폴백 계약을 가진다", () => {
  assert.match(css, /\.ktx-real-cab-image\s*\{/);
  assert.match(css, /\.ktx-real-cab-image\s*\{[^}]*object-position:\s*center top/s);
  assert.match(css, /\.ktx-real-exterior-image\s*\{/);
  assert.match(css, /data-realistic="ready"/);
  assert.match(css, /object-fit:\s*cover/);
  assert.match(css,
    /data-realistic="ready"[^\{]*\.ktx-view-side \.ktx-side-near\s*\{[^}]*display:\s*none/s);
});

test("실사 바깥 뷰는 71% 월드와 기존 실시간 운전 계기를 함께 보여 준다", () => {
  assert.match(css,
    /data-view="side"\][^\{]*\.ktx-real-exterior-image\s*\{[^}]*height:\s*71%/s);
  assert.match(css,
    /data-view="side"\][^\{]*\.ktx-view-cab\s*\{[^}]*visibility:\s*visible/s);
  assert.match(css,
    /data-view="side"\][^\{]*\.ktx-speedo[^\{]*\.ktx-lever[^\{]*\.ktx-door-panel[^\{]*\.ktx-next-key\s*\{/s);
  assert.match(css,
    /data-realistic="ready"\]\[data-view="cab"\][^\{]*\.ktx-lever\s*\{[^}]*right:\s*auto[^}]*left:\s*34px[^}]*transform-origin:\s*left bottom/s);
  assert.match(css,
    /data-realistic="ready"\]\[data-view="cab"\][^\{]*\.ktx-next-key\s*\{[^}]*left:\s*190px/s);
});

test("부스터 HUD는 준비·작동·충전 상태를 읽기 쉽게 구분한다", () => {
  assert.match(css,
    /\.ktx-boost-badge\s*\{[^}]*min-width:[^}]*border-radius:[^}]*font-weight:\s*900/s,
    "HUD 안에서 짧고 읽기 쉬운 배지");
  assert.match(css,
    /data-boost="active"[^\{]*\.ktx-boost-badge\s*\{[^}]*background:[^}]*animation:\s*ktx-boost-pulse/s,
    "활성 상태는 청록색 펄스");
  assert.match(css,
    /data-boost="cooldown"[^\{]*\.ktx-boost-badge\s*\{[^}]*background:/s,
    "쿨다운은 별도 중립색");
  assert.match(css,
    /data-boost="active"[^\{]*\.ktx-motion-near::after\s*\{[^}]*opacity:/s,
    "500km\/h는 기존 속도선을 더 강하게 표시");
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-boost-badge\s*\{[^}]*animation:\s*none\s*!important/s,
    "동작 줄이기는 배지 애니메이션만 제거");
});

test("실사 준비 상태에서는 승강장 구조물만 숨기고 정차 단서는 남긴다", () => {
  assert.match(css,
    /data-realistic="ready"[^\{]*\.ktx-platform-roof[^\{]*\.ktx-platform-pillar[^\{]*\.ktx-platform-sign\s*\{[^}]*display:\s*none/s);
  assert.match(css,
    /data-realistic="ready"[^\{]*\.ktx-platform\s*\{[^}]*bottom:\s*29%[^}]*background:\s*none/s);
  assert.match(css,
    /data-realistic="ready"[^\{]*\.ktx-queue\s*\{[^}]*bottom:\s*calc\(29%\s*\+\s*2px\)/s);
});

test("실사 외부 콘솔은 모든 모션 레이어 위에서 하단 29%를 차단한다", () => {
  assert.match(css,
    /data-view="side"\][^\{]*\.ktx-view-cab::before\s*\{[^}]*height:\s*29%[^}]*z-index:\s*10/s);
});

test("실사 모션 플레이트는 겹친 완성 장면으로만 안전 크롭·교차한다", () => {
  assert.match(css,
    /\.ktx-motion-plate\s*\{[^}]*position:\s*absolute[^}]*object-fit:\s*cover[^}]*transform:\s*translate3d\(var\(--motion-plate-x,\s*var\(--motion-scene-x\)\)/s);
  assert.match(css,
    /\.ktx-motion-plate\s*\{[^}]*width:\s*calc\(100%\s*\+\s*640px\)[^}]*left:\s*-320px/s);
  assert.match(css,
    /\.ktx-motion-plate\[data-active="true"\]\s*\{[^}]*opacity:\s*1/s);
  assert.match(css,
    /\.ktx-motion-plate\[data-active="false"\]\s*\{[^}]*opacity:\s*0/s);
  assert.doesNotMatch(css, /\.ktx-motion-plate\s*\{[^}]*repeat/s);
});

test("실사 외부 장면은 원경·중경·근경·선로를 서로 다른 속도로 이동한다", () => {
  assert.match(css,
    /\.ktx-motion-plate\s*\{[^}]*object-fit:\s*cover[^}]*--motion-plate-x/s);
  assert.match(css,
    /\.ktx-motion-mid\s*\{[^}]*transform:\s*translate3d\(var\(--motion-mid-phase-x\)/s);
  assert.match(css,
    /\.ktx-motion-near\s*\{[^}]*transform:\s*translate3d\(var\(--motion-near-phase-x\)/s);
  assert.match(css,
    /\.ktx-motion-wheel-shadow\s*\{[^}]*filter:\s*blur/s);
  assert.match(css,
    /\.ktx-motion-train-rig\s*\{[^}]*--motion-vibration-y[^}]*--motion-brake-pitch/s);
});

test("운전실 창은 하늘 아래에 지면·자갈·원근 선로와 전차선 기둥을 표시한다", () => {
  assert.match(css,
    /\.ktx-motion-cab-ground\s*\{[^}]*top:\s*22%[^}]*bottom:\s*0[^}]*background:/s);
  assert.match(css,
    /\.ktx-motion-cab-ballast\s*\{[^}]*clip-path:\s*polygon\([^)]*\)[^}]*background:/s);
  assert.match(css,
    /\.ktx-motion-cab-rail-left\s*\{[^}]*clip-path:\s*polygon\([^)]*\)/s);
  assert.match(css,
    /\.ktx-motion-cab-rail-right\s*\{[^}]*clip-path:\s*polygon\([^)]*\)/s);
  assert.match(css,
    /\.ktx-motion-cab-sleepers\s*\{[^}]*--cab-sleeper-phase[^}]*perspective/s);
  assert.match(css,
    /\.ktx-motion-cab-poles\s*\{[^}]*background-position:[^}]*--cab-pole-phase/s);
});

test("정차한 실사 SRT는 차체 문짝 두 장이 실제로 반대 방향으로 열린다", () => {
  assert.match(css,
    /\.ktx-motion-door\s*\{[^}]*position:\s*absolute[^}]*overflow:\s*hidden/s);
  assert.match(css,
    /\.ktx-motion-door-leaf\s*\{[^}]*transition:\s*transform\s+600ms/s);
  assert.match(css,
    /data-doors="open"[^\{]*\.ktx-motion-door-leaf-left\s*\{[^}]*translateX\(-/s);
  assert.match(css,
    /data-doors="open"[^\{]*\.ktx-motion-door-leaf-right\s*\{[^}]*translateX\(/s);
});

test("실사 근경·선로만 위치 이동과 블러를 받고 열차·조작부는 선명하게 고정된다", () => {
  assert.match(css,
    /\.ktx-motion-near\s*\{[^}]*transform:\s*translate3d\(var\(--motion-near-phase-x\)[^}]*filter:\s*blur\(var\(--motion-blur\)/s);
  assert.match(css,
    /\.ktx-motion-track\s*\{[^}]*transform:\s*translate3d\(var\(--motion-track-phase-x\)[^}]*filter:\s*blur\(var\(--motion-blur\)/s);
  assert.match(css,
    /\.ktx-motion-train-rig\s*\{[^}]*--motion-vibration-y[^}]*--motion-brake-pitch[^}]*z-index:\s*6/s);
  assert.match(css,
    /\.ktx-motion-train\s*\{[^}]*z-index:\s*2[^}]*filter:\s*none/s);
  assert.doesNotMatch(css, /\.ktx-motion-train\s*\{[^}]*animation:[^}]*infinite/s);
  assert.doesNotMatch(css, /\.ktx-motion-cab-frame\s*\{[^}]*filter:\s*blur/s);
});

test("선로·근경·속도선은 서로 다른 CSS 무늬 주기로 독립 위상 이동한다", () => {
  assert.match(css,
    /\.ktx-motion-track\s*\{[^}]*width:\s*calc\(100%\s*\+\s*144px\)[^}]*transform:\s*translate3d\(var\(--motion-track-phase-x\)/s);
  assert.match(css,
    /\.ktx-motion-near\s*\{[^}]*width:\s*calc\(100%\s*\+\s*720px\)[^}]*transform:\s*translate3d\(var\(--motion-near-phase-x\)/s);
  assert.match(css,
    /\.ktx-motion-near::after\s*\{[^}]*width:\s*calc\(100%\s*\+\s*310px\)[^}]*transform:\s*translate3d\(calc\(var\(--motion-streak-phase-x\)\s*-\s*var\(--motion-near-phase-x\)\)/s);
});

test("실사 속도선은 고속 밴드에만 보이고 정차하면 모든 이동 보간이 사라진다", () => {
  assert.match(css,
    /data-speed-band="fast"[^\{]*\.ktx-motion-near::after[^\{]*data-speed-band="very-fast"[^\{]*\.ktx-motion-near::after\s*\{[^}]*opacity:/s);
  assert.match(css,
    /data-motion-moving="false"[^\{]*\.ktx-motion-plate[\s\S]*?data-motion-moving="false"[^\{]*\.ktx-motion-track[\s\S]*?\{[^}]*transition:\s*none/s);
  assert.match(css,
    /data-motion-moving="true"[^\{]*\.ktx-motion-near[^\{]*data-motion-moving="true"[^\{]*\.ktx-motion-track\s*\{[^}]*transition:\s*transform\s+120ms\s+linear/s);
  assert.match(css,
    /data-track-loop-reset="true"[^\{]*\.ktx-motion-track\s*\{[^}]*transition:\s*none/s);
});

test("완성 장면 교차는 유한 애니메이션이며 정차 시 현재 불투명도에서 일시정지한다", () => {
  assert.match(css,
    /@keyframes\s+ktx-motion-plate-in\s*\{[^}]*opacity:\s*0[^}]*\}[^}]*opacity:\s*1/s);
  assert.match(css,
    /@keyframes\s+ktx-motion-plate-out\s*\{[^}]*opacity:\s*1[^}]*\}[^}]*opacity:\s*0/s);
  assert.match(css,
    /\.ktx-motion-plate\[data-crossfade="in"\][^\{]*\.ktx-motion-plate\[data-crossfade="out"\]\s*\{[^}]*animation-duration:\s*var\(--motion-crossfade-ms[^}]*animation-play-state:\s*var\(--motion-crossfade-play-state/s);
  assert.doesNotMatch(css,
    /\.ktx-motion-plate\s*\{[^}]*transition:[^;]*opacity/s);
  assert.doesNotMatch(css,
    /\.ktx-motion-plate\s*\{[^}]*animation[^}]*infinite/s);
});

test("동작 줄이기에서는 실사 블러·진동·속도선과 장면 교차를 제거한다", () => {
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-plate\[data-crossfade\]\s*\{[^}]*animation:\s*none\s*!important/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-near[^\{]*\.ktx-motion-track[^\{]*\.ktx-motion-tunnel-lights\s*\{[^}]*filter:\s*none/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-near::after\s*\{[^}]*display:\s*none/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-train-rig\s*\{[^}]*transform:[^}]*--motion-brake-pitch/s);
});

test("동작 줄이기는 위치 상태를 남기고 모든 실사 효과와 보간을 즉시 끈다", () => {
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-plate\[data-crossfade\]\s*\{[^}]*animation:\s*none\s*!important[^}]*transition:\s*none\s*!important/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-plate,[^\{]*\.ktx-motion-mid,[^\{]*\.ktx-motion-near,[^\{]*\.ktx-motion-track,[^\{]*\.ktx-motion-station-viewport,[^\{]*\.ktx-motion-station,[^\{]*\.ktx-motion-cab-sleepers,[^\{]*\.ktx-motion-cab-catenary,[^\{]*\.ktx-motion-tunnel,[^\{]*\.ktx-motion-tunnel-portal,[^\{]*\.ktx-motion-tunnel-lights,[^\{]*\.ktx-motion-train-rig\s*\{[^}]*transition:\s*none\s*!important/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-scene\s*\{[^}]*--motion-vibration-y:\s*0px/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-near[^\{]*\.ktx-motion-track[^\{]*\.ktx-motion-tunnel-lights\s*\{[^}]*filter:\s*none\s*!important/s);
  assert.match(css,
    /prefers-reduced-motion:\s*reduce[\s\S]*\.ktx-motion-near::after\s*\{[^}]*display:\s*none/s);
  assert.match(css,
    /\.ktx-motion-plate\s*\{[^}]*transform:\s*translate3d\(var\(--motion-plate-x/s,
    "줄임 동작에서도 결정적 위치 변수는 계속 렌더링한다");
});

test("운전실 모션은 고정 프레임의 투명 전면창 안에서만 소실점 투영된다", () => {
  assert.match(css,
    /data-view="cab"\][^\{]*\.ktx-motion-scene\s*\{[^}]*inset:\s*0[^}]*opacity:\s*1/s);
  assert.match(css,
    /\.ktx-motion-cab-window\s*\{[^}]*position:\s*absolute[^}]*z-index:\s*5[^}]*overflow:\s*hidden[^}]*clip-path:\s*polygon\([^)]*53%[^)]*\)/s,
    "절차적 선로는 실제 투명 전면창을 마스크로 쓰도록 운전실 프레임 아래에 표시됨");
  assert.match(css,
    /\.ktx-motion-cab-rail\s*\{[^}]*top:\s*20%[^}]*transform-origin:\s*50%\s+0/s,
    "선로 소실점은 불투명 계기판 위의 실제 투명창 안에 있어야 함");
  assert.match(css,
    /\.ktx-motion-cab-rail-left\s*\{[^}]*left:\s*19%[^}]*clip-path:\s*polygon\([^)]*\)[^}]*transform:\s*none/s);
  assert.match(css,
    /\.ktx-motion-cab-rail-right\s*\{[^}]*left:\s*50%[^}]*transform:\s*none/s,
    "고정 속도계 양옆의 전면창에서 두 레일 이동이 보여야 함");
  assert.match(css,
    /\.ktx-motion-cab-sleepers\s*\{[^}]*top:\s*21%[^}]*--cab-sleeper-gap[^}]*background-position:[^}]*--cab-sleeper-phase[^}]*clip-path:\s*polygon\([^)]*\)[^}]*perspective:\s*600px/s,
    "속도계 양옆에 실제 위상 이동 침목이 압축 없이 보여야 함");
  assert.match(css,
    /\.ktx-motion-cab-catenary\s*\{[^}]*top:\s*11%[^}]*--cab-catenary-gap[^}]*--cab-catenary-phase[^}]*transform-origin:\s*50%\s+0/s);
  assert.match(css,
    /data-cab-track-loop-reset="true"[^\{]*\.ktx-motion-cab-sleepers[\s\S]*data-cab-catenary-loop-reset="true"[^\{]*\.ktx-motion-cab-catenary[\s\S]*transition:\s*none/s);
  assert.match(css,
    /data-view="cab"\][^\{]*\.ktx-motion-cab-frame\s*\{[^}]*display:\s*block/s);
  assert.match(css,
    /data-realistic="ready"\]\[data-view="cab"\][^\{]*\.ktx-speedo\s*\{[^}]*width:\s*188px[^}]*height:\s*188px[^}]*margin-left:\s*-94px/s,
    "운전실 속도계는 전면창의 선로·터널 접근을 가리지 않음");
  assert.match(css,
    /\.ktx-motion-cab-frame\s*\{[^}]*position:\s*absolute[^}]*pointer-events:\s*none/s);
});

test("역 플레이트는 반복 없이 안전 크롭되고 상세 단계에서 읽을 수 있는 표지를 보인다", () => {
  assert.match(css,
    /\.ktx-motion-station-viewport\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0[^}]*z-index:\s*5[^}]*overflow:\s*hidden[^}]*opacity:\s*0/s);
  assert.doesNotMatch(css,
    /\.ktx-motion-station-viewport\s*\{[^}]*clip-path:/s,
    "역 사진의 사각 경계를 드러내는 부분 클립 금지");
  assert.match(css,
    /\.ktx-motion-station\s*\{[^}]*width:\s*calc\(100%\s*\+\s*240px\)[^}]*height:\s*100%[^}]*object-fit:\s*cover[^}]*--station-cover-scale/s);
  assert.match(css,
    /data-station-visible="true"[^\{]*\.ktx-motion-station-viewport\s*\{[^}]*opacity:[^}]*--station-opacity/s);
  assert.doesNotMatch(css, /\.ktx-motion-station\s*\{[^}]*repeat/s);
  assert.match(css,
    /data-station-stage="detail"[^\{]*\.ktx-motion-station-sign[\s\S]*data-station-stage="stopped"[^\{]*\.ktx-motion-station-sign\s*\{[^}]*opacity:\s*1/s);
  assert.match(css,
    /data-near-suppressed="true"[^\{]*\.ktx-motion-near\s*\{[^}]*opacity:\s*0/s);
  // 실물 크기 개편(2026-08-10): 승강장 구조물과 같은 자로 잰 132% 폭 —
  // 코끝·꼬리가 화면 밖으로 살짝 나가는 게 실사 배경과 맞는 스케일이다.
  assert.match(css,
    /\.ktx-motion-train-rig\s*\{[^}]*top:\s*62%[^}]*width:\s*min\(132%,\s*1900px\)/s,
    "열차는 실물 스케일(132%)로 바퀴가 선로 높이에 놓임");
  assert.match(css,
    /\.ktx-motion-station\s*\{[^}]*object-position:\s*center\s+var\(--station-object-y/s,
    "역 접근 진행률에 따라 승강장 크롭 위치를 정렬함");
});

test("터널 벽과 조명은 터널에서만 보이고 속도 기반 위상·밀도를 사용한다", () => {
  assert.match(css,
    /\.ktx-motion-tunnel\s*\{[^}]*--tunnel-wall-phase[^}]*opacity:\s*0/s);
  assert.match(css,
    /data-tunnel-portal-visible="true"[^\{]*\.ktx-motion-tunnel[^\{]*data-tunnel="true"[^\{]*\.ktx-motion-tunnel\s*\{[^}]*opacity:\s*1/s,
    "야외 접근 포털과 터널 내부 모두 터널 레이어를 표시함");
  assert.match(css,
    /data-tunnel="true"[^\{]*\.ktx-motion-tunnel\s*\{[^}]*--tunnel-wall-gap/s,
    "반복 벽은 실제 터널 내부에서만 활성화됨");
  assert.match(css,
    /\.ktx-motion-tunnel-portal\s*\{[^}]*border:[^;]*#7d858c[^}]*box-shadow:/s,
    "산 배경에서도 터널 입구 윤곽이 식별되는 콘크리트 테두리");
  assert.match(css,
    /\.ktx-motion-tunnel-lights\s*\{[^}]*--tunnel-light-gap[^}]*--tunnel-light-phase/s);
  assert.match(css,
    /data-tunnel-wall-loop-reset="true"[^\{]*\.ktx-motion-tunnel[\s\S]*data-tunnel-light-loop-reset="true"[^\{]*\.ktx-motion-tunnel-lights[\s\S]*transition:\s*none/s);
  assert.match(css,
    /data-motion-moving="false"[^\{]*\.ktx-motion-cab-sleepers[\s\S]*data-motion-moving="false"[^\{]*\.ktx-motion-cab-catenary[\s\S]*\.ktx-motion-tunnel-lights\s*\{[^}]*transition:\s*none/s);
});

test("모션 운전실 준비 상태는 정적 폴백과 무관하게 기존 배경만 숨기고 계기는 유지한다", () => {
  assert.match(css,
    /data-motion-realistic="ready"[^\{]*\.ktx-view-cab \.ktx-cab-backdrop[\s\S]*?\.ktx-view-cab \.ktx-cab-dash\s*\{[^}]*opacity:\s*0/s);
  assert.doesNotMatch(css,
    /data-motion-realistic="ready"[^\{]*\.ktx-speedo[^\{]*\{[^}]*display:\s*none/s);
});

test("문 다섯 짝은 역이 보이는 동안만 나타난다 — 주행 중 검은 기둥 금지", () => {
  // 협회 연출 검수(2026-08-10): 주행 중 문 모듈이 칸마다 검은 기둥으로 떠
  // 있어 열차 그림을 해쳤다. 문은 역 장면의 소품이다.
  assert.match(css,
    /\.ktx-motion-door\s*\{[^}]*opacity:\s*0[^}]*transition:\s*opacity/s);
  assert.match(css,
    /data-station-visible="true"[^\{]*\.ktx-motion-door\s*\{[^}]*opacity:\s*1/s);
});

test("실사 모드 대기줄과 워커는 열차 차체와 겹치지 않는 전경 라인에 선다", () => {
  assert.match(css,
    /data-motion-realistic="ready"[^\{]*\.ktx-walker-host,[^\{]*data-motion-realistic="ready"[^\{]*\.ktx-queue\s*\{[^}]*bottom:\s*22%/s);
});

test("운전실 옆 창은 흐르는 풍경·유리막·시간대를 모두 갖춘다", () => {
  // 옆 창은 전면창 사다리꼴 바깥이라 계층이 없으면 장면 배경색이 그대로
  // 비친다(하늘색 삼각 쐐기). 아래 셋 중 하나라도 빠지면 그 결함이 돌아온다.
  assert.match(css,
    /data-view="cab"\][^\{]*\.ktx-motion-plate\s*\{[^}]*--cab-glass-blur/s,
    "판이 운전실 뷰에서 보이고 유리 값으로 합성된다");
  assert.match(css, /\.ktx-motion-glass\s*\{/, "유리막 계층");
  assert.match(css,
    /data-view="cab"\][^\{]*\.ktx-motion-glass\s*\{[^}]*display:\s*block/s);
  for (const sky of ["dawn", "sunset", "night"]) {
    assert.match(css,
      new RegExp(`data-view="cab"\\][^\\{]*data-sky="${sky}"\\][^\\{]*\\{[^}]*--cab-glass-bright`, "s"),
      `${sky} 유리 밝기 — 없으면 옆 창만 대낮으로 빛난다`);
  }
  for (const band of ["cruise", "fast", "very-fast"]) {
    assert.match(css,
      new RegExp(`data-view="cab"\\][^\\{]*data-speed-band="${band}"\\][^\\{]*\\{[^}]*--cab-glass-blur`, "s"),
      `${band} 흐름 블러`);
  }
});

test("실사 준비 상태에서 레거시 만화 속도선은 화면에서 빠진다", () => {
  // 실사 사진 위에 흰 파선 두 줄이 남아 화면 좌우 끝 얼룩으로 보였다.
  assert.match(css,
    /data-realistic="ready"[^\{]*\.ktx-speedlines\s*\{[^}]*display:\s*none/s);
});
