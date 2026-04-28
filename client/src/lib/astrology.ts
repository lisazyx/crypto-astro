/**
 * astrology.ts — Bitcoin Natal Chart + Professional Astro Signal Engine
 * Bitcoin Genesis Block: 2009-01-03 18:15 UTC
 * Natal: Sun Capricorn, Moon Aries, Mars-Pluto conjunct Capricorn, Venus Pisces
 */

export interface PlanetPosition {
  name: string;
  symbol: string;
  sign: string;
  signSymbol: string;
  degree: number;
  longitude: number;
  isRetrograde: boolean;
  color: string;
  speed: number;
}

export interface MoonPhase {
  phase: string;
  phaseSymbol: string;
  illumination: number;
  age: number;
  marketBias: "bullish" | "bearish" | "neutral";
  influence: string;
  nextNewMoon: Date;
  nextFullMoon: Date;
}

export type MoonPhaseData = MoonPhase;

export interface PlanetAspect {
  planet1: string;
  planet2: string;
  aspect: string;
  symbol: string;
  orb: number;
  strength: "strong" | "moderate" | "weak";
  influence: "bullish" | "bearish" | "neutral";
  signalDesc: string;
}

export type AspectData = PlanetAspect & { angle: number; isApplying: boolean };

export interface AstroEvent {
  date: Date;
  type: string;
  description: string;
  influence: "bullish" | "bearish" | "neutral";
  tier: "short" | "mid" | "long";
  probability?: number;
}

export interface AstroSentiment {
  score: number;
  label: string;
  bullishFactors: string[];
  bearishFactors: string[];
}

export interface AstroAlert {
  id: string;
  timeframe: "short" | "mid" | "long";
  timeLabel: string;
  dateRange?: string;  // 具体起止时间段，如 "6/12 – 7/6"
  planets: string[];
  signal: string;
  direction: "bullish" | "bearish" | "neutral";
  probability: number;
  probabilityLabel: string;
  warning: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SIGNS = [
  { name: "白羊座", symbol: "♈", element: "fire" },
  { name: "金牛座", symbol: "♉", element: "earth" },
  { name: "双子座", symbol: "♊", element: "air" },
  { name: "巨蟹座", symbol: "♋", element: "water" },
  { name: "狮子座", symbol: "♌", element: "fire" },
  { name: "处女座", symbol: "♍", element: "earth" },
  { name: "天秤座", symbol: "♎", element: "air" },
  { name: "天蝎座", symbol: "♏", element: "water" },
  { name: "射手座", symbol: "♐", element: "fire" },
  { name: "摩羯座", symbol: "♑", element: "earth" },
  { name: "水瓶座", symbol: "♒", element: "air" },
  { name: "双鱼座", symbol: "♓", element: "water" },
];

// Bitcoin Natal Chart (Genesis Block 2009-01-03 18:15 UTC)
const BTC_NATAL = {
  sun: 283.5,     // ~13° Capricorn
  moon: 15.0,     // ~15° Aries
  mercury: 270.0, // ~0° Capricorn
  venus: 345.0,   // ~15° Pisces
  mars: 285.0,    // ~15° Capricorn
  jupiter: 318.0, // ~18° Aquarius
  saturn: 171.0,  // ~21° Virgo
  pluto: 301.0,   // ~1° Capricorn
};

const PLANET_COLORS: Record<string, string> = {
  "太阳": "#FFD700", "月亮": "#C0C0C8", "水星": "#A0C4FF",
  "金星": "#FFB3C6", "火星": "#FF6B6B", "木星": "#FFA500",
  "土星": "#B8A090", "天王星": "#7FDBFF", "海王星": "#4A90D9", "冥王星": "#C084FC",
};

// ─── Math helpers ─────────────────────────────────────────────────────────────

function julianDay(date: Date): number {
  const y = date.getUTCFullYear(), m = date.getUTCMonth() + 1;
  const d = date.getUTCDate() + (date.getUTCHours() + date.getUTCMinutes() / 60) / 24;
  const A = Math.floor((14 - m) / 12), Y = y + 4800 - A, M = m + 12 * A - 3;
  return d + Math.floor((153 * M + 2) / 5) + 365 * Y + Math.floor(Y / 4) - Math.floor(Y / 100) + Math.floor(Y / 400) - 32045;
}

function norm360(deg: number): number { return ((deg % 360) + 360) % 360; }
function toRad(deg: number): number { return deg * Math.PI / 180; }

// ─── Planetary longitudes ─────────────────────────────────────────────────────

function sunLon(jd: number): number {
  const n = jd - 2451545.0;
  const L = norm360(280.460 + 0.9856474 * n);
  const g = norm360(357.528 + 0.9856003 * n);
  return norm360(L + 1.915 * Math.sin(toRad(g)) + 0.020 * Math.sin(toRad(2 * g)));
}

// ─── Earth heliocentric coordinates (for geocentric conversion) ───────────────
function earthXY(jd: number): { x: number; y: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(100.466 + 36000.7698 * T);
  const M = toRad(norm360(357.529 + 35999.050 * T));
  const lon = toRad(norm360(L + 1.915 * Math.sin(M) + 0.020 * Math.sin(2 * M)));
  const r = 1.000140 - 0.016708 * Math.cos(M) - 0.000141 * Math.cos(2 * M);
  return { x: r * Math.cos(lon), y: r * Math.sin(lon) };
}

// Convert heliocentric (lon deg, dist AU) to geocentric longitude
function helio2geo(helioLon: number, helioDist: number, jd: number): number {
  const earth = earthXY(jd);
  const hl = toRad(helioLon);
  const mx = helioDist * Math.cos(hl) - earth.x;
  const my = helioDist * Math.sin(hl) - earth.y;
  return norm360(Math.atan2(my, mx) * 180 / Math.PI);
}

// Geocentric speed (deg/day) via central difference
function geoSpeed(geoLonFn: (jd: number) => number, jd: number): number {
  const lon1 = geoLonFn(jd - 0.5);
  const lon2 = geoLonFn(jd + 0.5);
  let s = lon2 - lon1;
  if (s > 180) s -= 360;
  if (s < -180) s += 360;
  return s;
}

function moonLon(jd: number): number {
  const n = jd - 2451545.0;
  const L = norm360(218.316 + 13.176396 * n);
  const M = norm360(134.963 + 13.064993 * n);
  return norm360(L + 6.289 * Math.sin(toRad(M)));
}

function moonPhaseAngle(jd: number): number { return norm360(moonLon(jd) - sunLon(jd)); }

// ─── Heliocentric positions (lon deg, dist AU) ───────────────────────────────────────────
function mercuryHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(252.251 + 149474.0722 * T);
  const M = toRad(norm360(174.795 + 149472.5153 * T));
  const lon = norm360(L + 23.440 * Math.sin(M) + 2.99 * Math.sin(2 * M) + 0.526 * Math.sin(3 * M) + 0.106 * Math.sin(4 * M));
  const r = 0.387098 * (1 - 0.205630 * Math.cos(M));
  return { lon, r };
}

function venusHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(181.980 + 58519.2130 * T);
  const M = toRad(norm360(50.416 + 58517.8039 * T));
  const lon = norm360(L + 0.7758 * Math.sin(M) + 0.0033 * Math.sin(2 * M));
  const r = 0.723332 * (1 - 0.006773 * Math.cos(M));
  return { lon, r };
}

function marsHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(355.433 + 19141.6964 * T);
  const M = toRad(norm360(19.373 + 19140.3023 * T));
  const lon = norm360(L + 10.691 * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.050 * Math.sin(3 * M));
  const r = 1.523688 * (1 - 0.093405 * Math.cos(M));
  return { lon, r };
}

function jupiterHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(34.351 + 3036.3027 * T);
  const M = toRad(norm360(20.020 + 3034.9057 * T));
  const lon = norm360(L + 5.555 * Math.sin(M) + 0.168 * Math.sin(2 * M));
  const r = 5.202561 * (1 - 0.048498 * Math.cos(M));
  return { lon, r };
}

function saturnHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(50.077 + 1223.5110 * T);
  const M = toRad(norm360(317.021 + 1222.1138 * T));
  const lon = norm360(L + 6.393 * Math.sin(M) + 0.150 * Math.sin(2 * M));
  const r = 9.554909 * (1 - 0.055548 * Math.cos(M));
  return { lon, r };
}

function uranusHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const L = norm360(314.055 + 428.4690 * T);
  const M = toRad(norm360(142.591 + 428.4690 * T));
  const lon = norm360(L + 5.329 * Math.sin(M) + 0.122 * Math.sin(2 * M));
  const r = 19.21814 * (1 - 0.047168 * Math.cos(M));
  return { lon, r };
}

function neptuneHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const lon = norm360(304.349 + 219.8553 * T);
  const r = 30.10957;
  return { lon, r };
}

