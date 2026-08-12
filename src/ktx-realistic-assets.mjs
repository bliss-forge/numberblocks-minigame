const ROOT = "assets/train-realistic";
const MOTION_ROOT = `${ROOT}/motion`;
const MOTION_LANDS = Object.freeze(["city", "field", "mountain", "river", "sea", "tunnel"]);

export const REALISTIC_TRAIN_ASSETS = Object.freeze({
  srt: Object.freeze({
    exterior: Object.freeze(Object.fromEntries(
      ["city", "field", "mountain", "river", "sea", "tunnel"]
        .map(land => [land, `${ROOT}/srt-exterior-${land}.webp`]))),
    cab: Object.freeze({
      day: `${ROOT}/cab-day.webp`,
      night: `${ROOT}/cab-night.webp`,
      tunnel: `${ROOT}/cab-tunnel.webp`,
      dawn: `${ROOT}/cab-dawn.webp`,
      sunset: `${ROOT}/cab-sunset.webp`,
      field: `${ROOT}/cab-field.webp`,
      river: `${ROOT}/cab-river.webp`,
      sea: `${ROOT}/cab-sea.webp`,
      mountain: `${ROOT}/cab-mountain.webp`
    })
  })
});

export const REALISTIC_MOTION_ASSETS = Object.freeze({
  train: `${MOTION_ROOT}/srt-side-transparent.png`,
  trainNight: `${MOTION_ROOT}/srt-side-transparent-night.png`,
  cabMask: `${MOTION_ROOT}/cab-window-mask.png`,
  station: Object.freeze([`${MOTION_ROOT}/station-platform-a.webp`]),
  stationBySky: Object.freeze({
    sunset: `${MOTION_ROOT}/station-platform-sunset.webp`,
    night: `${MOTION_ROOT}/station-platform-night.webp`,
    dawn: `${MOTION_ROOT}/station-platform-dawn.webp`
  }),
  scenes: Object.freeze(Object.fromEntries(MOTION_LANDS.map(land => [
    land,
    Object.freeze(["a", "b", "c"].map(variant =>
      `${MOTION_ROOT}/${land}-${variant}.webp`))
  ])))
});

// 실사 이벤트 스프라이트 — 등재된 종류만 월드 스윕으로 승격되고, 없는 종류는
// ktx-scene-art.mjs 의 손그림 SVG를 그대로 써서 빈 화면이 되지 않는다.
// 2026-08-11: 사진풍 4종(cows·seagull·river·mountain) 제작은 품질 문제로 취소됐다.
// 비어 있는 것이 정상 상태다 — 더 나은 자산이 생기면 그때 한 줄씩 등재한다.
export const REALISTIC_EVENT_ASSETS = Object.freeze({
  // 예: cows: `${MOTION_ROOT}/event-cows.webp`
});

export function realisticEventAsset(kind) {
  return Object.hasOwn(REALISTIC_EVENT_ASSETS, kind)
    ? REALISTIC_EVENT_ASSETS[kind]
    : null;
}

export function realisticExteriorAsset(trainId, land) {
  const train = Object.hasOwn(REALISTIC_TRAIN_ASSETS, trainId)
    ? REALISTIC_TRAIN_ASSETS[trainId]
    : null;
  if (!train) return null;
  return train.exterior[land]
    ?? train.exterior.city;
}

export function realisticCabAsset(sky, land) {
  // 우선순위: 터널 > 밤 > 새벽·노을 > 지형(주간) > 낮 — 시간대가 지형보다
  // 강한 단서다(PR #8 시간대·지형 자산, 협회 검수 8·11 해소).
  const cab = REALISTIC_TRAIN_ASSETS.srt.cab;
  if (land === "tunnel") return cab.tunnel;
  if (sky === "night") return cab.night;
  if (sky === "dawn") return cab.dawn;
  if (sky === "sunset") return cab.sunset;
  return cab[land] ?? cab.day;
}

export function realisticMotionAssets(trainId, land) {
  if (trainId !== "srt") return null;
  const selected = Object.hasOwn(REALISTIC_MOTION_ASSETS.scenes, land)
    ? land
    : "city";
  return Object.freeze({
    train: REALISTIC_MOTION_ASSETS.train,
    trainNight: REALISTIC_MOTION_ASSETS.trainNight,
    cabMask: REALISTIC_MOTION_ASSETS.cabMask,
    station: REALISTIC_MOTION_ASSETS.station,
    stationBySky: REALISTIC_MOTION_ASSETS.stationBySky,
    scenes: REALISTIC_MOTION_ASSETS.scenes[selected]
  });
}

export function realisticAssetAlt(kind, context = "") {
  return `실사 SRT ${context} ${kind}`.trim();
}
