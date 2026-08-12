// 물감 놀이 데이터 계약 — 혼합 테이블·레시피·주제·튜브의 정합성.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_MIX,
  KEY_SLOTS,
  MIX3_TABLE,
  MIX4_TABLE,
  MIX_TABLE,
  PAINT_COLORS,
  PAINT_RECIPES,
  PAINT_SUBJECTS,
  PAINT_TUBES,
  STAGE_PLANS,
  STAGE_PARTS,
  UNLOCKABLE,
  keyDigitSlot,
  mixJar,
  mixKey,
  mixResult,
  slotKeyDigit
} from "../src/paint-play-data.mjs";

test("혼합은 순서 무관이다 (a+b = b+a)", () => {
  assert.equal(mixResult("red", "yellow"), "orange");
  assert.equal(mixResult("yellow", "red"), "orange");
  assert.equal(mixResult("white", "blue"), mixResult("blue", "white"));
});

test("모든 레시피 재료는 실제 튜브고, 결과는 팔레트에 있다", () => {
  const tubeIds = new Set(PAINT_TUBES.map(tube => tube.id));
  for (const [result, parts] of Object.entries(PAINT_RECIPES)) {
    assert.ok(PAINT_COLORS[result], `${result} 팔레트 등재`);
    assert.ok([1, 2, 3, 4].includes(parts.length), `${result} 재료 수`);
    for (const part of parts) {
      assert.ok(tubeIds.has(part), `${result}의 재료 ${part}는 튜브여야 한다`);
    }
  }
});

test("2재료 레시피는 전부 MIX_TABLE에 존재한다 (미정의 조합 없음)", () => {
  for (const [result, parts] of Object.entries(PAINT_RECIPES)) {
    if (parts.length !== 2) continue;
    assert.equal(MIX_TABLE[mixKey(parts[0], parts[1])], result);
  }
});

test("튜브 5종의 모든 2색 조합(중복 포함)이 진짜 색을 낸다 — null 금지", () => {
  for (const a of PAINT_TUBES) {
    for (const b of PAINT_TUBES) {
      const result = mixResult(a.id, b.id);
      assert.ok(result, `${a.id}+${b.id}`);
      assert.ok(PAINT_COLORS[result], `${a.id}+${b.id} → ${result} 팔레트 등재`);
    }
  }
  assert.equal(mixResult("red", "red"), "red", "같은 색은 그대로");
  assert.equal(mixResult("black", "white"), "gray");
  assert.equal(mixResult("yellow", "white"), "lightyellow");
});

test("서로 다른 튜브 3색 조합 10가지가 전부 진짜 색을 낸다 — null 금지", () => {
  const tubes = PAINT_TUBES.map(tube => tube.id);
  for (let i = 0; i < tubes.length; i += 1) {
    for (let j = i + 1; j < tubes.length; j += 1) {
      for (let k = j + 1; k < tubes.length; k += 1) {
        const result = mixResult(tubes[i], tubes[j], tubes[k]);
        assert.ok(result, `${tubes[i]}+${tubes[j]}+${tubes[k]}`);
        assert.ok(PAINT_COLORS[result],
          `${tubes[i]}+${tubes[j]}+${tubes[k]} → ${result} 팔레트 등재`);
      }
    }
  }
  // 대표 조합 — 순서 무관, 빨+노+검은 기존 밤색을 재사용한다(주황+검정 직관)
  assert.equal(mixResult("red", "yellow", "white"), "peach");
  assert.equal(mixResult("white", "yellow", "red"), "peach");
  assert.equal(mixResult("red", "yellow", "black"), "brown");
});

test("해금 대상은 전부 2재료 레시피 색이다", () => {
  for (const colorId of UNLOCKABLE) {
    assert.equal(PAINT_RECIPES[colorId]?.length, 2, colorId);
  }
});

