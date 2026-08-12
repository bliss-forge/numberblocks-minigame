// 물감 놀이 상태 머신 계약 — 시드 재현성·2색 잠금·자동 혼합·힌트·벌점 없음.

import test from "node:test";
import assert from "node:assert/strict";
import {
  createPaintPlay,
  currentRound,
  currentSubject,
  equationFor,
  jarColor,
  movePaintFocus,
  paintCanvas,
  paintFocusCount,
  recipeFor,
  rinseJar,
  shelfTubes,
  squeezeTube,
  tubeForDigit
} from "../src/paint-play.mjs";
import {
  PAINT_COLORS,
  PAINT_RECIPES,
  PAINT_TUBES,
  RAINBOW_COUNT,
  STAGE_PLANS,
  UNLOCKABLE,
  slotKeyDigit
} from "../src/paint-play-data.mjs";

// 현재 라운드를 정답으로 완성한다 — 테스트 헬퍼.
function solveRound(state) {
  const round = currentRound(state);
  for (const part of recipeFor(round.colorId)) squeezeTube(state, part);
  return paintCanvas(state);
}

// 라운드를 원하는 목표색으로 고정한다. 난이도 계획이 바뀔 때마다 무관한
// 테스트가 무더기로 깨지지 않도록, 재료 수가 중요한 테스트는 이걸 쓴다.
function pinRound(state, colorId, subjectId = null) {
  const round = state.rounds[state.roundIndex];
  round.colorId = colorId;
  if (subjectId) round.subjectId = subjectId;
  return round;
}

test("같은 시드는 같은 라운드 목록을 만든다 (재현성)", () => {
  const a = createPaintPlay("challenge", 42);
  const b = createPaintPlay("challenge", 42);
  assert.deepEqual(a.rounds, b.rounds);
  const c = createPaintPlay("challenge", 43);
  assert.notDeepEqual(a.rounds, c.rounds);
});

test("난이도별 라운드 수·스테이지가 계획을 따른다", () => {
  for (const [difficulty, plan] of Object.entries(STAGE_PLANS)) {
    const state = createPaintPlay(difficulty, 7);
    assert.equal(state.rounds.length, plan.length, difficulty);
    state.rounds.forEach((round, index) => {
      assert.equal(round.stage, plan[index], `${difficulty}[${index}]`);
      assert.equal(
        round.hintLevel, plan[index] === 4 ? 0 : 1,
        `${difficulty}[${index}] 힌트 시작값`
      );
    });
  }
});

// 한 판 안에서 색·그림이 겹치지 않아야 한다. 예전엔 직전 라운드만 걸러서
// 같은 스테이지가 떨어져 배치되면 같은 그림이 다시 나왔고, 전시회 벽에
// 같은 그림 두 장이 걸렸다(2026-08-11 리뷰에서 잡힌 회귀).
test("한 판에 같은 색·같은 그림이 두 번 나오지 않는다", () => {
  for (const difficulty of Object.keys(STAGE_PLANS)) {
    for (let seed = 0; seed < 200; seed += 1) {
      const state = createPaintPlay(difficulty, seed);
      const colors = state.rounds.map(round => round.colorId);
      const subjects = state.rounds.map(round => round.subjectId);
      for (const round of state.rounds) {
        assert.ok(PAINT_RECIPES[round.colorId], "레시피 있는 색");
      }
      assert.equal(new Set(colors).size, colors.length,
        `${difficulty} seed ${seed} 색 중복: ${colors}`);
      assert.equal(new Set(subjects).size, subjects.length,
        `${difficulty} seed ${seed} 그림 중복: ${subjects}`);
    }
  }
});

// 역추론(스테이지 4)은 "무엇과 무엇을 섞을까"를 묻는다. 이미 튜브로 가진
// 색을 내면 그 튜브 한 번으로 정원이 차서 물음이 사라진다(2026-08-11 리뷰).
test("역추론 라운드는 이미 해금한 색을 목표로 내지 않는다", () => {
  const owned = ["orange", "green", "purple", "pink"];
  for (let seed = 0; seed < 200; seed += 1) {
    const state = createPaintPlay("challenge", seed, owned);
    for (const round of state.rounds) {
      if (round.stage !== 4) continue;
      assert.ok(!owned.includes(round.colorId),
        `seed ${seed} 역추론 목표 ${round.colorId} 는 이미 가진 색`);
    }
  }
  // 다 가진 아이면 피할 곳이 없다 — 그때는 출제가 깨지지 않는 쪽이 우선이다
  const all = createPaintPlay("challenge", 1, [...UNLOCKABLE]);
  for (const round of all.rounds) {
    assert.ok(PAINT_RECIPES[round.colorId], "전부 해금해도 라운드는 성립");
  }
});

