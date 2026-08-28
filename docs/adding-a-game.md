# 새 놀이 하나 붙이기

이 저장소에 열한 번째 놀이를 붙일 때 밟을 순서. 열 번을 붙이면서 실제로
밟은 함정까지 같이 적는다 — 순서보다 함정이 더 값지다.

빌드 단계가 없다는 것이 이 저장소의 기본 전제다. 바닐라 ES 모듈 + 인라인
SVG + CSS이고 런타임 의존성이 0이다. 새 놀이도 그 안에서 끝낸다.

---

## 1. 계약부터 정한다

카드 번호와 캐릭터 번호는 **항상 같아야 한다**(7번 카드 = `seven.png`).
글을 못 읽는 아이가 카드를 고르는 유일한 단서라서, 이 규칙이 깨지면
게임이 아니라 미로가 된다.

1. `CLAUDE.md` 홈 카드 표에 행을 추가한다 — 번호·모드 id·제목·캐릭터 자산.
2. `index.html` 에 카드를 넣는다. 기존 카드와 같은 모양이어야 한다:

```html
<button class="mode-card" type="button" data-mode="<모드id>">
  <span class="card-number">11</span>
  <img src="assets/characters/eleven.png" alt=""
       srcset="assets/characters/thumb/eleven.webp 480w" sizes="154px" decoding="async">
  <span class="card-copy">
    <strong>제목</strong>
    <small>한 줄 부제</small>
  </span>
</button>
```

3. `styles.css` 에 `.mode-card:nth-child(11)` 색을 정의한다. **빠뜨리면 폴백
   분홍이 되고 번호 배지 대비가 무너진다** — 실제로 7~9번이 그랬다(P1-1).

홈에는 숫자키 단축키가 없다. 카드도 난이도도 ←/→ 로 옮기고 Space·Enter 로
고른다. 번호 배지는 순서 표식일 뿐이다.

## 2. 모델과 장면을 나눈다

파일 두 개로 시작한다. 섞으면 테스트가 브라우저 없이는 못 돈다.

| 파일 | 책임 | 예 |
|---|---|---|
| `src/<이름>.mjs` | 규칙·상태·전이. DOM 을 모른다 | `subway-journey.mjs` |
| `src/<이름>-scene.mjs` | DOM 생성·갱신. 규칙을 모른다 | `subway-scene.mjs` |

모델은 **시드 RNG** 를 쓴다(`seededRandom` 패턴을 복사한다). 같은 시드가 같은
판을 만들어야 테스트가 재현된다.

모델이 내보낼 것은 대체로 이 셋이다:
- `create<이름>(difficulty, { seed })` — 초기 상태
- `attempt<이름>Move(state, direction)` → `{ state, event }`
- `advance<이름>World(state, elapsedMs)` — 시간이 흐르는 놀이라면

그림이 커지면 `-art.mjs`(SVG 문자열)와 `-data.mjs`(표 데이터)로 더 쪼갠다.

## 3. app.mjs 에 배선한다

`startMode()` 하나가 모든 모드의 입구다(`src/app.mjs`).

1. 상태 슬롯을 `state` 에 추가하고, `startMode` 의 초기화 목록에 `null` 로
   넣는다. **여기를 빼먹으면 다른 놀이를 하다 온 찌꺼기가 화면에 남는다.**
2. `startMode` 분기에 `start<이름>()` 을 건다.
3. 시간이 흐르면 `schedule<이름>Tick()` 을 만든다 — 100~200ms 주기, 그리고
   `state.phase !== "playing"` 이면 즉시 반환한다.
4. `goHome()` / `clearTimers()` 가 새 상태를 지우는지 확인한다.

난이도로 막을 놀이면 `src/game-model.mjs` 의 `isModeAvailable()` 을 고친다.

## 4. 캐릭터 이미지는 한 곳으로만

`assets/characters/...` 를 직접 이어 붙이지 않는다. **`src/character-image.mjs`
를 쓴다.**

```js
import { applyCharacterNumber } from "./character-image.mjs";
applyCharacterNumber(image, number);   // PNG 원본 + WebP 파생본을 함께 건다
```

SVG `<image>` 는 srcset 이 없으니 `characterWebpPath()` 로 파생본을 직접
가리킨다. 직접 조립하면 **그 화면만 조용히 원본 PNG(장당 400~700KB)를
받는다** — `tests/character-image.test.mjs` 가 구조로 막는다.

새 캐릭터 원본을 추가했다면 파생본을 만든다:

```bash
npm run assets:webp     # 원본은 건드리지 않고 webp/ 에 파생본만 쌓는다
```

## 5. 음성

글을 못 읽는 아이에게 **자막은 전달 수단이 0이다.** 새 안내를 만들 때마다
음성 키를 같이 만든다. 자리는 세 곳이고, 한 곳만 고치면 조용히 무음이 된다.

