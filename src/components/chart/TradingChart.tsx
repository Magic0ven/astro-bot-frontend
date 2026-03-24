"use client";

import { useEffect, useRef } from "react";
import type { OHLCVCandle, Signal, Position } from "@/lib/types";

interface Props {
  candles:         OHLCVCandle[];
  signals:         Signal[];
  positions:       Position[];
  selectedSignal?: Signal | null;
}

export default function TradingChart({ candles, signals, positions, selectedSignal }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !candles.length) return;

    let chart: import("lightweight-charts").IChartApi | null = null;

    import("lightweight-charts").then(
      ({ createChart, ColorType, CrosshairMode, LineStyle }) => {
        if (!containerRef.current) return;

        chart = createChart(containerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: "#161b22" },
            textColor: "#8b949e",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: "#21262d", style: LineStyle.Dotted },
            horzLines: { color: "#21262d", style: LineStyle.Dotted },
          },
          crosshair:       { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: "#30363d" },
          timeScale:       { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
          width:  containerRef.current.clientWidth,
          height: 480,
        });

        const series = chart.addCandlestickSeries({
          upColor:         "#3fb950",
          downColor:       "#f85149",
          borderUpColor:   "#3fb950",
          borderDownColor: "#f85149",
          wickUpColor:     "#3fb950",
          wickDownColor:   "#f85149",
        });

        series.setData(
          candles.map((c) => ({
            time:  c.time as import("lightweight-charts").Time,
            open:  c.open,
            high:  c.high,
            low:   c.low,
            close: c.close,
          }))
        );

        // Only BUY/SELL: green triangle up = buy, red triangle down = sell
        const isTradeAction = (a: string | undefined) => {
          if (!a) return false;
          const u = a.toUpperCase();
          return u !== "NO_TRADE" && u !== "HOLD" && u !== "COLLECTING_DATA" && (u.includes("BUY") || u.includes("SELL"));
        };
        const markers = signals
          .filter((s) => s.entry_price && s.timestamp && isTradeAction(s.action))
          .map((s) => {
            const ts  = Math.floor(new Date(s.timestamp!).getTime() / 1000) as import("lightweight-charts").Time;
            const buy = s.action!.toUpperCase().includes("BUY");
            return {
              time:     ts,
              position: (buy ? "belowBar" : "aboveBar") as import("lightweight-charts").SeriesMarkerPosition,
              color:    buy ? "#22c55e" : "#ef4444",
              shape:    (buy ? "arrowUp" : "arrowDown") as import("lightweight-charts").SeriesMarkerShape,
              text:     s.result ?? s.action!.replace("_", " "),
            };
          })
          .sort((a, b) => (a.time as number) - (b.time as number));

        series.setMarkers(markers);

        // SL / TP price lines for open positions (bot KV uses entry_price/stop_loss/target)
        positions.forEach((p) => {
          const entry = p.entry ?? p.entry_price;
          const sl = p.sl ?? p.stop_loss;
          const tp = p.tp ?? p.target;
          if (entry != null && entry > 0) {
            series.createPriceLine({ price: entry, color: "#58a6ff", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: `Entry` });
          }
          if (sl != null && sl > 0) {
            series.createPriceLine({ price: sl, color: "#f85149", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `SL` });
          }
          if (tp != null && tp > 0) {
            series.createPriceLine({ price: tp, color: "#3fb950", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `TP` });
          }
        });

        // Highlight a specific signal's entry / SL / TP when selected
        if (selectedSignal && selectedSignal.entry_price != null) {
          const entry = selectedSignal.entry_price;
          series.createPriceLine({
            price: entry,
            color: "#58a6ff",
            lineWidth: 2,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: "Selected Entry",
          });
          if (selectedSignal.stop_loss != null) {
            series.createPriceLine({
              price: selectedSignal.stop_loss,
              color: "#f97373",
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: "Selected SL",
            });
          }
          if (selectedSignal.target != null) {
            series.createPriceLine({
              price: selectedSignal.target,
              color: "#4ade80",
              lineWidth: 2,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: "Selected TP",
            });
          }
        }

        chart.timeScale().fitContent();

        const ro = new ResizeObserver(() => {
          if (containerRef.current && chart) {
            chart.resize(containerRef.current.clientWidth, 480);
          }
        });
        ro.observe(containerRef.current);

        (containerRef.current as HTMLDivElement & { _ro?: ResizeObserver })._ro = ro;
      }
    );

    return () => {
      const el = containerRef.current as (HTMLDivElement & { _ro?: ResizeObserver }) | null;
      el?._ro?.disconnect();
      chart?.remove();
    };
  }, [candles, signals, positions]);

  return <div ref={containerRef} className="w-full rounded-b-xl overflow-hidden" />;
}
