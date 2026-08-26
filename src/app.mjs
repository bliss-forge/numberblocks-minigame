import {
  NUMBERBLOCKS,
  applyDigit,
  createProblem,
  deleteLastDigit,
  isModeAvailable,
  problemKey
} from "./game-model.mjs";
import { AudioManager } from "./audio-manager.mjs";
import {
  loadDifficulty,
  saveDifficulty
} from "./difficulty-preference.mjs";
import {
  celebrationPresentation,
  characterSceneScale,
  characterShapeScale,
  characterShapeWidthScale,
  characterSizeBand,
  formatCountHint,
  formatProblemText,
  focusPhase,
  ktxBoosterCue,
  nextSafetyVoice,
  playPromptCue,
  playRetryCue,
  quantityParts,
  retireAnimationClass,
  subwayArrivingCue
} from "./app-behavior.mjs";
import {
  CHARACTER_VISUAL_METRICS,
  REFERENCE_VISUAL_AREA
} from "./character-visual-metrics.mjs";
import {
  characterLayoutScaleCap,
  containedBitmapDimensions
} from "./character-layout.mjs";
import {
  countCharacterValues,
  multiplicationBoard,
  operandScene,
  operatorFor
} from "./problem-scene.mjs";
import {
  advanceSafetyWorld,
  attemptSafetyMove,
  busStopForNextTarget,
  createSafetyRouteState,
  crossingClearance,
  findSafetyPath
} from "./safety-route-model.mjs";
import {
  acceptSafetyRepeat,
  directionForKey,
  safetyCueForEvent
} from "./safety-route-controller.mjs";
import {
  renderSafetyRouteScene,
  updateSafetyRouteScene
} from "./safety-route-scene.mjs";
import {
  createGuidanceState,
  guidanceCells,
  recordGuidanceMove
} from "./safety-route-guidance.mjs";
import {
  cameraOffset,
  targetArrow,
  tourCameraPath
} from "./safety-route-camera.mjs";
import {
  advanceSrtWorld,
  attemptSrtMove,
  createSrtJourney,
  SPLASH_MESSAGES,
  splashStep,
  SRT_STATIONS,
  targetSeatName,
  ticketVoiceKeys
} from "./srt-journey.mjs";
import {
  renderSrtJourney,
  updateSrtJourney
} from "./srt-journey-scene.mjs";
import {
  advanceSubwayWorld,
  attemptSubwayMove,
  chooseSubwayLine,
  createFamilyJourney,
  createSubwayJourney,
  isFamilyJourney,
  subwayCompass,
  subwayDestinations
} from "./subway-journey.mjs";
import {
  renderSubwayJourney,
  renderSubwayPicker,
  updateSubwayJourney
} from "./subway-scene.mjs";
import {
  stationSoundSrc,
  stationVoiceKey,
  subwaySoundSrc
} from "./subway-sound-manifest.mjs";
import { lineForKey, stationLabel } from "./subway-map-data.mjs";
import {
  createKtxJourney,
  pressKtxSpace,
  selectKtxRoute,
  tickKtx
} from "./ktx-journey.mjs";
import { KTX_TRAINS } from "./ktx-route-data.mjs";
import { recordMetFriends } from "./ktx-passengers.mjs";
import {
  movePickerSelection,
  renderKtxPicker,
  renderKtxScene,
  updateKtxScene
} from "./ktx-scene.mjs";
import {
  addPhoto,
  createPhotoHunt,
  loadAlbum,
  movePhotoFrame,
  shootPhoto
} from "./photo-hunt.mjs";
import {
  createPaintPlay,
  currentRound as currentPaintRound,
  currentSubject as currentPaintSubject,
  equationFor as paintEquationFor,
  shelfTubes as paintShelfTubes,
  tubeForDigit as paintTubeForDigit,
  movePaintFocus,
  paintCanvas as paintPlayCanvas,
  rinseJar as paintRinseJar,
  squeezeTube as paintSqueezeTube
} from "./paint-play.mjs";
import {
  paintCanvasNode,
  renderPaintPlay,
  updatePaintPlay
} from "./paint-play-scene.mjs";
import {
  CANONICAL_MIX as PAINT_CANONICAL_MIX,
  PAINT_COLORS,
  josa
} from "./paint-play-data.mjs";
import {
  boardElevator,
  createDelivery,
  deliverParcel,
  moveCorridorFocus,
  moveTrayFocus,
  parcelById,
  pressFloor,
  passRhythmBox,

  ringBell as ringDeliveryBell,
  driveStep as driveDeliveryStep,
  tickRhythm
} from "./delivery-model.mjs";
import { deliveryCaption, renderDelivery } from "./delivery-scene.mjs";
import {
  advanceCatchmind,
  createCatchmind,
  currentCatchmindRound,
  guessCatchmindCard,
  tickCatchmind
} from "./catchmind-model.mjs";
import {
  paintCatchmindColorIn,
  paintCatchmindReveal,
  renderCatchmindCollection,
  renderCatchmindResult,
  renderCatchmindRound,
  setupCatchmindReveal,
  showCatchmindCelebrate,
  updateCatchmindScene
} from "./catchmind-scene.mjs";

const WALK_REPEAT_MS = 110;
const audio = new AudioManager();
const $ = id => document.getElementById(id);
const modeControls = [...document.querySelectorAll(".mode-card")];
const difficultyControls = [
  ...document.querySelectorAll(".difficulty-button")
];
const countControl = document.querySelector('[data-mode="count"]');
const countUnavailable = $("count-unavailable");
const numberPadDigits = [...document.querySelectorAll("[data-digit]")];

const dom = {
  home: $("home"),
  game: $("game"),
  stage: $("stage"),
  problem: $("problem-text"),
  answer: $("answer-box"),
  stars: $("star-count"),
  mute: $("mute-btn"),
  muteIcon: $("mute-icon"),
  homeButton: $("home-btn"),
  hint: $("hint-msg"),
  cheer: $("big-cheer"),
  numberPadDelete: $("number-pad-delete")
};

const state = {
  phase: "home",
  mode: null,
  difficulty: loadDifficulty(),
  problem: null,
  safety: null,
  safetyView: null,
  safetyVoiceKey: null,  // 재생 중인 안전 안내 — 같은 문장 재발화를 막는다
  buffer: "",
  stars: 0,
  streak: { count: 0, add: 0, sub: 0, mul: 0, safety: 0, subway: 0 },
  subwayWalkMs: 0,
  subwayTickMs: 0,
  subwayHoldBlock: false,
  subwayDoorCue: false,
  ktx: null,
  ktxScene: null,
  ktxView: "cab",
  ktxHeld: { up: false, down: false },
  ktxTickMs: 0,
  ktxPicking: false,
  ktxPickIndex: 0,
  ktxViewMs: 0,
  paint: null,
  paintScene: null,
  paintBusy: false,   // 자동 혼합→채색 연출 동안 입력 잠금
  delivery: null,
  deliveryScene: null,
  deliveryBusy: false,   // 주행 연출·도착 여운 동안 입력 잠금
  deliveryLastStepAt: 0, // 방향키 반복을 5번 게임과 같은 간격으로 조인다
  paintFinaleAt: 0,   // 피날레 화면이 뜬 시각(최소 체류 계산용)
  catchmind: null,
  catchmindScene: null,
  catchmindReveal: null,  // 캔버스 붓칠 상태 — 브라우저에서만 존재
  catchmindBusy: false,   // 정답 축하 연출 동안 입력 잠금
  catchmindView: "game",  // game | result | collection
  catchmindTab: "animal",
  wrongCount: 0,
  round: 0,
  hintTimer: 0,
  timers: new Map(),
  recentProblemKeys: []
};

// 홈에서 보이는 것은 480px 축소본이다(원본 10장 4.7MB → 160KB). 원본은 홈에서
// 한 픽셀도 쓰이지 않으므로 여기서 당기지 않는다 — 유휴 시간에 뒤에서 데우는
// 방식도 실측해 보니 requestIdleCallback이 로드 직후 바로 발사돼 결국 첫 화면과
// 대역폭을 다퉜다. 원본은 게임에 들어가 character()가 붙일 때 받는다.
function preloadCharacters() {
  Object.values(NUMBERBLOCKS).slice(0, 10).forEach(({ asset }) => {
    const image = new Image();
    image.src = `assets/characters/thumb/${asset.replace(/\.png$/, ".webp")}`;
  });
}

function character(number, className = "", scene = "neutral") {
  const { asset, rows, cols } = NUMBERBLOCKS[number];
  const metric = CHARACTER_VISUAL_METRICS[number];
  const image = document.createElement("img");
  image.className = `character enter ${className}`.trim();
  image.src = `assets/characters/${asset}`;
  image.alt = `숫자 ${number} 블록 캐릭터`;
  image.dataset.number = String(number);
  image.dataset.sizeBand = characterSizeBand(number);
  image.dataset.scene = scene;
  image.style.setProperty(
    "--shape-scale",
    String(characterShapeScale(number, rows, cols))
  );
  image.style.setProperty(
    "--shape-width-scale",
    String(characterShapeWidthScale(number, rows, cols))
  );
  image.style.setProperty(
    "--scene-scale",
    String(characterSceneScale({
      number,
      scene,
      rows,
      cols,
      metric,
      referenceArea: REFERENCE_VISUAL_AREA
    }))
  );
  image.dataset.shape =
    cols > rows
      ? "wide"
      : rows > cols * 2
        ? "tall"
        : "balanced";
  retireAnimationClass(image, "enter");
  return image;
}

// 세기 장면은 캐릭터 두 장이 한 그리드를 나눠 쓴다. 존 전체 폭을 주면 한 명이
// 그 폭을 다 쓸 수 있다고 계산해 두 배로 커진다 — 칸 폭으로 나눠 넘긴다.
function characterZoneBox(zone, image) {
  if (!zone.classList.contains("count-friends")) {
    return { width: zone.clientWidth, height: zone.clientHeight };
  }
  const siblings = zone.querySelectorAll(".count-character").length || 1;
  const gap = Number.parseFloat(getComputedStyle(zone).columnGap) || 0;
  const columns = Math.min(siblings, 2);
  return {
    width: Math.max(0, (zone.clientWidth - gap * (columns - 1)) / columns),
    height: zone.clientHeight
  };
}

function fitSceneCharacter(image) {
  // .count-friends 가 여기 없으면 세기 캐릭터는 배율 상한을 못 받는다. 그 상태에서
  // scale: 변환이 레이아웃 박스를 넘겨 1280×720에서 블록 하단이 프레임 밖으로
  // 80~87px 잘렸다 — 그림대로 센 아이가 오답을 맞는다(심층 검토 P0-1, 실측).
  const zone = image.closest(
    ".operand-slot, .celebration-character-zone, .count-friends"
  );
  const metric = CHARACTER_VISUAL_METRICS[Number(image.dataset.number)];
  if (!zone || !metric) return;

  const bitmap = containedBitmapDimensions({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    boxWidth: image.clientWidth,
    boxHeight: image.clientHeight
  });

  const box = characterZoneBox(zone, image);
  const cap = characterLayoutScaleCap({
    zoneWidth: box.width,
    zoneHeight: box.height,
    imageWidth: bitmap?.width ?? 0,
    imageHeight: bitmap?.height ?? 0,
    metric,
    widthScale: Number(
      image.style.getPropertyValue("--shape-width-scale")
    )
  });
  image.style.setProperty("--layout-scale-cap", String(cap));
}

function fitSceneCharacters(root = dom.stage) {
  root
    .querySelectorAll('.character[data-scene="problem"], .character[data-scene="celebration"]')
    .forEach(fitSceneCharacter);
}

function scheduleCharacterFit(root = dom.stage) {
  requestAnimationFrame(() => {
    fitSceneCharacters(root);
    root.querySelectorAll(".character").forEach(image => {
      if (!image.complete) {
        image.addEventListener(
          "load",
          () => fitSceneCharacter(image),
          { once: true }
        );
      }
    });
  });
}

function quantityVisual(number, { countable = false } = {}) {
  const visual = document.createElement("div");
  visual.className = `quantity-visual${countable ? " countable" : ""}`;
  visual.dataset.value = String(number);
  visual.setAttribute("aria-label", `${number}개`);

  const { tens, ones } = quantityParts(number);
  for (let groupIndex = 0; groupIndex < tens; groupIndex += 1) {
    const group = document.createElement("span");
    group.className = "ten-group";
    for (let index = 0; index < 10; index += 1) {
      const block = document.createElement("i");
      block.setAttribute("aria-hidden", "true");
      group.append(block);
    }
    visual.append(group);
  }

  if (ones > 0) {
    const group = document.createElement("span");
    group.className = "ones-group";
    for (let index = 0; index < ones; index += 1) {
      const block = document.createElement("i");
      block.setAttribute("aria-hidden", "true");
      group.append(block);
    }
    visual.append(group);
  }

  return visual;
}

function countFriends(answer) {
  const friends = document.createElement("div");
  friends.className = "count-friends";
  friends.setAttribute("aria-label", `${answer}개`);
  countCharacterValues(answer).forEach(value => {
    const image = character(value, "count-character");
    // 이 게임은 그림이 곧 문제다. png 하나가 못 뜨면 셀 대상이 사라져 답을 낼 수
    // 없다 — 곱하기·덧뺄셈·축하는 모두 폴백이 있는데 세기만 없었다(P1-13).
    // 블록 네모로 물러나면 여전히 셀 수 있다.
    image.addEventListener("error", () => {
      image.replaceWith(quantityVisual(value, { countable: true }));
    }, { once: true });
    friends.append(image);
  });
  return friends;
}

function resultBoard(problem) {
  const board = document.createElement("div");
  board.className = "result-board";
  const formula = document.createElement("strong");

  if (problem.mode === "count") {
    formula.textContent = `${problem.answer}개!`;
  } else {
    const operator = operatorFor(problem.mode);
    formula.textContent =
      `${problem.operands[0]} ${operator} ${problem.operands[1]} = ${problem.answer}`;
  }

  board.append(formula, quantityVisual(problem.answer));
  return board;
}

function renderCelebration(problem) {
  const presentation = celebrationPresentation(problem);
  if (presentation.view === "number") {
    const wrapper = document.createElement("div");
    wrapper.className = "celebration-result";
    const characterZone = document.createElement("div");
    characterZone.className = "celebration-character-zone";
    const image = character(
      presentation.characterNumber,
      "correct",
      "celebration"
    );
    image.addEventListener("error", () => {
      if (state.problem === problem) {
        dom.stage.replaceChildren(resultBoard(problem));
      }
    }, { once: true });
    characterZone.append(image);
    wrapper.append(characterZone);
    if (presentation.equation !== null) {
      const equation = document.createElement("strong");
      equation.className = "completed-equation";
      equation.textContent = presentation.equation;
      wrapper.append(equation);
    }
    dom.stage.replaceChildren(wrapper);
    scheduleCharacterFit(wrapper);
  } else {
    dom.stage.replaceChildren(resultBoard(problem));
  }
}

function clearTimers() {
  state.timers.forEach((resolve, timer) => {
    clearTimeout(timer);
    resolve(false);
  });
  state.timers.clear();
  state.hintTimer = 0;
}

function wait(delay) {
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      resolve(true);
    }, delay);
    state.timers.set(timer, resolve);
  });
}

function schedule(callback, delay) {
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    callback();
  }, delay);
  state.timers.set(timer, () => {});
  return timer;
}

function setPhase(phase) {
  state.phase = phase;
  document.body.dataset.state = phase;
  dom.home.classList.toggle("active", phase === "home");
  dom.game.classList.toggle("active", phase !== "home");
  dom.home.setAttribute("aria-hidden", String(phase !== "home"));
  dom.game.setAttribute("aria-hidden", String(phase === "home"));
}

function setMode(mode) {
  state.mode = mode;
  document.body.dataset.mode = mode ?? "";
}

