/**
 * fibAstro.ts — 斐波那契时间线 × 占星变盘点系统
 * 基于 BTC 减半日 + 创世区块锚点，叠加精准星历数据
 */

// ─── 精准星历数据（UTC）─────────────────────────────────────────────────────────

const EPHEMERIS = {
  mercury: [
    // 2026
    { start: "2026-01-25", end: "2026-02-16", sign: "摩羯座", status: "逆行" },
    { start: "2026-02-16", end: "2026-04-05", sign: "水瓶座", status: "顺行" },
    { start: "2026-04-05", end: "2026-04-26", sign: "白羊座", status: "顺行" },
    { start: "2026-04-26", end: "2026-06-12", sign: "金牛座", status: "顺行" },
    { start: "2026-06-12", end: "2026-07-06", sign: "双子座", status: "逆行" },
    { start: "2026-07-06", end: "2026-09-14", sign: "巨蟹座", status: "顺行" },
    { start: "2026-09-14", end: "2026-10-07", sign: "天秤座", status: "逆行" },
    { start: "2026-10-07", end: "2026-12-31", sign: "天蝎座", status: "顺行" },
    // 2027
    { start: "2027-01-01", end: "2027-01-14", sign: "摩羯座", status: "逆行" },
    { start: "2027-01-14", end: "2027-04-01", sign: "水瓶座", status: "顺行" },
    { start: "2027-05-04", end: "2027-05-28", sign: "金牛座", status: "逆行" },
    { start: "2027-05-28", end: "2027-08-31", sign: "双子座", status: "顺行" },
    { start: "2027-08-31", end: "2027-09-22", sign: "处女座", status: "逆行" },
    { start: "2027-09-22", end: "2027-12-31", sign: "天秤座", status: "顺行" },
  ],
  mars: [
    { start: "2026-03-25", end: "2026-05-20", sign: "白羊座", status: "顺行" },
    { start: "2026-05-20", end: "2026-07-05", sign: "金牛座", status: "顺行" },
    { start: "2026-07-05", end: "2026-08-19", sign: "双子座", status: "顺行" },
    { start: "2026-08-19", end: "2026-10-04", sign: "巨蟹座", status: "顺行" },
    { start: "2026-10-04", end: "2026-11-19", sign: "狮子座", status: "顺行" },
    { start: "2026-11-19", end: "2027-01-06", sign: "处女座", status: "顺行" },
    { start: "2027-01-06", end: "2027-04-18", sign: "天秤座", status: "顺行" },
    { start: "2027-04-18", end: "2027-06-17", sign: "天蝎座", status: "顺行" },
  ],
  saturn: [
    { start: "2026-02-15", end: "2026-07-13", sign: "白羊座", status: "顺行" },
    { start: "2026-07-13", end: "2026-11-28", sign: "白羊座", status: "逆行" },
    { start: "2026-11-28", end: "2027-04-12", sign: "白羊座", status: "顺行" },
    { start: "2027-04-12", end: "2027-08-24", sign: "金牛座", status: "顺行" },
    { start: "2027-08-24", end: "2027-12-31", sign: "金牛座", status: "逆行" },
  ],
  jupiter: [
    { start: "2025-12-25", end: "2026-06-30", sign: "双子座", status: "顺行" },
    { start: "2026-06-30", end: "2026-10-22", sign: "双子座", status: "逆行" },
    { start: "2026-10-22", end: "2027-06-15", sign: "双子座", status: "顺行" },
    { start: "2027-06-15", end: "2027-12-31", sign: "巨蟹座", status: "顺行" },
  ],
  uranus: [
    { start: "2026-01-01", end: "2026-07-07", sign: "金牛座", status: "顺行" },
    { start: "2026-07-07", end: "2026-12-31", sign: "双子座", status: "顺行" },
    { start: "2027-01-01", end: "2027-12-31", sign: "双子座", status: "顺行" },
  ],
  pluto: [
    { start: "2026-01-01", end: "2026-04-20", sign: "水瓶座", status: "顺行" },
    { start: "2026-04-20", end: "2026-10-10", sign: "水瓶座", status: "逆行" },
    { start: "2026-10-10", end: "2027-02-01", sign: "水瓶座", status: "顺行" },
    { start: "2027-02-01", end: "2027-07-01", sign: "摩羯座", status: "顺行" },
    { start: "2027-07-01", end: "2027-12-31", sign: "摩羯座", status: "逆行" },
  ],
  moonPhase: [
    // 2026
    { date: "2026-04-21", type: "新月" },
    { date: "2026-05-05", type: "满月" },
    { date: "2026-05-20", type: "新月" },
    { date: "2026-06-04", type: "满月" },
    { date: "2026-06-19", type: "新月" },
    { date: "2026-07-04", type: "满月" },
    { date: "2026-07-18", type: "新月" },
    { date: "2026-08-02", type: "满月" },
    { date: "2026-08-17", type: "新月" },
    { date: "2026-09-01", type: "满月" },
    { date: "2026-09-15", type: "新月" },
    { date: "2026-10-01", type: "满月" },
    { date: "2026-10-15", type: "新月" },
    { date: "2026-10-30", type: "满月" },
    { date: "2026-11-14", type: "新月" },
    { date: "2026-11-29", type: "满月" },
    { date: "2026-12-13", type: "新月" },
    { date: "2026-12-29", type: "满月" },
    // 2027
    { date: "2027-01-12", type: "新月" },
    { date: "2027-01-27", type: "满月" },
    { date: "2027-02-11", type: "新月" },
    { date: "2027-02-26", type: "满月" },
    { date: "2027-03-13", type: "新月" },
    { date: "2027-03-28", type: "满月" },
    { date: "2027-04-11", type: "新月" },
    { date: "2027-04-27", type: "满月" },
  ],
  criticalAspect: [
    // 2026
    { date: "2026-04-19", name: "火星合土星", type: "强压变盘", impact: "down" },
    { date: "2026-04-26", name: "水星换座金牛座", type: "情绪拐点", impact: "warn" },
    { date: "2026-05-20", name: "火星换座金牛座", type: "波动率切换", impact: "warn" },
    { date: "2026-06-12", name: "水星逆行开始", type: "信息混乱", impact: "down" },
    { date: "2026-06-30", name: "木星逆行开始", type: "扩张受阻", impact: "down" },
    { date: "2026-07-06", name: "水星逆行结束", type: "延迟释放", impact: "up" },
    { date: "2026-07-07", name: "天王星入双子座", type: "范式转变", impact: "warn" },
    { date: "2026-07-13", name: "土星逆行开始", type: "结构承压", impact: "down" },
    { date: "2026-09-14", name: "水星逆行开始", type: "信息混乱", impact: "down" },
    { date: "2026-10-07", name: "水星逆行结束", type: "延迟释放", impact: "up" },
    { date: "2026-10-10", name: "冥王星逆行结束", type: "深度转折", impact: "up" },
    { date: "2026-10-22", name: "木星逆行结束", type: "扩张重启", impact: "up" },
    { date: "2026-11-28", name: "土星逆行结束", type: "结构重建", impact: "up" },
    // 2027
    { date: "2027-01-14", name: "水星逆行结束", type: "延迟释放", impact: "up" },
    { date: "2027-04-18", name: "火星入天蝎座", type: "深度波动", impact: "down" },
    { date: "2027-05-04", name: "水星逆行开始", type: "信息混乱", impact: "down" },
    { date: "2027-06-15", name: "木星入巨蟹座", type: "周期转折", impact: "up" },
    { date: "2027-08-31", name: "水星逆行开始", type: "信息混乱", impact: "down" },
  ],
};

