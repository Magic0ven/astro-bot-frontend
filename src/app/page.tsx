"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import Header from "@/components/layout/Header";
import { ACTION_BG } from "@/lib/types";
import type { Stats, Signal, Position, EquityState } from "@/lib/types";
import {
  TrendingUp, TrendingDown, Activity, Target,
  AlertTriangle, Clock, BarChart2, Layers,
} from "lucide-react";
import clsx from "clsx";

function StatCard({
  icon: Icon, label, value, sub, color = "blue", glow = false,
}: {
  icon: React.ElementType; label: string; value: string;
  sub?: string; color?: string; glow?: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue:   "text-blue border-blue/20 bg-blue/5",
    green:  "text-green border-green/20 bg-green/5",
    red:    "text-red border-red/20 bg-red/5",
    orange: "text-orange border-orange/20 bg-orange/5",
    purple: "text-purple border-purple/20 bg-purple/5",
  };
  return (
    <div className={clsx(
      "rounded-xl border p-4 flex items-start gap-4 transition-all",
      "bg-surface", glow ? `${colorMap[color]} shadow-lg` : "border-border"
    )}>
      <div className={clsx("p-2 rounded-lg", colorMap[color])}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted mb-0.5">{label}</p>
        <p className={clsx("text-xl font-bold mono", `text-${color}`)}>{value}</p>
        {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const action = signal.action ?? "–";
  const badge  = ACTION_BG[action] ?? "bg-surface2 text-muted border border-border";
  const isBuy  = action.includes("BUY");
  const isSell = action.includes("SELL");

  return (
    <div className="rounded-xl border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted font-medium uppercase tracking-wider">Latest Signal</p>
        <span className={clsx("text-xs font-bold px-3 py-1 rounded-full mono", badge)}>{action}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          { label: "Entry",  value: signal.entry_price  ? `$${signal.entry_price.toLocaleString()}` : "–", color: "text-text" },
          { label: "Stop",   value: signal.stop_loss    ? `$${signal.stop_loss.toLocaleString()}`   : "–", color: "text-red" },
          { label: "Target", value: signal.target       ? `$${signal.target.toLocaleString()}`      : "–", color: "text-green" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface2 rounded-lg p-3">
            <p className="text-[10px] text-muted mb-1">{label}</p>
            <p className={clsx("text-sm font-bold mono", color)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          { label: "Western",   value: signal.western_signal ?? "–" },
          { label: "Vedic",     value: signal.vedic_signal   ?? "–" },
          { label: "Nakshatra", value: signal.nakshatra      ?? "–" },
          { label: "Size",      value: signal.position_size_usdt ? `$${signal.position_size_usdt}` : "–" },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between bg-surface2 rounded px-3 py-2">
            <span className="text-muted">{label}</span>
            <span className="mono text-text">{value}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted text-right mono">
        {signal.timestamp ? new Date(signal.timestamp).toUTCString().slice(5, 25) : ""}
      </p>
    </div>
  );
}

function OpenPositionsCard({ positions }: { positions: Position[] }) {
  if (!positions.length) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Open Positions</p>
        <p className="text-sm text-muted text-center py-4">No open positions</p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">
        Open Positions ({positions.length})
      </p>
      <div className="space-y-2">
        {positions.map((p, i) => (
          <div key={i} className="flex items-center justify-between bg-surface2 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={clsx("text-xs font-bold mono", p.side === "BUY" ? "text-green" : "text-red")}>
                {p.side}
              </span>
              <span className="text-xs text-muted">{p.signal}</span>
            </div>
            <div className="text-right">
              <p className="text-xs mono text-text">${(p.entry ?? 0).toLocaleString()}</p>
              <p className="text-[10px] text-muted">SL ${(p.sl ?? 0).toLocaleString()} · TP ${(p.tp ?? 0).toLocaleString()}</p>
            </div>
            <span className="text-[10px] text-muted mono">{p.age ?? 0}b</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentTrades({ trades }: { trades: Signal[] }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">Recent Closed Trades</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted border-b border-border">
              {["Time", "Action", "Entry", "Close", "P&L", "Result"].map(h => (
                <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 8).map((t, i) => {
              const pnl = t.pnl ?? 0;
              return (
                <tr key={i} className="border-b border-border/50 hover:bg-surface2 transition-colors">
                  <td className="py-2 pr-4 mono text-muted">{t.timestamp?.slice(5, 16) ?? "–"}</td>
                  <td className="py-2 pr-4">
                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold", ACTION_BG[t.action] ?? "")}>
                      {t.action}
                    </span>
                  </td>
                  <td className="py-2 pr-4 mono">${t.entry_price?.toLocaleString() ?? "–"}</td>
                  <td className="py-2 pr-4 mono">${t.close_price?.toLocaleString() ?? "–"}</td>
                  <td className={clsx("py-2 pr-4 mono font-bold", pnl >= 0 ? "text-green" : "text-red")}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                  </td>
                  <td className={clsx("py-2 mono text-[10px]",
                    t.result === "WIN" ? "text-green" : t.result === "STOP" ? "text-red" : "text-orange")}>
                    {t.result ?? "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [userId, setUserId] = useState("default");

  const { data: stats }    = useSWR<Stats>  (`/api/users/${userId}/stats`,         fetcher, { refreshInterval: 30000 });
  const { data: signals }  = useSWR<Signal[]>(`/api/users/${userId}/signals?limit=1`, fetcher, { refreshInterval: 30000 });
  const { data: positions }= useSWR<Position[]>(`/api/users/${userId}/positions`,  fetcher, { refreshInterval: 30000 });
  const { data: trades }   = useSWR<Signal[]>(`/api/users/${userId}/trades?limit=50`, fetcher, { refreshInterval: 30000 });
  const { data: equity }   = useSWR<EquityState>(`/api/users/${userId}/equity`,    fetcher, { refreshInterval: 30000 });

  const latest   = signals?.[0];
  const paperPnl = equity?.paper_pnl ?? 0;

  return (
    <>
      <Header title="Dashboard" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-6 overflow-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={BarChart2} label="Total Trades" color="blue"
            value={stats?.trades?.toString() ?? "–"}
            sub={`${stats?.wins ?? 0}W / ${stats?.losses ?? 0}L`}
          />
          <StatCard
            icon={Target} label="Win Rate" color="green"
            value={stats ? `${stats.win_rate}%` : "–"}
            sub={`Avg W $${stats?.avg_win?.toFixed(2) ?? "–"}`}
            glow={(stats?.win_rate ?? 0) >= 50}
          />
          <StatCard
            icon={stats && (stats.total_pnl >= 0) ? TrendingUp : TrendingDown}
            label="Total P&L (Paper)" color={paperPnl >= 0 ? "green" : "red"}
            value={`${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}`}
            sub={`Peak $${(equity?.peak_equity ?? 0).toLocaleString()}`}
            glow
          />
          <StatCard
            icon={Layers} label="Open Positions" color="orange"
            value={positions?.length?.toString() ?? "0"}
            sub="Active trades"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Latest signal — 1 col */}
          <div className="lg:col-span-1 space-y-4">
            {latest ? <SignalCard signal={latest} /> : (
              <div className="rounded-xl border border-border bg-surface p-8 text-center">
                <Activity size={24} className="text-muted mx-auto mb-2" />
                <p className="text-sm text-muted">No signal data yet</p>
              </div>
            )}

            {/* Quick equity snapshot */}
            {equity && (
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <p className="text-xs text-muted font-medium uppercase tracking-wider">Equity Snapshot</p>
                {[
                  { label: "Paper P&L",   value: `${paperPnl >= 0 ? "+" : ""}$${paperPnl.toFixed(2)}`, color: paperPnl >= 0 ? "text-green" : "text-red" },
                  { label: "Peak Equity", value: `$${(equity.peak_equity ?? 0).toLocaleString()}`,      color: "text-blue" },
                  { label: "Paper Trades",value: `${equity.paper_trades ?? 0}`,                        color: "text-muted" },
                  { label: "Win Rate",    value: `${stats?.win_rate ?? 0}%`,                            color: "text-text" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center text-sm">
                    <span className="text-muted text-xs">{label}</span>
                    <span className={clsx("mono font-bold text-sm", color)}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right side — 2 cols */}
          <div className="lg:col-span-2 space-y-4">
            <OpenPositionsCard positions={positions ?? []} />
            {trades && trades.length > 0 && <RecentTrades trades={trades} />}
          </div>
        </div>
      </div>
    </>
  );
}