function syncDifficulty() {
  difficultyControls.forEach(button => {
    const selected = button.dataset.difficulty === state.difficulty;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  const countAvailable = isModeAvailable("count", state.difficulty);
  countControl.disabled = !countAvailable;
  countControl.setAttribute("aria-disabled", String(!countAvailable));
  countUnavailable.hidden = countAvailable;
}

function setDifficulty(value) {
  state.difficulty = saveDifficulty(globalThis.localStorage, value);
  state.recentProblemKeys = [];
  syncDifficulty();
}

function availableHomeControl() {
  return modeControls.find(control => !control.disabled) ?? difficultyControls[0];
}

function renderProblem(problem) {
  dom.stage.replaceChildren();
  dom.answer.className = "answer-box";
  dom.answer.textContent = "?";

  if (problem.mode === "count") {
    dom.problem.textContent = formatProblemText(problem);
    const friends = countFriends(problem.answer);
    dom.stage.append(friends);
    // 세는 게 이 게임의 전부다 — 블록이 프레임에 다 들어와야 한다(P0-1).
    scheduleCharacterFit(friends);
    if (problem.answer > 10) scheduleCountHint(problem.answer);
    return;
  }

  dom.problem.textContent = formatProblemText(problem);

  // 곱하기는 "블록판에는 모두 몇 개가 있을까요?"를 묻는다 — 친구를 여럿 세워야
  // 아이가 세어 답을 구할 수 있다(4×5면 4 친구가 다섯 명). 다만 어느 한쪽이 열을
  // 넘으면 친구가 너무 작아지거나 너무 많아져 셀 수 없다 — 10×13은 13명이 줄지어
  // 서서 아무것도 안 읽혔다(대장 지적 2026-08-14). 그때는 덧셈·뺄셈과 같은 두
  // 캐릭터 장면으로 물러난다. 쉬움·차근차근은 양쪽 다 10 이하라 늘 친구 장면이다.
  if (problem.mode === "mul" && problem.operands.every(value => value <= 10)) {
    const board = multiplicationBoard(document, problem,
      (number, className) => character(number, className, "problem"));
    board.querySelectorAll(".mul-friend").forEach(image => {
      image.addEventListener("error", () => {
        const fallback = document.createElement("strong");
        fallback.className = "operand-fallback";
        fallback.textContent = image.dataset.number;
        image.replaceWith(fallback);
      }, { once: true });
    });
    dom.stage.append(board);
    scheduleCharacterFit(board);
    return;
  }

  const scene = operandScene(
    document,
    problem,
    (number, className) => character(number, className, "problem")
  );
  scene.querySelectorAll(".operand-character").forEach(image => {
    image.addEventListener("error", () => {
      const fallback = document.createElement("strong");
      fallback.className = "operand-fallback";
      fallback.textContent = image.dataset.number;
      image.replaceWith(fallback);
    }, { once: true });
  });
  dom.stage.append(scene);
  scheduleCharacterFit(scene);
}

function newProblem() {
  clearTimers();
  audio.cancel();
  state.round += 1;
  state.buffer = "";
  state.wrongCount = 0;
  state.problem = createProblem(
    state.mode,
    state.difficulty,
    Math.random,
    state.recentProblemKeys
  );
  state.recentProblemKeys = [
    ...state.recentProblemKeys,
    problemKey(state.problem)
  ].slice(-4);
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  setPhase("playing");
  renderProblem(state.problem);
  playPromptCue(audio, state.problem.promptKey);
}

function renderSafetyRoute() {
  if (!state.safety || !state.safetyView) return;
  dom.problem.textContent =
    state.safety.nextFriend <= 10
      ? `${state.safety.nextFriend} 친구를 만나러 가요`
      : "학교까지 안전하게 가요";

  const mobile = window.innerWidth <= 640;
  const viewport = mobile
    ? { width: 5, height: 5 }
    : { width: 7, height: 5 };
  const target =
    state.safety.map.friends.find(
      friend => friend.number === state.safety.nextFriend
    ) ?? state.safety.map.goal;
  const previousCamera = state.safetyView.camera;
  const animateCamera = state.safetyView.cameraRendered;
  state.safetyView.camera = state.safety.tourActive
    ? { ...state.safetyView.camera, ...viewport }
    : {
      ...cameraOffset({
        world: state.safety.map,
        viewport,
        player: state.safety.position,
        previous: state.safetyView.camera
      }),
      ...viewport
    };
  const nowMs = performance.now();
  const guidance = guidanceCells(
    state.safetyView.guidance,
    state.safety.map,
    state.safety.position,
    target,
    nowMs
  );
  const sceneView = {
    camera: state.safetyView.camera,
    cameraStart: animateCamera ? previousCamera : undefined,
    guidance,
    targetArrow: targetArrow({
      viewport,
      camera: state.safetyView.camera,
      target
    })
  };
  if (!state.safetyView.scene) {
    state.safetyView.scene = renderSafetyRouteScene(
      document,
      state.safety,
      sceneView
    );
    dom.stage.replaceChildren(state.safetyView.scene);
  } else {
    updateSafetyRouteScene(
      state.safetyView.scene,
      state.safety,
      sceneView
    );
  }
  state.safetyView.cameraRendered = true;
}

function scheduleSafetyWorldTick(previousMs = performance.now()) {
  schedule(() => {
    if (
      state.phase !== "playing" ||
      state.mode !== "safety" ||
      !state.safety
    ) {
      return;
    }
    const nowMs = performance.now();
    const wasRiding = state.safety.riding;
    state.safety = advanceSafetyWorld(
      state.safety,
      Math.min(250, nowMs - previousMs)
    );
    if (wasRiding && !state.safety.riding) {
      showHint("정류장에 도착했어요! 이제 친구들을 만나러 가요");
    }
    announceCrossingClearance();
    renderSafetyRoute();
    scheduleSafetyWorldTick(nowMs);
  }, 100);
}

// 무신호 횡단보도에서 차가 정지선에 서면 한 번만 "지금 건너요"라고 알린다.
// 막는 안내만 있던 시절에는 아이가 언제 건널지 몰라 계속 기다렸다(P1-12).
function announceCrossingClearance() {
  if (!state.safety || !state.safetyView) return;
  const clearance = crossingClearance(state.safety);
  const readyId = clearance.waiting && clearance.safe
    ? clearance.crossingId
    : null;
  if (readyId === state.safetyView.crossReadyId) return;
  state.safetyView.crossReadyId = readyId;
  if (!readyId) return;
  const cue = safetyCueForEvent({ type: "cross-now" }, state.safety.nextFriend);
  showHint(cue.message);
  playSafetyCueVoice(cue.voiceKey);
}

function startSafetyRoute() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  state.safetyVoiceKey = null;
  const seed = Math.floor(Math.random() * 0x100000000);
  state.safety = createSafetyRouteState(state.difficulty, {
    seed,
    tourActive: true
  });
  const mobile = window.innerWidth <= 640;
  state.safetyView = {
    camera: {
      x: 0,
      y: Math.max(0, state.safety.map.height - 5),
      width: mobile ? 5 : 7,
      height: 5
    },
    cameraRendered: false,
    scene: null,
    guidance: createGuidanceState(performance.now()),
    lastMoveAt: 0,
    heldDirection: null,
    holdTimer: 0,
    tourTimer: 0
  };
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  setPhase("playing");
  renderSafetyRoute();
  void audio.playPrompt("safety-tour");
  runSafetyTour();
}

function runSafetyTour() {
  if (!state.safety || !state.safetyView) return;
  const viewport = {
    width: state.safetyView.camera.width,
    height: state.safetyView.camera.height
  };
  const waypoints = tourCameraPath({
    world: state.safety.map,
    viewport,
    start: state.safety.map.start,
    goal: state.safety.map.goal
  });
  let index = 0;
  const advance = () => {
    if (
      state.phase !== "playing" ||
      state.mode !== "safety" ||
      !state.safety?.tourActive
    ) {
      return;
    }
    if (index >= waypoints.length) {
      endSafetyTour();
      return;
    }
    state.safetyView.camera = { ...waypoints[index], ...viewport };
    index += 1;
    renderSafetyRoute();
    state.safetyView.tourTimer = schedule(
      advance,
      index >= waypoints.length ? 800 : 500
    );
  };
  advance();
}

function endSafetyTour() {
  if (!state.safety) return;
  if (state.safetyView?.tourTimer) {
    clearTimeout(state.safetyView.tourTimer);
    state.timers.delete(state.safetyView.tourTimer);
    state.safetyView.tourTimer = 0;
  }
  state.safety = { ...state.safety, tourActive: false };
  audio.cancel();
  void audio.playPrompt("safety-next-2");
  renderSafetyRoute();
  scheduleSafetyWorldTick(performance.now());
}

// 토스트 기본 유지 시간. 물감 혼합 수식처럼 그림·소리와 함께 읽어야 하는 문장은
// holdMs로 늘린다 — 감사(2026-08-06): 자막이 1.25초에 사라지는데 채색은 1.5초,
// 낭독은 3.2초까지 이어져 아이가 세 채널 중 어느 둘도 같이 못 받았다.
const HINT_HOLD_MS = 1300;

function showHint(message, holdMs = HINT_HOLD_MS) {
  if (state.hintTimer) {
    clearTimeout(state.hintTimer);
    state.timers.delete(state.hintTimer);
  }
  dom.hint.textContent = message;
  dom.hint.className = "toast retry";
  void dom.hint.offsetWidth;
  dom.hint.classList.add("show");
  state.hintTimer = schedule(() => {
    state.hintTimer = 0;
    dom.hint.classList.remove("show");
  }, holdMs);
}

async function completeSafetyRoute() {
  const round = state.round;
  stopSafetyHold();
  setPhase("celebrating");
  clearTimers();
  audio.cancel();
  state.stars += 1;
  state.streak.safety += 1;
  dom.stars.textContent = String(state.stars);
  dom.cheer.textContent = "안전하게 도착했어요!";
  dom.cheer.classList.add("show");
  renderSafetyRoute();
  audio.playSfx("win");
  await audio.playPrompt("safety-finish");
  if (state.phase !== "celebrating" || state.round !== round) return;
  schedule(() => {
    dom.cheer.classList.remove("show");
    startSafetyRoute();
  }, 1550);
}

function safetyTarget(safety = state.safety) {
  if (!safety) return null;
  return busStopForNextTarget(safety) ?? safety.map.friends.find(
    friend => friend.number === safety.nextFriend
  ) ?? safety.map.goal ?? null;
}

function safetyDistance(safety = state.safety) {
  const target = safetyTarget(safety);
  if (!safety || !target) return Number.POSITIVE_INFINITY;
  const path = findSafetyPath(
    safety.map,
    safety.position,
    target
  );
  return path.length > 0 ? path.length - 1 : Number.POSITIVE_INFINITY;
}

function stopSafetyHold() {
  if (state.safetyView?.holdTimer) {
    clearInterval(state.safetyView.holdTimer);
  }
  if (state.safetyView) {
    state.safetyView.holdTimer = 0;
    state.safetyView.heldDirection = null;
  }
}

function startSafetyHold(direction) {
  stopSafetyHold();
  if (state.subway) {
    moveSubway(direction);
    return;
  }
  if (state.srt) {
    moveSrt(direction);
    return;
  }
  if (!state.safetyView) return;
  state.safetyView.heldDirection = direction;
  const event = moveSafetyRoute(direction);
  if (event?.type !== "moved" && event?.type !== "crossing-started") {
    stopSafetyHold();
    return;
  }
  state.safetyView.holdTimer = window.setInterval(() => {
    if (state.safetyView?.heldDirection !== direction) return;
    const repeatedEvent = moveSafetyRoute(direction);
    if (repeatedEvent?.type !== "moved") stopSafetyHold();
  }, 140);
}

function moveSafetyRoute(direction) {
  if (
    state.phase !== "playing" ||
    state.mode !== "safety" ||
    !state.safety
  ) {
    return null;
  }

  const beforeDistance = safetyDistance();
  audio.playSfx("key");
  const result = attemptSafetyMove(state.safety, direction);
  state.safety = result.state;
  const nowMs = performance.now();
  if (result.event.type === "friend") {
    state.safetyView.guidance = createGuidanceState(nowMs);
  } else {
    state.safetyView.guidance = recordGuidanceMove(
      state.safetyView.guidance,
      {
        beforeDistance,
        afterDistance: safetyDistance(),
        blocked: result.event.type === "blocked",
        nowMs
      }
    );
  }
  renderSafetyRoute();

  if (result.event.type === "complete") {
    if (state.safety.map.srtMode) {
      startSrtJourney();
    } else {
      void completeSafetyRoute();
    }
    return result.event;
  }

  const cue = safetyCueForEvent(result.event, state.safety.nextFriend,
    state.safety?.map?.srtMode ? "station" : "school");
  playSafetyCueVoice(cue?.voiceKey ?? null);
  if (!cue) return result.event;
  showHint(cue.message);
  return result.event;
}

// 같은 안내를 연달아 취소·재생하지 않는다. 감사(2026-08-06): 방향키를 누르고
// 있거나 연타하면 막힐 때마다 audio.cancel() 후 같은 mp3를 새로 틀어서
// "먼저 4 친구를 만나고 횡단보도로 가요" 같은 문장이 0.15초만 19번 반복됐다.
// 잠금은 (1) 재생이 끝나거나 (2) 안내 없는 이동(상황 변화)에서 풀린다 —
// 그래서 잠시 뒤 다시 막히면 아이는 문장을 처음부터 끝까지 듣는다.
function playSafetyCueVoice(voiceKey) {
  const gate = nextSafetyVoice(state.safetyVoiceKey, voiceKey);
  state.safetyVoiceKey = gate.playingKey;
  if (!gate.play) return;
  audio.cancel();
  void audio.playPrompt(voiceKey).then(() => {
    if (state.safetyVoiceKey === voiceKey) state.safetyVoiceKey = null;
  });
}

const SRT_SPLASH_VOICES = ["srt-arrive", "srt-board", "srt-seat"];
const SRT_STATION_VOICES = {
  동탄: "srt-station-dongtan",
  대전: "srt-station-daejeon",
  대구: "srt-station-daegu",
  부산: "srt-station-busan"
};

function playSrtVoice(key) {
  audio.cancel();
  void audio.playPrompt(key);
}

// 승차권을 소리로 읽어 준다. 앞 문장이 취소되면(다른 안내가 끼어들면) 뒤 문장도
// 따라가지 않는다 — 글 못 읽는 아이에게 자리 정보를 주는 유일한 통로다(P1-11).
function playSrtSequence(keys) {
  audio.cancel();
  const step = index => {
    const key = keys[index];
    if (!key) return;
    void audio.playPrompt(key).then(status => {
      if (status !== "cancelled") step(index + 1);
    });
  };
  step(0);
}

function startSrtJourney() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  state.srt = createSrtJourney(state.safety?.seed ?? 0);
  state.srtScene = renderSrtJourney(document, state.srt);
  dom.stage.replaceChildren(state.srtScene);
  dom.problem.textContent = "SRT를 타고 할아버지 할머니댁에 가요!";
  audio.playSfx("win");
  showHint(SPLASH_MESSAGES[0]);
  playSrtVoice(SRT_SPLASH_VOICES[0]);
  scheduleSrtTick(performance.now());
}

function scheduleSrtTick(previousMs = performance.now()) {
  schedule(() => {
    if (
      state.phase !== "playing" ||
      state.mode !== "safety" ||
      !state.srt
    ) {
      return;
    }
    const nowMs = performance.now();
    if (state.srt.phase === "station" || state.srt.phase === "ride") {
      const wasPhase = state.srt.phase;
      const wasStep = wasPhase === "station" ? splashStep(state.srt) : -1;
      const wasOpen = state.srt.ride.doorOpen;
      state.srt = advanceSrtWorld(
        state.srt,
        Math.min(400, nowMs - previousMs)
      );
      if (wasPhase === "station" && state.srt.phase === "station") {
        const step = splashStep(state.srt);
        if (step !== wasStep) {
          showHint(SPLASH_MESSAGES[step]);
          playSrtVoice(SRT_SPLASH_VOICES[step]);
        }
      }
      if (wasPhase === "station" && state.srt.phase === "seat") {
        showHint(`${targetSeatName(state.srt)} 좌석을 찾아요!`);
        playSrtSequence(ticketVoiceKeys(state.srt.target));
      }
      if (!wasOpen && state.srt.ride.doorOpen) {
        audio.playSfx("key");
        const station = SRT_STATIONS[state.srt.ride.stationIndex];
        showHint(`${station}역이에요! 문이 열렸어요`);
        const voiceKey = SRT_STATION_VOICES[station];
        if (voiceKey) playSrtVoice(voiceKey);
      }
      updateSrtJourney(state.srtScene, state.srt);
    }
    scheduleSrtTick(nowMs);
  }, 200);
}

