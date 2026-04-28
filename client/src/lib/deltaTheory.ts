/**
 * deltaTheory.ts — BTC Delta 三角洲理论监控模块
 *
 * 基于 BTC 创世出生日期校准循环起点，适配 ITD 日线周期
 * BTC 出生日期：北京时间 2009/01/04 02:15
 *
 * 核心思想：
 *   - 以 BTC 创世日为绝对锚点
 *   - 每 4 个农历月为一个 Delta 循环
 *   - 每个循环内按 BTC_DELTA_SEQUENCE 偏移天数生成转折点
 *   - 转折点高低交替，每个点附带 ±3 天误差窗口
 */

// ─── 核心配置 ──────────────────────────────────────────────────────────────────

/** BTC 创世出生日期（北京时间 2009-01-04 02:15）*/
export const BTC_BIRTH_DATE = new Date(Date.UTC(2009, 0, 3, 18, 15)); // UTC: 2009-01-03 18:15

/** Delta 循环长度（农历月数），4 个月 ≈ 118 天 */
export const DELTA_CYCLE_LUNAR_MONTHS = 4;

/** 一个农历月的近似天数（朔望月 = 29.5306 天）*/
const LUNAR_MONTH_DAYS = 29.5306;

/** 转折点误差窗口（天），理论默认 2-3 天 */
export const TURNOVER_ERROR_WINDOW = 3;

/**
 * BTC 专属 Delta 序列：每个元素代表【相对于循环起点的偏移天数】
 * 这些数字由 Delta 理论的 8/11 转折点法则启发，可根据历史行情拟合
 */
export const BTC_DELTA_SEQUENCE: number[] = [
  6, 15, 26, 35, 47, 58, 69, 78, 89, 100, 110,
];

/** 是否反转高低点（默认 false，序列开头为高点）*/
export const IS_SEQUENCE_REVERSED = false;

// ─── 类型定义 ──────────────────────────────────────────────────────────────────

export interface DeltaTurnover {
  /** 转折点理论日期（循环起点 + 偏移）*/
  date: Date;
  /** 是否为高点（false 即低点）*/
  isHigh: boolean;
  /** 该转折点所在循环的起点 */
  cycleStart: Date;
  /** 该转折点在循环序列中的索引（0-based）*/
  seqIndex: number;
  /** 偏移天数 */
  offsetDay: number;
  /** 窗口起始日（理论日 - TURNOVER_ERROR_WINDOW）*/
  windowStart: Date;
  /** 窗口结束日（理论日 + TURNOVER_ERROR_WINDOW）*/
  windowEnd: Date;
}

export interface DeltaCycleInfo {
  /** 循环起点 */
  cycleStart: Date;
  /** 循环结束 */
  cycleEnd: Date;
  /** 循环序号（从创世起算）*/
  cycleIndex: number;
  /** 当前位置在循环内的天数 */
  currentDayInCycle: number;
  /** 循环总天数 */
  totalDays: number;
  /** 进度百分比（0-100）*/
  progress: number;
}

export interface DeltaSignal {
  /** 转折点对象 */
  turnover: DeltaTurnover;
  /** 距今天数（负值表示已过窗口起点）*/
  daysToWindow: number;
  /** 当前是否处于窗口内 */
  inWindow: boolean;
  /** 信号紧急级别 */
  urgency: "active" | "imminent" | "near" | "far";
}

// ─── 工具函数 ──────────────────────────────────────────────────────────────────

/** 将日期归一化到当天 00:00（去除时分秒）*/
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** 在日期上加 n 天 */
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** 计算两日期相差天数（向下取整）*/
function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.floor(ms / 86400000);
}

// ─── 周期边界生成 ──────────────────────────────────────────────────────────────

/**
 * 根据 BTC 出生日期，生成所有 Delta 循环的起点
 * 使用朔望月平均天数近似农历月（无需引入农历库），
 * 工程上误差 < 1 天，处于 TURNOVER_ERROR_WINDOW 容忍范围内
 */
export function getDeltaCycleBoundaries(endDate: Date): Date[] {
  const boundaries: Date[] = [];
  const cycleDays = DELTA_CYCLE_LUNAR_MONTHS * LUNAR_MONTH_DAYS;
  const totalSpan = diffDays(endDate, BTC_BIRTH_DATE);
  const cycleCount = Math.ceil(totalSpan / cycleDays) + 1;

  for (let i = 0; i < cycleCount; i++) {
    const offset = Math.round(i * cycleDays);
    const cycleStart = addDays(BTC_BIRTH_DATE, offset);
    if (cycleStart > endDate) break;
    boundaries.push(cycleStart);
  }

  return boundaries;
}

