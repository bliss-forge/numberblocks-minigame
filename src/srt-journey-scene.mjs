import { characterAsset } from "./character-spec.mjs";
import {
  CAR_SHAPE_LABELS,
  RIDE_DOOR,
  SPLASH_MESSAGES,
  SRT_CARS,
  SRT_STATIONS,
  TRAIN_HEIGHT,
  TRAIN_WIDTH,
  rideAnnouncement,
  seatInfo,
  splashStep,
  targetSeatName,
  trainWalkable
} from "./srt-journey.mjs";
import {
  grandmaSvg,
  grandpaSvg,
  parkingCarSvg
} from "./safety-route-art.mjs";
import { ktxTrainSvg, trainDoorSvg } from "./srt-journey-art.mjs";

// The splash banner and the ride door both pair a drawn mark with real Korean
// text, so the mark and the words are separate spans the updater can refresh.
function markedText(document, markClass, textClass, mark, text) {
  const markNode = document.createElement("span");
  markNode.className = markClass;
  markNode.innerHTML = mark;
  markNode.setAttribute("aria-hidden", "true");
  const textNode = document.createElement("span");
  textNode.className = textClass;
  textNode.textContent = text;
  return [markNode, textNode];
}

function playerImage(document) {
  const image = document.createElement("img");
  image.className = "srt-player";
  image.src = `assets/characters/${characterAsset(1)}`;
  image.alt = "숫자 1 블록 친구";
  return image;
}

function missionText(state) {
  if (state.phase === "station") {
    return SPLASH_MESSAGES[splashStep(state)];
  }
  if (state.phase === "seat") {
    return `${targetSeatName(state)} 좌석을 찾아요!`;
  }
  if (state.phase === "ride") {
    return `${state.targetStation}역에 내려야 해요!`;
  }
  if (state.phase === "parking") {
    return `이 모양의 ${state.parking.targetPlate} 번호 차를 찾아보아요!`;
  }
  return "할아버지 할머니를 만났어요!";
}

function renderStationPhase(document, state, stage) {
  const splash = document.createElement("div");
  splash.className = "srt-station-splash";

  const facade = document.createElement("div");
  facade.className = "srt-splash-facade";
  const canopy = document.createElement("div");
  canopy.className = "srt-splash-canopy";
  const glass = document.createElement("div");
  glass.className = "srt-splash-glass";
  const sign = document.createElement("div");
  sign.className = "srt-splash-sign";
  sign.textContent = "수서역";
  const logo = document.createElement("div");
  logo.className = "srt-splash-logo";
  logo.textContent = "SRT";
  facade.append(canopy, glass, sign, logo);

  const banner = document.createElement("div");
  banner.className = "srt-splash-banner";
  banner.dataset.step = String(splashStep(state));
  banner.append(...markedText(
    document,
    "srt-splash-mark",
    "srt-splash-text",
    ktxTrainSvg(),
    SPLASH_MESSAGES[splashStep(state)]
  ));

  splash.append(facade, banner);
  stage.append(splash);
  return null;
}

// 승차권. "1호차 2C"를 글로만 주면 글 못 읽는 아이는 80석을 찍어 볼 수밖에
// 없었다(심층 검토 P1-11). 호차는 아이가 이미 아는 넘버블록 친구로 보여 주고,
// 자리 번호는 좌석에 적힌 것과 똑같이 크게 적어 눈으로 맞추게 한다.
function seatTicket(document, target) {
  const ticket = document.createElement("div");
  ticket.className = "srt-ticket";
  ticket.dataset.car = String(target.car);
  ticket.dataset.seat = `${target.row}${target.letter}`;
  ticket.setAttribute(
    "aria-label",
    `내 자리는 ${target.car}호차 ${target.row}${target.letter}`
  );

  const head = document.createElement("div");
  head.className = "srt-ticket-head";
  head.textContent = "내 자리";

  const car = document.createElement("div");
  car.className = "srt-ticket-car";
  const friend = document.createElement("img");
  friend.className = "srt-ticket-friend";
  friend.src = `assets/characters/${characterAsset(target.car)}`;
  friend.alt = `숫자 ${target.car} 블록 친구`;
  const carLabel = document.createElement("span");
  carLabel.className = "srt-ticket-car-label";
  carLabel.textContent = `${target.car}호차`;
  car.append(friend, carLabel);

  const seat = document.createElement("div");
  seat.className = "srt-ticket-seat";
  seat.textContent = `${target.row}${target.letter}`;

  ticket.append(head, car, seat);
  return ticket;
}