function moveSrt(direction) {
  if (
    state.phase !== "playing" ||
    state.mode !== "safety" ||
    !state.srt
  ) {
    return;
  }
  audio.playSfx("key");
  const result = attemptSrtMove(state.srt, direction);
  state.srt = result.state;
  updateSrtJourney(state.srtScene, state.srt);
  const event = result.event;
  if (event.type === "seat-found") {
    audio.playSfx("win");
    showHint(`${event.seat} 좌석을 찾았어요! 출발합니다!`);
    playSrtVoice("srt-depart");
  } else if (event.type === "wrong-seat") {
    showHint(`여기는 ${event.seat} 좌석이에요. ${targetSeatName(state.srt)}를 찾아요!`);
    // 자리를 잘못 찾은 순간이 자리 번호를 다시 들려줄 자리다. 호차는 승차권과
    // 금색 표지판이 계속 보여 주고 있으니, 음성은 자리만 짚어 짧게 끝낸다
    // (키 하나가 한국어·영어 두 번 재생된다 — 세 키면 10초가 넘는다).
    const [, seatKey] = ticketVoiceKeys(state.srt.target);
    playSrtSequence(["srt-wrong-seat", seatKey]);
  } else if (event.type === "wrong-station") {
    showHint(`${event.station}역은 해당 역이 아니에요. 다시 기차에 올라타요!`);
    playSrtVoice("srt-wrong-station");
  } else if (event.type === "arrived") {
    audio.playSfx("win");
    showHint(`${event.station}역에 내렸어요! 할아버지 할머니 차를 찾아요!`);
    playSrtVoice("srt-parking");
  } else if (event.type === "wrong-car") {
    showHint(event.shapeMatches
      ? `모양은 맞아요! 번호판 ${state.srt.parking.targetPlate}를 찾아요!`
      : "이 모양이 아니에요. 그림자를 잘 봐요!");
    playSrtVoice("srt-wrong-car");
  } else if (event.type === "car-found") {
    audio.playSfx("win");
    showHint("차를 찾았어요! 할아버지 할머니예요!");
    schedule(() => {
      void completeSrtJourney();
    }, 2400);
  }
}

async function completeSrtJourney() {
  const round = state.round;
  setPhase("celebrating");
  clearTimers();
  audio.cancel();
  state.stars += 1;
  state.streak.safety += 1;
  dom.stars.textContent = String(state.stars);
  dom.cheer.textContent = "할아버지 할머니를 만났어요!";
  dom.cheer.classList.add("show");
  audio.playSfx("win");
  await audio.playPrompt("srt-grandparents");
  if (state.phase !== "celebrating" || state.round !== round) return;
  schedule(() => {
    dom.cheer.classList.remove("show");
    state.srt = null;
    state.srtScene = null;
    goHome();
  }, 1800);
}

function startSubwayJourney() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  state.subway = null;
  state.subwayChoosing = true;
  dom.stage.setAttribute("aria-live", "off");
  state.subwayScene = renderSubwayPicker(document, subwayDestinations());
  dom.stage.replaceChildren(state.subwayScene);
  dom.problem.textContent = "🚇 어디로 갈까요?";
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  setPhase("playing");
  audio.playSfx("win");
  showHint("가고 싶은 곳을 숫자키로 골라요!");
}

// nextKey가 있으면 첫 소리가 끝난 뒤 이어서 튼다 — 도착 멜로디 다음에 오는
// 발빠짐 주의처럼, 두 소리가 겹치지 않고 차례로 나와야 하는 자리에 쓴다.
function playSubwayReal(key, fallback, nextKey = null) {
  const src = subwaySoundSrc(key);
  audio.cancel();
  const chain = status => {
    if (status === "error" && fallback) {
      void audio.playPrompt(fallback);
      return;
    }
    if (status !== "cancelled" && nextKey) {
      const nextSrc = subwaySoundSrc(nextKey);
      if (nextSrc) void audio.playFile(nextSrc);
    }
  };
  if (src) {
    // a missing or broken recording falls back to the TTS voice pack; a
    // cancellation means newer audio took over, so stay quiet
    void audio.playFile(src).then(chain);
  } else if (fallback) {
    void audio.playPrompt(fallback);
  }
}

function playStationSound(station, followUpKey = null) {
  const src = stationSoundSrc(station);
  if (!src) {
    // 실음원이 없는 역은 이름만 TTS로 부른다 — 통과역이 통째로 무음이 되지
    // 않게(감사 2026-08-06). 가족역은 폴백 키가 없어 예전처럼 조용히 지나간다.
    const nameKey = stationVoiceKey(station);
    if (nameKey && followUpKey) {
      // 취소 확인 없이 이으면 뒤 음성이 도착 멜로디를 눌러 끈다 — 실음원 경로와
      // 같은 규칙을 쓴다(심층 검토 P1-6, 국회의사당은 매 여정 재현).
      void audio.playPrompt(nameKey).then(status => {
        if (status !== "cancelled") void audio.playPrompt(followUpKey);
      });
    } else if (nameKey) {
      void audio.playPrompt(nameKey);
    } else if (followUpKey) {
      void audio.playPrompt(followUpKey);
    }
    return;
  }
  const playback = audio.playFile(src);
  if (followUpKey) {
    void playback.then(status => {
      if (status !== "cancelled") void audio.playPrompt(followUpKey);
    });
  } else {
    void playback;
  }
}

function startSubwayRide(placeId) {
  if (state.mode !== "subway") return;
  state.subwayChoosing = false;
  const seed = Math.floor(Math.random() * 0x100000000);
  state.subway = createSubwayJourney(placeId, seed);
  state.subwayScene = renderSubwayJourney(document, state.subway);
  dom.stage.replaceChildren(state.subwayScene);
  dom.problem.textContent =
    `${state.subway.place.icon} ${state.subway.place.label}에 가요!`;
  audio.playSfx("win");
  showHint("→ 걸어가서 🎫 들어가는 곳을 지나가요!");
  audio.cancel();
  void audio.playPrompt(state.subway.place.voiceKey);
  state.subwayTickMs = performance.now();
  scheduleSubwayTick();
}

function startFamilyLine() {
  if (state.mode !== "subway") return;
  state.subwayChoosing = false;
  const seed = Math.floor(Math.random() * 0x100000000);
  state.subway = createFamilyJourney(seed);
  state.subwayScene = renderSubwayJourney(document, state.subway);
  dom.stage.replaceChildren(state.subwayScene);
  dom.problem.textContent = "10호선 가족 노선";
  audio.playSfx("win");
  showHint("가족이 기다려요! → 걸어가서 들어가는 곳을 지나가요");
  state.subwayTickMs = performance.now();
  scheduleSubwayTick();
}

function movePhoto(input) {
  const journey = state.subway;
  if (!journey?.photo || journey.photo.taken) return;
  if (input === "space") {
    const shot = shootPhoto(journey.photo);
    journey.photo = shot.hunt;
    if (shot.event.type === "taken") {
      audio.playSfx("win");
      journey.album = addPhoto(journey.place.id, globalThis.localStorage);
      showHint(`찰칵! ${shot.event.subject.label} 사진을 찍었어요`);
      updateSubwayJourney(state.subwayScene, journey);
      schedule(() => {
        void completeSubwayJourney();
      }, 2200);
      return;
    }
    audio.playSfx("pop");
    showHint("살짝 빗나갔어요 — 화살표 쪽으로 옮겨요");
  } else {
    const moved = movePhotoFrame(journey.photo, input);
    journey.photo = moved.hunt;
    if (moved.event.type === "framed") audio.playSfx("key");
  }
  updateSubwayJourney(state.subwayScene, journey);
}

const KTX_EVENT_HINTS = Object.freeze({
  sprint300: "쭉 뻗은 길! 300까지 가 볼까?",
  river: "강이에요! 빵빵 하면 오리들이 인사해요",
  tunnel: "터널이에요! 빵빵 해볼까?",
  seagull: "바다다! 빵빵 하면 갈매기가 답해요",
  passing: "반대편 기차예요! 빵빵 인사해요",
  cows: "소 떼예요! 빵빵 하면 음머~"
});

// SRT는 주행 중 ⎵가 경적이 아니라 부스터다. 위 안내를 그대로 쓰면 "빵빵 해
// 볼까?"를 보고 누른 아이에게 500km/h가 터진다 — 있지도 않은 버튼을 시키는
// 셈이라 SRT에서는 구경만 하는 문구로 바꾼다. KTX는 경적이 살아 있어 그대로다.
const SRT_EVENT_HINTS = Object.freeze({
  river: "강이에요! 오리들이 헤엄쳐요",
  tunnel: "터널로 들어가요! 깜깜해요",
  seagull: "바다다! 갈매기가 날아요",
  passing: "반대편 기차가 지나가요!",
  cows: "소 떼예요! 음머~"
});

function ktxEventHint(event) {
  const srt = state.ktx?.train?.id === "srt";
  return (srt && SRT_EVENT_HINTS[event]) || KTX_EVENT_HINTS[event];
}

function startKtxPicker() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  audio.stopEngine();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  setPhase("playing");
  state.ktxPicking = true;
  state.ktxPickIndex = 0;
  state.ktxScene = renderKtxPicker(document, 0);
  dom.stage.replaceChildren(state.ktxScene);
  dom.problem.textContent = "칙칙폭폭 기관사";
  dom.stage.setAttribute("aria-live", "off");
  showHint("← → 로 기차를 고르고 ⎵ 로 출발!");
}

function startKtxJourney(trainId) {
  state.ktxPicking = false;
  const seed = Math.floor(Math.random() * 0x100000000);
  state.ktx = createKtxJourney(seed, trainId, state.difficulty);
  // 밖에서 타고, 안에서 몬다 — 탑승은 바깥 뷰에서 시작한다.
  state.ktxView = "side";
  state.ktxHeld = { up: false, down: false };
  state.ktxScene = renderKtxScene(document, state.ktx, state.ktxView);
  dom.stage.replaceChildren(state.ktxScene);
  dom.problem.textContent = "🚄 부산까지 가요!";
  audio.playSfx("win");
  showHint("기관사님, 준비 완료! ⎵ 눌러서 친구들을 태워요");
  state.ktxTickMs = performance.now();
  scheduleKtxTick();
}

function handleKtxEvents(events) {
  const journey = state.ktx;
  for (const event of events) {
    const boosterCue = ktxBoosterCue(event);
    if (boosterCue) {
      audio.playSfx(boosterCue.sfx);
      showHint(boosterCue.hint);
    } else if (event.type === "boarded") {
      audio.playSfx("pop");
      audio.cancel();
      if (event.guest) {
        // 큰 손님은 이름(수)을 불러 준다 — "백!"
        void audio.playAnswer(event.number);
        showHint(`와! ${event.number} 손님이 탔어요!`);
      } else {
        void audio.playAnswer(event.ordinal);
        if (event.remaining === 0) {
          showHint("다 탔어요!");
        }
      }
    } else if (event.type === "all-aboard") {
      audio.playSfx("win");
      showHint(`${event.count}명 탔어요! 문이 곧 닫혀요~`);
    } else if (event.type === "doors-closed") {
      audio.playSfx("door");
      showHint(`문 닫았어요! ↑ 를 꾹 눌러 출발! 다음 역, ${event.next}!`);
    } else if (event.type === "depart") {
      audio.playSfx("jingle");
      audio.startEngine();
      // 출발 컷: 문 닫힌 열차가 움직이기 시작하는 걸 900ms 보고 운전석에 앉는다.
      // 그 사이 아이가 1/3로 직접 뷰를 골랐으면 컷을 양보한다(반증 B1 가드).
      const cutMark = state.ktxViewMs;
      schedule(() => {
        if (state.mode === "ktx" && state.ktx && !state.ktxPicking &&
          state.ktxViewMs === cutMark && state.ktxView !== "cab") {
          state.ktxView = "cab";
          updateKtxScene(state.ktxScene, state.ktx, "cab", [], state.ktxHeld);
        }
      }, 900);
      if (!event.auto) {
        audio.cancel();
        void audio.playPrompt("srt-depart");
      }
    } else if (event.type === "branch-open") {
      audio.playSfx("bell");
      showHint("하늘에서 봐요! ← 목포, → 부산 — ⎵ 로 정해요");
    } else if (event.type === "route-chosen") {
      audio.playSfx("jingle");
      const label = event.route === "mokpo" ? "목포" : "부산";
      showHint(`${label} 쪽으로 가요! ↑ 를 꾹 눌러 출발!`);
    } else if (event.type === "door-countdown-start") {
      showHint("다 탔어요! 문이 곧 닫혀요~ (⎵ 로 바로 닫기)");
    } else if (event.type === "door-countdown") {
      audio.playSfx("key");
      showHint(`문 닫혀요! ${event.secondsLeft}!`);
    } else if (event.type === "milestone") {
      audio.playSfx("pop");
      if (event.speed <= 150) {
        audio.cancel();
        void audio.playAnswer(event.speed);
      } else if (event.speed === 300) {
        audio.playSfx("win");
        showHint("삼백!! 최고 속도예요!!");
      }
    } else if (event.type === "event") {
      const hint = ktxEventHint(event.event);
      if (hint) showHint(hint);
    } else if (event.type === "slow-warn") {
      audio.playSfx("bell");
      // 실물 표지판은 바깥 뷰의 소품 — 운전실이면 도착 컷과 같은 관례로
      // 잠깐 바깥을 보여 준다(협회 D: cab에서 "저기"가 없었다).
      state.ktxView = "side";
      showHint(`🚧 저기 표지판! ${event.limit}까지 천천히~`);
      audio.cancel();
      void audio.playAnswer(event.limit);   // number-100/150 재사용
    } else if (event.type === "slow-enter") {
      showHint(`서행 구간이에요! ${event.limit} 밑으로 살살~`);
    } else if (event.type === "slow-wobble") {
      audio.playSfx("pop");
      showHint("덜컹덜컹~ 조금만 천천히!");
    } else if (event.type === "slow-clear") {
      if (event.success) {
        audio.playSfx("win");
        showHint("✨ 부드럽게 지나갔어요! 반짝 배지!");
      } else {
        showHint("다음 서행은 살살 가 보자~");
      }
    } else if (event.type === "zone-enter") {
      audio.playSfx("bell");
      showHint(`${event.station}역이 보여요! 천천히, 천천히~`);
    } else if (event.type === "armed") {
      audio.playSfx("key");
      showHint("✋ 노란 불이에요! ⎵ 눌러서 딱 멈추기!");
    } else if (event.type === "early-stop") {
      showHint("조금만 더 가서 멈춰요~");
    } else if (event.type === "overrun") {
      audio.playSfx("pop");
      showHint("어이쿠~ 살짝 지나쳤어요! 뒤로 통통~");
    } else if (event.type === "stopped") {
      audio.playSfx("win");
      state.ktxView = "side";      // 도착 컷: 승강장의 친구들이 보인다
      const starText = "⭐".repeat(event.stars);
      if (event.gold) {
        showHint(`👑 골드 정차! ${starText} 완벽해요, 기관사님!`);
      } else if (event.stars === 3 && event.smooth) {
        showHint(`${starText} 스르르~ 딱! 승객들이 편안해요`);
      } else if (event.stars === 3) {
        showHint(`${starText} 딱 멈췄어요! 최고, 기관사님!`);
      } else if (event.smooth) {
        showHint(`${starText} 부드러운 도착! ⎵ 눌러서 문 열기`);
      } else {
        showHint(`${starText} ${event.station}역이에요! ⎵ 눌러서 문 열기`);
      }
      const voiceKey = SRT_STATION_VOICES[event.station];
      if (voiceKey) {
        audio.cancel();
        void audio.playPrompt(voiceKey);
      }
    } else if (event.type === "doors-open") {
      audio.playSfx("door");
      showHint("친구들이 기다려요! ⎵ 한 명씩 태워요");
    } else if (event.type === "horn") {
      audio.playSfx("horn");
    } else if (event.type === "hint") {
      const words = {
        board: "⎵ 눌러서 태워 볼까?",
        "close-doors": "⎵ 눌러서 문을 닫아요",
        "open-doors": "⎵ 눌러서 문을 열어요",
        branch: "← → 로 길을 골라 볼까요?",
        depart: "↑ 를 꾹 눌러 볼까요?",
        go: "↑ 를 눌러 다시 출발해요"
      };
      if (words[event.what]) showHint(words[event.what]);
    } else if (event.type === "auto") {
      if (event.what === "creep") showHint("같이 가 볼까요? 칙칙폭폭~");
      if (event.what === "doors-open") showHint("문이 열려요! 친구들을 태워요");
    } else if (event.type === "auto-board-start") {
      showHint("같이 태워 볼게요! 하나, 둘~");
    } else if (event.type === "finale") {
      void completeKtxJourney(event);
    }
  }
  void journey;
}

