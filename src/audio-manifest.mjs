const numbers = Object.fromEntries(
  Array.from({ length: 150 }, (_, index) => {
    const number = index + 1;
    return [
      `number-${number}`,
      {
        ko: `assets/audio/voice/ko/number-${number}.mp3`,
        en: `assets/audio/voice/en/number-${number}.mp3`
      }
    ];
  })
);

const safety = Object.fromEntries(
  [
    ...Array.from({ length: 9 }, (_, index) => `safety-next-${index + 2}`),
    "safety-red-light",
    "safety-manhole",
    "safety-construction",
    "safety-scooter",
    "safety-bicycle",
    "safety-car",
    "safety-wrong-order",
    "safety-finish",
    "safety-look-both",
    "safety-tour",
    "safety-take-the-bus",
    "safety-wrong-bus",
    "safety-bus-stop",
    "safety-bus-boarded",
    "safety-next-station",
    "safety-cross-now"
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

const subway = Object.fromEntries(
  [
    "subway-board",
    "subway-wrong-line",
    "subway-stop-check",
    "subway-wrong-stop",
    "subway-transfer",
    "subway-arrive",
    "subway-mind-gap",
    "subway-place-zoo",
    "subway-place-lunapark",
    "subway-place-baseball",
    "subway-place-palace",
    "subway-place-namsan",
    "subway-place-hanriver",
    "subway-place-skypark",
    "subway-place-childpark",
    "subway-place-lake",
    "subway-place-assembly",
    // 실음원이 없는 역 4곳의 이름 안내 — subway_sound/에 파일이 생기면
    // stationSoundSrc가 그쪽을 먼저 쓰고 이 키는 폴백으로만 남는다.
    "subway-station-moran",
    "subway-station-gayang",
    "subway-station-assembly",
    "subway-station-bongeunsa"
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

const srt = Object.fromEntries(
  [
    "srt-arrive",
    "srt-board",
    "srt-seat",
    "srt-wrong-seat",
    "srt-depart",
    "srt-station-dongtan",
    "srt-station-daejeon",
    "srt-station-daegu",
    "srt-station-busan",
    "srt-wrong-station",
    "srt-parking",
    "srt-wrong-car",
    "srt-grandparents"
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

const paint = Object.fromEntries(
  [
    "paint-intro",
    "paint-finale",
    "paint-rainbow",
    "paint-unlock",
    ...[
      "firetruck", "chick", "bus", "carrot", "car", "frog", "tractor",
      "grape", "heli", "blossom", "boat", "bear", "rocket",
      "strawberry", "banana", "whale", "crow", "snowman",
      "tangerine", "plane", "submarine",
      "pig", "peach", "caterpillar", "butterfly", "acorn", "pine", "eggplant",
      "sandcastle", "camel", "dumptruck", "elephant", "cactus"
    ].map(subject => `paint-order-${subject}`),
    ...[
      "orange", "green", "purple", "pink", "sky", "brown", "navy",
      "lightyellow", "olive", "gray",
      "peach", "yellowgreen", "lavender", "darkbrown", "darkgreen",
      "darkpurple", "brick", "khaki", "bluegray",
      "sand", "ochre", "grayviolet", "sage", "mud"
    ].map(color => `paint-mix-${color}`),
    ...[
      "red", "yellow", "blue", "black", "white", "orange", "green",
      "purple", "pink", "sky", "brown", "navy", "lightyellow", "olive", "gray",
      "peach", "yellowgreen", "lavender", "darkbrown", "darkgreen",
      "darkpurple", "brick", "khaki", "bluegray", "mud",
      "sand", "ochre", "grayviolet", "sage"
    ].map(color => `paint-made-${color}`)
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

const delivery = Object.fromEntries(
  [
    "delivery-intro",
    "delivery-blocked",
    "delivery-wrong-house",
    "delivery-arrive",
    "delivery-floor-wrong",
    "delivery-floor-ok",
    "delivery-door-wrong",
    "delivery-bell",
    "delivery-parcel-wrong",
    "delivery-parcel-ok",
    "delivery-finale",
    "delivery-parcel-fruit",
    "delivery-parcel-cosmetic",
    "delivery-parcel-toy",
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

// 슥삭 그림 퀴즈 — 그리기 단계 안내 5 + 구제 + 피날레. 오답은 공용 retry-1~3,
// 정답 칭찬은 공용 cheer-1~4를 재사용한다.
const catchmind = Object.fromEntries(
  [
    "catchmind-intro",
    "catchmind-guess",
    "catchmind-form",
    "catchmind-finish",
    "catchmind-done",
    "catchmind-rescue",
    "catchmind-finale"
  ].map(key => [
    key,
    {
      ko: `assets/audio/voice/ko/${key}.mp3`,
      en: `assets/audio/voice/en/${key}.mp3`
    }
  ])
);

export const VOICE = Object.freeze({
  "prompt-count": { ko: "assets/audio/voice/ko/prompt-count.mp3" },
  "prompt-add": { ko: "assets/audio/voice/ko/prompt-add.mp3" },
  "prompt-sub": {
    ko: "assets/audio/voice/ko/prompt-sub.mp3",
    en: "assets/audio/voice/en/prompt-sub.mp3"
  },
  "prompt-mul": { ko: "assets/audio/voice/ko/prompt-mul.mp3" },
  ...safety,
  ...srt,
  ...subway,
  ...paint,
  ...delivery,
  ...catchmind,
  ...numbers,
  ...Object.fromEntries(
    Array.from({ length: 4 }, (_, index) => [
      `cheer-${index + 1}`,
      { ko: `assets/audio/voice/ko/cheer-${index + 1}.mp3` }
    ])
  ),
  ...Object.fromEntries(
    Array.from({ length: 3 }, (_, index) => [
      `retry-${index + 1}`,
      { ko: `assets/audio/voice/ko/retry-${index + 1}.mp3` }
    ])
  )
});
