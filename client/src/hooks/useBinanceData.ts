/**
 * useBinanceData — Binance data hooks via backend tRPC proxy
 * All requests go through /api/trpc/binance.* to avoid CORS/geo restrictions
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

export interface KlineData {
  time: number;       // open time in seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TickerData {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  openPrice: number;
}

export interface OrderBookData {
  bids: [number, number][];
  asks: [number, number][];
}

// ============ Technical Indicators ============

export function calcSMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];
  let ema = data[0];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) { result.push(data[0]); continue; }
    ema = data[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

export function calcRSI(data: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = new Array(period).fill(null);
  if (data.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = data[i] - data[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;

  const firstRsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  result.push(firstRsi);

  for (let i = period + 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    result.push(rsi);
  }
  return result;
}

export function calcMACD(data: number[], fast = 12, slow = 26, signal = 9) {
  const emaFast = calcEMA(data, fast);
  const emaSlow = calcEMA(data, slow);
  const macdLine = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = calcEMA(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function calcBollingerBands(data: number[], period: number = 20, stdDev: number = 2): BollingerBands {
  const middle = calcSMA(data, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (middle[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i]!;
      const variance = slice.reduce((sum, v) => sum + (v - mean) ** 2, 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  return { upper, middle, lower };
}

// ============ Quantitative Signal Generator ============

export type SignalType = "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";

export interface QuantSignal {
  type: SignalType;
  score: number;
  rsiSignal: string;
  macdSignal: string;
  trendSignal: string;
  bbSignal: string;
  volumeSignal: string;
}

export function generateQuantSignal(klines: KlineData[]): QuantSignal {
  if (klines.length < 50) {
    return { type: "NEUTRAL", score: 0, rsiSignal: "数据不足", macdSignal: "数据不足", trendSignal: "数据不足", bbSignal: "数据不足", volumeSignal: "数据不足" };
  }

  const closes = klines.map((k) => k.close);
  const volumes = klines.map((k) => k.volume);
  const n = closes.length;

  const rsi = calcRSI(closes, 14);
  const lastRsi = rsi[n - 1] ?? 50;
  let rsiScore = 0;
  let rsiSignal = "中性";
  if (lastRsi < 30) { rsiScore = 40; rsiSignal = `超卖 RSI ${lastRsi.toFixed(1)}`; }
  else if (lastRsi < 40) { rsiScore = 20; rsiSignal = `偏弱 RSI ${lastRsi.toFixed(1)}`; }
  else if (lastRsi > 70) { rsiScore = -40; rsiSignal = `超买 RSI ${lastRsi.toFixed(1)}`; }
  else if (lastRsi > 60) { rsiScore = -20; rsiSignal = `偏强 RSI ${lastRsi.toFixed(1)}`; }
  else { rsiSignal = `中性 RSI ${lastRsi.toFixed(1)}`; }

  const macdData = calcMACD(closes);
  const lastHist = macdData.histogram[n - 1] ?? 0;
  const prevHist = macdData.histogram[n - 2] ?? 0;
  let macdScore = 0;
  let macdSignal = "中性";
  if (lastHist > 0 && prevHist <= 0) { macdScore = 35; macdSignal = "金叉信号"; }
  else if (lastHist < 0 && prevHist >= 0) { macdScore = -35; macdSignal = "死叉信号"; }
  else if (lastHist > 0) { macdScore = 15; macdSignal = `多头动能 ${lastHist.toFixed(2)}`; }
  else if (lastHist < 0) { macdScore = -15; macdSignal = `空头动能 ${lastHist.toFixed(2)}`; }

  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const lastEma20 = ema20[n - 1] ?? closes[n - 1];
  const lastEma50 = ema50[n - 1] ?? closes[n - 1];
  const lastClose = closes[n - 1];
  let trendScore = 0;
  let trendSignal = "中性";
  if (lastClose > lastEma20 && lastEma20 > lastEma50) { trendScore = 25; trendSignal = "上升趋势"; }
  else if (lastClose < lastEma20 && lastEma20 < lastEma50) { trendScore = -25; trendSignal = "下降趋势"; }
  else if (lastClose > lastEma20) { trendScore = 10; trendSignal = "短期偏多"; }
  else { trendScore = -10; trendSignal = "短期偏空"; }

  const bb = calcBollingerBands(closes, 20, 2);
  const bbUpper = bb.upper[n - 1] ?? lastClose * 1.02;
  const bbLower = bb.lower[n - 1] ?? lastClose * 0.98;
  const bbMiddle = bb.middle[n - 1] ?? lastClose;
  let bbScore = 0;
  let bbSignal = "中性";
  if (lastClose <= bbLower) { bbScore = 20; bbSignal = "触及下轨"; }
  else if (lastClose >= bbUpper) { bbScore = -20; bbSignal = "触及上轨"; }
  else if (lastClose > bbMiddle) { bbScore = 5; bbSignal = "中轨以上"; }
  else { bbScore = -5; bbSignal = "中轨以下"; }

  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVol = volumes[n - 1];
  let volScore = 0;
  let volumeSignal = "正常";
  if (lastVol > avgVol * 1.5) { volScore = lastClose > closes[n - 2] ? 10 : -10; volumeSignal = `放量 ${(lastVol / avgVol).toFixed(1)}x`; }
  else if (lastVol < avgVol * 0.5) { volumeSignal = "缩量"; }

  const totalScore = rsiScore + macdScore + trendScore + bbScore + volScore;
  let type: SignalType = "NEUTRAL";
  if (totalScore >= 60) type = "STRONG_BUY";
  else if (totalScore >= 25) type = "BUY";
  else if (totalScore <= -60) type = "STRONG_SELL";
  else if (totalScore <= -25) type = "SELL";

  return { type, score: Math.max(-100, Math.min(100, totalScore)), rsiSignal, macdSignal, trendSignal, bbSignal, volumeSignal };
}

// ============ Support & Resistance Calculator ============

export interface SRLevel {
  price: number;
  type: "support" | "resistance";
  strength: "strong" | "moderate" | "weak";
  label: string;
  touchCount: number;
}

export function calcSupportResistance(klines: KlineData[], currentPrice: number): SRLevel[] {
  if (klines.length < 20) return [];

  const levels: SRLevel[] = [];
  const highs = klines.map((k) => k.high);
  const lows = klines.map((k) => k.low);
  const closes = klines.map((k) => k.close);
  const n = klines.length;

  // 1. Pivot highs and lows (swing points)
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  const lookback = 5;
  for (let i = lookback; i < n - lookback; i++) {
    const windowHighs = highs.slice(i - lookback, i + lookback + 1);
    const windowLows = lows.slice(i - lookback, i + lookback + 1);
    if (highs[i] === Math.max(...windowHighs)) pivotHighs.push(highs[i]);
    if (lows[i] === Math.min(...windowLows)) pivotLows.push(lows[i]);
  }

  // 2. Cluster nearby levels (within 0.5%)
  function clusterLevels(prices: number[]): { price: number; count: number }[] {
    const clusters: { price: number; count: number }[] = [];
    for (const p of prices) {
      const existing = clusters.find((c) => Math.abs(c.price - p) / p < 0.005);
      if (existing) { existing.price = (existing.price * existing.count + p) / (existing.count + 1); existing.count++; }
      else clusters.push({ price: p, count: 1 });
    }
    return clusters.sort((a, b) => b.count - a.count);
  }

  const resistanceClusters = clusterLevels(pivotHighs).filter((c) => c.price > currentPrice * 0.995);
  const supportClusters = clusterLevels(pivotLows).filter((c) => c.price < currentPrice * 1.005);

  // 3. EMA levels as dynamic S/R
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const lastEma20 = ema20[n - 1];
  const lastEma50 = ema50[n - 1];

  // 4. Bollinger bands
  const bb = calcBollingerBands(closes, 20, 2);
  const bbUpper = bb.upper[n - 1];
  const bbLower = bb.lower[n - 1];

  // 5. Recent 24h high/low
  const recent24 = klines.slice(-24);
  const recent24High = Math.max(...recent24.map((k) => k.high));
  const recent24Low = Math.min(...recent24.map((k) => k.low));

  // Build resistance levels
  for (const c of resistanceClusters.slice(0, 3)) {
    const strength = c.count >= 3 ? "strong" : c.count >= 2 ? "moderate" : "weak";
    levels.push({ price: c.price, type: "resistance", strength, label: `阻力 (${c.count}次触及)`, touchCount: c.count });
  }

  // Build support levels
  for (const c of supportClusters.slice(0, 3)) {
    const strength = c.count >= 3 ? "strong" : c.count >= 2 ? "moderate" : "weak";
    levels.push({ price: c.price, type: "support", strength, label: `支撑 (${c.count}次触及)`, touchCount: c.count });
  }

  // Add EMA levels
  if (lastEma20 > currentPrice * 1.001) levels.push({ price: lastEma20, type: "resistance", strength: "moderate", label: "EMA20 阻力", touchCount: 1 });
  else if (lastEma20 < currentPrice * 0.999) levels.push({ price: lastEma20, type: "support", strength: "moderate", label: "EMA20 支撑", touchCount: 1 });
  if (lastEma50 > currentPrice * 1.001) levels.push({ price: lastEma50, type: "resistance", strength: "strong", label: "EMA50 阻力", touchCount: 2 });
  else if (lastEma50 < currentPrice * 0.999) levels.push({ price: lastEma50, type: "support", strength: "strong", label: "EMA50 支撑", touchCount: 2 });

  // Add BB levels
  if (bbUpper !== null && bbUpper > currentPrice) levels.push({ price: bbUpper, type: "resistance", strength: "moderate", label: "布林上轨", touchCount: 1 });
  if (bbLower !== null && bbLower < currentPrice) levels.push({ price: bbLower, type: "support", strength: "moderate", label: "布林下轨", touchCount: 1 });

  // Add 24h high/low
  if (recent24High > currentPrice * 1.001) levels.push({ price: recent24High, type: "resistance", strength: "weak", label: "24H 高点", touchCount: 1 });
  if (recent24Low < currentPrice * 0.999) levels.push({ price: recent24Low, type: "support", strength: "weak", label: "24H 低点", touchCount: 1 });

  // Sort: resistances ascending (closest first), supports descending (closest first)
  const resistances = levels.filter((l) => l.type === "resistance").sort((a, b) => a.price - b.price).slice(0, 4);
  const supports = levels.filter((l) => l.type === "support").sort((a, b) => b.price - a.price).slice(0, 4);

  return [...resistances, ...supports];
}

// ============ React Hooks (via tRPC proxy) ============

function parseKlines(raw: any[][]): KlineData[] {
  return raw.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
  }));
}

function parseTicker(d: any): TickerData {
  return {
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    priceChange: parseFloat(d.priceChange),
    priceChangePercent: parseFloat(d.priceChangePercent),
    highPrice: parseFloat(d.highPrice),
    lowPrice: parseFloat(d.lowPrice),
    volume: parseFloat(d.volume),
    quoteVolume: parseFloat(d.quoteVolume),
    openPrice: parseFloat(d.openPrice),
  };
}

export function useTickerData(symbol: string, refreshInterval: number = 5000) {
  const { data: raw, isLoading, error, refetch } = trpc.binance.ticker.useQuery(
    { symbol },
    { refetchInterval: refreshInterval, staleTime: refreshInterval }
  );
  const data = raw ? parseTicker(raw) : null;
  return { data, loading: isLoading, error: error?.message ?? null, refresh: refetch };
}

export function useKlineData(symbol: string, interval: string, limit: number = 200) {
  const { data: raw, isLoading, error, refetch } = trpc.binance.klines.useQuery(
    { symbol, interval, limit },
    { refetchInterval: 30000, staleTime: 15000 }
  );
  const data = raw ? parseKlines(raw as any[][]) : [];
  return { data, loading: isLoading, error: error?.message ?? null, refresh: refetch };
}

export function useOrderBook(symbol: string, limit: number = 15) {
  const { data: raw, isLoading } = trpc.binance.depth.useQuery(
    { symbol, limit },
    { refetchInterval: 3000, staleTime: 1500 }
  );
  const data: OrderBookData | null = raw
    ? {
        bids: (raw as any).bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
        asks: (raw as any).asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
      }
    : null;
  return { data, loading: isLoading };
}

// ============ Multi-Timeframe NR Hook ============

export interface MultiTFKlines {
  "1h": KlineData[];
  "4h": KlineData[];
  "1d": KlineData[];
}

/**
 * 同时获取三个周期的K线数据，用于多周期NR扫描
 */
export function useMultiTFKlines(symbol: string): {
  data: MultiTFKlines;
  loading: boolean;
} {
  const { data: raw1h, isLoading: l1 } = trpc.binance.klines.useQuery(
    { symbol, interval: "1h", limit: 100 },
    { refetchInterval: 60000, staleTime: 30000 }
  );
  const { data: raw4h, isLoading: l2 } = trpc.binance.klines.useQuery(
    { symbol, interval: "4h", limit: 100 },
    { refetchInterval: 120000, staleTime: 60000 }
  );
  const { data: raw1d, isLoading: l3 } = trpc.binance.klines.useQuery(
    { symbol, interval: "1d", limit: 100 },
    { refetchInterval: 300000, staleTime: 120000 }
  );

  return {
    data: {
      "1h": raw1h ? parseKlines(raw1h as any[][]) : [],
      "4h": raw4h ? parseKlines(raw4h as any[][]) : [],
      "1d": raw1d ? parseKlines(raw1d as any[][]) : [],
    },
    loading: l1 || l2 || l3,
  };
}
