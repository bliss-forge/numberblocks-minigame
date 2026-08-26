export const SRT_STATIONS = Object.freeze(["수서", "동탄", "대전", "대구", "부산"]);
export const SRT_CARS = 5;
export const SEAT_ROWS = 4;
export const SEAT_LETTERS = Object.freeze(["A", "B", "C", "D"]);
export const TARGET_SEAT_LETTERS = Object.freeze(["B", "C"]);
export const TRAIN_WIDTH = SRT_CARS * 5 + 1;
export const TRAIN_HEIGHT = 5;
export const CAR_SHAPES = Object.freeze([
  "sedan", "suv", "van", "truck", "sports", "hatchback"
]);
export const CAR_SHAPE_LABELS = Object.freeze({
  sedan: "세단",
  suv: "SUV",
  van: "미니밴",
  truck: "트럭",
  sports: "스포츠카",
  hatchback: "해치백"
});
export const PARKING_SLOTS = 8;

const TRAVEL_MS = 4000;
const STOP_MS = 5000;
export const SPLASH_MESSAGES = Object.freeze([
  "수서역에 도착하였어요!",
  "SRT를 타고 할아버지 할머니댁에 가요!",
  "내 자리를 찾아 앉아보아요!"
]);
export const SPLASH_STEP_MS = 2600;
const STATION_SPLASH_MS = SPLASH_STEP_MS * SPLASH_MESSAGES.length;
const LETTER_ROWS = Object.freeze({ A: 0, B: 1, C: 3, D: 4 });
const ROW_LETTERS = Object.freeze({ 0: "A", 1: "B", 3: "C", 4: "D" });
export const RIDE_DOOR = Object.freeze({ x: 2, y: 2 });
export const RIDE_SEAT = Object.freeze({ x: 2, y: 0 });

const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 })
});