function plutoHelio(jd: number): { lon: number; r: number } {
  const T = (jd - 2451545.0) / 36525;
  const lon = norm360(238.929 + 145.181 * T);
  const r = 39.48168;
  return { lon, r };
}

// ─── Geocentric data (correct retrograde detection) ───────────────────────────────────────
function makeGeoData(helioFn: (jd: number) => { lon: number; r: number }) {
  return (jd: number): { lon: number; speed: number } => {
    const geoLon = (j: number) => { const h = helioFn(j); return helio2geo(h.lon, h.r, j); };
    const lon = geoLon(jd);
    const speed = geoSpeed(geoLon, jd);
    return { lon, speed };
  };
}

const mercuryData = makeGeoData(mercuryHelio);
const venusData   = makeGeoData(venusHelio);
const marsData    = makeGeoData(marsHelio);
const jupiterData = makeGeoData(jupiterHelio);
const saturnData  = makeGeoData(saturnHelio);
const uranusData  = makeGeoData(uranusHelio);
const neptuneData = makeGeoData(neptuneHelio);
const plutoData   = makeGeoData(plutoHelio);

// venusLon kept for backward compat
function venusLon(jd: number): number { return venusData(jd).lon; }

function lonToSign(lon: number) {
  const idx = Math.floor(lon / 30) % 12;
  return { sign: SIGNS[idx].name, signSymbol: SIGNS[idx].symbol, degree: lon % 30, signIndex: idx };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function getPlanetPositions(date: Date = new Date()): PlanetPosition[] {
  const jd = julianDay(date);
  const mercury = mercuryData(jd), mars = marsData(jd), jupiter = jupiterData(jd);
  const saturn = saturnData(jd), uranus = uranusData(jd), neptune = neptuneData(jd), pluto = plutoData(jd);

  const raw = [
    { name: "太阳", symbol: "☉", lon: sunLon(jd), speed: 0.9856 },
    { name: "月亮", symbol: "☽", lon: moonLon(jd), speed: 13.176 },
    { name: "水星", symbol: "☿", lon: mercury.lon, speed: mercury.speed },
    { name: "金星", symbol: "♀", lon: venusData(jd).lon, speed: venusData(jd).speed },
    { name: "火星", symbol: "♂", lon: mars.lon, speed: mars.speed },
    { name: "木星", symbol: "♃", lon: jupiter.lon, speed: jupiter.speed },
    { name: "土星", symbol: "♄", lon: saturn.lon, speed: saturn.speed },
    { name: "天王星", symbol: "⛢", lon: uranus.lon, speed: uranus.speed },
    { name: "海王星", symbol: "♆", lon: neptune.lon, speed: neptune.speed },
    { name: "冥王星", symbol: "♇", lon: pluto.lon, speed: pluto.speed },
  ];

  return raw.map((p) => {
    const { sign, signSymbol, degree } = lonToSign(p.lon);
    return { name: p.name, symbol: p.symbol, sign, signSymbol, degree, longitude: p.lon, isRetrograde: p.speed < 0, color: PLANET_COLORS[p.name] || "#fff", speed: p.speed };
  });
}

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const jd = julianDay(date);
  const phase = moonPhaseAngle(jd);
  const illumination = (1 - Math.cos(toRad(phase))) / 2 * 100;
  const age = phase / 360 * 29.53;

  let phaseName = "", phaseSymbol = "", marketBias: "bullish" | "bearish" | "neutral" = "neutral", influence = "";
  if (phase < 22.5) { phaseName = "新月"; phaseSymbol = "🌑"; marketBias = "neutral"; influence = "新周期开启，方向待定，关注突破方向"; }
  else if (phase < 67.5) { phaseName = "娥眉月"; phaseSymbol = "🌒"; marketBias = "bullish"; influence = "动能积累期，多头逐步建仓"; }
  else if (phase < 112.5) { phaseName = "上弦月"; phaseSymbol = "🌓"; marketBias = "bullish"; influence = "上升中段，趋势确认，适合追涨"; }
  else if (phase < 157.5) { phaseName = "盈凸月"; phaseSymbol = "🌔"; marketBias = "bullish"; influence = "强势期，情绪高涨，注意顶部信号"; }
  else if (phase < 202.5) { phaseName = "满月"; phaseSymbol = "🌕"; marketBias = "bearish"; influence = "情绪顶点，短期变盘高概率，警惕回调"; }
  else if (phase < 247.5) { phaseName = "亏凸月"; phaseSymbol = "🌖"; marketBias = "bearish"; influence = "动能衰减，空头逐步占优"; }
  else if (phase < 292.5) { phaseName = "下弦月"; phaseSymbol = "🌗"; marketBias = "bearish"; influence = "下降中段，趋势确认，注意反弹陷阱"; }
  else { phaseName = "残月"; phaseSymbol = "🌘"; marketBias = "neutral"; influence = "能量消散，等待新周期"; }

  const daysToNewMoon = (360 - phase) / 360 * 29.53;
  const daysToFullMoon = phase < 180 ? (180 - phase) / 360 * 29.53 : (540 - phase) / 360 * 29.53;
  return { phase: phaseName, phaseSymbol, illumination, age, marketBias, influence, nextNewMoon: new Date(date.getTime() + daysToNewMoon * 86400000), nextFullMoon: new Date(date.getTime() + daysToFullMoon * 86400000) };
}