function renderSeatPhase(document, state, stage) {
  const world = document.createElement("div");
  world.className = "srt-train";
  world.style.setProperty("--srt-cols", TRAIN_WIDTH);
  world.style.setProperty("--srt-rows", TRAIN_HEIGHT);

  for (let car = 1; car <= SRT_CARS; car += 1) {
    const banner = document.createElement("div");
    banner.className = "srt-car-banner";
    banner.style.setProperty("--srt-x", 5 * (car - 1) + 2);
    if (car === state.target.car) {
      // 목표 호차에는 승차권과 같은 친구를 세워 둔다 — 글자 대신 얼굴로 찾는다.
      banner.dataset.target = "true";
      const friend = document.createElement("img");
      friend.className = "srt-car-friend";
      friend.src = `assets/characters/${characterAsset(car)}`;
      friend.alt = "";
      friend.setAttribute("aria-hidden", "true");
      const label = document.createElement("span");
      label.textContent = `${car}호차`;
      banner.append(friend, label);
    } else {
      banner.textContent = `${car}호차`;
    }
    world.append(banner);
  }

  for (let y = 0; y < TRAIN_HEIGHT; y += 1) {
    for (let x = 0; x < TRAIN_WIDTH; x += 1) {
      const cell = document.createElement("div");
      const seat = seatInfo(x, y);
      cell.className = seat
        ? "srt-cell srt-seat"
        : y === 2
          ? "srt-cell srt-corridor"
          : trainWalkable(x, y)
            ? "srt-cell"
            : "srt-cell srt-vestibule";
      cell.style.setProperty("--srt-x", x + 1);
      cell.style.setProperty("--srt-y", y + 1);
      if (seat) {
        cell.textContent = `${seat.row}${seat.letter}`;
        cell.dataset.seat = seat.name;
      }
      world.append(cell);
    }
  }
  stage.append(world);
  return world;
}

function renderRidePhase(document, state, stage) {
  const room = document.createElement("div");
  room.className = "srt-ride";
  room.dataset.moving = String(Boolean(state.ride.moving));

  const trainWindow = document.createElement("div");
  trainWindow.className = "srt-window";
  const scenery = document.createElement("div");
  scenery.className = "srt-scenery";
  scenery.setAttribute("aria-hidden", "true");
  const platform = document.createElement("div");
  platform.className = "srt-platform";
  platform.textContent =
    `${SRT_STATIONS[state.ride.stationIndex]}역`;
  trainWindow.append(scenery, platform);
  room.append(trainWindow);

  const stationStrip = document.createElement("div");
  stationStrip.className = "srt-station-strip";
  SRT_STATIONS.forEach((station, index) => {
    const stop = document.createElement("span");
    stop.className = "srt-station";
    stop.dataset.station = station;
    stop.textContent = `${station}`;
    if (index === state.ride.stationIndex) stop.dataset.current = "true";
    if (station === state.targetStation) stop.dataset.target = "true";
    stationStrip.append(stop);
  });
  room.append(stationStrip);

  const announcement = document.createElement("div");
  announcement.className = "srt-announcement";
  announcement.textContent = rideAnnouncement(state);
  room.append(announcement);

  const floor = document.createElement("div");
  floor.className = "srt-ride-floor";
  for (let y = 0; y <= 2; y += 1) {
    for (let x = 0; x <= 4; x += 1) {
      const cell = document.createElement("div");
      const isDoor = x === RIDE_DOOR.x && y === RIDE_DOOR.y;
      cell.className = isDoor ? "srt-cell srt-door" : "srt-cell";
      cell.style.setProperty("--srt-x", x + 1);
      cell.style.setProperty("--srt-y", y + 1);
      if (isDoor) {
        const open = Boolean(state.ride.doorOpen);
        cell.dataset.open = String(open);
        cell.append(...markedText(
          document,
          "srt-door-art",
          "srt-door-label",
          trainDoorSvg(open),
          open ? "열림" : ""
        ));
      }
      floor.append(cell);
    }
  }
  room.append(floor);
  stage.append(room);
  return floor;
}

