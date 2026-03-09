"use client";

import { useState, useEffect } from "react";
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

function actionDisplayLabel(action: string): string {
  if (action === "STRONG_BUY") return "Strong Buy";
  if (action === "WEAK_BUY") return "Weak Buy";
  if (action === "STRONG_SELL") return "Strong Sell";
  if (action === "WEAK_SELL") return "Weak Sell";
  if (action === "NO_TRADE") return "No Trade";
  if (action === "HOLD") return "Hold";
  if (action === "COLLECTING_DATA") return "…";
  return action.replace(/_/g, " ");
}

function formatPrice(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return value.toFixed(2);
}

export default function PredictionsPage() {
  const [userId, setUserId] = useState("default");
  const [selectedMonth, setSelectedMonth] = useState(1);   // January default
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDayKey(null);
  }, [selectedMonth, selectedYear]);

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
                {calendar.asset}
                {calendar.life_path_number != null && ` · Life Path ${calendar.life_path_number}`}
                {calendar.from && calendar.to && ` · ${calendar.from} → ${calendar.to}`}
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
                {calendar.days.some((d) => d.pred_median != null || d.predicted_price != null) && "Price = predicted price (median or range) for that day. "}
                {calendar.days.some((d) => d.action) && "Signal = from bot (Western + Vedic + numerology). "}
                Click a day to see astrology and price detail.
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
                    const hasAction = calendar.days.some((d) => d.action);
                    const priceForDay = (d: PredictionsCalendarDay) => d.pred_median ?? d.predicted_price ?? null;
                    return cells.map((dayNum, idx) => {
                      if (dayNum === null) {
                        return <div key={`e-${idx}`} className="min-h-[88px] p-2 border-b border-r border-border/50 bg-surface/50" />;
                      }
                      const key = dateKey(selectedYear, selectedMonth, dayNum);
                      const data = dayMap.get(key);
                      const isSelected = selectedDayKey === key;
                      const price = data ? priceForDay(data) : null;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDayKey(data ? (isSelected ? null : key) : null)}
                          className={clsx(
                            "min-h-[88px] p-2 border-b border-r border-border/50 flex flex-col text-left w-full",
                            data?.resonance ? "bg-green/10" : "bg-surface",
                            data && "hover:bg-surface2/80 cursor-pointer transition-colors",
                            isSelected && "ring-2 ring-blue ring-inset"
                          )}
                        >
                          <span className="text-sm font-semibold text-muted">{dayNum}</span>
                          {data && (
                            <>
                              {data.udn != null && <span className="text-[10px] mono font-semibold mt-0.5">UDN {data.udn}</span>}
                              {data.resonance != null && (
                                <span className={clsx("text-[10px] mt-0.5", data.resonance ? "text-green font-medium" : "text-muted")}>
                                  {data.resonance ? "1.5×" : "1.0×"}
                                </span>
                              )}
                              {hasAction && data.action && (
                                <span
                                  className={clsx(
                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold mono mt-1 w-fit",
                                    ACTION_BG[data.action] ?? "bg-surface2 text-muted border border-border"
                                  )}
                                >
                                  {data.action.includes("BUY") && <TrendingUp size={8} />}
                                  {data.action.includes("SELL") && <TrendingDown size={8} />}
                                  {!data.action.includes("BUY") && !data.action.includes("SELL") && <Minus size={8} />}
                                  {actionDisplayLabel(data.action)}
                                </span>
                              )}
                              {price != null && (
                                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 mono" title="Predicted price for this day">
                                  ${formatPrice(price)}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Why this signal: factors for selected day */}
              {selectedDayKey && (() => {
                const dayData = calendar.days.find((d) => d.date === selectedDayKey);
                if (!dayData) return null;
                const wScore = dayData.western_score ?? 0;
                const vScore = dayData.vedic_score ?? 0;
                const wMed = dayData.western_medium ?? null;
                const vMed = dayData.vedic_medium ?? null;
                const wSlope = dayData.western_slope ?? null;
                const vSlope = dayData.vedic_slope ?? null;
                const wSig = dayData.western_signal ?? "–";
                const vSig = dayData.vedic_signal ?? "–";
                const naks = dayData.nakshatra ?? "–";
                const retroW = (dayData.retrograde_western ?? []).filter(Boolean);
                const retroV = (dayData.retrograde_vedic ?? []).filter(Boolean);
                const numLabel = dayData.numerology_label ?? "";
                const numMult = dayData.numerology_mult ?? dayData.multiplier ?? 1.0;
                const lifePath = calendar.life_path_number ?? null;
                return (
                  <div className="mt-4 p-4 rounded-lg border border-border bg-surface2/50">
                    {(dayData.pred_median != null || dayData.predicted_price != null) && (
                      <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <p className="text-[11px] text-muted uppercase tracking-wider mb-0.5">Predicted price for this day</p>
                        {dayData.pred_median != null ? (
                          <>
                            <p className="text-xl font-bold mono text-amber-600 dark:text-amber-400">${formatPrice(dayData.pred_median)}</p>
                            {(dayData.pred_low != null || dayData.pred_high != null) && (
                              <p className="text-xs text-muted mt-1">
                                Range: ${formatPrice(dayData.pred_low ?? dayData.pred_median)} – ${formatPrice(dayData.pred_high ?? dayData.pred_median)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xl font-bold mono text-amber-600 dark:text-amber-400">${formatPrice(dayData.predicted_price!)}</p>
                        )}
                        {dayData.actual_close != null && (
                          <p className="text-xs text-muted mt-1">Actual close: ${formatPrice(dayData.actual_close)}</p>
                        )}
                      </div>
                    )}

                    {/* Full maths: only for legacy format (no pred_median); hide for new astrology-only calendar */}
                    {dayData.pred_median == null && dayData.predicted_price != null && dayData.predicted_return != null && calendar.model && dayData.features_norm != null && dayData.raw_return != null && dayData.dampened_return != null && dayData.signal_weight != null && dayData.max_daily_move != null && (() => {
                      const { weights, bias, feature_cols } = calendar.model;
                      const prevPrice = dayData.predicted_price / Math.exp(dayData.predicted_return);
                      const terms = feature_cols.map((name, i) => ({ name, w: weights[i], x: dayData.features_norm![i], term: weights[i] * dayData.features_norm![i] }));
                      const sumTerms = terms.reduce((s, t) => s + t.term, 0);
                      return (
                        <div className="mb-4 rounded-xl border border-border bg-surface2 overflow-hidden">
                          <div className="px-3 py-2 border-b border-border bg-surface/50">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Calculation</span>
                          </div>
                          <div className="p-4 space-y-4">
                            {/* Step 1: Normalized features */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue/20 text-[10px] font-bold text-blue">1</span>
                                <span className="text-xs font-medium text-muted">Normalized features <span className="font-normal">(z-score)</span></span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
                                {terms.map((t, i) => (
                                  <span key={i} className="truncate" title={`${t.name} = ${t.x.toFixed(4)}`}>
                                    <span className="text-muted/80">{t.name}</span>
                                    <span className="text-text ml-1">= {t.x.toFixed(4)}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Step 2: raw_return */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue/20 text-[10px] font-bold text-blue">2</span>
                                <span className="text-xs font-medium text-muted">raw_return = Σ(w·x) + bias</span>
                              </div>
                              <p className="font-mono text-xs text-muted pl-7">
                                Σ(w·x) = {sumTerms.toFixed(6)} ; bias = {bias.toFixed(6)} → raw_return = <span className="text-amber-600 dark:text-amber-400 font-medium">{(dayData.raw_return!).toFixed(6)}</span>
                              </p>
                            </div>

                            {/* Step 3: Dampening */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue/20 text-[10px] font-bold text-blue">3</span>
                                <span className="text-xs font-medium text-muted">dampened_return</span>
                              </div>
                              <p className="font-mono text-xs text-muted pl-7">
                                {dayData.signal_weight!.toFixed(4)} × raw + (1 − {dayData.signal_weight!.toFixed(4)}) × bias → <span className="text-amber-600 dark:text-amber-400 font-medium">{(dayData.dampened_return!).toFixed(6)}</span>
                              </p>
                            </div>

                            {/* Step 4: Clamp */}
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue/20 text-[10px] font-bold text-blue">4</span>
                                <span className="text-xs font-medium text-muted">clamped_return</span>
                              </div>
                              <p className="font-mono text-xs text-muted pl-7">
                                clamp(·, ±{dayData.max_daily_move!.toFixed(4)}) → <span className="text-amber-600 dark:text-amber-400 font-medium">{(dayData.predicted_return!).toFixed(6)}</span>
                              </p>
                            </div>

                            {/* Step 5: Price */}
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/30 text-[10px] font-bold text-amber-600 dark:text-amber-400">5</span>
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">P_today = P_prev × e^r</span>
                              </div>
                              <p className="font-mono text-sm text-amber-700 dark:text-amber-300 pl-7 font-semibold">
                                {prevPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {Math.exp(dayData.predicted_return!).toFixed(6)} = {dayData.predicted_price!.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Fallback when no model/calculation fields (legacy calendar only; never for pred_median format) */}
                    {dayData.pred_median == null && dayData.predicted_price != null && dayData.predicted_return != null && !(calendar.model && dayData.features_norm != null && dayData.raw_return != null) && (() => {
                      const r = dayData.predicted_return;
                      const prevPrice = dayData.predicted_price / Math.exp(r);
                      const expR = Math.exp(r);
                      return (
                        <div className="mb-4 rounded-xl border border-border bg-surface2 overflow-hidden">
                          <div className="px-3 py-2 border-b border-border bg-surface/50">
                            <span className="text-xs font-semibold text-muted uppercase tracking-wider">Price calculation</span>
                          </div>
                          <div className="p-4">
                            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                              <p className="font-mono text-xs text-muted space-y-0.5 mb-2">
                                <span>P_prev = {prevPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="mx-2">·</span>
                                <span>r = {r.toFixed(6)}</span>
                                <span className="mx-2">·</span>
                                <span>e^r = {expR.toFixed(6)}</span>
                              </p>
                              <p className="font-mono text-sm text-amber-700 dark:text-amber-300 font-semibold">
                                P_today = {prevPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × {expR.toFixed(6)} = {dayData.predicted_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Astrology: for new calendar (pred_median) show only this; for legacy show below as well */}
                    {(dayData.pred_median != null || naks !== "–" || retroW.length > 0 || retroV.length > 0) && (
                      <>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">Astrology</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Nakshatra</p>
                            <p className="font-medium">{naks}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Retrograde (Western)</p>
                            <p className="font-medium">{retroW.length ? retroW.join(", ") : "None"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Retrograde (Vedic)</p>
                            <p className="font-medium">{retroV.length ? retroV.join(", ") : "None"}</p>
                          </div>
                        </div>
                      </>
                    )}
                    {/* Legacy: "Why this signal" + Western/Vedic/Numerology when we have action or scores */}
                    {(dayData.action != null || dayData.western_score != null || dayData.vedic_score != null || dayData.udn != null) && (
                      <>
                        <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3 mt-4">
                          Why {dayData.date} → {actionDisplayLabel(dayData.action ?? "–")}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Western</p>
                            <p className="font-medium">
                              {wScore.toFixed(4)}{" "}
                              {wMed != null && wSlope != null && (
                                <span className="text-[11px] text-muted font-normal">
                                  (med: {wMed.toFixed(4)} slope: {wSlope >= 0 ? "+" : ""}
                                  {wSlope.toFixed(4)})
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted">W Signal: {wSig}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Vedic</p>
                            <p className="font-medium">
                              {vScore.toFixed(4)}{" "}
                              {vMed != null && vSlope != null && (
                                <span className="text-[11px] text-muted font-normal">
                                  (med: {vMed.toFixed(4)} slope: {vSlope >= 0 ? "+" : ""}
                                  {vSlope.toFixed(4)})
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted">V Signal: {vSig}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Nakshatra</p>
                            <p className="font-medium">{naks}</p>
                          </div>
                          <div>
                            <p className="text-[11px] text-muted uppercase mb-0.5">Numerology</p>
                            <p className="font-medium">
                              {numLabel || (dayData.resonance ? "Resonance Day" : "Normal Day")}{" "}
                              ({numMult.toFixed(1)}x)
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">UDN {dayData.udn}</p>
                            {lifePath != null && (
                              <p className="text-[11px] text-muted">Life Path {lifePath}</p>
                            )}
                            <p className="text-[11px] text-muted mt-1">
                              Retrograde (W): {retroW.length ? retroW.join(", ") : "None"}
                            </p>
                            <p className="text-[11px] text-muted">
                              Retrograde (V): {retroV.length ? retroV.join(", ") : "None"}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                    <p className="text-[11px] text-muted mt-3">
                      Combined Western + Vedic + numerology → {actionDisplayLabel(dayData.action ?? "–")}. Click the day again to close.
                    </p>
                  </div>
                );
              })()}
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
