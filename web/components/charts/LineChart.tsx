"use client";
import { useState } from "react";

interface LineChartProps {
  data: { date: string; count: number }[];
  label?: string;
  color?: string;
  height?: number;
}

function buildSmoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";

  return points.reduce((path, point, index, array) => {
    if (index === 0) return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;

    const prev = array[index - 1];
    const next = array[index + 1] ?? point;
    const controlPointOffset = (point.x - prev.x) * 0.28;
    const cp1x = prev.x + controlPointOffset;
    const cp1y = prev.y;
    const cp2x = point.x - controlPointOffset;
    const cp2y = next.y === point.y ? point.y : (point.y + next.y) / 2;

    return `${path} C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
}

function getLabelPoints(points: { x: number; y: number; date: string; count: number }[]) {
  if (points.length <= 6) return points;

  if (points.length >= 10) {
    return points.filter((_, i) => i === 0 || i % 2 === 1).slice(1);
  }

  const desiredTicks = 8;
  const step = (points.length - 1) / (desiredTicks - 1);
  const indexes = Array.from({ length: desiredTicks }, (_, i) => Math.round(i * step));
  const uniqueIndexes = Array.from(new Set(indexes));
  return uniqueIndexes.map((index) => points[index]);
}

function formatDateLabel(date: string) {
  const parts = date.split("-");
  if (date.includes("W")) {
    const year = parseInt(date.split("-")[0]);
    const week = parseInt(date.split("W")[1]);
    const jan4 = Date.UTC(year, 0, 4);
    const monOfW01 = new Date(jan4);
    monOfW01.setUTCDate(4 - (monOfW01.getUTCDay() || 7) + 1);
    const mondayOfWeek = new Date(monOfW01.getTime() + (week - 1) * 7 * 86400000);
    return `${mondayOfWeek.getUTCMonth() + 1}/${mondayOfWeek.getUTCDate()}`;
  }
  if (parts.length === 2) return `${parseInt(parts[1])}/1`;
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

export default function LineChart({
  data,
  label,
  color = "#a23f00",
  height = 210,
}: LineChartProps) {
  const [tooltip, setTooltip] = useState<{
    point: { x: number; y: number; date: string; count: number };
    containerX: number;
    containerY: number;
  } | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[#a89070] text-sm font-body" style={{ height }}>
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const padding = { top: 12, right: 14, bottom: 28, left: 40 };
  const width = 480;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + (1 - d.count / max) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = buildSmoothPath(points);

  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${(padding.top + chartHeight).toFixed(2)} L ${padding.left} ${(padding.top + chartHeight).toFixed(2)} Z`;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_top,_rgba(255,253,248,0.96),_rgba(247,240,226,0.92)_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setTooltip((prev) =>
          prev ? { ...prev, containerX: e.clientX - rect.left, containerY: e.clientY - rect.top } : prev
        );
      }}
      onMouseLeave={() => setTooltip(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        aria-label={label}
      >
        <defs>
          <linearGradient id="line-chart-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="65%" stopColor={color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="line-chart-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.82" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padding.top + frac * chartHeight;
          const val = Math.round(max * (1 - frac));
          return (
            <g key={frac}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke={frac === 1 ? "#dcc9a8" : "#eadfc8"}
                strokeWidth="1"
                strokeDasharray={frac === 1 ? undefined : "3 5"}
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight="600"
                fill="#b09a7a"
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          );
        })}

        <path d={areaPath} fill="url(#line-chart-area)" />

        <path
          d={linePath}
          fill="none"
          stroke="url(#line-chart-stroke)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          filter="drop-shadow(0 10px 16px rgba(162,63,0,0.14))"
        />

        {points.map((p, i) => (
          <g
            key={i}
            onMouseEnter={(e) => {
              const rect = e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect();
              setTooltip({ point: p, containerX: e.clientX - rect.left, containerY: e.clientY - rect.top });
            }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.ownerSVGElement!.parentElement!.getBoundingClientRect();
              setTooltip((prev) =>
                prev ? { ...prev, containerX: e.clientX - rect.left, containerY: e.clientY - rect.top } : prev
              );
            }}
            onMouseLeave={() => setTooltip(null)}
            style={{ cursor: "default" }}
          >
            <circle cx={p.x} cy={p.y} r="10" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r="6.2"
              fill={color}
              opacity={tooltip?.point === p ? "0.3" : "0.12"}
            />
            <circle cx={p.x} cy={p.y} r="4.2" fill="#fffdf8" stroke={color} strokeWidth="2" />
            <circle cx={p.x} cy={p.y} r="1.9" fill={color} />
          </g>
        ))}

        {getLabelPoints(points).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padding.top + chartHeight + 22}
            textAnchor="middle"
            fontSize="10"
            fontWeight="600"
            fill="#b09a7a"
            fontFamily="Be Vietnam Pro, sans-serif"
          >
            {formatDateLabel(p.date)}
          </text>
        ))}
      </svg>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-xl bg-[#3d2c1a] px-3 py-2 text-center shadow-lg"
          style={{
            left: tooltip.containerX,
            top: tooltip.containerY,
            transform:
              tooltip.containerY < 50
                ? "translate(-50%, 12px)"
                : "translate(-50%, calc(-100% - 12px))",
          }}
        >
          <div
            className="text-xs font-bold text-[#f5d9a8]"
            style={{ fontFamily: "Be Vietnam Pro, sans-serif" }}
          >
            {tooltip.point.count.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}
