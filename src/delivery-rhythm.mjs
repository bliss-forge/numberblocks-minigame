// 씬 ② 리듬 하역의 순수 판정 — 목업 v3(mockups/v3/mockup-v3-2-rhythm.html)의 수치를 따른다.
//
// 목업에서 확정되는 값: 80BPM · 4비트 마커 · 2박째 정박 PERFECT.
// 판정 창(ms)은 목업에 없어 이 파일에서 정했다. 근거는 무벌칙 원칙이다 —
// 네 살이 눌러도 대부분 성공해야 하므로 한 박(750ms)의 3/4 가 성공 구간이다.
// 실패해도 상자만 안 나갈 뿐 벌점은 없고, 다음 박자에 다시 누르면 된다.
//
// 시계를 모른다. 앱이 "무대가 열린 뒤 흐른 밀리초"를 넣어 주면 판정만 돌려준다.

export const RHYTHM_BPM = 80;
export const BEAT_MS = 60000 / RHYTHM_BPM; // 750
export const BEATS_PER_BAR = 4;

// 한 건마다 상자 셋을 내린다 — 하나, 둘, 셋. 세는 놀이가 한 번 더 나온다.
export const RHYTHM_TARGET = 3;

export const PERFECT_WINDOW_MS = 150;
export const GOOD_WINDOW_MS = 280;

export function createRhythm(target = RHYTHM_TARGET) {
  return { loaded: 0, target, perfect: 0, judge: null, beat: 0 };
}

// 지금이 몇 박째인가 (0~3). 마커 링과 비트 칩이 이 값으로 켜진다.
export function beatIndexAt(elapsedMs) {
  const beats = Math.floor(Math.max(0, elapsedMs) / BEAT_MS);
  return ((beats % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
}

// 가장 가까운 정박까지의 거리(ms). 박자 앞이든 뒤든 같은 거리로 센다.
export function beatOffsetMs(elapsedMs) {
  const at = Math.max(0, elapsedMs);
  const into = at % BEAT_MS;
  return Math.min(into, BEAT_MS - into);
}

export function judgeAt(elapsedMs) {
  const offset = beatOffsetMs(elapsedMs);
  if (offset <= PERFECT_WINDOW_MS) return "perfect";
  if (offset <= GOOD_WINDOW_MS) return "good";
  return "miss";
}

/**
 * 상자 하나를 박자에 맞춰 넘긴다.
 * @returns {Array} 이벤트 — 씬과 앱이 이것만 보고 움직인다.
 */
export function passBox(rhythm, elapsedMs) {
  if (!rhythm || rhythm.loaded >= rhythm.target) return [];

  const judge = judgeAt(elapsedMs);
  rhythm.judge = judge;
  rhythm.beat = beatIndexAt(elapsedMs);

  // 빗나가도 상자는 그대로 있고 벌점도 없다 — 다음 박자에 다시 누르면 된다.
  if (judge === "miss") {
    return [{ type: "rhythm-miss", offset: Math.round(beatOffsetMs(elapsedMs)) }];
  }

  rhythm.loaded += 1;
  if (judge === "perfect") rhythm.perfect += 1;

  const events = [
    { type: "rhythm-pass", judge, loaded: rhythm.loaded, target: rhythm.target },
  ];
  if (rhythm.loaded >= rhythm.target) {
    events.push({ type: "rhythm-done", perfect: rhythm.perfect, target: rhythm.target });
  }
  return events;
}

// 앱의 박자 시계가 한 칸 넘어갈 때 부른다 — 그림의 비트 칩만 옮긴다.
export function tickBeat(rhythm, elapsedMs) {
  if (!rhythm) return [];
  const beat = beatIndexAt(elapsedMs);
  if (beat === rhythm.beat) return [];
  rhythm.beat = beat;
  return [{ type: "rhythm-beat", beat }];
}

export function rhythmDone(rhythm) {
  return Boolean(rhythm) && rhythm.loaded >= rhythm.target;
}
