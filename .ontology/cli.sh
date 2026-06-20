#!/usr/bin/env bash
# 온톨로지 CLI 진입 셸 (ADR 0011). node 컨트롤러로 위임하는 얇은 래퍼.
#   cli.sh gui                  → GUI 서버 기동(또는 재사용) + 브라우저 오픈
#   cli.sh build-ontology       → 빌드: database/ → .system 작업본 갱신 (ADR 0008)
#   cli.sh save                 → 저장: 작업본을 끝(TIP)에 세대로 적재 + backup 재기준화
#   cli.sh checkout <세대>       → 체크: 작업본+유저 DB를 그 세대로 이동(HEAD 이동, TIP 불변)
#   cli.sh restore              → 초기화: 작업본+유저 DB를 backup(마지막 저장)으로 되돌림
#   cli.sh reset                → 리셋: 현재 HEAD 이후 세대 폐기(TIP=HEAD)
#   cli.sh diff <from> <to>     → 비교 (세대/current/backup)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$HERE/.system/scripts"

cmd="${1:-}"

case "$cmd" in
  gui)
    exec node "$SCRIPTS/gui-command-controller.js"
    ;;
  "")
    echo "사용법: cli.sh <gui|build-ontology|save|checkout|restore|reset|diff> [옵션]" >&2
    exit 2
    ;;
  *)
    exec node "$SCRIPTS/cli-command-controller.js" "$@"
    ;;
esac
