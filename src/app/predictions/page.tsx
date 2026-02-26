"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { api } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { Signal, PredictionsCalendarDay } from "@/lib/types";
import { ACTION_BG } from "@/lib/types";
import clsx from "clsx";
import { Target, TrendingUp, TrendingDown, Minus, Calendar } from "lucide-react";

function pct(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildMonthGrid(year: number, month: number): (number | null)[] {
  const first = new Date(year, month - 1, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateKey(year: number, month: number, day: number): string {
  const m = month < 10 ? `0${month}` : String(month);
  const d = day < 10 ? `0${day}` : String(day);
  return `${year}-${m}-${d}`;
}

const CURRENT_YEAR = new Date().getFullYear();

export default function PredictionsPage() {
  const [userId, setUserId] = useState("default");
  const [selectedMonth, setSelectedMonth] = useState(1);   // January default
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);

  const { data: calendar, isLoading: calendarLoading } = useSWR(
    ["predictions-calendar", CURRENT_YEAR],
    () => api.predictionsCalendar(CURRENT_YEAR),
    { revalidateOnFocus: false }
  );

  const { data: signals = [], isLoading: signalsLoading } = useSWR<Signal[]>(
    `/api/users/${userId}/signals?limit=200`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const { data: ticker = {}, isLoading: tickerLoading } = useSWR(
    "ticker",
    () => api.ticker(),
    { refreshInterval: 15000 }
  );

  // Predictions = signals with levels, excluding NO_TRADE and HOLD
  const predictions = signals.filter(
    (s) =>
      (s.entry_price != null || s.stop_loss != null || s.target != null) &&
      s.symbol &&
      s.action !== "NO_TRADE" &&
      s.action !== "HOLD"
  );

  const getCurrentPrice = (symbol: string): number | null => {
    const coin = symbol.split("/")[0];
    const p = ticker[coin];
    return typeof p === "number" && Number.isFinite(p) ? p : null;
  };

  return (
    <>
      <Header title="Predictions" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-6">
        {/* Calendar: predictions till 31 December */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-surface2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-blue" />
              <span className="text-sm font-semibold">Predicted calendar till 31 December</span>
            </div>
            {calendar && !calendar.unavailable && calendar.asset && (
              <span className="text-[11px] text-muted">
                {calendar.asset} · Life Path {calendar.life_path_number} · {calendar.from} → {calendar.to}
              </span>
            )}
          </div>
          {calendarLoading && (
            <div className="p-8 text-center text-muted text-sm">Loading calendar…</div>
          )}
          {!calendarLoading && (!calendar || calendar.unavailable) && (
            <div className="p-6 text-center">
              <p className="text-muted text-sm font-medium">{calendar?.reason ?? "Calendar unavailable"}</p>
              {calendar?.hint && <p className="text-[11px] text-muted mt-1">{calendar.hint}</p>}
              {calendar?.tried_paths && calendar.tried_paths.length > 0 && (
                <p className="text-[10px] text-muted/80 mt-2 mono max-w-md mx-auto break-all">
                  Tried: {calendar.tried_paths.join(", ")}
                </p>
              )}
            </div>
          )}
          {calendar && !calendarLoading && !calendar.unavailable && calendar.days?.length > 0 && (
            <div className="p-4">
              <p className="text-[11px] text-muted mb-4">
                UDN = Universal Day Number. Resonance = UDN matches asset Life Path (1.5× size days).
                {calendar.days.some((d) => d.action) && " Prediction = signal from bot (Western + Vedic + numerology)."}
              </p>

              {/* Month + Year selector */}
              <div className="flex items-center gap-3 mb-4">
                <label className="text-xs font-medium text-muted">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue/30"
                >
                  {MONTH_NAMES.map((name, i) => (
                    <option key={i} value={i + 1}>{name}</option>
                  ))}
                </select>
                <label className="text-xs font-medium text-muted">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-surface2 border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-blue/30"
                >
                  {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].filter((y) => y >= 2024).map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Calendar grid */}
              <div className="border border-border rounded-lg overflow-hidden bg-surface2/30">
                <div className="grid grid-cols-7 text-[11px] font-medium text-muted uppercase tracking-wider border-b border-border bg-surface2">
                  {WEEKDAYS.map((w) => (
                    <div key={w} className="p-2 text-center">{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 [&>div:nth-child(7n)]:border-r-0">
                  {(() => {
                    const dayMap = new Map<string, PredictionsCalendarDay>();
                    for (const d of calendar.days) dayMap.set(d.date, d);
                    const cells = buildMonthGrid(selectedYear, selectedMonth);
                    const hasPrediction = calendar.days.some((d) => d.action);
                    return cells.map((dayNum, idx) => {
                      if (dayNum === null) {
                        return <div key={`e-${idx}`} className="min-h-[88px] p-2 border-b border-r border-border/50 bg-surface/50" />;
                      }
                      const key = dateKey(selectedYear, selectedMonth, dayNum);
                      const data = dayMap.get(key);
                      return (
                        <div
                          key={key}
                          className={clsx(
                            "min-h-[88px] p-2 border-b border-r border-border/50 flex flex-col",
                            data?.resonance ? "bg-green/10" : "bg-surface"
                          )}
                        >
                          <span className="text-sm font-semibold text-muted">{dayNum}</span>
                          {data && (
                            <>
                              <span className="text-[10px] mono font-semibold mt-0.5">UDN {data.udn}</span>
                              <span className={clsx("text-[10px] mt-0.5", data.resonance ? "text-green font-medium" : "text-muted")}>
                                {data.resonance ? "1.5×" : "1.0×"}
                              </span>
                              {hasPrediction && data.action && (
                                <span
                                  className={clsx(
                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold mono mt-1 w-fit",
                                    ACTION_BG[data.action] ?? "bg-surface2 text-muted border border-border"
                                  )}
                                >
                                  {data.action.includes("BUY") && <TrendingUp size={8} />}
                                  {data.action.includes("SELL") && <TrendingDown size={8} />}
                                  {!data.action.includes("BUY") && !data.action.includes("SELL") && <Minus size={8} />}
                                  {data.action.replace("STRONG_", "").replace("WEAK_", "")}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Trade signals only (Entry / SL / TP) vs current market price. NO_TRADE and HOLD hidden. Market
            data from Hyperliquid.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green/60" />
              Long
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red/60" />
              Short
            </span>
          </div>
        </div>

        {(signalsLoading || tickerLoading) && predictions.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <Target size={24} className="text-muted mx-auto mb-2 animate-pulse" />
            <p className="text-muted text-sm">Loading predictions and market data…</p>
          </div>
        )}

        {!signalsLoading && predictions.length === 0 && (
          <div className="rounded-xl border border-border bg-surface p-12 text-center">
            <p className="text-muted text-sm">No trade signals (BUY/SELL) with predicted levels. NO_TRADE and HOLD are hidden.</p>
          </div>
        )}

        {predictions.length > 0 && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface2 text-left text-[11px] font-medium text-muted uppercase tracking-wider">
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3 text-right">Entry</th>
                    <th className="px-4 py-3 text-right">SL</th>
                    <th className="px-4 py-3 text-right">TP</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">% to TP</th>
                    <th className="px-4 py-3 text-right">% to SL</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.slice(0, 80).map((s) => {
                    const action = s.action ?? "–";
                    const isBuy = action.includes("BUY");
                    const isSell = action.includes("SELL");
                    const badge =
                      ACTION_BG[action] ??
                      "bg-surface2 text-muted border border-border";
                    const entry = s.entry_price ?? null;
                    const sl = s.stop_loss ?? null;
                    const tp = s.target ?? null;
                    const current = getCurrentPrice(s.symbol ?? "");
                    const pctToTp =
                      current != null && tp != null ? pct(current, tp) : null;
                    const pctToSl =
                      current != null && sl != null ? pct(current, sl) : null;

                    return (
                      <tr
                        key={s.id}
                        className={clsx(
                          "border-b border-border/50 last:border-0",
                          isBuy && "bg-green/[0.03]",
                          isSell && "bg-red/[0.03]"
                        )}
                      >
                        <td className="px-4 py-2.5 mono text-[11px] text-muted">
                          {s.timestamp
                            ? new Date(s.timestamp).toUTCString().slice(5, 22)
                            : "–"}
                        </td>
                        <td className="px-4 py-2.5 font-medium">
                          {s.symbol ?? "–"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={clsx(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mono",
                              badge
                            )}
                          >
                            {isBuy && <TrendingUp size={10} />}
                            {isSell && <TrendingDown size={10} />}
                            {!isBuy && !isSell && <Minus size={10} />}
                            {action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right mono">
                          {entry != null
                            ? `$${entry.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right mono text-red">
                          {sl != null
                            ? `$${sl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right mono text-green">
                          {tp != null
                            ? `$${tp.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right mono text-blue font-semibold">
                          {current != null
                            ? `$${current.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                            : "–"}
                        </td>
                        <td className="px-4 py-2.5 text-right mono">
                          {pctToTp != null ? (
                            <span
                              className={
                                pctToTp >= 0 ? "text-green" : "text-red"
                              }
                            >
                              {pctToTp >= 0 ? "+" : ""}
                              {pctToTp.toFixed(2)}%
                            </span>
                          ) : (
                            "–"
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right mono">
                          {pctToSl != null ? (
                            <span
                              className={
                                pctToSl <= 0 ? "text-green" : "text-red"
                              }
                            >
                              {pctToSl >= 0 ? "+" : ""}
                              {pctToSl.toFixed(2)}%
                            </span>
                          ) : (
                            "–"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-border bg-surface2 text-[11px] text-muted">
              Trade signals only (NO_TRADE / HOLD hidden). Up to 80 most recent. Current
              price refreshes every 15s from Hyperliquid.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