test("mixJar — 해금 튜브는 재료로 전개돼 기존 테이블과 등가다", () => {
  assert.equal(mixJar(["red", "yellow"]), "orange", "기본 2색 그대로");
  assert.equal(mixJar(["orange"]), "orange", "해금 튜브 단독은 그 색");
  assert.equal(mixJar(["orange", "white"]), "peach", "주황+하양 = 빨+노+하양");
  assert.equal(mixJar(["green", "black"]), "darkgreen");
  assert.equal(mixJar(["pink", "sky"]), "lavender", "분홍+하늘 = 빨+파+하양");
  assert.equal(mixJar(["orange", "green"]), "darkbrown", "합집합 3원색");
  // 해금 색끼리 어떤 조합도 이름 있는 색 — 4원색도 이름을 얻었다
  for (const a of UNLOCKABLE) {
    for (const b of UNLOCKABLE) {
      const result = mixJar([a, b]);
      assert.ok(result, `${a}+${b}`);
      assert.ok(PAINT_COLORS[result], `${a}+${b} → ${result} 팔레트 등재`);
    }
  }
  // 해금 지름길로 4원색에 닿는 대표 경로 — 사용자 요구("2,3가지로 4가지를")
  assert.equal(mixJar(["orange", "sky"]), "sand", "주황+하늘 = 빨노파하양");
  assert.equal(mixJar(["pink", "green"]), "sand", "분홍+초록도 같은 4원색");
  assert.equal(mixJar(["navy", "pink"]), "grayviolet", "남색+분홍 = 빨파검하양");
  assert.equal(mixJar(["orange", "black", "white"]), "ochre", "3손짓 경로");
  assert.equal(mixJar(["green", "black", "white"]), "sage", "3손짓 경로");
});

test("먹색은 삼원색+검정이거나 전부 섞였을 때만 나온다", () => {
  assert.equal(mixJar(["red", "yellow", "blue", "black"]), "mud");
  assert.equal(mixJar(["orange", "navy"]), "mud", "주황+남색 = 빨노파검");
  assert.equal(
    mixJar(["red", "yellow", "blue", "black", "white"]), "mud", "다 섞으면 먹색"
  );
  assert.equal(mixJar(["sand", "black"]), "mud", "4색 결과에 검정을 더하면 먹색");
  assert.ok(PAINT_COLORS.mud, "먹색 팔레트 등재");
});

test("4원색 조합 5가지가 전부 이름 있는 색이다 — null 금지", () => {
  const tubes = PAINT_TUBES.map(tube => tube.id);
  const seen = new Set();
  for (let skip = 0; skip < tubes.length; skip += 1) {
    const parts = tubes.filter((_, index) => index !== skip);
    const result = mixJar(parts);
    assert.ok(result, parts.join("+"));
    assert.ok(PAINT_COLORS[result], `${parts.join("+")} → ${result} 팔레트 등재`);
    seen.add(result);
  }
  // 넷 중 넷은 고유색, 빨+노+파+검만 먹색을 재사용한다
  assert.equal(seen.size, 5);
  assert.ok(seen.has("mud"));
  for (const id of ["sand", "ochre", "grayviolet", "sage"]) {
    assert.ok(seen.has(id), `${id} 4원색 결과`);
    assert.equal(MIX4_TABLE[mixKey(...PAINT_RECIPES[id])], id, `${id} 테이블`);
  }
});

test("혼합 낭독 원본(CANONICAL_MIX) — 모든 혼합색의 재료가 정의된다", () => {
  const TABLES = { 2: MIX_TABLE, 3: MIX3_TABLE, 4: MIX4_TABLE };
  for (const [colorId, parts] of Object.entries(CANONICAL_MIX)) {
    assert.ok(PAINT_COLORS[colorId], `${colorId} 팔레트 등재`);
    const table = TABLES[parts.length];
    assert.ok(table, `${colorId} 재료 수 ${parts.length}에 맞는 테이블`);
    assert.equal(
      table[mixKey(...parts)], colorId, `${colorId} 재료가 혼합 테이블과 일치`
    );
  }
  // 레시피 있는 혼합색·발견색 모두 낭독 원본이 있다
  for (const [result, parts] of Object.entries(PAINT_RECIPES)) {
    if (parts.length >= 2) assert.ok(CANONICAL_MIX[result], `${result} 낭독 원본`);
  }
  for (const id of ["lightyellow", "olive", "gray", "brick", "khaki", "bluegray"]) {
    assert.ok(CANONICAL_MIX[id], `${id} 발견색 낭독 원본`);
  }
});

// 스테이지→재료 수는 STAGE_PARTS 선언으로만 안다. 예전엔 if/else 사슬이라
// 새 스테이지가 else로 떨어져 조용히 오판했다(2026-08-11 감사).
test("그림 주제는 목표색·스테이지가 팔레트·레시피와 정합한다", () => {
  for (const subject of PAINT_SUBJECTS) {
    assert.ok(PAINT_COLORS[subject.color], `${subject.id} 색`);
    const parts = PAINT_RECIPES[subject.color];
    assert.ok(parts, `${subject.id} 레시피`);
    const expected = STAGE_PARTS[subject.stage];
    assert.ok(expected, `스테이지 ${subject.stage} 재료 수 선언`);
    assert.equal(parts.length, expected, subject.id);
    if (subject.stage === 3) {
      assert.ok(parts.includes("white") || parts.includes("black"),
        `${subject.id}는 연하게/진하게 스테이지`);
    }
  }
});

