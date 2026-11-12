#!/usr/bin/env bash
# Резервная копия базы (у Prisma Postgres Free автоматических бэкапов нет).
# Нужен DIRECT_URL — прямая строка подключения (db.prisma.io, не pooled) — и pg_dump не старше версии сервера.
# Использование: DIRECT_URL='postgres://…@db.prisma.io:5432/postgres?sslmode=require' npm run db:backup
set -euo pipefail
cd "$(dirname "$0")/.."
: "${DIRECT_URL:?Задайте DIRECT_URL — прямую строку подключения из Prisma Console}"
mkdir -p backups
out="backups/bug-hunter-$(date -u +%Y%m%d-%H%M%S).dump"
# --no-owner/--no-acl: копию можно восстановить в любую базу (pg_restore -d …)
pg_dump --format=custom --no-owner --no-acl --file "$out" "$DIRECT_URL"
echo "Сохранено: $out ($(du -h "$out" | cut -f1)). В файле хеши паролей — храните его не в репозитории."
