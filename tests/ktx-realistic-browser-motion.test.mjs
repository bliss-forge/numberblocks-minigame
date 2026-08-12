import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".png": "image/png",
  ".webp": "image/webp"
};

function loadChromium() {
  try {
    const globalModules = execFileSync("npm", ["root", "-g"], {
      encoding: "utf8"
    }).trim();
    return require(resolve(globalModules, "playwright")).chromium;
  } catch {
    return null;
  }
}

async function startStaticServer() {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (file !== root && !file.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "content-type": contentTypes[extname(file)] ?? "application/octet-stream"
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolveServer => server.listen(0, "127.0.0.1", resolveServer));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("실제 CSSOM에서 SRT 풍경·운전실 선로·차체 문이 상태에 따라 움직인다", async t => {
  const chromium = loadChromium();
  if (!chromium) {
    t.skip("Playwright is not installed globally");
    return;
  }

  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  t.after(async () => {
    await browser.close();
    await new Promise(resolveServer => server.close(resolveServer));
  });

  const page = await browser.newPage({ viewport: { width: 1228, height: 620 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    const journey = await import("/src/ktx-journey.mjs");
    const scene = await import("/src/ktx-scene.mjs");
    const base = journey.createKtxJourney(17, "srt");
    const makeState = (x, extra = {}) => ({
      ...base,
      phase: "driving",
      doors: "closed",
      segIndex: 0,
      station: "수서",
      x,
      v: 240,
      zoneEntered: false,
      armed: false,
      ...extra
    });
    const game = scene.renderKtxScene(document, makeState(200), "side");
    document.body.replaceChildren(game);
    window.__motionQa = { game, scene, makeState };
  });
  await page.locator('.ktx-game[data-motion-realistic="ready"]').waitFor();

  const values = await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(200), "side", [], {});
    const motion = game.querySelector(".ktx-motion-scene");
    const plate = motion.querySelector('.ktx-motion-plate[data-active="true"]');
    const before = {
      far: Number.parseFloat(plate.style.getPropertyValue("--motion-plate-x")),
      mid: Number.parseFloat(motion.style.getPropertyValue("--motion-mid-phase-x")),
      near: Number.parseFloat(motion.style.getPropertyValue("--motion-near-phase-x")),
      plateTransform: getComputedStyle(plate).transform
    };
    scene.updateKtxScene(game, makeState(700), "side", [], {});
    return {
      before,
      after: {
        far: Number.parseFloat(plate.style.getPropertyValue("--motion-plate-x")),
        mid: Number.parseFloat(motion.style.getPropertyValue("--motion-mid-phase-x")),
        near: Number.parseFloat(motion.style.getPropertyValue("--motion-near-phase-x")),
        plateTransform: getComputedStyle(plate).transform
      }
    };
  });

  assert.ok(values.after.far < values.before.far);
  assert.notEqual(values.after.mid, values.before.mid);
  assert.notEqual(values.after.near, values.before.near);
  assert.ok(Math.abs(values.after.near - values.before.near) >
    Math.abs(values.after.far - values.before.far));
  assert.notEqual(values.after.plateTransform, "none");

  await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(200), "cab", [], {});
  });
  await page.waitForTimeout(280);
  const cabParallaxBefore = await page.evaluate(() => {
    const motion = window.__motionQa.game.querySelector(".ktx-motion-scene");
    return {
      transform: getComputedStyle(motion.querySelector(".ktx-motion-cab-base")).transform,
      scale: Number.parseFloat(motion.style.getPropertyValue("--cab-base-scale")),
      sleepers: motion.style.getPropertyValue("--cab-sleeper-phase"),
      poles: motion.style.getPropertyValue("--cab-pole-phase")
    };
  });
  await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(700), "cab", [], {});
  });
  await page.waitForTimeout(280);
  const cabParallaxAfter = await page.evaluate(() => {
    const motion = window.__motionQa.game.querySelector(".ktx-motion-scene");
    return {
      transform: getComputedStyle(motion.querySelector(".ktx-motion-cab-base")).transform,
      scale: Number.parseFloat(motion.style.getPropertyValue("--cab-base-scale")),
      sleepers: motion.style.getPropertyValue("--cab-sleeper-phase"),
      poles: motion.style.getPropertyValue("--cab-pole-phase")
    };
  });
  assert.notEqual(cabParallaxBefore.transform, cabParallaxAfter.transform,
    "the photographic cab track must advance with journey distance");
  assert.ok(cabParallaxAfter.scale > cabParallaxBefore.scale,
    "the forward photograph must move toward the driver without reversing");
  assert.notEqual(cabParallaxBefore.sleepers, cabParallaxAfter.sleepers);
  assert.notEqual(cabParallaxBefore.poles, cabParallaxAfter.poles);
  const cabBoundary = await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(1199), "cab", [], {});
    const motion = game.querySelector(".ktx-motion-scene");
    const before = Number.parseFloat(motion.style.getPropertyValue("--cab-base-scale"));
    scene.updateKtxScene(game, makeState(1200), "cab", [], {});
    return {
      before,
      after: Number.parseFloat(motion.style.getPropertyValue("--cab-base-scale")),
      doorDisplay: getComputedStyle(game.querySelector(".ktx-motion-door")).display
    };
  });
  assert.ok(cabBoundary.after >= cabBoundary.before &&
    Math.abs(cabBoundary.after - cabBoundary.before) < .001,
    "the photographic cab track must not rewind at plate boundaries");
  assert.equal(cabBoundary.doorDisplay, "none",
    "the exterior carriage door must never render over the cockpit");

  const cab = await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(760), "cab", [], {});
    const windowBox = game.querySelector(".ktx-motion-cab-window").getBoundingClientRect();
    const groundBox = game.querySelector(".ktx-motion-cab-ground").getBoundingClientRect();
    const railBox = game.querySelector(".ktx-motion-cab-rail-left").getBoundingClientRect();
    return {
      windowHeight: windowBox.height,
      groundHeight: groundBox.height,
      groundTop: groundBox.top,
      windowTop: windowBox.top,
      railHeight: railBox.height
    };
  });
  assert.ok(cab.windowHeight > 0);
  assert.ok(cab.groundHeight > 0);
  assert.ok(cab.groundTop > cab.windowTop);
  assert.ok(cab.groundTop - cab.windowTop < cab.windowHeight * .27,
    "the track bed must begin inside the visible upper windshield");
  assert.ok(cab.railHeight > 0);

  const closed = await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(0, {
      phase: "stopped", doors: "closed"
    }), "side", [], {});
    const doorBox = game.querySelector(".ktx-motion-door").getBoundingClientRect();
    const sceneBox = game.querySelector(".ktx-motion-scene").getBoundingClientRect();
    return {
      left: getComputedStyle(game.querySelector(".ktx-motion-door-leaf-left")).transform,
      right: getComputedStyle(game.querySelector(".ktx-motion-door-leaf-right")).transform,
      doorHeight: doorBox.height,
      doorTop: doorBox.top - sceneBox.top,
      sceneHeight: sceneBox.height
    };
  });
  assert.ok(closed.doorHeight >= 22 && closed.doorHeight <= 52,
    "the animated door must remain the size of an actual carriage door");
  assert.ok(closed.doorTop > closed.sceneHeight * .48 &&
    closed.doorTop < closed.sceneHeight * .68,
  "the animated door must sit on the visible carriage body");
  await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    scene.updateKtxScene(game, makeState(0, {
      phase: "stopped", doors: "open"
    }), "side", [], {});
  });
  await page.waitForTimeout(700);
  const open = await page.evaluate(() => {
    const game = window.__motionQa.game;
    return {
      left: getComputedStyle(game.querySelector(".ktx-motion-door-leaf-left")).transform,
      right: getComputedStyle(game.querySelector(".ktx-motion-door-leaf-right")).transform
    };
  });
  assert.notEqual(open.left, closed.left);
  assert.notEqual(open.right, closed.right);
  assert.match(open.left, /matrix/);
  assert.match(open.right, /matrix/);

  const brakeAlignment = await page.evaluate(() => {
    const { game, scene, makeState } = window.__motionQa;
    const measure = () => {
      const train = game.querySelector(".ktx-motion-train").getBoundingClientRect();
      const door = game.querySelector(".ktx-motion-door").getBoundingClientRect();
      return {
        x: (door.left + door.width / 2 - train.left) / train.width,
        y: (door.top + door.height / 2 - train.top) / train.height
      };
    };
    scene.updateKtxScene(game, makeState(0, {
      phase: "stopped", doors: "closed", v: 0
    }), "side", [], {});
    const stopped = measure();
    scene.updateKtxScene(game, makeState(2000, {
      phase: "stopping", doors: "closed", v: 240
    }), "side", [], {});
    return { stopped, braking: measure() };
  });
  assert.ok(Math.abs(brakeAlignment.stopped.x - brakeAlignment.braking.x) < .002,
    "the door must remain attached to its carriage while the train pitches");
  assert.ok(Math.abs(brakeAlignment.stopped.y - brakeAlignment.braking.y) < .002,
    "the door must share the train transform origin while braking");
});
