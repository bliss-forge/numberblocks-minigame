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
const mobileCss = await readFile(resolve(root, "mobile-games.css"), "utf8");
const stylesCss = await readFile(resolve(root, "styles.css"), "utf8");
const contentTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
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

function observeErrors(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  return { consoleErrors, pageErrors };
}

test("홈 숫자키는 게임이나 난이도를 바꾸지 않고 버튼 선택은 계속 동작한다", async t => {
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

  for (const key of ["1", "7", "8", "9"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = observeErrors(page);
    await page.goto(url, { waitUntil: "networkidle" });
    const before = await page.locator(".difficulty-button.selected")
      .getAttribute("data-difficulty");

    await page.keyboard.press(key);

    assert.equal(await page.locator("body").getAttribute("data-state"), "home", key);
    assert.equal(
      await page.locator(".difficulty-button.selected")
        .getAttribute("data-difficulty"),
      before,
      key
    );
    assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] }, key);
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(url, { waitUntil: "networkidle" });
  assert.equal(await page.locator(".lead").count(), 0);
  assert.equal(await page.locator(".keyboard-note").count(), 0);
  assert.equal(await page.locator(".mode-card[aria-keyshortcuts]").count(), 0);
  assert.equal(await page.locator(".difficulty-button kbd").count(), 0);

  await page.locator('[data-difficulty="challenge"]').click();
  assert.equal(
    await page.locator(".difficulty-button.selected")
      .getAttribute("data-difficulty"),
    "challenge"
  );
  await page.locator('[data-mode="add"]').click();
  assert.equal(await page.locator("body").getAttribute("data-state"), "playing");
});

test("390×844 홈은 두 열과 넓은 마지막 홀수 카드로 잘림 없이 표시된다", async t => {
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

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = observeErrors(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator(".mode-grid").waitFor({ state: "visible" });

  const metrics = await page.evaluate(() => {
    const grid = document.querySelector(".mode-grid");
    const cards = [...document.querySelectorAll(".mode-card")];
    const rects = cards.map(card => card.getBoundingClientRect());
    return {
      columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      firstWidth: rects[0].width,
      seventhWidth: rects[6].width,
      firstSixWidths: rects.slice(0, 6).map(rect => rect.width),
      cardsInsideWidth: rects.every(
        rect => rect.left >= -0.5 && rect.right <= innerWidth + 0.5
      ),
      homeHeight: document.querySelector("#home").getBoundingClientRect().height,
      viewportHeight: innerHeight
    };
  });

  assert.equal(metrics.columns, 2);
  assert.equal(metrics.horizontalOverflow, false);
  assert.equal(metrics.cardsInsideWidth, true);
  // 카드 8장(짝수) — 넓은 홀수 마지막 카드 없이 모두 같은 폭의 2열이다
  assert.ok(Math.abs(metrics.seventhWidth - metrics.firstWidth) <= 1);
  assert.ok(
    metrics.firstSixWidths.every(
      width => Math.abs(width - metrics.firstWidth) <= 1
    )
  );
  assert.ok(metrics.homeHeight >= metrics.viewportHeight);
  const creditOverlap = await page.evaluate(() => {
    const home = document.querySelector("#home");
    home.scrollTop = home.scrollHeight;
    const credit = document.querySelector(".creator-credit").getBoundingClientRect();
    return [...document.querySelectorAll(".mode-card")]
      .map(card => card.getBoundingClientRect())
      .some(card => !(
        card.right <= credit.left ||
        credit.right <= card.left ||
        card.bottom <= credit.top ||
        credit.bottom <= card.top
      ));
  });
  assert.equal(creditOverlap, false);
  assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
});

test("PC 홈은 짧은 카드 다섯 열로 1~10 자리를 준비한다", async t => {
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

  for (const viewport of [
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 }
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = observeErrors(page);
    await page.goto(url, { waitUntil: "networkidle" });
    const metrics = await page.evaluate(() => {
      const grid = document.querySelector(".mode-grid");
      const cards = [...document.querySelectorAll(".mode-card")]
        .map(card => {
          const rect = card.getBoundingClientRect();
          return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            height: rect.height,
            layoutTop: card.offsetTop
          };
        });
      const firstTop = cards[0].layoutTop;
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        columns: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        verticalOverflow: document.documentElement.scrollHeight > innerHeight + 1,
        maximumCardHeight: Math.max(...cards.map(card => card.height)),
        firstRowCount: cards.filter(
          card => Math.abs(card.layoutTop - firstTop) <= 2
        ).length,
        secondRowTop: cards[5].layoutTop,
        firstRowTop: firstTop,
        cards
      };
    });

    assert.equal(metrics.columns, 5, `${viewport.width} columns`);
    assert.equal(metrics.horizontalOverflow, false, `${viewport.width} horizontal`);
    assert.equal(metrics.verticalOverflow, false, `${viewport.width} vertical`);
    assert.equal(metrics.firstRowCount, 5, `${viewport.width} first row`);
    assert.ok(metrics.secondRowTop > metrics.firstRowTop, `${viewport.width} row two`);
    assert.ok(
      metrics.maximumCardHeight <= metrics.viewportHeight * 0.34,
      `${viewport.width} card height ${metrics.maximumCardHeight}`
    );
    assert.ok(
      metrics.cards.every(card =>
        card.left >= -0.5 && card.right <= metrics.viewportWidth + 0.5
      ),
      `${viewport.width} contained`
    );
    assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
    await page.close();
  }
});