test("원색 라운드는 한 번 고르면 바로 섞인다", () => {
  const state = createPaintPlay("easy", 1);
  const round = currentRound(state);
  assert.equal(round.stage, 1);
  const events = squeezeTube(state, round.colorId);
  assert.ok(events.some(event => event.type === "mixed"));
  assert.equal(jarColor(state), round.colorId);
});

// 감사(2026-08-06): 아이 더블탭이 곧바로 오답이 되던 결함. 같은 색을 두 번째로
// 고르면 무른다 — 2재료 레시피는 모두 서로 다른 두 색이라 잃는 조작이 없다.
test("같은 튜브를 두 번 고르면 두 번째는 잠금 — 더블탭이 오답이 되지 않는다", () => {
  const state = createPaintPlay("steady", 1);
  const round = pinRound(state, "orange", "car");
  const [a] = recipeFor(round.colorId);
  assert.equal(recipeFor(round.colorId).length, 2, "2재료 라운드");
  squeezeTube(state, a);
  const second = squeezeTube(state, a);
  assert.deepEqual(second, [{ type: "locked", reason: "same-color", color: a }]);
  assert.equal(state.jar.length, 1, "병에는 한 색만 남는다");
  assert.equal(state.mixed, false, "혼합이 확정되지 않는다");
  assert.equal(jarColor(state), null);
});

test("혼합 라운드 — 2색 제한: 가득 찬 병에는 잠금 이벤트만 나온다", () => {
  const state = createPaintPlay("steady", 1);
  const round = pinRound(state, "green", "frog");
  const [a, b] = recipeFor(round.colorId);
  squeezeTube(state, a);
  squeezeTube(state, b);
  const locked = squeezeTube(state, "red");
  assert.equal(locked[0].type, "locked");
  assert.equal(state.jar.length, 2);
});

// 사용자 결정(2026-08-05): "두 개를 선택하면 자동으로 색이 합쳐지고 완료".
// 젓기·칠하기 버튼은 없다 — 두 번째 튜브가 곧 혼합 신호다.
test("혼합 라운드 — 두 번째 튜브에서 자동으로 섞인다(젓기 단계 없음)", () => {
  const state = createPaintPlay("steady", 1);
  const round = pinRound(state, "purple", "grape");
  const [a, b] = recipeFor(round.colorId);
  const first = squeezeTube(state, a);
  assert.ok(!first.some(event => event.type === "mixed"), "한 개로는 안 섞인다");
  assert.equal(jarColor(state), null);
  const events = squeezeTube(state, b);
  assert.ok(events.some(event => event.type === "mixed"), "두 번째에서 혼합");
  assert.equal(state.mixed, true);
  assert.equal(jarColor(state), round.colorId);
  // 확인 동작 없이 곧바로 칠할 수 있다(앱이 자동으로 부른다)
  assert.ok(paintCanvas(state).some(event => event.type === "success"));
});

test("수식 칩 — 한 개 고른 뒤엔 결과가 비고, 두 개째에 채워진다", () => {
  const state = createPaintPlay("steady", 1);
  const round = pinRound(state, "orange", "car");
  const [a, b] = recipeFor(round.colorId);
  squeezeTube(state, a);
  const before = equationFor(state);
  assert.equal(before.parts[0], PAINT_COLORS[a].ko);
  assert.equal(before.parts[1], null, "두 번째는 아직 비었다");
  assert.equal(before.result, null);
  squeezeTube(state, b);
  const after = equationFor(state);
  assert.ok(after.parts[1] && after.result, "혼합 후 재료 둘과 결과 이름");
});

test("헹구기 — 병이 비고 판정·별 변화가 없다", () => {
  const state = createPaintPlay("steady", 1);
  const round = pinRound(state, "orange", "car");
  squeezeTube(state, recipeFor(round.colorId)[0]);
  const events = rinseJar(state);
  assert.deepEqual(events, [{ type: "rinsed" }]);
  assert.equal(state.jar.length, 0);
  assert.equal(state.stars, 0);
  assert.equal(state.tries, 0, "헹구기는 실패가 아니다");
});

