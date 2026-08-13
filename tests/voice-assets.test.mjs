import test from "node:test";
import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";

const srtKeys = [
  "srt-arrive", "srt-board", "srt-seat", "srt-wrong-seat", "srt-depart",
  "srt-station-dongtan", "srt-station-daejeon", "srt-station-daegu",
  "srt-station-busan", "srt-wrong-station", "srt-parking",
  "srt-wrong-car", "srt-grandparents"
];
const subwayKeys = [
  "subway-board", "subway-wrong-line", "subway-stop-check",
  "subway-wrong-stop", "subway-transfer", "subway-arrive",
  "subway-mind-gap",
  "subway-place-zoo", "subway-place-lunapark", "subway-place-baseball",
  "subway-place-palace", "subway-place-namsan", "subway-place-hanriver",
  "subway-place-skypark", "subway-place-childpark", "subway-place-lake",
  "subway-place-assembly",
  // 실음원이 없는 역 4곳의 이름 낭독 폴백
  "subway-station-moran", "subway-station-gayang",
  "subway-station-assembly", "subway-station-bongeunsa"
];
const paintKeys = [
  "paint-intro", "paint-finale", "paint-rainbow", "paint-unlock",
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
];
// 택배 왔어요! — 진행 안내 12 + 상자 이름 3. 매니페스트와의 대조는
// tests/delivery-voice.test.mjs 가 따로 본다.
const deliveryKeys = [
  "delivery-intro", "delivery-blocked", "delivery-wrong-house",
  "delivery-arrive", "delivery-floor-wrong", "delivery-floor-ok",
  "delivery-door-wrong", "delivery-bell", "delivery-parcel-wrong",
  "delivery-parcel-ok", "delivery-finale",
  "delivery-parcel-fruit", "delivery-parcel-cosmetic", "delivery-parcel-toy"
];
const ko = [
  "prompt-count", "prompt-add", "prompt-sub", "prompt-mul",
  ...Array.from({ length: 150 }, (_, i) => `number-${i + 1}`),
  "cheer-1", "cheer-2", "cheer-3", "cheer-4",
  "retry-1", "retry-2", "retry-3",
  ...Array.from({ length: 9 }, (_, i) => `safety-next-${i + 2}`),
  "safety-red-light", "safety-manhole", "safety-construction",
  "safety-scooter", "safety-bicycle", "safety-car",
  "safety-wrong-order", "safety-finish",
  "safety-look-both", "safety-tour", "safety-take-the-bus",
  ...srtKeys,
  ...subwayKeys,
  ...paintKeys,
  ...deliveryKeys
];
const en = [
  "prompt-sub",
  ...Array.from({ length: 9 }, (_, i) => `safety-next-${i + 2}`),
  "safety-red-light", "safety-manhole", "safety-construction",
  "safety-scooter", "safety-bicycle", "safety-car",
  "safety-wrong-order", "safety-finish",
  "safety-look-both", "safety-tour", "safety-take-the-bus",
  ...srtKeys,
  ...subwayKeys,
  ...paintKeys,
  ...deliveryKeys,
  ...Array.from({ length: 150 }, (_, i) => `number-${i + 1}`)
];

test("필수 한국어·영어 MP3가 모두 비어 있지 않다", async () => {
  for (const [lang, names] of [["ko", ko], ["en", en]]) {
    for (const name of names) {
      const file = await stat(new URL(`../assets/audio/voice/${lang}/${name}.mp3`, import.meta.url));
      assert.ok(file.size > 1024, `${lang}/${name}.mp3`);
    }
  }
});

test("영국 영어 뺄셈 안내 문구는 아이에게 자연스러운 표현을 사용한다", async () => {
  const generator = await readFile(
    new URL("../scripts/generate_voice_pack.py", import.meta.url),
    "utf8"
  );

  assert.match(
    generator,
    /"prompt-sub": "What do you get when you take the smaller number away from the larger number\?"/
  );
});

