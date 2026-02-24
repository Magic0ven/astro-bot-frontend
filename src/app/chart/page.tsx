"use client";

import { useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { fetcher } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { OHLCVCandle, Signal, Position } from "@/lib/types";
import { ACTION_BG } from "@/lib/types";
import clsx from "clsx";

const TradingChart = dynamic(() => import("@/components/chart/TradingChart"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-surface2 rounded-b-xl flex items-center justify-center">
      <p className="text-muted text-sm animate-pulse">Loading chart…</p>
    </div>
  ),
});

const TIMEFRAMES = ["1h", "4h", "1d"];

export default function ChartPage() {
  const [userId, setUserId] = useState("default");
  const [tf, setTf]         = useState("4h");

  const { data: candles = [] }   = useSWR<OHLCVCandle[]>(
    `/api/ohlcv?symbol=BTC%2FUSDT&timeframe=${tf}&limit=500`, fetcher,
    { refreshInterval: 60000 }
  );
  const { data: signals = [] }   = useSWR<Signal[]>(
    `/api/users/${userId}/signals?limit=200`, fetcher, { refreshInterval: 30000 }
  );
  const { data: positions = [] } = useSWR<Position[]>(
    `/api/users/${userId}/positions`, fetcher, { refreshInterval: 30000 }
  );

  const latestCandle = candles[candles.length - 1];
  const prevCandle   = candles[candles.length - 2];
  const priceDiff    = latestCandle && prevCandle
    ? ((latestCandle.close - prevCandle.close) / prevCandle.close) * 100 : 0;

  return (
    <>
      <Header title="Chart" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-2xl font-bold mono text-text">
                {latestCandle ? `$${latestCandle.close.toLocaleString()}` : "–"}
              </span>
              <span className={clsx(
                "ml-3 text-sm mono font-semibold",
                priceDiff >= 0 ? "text-green" : "text-red"
              )}>
                {priceDiff >= 0 ? "+" : ""}{priceDiff.toFixed(2)}%
              </span>
            </div>
            <span className="text-xs text-muted">BTC/USDT</span>
          </div>

          {/* Timeframe picker */}
          <div className="flex gap-1 bg-surface2 rounded-lg p-1">
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={clsx(
                  "px-3 py-1.5 rounded-md text-xs font-medium mono transition-all",
                  tf === t
                    ? "bg-blue/20 text-blue border border-blue/30"
                    : "text-muted hover:text-text"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-xs text-muted">
              BTC/USDT · {tf.toUpperCase()} · Markers = trade entries
            </p>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-green inline-block rounded" />Buy entry</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red inline-block rounded" />Sell entry</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue border-dashed border-b inline-block" />Open position</span>
            </div>
          </div>
          <TradingChart candles={candles} signals={signals} positions={positions} />
        </div>

        {/* Recent signals table under chart */}
        {signals.length > 0 && (
          <div className="rounded-xl border border-border bg-surface p-5">
            <p className="text-xs text-muted font-medium uppercase tracking-wider mb-3">
              Plotted Trade Signals
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted border-b border-border">
                    {["Time", "Action", "Entry", "SL", "TP", "Size", "Result", "P&L"].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {signals.filter(s => s.entry_price).slice(0, 12).map((s, i) => {
                    const pnl = s.pnl ?? null;
                    return (
                      <tr key={i} className="border-b border-border/40 hover:bg-surface2 transition-colors">
                        <td className="py-2 pr-4 mono text-muted">{s.timestamp?.slice(5, 16)}</td>
                        <td className="py-2 pr-4">
                          <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold", ACTION_BG[s.action] ?? "")}>
                            {s.action}
                          </span>
                        </td>
                        <td className="py-2 pr-4 mono">${s.entry_price?.toLocaleString() ?? "–"}</td>
                        <td className="py-2 pr-4 mono text-red">${s.stop_loss?.toLocaleString() ?? "–"}</td>
                        <td className="py-2 pr-4 mono text-green">${s.target?.toLocaleString() ?? "–"}</td>
                        <td className="py-2 pr-4 mono text-muted">${s.position_size_usdt ?? "–"}</td>
                        <td className={clsx("py-2 pr-4 mono text-[10px] font-semibold",
                          s.result === "WIN" ? "text-green" : s.result === "STOP" ? "text-red" : "text-orange")}>
                          {s.result ?? "OPEN"}
                        </td>
                        <td className={clsx("py-2 mono font-bold", pnl === null ? "text-muted" : pnl >= 0 ? "text-green" : "text-red")}>
                          {pnl !== null ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}` : "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
