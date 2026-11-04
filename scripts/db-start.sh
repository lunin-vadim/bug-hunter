#!/usr/bin/env bash
# Поднимает изолированный кластер PostgreSQL в ./.pgdata на порту 5433 (свои данные, системный Postgres не трогаем).
set -euo pipefail
cd "$(dirname "$0")/.."

PGBIN="${PGBIN:-$(dirname "$(command -v pg_ctl || echo /opt/homebrew/opt/postgresql@14/bin/pg_ctl)")}"
[ -x "$PGBIN/pg_ctl" ] || PGBIN=/opt/homebrew/opt/postgresql@14/bin
PORT=5433

if [ ! -d .pgdata ]; then
  "$PGBIN/initdb" -D .pgdata -U postgres --auth=trust -E UTF8 >/dev/null
fi

if ! "$PGBIN/pg_ctl" -D .pgdata status >/dev/null 2>&1; then
  "$PGBIN/pg_ctl" -D .pgdata -o "-p $PORT -k /tmp" -l .pg.log -w start >/dev/null
fi

PSQL="$PGBIN/psql -h localhost -p $PORT -U postgres -v ON_ERROR_STOP=1 -q"
$PSQL -tc "SELECT 1 FROM pg_roles WHERE rolname='bughunter'" | grep -q 1 \
  || $PSQL -c "CREATE ROLE bughunter LOGIN PASSWORD 'bughunter'"
$PSQL -tc "SELECT 1 FROM pg_database WHERE datname='bughunter'" | grep -q 1 \
  || $PSQL -c "CREATE DATABASE bughunter OWNER bughunter"

echo "PostgreSQL запущен: postgres://bughunter:bughunter@localhost:$PORT/bughunter"