function completeKtxJourney(event) {
  // 반짝 배지(서행·부드러운 도착·골드) 1개 = 별 +1. 정차 별 계약은 불변,
  // 보너스는 언제나 가산만 한다 — 4~6세 무벌점 세계 유지.
  const bonusStars = event.bonuses?.length ?? 0;
  const totalStars = event.stars.reduce((sum, count) => sum + count, 0) +
    bonusStars;
  state.stars += totalStars;
  dom.stars.textContent = String(state.stars);
  const fresh = recordMetFriends(event.boarded);
  const finalStation = state.ktx?.station ?? "부산";
  audio.playSfx("win");
  if (finalStation === "부산") {
    audio.cancel();
    void audio.playPrompt("srt-station-busan");
  }
  showHint(event.perfect
    ? "⭐ 퍼펙트 기관사! 별을 다 모았어요!"
    : fresh.length > 0
      ? `처음 만난 친구가 ${fresh.length}명 있어요!`
      : "고마워요, 기관사님!");
  // 빨간 cheer 배너는 피날레 제목과 같은 자리에 같은 말이 겹쳐 3중 표기가
  // 됐다(협회 후반 검수 6). 피날레 화면이 이미 제목·별 줄·친구 대열을
  // 갖고 있으니 배너 없이 9초 감상 후 홈으로.
  // phase 를 넘기지 않으면 9초 동안 "playing" 이 유지돼 ⎵ 가 계속 시뮬레이션에
  // 들어간다 — 다른 게임은 모두 축하 단계로 넘긴다(심층 검토 P1-15).
  setPhase("celebrating");
  schedule(() => goHome(), 9000);
}

function scheduleKtxTick() {
  schedule(() => {
    if (state.phase !== "playing" || state.mode !== "ktx" || !state.ktx) {
      return;
    }
    const nowMs = performance.now();
    const elapsed = Math.min(400, nowMs - (state.ktxTickMs || nowMs));
    state.ktxTickMs = nowMs;
    const result = tickKtx(state.ktx, state.ktxHeld, elapsed);
    state.ktx = result.state;
    handleKtxEvents(result.events);
    if (state.ktx) {
      // 주행음 — 속도가 소리를 민다(정지 = 무음, 부스터 = 컷오프 활짝)
      audio.setEngineSpeed(state.ktx.v / 300);
      updateKtxScene(state.ktxScene, state.ktx, state.ktxView, result.events,
        state.ktxHeld);
    }
    scheduleKtxTick();
  }, 150);
}

function moveKtxSpace() {
  if (state.phase !== "playing" || !state.ktx) return;
  // 판정 공정성: 누른 순간까지의 실측 경과를 먼저 시뮬에 반영한다
  const nowMs = performance.now();
  const elapsed = Math.min(400, nowMs - (state.ktxTickMs || nowMs));
  state.ktxTickMs = nowMs;
  const ticked = tickKtx(state.ktx, state.ktxHeld, elapsed);
  state.ktx = ticked.state;
  handleKtxEvents(ticked.events);
  const pressed = pressKtxSpace(state.ktx);
  state.ktx = pressed.state;
  handleKtxEvents(pressed.events);
  if (state.ktx) {
    updateKtxScene(state.ktxScene, state.ktx, state.ktxView,
      [...ticked.events, ...pressed.events], state.ktxHeld);
  }
}

function switchKtxView(view) {
  if (!state.ktx || state.ktxView === view) {
    audio.playSfx("key");
    return;
  }
  const nowMs = performance.now();
  if (nowMs - state.ktxViewMs < 400) return;  // 쿨다운 — 플리커 방지
  state.ktxViewMs = nowMs;
  state.ktxView = view;
  audio.playSfx("key");
  updateKtxScene(state.ktxScene, state.ktx, view, [], state.ktxHeld);
}

function chooseSubwayLineInput(lineNumber) {
  if (state.phase !== "playing" || !state.subway) return;
  const result = chooseSubwayLine(state.subway, lineNumber);
  state.subway = result.state;
  updateSubwayJourney(state.subwayScene, state.subway);
  if (result.event.type === "line-chosen") {
    audio.playSfx("key");
    showHint(`${result.event.line}호선 계단이에요! → 걸어서 내려가요`);
  } else if (result.event.type === "no-line") {
    showHint(`이 역에는 ${lineNumber}호선이 없어요`);
    audio.cancel();
    void audio.playPrompt("subway-wrong-line");
  } else if (result.event.type === "tap-first") {
    showHint("먼저 → 걸어서 들어가는 곳을 지나가요!");
  }
}

function scheduleSubwayTick() {
  schedule(() => {
    if (
      state.phase !== "playing" ||
      state.mode !== "subway" ||
      !state.subway
    ) {
      return;
    }
    const nowMs = performance.now();
    const previous = state.subway;
    // state.subwayTickMs is the single clock shared with moveSubway, so a
    // keypress between ticks is never counted twice. The 400ms cap guards
    // backgrounded tabs, except during the hop, whose phase is periodic and
    // must track the CSS-animated marker.
    const elapsed = nowMs - (state.subwayTickMs || nowMs);
    state.subway = advanceSubwayWorld(
      state.subway,
      state.subway.phase === "arriving" ? elapsed : Math.min(400, elapsed)
    );
    if (previous.phase === "platform" && state.subway.phase === "platform" &&
      previous.platform.stage !== "stopped" &&
      state.subway.platform.stage === "stopped") {
      audio.playSfx("door");
      showHint(`${state.subway.line}호선 열차예요! ⎵ 키로 타요`);
    }
    maybeSubwayDoorCue();
    state.subwayTickMs = nowMs;
    updateSubwayJourney(state.subwayScene, state.subway);
    scheduleSubwayTick();
  }, 150);
}

function maybeSubwayDoorCue() {
  if (
    state.subway?.phase === "arriving" &&
    state.subway.arriving?.stage === "hop" &&
    !state.subwayDoorCue
  ) {
    state.subwayDoorCue = true;
    audio.playSfx("door");
    showHint("문이 열렸어요! 빨간 불이 노란 칸에 올 때 ⎵로 폴짝!");
  }
}