test("390×844 수학 게임은 무대와 큰 숫자판을 한 화면에 유지한다", async t => {
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

  for (const mode of ["count", "add", "sub", "mul"]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = observeErrors(page);
    await page.goto(url, { waitUntil: "networkidle" });
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator(".number-pad").waitFor({ state: "visible" });

    const metrics = await page.evaluate(() => {
      const rectangle = selector => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      };
      const buttonRects = [...document.querySelectorAll(".number-pad button")]
        .map(button => button.getBoundingClientRect());
      const firstDigit = document.querySelector('[data-digit="1"]')
        .getBoundingClientRect();
      const zero = document.querySelector('[data-digit="0"]')
        .getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        game: rectangle("#game"),
        problem: rectangle(".problem-pill"),
        stage: rectangle(".stage-frame"),
        answer: rectangle(".answer-dock"),
        pad: rectangle(".number-pad"),
        columnCount: getComputedStyle(document.querySelector(".number-pad"))
          .gridTemplateColumns.split(" ").length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        minimumButtonWidth: Math.min(...buttonRects.map(rect => rect.width)),
        minimumButtonHeight: Math.min(...buttonRects.map(rect => rect.height)),
        zeroRatio: zero.width / firstDigit.width
      };
    });

    const contained = rect =>
      rect.left >= -0.5 &&
      rect.right <= metrics.viewport.width + 0.5 &&
      rect.top >= -0.5 &&
      rect.bottom <= metrics.viewport.height + 0.5;

    assert.equal(metrics.columnCount, 3, mode);
    assert.equal(metrics.horizontalOverflow, false, mode);
    assert.ok(contained(metrics.game), `${mode} game`);
    assert.ok(contained(metrics.problem), `${mode} problem`);
    assert.ok(contained(metrics.stage), `${mode} stage`);
    assert.ok(contained(metrics.answer), `${mode} answer`);
    assert.ok(contained(metrics.pad), `${mode} pad`);
    assert.ok(metrics.problem.bottom <= metrics.stage.top + 0.5, `${mode} problem-stage`);
    assert.ok(metrics.stage.bottom <= metrics.answer.top + 0.5, `${mode} stage-answer`);
    assert.ok(metrics.answer.bottom <= metrics.pad.top + 0.5, `${mode} answer-pad`);
    assert.ok(metrics.minimumButtonWidth >= 48, `${mode} button width`);
    assert.ok(metrics.minimumButtonHeight >= 48, `${mode} button height`);
    assert.ok(metrics.zeroRatio >= 1.8, `${mode} zero key`);
    assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] }, mode);
    await page.close();
  }
});

