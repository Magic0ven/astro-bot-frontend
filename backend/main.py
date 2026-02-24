"""
Astro-Bot Dashboard API
FastAPI backend — bridges the running bot's data files to the frontend.

Start:
    uvicorn main:app --reload --port 8000
"""
import asyncio
import json
import os
import re
import shlex
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import ccxt
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
BOT_DIR          = Path(os.getenv("BOT_DIR", "/Users/akagami/astro-bot"))
USERS_FILE       = Path(__file__).parent / "users.json"
PROVISION_SCRIPT = Path(__file__).parent.parent / "provision_user.sh"

app = FastAPI(title="Astro-Bot Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────
def load_users() -> list[dict]:
    if USERS_FILE.exists():
        return json.loads(USERS_FILE.read_text())
    return [{"id": "default", "name": "Main Bot", "bot_dir": str(BOT_DIR), "color": "#58a6ff"}]


def users_map() -> dict[str, dict]:
    return {u["id"]: u for u in load_users()}


def resolve_user(user_id: str) -> Path:
    um = users_map()
    if user_id not in um:
        raise HTTPException(404, f"User '{user_id}' not found")
    return Path(um[user_id]["bot_dir"])


def read_json_safe(path: Path, default=None):
    try:
        if path.exists():
            return json.loads(path.read_text())
    except Exception:
        pass
    return default if default is not None else {}


def query_signals_db(bot_dir: Path, limit: int = 200, closed_only: bool = False) -> list[dict]:
    db_path = bot_dir / "logs" / "signals.db"
    if not db_path.exists():
        return []
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        where = "WHERE pnl IS NOT NULL" if closed_only else ""
        cur.execute(f"""
            SELECT id, timestamp, symbol, action, western_score, vedic_score,
                   western_signal, vedic_signal, nakshatra, entry_price,
                   stop_loss, target, position_size_usdt, paper,
                   close_price, pnl, result, notes
            FROM signals
            {where}
            ORDER BY id DESC
            LIMIT ?
        """, (limit,))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return rows
    except Exception:
        return []


# ── Stats helper ───────────────────────────────────────────────────────────────
def compute_stats(trades: list[dict]) -> dict:
    if not trades:
        return {"trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0,
                "total_pnl": 0.0, "avg_win": 0.0, "avg_loss": 0.0}
    wins   = [t for t in trades if (t.get("pnl") or 0) > 0]
    losses = [t for t in trades if (t.get("pnl") or 0) <= 0]
    total  = sum(t.get("pnl") or 0 for t in trades)
    return {
        "trades":   len(trades),
        "wins":     len(wins),
        "losses":   len(losses),
        "win_rate": round(len(wins) / len(trades) * 100, 1) if trades else 0.0,
        "total_pnl": round(total, 2),
        "avg_win":  round(sum(t["pnl"] for t in wins)   / len(wins),   2) if wins   else 0.0,
        "avg_loss": round(sum(t["pnl"] for t in losses) / len(losses), 2) if losses else 0.0,
    }


# ── REST endpoints ─────────────────────────────────────────────────────────────
@app.get("/api/users")
def list_users_endpoint():
    return load_users()


@app.get("/api/users/{user_id}/signals")
def get_signals(user_id: str, limit: int = 100):
    bot_dir = resolve_user(user_id)
    return query_signals_db(bot_dir, limit)


@app.get("/api/users/{user_id}/positions")
def get_positions(user_id: str):
    bot_dir = resolve_user(user_id)
    return read_json_safe(bot_dir / "logs" / "open_positions.json", [])


@app.get("/api/users/{user_id}/equity")
def get_equity(user_id: str):
    bot_dir = resolve_user(user_id)
    return read_json_safe(bot_dir / "logs" / "equity_state.json", {})


@app.get("/api/users/{user_id}/trades")
def get_trades(user_id: str, limit: int = 200):
    bot_dir = resolve_user(user_id)
    return query_signals_db(bot_dir, limit, closed_only=True)


@app.get("/api/users/{user_id}/stats")
def get_stats(user_id: str):
    bot_dir  = resolve_user(user_id)
    trades   = query_signals_db(bot_dir, 500, closed_only=True)
    equity   = read_json_safe(bot_dir / "logs" / "equity_state.json", {})
    positions = read_json_safe(bot_dir / "logs" / "open_positions.json", [])
    stats    = compute_stats(trades)
    stats["peak_equity"]   = equity.get("peak_equity", 0)
    stats["paper_pnl"]     = equity.get("paper_pnl", 0)
    stats["open_positions"] = len(positions)
    return stats


@app.get("/api/users/{user_id}/latest-signal")
def get_latest_signal(user_id: str):
    bot_dir = resolve_user(user_id)
    rows = query_signals_db(bot_dir, 1)
    return rows[0] if rows else {}


@app.get("/api/ohlcv")
def get_ohlcv(symbol: str = "BTC/USDT", timeframe: str = "4h", limit: int = 500):
    try:
        exchange = ccxt.binance({"enableRateLimit": True})
        raw = exchange.fetch_ohlcv(symbol, timeframe, limit=limit)
        return [
            {"time": int(c[0] / 1000), "open": c[1], "high": c[2],
             "low": c[3], "close": c[4], "volume": c[5]}
            for c in raw
        ]
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Paper trade manual entry ───────────────────────────────────────────────────
class PaperTradeIn(BaseModel):
    user_id:  str
    side:     str   # BUY | SELL
    entry:    float
    sl:       float
    tp:       float
    notional: float
    signal:   str = "MANUAL"


@app.post("/api/paper/trade")
def create_paper_trade(body: PaperTradeIn):
    bot_dir   = resolve_user(body.user_id)
    positions_path = bot_dir / "logs" / "open_positions.json"
    positions = read_json_safe(positions_path, [])
    new_pos = {
        "side":     body.side,
        "signal":   body.signal,
        "entry":    body.entry,
        "sl":       body.sl,
        "tp":       body.tp,
        "notional": body.notional,
        "risk":     abs(body.entry - body.sl) / body.entry * body.notional,
        "age":      0,
        "open_ts":  datetime.now(timezone.utc).isoformat()[:16],
        "paper":    True,
    }
    positions.append(new_pos)
    positions_path.parent.mkdir(parents=True, exist_ok=True)
    positions_path.write_text(json.dumps(positions, indent=2))
    return {"status": "ok", "position": new_pos}


@app.delete("/api/paper/trade/{user_id}/{index}")
def close_paper_trade(user_id: str, index: int):
    bot_dir   = resolve_user(user_id)
    positions_path = bot_dir / "logs" / "open_positions.json"
    positions = read_json_safe(positions_path, [])
    if index < 0 or index >= len(positions):
        raise HTTPException(400, "Invalid position index")
    removed = positions.pop(index)
    positions_path.write_text(json.dumps(positions, indent=2))
    return {"status": "ok", "removed": removed}


# ── User provisioning ─────────────────────────────────────────────────────────
class RegisterUserIn(BaseModel):
    username:     str    # Linux username / unique ID  (alphanumeric + dash)
    display_name: str    # Human-readable label shown in the dashboard
    wallet:       str    # Hyperliquid wallet address  0x...
    private_key:  str    # Hyperliquid agent wallet private key  0x...


@app.post("/api/users/register")
def register_user(body: RegisterUserIn):
    # Validate username is safe (alphanumeric + hyphen only)
    if not re.fullmatch(r"[a-z0-9\-]{2,32}", body.username):
        raise HTTPException(400, "username must be 2-32 lowercase alphanumeric / hyphen chars")

    # Check provision script exists
    if not PROVISION_SCRIPT.exists():
        raise HTTPException(500, f"provision_user.sh not found at {PROVISION_SCRIPT}")

    cmd = [
        "sudo", str(PROVISION_SCRIPT),
        body.username,
        body.wallet,
        body.private_key,
        body.display_name,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,      # 2 min max — pip install can be slow
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Provisioning timed out after 120 s")

    if result.returncode != 0:
        raise HTTPException(500, f"Provisioning failed:\n{result.stderr}")

    # Return the newly created user entry from users.json
    users = load_users()
    user  = next((u for u in users if u["id"] == body.username), None)
    return {
        "status": "ok",
        "user":   user,
        "log":    result.stdout[-2000:],   # last 2 kb of script output
    }


@app.delete("/api/users/{user_id}")
def remove_user(user_id: str, stop_service: bool = True):
    """Remove a user from users.json (optionally stop their systemd service)."""
    users = load_users()
    target = next((u for u in users if u["id"] == user_id), None)
    if not target:
        raise HTTPException(404, f"User '{user_id}' not found")

    if stop_service:
        service = f"astrobot-{user_id}"
        subprocess.run(["sudo", "systemctl", "stop",    service], capture_output=True)
        subprocess.run(["sudo", "systemctl", "disable", service], capture_output=True)

    updated = [u for u in users if u["id"] != user_id]
    USERS_FILE.write_text(json.dumps(updated, indent=2))
    return {"status": "ok", "removed": target}


@app.get("/api/users/{user_id}/service-status")
def service_status(user_id: str):
    """Return systemd active/inactive status for a bot instance."""
    service = f"astrobot-{user_id}"
    result  = subprocess.run(
        ["systemctl", "is-active", service],
        capture_output=True, text=True,
    )
    return {
        "service": service,
        "status":  result.stdout.strip(),   # "active" | "inactive" | "failed"
        "running": result.returncode == 0,
    }


# ── WebSocket broadcast ────────────────────────────────────────────────────────
class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        for ws in self.active[:]:
            try:
                await ws.send_json(data)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()


@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            users = load_users()
            payload: dict = {}
            for user in users:
                bd = Path(user["bot_dir"])
                payload[user["id"]] = {
                    "positions":     read_json_safe(bd / "logs" / "open_positions.json", []),
                    "equity":        read_json_safe(bd / "logs" / "equity_state.json", {}),
                    "latest_signal": (query_signals_db(bd, 1) or [{}])[0],
                }
            await websocket.send_json({"type": "update", "data": payload})
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
