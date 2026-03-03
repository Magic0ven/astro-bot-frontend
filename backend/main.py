"""
Astro-Bot Dashboard API
FastAPI backend — bridges the running bot's data to the frontend.

Storage strategy (auto-detected at startup):
  • DATABASE_URL set  → reads/writes Railway Postgres  (production)
  • DATABASE_URL unset → reads bot's local JSON/SQLite files (local dev)

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
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Config ─────────────────────────────────────────────────────────────────────
BOT_DIR          = Path(os.getenv("BOT_DIR", "/Users/akagami/astro-bot"))
USERS_FILE       = Path(__file__).parent / "users.json"
PROVISION_SCRIPT = Path(__file__).parent.parent / "provision_user.sh"
DATABASE_URL     = os.getenv("DATABASE_URL")
RAILWAY_API_KEY  = os.getenv("RAILWAY_API_KEY", "")   # needed only for provisioning
RAILWAY_PROJECT_ID = os.getenv("RAILWAY_PROJECT_ID", "")
RAILWAY_ENV_ID   = os.getenv("RAILWAY_ENVIRONMENT_ID", "")
BOT_TEMPLATE_SERVICE_ID = os.getenv("BOT_TEMPLATE_SERVICE_ID", "")  # ID of the 'bot' service to clone

# ── Postgres helpers (used when DATABASE_URL is set) ──────────────────────────
_USE_PG = bool(DATABASE_URL)

if _USE_PG:
    import psycopg2
    import psycopg2.extras

    def _pg_conn():
        return psycopg2.connect(DATABASE_URL, sslmode="require")

    def _pg_query_signals(user_id: str, limit: int = 200,
                          closed_only: bool = False) -> list[dict]:
        where  = "WHERE user_id = %s"
        params = [user_id]
        if closed_only:
            where += " AND pnl IS NOT NULL"
        with _pg_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(f"""
                    SELECT id, user_id, timestamp, symbol, action,
                           western_score, vedic_score,
                           western_slope AS western_signal,
                           vedic_slope   AS vedic_signal,
                           nakshatra, entry_price, stop_loss, target,
                           position_usdt AS position_size_usdt,
                           paper, close_price, pnl, result, notes,
                           full_signal
                    FROM signals
                    {where}
                    ORDER BY id DESC
                    LIMIT %s
                """, (*params, limit))
                return [dict(r) for r in cur.fetchall()]

    def _pg_load(user_id: str, data_type: str, default):
        key = f"{user_id}:{data_type}"
        with _pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM kv_store WHERE key = %s", (key,))
                row = cur.fetchone()
                return json.loads(row[0]) if row else default

    def _pg_save(user_id: str, data_type: str, value):
        key = f"{user_id}:{data_type}"
        with _pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO kv_store (key, value) VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """, (key, json.dumps(value)))
            conn.commit()

    def _pg_list_users() -> list[str]:
        """Return all user_ids that have signals in the DB."""
        with _pg_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT user_id FROM signals ORDER BY user_id")
                return [r[0] for r in cur.fetchall()]

