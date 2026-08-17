import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../src/app.mjs", import.meta.url), "utf8");

test("정적 셸이 스타일과 앱 모듈을 로드한다", () => {
  assert.match(html, /<link rel="stylesheet" href="styles\.css(?:\?[^"]+)?">/);
  assert.match(html, /<script type="module" src="src\/app\.mjs"><\/script>/);
});

test("1~5 모바일 보정 스타일은 기본 스타일 뒤에 로드된다", () => {
  const baseIndex = html.indexOf(
    'href="styles.css?v=20260808-delivery"'
  );
  const mobileIndex = html.indexOf(
    'href="mobile-games.css?v=20260808-delivery-home"'
  );

  assert.ok(baseIndex >= 0);
  assert.ok(mobileIndex > baseIndex);
});

test("스타일 시트는 최신 캐시 주소를 달고 나간다", () => {
  // 배포 후 옛 CSS 가 그대로 쓰이지 않도록, 내용이 바뀌면 이 값을 함께 올린다.
  assert.match(
    html,
    /<link rel="stylesheet" href="styles\.css\?v=20260808-delivery">/
  );
  assert.match(
    html,
    /<link rel="stylesheet" href="mobile-games\.css\?v=20260808-delivery-home">/
  );
});

test("홈, 게임, HUD, 음소거 컨트롤이 존재한다", () => {
  for (const id of [
    "home",
    "game",
    "stage",
    "answer-box",
    "mute-btn",
    "home-btn"
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
});

test("게임 화면은 화면 전환 뒤 프로그램 방식으로 포커스를 받을 수 있다", () => {
  assert.match(
    html,
    /<section id="game"[^>]*tabindex="-1"[^>]*aria-hidden="true">/
  );
});

test("홈은 번호 배지가 있는 아홉 가지 놀이를 제공한다", () => {
  assert.equal((html.match(/class="mode-card(?: [^"]*)?"/g) ?? []).length, 9);
  assert.match(html, /안전한 길찾기/);
  assert.match(html, /지하철 여행/);
  assert.match(html, /칙칙폭폭 기관사/);
  assert.match(html, /알록달록 물감 놀이/);
  assert.match(html, /택배 왔어요!/);
});

test("홈 카드 번호는 같은 번호의 블럭 친구를 사용한다", () => {
  for (const [mode, key, asset] of [
    ["count", "1", "one"],
    ["add", "2", "two"],
    ["sub", "3", "three"],
    ["mul", "4", "four"],
    ["safety", "5", "five"],
    ["subway", "6", "six"],
    ["ktx", "7", "seven"],
    ["paint", "8", "eight"],
    ["delivery", "9", "nine"]
  ]) {
    const card = html.match(
      new RegExp(
        `<button class="[^"]*mode-card[^"]*"[^>]*data-mode="${mode}"[\\s\\S]*?<\\/button>`
      )
    )?.[0];

    assert.ok(card, `${mode} card`);
    assert.match(
      card,
      new RegExp(`<span class="card-number">${key}<\\/span>`)
    );
    // src(원본)와 alt는 계약이고, 그 뒤 속성은 자유다 — 홈은 480px 축소본을
    // srcset으로 받아 첫 화면을 가볍게 한다. 축소본이 사라지면 홈이 다시
    // 4.7MB를 당기므로 파일 존재까지 함께 고정한다.
    assert.match(
      card,
      new RegExp(`<img src="assets/characters/${asset}\\.png" alt=""[^>]*>`)
    );
    assert.match(
      card,
      new RegExp(`srcset="assets/characters/thumb/${asset}\\.webp \\d+w"`)
    );
    assert.ok(
      existsSync(new URL(`../assets/characters/thumb/${asset}.webp`, import.meta.url)),
      `${asset}.webp 축소본이 저장소에 있어야 한다`
    );
  }
});

test("길찾기는 모델, 장면, 키보드와 모바일 방향 버튼을 앱에 연결한다", () => {
  for (const name of [
    "attemptSafetyMove",
    "createSafetyRouteState",
    "advanceSafetyWorld"
  ]) {
    assert.match(
      app,
      new RegExp(
        `import\\s*\\{[^}]*${name}[^}]*\\}\\s*from "\\.\\/safety-route-model\\.mjs";`,
        "s"
      )
    );
  }
  assert.match(
    app,
    /import\s*\{[^}]*directionForKey[^}]*safetyCueForEvent[^}]*\}\s*from "\.\/safety-route-controller\.mjs";/s
  );
  assert.match(
    app,
    /import\s*\{[^}]*renderSafetyRouteScene[^}]*\}\s*from "\.\/safety-route-scene\.mjs";/s
  );
  assert.match(app, /directionForKey\(event\.key\)/);
  assert.match(app, /closest\("\[data-route-direction\]"\)/);
  assert.match(app, /attemptSafetyMove\(state\.safety,\s*direction\)/);
  assert.match(app, /advanceSafetyWorld\(\s*state\.safety,\s*/);
  assert.match(app, /acceptSafetyRepeat\(/);
  assert.match(app, /pointerdown/);
  assert.match(app, /pointerup/);
  assert.match(app, /pointercancel/);
  assert.match(app, /guidanceCells\(/);
  assert.match(app, /cameraOffset\(/);
  assert.doesNotMatch(
    app,
    /state\.mode === "safety"\s*&&\s*!event\.repeat/
  );
});

test("길찾기 라운드는 난수 시드를 만들고 월드 시간을 제한한다", () => {
  assert.match(app, /const seed = Math\.floor\(Math\.random\(\) \* 0x100000000\);/);
  assert.match(
    app,
    /createSafetyRouteState\(state\.difficulty,\s*\{\s*seed,\s*tourActive:\s*true\s*\}\)/
  );
  assert.match(app, /Math\.min\(250,\s*nowMs - previousMs\)/);
});

test("길찾기는 숫자 답안 UI를 사용하지 않고 별을 잃지 않는다", () => {
  assert.match(app, /state\.mode === "safety"/);
  assert.match(app, /state\.safety = null;/);
  assert.doesNotMatch(app, /blocked[\s\S]{0,200}state\.stars\s*-=/);
});

test("길찾기 카메라는 첫 장면만 마운트하고 이후 월드 틱은 같은 장면을 갱신한다", () => {
  assert.match(app, /cameraRendered:\s*false/);
  assert.match(app, /const previousCamera = state\.safetyView\.camera;/);
  assert.match(app, /const animateCamera = state\.safetyView\.cameraRendered;/);
  assert.match(
    app,
    /if\s*\(!state\.safetyView\.scene\)\s*\{[\s\S]*?state\.safetyView\.scene = renderSafetyRouteScene\([\s\S]*?dom\.stage\.replaceChildren\(state\.safetyView\.scene\);[\s\S]*?\}\s*else\s*\{[\s\S]*?updateSafetyRouteScene\(\s*state\.safetyView\.scene/
  );
  assert.match(
    app,
    /scene:\s*null/
  );
  assert.match(app, /state\.safetyView\.cameraRendered = true;/);
  assert.match(app, /scheduleSafetyWorldTick\(nowMs\);[\s\S]*?},\s*100\);/);
});

test("홈에는 세 난이도 버튼과 도전 세기 안내가 있다", () => {
  assert.match(html, /id="difficulty-picker"/);
  assert.equal((html.match(/class="difficulty-button"/g) ?? []).length, 3);
  assert.match(html, /id="count-unavailable"/);
  assert.match(app, /도전에서는 더하기, 빼기와 곱하기를 해요\./);
});

test("모바일 숫자 패드는 숫자 입력과 마지막 숫자 지우기를 제공한다", () => {
  assert.match(html, /id="number-pad"/);
  assert.equal((html.match(/data-digit="[0-9]"/g) ?? []).length, 10);
  assert.match(
    html,
    /id="number-pad-delete"[^>]*aria-label="마지막 숫자 지우기"/
  );
  assert.match(css, /\.number-pad\s*\{[^}]*display:\s*none;/s);
  assert.match(
    css,
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.number-pad\s*\{[^}]*display:\s*grid;/s
  );
});

test("모바일 숫자 패드는 기존 숫자 입력 경로와 삭제 모델을 사용한다", () => {
  assert.match(
    app,
    /import\s*\{[^}]*deleteLastDigit[^}]*\}\s*from "\.\/game-model\.mjs";/s
  );
  assert.match(app, /numberPadDigits\.forEach\([\s\S]*?onDigit\(button\.dataset\.digit\)/);
  assert.match(app, /state\.buffer = deleteLastDigit\(state\.buffer\);/);
});

test("곱셈 결과 팻말은 긴 수식도 한 줄로 유지한다", () => {
  assert.match(
    css,
    /\.result-sign\s*\{[^}]*white-space:\s*nowrap;/s
  );
});

test("피연산자 장면은 두 개의 같은 크기 슬롯과 식을 사용한다", () => {
  assert.match(css, /\.operand-scene\s*\{/);
  assert.match(css, /\.operand-slot\s*\{/);
  assert.match(css, /\.equation-label\s*\{/);
  assert.match(
    css,
    /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/
  );
  assert.match(
    css,
    /@media\s*\(max-width:\s*900px\)\s*\{[\s\S]*?\.operand-character\s*\{[^}]*height:/
  );
});

test("세기 친구 장면은 같은 크기의 두 칸과 보이는 힌트 상태를 제공한다", () => {
  assert.match(
    css,
    /\.count-friends\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/s
  );
  assert.match(
    css,
    /\.count-friends\s+\.count-character\s*\{[^}]*max-width:\s*100%;[^}]*max-height:\s*100%;/s
  );
  assert.match(
    css,
    /\.count-friends\.hint-groups\s*\{[^}]*border-color:/s
  );
});

test("모든 캐릭터 이미지에 숫자 단계와 두 축 형태 보정을 표시한다", () => {
  assert.match(
    app,
    /import\s*\{[^}]*characterShapeScale[^}]*\}\s*from "\.\/app-behavior\.mjs";/s
  );
  assert.match(
    app,
    /image\.dataset\.sizeBand\s*=\s*characterSizeBand\(number\);/
  );
  assert.match(
    app,
    /image\.style\.setProperty\(\s*"--shape-scale",\s*String\(characterShapeScale\(number,\s*rows,\s*cols\)\)\s*\);/s
  );
  assert.match(
    app,
    /image\.style\.setProperty\(\s*"--shape-width-scale",\s*String\(characterShapeWidthScale\(number,\s*rows,\s*cols\)\)\s*\);/s
  );
});

test("결과 팻말은 공유 연산자로 뺄셈 기호를 고른다", () => {
  assert.match(
    app,
    /import\s*\{[^}]*operatorFor[^}]*\}\s*from "\.\/problem-scene\.mjs";/s
  );
  assert.match(
    app,
    /function resultBoard\(problem\)\s*\{[\s\S]*?const operator = operatorFor\(problem\.mode\);/s
  );
});

test("정답 캐릭터 결과는 순수 표현값을 사용하고 이미지 오류 팻말을 유지한다", () => {
  assert.match(
    app,
    /import\s*\{[^}]*celebrationPresentation[^}]*\}\s*from "\.\/app-behavior\.mjs";/s
  );
  assert.match(
    app,
    /function renderCelebration\(problem\)\s*\{[\s\S]*?const presentation = celebrationPresentation\(problem\);/s
  );
  assert.match(app, /wrapper\.className = "celebration-result";/);
  assert.match(app, /equation\.className = "completed-equation";/);
  assert.match(
    app,
    /image\.addEventListener\("error",[\s\S]*?dom\.stage\.replaceChildren\(resultBoard\(problem\)\)/s
  );
});

test("문제와 정답 캐릭터는 장면 확대와 실측 상한을 공유한다", () => {
  assert.match(
    app,
    /import\s*\{[^}]*CHARACTER_VISUAL_METRICS[^}]*REFERENCE_VISUAL_AREA[^}]*\}\s*from "\.\/character-visual-metrics\.mjs";/s
  );
  assert.match(
    app,
    /image\.dataset\.scene\s*=\s*scene;/
  );
  assert.match(
    app,
    /image\.style\.setProperty\(\s*"--scene-scale",[\s\S]*?characterSceneScale\(/s
  );
  assert.match(
    app,
    /image\.style\.setProperty\(\s*"--layout-scale-cap",\s*String\(cap\)\s*\);/s
  );
  assert.match(
    app,
    /containedBitmapDimensions\(\{[\s\S]*?naturalWidth:\s*image\.naturalWidth,[\s\S]*?naturalHeight:\s*image\.naturalHeight,[\s\S]*?boxWidth:\s*image\.clientWidth,[\s\S]*?boxHeight:\s*image\.clientHeight/s
  );
  assert.match(
    app,
    /className\s*=\s*"celebration-character-zone"/
  );
});

test("오른쪽 아래에 bliss 제작자 서명을 표시한다", () => {
  assert.match(
    html,
    /<footer class="creator-credit">crafted by <strong>bliss<\/strong> © 2026<\/footer>/
  );
  assert.match(
    css,
    /\.creator-credit\s*\{[^}]*position:\s*fixed;[^}]*right:/s
  );
});

// 감사(2026-08-06) 회귀 가드 — 둘 다 app.mjs 결선이라 소스 계약으로 지킨다
// (실동작은 브라우저 검증으로 확인했고, 여정 41스텝 자동 플레이는 스위트에 넣기엔 무겁다).
test("곱하기 문제는 줄·칸으로 세운 블록 친구를 그린다", () => {
  // 두 계약이 함께 있다. 줄·칸 장면이어야 아이가 답을 세어 구할 수 있고(2026-08-06),
  // 그 줄을 채우는 것은 익명 네모가 아니라 친구여야 한다(2026-08-14 지적 —
  // 감사 대응이 친구를 네모로 갈아치웠고 "이상한 네모"라는 말이 돌아왔다).
  assert.match(app, /multiplicationBoard/);
  const render = app.slice(
    app.indexOf("function renderProblem("),
    app.indexOf("function newProblem(")
  );
  const mulBranch = render.indexOf('problem.mode === "mul"');
  assert.ok(mulBranch >= 0, "renderProblem에 mul 분기가 있다");
  assert.ok(
    mulBranch < render.indexOf("operandScene("),
    "mul 분기가 피연산자 장면보다 먼저 온다"
  );
  const call = render.slice(
    render.indexOf("multiplicationBoard("),
    render.indexOf("dom.stage.append(board)")
  );
  assert.match(call, /document,\s*problem,/, "블록판에 문제를 넘긴다");
  assert.match(
    call,
    /character\(number,\s*className,\s*"problem"\)/,
    "줄을 채울 캐릭터 생성기를 함께 넘긴다 — 빠지면 네모로 되돌아간다"
  );
  // 열을 넘는 쪽이 있으면 친구가 너무 많거나 작아져 못 센다(10×13 = 열세 명).
  // 그때는 덧셈·뺄셈과 같은 두 캐릭터 장면으로 물러난다.
  assert.match(
    render.slice(mulBranch, mulBranch + 200),
    /operands\.every\(\s*value\s*=>\s*value\s*<=\s*10\s*\)/,
    "한쪽이라도 10을 넘으면 친구 장면을 쓰지 않는다"
  );
});

test("지하철 도착지 사진은 화면 패드 입력으로도 움직인다", () => {
  // 패드 pointerdown·클릭은 moveSubway 한 곳으로만 들어온다 — 사진 분기가 그 안에
  // 있어야 마우스·터치만 쓰는 아이도 사진을 찍고 여정을 끝낼 수 있다.
  const body = app.slice(app.indexOf("function moveSubway("));
  const photoBranch = body.indexOf("movePhoto(direction)");
  assert.ok(photoBranch >= 0, "moveSubway가 사진 입력을 movePhoto로 보낸다");
  assert.ok(
    photoBranch < body.indexOf("attemptSubwayMove("),
    "사진 단계 분기가 이동 판정보다 앞에 온다"
  );
});

// 감사(2026-08-06) B2-1 회귀 가드 — 결선이 app.mjs에 있어 소스 계약으로 지킨다.
test("안전 안내 음성은 게이트를 지나서만 재생된다", () => {
  assert.match(app, /nextSafetyVoice\(state\.safetyVoiceKey, voiceKey\)/);
  const move = app.slice(
    app.indexOf("function moveSafetyRoute("),
    app.indexOf("function playSafetyCueVoice(")
  );
  // cue 재생 경로에 audio.cancel()+playPrompt 직접 호출이 남아 있으면 안 된다
  assert.ok(
    !/cue\.voiceKey\)/.test(move),
    "cue 음성은 playSafetyCueVoice 한 곳만 지난다"
  );
  assert.match(move, /playSafetyCueVoice\(cue\?\.voiceKey \?\? null\)/);
});

test("물감 혼합 수식 자막은 채색·낭독이 끝날 때까지 유지된다", () => {
  const hold = app.match(/const PAINT_EQUATION_HOLD_MS = (\d+);/);
  assert.ok(hold, "혼합 자막 유지 시간 상수");
  const auto = app.match(/const PAINT_AUTO_MS = (\d+);/);
  assert.ok(Number(hold[1]) > Number(auto[1]), "채색 시작보다 오래 남는다");
  assert.match(app, /showHint\(equation, PAINT_EQUATION_HOLD_MS\)/);
  // 기본 토스트는 그대로 1.3초
  assert.match(app, /const HINT_HOLD_MS = 1300;/);
  assert.match(app, /function showHint\(message, holdMs = HINT_HOLD_MS\)/);
});

test("실음원이 없는 역은 이름 낭독 폴백을 거친다", () => {
  const play = app.slice(
    app.indexOf("function playStationSound("),
    app.indexOf("function startSubwayRide(")
  );
  assert.match(play, /stationVoiceKey\(station\)/);
  assert.match(play, /playPrompt\(nameKey\)/);
});

// SRT는 주행 중 ⎵가 경적이 아니라 부스터다. 두 기차가 안내 문구를 공유하던
// 시절엔 "빵빵 해볼까?"를 보고 누른 아이에게 500km/h가 터졌다.
test("SRT 주행 안내는 없는 경적을 누르라고 시키지 않는다", () => {
  const block = app.slice(
    app.indexOf("const SRT_EVENT_HINTS"),
    app.indexOf("function ktxEventHint(")
  );
  assert.ok(block.length > 0, "SRT 전용 안내 문구가 없다");
  assert.doesNotMatch(block, /빵빵/, "SRT 안내가 여전히 경적을 시킨다");

  for (const event of ["river", "tunnel", "seagull", "passing", "cows"]) {
    assert.match(block, new RegExp(`${event}:`), `${event} 안내가 빠졌다`);
  }

  // 안내를 고르는 지점이 실제로 기차를 구분해야 한다 — 상수만 두면 무용지물이다.
  assert.match(app, /const hint = ktxEventHint\(event\.event\)/);
  assert.match(app, /state\.ktx\?\.train\?\.id === "srt"/);
});

// 물감 숫자키 결선 가드(2026-08-11) — 사용자 요구는 "해금한 내 물감도 1~0으로
// 고르게"였는데, 이 결선은 app.mjs 에만 있어 기본 5종으로 되돌려도 스위트가
// 전부 통과했다(리뷰에서 실측). 슬롯 계산은 tubeForDigit 순수 함수가 테스트하고,
// 여기서는 앱이 그 함수를 실제로 지나는지만 소스 계약으로 지킨다.
test("물감 숫자키는 해금 포함 선반 전체를 tubeForDigit 한 곳으로 찾는다", () => {
  assert.match(app, /tubeForDigit as paintTubeForDigit/, "순수 함수를 가져와야 한다");
  const paintKeys = app.slice(
    app.indexOf('state.mode === "paint" && state.paint'),
    app.indexOf("// 택배 왔어요! — 단계마다 쓰는 키가 다르다")
  );
  assert.ok(paintKeys.length > 0, "물감 keydown 블록을 찾지 못했다");

  const digitBranch = paintKeys.indexOf('/^[0-9]$/.test(event.key)');
  assert.ok(digitBranch >= 0, "숫자키 분기가 있다");
  const branch = paintKeys.slice(digitBranch);
  assert.match(branch, /paintTubeForDigit\(state\.paint, event\.key\)/);
  // 기본 튜브 목록으로 직접 찾으면 해금 튜브가 영영 키를 못 받는다
  assert.doesNotMatch(branch, /PAINT_TUBES/, "기본 5종 목록을 직접 쓰면 안 된다");
  // 빈 칸을 눌렀을 때 물감 짜기 성공음(pop)을 내면 아이가 성공으로 오해한다
  assert.doesNotMatch(branch, /playSfx\("pop"\)/, "빈 칸에 성공음을 내면 안 된다");
});

// 게임 포커스(노란 링)와 Tab 포커스(파란 링)가 서로 다른 칸을 가리키던 결함.
test("물감 ⎵ 실행은 Tab 으로 옮긴 DOM 포커스를 먼저 따른다", () => {
  const body = app.slice(
    app.indexOf("function activatePaintFocus("),
    app.indexOf("/* ── 택배 왔어요!")
  );
  assert.ok(body.length > 0, "activatePaintFocus 를 찾지 못했다");
  const domFocus = body.indexOf('closest?.(".pp-tube")');
  const gameFocus = body.indexOf("state.paint.focusIndex;");
  assert.ok(domFocus >= 0, "DOM 포커스를 보지 않는다");
  assert.ok(domFocus < gameFocus, "DOM 포커스 분기가 게임 포커스보다 앞에 와야 한다");
});

// 판마다 다섯 칸에서 시작한다(2026-08-11 사용자 지시) — 해금을 localStorage 로
// 영구 저장하던 코드를 걷어냈다. 되살아나면 다음 판이 열 칸에서 시작해
// "처음부터 1~0번이 다 있다"는 원래 증상이 그대로 재발한다.
test("물감 해금은 그 판에서만 유지된다 — 기기에 저장하지 않는다", () => {
  assert.doesNotMatch(app, /numberblocks-paint-unlocked/,
    "해금 localStorage 키가 되살아났다");
  assert.doesNotMatch(app, /readPaintUnlocks|savePaintUnlock/,
    "해금 영구 저장 함수가 되살아났다");
  // 판을 시작할 때 해금 목록을 넘기지 않아야 선반이 기본 다섯 칸이 된다
  assert.match(app, /createPaintPlay\(state\.difficulty, seed\)/);
});

test("KTX starts in the selected side view", () => {
  assert.match(
    app,
    /state\.ktxView\s*=\s*"side";[\s\S]*?renderKtxScene\(document,\s*state\.ktx,\s*state\.ktxView\);/s
  );
});

test("modes 6 to 9 keep playtest-guided feedback without replacing the original UI", () => {
  assert.match(css, /\.subway-plan-step\[data-current="true"\]\s*\{[^}]*box-shadow:/s);
  assert.match(css, /\.subway-rail \.route-pad button:active,[\s\S]*?\.dv-bell:active/s);
  assert.match(css, /\.pp-tube\[data-hint="sparkle"\] \.pp-tube-body\s*\{[^}]*outline:/s);
  assert.match(css, /\.dv-beat-marker\s*\{[^}]*filter:\s*drop-shadow/s);
});

// 숫자키가 물감 놀이의 주 조작인데(2026-08-11 사용자 지시) 화면 어디에도
// 설명이 없으면 아이도 부모도 새 규칙을 알 방법이 없다. 시작 안내가
// 화살표만 말하던 상태로 되돌아가지 않게 못 박는다.
test("물감 시작 안내는 숫자키와 번호가 늘어나는 규칙을 알려 준다", () => {
  const start = app.slice(
    app.indexOf("function startPaintPlay("),
    app.indexOf("function handlePaintEvents(")
  );
  assert.ok(start.length > 0, "startPaintPlay 를 찾지 못했다");
  const hint = start.match(/showHint\("([^"]+)"\)/);
  assert.ok(hint, "시작 안내 토스트가 없다");
  assert.match(hint[1], /숫자/, "숫자키 안내가 빠졌다");
  assert.match(hint[1], /1~5/, "시작 시 다섯 칸이라는 안내가 빠졌다");
  assert.match(hint[1], /늘어나/, "번호가 늘어난다는 안내가 빠졌다");
});

// ── 심층 검토(2026-08-17) P0 회귀 가드 ──────────────────────────────────────

test("택배 화면 버튼 키는 클릭 디스패처 셀렉터와 정확히 일치한다", async () => {
  // P0-2: 'go'를 'beat'로 개명하며 셀렉터를 안 고쳐 '빵빵!'·'박자!' 버튼이
  // 클릭·터치에 완전 무반응이었다. 키보드 없는 태블릿에서는 리듬 하역이 유일한
  // 진행 수단이라 씬 ②에서 영구 정지였다.
  const scene = await readFile(
    new URL("../src/delivery-scene.mjs", import.meta.url), "utf8");
  const rendered = new Set(
    [...scene.matchAll(/\{\s*(dv[A-Z][A-Za-z]*)\s*:/g)]
      .map(match => match[1].replace(/[A-Z]/g, c => `-${c.toLowerCase()}`))
      .map(name => `data-${name}`)
  );
  assert.ok(rendered.size >= 5, `렌더되는 data-dv-* 키를 찾아야 한다: ${[...rendered]}`);

  const selector = app.slice(app.indexOf('"[data-dv-dir]'))
    .slice(0, app.slice(app.indexOf('"[data-dv-dir]')).indexOf(");"));
  const listed = new Set(
    [...selector.matchAll(/\[(data-dv-[a-z]+)\]/g)].map(match => match[1]));

  for (const key of rendered) {
    assert.ok(listed.has(key), `${key} 버튼이 렌더되는데 디스패처가 못 잡는다`);
  }
  for (const key of listed) {
    assert.ok(rendered.has(key), `${key} 는 렌더되지 않는 죽은 셀렉터다`);
  }
});

test("숫자 답을 받지 않는 모드는 숫자키를 흡수하고 onDigit 은 problem 없이 돌지 않는다", () => {
  // P0-3: safety 분기가 숫자키를 흘려보내 onDigit 에서 state.problem 이 null 인
  // 채로 answer 를 읽어 매 입력마다 uncaught TypeError 가 났다.
  const safetyBranch = app.slice(
    app.indexOf('state.mode === "safety"\n  ) {'),
    app.indexOf('if (event.key === "Backspace"')
  );
  assert.match(safetyBranch, /\/\^\[0-9\]\$\/\.test\(event\.key\)/,
    "길찾기 분기가 숫자키를 흡수해야 한다");
  const onDigit = app.slice(
    app.indexOf("function onDigit("), app.indexOf("function deleteDigit("));
  assert.match(onDigit, /if\s*\(!state\.problem\)\s*return;/,
    "onDigit 은 problem 이 없으면 즉시 빠져야 한다");
  assert.ok(
    onDigit.indexOf("!state.problem") < onDigit.indexOf("state.problem.answer"),
    "가드가 answer 접근보다 앞에 와야 한다"
  );
});

test("홈에서 ↑/↓ 는 난이도 줄과 카드 판을 잇는다", () => {
  // P0-4: 방향키만 쓰는 아이는 난이도에 닿을 방법이 없어 도전 지도와 SRT 여정이
  // 키보드만으로는 열리지 않았다. CLAUDE.md 계약은 난이도도 방향키로 고른다.
  const home = app.slice(app.indexOf('state.phase === "home" && ["ArrowUp"'));
  assert.ok(home.length > 0, "홈 ↑/↓ 분기가 있어야 한다");
  const branch = home.slice(0, home.indexOf("ArrowLeft"));
  assert.match(branch, /ArrowUp[\s\S]*difficultyControls/, "↑ 는 난이도로 올라간다");
  assert.match(branch, /ArrowDown[\s\S]*modeControls/, "↓ 는 카드로 내려온다");
});
