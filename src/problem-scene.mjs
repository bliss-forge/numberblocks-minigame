export function operatorFor(mode) {
  const operators = { add: "+", sub: "−", mul: "×" };
  if (!operators[mode]) {
    throw new TypeError("operand scene requires add, sub, or mul mode");
  }
  return operators[mode];
}

export function countCharacterValues(answer) {
  if (!Number.isInteger(answer) || answer < 1 || answer > 20) {
    throw new RangeError("count answer must be between 1 and 20");
  }
  if (answer <= 10) return [answer];
  if (answer === 20) return [10, 10];
  return [10, answer - 10];
}

export function equationText(problem) {
  return `${problem.operands[0]} ${operatorFor(problem.mode)} ${problem.operands[1]}`;
}

// 곱하기 블록판 — 카드 부제 "줄과 칸을 세어요"와 음성 "블록판에는 모두 몇 개가
// 있을까요?"의 화면 대응물. 줄마다 눈에 보이는 틈을 두어 아이가 6, 12, 18, 24로
// 묶어 셀 수 있게 한다. 블록 크기는 CSS가 --mul-rows/--mul-cols로 줄인다.
//
// 친구 장면에서는 **왼쪽 수 친구가 오른쪽 수만큼** 선다 — 4×5면 4 친구가 다섯 명
// (대장 지적 2026-08-14: 10×1이 "1 친구 열 명"으로 나와 말과 그림이 어긋났다).
// 넘버블럭스 캐릭터 자체가 제 수만큼의 블록으로 그려져 있어 세는 것과 친구를
// 보는 것이 한 그림에서 같이 된다 — 2026-08-06 감사 대응 때 익명 노란 네모로
// 바꿨다가 "친구들이 아니고 이상한 네모"라는 지적을 받았다.
// createCharacter가 없으면(단위 테스트·이미지 실패) 예전 줄×칸 네모판으로 물러난다.
export function multiplicationBoard(document, problem, createCharacter = null) {
  if (problem.mode !== "mul") {
    throw new TypeError("multiplication board requires mul mode");
  }
  const [rows, cols] = problem.operands;
  const board = document.createElement("div");
  board.className = "mul-board";
  board.dataset.render = createCharacter ? "friends" : "blocks";
  board.dataset.rows = String(rows);
  board.dataset.cols = String(cols);
  board.style.setProperty("--mul-rows", String(rows));
  board.style.setProperty("--mul-cols", String(cols));
  board.setAttribute("aria-label", createCharacter
    ? `${rows} 친구 ${cols}명, 모두 ${problem.answer}개`
    : `${rows}줄 ${cols}칸, 모두 ${problem.answer}개`);

  const grid = document.createElement("div");
  grid.className = "mul-rows";
  // 친구 장면은 "왼쪽 친구가 오른쪽 수만큼", 네모판은 예전대로 "왼쪽 줄 × 오른쪽 칸".
  const groups = createCharacter ? cols : rows;
  for (let group = 0; group < groups; group += 1) {
    const line = document.createElement("span");
    line.className = "mul-row";
    line.dataset.row = String(group + 1);
    if (createCharacter) {
      line.dataset.friend = String(rows);
      line.append(createCharacter(rows, "mul-friend"));
    } else {
      for (let column = 0; column < cols; column += 1) {
        const block = document.createElement("i");
        block.setAttribute("aria-hidden", "true");
        line.append(block);
      }
    }
    grid.append(line);
  }

  const label = document.createElement("strong");
  label.className = "equation-label";
  label.textContent = equationText(problem);

  board.append(grid, label);
  return board;
}

export function operandScene(document, problem, createCharacter) {
  const scene = document.createElement("div");
  scene.className = "operand-scene";

  const friends = document.createElement("div");
  friends.className = "operand-friends";

  const left = document.createElement("div");
  left.className = "operand-slot";
  left.append(createCharacter(problem.operands[0], "operand-character"));

  const operator = document.createElement("span");
  operator.className = "operator";
  operator.textContent = operatorFor(problem.mode);
  operator.setAttribute("aria-hidden", "true");

  const right = document.createElement("div");
  right.className = "operand-slot";
  right.append(createCharacter(problem.operands[1], "operand-character"));

  const label = document.createElement("strong");
  label.className = "equation-label";
  label.textContent = equationText(problem);

  friends.append(left, operator, right);
  scene.append(friends, label);
  return scene;
}