function renderParkingPhase(document, state, stage) {
  const lot = document.createElement("div");
  lot.className = "srt-parking";

  const silhouette = document.createElement("div");
  silhouette.className = "srt-silhouette";
  const shadow = document.createElement("span");
  shadow.className = "srt-car-shadow";
  shadow.setAttribute("role", "img");
  shadow.setAttribute("aria-label", "찾아야 하는 차 그림자");
  shadow.innerHTML = parkingCarSvg(state.parking.targetShape, "");
  const hint = document.createElement("span");
  hint.className = "srt-silhouette-hint";
  hint.textContent =
    `이 모양의 ${state.parking.targetPlate} 번호 차를 찾아보아요`;
  silhouette.append(shadow, hint);
  lot.append(silhouette);

  const row = document.createElement("div");
  row.className = "srt-parking-row";
  state.parking.cars.forEach((car, index) => {
    const slot = document.createElement("div");
    slot.className = "srt-parking-slot";
    slot.style.setProperty("--srt-x", index + 1);
    const art = document.createElement("span");
    art.className = `srt-parked-car srt-shape-${car.shape}`;
    art.setAttribute("role", "img");
    art.setAttribute(
      "aria-label",
      `${CAR_SHAPE_LABELS[car.shape]} ${car.plate}`
    );
    art.innerHTML = parkingCarSvg(car.shape, car.plate);
    slot.append(art);
    row.append(slot);
  });
  lot.append(row);

  const walk = document.createElement("div");
  walk.className = "srt-parking-walk";
  lot.append(walk);
  stage.append(lot);
  return walk;
}

function renderDonePhase(document, state, stage) {
  const ending = document.createElement("div");
  ending.className = "srt-ending";

  const grandpa = document.createElement("span");
  grandpa.className = "srt-elder srt-grandpa";
  grandpa.setAttribute("role", "img");
  grandpa.setAttribute("aria-label", "할아버지 넘버블록");
  grandpa.innerHTML = grandpaSvg();

  const hero = playerImage(document);
  hero.className = "srt-player srt-ending-player";

  const grandma = document.createElement("span");
  grandma.className = "srt-elder srt-grandma";
  grandma.setAttribute("role", "img");
  grandma.setAttribute("aria-label", "할머니 넘버블록");
  grandma.innerHTML = grandmaSvg();

  const hearts = document.createElement("div");
  hearts.className = "srt-ending-hearts";
  hearts.textContent = "💛 💚 💙";
  hearts.setAttribute("aria-hidden", "true");

  ending.append(grandpa, hero, grandma);
  const wrap = document.createElement("div");
  wrap.className = "srt-ending-wrap";
  wrap.append(hearts, ending);
  stage.append(wrap);
  return null;
}

