import test from "node:test";
import assert from "node:assert/strict";
import {
  countCharacterValues,
  equationText,
  multiplicationBoard
} from "../src/problem-scene.mjs";

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.dataset = {};
    this.style = new FakeStyle();
    this.children = [];
    this.attributes = new Map();
    this.textContent = "";
  }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
}

const fakeDocument = {
  createElement(tagName) { return new FakeElement(tagName); }
};

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

function byClass(root, className) {
  return descendants(root).filter(node =>
    typeof node.className === "string" &&
    node.className.split(" ").includes(className)
  );
}

test("더하기와 곱셈 식을 화면용 기호로 만든다", () => {
  assert.equal(
    equationText({ mode: "add", operands: [6, 38] }),
    "6 + 38"
  );
  assert.equal(
    equationText({ mode: "mul", operands: [6, 8] }),
    "6 × 8"
  );
  assert.equal(
    equationText({ mode: "sub", operands: [38, 6] }),
    "38 − 6"
  );
});

test("세기 캐릭터는 1부터 20까지 십 블록으로 분해한다", () => {
  assert.deepEqual(countCharacterValues(1), [1]);
  assert.deepEqual(countCharacterValues(10), [10]);
  assert.deepEqual(countCharacterValues(13), [10, 3]);
  assert.deepEqual(countCharacterValues(20), [10, 10]);
  assert.throws(() => countCharacterValues(21), RangeError);
});

test("숫자 세기는 피연산자 장면을 만들지 않는다", () => {
  assert.throws(
    () => equationText({ mode: "count", answer: 6 }),
    TypeError
  );
});

// 감사(2026-08-06): 곱하기 카드 부제("줄과 칸을 세어요")와 음성("블록판에는 모두
// 몇 개가 있을까요?")이 말하는 블록판이 화면에 없어서, 구구단을 모르는 아이가
// 답을 세어 구할 방법이 없었다. 줄×칸 블록판이 그 문구의 화면 대응물이다.
test("곱하기 블록판은 줄 수 × 칸 수 블록을 그리고 총합이 답과 같다", () => {
  const problem = { mode: "mul", operands: [4, 6], answer: 24 };
  const board = multiplicationBoard(fakeDocument, problem);

  const rows = byClass(board, "mul-row");
  assert.equal(rows.length, 4, "줄 수 = 왼쪽 수");
  for (const row of rows) {
    assert.equal(row.children.length, 6, "한 줄의 칸 수 = 오른쪽 수");
  }
  const blocks = descendants(board).filter(node => node.tagName === "I");
  assert.equal(blocks.length, 24, "블록 총합 = 답");

  assert.equal(board.dataset.rows, "4");
  assert.equal(board.dataset.cols, "6");
  assert.equal(board.style.values.get("--mul-rows"), "4");
  assert.equal(board.style.values.get("--mul-cols"), "6");
  assert.equal(board.attributes.get("aria-label"), "4줄 6칸, 모두 24개");
  assert.equal(byClass(board, "equation-label")[0].textContent, "4 × 6");
});

test("곱하기 블록판은 한 줄이 한 묶음으로 읽히게 줄마다 번호를 남긴다", () => {
  const board = multiplicationBoard(fakeDocument, {
    mode: "mul",
    operands: [3, 5],
    answer: 15
  });
  assert.deepEqual(
    byClass(board, "mul-row").map(row => row.dataset.row),
    ["1", "2", "3"]
  );
});

test("곱하기 블록판은 곱하기 문제만 받는다", () => {
  assert.throws(
    () => multiplicationBoard(fakeDocument, {
      mode: "add",
      operands: [2, 3],
      answer: 5
    }),
    TypeError
  );
});

test("곱하기 친구 장면은 왼쪽 수 친구를 오른쪽 수만큼 세운다", () => {
  // 2026-08-14 대장 지적: 10×1이 "1 친구 열 명"으로 나왔다. 말(10 곱하기 1)과
  // 그림(10 친구 한 명)이 같아야 한다. 4×5면 4 친구가 다섯 명이다.
  const made = [];
  const board = multiplicationBoard(
    fakeDocument,
    { mode: "mul", operands: [4, 5], answer: 20 },
    (number, className) => {
      made.push([number, className]);
      const image = fakeDocument.createElement("img");
      image.className = className;
      image.dataset.number = String(number);
      return image;
    }
  );

  const groups = byClass(board, "mul-row");
  assert.equal(groups.length, 5, "사람 수 = 오른쪽 수");
  assert.deepEqual(made, Array.from({ length: 5 }, () => [4, "mul-friend"]),
    "모두 왼쪽 수 친구");
  for (const group of groups) {
    assert.equal(group.children.length, 1, "한 자리에 친구 한 명");
    assert.equal(group.dataset.friend, "4");
  }
  assert.equal(
    descendants(board).filter(node => node.tagName === "I").length, 0,
    "익명 네모는 남지 않는다"
  );
  assert.equal(board.attributes.get("aria-label"), "4 친구 5명, 모두 20개");
});

test("한 명짜리 곱셈도 친구 한 명으로 그린다", () => {
  const made = [];
  const board = multiplicationBoard(
    fakeDocument,
    { mode: "mul", operands: [10, 1], answer: 10 },
    (number, className) => {
      made.push(number);
      const image = fakeDocument.createElement("img");
      image.className = className;
      return image;
    }
  );
  assert.equal(byClass(board, "mul-row").length, 1, "10 × 1 은 친구 한 명");
  assert.deepEqual(made, [10]);
});

test("캐릭터 생성기가 없으면 예전 줄×칸 네모판으로 물러난다", () => {
  const board = multiplicationBoard(
    fakeDocument, { mode: "mul", operands: [2, 3], answer: 6 });
  assert.equal(
    descendants(board).filter(node => node.tagName === "I").length, 6);
  assert.equal(byClass(board, "mul-row").length, 2, "네모판은 왼쪽 수만큼 줄");
});
