import test from "node:test";
import assert from "node:assert/strict";
import { createKtxJourney, distanceToMarker } from "../src/ktx-journey.mjs";
import { renderKtxScene, updateKtxScene } from "../src/ktx-scene.mjs";
import { updateRealisticMotionScene } from "../src/ktx-realistic-motion-scene.mjs";

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
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = tagName.toUpperCase();
    this.className = "";
    this.dataset = {};
    this.style = new FakeStyle();
    this.children = [];
    this.attributes = new Map();
    this.textContent = "";
    this.listeners = new Map();
    this.srcWrites = 0;
  }

  set src(value) {
    this._src = String(value);
    this.srcWrites += 1;
  }

  get src() {
    return new URL(this._src, "https://game.test/").href;
  }

  set innerHTML(markup) {
    this._innerHTML = String(markup);
    this.children = [...markup.matchAll(/class="([^"]+)"/g)].map(match => {
      const child = new FakeElement(this.ownerDocument, "span");
      child.className = match[1];
      return child;
    });
  }

  get innerHTML() {
    return this._innerHTML ?? "";
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

  remove() {}

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type) {
    this.listeners.get(type)?.();
  }

  get classList() {
    return {
      add: name => {
        if (!this.className.split(/\s+/).includes(name)) {
          this.className = `${this.className} ${name}`.trim();
        }
      },
      remove: name => {
        this.className = this.className.split(/\s+/)
          .filter(value => value && value !== name)
          .join(" ");
      }
    };
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    const target = selector.trim().split(/\s+/).at(-1);
    const descendants = this.children.flatMap(child => [child, ...child.#descendants()]);
    if (selector === ".ktx-real-scene img") {
      const scenes = descendants.filter(node =>
        node.className.split(/\s+/).includes("ktx-real-scene")
      );
      return scenes.flatMap(scene => scene.#descendants())
        .filter(node => node.tagName === "IMG");
    }
    if (target.startsWith(".")) {
      const className = target.slice(1);
      return descendants.filter(node => node.className.split(/\s+/).includes(className));
    }
    return descendants.filter(node => node.tagName.toLowerCase() === target.toLowerCase());
  }

  #descendants() {
    return this.children.flatMap(child => [child, ...child.#descendants()]);
  }
}

function fakeDocument() {
  const document = {
    createdElements: [],
    createElement(tagName) {
      const element = new FakeElement(document, tagName);
      document.createdElements.push(element);
      return element;
    },
    createElementNS(_namespace, tagName) {
      return new FakeElement(document, tagName);
    }
  };
  return document;
}

function nodeList(items) {
  return {
    ...items,
    length: items.length,
    forEach: callback => items.forEach(callback),
    [Symbol.iterator]: () => items[Symbol.iterator]()
  };
}

test("운전실과 바깥 뷰는 실사 이미지와 기존 SVG 폴백을 함께 마운트한다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "cab");

  assert.ok(root.querySelector(".ktx-real-scene"));
  assert.ok(root.querySelector(".ktx-real-cab-image"));
  assert.ok(root.querySelector(".ktx-real-exterior-image"));
  assert.ok(root.querySelector(".ktx-cab-backdrop"), "기존 폴백 유지");
  assert.ok(root.querySelector(".ktx-side-train"), "기존 폴백 유지");
});

test("SRT 부스터 HUD는 준비·작동·충전을 두 뷰에서 같은 상태로 보인다", () => {
  const initial = {
    ...createKtxJourney(3, "srt"),
    phase: "driving"
  };
  const root = renderKtxScene(fakeDocument(), initial, "cab");
  const badge = root.querySelector(".ktx-boost-badge");

  assert.ok(badge, "운전실과 바깥 뷰가 공유하는 HUD 배지");
  assert.equal(root.dataset.boost, "ready");
  assert.equal(badge.textContent, "부스터 준비");

  updateKtxScene(root, {
    ...initial,
    v: 500,
    boostRemainingMs: 4200,
    boostCooldownMs: 0
  }, "side");
  assert.equal(root.dataset.view, "side");
  assert.equal(root.dataset.boost, "active");
  assert.equal(badge.textContent, "부스터 5");
  assert.equal(root.querySelector(".ktx-speed-number").textContent, "500");
  assert.equal(root.style.getPropertyValue("--needle-deg"), "120.0deg",
    "300 눈금 바늘은 끝에 고정되고 디지털만 500을 표시");

  updateKtxScene(root, {
    ...initial,
    v: 300,
    boostRemainingMs: 0,
    boostCooldownMs: 5200
  }, "cab");
  assert.equal(root.dataset.boost, "cooldown");
  assert.equal(badge.textContent, "충전 6");

  const ktxRoot = renderKtxScene(fakeDocument(), {
    ...createKtxJourney(3, "ktx"),
    phase: "driving"
  }, "cab");
  assert.equal(ktxRoot.dataset.boost, "unavailable");
  assert.equal(ktxRoot.querySelector(".ktx-boost-badge").textContent, "부스터 없음");
});

// 라벨이 실제 동작과 어긋나면 글 못 읽는 아이는 끝까지 오해한 채로 논다.
// SRT 주행 중 ⎵는 부스터인데 버튼에 "빵빵"이 적혀 있던 적이 있어 못을 박는다.
test("주행 중 ⎵ 라벨은 SRT가 부스터, KTX가 빵빵으로 갈린다", () => {
  const label = trainId => {
    const root = renderKtxScene(fakeDocument(), {
      ...createKtxJourney(3, trainId),
      phase: "driving",
      armed: false
    }, "cab");
    return root.querySelector(".ktx-next-word").textContent;
  };

  assert.equal(label("srt"), "부스터", "SRT ⎵는 경적이 아니라 부스터다");
  assert.equal(label("ktx"), "빵빵", "KTX는 경적을 그대로 쓴다");
});

test("HUD 배지 문구에 영어를 쓰지 않는다", () => {
  // 이 게임을 하는 나이대는 영어를 못 읽는다. BOOST 로 되돌아가면 여기서 걸린다.
  const root = renderKtxScene(fakeDocument(), {
    ...createKtxJourney(3, "srt"),
    phase: "driving"
  }, "cab");
  const badge = root.querySelector(".ktx-boost-badge");

  for (const boost of [
    { boostRemainingMs: 0, boostCooldownMs: 0 },
    { boostRemainingMs: 4200, boostCooldownMs: 0 },
    { boostRemainingMs: 0, boostCooldownMs: 5200 }
  ]) {
    updateKtxScene(root, {
      ...createKtxJourney(3, "srt"), phase: "driving", ...boost
    }, "cab");
    assert.doesNotMatch(badge.textContent, /[A-Za-z]/, badge.textContent);
  }
});

test("SRT는 분리 실사 모션 리그와 정적 폴백을 함께 마운트한다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "side");

  assert.ok(root.querySelector(".ktx-motion-scene"));
  assert.equal(root.querySelectorAll(".ktx-motion-plate").length, 2);
  assert.ok(root.querySelector(".ktx-motion-mid"));
  assert.ok(root.querySelector(".ktx-motion-track"));
  assert.ok(root.querySelector(".ktx-motion-near"));
  assert.ok(root.querySelector(".ktx-motion-wheel-shadow"));
  assert.ok(root.querySelector(".ktx-motion-train-rig"));
  assert.ok(root.querySelector(".ktx-motion-train"));
  assert.ok(root.querySelector(".ktx-motion-door"));
  assert.ok(root.querySelector(".ktx-motion-door-leaf-left"));
  assert.ok(root.querySelector(".ktx-motion-door-leaf-right"));
  assert.ok(root.querySelector(".ktx-motion-cab-frame"));
  assert.ok(root.querySelector(".ktx-motion-station"));
  assert.ok(root.querySelector(".ktx-real-exterior-image"), "정적 실사 폴백 유지");
});

test("SRT 모션 리그는 운전실 전면창 투영과 역·터널 장면 객체를 마운트한다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "cab");

  assert.ok(root.querySelector(".ktx-motion-cab-window"));
  assert.equal(root.querySelectorAll(".ktx-motion-cab-rail").length, 2);
  assert.ok(root.querySelector(".ktx-motion-cab-ground"));
  assert.ok(root.querySelector(".ktx-motion-cab-ballast"));
  assert.ok(root.querySelector(".ktx-motion-cab-sleepers"));
  assert.ok(root.querySelector(".ktx-motion-cab-poles"));
  assert.ok(root.querySelector(".ktx-motion-cab-catenary"));
  assert.ok(root.querySelector(".ktx-motion-tunnel"));
  assert.ok(root.querySelector(".ktx-motion-tunnel-lights"));
  assert.ok(root.querySelector(".ktx-motion-train-rig")
    .querySelector(".ktx-motion-door"),
  "차체 문은 열차와 같은 변환 좌표계 안에 포함됨");
  const stationViewport = root.querySelector(".ktx-motion-station-viewport");
  assert.ok(stationViewport);
  assert.ok(stationViewport.querySelector(".ktx-motion-station"),
    "역 완성 장면은 전체 화면 레이어 안에 포함됨");
  assert.ok(root.querySelector(".ktx-motion-station-sign"));
});

