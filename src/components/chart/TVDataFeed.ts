"use client";

import type {
  TVDatafeed,
  TVSymbolInfo,
  TVPeriodParams,
  TVBar,
  TVHistoryCallback,
  TVErrorCallback,
  TVResolveCallback,
  TVReadyCallback,
  TVMark,
} from "@/lib/tv-types";
import { TV_RESOLUTIONS, OHLCV_START_TIMESTAMP } from "@/lib/tv-constants";

const API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
  : "http://localhost:8000";

function resolutionToTimeframe(resolution: string): string {
  const r = resolution.toLowerCase();
  if (r === "1d" || r === "d") return "1d";
  const map: Record<string, string> = { "1": "1m", "5": "5m", "15": "15m", "60": "1h", "240": "4h" };
  return map[r] ?? "4h";
}

/** Only BUY/SELL; exclude NO_TRADE, HOLD, COLLECTING_DATA */
function isTradeAction(action: string | undefined): boolean {
  if (!action) return false;
  const u = action.toUpperCase();
  if (u === "NO_TRADE" || u === "HOLD" || u === "COLLECTING_DATA") return false;
  return u.includes("BUY") || u.includes("SELL");
}

export function createTVDataFeed(signalsFetcher?: () => Promise<Array<{ id?: number; timestamp?: string; action?: string; entry_price?: number; result?: string }>>): TVDatafeed {
  const supportedResolutions = Object.values(TV_RESOLUTIONS);

  return {
    onReady(callback: TVReadyCallback) {
      setTimeout(() => callback({
        supported_resolutions: supportedResolutions,
        supports_marks: true,
      }), 0);
    },
    resolveSymbol(symbolName: string, onResolve: TVResolveCallback, onError: TVErrorCallback) {
      setTimeout(() => {
        onResolve({
          name: symbolName,
          full_name: symbolName,
          description: symbolName,
          type: "crypto",
          session: "24x7",
          timezone: "Etc/UTC",
          exchange: "Hyperliquid",
          minmov: 1,
          pricescale: 100,
          has_intraday: true,
          supported_resolutions: supportedResolutions,
        });
      }, 0);
    },
    getBars(symbolInfo: TVSymbolInfo, resolution: string, periodParams: TVPeriodParams, onResult: TVHistoryCallback, onError: TVErrorCallback) {
      const { from, to } = periodParams;
      const timeframe = resolutionToTimeframe(resolution);
      const symbol = (symbolInfo.name || "BTC/USDT").replace("/", "%2F");
      const url = `${API}/api/ohlcv?symbol=${symbol}&timeframe=${timeframe}&start_time=${OHLCV_START_TIMESTAMP}`;
      fetch(url)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
        .then((raw: Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>) => {
          if (!Array.isArray(raw)) {
            onResult([], { noData: true });
            return;
          }
          const bars: TVBar[] = raw.map((c) => ({
            time: c.time * 1000,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            volume: c.volume ?? 0,
          }));
          const fromMs = from * 1000;
          const toMs = to * 1000;
          const filtered = bars.filter((b) => b.time >= fromMs && b.time <= toMs);
          onResult(filtered, { noData: filtered.length === 0 });
        })
        .catch((err) => onError(String(err?.message ?? err)));
    },
    getMarks(_symbolName: string, from: number, to: number, onData: (marks: TVMark[]) => void) {
      if (!signalsFetcher) {
        setTimeout(() => onData([]), 0);
        return;
      }
      signalsFetcher()
        .then((signals) => {
          const marks = signals
            .filter((s) => s.timestamp && s.entry_price && isTradeAction(s.action))
            .flatMap((s) => {
              const ts = Math.floor(new Date(s.timestamp!).getTime() / 1000);
              if (ts < from || ts > to) return [];
              const buy = s.action!.toUpperCase().includes("BUY");
              return [{
                id: s.id ?? 0,
                time: ts,
                color: buy ? "green" : "red",
                text: s.result ?? s.action ?? "",
                label: buy ? "▲" : "▼",
                labelFontColor: "#fff",
              }];
            })
            .slice(0, 500) as TVMark[];
          setTimeout(() => onData(marks), 0);
        })
        .catch(() => setTimeout(() => onData([]), 0));
    },
  };
}
