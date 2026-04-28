/**
 * IndicatorChart — RSI and MACD indicator charts using recharts
 * Design: Quantum Terminal — dark theme with colored signals
 */
import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from "recharts";
import { KlineData, calcRSI, calcMACD } from "@/hooks/useBinanceData";

interface IndicatorChartProps {
  data: KlineData[];
  type: "rsi" | "macd";
  height?: number;
}

const CHART_STYLE = {
  background: "transparent",
  fontSize: 10,
  fontFamily: "'JetBrains Mono', monospace",
};

const TOOLTIP_STYLE = {
  backgroundColor: "#0D1117",
  border: "1px solid rgba(40, 50, 70, 0.8)",
  borderRadius: "4px",
  color: "#E8EDF5",
  fontSize: "11px",
  fontFamily: "'JetBrains Mono', monospace",
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function IndicatorChart({ data, type, height = 160 }: IndicatorChartProps) {
  const chartData = useMemo(() => {
    if (!data.length) return [];
    const closes = data.map((k) => k.close);

    if (type === "rsi") {
      const rsi = calcRSI(closes, 14);
      return data.map((k, i) => ({
        time: k.time,
        rsi: rsi[i] !== null ? parseFloat(rsi[i]!.toFixed(2)) : null,
      })).filter((d) => d.rsi !== null);
    } else {
      const macd = calcMACD(closes);
      return data.map((k, i) => ({
        time: k.time,
        macd: macd.macd[i] !== null ? parseFloat(macd.macd[i]!.toFixed(2)) : null,
        signal: macd.signal[i] !== null ? parseFloat(macd.signal[i]!.toFixed(2)) : null,
        histogram: macd.histogram[i] !== null ? parseFloat(macd.histogram[i]!.toFixed(2)) : null,
      })).filter((d) => d.macd !== null);
    }
  }, [data, type]);

  if (!chartData.length) return null;

  if (type === "rsi") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} style={CHART_STYLE}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(40, 50, 70, 0.5)" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{ fill: "#7A8899", fontSize: 10 }}
            axisLine={{ stroke: "rgba(40, 50, 70, 0.8)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#7A8899", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={28}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={(v) => formatTime(v as number)}
            formatter={(v: any) => [v?.toFixed(2), "RSI"]}
          />
          <ReferenceLine y={70} stroke="rgba(255, 77, 109, 0.5)" strokeDasharray="4 4" label={{ value: "超买", fill: "#FF4D6D", fontSize: 10, position: "insideRight" }} />
          <ReferenceLine y={30} stroke="rgba(0, 212, 170, 0.5)" strokeDasharray="4 4" label={{ value: "超卖", fill: "#00D4AA", fontSize: 10, position: "insideRight" }} />
          <ReferenceLine y={50} stroke="rgba(120, 130, 150, 0.3)" strokeDasharray="2 4" />
          <Area
            type="monotone"
            dataKey="rsi"
            stroke="#A78BFA"
            strokeWidth={1.5}
            fill="rgba(167, 139, 250, 0.1)"
            dot={false}
            activeDot={{ r: 3, fill: "#A78BFA" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} style={CHART_STYLE}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(40, 50, 70, 0.5)" />
        <XAxis
          dataKey="time"
          tickFormatter={formatTime}
          tick={{ fill: "#7A8899", fontSize: 10 }}
          axisLine={{ stroke: "rgba(40, 50, 70, 0.8)" }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: "#7A8899", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) => formatTime(v as number)}
          formatter={(v: any, name: string) => [v?.toFixed(4), name === "macd" ? "MACD" : name === "signal" ? "信号线" : "柱状"]}
        />
        <ReferenceLine y={0} stroke="rgba(120, 130, 150, 0.5)" />
        <Bar
          dataKey="histogram"
          fill="#26a69a"
          radius={[1, 1, 0, 0]}
          maxBarSize={6}
          // Color bars based on value
          label={false}
        />
        <Line type="monotone" dataKey="macd" stroke="#FFD700" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
        <Line type="monotone" dataKey="signal" stroke="#FF6B9D" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
