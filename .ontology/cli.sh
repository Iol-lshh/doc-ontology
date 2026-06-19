#!/usr/bin/env bash
# 온톨로지 CLI 진입 셸 (ADR 0011). node 컨트롤러로 위임하는 얇은 래퍼.
#   cli.sh gui                 → GUI 서버 기동(또는 재사용) + 브라우저 오픈
#   cli.sh build-ontology      → 빌드 (CLI 컨트롤러, 미구현)
#   cli.sh rollback|find ...    → 그 외 명령 (CLI 컨트롤러, 미구현)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS="$HERE/.system/scripts"

cmd="${1:-}"

case "$cmd" in
  gui)
    exec node "$SCRIPTS/gui-command-controller.js"
    ;;
  "")
    echo "사용법: cli.sh <gui|build-ontology|rollback|find> [옵션]" >&2
    exit 2
    ;;
  *)
    exec node "$SCRIPTS/cli-command-controller.js" "$@"
    ;;
esac
