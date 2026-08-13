#!/usr/bin/env bash
set -euo pipefail
cd /Users/bosung_kim/bliss/bliss_github/D_ETC/numberblocks-minigame
exec python3 -m http.server 4173 --bind 127.0.0.1
