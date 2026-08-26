import test from "node:test";
import assert from "node:assert/strict";
import { VOICE } from "../src/audio-manifest.mjs";
import {
  advanceSrtWorld,
  attemptSrtMove,
  createSrtJourney,
  RIDE_DOOR,
  RIDE_SEAT,
  SEAT_ROWS,
  seatCell,
  seatInfo,
  SPLASH_MESSAGES,
  SPLASH_STEP_MS,
  splashStep,
  SRT_CARS,
  SRT_STATIONS,
  TARGET_SEAT_LETTERS,
  targetSeatName,
  ticketVoiceKeys,
  trainWalkable
} from "../src/srt-journey.mjs";

test("역 순서는 수서-동탄-대전-대구-부산이다", () => {
  assert.deepEqual([...SRT_STATIONS], ["수서", "동탄", "대전", "대구", "부산"]);
});

test("같은 시드는 같은 좌석·차량 목표를 만든다", () => {
  const first = createSrtJourney(77);
  const second = createSrtJourney(77);
  assert.equal(first.phase, "station");
  assert.deepEqual(first.target, second.target);
  assert.deepEqual(first.parking, second.parking);
  assert.ok(first.target.car >= 1 && first.target.car <= 5);
  assert.ok(first.target.row >= 1 && first.target.row <= 4);
  assert.ok(["B", "C"].includes(first.target.letter));
  assert.equal(first.targetStation, "부산");
});

test("목표 좌석은 복도에서 바로 닿는 B·C 좌석만 나온다", () => {
  for (let seed = 0; seed < 40; seed += 1) {
    const journey = createSrtJourney(seed);
    assert.ok(
      ["B", "C"].includes(journey.target.letter),
      `seed ${seed} picked ${journey.target.letter}`
    );
  }
});

test("수서역 스플래시는 3단계 안내를 거쳐 좌석 찾기로 넘어간다", () => {
  assert.deepEqual([...SPLASH_MESSAGES], [
    "수서역에 도착하였어요!",
    "SRT를 타고 할아버지 할머니댁에 가요!",
    "내 자리를 찾아 앉아보아요!"
  ]);
  let state = createSrtJourney(5);
  assert.equal(attemptSrtMove(state, "right").event.type, "ignored");
  assert.equal(splashStep(state), 0);
  state = advanceSrtWorld(state, SPLASH_STEP_MS);
  assert.equal(state.phase, "station");
  assert.equal(splashStep(state), 1);
  state = advanceSrtWorld(state, SPLASH_STEP_MS);
  assert.equal(state.phase, "station");
  assert.equal(splashStep(state), 2);
  state = advanceSrtWorld(state, SPLASH_STEP_MS);
  assert.equal(state.phase, "seat");
});

test("주차장에는 8대가 서 있고 목표 모양 함정이 2대 이상 있다", () => {
  const { parking } = createSrtJourney(13);
  assert.equal(parking.cars.length, 8);
  const sameShape = parking.cars.filter(
    car => car.shape === parking.targetShape
  );
  assert.ok(sameShape.length >= 3, "target + at least two decoys");
  assert.equal(
    sameShape.filter(car => car.plate === parking.targetPlate).length,
    1
  );
  const plates = new Set(parking.cars.map(car => car.plate));
  assert.equal(plates.size, parking.cars.length, "plates are unique");
  parking.cars.forEach(car => assert.match(car.plate, /^\d{4}$/));
});

test("좌석 좌표와 이름이 서로 일치한다", () => {
  const target = { car: 5, row: 3, letter: "A" };
  const cell = seatCell(target);
  const info = seatInfo(cell.x, cell.y);
  assert.deepEqual(
    { car: info.car, row: info.row, letter: info.letter },
    target
  );
  assert.equal(info.name, "5호차 3A");
  assert.equal(seatInfo(0, 0), null);
  assert.equal(seatInfo(5, 1), null);
  assert.equal(trainWalkable(5, 2), true);
  assert.equal(trainWalkable(5, 1), false);
});

