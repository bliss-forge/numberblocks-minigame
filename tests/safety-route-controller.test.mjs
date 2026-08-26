import test from "node:test";
import assert from "node:assert/strict";

import {
  acceptSafetyRepeat,
  directionForKey,
  safetyCueForEvent
} from "../src/safety-route-controller.mjs";

test("방향키와 WASD를 네 방향 이동으로 바꾼다", () => {
  assert.equal(directionForKey("ArrowUp"), "up");
  assert.equal(directionForKey("w"), "up");
  assert.equal(directionForKey("A"), "left");
  assert.equal(directionForKey("ArrowDown"), "down");
  assert.equal(directionForKey("d"), "right");
  assert.equal(directionForKey("5"), null);
});

test("길게 누르기는 140ms 간격으로만 이동을 허용한다", () => {
  assert.equal(
    acceptSafetyRepeat({ repeat: false, nowMs: 100, previousMs: 95 }),
    true
  );
  assert.equal(
    acceptSafetyRepeat({ repeat: true, nowMs: 220, previousMs: 100 }),
    false
  );
  assert.equal(
    acceptSafetyRepeat({ repeat: true, nowMs: 240, previousMs: 100 }),
    true
  );
});

test("친구를 만나면 다음 목적지와 음성 키를 안내한다", () => {
  assert.deepEqual(
    safetyCueForEvent({ type: "friend", number: 2 }, 3),
    {
      message: "2 친구를 만났어요! 이제 3 친구를 만나러 가요.",
      voiceKey: "safety-next-3",
      tone: "success"
    }
  );
});

test("안전 장애물은 실패 대신 이유와 행동을 설명한다", () => {
  assert.deepEqual(
    safetyCueForEvent({ type: "blocked", reason: "red-light" }, 2),
    {
      message: "빨간불이에요. 초록불이 될 때까지 기다려요!",
      voiceKey: "safety-red-light",
      tone: "safety"
    }
  );
  assert.match(
    safetyCueForEvent({ type: "blocked", reason: "manhole" }, 4).message,
    /맨홀/
  );
  assert.match(
    safetyCueForEvent({ type: "blocked", reason: "car" }, 4).message,
    /자동차/
  );
  assert.deepEqual(
    safetyCueForEvent({ type: "blocked", reason: "green-ending" }, 4),
    {
      message: "초록불이 곧 끝나요. 다음 초록불을 기다려요!",
      voiceKey: "safety-red-light",
      tone: "safety"
    }
  );
  assert.deepEqual(
    safetyCueForEvent({ type: "blocked", reason: "look-first" }, 4),
    {
      message: "차가 나올 수 있어요. 잠깐 멈춰 좌우를 살펴요!",
      voiceKey: "safety-car",
      tone: "safety"
    }
  );
});

test("왼쪽 친구를 먼저 만나도록 횡단을 안내한다", () => {
  assert.deepEqual(
    safetyCueForEvent({ type: "blocked", reason: "left-friends-first" }, 5),
    {
      message: "먼저 이 동네의 5 친구를 만나고 횡단보도로 가요!",
      voiceKey: "safety-next-5",
      tone: "guide"
    }
  );
});

test("움직이는 자전거와 킥보드는 기다리거나 옆줄로 피하라고 안내한다", () => {
  const cue = safetyCueForEvent(
    {
      type: "blocked",
      reason: "moving-rider",
      moverType: "bicycle"
    },
    6
  );

  assert.match(cue.message, /기다리|옆줄/);
  assert.equal(cue.voiceKey, "safety-bicycle");
});

test("순서와 완주 안내를 제공한다", () => {
  assert.deepEqual(
    safetyCueForEvent({ type: "wrong-friend", number: 7 }, 4),
    {
      message: "7 친구도 반가워요! 먼저 4 친구를 만나러 가요.",
      voiceKey: "safety-wrong-order",
      tone: "guide"
    }
  );
  assert.equal(
    safetyCueForEvent({ type: "need-friends", nextFriend: 6 }, 6).voiceKey,
    "safety-next-6"
  );
  assert.deepEqual(
    safetyCueForEvent({ type: "complete" }, 11),
    {
      message: "모든 친구를 만났어요! 안전하게 도착했어요!",
      voiceKey: "safety-finish",
      tone: "success"
    }
  );
});

test("crossing-started 이벤트는 좌우 살피기 안내를 만든다", () => {
  const cue = safetyCueForEvent({ type: "crossing-started" }, 6);
  assert.equal(cue.voiceKey, "safety-look-both");
  assert.equal(cue.message, "멈춰요, 왼쪽 오른쪽을 봐요!");
  assert.equal(cue.tone, "safety");
});

test("car-close 사유는 차가 지나간 뒤 건너라는 안내를 만든다", () => {
  const cue = safetyCueForEvent({ type: "blocked", reason: "car-close" }, 6);
  assert.equal(cue.message, "차가 오고 있어요! 차가 지나간 다음에 건너요!");
  assert.equal(cue.voiceKey, "safety-car");
});

// 막는 안내만 있으면 아이는 언제 건널지 모른다. 긍정 안내도 음성을 갖는다(P1-12).
test("차가 멈춘 순간의 안내는 글과 음성을 함께 준다", () => {
  const cue = safetyCueForEvent({ type: "cross-now" }, 6);
  assert.equal(cue.voiceKey, "safety-cross-now");
  assert.equal(cue.tone, "success");
  assert.match(cue.message, /건너/);
});