test("안전 안내 생성 문구는 한국어와 자연스러운 영국 영어를 함께 제공한다", async () => {
  const generator = await readFile(
    new URL("../scripts/generate_voice_pack.py", import.meta.url),
    "utf8"
  );

  assert.match(generator, /KO_SAFETY = \{/);
  assert.match(generator, /EN_SAFETY = \{/);
  assert.match(generator, /"safety-red-light": "빨간불이에요\./);
  assert.match(generator, /"safety-red-light": "The light is red\./);
  assert.match(generator, /"safety-finish": "We met all our friends/);
});

test("안전 연출·투어 음성 키가 매니페스트와 생성 스크립트에 준비되어 있다", async () => {
  const { VOICE } = await import("../src/audio-manifest.mjs");
  assert.ok(VOICE["safety-look-both"].ko.endsWith("safety-look-both.mp3"));
  assert.ok(VOICE["safety-look-both"].en.endsWith("safety-look-both.mp3"));
  assert.ok(VOICE["safety-tour"].ko.endsWith("safety-tour.mp3"));
  assert.ok(VOICE["safety-tour"].en.endsWith("safety-tour.mp3"));

  const generator = await readFile(
    new URL("../scripts/generate_voice_pack.py", import.meta.url),
    "utf8"
  );
  assert.match(generator, /"safety-look-both": "멈춰요, 왼쪽 오른쪽을 봐요!"/);
  assert.match(generator, /"safety-tour": "학교까지 안전하게 가 보자!"/);
  assert.match(generator, /"safety-look-both": "Stop! Look left and right!"/);
  assert.match(generator, /"safety-tour": "Let's walk safely to school!"/);
});

test("SRT 여정 음성 키가 매니페스트와 생성 스크립트에 준비되어 있다", async () => {
  const { VOICE } = await import("../src/audio-manifest.mjs");
  const keys = [
    "srt-arrive", "srt-board", "srt-seat", "srt-wrong-seat", "srt-depart",
    "srt-station-dongtan", "srt-station-daejeon", "srt-station-daegu",
    "srt-station-busan", "srt-wrong-station", "srt-parking",
    "srt-wrong-car", "srt-grandparents"
  ];
  for (const key of keys) {
    assert.ok(VOICE[key]?.ko.endsWith(`${key}.mp3`), `ko ${key}`);
    assert.ok(VOICE[key]?.en.endsWith(`${key}.mp3`), `en ${key}`);
  }

  const generator = await readFile(
    new URL("../scripts/generate_voice_pack.py", import.meta.url),
    "utf8"
  );
  assert.match(generator, /"srt-arrive": "수서역에 도착하였어요!"/);
  assert.match(generator, /"srt-board": "SRT를 타고 할아버지 할머니댁에 가요!"/);
  assert.match(generator, /"srt-seat": "내 자리를 찾아 앉아보아요!"/);
  assert.match(generator, /"srt-station-busan": "부산역이에요! 여기서 내려요!"/);
  assert.match(generator, /"srt-grandparents": "We met Grandma and Grandpa! Well done!"/);
  assert.match(generator, /render_pack\("ko", KO_SRT/);
  assert.match(generator, /render_pack\("en", EN_SRT/);
});

test("지하철 여행 음성 키가 매니페스트와 생성 스크립트에 준비되어 있다", async () => {
  const { VOICE } = await import("../src/audio-manifest.mjs");
  const { SUBWAY_PLACES } = await import("../src/subway-map-data.mjs");
  const keys = [
    "subway-board", "subway-wrong-line", "subway-stop-check",
    "subway-wrong-stop", "subway-transfer", "subway-arrive",
    "subway-mind-gap",
    ...SUBWAY_PLACES.map(place => place.voiceKey)
  ];
  for (const key of keys) {
    assert.ok(VOICE[key]?.ko.endsWith(`${key}.mp3`), `ko ${key}`);
    assert.ok(VOICE[key]?.en.endsWith(`${key}.mp3`), `en ${key}`);
  }

  const generator = await readFile(
    new URL("../scripts/generate_voice_pack.py", import.meta.url),
    "utf8"
  );
  assert.match(generator, /"subway-transfer": "갈아타는 역이에요! 다음 열차를 찾아요!"/);
  assert.match(generator, /"subway-place-zoo": "동물원에 가요!"/);
  assert.match(generator, /render_pack\("ko", KO_SUBWAY/);
  assert.match(generator, /render_pack\("en", EN_SUBWAY/);
});