// ─── Aspects ─────────────────────────────────────────────────────────────────

const ASPECT_DEFS = [
  { name: "合相", symbol: "☌", angle: 0, orb: 8 },
  { name: "六分相", symbol: "⚹", angle: 60, orb: 4 },
  { name: "四分相", symbol: "□", angle: 90, orb: 6 },
  { name: "三分相", symbol: "△", angle: 120, orb: 6 },
  { name: "对分相", symbol: "☍", angle: 180, orb: 8 },
];

function aspectInfluence(p1: string, p2: string, asp: string): { influence: "bullish" | "bearish" | "neutral"; signalDesc: string } {
  const hard = ["四分相", "对分相"].includes(asp);
  const soft = ["三分相", "六分相"].includes(asp);
  const bullishPairs = [["木星", "太阳"], ["木星", "金星"], ["木星", "土星"], ["金星", "太阳"], ["天王星", "木星"]];
  const bearishPairs = [["土星", "太阳"], ["土星", "金星"], ["火星", "天王星"], ["冥王星", "太阳"], ["土星", "水星"]];
  const key = [p1, p2].sort().join("-");
  if (bullishPairs.some(([a, b]) => [a, b].sort().join("-") === key) && (soft || asp === "合相")) return { influence: "bullish", signalDesc: "吉相增益，看涨动能增强" };
  if (bearishPairs.some(([a, b]) => [a, b].sort().join("-") === key) && (hard || asp === "合相")) return { influence: "bearish", signalDesc: "凶相压制，注意回调风险" };
  if (hard) return { influence: "bearish", signalDesc: "张力相位，波动率上升" };
  if (soft) return { influence: "bullish", signalDesc: "和谐相位，趋势顺畅" };
  return { influence: "neutral", signalDesc: "合相，能量叠加" };
}

export function getAspects(planets: PlanetPosition[]): PlanetAspect[] {
  const aspects: PlanetAspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let diff = Math.abs(planets[i].longitude - planets[j].longitude);
      if (diff > 180) diff = 360 - diff;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(diff - def.angle);
        if (orb <= def.orb) {
          const strength: "strong" | "moderate" | "weak" = orb <= def.orb * 0.3 ? "strong" : orb <= def.orb * 0.65 ? "moderate" : "weak";
          const { influence, signalDesc } = aspectInfluence(planets[i].name, planets[j].name, def.name);
          aspects.push({ planet1: planets[i].symbol + planets[i].name, planet2: planets[j].symbol + planets[j].name, aspect: def.name, symbol: def.symbol, orb, strength, influence, signalDesc });
          break;
        }
      }
    }
  }
  return aspects.sort((a, b) => a.orb - b.orb);
}

// ─── Natal aspect checker ─────────────────────────────────────────────────────

function getNatalAspects(planets: PlanetPosition[]) {
  const natalPoints = [
    { name: "本命太阳", lon: BTC_NATAL.sun }, { name: "本命月亮", lon: BTC_NATAL.moon },
    { name: "本命金星", lon: BTC_NATAL.venus }, { name: "本命火星", lon: BTC_NATAL.mars },
    { name: "本命冥王星", lon: BTC_NATAL.pluto },
  ];
  const results: { transit: string; natal: string; aspect: string; orb: number }[] = [];
  for (const t of planets) {
    for (const n of natalPoints) {
      let diff = Math.abs(t.longitude - n.lon);
      if (diff > 180) diff = 360 - diff;
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(diff - def.angle);
        if (orb <= def.orb * 0.8) { results.push({ transit: t.name, natal: n.name, aspect: def.name, orb }); break; }
      }
    }
  }
  return results;
}

