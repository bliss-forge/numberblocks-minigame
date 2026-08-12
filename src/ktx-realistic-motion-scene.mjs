import {
  REALISTIC_MOTION_ASSETS,
  realisticCabAsset,
  realisticEventAsset,
  realisticMotionAssets
} from "./ktx-realistic-assets.mjs";
import { realisticMotionFrame } from "./ktx-realistic-motion.mjs";
import { routeSegments } from "./ktx-journey.mjs";

const controllers = new WeakMap();
const PLATE_SPAN = 1200;
const PLATE_SWAP_GUARD = 160;
const PHOTO_SAFE_PAN_PX = 320;
const STATION_SAFE_PAN_PX = 120;
const PATTERN_PERIOD_PX = Object.freeze({ mid: 960, near: 720, track: 144, streak: 310 });
const TUNNEL_WALL_GAP_PX = 50;
const TUNNEL_PORTAL_DISTANCE = 600;
const STATION_PHASES = new Set(["stopped", "boarding", "ready", "branch", "finale"]);

// 열차 png의 칸 접합부(문) 위치 — rig 폭 기준 %. 브라우저 실측으로 보정.
const DOOR_LEFT_PERCENTS = Object.freeze([32, 43.9, 55.7, 67.6, 79.5]);

function el(document, tag, className) {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function motionImage(document, className, src, alt, controller) {
  const image = el(document, "img", className);
  image.dataset.assetSrc = src;
  image.src = src;
  image.alt = alt;
  image.decoding = "async";
  image.addEventListener?.("load", () => {
    if (image.dataset.assetSrc !== src) return;
    image.dataset.loaded = "true";
    delete image.dataset.failed;
    syncReadiness(controller);
  });
  image.addEventListener?.("error", () => {
    if (image.dataset.assetSrc !== src) return;
    delete image.dataset.loaded;
    image.dataset.failed = "true";
    syncReadiness(controller);
  });
  return image;
}

function setStatus(controller, status) {
  controller.scene.dataset.readiness = status;
  if (controller.root) controller.root.dataset.motionRealistic = status;
  controller.onStateChange?.(status);
}

function requiredImages(controller) {
  return [
    ...controller.plates,
    controller.station,
    controller.view === "cab" ? controller.cabFrame : controller.train
  ];
}

function syncReadiness(controller) {
  if (controller.failedEnvironments.has(controller.requestedLand)) {
    setStatus(controller, "fallback");
    return;
  }
  if (controller.pending?.land === controller.requestedLand ||
    controller.requestedLand !== controller.land) {
    setStatus(controller, "pending");
    return;
  }
  const required = requiredImages(controller);
  if (required.some(image => image.dataset.failed === "true")) {
    setStatus(controller, "fallback");
    return;
  }
  const ready = required.every(image => image.dataset.loaded === "true");
  if (ready) {
    controller.loadedEnvironments.set(controller.land, controller.scenes);
    controller.failedEnvironments.clear();
  }
  setStatus(controller, ready ? "ready" : "pending");
}

function applyFrame(scene, state, band, controller = null) {
  const frame = realisticMotionFrame({
    x: state.x,
    v: state.v,
    phase: state.phase,
    markerDistance: state.markerDistance,
    land: band.land
  });
  scene.dataset.land = frame.land;
  scene.dataset.sky = band.sky ?? "day";
  scene.dataset.speedBand = frame.speedBand;
  scene.dataset.stationStage = frame.stationStage;
  scene.dataset.stationVisible = String(frame.stationStage !== "hidden");
  scene.dataset.nearSuppressed = String(
    frame.stationStage === "detail" || frame.stationStage === "stopped" || frame.departing
  );
  scene.dataset.tunnel = String(frame.land === "tunnel");
  scene.dataset.moving = String(frame.moving);
  scene.dataset.motionMoving = String(frame.moving);
  const photoX = monotonicPhotoPan(state.x);
  scene.style.setProperty("--motion-scene-x", `${photoX}px`);
  scene.style.setProperty("--motion-far-x", `${photoX}px`);
  // 전면창 사진도 시간대·지형을 따른다. 옆 창에 사진 판이 보이기 시작하면서
  // "옆은 들판, 앞은 도시"가 드러났다(대장 지적 2026-08-11). 우선순위는
  // realisticCabAsset 한 곳에만 두고 CSS는 이 변수를 쓴다 — 규칙을 CSS에
  // 복제하면 둘이 갈라진다.
  scene.style.setProperty("--cab-base-image",
    `url("${realisticCabAsset(band.sky ?? "day", frame.land)}")`);
  const cabProgress = cabForwardProgress(state.x);
  scene.style.setProperty("--cab-base-scale",
    (1.035 + cabProgress * .035).toFixed(4));
  scene.style.setProperty("--cab-base-y", `${rounded(cabProgress * 5)}px`);
  setPatternMotion(scene, "mid", frame.offsets.mid, PATTERN_PERIOD_PX.mid);
  setPatternMotion(scene, "near", frame.offsets.near, PATTERN_PERIOD_PX.near);
  setPatternMotion(scene, "track", frame.offsets.track, PATTERN_PERIOD_PX.track);
  setPatternMotion(scene, "streak", frame.offsets.track, PATTERN_PERIOD_PX.streak);
  scene.style.setProperty("--motion-speed", String(frame.speedRatio));
  scene.style.setProperty("--motion-blur", `${frame.blurPx}px`);
  scene.style.setProperty("--motion-brake-pitch", String(frame.brakePitch));
  scene.style.setProperty("--station-progress", String(frame.stationProgress));
  const stationOffsetX = frame.departing
    ? -STATION_SAFE_PAN_PX * (1 - frame.stationProgress)
    : STATION_SAFE_PAN_PX * (1 - frame.stationProgress);
  scene.style.setProperty("--station-offset-x", `${rounded(stationOffsetX)}px`);
  scene.style.setProperty("--station-cover-scale",
    String(rounded(1 + frame.stationProgress * .06)));
  scene.style.setProperty("--station-object-y",
    `${rounded(50 + frame.stationProgress * 30)}%`);
  scene.style.setProperty("--station-opacity", String(frame.stationProgress));
  const cabSleeperGap = patternGap(scene, "--cab-sleeper-gap",
    42 - frame.speedRatio * 12, frame.moving);
  const cabCatenaryGap = patternGap(scene, "--cab-catenary-gap",
    76 - frame.speedRatio * 20, frame.moving);
  const tunnelLightGap = patternGap(scene, "--tunnel-light-gap",
    98 - frame.speedRatio * 42, frame.moving);
  // 터널 조명 맥동 주기 — 조명 간격을 실제 통과 시간으로 환산. 4~6세 광과민
  // 안전 상한: 최소 400ms(2.5Hz) 밑으로 절대 내리지 않는다. 100ms 양자화로
  // 값이 진짜 변할 때만 써서 애니메이션 재시작 점프를 막는다.
  const strobeMs = Math.round(Math.min(2000, Math.max(400,
    (tunnelLightGap * 3600) / Math.max(state.v, 1))) / 100) * 100;
  if (scene.style.getPropertyValue("--strobe-period") !== `${strobeMs}ms`) {
    scene.style.setProperty("--strobe-period", `${strobeMs}ms`);
  }
  scene.style.setProperty("--tunnel-wall-gap", `${TUNNEL_WALL_GAP_PX}px`);
  setLoopPhase(scene, "cabTrack", "--cab-track-phase",
    frame.offsets.track, cabSleeperGap, frame.moving);
  setLoopPhase(scene, "cabCatenary", "--cab-catenary-phase",
    frame.offsets.track, cabCatenaryGap, frame.moving);
  scene.style.setProperty("--cab-sleeper-phase", `${frame.cab.sleeperPhase}px`);
  scene.style.setProperty("--cab-pole-phase", `${frame.cab.polePhase}px`);
  scene.style.setProperty("--cab-ground-ratio", String(frame.cab.groundRatio));
  // 원근 평면 침목 — 평면 로컬 8px/m, 패턴 주기 64px의 정수배(512)로 무봉합.
  setLoopPhase(scene, "cabTies", "--cab-tie-px",
    frame.offsets.track * 8, 512, frame.moving);
  // 의사 곡선 캔트 — 시뮬에 곡선 데이터가 없어 위치 기반 저주파 사인.
  // 상한 0.8°(멀미 배려), 900m 주기라 체감은 "가끔 완만한 곡선".
  scene.style.setProperty("--cab-cant",
    `${(Math.sin(state.x / 900) * 0.8).toFixed(2)}deg`);
  scene.dataset.doors = state.doors === "open" && STATION_PHASES.has(state.phase)
    ? "open" : "closed";
  scene.dataset.doorWarning = String(
    Number.isFinite(state.doorCountdownMs) && state.doorCountdownMs > 0 &&
    state.doorCountdownMs <= 3000);
  const tunnelPortal = tunnelPortalState(state, frame.land);
  setLoopPhase(scene, "tunnelWall", "--tunnel-wall-phase",
    frame.land === "tunnel" ? frame.offsets.track : 0,
    TUNNEL_WALL_GAP_PX, frame.moving);
  setLoopPhase(scene, "tunnelLight", "--tunnel-light-phase",
    frame.land === "tunnel" ? frame.offsets.track : 0,
    tunnelLightGap, frame.moving);
  scene.style.setProperty("--tunnel-progress", String(rounded(tunnelPortal.progress)));
  scene.style.setProperty("--tunnel-scale",
    String(rounded(.32 + tunnelPortal.progress * 1.36)));
  scene.dataset.tunnelPortalVisible = String(tunnelPortal.visible);
  scene.style.setProperty("--motion-vibration-y",
    `${motionVibration(state.x, state.v, frame.moving)}px`);
  const durationMs = controller?.crossfade?.durationMs ??
    crossfadeDuration(frame.speedRatio);
  scene.style.setProperty("--motion-crossfade-ms", `${durationMs}ms`);
  scene.style.setProperty("--motion-crossfade-play-state",
    frame.moving ? "running" : "paused");
  if (controller?.station) {
    controller.station.dataset.lifecycle = frame.departing
      ? "departing" : frame.stationStage;
    // 시간대별 역 사진 — 역이 화면 밖(hidden)일 때만 바꿔 로드 깜빡임이
    // 보이지 않는다. loaded 게이트는 유지(최초 로드로 이미 통과).
    const wantedStation =
      REALISTIC_MOTION_ASSETS.stationBySky[scene.dataset.sky] ??
      REALISTIC_MOTION_ASSETS.station[0];
    if (frame.stationStage === "hidden" &&
      controller.station.dataset.assetSrc !== wantedStation) {
      controller.station.dataset.assetSrc = wantedStation;
      controller.station.src = wantedStation;
    }
  }
  if (controller?.stationSign) {
    controller.stationSign.textContent = stationName(state);
  }
  return frame;
}

function rounded(value) {
  return Number(value.toFixed(2));
}

function monotonicPhotoPan(x) {
  const distanceInPlate = Math.max(0, x) % PLATE_SPAN;
  const progress = distanceInPlate / PLATE_SPAN;
  return rounded(PHOTO_SAFE_PAN_PX / 2 - progress * PHOTO_SAFE_PAN_PX);
}

function cabForwardProgress(x) {
  const distance = Math.max(0, Number.isFinite(x) ? x : 0);
  return Math.min(1, distance / 5000);
}

function setPatternMotion(scene, layer, offset, period) {
  const phaseProperty = `--motion-${layer}-phase-x`;
  const phase = rounded(-(offset % period));
  const previous = Number.parseFloat(scene.style.getPropertyValue(phaseProperty));
  scene.dataset[`${layer}LoopReset`] = String(
    Number.isFinite(previous) && Math.abs(phase - previous) > period / 2
  );
  scene.style.setProperty(`--motion-${layer}-x`, `${rounded(-offset)}px`);
  scene.style.setProperty(phaseProperty, `${phase}px`);
}

function patternGap(scene, property, nextGap, moving) {
  const previous = Number.parseFloat(scene.style.getPropertyValue(property));
  const gap = !moving && Number.isFinite(previous) ? previous : rounded(nextGap);
  scene.style.setProperty(property, `${gap}px`);
  return gap;
}

function setLoopPhase(scene, loop, property, offset, period, moving) {
  const previous = Number.parseFloat(scene.style.getPropertyValue(property));
  if (!moving && Number.isFinite(previous)) {
    scene.dataset[`${loop}LoopReset`] = "false";
    return;
  }
  const phase = rounded(-(Math.max(0, offset) % period));
  const periodKey = `${loop}LoopPeriod`;
  const previousPeriod = Number.parseFloat(scene.dataset[periodKey]);
  scene.dataset[`${loop}LoopReset`] = String(
    Number.isFinite(previous) && (
      phase > previous ||
      (Number.isFinite(previousPeriod) && previousPeriod !== period)
    )
  );
  scene.dataset[periodKey] = String(period);
  scene.style.setProperty(property, `${phase}px`);
}

function tunnelPortalState(state, land) {
  const segment = routeSegments(state)[state.segIndex];
  if (!segment) return { progress: 0, visible: false };

  let previousUntil = 0;
  let tunnelStart = null;
  for (const band of segment.bands) {
    if (band.land === "tunnel") {
      tunnelStart = previousUntil * segment.length;
      break;
    }
    previousUntil = band.until;
  }
  if (tunnelStart === null) return { progress: 0, visible: false };

  const distance = tunnelStart - state.x;
  if (land !== "tunnel") {
    if (distance < 0 || distance > TUNNEL_PORTAL_DISTANCE) {
      return { progress: 0, visible: false };
    }
    return {
      progress: 1 - distance / TUNNEL_PORTAL_DISTANCE,
      visible: true
    };
  }

  const insideDistance = Math.max(0, state.x - tunnelStart);
  return {
    progress: 1 + Math.min(.35, insideDistance / 120 * .35),
    visible: insideDistance <= 120
  };
}

function stationName(state) {
  if (STATION_PHASES.has(state.phase) && state.station) return state.station;
  const segment = routeSegments(state)[state.segIndex];
  return segment?.to ?? state.station ?? "SRT 역";
}

function crossfadeDuration(speedRatio) {
  return Math.round(900 - speedRatio * 450);
}

function motionVibration(x, v, moving) {
  if (!moving || v <= 160) return 0;
  const amplitude = Math.min(1.5, ((v - 160) / 140) * 1.5);
  return rounded(Math.sin(x * 0.16) * amplitude);
}

function finishPlateCrossfade(controller, slot) {
  const crossfade = controller.crossfade;
  if (!crossfade || !crossfade.remainingSlots.has(slot)) return;
  crossfade.remainingSlots.delete(slot);
  if (crossfade.remainingSlots.size > 0) return;
  controller.crossfade = null;
  controller.plates.forEach((plate, index) => {
    delete plate.dataset.crossfade;
    plate.hidden = index !== controller.activeSlot;
  });
}

function resetPlateSlots(controller, catalog) {
  controller.catalog = catalog;
  controller.activeSlot = 0;
  controller.activeCatalogIndex = 0;
  controller.platePreload = null;
  controller.crossfade = null;
  controller.failedPlateSources.clear();
  controller.plates.forEach((plate, index) => {
    plate.dataset.active = String(index === 0);
    delete plate.dataset.crossfade;
    plate.hidden = index !== 0;
  });
}

function assignPreloadedPlate(controller, request) {
  if (controller.platePreload !== request || !request.loaded ||
    controller.requestedLand !== request.land ||
    controller.activeCatalogIndex !== request.fromIndex ||
    controller.currentX < request.minX) return;
  const inactiveSlot = 1 - controller.activeSlot;
  const plate = controller.plates[inactiveSlot];
  plate.dataset.assetSrc = request.source;
  plate.src = request.source;
  plate.dataset.loaded = "true";
  delete plate.dataset.failed;
  plate.dataset.active = "false";
  delete plate.dataset.crossfade;
  plate.hidden = true;
  controller.platePreload = null;
}

function preloadPlate(controller, catalogIndex, minX) {
  const source = controller.catalog[catalogIndex];
  if (controller.plates.some(plate => plate.dataset.assetSrc === source)) return;
  if (controller.failedPlateSources.has(source)) return;

  if (controller.platePreload?.source === source) {
    assignPreloadedPlate(controller, controller.platePreload);
    return;
  }

  const request = {
    land: controller.land,
    source,
    fromIndex: controller.activeCatalogIndex,
    minX,
    loaded: false
  };
  controller.platePreload = request;
  const preloader = controller.document.createElement("img");
  preloader.decoding = "async";
  preloader.addEventListener?.("load", () => {
    if (controller.platePreload !== request) return;
    request.loaded = true;
    controller.failedPlateSources.delete(source);
    assignPreloadedPlate(controller, request);
  });
  preloader.addEventListener?.("error", () => {
    if (controller.platePreload !== request) return;
    controller.failedPlateSources.add(source);
    controller.platePreload = null;
  });
  preloader.src = source;
}

function syncPlateMotion(controller, state, frame) {
  if (!frame.moving || controller.catalog.length < 2) return;
  controller.currentX = Math.max(0, state.x);
  const segment = Math.floor(Math.max(0, state.x) / PLATE_SPAN);
  const desiredIndex = segment % controller.catalog.length;
  const source = controller.catalog[desiredIndex];
  const desiredSlot = controller.plates.findIndex(
    plate => plate.dataset.assetSrc === source && plate.dataset.loaded === "true"
  );
  if (desiredSlot < 0) {
    preloadPlate(controller, desiredIndex, controller.currentX);
    return;
  }
  let switched = false;
  if (desiredSlot >= 0 && desiredSlot !== controller.activeSlot) {
    const outgoingSlot = controller.activeSlot;
    controller.plates.forEach((plate, index) => {
      plate.hidden = false;
      plate.dataset.active = String(index === desiredSlot);
    });
    controller.plates[outgoingSlot].dataset.crossfade = "out";
    controller.plates[desiredSlot].dataset.crossfade = "in";
    controller.crossfade = {
      durationMs: Number.parseFloat(
        controller.scene.style.getPropertyValue("--motion-crossfade-ms")),
      remainingSlots: new Set([outgoingSlot, desiredSlot])
    };
    controller.activeSlot = desiredSlot;
    controller.activeCatalogIndex = desiredIndex;
    controller.platePreload = null;
    switched = true;
  } else if (desiredSlot >= 0) {
    controller.activeCatalogIndex = desiredIndex;
  }
  controller.plates[controller.activeSlot].style.setProperty(
    "--motion-plate-x",
    controller.scene.style.getPropertyValue("--motion-scene-x"));
  preloadPlate(controller,
    (controller.activeCatalogIndex + 1) % controller.catalog.length,
    controller.currentX + (switched ? PLATE_SWAP_GUARD : 0));
}

function assignLoadedScenes(controller, land, sources) {
  controller.land = land;
  controller.scenes = sources;
  const pack = realisticMotionAssets("srt", land);
  controller.failedEnvironments.clear();
  controller.plates.forEach((plate, index) => {
    const src = sources[index];
    if (plate.dataset.assetSrc !== src) {
      plate.dataset.assetSrc = src;
      plate.src = src;
    }
    plate.dataset.loaded = "true";
    delete plate.dataset.failed;
  });
  resetPlateSlots(controller, pack.scenes);
  syncReadiness(controller);
}

function preloadEnvironment(controller, land, sources) {
  if (controller.pending?.land === land) return;
  const request = { land, sources, loaded: new Set(), failed: false };
  controller.pending = request;
  setStatus(controller, "pending");

  sources.forEach((src, index) => {
    const preloader = controller.document.createElement("img");
    preloader.decoding = "async";
    preloader.addEventListener?.("load", () => {
      if (controller.pending !== request || request.failed) return;
      request.loaded.add(index);
      if (request.loaded.size !== sources.length) return;
      controller.pending = null;
      controller.loadedEnvironments.set(land, sources);
      assignLoadedScenes(controller, land, sources);
    });
    preloader.addEventListener?.("error", () => {
      if (controller.pending !== request) return;
      request.failed = true;
      controller.pending = null;
      controller.failedEnvironments.add(land);
      setStatus(controller, "fallback");
    });
    preloader.src = src;
  });
}

export function buildRealisticMotionScene(document, state, onStateChange) {
  const pack = realisticMotionAssets(state.train.id, state.land);
  if (!pack) return null;

  const scene = el(document, "div", "ktx-motion-scene");
  scene.setAttribute("aria-hidden", "true");
  const controller = {
    document,
    scene,
    root: null,
    view: "side",
    land: state.land,
    requestedLand: state.land,
    scenes: pack.scenes.slice(0, 2),
    catalog: pack.scenes,
    activeSlot: 0,
    activeCatalogIndex: 0,
    platePreload: null,
    crossfade: null,
    failedPlateSources: new Set(),
    currentX: Math.max(0, state.x),
    loadedEnvironments: new Map(),
    failedEnvironments: new Set(),
    pending: null,
    onStateChange
  };

  const plates = pack.scenes.slice(0, 2).map((src, index) => {
    const plate = motionImage(document,
      `ktx-motion-plate ktx-motion-plate-${index + 1}`, src, "", controller);
    plate.dataset.active = String(index === 0);
    plate.hidden = index !== 0;
    return plate;
  });
  controller.plates = plates;
  plates.forEach((plate, index) => {
    plate.addEventListener?.("animationend", () =>
      finishPlateCrossfade(controller, index));
  });

  const mid = el(document, "div", "ktx-motion-mid");
  const track = el(document, "div", "ktx-motion-track");
  const near = el(document, "div", "ktx-motion-near");
  const wheelShadow = el(document, "div", "ktx-motion-wheel-shadow");
  const station = motionImage(document, "ktx-motion-station",
    pack.station[0], "", controller);
  const stationViewport = el(document, "div", "ktx-motion-station-viewport");
  stationViewport.append(station);
  const stationSign = el(document, "div", "ktx-motion-station-sign");
  stationSign.textContent = stationName(state);
  const cabWindow = el(document, "div", "ktx-motion-cab-window");
  const cabBase = el(document, "div", "ktx-motion-cab-base");
  const cabGround = el(document, "div", "ktx-motion-cab-ground");
  const cabBallast = el(document, "div", "ktx-motion-cab-ballast");
  const cabRailLeft = el(document, "div", "ktx-motion-cab-rail ktx-motion-cab-rail-left");
  const cabRailRight = el(document, "div", "ktx-motion-cab-rail ktx-motion-cab-rail-right");
  const cabSleepers = el(document, "div", "ktx-motion-cab-sleepers");
  const cabPoles = el(document, "div", "ktx-motion-cab-poles");
  const cabCatenary = el(document, "div", "ktx-motion-cab-catenary");
  // 원근 선로 평면 — 사진 위 평면 크롤이 아니라 진짜 CSS 3D 투영(rotateX 84°).
  // 소실점에서 느리고 관찰자 앞에서 지수 가속하는 광학 흐름이 투영에서 공짜로
  // 나온다(협회 모션 설계 2026-08-10 P1). 기존 크롤 침목은 보조로 강등.
  const cabPersp = el(document, "div", "ktx-motion-cab-persp");
  const cabPlane = el(document, "div", "ktx-motion-cab-plane");
  const cabTies = el(document, "div", "ktx-motion-cab-ties");
  cabPlane.append(cabTies);
  cabPersp.append(cabPlane);
  const tunnel = el(document, "div", "ktx-motion-tunnel");
  const tunnelPortal = el(document, "div", "ktx-motion-tunnel-portal");
  const tunnelLights = el(document, "div", "ktx-motion-tunnel-lights");
  tunnel.append(tunnelPortal, tunnelLights);
  cabWindow.append(cabBase, cabGround, cabBallast, cabSleepers,
    cabRailLeft, cabRailRight, cabPersp, cabPoles, cabCatenary, tunnel);
  const train = motionImage(document, "ktx-motion-train",
    pack.train, "실사 SRT 열차", controller);
  // 야간 도색 — 주간본과 픽셀 정렬된 스프라이트를 겹쳐 두고 CSS로 교차.
  // 필수 로딩 게이트에 넣지 않아 실패해도 주간본으로 계속 논다.
  const trainNight = el(document, "img", "ktx-motion-train-night");
  trainNight.src = pack.trainNight;
  trainNight.alt = "";
  trainNight.decoding = "async";
  // 교행 열차 — 건너편(먼) 선로를 반대 방향으로 스치는 KTX. 같은 스프라이트를
  // 색상 변환(보라→파랑)으로 눕혀 쓴다. passing 이벤트가 스윕을 발사한다.
  const oncoming = el(document, "img", "ktx-motion-oncoming");
  oncoming.src = pack.train;
  oncoming.alt = "";
  oncoming.decoding = "async";
  oncoming.setAttribute("aria-hidden", "true");
  // 테마 이벤트 스프라이트 — 소 농장·갈매기 떼가 월드에서 스쳐 지나간다.
  // 화면에 붙어 있는 평면 연출과 달리 속도에 맞춰 흘러야 "달리는 중에
  // 우연히 봤다"가 된다.
  const eventSprite = el(document, "div", "ktx-motion-event");
  const trainRig = el(document, "div", "ktx-motion-train-rig");
  // 칸 접합부마다 문 — 문 하나(23px)로는 개폐가 화면에서 읽히지 않는다는
  // 피드백(2026-08-10). 네 짝이 함께 열리고 닫혀야 "정차했다/떠난다"가 보인다.
  const doors = DOOR_LEFT_PERCENTS.map(left => {
    const door = el(document, "div", "ktx-motion-door");
    door.style.setProperty("--door-left", `${left}%`);
    const doorBay = el(document, "span", "ktx-motion-door-bay");
    const doorLeft = el(document, "span",
      "ktx-motion-door-leaf ktx-motion-door-leaf-left");
    const doorRight = el(document, "span",
      "ktx-motion-door-leaf ktx-motion-door-leaf-right");
    door.append(doorBay, doorLeft, doorRight);
    return door;
  });
  // 근접 궤도 — 바퀴 라인 바로 밑에 레일·침목·자갈이 함께 흐르지 않으면
  // 열차가 사진 위에 떠 보인다(사용자 피드백 2026-08-10).
  const railbed = el(document, "div", "ktx-motion-railbed");
  trainRig.append(railbed, train, trainNight, wheelShadow, ...doors);
  const cabFrame = motionImage(document, "ktx-motion-cab-frame",
    pack.cabMask, "실사 SRT 운전실", controller);
  // 창 내용과 프레임을 한 몸으로 묶는 카메라 리그 — 진동을 따로 주면 세계와
  // 프레임이 분리돼 보인다. 흔들림은 리그 하나에만 건다(협회 P3).
  const cabRig = el(document, "div", "ktx-motion-cab-rig");
  cabRig.append(cabWindow, cabFrame);
  Object.assign(controller, { station, stationSign, train, cabFrame });

  // 운전실 옆 창의 유리 한 장 — 판(z1) 위, 전면창(z5) 아래에 얹혀 좌우 창에만
  // 걸린다. 없으면 옆 창이 "유리 없는 구멍"으로 보인다.
  const glass = el(document, "div", "ktx-motion-glass");
  scene.append(...plates, glass, stationViewport, stationSign,
    mid, eventSprite, track, oncoming, near, cabRig, trainRig);
  scene.dataset.readiness = "pending";
  applyFrame(scene, state, { sky: state.sky, land: state.land }, controller);
  controllers.set(scene, controller);
  return scene;
}

export function updateRealisticMotionScene(root, state, band) {
  const scene = root.querySelector(".ktx-motion-scene");
  if (state.train.id !== "srt" || !scene) {
    root.dataset.motionRealistic = "fallback";
    return;
  }

  const controller = controllers.get(scene);
  if (!controller) {
    root.dataset.motionRealistic = "fallback";
    return;
  }
  controller.root = root;
  controller.view = root.dataset.view === "cab" ? "cab" : "side";
  const frame = applyFrame(scene, state, band, controller);

  const pack = realisticMotionAssets(state.train.id, band.land);
  const sources = pack.scenes.slice(0, 2);
  const previousRequestedLand = controller.requestedLand;
  controller.requestedLand = band.land;
  if (controller.pending && controller.pending.land !== band.land) {
    controller.pending = null;
  }
  if (previousRequestedLand !== band.land && controller.land === band.land &&
    controller.loadedEnvironments.has(band.land)) {
    controller.failedEnvironments.clear();
  }
  if (controller.failedEnvironments.has(band.land)) {
    setStatus(controller, "fallback");
    return;
  }
  if (controller.land !== band.land) {
    const loaded = controller.loadedEnvironments.get(band.land);
    if (loaded) {
      controller.pending = null;
      assignLoadedScenes(controller, band.land, loaded);
    } else {
      preloadEnvironment(controller, band.land, sources);
    }
    return;
  }
  syncReadiness(controller);
  syncPlateMotion(controller, state, frame);
}