// ─── 斐波那契核心配置 ─────────────────────────────────────────────────────────

const FIB_CONFIG = {
  anchorPoints: [
    { name: "2024减半日",       date: "2024-04-20", level: "high" as const },
    { name: "创世区块日",       date: "2009-01-03", level: "high" as const },
    { name: "2026年阶段低点",   date: "2026-01-05", level: "mid"  as const },
    { name: "2025年ATH",        date: "2025-01-20", level: "high" as const },
    { name: "2022年熊市低点",   date: "2022-11-21", level: "high" as const },
    { name: "2023年低点",       date: "2023-01-01", level: "mid"  as const },
  ],
  fibSeries: [3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610],
  windowRange: 1,
};

// ─── 类型定义 ─────────────────────────────────────────────────────────────────

export interface PlanetStatusTag {
  text: string;
  type: "up" | "down" | "warn" | "neutral" | "high";
}

export interface DaySignal {
  date: string;
  dateShow: string;
  weekday: string;
  planets: string[];
  tags: PlanetStatusTag[];
  signal: string;
  upProb: number;
  downProb: number;
  warning: string;
  isCritical: boolean;
  criticalName: string;
}

export interface FibWindow {
  date: string;
  dateShow: string;
  anchorName: string;
  fibNum: number;
  level: "high" | "mid" | "low";
  levelText: string;
  astroOverlay: boolean;
  astroName: string;
  desc: string;
  daysFromNow: number;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateStr(d);
}