// ─── 转折点生成 ────────────────────────────────────────────────────────────────

/**
 * 根据周期边界和 Delta 序列，生成所有的转折点日期
 */
export function generateDeltaTurnovers(
  boundaries: Date[]
): DeltaTurnover[] {
  const turnovers: DeltaTurnover[] = [];

  for (const cycleStart of boundaries) {
    BTC_DELTA_SEQUENCE.forEach((offsetDay, idx) => {
      const turnoverDate = addDays(cycleStart, offsetDay);
      const isHigh = IS_SEQUENCE_REVERSED ? idx % 2 === 1 : idx % 2 === 0;
      turnovers.push({
        date: turnoverDate,
        isHigh,
        cycleStart,
        seqIndex: idx,
        offsetDay,
        windowStart: addDays(turnoverDate, -TURNOVER_ERROR_WINDOW),
        windowEnd: addDays(turnoverDate, TURNOVER_ERROR_WINDOW),
      });
    });
  }

  return turnovers;
}

// ─── 信号检测 ──────────────────────────────────────────────────────────────────

/**
 * 检查当前日期附近的 Delta 转折点信号
 * @param turnovers 所有转折点
 * @param currentDate 当前日期
 * @param futureDays 向前查看天数（默认 60）
 */
export function checkDeltaSignals(
  turnovers: DeltaTurnover[],
  currentDate: Date,
  futureDays: number = 60
): DeltaSignal[] {
  const today = startOfDay(currentDate);
  const futureLimit = addDays(today, futureDays);

  return turnovers
    .filter((t) => t.windowEnd >= today && t.windowStart <= futureLimit)
    .map((turnover) => {
      const daysToWindow = diffDays(turnover.windowStart, today);
      const inWindow =
        currentDate >= turnover.windowStart &&
        currentDate <= turnover.windowEnd;
      let urgency: DeltaSignal["urgency"];
      if (inWindow) urgency = "active";
      else if (daysToWindow <= 3) urgency = "imminent";
      else if (daysToWindow <= 7) urgency = "near";
      else urgency = "far";
      return { turnover, daysToWindow, inWindow, urgency };
    })
    .sort((a, b) => a.turnover.date.getTime() - b.turnover.date.getTime());
}

// ─── 历史回测 ──────────────────────────────────────────────────────────────────

/** K线数据点（用于回测匹配价格高低）*/
export interface PriceCandle {
  /** 时间戳（毫秒）*/
  time: number;
  high: number;
  low: number;
  close: number;
}

/** 历史回测信号（带命中校验）*/
export interface DeltaBacktest {
  /** 转折点对象 */
  turnover: DeltaTurnover;
  /** 距今天数（正值表示已经过去 N 天）*/
  daysAgo: number;
  /** 窗口期内匹配到的实际极值价格 */
  actualPrice: number | null;
  /** 窗口期内极值出现的实际日期 */
  actualDate: Date | null;
  /** 是否命中（窗口内出现局部极值）*/
  hit: boolean;
  /** 实际极值与理论日的偏差天数（正值=极值在理论日之后）*/
  deviationDays: number | null;
}

/**
 * 基于过去N天的实际K线数据，对Delta转折点进行历史回测
 * @param turnovers 所有转折点
 * @param currentDate 当前日期
 * @param pastDays 向后查看天数（默认 30）
 * @param candles 真实K线数据（按时间升序），可选
 */
export function backtestDeltaSignals(
  turnovers: DeltaTurnover[],
  currentDate: Date,
  pastDays: number = 30,
  candles?: PriceCandle[]
): DeltaBacktest[] {
  const today = startOfDay(currentDate);
  const pastLimit = addDays(today, -pastDays);

  return turnovers
    .filter((t) => t.date < today && t.date >= pastLimit)
    .map((turnover) => {
      const daysAgo = diffDays(today, turnover.date);
      let actualPrice: number | null = null;
      let actualDate: Date | null = null;
      let hit = false;
      let deviationDays: number | null = null;

      if (candles && candles.length > 0) {
        const winStart = turnover.windowStart.getTime();
        const winEnd = turnover.windowEnd.getTime() + 86400000; // 包含 windowEnd 当天
        const inWin = candles.filter(
          (c) => c.time >= winStart && c.time <= winEnd
        );
        if (inWin.length > 0) {
          if (turnover.isHigh) {
            const peak = inWin.reduce((max, c) =>
              c.high > max.high ? c : max
            );
            actualPrice = peak.high;
            actualDate = new Date(peak.time);
          } else {
            const trough = inWin.reduce((min, c) =>
              c.low < min.low ? c : min
            );
            actualPrice = trough.low;
            actualDate = new Date(trough.time);
          }
          deviationDays = diffDays(actualDate, turnover.date);
          hit = Math.abs(deviationDays) <= TURNOVER_ERROR_WINDOW;
        }
      }

      return {
        turnover,
        daysAgo,
        actualPrice,
        actualDate,
        hit,
        deviationDays,
      };
    })
    .sort((a, b) => a.turnover.date.getTime() - b.turnover.date.getTime());
}

