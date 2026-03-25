"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { Position, EquityState, Signal } from "@/lib/types";
import clsx from "clsx";
import {
  Terminal, TrendingUp, TrendingDown, BarChart2,
} from "lucide-react";
import FullSignalPanel from "@/components/signals/FullSignalPanel";
import type { FullSignalPayload } from "@/lib/types";

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface2 rounded-xl border border-border px-4 py-3 text-center">
      <p className="text-[10px] text-muted mb-1">{label}</p>
      <p className={clsx("text-lg font-bold mono", color)}>{value}</p>
    </div>
  );
}

function formatCloseReason(result?: string | null): string {
  const r = (result || "").toUpperCase();
  if (!r) return "Closed";
  if (r === "OPPOSITE_SIGNAL") return "Closed by OPPOSITE";
  if (r === "TIMEOUT") return "Closed by TIMEOUT";
  if (r === "BOOK_PROFIT") return "Closed by BOOK_PROFIT";
  if (r === "TP") return "Closed by TP";
  if (r === "SL") return "Closed by SL";
  return `Closed by ${r}`;
}

function closeReasonColor(result?: string | null): string {
  const r = (result || "").toUpperCase();
  if (r === "TP" || r === "BOOK_PROFIT") return "text-green";
  if (r === "SL") return "text-red";
  if (r === "OPPOSITE_SIGNAL" || r === "TIMEOUT") return "text-orange";
  return "text-muted";
}

/** Merge bot KV shape (entry_price, stop_loss, target, action) with manual dashboard shape */
function normalizeOpenPosition(p: Position) {
  const entry = p.entry ?? p.entry_price ?? 0;
  const sl = p.sl ?? p.stop_loss ?? 0;
  const tp = p.tp ?? p.target ?? 0;
  const notional = p.notional ?? 0;
  const action = p.action ?? "";
  let side = (p.side || "").toUpperCase();
  if (!side && action.includes("BUY")) side = "BUY";
  if (!side && action.includes("SELL")) side = "SELL";
  if (!side) side = "—";
  const signal = (p.signal && String(p.signal).trim()) || action || "—";
  const openedAt = p.opened_at ?? "";
  const open_ts =
    p.open_ts ??
    (openedAt ? openedAt.replace("T", " ").slice(0, 16) : "–");
  let ageLabel: string;
  if (typeof p.age === "number" && p.age > 0) {
    ageLabel = `${p.age} bars`;
  } else if (openedAt) {
    try {
      const opened = new Date(openedAt).getTime();
      const h = (Date.now() - opened) / 3_600_000;
      ageLabel = h < 1 ? `${Math.round(h * 60)}m open` : `${h.toFixed(1)}h open`;
    } catch {
      ageLabel = "–";
    }
  } else {
    ageLabel = "–";
  }
  const risk = entry > 0 ? (Math.abs(entry - sl) / entry) * notional : 0;
  const reward = entry > 0 ? (Math.abs(entry - tp) / entry) * notional : 0;
  const isLong = side === "BUY";
  return { entry, sl, tp, notional, side, signal, open_ts, ageLabel, risk, reward, isLong, symbol: p.symbol };
}

