// SVG 무대 위에 넘버블럭스 친구를 세운다.
//
// 5번(안전한 길찾기)과 같은 에셋을 쓴다 — characterAsset() 이 고르는 공식 캐릭터
// 그림이다(1~10은 one.png…ten.png, 그 위는 number-NNN.png).
//
// 에셋 캔버스에는 빈 여백이 많고 그 여백의 크기가 번호마다 다르다. 그대로 얹으면
// 1번은 바닥에서 21% 쯤 떠 있고 7번은 붙어 선다. 그래서 중첩 <svg> 의 viewBox 로
// 몸이 실제로 차지하는 사각형만 오려 내 바닥선에 맞춘다.
//
// 크기는 폭을 기준으로 준다. 넘버블럭스는 번호마다 몸 비율이 다르고(5는 길쭉한
// 기둥, 9는 3×3 정사각) 그 비율이 곧 캐릭터의 정체성이라, 높이를 맞추면 9가
// 납작해지고 5가 홀쭉해진다. 폭을 맞추면 원본 비례가 그대로 산다.

import { characterAsset } from "./character-spec.mjs";
import { CHARACTER_VISUAL_METRICS } from "./character-visual-metrics.mjs";

const ASSET_ROOT = "assets/characters";

export function characterNumberFor(unit) {
  return Math.max(1, Math.min(150, Math.floor(unit)));
}

export function characterAssetPath(number) {
  return `${ASSET_ROOT}/${characterAsset(characterNumberFor(number))}`;
}

/**
 * 바닥선(baseY)에 발을 붙이고 선 친구 한 명.
 * @param {{number:number, cx:number, baseY:number, width:number, className?:string}} spec
 */
export function standingCharacterSvg({ number, cx, baseY, width, className = "dv-friend" }) {
  const index = characterNumberFor(number);
  const metric = CHARACTER_VISUAL_METRICS[index];
  if (!metric?.box) return "";

  const { box } = metric;
  const height = (width * box.height) / box.width;
  const x = cx - width / 2;
  const y = baseY - height;

  // 중첩 <svg> 의 viewBox 가 캔버스에서 몸만 잘라 낸다.
  return `<svg class="${className}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" ` +
    `width="${width.toFixed(1)}" height="${height.toFixed(1)}" ` +
    `viewBox="${box.x} ${box.y} ${box.width} ${box.height}" ` +
    `overflow="visible" role="img" aria-label="숫자 ${index} 블록 친구">` +
    `<image href="${characterAssetPath(index)}" x="0" y="0" ` +
    `width="${metric.canvas.width}" height="${metric.canvas.height}"/></svg>`;
}

// 그림에서 차지할 높이 — 무대가 배치를 계산할 때 쓴다.
export function standingCharacterHeight(number, width) {
  const metric = CHARACTER_VISUAL_METRICS[characterNumberFor(number)];
  if (!metric?.box) return width;
  return (width * metric.box.height) / metric.box.width;
}
