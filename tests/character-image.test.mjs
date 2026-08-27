// 캐릭터 이미지 주소 계약.
//
// 원본 PNG(1024×1536)는 그대로 두고 같은 해상도의 WebP 파생본을 얹는다.
// 2026-08-28 실측: count 모드 진입에 이미지 947KB → 81KB.
// 여기서 지키는 것은 두 가지다 — (1) 주소를 한 곳에서만 만든다, (2) 모든
// 원본에 파생본이 있다. 둘 중 하나가 깨지면 그림이 안 뜨거나 용량이 되돌아온다.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import {
  applyCharacterNumber,
  applyCharacterSource,
  characterPngPath,
  characterSrcset,
  characterWebpPath
} from "../src/character-image.mjs";
import { characterAsset } from "../src/character-spec.mjs";

const charactersDir = new URL("../assets/characters/", import.meta.url);
const srcDir = new URL("../src/", import.meta.url);

test("PNG 원본과 WebP 파생본 주소를 만든다", () => {
  assert.equal(characterPngPath("five.png"), "assets/characters/five.png");
  assert.equal(characterWebpPath("five.png"), "assets/characters/webp/five.webp");
  assert.equal(
    characterWebpPath("number-031.png"),
    "assets/characters/webp/number-031.webp"
  );
  // 후보가 하나뿐이라 화면 배율과 무관하게 이것이 선택된다.
  assert.equal(characterSrcset("five.png"), "assets/characters/webp/five.webp 1024w");
});

test("<img> 에 원본과 파생본을 함께 건다", () => {
  const image = {};
  applyCharacterSource(image, "five.png");
  assert.equal(image.src, "assets/characters/five.png");
  assert.equal(image.srcset, "assets/characters/webp/five.webp 1024w");

  const byNumber = {};
  applyCharacterNumber(byNumber, 7);
  assert.equal(byNumber.src, `assets/characters/${characterAsset(7)}`);
  assert.match(byNumber.srcset, /webp\/seven\.webp/);
});

test("모든 캐릭터 원본에 파생본이 있다", async () => {
  const files = await readdir(charactersDir);
  const pngs = files.filter(name => name.endsWith(".png"));
  assert.ok(pngs.length > 150, `원본 ${pngs.length}장 — 탐색이 끊겼다`);
  for (const png of pngs) {
    const webp = new URL(`webp/${png.replace(/\.png$/, ".webp")}`, charactersDir);
    const info = await stat(webp).catch(() => null);
    assert.ok(info, `${png} 의 파생본이 없다 — ` +
      "python3 scripts/generate_character_webp.py 를 실행하라");
    assert.ok(info.size > 512, `${png} 의 파생본이 비었다`);
  }
});

test("파생본은 원본보다 확실히 작다 — 안 그러면 바꿀 이유가 없다", async () => {
  let png = 0;
  let webp = 0;
  for (const name of ["one", "five", "ten", "number-031", "number-120"]) {
    png += (await stat(new URL(`${name}.png`, charactersDir))).size;
    webp += (await stat(new URL(`webp/${name}.webp`, charactersDir))).size;
  }
  assert.ok(webp * 4 < png, `표본 원본 ${png}B, 파생본 ${webp}B — 이득이 사라졌다`);
});

test("캐릭터 주소는 character-image 한 곳에서만 만든다", async () => {
  // 새 화면이 `assets/characters/${...}` 를 직접 이어 붙이면 파생본을 빼먹고
  // 그 화면만 조용히 원본을 받는다. 그래서 구조로 막는다.
  const allowed = new Set(["character-image.mjs"]);
  for (const file of await readdir(srcDir)) {
    if (!file.endsWith(".mjs") || allowed.has(file)) continue;
    const source = await readFile(new URL(file, srcDir), "utf8");
    for (const line of source.split("\n")) {
      if (!line.includes("assets/characters")) continue;
      // 홈 카드 축소본(thumb)은 별도 크기 계약이라 예외로 둔다.
      if (line.includes("characters/thumb/")) continue;
      assert.fail(
        `${file}: 캐릭터 주소를 직접 만든다 — character-image.mjs 를 써라\n  ${line.trim()}`
      );
    }
  }
});