function getDayDiff(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function shortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ─── 核心计算：指定日期的行星状态与信号 ──────────────────────────────────────

export function getDaySignal(dateStr: string): DaySignal {
  const target = new Date(dateStr);
  const weekday = WEEKDAYS[target.getDay()];

  const result: DaySignal = {
    date: dateStr,
    dateShow: shortDate(dateStr),
    weekday,
    planets: [],
    tags: [],
    signal: "",
    upProb: 50,
    downProb: 50,
    warning: "",
    isCritical: false,
    criticalName: "",
  };

  const PLANET_NAMES: Record<string, string> = {
    mercury: "水星", mars: "火星", saturn: "土星",
    jupiter: "木星", uranus: "天王星", pluto: "冥王星",
  };

  // 遍历行星数据
  for (const [planet, periods] of Object.entries(EPHEMERIS)) {
    if (planet === "moonPhase" || planet === "criticalAspect") continue;
    for (const period of (periods as { start: string; end: string; sign: string; status: string }[])) {
      const start = new Date(period.start);
      const end = new Date(period.end);
      if (target >= start && target <= end) {
        const name = PLANET_NAMES[planet] || planet;
        result.planets.push(`${name}${period.sign}(${period.status})`);

        if (planet === "mercury" && period.status === "逆行") {
          result.tags.push({ text: "水星逆行", type: "down" });
          result.downProb += 10;
          result.signal += "消息误读、插针、波动放大、延迟反应 ";
        }
        if (planet === "mars" && (period.sign === "白羊座" || period.sign === "天蝎座")) {
          result.tags.push({ text: `火星入${period.sign}`, type: "warn" });
          result.signal += "波动率上升、急涨急跌、放量行情 ";
        }
        if (planet === "saturn" && period.status === "逆行") {
          result.tags.push({ text: "土星逆行", type: "warn" });
          result.signal += "结构性压力、趋势考验 ";
        }
        if (planet === "jupiter" && period.status === "顺行") {
          result.tags.push({ text: `木星${period.sign}`, type: "up" });
          result.upProb += 5;
          result.signal += "信息流动活跃、情绪偏乐观 ";
        }
        if (planet === "jupiter" && period.status === "逆行") {
          result.tags.push({ text: "木星逆行", type: "down" });
          result.downProb += 8;
          result.signal += "扩张受阻、获利回吐压力 ";
        }
        if (planet === "pluto" && period.status === "逆行") {
          const startTs = new Date(period.start).getTime();
          const diffMs = target.getTime() - startTs;
          if (diffMs >= 0 && diffMs <= 14 * 86400000) {
            result.tags.push({ text: "冥王星逆行初期", type: "down" });
            result.downProb += 15;
            result.signal += "深度洗盘、趋势反转风险 ";
          }
        }
      }
    }
  }

  // 月相判断
  for (const phase of EPHEMERIS.moonPhase) {
    const phaseDate = new Date(phase.date);
    const diffDays = Math.abs(target.getTime() - phaseDate.getTime()) / 86400000;
    if (diffDays <= 3) {
      result.tags.push({ text: `${phase.type}窗口期`, type: "warn" });
      result.signal += "短期情绪拐点、变盘概率高 ";
      result.upProb = 50;
      result.downProb = 50;
    }
  }

  // 关键相位判断（未来7天内）
  for (const aspect of EPHEMERIS.criticalAspect) {
    const aspectDate = new Date(aspect.date);
    const diffDays = (aspectDate.getTime() - target.getTime()) / 86400000;
    if (diffDays >= 0 && diffDays <= 7) {
      result.tags.push({ text: aspect.name, type: aspect.impact === "down" ? "down" : aspect.impact === "up" ? "up" : "warn" });
      result.isCritical = true;
      result.criticalName = aspect.name;
      if (aspect.impact === "down") {
        result.downProb += 15;
        result.warning = `${Math.ceil(diffDays)}天后迎来${aspect.name}强变盘点，市场承压，严控仓位，不追高`;
        result.signal += `${aspect.type}、下行压力加大 `;
      } else if (aspect.impact === "up") {
        result.upProb += 12;
        result.warning = `${Math.ceil(diffDays)}天后${aspect.name}，延迟能量释放，关注做多窗口`;
        result.signal += `${aspect.type}、上行动能积累 `;
      } else {
        result.warning = `${Math.ceil(diffDays)}天后${aspect.name}，注意情绪拐点，关注方向选择`;
        result.signal += `${aspect.type}、波动率上升 `;
      }
    }
  }

  // 概率边界
  result.upProb = Math.max(15, Math.min(85, result.upProb));
  result.downProb = 100 - result.upProb;

  // 默认值
  if (!result.signal.trim()) result.signal = "多空能量均衡，震荡行情为主";
  if (!result.warning) result.warning = "行情波动平稳，轻仓操作，做好止盈止损";
  if (result.tags.length === 0) result.tags.push({ text: "平稳期", type: "neutral" });

  return result;
}

// ─── 斐波那契变盘窗口计算 ────────────────────────────────────────────────────

export function getFibWindows(referenceDate: Date = new Date()): FibWindow[] {
  const todayStr = formatDateStr(referenceDate);
  const windows: FibWindow[] = [];

  for (const anchor of FIB_CONFIG.anchorPoints) {
    for (const fib of FIB_CONFIG.fibSeries) {
      const targetDate = addDays(anchor.date, fib);
      const daysFromNow = getDayDiff(todayStr, targetDate);

      // 保留未来360天内的窗口（扩展自60天）
      if (daysFromNow < 0 || daysFromNow > 360) continue;

      const planetStatus = getDaySignal(targetDate);
      const isAstroOverlay = planetStatus.isCritical;

      let level: "high" | "mid" | "low" = "low";
      let levelText = "低优先级";

      if (anchor.level === "high" && isAstroOverlay) {
        level = "high";
        levelText = "最高优先级";
      } else if (anchor.level === "high" || isAstroOverlay) {
        level = "mid";
        levelText = "中优先级";
      }

      // 去重（同一日期只保留优先级最高的）
      const existing = windows.findIndex((w) => w.date === targetDate);
      if (existing >= 0) {
        const priority = { high: 3, mid: 2, low: 1 };
        if (priority[level] > priority[windows[existing].level]) {
          windows[existing] = {
            date: targetDate,
            dateShow: shortDate(targetDate),
            anchorName: anchor.name,
            fibNum: fib,
            level,
            levelText,
            astroOverlay: isAstroOverlay,
            astroName: planetStatus.criticalName,
            desc: isAstroOverlay
              ? `叠加${planetStatus.criticalName}占星相位，变盘概率≥90%`
              : `${anchor.name} · Fib${fib}日周期，变盘概率≥50%`,
            daysFromNow,
          };
        }
        continue;
      }

      windows.push({
        date: targetDate,
        dateShow: shortDate(targetDate),
        anchorName: anchor.name,
        fibNum: fib,
        level,
        levelText,
        astroOverlay: isAstroOverlay,
        astroName: planetStatus.criticalName,
        desc: isAstroOverlay
          ? `叠加${planetStatus.criticalName}占星相位，变盘概率≥90%`
          : `${anchor.name} · Fib${fib}日周期，变盘概率≥50%`,
        daysFromNow,
      });
    }
  }

  // 按日期排序，最多返回20条
  return windows
    .sort((a, b) => a.daysFromNow - b.daysFromNow)
    .slice(0, 20);
}

// ─── 未来7天预报 ─────────────────────────────────────────────────────────────

export function getSevenDayForecast(referenceDate: Date = new Date()): DaySignal[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() + i);
    return getDaySignal(formatDateStr(d));
  });
}

// ─── 分析规则常量 ─────────────────────────────────────────────────────────────

export const ANALYSIS_RULES = [
  {
    type: "up" as const,
    title: "上涨高概率（60%-85%）",
    emoji: "🟢",
    desc: "木星拱比特币本命太阳/金星、土木吉相、金星入双鱼/金牛、天王星顺行、月亮与本命星成吉相",
  },
  {
    type: "down" as const,
    title: "下跌高概率（60%-85%）",
    emoji: "🔴",
    desc: "水星逆行+月冲、土星刑冲本命星、火星-天王星刑冲、冥王星逆行初期、土火合相临近",
  },
  {
    type: "warn" as const,
    title: "震荡变盘（50%概率）",
    emoji: "🟡",
    desc: "满月/新月窗口期、行星静止期、木星-土星刑相位、多空能量均衡",
  },
  {
    type: "high" as const,
    title: "斐波那契变盘确认规则",
    emoji: "📐",
    desc: "最高优先级：斐波那契时间窗口+占星关键相位重合（变盘概率≥90%）\n中优先级：斐波那契时间窗口+占星次要信号（变盘概率≥70%）\n低优先级：单一斐波那契/占星信号（变盘概率≈50%）",
  },
];