test("목표 좌석에 앉으면 탑승 단계로, 다른 좌석은 안내만 한다", () => {
  const journey = { ...createSrtJourney(3), phase: "seat" };
  const cell = seatCell(journey.target);
  const beside = { x: cell.x, y: 2 };
  const direction = cell.y < 2 ? "up" : "down";
  const wrongCell = seatCell({
    car: journey.target.car === 1 ? 2 : 1,
    row: journey.target.row,
    letter: journey.target.letter
  });

  const wrong = attemptSrtMove(
    { ...journey, position: { x: wrongCell.x, y: 2 } },
    wrongCell.y < 2 ? "up" : "down"
  );
  assert.equal(wrong.event.type, "wrong-seat");
  assert.equal(wrong.state.phase, "seat");

  const found = attemptSrtMove({ ...journey, position: beside }, direction);
  assert.equal(found.event.type, "seat-found");
  assert.equal(found.event.seat, targetSeatName(journey));
  assert.equal(found.state.phase, "ride");
  assert.deepEqual(found.state.position, RIDE_SEAT);
});

test("기차는 4초 이동 후 정차하고 부산이 아니면 다시 태운다", () => {
  const base = { ...createSrtJourney(3), phase: "ride" };
  let state = base;
  state = advanceSrtWorld(state, 4000);
  assert.equal(state.ride.stationIndex, 1);
  assert.equal(state.ride.doorOpen, true);

  const wrong = attemptSrtMove(
    { ...state, position: { x: RIDE_DOOR.x, y: RIDE_DOOR.y - 1 } },
    "down"
  );
  assert.equal(wrong.event.type, "wrong-station");
  assert.equal(wrong.event.station, "동탄");
  assert.equal(wrong.state.phase, "ride");
  assert.deepEqual(wrong.state.position, RIDE_SEAT);

  state = advanceSrtWorld(state, 5000);
  assert.equal(state.ride.moving, true);
  for (const expected of [2, 3, 4]) {
    state = advanceSrtWorld(state, 4000);
    assert.equal(state.ride.stationIndex, expected);
    if (expected < 4) state = advanceSrtWorld(state, 5000);
  }
  assert.equal(SRT_STATIONS[state.ride.stationIndex], "부산");

  state = advanceSrtWorld(state, 9000);
  assert.equal(state.ride.doorOpen, true, "종점에서는 문이 계속 열려 있다");

  const arrived = attemptSrtMove(
    { ...state, position: { x: RIDE_DOOR.x, y: RIDE_DOOR.y - 1 } },
    "down"
  );
  assert.equal(arrived.event.type, "arrived");
  assert.equal(arrived.state.phase, "parking");
});

test("모양과 번호판이 모두 맞는 차를 골라야 성공한다", () => {
  const journey = { ...createSrtJourney(11), phase: "parking" };
  const { cars, targetShape, targetPlate } = journey.parking;
  const targetIndex = cars.findIndex(car =>
    car.shape === targetShape && car.plate === targetPlate
  );
  const decoyIndex = cars.findIndex(car =>
    car.shape === targetShape && car.plate !== targetPlate
  );
  const otherIndex = cars.findIndex(car => car.shape !== targetShape);

  const decoy = attemptSrtMove(
    { ...journey, position: { x: decoyIndex, y: 1 } },
    "up"
  );
  assert.equal(decoy.event.type, "wrong-car");
  assert.equal(decoy.event.shapeMatches, true);
  assert.equal(decoy.state.phase, "parking");

  const other = attemptSrtMove(
    { ...journey, position: { x: otherIndex, y: 1 } },
    "up"
  );
  assert.equal(other.event.type, "wrong-car");
  assert.equal(other.event.shapeMatches, false);

  const found = attemptSrtMove(
    { ...journey, position: { x: targetIndex, y: 1 } },
    "up"
  );
  assert.equal(found.event.type, "car-found");
  assert.equal(found.event.plate, targetPlate);
  assert.equal(found.state.phase, "done");
});

// 심층 검토 P1-11. "1호차 2C"는 글을 못 읽는 아이에게 아무 정보가 아니었다.
test("승차권은 호차와 자리를 나눠 음성 키로 읽어 준다", () => {
  assert.deepEqual(
    ticketVoiceKeys({ car: 1, row: 2, letter: "C" }),
    ["srt-car-1", "srt-seat-2c"]
  );
  assert.deepEqual(ticketVoiceKeys(null), []);

  // 나올 수 있는 목표는 전부 등재된 음성이어야 한다 — 하나라도 빠지면 무음이다.
  for (let car = 1; car <= SRT_CARS; car += 1) {
    for (let row = 1; row <= SEAT_ROWS; row += 1) {
      for (const letter of TARGET_SEAT_LETTERS) {
        for (const key of ticketVoiceKeys({ car, row, letter })) {
          assert.ok(VOICE[key], `${key} 가 매니페스트에 없다`);
        }
      }
    }
  }
});