test("SRT 외부 깊이와 운전실 원근 위상은 주행 거리마다 계속 갱신된다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");
  const snapshot = x => {
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", doors: "closed", x, v: 240 },
      { land: "field" });
    return {
      far: Number.parseFloat(scene.style.getPropertyValue("--motion-far-x")),
      mid: scene.style.getPropertyValue("--motion-mid-phase-x"),
      near: scene.style.getPropertyValue("--motion-near-phase-x"),
      track: scene.style.getPropertyValue("--motion-track-phase-x"),
      sleeper: scene.style.getPropertyValue("--cab-sleeper-phase"),
      pole: scene.style.getPropertyValue("--cab-pole-phase")
    };
  };

  const before = snapshot(200);
  const after = snapshot(700);
  assert.ok(after.far < before.far, "원경 사진도 플레이트 끝까지 계속 왼쪽으로 이동");
  for (const name of ["mid", "near", "track", "sleeper", "pole"]) {
    assert.notEqual(after[name], before[name], `${name} 위상이 주행 거리와 함께 변함`);
  }
});

test("SRT 실제 차체 문은 정차 승하차 상태에서만 열린다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopped", doors: "open", x: 0, v: 0 },
    { land: "city" });
  assert.equal(scene.dataset.doors, "open");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", doors: "open", x: 20, v: 40 },
    { land: "city" });
  assert.equal(scene.dataset.doors, "closed", "주행 중 잘못 열린 모델 상태도 화면에서는 닫힘");

  updateRealisticMotionScene(root,
    { ...initial, phase: "finale", doors: "open", x: 0, v: 0 },
    { sky: "day", land: "city" });
  assert.equal(scene.dataset.doors, "open", "종착역에서도 실제 차체 문이 열림");
});

test("SRT 운전실 전면창 사진은 시간대·지형 우선순위를 그대로 따른다", () => {
  // 옆 창에 사진 판이 보이기 시작하면서 "옆은 들판, 앞은 도시"가 드러났다.
  // 전면창이 밴드를 따라가는지 값으로 고정한다 — dataset.sky만 보면 사진이
  // 안 바뀌어도 통과한다(실제로 그렇게 지나갔다).
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "cab");
  const scene = root.querySelector(".ktx-motion-scene");
  const cases = [
    { band: { sky: "night", land: "mountain" }, file: "cab-night.webp" },
    { band: { sky: "day", land: "field" }, file: "cab-field.webp" },
    { band: { sky: "day", land: "sea" }, file: "cab-sea.webp" },
    { band: { sky: "dawn", land: "field" }, file: "cab-dawn.webp" },
    { band: { sky: "sunset", land: "river" }, file: "cab-sunset.webp" },
    { band: { sky: "night", land: "tunnel" }, file: "cab-tunnel.webp" }
  ];

  for (const { band, file } of cases) {
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: 2600, v: 240 }, band);
    assert.equal(scene.dataset.sky, band.sky);
    assert.equal(
      scene.style.getPropertyValue("--cab-base-image"),
      `url("assets/train-realistic/${file}")`,
      `${band.sky}·${band.land} 전면창`);
  }
});

test("KTX는 분리 실사 모션 리그와 모션 자산 요청을 만들지 않는다", () => {
  const document = fakeDocument();
  const root = renderKtxScene(document, createKtxJourney(3, "ktx"), "side");

  assert.equal(root.querySelector(".ktx-motion-scene"), null);
  assert.equal(document.createdElements.some(element =>
    element.tagName === "IMG" &&
    element.src.includes("/assets/train-realistic/motion/")), false);
  assert.equal(root.dataset.motionRealistic, "fallback");
});

function loadMotionSideAssets(root) {
  root.querySelectorAll(".ktx-motion-plate").forEach(plate => plate.dispatch("load"));
  root.querySelector(".ktx-motion-station").dispatch("load");
  root.querySelector(".ktx-motion-train").dispatch("load");
}

test("현재 바깥 뷰 필수 모션 자산이 모두 로드된 뒤에만 ready가 된다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "side");
  const plates = root.querySelectorAll(".ktx-motion-plate");

  assert.equal(root.dataset.motionRealistic, "pending");
  plates[0].dispatch("load");
  plates[1].dispatch("load");
  root.querySelector(".ktx-motion-station").dispatch("load");
  assert.equal(root.dataset.motionRealistic, "pending", "열차가 남으면 대기");
  root.querySelector(".ktx-motion-train").dispatch("load");
  assert.equal(root.dataset.motionRealistic, "ready");
  assert.equal(plates[0].dataset.active, "true");
  assert.equal(plates[1].dataset.active, "false", "두 번째 슬롯은 선로드 전용");
  assert.equal(plates[1].hidden, true, "교차 전환 전에는 비활성 장면을 표시하지 않음");
});

test("필수 모션 플레이트 오류는 정적 실사 상태를 보존한 채 폴백한다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "side");
  root.querySelector(".ktx-real-cab-image").dispatch("load");
  root.querySelector(".ktx-real-exterior-image").dispatch("load");
  assert.equal(root.dataset.realistic, "ready");

  root.querySelectorAll(".ktx-motion-plate")[0].dispatch("error");

  assert.equal(root.dataset.motionRealistic, "fallback");
  assert.equal(root.dataset.realistic, "ready", "정상 정적 실사 폴백 상태는 변경하지 않음");
  assert.ok(root.querySelector(".ktx-side-train"), "최종 SVG 폴백도 유지");
});

test("환경 변경은 활성·비활성 플레이트를 모두 선로드한 뒤 교체한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  const plates = root.querySelectorAll(".ktx-motion-plate");
  loadMotionSideAssets(root);
  assert.equal(root.dataset.motionRealistic, "ready");

  const field = { ...initial, phase: "driving", x: 2000, v: 80 };
  updateKtxScene(root, field, "side");

  assert.equal(root.dataset.motionRealistic, "pending");
  assert.ok(plates[0].src.endsWith("/city-a.webp"), "선로드 중 현재 장면 유지");
  assert.ok(plates[1].src.endsWith("/city-b.webp"), "비활성 현재 장면도 유지");
  const fieldPreloads = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  assert.equal(fieldPreloads.length, 2, "다음 활성 장면과 비활성 장면을 함께 선로드");

  fieldPreloads[0].dispatch("load");
  assert.equal(root.dataset.motionRealistic, "pending", "한 장만 준비되면 교체하지 않음");
  assert.ok(plates[0].src.endsWith("/city-a.webp"));
  fieldPreloads[1].dispatch("load");

  assert.equal(root.dataset.motionRealistic, "ready");
  assert.ok(plates[0].src.endsWith("/field-a.webp"));
  assert.ok(plates[1].src.endsWith("/field-b.webp"));
});

