"""캐릭터 PNG의 WebP 파생본을 만든다.

원본 PNG는 건드리지 않는다 — 승인된 자산이고, 파생본은 옆에 쌓기만 한다.
해상도도 줄이지 않는다: 화면 최대 표시 크기가 570px인데 고해상도 화면(DPR 2)은
1140px를 원하므로, 원본 1024px가 그대로 필요하다. 줄이는 것은 용량뿐이다.

q92 근거(2026-08-28 측정): 표시 크기 570px로 줄여 비교했을 때 RMS 오차
0.94/255, 8단계 넘게 차이 나는 서브픽셀 0.18%. 알파는 완전 보존된다.
용량은 1~10번 열 장 기준 4788KB → 410KB.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "characters"
OUT = ROOT / "webp"
QUALITY = "92"


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = 0
    skipped = 0
    for source in sorted(ROOT.glob("*.png")):
        target = OUT / f"{source.stem}.webp"
        if target.exists() and target.stat().st_size > 512:
            skipped += 1
            continue
        subprocess.run(
            ["cwebp", "-quiet", "-q", QUALITY, "-m", "6", "-alpha_q", "100",
             str(source), "-o", str(target)],
            check=True,
        )
        made += 1
        print(target.relative_to(ROOT.parent))
    print(f"made {made}, skipped {skipped}")
    if made == 0 and skipped == 0:
        print("no PNG sources found", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
