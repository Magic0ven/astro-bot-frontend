#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# provision_user.sh — Spin up a new Astro-Bot instance for a user.
#
# Usage:
#   sudo ./provision_user.sh <username> <wallet_address> <private_key> [display_name]
#
# Example:
#   sudo ./provision_user.sh bob 0xAbc...123 0xPrivKey...789 "Bob Smith"
#
# What it does:
#   1. Creates a Linux user (if missing)
#   2. Copies the bot template to /home/<username>/astro-bot/
#   3. Writes a personalised .env
#   4. Creates a systemd service  astrobot-<username>
#   5. Enables + starts the service
#   6. Appends the user to backend/users.json
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
USERNAME="${1:-}"
WALLET="${2:-}"
PRIVKEY="${3:-}"
DISPLAY_NAME="${4:-$USERNAME}"

if [[ -z "$USERNAME" || -z "$WALLET" || -z "$PRIVKEY" ]]; then
  echo "Usage: sudo $0 <username> <wallet_address> <private_key> [display_name]"
  exit 1
fi

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOT_TEMPLATE="/home/astrobot/astro-bot"          # canonical bot template
BOT_DEST="/home/${USERNAME}/astro-bot"
USERS_JSON="${SCRIPT_DIR}/backend/users.json"
SERVICE_NAME="astrobot-${USERNAME}"

# Colour helpers
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[+]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
error() { echo -e "${RED}[x]${NC} $*"; exit 1; }

# ── Sanity checks ─────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Run with sudo."
[[ -d "$BOT_TEMPLATE" ]] || error "Bot template not found at $BOT_TEMPLATE"
[[ -f "$USERS_JSON"   ]] || error "users.json not found at $USERS_JSON"

if systemctl is-active --quiet "${SERVICE_NAME}"; then
  warn "Service ${SERVICE_NAME} is already running. Stopping before reprovisioning..."
  systemctl stop "${SERVICE_NAME}" || true
fi

# ── 1. Create system user ─────────────────────────────────────────────────────
if id "$USERNAME" &>/dev/null; then
  info "User '$USERNAME' already exists — skipping creation."
else
  info "Creating Linux user: $USERNAME"
  useradd -m -s /bin/bash "$USERNAME"
fi

# ── 2. Copy bot template ──────────────────────────────────────────────────────
info "Copying bot template → $BOT_DEST"
rm -rf "$BOT_DEST"
cp -r "$BOT_TEMPLATE" "$BOT_DEST"

# Copy ephemeris files (large, symlink is faster)
if [[ -d "${BOT_TEMPLATE}/ephe" ]]; then
  rm -rf "${BOT_DEST}/ephe"
  ln -s "${BOT_TEMPLATE}/ephe" "${BOT_DEST}/ephe"
  info "Linked ephemeris files (shared, read-only)"
fi

# Fresh logs dir — don't copy old trades
rm -rf "${BOT_DEST}/logs"
mkdir -p "${BOT_DEST}/logs"
touch "${BOT_DEST}/logs/.gitkeep"

chown -R "${USERNAME}:${USERNAME}" "$BOT_DEST"

# ── 3. Write personalised .env ────────────────────────────────────────────────
info "Writing .env for $USERNAME"

# Read the template .env and substitute Hyperliquid credentials
if [[ -f "${BOT_TEMPLATE}/.env" ]]; then
  cp "${BOT_TEMPLATE}/.env" "${BOT_DEST}/.env"
else
  cp "${BOT_TEMPLATE}/.env.example" "${BOT_DEST}/.env"
fi

# Replace / add Hyperliquid credentials
python3 - <<PYEOF
import re, pathlib
env_path = pathlib.Path("${BOT_DEST}/.env")
content  = env_path.read_text()

def set_var(text, key, value):
    pattern = rf'^{key}=.*$'
    replacement = f'{key}={value}'
    if re.search(pattern, text, re.MULTILINE):
        return re.sub(pattern, replacement, text, flags=re.MULTILINE)
    return text + f'\n{key}={value}\n'

content = set_var(content, 'HYPERLIQUID_WALLET_ADDRESS', '${WALLET}')
content = set_var(content, 'HYPERLIQUID_PRIVATE_KEY',    '${PRIVKEY}')
content = set_var(content, 'PAPER_TRADING',              'true')   # safe default
env_path.write_text(content)
print("  .env written")
PYEOF

chmod 600 "${BOT_DEST}/.env"
chown "${USERNAME}:${USERNAME}" "${BOT_DEST}/.env"

# ── 4. Create Python venv ─────────────────────────────────────────────────────
info "Creating Python venv for $USERNAME"
sudo -u "$USERNAME" python3.11 -m venv "${BOT_DEST}/venv"
sudo -u "$USERNAME" "${BOT_DEST}/venv/bin/pip" install -q \
  -r "${BOT_DEST}/requirements.txt"
info "Dependencies installed"

# ── 5. Create systemd service ─────────────────────────────────────────────────
info "Creating systemd service: ${SERVICE_NAME}"

cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<UNIT
[Unit]
Description=Astro-Bot — ${DISPLAY_NAME}
After=network.target

[Service]
Type=simple
User=${USERNAME}
WorkingDirectory=${BOT_DEST}
ExecStart=${BOT_DEST}/venv/bin/python3 main.py
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal
EnvironmentFile=${BOT_DEST}/.env

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl start  "${SERVICE_NAME}"
info "Service ${SERVICE_NAME} started"

# ── 6. Register in users.json ─────────────────────────────────────────────────
info "Registering user in users.json"

# Generate a random pastel colour
HEX_COLORS=("#58a6ff" "#3fb950" "#f85149" "#d29922" "#bc8cff" "#39d353" "#e3b341" "#79c0ff")
COLOR="${HEX_COLORS[$((RANDOM % ${#HEX_COLORS[@]}))]}"

python3 - <<PYEOF
import json, pathlib

users_path = pathlib.Path("${USERS_JSON}")
users = json.loads(users_path.read_text())

# Remove existing entry for this username if reprovisioning
users = [u for u in users if u.get("id") != "${USERNAME}"]

users.append({
    "id":      "${USERNAME}",
    "name":    "${DISPLAY_NAME}",
    "bot_dir": "${BOT_DEST}",
    "color":   "${COLOR}",
})

users_path.write_text(json.dumps(users, indent=2))
print(f"  users.json updated — {len(users)} user(s) total")
PYEOF

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Bot provisioned for: ${DISPLAY_NAME} (${USERNAME})${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Bot directory : $BOT_DEST"
echo "  Service       : $SERVICE_NAME"
echo "  Wallet        : $WALLET"
echo "  Paper trading : true (default — change in ${BOT_DEST}/.env)"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status  $SERVICE_NAME"
echo "    sudo journalctl -u $SERVICE_NAME -f"
echo "    sudo systemctl stop    $SERVICE_NAME"
echo ""
echo "  To go live, edit ${BOT_DEST}/.env and set PAPER_TRADING=false"
echo "  then: sudo systemctl restart $SERVICE_NAME"
echo ""
