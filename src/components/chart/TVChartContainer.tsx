"use client";

import { useEffect, useRef, useState } from "react";
import { createTVDataFeed } from "./TVDataFeed";
import { CHARTING_LIBRARY_PATH } from "@/lib/tv-constants";
import type { TVChartApi, TVWidget } from "@/lib/tv-types";
import type { Signal } from "@/lib/types";

const API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
  : "http://localhost:8000";

function isTradeAction(action: string | undefined): boolean {
  if (!action) return false;
  const u = action.toUpperCase();
  return u !== "NO_TRADE" && u !== "HOLD" && u !== "COLLECTING_DATA" && (u.includes("BUY") || u.includes("SELL"));
}

interface TVChartContainerProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange?: (tf: string) => void;
  className?: string;
  signalsUrl?: string;
  isLibraryReady?: boolean;
  /** Single selected signal to project Entry/SL/TP when user clicks a row */
  selectedSignal?: Signal | null;
}

export default function TVChartContainer({
  symbol,
  timeframe,
  onTimeframeChange,
  className = "",
  signalsUrl,
  isLibraryReady = false,
  selectedSignal = null,
}: TVChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);
  const chartRef = useRef<TVChartApi | null>(null);
  const shapeIdsRef = useRef<unknown[]>([]);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    if (
      !isLibraryReady ||
      !containerRef.current ||
      typeof window === "undefined" ||
      !window.TradingView?.widget
    ) {
      return;
    }

    const signalsFetcher = signalsUrl
      ? () => fetch(`${API}${signalsUrl}`).then((r) => (r.ok ? r.json() : []))
      : undefined;
    const datafeed = createTVDataFeed(signalsFetcher);

    const intervalMap: Record<string, string> = {
      "1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "1D",
    };
    const tvInterval = intervalMap[timeframe] ?? "240";

    const widget = new window.TradingView!.widget({
      container: containerRef.current,
      library_path: CHARTING_LIBRARY_PATH,
      datafeed,
      symbol: symbol || "BTC/USDT",
      interval: tvInterval,
      locale: "en",
      theme: "dark",
      fullscreen: false,
      autosize: true,
      disabled_features: [
        "use_localstorage_for_settings",
        "study_templates",
      ],
      enabled_features: [
        "header_widget",
        "header_chart_type",
        "header_compare",
        "header_fullscreen_button",
        "header_indicators",
        "header_resolutions",
        "header_screenshot",
        "header_settings",
        "header_symbol_search",
        "header_undo_redo",
        "header_saveload",
        "left_toolbar",
        "control_bar",
        "timeframes_toolbar",
        "legend_widget",
        "show_right_widgets_panel_by_default",
        "show_object_tree",
        "context_menus",
      ],
      overrides: {
        "paneProperties.background": "#161b22",
        "paneProperties.vertGridColor": "#21262d",
        "paneProperties.horzGridColor": "#21262d",
      },
    });

    widgetRef.current = widget;
    widget.onChartReady?.(() => {
      try {
        const chart = widget.activeChart?.();
        if (chart) {
          chartRef.current = chart;
          setChartReady(true);
          if (chart.setResolution && onTimeframeChange) chart.setResolution(tvInterval);
        }
      } catch {}
    });

    return () => {
      shapeIdsRef.current = [];
      chartRef.current = null;
      setChartReady(false);
      try { widget.remove?.(); } catch {}
      widgetRef.current = null;
    };
  }, [symbol, timeframe, signalsUrl, onTimeframeChange, isLibraryReady]);

  // Draw long/short projection lines (Entry, SL, TP) only for the selected signal
  useEffect(() => {
    const chart = chartRef.current;
    if (!chartReady || !chart?.createShape || !chart?.removeEntity) return;

    (async () => {
      // Always clear previous projection lines
      for (const id of shapeIdsRef.current) {
        try { chart.removeEntity?.(id); } catch {}
      }
      shapeIdsRef.current = [];

      // Nothing selected → nothing to draw
      if (!selectedSignal || selectedSignal.entry_price == null || !selectedSignal.timestamp || !isTradeAction(selectedSignal.action)) {
        return;
      }

      const addLine = async (
        price: number,
        color: string,
        title: string,
        time?: number
      ): Promise<void> => {
        try {
          const point = time != null ? { time, price } : { price };
          const id = await chart.createShape!(point, {
            shape: "horizontal_line",
            lock: true,
            disableSelection: true,
            text: title,
            overrides: {
              linecolor: color,
              showPrice: true,
              linewidth: 2,
            },
          });
          if (id != null) shapeIdsRef.current.push(id);
        } catch {}
      };

      const toUnix = (ts: string) => Math.floor(new Date(ts).getTime() / 1000);

      const t = toUnix(selectedSignal.timestamp!);
      const entryColor = "#58a6ff";
      const slColor = "#f85149";
      const tpColor = "#22c55e";
      await addLine(selectedSignal.entry_price!, entryColor, "Entry", t);
      if (selectedSignal.stop_loss != null) await addLine(selectedSignal.stop_loss, slColor, "SL", t);
      if (selectedSignal.target != null) await addLine(selectedSignal.target, tpColor, "TP", t);
    })();
  }, [chartReady, selectedSignal]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 480 }}
    />
  );
}