test("새 환경 대기 중 무관한 고정 프레임 로드는 pending을 해제하지 않는다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  assert.equal(root.dataset.motionRealistic, "ready");

  const field = { ...initial, phase: "driving", x: 2000, v: 80 };
  updateKtxScene(root, field, "side");
  assert.equal(root.dataset.motionRealistic, "pending");

  root.querySelector(".ktx-motion-cab-frame").dispatch("load");

  assert.equal(root.dataset.motionRealistic, "pending",
    "요청한 field 플레이트가 끝나기 전 city 준비 상태로 돌아가지 않음");
});

test("로드된 환경으로 복귀하거나 재진입하면 중복 선로드하지 않는다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const field = { ...initial, phase: "driving", x: 2000, v: 80 };

  updateKtxScene(root, field, "side");
  const fieldPreloads = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  fieldPreloads.forEach(image => image.dispatch("load"));
  assert.equal(root.dataset.motionRealistic, "ready");

  updateKtxScene(root, initial, "side");
  assert.equal(root.dataset.motionRealistic, "ready");
  assert.ok(root.querySelectorAll(".ktx-motion-plate")[0].src.endsWith("/city-a.webp"));
  updateKtxScene(root, field, "side");

  const afterReturn = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/(city|field)-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  assert.equal(afterReturn.length, 2, "두 환경 모두 캐시되어 새 선로드 없음");
  assert.equal(root.dataset.motionRealistic, "ready");
});

test("실패한 환경은 정상 환경 복귀 후 다시 선로드할 수 있다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const field = { ...initial, phase: "driving", x: 2000, v: 80 };

  updateKtxScene(root, field, "side");
  let attempts = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  attempts[0].dispatch("error");
  assert.equal(root.dataset.motionRealistic, "fallback");

  updateKtxScene(root, initial, "side");
  assert.equal(root.dataset.motionRealistic, "ready");
  updateKtxScene(root, field, "side");
  attempts = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  assert.equal(attempts.length, 4, "실패한 두 장을 새 이미지 요청으로 재시도");
  attempts.slice(-2).forEach(image => image.dispatch("load"));
  assert.equal(root.dataset.motionRealistic, "ready");
});

test("실패 환경은 같은 밴드에서 고정되고 정상 환경을 거친 뒤 한 번만 재시도한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const field = { ...initial, phase: "driving", x: 2000, v: 80 };
  const fieldPreloads = () => document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));

  updateKtxScene(root, field, "side");
  assert.equal(fieldPreloads().length, 2);
  fieldPreloads()[0].dispatch("error");
  assert.equal(root.dataset.motionRealistic, "fallback");

  updateKtxScene(root, field, "side");
  assert.equal(fieldPreloads().length, 2, "같은 실패 밴드는 즉시 다시 요청하지 않음");
  assert.equal(root.dataset.motionRealistic, "fallback");

  updateKtxScene(root, initial, "side");
  assert.equal(root.dataset.motionRealistic, "ready");
  updateKtxScene(root, field, "side");

  assert.equal(fieldPreloads().length, 4, "정상 city를 거친 뒤 새 두 장만 재시도");
  assert.equal(root.dataset.motionRealistic, "pending");
});

test("늦게 ready가 된 정상 환경도 실패 환경 재시도를 다시 허용한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  const field = { ...initial, phase: "driving", x: 2000, v: 80 };
  const fieldPreloads = () => document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));

  assert.equal(root.dataset.motionRealistic, "pending", "city가 아직 로드되지 않음");
  updateKtxScene(root, field, "side");
  assert.equal(fieldPreloads().length, 2);
  fieldPreloads()[0].dispatch("error");
  assert.equal(root.dataset.motionRealistic, "fallback");

  updateKtxScene(root, initial, "side");
  assert.equal(root.dataset.motionRealistic, "pending");
  loadMotionSideAssets(root);
  assert.equal(root.dataset.motionRealistic, "ready", "돌아온 city가 뒤늦게 준비됨");

  updateKtxScene(root, field, "side");

  assert.equal(fieldPreloads().length, 4, "field에 정확히 한 쌍의 재시도 요청 추가");
  assert.equal(root.dataset.motionRealistic, "pending");
});

test("환경 선로드 중 원래 장면으로 돌아오면 늦은 요청이 화면을 덮지 않는다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const field = { ...initial, phase: "driving", x: 2000, v: 80 };

  updateKtxScene(root, field, "side");
  const stalePreloads = document.createdElements.filter(element =>
    element.tagName === "IMG" && /\/field-[ab]\.webp$/.test(element.src) &&
    !element.className.includes("ktx-motion-plate"));
  assert.equal(stalePreloads.length, 2);

  updateKtxScene(root, initial, "side");
  assert.equal(root.dataset.motionRealistic, "ready");
  stalePreloads.forEach(image => image.dispatch("load"));

  const plates = root.querySelectorAll(".ktx-motion-plate");
  assert.ok(plates[0].src.endsWith("/city-a.webp"));
  assert.ok(plates[1].src.endsWith("/city-b.webp"));
  assert.equal(root.querySelector(".ktx-motion-scene").dataset.land, "city");
});

test("뷰가 바뀌면 그 뷰의 고정 프레임 준비 상태를 사용한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  loadMotionSideAssets(root);
  assert.equal(root.dataset.motionRealistic, "ready");

  updateKtxScene(root, initial, "cab");
  assert.equal(root.dataset.motionRealistic, "pending", "운전실 프레임이 아직 로드 전");
  root.querySelector(".ktx-motion-cab-frame").dispatch("load");
  assert.equal(root.dataset.motionRealistic, "ready");
});

test("모션 리그 갱신은 실제 속도·단계·환경·마커 거리를 모델에 전달한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const markerX = distanceToMarker(initial) + initial.x;
  const stopping = {
    ...initial,
    phase: "stopping",
    x: markerX - 100,
    v: 240
  };

  updateKtxScene(root, stopping, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  assert.equal(scene.dataset.speedBand, "very-fast");
  assert.equal(scene.dataset.stationStage, "detail");
  assert.equal(scene.dataset.moving, "true");
  assert.equal(scene.dataset.land, root.dataset.land);
});

test("실사 외부 모션은 위치·속도를 정확한 CSS 변수로 동기화한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const moving = { ...initial, phase: "driving", x: 2000, v: 240 };

  updateRealisticMotionScene(root, moving, { land: "city" });
  const scene = root.querySelector(".ktx-motion-scene");

  assert.equal(scene.style.getPropertyValue("--motion-scene-x"), "-53.33px");
  assert.equal(scene.style.getPropertyValue("--motion-far-x"), "-53.33px");
  assert.equal(scene.style.getPropertyValue("--motion-near-x"), "-1700px");
  assert.equal(scene.style.getPropertyValue("--motion-track-x"), "-2000px");
  assert.equal(scene.style.getPropertyValue("--motion-speed"), "0.8");
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--motion-blur")) > 0);
  assert.equal(scene.dataset.motionMoving, "true");
});

