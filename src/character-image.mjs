// 캐릭터 이미지의 주소를 한 곳에서 만든다.
//
// 원본 PNG(1024×1536)는 그대로 두고 같은 해상도의 WebP 파생본을 srcset 으로
// 얹는다. 해상도를 줄이지 않는 이유: 화면 최대 표시 폭이 570px인데 고해상도
// 화면(DPR 2)은 1140px를 원한다 — 줄이면 그 화면에서 흐려진다. 줄이는 것은
// 용량뿐이고, 그것만으로 1~10번 열 장이 4788KB에서 410KB가 된다.
// (2026-08-28 실측: count 모드 진입에 이미지 947KB가 붙었다.)
//
// 홈 카드가 이미 쓰는 방식과 같다 — src 는 PNG, srcset 은 WebP.
import { characterAsset } from "./character-spec.mjs";

export const CHARACTER_ROOT = "assets/characters";

export function characterPngPath(asset) {
  return `${CHARACTER_ROOT}/${asset}`;
}

export function characterWebpPath(asset) {
  return `${CHARACTER_ROOT}/webp/${asset.replace(/\.png$/, ".webp")}`;
}

// 후보가 하나뿐이라 브라우저는 화면 배율과 무관하게 이것을 고른다.
export function characterSrcset(asset) {
  return `${characterWebpPath(asset)} 1024w`;
}

/** <img> 하나에 PNG 원본과 WebP 파생본을 함께 걸어 준다. */
export function applyCharacterSource(image, asset) {
  image.src = characterPngPath(asset);
  image.srcset = characterSrcset(asset);
  return image;
}

/** 번호로 바로 걸 때. */
export function applyCharacterNumber(image, number) {
  return applyCharacterSource(image, characterAsset(number));
}
