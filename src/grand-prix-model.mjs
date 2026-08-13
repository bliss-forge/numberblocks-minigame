export const GRAND_PRIX_COURSE = "star-canyon-circuit";

const TRACK_LENGTH = 980;
const TOTAL_LAPS = 2;
const GATE_POSITIONS = Object.freeze([245, 505, 760]);
const COURSE_STEPS = Object.freeze([
  { id: "plus-2", value: 2, target: 6, lane: -0.58, decoy: "plus-4" },
  { id: "plus-1", value: 1, target: 7, lane: 0, decoy: "plus-3" },
  { id: "plus-3", value: 3, target: 10, lane: 0.58, decoy: "plus-2" }
]);
const RACER_NUMBERS = Object.freeze([1, 2, 3, 5]);
const MAX_SPEED = 74;
const BOOST_SPEED = 96;
const ACCELERATION = 36;
const COAST_DECELERATION = 11;
const BRAKE_DECELERATION = 76;
const TURN_FORCE = 2.9;
const ROAD_LIMIT = 1.15;
const OFFROAD_LIMIT = 2.05;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function seededOrder(seed) {
  let value = (Number(seed) || 1) >>> 0;
  const entries = [...RACER_NUMBERS];
  for (let index = entries.length - 1; index > 0; index -= 1) {
    value = (value * 1664525 + 1013904223) >>> 0;
    const picked = value % (index + 1);
    [entries[index], entries[picked]] = [entries[picked], entries[index]];
  }
  return entries;
}

function activeStep(state) {
  return COURSE_STEPS[state.checkpoint] ?? null;
}

function totalProgress(state) {
  return (state.lap - 1) * TRACK_LENGTH + state.progress;
}

function addBoost(state, duration) {
  state.drive.boostMs = Math.max(state.drive.boostMs, duration);
}

function passStep(state, gateId, automatic = false) {
  const step = activeStep(state);
  if (!step) return [];
  if (gateId !== step.id) {
    state.correction = Math.max(0, step.target - state.number);
    state.correctionAt = state.progress + 86;
    state.drive.penaltyMs = Math.max(state.drive.penaltyMs, 850);
    return [{ type: "wrong-gate", gateId, needed: state.correction, automatic }];
  }
  state.number += step.value;
  state.fuel += 1;
  state.checkpoint += 1;
  state.gateLatched = false;
  addBoost(state, 1050);
  return [{ type: "number-boost", value: step.value, number: state.number, fuel: state.fuel, automatic }];
}

function takeCorrection(state, automatic = false) {
  const step = activeStep(state);
  if (!step || state.correction <= 0) return [];
  state.number += state.correction;
  state.correction = 0;
  state.correctionAt = null;
  state.fuel += 1;
  state.checkpoint += 1;
  state.gateLatched = false;
  addBoost(state, 700);
  return [{ type: "correction", number: state.number, fuel: state.fuel, automatic }];
}

function tickAi(state, seconds) {
  state.racers.forEach((racer, index) => {
    const pressure = racer.totalProgress < totalProgress(state) - 20 ? 1.12 : 0.98;
    racer.totalProgress += racer.pace * pressure * seconds;
    racer.progress = racer.totalProgress % TRACK_LENGTH;
    racer.lap = Math.floor(racer.totalProgress / TRACK_LENGTH) + 1;
    racer.laneTarget = Math.sin((state.elapsedMs / 850) + index * 1.9) * 0.72;
    racer.lane += (racer.laneTarget - racer.lane) * Math.min(1, seconds * 2.8);
  });
}

function checkTrackEvents(state) {
  const events = [];
  const step = activeStep(state);
  if (state.lap === 1 && step && state.progress >= GATE_POSITIONS[state.checkpoint] && !state.gateLatched) {
    state.gateLatched = true;
    const enteredCorrectGate = Math.abs(state.drive.lateral - step.lane) < 0.38;
    events.push(...passStep(state, enteredCorrectGate ? step.id : step.decoy, true));
  }
  if (state.correction > 0 && state.correctionAt !== null && state.progress >= state.correctionAt) {
    if (Math.abs(state.drive.lateral) < 0.5) events.push(...takeCorrection(state, true));
    else {
      state.correctionAt += 48;
      state.drive.penaltyMs = Math.max(state.drive.penaltyMs, 500);
    }
  }
  if (state.jumpAt >= 0 && Math.abs(state.progress - state.jumpAt) < 8 && Math.abs(state.drive.lateral) < 0.46) {
    state.drive.airborneMs = Math.max(state.drive.airborneMs, 430);
    addBoost(state, 520);
  }
  return events;
}

export function createGrandPrix(difficulty = "easy", seed = Date.now()) {
  const racers = seededOrder(seed).map((number, index) => ({
    number,
    lane: [-0.72, -0.2, 0.34, 0.78][index],
    laneTarget: [-0.72, -0.2, 0.34, 0.78][index],
    pace: 51 + index * 1.25,
    progress: index * 5,
    totalProgress: index * 5,
    lap: 1
  }));
  return {
    difficulty,
    seed,
    course: GRAND_PRIX_COURSE,
    phase: "grid",
    target: 10,
    number: 4,
    fuel: 0,
    checkpoint: 0,
    correction: 0,
    correctionAt: null,
    lap: 1,
    totalLaps: TOTAL_LAPS,
    progress: 0,
    elapsedMs: 0,
    countdownMs: 1800,
    gateLatched: false,
    jumpAt: 640,
    racers,
    drive: {
      speed: 0,
      lateral: 0,
      lateralVelocity: 0,
      heading: 0,
      throttle: false,
      brake: false,
      boostMs: 0,
      penaltyMs: 0,
      airborneMs: 0,
      offroad: false,
      collisionMs: 0
    }
  };
}