function prefersReducedMotion() {
  return typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function moveSubway(direction) {
  if (
    state.phase !== "playing" ||
    state.mode !== "subway" ||
    !state.subway
  ) {
    return;
  }
  // 도착지 사진 단계에서는 같은 조작이 사진 프레임을 움직인다. 키보드 분기는
  // 위에서 먼저 걸러지지만 화면 패드(pointerdown·클릭)는 여기로만 들어오므로,
  // 마우스·터치만 쓰는 아이가 사진을 못 찍고 여정이 끝나지 않는 문제를 막는다.
  if (state.subway.photo && !state.subway.photo.taken) {
    movePhoto(direction);
    return;
  }
  if (state.subway.phase === "arriving" && state.subwayTickMs) {
    // Sync the marker to the wall clock before judging the jump, so the
    // judgement matches what the CSS-animated marker is showing.
    const nowMs = performance.now();
    state.subway = advanceSubwayWorld(state.subway, nowMs - state.subwayTickMs);
    state.subwayTickMs = nowMs;
    maybeSubwayDoorCue();
  }
  const result = attemptSubwayMove(state.subway, direction, {
    assist: prefersReducedMotion()
  });
  state.subway = result.state;
  updateSubwayJourney(state.subwayScene, state.subway);
  const event = result.event;
  if (!["ignored", "walked"].includes(event.type)) audio.playSfx("key");
  if (event.type === "boarded") {
    audio.playSfx("bell");
    playSubwayReal("door-close", "subway-board");
    const compass = subwayCompass(state.subway);
    showHint(
      compass?.alightAt && compass.hopsToAlight > 0
        ? `${event.line}호선을 탔어요! ${compass.alightAt}에서 내려요 ` +
          `(${compass.hopsToAlight}정거장)`
        : `${event.line}호선을 탔어요! ←→ 문으로 걸어가요`
    );
  } else if (event.type === "no-train") {
    showHint("열차가 완전히 설 때까지 기다려요");
  } else if (event.type === "card-tapped") {
    audio.playSfx("bell");
    showHint(
      event.autoLine
        ? `삑! 통과했어요. → ${event.autoLine}호선 계단으로 내려가요`
        : `삑! 통과했어요. ${event.lines.join("·")}호선 중에 골라요`
    );
  } else if (event.type === "wrong-gate") {
    showHint("여기는 나가는 곳이에요! → 들어가는 곳으로 가요");
  } else if (event.type === "walk-through-gate") {
    showHint("→ 걸어서 들어가는 곳을 지나가요");
  } else if (event.type === "pick-line-first") {
    showHint(`몇 호선 계단으로 갈까요? ${event.lines.join("·")} 중에 골라요`);
  } else if (event.type === "stairs-down") {
    audio.playSfx("jingle");
    showHint(`${event.line}호선 승강장이에요! 열차가 서면 ↑ 키로 타요`);
  } else if (event.type === "gate-reached") {
    audio.playSfx("jingle");
    showHint("개찰구예요! → 들어가는 곳으로 지나가요");
  } else if (event.type === "friend-joined") {
    audio.playSfx("win");
    showHint(`${event.number} 친구가 함께 가요!`);
  } else if (event.type === "departed") {
    // A held arrow must not ride straight through stations: the hold is
    // absorbed at each arrival and a fresh press is needed to continue.
    state.subwayHoldBlock = true;
    const compass = subwayCompass(state.subway);
    // 역 이름 안내는 그 역에 실제로 섰을 때만 튼다. 전에는 목적지 한 정거장
    // 앞에서 내릴 역 이름을 미리 틀어서, 아이가 엉뚱한 역에서 그 이름을 들었다.
    audio.cancel();
    if (event.atDest) {
      audio.playSfx("door");
      showHint(`⭐ ${stationLabel(event.station)}이에요! ⎵ 눌러서 내려요`);
      playStationSound(event.station, "subway-stop-check");
    } else if (compass?.hopsToAlight === 0) {
      audio.playSfx("door");
      showHint(`🔔 ${stationLabel(event.station)}이에요! ⎵ 눌러서 갈아타요`);
      playStationSound(event.station, "subway-transfer");
    } else if (compass?.hopsToAlight === 1) {
      showHint(
        `${stationLabel(event.station)} — 다음 ${compass.alightAt}에서 내려요!`
      );
      playStationSound(event.station);
    } else {
      showHint(
        `${stationLabel(event.station)} — ${compass?.alightAt ?? "목적지"}까지 ` +
        `${compass?.hopsToAlight ?? "?"}정거장`
      );
      playStationSound(event.station);
      if (!event.closer && state.subway.strayStreak >= 2) {
        showHint("목적지에서 멀어지고 있어요. 지도를 봐요!");
      }
    }
  } else if (event.type === "line-end") {
    showHint("이 방향은 종점이에요. 반대쪽 문으로 가요");
  } else if (event.type === "wall") {
    showHint("벽이에요! 다른 쪽으로 가요");
  } else if (event.type === "not-your-stop") {
    showHint(`${stationLabel(event.station)}은 내릴 역이 아니에요. 계속 타요`);
    audio.cancel();
    void audio.playPrompt("subway-wrong-stop");
  } else if (event.type === "transfer-start") {
    audio.playSfx("jingle");
    showHint(
      event.offPlan
        ? "여기서 내렸어요! 계획에 없던 역이지만 다시 탈 수 있어요"
        : "내렸어요! → 환승 통로로 걸어가요. 발빠짐 주의!"
    );
    audio.cancel();
    playStationSound(event.station, "subway-transfer");
  } else if (event.type === "arriving") {
    const cue = subwayArrivingCue(event.kind, state.subway.travelSide);
    state.subwayDoorCue = event.kind === "transfer";
    // 목적지는 멜로디 뒤 발빠짐 안내, 환승은 음악 없이 안내부터 튼다.
    playSubwayReal(cue.realKey, cue.fallback, cue.nextKey);
    audio.playSfx(cue.sfx);
    showHint(cue.hint);
  } else if (event.type === "hop-miss") {
    audio.playSfx("pop");
    showHint("아직! 표시가 가운데 노란 칸에 올 때 ⎵");
  } else if (event.type === "hop-wait") {
    showHint("⎵ 스페이스로 폴짝 뛰어 내려요!");
  } else if (event.type === "blocked-person") {
    audio.playSfx("pop");
    showHint("\"실례합니다!\" 한 번 더 누르면 비켜줘요");
  } else if (event.type === "alighted") {
    audio.playSfx("win");
    const hunt = createPhotoHunt(state.subway.place.id);
    if (hunt) {
      // 도착지에서 바로 끝내지 않는다 — 사진 한 장 찍고 간다.
      state.subway.photo = hunt;
      state.subway.album = loadAlbum();
      updateSubwayJourney(state.subwayScene, state.subway);
      showHint(`${state.subway.place.label}이에요! 방향키로 찾아 ⎵ 찰칵`);
    } else if (isFamilyJourney(state.subway)) {
      showHint("가족이 모두 마중 나왔어요!");
      schedule(completeFamilyJourney, 2600);
    } else {
      showHint(`${state.subway.place.label}에 도착했어요!`);
      schedule(() => {
        void completeSubwayJourney();
      }, 2600);
    }
  }
}

function completeFamilyJourney() {
  setPhase("celebrating");
  clearTimers();
  audio.cancel();
  state.streak.subway += 1;
  state.stars += 1;
  dom.stars.textContent = String(state.stars);
  dom.cheer.textContent =
    `⭐ 도하네 집 도착! 환승 ${state.subway.transfersUsed}번 · 가족 모두 만났어요`;
  dom.cheer.classList.add("show");
  audio.playSfx("win");
  // schedule은 타이머 id를 돌려준다. await 하면 그 자리에서 지나가 버려서
  // 축하 화면이 한 순간도 보이지 않는다.
  schedule(() => {
    dom.cheer.classList.remove("show");
    state.subway = null;
    state.subwayScene = null;
    goHome();
  }, 2600);
}

async function completeSubwayJourney() {
  const round = state.round;
  setPhase("celebrating");
  clearTimers();
  audio.cancel();
  state.stars += 1;
  state.streak.subway += 1;
  dom.stars.textContent = String(state.stars);
  dom.cheer.textContent =
    `${state.subway.place.icon} ${state.subway.place.label} 도착! ` +
    `환승 ${state.subway.transfersUsed}번`;
  dom.cheer.classList.add("show");
  audio.playSfx("win");
  await audio.playPrompt("subway-arrive");
  if (state.phase !== "celebrating" || state.round !== round) return;
  schedule(() => {
    dom.cheer.classList.remove("show");
    state.subway = null;
    state.subwayScene = null;
    goHome();
  }, 1800);
}

function scheduleCountHint(answer) {
  schedule(() => {
    if (state.phase !== "playing" || state.problem?.answer !== answer) return;
    dom.stage.querySelector(".count-friends")?.classList.add("hint-groups");
    showHint(formatCountHint(answer));
  }, 4500);
}

function replayClass(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
  node.addEventListener(
    "animationend",
    () => node.classList.remove(className),
    { once: true }
  );
}

async function celebrate() {
  const round = state.round;
  setPhase("celebrating");
  clearTimers();
  audio.cancel();
  state.stars += 1;
  state.streak[state.mode] += 1;
  dom.stars.textContent = String(state.stars);
  dom.answer.textContent = String(state.problem.answer);

  const cheers = [
    "참 잘했어요!",
    "대단해요!",
    "정답이에요!",
    "멋지게 해냈어요!"
  ];
  dom.cheer.textContent = cheers[(state.stars - 1) % cheers.length];
  dom.cheer.classList.add("show");
  dom.stage
    .querySelectorAll(".character")
    .forEach(node => node.classList.add("correct"));

  audio.playSfx("win");
  if (!(await wait(480))) return;
  if (state.phase !== "celebrating" || state.round !== round) return;

  renderCelebration(state.problem);

  await audio.playAnswer(state.problem.answer);
  if (state.phase !== "celebrating" || state.round !== round) return;

  schedule(() => {
    dom.cheer.classList.remove("show");
    newProblem();
  }, 1550);
}

function wrongAnswer() {
  audio.cancel();
  state.wrongCount += 1;
  dom.answer.textContent = "?";
  dom.stage
    .querySelectorAll(".character")
    .forEach(node => replayClass(node, "wrong"));
  replayClass(dom.answer, "wrong");
  const retryMessage =
    state.mode === "count" && state.wrongCount >= 2
      ? formatCountHint(state.problem.answer)
      : "괜찮아요! 천천히 다시 눌러 봐요.";
  if (state.mode === "count" && state.wrongCount >= 2) {
    dom.stage.querySelector(".count-friends")?.classList.add("hint-groups");
  }
  showHint(retryMessage);
  playRetryCue(audio, `retry-${Math.min(state.wrongCount, 3)}`);
}

function onDigit(digit) {
  if (state.phase !== "playing") return;
  // 숫자 답을 받지 않는 게임(길찾기·지하철·기관사·물감·택배)에서 키가 여기까지
  // 새면 problem 이 null 이다. 각 모드가 흡수하는 것이 원칙이지만, 새 게임이
  // 하나 빠뜨려도 크래시가 아이 화면까지 가지 않게 여기서 한 겹 더 막는다.
  if (!state.problem) return;
  audio.playSfx("key");
  const result = applyDigit(state.buffer, digit, state.problem.answer);
  state.buffer = result.buffer;
  dom.answer.textContent = result.buffer || "?";
  replayClass(dom.answer, "typing");

  if (result.status === "correct") {
    void celebrate();
  } else if (result.status === "wrong") {
    wrongAnswer();
  }
}

function deleteDigit() {
  if (state.phase !== "playing") return;
  state.buffer = deleteLastDigit(state.buffer);
  dom.answer.textContent = state.buffer || "?";
}

// ── 알록달록 물감 놀이 ────────────────────────────────────────────────────

// 해금한 "내 물감"은 그 판 안에서만 늘어난다(2026-08-11 사용자 지시).
// 예전엔 localStorage 에 영구 저장해서, 한 번 다 모으면 다음 판이 열 칸에서
// 시작했다 — "처음부터 1~0번이 다 있다"는 게 그 증상이었다. 판마다 다섯
// 칸에서 시작해 그 판에서 만든 색만 붙는 게 이 게임의 진행감이다.

// 혼합 문장("A와 B를 섞으면 C!")은 CANONICAL_MIX의 재료를 말한다.
// 병 내용이 그 재료와 일치할 때만 혼합 문장을 틀고, 다른 조합으로 같은 색이
// 나온 경우(빨+노+검→밤색)는 "우와, C가 됐네!"로 실명만 호명한다.
function paintMixVoiceKey(event) {
  const canonical = PAINT_CANONICAL_MIX[event.color];
  const jar = event.jar ?? [];
  const matches = canonical && canonical.length === jar.length &&
    canonical.every(part => jar.includes(part));
  return matches ? `paint-mix-${event.color}` : `paint-made-${event.color}`;
}

// 물감을 다 고른 뒤 병이 섞이는 걸 보여주고 자동으로 칠하기까지의 간격.
// 혼합 낭독(한국어 약 3.2초)이 시작된 뒤라 그림은 문장 끝에 맞춰 차오른다.
const PAINT_AUTO_MS = 1600;

// 완성한 그림을 보여주는 시간 — 사용자 요청(2026-08-05)으로 1.5초에서 2초 늘렸다.
// "색이 완성될 때 너무 빨리 지나간다" — 이 게임의 보상 장면이라 넉넉히 둔다.
const PAINT_HOLD_MS = 3500;

// 색이 어긋났을 때 병에 든 그 색을 이름과 함께 잠깐 더 보여준다(즉시 헹굼 금지).
const PAINT_MISS_HOLD_MS = 1600;

// 혼합 수식 자막 유지 — 한국어 낭독(약 3.2초)이 끝나고 채색까지 본 뒤 사라진다.
const PAINT_EQUATION_HOLD_MS = 3400;

// 피날레 화면 최소 체류(완성 그림 3.5초 + 축하 3.7초)와 안전망 상한.
// 낭독이 먼저 끝나면 최소 체류 시각에, 소리가 없으면 상한에서 홈으로 간다.
const PAINT_FINALE_FLOOR_MS = PAINT_HOLD_MS + 3700;
const PAINT_FINALE_LIMIT_MS = 15000;

function leavePaintFinale(round) {
  if (state.round !== round || state.phase !== "celebrating") return;
  const remain = PAINT_FINALE_FLOOR_MS -
    (performance.now() - (state.paintFinaleAt || 0));
  if (remain > 0) {
    schedule(() => leavePaintFinale(round), remain);
    return;
  }
  goHome();
}

// 물감 놀이 낭독 줄 세우기 — 혼합 문장("빨강과 노랑을 섞으면 주황!")이
// 이 게임 학습의 본체라 끝까지 들려주고, 그 다음 문장을 이어 붙인다.
let paintVoice = Promise.resolve(true);
let paintVoiceSeq = 0;

function speakPaint(key) {
  paintVoiceSeq += 1;
  const seq = paintVoiceSeq;
  paintVoice = audio.playPrompt(key).then(() => seq === paintVoiceSeq);
  return paintVoice;
}

// 앞 문장이 끝나면(중간에 다른 낭독이 끼어들지 않았을 때만) 이어서 실행.
function afterPaintVoice(round, run) {
  void paintVoice.then(fresh => {
    if (fresh && state.round === round && state.paint) run();
  });
}

// 현재 라운드 주문을 낭독한다 — 색 이름 호명이 이 게임 학습의 절반.
function playPaintOrder() {
  const subject = currentPaintSubject(state.paint ?? {});
  if (subject) speakPaint(`paint-order-${subject.id}`);
}

function paintOrderCaption() {
  const round = currentPaintRound(state.paint);
  if (!round) return "🎨 알록달록 물감 놀이";
  const color = PAINT_COLORS[round.colorId].ko;
  return `🎨 ${color}${josa(color, "을", "를")} 만들어 칠해요!`;
}

function refreshPaintScene() {
  if (!state.paint || !state.paintScene) return;
  updatePaintPlay(state.paintScene, state.paint, document);
}

function startPaintPlay() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  const seed = Math.floor(Math.random() * 0x100000000);
  // 해금 없이 시작한다 — 선반은 기본 다섯 튜브(숫자키 1~5)뿐이다.
  state.paint = createPaintPlay(state.difficulty, seed);
  state.paintBusy = false;
  state.paintScene = renderPaintPlay(document, state.paint);
  dom.stage.setAttribute("aria-live", "off");
  dom.stage.replaceChildren(state.paintScene);
  dom.problem.textContent = paintOrderCaption();
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  setPhase("playing");
  audio.playSfx("win");
  // 숫자키가 이 게임의 주 조작이다(2026-08-11 사용자 지시). 배지에 눌러야 할
  // 숫자가 찍혀 있지만, 판이 진행되며 번호가 늘어나는 규칙은 안내가 있어야
  // 아이도 부모도 안다. ←/→ + ⎵ 는 그대로 살아 있고 배지가 스스로 설명한다.
  showHint("숫자 1~5로 물감을 골라요! 새 색을 만들면 번호가 늘어나요");
  audio.cancel();
  const introRound = state.round;
  speakPaint("paint-intro");
  afterPaintVoice(introRound, playPaintOrder);
}

// 성공·불일치·혼합 이벤트를 소리·자막·연출로 옮긴다.
// 수식 낭독("빨강과 노랑을 섞으면 주황!")이 학습의 핵심 채널이다.
function handlePaintEvents(events) {
  if (!state.paint) return;
  const round = state.round;
  // 마지막 라운드는 성공 배너를 지우지 않는다 — 곧바로 피날레 문구가 들어온다
  const hasFinale = events.some(event => event.type === "finale");
  for (const event of events) {
    if (event.type === "squeeze") {
      audio.playSfx("pop");
    } else if (event.type === "locked") {
      audio.playSfx("key");
      if (event.reason === "same-color") {
        const already = PAINT_COLORS[event.color].ko;
        showHint(`${already}${josa(already, "은", "는")} 이미 담았어요! 다른 색을 골라 봐요`);
      } else {
        showHint("잠깐만요, 색을 섞는 중이에요!");
      }
    } else if (event.type === "mixed") {
      // 혼합 순간이 학습의 본체 — 수식 자막 + 색 이름 낭독을 먼저 깔고,
      // 칠하기는 PAINT_AUTO_MS 뒤 저절로 이어진다(확인 버튼 없음).
      audio.playSfx("win");
      const equation = state.paint ? paintEquationText() : "";
      // 자막을 채색(1.6초 뒤)과 낭독(약 3.2초)이 끝날 때까지 붙잡는다 —
      // 글자·소리·그림 세 채널이 같은 문장을 동시에 전한다.
      if (equation) showHint(equation, PAINT_EQUATION_HOLD_MS);
      audio.cancel();
      speakPaint(paintMixVoiceKey(event));
    } else if (event.type === "rinsed") {
      audio.playSfx("key");
    } else if (event.type === "mismatch") {
      // 색 이름은 방금 혼합 낭독이 말했다 — 여기선 격려만 이어 붙인다.
      const made = PAINT_COLORS[event.color].ko;
      const wanted = PAINT_COLORS[event.wantedColor].ko;
      const retryKey = `retry-${Math.min(state.paint.tries, 3)}`;
      afterPaintVoice(round, () => playRetryCue(audio, retryKey));
      showHint(`우와, ${made}${josa(made, "이", "가")} 됐네! 이번엔 ${wanted}${josa(wanted, "을", "를")} 만들어 보자`);
    } else if (event.type === "success") {
      state.stars += 1;
      dom.stars.textContent = String(state.stars);
      audio.playSfx("win");
      const parts = event.equation;
      const mixParts = (parts.parts ?? []).filter(Boolean);
      dom.cheer.textContent = mixParts.length >= 2
        ? `${mixParts.join(" + ")} = ${parts.result}!`
        : `${parts.result} 완성!`;
      dom.cheer.classList.add("show");
      if (!hasFinale) {
        schedule(() => {
          if (state.round === round) dom.cheer.classList.remove("show");
        }, PAINT_HOLD_MS - 500);
      }
    } else if (event.type === "unlocked") {
      // 새 물감 해금 — 이 판의 선반에 바로 붙는다. 낭독은 혼합 문장이 끝난
      // 뒤에 잇고, 피날레와 겹치는 판이면 토스트·효과음만(피날레 낭독 우선).
      audio.playSfx("jingle");
      const name = PAINT_COLORS[event.color].ko;
      showHint(
        `🔓 ${name} 물감을 얻었어요! 이제 선반에서 바로 쓸 수 있어요`,
        PAINT_EQUATION_HOLD_MS
      );
      if (!hasFinale) afterPaintVoice(round, () => speakPaint("paint-unlock"));
    } else if (event.type === "finale") {
      setPhase("celebrating");
      audio.playSfx("win");
      dom.cheer.textContent = event.rainbow
        ? "🌈 무지개 화가 탄생!"
        : "오늘의 그림을 다 그렸어요!";
      dom.cheer.classList.add("show");
      // 마지막 라운드의 혼합 문장을 끊지 않는다 — 그게 이 게임의 학습 문장이다.
      // 문장이 끝나면 피날레를 이어 붙이고, 홈 복귀는 피날레 낭독이 끝난 뒤
      // (최소 체류 시간은 지키고, 소리가 없으면 안전망 타이머가 데려간다).
      state.paintFinaleAt = performance.now();
      afterPaintVoice(round, () => {
        void speakPaint(event.rainbow ? "paint-rainbow" : "paint-finale")
          .then(fresh => {
            if (fresh) leavePaintFinale(round);
          });
      });
      schedule(() => leavePaintFinale(round), PAINT_FINALE_LIMIT_MS);
    }
  }
  // 성공 순간엔 칠해진 그림을 PAINT_HOLD_MS 동안 붙잡은 뒤 다음 라운드로 —
  // "내가 만든 색으로 칠했다"가 이 게임의 핵심 보상이다.
  const success = events.find(event => event.type === "success");
  if (success) {
    const canvas = state.paintScene?.querySelector?.(".pp-canvas");
    if (canvas) paintCanvasNode(canvas, PAINT_COLORS[success.color].hex);
    state.paintBusy = true;
    schedule(() => {
      state.paintBusy = false;
      if (state.round !== round || !state.paint) return;
      dom.problem.textContent = paintOrderCaption();
      refreshPaintScene();
      // 다음 주문은 혼합 문장이 끝난 뒤에 — 두 낭독이 겹치지 않게 한다.
      if (!state.paint.finale) afterPaintVoice(round, playPaintOrder);
    }, PAINT_HOLD_MS);
    return;
  }

  // 어긋난 색도 이름을 부르는 동안 병에 그대로 남긴다 — 모델은 이미 헹궜지만
  // 다시 그리지 않으면 화면에는 방금 만든 색이 남는다.
  if (events.some(event => event.type === "mismatch")) {
    state.paintBusy = true;
    schedule(() => {
      state.paintBusy = false;
      if (state.round !== round || !state.paint) return;
      dom.problem.textContent = paintOrderCaption();
      refreshPaintScene();
    }, PAINT_MISS_HOLD_MS);
    return;
  }

  if (state.paint) dom.problem.textContent = paintOrderCaption();
  refreshPaintScene();

  // 색이 섞였으면 확인 버튼 없이 그대로 칠한다(사용자 결정 2026-08-05).
  // 연출이 끝날 때까지 입력을 잠가 도중에 헹궈지거나 겹치지 않게 한다.
  if (events.some(event => event.type === "mixed")) {
    state.paintBusy = true;
    schedule(() => {
      state.paintBusy = false;
      if (state.round !== round || !state.paint) return;
      handlePaintEvents(paintPlayCanvas(state.paint));
    }, PAINT_AUTO_MS);
  }
}

// 혼합 완료 자막 — "빨강과 노랑을 섞으면 주황!" (수식 학습의 문장형)
// 3색 라운드는 재료가 늘고, 해금 지름길은 "주황과 하양을 섞으면 살구색!"이 된다.
function paintEquationText() {
  const equation = paintEquationFor(state.paint);
  if (!equation?.result) return "";
  const items = (equation.parts ?? []).filter(Boolean);
  if (items.length < 2) return `${equation.result} 물감이 준비됐어요!`;
  const listed = items
    .map((name, index) => index < items.length - 1
      ? `${name}${josa(name, "과", "와")}`
      : `${name}${josa(name, "을", "를")}`)
    .join(" ");
  return `${listed} 섞으면 ${equation.result}!`;
}

