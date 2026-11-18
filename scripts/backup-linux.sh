#!/usr/bin/env bash
# Create a private local archive of RumiStack workspace data.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$ROOT/backups"
RETENTION="${RUMISTACK_BACKUP_RETENTION:-7}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="$BACKUP_DIR/rumistack-workspace-$STAMP.tar.gz"

if ! [[ "$RETENTION" =~ ^[0-9]+$ ]] || (( RETENTION < 1 || RETENTION > 90 )); then
  echo "RUMISTACK_BACKUP_RETENTION must be between 1 and 90." >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"
for dir in sources projects state config; do
  mkdir -p "$ROOT/$dir"
done

tar -czf "$ARCHIVE" -C "$ROOT" \
  --exclude='projects/**/node_modules' \
  --exclude='sources/**/node_modules' \
  --exclude='projects/**/.venv' \
  --exclude='projects/**/venv' \
  sources projects state config

chmod 600 "$ARCHIVE"
mapfile -t old_backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'rumistack-workspace-*.tar.gz' -printf '%T@ %p\n' | sort -rn | tail -n +$((RETENTION + 1)) | cut -d' ' -f2-)
if (( ${#old_backups[@]} )); then
  printf '%s\n' "${old_backups[@]}" | while IFS= read -r file; do rm -f -- "$file"; done
fi

echo "Backup created: $ARCHIVE"
echo "Copy this archive off the VM. Local backups do not protect against VM or disk loss."
