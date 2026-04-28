/**
 * nr4nr7.ts — NR4/NR7 波动收缩量化信号
 * NR4/NR7 = 波动收缩 → 即将变盘 → 大概率出大行情
 * 收缩越小 → 爆发力越强
 */

import type { KlineData } from "@/hooks/useBinanceData";

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export type NRType = "NR4" | "NR7" | "NR4+NR7" | null;

export type NRSignalType =
  | "LONG_BREAKOUT"    // 多头突破
  | "SHORT_BREAKOUT"   // 空头突破
  | "LONG_MIDPOINT"    // 内部多头（中点突破）
  | "SHORT_MIDPOINT"   // 内部空头（中点突破）
  | "NR_FORMING"       // 收缩形成中（等待突破）
  | "NONE";

export interface NRBar {
  index: number;
  time: number;
  nrType: NRType;
  range: number;
  high: number;
  low: number;
  midpoint: number;
  rangeRank: number;      // 当前波幅在近20根中的百分位（越低越收缩）
}

export interface NRSignal {
  type: NRSignalType;
  nrType: NRType;
  direction: "bullish" | "bearish" | "neutral";
  label: string;
  description: string;
  triggerPrice: number;   // 触发价格（突破上沿或下沿）
  stopPrice: number;      // 止损参考价
  nrHigh: number;         // 收缩K线最高价
  nrLow: number;          // 收缩K线最低价
  nrTime: number;         // 收缩K线时间戳
  currentClose: number;   // 当前收盘价
  ema20Above: boolean;    // 价格是否在EMA20上方（趋势过滤）
  strength: "strong" | "moderate" | "weak";
  probability: number;    // 信号概率估计
}

export interface NRAnalysis {
  /** 最新一根K线的NR状态 */
  currentNR: NRBar | null;
  /** 最近出现的NR信号（可能已触发或等待触发） */
  latestSignal: NRSignal | null;
  /** 最近N根K线中所有NR4/NR7 bars */
  recentNRBars: NRBar[];
  /** 当前收盘价是否已突破上一根NR的高低点 */
  breakoutStatus: "above_high" | "below_low" | "inside" | "no_nr";
  /** 统计：近50根K线中NR4/NR7出现次数 */
  nr4Count: number;
  nr7Count: number;
  /** 当前波幅收缩程度（0=最收缩，100=最扩张） */
  compressionPct: number;
}

// ─── 核心计算 ─────────────────────────────────────────────────────────────────

/**
 * 计算NR4/NR7信号
 * @param klines K线数据数组（按时间升序）
 * @param ema20 EMA20数组（与klines等长）
 */
