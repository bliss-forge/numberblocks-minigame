// index.html 의 modulepreload 목록이 실제 import 그래프와 같은지 지킨다.
//
// 왜 지켜야 하나(2026-08-28 라이브 측정): 힌트가 없으면 브라우저는 부모를
// 파싱해야 자식 모듈을 발견한다. 그래프가 4단이라 왕복이 네 번 쌓여 DCL 이
// 1231ms였다. 모듈을 새로 만들고 힌트를 빠뜨리면 그 모듈만 다시 늦게 출발하고,
// 아무도 눈치채지 못한다 — 그래서 목록을 코드로 검사한다.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  listedModules,
  moduleGraph
} from "../scripts/sync_modulepreload.mjs";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("modulepreload 목록이 import 그래프와 정확히 같다", async () => {
  const graph = await moduleGraph();
  const listed = listedModules(html);
  assert.ok(listed, "modulepreload 블록이 index.html 에 없다");
  assert.deepEqual(
    listed,
    graph,
    "node scripts/sync_modulepreload.mjs 를 실행해 맞춰라"
  );
  assert.ok(graph.length > 40, `모듈 ${graph.length}개 — 그래프 탐색이 끊겼다`);
});

test("진입점은 중복으로 걸지 않는다", async () => {
  const graph = await moduleGraph();
  assert.ok(
    !graph.includes("src/app.mjs"),
    "app.mjs 는 <script type=\"module\"> 이 이미 받아 온다"
  );
});

test("힌트는 head 안에, 스타일시트 뒤에 있다", () => {
  const head = html.split("</head>")[0];
  assert.ok(
    head.includes("modulepreload:start"),
    "힌트가 head 밖에 있으면 파서가 늦게 발견한다"
  );
  assert.ok(
    head.indexOf("stylesheet") < head.indexOf("modulepreload"),
    "렌더를 막는 스타일시트가 먼저 출발해야 한다"
  );
});

test("걸어 둔 모듈 파일이 실제로 있다", async () => {
  for (const name of listedModules(html)) {
    const source = await readFile(new URL(`../${name}`, import.meta.url), "utf8");
    assert.ok(source.length > 0, `${name} 이 비어 있다`);
  }
});
