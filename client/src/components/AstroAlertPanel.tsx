/**
 * AstroAlertPanel — Professional Bitcoin Astro Signal Alert Panel
 * Displays daily astro alerts with direction, probability, signal description and warnings
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { AstroAlert, AstroEvent } from "@/lib/astrology";
import { SRLevel } from "@/hooks/useBinanceData";

interface AstroAlertPanelProps {
  alerts: AstroAlert[];
  events: AstroEvent[];
  srLevels?: SRLevel[];
  currentPrice?: number;
}

function DirectionIcon({ direction }: { direction: "bullish" | "bearish" | "neutral" }) {
  if (direction === "bullish") return <span style={{ color: "#00D4AA", fontSize: "14px" }}>▲</span>;
  if (direction === "bearish") return <span style={{ color: "#FF4D6D", fontSize: "14px" }}>▼</span>;
  return <span style={{ color: "#7A8899", fontSize: "14px" }}>◆</span>;
}

function ProbabilityBar({ probability, direction }: { probability: number; direction: "bullish" | "bearish" | "neutral" }) {
  const color = direction === "bullish" ? "#00D4AA" : direction === "bearish" ? "#FF4D6D" : "#7A8899";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(40,50,70,0.6)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${probability}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono" style={{ color, minWidth: "28px", textAlign: "right" }}>
        {probability}%
      </span>
    </div>
  );
}

const TIMEFRAME_LABELS: Record<string, string> = {
  short: "短期",
  mid: "中期",
  long: "长期",
};

const TIMEFRAME_COLORS: Record<string, string> = {
  short: "#A78BFA",
  mid: "#FFA500",
  long: "#7FDBFF",
};

export default function AstroAlertPanel({ alerts, events, srLevels = [], currentPrice = 0 }: AstroAlertPanelProps) {
  const shortAlerts = useMemo(() => alerts.filter((a) => a.timeframe === "short"), [alerts]);
  const midAlerts = useMemo(() => alerts.filter((a) => a.timeframe === "mid"), [alerts]);
  const longAlerts = useMemo(() => alerts.filter((a) => a.timeframe === "long"), [alerts]);

  // Overall composite direction
  const compositeScore = useMemo(() => {
    let score = 0;
    for (const a of alerts) {
      const weight = a.timeframe === "short" ? 1.5 : a.timeframe === "mid" ? 1.0 : 0.5;
      if (a.direction === "bullish") score += (a.probability - 50) * weight;
      if (a.direction === "bearish") score -= (a.probability - 50) * weight;
    }
    return score;
  }, [alerts]);

  const compositeLabel = compositeScore > 30 ? "综合看涨" : compositeScore < -30 ? "综合看跌" : "综合震荡";
  const compositeColor = compositeScore > 30 ? "#00D4AA" : compositeScore < -30 ? "#FF4D6D" : "#7A8899";

  return (
    <div className="space-y-4">
      {/* Composite Signal Header */}
      <div
        className="rounded-lg p-3"
        style={{
          background: compositeScore > 30 ? "rgba(0,212,170,0.06)" : compositeScore < -30 ? "rgba(255,77,109,0.06)" : "rgba(40,50,70,0.3)",
          border: `1px solid ${compositeScore > 30 ? "rgba(0,212,170,0.25)" : compositeScore < -30 ? "rgba(255,77,109,0.25)" : "rgba(40,50,70,0.5)"}`,
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest" style={{ color: "#4A5568", fontFamily: "'Space Grotesk', sans-serif" }}>
            今日占星综合信号
          </span>
          <span className="text-xs font-bold" style={{ color: compositeColor, fontFamily: "'Space Grotesk', sans-serif" }}>
            {compositeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DirectionIcon direction={compositeScore > 30 ? "bullish" : compositeScore < -30 ? "bearish" : "neutral"} />
          <span className="text-xs" style={{ color: "#7A8899" }}>
            {alerts.length} 个活跃星象信号 · 基于比特币创世区块本命盘分析
          </span>
        </div>
      </div>

      {/* Short-term Alerts */}
      {shortAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(167,139,250,0.15)", color: TIMEFRAME_COLORS.short, border: "1px solid rgba(167,139,250,0.3)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {TIMEFRAME_LABELS.short} 1–7天
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(40,50,70,0.6)" }} />
          </div>
          <div className="space-y-2">
            {shortAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Mid-term Alerts */}
      {midAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(255,165,0,0.12)", color: TIMEFRAME_COLORS.mid, border: "1px solid rgba(255,165,0,0.3)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {TIMEFRAME_LABELS.mid} 1–3月
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(40,50,70,0.6)" }} />
          </div>
          <div className="space-y-2">
            {midAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Long-term Alerts */}
      {longAlerts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(127,219,255,0.10)", color: TIMEFRAME_COLORS.long, border: "1px solid rgba(127,219,255,0.25)", fontFamily: "'Space Grotesk', sans-serif" }}>
              {TIMEFRAME_LABELS.long} 4年周期
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(40,50,70,0.6)" }} />
          </div>
          <div className="space-y-2">
            {longAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Events */}
      {events.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(40,50,70,0.4)", color: "#7A8899", border: "1px solid rgba(40,50,70,0.6)", fontFamily: "'Space Grotesk', sans-serif" }}>
              近期星象事件
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(40,50,70,0.6)" }} />
          </div>
          <div className="space-y-1.5">
            {events.slice(0, 6).map((evt, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-2 px-2 py-1.5 rounded"
                style={{ background: "rgba(15,20,35,0.5)", border: "1px solid rgba(40,50,70,0.3)" }}
              >
                <div
                  className="w-1 rounded-full flex-shrink-0 mt-0.5"
                  style={{
                    background: evt.influence === "bullish" ? "#00D4AA" : evt.influence === "bearish" ? "#FF4D6D" : "#7A8899",
                    minHeight: "12px",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-mono" style={{ color: "#4A5568" }}>
                      {evt.date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-[9px] px-1 rounded" style={{ background: "rgba(40,50,70,0.5)", color: "#7A8899" }}>
                      {evt.type}
                    </span>
                    {evt.probability && (
                      <span className="text-[9px]" style={{ color: evt.influence === "bullish" ? "#00D4AA" : evt.influence === "bearish" ? "#FF4D6D" : "#7A8899" }}>
                        {evt.probability}%
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] leading-tight" style={{ color: "#7A8899" }}>{evt.description}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Support & Resistance Levels */}
      {srLevels.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.25)", fontFamily: "'Space Grotesk', sans-serif" }}>
              ⚡ 支撑 / 阻力预警
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(40,50,70,0.6)" }} />
          </div>
          {currentPrice > 0 && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1 rounded" style={{ background: "rgba(20,25,40,0.6)", border: "1px solid rgba(40,50,70,0.4)" }}>
              <span className="text-[9px]" style={{ color: "#4A5568" }}>当前价格</span>
              <span className="flex-1 text-center text-[11px] font-bold font-mono" style={{ color: "#E8EDF5" }}>
                ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div className="space-y-1">
            {srLevels.map((level, i) => {
              const isResistance = level.type === "resistance";
              const color = isResistance ? "#FF4D6D" : "#00D4AA";
              const bgColor = isResistance ? "rgba(255,77,109,0.06)" : "rgba(0,212,170,0.06)";
              const borderColor = isResistance ? "rgba(255,77,109,0.25)" : "rgba(0,212,170,0.25)";
              const strengthDot = level.strength === "strong" ? "●" : level.strength === "moderate" ? "◉" : "○";
              const priceDiff = currentPrice > 0 ? ((level.price - currentPrice) / currentPrice * 100) : 0;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded"
                  style={{ background: bgColor, border: `1px solid ${borderColor}` }}
                >
                  <span className="text-[10px]" style={{ color, minWidth: "8px" }}>{strengthDot}</span>
                  <span className="text-[9px] px-1 rounded" style={{ background: isResistance ? "rgba(255,77,109,0.12)" : "rgba(0,212,170,0.12)", color, fontFamily: "'Space Grotesk', sans-serif", minWidth: "28px", textAlign: "center" }}>
                    {isResistance ? "阻力" : "支撑"}
                  </span>
                  <span className="text-[11px] font-mono font-bold flex-1" style={{ color: "#C8D4E0" }}>
                    ${level.price.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: isResistance ? "#FF4D6D" : "#00D4AA", minWidth: "40px", textAlign: "right" }}>
                    {priceDiff > 0 ? "+" : ""}{priceDiff.toFixed(1)}%
                  </span>
                  <span className="text-[9px]" style={{ color: "#4A5568", maxWidth: "60px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {level.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-[9px] text-center pb-1" style={{ color: "#1E2535", fontFamily: "'Space Grotesk', sans-serif" }}>
        基于 BTC 创世区块本命盘（2009-01-03 18:15 UTC）· 仅供参考，不构成投资建议
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: AstroAlert }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg p-3 space-y-2"
      style={{ background: alert.bgColor, border: `1px solid ${alert.borderColor}` }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <DirectionIcon direction={alert.direction} />
          {alert.planets.map((p, i) => (
            <span key={i} className="text-xs font-bold" style={{ color: alert.color, fontFamily: "'Space Grotesk', sans-serif" }}>
              {p}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.3)", color: "#7A8899", border: "1px solid rgba(40,50,70,0.4)" }}
          >
            {alert.timeLabel}
          </span>
          {alert.dateRange && (
            <span
              className="text-[9px] font-mono px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,0,0,0.25)", color: alert.color, border: `1px solid ${alert.borderColor}`, opacity: 0.9 }}
            >
              {alert.dateRange}
            </span>
          )}
        </div>
      </div>

      {/* Signal */}
      <div className="text-[11px] leading-relaxed" style={{ color: "#C8D4E0" }}>
        {alert.signal}
      </div>

      {/* Probability bar */}
      <ProbabilityBar probability={alert.probability} direction={alert.direction} />

      {/* Probability label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold" style={{ color: alert.color, fontFamily: "'JetBrains Mono', monospace" }}>
          {alert.probabilityLabel}
        </span>
      </div>

      {/* Warning */}
      <div
        className="text-[10px] px-2 py-1.5 rounded leading-relaxed"
        style={{ background: "rgba(0,0,0,0.25)", color: "#7A8899", borderLeft: `2px solid ${alert.color}` }}
      >
        ⚠ {alert.warning}
      </div>
    </motion.div>
  );
}
