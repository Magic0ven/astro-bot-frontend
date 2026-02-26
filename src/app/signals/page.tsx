"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import Header from "@/components/layout/Header";
import type { Signal, FullSignalPayload } from "@/lib/types";
import { ACTION_BG } from "@/lib/types";
import clsx from "clsx";
import { Radio, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import FullSignalPanel from "@/components/signals/FullSignalPanel";

function SignalRow({ s }: { s: Signal }) {
  let fullPayload: FullSignalPayload | null = null;
  try {
    if (s.full_signal && typeof s.full_signal === "string") {
      fullPayload = JSON.parse(s.full_signal) as FullSignalPayload;
    }
  } catch {
    // ignore invalid JSON
  }
  const [showFull, setShowFull] = useState(!!fullPayload);
  const action  = s.action ?? "–";
  const badge   = ACTION_BG[action] ?? "bg-surface2 text-muted border border-border";
  const isBuy   = action.includes("BUY");
  const isSell  = action.includes("SELL");
  const pnl     = s.pnl ?? null;

  return (
    <div className={clsx(
      "rounded-xl border p-4 transition-all hover:border-border/80 animate-fade-in",
      isBuy  ? "border-green/20 bg-green/[0.03]" :
      isSell ? "border-red/20 bg-red/[0.03]"     :
               "border-border bg-surface"
    )}>
      <div className="flex items-start justify-between gap-4">
        {/* Left — action + timestamp */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={clsx("p-2 rounded-lg shrink-0",
            isBuy ? "bg-green/10" : isSell ? "bg-red/10" : "bg-surface2")}>
            {isBuy  ? <TrendingUp  size={14} className="text-green" /> :
             isSell ? <TrendingDown size={14} className="text-red"  /> :
                      <Minus size={14} className="text-muted" />}
          </div>
          <div>
            <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full mono", badge)}>{action}</span>
            <p className="text-[10px] text-muted mt-1 mono">
              {s.timestamp ? new Date(s.timestamp).toUTCString().slice(5, 25) : ""}
            </p>
          </div>
        </div>

        {/* Right — P&L badge if closed */}
        {pnl !== null && (
          <div className={clsx(
            "text-right shrink-0 px-3 py-2 rounded-lg border",
            pnl >= 0 ? "bg-green/10 border-green/20" : "bg-red/10 border-red/20"
          )}>
            <p className="text-[10px] text-muted">P&L</p>
            <p className={clsx("text-sm font-bold mono", pnl >= 0 ? "text-green" : "text-red")}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
            </p>
            {s.result && (
              <p className="text-[10px] mono text-muted">{s.result}</p>
            )}
          </div>
        )}
      </div>

      {/* Details grid */}
      {s.entry_price != null && (
        <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: "Entry",   value: `$${s.entry_price?.toLocaleString() ?? "–"}`,      color: "text-blue"  },
            { label: "SL",      value: `$${s.stop_loss?.toLocaleString()    ?? "–"}`,      color: "text-red"   },
            { label: "TP",      value: `$${s.target?.toLocaleString()        ?? "–"}`,      color: "text-green" },
            { label: "Size",    value: `$${s.position_size_usdt ?? "–"}`,      color: "text-muted" },
            { label: "Western", value: s.western_signal ?? "–",       color: "text-muted" },
            { label: "Vedic",   value: s.vedic_signal   ?? "–",       color: "text-muted" },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-surface2 rounded-lg px-3 py-2">
              <p className="text-[10px] text-muted">{label}</p>
              <p className={clsx("text-xs font-semibold mono mt-0.5", color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Nakshatra + scores + Full signal toggle */}
      <div className="mt-2 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-[11px] text-muted">
          {s.nakshatra && <span>☽ {s.nakshatra}</span>}
          {s.western_score != null && <span>W: {s.western_score.toFixed(3)}</span>}
          {s.vedic_score   != null && <span>V: {s.vedic_score.toFixed(3)}</span>}
          {s.notes && <span className="text-orange italic">{s.notes}</span>}
        </div>
        {fullPayload && (
          <button
            type="button"
            onClick={() => setShowFull((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-blue hover:underline"
          >
            {showFull ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {showFull ? "Hide" : "Show"} full signal
          </button>
        )}
      </div>

      {/* Full signal panel (console-style) */}
      {showFull && fullPayload && (
        <div className="mt-4">
          <FullSignalPanel payload={fullPayload} onClose={() => setShowFull(false)} />
        </div>
      )}
    </div>
  );
}

export default function SignalsPage() {
  const [userId, setUserId] = useState("default");
  const [filter, setFilter] = useState<"all" | "trades" | "no_trade">("all");

  const { data: signals = [], isLoading } = useSWR<Signal[]>(
    `/api/users/${userId}/signals?limit=150`, fetcher, { refreshInterval: 30000 }
  );

  const filtered = filter === "all"     ? signals
    : filter === "trades"               ? signals.filter(s => s.action?.includes("BUY") || s.action?.includes("SELL"))
    :                                     signals.filter(s => s.action === "NO_TRADE" || s.action === "HOLD");

  const actionCounts: Record<string, number> = {};
  signals.forEach(s => { actionCounts[s.action] = (actionCounts[s.action] ?? 0) + 1; });

  return (
    <>
      <Header title="Signals" userId={userId} onUserChange={setUserId} />
      <div className="flex-1 p-6 space-y-5">

        {/* Live indicator + counts */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="dot-live" />
            <span className="text-sm text-text font-medium">Live Signal Feed</span>
            <span className="text-xs text-muted">· auto-refreshes every 30s</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {Object.entries(actionCounts).slice(0, 5).map(([action, count]) => (
              <span key={action} className={clsx("px-2 py-0.5 rounded-full border font-mono", ACTION_BG[action] ?? "bg-surface2 text-muted border-border")}>
                {action.replace("_", " ")} ×{count}
              </span>
            ))}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 bg-surface2 rounded-lg p-1 w-fit">
          {([["all", "All"], ["trades", "Trades Only"], ["no_trade", "No Trade / Hold"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={clsx(
                "px-4 py-1.5 rounded-md text-xs font-medium transition-all",
                filter === v ? "bg-blue/20 text-blue border border-blue/30" : "text-muted hover:text-text"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Signal list */}
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Radio size={24} className="text-muted animate-pulse" />
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="rounded-xl border border-border bg-surface p-12 text-center">
              <p className="text-muted text-sm">No signals found</p>
            </div>
          )}
          {filtered.map((s) => <SignalRow key={s.id} s={s} />)}
        </div>
      </div>
    </>
  );
}