function seededRandom(seed) {
  let value = (Number(seed) || 0) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function seatInfo(x, y) {
  if (x % 5 === 0) return null;
  const letter = ROW_LETTERS[y] ?? null;
  if (!letter) return null;
  const car = Math.floor(x / 5) + 1;
  const row = x % 5;
  return { car, row, letter, name: `${car}호차 ${row}${letter}` };
}

// 글을 못 읽는 아이에게 "1호차 2C"는 아무 정보가 아니다 — 승차권을 소리로도
// 읽어 준다(심층 검토 P1-11). 호차와 자리를 나눠 두면 조합 40개 대신 13개면 된다.
export function ticketVoiceKeys(target) {
  if (!target) return [];
  return [
    `srt-car-${target.car}`,
    `srt-seat-${target.row}${target.letter.toLowerCase()}`
  ];
}

export function seatCell(target) {
  return {
    x: 5 * (target.car - 1) + target.row,
    y: LETTER_ROWS[target.letter]
  };
}

export function trainWalkable(x, y) {
  if (x < 0 || x >= TRAIN_WIDTH || y < 0 || y >= TRAIN_HEIGHT) return false;
  if (y === 2) return true;
  return x % 5 !== 0;
}

function buildParkingLot(random) {
  const targetShape = CAR_SHAPES[Math.floor(random() * CAR_SHAPES.length)];
  const plates = new Set();
  const nextPlate = () => {
    let plate;
    do {
      plate = String(1000 + Math.floor(random() * 9000));
    } while (plates.has(plate));
    plates.add(plate);
    return plate;
  };
  const targetPlate = nextPlate();
  const slots = Array.from({ length: PARKING_SLOTS }, () => null);
  const openSlots = () => slots.flatMap(
    (slot, index) => (slot === null ? [index] : [])
  );
  const takeSlot = () => {
    const open = openSlots();
    return open[Math.floor(random() * open.length)];
  };
  slots[takeSlot()] = { shape: targetShape, plate: targetPlate };
  for (let decoy = 0; decoy < 2; decoy += 1) {
    slots[takeSlot()] = { shape: targetShape, plate: nextPlate() };
  }
  openSlots().forEach(index => {
    slots[index] = {
      shape: CAR_SHAPES[Math.floor(random() * CAR_SHAPES.length)],
      plate: nextPlate()
    };
  });
  return { cars: slots, targetShape, targetPlate };
}

export function createSrtJourney(seed = 0) {
  const random = seededRandom(seed);
  return {
    phase: "station",
    seed,
    introMs: 0,
    target: {
      car: 1 + Math.floor(random() * SRT_CARS),
      row: 1 + Math.floor(random() * SEAT_ROWS),
      letter: TARGET_SEAT_LETTERS[
        Math.floor(random() * TARGET_SEAT_LETTERS.length)
      ]
    },
    targetStation: "부산",
    parking: buildParkingLot(random),
    position: { x: 0, y: 2 },
    ride: { stationIndex: 0, moving: true, doorOpen: false, phaseMs: 0 }
  };
}

export function targetSeatName(state) {
  return `${state.target.car}호차 ${state.target.row}${state.target.letter}`;
}

export function splashStep(state) {
  return Math.min(
    Math.floor((state.introMs ?? 0) / SPLASH_STEP_MS),
    SPLASH_MESSAGES.length - 1
  );
}

function move(state, position, event, extra = {}) {
  return { state: { ...state, position, ...extra }, event };
}

export function attemptSrtMove(state, direction) {
  const offset = DIRECTIONS[direction];
  if (!offset || state.phase === "done" || state.phase === "station") {
    return { state, event: { type: "ignored" } };
  }
  const next = {
    x: state.position.x + offset.x,
    y: state.position.y + offset.y
  };

  if (state.phase === "seat") {
    if (!trainWalkable(next.x, next.y)) {
      return move(state, { ...state.position }, { type: "blocked" });
    }
    const seat = seatInfo(next.x, next.y);
    if (seat) {
      const target = state.target;
      if (seat.car === target.car && seat.row === target.row &&
        seat.letter === target.letter) {
        return move(state, next, { type: "seat-found", seat: seat.name }, {
          phase: "ride",
          position: { ...RIDE_SEAT },
          ride: { stationIndex: 0, moving: true, doorOpen: false, phaseMs: 0 }
        });
      }
      return move(
        state,
        { ...state.position },
        { type: "wrong-seat", seat: seat.name }
      );
    }
    return move(state, next, { type: "moved" });
  }

  if (state.phase === "ride") {
    if (next.x < 0 || next.x > 4 || next.y < 0 || next.y > 2) {
      return move(state, { ...state.position }, { type: "blocked" });
    }
    const atDoor = next.x === RIDE_DOOR.x && next.y === RIDE_DOOR.y;
    if (atDoor && state.ride.doorOpen) {
      const station = SRT_STATIONS[state.ride.stationIndex];
      if (station === state.targetStation) {
        return move(state, { x: 2, y: 1 }, { type: "arrived", station }, {
          phase: "parking"
        });
      }
      return move(
        state,
        { ...RIDE_SEAT },
        { type: "wrong-station", station }
      );
    }
    return move(state, next, { type: "moved" });
  }

  if (state.phase === "parking") {
    if (next.x < 0 || next.x >= PARKING_SLOTS || next.y < 0 || next.y > 1) {
      return move(state, { ...state.position }, { type: "blocked" });
    }
    if (next.y === 0) {
      const car = state.parking.cars[next.x];
      if (car.shape === state.parking.targetShape &&
        car.plate === state.parking.targetPlate) {
        return move(state, next, {
          type: "car-found",
          shape: car.shape,
          plate: car.plate
        }, { phase: "done" });
      }
      return move(state, { ...state.position }, {
        type: "wrong-car",
        shape: car.shape,
        plate: car.plate,
        shapeMatches: car.shape === state.parking.targetShape
      });
    }
    return move(state, next, { type: "moved" });
  }

  return { state, event: { type: "ignored" } };
}

export function advanceSrtWorld(state, elapsedMs = 100) {
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  if (state.phase === "station") {
    const introMs = (state.introMs ?? 0) + elapsed;
    if (introMs >= STATION_SPLASH_MS) {
      return { ...state, phase: "seat", introMs, position: { x: 0, y: 2 } };
    }
    return { ...state, introMs };
  }
  if (state.phase !== "ride") return state;
  const ride = { ...state.ride, phaseMs: state.ride.phaseMs + elapsed };
  if (ride.moving && ride.phaseMs >= TRAVEL_MS) {
    ride.stationIndex += 1;
    ride.moving = false;
    ride.doorOpen = true;
    ride.phaseMs = 0;
  } else if (!ride.moving && ride.phaseMs >= STOP_MS) {
    if (ride.stationIndex < SRT_STATIONS.length - 1) {
      ride.moving = true;
      ride.doorOpen = false;
      ride.phaseMs = 0;
    } else {
      ride.phaseMs = STOP_MS;
    }
  }
  return { ...state, ride };
}

export function rideAnnouncement(state) {
  const { stationIndex, moving } = state.ride;
  if (moving) {
    const nextStation = SRT_STATIONS[Math.min(
      stationIndex + 1,
      SRT_STATIONS.length - 1
    )];
    return `다음 역은 ${nextStation}역입니다`;
  }
  const station = SRT_STATIONS[stationIndex];
  return `${station}역입니다. 문이 열렸어요`;
}
