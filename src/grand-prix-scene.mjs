import { GRAND_PRIX_GATE_POSITIONS, GRAND_PRIX_TRACK_LENGTH, grandPrixRoadCenter, grandPrixSnapshot } from "./grand-prix-model.mjs";

const COLORS = Object.freeze({ 1: "#ed5d73", 2: "#ef9a46", 3: "#65b875", 4: "#7754c8", 5: "#5aaed5" });
const GATE_LABELS = Object.freeze({ "plus-2": "+2", "plus-1": "+1", "plus-3": "+3", "plus-4": "+4" });

function node(document, tag, className, text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function gateFor(state) {
  const step = [
    { id: "plus-2", lane: -0.58, decoy: "plus-4", decoyLane: 0.58 },
    { id: "plus-1", lane: 0, decoy: "plus-3", decoyLane: 0.58 },
    { id: "plus-3", lane: 0.58, decoy: "plus-2", decoyLane: -0.58 }
  ][state.checkpoint];
  return step ?? null;
}

function canvasContext(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: rect.width, height: rect.height };
}

function roadPoint(state, width, height, depth) {
  const horizon = height * 0.27;
  const range = 570;
  const ratio = Math.max(0, Math.min(1, 1 - depth / range));
  const distance = state.progress + depth;
  const centerCurve = grandPrixRoadCenter(distance) - grandPrixRoadCenter(state.progress);
  const center = width * 0.5 + centerCurve * width * (0.2 + ratio * 0.17);
  const roadWidth = 28 + Math.pow(ratio, 1.55) * width * 0.44;
  return { depth, ratio, distance, x: center, y: horizon + ratio * (height - horizon), width: roadWidth };
}

function drawSky(context, width, height, backdrop) {
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#8cd8f5");
  gradient.addColorStop(0.55, "#c7ecf3");
  gradient.addColorStop(1, "#b9df80");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  if (backdrop?.complete && backdrop.naturalWidth) {
    context.globalAlpha = 0.62;
    context.drawImage(backdrop, 0, 0, width, height);
    context.globalAlpha = 1;
  }
}

function drawRoad(context, state, width, height) {
  const slices = [];
  for (let depth = 570; depth >= 0; depth -= 8) slices.push(roadPoint(state, width, height, depth));
  context.beginPath();
  slices.forEach((slice, index) => {
    const x = slice.x - slice.width;
    if (index === 0) context.moveTo(x, slice.y);
    else context.lineTo(x, slice.y);
  });
  for (let index = slices.length - 1; index >= 0; index -= 1) {
    const slice = slices[index];
    context.lineTo(slice.x + slice.width, slice.y);
  }
  context.closePath();
  context.fillStyle = "#38495c";
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = "rgba(255,255,255,.75)";
  context.stroke();
  for (let depth = 0; depth < 570; depth += 36) {
    const pulse = (state.progress * 2.1 + depth) % 126;
    const from = roadPoint(state, width, height, pulse);
    const to = roadPoint(state, width, height, Math.min(570, pulse + 10));
    context.fillStyle = "#fff5c7";
    context.beginPath();
    context.moveTo(from.x - from.width * 0.055, from.y);
    context.lineTo(from.x + from.width * 0.055, from.y);
    context.lineTo(to.x + to.width * 0.02, to.y);
    context.lineTo(to.x - to.width * 0.02, to.y);
    context.closePath();
    context.fill();
  }
  [0, 1].forEach(side => {
    const sign = side ? 1 : -1;
    for (let depth = 30; depth < 570; depth += 45) {
      const point = roadPoint(state, width, height, depth);
      const size = 2 + point.ratio * 7;
      context.fillStyle = depth % 90 === 30 ? "#f8dd62" : "#ffffff";
      context.fillRect(point.x + sign * (point.width + size * 0.4) - size / 2, point.y - size, size, size * 1.8);
    }
  });
}

function roadPosition(state, width, height, distance, lane) {
  const depth = distance - state.progress;
  if (depth < -18 || depth > 570) return null;
  const point = roadPoint(state, width, height, depth);
  return { x: point.x + lane * point.width * 0.64, y: point.y, scale: 0.28 + point.ratio * 0.9, point };
}