test("390×844 길찾기는 지도 안에 안전한 엄지 방향키를 유지한다", async t => {
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

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = observeErrors(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-mode="safety"]').click();
  await page.locator(".safety-viewport").waitFor({ state: "visible" });

  const metrics = await page.evaluate(() => {
    const rectangle = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const buttonRects = [...document.querySelectorAll(".route-pad button")]
      .map(button => button.getBoundingClientRect());
    const padNode = document.querySelector(".route-pad");
    const pad = rectangle(".route-pad");
    const padStyle = getComputedStyle(padNode);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      game: rectangle("#game"),
      prompt: rectangle(".problem-pill"),
      route: rectangle(".safety-route"),
      routeTop: rectangle(".safety-route-top"),
      map: rectangle(".safety-viewport"),
      minimap: rectangle(".route-minimap"),
      pad,
      padBottom: padStyle.bottom,
      padRight: padStyle.right,
      rightMargin: innerWidth - pad.right,
      bottomMargin: innerHeight - pad.bottom,
      minimumButtonWidth: Math.min(...buttonRects.map(rect => rect.width)),
      minimumButtonHeight: Math.min(...buttonRects.map(rect => rect.height)),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth
    };
  });

  const contained = rect =>
    rect.left >= -0.5 &&
    rect.right <= metrics.viewport.width + 0.5 &&
    rect.top >= -0.5 &&
    rect.bottom <= metrics.viewport.height + 0.5;
  const overlaps = (first, second) => !(
    first.right <= second.left ||
    second.right <= first.left ||
    first.bottom <= second.top ||
    second.bottom <= first.top
  );

  assert.equal(metrics.horizontalOverflow, false);
  assert.ok(contained(metrics.game));
  assert.ok(contained(metrics.prompt));
  assert.ok(contained(metrics.route));
  assert.ok(contained(metrics.map));
  assert.ok(contained(metrics.pad));
  assert.ok(metrics.prompt.bottom <= metrics.route.top + 0.5);
  assert.ok(metrics.routeTop.bottom <= metrics.map.top + 0.5);
  assert.equal(overlaps(metrics.minimap, metrics.pad), false);
  assert.equal(metrics.padRight, "8px");
  assert.equal(metrics.padBottom, "8px");
  assert.ok(metrics.rightMargin >= 8);
  assert.ok(metrics.bottomMargin >= 8);
  assert.ok(metrics.minimumButtonWidth >= 48);
  assert.ok(metrics.minimumButtonHeight >= 48);
  assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
});

test("최소·대형 휴대전화에서도 1~5 조작 화면이 뷰포트에 들어온다", async t => {
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

  for (const viewport of [
    { width: 360, height: 640, target: 44 },
    { width: 430, height: 932, target: 48 }
  ]) {
    const home = await browser.newPage({ viewport });
    const homeErrors = observeErrors(home);
    await home.goto(url, { waitUntil: "networkidle" });
    const homeMetrics = await home.evaluate(() => {
      const cards = [...document.querySelectorAll(".mode-card")]
        .map(card => card.getBoundingClientRect());
      const credit = document.querySelector(".creator-credit").getBoundingClientRect();
      const overlapsCredit = cards.some(card => !(
        card.right <= credit.left ||
        credit.right <= card.left ||
        card.bottom <= credit.top ||
        credit.bottom <= card.top
      ));
      return {
        columns: getComputedStyle(document.querySelector(".mode-grid"))
          .gridTemplateColumns.split(" ").length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        cardsInsideWidth: cards.every(
          rect => rect.left >= -0.5 && rect.right <= innerWidth + 0.5
        ),
        overlapsCredit,
        firstWidth: cards[0].width,
        seventhWidth: cards[6].width,
        firstSixWidths: cards.slice(0, 6).map(card => card.width)
      };
    });
    assert.equal(homeMetrics.columns, 2, `${viewport.width} home columns`);
    assert.equal(homeMetrics.horizontalOverflow, false, `${viewport.width} home overflow`);
    assert.equal(homeMetrics.cardsInsideWidth, true, `${viewport.width} home cards`);
    assert.equal(homeMetrics.overlapsCredit, false, `${viewport.width} home credit`);
    // 카드 8장(짝수) — 마지막 행도 2열 균등 폭
    assert.ok(
      Math.abs(homeMetrics.seventhWidth - homeMetrics.firstWidth) <= 1,
      `${viewport.width} seventh card`
    );
    assert.ok(
      homeMetrics.firstSixWidths.every(
        width => Math.abs(width - homeMetrics.firstWidth) <= 1
      ),
      `${viewport.width} first six cards`
    );
    assert.deepEqual(homeErrors, { consoleErrors: [], pageErrors: [] });
    await home.close();

    for (const mode of ["count", "add", "sub", "mul", "safety"]) {
      const page = await browser.newPage({ viewport });
      const errors = observeErrors(page);
      await page.goto(url, { waitUntil: "networkidle" });
      await page.locator(`[data-mode="${mode}"]`).click();
      const controlSelector = mode === "safety" ? ".route-pad" : ".number-pad";
      await page.locator(controlSelector).waitFor({ state: "visible" });

      const metrics = await page.evaluate(({ modeName, targetSize }) => {
        const controls = [
          ...document.querySelectorAll(
            modeName === "safety" ? ".route-pad button" : ".number-pad button"
          )
        ].map(button => button.getBoundingClientRect());
        const required = modeName === "safety"
          ? ["#game", ".problem-pill", ".safety-route", ".route-pad"]
          : ["#game", ".problem-pill", ".stage-frame", ".answer-dock", ".number-pad"];
        const rectangles = required.map(selector => {
          const rect = document.querySelector(selector).getBoundingClientRect();
          return { selector, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        });
        const countCharacter = modeName === "count"
          ? document.querySelector(".count-character")?.getBoundingClientRect()
          : null;
        const countStage = modeName === "count"
          ? document.querySelector(".stage-frame")?.getBoundingClientRect()
          : null;
        return {
          targetSize,
          rectangles,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
          minimumWidth: Math.min(...controls.map(rect => rect.width)),
          minimumHeight: Math.min(...controls.map(rect => rect.height)),
          countCharacterContained: !countCharacter || !countStage || (
            countCharacter.left >= countStage.left - 0.5 &&
            countCharacter.right <= countStage.right + 0.5 &&
            countCharacter.top >= countStage.top - 0.5 &&
            countCharacter.bottom <= countStage.bottom + 0.5
          ),
          allContained: rectangles.every(rect =>
            rect.left >= -0.5 &&
            rect.right <= innerWidth + 0.5 &&
            rect.top >= -0.5 &&
            rect.bottom <= innerHeight + 0.5
          )
        };
      }, { modeName: mode, targetSize: viewport.target });

      assert.equal(metrics.horizontalOverflow, false, `${viewport.width} ${mode} overflow`);
      assert.equal(metrics.allContained, true, `${viewport.width} ${mode} contained`);
      assert.ok(metrics.minimumWidth >= viewport.target, `${viewport.width} ${mode} width`);
      assert.ok(metrics.minimumHeight >= viewport.target, `${viewport.width} ${mode} height`);
      assert.equal(
        metrics.countCharacterContained,
        true,
        `${viewport.width} ${mode} character`
      );
      assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
      await page.close();
    }
  }
});

test("844×390 가로형은 기존의 큰 조작 버튼을 유지한다", async t => {
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

  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-mode="safety"]').click();
  await page.locator(".route-pad").waitFor({ state: "visible" });
  const sizes = await page.locator(".route-pad button").evaluateAll(buttons =>
    buttons.map(button => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    })
  );

  assert.ok(Math.min(...sizes.map(size => size.width)) >= 48);
  assert.ok(Math.min(...sizes.map(size => size.height)) >= 48);
});

