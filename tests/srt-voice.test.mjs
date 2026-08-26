// SRT 여정 음성 계약 — 매니페스트·생성 스크립트·앱이 같은 키를 본다.
//
// 문구가 두 곳(매니페스트와 파이썬 생성기)에 나뉘어 있고 호출부가 세 갈래
// (playPrompt·playSrtVoice·스플래시/역 테이블)라, 한쪽만 고치면 조용히 무음이
// 된다. 기존 voice-assets 테스트는 키를 하드코딩한 목록이라 새 키가 한쪽에만
// 들어가는 드리프트를 못 잡았다. 여기서 집합 동치로 잡는다.
// (물감 세션이 delivery-voice 패턴을 물감에 이식하며 제안 — 2026-08-11)
// mp3 파일 존재 여부는 tests/voice-assets.test.mjs 가 따로 본다.

import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { VOICE } from "../src/audio-manifest.mjs";
import {
  SEAT_ROWS,
  SRT_CARS,
  TARGET_SEAT_LETTERS,
  ticketVoiceKeys
} from "../src/srt-journey.mjs";

// 넷째 경로(2026-08-27, P1-11): 승차권 음성은 문자열이 아니라 목표 좌석에서
// 계산된다. 가능한 목표를 전부 돌려 실제로 불릴 키 집합을 얻는다.
const ticketKeys = new Set();
for (let car = 1; car <= SRT_CARS; car += 1) {
  for (let row = 1; row <= SEAT_ROWS; row += 1) {
    for (const letter of TARGET_SEAT_LETTERS) {
      ticketVoiceKeys({ car, row, letter }).forEach(key => ticketKeys.add(key));
    }
  }
}

const generatorSource = await readFile(
  new URL("../scripts/generate_voice_pack.py", import.meta.url), "utf8");

// 스캔 대상은 "오디오를 실제로 만지는 파일"이다 — 파일 이름이나 src 전체가
// 아니다. srt-journey-scene.mjs 는 CSS 클래스 "srt-parking" 을 쓰는데(197행)
// 이름이 음성 키와 같다. src 전체로 넓히면 그 클래스가 호출로 오탐돼, 정작
// srt-parking 이 사문화돼도 못 잡는다. 오디오 접촉 여부로 거르면 그 파일은
// 구조적으로 빠지고, 나중에 새 파일이 음성을 부르면 자동으로 포함된다.
// (물감 세션의 스캔 범위·이름 충돌 지적에서 나온 설계 — 2026-08-11)
const AUDIO_TOUCH = /playPrompt|playSrtVoice|audio\./;
const srcDir = new URL("../src/", import.meta.url);
const voiceSources = new Map();
for (const file of await readdir(srcDir)) {
  if (!file.endsWith(".mjs") || file === "audio-manifest.mjs") continue;
  const source = await readFile(new URL(file, srcDir), "utf8");
  if (AUDIO_TOUCH.test(source)) voiceSources.set(file, source);
}
const appSource = voiceSources.get("app.mjs") ?? "";

const manifestKeys = Object.keys(VOICE).filter(key => key.startsWith("srt-")).sort();