app = FastAPI(title="Astro-Bot Dashboard API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────
_COLORS = ["#58a6ff", "#3fb950", "#f78166", "#d2a8ff", "#ffa657", "#79c0ff"]


def load_users() -> list[dict]:
    """
    Returns the user list.
    In PG mode: merges users.json with any user_ids found in the signals table
    so that newly provisioned Railway services appear automatically.
    """
    base: list[dict] = []
    if USERS_FILE.exists():
        base = json.loads(USERS_FILE.read_text())
    if not base:
        base = [{"id": "default", "name": "Main Bot",
                 "bot_dir": str(BOT_DIR), "color": "#58a6ff"}]

    if _USE_PG:
        try:
            known_ids  = {u["id"] for u in base}
            db_ids     = _pg_list_users()
            for i, uid in enumerate(db_ids):
                if uid not in known_ids:
                    base.append({
                        "id":      uid,
                        "name":    uid.replace("-", " ").title(),
                        "bot_dir": str(BOT_DIR),
                        "color":   _COLORS[i % len(_COLORS)],
                    })
        except Exception:
            pass

    return base


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


def query_signals_db(bot_dir: Path, limit: int = 200, closed_only: bool = False,
                     user_id: str = "default") -> list[dict]:
    # ── Postgres path ──────────────────────────────────────────────────────────
    if _USE_PG:
        return _pg_query_signals(user_id, limit, closed_only)

    # ── SQLite file path (local dev) ───────────────────────────────────────────
    db_path = bot_dir / "logs" / "signals.db"
    if not db_path.exists():
        return []
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        where = "WHERE pnl IS NOT NULL" if closed_only else ""
        cur.execute(f"SELECT * FROM signals {where} ORDER BY id DESC LIMIT ?", (limit,))
        rows = []
        for r in cur.fetchall():
            d = dict(r)
            # Normalize column names and include full_signal if present
            d["western_signal"] = d.get("western_slope") or d.get("western_signal")
            d["vedic_signal"] = d.get("vedic_slope") or d.get("vedic_signal")
            d["position_size_usdt"] = d.get("position_usdt") or d.get("position_size_usdt")
            if "full_signal" not in d:
                d["full_signal"] = None
            rows.append(d)
        conn.close()
        return rows
    except Exception:
        return []


def _load_positions(bot_dir: Path, user_id: str = "default") -> list:
    if _USE_PG:
        return _pg_load(user_id, "open_positions", [])
    return read_json_safe(bot_dir / "logs" / "open_positions.json", [])


def _load_equity(bot_dir: Path, user_id: str = "default") -> dict:
    if _USE_PG:
        return _pg_load(user_id, "equity_state", {})
    return read_json_safe(bot_dir / "logs" / "equity_state.json", {})


def _save_positions(bot_dir: Path, positions: list, user_id: str = "default"):
    if _USE_PG:
        _pg_save(user_id, "open_positions", positions)
        return
    path = bot_dir / "logs" / "open_positions.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(positions, indent=2))


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


# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "storage": "postgres" if _USE_PG else "file"}


# ── REST endpoints ─────────────────────────────────────────────────────────────
@app.get("/api/users")
def list_users_endpoint():
    return load_users()


@app.get("/api/users/{user_id}/signals")
def get_signals(user_id: str, limit: int = 100):
    bot_dir = resolve_user(user_id)
    return query_signals_db(bot_dir, limit, user_id=user_id)


@app.get("/api/users/{user_id}/positions")
def get_positions(user_id: str):
    bot_dir = resolve_user(user_id)
    return _load_positions(bot_dir, user_id=user_id)


@app.get("/api/users/{user_id}/equity")
def get_equity(user_id: str):
    bot_dir = resolve_user(user_id)
    return _load_equity(bot_dir, user_id=user_id)


@app.get("/api/users/{user_id}/trades")
def get_trades(user_id: str, limit: int = 200):
    bot_dir = resolve_user(user_id)
    return query_signals_db(bot_dir, limit, closed_only=True, user_id=user_id)


@app.get("/api/users/{user_id}/stats")
def get_stats(user_id: str):
    bot_dir   = resolve_user(user_id)
    trades    = query_signals_db(bot_dir, 500, closed_only=True, user_id=user_id)
    equity    = _load_equity(bot_dir, user_id=user_id)
    positions = _load_positions(bot_dir, user_id=user_id)
    stats     = compute_stats(trades)
    stats["peak_equity"]    = equity.get("peak_equity", 0)
    stats["paper_pnl"]      = equity.get("paper_pnl", 0)
    stats["open_positions"] = len(positions)
    return stats


@app.get("/api/users/{user_id}/latest-signal")
def get_latest_signal(user_id: str):
    bot_dir = resolve_user(user_id)
    rows = query_signals_db(bot_dir, 1, user_id=user_id)
    return rows[0] if rows else {}


def _urlopen_no_ssl_verify(req, timeout=15):
    """Open URL with optional SSL verification disabled (for macOS cert issues in dev)."""
    import ssl
    import urllib.request as urlreq
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return urlreq.urlopen(req, timeout=timeout, context=ctx)


# Hyperliquid returns max 500 candles per request; we paginate by time window
HL_CANDLES_CHUNK = 500


def _fetch_ohlcv_hyperliquid(coin: str, hl_interval: str, start_ms: int, end_ms: int, _num):
    import urllib.request as urlreq
    interval_ms = {
        "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
        "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
    }.get(hl_interval, 14_400_000)
    chunk_ms = HL_CANDLES_CHUNK * interval_ms
    all_out = []
    current_end = end_ms
    while current_end > start_ms:
        current_start = max(start_ms, current_end - chunk_ms)
        payload = json.dumps({
            "type": "candleSnapshot",
            "req": {"coin": coin, "interval": hl_interval, "startTime": current_start, "endTime": current_end},
        }).encode()
        req = urlreq.Request(
            "https://api.hyperliquid.xyz/info",
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "AstroBot-Dashboard/1.0"},
            method="POST",
        )
        with _urlopen_no_ssl_verify(req, 15) as resp:
            raw = json.loads(resp.read().decode())
        if not isinstance(raw, list):
            raise ValueError(f"Unexpected shape: {type(raw).__name__}")
        out = []
        for c in raw:
            if not isinstance(c, dict):
                continue
            ts = c.get("t") or c.get("T")
            if ts is None:
                continue
            out.append({
                "time": int(ts / 1000) if ts > 1e12 else int(ts),
                "open": _num(c.get("o", 0)), "high": _num(c.get("h", 0)),
                "low": _num(c.get("l", 0)), "close": _num(c.get("c", 0)),
                "volume": _num(c.get("v", 0)),
            })
        if not out:
            break
        all_out = out + all_out
        current_end = out[0]["time"] * 1000 - 1
    return all_out