// ─── Upcoming Events ─────────────────────────────────────────────────────────

export function getUpcomingEvents(date: Date = new Date()): AstroEvent[] {
  const events: AstroEvent[] = [];
  const jd0 = julianDay(date);

  for (let d = 0; d <= 45; d++) {
    const jd = jd0 + d;
    const scanDate = new Date(date.getTime() + d * 86400000);

    const merc = mercuryData(jd), mercPrev = mercuryData(jd - 1);
    if (merc.speed < 0 && mercPrev.speed >= 0) events.push({ date: scanDate, type: "水星逆行", tier: "short", description: "水星开始逆行 — 防乌龙、插针、消息误读、闪崩/急拉", influence: "bearish", probability: 65 });
    if (merc.speed >= 0 && mercPrev.speed < 0) events.push({ date: scanDate, type: "水星顺行", tier: "short", description: "水星恢复顺行 — 延迟反应释放，关注补涨机会", influence: "bullish", probability: 60 });

    const phaseNow = moonPhaseAngle(jd), phasePrev = moonPhaseAngle(jd - 1);
    if (phasePrev < 175 && phaseNow >= 175 && phaseNow <= 195) events.push({ date: scanDate, type: "满月", tier: "short", description: "满月 — 短期情绪顶点，变盘高概率，警惕高位回调", influence: "bearish", probability: 62 });
    if ((phasePrev > 350 && phaseNow < 10) || (phasePrev < 5 && phaseNow < phasePrev)) events.push({ date: scanDate, type: "新月", tier: "short", description: "新月 — 新周期开启，关注方向性突破", influence: "neutral", probability: 50 });

    const mars = marsData(jd), marsPrev = marsData(jd - 1);
    const marsIdx = Math.floor(mars.lon / 30) % 12, marsIdxPrev = Math.floor(marsPrev.lon / 30) % 12;
    if (marsIdx !== marsIdxPrev) {
      const sign = SIGNS[marsIdx];
      const volatile = sign.element === "fire" || sign.element === "air";
      events.push({ date: scanDate, type: "火星入" + sign.name, tier: "short", description: `火星入${sign.name} — ${volatile ? "波动率暴增，急涨急跌，放量" : "趋势稳健，波动收窄"}`, influence: volatile ? "neutral" : "bullish", probability: volatile ? 70 : 55 });
    }

    if (d % 7 === 0) {
      const jup = jupiterData(jd), sat = saturnData(jd);
      let jsDiff = Math.abs(jup.lon - sat.lon);
      if (jsDiff > 180) jsDiff = 360 - jsDiff;
      if (Math.abs(jsDiff - 120) < 3) events.push({ date: scanDate, type: "木土三分", tier: "mid", description: "木星-土星三分相 — 牛市结构，机构进场信号，中期看涨", influence: "bullish", probability: 72 });
      if (Math.abs(jsDiff - 90) < 3) events.push({ date: scanDate, type: "木土四分", tier: "mid", description: "木星-土星四分相 — 震荡顶底，监管收紧风险，谨慎操作", influence: "bearish", probability: 65 });
    }
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, 12);
}

// ─── Astro Alerts (Daily Signal Cards) ───────────────────────────────────────

// 格式化日期为 "M/D" 形式
function fmtMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// 扫描行星逆行的起止日期
function findRetrogradePeriod(
  dataFn: (jd: number) => { lon: number; speed: number },
  jd: number,
  maxDays = 200
): { start: Date; end: Date } | null {
  // 确认当前是逆行
  if (dataFn(jd).speed >= 0) return null;

  // 向前扫描找逆行开始日
let startJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (dataFn(jd - i).speed >= 0) { startJD = jd - i + 1; break; }
  }

  // 向后扫描找逆行结束日
  let endJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (dataFn(jd + i).speed >= 0) { endJD = jd + i; break; }
  }

  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { start: toDate(startJD), end: toDate(endJD) };
}

// 扫描火星在某星座的起止日期
function findMarsSignPeriod(
  jd: number,
  targetSignIdx: number,
  maxDays = 300
): { start: Date; end: Date } | null {
  const getIdx = (j: number) => Math.floor(marsData(j).lon / 30) % 12;
  if (getIdx(jd) !== targetSignIdx) return null;

  let startJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (getIdx(jd - i) !== targetSignIdx) { startJD = jd - i + 1; break; }
  }
  let endJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (getIdx(jd + i) !== targetSignIdx) { endJD = jd + i; break; }
  }

  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { start: toDate(startJD), end: toDate(endJD) };
}

