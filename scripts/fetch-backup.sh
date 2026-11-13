#!/usr/bin/env bash
# Скачивает свежий зашифрованный бэкап из GitHub Actions и расшифровывает его в backups/.
# Нужны: gh (вход выполнен), openssl и BACKUP_PASSPHRASE — тот же пароль, что в секрете репозитория.
# Использование: BACKUP_PASSPHRASE='…' npm run db:fetch-backup [-- <run-id>]
# Восстановление: pg_restore --clean --if-exists --no-owner -d "$TARGET_URL" backups/<файл>.dump
set -euo pipefail
cd "$(dirname "$0")/.."
: "${BACKUP_PASSPHRASE:?Задайте BACKUP_PASSPHRASE — пароль из секрета репозитория}"
run="${1:-$(gh run list --workflow db-backup.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')}"
[ -n "$run" ] || { echo "Нет успешных запусков DB backup" >&2; exit 1; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
gh run download "$run" --dir "$tmp"
enc=$(find "$tmp" -name '*.dump.enc' | head -1)
[ -n "$enc" ] || { echo "В запуске $run нет файла .dump.enc (возможно, истёк срок хранения)" >&2; exit 1; }
mkdir -p backups
umask 077
out="backups/$(basename "$enc" .enc)"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass fd:3 -in "$enc" -out "$out" 3<<<"$BACKUP_PASSPHRASE"
echo "Расшифровано: $out ($(du -h "$out" | cut -f1)). В файле хеши паролей — не коммитьте его."