def _fetch_ohlcv_binance(coin: str, interval: str, limit: int, start_ms: int = 0):
    import urllib.request as urlreq
    sym = coin + "USDT"
    chunk = 1000  # Binance max per request
    all_rows = []
    end_ms = int(__import__("time").time() * 1000)
    fetch_start = start_ms if start_ms > 0 else None
    while len(all_rows) < limit:
        url = (
            "https://api.binance.com/api/v3/klines"
            f"?symbol={sym}&interval={interval}&limit={chunk}&endTime={end_ms}"
        )
        if fetch_start is not None:
            url += f"&startTime={fetch_start}"
        req = urlreq.Request(
            url,
            method="GET",
            headers={"User-Agent": "Mozilla/5.0 (compatible; AstroBot/1.0)"},
        )
        with _urlopen_no_ssl_verify(req, 15) as resp:
            raw = json.loads(resp.read().decode())
        if not isinstance(raw, list) or not raw:
            break
        if fetch_start is not None:
            # Fixed range: fetch forward (oldest first), append
            all_rows.extend(raw)
            if len(raw) < chunk:
                break
            fetch_start = raw[-1][0] + 1
            if fetch_start >= end_ms:
                break
            if len(all_rows) >= limit:
                all_rows = all_rows[:limit]
                break
        else:
            # Backward from now
            all_rows = raw + all_rows
            if len(raw) < chunk:
                break
            end_ms = raw[0][0] - 1
            if len(all_rows) >= limit:
                all_rows = all_rows[-limit:]
                break
    return [
        {
            "time": int(row[0] / 1000),
            "open": float(row[1]), "high": float(row[2]),
            "low": float(row[3]), "close": float(row[4]),
            "volume": float(row[5]),
        }
        for row in all_rows
    ]


# Fixed range start: 2025-01-01 00:00:00 UTC
OHLCV_START_TIMESTAMP = 1735689600