1. `src/audio-manifest.mjs` 의 `VOICE` 에 키 등록
2. `scripts/generate_voice_pack.py` 의 `KO_*` / `EN_*` 딕셔너리에 문구 추가
   (+ `main()` 에 `render_pack` 호출)
3. 호출부에서 `audio.playPrompt(key)`

키 하나가 **한국어 → 영어 두 번** 재생된다. 세 키를 이어 붙이면 10초가
넘어간다 — 이어 읽기는 두 키까지가 한계다.

mp3 생성은 네트워크(edge-tts)를 쓴다. **대장 승인 전에는 실행하지 않는다.**
승인 후:

```bash
python3 scripts/generate_voice_pack.py     # 이미 있는 파일은 건너뛴다
```

계약 테스트를 함께 만든다(`tests/<이름>-voice.test.mjs`). `srt-voice.test.mjs`
가 본보기다 — 매니페스트·생성기·호출부 **세 집합이 정확히 같은지** 본다.
키를 문자열이 아니라 계산으로 만들면 스캐너에 그 경로를 가르쳐야 한다.

## 6. 테스트 네 종류

```
tests/<이름>.test.mjs           모델 — 시드 재현성, 규칙, 전이, 경계
tests/<이름>-scene.test.mjs     장면 — FakeElement 로 DOM 계약
tests/<이름>-voice.test.mjs     음성 — 세 집합 동치
tests/app-contract.test.mjs     카드 번호·모드·캐릭터 계약에 행 추가
```

`FakeElement` 는 기존 장면 테스트에서 복사한다(`safety-route-scene.test.mjs`).
브라우저 테스트는 `loadChromium()` 이 없으면 `t.skip` 으로 넘어가게 둔다.

**새 가드를 만들면 뮤테이션으로 확인한다.** 고친 로직을 일부러 끄고 그
테스트가 실제로 실패하는지 본다. 실패하지 않으면 가드가 아니라 장식이다.

## 7. 마무리 명령

```bash
npm run assets:preload    # 모듈을 새로 만들었으면 반드시 — 안 하면 부팅이 느려진다
npm test                  # 실패 0
```

`assets:preload` 는 `index.html` 의 `modulepreload` 목록을 실제 import 그래프와
맞춘다. 빠뜨린 모듈은 워터폴 뒤로 밀려 혼자 늦게 출발한다.

## 8. 브라우저가 최종 심판이다

**테스트 통과는 동작 증명이 아니다.** 606개가 통과하는 동안 화면의 모션이
죽어 있던 적이 있다. 1280×720 로 실제로 열어 보고 확인한다.

- 화면 잘림·가로 스크롤 없음
- 콘솔 오류·404 없음
- 캐릭터가 실제로 그려짐(`naturalWidth > 0` 까지 본다)

"오류 0" 을 보고하기 전에 **카나리로 리스너가 살아 있음을 먼저 증명한다** —
일부러 404 를 내고 그것이 잡히는지 본다. 안 그러면 "리스너가 안 붙었다"와
"오류가 없다"를 구분할 수 없다.

## 9. 배포

```bash
npm test                                   # 실패 0
git checkout main && git merge --no-ff <브랜치>
npm test                                   # 병합 결과에서 다시
PUSH_OK=1 git push origin main             # 대장 승인 후
gh run list --limit 1                      # Pages 완료 확인
```

배포 검증은 **렌더된 라이브 페이지까지** 간다. 소스 grep 으로는 부족하다 —
로컬 파일과 라이브 응답의 해시를 대조하고, 실제로 놀이에 들어가 본다.

---

## 밟았던 함정

| 증상 | 진짜 원인 |
|---|---|
| 캐릭터가 1498px 로 폭발 | 내용 크기 부모에 `height:100%` → 순환 참조 |
| 그리드가 컨테이너를 넘침 | 행 트랙에 `minmax(0, 1fr)` 이 없다 |
| 폭이 컨테이너와 어긋남 | `vw` 기준 계산. 컨테이너 폭과 다르다 |
| 스타일이 안 먹음 | CSS 애니메이션이 일반 선언을 덮어쓴다 |
| 테스트는 통과, 화면은 죽음 | 브라우저로 재지 않았다 |
| 새 음성이 무음 | 세 곳 중 한 곳만 고쳤다 |
| 스크립트가 "성공"인데 결과가 없음 | 마커에 정규식 특수문자. 쓰기 전에 결과를 확인한다 |
| 안내를 따르는 아이가 갇힘 | 막기만 하고 "지금 해도 된다"를 안 알려 줬다 |

마지막 줄이 이 저장소에서 가장 자주 나온 설계 실수다. 막는 안내를 만들 때는
**푸는 신호를 같이 만든다.** 4~6세 아이는 다시 눌러 볼 생각을 못 한다.