export function calcNR4NR7(klines: KlineData[], ema20: number[]): NRAnalysis {
  const n = klines.length;

  if (n < 10) {
    return {
      currentNR: null,
      latestSignal: null,
      recentNRBars: [],
      breakoutStatus: "no_nr",
      nr4Count: 0,
      nr7Count: 0,
      compressionPct: 50,
    };
  }

  // 计算每根K线的波幅
  const ranges = klines.map((k) => k.high - k.low);

  // 计算NR4/NR7标志
  const isNR4 = ranges.map((r, i) => {
    if (i < 3) return false;
    const window = ranges.slice(i - 3, i + 1);
    return r === Math.min(...window);
  });

  const isNR7 = ranges.map((r, i) => {
    if (i < 6) return false;
    const window = ranges.slice(i - 6, i + 1);
    return r === Math.min(...window);
  });

  // 构建NR bars
  const recentNRBars: NRBar[] = [];
  const lookback = Math.min(50, n);

  // 计算近20根波幅的百分位
  const recent20Ranges = ranges.slice(Math.max(0, n - 20), n);
  const sortedRanges = [...recent20Ranges].sort((a, b) => a - b);

  for (let i = n - lookback; i < n; i++) {
    if (!isNR4[i] && !isNR7[i]) continue;
    const nrType: NRType = isNR4[i] && isNR7[i] ? "NR4+NR7" : isNR7[i] ? "NR7" : "NR4";
    const rangeRank = sortedRanges.findIndex((r) => r >= ranges[i]) / sortedRanges.length * 100;
    recentNRBars.push({
      index: i,
      time: klines[i].time,
      nrType,
      range: ranges[i],
      high: klines[i].high,
      low: klines[i].low,
      midpoint: (klines[i].high + klines[i].low) / 2,
      rangeRank,
    });
  }

  // 当前K线NR状态
  const lastIdx = n - 1;
  const currentNR: NRBar | null = (isNR4[lastIdx] || isNR7[lastIdx])
    ? {
        index: lastIdx,
        time: klines[lastIdx].time,
        nrType: isNR4[lastIdx] && isNR7[lastIdx] ? "NR4+NR7" : isNR7[lastIdx] ? "NR7" : "NR4",
        range: ranges[lastIdx],
        high: klines[lastIdx].high,
        low: klines[lastIdx].low,
        midpoint: (klines[lastIdx].high + klines[lastIdx].low) / 2,
        rangeRank: sortedRanges.findIndex((r) => r >= ranges[lastIdx]) / sortedRanges.length * 100,
      }
    : null;

  // 统计近50根中NR4/NR7出现次数
  const nr4Count = isNR4.slice(Math.max(0, n - 50)).filter(Boolean).length;
  const nr7Count = isNR7.slice(Math.max(0, n - 50)).filter(Boolean).length;

  // 当前波幅收缩程度
  const currentRange = ranges[lastIdx];
  const compressionPct = sortedRanges.findIndex((r) => r >= currentRange) / Math.max(1, sortedRanges.length - 1) * 100;

  // 寻找最近一根NR bar（用于突破判断）
  let lastNRBar: NRBar | null = null;
  for (let i = n - 2; i >= Math.max(0, n - 10); i--) {
    if (isNR4[i] || isNR7[i]) {
      const nrType: NRType = isNR4[i] && isNR7[i] ? "NR4+NR7" : isNR7[i] ? "NR7" : "NR4";
      lastNRBar = {
        index: i,
        time: klines[i].time,
        nrType,
        range: ranges[i],
        high: klines[i].high,
        low: klines[i].low,
        midpoint: (klines[i].high + klines[i].low) / 2,
        rangeRank: sortedRanges.findIndex((r) => r >= ranges[i]) / sortedRanges.length * 100,
      };
      break;
    }
  }

  // 突破状态判断
  const currentClose = klines[lastIdx].close;
  let breakoutStatus: NRAnalysis["breakoutStatus"] = "no_nr";
  if (lastNRBar) {
    if (currentClose > lastNRBar.high) breakoutStatus = "above_high";
    else if (currentClose < lastNRBar.low) breakoutStatus = "below_low";
    else breakoutStatus = "inside";
  }

  // 生成信号
  const ema20Val = ema20[lastIdx] ?? currentClose;
  const ema20Above = currentClose > ema20Val;
  let latestSignal: NRSignal | null = null;

  // 优先判断当前K线是否是NR形成中
  if (currentNR) {
    // 当前K线本身就是NR，等待下一根突破
    const strength: "strong" | "moderate" | "weak" =
      currentNR.nrType === "NR4+NR7" ? "strong" : currentNR.nrType === "NR7" ? "moderate" : "weak";
    const prob = currentNR.nrType === "NR4+NR7" ? 75 : currentNR.nrType === "NR7" ? 65 : 58;

    latestSignal = {
      type: "NR_FORMING",
      nrType: currentNR.nrType,
      direction: "neutral",
      label: `${currentNR.nrType} 收缩形成`,
      description: `当前K线波幅极度收缩（${currentNR.nrType}），等待下根K线突破 ${currentNR.high.toFixed(0)} 做多 / 跌破 ${currentNR.low.toFixed(0)} 做空`,
      triggerPrice: currentNR.high,
      stopPrice: currentNR.low,
      nrHigh: currentNR.high,
      nrLow: currentNR.low,
      nrTime: currentNR.time,
      currentClose,
      ema20Above,
      strength,
      probability: prob,
    };
  } else if (lastNRBar) {
    // 判断是否已突破上一根NR
    const nrType = lastNRBar.nrType!;
    const strength: "strong" | "moderate" | "weak" =
      nrType === "NR4+NR7" ? "strong" : nrType === "NR7" ? "moderate" : "weak";

    if (breakoutStatus === "above_high") {
      // 多头突破
      const trendBoost = ema20Above ? 10 : -5;
      const prob = Math.min(85, (nrType === "NR4+NR7" ? 72 : nrType === "NR7" ? 65 : 58) + trendBoost);
      latestSignal = {
        type: "LONG_BREAKOUT",
        nrType,
        direction: "bullish",
        label: `${nrType} 多头突破`,
        description: `价格突破${nrType}收缩K线高点 ${lastNRBar.high.toFixed(0)}${ema20Above ? "，EMA20上方趋势确认" : "，但在EMA20下方注意假突破"}`,
        triggerPrice: lastNRBar.high,
        stopPrice: lastNRBar.low,
        nrHigh: lastNRBar.high,
        nrLow: lastNRBar.low,
        nrTime: lastNRBar.time,
        currentClose,
        ema20Above,
        strength,
        probability: prob,
      };
    } else if (breakoutStatus === "below_low") {
      // 空头突破
      const trendBoost = !ema20Above ? 10 : -5;
      const prob = Math.min(85, (nrType === "NR4+NR7" ? 72 : nrType === "NR7" ? 65 : 58) + trendBoost);
      latestSignal = {
        type: "SHORT_BREAKOUT",
        nrType,
        direction: "bearish",
        label: `${nrType} 空头突破`,
        description: `价格跌破${nrType}收缩K线低点 ${lastNRBar.low.toFixed(0)}${!ema20Above ? "，EMA20下方趋势确认" : "，但在EMA20上方注意假突破"}`,
        triggerPrice: lastNRBar.low,
        stopPrice: lastNRBar.high,
        nrHigh: lastNRBar.high,
        nrLow: lastNRBar.low,
        nrTime: lastNRBar.time,
        currentClose,
        ema20Above,
        strength,
        probability: prob,
      };
    } else if (breakoutStatus === "inside") {
      // 内部突破（中点判断）
      const midpoint = lastNRBar.midpoint;
      if (currentClose > midpoint) {
        latestSignal = {
          type: "LONG_MIDPOINT",
          nrType,
          direction: "bullish",
          label: `${nrType} 内部偏多`,
          description: `价格在${nrType}收缩区间内，突破中点 ${midpoint.toFixed(0)} 偏多，等待突破高点 ${lastNRBar.high.toFixed(0)} 确认`,
          triggerPrice: lastNRBar.high,
          stopPrice: midpoint,
          nrHigh: lastNRBar.high,
          nrLow: lastNRBar.low,
          nrTime: lastNRBar.time,
          currentClose,
          ema20Above,
          strength: "weak",
          probability: 55,
        };
      } else {
        latestSignal = {
          type: "SHORT_MIDPOINT",
          nrType,
          direction: "bearish",
          label: `${nrType} 内部偏空`,
          description: `价格在${nrType}收缩区间内，跌破中点 ${midpoint.toFixed(0)} 偏空，等待跌破低点 ${lastNRBar.low.toFixed(0)} 确认`,
          triggerPrice: lastNRBar.low,
          stopPrice: midpoint,
          nrHigh: lastNRBar.high,
          nrLow: lastNRBar.low,
          nrTime: lastNRBar.time,
          currentClose,
          ema20Above,
          strength: "weak",
          probability: 55,
        };
      }
    }
  }

  return {
    currentNR,
    latestSignal,
    recentNRBars,
    breakoutStatus,
    nr4Count,
    nr7Count,
    compressionPct,
  };
}