test("불일치 — 벌점 없이(별 불변) 결과 색을 호명하고 병을 비운다", () => {
  const state = createPaintPlay("steady", 1);
  const round = state.rounds[0];
  round.colorId = "orange";
  round.subjectId = "carrot";
  squeezeTube(state, "red");
  squeezeTube(state, "blue"); // 보라 — 주문(주황)과 다르다
  const events = paintCanvas(state);
  const mismatch = events.find(event => event.type === "mismatch");
  assert.ok(mismatch);
  assert.equal(mismatch.color, "purple");
  assert.equal(mismatch.wantedColor, "orange");
  assert.equal(state.stars, 0);
  assert.equal(state.roundIndex, 0, "같은 라운드 재도전");
  assert.equal(state.jar.length, 0, "병 자동 헹굼");
});

test("힌트 에스컬레이션 — 물방울 라운드는 2회 실패에 반짝(2)으로", () => {
  const state = createPaintPlay("steady", 1);
  const round = state.rounds[0];
  round.colorId = "orange";
  assert.equal(round.hintLevel, 1);
  for (const _ of [1, 2]) {
    squeezeTube(state, "red");
    squeezeTube(state, "blue");
    paintCanvas(state);
  }
  assert.equal(round.hintLevel, 2);
});

test("역추론 라운드(스테이지 4) — 힌트 0에서 2회 실패 시 물방울(1) 복귀", () => {
  const state = createPaintPlay("challenge", 1);
  const index = state.rounds.findIndex(round => round.stage === 4);
  assert.ok(index >= 0);
  state.roundIndex = index;
  const round = state.rounds[index];
  round.colorId = "orange";
  assert.equal(round.hintLevel, 0);
  for (const _ of [1, 2]) {
    squeezeTube(state, "red");
    squeezeTube(state, "blue");
    paintCanvas(state);
  }
  assert.equal(round.hintLevel, 1);
});

test("성공 — 별+1·갤러리에 색과 그림 적재·수식 포함·다음 라운드로", () => {
  const state = createPaintPlay("easy", 3);
  const round = currentRound(state);
  const events = solveRound(state);
  const success = events.find(event => event.type === "success");
  assert.ok(success);
  assert.equal(success.color, round.colorId);
  assert.ok(success.equation.parts[0], "성공 이벤트에 수식");
  assert.equal(state.stars, 1);
  // 피날레 전시회 벽이 그림까지 걸 수 있게 색+그림을 함께 기억한다
  assert.deepEqual(state.gallery,
    [{ colorId: round.colorId, subjectId: round.subjectId }]);
  assert.equal(state.roundIndex, 1);
});

test("3색 혼합 라운드 — 세 번째 튜브에서 자동으로 섞이고 수식에 세 재료가 실린다", () => {
  const state = createPaintPlay("challenge", 1);
  const index = state.rounds.findIndex(round => round.stage === 5);
  assert.ok(index >= 0, "challenge에 3색 혼합 라운드");
  state.roundIndex = index;
  const round = state.rounds[index];
  const [a, b, c] = recipeFor(round.colorId);
  assert.ok(c, "3재료 레시피");
  squeezeTube(state, a);
  const two = squeezeTube(state, b);
  assert.ok(!two.some(event => event.type === "mixed"), "두 개로는 안 섞인다");
  assert.equal(jarColor(state), null);
  const events = squeezeTube(state, c);
  const mixed = events.find(event => event.type === "mixed");
  assert.ok(mixed, "세 번째에서 혼합");
  assert.equal(jarColor(state), round.colorId);
  assert.deepEqual([...mixed.jar].sort(), [a, b, c].sort(), "혼합 이벤트에 병 내용");
  const equation = equationFor(state);
  assert.equal(equation.parts[2], PAINT_COLORS[c].ko, "세 번째 수식 칩");
  assert.ok(equation.result, "결과 이름");
  assert.ok(paintCanvas(state).some(event => event.type === "success"));
});