test("정차한 실사 외부 모션은 모든 보간 효과를 즉시 멈춘다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const stopped = { ...initial, phase: "stopped", x: 2000, v: 0 };

  updateRealisticMotionScene(root, stopped, { land: "city" });
  const scene = root.querySelector(".ktx-motion-scene");

  assert.equal(scene.dataset.motionMoving, "false");
  assert.equal(scene.style.getPropertyValue("--motion-speed"), "0");
  assert.equal(scene.style.getPropertyValue("--motion-blur"), "0px");
  assert.equal(scene.style.getPropertyValue("--motion-brake-pitch"), "0");
});

test("역 접근·정차·출발은 진행률과 근경 억제를 하나의 수명주기로 동기화한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");
  const station = root.querySelector(".ktx-motion-station");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 100, v: 120, markerDistance: 600 },
    { land: "city" });
  assert.equal(scene.style.getPropertyValue("--station-progress"), "0");
  assert.equal(scene.style.getPropertyValue("--station-opacity"), "0",
    "600m 경계에서는 전체 프레임 교차가 투명도 0에서 시작");
  const approachStartX = Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"));
  const approachStartY = Number.parseFloat(scene.style.getPropertyValue("--station-object-y"));
  assert.ok(approachStartX > 0);
  assert.equal(approachStartY, 50);
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--station-cover-scale")), 1);
  assert.equal(scene.dataset.nearSuppressed, "false");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopping", x: 400, v: 80, markerDistance: 320 },
    { land: "city" });
  assert.equal(scene.style.getPropertyValue("--station-progress"), "0.47");
  assert.equal(scene.style.getPropertyValue("--station-opacity"), "0.47",
    "320m에서는 전체 역 장면이 일반 풍경과 절반가량 교차");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopping", x: 500, v: 40, markerDistance: 100 },
    { land: "city" });
  assert.equal(scene.style.getPropertyValue("--station-progress"), "0.83");
  assert.equal(scene.style.getPropertyValue("--station-opacity"), "0.83");
  const approachDetailX = Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"));
  assert.ok(approachDetailX < approachStartX);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--station-object-y")) > approachStartY,
    "접근할수록 승강장 선형이 열차 바퀴 높이로 올라옴");
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--station-cover-scale")) > 1,
    "접근할수록 역 장면이 소실점에서 확대됨");
  assert.equal(scene.dataset.nearSuppressed, "true");
  assert.equal(scene.dataset.stationVisible, "true");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopped", x: 600, v: 0, markerDistance: 0 },
    { land: "city" });
  const stoppedProgress = scene.style.getPropertyValue("--station-progress");
  assert.equal(stoppedProgress, "1");
  assert.equal(scene.style.getPropertyValue("--station-opacity"), "1");
  const stoppedX = Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"));
  assert.equal(stoppedX, 0);
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--station-object-y")), 80);
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--station-cover-scale")), 1.06);
  assert.equal(scene.dataset.motionMoving, "false");
  assert.equal(station.dataset.lifecycle, "stopped");

  // 출발 잔상 창은 300m — 600m는 고속에서 유령 역 이중 노출(협회 후반 검수 4)
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 150, v: 80, markerDistance: 5000 },
    { land: "field" });
  assert.equal(scene.style.getPropertyValue("--station-progress"), "0.5");
  const departureMiddleX = Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"));
  assert.ok(departureMiddleX < stoppedX, "출발 시 역은 열차 뒤쪽인 왼쪽으로 밀려야 함");
  assert.equal(station.dataset.lifecycle, "departing");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 299, v: 80, markerDistance: 4701 },
    { land: "field" });
  const departureEndX = Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"));
  assert.ok(departureEndX < departureMiddleX,
    "접근→정차→출발의 역 이동은 오른쪽으로 되감기지 않음");
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--station-opacity")) < 0.01);

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 300, v: 80, markerDistance: 4700 },
    { land: "field" });
  assert.equal(scene.dataset.stationVisible, "false");
  assert.equal(station.dataset.lifecycle, "hidden");
});

test("1280×720 역 사진은 사진 경계 없이 전체 모션 월드를 항상 덮는다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 100, v: 120, markerDistance: 600 },
    { land: "city" });

  const scale = Number.parseFloat(scene.style.getPropertyValue("--station-cover-scale"));
  const sourceWidth = (1280 + 240) * scale;
  const sourceHeight = 720 * scale;
  assert.ok(scale >= 1, "커버 이미지는 어떤 접근 단계에서도 축소 금지");
  assert.ok(sourceWidth >= 1280 && sourceHeight >= 720,
    "안전 여백을 포함한 이미지가 1280×720 뷰포트를 덮음");
  assert.ok(Math.abs(Number.parseFloat(scene.style.getPropertyValue("--station-offset-x"))) <= 120,
    "역 사진 이동은 좌우 120px 안전 크롭 여백을 넘지 않음");
  assert.equal(scene.style.getPropertyValue("--station-clip-side"), "");
  assert.equal(scene.style.getPropertyValue("--station-clip-top"), "");
});

test("역 표지는 주행 중 목적지와 정차한 현재 역 이름을 표시한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const sign = root.querySelector(".ktx-motion-station-sign");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopping", x: 4000, v: 40, markerDistance: 100 },
    { land: "field" });
  assert.equal(sign.textContent, "동탄");

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopped", segIndex: 1, station: "동탄", x: 0, v: 0,
      markerDistance: 0 }, { land: "field" });
  assert.equal(sign.textContent, "동탄", "정차 직후 다음 구간 목적지로 먼저 바뀌지 않음");
});

test("운전실 선로 위상은 큰 실제 위치에서도 반복 범위 안에 있고 정차 시 멈춘다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "cab");
  const scene = root.querySelector(".ktx-motion-scene");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 2530, v: 80, markerDistance: 900 },
    { land: "field" });
  const slowTrack = Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase"));
  const slowSleeperGap = Number.parseFloat(scene.style.getPropertyValue("--cab-sleeper-gap"));
  const slowCatenaryGap = Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-gap"));
  const slowTunnelGap = Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-gap"));
  assert.ok(slowTrack <= 0 && slowTrack > -slowSleeperGap);

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 2640, v: 240, markerDistance: 700 },
    { land: "field" });
  const fastSleeperGap = Number.parseFloat(scene.style.getPropertyValue("--cab-sleeper-gap"));
  const fastCatenaryGap = Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-gap"));
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")) <= 0);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")) > -fastSleeperGap);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--cab-sleeper-gap")) < slowSleeperGap);
  assert.ok(fastCatenaryGap < slowCatenaryGap);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-gap")) < slowTunnelGap);
  assert.equal(scene.dataset.cabTrackLoopReset, "true",
    "속도로 반복 밀도가 바뀌는 프레임은 역방향 보간을 금지");
  assert.equal(scene.dataset.cabCatenaryLoopReset, "true");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 5000, v: 240, markerDistance: 700 },
    { land: "field" });
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")) <= 0);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")) > -fastSleeperGap,
    "유한 요소가 화면 밖으로 누적 이동하지 않음");

  const speed = 120;
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 0, v: speed, markerDistance: 700 },
    { land: "field" });
  const sleeperGap = Number.parseFloat(scene.style.getPropertyValue("--cab-sleeper-gap"));
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: sleeperGap - 1, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")), -(sleeperGap - 1));
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: sleeperGap, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")), 0);
  assert.equal(scene.dataset.cabTrackLoopReset, "true");
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: sleeperGap + 1, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-track-phase")), -1,
    "반복 경계 다음 프레임도 순방향으로 한 픽셀 진행");

  const catenaryGap = Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-gap"));
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: catenaryGap - 1, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-phase")), -(catenaryGap - 1));
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: catenaryGap, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-phase")), 0);
  assert.equal(scene.dataset.cabCatenaryLoopReset, "true");
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: catenaryGap + 1, v: speed, markerDistance: 700 },
    { land: "field" });
  assert.equal(Number.parseFloat(scene.style.getPropertyValue("--cab-catenary-phase")), -1);

  const stoppedTrack = scene.style.getPropertyValue("--cab-track-phase");
  const stoppedCatenary = scene.style.getPropertyValue("--cab-catenary-phase");
  updateRealisticMotionScene(root,
    { ...initial, phase: "stopped", x: catenaryGap + 1, v: 0, markerDistance: 0 },
    { land: "field" });
  assert.equal(scene.style.getPropertyValue("--cab-track-phase"), stoppedTrack);
  assert.equal(scene.style.getPropertyValue("--cab-catenary-phase"), stoppedCatenary);
});