function drawGate(context, state, width, height, distance, lane, label, correct) {
  const position = roadPosition(state, width, height, distance, lane);
  if (!position) return;
  const size = 26 * position.scale;
  context.save();
  context.translate(position.x, position.y - size * 2.1);
  context.fillStyle = correct ? "#45ae7c" : "#e47458";
  context.strokeStyle = "#fffdf0";
  context.lineWidth = Math.max(2, size * 0.12);
  context.beginPath();
  context.roundRect(-size, -size * 1.2, size * 2, size * 1.65, size * 0.25);
  context.fill();
  context.stroke();
  context.fillStyle = "#fff";
  context.font = `900 ${Math.max(11, size * 0.78)}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 0, -size * 0.37);
  context.restore();
}

function drawRamp(context, state, width, height) {
  const position = roadPosition(state, width, height, state.jumpAt, 0);
  if (!position) return;
  const size = 31 * position.scale;
  context.save();
  context.translate(position.x, position.y - size * 0.25);
  context.fillStyle = "#f4d25a";
  context.strokeStyle = "#fff7c4";
  context.lineWidth = Math.max(2, size * 0.13);
  context.beginPath();
  context.moveTo(-size, size * 0.35);
  context.lineTo(size, size * 0.35);
  context.lineTo(size * 0.66, -size * 0.46);
  context.lineTo(-size * 0.66, -size * 0.46);
  context.closePath();
  context.fill();
  context.stroke();
  context.strokeStyle = "#5276aa";
  context.lineWidth = Math.max(1, size * 0.16);
  context.beginPath();
  context.moveTo(-size * 0.52, size * 0.14);
  context.lineTo(-size * 0.15, -size * 0.32);
  context.moveTo(0, size * 0.14);
  context.lineTo(size * 0.37, -size * 0.32);
  context.stroke();
  context.restore();
}

function drawKart(context, x, y, scale, number, lean = 0, airborne = 0) {
  const body = COLORS[number] ?? "#7754c8";
  const size = 31 * scale;
  context.save();
  context.translate(x, y - airborne * scale);
  context.rotate(lean * 0.09);
  context.fillStyle = "rgba(22,40,64,.24)";
  context.beginPath();
  context.ellipse(0, size * 0.64, size * 0.95, size * 0.25, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#253a52";
  [-0.72, 0.72].forEach(side => {
    context.beginPath();
    context.roundRect(side * size * 0.78 - size * 0.27, size * 0.16, size * 0.54, size * 0.74, size * 0.16);
    context.fill();
  });
  context.fillStyle = body;
  context.strokeStyle = "#263a55";
  context.lineWidth = Math.max(2, size * 0.12);
  context.beginPath();
  context.roundRect(-size, -size * 0.64, size * 2, size * 1.46, size * 0.34);
  context.fill();
  context.stroke();
  context.fillStyle = "rgba(255,255,255,.68)";
  context.beginPath();
  context.roundRect(-size * 0.54, -size * 0.46, size * 1.08, size * 0.52, size * 0.2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = `900 ${Math.max(10, size * 0.72)}px Arial`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(number), 0, size * 0.31);
  context.restore();
}

function drawWorld(canvas, state) {
  const { context, width, height } = canvasContext(canvas);
  const backdrop = canvas._gpBackdrop;
  drawSky(context, width, height, backdrop);
  drawRoad(context, state, width, height);
  const step = gateFor(state);
  if (step && state.lap === 1) {
    const gateDistance = GRAND_PRIX_GATE_POSITIONS[state.checkpoint];
    drawGate(context, state, width, height, gateDistance, step.lane, GATE_LABELS[step.id], true);
    drawGate(context, state, width, height, gateDistance, step.decoyLane, GATE_LABELS[step.decoy], false);
  }
  if (state.correction > 0 && state.correctionAt !== null) {
    drawGate(context, state, width, height, state.correctionAt, 0, `+${state.correction}`, true);
  }
  if (state.lap === 1) drawRamp(context, state, width, height);
  const playerTotal = (state.lap - 1) * GRAND_PRIX_TRACK_LENGTH + state.progress;
  state.racers.forEach(racer => {
    const depth = racer.totalProgress - playerTotal;
    const position = roadPosition(state, width, height, state.progress + depth, racer.lane);
    if (position) drawKart(context, position.x, position.y - 4, position.scale, racer.number, 0);
  });
  const playerRoad = roadPoint(state, width, height, 22);
  const playerX = playerRoad.x + state.drive.lateral * playerRoad.width * 0.64;
  drawKart(context, playerX, height * 0.81, 1.2, 4, state.drive.heading, state.drive.airborneMs > 0 ? 17 : 0);
  if (state.drive.offroad) {
    context.fillStyle = "rgba(133,92,47,.36)";
    context.fillRect(0, height * 0.75, width, height * 0.25);
  }
}

function buildHud(document) {
  const hud = node(document, "header", "gp-race-hud");
  const title = node(document, "div", "gp-title");
  title.append(node(document, "small", "gp-kicker", "NUMBERBLOCKS"), node(document, "strong", "gp-name", "GRAND PRIX"));
  const status = node(document, "div", "gp-status");
  status.append(node(document, "span", "gp-lap", "LAP 1 / 2"), node(document, "span", "gp-speed", "0 km/h"), node(document, "span", "gp-rank", "5th"));
  const route = node(document, "div", "gp-route");
  route.append(node(document, "span", "gp-route-label", "STAR RUN"), node(document, "i", "gp-route-fill"));
  hud.append(title, route, status);
  return hud;
}

export function renderGrandPrixScene(document, state) {
  const root = node(document, "section", "gp-game gp-driving-race");
  root.tabIndex = -1;
  const canvas = node(document, "canvas", "gp-race-canvas");
  canvas.setAttribute("aria-label", "Numberblocks kart racing course");
  const backdrop = new Image();
  backdrop.src = "assets/grand-prix/canyon-backdrop.png";
  backdrop.addEventListener("load", () => { canvas._gpBackdrop = backdrop; });
  canvas._gpBackdrop = backdrop;
  const countdown = node(document, "div", "gp-countdown");
  countdown.hidden = true;
  const finish = node(document, "div", "gp-finish");
  finish.hidden = true;
  const controls = node(document, "footer", "gp-controls");
  const left = node(document, "button", "gp-key", "◀");
  left.type = "button";
  left.dataset.gpHold = "left";
  const go = node(document, "button", "gp-key gp-go-key", "GO");
  go.type = "button";
  go.dataset.gpToggle = "throttle";
  const right = node(document, "button", "gp-key", "▶");
  right.type = "button";
  right.dataset.gpHold = "right";
  const jump = node(document, "button", "gp-key gp-jump-key", "JUMP");
  jump.type = "button";
  jump.dataset.gpJump = "true";
  controls.append(left, go, right, jump, node(document, "span", "gp-tip", "TAP GO • STEER • JUMP"));
  root.append(canvas, buildHud(document), countdown, controls, finish);
  updateGrandPrixScene(root, state);
  return root;
}

export function updateGrandPrixScene(root, state) {
  const snapshot = grandPrixSnapshot(state);
  root.dataset.phase = state.phase;
  root.dataset.offroad = String(snapshot.offroad);
  root.dataset.boost = String(state.drive.boostMs > 0);
  root.querySelector(".gp-lap").textContent = `LAP ${Math.min(state.lap, state.totalLaps)} / ${state.totalLaps}`;
  root.querySelector(".gp-speed").textContent = `${snapshot.speed} km/h`;
  root.querySelector(".gp-rank").textContent = `${snapshot.rank}${snapshot.rank === 1 ? "st" : snapshot.rank === 2 ? "nd" : snapshot.rank === 3 ? "rd" : "th"}`;
  root.querySelector(".gp-route-fill").style.width = `${Math.max(2, Math.min(100, (((state.lap - 1) * GRAND_PRIX_TRACK_LENGTH + state.progress) / (state.totalLaps * GRAND_PRIX_TRACK_LENGTH)) * 100))}%`;
  const countdown = root.querySelector(".gp-countdown");
  const count = Math.ceil(state.countdownMs / 600);
  countdown.hidden = count <= 0 || state.phase !== "racing";
  countdown.textContent = count > 0 ? String(count) : "";
  const finish = root.querySelector(".gp-finish");
  finish.hidden = state.phase !== "finale";
  finish.textContent = state.phase === "finale" ? `${snapshot.rank}${snapshot.rank === 1 ? "st" : snapshot.rank === 2 ? "nd" : snapshot.rank === 3 ? "rd" : "th"} PLACE • STAR CASTLE!` : "";
  root.querySelector(".gp-controls").hidden = state.phase === "finale";
  drawWorld(root.querySelector(".gp-race-canvas"), state);
}