// 사용자 요구(2026-08-11): 한 판에 그림 열 개.
test("모든 난이도가 한 판에 열 라운드다", () => {
  for (const [difficulty, plan] of Object.entries(STAGE_PLANS)) {
    assert.equal(plan.length, 10, `${difficulty} 라운드 수`);
  }
});

// 선반은 기본 다섯에서 시작해 숫자키가 덮는 열 칸까지만 자란다. 계획이
// 해금 대상(2재료 = 스테이지 2·3·4 목표)을 여섯 개 이상 내면 키 없는
// 튜브가 생긴다 — 계획을 손볼 때마다 여기서 걸리게 한다.
test("한 판의 해금 대상은 다섯을 넘지 않는다 — 선반이 열 칸을 넘지 않게", () => {
  const twoPart = new Set(
    Object.entries(PAINT_RECIPES)
      .filter(([, parts]) => parts.length === 2)
      .map(([colorId]) => colorId)
  );
  for (const [difficulty, plan] of Object.entries(STAGE_PLANS)) {
    // 스테이지 2·3 은 항상 2재료, 스테이지 4(역추론)도 2·3 색 풀에서 뽑는다
    const unlockable = plan.filter(stage => [2, 3, 4].includes(stage)).length;
    assert.ok(
      unlockable <= KEY_SLOTS - PAINT_TUBES.length,
      `${difficulty} 해금 대상 ${unlockable}개 — 최대 ${KEY_SLOTS - PAINT_TUBES.length}`
    );
  }
  // 스테이지 2·3 목표색이 실제로 전부 2재료(=해금 대상)인지 확인
  for (const subject of PAINT_SUBJECTS) {
    if (subject.stage === 2 || subject.stage === 3) {
      assert.ok(twoPart.has(subject.color), `${subject.id} 는 2재료 색`);
    }
  }
});

// 원색 라운드가 다섯 색 전부를 쓴다 — 판 시작의 다섯 튜브를 다 써 보게 한다.
test("원색 스테이지는 기본 튜브 다섯 색을 모두 출제한다", () => {
  const primaries = new Set(
    PAINT_SUBJECTS.filter(subject => subject.stage === 1).map(subject => subject.color)
  );
  assert.deepEqual(
    [...primaries].sort(),
    PAINT_TUBES.map(tube => tube.id).sort(),
    "원색 출제 색 = 기본 튜브"
  );
  for (const tube of PAINT_TUBES) {
    assert.deepEqual(PAINT_RECIPES[tube.id], [tube.id], `${tube.id} 1재료 레시피`);
  }
});

// 사용자 요구(2026-08-11): 쉬움 2가지 · 중간 3가지 · 어려움 4가지.
test("난이도 = 섞는 색 개수 — 쉬움 2 · 중간 3 · 어려움 4", () => {
  const parts = plan => plan.map(stage => STAGE_PARTS[stage] ?? 2);
  assert.equal(Math.max(...parts(STAGE_PLANS.easy)), 2, "쉬움은 두 색까지");
  assert.equal(Math.max(...parts(STAGE_PLANS.steady)), 3, "중간은 세 색까지");
  assert.equal(Math.max(...parts(STAGE_PLANS.challenge)), 4, "어려움은 네 색");
  assert.ok(STAGE_PLANS.steady.includes(5), "중간에 3색 라운드");
  assert.ok(STAGE_PLANS.challenge.includes(6), "어려움에 4색 라운드");
  assert.ok(!STAGE_PLANS.easy.includes(5), "쉬움에 3색 없음");
  assert.ok(!STAGE_PLANS.steady.includes(6), "중간에 4색 없음");
  // 해금 없는 첫 판을 위해 어려움도 2색 라운드로 시작한다(해금 유도)
  assert.equal(STAGE_PARTS[STAGE_PLANS.challenge[0]], 2, "어려움 첫 라운드는 2색");
});

test("3색 혼합 스테이지(5) — 주문 가능한 색과 그림이 충분히 있다", () => {
  const stage5 = PAINT_SUBJECTS.filter(subject => subject.stage === 5);
  assert.ok(stage5.length >= 6, "3색 혼합 그림 6종 이상");
  const colors = new Set(stage5.map(subject => subject.color));
  assert.ok(colors.size >= 6, "3색 혼합 주문색 6종 이상");
});