test("3색 회귀 — 서로 다른 세 튜브 전 조합이 이름 있는 색으로 판정된다", () => {
  const tubes = PAINT_TUBES.map(tube => tube.id);
  for (let i = 0; i < tubes.length; i += 1) {
    for (let j = i + 1; j < tubes.length; j += 1) {
      for (let k = j + 1; k < tubes.length; k += 1) {
        const state = createPaintPlay("challenge", 1);
        const index = state.rounds.findIndex(round => round.stage === 5);
        state.roundIndex = index;
        state.rounds[index].colorId = "peach"; // 3재료 라운드로 고정
        squeezeTube(state, tubes[i]);
        squeezeTube(state, tubes[j]);
        squeezeTube(state, tubes[k]);
        const label = `${tubes[i]}+${tubes[j]}+${tubes[k]}`;
        assert.ok(jarColor(state), `${label} 혼합색`);
        const outcome = paintCanvas(state).find(
          event => event.type === "success" || event.type === "mismatch"
        );
        assert.ok(outcome, `${label} 판정 이벤트`);
        assert.ok(outcome.color, `${label} 색 이름 존재`);
      }
    }
  }
});

test("전 라운드 완주 — finale 이벤트와 상태", () => {
  const state = createPaintPlay("easy", 5);
  let finale = null;
  while (!state.finale) {
    const events = solveRound(state);
    finale = events.find(event => event.type === "finale") ?? finale;
  }
  assert.ok(finale);
  assert.equal(state.stars, state.rounds.length);
  assert.equal(state.gallery.length, state.rounds.length);
  const distinct = new Set(state.gallery.map(entry => entry.colorId)).size;
  assert.equal(finale.rainbow, distinct >= 7);
});

// 열 라운드가 모두 다른 색이므로 완주하면 무지개다 — 카운터(🌈 n/10색)가
// 곧 진행도가 된다. 중간에 그만두면 갤러리가 덜 차고 무지개도 안 뜬다.
test("열 색을 다 칠하면 무지개, 덜 칠하면 안 뜬다", () => {
  assert.equal(RAINBOW_COUNT, 10, "카운터 목표 = 한 판 라운드 수");
  for (const difficulty of Object.keys(STAGE_PLANS)) {
    for (const seed of [0, 7, 42]) {
      const state = createPaintPlay(difficulty, seed);
      while (!state.finale) {
        const round = currentRound(state);
        for (const part of recipeFor(round.colorId)) squeezeTube(state, part);
        paintCanvas(state);
      }
      const distinct = new Set(state.gallery.map(entry => entry.colorId)).size;
      assert.equal(distinct, 10, `${difficulty} seed ${seed} 열 색 전부 다름`);
      assert.equal(state.rainbow, true, `${difficulty} seed ${seed} 무지개`);
    }
  }
  // 아홉 칠하고 멈춘 상태에서는 무지개가 아니다
  const partial = createPaintPlay("easy", 1);
  for (let index = 0; index < 9; index += 1) {
    const round = currentRound(partial);
    for (const part of recipeFor(round.colorId)) squeezeTube(partial, part);
    paintCanvas(partial);
  }
  assert.equal(partial.finale, false, "아직 완주 아님");
  assert.equal(partial.rainbow, false, "아홉 색으론 무지개 아님");
});

test("포커스 순환 — 선반 튜브 + 헹구기를 양방향으로 감싸고 해금만큼 늘어난다", () => {
  const state = createPaintPlay("easy", 1);
  assert.equal(paintFocusCount(state), 6, "기본 5튜브 + 헹구기");
  assert.equal(movePaintFocus(state, -1), 5);
  assert.equal(movePaintFocus(state, 1), 0);
  assert.equal(currentSubject(state).color, currentRound(state).colorId);
  const unlocked = createPaintPlay("easy", 1, ["orange", "green"]);
  assert.equal(paintFocusCount(unlocked), 8, "해금 2개면 8칸");
  assert.equal(movePaintFocus(unlocked, -1), 7);
});

// ── 해금(내 물감) — 완성한 혼합색이 튜브가 되어 지름길 조합을 연다 ──────

test("해금 — 혼합색 첫 완성에 unlocked 이벤트가 한 번만 나온다", () => {
  const state = createPaintPlay("steady", 1);
  state.rounds[0].colorId = "orange";
  state.rounds[0].subjectId = "car";
  state.rounds[1].colorId = "orange";
  state.rounds[1].subjectId = "carrot";
  squeezeTube(state, "red");
  squeezeTube(state, "yellow");
  const events = paintCanvas(state);
  const unlocked = events.find(event => event.type === "unlocked");
  assert.ok(unlocked, "첫 완성에 해금");
  assert.equal(unlocked.color, "orange");
  assert.ok(state.myTubes.includes("orange"), "선반에 즉시 추가");
  squeezeTube(state, "red");
  squeezeTube(state, "yellow");
  const again = paintCanvas(state);
  assert.ok(!again.some(event => event.type === "unlocked"), "재해금 없음");
});