// ⎵ 실행 — 선반 튜브(기본+해금) 고르기, 마지막 칸 헹구기.
// 섞기·칠하기는 자동이라 버튼이 없다.
// Tab 으로 옮긴 DOM 포커스가 있으면 그쪽을 먼저 따른다 — 파란 포커스 링과
// 노란 게임 포커스가 서로 다른 칸을 가리키던 문제(2026-08-11 리뷰).
function activatePaintFocus() {
  if (!state.paint || state.paintBusy) return;
  const tubes = paintShelfTubes(state.paint);
  const active = document.activeElement;
  const focusedTube = active?.closest?.(".pp-tube");
  if (focusedTube) {
    const found = tubes.findIndex(entry => entry.id === focusedTube.dataset.tube);
    if (found >= 0) {
      state.paint.focusIndex = found;
      handlePaintEvents(paintSqueezeTube(state.paint, tubes[found].id));
      return;
    }
  }
  if (active?.closest?.(".pp-rinse")) {
    state.paint.focusIndex = tubes.length;
    handlePaintEvents(paintRinseJar(state.paint));
    return;
  }
  const index = state.paint.focusIndex;
  if (index < tubes.length) {
    handlePaintEvents(paintSqueezeTube(state.paint, tubes[index].id));
    return;
  }
  handlePaintEvents(paintRinseJar(state.paint));
}

/* ── 택배 왔어요! ─────────────────────────────────────────────────────
   네 단계(운전 → 엘리베이터 → 호수 찾기 → 전달)를 모델이 판정하고, 여기서는
   그 이벤트를 소리·자막·연출로 옮긴다. 벌점은 어디에도 없다 — 틀리면 다시
   알려 주고 다시 시킨다. 연출 중에는 deliveryBusy 로 입력을 잠근다. */

const DELIVERY_ARRIVE_MS = 1000; // 도착 여운
const DELIVERY_HANDOFF_MS = 1400; // 전달 성공 여운

// 조작할 때마다 씬을 통째로 갈아 끼우므로, 누르고 있던 버튼과 같은 버튼에
// 포커스를 되돌려 준다. 안 그러면 키보드 사용자의 포커스가 매번 사라진다.
const DELIVERY_FOCUS_KEYS = ["dvDir", "dvHorn", "dvFloor", "dvBell", "dvMove", "dvHome", "dvBeat"];

function deliveryFocusMark() {
  const active = document.activeElement;
  if (!active || !dom.stage.contains(active)) return null;
  const key = DELIVERY_FOCUS_KEYS.find(name => active.dataset?.[name] !== undefined);
  return key ? { key, value: active.dataset[key] } : null;
}

function restoreDeliveryFocus(mark) {
  if (!mark) return;
  const attribute = mark.key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const next = dom.stage.querySelector(`[data-${attribute}="${mark.value}"]`);
  if (next) next.focus();
}

function refreshDeliveryScene() {
  if (!state.delivery) return;
  const mark = deliveryFocusMark();
  state.deliveryScene = renderDelivery(document, state.delivery);
  dom.stage.replaceChildren(state.deliveryScene);
  dom.problem.textContent = deliveryCaption(state.delivery);
  restoreDeliveryFocus(mark);
}

// 모델은 이미 다음 단계로 넘어가 있을 수 있다. 연출을 위해 잠시 이전 단계 화면을 그린다.
function renderDeliveryAs(phase) {
  const model = state.delivery;
  if (!model) return;
  const real = model.phase;
  model.phase = phase;
  refreshDeliveryScene();
  model.phase = real;
}

function holdDelivery(delayMs, onDone = null) {
  const round = state.round;
  state.deliveryBusy = true;
  schedule(() => {
    if (state.round !== round || state.mode !== "delivery" || !state.delivery) return;
    state.deliveryBusy = false;
    if (onDone) onDone();
    refreshDeliveryScene();
  }, delayMs);
}

function startDeliveryRun() {
  stopSafetyHold();
  stopDeliveryBeat();
  clearTimers();
  audio.cancel();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  const seed = Math.floor(Math.random() * 0x100000000);
  state.delivery = createDelivery(state.difficulty, seed);
  state.deliveryBusy = false;
  dom.stage.setAttribute("aria-live", "off");
  refreshDeliveryScene();
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  setPhase("playing");
  audio.playSfx("win");
  void audio.playPrompt("delivery-intro");
  showHint(`${state.delivery.order.unit}호로 택배를 배달해요!`, 2200);
}

function handleDeliveryEvents(events) {
  if (events.length === 0) return;

  for (const event of events) {
    switch (event.type) {
      case "drive-step":
        audio.playSfx("pop");
        break;
      case "drive-edge":
        audio.playSfx("pop");
        showHint("여기가 단지 끝이에요. 다른 쪽으로 가 봐요!", 1400);
        break;
      case "drive-blocked":
        audio.playSfx("pop");
        void audio.playPrompt("delivery-blocked");
        showHint(
          event.kind === "pond" ? "연못이에요! 돌아서 가요." : "나무가 있어요! 돌아서 가요.",
          1600
        );
        break;
      case "drive-miss":
        // 벌점은 첫 방문 한 번뿐이다 — 같은 집을 오간다고 보너스가 끊기지 않는다.
        audio.playSfx("pop");
        void audio.playPrompt("delivery-wrong-house");
        showHint(`여기는 ${event.unit}호예요. 목표는 ${event.want}호!`, 1900);
        break;
      case "drive-arrived":
        audio.playSfx("win");
        void audio.playPrompt("delivery-arrive");
        showHint(`${event.unit}호에 도착! 상자를 내려요.`, 2000);
        holdDelivery(DELIVERY_ARRIVE_MS, startDeliveryBeat);
        break;
      case "rhythm-pass":
        audio.playSfx(event.judge === "perfect" ? "jingle" : "key");
        showHint(
          event.judge === "perfect"
            ? `박자 딱! 상자 ${event.loaded}개!`
            : `좋아요! 상자 ${event.loaded}개!`,
          1100
        );
        break;
      case "rhythm-miss":
        // 벌점 없음 — 상자는 그대로 있고 다음 박자에 다시 하면 된다.
        audio.playSfx("pop");
        showHint("괜찮아요! 동그라미가 좁아질 때 눌러요.", 1300);
        break;
      case "rhythm-done":
        audio.playSfx("win");
        stopDeliveryBeat();
        state.deliveryBusy = true;
        showHint("상자를 다 실었어요! 엘리베이터로 가요.", 1600);
        holdDelivery(DELIVERY_ARRIVE_MS, () => {
          if (state.mode !== "delivery" || !state.delivery) return;
          handleDeliveryEvents(boardElevator(state.delivery));
        });
        break;
      case "rhythm-boarding":
        audio.playSfx("door");
        void audio.playPrompt("delivery-arrive");
        showHint(`${event.floor}층으로 올라가요!`, 1600);
        break;
      case "floor-wrong":
        audio.playSfx("pop");
        void audio.playPrompt("delivery-floor-wrong");
        showHint(`${event.digit}층이 아니에요. ${event.target}층을 눌러요!`, 1900);
        break;
      case "elevator-arrived":
        audio.playSfx("door");
        void audio.playPrompt("delivery-floor-ok");
        showHint(`${event.to}층이에요! 문이 열려요.`, 1800);
        break;
      case "corridor-focus":
        audio.playSfx("key");
        showHint(`${event.unit}호 문`, 900);
        break;
      case "corridor-edge":
      case "tray-edge":
        audio.playSfx("pop");
        break;
      case "corridor-wrong":
        audio.playSfx("bell");
        void audio.playPrompt("delivery-door-wrong");
        showHint(`여기는 ${event.unit}호예요. ${event.want}호를 찾아요!`, 1900);
        break;
      case "corridor-correct": {
        audio.playSfx("bell");
        const asked = parcelById(state.delivery.order.parcel);
        const askedRound = state.round;
        const askedUnit = state.delivery.order.unit;
        void audio.playPrompt("delivery-bell").then(() => {
          // 낭독이 끝났을 때 이미 다음 배송으로 넘어갔다면 이어 읽지 않는다.
          const still = state.mode === "delivery" && state.round === askedRound &&
            state.delivery?.order.unit === askedUnit;
          if (still && asked) void audio.playPrompt(`delivery-parcel-${asked.id}`);
        });
        showHint("딩동! 문이 열려요.", 1600);
        break;
      }
      case "tray-focus": {
        audio.playSfx("key");
        const picked = parcelById(event.parcel);
        if (picked) showHint(picked.label, 900);
        break;
      }
      case "parcel-wrong": {
        const wanted = parcelById(event.want);
        audio.playSfx("pop");
        void audio.playPrompt("delivery-parcel-wrong");
        showHint(`친구는 ${wanted ? wanted.label : "다른 물건"}를 기다려요!`, 2000);
        break;
      }
      case "parcel-correct":
        audio.playSfx("win");
        void audio.playPrompt("delivery-parcel-ok");
        break;
      case "delivered":
        state.stars += 1;
        dom.stars.textContent = String(state.stars);
        showHint(`고마워요! 택배 ${event.delivered}개 전달했어요.`, 2000);
        break;
      case "next-order":
        showHint(`다음은 ${event.unit}호예요!`, 2000);
        void audio.playPrompt("delivery-intro");
        break;
      case "finale":
        audio.playSfx("jingle");
        void audio.playPrompt("delivery-finale");
        break;
      default:
        break;
    }
  }

  // 초인종·전달 성공은 그 장면을 잠깐 남겨 둔다. 나머지는 곧바로 새로 그린다.
  if (events.some(event => event.type === "corridor-correct")) {
    holdDelivery(DELIVERY_ARRIVE_MS);
    return;
  }
  if (events.some(event => event.type === "parcel-correct")) {
    holdDelivery(DELIVERY_HANDOFF_MS);
    return;
  }
  if (events.some(event => event.type === "elevator-arrived")) {
    renderDeliveryAs("elevator");
    holdDelivery(DELIVERY_ARRIVE_MS);
    return;
  }
  refreshDeliveryScene();
}

function deliveryActionable() {
  return state.phase === "playing" && state.mode === "delivery" &&
    Boolean(state.delivery) && !state.deliveryBusy;
}

// 5번 게임과 같은 문법 — 누르면 그 자리에서 한 칸 간다.
function deliveryDrive(direction) {
  if (!deliveryActionable()) return;
  handleDeliveryEvents(driveDeliveryStep(state.delivery, direction));
}

// 경적은 판정이 없다. 아이가 아무 때나 눌러도 되는 유일한 버튼이다.
function deliveryHorn() {
  if (!deliveryActionable() || state.delivery.phase !== "drive") return;
  audio.playSfx("horn");
  showHint("빵빵! 친구들이 손을 흔들어요.", 1200);
}

function deliveryFloor(digit) {
  if (!deliveryActionable()) return;
  handleDeliveryEvents(pressFloor(state.delivery, digit));
}

function deliveryMove(delta) {
  if (!deliveryActionable()) return;
  const model = state.delivery;
  if (model.phase === "corridor") {
    handleDeliveryEvents(moveCorridorFocus(model, delta));
  } else if (model.phase === "handover") {
    handleDeliveryEvents(moveTrayFocus(model, delta));
  }
}

/* 박자 시계 — 리듬 하역 무대에서만 돈다. 모델은 시계를 모르므로
   "무대가 열린 뒤 흐른 밀리초"를 여기서 재어 넣어 준다. */
let deliveryBeatTimer = null;
let deliveryBeatStart = 0;

function stopDeliveryBeat() {
  if (deliveryBeatTimer === null) return;
  clearInterval(deliveryBeatTimer);
  deliveryBeatTimer = null;
}

function startDeliveryBeat() {
  stopDeliveryBeat();
  deliveryBeatStart = performance.now();
  // 박이 넘어간 것을 늦지 않게 알아채려고 촘촘히 보되, 다시 그리는 것은 박마다 한 번이다.
  deliveryBeatTimer = setInterval(() => {
    if (state.mode !== "delivery" || state.delivery?.phase !== "rhythm") {
      stopDeliveryBeat();
      return;
    }
    if (state.deliveryBusy) return;
    const events = tickRhythm(state.delivery, performance.now() - deliveryBeatStart);
    if (events.length === 0) return;
    audio.playSfx("key");
    renderDeliveryAs("rhythm");
  }, 60);
}

function deliveryBeat() {
  if (!deliveryActionable() || state.delivery.phase !== "rhythm") return;
  handleDeliveryEvents(passRhythmBox(state.delivery, performance.now() - deliveryBeatStart));
}

function deliveryBell() {
  if (!deliveryActionable()) return;
  const model = state.delivery;
  if (model.phase === "rhythm") {
    deliveryBeat();
  } else if (model.phase === "corridor") {
    handleDeliveryEvents(ringDeliveryBell(model));
  } else if (model.phase === "handover") {
    handleDeliveryEvents(deliverParcel(model));
  } else if (model.phase === "elevator") {
    audio.playSfx("bell");
    showHint(`${model.elevator.target}층 버튼을 눌러요!`, 1600);
  } else if (model.phase === "finale") {
    goHome();
  }
}

// ── 슥삭 그림 퀴즈 ────────────────────────────────────────────────────────
// 슥삭이(붓)가 이모지 그림을 붓칠로 서서히 공개하고, 아이가 카드 4장에서
// 정답을 고른다. 규칙·별 판정은 catchmind-model.mjs, 화면은 catchmind-scene.mjs.

// 저장은 한 번 읽어 메모리에 들고 쓰기만 시도한다 — localStorage 가 막힌
// 환경(사파리 프라이빗)에서도 판 안에서는 정상 동작한다(문서 §9-2-6).
function catchmindRead(key, fallback) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function catchmindWrite(key, value) {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(value));
  } catch {
    // 메모리 사본이 진실 — 저장 실패는 조용히 넘긴다
  }
}

let catchmindRecent = Array.isArray(catchmindRead("nbmg.catchmind.recent", []))
  ? catchmindRead("nbmg.catchmind.recent", [])
  : [];
const catchmindCollected = new Set(
  Array.isArray(catchmindRead("nbmg.catchmind.collected", []))
    ? catchmindRead("nbmg.catchmind.collected", [])
    : []
);
let catchmindBest = Number(catchmindRead("nbmg.catchmind.best", 0)) || 0;
// 다음에 도전할 단계 — 단계를 완료할 때마다 올려 저장하므로,
// 게임을 껐다 켜도 도달한 단계에서 이어서 시작한다.
let catchmindStage = Math.max(
  1,
  Math.floor(Number(catchmindRead("nbmg.catchmind.stage", 1))) || 1
);

function catchmindCaption() {
  return "슥삭이가 무엇을 그리는 걸까요?";
}

function renderCatchmindStage() {
  const scene = renderCatchmindRound(document, state.catchmind);
  state.catchmindScene = scene;
  dom.stage.replaceChildren(scene);
  state.catchmindReveal = setupCatchmindReveal(
    scene,
    currentCatchmindRound(state.catchmind).item
  );
  dom.problem.textContent = catchmindCaption();
  updateCatchmindScene(scene, state.catchmind);
}

function startCatchmind(stage = catchmindStage) {
  stopSafetyHold();
  clearTimers(); // 재진입 시 이전 틱 체인이 겹돌지 않게 먼저 끊는다
  audio.cancel();
  state.round += 1;
  state.problem = null;
  state.buffer = "";
  state.catchmind = createCatchmind(stage, Date.now() >>> 0, {
    recent: catchmindRecent
  });
  state.catchmindBusy = false;
  state.catchmindView = "game";
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  renderCatchmindStage();
  setPhase("playing");
  audio.playSfx("jingle");
  showHint("스케치만 보고 맞히면 별 3개!");
  void audio.playPrompt("catchmind-intro");
  scheduleCatchmindTick();
}