// 扫描木土相位持续时间
function findAspectPeriod(
  jd: number,
  checkFn: (j: number) => boolean,
  maxDays = 60
): { start: Date; end: Date } | null {
  if (!checkFn(jd)) return null;

  let startJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (!checkFn(jd - i)) { startJD = jd - i + 1; break; }
  }
  let endJD = jd;
  for (let i = 1; i <= maxDays; i++) {
    if (!checkFn(jd + i)) { endJD = jd + i; break; }
  }

  const toDate = (j: number) => new Date((j - 2440587.5) * 86400000);
  return { start: toDate(startJD), end: toDate(endJD) };
}

export function getAstroAlerts(date: Date, planets: PlanetPosition[]): AstroAlert[] {
  const alerts: AstroAlert[] = [];
  const jd = julianDay(date);
  const mercury = planets.find((p) => p.name === "水星")!;
  const mars = planets.find((p) => p.name === "火星")!;
  const jupiter = planets.find((p) => p.name === "木星")!;
  const saturn = planets.find((p) => p.name === "土星")!;
  const uranus = planets.find((p) => p.name === "天王星")!;
  const pluto = planets.find((p) => p.name === "冥王星")!;
  const venus = planets.find((p) => p.name === "金星")!;
  const phase = moonPhaseAngle(jd);

  if (mercury.isRetrograde) {
    const period = findRetrogradePeriod(mercuryData, jd);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "mercury-rx", timeframe: "short", timeLabel: "逆行期间", dateRange, planets: ["水星逆行 ℞"], signal: "防插针、消息陷阱、乌龙成交、延迟反应", direction: "bearish", probability: 65, probabilityLabel: "下跌 65%", warning: "避免追高，等待信号确认后再入场", color: "#FF4D6D", bgColor: "rgba(255,77,109,0.08)", borderColor: "rgba(255,77,109,0.35)" });
  }

  if (phase >= 165 && phase <= 195) {
    const moonPhaseData = getMoonPhase(date);
    const fullMoonDate = new Date(date.getTime() - (phase - 180) / 360 * 29.53 * 86400000);
    const startD = new Date(fullMoonDate.getTime() - 2 * 86400000);
    const endD = new Date(fullMoonDate.getTime() + 2 * 86400000);
    const dateRange = `${fmtMD(startD)} – ${fmtMD(endD)}`;
    alerts.push({ id: "full-moon", timeframe: "short", timeLabel: "满月窗口", dateRange, planets: ["满月 🌕"], signal: "短期变盘、情绪顶点、高低点形成", direction: "bearish", probability: 62, probabilityLabel: "下跌 62%", warning: "满月后 24–48h 内警惕急速回调", color: "#FF4D6D", bgColor: "rgba(255,77,109,0.08)", borderColor: "rgba(255,77,109,0.35)" });
  } else if (phase <= 15 || phase >= 345) {
    const newMoonDate = phase <= 15
      ? new Date(date.getTime() - phase / 360 * 29.53 * 86400000)
      : new Date(date.getTime() + (360 - phase) / 360 * 29.53 * 86400000);
    const startD = new Date(newMoonDate.getTime() - 2 * 86400000);
    const endD = new Date(newMoonDate.getTime() + 2 * 86400000);
    const dateRange = `${fmtMD(startD)} – ${fmtMD(endD)}`;
    alerts.push({ id: "new-moon", timeframe: "short", timeLabel: "新月窗口", dateRange, planets: ["新月 🌑"], signal: "新周期开启，方向性突破信号", direction: "neutral", probability: 50, probabilityLabel: "震荡 50%", warning: "关注突破方向，确认后跟进", color: "#7A8899", bgColor: "rgba(120,136,153,0.08)", borderColor: "rgba(120,136,153,0.35)" });
  }

  const marsIdx = Math.floor(mars.longitude / 30) % 12;
  if (SIGNS[marsIdx].element === "fire" || SIGNS[marsIdx].element === "air") {
    const period = findMarsSignPeriod(jd, marsIdx);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "mars-volatile", timeframe: "short", timeLabel: "在地期间", dateRange, planets: [`火星在${SIGNS[marsIdx].name}`], signal: "波动率上升，急涨急跌，成交量放大", direction: "neutral", probability: 70, probabilityLabel: "高波动 70%", warning: "设置止损，避免重仓，注意假突破", color: "#FF6B6B", bgColor: "rgba(255,107,107,0.08)", borderColor: "rgba(255,107,107,0.35)" });
  }

  const uranusHard = getNatalAspects(planets).filter((a) => a.transit === "天王星" && ["四分相", "对分相"].includes(a.aspect));
  if (uranusHard.length > 0) {
    // 天王星刺冲相位持续约两周，取前后各一周为窗口
    const startD = new Date(date.getTime() - 7 * 86400000);
    const endD = new Date(date.getTime() + 7 * 86400000);
    const dateRange = `${fmtMD(startD)} – ${fmtMD(endD)}`;
    alerts.push({ id: "uranus-hard", timeframe: "short", timeLabel: "刺冲窗口", dateRange, planets: ["天王星刺冲本命"], signal: "黑天鹅风险，突发政策/监管，断崖/暴涨", direction: "bearish", probability: 75, probabilityLabel: "下跌 75%", warning: "极端行情预警，降低仓位，设宽止损", color: "#FF4D6D", bgColor: "rgba(255,77,109,0.10)", borderColor: "rgba(255,77,109,0.45)" });
  }

  let jsDiff = Math.abs(jupiter.longitude - saturn.longitude);
  if (jsDiff > 180) jsDiff = 360 - jsDiff;
  if (Math.abs(jsDiff - 120) < 8 || Math.abs(jsDiff - 60) < 5) {
    const checkTrine = (j: number) => { const jup = jupiterData(j), sat = saturnData(j); let d = Math.abs(jup.lon - sat.lon); if (d > 180) d = 360 - d; return Math.abs(d - 120) < 8 || Math.abs(d - 60) < 5; };
    const period = findAspectPeriod(jd, checkTrine);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "js-trine", timeframe: "mid", timeLabel: "吉相期间", dateRange, planets: ["木星-土星吉相"], signal: "牛市结构确认，机构进场，突破关键阻力", direction: "bullish", probability: 72, probabilityLabel: "上涨 72%", warning: "中期做多机会，关注回调买点", color: "#00D4AA", bgColor: "rgba(0,212,170,0.08)", borderColor: "rgba(0,212,170,0.35)" });
  } else if (Math.abs(jsDiff - 90) < 8 || Math.abs(jsDiff - 180) < 8) {
    const checkSquare = (j: number) => { const jup = jupiterData(j), sat = saturnData(j); let d = Math.abs(jup.lon - sat.lon); if (d > 180) d = 360 - d; return Math.abs(d - 90) < 8 || Math.abs(d - 180) < 8; };
    const period = findAspectPeriod(jd, checkSquare);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "js-square", timeframe: "mid", timeLabel: "凶相期间", dateRange, planets: ["木星-土星凶相"], signal: "震荡顶底，监管收紧风险，趋势受阻", direction: "bearish", probability: 65, probabilityLabel: "下跌 65%", warning: "中期谨慎，等待相位结束后再建仓", color: "#FF4D6D", bgColor: "rgba(255,77,109,0.08)", borderColor: "rgba(255,77,109,0.35)" });
  }

  if (pluto.isRetrograde) {
    const period = findRetrogradePeriod(plutoData, jd);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "pluto-rx", timeframe: "mid", timeLabel: "逆行期间", dateRange, planets: ["冥王星逆行 ℞"], signal: "深度洗盘，趋势反转，资金流向剧变", direction: "bearish", probability: 60, probabilityLabel: "下跌 60%", warning: "中期趋势承压，关注资金流出信号", color: "#C084FC", bgColor: "rgba(192,132,252,0.08)", borderColor: "rgba(192,132,252,0.35)" });
  }

  const uranusIdx = Math.floor(uranus.longitude / 30) % 12;
  if (uranusIdx === 1) {
    alerts.push({ id: "uranus-taurus", timeframe: "long", timeLabel: "长期结构", dateRange: "2018 – 2026", planets: ["天王星在金牛座"], signal: "颠覆传统金融，BTC 结构性牛熊周期", direction: "bullish", probability: 68, probabilityLabel: "长期看涨 68%", warning: "2025–2026 年天王星离开金牛，关注范式转变", color: "#7FDBFF", bgColor: "rgba(127,219,255,0.08)", borderColor: "rgba(127,219,255,0.35)" });
  } else if (uranusIdx === 2) {
    alerts.push({ id: "uranus-gemini", timeframe: "long", timeLabel: "长期结构", dateRange: "2026 – 2033", planets: ["天王星入双子座"], signal: "信息革命加速，AI×加密资产新周期", direction: "bullish", probability: 70, probabilityLabel: "长期看涨 70%", warning: "天王星入双子座，技术层面大变革，关注新赛道机会", color: "#7FDBFF", bgColor: "rgba(127,219,255,0.08)", borderColor: "rgba(127,219,255,0.35)" });
  }

  const venusIdx = Math.floor(venus.longitude / 30) % 12;
  if (venusIdx === 11 || venusIdx === 1) {
    const checkVenus = (j: number) => { const vi = Math.floor(venusData(j).lon / 30) % 12; return vi === 11 || vi === 1; };
    const period = findAspectPeriod(jd, checkVenus, 40);
    const dateRange = period ? `${fmtMD(period.start)} – ${fmtMD(period.end)}` : undefined;
    alerts.push({ id: "venus-bullish", timeframe: "short", timeLabel: "在地期间", dateRange, planets: [`金星在${SIGNS[venusIdx].name}`], signal: "金星吉位，资金流入，情绪偏多", direction: "bullish", probability: 63, probabilityLabel: "上涨 63%", warning: "短期做多窗口，注意量能配合", color: "#00D4AA", bgColor: "rgba(0,212,170,0.08)", borderColor: "rgba(0,212,170,0.35)" });
  }

  if (alerts.length === 0) {
    alerts.push({ id: "neutral", timeframe: "short", timeLabel: "今日", planets: ["无重大星象"], signal: "星象平静，技术面主导", direction: "neutral", probability: 50, probabilityLabel: "震荡 50%", warning: "以量化信号为主，关注支撑阻力位", color: "#7A8899", bgColor: "rgba(120,136,153,0.08)", borderColor: "rgba(120,136,153,0.35)" });
  }

  return alerts;
}

