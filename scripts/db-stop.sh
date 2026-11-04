#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl || echo /opt/homebrew/opt/postgresql@14/bin/pg_ctl)")}"
[ -x "$PGBIN/pg_ctl" ] || PGBIN=/opt/homebrew/opt/postgresql@14/bin
"$PGBIN/pg_ctl" -D .pgdata stop -m fast
