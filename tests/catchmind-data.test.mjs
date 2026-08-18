// 슥삭 그림 퀴즈 데이터 계약 — 500개 이상, 이름·이모지 유일, 카테고리·레벨 유효.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CATCHMIND_CATEGORIES,
  CATCHMIND_ITEMS,
  catchmindItemByName
} from "../src/catchmind-data.mjs";

test("문항은 500개 이상이다", () => {
  assert.ok(
    CATCHMIND_ITEMS.length >= 500,
    `500개 이상이어야 한다 — 현재 ${CATCHMIND_ITEMS.length}개`
  );
});

test("이름과 이모지는 전체에서 유일하다", () => {
  const names = new Set();
  const emojis = new Set();
  for (const item of CATCHMIND_ITEMS) {
    assert.ok(!names.has(item.n), `이름 중복: ${item.n}`);
    assert.ok(!emojis.has(item.e), `이모지 중복: ${item.e} (${item.n})`);
    names.add(item.n);
    emojis.add(item.e);
  }
});

test("모든 문항이 유효한 카테고리·레벨·이름 형식을 갖는다", () => {
  for (const item of CATCHMIND_ITEMS) {
    assert.ok(
      Object.hasOwn(CATCHMIND_CATEGORIES, item.c),
      `${item.n}: 카테고리 ${item.c}`
    );
    assert.ok([1, 2, 3].includes(item.l), `${item.n}: 레벨 ${item.l}`);
    assert.ok(
      typeof item.n === "string" && item.n.length >= 1 && item.n.length <= 6,
      `${item.n}: 이름은 1~6자`
    );
    assert.ok(item.e.length > 0, `${item.n}: 이모지 없음`);
  }
});

test("카테고리마다 오답 카드 3장을 만들 수 있다(4개 이상)", () => {
  const byCategory = new Map();
  for (const item of CATCHMIND_ITEMS) {
    byCategory.set(item.c, (byCategory.get(item.c) ?? 0) + 1);
  }
  for (const key of Object.keys(CATCHMIND_CATEGORIES)) {
    assert.ok(
      (byCategory.get(key) ?? 0) >= 4,
      `${key}: ${byCategory.get(key) ?? 0}개 — 최소 4개`
    );
  }
});

test("레벨별 전역 풀은 한 판 선정에 충분하다(각 12개 이상)", () => {
  const byLevel = { 1: 0, 2: 0, 3: 0 };
  for (const item of CATCHMIND_ITEMS) byLevel[item.l] += 1;
  for (const level of [1, 2, 3]) {
    assert.ok(byLevel[level] >= 12, `레벨 ${level}: ${byLevel[level]}개`);
  }
});

test("이름으로 문항을 찾을 수 있다", () => {
  assert.equal(catchmindItemByName("사과")?.e, "🍎");
  assert.equal(catchmindItemByName("없는이름"), null);
});
