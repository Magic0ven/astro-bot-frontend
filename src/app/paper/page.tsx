"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher, api } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { Position, EquityState, Signal } from "@/lib/types";
import clsx from "clsx";
import {
  Terminal, TrendingUp, TrendingDown, Plus,
  X, Trophy, AlertCircle, BarChart2,
} from "lucide-react";

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface2 rounded-xl border border-border px-4 py-3 text-center">
      <p className="text-[10px] text-muted mb-1">{label}</p>
      <p className={clsx("text-lg font-bold mono", color)}>{value}</p>
    </div>
  );
}

interface TradeFormData {
  side:     "BUY" | "SELL";
  entry:    string;
  sl:       string;
  tp:       string;
  notional: string;
}

const DEFAULT_FORM: TradeFormData = { side: "BUY", entry: "", sl: "", tp: "", notional: "" };

export default function PaperPage() {
  const [userId, setUserId]     = useState("default");
  const [form, setForm]         = useState<TradeFormData>(DEFAULT_FORM);
  const [submitting, setSubmit] = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const { data: positions = [], mutate: mutatePosns } =
    useSWR<Position[]>(`/api/users/${userId}/positions`, fetcher, { refreshInterval: 15000 });

  const { data: equity }     = useSWR<EquityState>(`/api/users/${userId}/equity`,          fetcher, { refreshInterval: 30000 });
  const { data: trades = [] } = useSWR<Signal[]>  (`/api/users/${userId}/trades?limit=50`, fetcher, { refreshInterval: 30000 });

  const paperPnl   = equity?.paper_pnl   ?? 0;
  const paperTrades= equity?.paper_trades ?? trades.length;
  const wins       = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const winRate    = paperTrades > 0 ? (wins / paperTrades * 100).toFixed(1) : "0.0";

  async function handleOpen(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess("");
    const entry = parseFloat(form.entry);
    const sl    = parseFloat(form.sl);
    const tp    = parseFloat(form.tp);
    const notional = parseFloat(form.notional);
    if (!entry || !sl || !tp || !notional) { setError("All fields required."); return; }
    if (form.side === "BUY"  && sl >= entry) { setError("SL must be below entry for BUY.");  return; }
    if (form.side === "SELL" && sl <= entry) { setError("SL must be above entry for SELL."); return; }

    setSubmit(true);
    try {
      await api.openPaperTrade({ user_id: userId, side: form.side, entry, sl, tp, notional, signal: "MANUAL" });
      setSuccess("Paper trade opened!");
      setForm(DEFAULT_FORM);
      mutatePosns();
    } catch (err) {
      setError("Failed to open trade.");
    } finally {
      setSubmit(false);
    }
  }

  async function handleClose(index: number) {
    try {
      await api.closePaperTrade(userId, index);
      mutatePosns();
    } catch { /* silent */ }
  }

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

          {/* Manual trade form */}
          <div className="rounded-xl border border-border bg-surface p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Terminal size={16} className="text-blue" />
              <h2 className="text-sm font-semibold text-text">Open Manual Paper Trade</h2>
            </div>

            <form onSubmit={handleOpen} className="space-y-4">
              {/* Side toggle */}
              <div>
                <label className="text-xs text-muted block mb-2">Side</label>
                <div className="flex gap-2">
                  {(["BUY", "SELL"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, side: s }))}
                      className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-bold transition-all",
                        form.side === s && s === "BUY"  ? "bg-green/10 border-green/40 text-green"  :
                        form.side === s && s === "SELL" ? "bg-red/10 border-red/40 text-red"        :
                        "bg-surface2 border-border text-muted hover:text-text"
                      )}
                    >
                      {s === "BUY" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price fields */}
              {[
                { key: "entry" as const, label: "Entry Price",  placeholder: "e.g. 65000" },
                { key: "sl"    as const, label: "Stop Loss",    placeholder: form.side === "BUY" ? "Below entry" : "Above entry" },
                { key: "tp"    as const, label: "Take Profit",  placeholder: form.side === "BUY" ? "Above entry" : "Below entry" },
                { key: "notional" as const, label: "Position Size (USDT notional)", placeholder: "e.g. 300" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-muted block mb-1.5">{label}</label>
                  <input
                    type="number"
                    step="any"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-surface2 border border-border rounded-lg px-3 py-2.5 text-sm mono text-text placeholder-muted outline-none focus:border-blue/50 transition-colors"
                  />
                </div>
              ))}

              {/* Risk preview */}
              {form.entry && form.sl && form.notional && (() => {
                const fe = parseFloat(form.entry) || 0;
                const fs = parseFloat(form.sl)    || 0;
                const fn = parseFloat(form.notional) || 0;
                const ft = parseFloat(form.tp)    || 0;
                const stopDist = Math.abs(fe - fs);
                const stopPct  = fe > 0 ? stopDist / fe * 100 : 0;
                const riskAmt  = fe > 0 ? stopDist / fe * fn  : 0;
                const profitAmt= fe > 0 && ft > 0 ? Math.abs(fe - ft) / fe * fn : 0;
                return (
                  <div className="bg-surface2 rounded-lg px-4 py-3 text-xs space-y-1 border border-border">
                    <p className="text-muted font-medium">Risk Preview</p>
                    <div className="flex justify-between">
                      <span className="text-muted">Stop distance</span>
                      <span className="mono text-text">{stopDist.toFixed(2)} pts ({stopPct.toFixed(2)}%)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Risk amount</span>
                      <span className="mono text-red">${riskAmt.toFixed(2)}</span>
                    </div>
                    {form.tp && (
                      <div className="flex justify-between">
                        <span className="text-muted">Potential profit</span>
                        <span className="mono text-green">${profitAmt.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {error   && <p className="text-xs text-red flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>}
              {success && <p className="text-xs text-green flex items-center gap-1.5"><Trophy size={12} />{success}</p>}

              <button
                type="submit"
                disabled={submitting}
                className={clsx(
                  "w-full py-3 rounded-lg font-bold text-sm transition-all border",
                  form.side === "BUY"
                    ? "bg-green/10 border-green/30 text-green hover:bg-green/20"
                    : "bg-red/10 border-red/30 text-red hover:bg-red/20",
                  submitting && "opacity-50 cursor-not-allowed"
                )}
              >
                {submitting ? "Opening…" : `Open ${form.side} Paper Trade`}
              </button>
            </form>
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
                          <button
                            onClick={() => handleClose(i)}
                            className="text-muted hover:text-red transition-colors p-1 rounded"
                            title="Close position"
                          >
                            <X size={13} />
                          </button>
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