// ─── 当前循环信息 ──────────────────────────────────────────────────────────────

/**
 * 获取当前所在的 Delta 循环信息
 */
export function getCurrentCycle(currentDate: Date): DeltaCycleInfo | null {
  const cycleDays = DELTA_CYCLE_LUNAR_MONTHS * LUNAR_MONTH_DAYS;
  const totalSpan = diffDays(currentDate, BTC_BIRTH_DATE);
  if (totalSpan < 0) return null;

  const cycleIndex = Math.floor(totalSpan / cycleDays);
  const cycleStart = addDays(BTC_BIRTH_DATE, Math.round(cycleIndex * cycleDays));
  const cycleEnd = addDays(BTC_BIRTH_DATE, Math.round((cycleIndex + 1) * cycleDays));
  const currentDayInCycle = diffDays(currentDate, cycleStart);
  const totalDays = diffDays(cycleEnd, cycleStart);
  const progress = (currentDayInCycle / totalDays) * 100;

  return {
    cycleStart,
    cycleEnd,
    cycleIndex,
    currentDayInCycle,
    totalDays,
    progress: Math.max(0, Math.min(100, progress)),
  };
}

// ─── 综合分析 ──────────────────────────────────────────────────────────────────

export interface DeltaAnalysis {
  cycle: DeltaCycleInfo | null;
  signals: DeltaSignal[];
  /** 历史回测：过去N天的转折点（带命中校验）*/
  backtests: DeltaBacktest[];
  activeSignal: DeltaSignal | null;
  nextSignal: DeltaSignal | null;
  /** 综合趋势倾向（基于即将到来的转折点性质）*/
  bias: "bullish" | "bearish" | "neutral";
  /** 0-100 的强度评分 */
  strength: number;
  /** 历史命中统计 */
  hitStats: {
    total: number;
    hits: number;
    hitRate: number; // 0-100
  };
}

/**
 * 一站式获取 BTC Delta 理论分析结果
 * @param currentDate 当前日期
 * @param candles 真实K线数据（按时间升序），用于历史回测
 */
export function getDeltaAnalysis(
  currentDate: Date = new Date(),
  candles?: PriceCandle[]
): DeltaAnalysis {
  const cycle = getCurrentCycle(currentDate);
  // 同时覆盖过去30天和未来90天
  const boundaries = getDeltaCycleBoundaries(addDays(currentDate, 90));
  const turnovers = generateDeltaTurnovers(boundaries);
  const signals = checkDeltaSignals(turnovers, currentDate, 60);
  const backtests = backtestDeltaSignals(turnovers, currentDate, 30, candles);

  const activeSignal = signals.find((s) => s.inWindow) ?? null;
  const nextSignal = signals.find((s) => !s.inWindow) ?? null;

  // 计算偏向性：当前活跃 + 接下来 14 天内的转折点
  const focus = signals.filter((s) => s.inWindow || s.daysToWindow <= 14);
  let highCount = 0;
  let lowCount = 0;
  focus.forEach((s) => {
    if (s.turnover.isHigh) highCount++;
    else lowCount++;
  });

  let bias: DeltaAnalysis["bias"] = "neutral";
  if (highCount > lowCount) bias = "bearish"; // 即将见顶 → 偏空
  else if (lowCount > highCount) bias = "bullish"; // 即将见底 → 偏多

  // 强度：活跃窗口加权
  let strength = 0;
  if (activeSignal) strength += 60;
  if (nextSignal && nextSignal.daysToWindow <= 3) strength += 25;
  else if (nextSignal && nextSignal.daysToWindow <= 7) strength += 15;
  strength = Math.min(100, strength + focus.length * 3);

  // 历史命中统计
  const matched = backtests.filter((b) => b.actualPrice !== null);
  const hits = matched.filter((b) => b.hit).length;
  const hitStats = {
    total: matched.length,
    hits,
    hitRate: matched.length > 0 ? Math.round((hits / matched.length) * 100) : 0,
  };

  return {
    cycle,
    signals,
    backtests,
    activeSignal,
    nextSignal,
    bias,
    strength,
    hitStats,
  };
}
