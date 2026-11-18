#!/usr/bin/env bash
# Install RumiStack as a per-user systemd service (no root-owned app process).
set -Eeuo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${RUMISTACK_PORT:-47821}"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT_FILE="$UNIT_DIR/rumistack.service"

if ! command -v systemctl >/dev/null 2>&1 || ! systemctl --user show-environment >/dev/null 2>&1; then
  echo "A running systemd user session is required." >&2
  echo "On a headless VM, run: sudo loginctl enable-linger $USER" >&2
  exit 1
fi
if ! [[ "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then
  echo "RUMISTACK_PORT must be between 1024 and 65535." >&2
  exit 1
fi
command -v node >/dev/null 2>&1 || { echo "Node.js 20+ is required." >&2; exit 1; }
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( NODE_MAJOR >= 20 )) || { echo "Node.js 20+ is required." >&2; exit 1; }

mkdir -p "$ROOT"/{sources,projects,logs,backups,state,config} "$UNIT_DIR"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=RumiStack private developer workspace
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT
Environment=RUMISTACK_PORT=$PORT
ExecStart=/usr/bin/env bash $ROOT/scripts/start-linux.sh
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now rumistack.service
echo "RumiStack user service installed and started."
echo "Status: systemctl --user status rumistack"
echo "Logs:   journalctl --user -u rumistack -f"
echo "To start after logout/reboot on a headless VM, enable lingering:"
echo "  sudo loginctl enable-linger $USER"
echo "Dashboard remains private at http://127.0.0.1:$PORT"