test("터널 벽과 조명은 각 CSS 반복 간격과 같은 위상 주기로 이음새 없이 순환한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "cab");
  const scene = root.querySelector(".ktx-motion-scene");
  const speed = 120;

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 0, v: speed, markerDistance: 700 },
    { land: "tunnel" });
  const lightGap = Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-gap"));
  const wallGap = Number.parseFloat(scene.style.getPropertyValue("--tunnel-wall-gap"));

  for (const pattern of [
    { gap: lightGap, phase: "--tunnel-light-phase", reset: "tunnelLightLoopReset" },
    { gap: wallGap, phase: "--tunnel-wall-phase", reset: "tunnelWallLoopReset" }
  ]) {
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: pattern.gap - 1, v: speed, markerDistance: 700 },
      { land: "tunnel" });
    assert.equal(Number.parseFloat(scene.style.getPropertyValue(pattern.phase)), -(pattern.gap - 1));
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: pattern.gap, v: speed, markerDistance: 700 },
      { land: "tunnel" });
    assert.equal(Number.parseFloat(scene.style.getPropertyValue(pattern.phase)), 0);
    assert.equal(scene.dataset[pattern.reset], "true");
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: pattern.gap + 1, v: speed, markerDistance: 700 },
      { land: "tunnel" });
    assert.equal(Number.parseFloat(scene.style.getPropertyValue(pattern.phase)), -1);
  }

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 5000, v: 240, markerDistance: 700 },
    { land: "tunnel" });
  const fastLightGap = Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-gap"));
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-phase")) <= 0);
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--tunnel-light-phase")) > -fastLightGap);
  assert.equal(scene.dataset.tunnelLightLoopReset, "true",
    "속도 변화로 조명 밀도가 바뀔 때 역방향 보간하지 않음");
});

for (const routeCase of [
  { route: "busan", entryX: 2640, beforeLand: "mountain" },
  { route: "mokpo", entryX: 2530, beforeLand: "field" }
]) {
  test(`${routeCase.route} 터널 포털은 야외 600m 전부터 다가오고 진입 뒤 내부로 전환된다`, () => {
    const initial = { ...createKtxJourney(3, "srt"), route: routeCase.route,
      selectedRoute: routeCase.route, segIndex: 2 };
    const root = renderKtxScene(fakeDocument(), initial, "cab");
    const scene = root.querySelector(".ktx-motion-scene");

    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: routeCase.entryX - 600, v: 180 },
      { land: routeCase.beforeLand });
    assert.equal(scene.style.getPropertyValue("--tunnel-progress"), "0");
    assert.equal(scene.dataset.tunnelPortalVisible, "true");
    assert.equal(scene.dataset.tunnel, "false", "야외에서는 내부 벽을 아직 표시하지 않음");
    assert.ok(Number.parseFloat(scene.style.getPropertyValue("--tunnel-scale")) >= .3,
      "600m에서도 소실점의 작은 입구가 식별 가능함");

    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: routeCase.entryX - 300, v: 180 },
      { land: routeCase.beforeLand });
    assert.equal(scene.style.getPropertyValue("--tunnel-progress"), "0.5");
    assert.equal(scene.dataset.tunnelPortalVisible, "true");
    assert.ok(Number.parseFloat(scene.style.getPropertyValue("--tunnel-scale")) >= .9,
      "300m에서는 운전실 표지 뒤로도 입구 윤곽이 식별 가능함");

    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: routeCase.entryX, v: 180 },
      { land: "tunnel" });
    assert.equal(scene.style.getPropertyValue("--tunnel-progress"), "1");
    assert.equal(scene.dataset.tunnelPortalVisible, "true");
    assert.equal(scene.dataset.tunnel, "true", "진입 시점부터 내부 벽과 조명을 표시");

    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x: routeCase.entryX + 121, v: 180 },
      { land: "tunnel" });
    assert.equal(scene.dataset.tunnelPortalVisible, "false");
    assert.equal(scene.dataset.tunnel, "true", "포털 뒤에도 벽과 조명은 유지");
  });
}

test("고속 진동은 160km/h 위에서만 생기고 1.5px를 넘지 않는다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 2000, v: 160 }, { land: "city" });
  assert.equal(scene.style.getPropertyValue("--motion-vibration-y"), "0px");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 2000, v: 300 }, { land: "city" });
  const vibration = Math.abs(Number.parseFloat(scene.style.getPropertyValue("--motion-vibration-y")));
  assert.ok(vibration > 0);
  assert.ok(vibration <= 1.5);

  updateRealisticMotionScene(root,
    { ...initial, phase: "stopping", x: 2000, v: 240 }, { land: "city" });
  assert.ok(Number.parseFloat(scene.style.getPropertyValue("--motion-brake-pitch")) > 0);
});

test("사진 팬은 큰 주행 위치에서도 안전 크롭 범위 안에 머문다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");

  for (const x of [0, 600, 20_000, 200_000]) {
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x, v: 240 }, { land: "city" });
    const pan = Number.parseFloat(
      root.querySelector(".ktx-motion-scene").style
        .getPropertyValue("--motion-scene-x")
    );
    assert.ok(pan >= -160 && pan <= 160, `${x}m의 팬 ${pan}px가 안전 범위 안`);
  }
});

test("사진 팬은 같은 활성 플레이트에서 되감기 없이 왼쪽으로만 가고 교차할 새 슬롯만 원점에서 시작한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  loadMotionSideAssets(root);
  const scene = root.querySelector(".ktx-motion-scene");
  const plates = root.querySelectorAll(".ktx-motion-plate");
  const pans = [];

  for (const x of [0, 300, 600, 900, 1199]) {
    updateRealisticMotionScene(root,
      { ...initial, phase: "driving", x, v: 240 }, { land: "city" });
    pans.push(Number.parseFloat(scene.style.getPropertyValue("--motion-scene-x")));
  }

  assert.equal(pans[2], 0, "플레이트 중간에서는 오버스캔 중심을 통과");
  pans.slice(1).forEach((pan, index) => {
    assert.ok(pan <= pans[index], `${pans[index]}px 다음 ${pan}px는 오른쪽으로 되감기면 안 됨`);
  });
  assert.ok(Number.parseFloat(plates[0].style.getPropertyValue("--motion-plate-x")) < -159);

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1200, v: 240 }, { land: "city" });

  assert.ok(Number.parseFloat(plates[0].style.getPropertyValue("--motion-plate-x")) < -159,
    "나가는 완성 장면은 왼쪽 끝 위치 고정");
  assert.equal(plates[1].style.getPropertyValue("--motion-plate-x"), "160px",
    "들어오는 완성 장면은 오른쪽 안전 여백에서 시작");
});

