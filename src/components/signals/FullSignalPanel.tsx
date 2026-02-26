"use client";

import type { FullSignalPayload } from "@/lib/types";
import { ACTION_BG } from "@/lib/types";
import clsx from "clsx";

interface Props {
  payload: FullSignalPayload | null;
  onClose?: () => void;
}

const FRACTION_2 = { minimumFractionDigits: 2 };

const row = (label: string, value: React.ReactNode, valueClass = "text-text") => (
  <div key={label} className="flex border-b border-border/50 last:border-0">
    <div className="w-40 shrink-0 py-2 pr-4 text-[11px] font-medium text-muted uppercase tracking-wider">
      {label}
    </div>
    <div className={clsx("py-2 text-sm mono", valueClass)}>{value ?? "–"}</div>
  </div>
);

export default function FullSignalPanel({ payload, onClose }: Props) {
  if (!payload) return null;

  const action = payload.action ?? "–";
  const badge = ACTION_BG[action] ?? "bg-surface2 text-muted border border-border";
  const stopLossVal = payload.stop_loss != null ? `$${payload.stop_loss.toLocaleString(undefined, FRACTION_2)}` : null;
  const targetVal = payload.target != null ? `$${payload.target.toLocaleString(undefined, FRACTION_2)}` : null;
  const sizeUsdtVal = payload.position_size_usdt != null ? `$${payload.position_size_usdt.toLocaleString(undefined, FRACTION_2)}` : null;
  const timeLabel = payload.timestamp
    ? new Date(payload.timestamp).toUTCString().replace(/ GMT$/, "")
    : null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {onClose && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface2">
          <span className="text-xs font-semibold text-muted">
            {timeLabel ? `Full signal — ${timeLabel}` : "Full signal parameters"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-blue hover:underline"
          >
            Close
          </button>
        </div>
      )}
      <div className="p-4 space-y-0">
        {row("Action", <span className={clsx("px-2 py-0.5 rounded-full text-xs font-bold", badge)}>{action}</span>)}
        {row("Asset", payload.asset)}
        {row("Price", payload.current_price != null ? `$${payload.current_price.toLocaleString(undefined, FRACTION_2)}` : null)}
        {row("Stop Loss", stopLossVal, "text-red")}
        {row("Target", targetVal, "text-green")}
        {row("Size (USDT)", sizeUsdtVal)}
        {row(
          "Capital base",
          payload.effective_capital != null && payload.capital_pct != null
            ? `$${payload.effective_capital.toLocaleString(undefined, FRACTION_2)}  (${Math.round((payload.capital_pct ?? 0) * 100)}% of balance)`
            : payload.effective_capital != null
              ? `$${payload.effective_capital.toLocaleString(undefined, FRACTION_2)}`
              : null
        )}
        {row("", "")}
        {row(
          "Western",
          [payload.western_score, payload.western_medium, payload.western_slope].every((x) => x != null)
            ? `${payload.western_score}  (med: ${payload.western_medium}  slope: ${Number(payload.western_slope) >= 0 ? "+" : ""}${payload.western_slope})`
            : payload.western_score != null ? String(payload.western_score) : null
        )}
        {row(
          "Vedic",
          [payload.vedic_score, payload.vedic_medium, payload.vedic_slope].every((x) => x != null)
            ? `${payload.vedic_score}  (med: ${payload.vedic_medium}  slope: ${Number(payload.vedic_slope) >= 0 ? "+" : ""}${payload.vedic_slope})`
            : payload.vedic_score != null ? String(payload.vedic_score) : null
        )}
        {row("W Signal", payload.western_signal)}
        {row("V Signal", payload.vedic_signal)}
        {row("", "")}
        {row("Numerology", payload.numerology_label != null ? `${payload.numerology_label}${payload.numerology_mult != null ? ` (${payload.numerology_mult}x)` : ""}` : null)}
        {row("UDN", payload.universal_day_number)}
        {row("Life Path", payload.life_path_number)}
        {row(
          "Nakshatra",
          payload.nakshatra != null
            ? `${payload.nakshatra}${payload.nakshatra_multiplier != null ? ` (×${payload.nakshatra_multiplier})` : ""}`
            : null
        )}
        {row("Moon Fast", payload.moon_fast != null ? String(payload.moon_fast) : null)}
        {row("EMA", payload.ema_value != null && payload.ema_filter ? `$${payload.ema_value.toLocaleString(undefined, FRACTION_2)}  (filter: ${payload.ema_filter})` : payload.ema_value != null ? `$${payload.ema_value.toLocaleString()}` : null)}
        {payload.filter_reason && row("Filtered", <span className="text-orange">{payload.filter_reason}</span>)}
        {row("Retrograde (W)", Array.isArray(payload.retrograde_western) ? payload.retrograde_western.join(", ") || "None" : payload.retrograde_western)}
        {row("Retrograde (V)", Array.isArray(payload.retrograde_vedic) ? payload.retrograde_vedic.join(", ") || "None" : payload.retrograde_vedic)}
      </div>
    </div>
  );
}
