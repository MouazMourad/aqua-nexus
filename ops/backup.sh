#!/bin/sh
set -eu

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="${BACKUP_ROOT:-./backups}"
TARGET="$BACKUP_ROOT/$STAMP"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

mkdir -p "$TARGET"

echo "[Aqua Nexus] Backing up PostgreSQL..."
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TARGET/aqua-nexus.dump"

echo "[Aqua Nexus] Backing up uploaded media..."
docker compose exec -T app sh -c 'tar -czf - -C /data uploads 2>/dev/null || true' > "$TARGET/uploads.tar.gz"

echo "[Aqua Nexus] Recording deployment metadata..."
git rev-parse HEAD > "$TARGET/git-commit.txt" 2>/dev/null || true

find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} \;

echo "[Aqua Nexus] Backup completed: $TARGET"