function scheduleCatchmindTick(previousMs = performance.now()) {
  schedule(() => {
    if (state.mode !== "catchmind" || !state.catchmind) return;
    const nowMs = performance.now();
    // 탭이 숨겨졌던 시간은 별 판정·힌트 타이머에 넣지 않는다(상한 200ms).
    const delta = Math.min(200, nowMs - previousMs);
    const model = state.catchmind;
    if (model.phase === "drawing" || model.phase === "guess") {
      handleCatchmindEvents(tickCatchmind(model, delta));
      if (state.catchmind === model) {
        if (state.catchmindReveal) {
          paintCatchmindReveal(
            state.catchmindReveal, model.step, model.stepProgress
          );
        }
        if (state.catchmindScene) {
          updateCatchmindScene(state.catchmindScene, model);
        }
      }
    }
    scheduleCatchmindTick(nowMs);
  }, 33);
}

function handleCatchmindEvents(events) {
  for (const event of events) {
    switch (event.type) {
      case "step-done":
        // 한 단계를 다 그리고 펜을 내려놓는 작은 신호 + 물음 낭독.
        audio.playSfx("key");
        audio.cancel();
        void audio.playPrompt(event.final ? "catchmind-done" : "catchmind-guess");
        if (!event.final) showHint("무슨 그림일까요? 못 맞히면 더 그려 줄게요");
        break;
      case "step":
        // 8초 안에 못 맞혀서 다음 단계를 그리기 시작한다.
        audio.playSfx("pop");
        audio.cancel();
        void audio.playPrompt(
          event.step === 2 ? "catchmind-form" : "catchmind-finish"
        );
        showHint(
          event.step === 2
            ? "이번엔 자세히 그려 볼게요!"
            : "이제 색칠해 볼게요!"
        );
        break;
      case "rescue-pulse":
        audio.playSfx("bell");
        audio.cancel();
        void audio.playPrompt("catchmind-rescue");
        showHint("반짝이는 카드를 눌러 봐요!");
        break;
      case "wrong": {
        audio.cancel();
        playRetryCue(
          audio,
          `retry-${Math.min(state.catchmind.wrong.length, 3)}`
        );
        const card = state.catchmindScene?.querySelector(
          `[data-cm-card="${event.index}"]`
        );
        if (card) replayClass(card, "shake");
        showHint("괜찮아요! 다른 그림을 골라 봐요");
        break;
      }
      case "correct":
        startCatchmindCelebrate(event);
        break;
    }
  }
}

function startCatchmindCelebrate({ stars, item }) {
  const model = state.catchmind;
  state.catchmindBusy = true;
  audio.cancel();
  // 오답 직후의 "괜찮아요" 토스트가 축하 화면까지 남지 않게 지운다.
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  audio.playSfx("win");
  void audio.playVoice(`cheer-${1 + (model.roundIndex % 4)}`);
  state.stars += stars;
  dom.stars.textContent = String(state.stars);
  updateCatchmindScene(state.catchmindScene, model);
  dom.problem.textContent = `정답! ${item.n}`;

  // ① 남은 선을 마저 긋고 ② 채색이 차오른 뒤 ③ 이름 배너 — 문서 §4-4 순서.
  if (state.catchmindReveal) paintCatchmindReveal(state.catchmindReveal, 3, 1);
  [180, 380, 580].forEach(delay => {
    schedule(() => {
      if (state.catchmind === model && state.catchmindReveal) {
        paintCatchmindColorIn(state.catchmindReveal, 0.5);
      }
    }, delay);
  });
  schedule(() => {
    if (state.catchmind === model && state.catchmindScene) {
      showCatchmindCelebrate(state.catchmindScene, item, stars);
    }
  }, 800);

  // 도감 수집 + 최근 출제 큐(다음 판 중복 방지, 최근 40개)
  catchmindCollected.add(item.n);
  catchmindWrite("nbmg.catchmind.collected", [...catchmindCollected]);
  catchmindRecent = [...catchmindRecent, item.n].slice(-40);
  catchmindWrite("nbmg.catchmind.recent", catchmindRecent);

  for (let i = 0; i < stars; i += 1) {
    schedule(() => audio.playSfx("bell"), 900 + i * 220);
  }
  schedule(() => {
    if (state.catchmind !== model) return;
    for (const event of advanceCatchmind(model)) {
      if (event.type === "round") {
        state.catchmindBusy = false;
        audio.playSfx("jingle");
        renderCatchmindStage();
      } else if (event.type === "result") {
        showCatchmindResult();
      }
    }
  }, 2200);
}

function showCatchmindResult() {
  const model = state.catchmind;
  state.catchmindBusy = false;
  state.catchmindView = "result";
  state.catchmindReveal = null;
  if (model.totalStars > catchmindBest) {
    catchmindBest = model.totalStars;
    catchmindWrite("nbmg.catchmind.best", catchmindBest);
  }
  // 단계 완료가 곧 진행 저장 — 결과 화면에서 꺼도 다음엔 다음 단계부터.
  if (model.stage + 1 > catchmindStage) {
    catchmindStage = model.stage + 1;
    catchmindWrite("nbmg.catchmind.stage", catchmindStage);
  }
  const scene = renderCatchmindResult(document, model, catchmindBest);
  state.catchmindScene = scene;
  dom.stage.replaceChildren(scene);
  dom.problem.textContent = `다 맞혔어요! 별 ${model.totalStars}개`;
  audio.playSfx("jingle");
  audio.cancel();
  void audio.playPrompt("catchmind-finale");
  scene.querySelector("[data-cm-action='next']")?.focus?.();
}

function showCatchmindCollection(tab = state.catchmindTab) {
  state.catchmindView = "collection";
  state.catchmindTab = tab;
  const scene = renderCatchmindCollection(document, catchmindCollected, tab);
  state.catchmindScene = scene;
  dom.stage.replaceChildren(scene);
  dom.problem.textContent = "그림 도감 — 맞힌 그림이 모여요";
  scene.querySelector(".cm-tab.active")?.focus?.();
}

function catchmindGuess(index) {
  if (!state.catchmind || state.catchmindBusy) return;
  const events = guessCatchmindCard(state.catchmind, index);
  if (events.length === 0) return; // 비활성 카드 — 무반응(문서 §6-4)
  handleCatchmindEvents(events);
  if (state.catchmind && state.catchmindScene && !state.catchmindBusy) {
    updateCatchmindScene(state.catchmindScene, state.catchmind);
  }
}

function catchmindAction(action) {
  audio.playSfx("key");
  if (action === "next") startCatchmind(catchmindStage);
  else if (action === "collection") showCatchmindCollection();
  else if (action === "back") showCatchmindResult();
  else if (action === "home") goHome();
}

function moveCatchmindFocus(delta, selector) {
  const scene = state.catchmindScene;
  if (!scene) return;
  const buttons = [...scene.querySelectorAll(selector)].filter(
    button => !button.disabled
  );
  if (buttons.length === 0) return;
  const current = buttons.indexOf(document.activeElement);
  const next =
    current === -1
      ? delta > 0 ? 0 : buttons.length - 1
      : (current + delta + buttons.length) % buttons.length;
  buttons[next].focus();
  audio.playSfx("key");
}

function startMode(mode) {
  if (!isModeAvailable(mode, state.difficulty)) {
    showHint("도전에서는 더하기, 빼기와 곱하기를 해요.");
    return;
  }
  stopSafetyHold();
  setMode(mode);
  state.srt = null;
  state.srtScene = null;
  state.subway = null;
  state.subwayScene = null;
  state.subwayChoosing = false;
  state.ktx = null;
  state.ktxScene = null;
  state.ktxPicking = false;
  state.paint = null;
  state.paintScene = null;
  state.paintBusy = false;
  state.delivery = null;
  state.deliveryScene = null;
  state.deliveryBusy = false;
  state.catchmind = null;
  state.catchmindScene = null;
  state.catchmindReveal = null;
  state.catchmindBusy = false;
  state.catchmindView = "game";
  stopDeliveryBeat();
  if (mode === "safety") {
    startSafetyRoute();
  } else if (mode === "subway") {
    state.safety = null;
    state.safetyView = null;
    startSubwayJourney();
  } else if (mode === "ktx") {
    state.safety = null;
    state.safetyView = null;
    startKtxPicker();
  } else if (mode === "paint") {
    state.safety = null;
    state.safetyView = null;
    startPaintPlay();
  } else if (mode === "delivery") {
    state.safety = null;
    state.safetyView = null;
    startDeliveryRun();
  } else if (mode === "catchmind") {
    state.safety = null;
    state.safetyView = null;
    startCatchmind();
  } else {
    state.safety = null;
    state.safetyView = null;
    newProblem();
  }
  focusPhase(state.phase, {
    game: dom.game,
    homeControl: availableHomeControl()
  });
}

function goHome() {
  stopSafetyHold();
  clearTimers();
  audio.cancel();
  audio.stopEngine();
  state.round += 1;
  state.problem = null;
  state.safety = null;
  state.safetyView = null;
  state.safetyVoiceKey = null;
  state.srt = null;
  state.srtScene = null;
  state.subway = null;
  state.subwayScene = null;
  state.subwayChoosing = false;
  state.ktx = null;
  state.ktxScene = null;
  state.ktxPicking = false;
  state.ktxHeld = { up: false, down: false };
  state.paint = null;
  state.paintScene = null;
  state.paintBusy = false;
  state.delivery = null;
  state.deliveryScene = null;
  state.deliveryBusy = false;
  state.catchmind = null;
  state.catchmindScene = null;
  state.catchmindReveal = null;
  state.catchmindBusy = false;
  state.catchmindView = "game";
  dom.stage.setAttribute("aria-live", "polite");
  state.buffer = "";
  setMode(null);
  dom.cheer.classList.remove("show");
  dom.hint.className = "toast";
  dom.hint.textContent = "";
  dom.cheer.textContent = "";
  setPhase("home");
  focusPhase(state.phase, {
    game: dom.game,
    homeControl: availableHomeControl()
  });
}

function syncMuteButton() {
  dom.mute.setAttribute("aria-pressed", String(audio.muted));
  dom.mute.setAttribute("aria-label", audio.muted ? "소리 켜기" : "소리 끄기");
  dom.muteIcon.textContent = audio.muted ? "×" : "♪";
}

modeControls.forEach(button => {
  button.addEventListener("click", () => startMode(button.dataset.mode));
});

difficultyControls.forEach(button => {
  button.addEventListener("click", () => {
    audio.playSfx("key");
    setDifficulty(button.dataset.difficulty);
  });
});

numberPadDigits.forEach(button => {
  button.addEventListener("click", () => onDigit(button.dataset.digit));
});

dom.numberPadDelete.addEventListener("click", deleteDigit);
dom.stage.addEventListener("pointerdown", event => {
  const button = event.target.closest("[data-route-direction]");
  if (!button) return;
  event.preventDefault();
  if (state.mode === "safety" && state.safety?.tourActive) {
    endSafetyTour();
    return;
  }
  button.blur?.();
  button.setPointerCapture?.(event.pointerId);
  startSafetyHold(button.dataset.routeDirection);
});
document.addEventListener("keyup", event => {
  if (state.mode !== "ktx" || !state.ktx) return;
  if (event.key === "ArrowUp") {
    state.ktxHeld = { ...state.ktxHeld, up: false };
  } else if (event.key === "ArrowDown") {
    state.ktxHeld = { ...state.ktxHeld, down: false };
  } else {
    return;
  }
  // 레버 0-지연 반응 — 다음 틱을 기다리지 않는다
  if (state.ktxScene) {
    updateKtxScene(state.ktxScene, state.ktx, state.ktxView, [], state.ktxHeld);
  }
});

dom.stage.addEventListener("click", event => {
  // 슥삭 그림 퀴즈 — 카드·힌트·결과 버튼·도감 탭을 한자리에서 받는다.
  if (state.mode === "catchmind" && state.catchmind && state.phase === "playing") {
    const card = event.target.closest("[data-cm-card]");
    if (card && !state.catchmindBusy) {
      catchmindGuess(Number(card.dataset.cmCard));
      return;
    }
    const action = event.target.closest("[data-cm-action]");
    if (action) {
      catchmindAction(action.dataset.cmAction);
      return;
    }
    const tab = event.target.closest("[data-cm-tab]");
    if (tab) {
      audio.playSfx("key");
      showCatchmindCollection(tab.dataset.cmTab);
      return;
    }
  }
  // 택배 왔어요! — 방향·출발·층·벨·좌우 버튼을 한자리에서 받는다.
  if (state.mode === "delivery" && state.delivery && state.phase === "playing" &&
      !state.deliveryBusy) {
    // 아래 목록은 delivery-scene 이 실제로 렌더하는 키와 정확히 같아야 한다.
    // horn·beat 이 빠져 있어 '빵빵!'과 '박자!' 버튼이 클릭·터치에 완전 무반응이었다
    // — 키보드 없는 태블릿에서는 리듬 하역이 유일한 진행 수단이라 씬 ②에서
    // 영구 정지였다(심층 검토 P0-2). go·clear 는 렌더되지 않는 이름이라 뺀다.
    const control = event.target.closest(
      "[data-dv-dir],[data-dv-horn],[data-dv-beat],[data-dv-floor]," +
      "[data-dv-bell],[data-dv-move],[data-dv-home]"
    );
    if (control) {
      const data = control.dataset;
      if (data.dvDir) deliveryDrive(data.dvDir);
      else if (data.dvHorn) deliveryHorn();
      else if (data.dvFloor) deliveryFloor(Number(data.dvFloor));
      else if (data.dvMove) deliveryMove(Number(data.dvMove));
      else if (data.dvBeat) deliveryBeat();
      else if (data.dvHome) goHome();
      else if (data.dvBell) deliveryBell();
      return;
    }
  }
  if (state.mode === "paint" && state.paint && state.phase === "playing" &&
      !state.paintBusy) {
    const tubeButton = event.target.closest(".pp-tube");
    if (tubeButton) {
      const tubes = paintShelfTubes(state.paint);
      const index = tubes.findIndex(
        entry => entry.id === tubeButton.dataset.tube
      );
      if (index >= 0) {
        state.paint.focusIndex = index;
        handlePaintEvents(paintSqueezeTube(state.paint, tubeButton.dataset.tube));
      }
      return;
    }
    if (event.target.closest(".pp-rinse")) {
      state.paint.focusIndex = paintShelfTubes(state.paint).length;
      handlePaintEvents(paintRinseJar(state.paint));
      return;
    }
  }
  const branchChoice = event.target.closest(".ktx-branch-choice");
  if (branchChoice && state.mode === "ktx" && state.ktx?.phase === "branch") {
    const picked = selectKtxRoute(state.ktx, branchChoice.dataset.route);
    state.ktx = picked.state;
    audio.playSfx("key");
    updateKtxScene(state.ktxScene, state.ktx, state.ktxView, picked.events,
      state.ktxHeld);
    return;
  }
  const trainCard = event.target.closest("[data-train-id]");
  if (trainCard && state.mode === "ktx" && state.ktxPicking) {
    audio.playSfx("key");
    startKtxJourney(trainCard.dataset.trainId);
    return;
  }
  const bonusCard = event.target.closest('[data-bonus="family"]');
  if (bonusCard && state.mode === "subway" && state.subwayChoosing) {
    audio.playSfx("key");
    startFamilyLine();
    return;
  }
  const card = event.target.closest("[data-place-id]");
  if (card && state.mode === "subway" && state.subwayChoosing) {
    audio.playSfx("key");
    startSubwayRide(card.dataset.placeId);
    return;
  }
  const lineButton = event.target.closest("[data-line-number]");
  if (lineButton && state.subway?.phase === "gate") {
    chooseSubwayLineInput(Number(lineButton.dataset.lineNumber));
    lineButton.blur?.();
    return;
  }
  const button = event.target.closest("[data-route-direction]");
  if (!button || event.detail !== 0) return;
  if (state.subway) moveSubway(button.dataset.routeDirection);
  else if (state.srt) moveSrt(button.dataset.routeDirection);
  else moveSafetyRoute(button.dataset.routeDirection);
});
document.addEventListener("pointerup", stopSafetyHold);
document.addEventListener("pointercancel", stopSafetyHold);
dom.stage.addEventListener("pointerleave", stopSafetyHold);

