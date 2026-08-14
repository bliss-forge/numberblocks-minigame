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

test("곱하기 줄은 칸 수만큼의 블록으로 그려진 친구 한 명이 채운다", () => {
  // 2026-08-14: 감사 대응으로 들어간 익명 노란 네모가 넘버블럭스 친구를 밀어냈다.
  // 캐릭터 그림 자체가 제 수만큼의 블록이라 세기와 친구가 한 그림에서 같이 된다.
  const made = [];
  const board = multiplicationBoard(
    fakeDocument,
    { mode: "mul", operands: [5, 2], answer: 10 },
    (number, className) => {
      made.push([number, className]);
      const image = fakeDocument.createElement("img");
      image.className = className;
      image.dataset.number = String(number);
      return image;
    }
  );

  const rows = byClass(board, "mul-row");
  assert.equal(rows.length, 5, "줄 수 = 왼쪽 수");
  assert.deepEqual(made, Array.from({ length: 5 }, () => [2, "mul-friend"]),
    "줄마다 오른쪽 수 친구 한 명");
  for (const row of rows) {
    assert.equal(row.children.length, 1, "한 줄에 친구 한 명");
    assert.equal(row.dataset.friend, "2");
  }
  assert.equal(
    descendants(board).filter(node => node.tagName === "I").length, 0,
    "익명 네모는 남지 않는다"
  );
  assert.equal(board.attributes.get("aria-label"), "5줄 2칸, 모두 10개");
});

test("캐릭터 생성기가 없으면 예전 네모 줄로 물러난다", () => {
  const board = multiplicationBoard(
    fakeDocument, { mode: "mul", operands: [2, 3], answer: 6 });
  assert.equal(
    descendants(board).filter(node => node.tagName === "I").length, 6);
});
