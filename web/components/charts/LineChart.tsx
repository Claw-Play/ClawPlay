interface LineChartProps {
  data: { date: string; count: number }[];
  label?: string;
  color?: string;
  height?: number;
}

export default function LineChart({
  data,
  label,
  color = "#a23f00",
  height = 160,
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-[#a89070] text-sm font-body" style={{ height }}>
        No data
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const padding = { top: 12, right: 12, bottom: 28, left: 40 };
  const width = 320; // viewBox units, wider for better point spacing
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
    const y = padding.top + (1 - d.count / max) * chartHeight;
    return { x, y, ...d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1]?.x.toFixed(2)} ${(padding.top + chartHeight).toFixed(2)} L ${padding.left} ${(padding.top + chartHeight).toFixed(2)} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height }}
        aria-label={label}
      >
        {/* Y-axis gridlines */}
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
                stroke="#e8dfc8"
                strokeWidth="1"
              />
              <text
                x={padding.left - 2}
                y={y + 1.5}
                textAnchor="end"
                fontSize="11"
                fill="#a89070"
                fontFamily="Be Vietnam Pro, sans-serif"
              >
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path
          d={areaPath}
          fill={color}
          fillOpacity="0.08"
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.4"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3.6"
            fill={color}
          />
        ))}

        {/* X-axis labels */}
        {(
          points.length <= 7
            ? points
            : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
        ).map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={padding.top + chartHeight + 12}
            textAnchor="middle"
            fontSize="9"
            fill="#a89070"
            fontFamily="Be Vietnam Pro, sans-serif"
          >
            {(() => {
              const parts = p.date.split("-"); // "YYYY-MM-DD" → ["YYYY","MM","DD"]
              return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
            })()}
          </text>
        ))}
      </svg>
    </div>
  );
}