test("주행 위치가 플레이트 구간을 넘으면 준비된 다음 완성 장면으로 교차한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  loadMotionSideAssets(root);
  const plates = root.querySelectorAll(".ktx-motion-plate");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1300, v: 240 }, { land: "city" });

  assert.equal(plates[0].dataset.active, "false");
  assert.equal(plates[1].dataset.active, "true");
  assert.equal(plates[0].hidden, false, "이전 완성 장면은 교차 페이드 동안만 함께 마운트");
  assert.equal(plates[1].hidden, false);
  assert.ok(Number.parseFloat(
    root.querySelector(".ktx-motion-scene").style
      .getPropertyValue("--motion-crossfade-ms")
  ) >= 450);
});

test("완성 장면 교차는 정차와 다른 속도 재출발에도 시작 시간축을 유지하고 다음 교차만 새 속도를 쓴다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  loadMotionSideAssets(root);
  const scene = root.querySelector(".ktx-motion-scene");
  const plates = root.querySelectorAll(".ktx-motion-plate");
  const moving = { ...initial, phase: "driving", x: 1300, v: 240 };

  updateRealisticMotionScene(root, moving, { land: "city" });
  assert.equal(plates[0].dataset.crossfade, "out");
  assert.equal(plates[1].dataset.crossfade, "in");
  assert.equal(scene.style.getPropertyValue("--motion-crossfade-play-state"), "running");
  const duration = scene.style.getPropertyValue("--motion-crossfade-ms");

  updateRealisticMotionScene(root,
    { ...moving, phase: "stopped", v: 0 }, { land: "city" });
  assert.equal(plates[0].dataset.crossfade, "out", "나가는 장면의 중간 진행 상태 유지");
  assert.equal(plates[1].dataset.crossfade, "in", "들어오는 장면의 중간 진행 상태 유지");
  assert.equal(scene.style.getPropertyValue("--motion-crossfade-play-state"), "paused");
  assert.equal(scene.style.getPropertyValue("--motion-crossfade-ms"), duration,
    "정차 중 애니메이션 시간축도 바꾸지 않아 불투명도 진행률 유지");

  const resumedSlow = { ...moving, v: 40 };
  updateRealisticMotionScene(root, resumedSlow, { land: "city" });
  assert.equal(plates[0].dataset.crossfade, "out");
  assert.equal(plates[1].dataset.crossfade, "in");
  assert.equal(scene.style.getPropertyValue("--motion-crossfade-play-state"), "running");
  assert.equal(scene.style.getPropertyValue("--motion-crossfade-ms"), duration,
    "진행 중 교차는 재출발 속도가 달라도 시작할 때의 540ms 유지");

  plates[0].dispatch("animationend");
  plates[1].dispatch("animationend");
  updateRealisticMotionScene(root,
    { ...resumedSlow, x: 1000 }, { land: "city" });

  assert.equal(scene.style.getPropertyValue("--motion-crossfade-ms"), "840ms",
    "끝난 뒤 시작한 새 교차부터 현재 저속 시간을 사용");
  assert.equal(plates[0].dataset.crossfade, "in");
  assert.equal(plates[1].dataset.crossfade, "out");
});

test("다음 플레이트는 비활성 슬롯 교체 전에 별도 이미지로 선로드된다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1300, v: 240 }, { land: "city" });
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1500, v: 240 }, { land: "city" });

  const preload = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element.src.endsWith("/assets/train-realistic/motion/city-c.webp") &&
    !element.className.includes("ktx-motion-plate"));
  assert.ok(preload, "다음 city-c 완성 장면을 화면 밖에서 먼저 읽음");
  assert.ok(root.querySelectorAll(".ktx-motion-plate")[0].src.endsWith("/city-a.webp"),
    "로드 전 비활성 슬롯의 현재 장면은 보존");

  preload.dispatch("load");
  assert.ok(root.querySelectorAll(".ktx-motion-plate")[0].src.endsWith("/city-c.webp"));
});

test("다음 플레이트가 즉시 로드돼도 현재 교차 중인 이전 슬롯을 덮지 않는다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const plates = root.querySelectorAll(".ktx-motion-plate");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1300, v: 240 }, { land: "city" });
  const preload = document.createdElements.find(element =>
    element.tagName === "IMG" && element.src.endsWith("/city-c.webp") &&
    !element.className.includes("ktx-motion-plate"));
  preload.dispatch("load");

  assert.ok(plates[0].src.endsWith("/city-a.webp"), "A→B 교차가 끝날 때까지 A 유지");
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1490, v: 240 }, { land: "city" });
  assert.ok(plates[0].src.endsWith("/city-c.webp"), "충분히 진행한 뒤 비활성 슬롯 교체");
});

test("선택형 다음 플레이트 오류는 같은 환경의 상태 틱마다 재요청하지 않는다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const moving = { ...initial, phase: "driving", x: 1300, v: 240 };
  const optionalPreloads = () => document.createdElements.filter(element =>
    element.tagName === "IMG" && element.src.endsWith("/city-c.webp") &&
    !element.className.includes("ktx-motion-plate"));

  updateRealisticMotionScene(root, moving, { land: "city" });
  optionalPreloads()[0].dispatch("error");
  updateRealisticMotionScene(root, moving, { land: "city" });
  updateRealisticMotionScene(root, moving, { land: "city" });

  assert.equal(optionalPreloads().length, 1);
  assert.equal(root.dataset.motionRealistic, "ready", "현재 A/B 장면은 계속 정상 표시");
});

test("주행 위치를 건너뛰어도 해당 구간의 플레이트를 결정적으로 준비한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "side");
  loadMotionSideAssets(root);
  const jumped = { ...initial, phase: "driving", x: 2500, v: 240 };

  updateRealisticMotionScene(root, jumped, { land: "city" });
  const preload = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element.src.endsWith("/assets/train-realistic/motion/city-c.webp") &&
    !element.className.includes("ktx-motion-plate"));
  assert.ok(preload, "현재 위치가 가리키는 city-c를 직접 준비");

  preload.dispatch("load");
  updateRealisticMotionScene(root, jumped, { land: "city" });
  const active = root.querySelectorAll(".ktx-motion-plate")
    .find(plate => plate.dataset.active === "true");
  assert.ok(active.src.endsWith("/city-c.webp"));
});

test("빠를수록 완성 장면 교차 시간은 짧아지되 450ms 아래로 내려가지 않는다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1000, v: 80 }, { land: "city" });
  const slow = Number.parseFloat(scene.style.getPropertyValue("--motion-crossfade-ms"));
  updateRealisticMotionScene(root,
    { ...initial, phase: "driving", x: 1000, v: 300 }, { land: "city" });
  const fast = Number.parseFloat(scene.style.getPropertyValue("--motion-crossfade-ms"));

  assert.ok(fast < slow);
  assert.ok(fast >= 450);
  assert.ok(slow <= 900);
});

test("선로·근경·속도선은 각 CSS 무늬 주기 경계 전후에 같은 위상으로 이어진다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "side");
  const scene = root.querySelector(".ktx-motion-scene");
  const cases = [
    { layer: "track", period: 144, xs: [143, 144, 145] },
    { layer: "near", period: 720, xs: [719 / .85, 720 / .85, 721 / .85] },
    { layer: "streak", period: 310, xs: [309, 310, 311] }
  ];
  const wrappedDelta = (from, to, period) => {
    const half = period / 2;
    return ((to - from + half + period) % period) - half;
  };

  for (const { layer, period, xs } of cases) {
    const phases = xs.map(x => {
      updateRealisticMotionScene(root,
        { ...initial, phase: "driving", x, v: 240 }, { land: "city" });
      return Number.parseFloat(
        scene.style.getPropertyValue(`--motion-${layer}-phase-x`)
      );
    });
    assert.ok(phases.every(Number.isFinite), `${layer} 전용 위상 변수가 있어야 함`);
    assert.ok(Math.abs(wrappedDelta(phases[0], phases[1], period) + 1) < .01,
      `${layer} boundary-1 → boundary 위상 연속`);
    assert.ok(Math.abs(wrappedDelta(phases[1], phases[2], period) + 1) < .01,
      `${layer} boundary → boundary+1 위상 연속`);
  }
});

