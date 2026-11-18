#!/usr/bin/env bash
# Install a daily per-user systemd timer for local workspace backups.
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
SERVICE="$UNIT_DIR/rumistack-backup.service"
TIMER="$UNIT_DIR/rumistack-backup.timer"

if ! command -v systemctl >/dev/null 2>&1 || ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "A running systemd user session is required." >&2
  echo "On a headless VM, run: sudo loginctl enable-linger $USER" >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
cat > "$SERVICE" <<EOF
[Unit]
Description=Create a local RumiStack workspace backup

[Service]
Type=oneshot
WorkingDirectory=$ROOT
ExecStart=/usr/bin/env bash $ROOT/scripts/backup-linux.sh
EOF

cat > "$TIMER" <<'EOF'
[Unit]
Description=Daily RumiStack workspace backup

[Timer]
OnCalendar=daily
Persistent=true
RandomizedDelaySec=15m
Unit=rumistack-backup.service

[Install]
WantedBy=timers.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now rumistack-backup.timer
echo "Daily RumiStack backup timer enabled."
echo "Next run: systemctl --user list-timers rumistack-backup.timer"
echo "Logs:     journalctl --user -u rumistack-backup.service"
echo "Remember to copy archives off the VM for disaster recovery."