function pythonKeys(name) {
  const block = generatorSource.match(new RegExp(`${name} = \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(block, `${name} 딕셔너리가 없다`);
  return [...block[1].matchAll(/"(srt-[\w-]+)":/g)].map(match => match[1]).sort();
}

// 호출 경로가 세 갈래다 — 하나만 훑으면 살아 있는 키를 사문화로 오판한다.
// (실제로 playPrompt만 보고 7개를 죽은 키로 착각한 적이 있다.)
function appVoiceKeys() {
  const keys = new Set();
  for (const source of voiceSources.values()) {
    for (const call of source.matchAll(/play(?:Prompt|SrtVoice)\("(srt-[\w-]+)"\)/g)) {
      keys.add(call[1]);
    }
    // playSrtSequence([...]) 안의 문자열도 실제 재생 경로다.
    for (const call of source.matchAll(/playSrtSequence\(\[([^\]]*)\]/g)) {
      for (const key of call[1].matchAll(/"(srt-[\w-]+)"/g)) keys.add(key[1]);
    }
  }
  ticketKeys.forEach(key => keys.add(key));
  for (const name of ["SRT_SPLASH_VOICES", "SRT_STATION_VOICES"]) {
    const block = appSource.match(new RegExp(`const ${name} = [\\[{]([\\s\\S]*?)[\\]}];`));
    assert.ok(block, `${name} 정의가 없다`);
    for (const key of block[1].matchAll(/"(srt-[\w-]+)"/g)) keys.add(key[1]);
  }
  return [...keys].sort();
}

test("SRT 음성은 한국어와 영어를 함께 갖는다", () => {
  assert.ok(manifestKeys.length >= 13, `키 ${manifestKeys.length}개`);
  for (const key of manifestKeys) {
    assert.equal(VOICE[key].ko, `assets/audio/voice/ko/${key}.mp3`, key);
    assert.equal(VOICE[key].en, `assets/audio/voice/en/${key}.mp3`, key);
  }
});

test("생성 스크립트의 한국어·영어 문구가 매니페스트와 정확히 같은 키를 덮는다", () => {
  assert.deepEqual(pythonKeys("KO_SRT"), manifestKeys, "한국어 문구 목록이 어긋난다");
  assert.deepEqual(pythonKeys("EN_SRT"), manifestKeys, "영어 문구 목록이 어긋난다");
});

test("생성 스크립트가 두 묶음을 실제로 렌더한다", () => {
  assert.match(generatorSource, /render_pack\("ko", KO_SRT/);
  assert.match(generatorSource, /render_pack\("en", EN_SRT/);
});

test("앱이 부르는 SRT 음성은 모두 등재돼 있다 — 무음이 되는 키가 없다", () => {
  for (const key of appVoiceKeys()) {
    assert.ok(manifestKeys.includes(key), `${key} 가 매니페스트에 없다(조용히 무음)`);
  }
});

// 물감 세션이 같은 이식을 하며 넣은 구조 가드를 여기도 둔다(2026-08-11).
// 위 두 테스트는 "내가 아는 세 경로"를 훑는다 — 넷째 경로가 생기면 스캔 범위가
// 조용히 좁아져, 살아 있는 키를 사문화로 오판한다(내가 실제로 밟은 함정).
// 새 경로가 생기면 여기서 먼저 걸려 스캐너를 갱신하라고 알려 준다.
test("SRT 음성 호출 경로가 알려진 세 갈래를 벗어나지 않는다", () => {
  const scanned = new Set(appVoiceKeys());
  for (const [file, source] of voiceSources) {
    for (const match of source.matchAll(/"(srt-[\w-]+)"/g)) {
      assert.ok(scanned.has(match[1]),
        `${file} 의 ${match[1]} 이 스캔 밖에 있다 — ` +
        "새 호출 경로가 생겼으니 appVoiceKeys()를 갱신하라");
    }
  }
});

test("오디오를 만지는 파일만 스캔한다 — 이름이 같은 CSS 클래스에 속지 않는다", () => {
  // srt-journey-scene.mjs 는 CSS 클래스 "srt-parking" 을 쓴다. 스캔에 들어오면
  // 호출로 오탐돼 사문화 검사가 무력해진다. 이 파일이 오디오를 만지기 시작하면
  // 이 테스트가 먼저 걸려 이름 충돌을 처리하라고 알려 준다.
  assert.ok(voiceSources.has("app.mjs"), "app.mjs 는 스캔에 있어야 한다");
  assert.ok(!voiceSources.has("srt-journey-scene.mjs"),
    "srt-journey-scene.mjs 가 오디오를 만지기 시작했다 — " +
    "CSS 클래스 srt-parking 과 음성 키 srt-parking 의 충돌을 먼저 해소하라");
});

test("등재한 SRT 음성은 앱이 실제로 부른다 — 사문화된 키가 없다", () => {
  const called = appVoiceKeys();
  for (const key of manifestKeys) {
    assert.ok(called.includes(key), `${key} 를 앱이 부르지 않는다`);
  }
});
