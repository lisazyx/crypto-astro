/**
 * CandlestickChart — Professional K-line chart using lightweight-charts v5
 * Design: Quantum Terminal — deep space dark theme
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import { KlineData, calcEMA, calcBollingerBands } from "@/hooks/useBinanceData";
import type { NRBar } from "@/lib/nr4nr7";

interface CandlestickChartProps {
  data: KlineData[];
  height?: number;
  showEMA?: boolean;
  showBB?: boolean;
  nrBars?: NRBar[];  // NR signal markers to overlay on chart
}

export default function CandlestickChart({ data, height = 400, showEMA = true, showBB = false, nrBars = [] }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7A8899",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(40, 50, 70, 0.5)" },
        horzLines: { color: "rgba(40, 50, 70, 0.5)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(0, 212, 170, 0.5)", width: 1, style: 3 },
        horzLine: { color: "rgba(0, 212, 170, 0.5)", width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: "rgba(40, 50, 70, 0.8)",
        textColor: "#7A8899",
      },
      timeScale: {
        borderColor: "rgba(40, 50, 70, 0.8)",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
      height,
    });

    // Candlestick series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00D4AA",
      downColor: "#FF4D6D",
      borderUpColor: "#00D4AA",
      borderDownColor: "#FF4D6D",
      wickUpColor: "#00D4AA",
      wickDownColor: "#FF4D6D",
    });
    candleRef.current = candleSeries;

    // Volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeRef.current = volumeSeries;

    // EMA lines
    if (showEMA) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: "#FFD700",
        lineWidth: 1,
        title: "EMA20",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema20Ref.current = ema20Series;

      const ema50Series = chart.addSeries(LineSeries, {
        color: "#A78BFA",
        lineWidth: 1,
        title: "EMA50",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema50Ref.current = ema50Series;
    }

    // Bollinger Bands
    if (showBB) {
      const bbUpperSeries = chart.addSeries(LineSeries, {
        color: "rgba(100, 200, 255, 0.5)",
        lineWidth: 1,
        title: "BB Upper",
        priceLineVisible: false,
        lastValueVisible: false,
        lineStyle: 2,
      });
      bbUpperRef.current = bbUpperSeries;

      const bbLowerSeries = chart.addSeries(LineSeries, {
        color: "rgba(100, 200, 255, 0.5)",
        lineWidth: 1,
        title: "BB Lower",
        priceLineVisible: false,
        lastValueVisible: false,
        lineStyle: 2,
      });
      bbLowerRef.current = bbLowerSeries;
    }

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      ema20Ref.current = null;
      ema50Ref.current = null;
      bbUpperRef.current = null;
      bbLowerRef.current = null;
    };
  }, [height, showEMA, showBB]);

  useEffect(() => {
    if (!data.length || !candleRef.current || !volumeRef.current) return;

    const candleData = data.map((k) => ({
      time: k.time as any,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
    }));

    const volumeData = data.map((k) => ({
      time: k.time as any,
      value: k.volume,
      color: k.close >= k.open ? "rgba(0, 212, 170, 0.4)" : "rgba(255, 77, 109, 0.4)",
    }));

    candleRef.current.setData(candleData);
    volumeRef.current.setData(volumeData);

    // EMA data
    if (showEMA && ema20Ref.current && ema50Ref.current) {
      const closes = data.map((k) => k.close);
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, 50);

      const ema20Data = data
        .map((k, i) => ema20[i] !== null ? { time: k.time as any, value: ema20[i]! } : null)
        .filter(Boolean) as any[];
      const ema50Data = data
        .map((k, i) => ema50[i] !== null ? { time: k.time as any, value: ema50[i]! } : null)
        .filter(Boolean) as any[];

      ema20Ref.current.setData(ema20Data);
      ema50Ref.current.setData(ema50Data);
    }

    // BB data
    if (showBB && bbUpperRef.current && bbLowerRef.current) {
      const closes = data.map((k) => k.close);
      const bb = calcBollingerBands(closes, 20, 2);

      const bbUpperData = data
        .map((k, i) => bb.upper[i] !== null ? { time: k.time as any, value: bb.upper[i]! } : null)
        .filter(Boolean) as any[];
      const bbLowerData = data
        .map((k, i) => bb.lower[i] !== null ? { time: k.time as any, value: bb.lower[i]! } : null)
        .filter(Boolean) as any[];

      bbUpperRef.current.setData(bbUpperData);
      bbLowerRef.current.setData(bbLowerData);
    }

    chartRef.current?.timeScale().fitContent();

    // NR signal markers
    if (nrBars.length > 0 && candleRef.current) {
      const markers = nrBars.map((bar) => ({
        time: bar.time as any,
        position: 'belowBar' as const,
        color: bar.nrType === 'NR4+NR7' ? '#A78BFA' : bar.nrType === 'NR7' ? '#FFD700' : '#00D4AA',
        shape: 'arrowUp' as const,
        text: bar.nrType,
        size: bar.nrType === 'NR4+NR7' ? 2 : 1,
      }));
      try {
        (candleRef.current as any).setMarkers(markers);
      } catch (_) {}
    } else if (candleRef.current) {
      try { (candleRef.current as any).setMarkers([]); } catch (_) {}
    }
  }, [data, showEMA, showBB, nrBars]);

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height: `${height}px` }}
    />
  );
}