@app.get("/api/ohlcv")
def get_ohlcv(
    symbol: str = "BTC/USDT",
    timeframe: str = "4h",
    limit: int = 2000,
    start_time: Optional[int] = None,
):
    """
    Fetches OHLCV candles from start_time to now (or last `limit` bars if no start_time).
    Tries Hyperliquid first; on failure falls back to Binance.
    """
    import time

    coin = symbol.split("/")[0]
    hl_interval = {
        "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m",
        "1h": "1h", "4h": "4h", "1d": "1d",
    }.get(timeframe, "4h")
    interval_ms = {
        "1m": 60_000, "5m": 300_000, "15m": 900_000, "30m": 1_800_000,
        "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
    }.get(timeframe, 14_400_000)
    end_ms = int(time.time() * 1000)
    if start_time is not None:
        start_ms = int(start_time) * 1000
        # Cap number of bars to avoid timeouts (e.g. 50k bars max)
        max_bars = 50000
        start_ms = max(start_ms, end_ms - max_bars * interval_ms)
    else:
        start_ms = end_ms - limit * interval_ms

    def _num(x):
        return float(x) if isinstance(x, str) else float(x)

    err1 = None
    try:
        return _fetch_ohlcv_hyperliquid(coin, hl_interval, start_ms, end_ms, _num)
    except Exception as e:
        err1 = e

    try:
        binance_interval = {"1h": "1h", "4h": "4h", "1d": "1d"}.get(timeframe, "4h")
        # When using fixed range, request enough to cover start_ms→end_ms
        limit_binance = limit if start_time is None else max(limit, (end_ms - start_ms) // interval_ms + 100)
        limit_binance = min(limit_binance, 50000)
        return _fetch_ohlcv_binance(coin, binance_interval, limit_binance, start_ms if start_time is not None else 0)
    except Exception as e:
        msg = str(e).replace("\n", " ")
        if err1:
            raise HTTPException(500, f"OHLCV: Hyperliquid failed ({err1!s}); Binance failed ({msg})")
        raise HTTPException(500, f"OHLCV error: {msg}")


@app.get("/api/ticker")
def get_ticker():
    """
    Returns current mid prices for all coins from Hyperliquid (allMids).
    Used by the Predictions page to show current market price vs signal levels.
    """
    import urllib.request as urlreq
    payload = json.dumps({"type": "allMids"}).encode()
    try:
        req = urlreq.Request(
            "https://api.hyperliquid.xyz/info",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with _urlopen_no_ssl_verify(req, 10) as resp:
            raw = json.loads(resp.read().decode())
        return {k: float(v) for k, v in raw.items()}
    except Exception as e:
        raise HTTPException(500, f"Hyperliquid ticker error: {e}")


@app.get("/api/market-stats")
def get_market_stats(symbol: str = "BTC"):
    """
    Returns market stats for the chart header: price, 24h volume, open interest, funding, impact.
    Uses Hyperliquid metaAndAssetCtxs; symbol should be the perp name (e.g. BTC, ETH).
    """
    import urllib.request as urlreq
    coin = symbol.upper().replace("/USDT", "").replace("/", "").strip() or "BTC"
    payload = json.dumps({"type": "metaAndAssetCtxs"}).encode()
    try:
        req = urlreq.Request(
            "https://api.hyperliquid.xyz/info",
            data=payload,
            headers={"Content-Type": "application/json", "User-Agent": "AstroBot-Dashboard/1.0"},
            method="POST",
        )
        with _urlopen_no_ssl_verify(req, 10) as resp:
            raw = json.loads(resp.read().decode())
    except Exception as e:
        raise HTTPException(500, f"Market stats error: {e}")
    if not isinstance(raw, list) or len(raw) < 2:
        raise HTTPException(502, "Invalid metaAndAssetCtxs response")
    meta, asset_ctxs = raw[0], raw[1]
    universe = meta.get("universe") if isinstance(meta, dict) else []
    if not isinstance(universe, list) or not isinstance(asset_ctxs, list) or len(asset_ctxs) != len(universe):
        raise HTTPException(502, "Universe/context length mismatch")
    idx = None
    for i, u in enumerate(universe):
        if isinstance(u, dict) and (u.get("name") or "").upper() == coin:
            idx = i
            break
    if idx is None:
        raise HTTPException(404, f"Symbol {symbol} not found in Hyperliquid meta")
    ctx = asset_ctxs[idx]
    if not isinstance(ctx, dict):
        raise HTTPException(502, "Invalid asset context")
    def _f(k, default=0):
        v = ctx.get(k, default)
        try:
            return float(v)
        except (TypeError, ValueError):
            return default
    mid = _f("midPx")
    prev = _f("prevDayPx")
    change_pct = ((mid - prev) / prev * 100) if prev and prev != 0 else 0.0
    oi_base = _f("openInterest")
    oi_usd = oi_base * mid if mid else 0
    day_ntl = _f("dayNtlVlm")
    funding = _f("funding")
    impact = ctx.get("impactPxs")
    if isinstance(impact, list) and len(impact) >= 2:
        impact_buy = float(impact[0]) if impact[0] is not None else 0
        impact_sell = float(impact[1]) if impact[1] is not None else 0
    else:
        impact_buy = impact_sell = 0
    return {
        "price": mid,
        "prevDayPx": prev,
        "changePct": round(change_pct, 2),
        "volume24h": day_ntl,
        "openInterestUsd": round(oi_usd, 2),
        "openInterestBase": oi_base,
        "funding": funding,
        "fundingPct": round(funding * 100, 4),
        "impactPxs": [impact_buy, impact_sell],
    }


# ── Prediction calendar (static JSON) ─────────────────────────────────────────

def _predictions_calendar_file() -> Optional[Path]:
    """Path to static predictions JSON in backend repo (backend/data/predictions_calendar.json)."""
    p = Path(__file__).parent / "data" / "predictions_calendar.json"
    return p if p.exists() else None


@app.get("/api/predictions/calendar")
def get_predictions_calendar(until_year: int = 0, asset: Optional[str] = None):
    """
    Returns day-by-day predictions from backend/data/predictions_calendar.json.
    Query params: until_year (filter days to this year), asset (ignored; file is single-asset).
    """
    year = until_year or datetime.now(timezone.utc).date().year
    calendar_file = _predictions_calendar_file()
    if not calendar_file:
        return {
            "unavailable": True,
            "reason": "predictions_calendar.json not found",
            "hint": "Add backend/data/predictions_calendar.json (e.g. from bot: python scripts/predict_calendar.py --to YYYY-12-31).",
            "asset": None,
            "life_path_number": None,
            "from": None,
            "to": None,
            "days": [],
        }
    try:
        with open(calendar_file) as f:
            data = json.load(f)
    except (json.JSONDecodeError, IOError):
        return {
            "unavailable": True,
            "reason": "Failed to load predictions_calendar.json",
            "asset": None,
            "life_path_number": None,
            "from": None,
            "to": None,
            "days": [],
        }
    if not isinstance(data.get("days"), list):
        return {
            "unavailable": True,
            "reason": "Invalid predictions_calendar.json format",
            "asset": None,
            "life_path_number": None,
            "from": None,
            "to": None,
            "days": [],
        }
    year_str = str(year)
    data["days"] = [d for d in data["days"] if d.get("date", "").startswith(year_str)]
    data["from"] = data["days"][0]["date"] if data["days"] else None
    data["to"] = data["days"][-1]["date"] if data["days"] else None
    return data


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
    positions = _load_positions(bot_dir, user_id=body.user_id)
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
    _save_positions(bot_dir, positions, user_id=body.user_id)
    return {"status": "ok", "position": new_pos}


@app.delete("/api/paper/trade/{user_id}/{index}")
def close_paper_trade(user_id: str, index: int):
    bot_dir   = resolve_user(user_id)
    positions = _load_positions(bot_dir, user_id=user_id)
    if index < 0 or index >= len(positions):
        raise HTTPException(400, "Invalid position index")
    removed = positions.pop(index)
    _save_positions(bot_dir, positions, user_id=user_id)
    return {"status": "ok", "removed": removed}


# ── User provisioning via Railway API ─────────────────────────────────────────
class RegisterUserIn(BaseModel):
    username:     str    # unique ID for this user  (alphanumeric + dash)
    display_name: str    # Human-readable label shown in the dashboard
    wallet:       str    # Hyperliquid wallet address  0x...
    private_key:  str    # Hyperliquid agent wallet private key  0x...


@app.post("/api/users/register")
def register_user(body: RegisterUserIn):
    """
    Provision a new bot user on Railway.

    On Railway, a new user = a new Railway Service created via the Railway API.
    The service is a copy of the existing bot service with user-specific env vars
    injected (BOT_USER_ID, HYPERLIQUID_WALLET_ADDRESS, HYPERLIQUID_PRIVATE_KEY).

    Requires RAILWAY_API_KEY, RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID, and
    BOT_TEMPLATE_SERVICE_ID to be set in this service's env vars.
    """
    if not re.fullmatch(r"[a-z0-9\-]{2,32}", body.username):
        raise HTTPException(400, "username must be 2-32 lowercase alphanumeric / hyphen chars")

    if not RAILWAY_API_KEY:
        raise HTTPException(503, "RAILWAY_API_KEY not configured — cannot auto-provision")

    import urllib.request

    headers = {
        "Content-Type":  "application/json",
        "Authorization": f"Bearer {RAILWAY_API_KEY}",
    }

    # ── 1. Create a new Railway service by cloning the template bot service ───
    mutation = """
    mutation ServiceCreate($input: ServiceCreateInput!) {
      serviceCreate(input: $input) { id name }
    }
    """
    payload = json.dumps({
        "query": mutation,
        "variables": {
            "input": {
                "projectId":   RAILWAY_PROJECT_ID,
                "name":        f"bot-{body.username}",
                "sourceServiceId": BOT_TEMPLATE_SERVICE_ID or None,
            }
        }
    }).encode()

    req  = urllib.request.Request("https://backboard.railway.app/graphql/v2",
                                   data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        raise HTTPException(500, f"Railway API error creating service: {e}")

    errors = data.get("errors")
    if errors:
        raise HTTPException(500, f"Railway API: {errors[0].get('message')}")

    new_service_id = data["data"]["serviceCreate"]["id"]

    # ── 2. Set env vars for the new service ────────────────────────────────────
    env_mutation = """
    mutation VariableCollectionUpsert($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }
    """
    env_payload = json.dumps({
        "query": env_mutation,
        "variables": {
            "input": {
                "projectId":     RAILWAY_PROJECT_ID,
                "environmentId": RAILWAY_ENV_ID,
                "serviceId":     new_service_id,
                "variables": {
                    "BOT_USER_ID":                    body.username,
                    "HYPERLIQUID_WALLET_ADDRESS":      body.wallet,
                    "HYPERLIQUID_PRIVATE_KEY":         body.private_key,
                    "PAPER_TRADING":                   "true",
                }
            }
        }
    }).encode()

    req2 = urllib.request.Request("https://backboard.railway.app/graphql/v2",
                                   data=env_payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req2, timeout=15) as resp:
            data2 = json.loads(resp.read())
    except Exception as e:
        raise HTTPException(500, f"Railway API error setting env vars: {e}")

    if data2.get("errors"):
        raise HTTPException(500, f"Railway API env: {data2['errors'][0].get('message')}")

    # ── 3. Register in users.json for the dashboard ───────────────────────────
    users = load_users()
    if not any(u["id"] == body.username for u in users):
        users.append({
            "id":      body.username,
            "name":    body.display_name,
            "bot_dir": str(BOT_DIR),
            "color":   _COLORS[len(users) % len(_COLORS)],
            "railway_service_id": new_service_id,
        })
        if USERS_FILE.exists():
            USERS_FILE.write_text(json.dumps(users, indent=2))

    return {
        "status":     "ok",
        "user_id":    body.username,
        "service_id": new_service_id,
        "message":    (
            f"Railway service 'bot-{body.username}' created. "
            "It will start deploying automatically. "
            "Data will appear in the dashboard once the first bot cycle runs."
        ),
    }


@app.delete("/api/users/{user_id}")
def remove_user(user_id: str):
    """Remove a user from users.json. Does NOT delete the Railway service."""
    users = load_users()
    target = next((u for u in users if u["id"] == user_id), None)
    if not target:
        raise HTTPException(404, f"User '{user_id}' not found")
    updated = [u for u in users if u["id"] != user_id]
    if USERS_FILE.exists():
        USERS_FILE.write_text(json.dumps(updated, indent=2))
    return {"status": "ok", "removed": target,
            "note": "Railway service must be deleted manually in the Railway dashboard."}


@app.get("/api/users/{user_id}/service-status")
def service_status(user_id: str):
    """
    Returns Railway deployment status for a bot instance.
    Requires RAILWAY_API_KEY + railway_service_id stored in users.json.
    """
    user = users_map().get(user_id)
    if not user:
        raise HTTPException(404, f"User '{user_id}' not found")

    service_id = user.get("railway_service_id")
    if not service_id or not RAILWAY_API_KEY:
        return {"status": "unknown", "reason": "RAILWAY_API_KEY or service_id not configured"}

    import urllib.request
    query = """
    query ServiceDeployments($serviceId: String!, $environmentId: String!) {
      deployments(
        input: { serviceId: $serviceId, environmentId: $environmentId }
        last: 1
      ) {
        edges { node { id status createdAt } }
      }
    }
    """
    payload = json.dumps({
        "query": query,
        "variables": {"serviceId": service_id, "environmentId": RAILWAY_ENV_ID}
    }).encode()
    req = urllib.request.Request(
        "https://backboard.railway.app/graphql/v2",
        data=payload,
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {RAILWAY_API_KEY}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
        edges = data["data"]["deployments"]["edges"]
        latest = edges[0]["node"] if edges else {}
        return {
            "service_id":  service_id,
            "status":      latest.get("status", "NO_DEPLOYMENTS"),
            "deployed_at": latest.get("createdAt"),
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}


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
                uid = user["id"]
                bd  = Path(user["bot_dir"])
                payload[uid] = {
                    "positions":     _load_positions(bd, user_id=uid),
                    "equity":        _load_equity(bd, user_id=uid),
                    "latest_signal": (query_signals_db(bd, 1, user_id=uid) or [{}])[0],
                }
            await websocket.send_json({"type": "update", "data": payload})
            await asyncio.sleep(30)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