test("KTX 선택은 SRT 사진을 마운트하지 않고 전용 SVG 장면을 유지한다", () => {
  const document = fakeDocument();
  const root = renderKtxScene(document, createKtxJourney(3, "ktx"), "side");
  const train = root.querySelector(".ktx-side-train");

  assert.equal(root.querySelector(".ktx-real-cab-image"), null);
  assert.equal(root.querySelector(".ktx-real-exterior-image"), null);
  assert.equal(document.createdElements.some(element =>
    element.tagName === "IMG" && element.src.includes("/assets/train-realistic/")), false,
  "SRT 실사 자산을 백그라운드에서도 요청하지 않음");
  assert.equal(root.dataset.realistic, "fallback");
  assert.equal(root.dataset.loading, "false");
  assert.ok(train, "KTX 전용 SVG 열차 유지");
  assert.match(train.innerHTML, /ktx-tm-side-body-ktx/, "KTX 리버리 정의 사용");
  assert.match(train.innerHTML, />KTX<\/text>/, "KTX 로고 사용");
  assert.doesNotMatch(train.innerHTML, />SRT<\/text>/, "SRT 로고를 섞지 않음");
});

test("현재 실사 이미지가 모두 로드된 뒤에만 준비 상태가 된다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "cab");
  const cab = root.querySelector(".ktx-real-cab-image");
  const exterior = root.querySelector(".ktx-real-exterior-image");

  assert.equal(root.dataset.realistic, "pending");
  assert.equal(root.dataset.loading, "true");
  assert.ok(root.querySelector(".ktx-loading-veil"));
  cab.dispatch("load");
  assert.equal(root.dataset.realistic, "pending", "한 장만 로드되면 대기 유지");
  exterior.dispatch("load");
  assert.equal(root.dataset.realistic, "ready");
  assert.equal(root.dataset.loading, "false");
});

test("다음 환경 이미지는 미리 읽고 로드된 뒤에만 현재 장면을 교체한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "cab");
  const cab = root.querySelector(".ktx-real-cab-image");
  const exterior = root.querySelector(".ktx-real-exterior-image");
  cab.dispatch("load");
  exterior.dispatch("load");

  updateKtxScene(root, initial, "side");
  assert.equal(root.querySelector(".ktx-real-cab-image"), cab);
  assert.equal(root.querySelector(".ktx-real-exterior-image"), exterior);
  assert.equal(cab.srcWrites, 1, "같은 운전실 경로는 다시 쓰지 않음");
  assert.equal(exterior.srcWrites, 1, "같은 외부 경로는 다시 쓰지 않음");

  const field = { ...initial, phase: "driving", x: 2000 };
  updateKtxScene(root, field, "side");
  assert.equal(root.querySelector(".ktx-real-cab-image"), cab);
  assert.equal(root.querySelector(".ktx-real-exterior-image"), exterior);
  // 지형 변형(PR #8): field 밴드에서는 운전실도 cab-field로 준비를 시작한다
  assert.equal(cab.src, "https://game.test/assets/train-realistic/cab-day.webp");
  assert.equal(cab.srcWrites, 1, "다음 운전실이 준비되는 동안 현재 사진 유지");
  assert.equal(exterior.src,
    "https://game.test/assets/train-realistic/srt-exterior-city.webp",
    "다음 사진이 준비되는 동안 현재 사진 유지");
  assert.equal(exterior.srcWrites, 1);
  assert.equal(root.dataset.realistic, "ready");
  assert.equal(root.dataset.loading, "true");

  const preloader = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element !== cab &&
    element !== exterior &&
    element.src.endsWith("/assets/train-realistic/srt-exterior-field.webp")
  );
  assert.ok(preloader, "다음 환경 자산을 별도 이미지로 미리 읽음");
  preloader.dispatch("load");

  assert.equal(exterior.src,
    "https://game.test/assets/train-realistic/srt-exterior-field.webp");
  assert.equal(exterior.srcWrites, 2, "미리 읽기가 끝난 뒤 현재 이미지 교체");
  assert.equal(root.dataset.realistic, "ready");

  const cabPreloader = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element !== cab &&
    element !== exterior &&
    element.src.endsWith("/assets/train-realistic/cab-field.webp")
  );
  assert.ok(cabPreloader, "지형 운전실도 별도 이미지로 미리 읽음");
  cabPreloader.dispatch("load");
  assert.equal(cab.src, "https://game.test/assets/train-realistic/cab-field.webp");
  assert.equal(root.dataset.loading, "false");
});

test("다음 환경 이미지 미리 읽기가 실패하면 즉시 SVG 폴백을 보여 준다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "cab");
  const cab = root.querySelector(".ktx-real-cab-image");
  const exterior = root.querySelector(".ktx-real-exterior-image");
  cab.dispatch("load");
  exterior.dispatch("load");
  assert.equal(root.dataset.realistic, "ready");

  updateKtxScene(root, { ...initial, phase: "driving", x: 2000 }, "side");

  assert.equal(cab.dataset.loaded, "true", "같은 운전실 자산은 로드 상태 유지");
  assert.equal(exterior.dataset.loaded, "true", "현재 외부 자산도 화면에 유지");
  assert.equal(root.dataset.realistic, "ready");
  assert.equal(root.dataset.loading, "true");

  const preloader = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element !== cab &&
    element !== exterior &&
    element.src.endsWith("/assets/train-realistic/srt-exterior-field.webp")
  );
  assert.ok(preloader);
  preloader.dispatch("error");

  assert.equal(exterior.src,
    "https://game.test/assets/train-realistic/srt-exterior-city.webp",
    "실패한 자산은 현재 이미지에 쓰지 않음");
  assert.equal(exterior.dataset.loaded, "true", "이미 로드된 현재 자산은 유효함");
  assert.equal(exterior.dataset.failed, "true");
  assert.equal(exterior.dataset.failedSrc,
    "assets/train-realistic/srt-exterior-field.webp");
  assert.equal(root.dataset.realistic, "fallback");
  assert.equal(root.dataset.loading, "false");
  assert.ok(root.querySelector(".ktx-side-train"), "외부 SVG 폴백 유지");
});

test("로드된 A에서 B 미리 읽기 실패 후 A로 돌아오면 ready를 유지한다", () => {
  const document = fakeDocument();
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(document, initial, "cab");
  const cab = root.querySelector(".ktx-real-cab-image");
  const exterior = root.querySelector(".ktx-real-exterior-image");
  cab.dispatch("load");
  exterior.dispatch("load");

  const field = { ...initial, phase: "driving", x: 2000 };
  updateKtxScene(root, field, "side");
  const preloader = document.createdElements.find(element =>
    element.tagName === "IMG" &&
    element !== cab &&
    element !== exterior &&
    element.src.endsWith("/assets/train-realistic/srt-exterior-field.webp")
  );
  assert.ok(preloader);
  preloader.dispatch("error");

  updateKtxScene(root, initial, "side");

  assert.equal(exterior.src,
    "https://game.test/assets/train-realistic/srt-exterior-city.webp");
  assert.equal(exterior.dataset.loaded, "true");
  assert.equal(exterior.dataset.failed, undefined);
  assert.equal(root.dataset.realistic, "ready");
  assert.equal(root.dataset.loading, "false");

  updateKtxScene(root, field, "side");
  const retries = document.createdElements.filter(element =>
    element.tagName === "IMG" &&
    element !== cab &&
    element !== exterior &&
    element.src.endsWith("/assets/train-realistic/srt-exterior-field.webp")
  );
  assert.equal(retries.length, 2, "정상 장면으로 복귀한 뒤 실패 자산을 다시 시도");
  retries.at(-1).dispatch("load");
  assert.equal(exterior.src,
    "https://game.test/assets/train-realistic/srt-exterior-field.webp");
  assert.equal(root.dataset.realistic, "ready");
});