dom.homeButton.addEventListener("click", goHome);
dom.mute.addEventListener("click", () => {
  audio.toggleMuted();
  syncMuteButton();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    goHome();
    return;
  }

  // 목적지 열 곳이 숫자키를 다 써서 보너스는 스페이스바로 들어간다.
  if (
    state.phase === "playing" && state.mode === "subway" &&
    state.subwayChoosing && (event.key === " " || event.key === "Spacebar")
  ) {
    event.preventDefault();
    if (!event.repeat) {
      audio.playSfx("key");
      // 포커스가 목적지 카드에 있으면 그 카드를 고른다. 무조건 가족 노선을
      // 시작하면, 홈에서 "화살표로 고르고 ⎵" 를 방금 배운 아이가 그대로 했을 때
      // 엉뚱한 2환승 최장 여정에 던져진다(심층 검토 P1-5). 가족 노선은 카드에
      // 포커스가 없을 때의 단축키로만 남긴다.
      const focusedPlace = document.activeElement?.closest?.("[data-place-id]");
      if (focusedPlace) startSubwayRide(focusedPlace.dataset.placeId);
      else startFamilyLine();
    }
    return;
  }

  // 물감 놀이 — ←/→ 포커스, ⎵ 고르기, 숫자키 = 튜브. 섞기·칠하기는 자동.
  if (state.phase === "playing" && state.mode === "paint" && state.paint) {
    // 자동 혼합·채색 연출 중엔 조작 키를 먹는다(Esc는 위에서 이미 처리)
    if (state.paintBusy) {
      if (event.key === " " || event.key === "Spacebar" ||
          event.key === "Enter" || event.key === "ArrowLeft" ||
          event.key === "ArrowRight" || /^[0-9]$/.test(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (!event.repeat) {
        movePaintFocus(state.paint, event.key === "ArrowRight" ? 1 : -1);
        audio.playSfx("key");
        refreshPaintScene();
      }
      return;
    }
    if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
      event.preventDefault();
      if (!event.repeat) activatePaintFocus();
      return;
    }
    // 숫자키 = 선반 슬롯(1..9, 0). 해금한 내 물감도 같은 규칙으로 잡힌다 —
    // 키를 위치에서 뽑기 때문에 클릭·⎵ 경로와 인덱스 공간이 하나로 유지된다.
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      if (event.repeat) return;
      const picked = paintTubeForDigit(state.paint, event.key);
      if (picked) {
        state.paint.focusIndex = picked.index;
        handlePaintEvents(paintSqueezeTube(state.paint, picked.tube.id));
      } else {
        // 빈 칸을 누른 것 — 예전엔 물감을 짤 때와 똑같은 pop 이 나서
        // 글을 못 읽는 아이가 성공한 줄 알았다(2026-08-11 리뷰).
        audio.playSfx("key");
        showHint(`${event.key}번 물감은 아직 없어요! 다른 번호를 눌러 봐요`);
      }
      return;
    }
    return;
  }

  // 택배 왔어요! — 단계마다 쓰는 키가 다르다. 새 키는 없다(숫자·화살표·Space·Esc).
  if (state.phase === "playing" && state.mode === "delivery" && state.delivery) {
    // 버튼에 포커스가 있으면 브라우저가 눌러 주게 둔다 — 여기서 가로채면
    // HUD 의 처음·소리 버튼까지 키보드로 못 누르게 된다.
    const onButton = typeof event.target?.closest === "function" &&
      Boolean(event.target.closest("button"));
    const isSpace = !onButton &&
      (event.key === " " || event.key === "Spacebar" || event.key === "Enter");
    const isDigit = /^[0-9]$/.test(event.key);
    const direction = directionForKey(event.key);

    // 연출 중에는 조작 키를 먹는다(Esc는 위에서 이미 처리했다).
    if (state.deliveryBusy) {
      if (isSpace || isDigit || direction) event.preventDefault();
      return;
    }

    const model = state.delivery;

    if (model.phase === "drive") {
      if (direction) {
        event.preventDefault();
        // 5번 게임과 같은 반복 규칙 — 꾹 눌러도 140ms 에 한 칸씩만 간다.
        const nowMs = performance.now();
        if (acceptSafetyRepeat({
          repeat: event.repeat,
          nowMs,
          previousMs: state.deliveryLastStepAt
        })) {
          state.deliveryLastStepAt = nowMs;
          deliveryDrive(direction);
        }
        return;
      }
      if (isSpace) {
        event.preventDefault();
        if (!event.repeat) deliveryHorn();
        return;
      }
      if (isDigit || event.key === "Backspace") {
        event.preventDefault();
        audio.playSfx("pop");
      }
      return;
    }

    if (model.phase === "rhythm") {
      if (isSpace) {
        event.preventDefault();
        if (!event.repeat) deliveryBeat();
        return;
      }
      if (isDigit || direction || event.key === "Backspace") event.preventDefault();
      return;
    }

    if (model.phase === "elevator") {
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        if (!event.repeat) deliveryFloor(Number(event.key));
        return;
      }
      if (isSpace) {
        event.preventDefault();
        if (!event.repeat) deliveryBell();
        return;
      }
      if (isDigit || direction || event.key === "Backspace") event.preventDefault();
      return;
    }

    if (model.phase === "corridor" || model.phase === "handover") {
      if (direction === "left" || direction === "right") {
        event.preventDefault();
        if (!event.repeat) deliveryMove(direction === "right" ? 1 : -1);
        return;
      }
      if (isSpace) {
        event.preventDefault();
        if (!event.repeat) deliveryBell();
        return;
      }
      if (isDigit || direction || event.key === "Backspace") {
        event.preventDefault();
        audio.playSfx("pop");
      }
      return;
    }

    if (model.phase === "finale") {
      if (isSpace) {
        event.preventDefault();
        if (!event.repeat) goHome();
        return;
      }
      if (isDigit || direction || event.key === "Backspace") event.preventDefault();
      return;
    }
    return;
  }

  // 슥삭 그림 퀴즈 — 숫자 1~4 = 카드, ←/→ 포커스, ⎵/Enter = 포커스 실행.
  if (state.phase === "playing" && state.mode === "catchmind" && state.catchmind) {
    const model = state.catchmind;
    const isSpace =
      event.key === " " || event.key === "Spacebar" || event.key === "Enter";
    const isDigit = /^[0-9]$/.test(event.key);
    const isArrow = event.key === "ArrowLeft" || event.key === "ArrowRight";

    // 축하 연출 중엔 조작 키를 먹는다(Esc는 위에서 이미 처리).
    if (state.catchmindBusy) {
      if (isSpace || isDigit || isArrow || event.key === "Backspace") {
        event.preventDefault();
      }
      return;
    }

    // 결과·도감 — ←/→로 버튼을 오가고, 실행은 버튼의 기본 Space/Enter.
    if (model.phase === "result" || state.catchmindView !== "game") {
      if (isArrow) {
        event.preventDefault();
        if (!event.repeat) {
          moveCatchmindFocus(
            event.key === "ArrowRight" ? 1 : -1,
            "[data-cm-action],[data-cm-tab]"
          );
        }
        return;
      }
      if (isDigit || event.key === "Backspace") {
        event.preventDefault();
        if (!event.repeat) audio.playSfx("pop");
        return;
      }
      return;
    }

    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) catchmindGuess(Number(event.key) - 1);
      return;
    }
    if (isDigit || event.key === "Backspace") {
      event.preventDefault();
      if (!event.repeat) audio.playSfx("pop");
      return;
    }
    if (isArrow) {
      event.preventDefault();
      if (!event.repeat) {
        moveCatchmindFocus(
          event.key === "ArrowRight" ? 1 : -1,
          "[data-cm-card]"
        );
      }
      return;
    }
    if (isSpace) {
      // 버튼에 포커스가 있으면 브라우저 기본 클릭에 맡긴다(택배와 같은 규칙).
      const onButton =
        typeof event.target?.closest === "function" &&
        Boolean(event.target.closest("button"));
      if (!onButton) {
        event.preventDefault();
        if (!event.repeat) moveCatchmindFocus(1, "[data-cm-card]");
      }
      return;
    }
    return;
  }

  // 기관사 게임 — 열차 고르기와 운전이 키를 먼저 가져간다.
  if (state.phase === "playing" && state.mode === "ktx") {
    if (state.ktxPicking) {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        if (!event.repeat) {
          const delta = event.key === "ArrowRight" ? 1 : -1;
          state.ktxPickIndex =
            (state.ktxPickIndex + delta + KTX_TRAINS.length) % KTX_TRAINS.length;
          movePickerSelection(state.ktxScene, state.ktxPickIndex);
          audio.playSfx("key");
        }
        return;
      }
      if (event.key === " " || event.key === "Spacebar" || event.key === "Enter") {
        event.preventDefault();
        if (!event.repeat) {
          startKtxJourney(KTX_TRAINS[state.ktxPickIndex].id);
        }
        return;
      }
      return;
    }
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat) moveKtxSpace();
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (!event.repeat) {
        state.ktxHeld = {
          ...state.ktxHeld,
          [event.key === "ArrowUp" ? "up" : "down"]: true
        };
        if (state.ktx && state.ktxScene) {
          updateKtxScene(state.ktxScene, state.ktx, state.ktxView, [],
            state.ktxHeld);
        }
      }
      return;
    }
    if (event.key === "1" || event.key === "3") {
      event.preventDefault();
      if (!event.repeat) switchKtxView(event.key === "1" ? "cab" : "side");
      return;
    }
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) audio.playSfx("pop");
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      if (event.repeat) return;
      if (state.ktx?.phase === "branch") {
        const routeId = event.key === "ArrowLeft" ? "mokpo" : "busan";
        const picked = selectKtxRoute(state.ktx, routeId);
        state.ktx = picked.state;
        if (picked.events.length > 0) audio.playSfx("key");
        updateKtxScene(state.ktxScene, state.ktx, state.ktxView, picked.events,
          state.ktxHeld);
        return;
      }
      audio.playSfx("pop");
      return;
    }
  }

  // 사진 찍는 동안에는 사진 쪽이 방향키와 스페이스바를 먼저 가져간다.
  if (
    state.phase === "playing" && state.mode === "subway" &&
    state.subway?.photo && !state.subway.photo.taken
  ) {
    if (event.key === " " || event.key === "Spacebar") {
      event.preventDefault();
      if (!event.repeat) movePhoto("space");
      return;
    }
    const photoDirection = directionForKey(event.key);
    if (photoDirection) {
      event.preventDefault();
      if (!event.repeat) movePhoto(photoDirection);
      return;
    }
  }

  if (state.phase === "playing" && state.mode === "subway" && state.subway) {
    if (event.key === " " || event.key === "Spacebar") {
      // every subway phase owns the spacebar — it must never scroll the page
      event.preventDefault();
      if (!event.repeat) moveSubway("space");
      return;
    }
    const direction = directionForKey(event.key);
    if (direction) {
      event.preventDefault();
      // Walking a whole car one press at a time is too much for small hands,
      // so holding left/right keeps stepping — but only walking repeats.
      if (event.repeat) {
        if (direction !== "left" && direction !== "right") return;
        if (state.subwayHoldBlock) return;
        const now = performance.now();
        if (now - state.subwayWalkMs < WALK_REPEAT_MS) return;
        state.subwayWalkMs = now;
      } else {
        state.subwayHoldBlock = false;
        state.subwayWalkMs = performance.now();
      }
      moveSubway(direction);
      return;
    }
  }

  if (
    state.phase === "playing" &&
    state.mode === "safety"
  ) {
    if (state.safety?.tourActive) {
      event.preventDefault();
      endSafetyTour();
      return;
    }
    const direction = directionForKey(event.key);
    const nowMs = performance.now();
    if (direction) {
      event.preventDefault();
      if (acceptSafetyRepeat({
        repeat: event.repeat,
        nowMs,
        previousMs: state.safetyView?.lastMoveAt ?? 0
      })) {
        state.safetyView.lastMoveAt = nowMs;
        if (state.srt) moveSrt(direction);
        else moveSafetyRoute(direction);
      }
      return;
    }
    // 숫자키를 흘려보내면 onDigit 까지 내려가 state.problem 이 null 인 채로
    // answer 를 읽어 매번 TypeError 가 났다(심층 검토 P0-3, 실측 재현).
    // 1~4번 게임에서 숫자키가 정답 입력이라 아이는 게임 구분 없이 가장 많이
    // 누르는 키다. KTX·택배·물감처럼 여기서 흡수한다.
    if (/^[0-9]$/.test(event.key)) {
      event.preventDefault();
      if (!event.repeat) audio.playSfx("pop");
      return;
    }
  }

  if (event.key === "Backspace" && state.phase === "playing") {
    event.preventDefault();
    deleteDigit();
    return;
  }

  // 홈에서 ↑/↓ 는 난이도 줄과 카드 판을 오간다. 없으면 방향키만 쓰는 아이는
  // 난이도에 영원히 닿지 못한다 — 도전 지도와 SRT 여정이 키보드만으로는 열리지
  // 않았다(심층 검토 P0-4, 실측: 방향키 24번에 카드 9장만 순환).
  // CLAUDE.md 계약: "카드와 난이도 모두 ←/→ 포커스 이동 + Space·Enter".
  if (state.phase === "home" && ["ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const onDifficulty = difficultyControls.includes(document.activeElement);
    if (event.key === "ArrowUp" && !onDifficulty) {
      (difficultyControls.find(button => button.dataset.difficulty === state.difficulty)
        ?? difficultyControls[0])?.focus();
      return;
    }
    if (event.key === "ArrowDown" && onDifficulty) {
      (modeControls.find(card => !card.disabled))?.focus();
      return;
    }
    return;
  }

  if (
    state.phase === "home" &&
    ["ArrowLeft", "ArrowRight"].includes(event.key) &&
    difficultyControls.includes(document.activeElement)
  ) {
    event.preventDefault();
    const current = difficultyControls.indexOf(document.activeElement);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next =
      (current + offset + difficultyControls.length) %
      difficultyControls.length;
    difficultyControls[next].focus();
    return;
  }

  // 홈에서 ←/→ 는 카드 사이를 오간다 — 숫자키 없는 7번 카드의 1차 진입로.
  if (
    state.phase === "home" &&
    ["ArrowLeft", "ArrowRight"].includes(event.key) &&
    !difficultyControls.includes(document.activeElement)
  ) {
    event.preventDefault();
    const cards = modeControls.filter(card => !card.disabled);
    const current = cards.indexOf(document.activeElement);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = current === -1
      ? (offset === 1 ? 0 : cards.length - 1)
      : (current + offset + cards.length) % cards.length;
    cards[next]?.focus();
    return;
  }

  const digit = /^[0-9]$/.test(event.key) ? event.key : null;
  if (digit === null || event.repeat) return;

  if (state.phase === "playing" && state.mode === "subway") {
    if (state.subwayChoosing) {
      event.preventDefault();
      const destinations = subwayDestinations();
      const index = digit === "0" ? 9 : Number(digit) - 1;
      const choice = destinations[index];
      if (choice) {
        audio.playSfx("key");
        startSubwayRide(choice.place.id);
      }
    } else if (state.subway?.phase === "gate") {
      event.preventDefault();
      chooseSubwayLineInput(lineForKey(digit));
    }
    return;
  }

  if (state.phase === "playing") {
    event.preventDefault();
    onDigit(digit);
  }
});

window.addEventListener("resize", () => scheduleCharacterFit());

syncMuteButton();
syncDifficulty();
preloadCharacters();
