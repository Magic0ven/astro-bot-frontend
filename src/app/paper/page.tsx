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

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface2 rounded-xl border border-border px-4 py-3 text-center">
      <p className="text-[10px] text-muted mb-1">{label}</p>
      <p className={clsx("text-lg font-bold mono", color)}>{value}</p>
    </div>
  );
}

export default function PaperPage() {
  const [userId, setUserId] = useState("default");

  const { data: positions = [] } =
    useSWR<Position[]>(`/api/users/${userId}/positions`, fetcher, { refreshInterval: 15000 });

  const { data: equity }     = useSWR<EquityState>(`/api/users/${userId}/equity`,          fetcher, { refreshInterval: 30000 });
  const { data: trades = [] } = useSWR<Signal[]>  (`/api/users/${userId}/trades?limit=50`, fetcher, { refreshInterval: 30000 });

  const paperPnl   = equity?.paper_pnl   ?? 0;
  const paperTrades= equity?.paper_trades ?? trades.length;
  const wins       = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate    = paperTrades > 0 ? (wins / paperTrades * 100).toFixed(1) : "0.0";

  return (
    <>
      <Header title="Paper Trading" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-4">
          <StatPill label="Paper P&L"    value={`${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}`} color={paperPnl >= 0 ? "text-green" : "text-red"} />
          <StatPill label="Total Trades" value={paperTrades.toString()}      color="text-blue"   />
          <StatPill label="Win Rate"     value={`${winRate}%`}               color="text-purple" />
          <StatPill label="Open Now"     value={positions.length.toString()} color="text-orange" />
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
                    const entry  = p.entry    ?? 0;
                    const sl     = p.sl       ?? 0;
                    const tp     = p.tp       ?? 0;
                    const notional = p.notional ?? 0;
                    const risk   = entry > 0 ? Math.abs(entry - sl)  / entry * notional : 0;
                    const reward = entry > 0 ? Math.abs(entry - tp)  / entry * notional : 0;
                    return (
                      <div key={i} className={clsx(
                        "rounded-lg border p-4 space-y-3 relative",
                        p.side === "BUY" ? "border-green/20 bg-green/[0.03]" : "border-red/20 bg-red/[0.03]"
                      )}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {p.side === "BUY"
                              ? <TrendingUp  size={14} className="text-green" />
                              : <TrendingDown size={14} className="text-red"   />}
                            <span className={clsx("font-bold mono text-sm", p.side === "BUY" ? "text-green" : "text-red")}>
                              {p.side}
                            </span>
                            <span className="text-xs text-muted">· {p.signal}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {[
                            { label: "Entry",    value: `$${entry.toLocaleString()}`,    color: "text-blue"  },
                            { label: "SL",       value: `$${sl.toLocaleString()}`,      color: "text-red"   },
                            { label: "TP",       value: `$${tp.toLocaleString()}`,      color: "text-green" },
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
                          Opened: {p.open_ts ?? "–"} · Age: {p.age ?? 0} bars
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
                      <div key={i} className="flex items-center justify-between bg-surface2 rounded-lg px-3 py-2.5 text-xs">
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
                          <span className={clsx("text-[10px] mono",
                            t.result === "WIN" ? "text-green" : t.result?.startsWith("STOP") ? "text-red" : "text-orange")}>
                            {t.result}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
