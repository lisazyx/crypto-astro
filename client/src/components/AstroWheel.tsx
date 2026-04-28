/**
 * AstroWheel — SVG Astrological Wheel Component
 * Design: Quantum Terminal — glowing neon astrology wheel
 * Shows 12 zodiac signs + current planet positions
 */
import { useMemo } from "react";
import { PlanetPosition } from "@/lib/astrology";

const SIGNS_LOCAL = [
  { name: "白羊座", symbol: "♈" }, { name: "金牛座", symbol: "♉" },
  { name: "双子座", symbol: "♊" }, { name: "巨蟹座", symbol: "♋" },
  { name: "狮子座", symbol: "♌" }, { name: "处女座", symbol: "♍" },
  { name: "天秤座", symbol: "♎" }, { name: "天蝎座", symbol: "♏" },
  { name: "射手座", symbol: "♐" }, { name: "摩羯座", symbol: "♑" },
  { name: "水瓶座", symbol: "♒" }, { name: "双鱼座", symbol: "♓" },
];

interface AstroWheelProps {
  planets: PlanetPosition[];
  size?: number;
}

const SIGN_COLORS = [
  "#FF6B6B", "#A8D8EA", "#FFD700", "#7EC8E3",
  "#FFB347", "#98D8C8", "#DDA0DD", "#87CEEB",
  "#F4A460", "#B8B8B8", "#87CEFA", "#9370DB",
];

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

export default function AstroWheel({ planets, size = 280 }: AstroWheelProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const signR = size * 0.40;
  const planetR = size * 0.30;
  const innerR = size * 0.20;

  const signSegments = useMemo(() => {
    return SIGNS_LOCAL.map((sign, i) => {
      const startAngle = i * 30;
      const endAngle = (i + 1) * 30;
      const midAngle = startAngle + 15;

      const p1 = polarToXY(cx, cy, innerR, startAngle);
      const p2 = polarToXY(cx, cy, outerR, startAngle);
      const p3 = polarToXY(cx, cy, outerR, endAngle);
      const p4 = polarToXY(cx, cy, innerR, endAngle);
      const labelPos = polarToXY(cx, cy, signR, midAngle);

      const largeArc = endAngle - startAngle > 180 ? 1 : 0;

      const path = [
        `M ${p1.x} ${p1.y}`,
        `L ${p2.x} ${p2.y}`,
        `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
        `L ${p4.x} ${p4.y}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
        "Z",
      ].join(" ");

      return { sign, path, labelPos, color: SIGN_COLORS[i], startAngle };
    });
  }, [size]);

  const planetDots = useMemo(() => {
    return planets.map((p) => {
      const pos = polarToXY(cx, cy, planetR, p.longitude);
      return { ...p, pos };
    });
  }, [planets, size]);

  // Draw aspect lines
  const aspectLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const diff = Math.abs(planets[i].longitude - planets[j].longitude);
        const angle = diff > 180 ? 360 - diff : diff;
        let color = "";
        if (Math.abs(angle - 120) < 8) color = "rgba(0, 212, 170, 0.3)";
        else if (Math.abs(angle - 60) < 6) color = "rgba(0, 212, 170, 0.2)";
        else if (Math.abs(angle - 90) < 8) color = "rgba(255, 77, 109, 0.25)";
        else if (Math.abs(angle - 180) < 8) color = "rgba(255, 77, 109, 0.2)";
        else if (angle < 8) color = "rgba(255, 215, 0, 0.25)";
        if (color) {
          const p1 = polarToXY(cx, cy, planetR * 0.85, planets[i].longitude);
          const p2 = polarToXY(cx, cy, planetR * 0.85, planets[j].longitude);
          lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, color });
        }
      }
    }
    return lines;
  }, [planets, size]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <filter id="glow-green">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-gold">
          <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="centerGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(120, 80, 200, 0.15)" />
          <stop offset="100%" stopColor="rgba(10, 15, 30, 0)" />
        </radialGradient>
      </defs>

      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(100, 80, 180, 0.4)" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="rgba(100, 80, 180, 0.3)" strokeWidth={1} />

      {/* Center gradient */}
      <circle cx={cx} cy={cy} r={innerR} fill="url(#centerGrad)" />

      {/* Sign segments */}
      {signSegments.map(({ sign, path, labelPos, color }: { sign: { name: string; symbol: string }; path: string; labelPos: { x: number; y: number }; color: string; startAngle: number }, i: number) => (
        <g key={sign.name}>
          <path
            d={path}
            fill={`${color}12`}
            stroke="rgba(80, 60, 140, 0.4)"
            strokeWidth={0.5}
          />
          <text
            x={labelPos.x}
            y={labelPos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={color}
            fontSize={size * 0.055}
            fontFamily="serif"
            opacity={0.85}
          >
            {sign.symbol}
          </text>
        </g>
      ))}

      {/* Degree marks */}
      {Array.from({ length: 36 }, (_, i) => {
        const angle = i * 10;
        const p1 = polarToXY(cx, cy, outerR, angle);
        const p2 = polarToXY(cx, cy, outerR - 4, angle);
        return (
          <line
            key={i}
            x1={p1.x} y1={p1.y}
            x2={p2.x} y2={p2.y}
            stroke="rgba(100, 80, 180, 0.4)"
            strokeWidth={0.5}
          />
        );
      })}

      {/* Aspect lines */}
      {aspectLines.map((line, i) => (
        <line
          key={i}
          x1={line.x1} y1={line.y1}
          x2={line.x2} y2={line.y2}
          stroke={line.color}
          strokeWidth={0.8}
        />
      ))}

      {/* Planet dots and labels */}
      {planetDots.map((p) => (
        <g key={p.name}>
          {/* Planet dot */}
          <circle
            cx={p.pos.x}
            cy={p.pos.y}
            r={size * 0.022}
            fill={p.color}
            opacity={0.9}
            filter="url(#glow-gold)"
          />
          {/* Planet symbol */}
          <text
            x={p.pos.x}
            y={p.pos.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill={p.color}
            fontSize={size * 0.038}
            fontFamily="serif"
            fontWeight="bold"
          >
            {p.symbol}
          </text>
          {/* Retrograde indicator */}
          {p.isRetrograde && (
            <text
              x={p.pos.x + size * 0.025}
              y={p.pos.y - size * 0.025}
              fill="#FF4D6D"
              fontSize={size * 0.025}
              fontFamily="sans-serif"
            >
              ℞
            </text>
          )}
        </g>
      ))}

      {/* Center cross */}
      <line x1={cx - innerR} y1={cy} x2={cx + innerR} y2={cy} stroke="rgba(100, 80, 180, 0.2)" strokeWidth={0.5} />
      <line x1={cx} y1={cy - innerR} x2={cx} y2={cy + innerR} stroke="rgba(100, 80, 180, 0.2)" strokeWidth={0.5} />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="rgba(167, 139, 250, 0.8)" filter="url(#glow-green)" />
    </svg>
  );
}