test("해금 선반 — 내 물감 튜브가 기본 5 뒤에 붙는다", () => {
  const state = createPaintPlay("easy", 1, ["green", "orange", "gray"]);
  // gray는 해금 대상이 아니라 걸러진다(2재료 혼합색만 튜브가 된다)
  assert.deepEqual(state.myTubes, ["green", "orange"]);
  const tubes = shelfTubes(state);
  assert.equal(tubes.length, PAINT_TUBES.length + 2);
  assert.equal(tubes[0].id, "red", "기본 튜브가 앞");
  assert.ok(tubes.at(-1).unlocked, "내 물감 표식");
});

// 숫자키가 선반 위치에서 나오므로, 한 번 6번이 된 색은 영원히 6번이어야 한다.
// 팔레트 선언 순서로 정렬하면 앞선 색을 나중에 해금할 때 뒤 튜브가 밀려
// 아이가 외운 키가 판 중간에 바뀐다 — 리뷰에서 잡힌 회귀(2026-08-11).
test("선반은 append-only — 새 해금이 기존 튜브의 숫자키를 밀지 않는다", () => {
  const before = createPaintPlay("easy", 1, ["navy"]);
  assert.equal(shelfTubes(before)[5].id, "navy");
  assert.equal(slotKeyDigit(5), "6", "남색이 6번");

  // 같은 판에서 UNLOCKABLE 선언이 앞선 주황을 새로 얻는다
  before.myTubes.push("orange");
  const after = shelfTubes(before);
  assert.equal(after[5].id, "navy", "남색은 6번 자리를 지킨다");
  assert.equal(after[6].id, "orange", "새 물감은 뒤에 붙는다");

  // 다음 세션(localStorage 는 얻은 순서를 보존한다)에서도 같은 자리
  const next = createPaintPlay("easy", 9, ["navy", "orange"]);
  assert.deepEqual(
    shelfTubes(next).map(tube => tube.id),
    [...PAINT_TUBES.map(tube => tube.id), "navy", "orange"]
  );
});

test("tubeForDigit — 숫자키가 가리키는 칸을 앱과 같은 함수로 판정한다", () => {
  const none = createPaintPlay("easy", 1);
  assert.equal(tubeForDigit(none, "1").tube.id, "red");
  assert.equal(tubeForDigit(none, "5").tube.id, "white");
  assert.equal(tubeForDigit(none, "6"), null, "해금 전엔 빈 칸");
  assert.equal(tubeForDigit(none, "0"), null);
  assert.equal(tubeForDigit(none, "x"), null, "숫자가 아니면 없음");

  const some = createPaintPlay("easy", 1, ["green", "orange"]);
  assert.deepEqual(
    ["1", "2", "3", "4", "5", "6", "7", "8"].map(d => tubeForDigit(some, d)?.tube.id ?? null),
    ["red", "yellow", "blue", "black", "white", "green", "orange", null]
  );
  // 헹구기는 숫자키로 잡히지 않는다 — 잡히면 마지막 튜브가 밀린다
  const full = createPaintPlay("easy", 1, [...UNLOCKABLE]);
  assert.equal(tubeForDigit(full, "0").tube.id, "sky");
  assert.equal(tubeForDigit(full, "0").index, 9);
});

