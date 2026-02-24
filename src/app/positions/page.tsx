"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { Position, Signal } from "@/lib/types";
import { ACTION_BG } from "@/lib/types";
import clsx from "clsx";
import { Clock, TrendingUp, TrendingDown, Filter } from "lucide-react";

type Tab = "open" | "closed";
type SideFilter = "all" | "BUY" | "SELL";

function PnlBadge({ pnl }: { pnl: number | null }) {
  if (pnl === null) return <span className="text-muted mono">–</span>;
  return (
    <span className={clsx("font-bold mono", pnl >= 0 ? "text-green" : "text-red")}>
      {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
    </span>
  );
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span className="text-muted mono text-[10px]">OPEN</span>;
  const c = result === "WIN" ? "bg-green/10 text-green border-green/20"
          : result.startsWith("STOP") ? "bg-red/10 text-red border-red/20"
          : "bg-orange/10 text-orange border-orange/20";
  return (
    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border mono", c)}>
      {result}
    </span>
  );
}

export default function PositionsPage() {
  const [userId,     setUserId]     = useState("default");
  const [tab,        setTab]        = useState<Tab>("open");
  const [sideFilter, setSideFilter] = useState<SideFilter>("all");

  const { data: openPos = [] }    = useSWR<Position[]>(`/api/users/${userId}/positions`,          fetcher, { refreshInterval: 15000 });
  const { data: closedTrades = []}= useSWR<Signal[]>  (`/api/users/${userId}/trades?limit=200`,   fetcher, { refreshInterval: 30000 });

  const filteredClosed = sideFilter === "all"
    ? closedTrades
    : closedTrades.filter(t => t.action?.includes(sideFilter));

  const totalPnl   = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const wins       = closedTrades.filter(t => (t.pnl ?? 0) > 0);
  const losses     = closedTrades.filter(t => (t.pnl ?? 0) <= 0);
  const winRate    = closedTrades.length ? (wins.length / closedTrades.length * 100) : 0;

  return (
    <>
      <Header title="Positions" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-5">

        {/* Summary strip */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Closed Trades", value: closedTrades.length.toString(),                              color: "text-blue"   },
            { label: "Win Rate",      value: `${winRate.toFixed(1)}%`,                                    color: "text-green"  },
            { label: "Total P&L",     value: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`,       color: totalPnl >= 0 ? "text-green" : "text-red" },
            { label: "Open Now",      value: openPos.length.toString(),                                   color: "text-orange" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface rounded-xl border border-border px-5 py-4">
              <p className="text-[11px] text-muted mb-1">{label}</p>
              <p className={clsx("text-2xl font-bold mono", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1 bg-surface2 rounded-lg p-1">
            {(["open", "closed"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize",
                  tab === t ? "bg-blue/20 text-blue border border-blue/30" : "text-muted hover:text-text"
                )}
              >
                {t} {t === "open" ? `(${openPos.length})` : `(${closedTrades.length})`}
              </button>
            ))}
          </div>

          {tab === "closed" && (
            <div className="flex items-center gap-2">
              <Filter size={13} className="text-muted" />
              <div className="flex gap-1 bg-surface2 rounded-lg p-1">
                {(["all", "BUY", "SELL"] as SideFilter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setSideFilter(f)}
                    className={clsx(
                      "px-3 py-1 rounded-md text-xs font-medium mono transition-all",
                      sideFilter === f ? "bg-surface border border-border text-text" : "text-muted hover:text-text"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Open positions */}
        {tab === "open" && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {openPos.length === 0 ? (
              <div className="p-12 text-center">
                <Clock size={32} className="text-muted mx-auto mb-3 opacity-50" />
                <p className="text-muted text-sm">No open positions</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface2 border-b border-border">
                  <tr className="text-muted">
                    {["Side", "Signal", "Entry", "Stop Loss", "Take Profit", "Notional", "Risk", "Age", "Opened"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {openPos.map((p, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3">
                        <span className={clsx(
                          "font-bold mono flex items-center gap-1",
                          p.side === "BUY" ? "text-green" : "text-red"
                        )}>
                          {p.side === "BUY" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {p.side}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border", ACTION_BG[p.signal] ?? "bg-surface2 text-muted border-border")}>
                          {p.signal}
                        </span>
                      </td>
                      <td className="px-4 py-3 mono text-blue font-semibold">${(p.entry ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 mono text-red">${(p.sl ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 mono text-green">${(p.tp ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 mono text-muted">${(p.notional ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 mono text-muted">${(p.risk ?? 0).toFixed(2)}</td>
                      <td className="px-4 py-3 mono text-orange">{p.age ?? 0} bars</td>
                      <td className="px-4 py-3 mono text-muted">{p.open_ts ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Closed trades */}
        {tab === "closed" && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            {filteredClosed.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-muted text-sm">No closed trades yet</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-surface2 border-b border-border">
                  <tr className="text-muted">
                    {["Time", "Action", "Entry", "Close", "P&L", "Result", "Nakshatra", "W Score", "V Score"].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredClosed.map((t, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-surface2 transition-colors">
                      <td className="px-4 py-3 mono text-muted">{t.timestamp?.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-4 py-3">
                        <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold border", ACTION_BG[t.action] ?? "")}>
                          {t.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 mono">${t.entry_price?.toLocaleString() ?? "–"}</td>
                      <td className="px-4 py-3 mono">${t.close_price?.toLocaleString() ?? "–"}</td>
                      <td className="px-4 py-3"><PnlBadge pnl={t.pnl ?? null} /></td>
                      <td className="px-4 py-3"><ResultBadge result={t.result ?? null} /></td>
                      <td className="px-4 py-3 mono text-muted">{t.nakshatra ?? "–"}</td>
                      <td className="px-4 py-3 mono text-muted">{t.western_score?.toFixed(2) ?? "–"}</td>
                      <td className="px-4 py-3 mono text-muted">{t.vedic_score?.toFixed(2) ?? "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}
