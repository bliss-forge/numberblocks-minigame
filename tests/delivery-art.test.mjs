// 택배 그림 계약 — 목표만 빛나고, 초점이 그림에 드러나고, 트럭은 방향대로 선다.
// 그림의 정본은 목업 v3(mockups/v3/*.html)이다.

import test from "node:test";
import { characterWebpPath } from "../src/character-image.mjs";
import { characterAsset } from "../src/character-spec.mjs";
import assert from "node:assert/strict";
import {
  CELL_ANCHORS,
  MAP_VIEW_BOX,
  anchorFor,
  estateMapSvg,
} from "../src/delivery-estate-art.mjs";
import {
  ELEVATOR_RIDER,
  corridorSvg,
  elevatorCabinSvg,
  elevatorShaftSvg,
  friendImageFor,
  handoverSvg,
} from "../src/delivery-building-art.mjs";
import { finaleSvg } from "../src/delivery-finale-art.mjs";
import { FRIENDS, PARCELS, createDelivery } from "../src/delivery-model.mjs";
import { GRID_COLUMNS, GRID_ROWS } from "../src/delivery-model.mjs";

function mapView(state, truck, facing) {
  return { houses: state.houses, targetUnit: state.order.unit, truck, facing };
}

/* ── 지도 ─────────────────────────────────────────────────────────── */

test("격자의 모든 칸에 트럭이 설 자리가 있다", () => {
  assert.equal(CELL_ANCHORS.length, GRID_ROWS);
  for (const row of CELL_ANCHORS) {
    assert.equal(row.length, GRID_COLUMNS);
    for (const anchor of row) {
      assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
    }
  }
  const [, , boxWidth, boxHeight] = MAP_VIEW_BOX.split(" ").map(Number);
  for (const row of CELL_ANCHORS) {
    for (const anchor of row) {
      assert.ok(anchor.x > 0 && anchor.x < boxWidth, `x ${anchor.x} 가 지도 밖`);
      assert.ok(anchor.y > 0 && anchor.y < boxHeight, `y ${anchor.y} 가 지도 밖`);
    }
  }
});