export function renderSrtJourney(document, state) {
  const root = document.createElement("div");
  root.className = "srt-journey";
  root.dataset.phase = state.phase;

  const mission = document.createElement("div");
  mission.className = "srt-mission";
  mission.textContent = missionText(state);
  root.append(mission);

  const stage = document.createElement("div");
  stage.className = "srt-stage";
  root.append(stage);
  // 승차권은 열차 위 빈 띠에 둔다 — 좌석 위에 얹으면 아이가 찾아야 할 자리를
  // 가린다(1280×720 브라우저 확인, 3A·4A가 덮였다).
  if (state.phase === "seat") root.append(seatTicket(document, state.target));

  let playerLayer = null;
  if (state.phase === "station") playerLayer = renderStationPhase(document, state, stage);
  else if (state.phase === "seat") playerLayer = renderSeatPhase(document, state, stage);
  else if (state.phase === "ride") playerLayer = renderRidePhase(document, state, stage);
  else if (state.phase === "parking") playerLayer = renderParkingPhase(document, state, stage);
  else if (state.phase === "done") playerLayer = renderDonePhase(document, state, stage);

  const pad = document.createElement("div");
  pad.className = "route-pad";
  pad.setAttribute("aria-label", "기차 여행 이동");
  for (const [direction, label, symbol] of [
    ["up", "위로 이동", "↑"],
    ["left", "왼쪽으로 이동", "←"],
    ["down", "아래로 이동", "↓"],
    ["right", "오른쪽으로 이동", "→"]
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.routeDirection = direction;
    button.setAttribute("aria-label", label);
    button.textContent = symbol;
    pad.append(button);
  }
  root.append(pad);

  const player = playerImage(document);
  player.style.setProperty("--srt-x", state.position.x + 1);
  player.style.setProperty("--srt-y", state.position.y + 1);
  if (playerLayer) playerLayer.append(player);

  root._srtView = { document, mission, stage, player, phase: state.phase };
  updateSrtJourney(root, state);
  return root;
}

export function updateSrtJourney(root, state) {
  const view = root?._srtView;
  if (!view) throw new TypeError("A rendered SRT journey is required");
  if (view.phase !== state.phase) {
    const rebuilt = renderSrtJourney(view.document, state);
    root.replaceChildren(...rebuilt.children);
    root.dataset.phase = state.phase;
    root._srtView = rebuilt._srtView;
    return root;
  }
  view.mission.textContent = missionText(state);
  view.player.style.setProperty("--srt-x", state.position.x + 1);
  view.player.style.setProperty("--srt-y", state.position.y + 1);
  if (state.phase === "station") {
    const banner = root.querySelector?.(".srt-splash-banner");
    if (banner) {
      banner.dataset.step = String(splashStep(state));
      const text = banner.querySelector?.(".srt-splash-text");
      if (text) text.textContent = SPLASH_MESSAGES[splashStep(state)];
    }
  }
  if (state.phase === "seat") {
    root.style.setProperty(
      "--srt-camera-x",
      Math.max(0, Math.min(state.position.x - 4, TRAIN_WIDTH - 9))
    );
  }
  if (state.phase === "ride") {
    const announcement = root.querySelector?.(".srt-announcement");
    if (announcement) announcement.textContent = rideAnnouncement(state);
    const room = root.querySelector?.(".srt-ride");
    if (room) room.dataset.moving = String(Boolean(state.ride.moving));
    const platform = root.querySelector?.(".srt-platform");
    if (platform) {
      platform.textContent = `${SRT_STATIONS[state.ride.stationIndex]}역`;
    }
    const door = root.querySelector?.(".srt-door");
    if (door) {
      const open = Boolean(state.ride.doorOpen);
      door.dataset.open = String(open);
      const art = door.querySelector?.(".srt-door-art");
      if (art) art.innerHTML = trainDoorSvg(open);
      const label = door.querySelector?.(".srt-door-label");
      if (label) label.textContent = open ? "열림" : "";
    }
    const stations = root.querySelectorAll?.(".srt-station") ?? [];
    stations.forEach((stop, index) => {
      if (index === state.ride.stationIndex) stop.dataset.current = "true";
      else delete stop.dataset.current;
    });
  }
  return root;
}
