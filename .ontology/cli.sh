#!/usr/bin/env bash
# 온톨로지 CLI 진입 셸 (ADR 0011). node 컨트롤러로 위임하는 얇은 래퍼.
#   cli.sh gui                  → GUI 서버 기동(또는 재사용) + 브라우저 오픈
#   cli.sh build-ontology       → 빌드: database/ → .system 작업본 갱신 (ADR 0008)
#   cli.sh save                 → 저장: 작업본을 세대로 보존 + 직전 저장본을 backup으로
#   cli.sh rollback [세대]       → 빌드 롤백(인자 없음) / 히스토리 롤백(세대)
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
    echo "사용법: cli.sh <gui|build-ontology|save|rollback|find|diff> [옵션]" >&2
    exit 2
    ;;
  *)
    exec node "$SCRIPTS/cli-command-controller.js" "$@"
    ;;
esac
