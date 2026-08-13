import assert from "node:assert/strict";
import test from "node:test";
import {
  GRAND_PRIX_COURSE,
  createGrandPrix,
  finishGrandPrix,
  grandPrixSnapshot,
  setGrandPrixThrottle,
  startGrandPrix,
  steerGrandPrix,
  tickGrandPrix
} from "../src/grand-prix-model.mjs";

test("seeded circuit uses stable rivals and two laps", () => {
  const first = createGrandPrix("easy", 42);
  const second = createGrandPrix("easy", 42);
  assert.equal(first.course, GRAND_PRIX_COURSE);
  assert.deepEqual(first.racers, second.racers);
  assert.equal(first.totalLaps, 2);
  assert.equal(first.drive.throttle, false);
});

test("starting race has a countdown before the karts move", () => {
  const state = createGrandPrix("easy", 2);
  startGrandPrix(state);
  setGrandPrixThrottle(state, true);
  for (let index = 0; index < 20; index += 1) tickGrandPrix(state, 50);
  assert.equal(state.countdownMs, 800);
  assert.equal(state.progress, 0);
  for (let index = 0; index < 16; index += 1) tickGrandPrix(state, 50);
  assert.equal(state.countdownMs, 0);
  for (let index = 0; index < 20; index += 1) tickGrandPrix(state, 50);
  assert.ok(state.progress > 0);
  assert.ok(state.drive.speed > 0);
});

test("steering changes a moving kart's lane and leaving road triggers drag", () => {
  const state = createGrandPrix("easy", 3);
  startGrandPrix(state);
  state.countdownMs = 0;
  setGrandPrixThrottle(state, true);
  steerGrandPrix(state, "right", true);
  for (let index = 0; index < 40; index += 1) tickGrandPrix(state, 50);
  assert.ok(state.drive.lateral > 0.2);
  steerGrandPrix(state, "right", true);
  for (let index = 0; index < 100; index += 1) tickGrandPrix(state, 50);
  assert.equal(state.drive.offroad, true);
  assert.ok(state.drive.speed < 74);
});

test("driving through the correct lane collects the first number booster", () => {
  const state = createGrandPrix("easy", 4);
  startGrandPrix(state);
  state.countdownMs = 0;
  state.progress = 244.99;
  state.drive.lateral = -0.58;
  setGrandPrixThrottle(state, true);
  tickGrandPrix(state, 50);
  assert.equal(state.number, 6);
  assert.equal(state.fuel, 1);
  assert.equal(state.checkpoint, 1);
  assert.ok(state.drive.boostMs > 0);
});

test("wrong lane creates a correction route rather than silently advancing", () => {
  const state = createGrandPrix("easy", 5);
  startGrandPrix(state);
  state.countdownMs = 0;
  state.progress = 244.99;
  state.drive.lateral = 0.58;
  setGrandPrixThrottle(state, true);
  tickGrandPrix(state, 50);
  assert.equal(state.number, 4);
  assert.equal(state.checkpoint, 0);
  assert.equal(state.correction, 2);
  assert.ok(state.correctionAt > state.progress);
});

test("two-lap route with all boosters opens ranked Star Castle finish", () => {
  const state = createGrandPrix("easy", 6);
  startGrandPrix(state);
  state.countdownMs = 0;
  state.lap = 3;
  state.checkpoint = 3;
  state.number = 10;
  state.fuel = 3;
  const snapshot = grandPrixSnapshot(state);
  assert.equal(snapshot.finishOpen, true);
  assert.deepEqual(finishGrandPrix(state).map(event => event.type), ["finish"]);
  assert.equal(state.phase, "finale");
});


test("three correctly steered gates advance in one physical first lap", () => {
  const state = createGrandPrix("easy", 7);
  startGrandPrix(state);
  state.countdownMs = 0;
  setGrandPrixThrottle(state, true);
  state.progress = 244.99;
  state.drive.lateral = -0.58;
  tickGrandPrix(state, 50);
  assert.equal(state.checkpoint, 1);
  assert.equal(state.gateLatched, false);
  state.progress = 504.99;
  state.drive.lateral = 0;
  tickGrandPrix(state, 50);
  assert.equal(state.checkpoint, 2);
  state.progress = 759.99;
  state.drive.lateral = 0.58;
  tickGrandPrix(state, 50);
  assert.equal(state.checkpoint, 3);
  assert.equal(state.number, 10);
});
