"use client";

import { useEffect, useRef } from "react";
import { createTVDataFeed } from "./TVDataFeed";
import { CHARTING_LIBRARY_PATH } from "@/lib/tv-constants";
import type { TVWidget } from "@/lib/tv-types";

const API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || window.location.origin)
  : "http://localhost:8000";

interface TVChartContainerProps {
  symbol: string;
  timeframe: string;
  onTimeframeChange?: (tf: string) => void;
  className?: string;
  signalsUrl?: string;
  isLibraryReady?: boolean;
}

export default function TVChartContainer({
  symbol,
  timeframe,
  onTimeframeChange,
  className = "",
  signalsUrl,
  isLibraryReady = false,
}: TVChartContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TVWidget | null>(null);

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
        "study_templates", // avoids /undefined/undefined/study_templates 404 (no storage backend)
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
        if (chart?.setResolution && onTimeframeChange) chart.setResolution(tvInterval);
      } catch {}
    });

    return () => {
      try { widget.remove?.(); } catch {}
      widgetRef.current = null;
    };
  }, [symbol, timeframe, signalsUrl, onTimeframeChange, isLibraryReady]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: 480 }}
    />
  );
}