test("가로 모바일에서 실사 기관사 화면은 조작부를 48px 이상 유지한다", () => {
  assert.match(mobileCss, /\.ktx-game \.ktx-lever[\s\S]*min-width:\s*48px/);
  assert.match(mobileCss, /\.ktx-game \.ktx-speedo[\s\S]*min-height:\s*48px/);
  assert.match(mobileCss, /\.ktx-game \.ktx-next-key[\s\S]*min-height:\s*48px/);
});

test("가로 모바일 실사 모션은 사진 세 장 상한과 저비용 페인트 계약을 가진다", () => {
  assert.match(stylesCss,
    /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-width:\s*900px\)\s*and\s*\(max-height:\s*500px\)[\s\S]*\.ktx-motion-plate\[data-crossfade="out"\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(stylesCss,
    /@media\s*\(orientation:\s*landscape\)[\s\S]*\.ktx-motion-near[^\{]*\.ktx-motion-track[^\{]*\.ktx-motion-tunnel-lights\s*\{[^}]*filter:\s*none/s);
  assert.match(stylesCss,
    /@media\s*\(orientation:\s*landscape\)[\s\S]*\.ktx-motion-plate[^\{]*\.ktx-motion-near[^\{]*\.ktx-motion-track[^\{]*\.ktx-motion-train[^\{]*\.ktx-motion-cab-frame\s*\{[^}]*will-change:\s*auto/s);
});

// 감사(2026-08-06): 화면 숫자판이 폭 640px 이하에서만 켜져 있어서 768×1024
// 태블릿에서는 키보드 없이 1~4번 게임을 한 문제도 풀 수 없었다.
// 폭 구간(641~1024)과 터치 포인터를 함께 보게 고쳤고, 여기서 실제로 눌러 확인한다.
test("768×1024 터치 태블릿에서 수학 게임 숫자판을 눌러 답을 넣을 수 있다", async t => {
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

  const page = await browser.newPage({
    viewport: { width: 768, height: 1024 },
    hasTouch: true
  });
  const errors = observeErrors(page);
  await page.goto(url, { waitUntil: "networkidle" });

  for (const mode of ["count", "add", "sub", "mul"]) {
    await page.locator(`[data-mode="${mode}"]`).click();
    await page.locator("#number-pad").waitFor({ state: "visible" });
    const pad = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll("#number-pad button")];
      return {
        display: getComputedStyle(document.querySelector("#number-pad")).display,
        visible: buttons.filter(button => {
          const rect = button.getBoundingClientRect();
          return rect.width >= 44 && rect.height >= 44 &&
            rect.right <= innerWidth + 0.5;
        }).length,
        total: buttons.length
      };
    });
    assert.equal(pad.display, "grid", mode);
    assert.equal(pad.visible, pad.total, `${mode} 버튼이 모두 44px 이상`);

    // 한 자리 답이면 누르는 즉시 채점되므로 "1"이 남아 있다고 단정할 수 없다 —
    // 탭이 앱에 도달했다는 사실(답 칸 변화·오답 표시·축하 전환)만 확인한다.
    await page.locator('#number-pad [data-digit="1"]').click();
    const registered = await page.evaluate(() => {
      const box = document.querySelector("#answer-box");
      return {
        text: box.textContent,
        wrong: box.className.includes("wrong"),
        state: document.body.dataset.state
      };
    });
    assert.ok(
      registered.text !== "?" || registered.wrong ||
        registered.state === "celebrating",
      `${mode} 숫자판 탭이 앱에 도달한다`
    );
    await page.keyboard.press("Escape");
  }

  assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
});

test("844×390 실사 기관사 화면은 창과 조작부를 클리핑 없이 유지한다", async t => {
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

  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  const errors = observeErrors(page);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator('[data-mode="ktx"]').click();
  await page.locator('.ktx-train-card[data-train-id="srt"]').click();
  await page.locator('.ktx-game[data-realistic="ready"]').waitFor();

  const metrics = await page.evaluate(() => {
    const rectangle = selector => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const stage = rectangle(".ktx-stage");
    const controls = [".ktx-lever", ".ktx-speedo", ".ktx-next-key"]
      .map(rectangle);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      game: rectangle(".ktx-game"),
      stage,
      window: rectangle(".ktx-real-cab-image"),
      controls,
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      allControlsInsideStage: controls.every(rect =>
        rect.left >= stage.left - 0.5 &&
        rect.right <= stage.right + 0.5 &&
        rect.top >= stage.top - 0.5 &&
        rect.bottom <= stage.bottom + 0.5
      )
    };
  });

  assert.equal(metrics.horizontalOverflow, false);
  assert.ok(metrics.game.bottom <= metrics.viewport.height + 0.5);
  assert.ok(metrics.stage.bottom <= metrics.viewport.height + 0.5);
  assert.ok(metrics.window.top >= metrics.stage.top - 0.5);
  assert.ok(metrics.window.bottom <= metrics.stage.bottom + 0.5);
  assert.equal(metrics.allControlsInsideStage, true);
  assert.ok(metrics.controls[0].width >= 48, "lever width");
  assert.ok(metrics.controls[1].height >= 48, "speedometer height");
  assert.ok(metrics.controls[2].height >= 48, "stop prompt height");
  assert.deepEqual(errors, { consoleErrors: [], pageErrors: [] });
});

test("1280×720 에서 세어야 할 블록이 프레임 안에 다 들어온다", async t => {
  // 심층 검토 P0-1: 그리드 행 트랙이 내용만큼 늘어나 캐릭터가 .stage-frame 아래로
  // 80~87px 잘렸다. 세는 게 이 게임의 전부라, 그림대로 센 아이가 오답을 맞았다.
  const chromium = loadChromium();
  if (!chromium) {
    t.skip("Playwright is not installed globally");
    return;
  }

  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const overflows = [];
    for (const difficulty of ["easy", "steady"]) {   // 도전에서는 1번 카드가 비활성이다
      for (let round = 0; round < 5; round += 1) {
        await page.goto(url, { waitUntil: "load" });
        await page.click(`[data-difficulty="${difficulty}"]`);
        await page.click('[data-mode="count"]');
        await page.waitForSelector(".count-character");
        await page.waitForTimeout(450);
        overflows.push(await page.evaluate(() => {
          const frame = document.querySelector(".stage-frame").getBoundingClientRect();
          const chars = [...document.querySelectorAll(".count-character")];
          return Math.round(Math.max(
            ...chars.map(node => node.getBoundingClientRect().bottom - frame.bottom)));
        }));
      }
    }
    const worst = Math.max(...overflows);
    assert.ok(worst <= 0,
      `블록 하단이 프레임을 ${worst}px 넘었다 — 세면 오답이 된다 (${overflows.join(",")})`);
  } finally {
    await browser.close();
    server.close();
  }
});
