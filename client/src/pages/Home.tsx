/**
 * Home.tsx — CryptoAstro Main Dashboard
 * Design: Quantum Terminal — Deep space dark terminal × Astrology mysticism
 * Layout: Fixed left sidebar + main chart area + right astro panel
 *
 * Features:
 * - Real-time BTC/USDT price from Binance API
 * - Candlestick K-line chart with EMA/BB overlays
 * - RSI + MACD indicator panels
 * - Quantitative signal generator
 * - Astrological wheel with planet positions
 * - Moon phase tracker
 * - Planetary aspects analysis
 * - Upcoming astro events calendar
 */
import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CandlestickChart from "@/components/CandlestickChart";
import IndicatorChart from "@/components/IndicatorChart";
import AstroWheel from "@/components/AstroWheel";
import {
  useTickerData,
  useKlineData,
  generateQuantSignal,
  calcRSI,
  calcEMA,
  calcSupportResistance,
  type SignalType,
  type SRLevel,
} from "@/hooks/useBinanceData";
import AstroAlertPanel from "@/components/AstroAlertPanel";
import {
  getPlanetPositions,
  getAspects,
  getMoonPhase,
  getUpcomingEvents,
  getAstroSentiment,
  getAstroAlerts,
  type PlanetPosition,
  type AstroEvent,
} from "@/lib/astrology";
import {
  getDaySignal,
  getFibWindows,
  getSevenDayForecast,
  ANALYSIS_RULES,
  type DaySignal,
  type FibWindow,
} from "@/lib/fibAstro";
import { calcNR4NR7, type NRAnalysis, type NRBar } from "@/lib/nr4nr7";
import { useMultiTFKlines } from "@/hooks/useBinanceData";
import { getDeltaAnalysis, type DeltaAnalysis } from "@/lib/deltaTheory";

// ============ Constants ============
const INTERVALS = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1h" },
  { label: "4H", value: "4h" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
];

const SYMBOLS = [
  { label: "BTC/USDT", value: "BTCUSDT" },
  { label: "ETH/USDT", value: "ETHUSDT" },
  { label: "BNB/USDT", value: "BNBUSDT" },
  { label: "SOL/USDT", value: "SOLUSDT" },
];

// ============ Helper Components ============

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00D4AA] pulse-dot" />
      <span className="text-[10px] text-[#00D4AA] font-mono uppercase tracking-wider">LIVE</span>
    </span>
  );
}