test("4색 혼합 스테이지(6) — 주문색 4종과 그림이 있고 지름길이 2~3손짓이다", () => {
  const stage6 = PAINT_SUBJECTS.filter(subject => subject.stage === 6);
  assert.ok(stage6.length >= 4, "4색 혼합 그림 4종 이상");
  const colors = [...new Set(stage6.map(subject => subject.color))];
  assert.equal(colors.length, 4, "4원색 주문색은 정확히 4종(나머지는 먹색)");
  for (const colorId of colors) {
    assert.equal(PAINT_RECIPES[colorId].length, 4, `${colorId} 4재료`);
    // 해금 튜브를 쓰면 두세 손짓으로 닿는다 — 사용자 요구의 핵심
    const shortest = shortestJar(colorId);
    assert.ok(shortest <= 3, `${colorId} 지름길 ${shortest}손짓`);
    assert.ok(shortest >= 2, `${colorId} 한 손짓 클리어는 없어야 한다`);
  }
});

// 해금 튜브 전체를 써서 목표색에 닿는 최소 손짓 수(전수 탐색).
function shortestJar(colorId) {
  const pool = [...PAINT_TUBES.map(tube => tube.id), ...UNLOCKABLE];
  let best = Infinity;
  const walk = (start, picked) => {
    if (picked.length && picked.length < best && mixJar(picked) === colorId) {
      best = picked.length;
      return;
    }
    if (picked.length >= 4) return;
    for (let index = start; index < pool.length; index += 1) {
      walk(index + 1, [...picked, pool[index]]);
    }
  };
  walk(0, []);
  return best;
}

test("모든 스테이지 계획의 스테이지에 출제 가능한 주제가 있다", () => {
  const stages = new Set(PAINT_SUBJECTS.map(subject => subject.stage));
  for (const plan of Object.values(STAGE_PLANS)) {
    for (const stage of plan) {
      if (stage === 4) {
        assert.ok(stages.has(2) || stages.has(3));
      } else {
        assert.ok(stages.has(stage), `스테이지 ${stage}`);
      }
    }
  }
});

test("탈것 주제가 색마다 고르게 있다 (자동차 색 입히기 요구)", () => {
  const vehicles = PAINT_SUBJECTS.filter(subject => subject.vehicle);
  assert.ok(vehicles.length >= 6, "탈것 6종 이상");
  // 2스테이지 혼합색(주황·초록·보라)에는 탈것과 비탈것이 모두 있다
  for (const color of ["orange", "green", "purple"]) {
    const pool = PAINT_SUBJECTS.filter(subject => subject.color === color);
    assert.ok(pool.some(subject => subject.vehicle), `${color} 탈것`);
    assert.ok(pool.some(subject => !subject.vehicle), `${color} 비탈것`);
  }
});

// 계약 변경(2026-08-11 사용자 지시): 숫자키는 캐릭터 번호가 아니라 선반 슬롯 순번이다.
// 해금 튜브까지 1..9,0 으로 고를 수 있어야 한다는 요구라, 키를 데이터가 아니라
// 위치에서 파생시킨다. 마스코트(char)는 색 정체성으로 그대로 남는다.
test("선반 슬롯 ↔ 숫자키 — 1..9 다음이 0이고 11번째부터는 키가 없다", () => {
  assert.equal(KEY_SLOTS, 10);
  assert.deepEqual(
    Array.from({ length: 11 }, (_, index) => slotKeyDigit(index)),
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", null]
  );
  for (let index = 0; index < KEY_SLOTS; index += 1) {
    assert.equal(keyDigitSlot(slotKeyDigit(index)), index, `슬롯 ${index} 왕복`);
  }
  assert.equal(keyDigitSlot("0"), 9, "0은 열 번째 칸");
  assert.equal(keyDigitSlot("x"), -1, "숫자가 아니면 슬롯 없음");
});

test("기본 튜브는 다섯 종이고 마스코트만 데이터로 남는다(키는 위치 파생)", () => {
  assert.deepEqual(
    PAINT_TUBES.map(tube => tube.id),
    ["red", "yellow", "blue", "black", "white"]
  );
  for (const tube of PAINT_TUBES) {
    assert.ok(tube.char, `${tube.id} 마스코트`);
    assert.equal(tube.keyDigit, undefined, `${tube.id} 정적 숫자키 제거`);
  }
});