test("지도는 집 네 채를 모두 그리고 목표만 후광으로 감싼다", () => {
  const state = createDelivery("challenge", 21);
  const svg = estateMapSvg(mapView(state, { x: 1, y: 1 }, "idle"));

  for (const house of state.houses) {
    assert.ok(svg.includes(`>${house.unit}</text>`), `${house.unit}호가 지도에 없다`);
  }
  assert.equal((svg.match(/url\(#dv-goalglow\)/g) ?? []).length, 1, "빛나는 동은 하나여야 한다");
  assert.ok(svg.includes(`여기가 ${state.order.unit}호!`), "목표 말풍선이 없다");
  assert.match(svg, /aria-label="[^"]*목표는 \d+호예요/);
});

test("목표 동 앞 도로에 하역 존이 깔린다", () => {
  const state = createDelivery("challenge", 21);
  const svg = estateMapSvg(mapView(state, { x: 1, y: 1 }, "idle"));

  assert.ok(svg.includes('stroke-dasharray="22 14"'), "하역 존 점선이 없다");
  assert.ok(svg.includes(">P</text>"), "주차 표식이 없다");
});

test("길찾기 화살표는 목표까지 남았을 때만 뜬다", () => {
  const state = createDelivery("steady", 7);
  const away = estateMapSvg(mapView(state, { x: 1, y: 1 }, "idle"));
  const arrived = estateMapSvg(mapView(state, state.order.cell, "idle"));

  assert.match(away, /class="dv-guide"/, "길이 남았는데 화살표가 없다");
  assert.equal(/class="dv-guide"/.test(arrived), false, "도착했는데 화살표가 남았다");
});

test("주행 방향이 트럭 뷰를 바꾼다", () => {
  const state = createDelivery("steady", 5);
  const spriteView = facing => {
    const svg = estateMapSvg(mapView(state, { x: 2, y: 1 }, facing));
    return svg.match(/class="dv-truck-sprite dv-truck-([\w-]+)"/)[1];
  };

  assert.equal(spriteView("right"), "side");
  assert.equal(spriteView("left"), "side-rev");
  assert.equal(spriteView("up"), "rear");
  assert.equal(spriteView("down"), "front");
  assert.equal(spriteView("idle"), "front34");
});

test("트럭은 자기 칸의 자리에 선다", () => {
  const state = createDelivery("steady", 5);
  const cell = { x: 4, y: 1 };
  const svg = estateMapSvg(mapView(state, cell, "right"));
  const anchor = anchorFor(cell);
  const sprite = svg.match(
    /<svg class="dv-truck-sprite [\w-]+" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/
  );

  assert.ok(sprite, "트럭 스프라이트가 없다");
  const [, x, y, width, height] = sprite.map(Number);
  assert.ok(Math.abs(x + width / 2 - anchor.x) < 1, "가로 중심이 앵커와 어긋난다");
  assert.ok(Math.abs(y + height - (anchor.y + 14)) < 1, "바퀴가 앵커 바닥과 어긋난다");
});

/* ── 엘리베이터 ───────────────────────────────────────────────────── */

test("샤프트는 층을 모두 세우고 목표 층에 후광을 두른다", () => {
  const svg = elevatorShaftSvg({ topFloor: 7, current: 3, target: 7 });
  for (let floor = 1; floor <= 7; floor += 1) {
    assert.ok(svg.includes(`>${floor}</text>`), `${floor}층 표시가 없다`);
  }
  assert.ok(svg.includes('fill="#FFE1D6"'), "목표 층 후광이 없다");
  assert.match(svg, /aria-label="[^"]*지금 3층, 목표는 7층/);
});

test("칸이 층을 따라 오르내린다", () => {
  const low = elevatorShaftSvg({ topFloor: 7, current: 1, target: 7 });
  const high = elevatorShaftSvg({ topFloor: 7, current: 7, target: 7 });
  const carY = markup => Number(markup.match(/class="dv-car" x="\d+" y="([-\d.]+)"/)[1]);

  assert.ok(carY(high) < carY(low), "위층일수록 칸이 위에 있어야 한다");
});

test("승강기에는 기사님이 카트를 밀고 탄다", () => {
  assert.equal(ELEVATOR_RIDER, "courier");
  const svg = elevatorCabinSvg({ current: 3 });
  assert.match(svg, /class="dv-courier"/, "승강기 안에 기사님이 없다");
  assert.match(svg, /class="dv-floor-readout"[^>]*>3</, "층 표시기가 현재 층을 안 보여 준다");
});

/* ── 복도 ─────────────────────────────────────────────────────────── */

test("복도는 문 셋을 그리고 목표 문패만 금빛으로 빛낸다", () => {
  const svg = corridorSvg({ units: [701, 702, 703], focus: 1, targetUnit: 702 });
  for (const unit of [701, 702, 703]) {
    assert.ok(svg.includes(`>${unit}</text>`), `${unit}호 문패가 없다`);
  }
  assert.equal((svg.match(/filter="url\(#dv-goldglow\)"/g) ?? []).length, 1, "빛나는 문패는 하나여야 한다");
  assert.ok(svg.includes("딩동!"), "초인종 소리가 없다");
});

test("목표 문 앞에 섰을 때만 호 확인 연출이 뜬다", () => {
  const onTarget = corridorSvg({ units: [701, 702, 703], focus: 1, targetUnit: 702 });
  const offTarget = corridorSvg({ units: [701, 702, 703], focus: 0, targetUnit: 702 });

  assert.ok(onTarget.includes("숫자가 딱 같네!"), "맞은 문 앞인데 확인 연출이 없다");
  assert.equal(offTarget.includes("숫자가 딱 같네!"), false, "다른 문 앞인데 확인 연출이 떴다");
});

test("택배 기사는 고른 문 앞으로 옮겨 선다", () => {
  const standX = focus => {
    const svg = corridorSvg({ units: [701, 702, 703], focus, targetUnit: 702 });
    return Number(svg.match(/class="dv-courier"[^>]*><g transform="translate\(([-\d.]+) /)[1]);
  };
  assert.ok(standX(0) < standX(1), "왼쪽 문일수록 더 왼쪽에 서야 한다");
  assert.ok(standX(1) < standX(2));
});

/* ── 전달 순간 ────────────────────────────────────────────────────── */

test("트레이 상자 셋이 이름표를 달고 고른 상자만 빛난다", () => {
  const svg = handoverSvg({
    tray: PARCELS,
    focus: 2,
    wanted: PARCELS[2],
    unit: 702,
    friend: FRIENDS[0],
  });
  for (const item of PARCELS) {
    assert.ok(svg.includes(`>${item.label}</text>`), `${item.label} 이름표가 없다`);
    assert.ok(svg.includes(item.emoji), `${item.label} 그림이 없다`);
  }
  assert.equal((svg.match(/filter="url\(#dv-pickglow\)"/g) ?? []).length, 1, "고른 상자는 하나여야 한다");
});

test("친구가 기다리는 물건을 말풍선으로 말한다", () => {
  for (const item of PARCELS) {
    const svg = handoverSvg({ tray: PARCELS, focus: 0, wanted: item, unit: 305, friend: FRIENDS[1] });
    assert.ok(svg.includes(`나는 ${item.label}를`), `${item.label} 대사가 없다`);
    assert.ok(svg.includes("기다리고 있었어!"));
    assert.ok(svg.includes(">305</text>"), "문패 호수가 없다");
  }
});

test("수령인은 호수 앞자리 번호의 실제 넘버블럭스 에셋이다 — 5번 게임과 같은 그림", () => {
  // 같은 그림이면 된다 — 형식은 character-image 가 정한다(SVG 는 srcset 이 없어
  // WebP 파생본을 바로 가리킨다). 경로를 글자로 박으면 형식이 바뀔 때마다 깨진다.
  assert.equal(friendImageFor(502), characterWebpPath(characterAsset(5)));
  assert.equal(friendImageFor(701), characterWebpPath(characterAsset(7)));
  assert.match(friendImageFor(502), /five/, "5번 친구 그림이어야 한다");

  const svg = handoverSvg({ tray: PARCELS, focus: 0, wanted: PARCELS[0], unit: 502, friend: FRIENDS[0] });
  assert.ok(svg.includes(`href="${friendImageFor(502)}"`), "수령인 에셋이 없다");
});

test("받는 친구 색은 배송마다 달라질 수 있다", () => {
  const first = handoverSvg({ tray: PARCELS, focus: 0, wanted: PARCELS[0], unit: 702, friend: FRIENDS[0] });
  const second = handoverSvg({ tray: PARCELS, focus: 0, wanted: PARCELS[0], unit: 702, friend: FRIENDS[2] });
  assert.ok(first.includes(FRIENDS[0].color));
  assert.ok(second.includes(FRIENDS[2].color));
  assert.notEqual(first, second);
});

/* ── 피날레 ───────────────────────────────────────────────────────── */

test("피날레는 배달한 수만큼 친구를 세운다", () => {
  const three = finaleSvg({ delivered: 3 });
  const five = finaleSvg({ delivered: 5 });

  assert.equal((three.match(/class="dv-chorus"/g) ?? []).length, 3);
  assert.equal((five.match(/class="dv-chorus"/g) ?? []).length, 5);
  assert.ok(
    five.includes(characterWebpPath(characterAsset(5))),
    "5번 친구가 없다"
  );
  assert.ok(five.includes("멋진 꼬마 택배기사님, 고마워요!"), "합창 배너가 없다");
});

/* ── 공통 ─────────────────────────────────────────────────────────── */

test("모든 그림이 하나짜리 svg 로 닫힌다", () => {
  const state = createDelivery("steady", 2);
  const drawings = [
    estateMapSvg(mapView(state, { x: 1, y: 1 }, "idle")),
    elevatorShaftSvg({ topFloor: 7, current: 2, target: 5 }),
    elevatorCabinSvg({ current: 2 }),
    corridorSvg({ units: [501, 502, 503], focus: 0, targetUnit: 502 }),
    handoverSvg({ tray: PARCELS, focus: 0, wanted: PARCELS[0], unit: 502, friend: FRIENDS[0] }),
    finaleSvg({ delivered: 5 }),
  ];
  for (const markup of drawings) {
    assert.match(markup, /^<svg /);
    assert.match(markup, /<\/svg>$/);
    assert.equal(
      (markup.match(/<svg /g) ?? []).length,
      (markup.match(/<\/svg>/g) ?? []).length,
      "중첩 svg 가 안 닫혔다"
    );
  }
});
