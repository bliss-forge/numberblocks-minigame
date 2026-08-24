const KEY_DIRECTIONS = Object.freeze({
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right"
});

const BLOCKED_CUES = Object.freeze({
  wall: {
    message: "길이 아니에요. 도로를 따라가 볼까요?",
    voiceKey: null
  },
  "red-light": {
    message: "빨간불이에요. 초록불이 될 때까지 기다려요!",
    voiceKey: "safety-red-light"
  },
  "green-ending": {
    message: "초록불이 곧 끝나요. 다음 초록불을 기다려요!",
    voiceKey: "safety-red-light"
  },
  "look-first": {
    message: "차가 나올 수 있어요. 잠깐 멈춰 좌우를 살펴요!",
    voiceKey: "safety-car"
  },
  "car-close": {
    message: "차가 오고 있어요! 차가 지나간 다음에 건너요!",
    voiceKey: "safety-car"
  },
  "take-the-bus": {
    // 글을 못 읽는 아이에게는 이 자막이 유일한 안내였다 — 음성을 붙인다.
    message: "여기는 버스를 타고 건너요! 정류장으로 가요",
    voiceKey: "safety-take-the-bus"
  },
  manhole: {
    message: "열린 맨홀이에요. 가까이 가지 말고 돌아가요!",
    voiceKey: "safety-manhole"
  },
  construction: {
    message: "공사 중이에요. 안전 울타리 밖으로 돌아가요!",
    voiceKey: "safety-construction"
  },
  scooter: {
    message: "길에 놓인 킥보드예요. 부딪히지 않게 돌아가요!",
    voiceKey: "safety-scooter"
  },
  bicycle: {
    message: "자전거가 지나가요. 멈추고 지나간 뒤 움직여요!",
    voiceKey: "safety-bicycle"
  },
  car: {
    message: "자동차가 지나가요. 안전한 곳에서 기다려요!",
    voiceKey: "safety-car"
  }
});

export function directionForKey(key) {
  if (typeof key !== "string") return null;
  return KEY_DIRECTIONS[key] ?? KEY_DIRECTIONS[key.toLowerCase()] ?? null;
}

export function acceptSafetyRepeat({
  repeat,
  nowMs,
  previousMs,
  intervalMs = 140
}) {
  return !repeat || nowMs - previousMs >= intervalMs;
}

export function safetyCueForEvent(event, nextFriend, goal = "school") {
  if (!event) return null;

  if (event.type === "blocked" && event.reason === "wrong-bus") {
    return {
      message: `이 버스는 ${event.number}번이에요. 우리는 ${event.target}번을 타요!`,
      voiceKey: "safety-wrong-bus",
      tone: "guide"
    };
  }

  if (event.type === "bus-stop") {
    return {
      message:
        `${event.target}번 버스가 서면 버스 쪽으로 방향키를 눌러 타요!`,
      // 조작법을 글로만 주면 글 못 읽는 아이에게는 전달 수단이 0이다(P1-10).
      voiceKey: "safety-bus-stop",
      tone: "guide"
    };
  }

  if (event.type === "bus-boarded") {
    return {
      message: `${event.number}번 버스를 탔어요!`,
      voiceKey: "safety-bus-boarded",
      tone: "success"
    };
  }

  if (event.type === "crossing-started") {
    return {
      message: "멈춰요, 왼쪽 오른쪽을 봐요!",
      voiceKey: "safety-look-both",
      tone: "safety"
    };
  }

  if (event.type === "friend") {
    return nextFriend <= 10
      ? {
          message:
            `${event.number} 친구를 만났어요! 이제 ${nextFriend} 친구를 만나러 가요.`,
          voiceKey: `safety-next-${nextFriend}`,
          tone: "success"
        }
      : goal === "station"
        ? {
            // 도전 지도의 목표는 학교가 아니라 기차역이다. 글은 그대로 두고
            // 음성이 실제 목적지를 말하게 한다(대장 지시 2026-08-20).
            message: "친구들을 모두 만났어요. 이제 기차역으로 가요!",
            voiceKey: "safety-next-station",
            tone: "success"
          }
        : {
            message: "친구들을 모두 만났어요. 이제 학교로 가요!",
            voiceKey: "safety-next-10",
            tone: "success"
          };
  }

  if (event.type === "blocked") {
    if (event.reason === "left-friends-first") {
      return {
        message: `먼저 이 동네의 ${nextFriend} 친구를 만나고 횡단보도로 가요!`,
        voiceKey: `safety-next-${nextFriend}`,
        tone: "guide"
      };
    }

    if (event.reason === "moving-rider") {
      const isBicycle = event.moverType === "bicycle";
      return {
        message: isBicycle
          ? "움직이는 자전거예요. 잠깐 기다리거나 옆줄로 피해 가요!"
          : "움직이는 킥보드예요. 잠깐 기다리거나 옆줄로 피해 가요!",
        voiceKey: isBicycle ? "safety-bicycle" : "safety-scooter",
        tone: "safety"
      };
    }

    const cue = BLOCKED_CUES[event.reason] ?? BLOCKED_CUES.wall;
    return { ...cue, tone: "safety" };
  }

  if (event.type === "wrong-friend") {
    return {
      message:
        `${event.number} 친구도 반가워요! 먼저 ${nextFriend} 친구를 만나러 가요.`,
      voiceKey: "safety-wrong-order",
      tone: "guide"
    };
  }

  if (event.type === "need-friends") {
    return {
      message: `학교에 가기 전에 ${event.nextFriend} 친구를 먼저 만나요.`,
      voiceKey: `safety-next-${event.nextFriend}`,
      tone: "guide"
    };
  }

  if (event.type === "complete") {
    return {
      message: "모든 친구를 만났어요! 안전하게 도착했어요!",
      voiceKey: "safety-finish",
      tone: "success"
    };
  }

  return null;
}
