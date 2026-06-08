#!/usr/bin/env bash
# Sets up the MyOffice daemon as a systemd user service on WSL2.
# Run once: bash src/daemon/setup-wsl-autostart.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$HOME/.myoffice-daemon.env"
SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/myoffice-daemon.service"

echo "=== MyOffice Daemon — WSL2 systemd setup ==="

# 1. Write env file if it doesn't exist
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
HQ_URL=https://claude-cowork-s82t.onrender.com
HQ_API_KEY=REPLACE_ME
REDIS_URL=REPLACE_ME
DAEMON_ID=wsl-daemon-1
ANTHROPIC_API_KEY=REPLACE_ME
AGENTS_DIR=/home/ominous/.claude/agents
EOF
  echo "Created $ENV_FILE — EDIT IT with real values before starting!"
else
  echo "Env file already exists: $ENV_FILE"
fi

# 2. Install systemd unit
mkdir -p "$SERVICE_DIR"
sed "s|WorkingDirectory=.*|WorkingDirectory=$REPO_ROOT|" \
    "$SCRIPT_DIR/myoffice-daemon.service" > "$SERVICE_FILE"
echo "Installed service: $SERVICE_FILE"

# 3. Enable lingering so service starts at boot without login
loginctl enable-linger "$(whoami)" 2>/dev/null || true

# 4. Reload and enable
systemctl --user daemon-reload
systemctl --user enable --now myoffice-daemon
echo ""
echo "=== Done ==="
echo "Check status:  systemctl --user status myoffice-daemon"
echo "View logs:     tail -f ~/.myoffice-daemon.log"
echo "Restart:       systemctl --user restart myoffice-daemon"
echo "Stop:          systemctl --user stop myoffice-daemon"