// 사용자 요구(2026-08-11): 판마다 다섯 칸에서 시작해, 그 판에서 만든 색만
// 붙는다. 예전엔 localStorage 로 영구 저장해 다음 판이 열 칸에서 시작했다.
test("판 시작 선반은 기본 다섯 칸이고, 그 판에서 만든 색만 붙는다", () => {
  const fresh = createPaintPlay("easy", 3);
  assert.deepEqual(fresh.myTubes, [], "시작은 해금 0");
  assert.deepEqual(
    shelfTubes(fresh).map(tube => tube.id),
    PAINT_TUBES.map(tube => tube.id),
    "선반은 기본 다섯 튜브뿐"
  );
  assert.deepEqual(
    ["1", "2", "3", "4", "5"].map(digit => tubeForDigit(fresh, digit)?.tube.id),
    ["red", "yellow", "blue", "black", "white"]
  );
  for (const digit of ["6", "7", "8", "9", "0"]) {
    assert.equal(tubeForDigit(fresh, digit), null, `${digit}번은 아직 빈 칸`);
  }

  // 실제로 한 판을 완주하면서 선반이 자라는지 — 그리고 열 칸을 안 넘는지
  for (const difficulty of Object.keys(STAGE_PLANS)) {
    for (let seed = 0; seed < 120; seed += 1) {
      const state = createPaintPlay(difficulty, seed);
      assert.equal(state.rounds.length, 10, `${difficulty} 열 라운드`);
      let peak = shelfTubes(state).length;
      while (!state.finale) {
        const round = currentRound(state);
        for (const part of recipeFor(round.colorId)) squeezeTube(state, part);
        paintCanvas(state);
        peak = Math.max(peak, shelfTubes(state).length);
      }
      assert.ok(peak <= 10,
        `${difficulty} seed ${seed} 선반이 ${peak}칸 — 숫자키 열 개를 넘었다`);
      assert.ok(state.myTubes.length >= 1,
        `${difficulty} seed ${seed} 한 판에 최소 하나는 해금돼야 진행감이 있다`);
    }
  }
});

test("숫자키 슬롯 — 기본 5 + 해금이 1..9,0 을 순서대로 받고 11번째는 없다", () => {
  const all = createPaintPlay("easy", 1, [...UNLOCKABLE]);
  const tubes = shelfTubes(all);
  assert.equal(tubes.length, 12, "기본 5 + 해금 7");
  const keyed = tubes
    .map((tube, index) => [slotKeyDigit(index), tube.id])
    .filter(([digit]) => digit !== null);
  assert.deepEqual(keyed, [
    ["1", "red"], ["2", "yellow"], ["3", "blue"], ["4", "black"], ["5", "white"],
    ["6", "orange"], ["7", "green"], ["8", "purple"], ["9", "pink"], ["0", "sky"]
  ]);
  assert.equal(slotKeyDigit(10), null, "밤색은 키 없이 ←/→ 로만");
  assert.equal(slotKeyDigit(11), null, "남색도 마찬가지");
  // 키 없는 튜브도 포커스로는 항상 닿는다
  assert.equal(paintFocusCount(all), 13);
});

test("해금 지름길 — 주황+하양 두 번으로 살구색(3재료)이 완성된다", () => {
  const state = createPaintPlay("challenge", 1, ["orange"]);
  const index = state.rounds.findIndex(round => round.stage === 5);
  state.roundIndex = index;
  state.rounds[index].colorId = "peach";
  state.rounds[index].subjectId = "peach";
  const first = squeezeTube(state, "orange");
  assert.ok(!first.some(event => event.type === "mixed"),
    "주황은 2유닛 — 아직 3 미만이라 안 섞인다");
  const events = squeezeTube(state, "white");
  assert.ok(events.some(event => event.type === "mixed"), "2번째 손짓에 혼합");
  assert.equal(jarColor(state), "peach", "재료 전개 등가 판정");
  const equation = equationFor(state);
  assert.deepEqual(equation.parts, ["주황", "하양"], "지름길 수식");
  assert.ok(paintCanvas(state).some(event => event.type === "success"));
});

// 4원색이 이름을 얻은 뒤(2026-08-11)에도 먹색 경로는 남는다 — 삼원색+검정.
test("해금 뒤섞임 — 삼원색+검정은 먹색으로 판정된다(크래시 없음)", () => {
  const state = createPaintPlay("challenge", 1, ["orange", "navy"]);
  const index = state.rounds.findIndex(round => round.stage === 5);
  state.roundIndex = index;
  state.rounds[index].colorId = "peach";
  squeezeTube(state, "orange"); // {빨강, 노랑}
  squeezeTube(state, "navy");   // {파랑, 검정} → 합집합 빨노파검
  assert.equal(jarColor(state), "mud");
  const outcome = paintCanvas(state).find(
    event => event.type === "mismatch"
  );
  assert.ok(outcome, "먹색은 벌점 없는 재도전");
  assert.equal(outcome.color, "mud");
});

// ── 4색 혼합(어려움) — 사용자 요구 2026-08-11 ─────────────────────────────