export default function PaperPage() {
  const [userId, setUserId] = useState("default");
  const [selectedTrade, setSelectedTrade] = useState<Signal | null>(null);

  const { data: positions = [] } =
    useSWR<Position[]>(`/api/users/${userId}/positions`, fetcher, { refreshInterval: 15000 });

  const { data: equity }      = useSWR<EquityState>(`/api/users/${userId}/equity`,            fetcher, { refreshInterval: 30000 });
  const { data: trades = [] } = useSWR<Signal[]>(`/api/users/${userId}/trades?limit=100`,      fetcher, { refreshInterval: 30000 });
  const { data: signals = [] } = useSWR<Signal[]>(`/api/users/${userId}/signals?limit=300`,    fetcher, { refreshInterval: 30000 });

  const paperTradesRows = trades.filter((t) => Number(t.paper) === 1);
  const paperSignalsRows = signals.filter((s) => Number(s.paper) === 1);

  const paperPnl = equity?.paper_pnl ?? 0;
  const closedTrades = paperTradesRows.length;
  const wins = paperTradesRows.filter((t) => (t.pnl ?? 0) > 0).length;
  const winRate = closedTrades > 0 ? (wins / closedTrades * 100).toFixed(1) : "0.0";

  const actionableSignals = paperSignalsRows.filter((s) => {
    const a = s.action || "";
    return a === "STRONG_BUY" || a === "STRONG_SELL" || a === "WEAK_BUY" || a === "WEAK_SELL";
  });
  const strongSignals = actionableSignals.filter((s) => {
    const a = s.action || "";
    return a === "STRONG_BUY" || a === "STRONG_SELL";
  });
  const weakSignals = actionableSignals.filter((s) => {
    const a = s.action || "";
    return a === "WEAK_BUY" || a === "WEAK_SELL";
  });
  const skippedActionableSignals = actionableSignals.filter((s) =>
    (s.notes || "").toLowerCase().startsWith("skipped"),
  );
  const openedEntries = strongSignals.filter((s) => {
    const notes = (s.notes || "").toLowerCase();
    return !notes.startsWith("skipped");
  });

  const selectedPayload: FullSignalPayload | null = (() => {
    if (!selectedTrade?.full_signal) return null;
    try {
      return JSON.parse(selectedTrade.full_signal) as FullSignalPayload;
    } catch {
      return null;
    }
  })();

  return (
    <>
      <Header title="Paper Trading" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <StatPill label="Paper P&L"    value={`${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}`} color={paperPnl >= 0 ? "text-green" : "text-red"} />
          <StatPill label="Closed Trades" value={closedTrades.toString()}     color="text-blue"   />
          <StatPill label="Win Rate"     value={`${winRate}%`}               color="text-purple" />
          <StatPill label="Open Now"     value={positions.length.toString()} color="text-orange" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <StatPill label="Signals Generated (All)" value={actionableSignals.length.toString()} color="text-cyan" />
          <StatPill label="Executable (STRONG)"     value={strongSignals.length.toString()}     color="text-blue" />
          <StatPill label="Entries Opened"          value={openedEntries.length.toString()}     color="text-green" />
          <StatPill label="Signals Skipped"         value={skippedActionableSignals.length.toString()} color="text-red" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <StatPill label="Weak Signals"      value={weakSignals.length.toString()}             color="text-orange" />
          <StatPill label="Strong Signals"    value={strongSignals.length.toString()}           color="text-purple" />
          <StatPill label="Closed Trades"     value={closedTrades.toString()}                   color="text-blue" />
          <StatPill label="Data Window"       value={`${paperSignalsRows.length} rows`}        color="text-muted" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Auto simulation panel */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-blue" />
              <h2 className="text-sm font-semibold text-text">Auto Paper Simulation</h2>
            </div>
            <div className="bg-surface2 rounded-lg border border-border px-4 py-3 text-sm text-muted">
              This page is read-only. Paper trades are simulated automatically from bot signals
              (open, SL/TP/timeout/opposite-signal close, and realised P&amp;L).
            </div>
          </div>

          {/* Open positions panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={15} className="text-orange" />
                <h2 className="text-sm font-semibold text-text">Open Paper Positions ({positions.length})</h2>
              </div>

              {positions.length === 0 ? (
                <div className="py-8 text-center">
                  <Terminal size={28} className="text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-sm text-muted">No open positions</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {positions.map((p, i) => {
                    const row = normalizeOpenPosition(p);
                    const { entry, sl, tp, notional, side, signal, open_ts, ageLabel, risk, reward, isLong, symbol } = row;
                    return (
                      <div key={i} className={clsx(
                        "rounded-lg border p-4 space-y-3 relative",
                        isLong ? "border-green/20 bg-green/[0.03]" : "border-red/20 bg-red/[0.03]"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isLong
                              ? <TrendingUp  size={14} className="text-green" />
                              : <TrendingDown size={14} className="text-red"   />}
                            <span className={clsx("font-bold mono text-sm", isLong ? "text-green" : "text-red")}>
                              {side}
                            </span>
                            <span className="text-xs text-muted">· {signal}</span>
                            {symbol ? <span className="text-[10px] text-muted mono">{symbol}</span> : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {[
                            { label: "Entry",    value: `$${entry.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,    color: "text-blue"  },
                            { label: "SL",       value: `$${sl.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,      color: "text-red"   },
                            { label: "TP",       value: `$${tp.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,      color: "text-green" },
                            { label: "Notional", value: `$${notional.toFixed(0)}`,     color: "text-muted" },
                            { label: "Risk",     value: `$${risk.toFixed(2)}`,         color: "text-red"   },
                            { label: "Reward",   value: `$${reward.toFixed(2)}`,       color: "text-green" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-surface2 rounded px-2 py-1.5">
                              <p className="text-[9px] text-muted">{label}</p>
                              <p className={clsx("text-xs font-bold mono", color)}>{value}</p>
                            </div>
                          ))}
                        </div>

                        <p className="text-[10px] text-muted mono">
                          Opened: {open_ts} · {ageLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent closed paper trades */}
            {trades.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="text-xs text-muted font-medium uppercase tracking-wider mb-3">
                  Recent Closed Paper Trades
                </h2>
                <div className="space-y-2">
                  {trades.slice(0, 6).map((t, i) => {
                    const pnl = t.pnl ?? 0;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedTrade(t)}
                        className="w-full flex items-center justify-between bg-surface2 rounded-lg px-3 py-2.5 text-xs hover:bg-surface3 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={clsx("mono font-bold", t.action?.includes("BUY") ? "text-green" : "text-red")}>
                            {t.action?.includes("BUY") ? "▲" : "▼"} {t.action?.split("_")[0]}
                          </span>
                          <span className="text-muted mono">{t.timestamp?.slice(5, 16)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={clsx("mono font-bold", pnl >= 0 ? "text-green" : "text-red")}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                          </span>
                          <span className={clsx("text-[10px] mono", closeReasonColor(t.result))}>
                            {formatCloseReason(t.result)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Trade details modal */}
      {selectedTrade && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTrade(null)}
        >
          <div
            className="w-full max-w-2xl rounded-xl overflow-hidden border border-border bg-surface"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface2">
              <div className="space-y-0">
                <div className="text-xs text-muted uppercase tracking-wider">
                  Trade Detail
                </div>
                <div className="text-sm font-semibold mono">
                  {selectedTrade.action ?? "—"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTrade(null)}
                className="text-[11px] text-blue hover:underline"
              >
                Close
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* If full_signal exists, show the richer panel */}
              <FullSignalPanel payload={selectedPayload} />

              <div className="rounded-lg border border-border bg-surface2 p-3 space-y-2">
                <div className="text-xs text-muted uppercase tracking-wider">Prices & Outcome</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">Entry</div>
                    <div className="mono font-semibold">
                      ${selectedTrade.entry_price != null ? selectedTrade.entry_price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                    </div>
                  </div>
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">SL</div>
                    <div className="mono font-semibold text-red">
                      ${selectedTrade.stop_loss != null ? selectedTrade.stop_loss.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                    </div>
                  </div>
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">TP</div>
                    <div className="mono font-semibold text-green">
                      ${selectedTrade.target != null ? selectedTrade.target.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                    </div>
                  </div>
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">Close</div>
                    <div className="mono font-semibold">
                      ${selectedTrade.close_price != null ? selectedTrade.close_price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">Notional</div>
                    <div className="mono font-semibold">
                      ${selectedTrade.position_size_usdt != null ? selectedTrade.position_size_usdt.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "–"}
                    </div>
                  </div>
                  <div className="bg-surface rounded px-2 py-1">
                    <div className="text-[10px] text-muted">P&amp;L</div>
                    <div className={clsx("mono font-semibold", (selectedTrade.pnl ?? 0) >= 0 ? "text-green" : "text-red")}>
                      {(selectedTrade.pnl ?? 0) >= 0 ? "+" : ""}{(selectedTrade.pnl ?? 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-xs">
                  <div className="text-[10px] text-muted uppercase tracking-wider">Result</div>
                  <div className={clsx("mono font-semibold", closeReasonColor(selectedTrade.result))}>
                    {formatCloseReason(selectedTrade.result)}
                  </div>
                </div>

                {selectedTrade.notes && (
                  <div className="text-xs text-muted">
                    <div className="text-[10px] text-muted uppercase tracking-wider">Notes</div>
                    <div className="mono whitespace-pre-wrap">{selectedTrade.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
