"use client";

import { useEffect, useRef } from "react";
import type { OHLCVCandle, Signal, Position } from "@/lib/types";

interface Props {
  candles:   OHLCVCandle[];
  signals:   Signal[];
  positions: Position[];
}

export default function TradingChart({ candles, signals, positions }: Props) {
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

        // Trade markers
        const markers = signals
          .filter((s) => s.entry_price && s.timestamp && s.action)
          .map((s) => {
            const ts  = Math.floor(new Date(s.timestamp).getTime() / 1000) as import("lightweight-charts").Time;
            const buy = s.action.includes("BUY");
            return {
              time:     ts,
              position: (buy ? "belowBar" : "aboveBar") as import("lightweight-charts").SeriesMarkerPosition,
              color:    buy ? "#3fb950" : "#f85149",
              shape:    (buy ? "arrowUp" : "arrowDown") as import("lightweight-charts").SeriesMarkerShape,
              text:     s.result ?? s.action.replace("_", " "),
            };
          })
          .sort((a, b) => (a.time as number) - (b.time as number));

        series.setMarkers(markers);

        // SL / TP price lines for open positions
        positions.forEach((p) => {
          series.createPriceLine({ price: p.entry, color: "#58a6ff", lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true, title: `Entry` });
          series.createPriceLine({ price: p.sl,    color: "#f85149", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `SL`    });
          series.createPriceLine({ price: p.tp,    color: "#3fb950", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: `TP`    });
        });

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