test("4색 라운드 — 기본 튜브 네 번으로 완성된다(해금 0인 첫 판)", () => {
  const state = createPaintPlay("challenge", 1);
  const index = state.rounds.findIndex(round => round.stage === 6);
  assert.ok(index >= 0, "challenge에 4색 라운드");
  state.roundIndex = index;
  const round = currentRound(state);
  const recipe = recipeFor(round.colorId);
  assert.equal(recipe.length, 4, "4재료 레시피");
  recipe.slice(0, 3).forEach(part => {
    const events = squeezeTube(state, part);
    assert.ok(!events.some(event => event.type === "mixed"), "3개로는 안 섞인다");
  });
  const events = squeezeTube(state, recipe[3]);
  assert.ok(events.some(event => event.type === "mixed"), "네 번째에서 혼합");
  assert.equal(jarColor(state), round.colorId);
  const equation = equationFor(state);
  assert.equal(equation.parts.length, 4, "수식 칩 네 칸 — 재료가 잘리지 않는다");
  assert.deepEqual(
    equation.parts, recipe.map(id => PAINT_COLORS[id].ko), "네 재료 이름 전부"
  );
  assert.ok(paintCanvas(state).some(event => event.type === "success"));
});

test("4색 지름길 — 해금 두 개로 두 손짓에 4원색이 완성된다", () => {
  const state = createPaintPlay("challenge", 1, ["orange", "sky"]);
  const index = state.rounds.findIndex(round => round.stage === 6);
  state.roundIndex = index;
  const round = pinRound(state, "sand", "sandcastle");
  assert.equal(recipeFor(round.colorId).length, 4, "정원은 네 유닛");
  const first = squeezeTube(state, "orange"); // 2유닛
  assert.ok(!first.some(event => event.type === "mixed"), "2유닛으론 부족");
  const events = squeezeTube(state, "sky");   // +2유닛 = 4
  assert.ok(events.some(event => event.type === "mixed"), "두 손짓에 혼합");
  assert.equal(jarColor(state), "sand");
  assert.deepEqual(equationFor(state).parts, ["주황", "하늘색"], "지름길 수식");
  assert.ok(paintCanvas(state).some(event => event.type === "success"));
});

test("4색 회귀 — 서로 다른 네 튜브 전 조합이 이름 있는 색으로 판정된다", () => {
  const tubes = PAINT_TUBES.map(tube => tube.id);
  for (let skip = 0; skip < tubes.length; skip += 1) {
    const picks = tubes.filter((_, index) => index !== skip);
    const state = createPaintPlay("challenge", 1);
    const index = state.rounds.findIndex(round => round.stage === 6);
    state.roundIndex = index;
    pinRound(state, "sand", "sandcastle");
    for (const id of picks) squeezeTube(state, id);
    const label = picks.join("+");
    assert.ok(jarColor(state), `${label} 혼합색`);
    const outcome = paintCanvas(state).find(
      event => event.type === "success" || event.type === "mismatch"
    );
    assert.ok(outcome, `${label} 판정 이벤트`);
    assert.ok(outcome.color, `${label} 색 이름 존재`);
  }
});

// 반증 패스(2026-08-05)에서 잡힌 크래시 회귀 가드: 아이가 아무 튜브나
// 눌러 만드는 전 조합이 자동 혼합→칠하기까지 항상 실명 있는 색으로 끝나야
// 한다 — null 색이 새어 나오면 앱단이 죽는다. 같은 튜브 2연타는 2026-08-06
// 부터 잠금이라 혼합까지 가지 않는다(mixResult(a,a)=a 가드는 데이터 테스트가 지킴).
test("전 조합 회귀 — 서로 다른 두 튜브는 반드시 이름 있는 색으로 판정된다", () => {
  for (const first of PAINT_TUBES) {
    for (const second of PAINT_TUBES) {
      const state = createPaintPlay("steady", 1);
      const round = state.rounds[0];
      round.colorId = "orange"; // 2재료 라운드로 고정
      squeezeTube(state, first.id);
      const events = squeezeTube(state, second.id);
      if (first.id === second.id) {
        assert.equal(events[0].type, "locked", `${first.id} 2연타 잠금`);
        assert.equal(events[0].reason, "same-color");
        assert.equal(jarColor(state), null);
        continue;
      }
      assert.ok(jarColor(state), `${first.id}+${second.id} 혼합색`);
      const outcome = paintCanvas(state).find(
        event => event.type === "success" || event.type === "mismatch"
      );
      assert.ok(outcome, `${first.id}+${second.id} 판정 이벤트`);
      assert.ok(outcome.color, `${first.id}+${second.id} 색 이름 존재`);
    }
  }
});