// ─── Astro Sentiment ─────────────────────────────────────────────────────────

export function getAstroSentiment(date: Date = new Date()): AstroSentiment {
  const planets = getPlanetPositions(date);
  const alerts = getAstroAlerts(date, planets);
  const aspects = getAspects(planets);
  const phase = moonPhaseAngle(julianDay(date));

  let score = 0;
  const bullishFactors: string[] = [];
  const bearishFactors: string[] = [];

  if (phase >= 165 && phase <= 195) { score -= 15; bearishFactors.push("满月变盘"); }
  else if (phase >= 45 && phase <= 135) { score += 10; bullishFactors.push("上弦月偏多"); }
  else if (phase >= 225 && phase <= 315) { score -= 10; bearishFactors.push("下弦月偏空"); }

  const mercury = planets.find((p) => p.name === "水星")!;
  if (mercury.isRetrograde) { score -= 20; bearishFactors.push("水星逆行"); }

  for (const alert of alerts) {
    if (["mercury-rx", "uranus-hard", "full-moon", "new-moon"].includes(alert.id)) continue;
    if (alert.direction === "bullish") { score += Math.round((alert.probability - 50) * 0.6); bullishFactors.push(alert.planets[0]); }
    if (alert.direction === "bearish") { score -= Math.round((alert.probability - 50) * 0.6); bearishFactors.push(alert.planets[0]); }
  }

  for (const asp of aspects.slice(0, 6)) {
    if (asp.influence === "bullish" && asp.strength === "strong") { score += 12; bullishFactors.push(`${asp.planet1}${asp.symbol}${asp.planet2}`); }
    if (asp.influence === "bearish" && asp.strength === "strong") { score -= 12; bearishFactors.push(`${asp.planet1}${asp.symbol}${asp.planet2}`); }
  }

  score = Math.max(-100, Math.min(100, score));
  let label = "中性";
  if (score >= 60) label = "强烈看涨";
  else if (score >= 30) label = "偏多";
  else if (score >= 10) label = "略偏多";
  else if (score <= -60) label = "强烈看跌";
  else if (score <= -30) label = "偏空";
  else if (score <= -10) label = "略偏空";

  const uniqueBullish = Array.from(new Set(bullishFactors)).slice(0, 5);
  const uniqueBearish = Array.from(new Set(bearishFactors)).slice(0, 5);
  return { score, label, bullishFactors: uniqueBullish, bearishFactors: uniqueBearish };
}
