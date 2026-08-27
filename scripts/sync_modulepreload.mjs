// index.html 의 modulepreload 목록을 실제 import 그래프와 맞춘다.
//
// 왜 필요한가(2026-08-28 라이브 측정): app.mjs 하나만 걸어 두면 브라우저는
// 부모를 파싱해야 자식 모듈을 발견한다. 그래프가 4단 깊이라 GitHub Pages
// 왕복(약 200ms)이 네 번 쌓여 마지막 모듈이 974ms에야 시작했고 DCL 이 1231ms
// 였다. 전부 미리 알려 주면 한 물결로 끝난다.
//
// 사용: node scripts/sync_modulepreload.mjs [--check]
// --check 는 고치지 않고 어긋났는지만 알려 준다(테스트가 이 모드를 쓴다).

import { readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = "src/app.mjs";
const START = "  <!-- modulepreload:start (scripts/sync_modulepreload.mjs) -->";
const END = "  <!-- modulepreload:end -->";

export async function moduleGraph(entry = ENTRY) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current)) continue;
    seen.add(current);
    const source = await readFile(resolve(root, current), "utf8");
    const dir = dirname(current);
    for (const match of source.matchAll(/from\s+"(\.[^"]+\.mjs)"/g)) {
      const next = relative(root, resolve(root, dir, match[1]));
      if (!seen.has(next)) queue.push(next);
    }
  }
  // 진입점은 <script type="module"> 이 이미 받아 온다 — 중복 힌트는 낭비다.
  seen.delete(entry);
  return [...seen].sort();
}

export function preloadBlock(modules) {
  return [
    START,
    ...modules.map(name => `  <link rel="modulepreload" href="${name}">`),
    END
  ].join("\n");
}

// 마커에는 정규식 특수문자(괄호·점)가 들어 있다 — 그대로 RegExp 에 넣으면
// 엉뚱한 것을 잡거나 아무것도 못 잡는다. 실제로 못 잡고도 "반영했다"고
// 출력하던 버그를 여기서 막는다(2026-08-28).
function escapeForRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listedModules(html) {
  const block = html.split(START)[1]?.split(END)[0];
  if (block === undefined) return null;
  return [...block.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
}

async function main() {
  const check = process.argv.includes("--check");
  const modules = await moduleGraph();
  const htmlPath = resolve(root, "index.html");
  const html = await readFile(htmlPath, "utf8");
  const listed = listedModules(html);

  if (check) {
    const same = listed && listed.length === modules.length &&
      listed.every((name, index) => name === modules[index]);
    if (same) {
      console.log(`modulepreload ${modules.length}개 — 그래프와 일치`);
      return 0;
    }
    console.error("modulepreload 목록이 import 그래프와 다르다 — " +
      "node scripts/sync_modulepreload.mjs 를 실행하라");
    return 1;
  }

  // <head> 에 둔다 — 파서가 본문에 닿기 전에 전부 받기 시작해야 의미가 있다.
  const next = listed === null
    ? html.replace(
        /(\n\s*<\/head>)/,
        `\n${preloadBlock(modules)}$1`
      )
    : html.replace(
        new RegExp(`${escapeForRegExp(START)}[\\s\\S]*?${escapeForRegExp(END)}`),
        () => preloadBlock(modules)
      );

  // 쓰기 전에 실제로 반영됐는지 확인한다 — 조용히 실패하면 성능 회귀가
  // 아무 신호 없이 돌아온다.
  const written = listedModules(next);
  if (!written || written.length !== modules.length ||
    written.some((name, index) => name !== modules[index])) {
    console.error("index.html 갱신에 실패했다 — 마커를 확인하라");
    return 1;
  }
  await writeFile(htmlPath, next);
  console.log(`modulepreload ${modules.length}개를 index.html 에 반영했다`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await main());
}
