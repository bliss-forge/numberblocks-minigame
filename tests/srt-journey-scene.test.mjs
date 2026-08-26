// SRT 좌석 찾기 장면 계약. 심층 검토 P1-11이 지적한 것은 "1호차 2C"가 글로만
// 나온다는 점이었다 — 글 못 읽는 아이는 80석을 찍어 볼 수밖에 없었다.
// 승차권 카드와 목표 호차 표식이 그 정보를 그림으로도 준다.
import test from "node:test";
import assert from "node:assert/strict";
import { createSrtJourney } from "../src/srt-journey.mjs";
import { renderSrtJourney } from "../src/srt-journey-scene.mjs";

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) ?? "";
  }
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
    this.innerHTML = "";
  }

  append(...children) {
    this.children.push(...children);
  }

  replaceChildren(...children) {
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelector() {
    return null;
  }

  querySelectorAll() {
    return [];
  }

  addEventListener() {}
}

const document = {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
};

function descendants(root) {
  return [root, ...root.children.flatMap(descendants)];
}

function byClass(root, className) {
  return descendants(root).filter(node =>
    node.className.split(/\s+/).includes(className)
  );
}

function seatPhaseScene(seed = 7) {
  const journey = createSrtJourney(seed);
  const state = { ...journey, phase: "seat", position: { x: 0, y: 2 } };
  return { state, scene: renderSrtJourney(document, state) };
}

test("좌석 찾기 화면에는 호차 친구와 자리 번호를 그린 승차권이 있다", () => {
  const { state, scene } = seatPhaseScene();
  const [ticket] = byClass(scene, "srt-ticket");
  assert.ok(ticket, "승차권 카드가 있다");
  assert.equal(ticket.dataset.car, String(state.target.car));
  assert.equal(
    ticket.dataset.seat,
    `${state.target.row}${state.target.letter}`
  );

  const [friend] = byClass(ticket, "srt-ticket-friend");
  assert.ok(friend, "호차는 아는 얼굴로 보여 준다");
  assert.match(friend.src, /assets\/characters\//);
  assert.match(friend.alt, new RegExp(`숫자 ${state.target.car} `));

  const [seat] = byClass(ticket, "srt-ticket-seat");
  assert.equal(
    seat.textContent,
    `${state.target.row}${state.target.letter}`,
    "좌석에 적힌 것과 똑같은 글자여야 눈으로 맞출 수 있다"
  );
  assert.match(
    ticket.attributes.get("aria-label"),
    new RegExp(`${state.target.car}호차`)
  );
});

test("목표 호차 표지판만 승차권과 같은 친구를 세운다", () => {
  const { state, scene } = seatPhaseScene();
  const banners = byClass(scene, "srt-car-banner");
  assert.equal(banners.length, 5);

  const marked = banners.filter(node => node.dataset.target === "true");
  assert.equal(marked.length, 1, "목표 호차 하나만 표시한다");
  assert.equal(byClass(marked[0], "srt-car-friend").length, 1);

  const others = banners.filter(node => node.dataset.target !== "true");
  assert.ok(
    others.every(node => byClass(node, "srt-car-friend").length === 0),
    "다른 호차에는 친구를 세우지 않는다 — 그러면 표식이 무의미하다"
  );
  assert.ok(
    others.every(node => /호차$/.test(node.textContent)),
    "다른 호차도 이름은 유지한다"
  );
});

test("승차권은 좌석을 찾는 화면에만 나온다", () => {
  const journey = createSrtJourney(7);
  for (const phase of ["station", "ride", "parking"]) {
    const scene = renderSrtJourney(document, { ...journey, phase });
    assert.equal(
      byClass(scene, "srt-ticket").length,
      0,
      `${phase} 화면에는 승차권이 없다`
    );
  }
});