test("같은 이미지 경로를 써도 현재 장면 대체 텍스트를 갱신한다", () => {
  const initial = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), initial, "cab");
  const cab = root.querySelector(".ktx-real-cab-image");

  assert.equal(cab.alt, "실사 SRT morning city 운전실");
  updateKtxScene(root, { ...initial, phase: "driving", x: 2000 }, "cab");

  assert.equal(cab.srcWrites, 1, "같은 주간 이미지 경로는 유지");
  assert.equal(cab.alt, "실사 SRT day field 운전실");
});

test("실사 이미지 오류는 즉시 SVG 폴백 상태로 전환한다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "cab");
  const cab = root.querySelector(".ktx-real-cab-image");

  assert.equal(root.dataset.realistic, "pending");
  cab.dispatch("error");

  assert.equal(cab.dataset.failed, "true");
  assert.equal(root.dataset.realistic, "fallback");
  assert.ok(root.querySelector(".ktx-cab-backdrop"), "운전실 SVG 폴백 유지");
  assert.ok(root.querySelector(".ktx-side-train"), "외부 SVG 폴백 유지");
});

test("브라우저 NodeList처럼 배열 메서드가 없어도 실사 상태를 갱신한다", () => {
  const state = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), state, "cab");
  const querySelectorAll = root.querySelectorAll.bind(root);
  root.querySelectorAll = selector => selector === ".ktx-real-scene img"
    ? nodeList(querySelectorAll(selector))
    : querySelectorAll(selector);

  assert.doesNotThrow(() => updateKtxScene(root, state, "cab"));
  assert.equal(root.dataset.realistic, "pending");
});

// ── 서행 표지 HUD(협회 게임 디자인 2026-08-10) ─────────────────────────────

test("서행 배지는 예고·준수·초과를 색 상태로 갈라 보여 준다", () => {
  const base = createKtxJourney(7, "srt", "steady");
  const segIndex = base.slowZones.findIndex(Boolean);
  assert.ok(segIndex > 0, "시드 7에 서행 존이 있다");
  const zone = base.slowZones[segIndex];
  const root = renderKtxScene(fakeDocument(), base, "cab");
  const badge = root.querySelector(".ktx-slow-badge");
  assert.ok(badge, "HUD에 서행 배지 자리가 있다");

  // 평시 — 꺼짐
  updateKtxScene(root, { ...base, phase: "driving" }, "cab");
  assert.equal(root.dataset.slow, "off");
  assert.equal(badge.textContent, "");

  // 예고 후 존 앞 — coming, 제한 숫자 표시
  updateKtxScene(root, {
    ...base, phase: "driving", segIndex, slowWarned: true, x: 0, v: 200
  }, "cab");
  assert.equal(root.dataset.slow, "coming");
  assert.equal(badge.textContent, String(zone.limit));

  // 존 안 준수 — calm
  updateKtxScene(root, {
    ...base, phase: "driving", segIndex, slowWarned: true, v: zone.limit - 20,
    slow: { limit: zone.limit, grace: zone.grace, calm: 1, total: 1, wobbles: 0 }
  }, "cab");
  assert.equal(root.dataset.slow, "calm");

  // 존 안 초과 — over
  updateKtxScene(root, {
    ...base, phase: "driving", segIndex, slowWarned: true, v: zone.limit + 60,
    slow: { limit: zone.limit, grace: zone.grace, calm: 0, total: 1, wobbles: 1 }
  }, "cab");
  assert.equal(root.dataset.slow, "over");
});

// ── 정차 연출(2026-08-10 피드백) — 문 다섯 짝·닫힘 경고·도착 임팩트 ────────

test("문은 칸 접합부마다 다섯 짝이고 상태를 함께 바꾼다", () => {
  const root = renderKtxScene(fakeDocument(), createKtxJourney(3, "srt"), "side");
  const doors = root.querySelectorAll(".ktx-motion-door");
  assert.equal(doors.length, 5, "문 한 짝(23px)으로는 개폐가 읽히지 않는다");
  const lefts = [...doors].map(door => door.style.getPropertyValue("--door-left"));
  assert.equal(new Set(lefts).size, 5, "다섯 짝이 서로 다른 접합부에 선다");
});

test("문닫힘 카운트다운 마지막 3초에 경고 상태가 켜진다", () => {
  const base = createKtxJourney(3, "srt");
  const root = renderKtxScene(fakeDocument(), base, "side");
  const scene = root.querySelector(".ktx-motion-scene");

  updateKtxScene(root, { ...base, doorCountdownMs: 5000 }, "side");
  assert.equal(scene.dataset.doorWarning, "false", "감상 유예 구간은 조용하다");

  updateKtxScene(root, { ...base, doorCountdownMs: 2400 }, "side");
  assert.equal(scene.dataset.doorWarning, "true", "마지막 3초는 문 램프가 깜빡인다");

  updateKtxScene(root, { ...base, doorCountdownMs: null }, "side");
  assert.equal(scene.dataset.doorWarning, "false");
});

test("도착 이벤트는 역명판 팝과 장면 플래시, 문 열림은 하차 연출을 부른다", () => {
  const base = { ...createKtxJourney(3, "srt"), phase: "stopped", station: "동탄" };
  const root = renderKtxScene(fakeDocument(), base, "side");

  updateKtxScene(root, base, "side",
    [{ type: "stopped", station: "동탄", stars: 3, how: "press" }]);
  const sign = root.querySelector(".ktx-motion-station-sign");
  assert.ok(sign.className.includes("ktx-sign-pop"), "역명판이 튄다");
  const scene = root.querySelector(".ktx-motion-scene");
  assert.ok(scene.className.includes("ktx-arrive-flash"), "장면이 한 번 숨쉰다");

  updateKtxScene(root, { ...base, phase: "boarding", doors: "open" }, "side",
    [{ type: "doors-open", station: "동탄", waiting: 3 }]);
  assert.ok(root.querySelector(".ktx-walker-out"), "문이 열리면 친구가 내린다");
});

test("피날레 제목은 노선의 종착역을 말한다 — 목포 완주가 부산이 되지 않는다", () => {
  const mokpo = {
    ...createKtxJourney(3, "srt"),
    route: "mokpo",
    phase: "finale"
  };
  const root = renderKtxScene(fakeDocument(), mokpo, "side");
  updateKtxScene(root, mokpo, "side", [{
    type: "finale", boarded: [1, 2], stars: [3, 1, 3, 3], bonuses: [], perfect: false
  }]);
  assert.match(root.querySelector(".ktx-finale-title").textContent, /목포/);
});

test("교행 이벤트는 건너편 선로의 실사 KTX 스윕을 발사한다", () => {
  const base = { ...createKtxJourney(3, "srt"), phase: "driving" };
  const root = renderKtxScene(fakeDocument(), base, "side");
  const oncoming = root.querySelector(".ktx-motion-oncoming");
  assert.ok(oncoming, "교행 스프라이트가 장면에 상주한다");

  updateKtxScene(root, base, "side", [{ type: "event", event: "passing" }]);
  assert.ok(oncoming.className.includes("ktx-oncoming-go"),
    "passing 이벤트가 스윕 애니메이션을 건다");
});
