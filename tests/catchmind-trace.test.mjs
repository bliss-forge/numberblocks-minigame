// 슥삭 그림 퀴즈 윤곽선 추출 계약 — 실루엣·내부 경계·노이즈·단순화·획 색.

import test from "node:test";
import assert from "node:assert/strict";
import {
  roughenPath as traceRoughen,
  traceEmojiEdges
} from "../src/catchmind-scene.mjs";

// {width, height, data} 합성 이미지 — painter(x, y)가 [r,g,b,a] 또는 null.
function makeImage(width, height, painter) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = painter(x, y);
      if (!pixel) continue;
      const index = (y * width + x) * 4;
      [data[index], data[index + 1], data[index + 2], data[index + 3]] = pixel;
    }
  }
  return { width, height, data };
}

const inSquare = (x, y) => x >= 10 && x <= 29 && y >= 10 && y <= 29;

test("불투명 사각형은 테두리를 한 획으로 딴다", () => {
  const image = makeImage(40, 40, (x, y) =>
    inSquare(x, y) ? [200, 40, 40, 255] : null
  );
  const paths = traceEmojiEdges(image);
  assert.ok(paths.length >= 1, "경로가 없다");
  // 모든 점이 테두리 근처에 있고 둘레(약 76px)에 가까운 길이를 갖는다.
  const [outline] = paths;
  assert.ok(outline.length >= 55, `둘레가 짧다: ${outline.length}`);
  for (const [x, y] of outline.points) {
    assert.ok(x >= 8 && x <= 31 && y >= 8 && y <= 31, `테두리 밖 점 (${x},${y})`);
  }
});

test("완전 투명 이미지는 경로가 없다", () => {
  const image = makeImage(40, 40, () => null);
  assert.deepEqual(traceEmojiEdges(image), []);
});

test("색이 갈리는 내부 경계는 특징선으로 딴다", () => {
  // 왼쪽 파랑 / 오른쪽 초록 — x=19/20 사이에 급격한 색 경계.
  const image = makeImage(40, 40, (x, y) =>
    inSquare(x, y) ? (x < 20 ? [30, 60, 220, 255] : [30, 200, 60, 255]) : null
  );
  const paths = traceEmojiEdges(image);
  // 경계선이 실루엣과 이어져 한 획으로 합쳐질 수 있으므로, 어느 획이든
  // 가운데 세로 띠(x 18~21)를 위아래로 길게 지나가면 특징선으로 인정한다.
  const middleYs = paths
    .flatMap(path => path.points)
    .filter(([x]) => x >= 18 && x <= 21)
    .map(([, y]) => y);
  assert.ok(middleYs.length >= 2, "가운데 세로 특징선이 없다");
  assert.ok(
    Math.max(...middleYs) - Math.min(...middleYs) >= 12,
    "특징선이 세로로 이어지지 않았다"
  );
});

test("완만한 그라데이션은 특징선을 만들지 않는다", () => {
  // 사각형 안에서 x 를 따라 밝기가 서서히 변한다 — 실루엣만 남아야 한다.
  const image = makeImage(40, 40, (x, y) =>
    inSquare(x, y) ? [50 + x * 4, 80, 120, 255] : null
  );
  const paths = traceEmojiEdges(image);
  for (const path of paths) {
    for (const [x, y] of path.points) {
      const onBorder = x <= 11 || x >= 28 || y <= 11 || y >= 28;
      assert.ok(onBorder, `그라데이션 내부에 선이 생겼다 (${x},${y})`);
    }
  }
});

test("RDP 단순화 — 직선 테두리는 적은 점으로 표현된다", () => {
  const image = makeImage(40, 40, (x, y) =>
    inSquare(x, y) ? [200, 40, 40, 255] : null
  );
  const [outline] = traceEmojiEdges(image);
  assert.ok(
    outline.points.length <= 30,
    `단순화가 안 됐다: ${outline.points.length}점`
  );
});

test("작은 얼룩은 노이즈로 버린다", () => {
  const image = makeImage(40, 40, (x, y) => {
    if (inSquare(x, y)) return [200, 40, 40, 255];
    if (x >= 34 && x <= 35 && y >= 4 && y <= 5) return [0, 0, 0, 255]; // 2×2 점
    return null;
  });
  const paths = traceEmojiEdges(image);
  for (const path of paths) {
    for (const [x, y] of path.points) {
      assert.ok(!(x >= 32 && y <= 8), `노이즈가 경로로 남았다 (${x},${y})`);
    }
  }
});

test("획 색은 주변 원본 색을 어둡게 뽑는다", () => {
  const image = makeImage(40, 40, (x, y) =>
    inSquare(x, y) ? [220, 40, 40, 255] : null
  );
  const [outline] = traceEmojiEdges(image);
  const match = outline.color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
  assert.ok(match, `rgb 형식이 아니다: ${outline.color}`);
  const [, r, g, b] = match.map(Number);
  assert.ok(r > g && r > b, "빨간 도형의 획이 빨간 계열이 아니다");
  assert.ok(r < 220, "어둡게 만들지 않았다");
});

test("roughenPath — 단순화하고 손떨림을 더하되 결정적이다", () => {
  const dense = Array.from({ length: 60 }, (_, i) => [i, Math.round(Math.sin(i / 4) * 2)]);
  const rough = traceRoughen(dense, { epsilon: 12, jitter: 3.5 });
  assert.ok(rough.length < dense.length, "단순화가 안 됐다");
  // 손떨림은 jitter 반경 안 — 원래 선에서 크게 벗어나지 않는다.
  for (const [, y] of rough) {
    assert.ok(Math.abs(y) <= 2 + 12 + 3.5, `너무 멀리 벗어남 y=${y}`);
  }
  // 결정적 — 같은 입력이면 같은 출력(매 프레임 모양이 흔들리면 안 된다).
  assert.deepEqual(rough, traceRoughen(dense, { epsilon: 12, jitter: 3.5 }));
});

test("roughenPath — epsilon·jitter 0이면 원본 그대로", () => {
  const points = [[0, 0], [10, 3], [20, 0]];
  assert.deepEqual(traceRoughen(points, { epsilon: 0, jitter: 0 }), points);
});