export function startGrandPrix(state) {
  if (state.phase !== "grid") return [];
  state.phase = "racing";
  state.countdownMs = 1800;
  return [{ type: "race-start" }];
}

export function setGrandPrixThrottle(state, active) {
  if (state.phase !== "racing") return [];
  state.drive.throttle = Boolean(active);
  return [{ type: active ? "accelerate" : "coast" }];
}

export function setGrandPrixBrake(state, active) {
  if (state.phase !== "racing") return [];
  state.drive.brake = Boolean(active);
  return [{ type: active ? "brake" : "release-brake" }];
}

export function steerGrandPrix(state, direction, active = true) {
  if (state.phase !== "racing") return [];
  const turn = direction === "left" ? -1 : direction === "right" ? 1 : 0;
  if (!turn) return [];
  state.drive.heading = active ? turn : 0;
  return [{ type: "steer", heading: state.drive.heading }];
}

export function tickGrandPrix(state, elapsedMs) {
  if (state.phase !== "racing") return [];
  const delta = clamp(Number(elapsedMs) || 0, 0, 50);
  const seconds = delta / 1000;
  const events = [];
  state.elapsedMs += delta;
  state.countdownMs = Math.max(0, state.countdownMs - delta);
  state.drive.boostMs = Math.max(0, state.drive.boostMs - delta);
  state.drive.penaltyMs = Math.max(0, state.drive.penaltyMs - delta);
  state.drive.airborneMs = Math.max(0, state.drive.airborneMs - delta);
  state.drive.collisionMs = Math.max(0, state.drive.collisionMs - delta);
  if (state.countdownMs > 0) {
    tickAi(state, seconds * 0.55);
    return events;
  }
  const drive = state.drive;
  const offroad = Math.abs(drive.lateral) > ROAD_LIMIT;
  drive.offroad = offroad;
  const cap = drive.boostMs > 0 ? BOOST_SPEED : MAX_SPEED;
  if (drive.throttle) drive.speed += ACCELERATION * seconds;
  else drive.speed -= COAST_DECELERATION * seconds;
  if (drive.brake) drive.speed -= BRAKE_DECELERATION * seconds;
  if (offroad) drive.speed -= 38 * seconds;
  if (drive.penaltyMs > 0) drive.speed -= 45 * seconds;
  drive.speed = clamp(drive.speed, 0, cap);
  drive.lateralVelocity += drive.heading * TURN_FORCE * seconds * (0.25 + drive.speed / MAX_SPEED);
  drive.lateralVelocity *= offroad ? 0.88 : 0.92;
  drive.lateral += drive.lateralVelocity * seconds;
  drive.lateral = clamp(drive.lateral, -OFFROAD_LIMIT, OFFROAD_LIMIT);
  state.progress += drive.speed * seconds;
  while (state.progress >= TRACK_LENGTH) {
    state.progress -= TRACK_LENGTH;
    state.lap += 1;
    state.gateLatched = false;
  }
  tickAi(state, seconds);
  state.racers.forEach(racer => {
    const gap = Math.abs(racer.totalProgress - totalProgress(state));
    if (drive.collisionMs === 0 && gap < 4 && Math.abs(racer.lane - drive.lateral) < 0.26) {
      drive.penaltyMs = 650;
      drive.collisionMs = 650;
      events.push({ type: "kart-bump", racer: racer.number });
    }
  });
  events.push(...checkTrackEvents(state));
  return events;
}

export function chooseGrandPrixGate(state, gateId) {
  if (state.phase !== "racing") return [];
  return passStep(state, gateId, false);
}

export function takeGrandPrixCorrection(state) {
  if (state.phase !== "racing") return [];
  return takeCorrection(state, false);
}

export function useGrandPrixJump(state) {
  if (state.phase !== "racing" || state.countdownMs > 0) return [];
  state.drive.airborneMs = Math.max(state.drive.airborneMs, 360);
  if (state.drive.speed > 42) addBoost(state, 500);
  return [{ type: "jump", boost: state.drive.speed > 42 }];
}

export function finishGrandPrix(state) {
  if (state.phase !== "racing" || !grandPrixSnapshot(state).finishOpen) return [];
  state.phase = "finale";
  return [{ type: "finish", rank: grandPrixSnapshot(state).rank }];
}

export function grandPrixSnapshot(state) {
  const playerTotal = totalProgress(state);
  return {
    number: state.number,
    target: state.target,
    fuel: state.fuel,
    checkpoint: state.checkpoint,
    correction: state.correction,
    lap: state.lap,
    totalLaps: state.totalLaps,
    progress: state.progress,
    speed: Math.round(state.drive.speed),
    offroad: state.drive.offroad,
    finishOpen: state.lap > state.totalLaps && state.number === state.target && state.fuel === COURSE_STEPS.length,
    rank: 1 + state.racers.filter(racer => racer.totalProgress > playerTotal).length
  };
}

export function grandPrixRoadCenter(progress) {
  return Math.sin(progress / 118) * 0.54 + Math.sin(progress / 47) * 0.18;
}

export const GRAND_PRIX_GATE_POSITIONS = GATE_POSITIONS;
export const GRAND_PRIX_TRACK_LENGTH = TRACK_LENGTH;