function PriceDisplay({ price, change, changePercent }: { price: number; change: number; changePercent: number }) {
  const isUp = change >= 0;
  const color = isUp ? "#00D4AA" : "#FF4D6D";

  return (
    <div className="flex items-baseline gap-3">
      <span
        className="mono-num font-bold"
        style={{ fontSize: "2rem", color, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}
      >
        ${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className="mono-num text-sm font-medium" style={{ color }}>
        {isUp ? "+" : ""}{changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

function SignalBadge({ type, score }: { type: SignalType; score: number }) {
  const config: Record<SignalType, { label: string; color: string; bg: string; border: string }> = {
    STRONG_BUY: { label: "强烈买入", color: "#00D4AA", bg: "rgba(0, 212, 170, 0.12)", border: "rgba(0, 212, 170, 0.4)" },
    BUY: { label: "买入", color: "#00D4AA", bg: "rgba(0, 212, 170, 0.08)", border: "rgba(0, 212, 170, 0.25)" },
    NEUTRAL: { label: "中性观望", color: "#7A8899", bg: "rgba(120, 136, 153, 0.1)", border: "rgba(120, 136, 153, 0.3)" },
    SELL: { label: "卖出", color: "#FF4D6D", bg: "rgba(255, 77, 109, 0.08)", border: "rgba(255, 77, 109, 0.25)" },
    STRONG_SELL: { label: "强烈卖出", color: "#FF4D6D", bg: "rgba(255, 77, 109, 0.12)", border: "rgba(255, 77, 109, 0.4)" },
  };
  const c = config[type];

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <span className="text-xs font-bold tracking-wider uppercase" style={{ color: c.color, fontFamily: "'Space Grotesk', sans-serif" }}>
        {c.label}
      </span>
      <span className="mono-num text-xs" style={{ color: c.color }}>
        {score > 0 ? "+" : ""}{score}
      </span>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="terminal-card p-3">
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>{label}</div>
      <div className="mono-num text-sm font-semibold" style={{ color: color || "#E8EDF5" }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "#4A5568" }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-base">{icon}</span>
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#7A8899", fontFamily: "'Space Grotesk', sans-serif" }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: "rgba(40, 50, 70, 0.8)" }} />
    </div>
  );
}

// ============ Main Dashboard ============

export default function Home() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [interval, setInterval] = useState("1h");
  const [activeIndicator, setActiveIndicator] = useState<"rsi" | "macd">("rsi");
  const [showBB, setShowBB] = useState(false);
  const [showEMA, setShowEMA] = useState(true);
  const [astroDate, setAstroDate] = useState(() => new Date());
  const [showAstroPanel, setShowAstroPanel] = useState(true);
  const [astroTab, setAstroTab] = useState<"alerts" | "wheel" | "planets">("alerts");
  const [sideTab, setSideTab] = useState<"quant" | "fib">("quant");

  // Data hooks
  const { data: ticker } = useTickerData(symbol, 5000);
  const { data: klines, loading: klinesLoading } = useKlineData(symbol, interval, 200);

  // Astro data (computed)
  const planets = useMemo(() => getPlanetPositions(astroDate), [astroDate]);
  const aspects = useMemo(() => getAspects(planets), [planets]);
  const moonPhase = useMemo(() => getMoonPhase(astroDate), [astroDate]);
  const upcomingEvents = useMemo(() => getUpcomingEvents(astroDate), [astroDate]);
  const astroSentiment = useMemo(() => getAstroSentiment(astroDate), [astroDate]);
  const astroAlerts = useMemo(() => getAstroAlerts(astroDate, planets), [astroDate, planets]);

  // Fib + NR4/NR7 data
  const todaySignal = useMemo(() => getDaySignal(new Date().toISOString().slice(0, 10)), []);
  const fibWindows = useMemo(() => getFibWindows(new Date()), []);
  const sevenDayForecast = useMemo(() => getSevenDayForecast(new Date()), []);

  // Multi-timeframe NR data (提前调用以供Delta回测使用)
  const { data: multiTFKlines, loading: multiTFLoading } = useMultiTFKlines(symbol);

  // Delta 三角洲理论分析（传入日线K供历史回测）
  const deltaAnalysis = useMemo<DeltaAnalysis>(() => {
    const dailyCandles = (multiTFKlines["1d"] || []).map((k) => ({
      time: k.time * 1000, // 秒 → 毫秒
      high: k.high,
      low: k.low,
      close: k.close,
    }));
    return getDeltaAnalysis(new Date(), dailyCandles);
  }, [multiTFKlines]);

  const nrAnalysis = useMemo((): NRAnalysis => {
    if (!klines.length) return { currentNR: null, latestSignal: null, recentNRBars: [], breakoutStatus: "no_nr", nr4Count: 0, nr7Count: 0, compressionPct: 50 };
    const closes = klines.map((k) => k.close);
    const ema20Arr = calcEMA(closes, 20);
    return calcNR4NR7(klines, ema20Arr);
  }, [klines]);

  const multiTFNR = useMemo(() => {
    const result: Record<string, NRAnalysis> = {};
    for (const tf of ["1h", "4h", "1d"] as const) {
      const tfKlines = multiTFKlines[tf];
      if (!tfKlines.length) {
        result[tf] = { currentNR: null, latestSignal: null, recentNRBars: [], breakoutStatus: "no_nr", nr4Count: 0, nr7Count: 0, compressionPct: 50 };
      } else {
        const closes = tfKlines.map((k) => k.close);
        const ema20Arr = calcEMA(closes, 20);
        result[tf] = calcNR4NR7(tfKlines, ema20Arr);
      }
    }
    return result;
  }, [multiTFKlines]);

  // NR signal history (collect from all timeframes)
  const nrSignalHistory = useMemo(() => {
    const history: Array<{ tf: string; bar: NRBar; time: Date }> = [];
    for (const tf of ["1h", "4h", "1d"] as const) {
      const analysis = multiTFNR[tf];
      if (analysis) {
        for (const bar of analysis.recentNRBars.slice(-8)) {
          history.push({ tf, bar, time: new Date(bar.time * 1000) });
        }
      }
    }
    return history.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 15);
  }, [multiTFNR]);

  // NR resonance score: how many timeframes have active NR signal
  const nrResonanceScore = useMemo(() => {
    let score = 0;
    const signals: string[] = [];
    for (const [tf, analysis] of Object.entries(multiTFNR)) {
      if (analysis.currentNR) {
        score += tf === "1d" ? 3 : tf === "4h" ? 2 : 1;
        signals.push(`${tf.toUpperCase()} ${analysis.currentNR.nrType}`);
      } else if (analysis.latestSignal && analysis.latestSignal.type !== "NONE") {
        score += tf === "1d" ? 2 : tf === "4h" ? 1 : 0.5;
        signals.push(`${tf.toUpperCase()} ${analysis.latestSignal.label}`);
      }
    }
    return { score: Math.min(10, Math.round(score)), signals };
  }, [multiTFNR]);

  // 变盘共振评分：综合NR多周期 + 占星情绪 + 变盘窗口 + 月相
  const fibResonanceScore = useMemo(() => {
    let score = 0;
    const factors: Array<{ label: string; color: string; pts: number }> = [];

    // NR多周期贡献（最高4分）
    const nrPts = Math.min(4, nrResonanceScore.score / 2.5);
    if (nrPts > 0) {
      score += nrPts;
      factors.push({ label: `NR多周期共振 ${nrResonanceScore.score}/10`, color: "#A78BFA", pts: nrPts });
    }

    // 占星情绪贡献（最高3分）
    const astroAbs = Math.abs(astroSentiment.score);
    const astroPts = Math.min(3, astroAbs / 33);
    if (astroPts > 0.5) {
      score += astroPts;
      factors.push({ label: `星象情绪 ${astroSentiment.score > 0 ? '+' : ''}${astroSentiment.score}`, color: astroSentiment.score >= 0 ? "#00D4AA" : "#FF4D6D", pts: astroPts });
    }

    // 变盘窗口贡献（最高2分）
    const todayStr = new Date().toISOString().slice(0, 10);
    const nearWindow = fibWindows.find(w => {
      // FibWindow有date字段，判断当前日期是否在变盘窗口内（前吊1天）
      const wDate = w.date;
      const diff = Math.abs(new Date(todayStr).getTime() - new Date(wDate).getTime()) / 86400000;
      return diff <= 1;
    });
    if (nearWindow) {
      const windowPts = nearWindow.level === 'high' ? 2 : nearWindow.level === 'mid' ? 1.5 : 1;
      score += windowPts;
      factors.push({ label: `变盘窗口 ${nearWindow.anchorName} Fib${nearWindow.fibNum}`, color: "#FFB74D", pts: windowPts });
    }

    // 月相贡献（最高1分）
    const moonPhaseStr = moonPhase.phase;
    if (moonPhaseStr.includes('满月') || moonPhaseStr.includes('新月')) {
      score += 1;
      factors.push({ label: `${moonPhase.phaseSymbol} ${moonPhaseStr}`, color: "#FFD700", pts: 1 });
    }

    return {
      score: Math.min(10, Math.round(score * 10) / 10),
      maxScore: 10,
      factors,
      level: score >= 7 ? '极强共振' : score >= 5 ? '强共振' : score >= 3 ? '中度共振' : '弱共振',
      levelColor: score >= 7 ? '#A78BFA' : score >= 5 ? '#FFB74D' : score >= 3 ? '#00D4AA' : '#4A5568',
    };
  }, [nrResonanceScore, astroSentiment, fibWindows, moonPhase]);

  // Support & Resistance levels
  const srLevels = useMemo((): SRLevel[] => {
    if (!klines.length || !ticker) return [];
    return calcSupportResistance(klines, ticker.price);
  }, [klines, ticker]);

  // Quant signal
  const quantSignal = useMemo(() => generateQuantSignal(klines), [klines]);

  // RSI last value
  const lastRSI = useMemo(() => {
    if (!klines.length) return null;
    const closes = klines.map((k) => k.close);
    const rsi = calcRSI(closes, 14);
    return rsi[rsi.length - 1];
  }, [klines]);

  // EMA values
  const emaValues = useMemo(() => {
    if (!klines.length) return { ema20: null, ema50: null };
    const closes = klines.map((k) => k.close);
    const ema20 = calcEMA(closes, 20);
    const ema50 = calcEMA(closes, 50);
    return {
      ema20: ema20[ema20.length - 1],
      ema50: ema50[ema50.length - 1],
    };
  }, [klines]);

  const symbolLabel = SYMBOLS.find((s) => s.value === symbol)?.label || symbol;

  // Auto-update astro date
  useEffect(() => {
    const id = window.setInterval(() => setAstroDate(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const retrogradeplanets = planets.filter((p) => p.isRetrograde);

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: "oklch(0.09 0.015 265)",
        backgroundImage: `url('https://d2xsxph8kpxj0f.cloudfront.net/310519663529904803/UoL3V8ByULfdz6p94MmQai/astro-hero-bg-E42vwj8t6SZBanuDNCDeXm.webp')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundBlendMode: "overlay",
      }}
    >
      {/* ===== LEFT SIDEBAR ===== */}
      <aside
        className="flex flex-col w-[220px] flex-shrink-0 h-full overflow-y-auto"
        style={{
          background: "rgba(8, 10, 20, 0.92)",
          borderRight: "1px solid rgba(40, 50, 70, 0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(40, 50, 70, 0.6)" }}>
          <div className="flex items-center gap-2">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663529904803/UoL3V8ByULfdz6p94MmQai/astro-wheel-azx6f46gXWRhkcnKHHYxdG.webp"
              alt="logo"
              className="w-8 h-8 rounded-full object-cover"
              style={{ filter: "brightness(0.9) saturate(1.2)" }}
            />
            <div>
              <div className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E8EDF5" }}>CryptoAstro</div>
              <div className="text-[10px]" style={{ color: "#4A5568" }}>量化 · 星象分析</div>
            </div>
          </div>
        </div>

        {/* Symbol selector */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40, 50, 70, 0.4)" }}>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>交易对</div>
          <div className="space-y-1">
            {SYMBOLS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSymbol(s.value)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-all"
                style={{
                  background: symbol === s.value ? "rgba(0, 212, 170, 0.12)" : "transparent",
                  color: symbol === s.value ? "#00D4AA" : "#7A8899",
                  border: symbol === s.value ? "1px solid rgba(0, 212, 170, 0.3)" : "1px solid transparent",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                <span>{s.label}</span>
                {symbol === s.value && <span className="w-1 h-1 rounded-full bg-[#00D4AA]" />}
              </button>
            ))}
          </div>
        </div>

        {/* Quick stats */}
        {ticker && (
          <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40, 50, 70, 0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>行情概览</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: "#4A5568" }}>24H高</span>
                <span className="mono-num" style={{ color: "#00D4AA" }}>${ticker.highPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#4A5568" }}>24H低</span>
                <span className="mono-num" style={{ color: "#FF4D6D" }}>${ticker.lowPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#4A5568" }}>成交量</span>
                <span className="mono-num" style={{ color: "#E8EDF5" }}>{ticker.volume >= 1000 ? (ticker.volume / 1000).toFixed(1) + 'K' : ticker.volume.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: "#4A5568" }}>成交额</span>
                <span className="mono-num" style={{ color: "#E8EDF5" }}>${ticker.quoteVolume >= 1e9 ? (ticker.quoteVolume / 1e9).toFixed(2) + 'B' : (ticker.quoteVolume / 1e6).toFixed(1) + 'M'}</span>
              </div>
            </div>
          </div>
        )}

        {/* 左侧内容：量化信号 + 变盘内容，全部展开纵向排列 */}

        {/* 量化信号 */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40,50,70,0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>量化信号</div>
            <SignalBadge type={quantSignal.type} score={quantSignal.score} />
            <div className="mt-2 space-y-1">
              {[
                { label: "RSI", value: quantSignal.rsiSignal },
                { label: "MACD", value: quantSignal.macdSignal },
                { label: "趋势", value: quantSignal.trendSignal },
                { label: "布林", value: quantSignal.bbSignal },
                { label: "成交量", value: quantSignal.volumeSignal },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-[10px]">
                  <span style={{ color: "#4A5568" }}>{label}</span>
                  <span style={{ color: "#7A8899" }} className="text-right max-w-[100px] truncate">{value}</span>
                </div>
              ))}
            </div>
        </div>

        {/* 今日核心信号 */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40,50,70,0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>今日核心信号</div>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {todaySignal.tags.map((tag, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{
                  background: tag.type === "up" ? "rgba(0,212,170,0.15)" : tag.type === "down" ? "rgba(255,77,109,0.15)" : tag.type === "high" ? "rgba(167,139,250,0.15)" : "rgba(255,183,77,0.12)",
                  color: tag.type === "up" ? "#00D4AA" : tag.type === "down" ? "#FF4D6D" : tag.type === "high" ? "#A78BFA" : "#FFB74D",
                }}>{tag.text}</span>
              ))}
            </div>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-[10px] mono-num" style={{ color: "#00D4AA" }}>{todaySignal.upProb}%</span>
              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(40,50,70,0.6)" }}>
                <div className="h-full rounded-full" style={{ width: `${todaySignal.upProb}%`, background: "linear-gradient(to right, #00D4AA, rgba(0,212,170,0.4))" }} />
              </div>
              <span className="text-[10px] mono-num" style={{ color: "#FF4D6D" }}>{todaySignal.downProb}%</span>
            </div>
            <div className="text-[10px] leading-relaxed" style={{ color: "#7A8899" }}>{todaySignal.signal.trim()}</div>
            {todaySignal.planets.length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {todaySignal.planets.map((p, i) => (
                  <div key={i} className="text-[10px]" style={{ color: "#4A5568" }}>• {p}</div>
                ))}
              </div>
            )}
            {todaySignal.warning && (
              <div className="mt-1.5 text-[10px] px-2 py-1 rounded" style={{ background: "rgba(255,183,77,0.08)", borderLeft: "2px solid #FFB74D", color: "#FFB74D" }}>
                {todaySignal.warning}
              </div>
            )}
            {fibWindows.length > 0 && (
              <div className="mt-1.5 text-[10px] px-2 py-1 rounded" style={{ background: "rgba(167,139,250,0.06)", borderLeft: "2px solid rgba(167,139,250,0.4)", color: "#A78BFA" }}>
                最近变盘点：{fibWindows[0].dateShow}（{fibWindows[0].levelText}）
              </div>
            )}
        </div>

        {/* 斯波那契变盘窗口 */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40,50,70,0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>斯波那契变盘窗口</div>
            <div className="space-y-1.5">
              {fibWindows.length === 0 ? (
                <div className="text-[10px]" style={{ color: "#4A5568" }}>近期无变盘窗口</div>
              ) : fibWindows.map((fw, i) => (
                <div key={i} className="px-2 py-1.5 rounded" style={{
                  background: "rgba(20,25,40,0.7)",
                  border: `1px solid ${fw.level === "high" ? "rgba(167,139,250,0.35)" : fw.level === "mid" ? "rgba(255,183,77,0.25)" : "rgba(40,50,70,0.4)"}`
                }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="mono-num text-[11px] font-bold" style={{ color: "#E8EDF5" }}>{fw.dateShow}</span>
                    <span className="text-[10px]" style={{ color: fw.level === "high" ? "#A78BFA" : fw.level === "mid" ? "#FFB74D" : "#4A5568" }}>{fw.levelText}</span>
                  </div>
                  <div className="text-[10px]" style={{ color: "#4A5568" }}>{fw.anchorName} · Fib{fw.fibNum}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: "#7A8899" }}>{fw.desc}</div>
                </div>
              ))}
            </div>
        </div>

        {/* 未来7天预报 */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40,50,70,0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>未来7天预报</div>
            <div className="grid grid-cols-7 gap-0.5">
              {sevenDayForecast.map((day, i) => (
                <div key={i} className="flex flex-col items-center py-1.5 px-0.5 rounded" style={{ background: "rgba(20,25,40,0.6)" }}>
                  <div className="text-[9px] mb-1" style={{ color: "#4A5568" }}>{i === 0 ? "今" : day.dateShow}</div>
                  <div className="text-[10px] font-bold mono-num" style={{ color: day.upProb >= 50 ? "#00D4AA" : "#FF4D6D" }}>
                    {day.upProb >= 50 ? `↑${day.upProb}` : `↓${day.downProb}`}
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: "#4A5568" }}>{day.weekday}</div>
                </div>
              ))}
            </div>
        </div>

        {/* BTC分析规则 */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40,50,70,0.4)" }}>
            <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>BTC分析规则</div>
            <div className="space-y-1.5">
              {ANALYSIS_RULES.map((rule, i) => (
                <div key={i} className="px-2 py-1.5 rounded" style={{
                  background: "rgba(20,25,40,0.6)",
                  borderLeft: `2px solid ${rule.type === "up" ? "rgba(0,212,170,0.5)" : rule.type === "down" ? "rgba(255,77,109,0.5)" : rule.type === "high" ? "rgba(167,139,250,0.5)" : "rgba(255,183,77,0.5)"}`
                }}>
                  <div className="text-[10px] font-bold mb-0.5" style={{ color: rule.type === "up" ? "#00D4AA" : rule.type === "down" ? "#FF4D6D" : rule.type === "high" ? "#A78BFA" : "#FFB74D" }}>
                    {rule.emoji} {rule.title}
                  </div>
                  <div className="text-[10px] leading-relaxed" style={{ color: "#4A5568" }}>{rule.desc}</div>
                </div>
              ))}
            </div>
        </div>

        {/* NR4/NR7 tab - moved to main center column below indicators */}
        {false && (
          <div className="px-3 py-3 overflow-y-auto flex-1" style={{ maxHeight: "calc(100vh - 320px)" }}>

            {/* 多周期共振评分 */}
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>多周期共振评分</div>
              <div className="px-2.5 py-2 rounded" style={{ background: "rgba(20,25,40,0.8)", border: `1px solid ${nrResonanceScore.score >= 5 ? "rgba(167,139,250,0.4)" : nrResonanceScore.score >= 3 ? "rgba(255,183,77,0.3)" : "rgba(40,50,70,0.5)"}` }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="w-3 h-3 rounded-sm" style={{ background: i < nrResonanceScore.score ? (nrResonanceScore.score >= 7 ? "#A78BFA" : nrResonanceScore.score >= 4 ? "#FFB74D" : "#4A5568") : "rgba(40,50,70,0.5)" }} />
                    ))}
                  </div>
                  <span className="mono-num text-sm font-bold" style={{ color: nrResonanceScore.score >= 7 ? "#A78BFA" : nrResonanceScore.score >= 4 ? "#FFB74D" : "#7A8899" }}>{nrResonanceScore.score}/10</span>
                </div>
                {nrResonanceScore.signals.length > 0 ? (
                  <div className="space-y-0.5">
                    {nrResonanceScore.signals.map((s, i) => (
                      <div key={i} className="text-[10px]" style={{ color: "#7A8899" }}>• {s}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px]" style={{ color: "#4A5568" }}>暂无多周期共振信号</div>
                )}
              </div>
            </div>

            {/* 多周期NR扫描 */}
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>多周期NR扫描</div>
              <div className="space-y-1.5">
                {(["1h", "4h", "1d"] as const).map((tf) => {
                  const tfLabels = { "1h": "1H", "4h": "4H", "1d": "1D" };
                  const analysis = multiTFNR[tf];
                  const sig = analysis?.latestSignal;
                  const hasNR = analysis?.currentNR || (sig && sig.type !== "NONE");
                  const dir = sig?.direction ?? "neutral";
                  const borderColor = !hasNR ? "rgba(40,50,70,0.4)" : dir === "bullish" ? "rgba(0,212,170,0.35)" : dir === "bearish" ? "rgba(255,77,109,0.35)" : "rgba(167,139,250,0.35)";
                  const bgColor = !hasNR ? "rgba(20,25,40,0.5)" : dir === "bullish" ? "rgba(0,212,170,0.06)" : dir === "bearish" ? "rgba(255,77,109,0.06)" : "rgba(167,139,250,0.06)";
                  const textColor = !hasNR ? "#4A5568" : dir === "bullish" ? "#00D4AA" : dir === "bearish" ? "#FF4D6D" : "#A78BFA";
                  return (
                    <div key={tf} className="px-2.5 py-2 rounded" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="mono-num text-xs font-bold" style={{ color: "#E8EDF5" }}>{tfLabels[tf]}</span>
                          {analysis?.currentNR && (
                            <span className="text-[10px] px-1 py-0.5 rounded font-bold" style={{ background: "rgba(167,139,250,0.2)", color: "#A78BFA" }}>{analysis.currentNR.nrType}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {sig && <span className="text-[10px] mono-num" style={{ color: "#FFD700" }}>{sig.probability}%</span>}
                          <span className="text-[10px]" style={{ color: textColor }}>
                            {!hasNR ? "无信号" : sig?.label ?? "收缩中"}
                          </span>
                        </div>
                      </div>
                      {sig && (
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div><span style={{ color: "#4A5568" }}>触发 </span><span className="mono-num" style={{ color: textColor }}>${sig.triggerPrice.toFixed(0)}</span></div>
                          <div><span style={{ color: "#4A5568" }}>止损 </span><span className="mono-num" style={{ color: "#FF4D6D" }}>${sig.stopPrice.toFixed(0)}</span></div>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(40,50,70,0.6)" }}>
                          <div className="h-full rounded-full" style={{ width: `${analysis?.compressionPct ?? 50}%`, background: (analysis?.compressionPct ?? 50) < 30 ? "#A78BFA" : (analysis?.compressionPct ?? 50) < 60 ? "#FFB74D" : "#4A5568" }} />
                        </div>
                        <span className="text-[9px] mono-num" style={{ color: "#4A5568" }}>收缩{(analysis?.compressionPct ?? 50).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 信号历史列表 */}
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>信号历史列表</div>
              {nrSignalHistory.length === 0 ? (
                <div className="text-[10px]" style={{ color: "#4A5568" }}>{multiTFLoading ? "加载中..." : "暂无历史信号"}</div>
              ) : (
                <div className="space-y-1">
                  {nrSignalHistory.map((item, i) => {
                    const tfLabels: Record<string, string> = { "1h": "1H", "4h": "4H", "1d": "1D" };
                    const nrColor = item.bar.nrType === "NR4+NR7" ? "#A78BFA" : item.bar.nrType === "NR7" ? "#FFD700" : "#7A8899";
                    const timeStr = item.time.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " " + item.time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px]" style={{ background: "rgba(20,25,40,0.6)" }}>
                        <span className="font-bold" style={{ color: nrColor }}>{item.bar.nrType}</span>
                        <span className="px-1 py-0.5 rounded text-[9px]" style={{ background: "rgba(40,50,70,0.6)", color: "#7A8899" }}>{tfLabels[item.tf]}</span>
                        <span className="mono-num" style={{ color: "#4A5568" }}>H:{item.bar.high.toFixed(0)}</span>
                        <span className="mono-num" style={{ color: "#4A5568" }}>L:{item.bar.low.toFixed(0)}</span>
                        <span className="ml-auto mono-num" style={{ color: "#2D3748" }}>{timeStr}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 多图回测面板 */}
            <div className="mb-3">
              <div className="text-[10px] uppercase tracking-widest mb-1.5" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>多图回测面板</div>
              <div className="rounded p-2.5" style={{ background: "rgba(20,25,40,0.7)", border: "1px solid rgba(40,50,70,0.5)" }}>
                <div className="text-[10px] font-bold mb-2" style={{ color: "#FFB74D" }}>⚡ 全周期联动 — 批次变盘预警</div>
                <div className="text-[10px] mb-2" style={{ color: "#7A8899" }}>NR = 4 · 7 · N 收缩 → 次日突破高低点触发信号，结合 EMA20 趋势过滤假突破</div>
                {(["1h", "4h", "1d"] as const).map((tf) => {
                  const tfLabels: Record<string, string> = { "1h": "1H", "4h": "4H", "1d": "1D" };
                  const analysis = multiTFNR[tf];
                  const bars = analysis?.recentNRBars ?? [];
                  const maxRange = bars.length > 0 ? Math.max(...bars.map(b => b.range)) : 1;
                  return (
                    <div key={tf} className="mb-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-bold" style={{ color: "#E8EDF5", fontFamily: "'JetBrains Mono', monospace" }}>{tfLabels[tf]}</span>
                        <span className="text-[9px]" style={{ color: "#4A5568" }}>NR4:{analysis?.nr4Count ?? 0} NR7:{analysis?.nr7Count ?? 0}</span>
                        <div className="flex-1 flex items-end gap-0.5 h-6">
                          {bars.slice(-20).map((bar, i) => {
                            const h = Math.max(2, Math.round((1 - bar.range / maxRange) * 20));
                            const barColor = bar.nrType === "NR4+NR7" ? "#A78BFA" : bar.nrType === "NR7" ? "#FFD700" : "#00D4AA";
                            return (
                              <div key={i} title={`${bar.nrType} H:${bar.high.toFixed(0)} L:${bar.low.toFixed(0)}`}
                                style={{ width: 4, height: h, background: barColor, borderRadius: 1, flexShrink: 0 }} />
                            );
                          })}
                          {bars.length === 0 && <span className="text-[9px]" style={{ color: "#2D3748" }}>无收缩信号</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: "#A78BFA" }} /><span className="text-[9px]" style={{ color: "#4A5568" }}>NR4+NR7</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: "#FFD700" }} /><span className="text-[9px]" style={{ color: "#4A5568" }}>NR7</span></div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-sm" style={{ background: "#00D4AA" }} /><span className="text-[9px]" style={{ color: "#4A5568" }}>NR4</span></div>
                </div>
              </div>
            </div>

            {/* 说明 */}
            <div className="mt-1 text-[10px] px-2 py-1.5 rounded" style={{ background: "rgba(255,183,77,0.06)", borderLeft: "2px solid rgba(255,183,77,0.3)", color: "#4A5568" }}>
              NR4=近4根最小波幅 NR7=近7根最小波幅<br/>收缩越小→爆发力越强，次日突破高低点触发信号
            </div>
          </div>
        )}

        {/* Astro sentiment */}
        <div className="px-3 py-3 border-b" style={{ borderColor: "rgba(40, 50, 70, 0.4)" }}>
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>星象情绪</div>
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded mb-2"
            style={{
              background: astroSentiment.score >= 0 ? "rgba(0, 212, 170, 0.08)" : "rgba(255, 77, 109, 0.08)",
              border: `1px solid ${astroSentiment.score >= 0 ? "rgba(0, 212, 170, 0.25)" : "rgba(255, 77, 109, 0.25)"}`,
            }}
          >
            <span className="text-xs" style={{ color: astroSentiment.score >= 0 ? "#00D4AA" : "#FF4D6D", fontFamily: "'Space Grotesk', sans-serif" }}>
              {astroSentiment.label}
            </span>
            <span className="mono-num text-xs ml-auto" style={{ color: astroSentiment.score >= 0 ? "#00D4AA" : "#FF4D6D" }}>
              {astroSentiment.score > 0 ? "+" : ""}{astroSentiment.score}
            </span>
          </div>
          <div className="text-[10px]" style={{ color: "#4A5568" }}>
            {moonPhase.phaseSymbol} {moonPhase.phase} · 照明 {moonPhase.illumination.toFixed(0)}%
          </div>
          {retrogradeplanets.length > 0 && (
            <div className="mt-1 text-[10px]" style={{ color: "#FF4D6D" }}>
              ℞ {retrogradeplanets.map((p) => p.name).join("、")} 逆行
            </div>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "rgba(40, 50, 70, 0.4)" }}>
          <div className="text-[10px] text-center" style={{ color: "#2D3748" }}>
            数据来源：Binance API<br />
            <span style={{ color: "#1A2030" }}>仅供参考，不构成投资建议</span>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header
          className="flex items-center gap-4 px-4 py-2 flex-shrink-0"
          style={{
            background: "rgba(8, 10, 20, 0.88)",
            borderBottom: "1px solid rgba(40, 50, 70, 0.6)",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Symbol + price */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ fontFamily: "'Space Grotesk', sans-serif", color: "#E8EDF5" }}>{symbolLabel}</span>
            {ticker ? (
              <PriceDisplay price={ticker.price} change={ticker.priceChange} changePercent={ticker.priceChangePercent} />
            ) : (
              <span className="text-sm" style={{ color: "#4A5568" }}>加载中...</span>
            )}
            <LiveDot />
          </div>

          <div className="flex-1" />

          {/* Interval selector */}
          <div className="flex items-center gap-1">
            {INTERVALS.map((iv) => (
              <button
                key={iv.value}
                onClick={() => setInterval(iv.value)}
                className="px-2.5 py-1 rounded text-xs transition-all"
                style={{
                  background: interval === iv.value ? "rgba(0, 212, 170, 0.15)" : "transparent",
                  color: interval === iv.value ? "#00D4AA" : "#4A5568",
                  border: interval === iv.value ? "1px solid rgba(0, 212, 170, 0.3)" : "1px solid transparent",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {iv.label}
              </button>
            ))}
          </div>

          {/* Overlay toggles */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEMA(!showEMA)}
              className="px-2 py-1 rounded text-[10px] transition-all"
              style={{
                background: showEMA ? "rgba(255, 215, 0, 0.12)" : "transparent",
                color: showEMA ? "#FFD700" : "#4A5568",
                border: showEMA ? "1px solid rgba(255, 215, 0, 0.3)" : "1px solid rgba(40, 50, 70, 0.4)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              EMA
            </button>
            <button
              onClick={() => setShowBB(!showBB)}
              className="px-2 py-1 rounded text-[10px] transition-all"
              style={{
                background: showBB ? "rgba(100, 200, 255, 0.12)" : "transparent",
                color: showBB ? "#64C8FF" : "#4A5568",
                border: showBB ? "1px solid rgba(100, 200, 255, 0.3)" : "1px solid rgba(40, 50, 70, 0.4)",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              BB
            </button>
          </div>

          {/* Multi-TF NR status badges */}
          <div className="hidden lg:flex items-center gap-1">
            {(["1h", "4h", "1d"] as const).map((tf) => {
              const tfLabel = { "1h": "1H", "4h": "4H", "1d": "1D" }[tf];
              const analysis = multiTFNR[tf];
              const hasNR = analysis?.currentNR;
              const dir = analysis?.latestSignal?.direction ?? "neutral";
              const badgeColor = !hasNR ? "#4A5568" : dir === "bullish" ? "#00D4AA" : dir === "bearish" ? "#FF4D6D" : "#A78BFA";
              const badgeBg = !hasNR ? "rgba(40,50,70,0.3)" : dir === "bullish" ? "rgba(0,212,170,0.12)" : dir === "bearish" ? "rgba(255,77,109,0.12)" : "rgba(167,139,250,0.12)";
              const nrText = hasNR ? analysis.currentNR!.nrType : "–";
              return (
                <div key={tf} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                  <span className="text-[9px] font-bold" style={{ color: "#7A8899", fontFamily: "'JetBrains Mono', monospace" }}>{tfLabel}</span>
                  <span className="text-[9px] font-bold" style={{ color: badgeColor, fontFamily: "'JetBrains Mono', monospace" }}>{nrText}</span>
                </div>
              );
            })}
          </div>

          {/* Toggle astro panel */}
          <button
            onClick={() => setShowAstroPanel(!showAstroPanel)}
            className="px-2.5 py-1 rounded text-xs transition-all"
            style={{
              background: showAstroPanel ? "rgba(167, 139, 250, 0.12)" : "transparent",
              color: showAstroPanel ? "#A78BFA" : "#4A5568",
              border: showAstroPanel ? "1px solid rgba(167, 139, 250, 0.3)" : "1px solid rgba(40, 50, 70, 0.4)",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ✦ 星象面板
          </button>
        </header>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chart + indicators + NR panel */}
          <div className="flex-1 flex flex-col overflow-y-auto p-3 gap-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(40,50,70,0.6) transparent' }}>
            {/* EMA info bar */}
            {showEMA && emaValues.ema20 && (
              <div className="flex items-center gap-4 text-[10px]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: "#FFD700" }}>EMA20: ${emaValues.ema20.toFixed(2)}</span>
                {emaValues.ema50 && <span style={{ color: "#A78BFA" }}>EMA50: ${emaValues.ema50.toFixed(2)}</span>}
                {lastRSI !== null && (
                  <span style={{ color: lastRSI > 70 ? "#FF4D6D" : lastRSI < 30 ? "#00D4AA" : "#7A8899" }}>
                    RSI(14): {lastRSI.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {/* K-line chart */}
            <div
              className="rounded overflow-hidden flex-shrink-0"
              style={{
                background: "rgba(8, 10, 20, 0.85)",
                border: "1px solid rgba(40, 50, 70, 0.6)",
                backdropFilter: "blur(8px)",
                height: "360px",
              }}
            >
              {klinesLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-[#00D4AA] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <div className="text-xs" style={{ color: "#4A5568" }}>加载行情数据...</div>
                  </div>
                </div>
              ) : (
                <CandlestickChart data={klines} height={320} showEMA={showEMA} showBB={showBB} nrBars={nrAnalysis.recentNRBars} />
              )}
            </div>

            {/* Indicator tabs + chart */}
            <div
              className="rounded overflow-hidden flex-shrink-0"
              style={{
                background: "rgba(8, 10, 20, 0.85)",
                border: "1px solid rgba(40, 50, 70, 0.6)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div className="flex items-center gap-0 px-3 pt-2 pb-0 border-b" style={{ borderColor: "rgba(40, 50, 70, 0.4)" }}>
                {(["rsi", "macd"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveIndicator(tab)}
                    className="px-3 py-1.5 text-xs transition-all border-b-2 -mb-px"
                    style={{
                      color: activeIndicator === tab ? "#A78BFA" : "#4A5568",
                      borderBottomColor: activeIndicator === tab ? "#A78BFA" : "transparent",
                      fontFamily: "'JetBrains Mono', monospace",
                      background: "transparent",
                    }}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
                <div className="flex-1" />
                <span className="text-[10px] pr-2" style={{ color: "#2D3748" }}>
                  {activeIndicator === "rsi" ? "相对强弱指数 (14)" : "MACD (12,26,9)"}
                </span>
              </div>
              <div className="p-2">
                <IndicatorChart data={klines} type={activeIndicator} height={140} />
              </div>
            </div>

            {/* ===== 变盘共振评分面板 (中间列) ===== */}
            <div
              className="rounded flex-shrink-0 mb-3"
              style={{
                background: "rgba(8, 10, 20, 0.88)",
                border: `1px solid ${fibResonanceScore.levelColor}40`,
                backdropFilter: "blur(8px)",
              }}
            >
              {/* 变盘共振 Panel Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(40,50,70,0.5)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "#FFB74D", fontFamily: "'Space Grotesk', sans-serif" }}>变盘共振评分</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${fibResonanceScore.levelColor}20`, color: fibResonanceScore.levelColor }}>{fibResonanceScore.level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="mono-num text-sm font-bold" style={{ color: fibResonanceScore.levelColor }}>{fibResonanceScore.score}/{fibResonanceScore.maxScore}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-sm" style={{ background: i < fibResonanceScore.score ? fibResonanceScore.levelColor : "rgba(40,50,70,0.5)" }} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 py-3">
                {fibResonanceScore.factors.length > 0 ? (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                    {fibResonanceScore.factors.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[10px]">
                        <span style={{ color: f.color }}>• {f.label}</span>
                        <span className="mono-num" style={{ color: "#4A5568" }}>+{f.pts.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px]" style={{ color: "#4A5568" }}>当前无共振因素</div>
                )}
              </div>
            </div>

            {/* ===== NR4/NR7 PANEL (中间列下方) ===== */}
            <div
              className="rounded flex-shrink-0"
              style={{
                background: "rgba(8, 10, 20, 0.88)",
                border: "1px solid rgba(167,139,250,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              {/* NR Panel Header */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: "rgba(40,50,70,0.5)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color: "#A78BFA", fontFamily: "'Space Grotesk', sans-serif" }}>NR4 / NR7 波动收缩信号</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>多周期扫描</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: "#A78BFA" }} /><span className="text-[10px]" style={{ color: "#7A8899" }}>NR4+NR7</span>
                    <div className="w-2 h-2 rounded-sm ml-1" style={{ background: "#FFD700" }} /><span className="text-[10px]" style={{ color: "#7A8899" }}>NR7</span>
                    <div className="w-2 h-2 rounded-sm ml-1" style={{ background: "#00D4AA" }} /><span className="text-[10px]" style={{ color: "#7A8899" }}>NR4</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]" style={{ color: "#4A5568" }}>共振</span>
                    <span className="mono-num text-xs font-bold" style={{ color: nrResonanceScore.score >= 7 ? "#A78BFA" : nrResonanceScore.score >= 4 ? "#FFB74D" : "#7A8899" }}>{nrResonanceScore.score}/10</span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-sm" style={{ background: i < nrResonanceScore.score ? (nrResonanceScore.score >= 7 ? "#A78BFA" : nrResonanceScore.score >= 4 ? "#FFB74D" : "#4A5568") : "rgba(40,50,70,0.5)" }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {/* 块1：NR4/NR7 波动收缩信号 — 1H/4H/1D 横排 */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {(["1h", "4h", "1d"] as const).map((tf) => {
                    const tfLabels = { "1h": "1H", "4h": "4H", "1d": "1D" };
                    const analysis = multiTFNR[tf];
                    const sig = analysis?.latestSignal;
                    const hasNR = analysis?.currentNR || (sig && sig.type !== "NONE");
                    const dir = sig?.direction ?? "neutral";
                    const borderColor = !hasNR ? "rgba(40,50,70,0.4)" : dir === "bullish" ? "rgba(0,212,170,0.4)" : dir === "bearish" ? "rgba(255,77,109,0.4)" : "rgba(167,139,250,0.4)";
                    const bgColor = !hasNR ? "rgba(20,25,40,0.5)" : dir === "bullish" ? "rgba(0,212,170,0.07)" : dir === "bearish" ? "rgba(255,77,109,0.07)" : "rgba(167,139,250,0.07)";
                    const textColor = !hasNR ? "#4A5568" : dir === "bullish" ? "#00D4AA" : dir === "bearish" ? "#FF4D6D" : "#A78BFA";
                    return (
                      <div key={tf} className="px-3 py-2.5 rounded" style={{ background: bgColor, border: `1px solid ${borderColor}` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="mono-num text-sm font-bold" style={{ color: "#E8EDF5" }}>{tfLabels[tf]}</span>
                            {analysis?.currentNR && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(167,139,250,0.2)", color: "#A78BFA" }}>{analysis.currentNR.nrType}</span>
                            )}
                          </div>
                          <span className="text-[10px]" style={{ color: textColor }}>{!hasNR ? "无信号" : sig?.label ?? "收缩中"}</span>
                        </div>
                        {sig ? (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span style={{ color: "#4A5568" }}>触发</span>
                              <span className="mono-num" style={{ color: textColor }}>${sig.triggerPrice.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span style={{ color: "#4A5568" }}>止损</span>
                              <span className="mono-num" style={{ color: "#FF4D6D" }}>${sig.stopPrice.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span style={{ color: "#4A5568" }}>概率</span>
                              <span className="mono-num" style={{ color: "#FFD700" }}>{sig.probability}%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[10px]" style={{ color: "#2D3748" }}>等待收缩信号...</div>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(40,50,70,0.6)" }}>
                            <div className="h-full rounded-full" style={{ width: `${analysis?.compressionPct ?? 50}%`, background: (analysis?.compressionPct ?? 50) < 30 ? "#A78BFA" : (analysis?.compressionPct ?? 50) < 60 ? "#FFB74D" : "#4A5568" }} />
                          </div>
                          <span className="text-[9px] mono-num" style={{ color: "#4A5568" }}>收缩{(analysis?.compressionPct ?? 50).toFixed(0)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 块2：多图回测面板 — 全宽 */}
                <div className="mb-4">
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>多图回测面板</div>
                  <div className="rounded p-4" style={{ background: "rgba(20,25,40,0.7)", border: "1px solid rgba(40,50,70,0.5)" }}>
                    <div className="text-[10px] font-bold mb-1.5" style={{ color: "#FFB74D" }}>⚡ 全周期联动 — 批次变盘预警</div>
                    <div className="text-[10px] mb-4" style={{ color: "#7A8899" }}>NR = 4 · 7 · N 收缩 → 次日突破高低点触发信号，结合 EMA20 趋势过滤假突破</div>
                    <div className="grid grid-cols-3 gap-4">
                      {(["1h", "4h", "1d"] as const).map((tf) => {
                        const tfLabels: Record<string, string> = { "1h": "1H", "4h": "4H", "1d": "1D" };
                        const analysis = multiTFNR[tf];
                        const bars = analysis?.recentNRBars ?? [];
                        const maxRange = bars.length > 0 ? Math.max(...bars.map(b => b.range)) : 1;
                        return (
                          <div key={tf}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold w-6" style={{ color: "#E8EDF5", fontFamily: "'JetBrains Mono', monospace" }}>{tfLabels[tf]}</span>
                              <span className="text-[9px]" style={{ color: "#4A5568" }}>NR4:{analysis?.nr4Count ?? 0} NR7:{analysis?.nr7Count ?? 0}</span>
                            </div>
                            <div className="flex items-end gap-0.5 h-10 px-1">
                              {bars.slice(-40).map((bar, i) => {
                                const h = Math.max(3, Math.round((1 - bar.range / maxRange) * 36));
                                const barColor = bar.nrType === "NR4+NR7" ? "#A78BFA" : bar.nrType === "NR7" ? "#FFD700" : "#00D4AA";
                                return (
                                  <div key={i} title={`${bar.nrType} H:${bar.high.toFixed(0)} L:${bar.low.toFixed(0)}`}
                                    style={{ width: 6, height: h, background: barColor, borderRadius: 1, flexShrink: 0, opacity: 0.85 }} />
                                );
                              })}
                              {bars.length === 0 && <span className="text-[9px]" style={{ color: "#2D3748" }}>无收缩信号</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] px-2 py-1.5 rounded" style={{ background: "rgba(255,183,77,0.06)", borderLeft: "2px solid rgba(255,183,77,0.3)", color: "#4A5568" }}>
                    NR4=近4根最小波幅 · NR7=近7根最小波幅 · 收缩越小→爆发力越强，次日突破高低点触发信号
                  </div>
                </div>

                {/* 块3：信号历史列表 — 全宽，单列纵向，按 1H→4H→1D 分组，每组 5 条共 15 行 */}
                <div>
                  <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>信号历史列表</div>
                  {nrSignalHistory.length === 0 ? (
                    <div className="text-[10px] text-center py-6" style={{ color: "#2D3748" }}>{multiTFLoading ? "加载中..." : "暂无历史信号"}</div>
                  ) : (
                    <div className="space-y-3">
                      {(["1h", "4h", "1d"] as const).map((tf) => {
                        const tfLabels: Record<string, string> = { "1h": "1H", "4h": "4H", "1d": "1D" };
                        const tfColorMap: Record<string, string> = { "1h": "#00D4AA", "4h": "#FFB74D", "1d": "#A78BFA" };
                        const group = nrSignalHistory
                          .filter(item => item.tf === tf)
                          .sort((a, b) => b.time.getTime() - a.time.getTime())
                          .slice(0, 5);
                        return (
                          <div key={tf}>
                            {/* 分组标题 */}
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-bold" style={{ color: tfColorMap[tf], fontFamily: "'JetBrains Mono', monospace" }}>{tfLabels[tf]}</span>
                              <div className="flex-1 h-px" style={{ background: `${tfColorMap[tf]}30` }} />
                              <span className="text-[9px]" style={{ color: "#2D3748" }}>{group.length}/5</span>
                            </div>
                            {group.length === 0 ? (
                              <div className="text-[10px] px-3 py-1.5" style={{ color: "#2D3748" }}>暂无{tfLabels[tf]}信号</div>
                            ) : (
                              <div className="space-y-1">
                                {group.map((item, i) => {
                                  const nrColor = item.bar.nrType === "NR4+NR7" ? "#A78BFA" : item.bar.nrType === "NR7" ? "#FFD700" : "#00D4AA";
                                  const timeStr = item.time.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" }) + " " + item.time.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
                                  return (
                                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded" style={{ background: "rgba(20,25,40,0.7)", border: "1px solid rgba(40,50,70,0.4)" }}>
                                      <span className="text-[10px] font-bold w-16 shrink-0" style={{ color: nrColor }}>{item.bar.nrType}</span>
                                      <div className="flex-1 text-[10px] mono-num">
                                        <span style={{ color: "#00D4AA" }}>H:{item.bar.high.toFixed(0)}</span>
                                        <span className="mx-1.5" style={{ color: "#2D3748" }}>/</span>
                                        <span style={{ color: "#FF4D6D" }}>L:{item.bar.low.toFixed(0)}</span>
                                      </div>
                                      <span className="text-[9px] mono-num shrink-0" style={{ color: "#4A5568" }}>{timeStr}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ===== Delta 三角洲理论面板 ===== */}
            <div
              className="rounded mt-3"
              style={{
                background: "rgba(8, 10, 20, 0.65)",
                border: "1px solid rgba(60, 80, 110, 0.4)",
                padding: "12px 14px",
              }}
            >
              {/* 顶部标题 + 评分 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-bold"
                    style={{ color: "#FF6B9D", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    △ Delta 三角洲理论
                  </span>
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background:
                        deltaAnalysis.bias === "bullish"
                          ? "rgba(0,212,170,0.15)"
                          : deltaAnalysis.bias === "bearish"
                          ? "rgba(255,77,109,0.15)"
                          : "rgba(74,85,104,0.2)",
                      color:
                        deltaAnalysis.bias === "bullish"
                          ? "#00D4AA"
                          : deltaAnalysis.bias === "bearish"
                          ? "#FF4D6D"
                          : "#A0AEC0",
                    }}
                  >
                    {deltaAnalysis.bias === "bullish"
                      ? "偏多 (即将见底)"
                      : deltaAnalysis.bias === "bearish"
                      ? "偏空 (即将见顶)"
                      : "中性"}
                  </span>
                  <span
                    className="text-[10px]"
                    style={{ color: "#4A5568", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    强度 {deltaAnalysis.strength}/100
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px]" style={{ color: "#4A5568" }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                    创世锁定 · ITD 日线周期
                  </span>
                </div>
              </div>

              {/* 当前循环信息 */}
              {deltaAnalysis.cycle && (
                <div
                  className="mb-3 px-3 py-2 rounded"
                  style={{
                    background: "rgba(20,25,40,0.8)",
                    border: "1px solid rgba(255,107,157,0.2)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-[10px] uppercase tracking-widest"
                      style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}
                    >
                      第 {deltaAnalysis.cycle.cycleIndex + 1} 个 Delta 循环
                    </span>
                    <span
                      className="text-[10px] mono-num"
                      style={{ color: "#FF6B9D" }}
                    >
                      {deltaAnalysis.cycle.currentDayInCycle}/{deltaAnalysis.cycle.totalDays} 天 · {deltaAnalysis.cycle.progress.toFixed(1)}%
                    </span>
                  </div>
                  <div
                    className="w-full h-1.5 rounded overflow-hidden"
                    style={{ background: "rgba(40,50,70,0.6)" }}
                  >
                    <div
                      style={{
                        width: `${deltaAnalysis.cycle.progress}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #FF6B9D, #FFB74D)",
                      }}
                    />
                  </div>
                  <div
                    className="flex items-center justify-between mt-1.5 text-[9px]"
                    style={{ color: "#4A5568", fontFamily: "'JetBrains Mono', monospace" }}
                  >
                    <span>起点 {deltaAnalysis.cycle.cycleStart.toLocaleDateString("zh-CN", { year: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                    <span>终点 {deltaAnalysis.cycle.cycleEnd.toLocaleDateString("zh-CN", { year: "2-digit", month: "2-digit", day: "2-digit" })}</span>
                  </div>
                </div>
              )}

              {/* 三列核心信号卡 */}
              <div className="grid grid-cols-3 gap-3 mb-3">
                {/* 活跃信号 */}
                <div
                  className="px-3 py-2 rounded"
                  style={{
                    background: deltaAnalysis.activeSignal
                      ? "rgba(255,77,109,0.08)"
                      : "rgba(20,25,40,0.7)",
                    border: deltaAnalysis.activeSignal
                      ? "1px solid rgba(255,77,109,0.4)"
                      : "1px solid rgba(40,50,70,0.4)",
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest mb-1.5"
                    style={{ color: "#FF4D6D", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    ● 活跃转折窗口
                  </div>
                  {deltaAnalysis.activeSignal ? (
                    <>
                      <div
                        className="text-sm font-bold mono-num mb-0.5"
                        style={{
                          color: deltaAnalysis.activeSignal.turnover.isHigh ? "#FFB74D" : "#00D4AA",
                        }}
                      >
                        {deltaAnalysis.activeSignal.turnover.isHigh ? "高点" : "低点"}转折
                      </div>
                      <div className="text-[10px] mono-num" style={{ color: "#A0AEC0" }}>
                        理论日 {deltaAnalysis.activeSignal.turnover.date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: "#4A5568" }}>
                        偏移 {deltaAnalysis.activeSignal.turnover.offsetDay} 天 · 序 #{deltaAnalysis.activeSignal.turnover.seqIndex + 1}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: "#4A5568" }}>今日无活跃窗口</div>
                  )}
                </div>

                {/* 下一个转折点 */}
                <div
                  className="px-3 py-2 rounded"
                  style={{
                    background: "rgba(20,25,40,0.7)",
                    border: "1px solid rgba(40,50,70,0.4)",
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest mb-1.5"
                    style={{ color: "#FFB74D", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    → 下个转折窗口
                  </div>
                  {deltaAnalysis.nextSignal ? (
                    <>
                      <div
                        className="text-sm font-bold mono-num mb-0.5"
                        style={{
                          color: deltaAnalysis.nextSignal.turnover.isHigh ? "#FFB74D" : "#00D4AA",
                        }}
                      >
                        {deltaAnalysis.nextSignal.turnover.isHigh ? "高点" : "低点"}转折
                      </div>
                      <div className="text-[10px] mono-num" style={{ color: "#A0AEC0" }}>
                        {deltaAnalysis.nextSignal.daysToWindow} 天后入场
                      </div>
                      <div className="text-[9px] mt-0.5" style={{ color: "#4A5568" }}>
                        {deltaAnalysis.nextSignal.turnover.windowStart.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} → {deltaAnalysis.nextSignal.turnover.windowEnd.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: "#4A5568" }}>未来 60 天无信号</div>
                  )}
                </div>

                {/* 60天信号计数 */}
                <div
                  className="px-3 py-2 rounded"
                  style={{
                    background: "rgba(20,25,40,0.7)",
                    border: "1px solid rgba(40,50,70,0.4)",
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest mb-1.5"
                    style={{ color: "#A78BFA", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    ▣ 60日转折点
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[9px]" style={{ color: "#FFB74D" }}>高点</div>
                      <div className="text-sm font-bold mono-num" style={{ color: "#FFB74D" }}>
                        {deltaAnalysis.signals.filter((s) => s.turnover.isHigh).length}
                      </div>
                    </div>
                    <div className="w-px h-7" style={{ background: "rgba(40,50,70,0.6)" }} />
                    <div>
                      <div className="text-[9px]" style={{ color: "#00D4AA" }}>低点</div>
                      <div className="text-sm font-bold mono-num" style={{ color: "#00D4AA" }}>
                        {deltaAnalysis.signals.filter((s) => !s.turnover.isHigh).length}
                      </div>
                    </div>
                    <div className="w-px h-7" style={{ background: "rgba(40,50,70,0.6)" }} />
                    <div>
                      <div className="text-[9px]" style={{ color: "#A0AEC0" }}>总计</div>
                      <div className="text-sm font-bold mono-num" style={{ color: "#E8EDF5" }}>
                        {deltaAnalysis.signals.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 转折点时间轴 */}
              <div>
                <div
                  className="text-[10px] uppercase tracking-widest mb-2"
                  style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  未来60天 Delta 转折点时间线
                </div>
                {deltaAnalysis.signals.length === 0 ? (
                  <div className="text-[10px] text-center py-3" style={{ color: "#2D3748" }}>
                    未来60天无Delta转折点信号
                  </div>
                ) : (
                  <div className="space-y-1">
                    {deltaAnalysis.signals.slice(0, 8).map((signal, i) => {
                      const t = signal.turnover;
                      const turnColor = t.isHigh ? "#FFB74D" : "#00D4AA";
                      const urgencyColor =
                        signal.urgency === "active"
                          ? "#FF4D6D"
                          : signal.urgency === "imminent"
                          ? "#FFD700"
                          : signal.urgency === "near"
                          ? "#A78BFA"
                          : "#4A5568";
                      const urgencyLabel =
                        signal.urgency === "active"
                          ? "进行中"
                          : signal.urgency === "imminent"
                          ? "迫近"
                          : signal.urgency === "near"
                          ? "临近"
                          : "远期";
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-1.5 rounded"
                          style={{
                            background:
                              signal.urgency === "active"
                                ? "rgba(255,77,109,0.08)"
                                : "rgba(20,25,40,0.7)",
                            border: `1px solid ${
                              signal.urgency === "active"
                                ? "rgba(255,77,109,0.3)"
                                : "rgba(40,50,70,0.4)"
                            }`,
                          }}
                        >
                          <span
                            className="text-[10px] font-bold w-10 shrink-0 text-center"
                            style={{ color: turnColor }}
                          >
                            {t.isHigh ? "▲ 高" : "▼ 低"}
                          </span>
                          <span
                            className="text-[10px] mono-num shrink-0 w-20"
                            style={{ color: "#E8EDF5" }}
                          >
                            {t.date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                          <span
                            className="text-[9px] mono-num flex-1"
                            style={{ color: "#4A5568" }}
                          >
                            窗口 {t.windowStart.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} → {t.windowEnd.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              background: `${urgencyColor}20`,
                              color: urgencyColor,
                            }}
                          >
                            {urgencyLabel}
                          </span>
                          <span
                            className="text-[9px] mono-num shrink-0 w-16 text-right"
                            style={{ color: "#4A5568" }}
                          >
                            {signal.daysToWindow > 0
                              ? `+${signal.daysToWindow}天`
                              : signal.inWindow
                              ? "窗口内"
                              : `${signal.daysToWindow}天`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 过去30天回测面板 */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    过去30天 Delta 转折点回测
                  </div>
                  {deltaAnalysis.hitStats.total > 0 && (
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[9px] mono-num"
                        style={{ color: "#A0AEC0" }}
                      >
                        命中 {deltaAnalysis.hitStats.hits}/{deltaAnalysis.hitStats.total}
                      </span>
                      <span
                        className="text-[10px] font-bold mono-num px-2 py-0.5 rounded"
                        style={{
                          background:
                            deltaAnalysis.hitStats.hitRate >= 60
                              ? "rgba(0,212,170,0.18)"
                              : deltaAnalysis.hitStats.hitRate >= 40
                              ? "rgba(255,183,77,0.18)"
                              : "rgba(255,77,109,0.18)",
                          color:
                            deltaAnalysis.hitStats.hitRate >= 60
                              ? "#00D4AA"
                              : deltaAnalysis.hitStats.hitRate >= 40
                              ? "#FFB74D"
                              : "#FF4D6D",
                        }}
                      >
                        {deltaAnalysis.hitStats.hitRate}%
                      </span>
                    </div>
                  )}
                </div>
                {deltaAnalysis.backtests.length === 0 ? (
                  <div className="text-[10px] text-center py-3" style={{ color: "#2D3748" }}>
                    过去30天无Delta转折点信号
                  </div>
                ) : (
                  <div className="space-y-1">
                    {deltaAnalysis.backtests.map((bt, i) => {
                      const t = bt.turnover;
                      const turnColor = t.isHigh ? "#FFB74D" : "#00D4AA";
                      const hitColor = bt.hit
                        ? "#00D4AA"
                        : bt.actualPrice !== null
                        ? "#FF4D6D"
                        : "#4A5568";
                      const hitLabel = bt.hit
                        ? "命中"
                        : bt.actualPrice !== null
                        ? "偏移"
                        : "无数据";
                      return (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-1.5 rounded"
                          style={{
                            background: bt.hit
                              ? "rgba(0,212,170,0.06)"
                              : bt.actualPrice !== null
                              ? "rgba(255,77,109,0.05)"
                              : "rgba(20,25,40,0.7)",
                            border: `1px solid ${
                              bt.hit
                                ? "rgba(0,212,170,0.25)"
                                : bt.actualPrice !== null
                                ? "rgba(255,77,109,0.2)"
                                : "rgba(40,50,70,0.4)"
                            }`,
                          }}
                        >
                          <span
                            className="text-[10px] font-bold w-10 shrink-0 text-center"
                            style={{ color: turnColor }}
                          >
                            {t.isHigh ? "▲ 高" : "▼ 低"}
                          </span>
                          <span
                            className="text-[10px] mono-num shrink-0 w-20"
                            style={{ color: "#E8EDF5" }}
                          >
                            {t.date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                          </span>
                          <span
                            className="text-[9px] mono-num flex-1"
                            style={{ color: "#4A5568" }}
                          >
                            {bt.actualPrice !== null && bt.actualDate ? (
                              <>
                                实际{t.isHigh ? "高" : "低"} ${bt.actualPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} · {bt.actualDate.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                              </>
                            ) : (
                              <>窗口 {t.windowStart.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} → {t.windowEnd.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}</>
                            )}
                          </span>
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ background: `${hitColor}20`, color: hitColor }}
                          >
                            {hitLabel}
                            {bt.deviationDays !== null && (
                              <span className="ml-1 mono-num">
                                {bt.deviationDays >= 0 ? "+" : ""}
                                {bt.deviationDays}d
                              </span>
                            )}
                          </span>
                          <span
                            className="text-[9px] mono-num shrink-0 w-16 text-right"
                            style={{ color: "#4A5568" }}
                          >
                            {bt.daysAgo}天前
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 理论说明 */}
              <div
                className="mt-3 px-3 py-2 rounded text-[9px] leading-relaxed"
                style={{
                  background: "rgba(20,25,40,0.5)",
                  border: "1px solid rgba(40,50,70,0.3)",
                  color: "#4A5568",
                }}
              >
                <span style={{ color: "#FF6B9D", fontWeight: 600 }}>Delta 理论</span>
                {" · "}
                以 BTC 创世日 (2009/01/04) 为绝对锚点，每 4 个农历月 (≈ 118 天) 为一个循环。
                循环内按 BTC 专属 Delta 序列在固定偏移日呈现高低交替转折，每个转折点附带 ±3 天误差窗口。
                高/低点交替出现反映市场节奏周期。
              </div>
            </div>

          </div>

          {/* ===== RIGHT ASTRO PANEL ===== */}
          <AnimatePresence>
            {showAstroPanel && (
              <motion.aside
                initial={false}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="flex-shrink-0 overflow-hidden"
                style={{
                  background: "rgba(8, 10, 20, 0.92)",
                  borderLeft: "1px solid rgba(40, 50, 70, 0.6)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <div className="w-[300px] h-full flex flex-col overflow-hidden">
                  {/* Tab bar */}
                  <div className="flex items-center gap-0 px-3 pt-2 pb-0 border-b flex-shrink-0" style={{ borderColor: "rgba(40,50,70,0.5)" }}>
                    {(["alerts", "wheel", "planets"] as const).map((tab) => {
                      const labels: Record<string, string> = { alerts: "⚡ 提醒", wheel: "✦ 轮盘", planets: "♄ 行星" };
                      return (
                        <button
                          key={tab}
                          onClick={() => setAstroTab(tab)}
                          className="px-2.5 py-1.5 text-[10px] transition-all border-b-2 -mb-px"
                          style={{
                            color: astroTab === tab ? "#A78BFA" : "#4A5568",
                            borderBottomColor: astroTab === tab ? "#A78BFA" : "transparent",
                            fontFamily: "'Space Grotesk', sans-serif",
                            background: "transparent",
                          }}
                        >
                          {labels[tab]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Tab content */}
                  <div className="flex-1 overflow-y-auto p-3">
                    {/* ALERTS TAB */}
                    {astroTab === "alerts" && (
                      <AstroAlertPanel alerts={astroAlerts} events={upcomingEvents} srLevels={srLevels} currentPrice={ticker?.price ?? 0} />
                    )}

                    {/* WHEEL TAB */}
                    {astroTab === "wheel" && (
                      <div className="space-y-4">
                        <div>
                          <SectionHeader title="星象轮盘" icon="✦" />
                          <div className="flex justify-center">
                            <AstroWheel planets={planets} size={260} />
                          </div>
                        </div>
                        <div>
                          <SectionHeader title="月相" icon="☽" />
                          <div
                            className="rounded p-3"
                            style={{
                              background: moonPhase.marketBias === "bullish" ? "rgba(0, 212, 170, 0.06)" : moonPhase.marketBias === "bearish" ? "rgba(255, 77, 109, 0.06)" : "rgba(40, 50, 70, 0.3)",
                              border: `1px solid ${moonPhase.marketBias === "bullish" ? "rgba(0, 212, 170, 0.2)" : moonPhase.marketBias === "bearish" ? "rgba(255, 77, 109, 0.2)" : "rgba(40, 50, 70, 0.4)"}`,
                            }}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <span className="text-3xl">{moonPhase.phaseSymbol}</span>
                              <div>
                                <div className="text-sm font-semibold" style={{ color: "#E8EDF5", fontFamily: "'Space Grotesk', sans-serif" }}>{moonPhase.phase}</div>
                                <div className="text-xs" style={{ color: "#7A8899" }}>照明度 {moonPhase.illumination.toFixed(1)}% · 月龄 {moonPhase.age.toFixed(1)}天</div>
                              </div>
                            </div>
                            <div className="text-[11px] leading-relaxed" style={{ color: "#7A8899" }}>{moonPhase.influence}</div>
                            <div className="mt-2 flex gap-3 text-[10px]">
                              <div><span style={{ color: "#4A5568" }}>下次新月 </span><span className="mono-num" style={{ color: "#7A8899" }}>{moonPhase.nextNewMoon.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span></div>
                              <div><span style={{ color: "#4A5568" }}>下次满月 </span><span className="mono-num" style={{ color: "#7A8899" }}>{moonPhase.nextFullMoon.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}</span></div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <SectionHeader title="行星相位" icon="☌" />
                          <div className="space-y-1">
                            {aspects.slice(0, 8).map((asp, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px]"
                                style={{
                                  background: asp.influence === "bullish" ? "rgba(0,212,170,0.06)" : asp.influence === "bearish" ? "rgba(255,77,109,0.06)" : "rgba(20,25,40,0.4)",
                                  border: `1px solid ${asp.influence === "bullish" ? "rgba(0,212,170,0.15)" : asp.influence === "bearish" ? "rgba(255,77,109,0.15)" : "rgba(40,50,70,0.3)"}`,
                                }}
                              >
                                <span style={{ color: asp.influence === "bullish" ? "#00D4AA" : asp.influence === "bearish" ? "#FF4D6D" : "#7A8899" }}>{asp.planet1} {asp.symbol} {asp.planet2}</span>
                                <span className="flex-1 text-right text-[10px]" style={{ color: "#4A5568" }}>{asp.aspect} ±{asp.orb.toFixed(1)}°</span>
                                <span className="text-[10px] px-1 rounded" style={{ background: asp.strength === "strong" ? "rgba(255,215,0,0.15)" : "transparent", color: asp.strength === "strong" ? "#FFD700" : "#4A5568" }}>{asp.strength === "strong" ? "强" : asp.strength === "moderate" ? "中" : "弱"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <SectionHeader title="星象综合评分" icon="⚖" />
                          <div className="rounded p-3" style={{ background: "rgba(20,25,40,0.6)", border: "1px solid rgba(40,50,70,0.4)" }}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xs" style={{ color: "#FF4D6D", fontFamily: "'JetBrains Mono', monospace" }}>-100</span>
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(40,50,70,0.6)" }}>
                                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(astroSentiment.score + 100) / 2}%`, background: astroSentiment.score >= 0 ? "linear-gradient(to right, rgba(0,212,170,0.5), #00D4AA)" : "linear-gradient(to right, #FF4D6D, rgba(255,77,109,0.5))" }} />
                              </div>
                              <span className="text-xs" style={{ color: "#00D4AA", fontFamily: "'JetBrains Mono', monospace" }}>+100</span>
                            </div>
                            <div className="text-center">
                              <span className="text-2xl font-bold mono-num" style={{ color: astroSentiment.score >= 0 ? "#00D4AA" : "#FF4D6D" }}>{astroSentiment.score > 0 ? "+" : ""}{astroSentiment.score}</span>
                              <span className="ml-2 text-sm" style={{ color: "#7A8899", fontFamily: "'Space Grotesk', sans-serif" }}>{astroSentiment.label}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PLANETS TAB */}
                    {astroTab === "planets" && (
                      <div className="space-y-4">
                        <div>
                          <SectionHeader title="行星位置" icon="♄" />
                          <div className="space-y-1">
                            {planets.map((p) => (
                              <div key={p.name} className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: "rgba(20,25,40,0.6)" }}>
                                <span className="text-base w-5 text-center" style={{ color: p.color }}>{p.symbol}</span>
                                <span className="text-xs w-10" style={{ color: "#7A8899", fontFamily: "'Space Grotesk', sans-serif" }}>{p.name}</span>
                                <span className="text-xs flex-1" style={{ color: p.color }}>{p.signSymbol} {p.sign}</span>
                                <span className="mono-num text-[10px]" style={{ color: "#4A5568" }}>{p.degree.toFixed(1)}°</span>
                                {p.isRetrograde && <span className="text-[10px] font-bold" style={{ color: "#FF4D6D" }}>℞</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <SectionHeader title="本命盘参考" icon="₿" />
                          <div className="rounded p-3 space-y-1.5" style={{ background: "rgba(20,25,40,0.6)", border: "1px solid rgba(40,50,70,0.4)" }}>
                            <div className="text-[10px] mb-2" style={{ color: "#4A5568" }}>创世区块 2009-01-03 18:15 UTC</div>
                            {[
                              { label: "太阳", val: "摩羯座 13°" },
                              { label: "月亮", val: "白羊座 15°" },
                              { label: "金星", val: "双鱼座 15°" },
                              { label: "火星", val: "摩羯座 15°" },
                              { label: "冥王星", val: "摩羯座 1°" },
                            ].map(({ label, val }) => (
                              <div key={label} className="flex justify-between text-[11px]">
                                <span style={{ color: "#7A8899" }}>{label}</span>
                                <span className="mono-num" style={{ color: "#A78BFA" }}>{val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
