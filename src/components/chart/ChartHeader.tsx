"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import clsx from "clsx";

export interface MarketStats {
  price: number;
  prevDayPx: number;
  changePct: number;
  volume24h: number;
  openInterestUsd: number;
  openInterestBase: number;
  funding: number;
  fundingPct: number;
  impactPxs: [number, number];
}

function formatUsdShort(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}b`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}m`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${value.toFixed(2)}`;
}

interface ChartHeaderProps {
  symbol: string;
  /** Override price from candles (optional) */
  price?: number;
  /** Override change % from candles (optional) */
  changePct?: number;
  className?: string;
}

export default function ChartHeader({ symbol, price: priceOverride, changePct: changeOverride, className = "" }: ChartHeaderProps) {
  const coin = symbol.replace("/USDT", "").replace("/", "").trim() || "BTC";
  const { data: stats } = useSWR<MarketStats>(
    `/api/market-stats?symbol=${encodeURIComponent(coin)}`,
    fetcher,
    { refreshInterval: 30000 }
  );

  const price = priceOverride ?? stats?.price;
  const changePct = changeOverride ?? stats?.changePct ?? 0;
  const volume24h = stats?.volume24h;
  const oiUsd = stats?.openInterestUsd;
  const fundingPct = stats?.fundingPct;
  const impactPxs = stats?.impactPxs;

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-surface px-4 py-3 rounded-t-xl",
        className
      )}
    >
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold mono text-text">
          {price != null ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "–"}
        </span>
        <span
          className={clsx(
            "text-sm mono font-semibold",
            changePct >= 0 ? "text-green" : "text-red"
          )}
        >
          {changePct >= 0 ? "+" : ""}
          {changePct.toFixed(2)}%
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
        <div className="flex items-center gap-1.5">
          <span className="text-muted/80">24h Volume</span>
          <span className="mono font-medium text-text">
            {volume24h != null ? formatUsdShort(volume24h) : "–"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted/80">Open Interest</span>
          <span className="mono font-medium text-text">
            {oiUsd != null ? formatUsdShort(oiUsd) : "–"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted/80">Available Liquidity</span>
          <span className="mono font-medium text-text">–</span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-muted/80">Net Rate / 1h</span>
          <span
            className={clsx(
              "mono font-medium",
              fundingPct != null
                ? fundingPct >= 0
                  ? "text-green"
                  : "text-red"
                : "text-text"
            )}
          >
            {fundingPct != null
              ? `${fundingPct >= 0 ? "+" : ""}${fundingPct.toFixed(4)}%`
              : "–"}
          </span>
        </div>
      </div>
    </div>
  );
}
