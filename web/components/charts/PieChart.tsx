interface PieChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  totalLabel?: string;
}

export default function PieChart({ data, size = 120, totalLabel = "次" }: PieChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex items-center justify-center text-[#a89070] text-xs font-body" style={{ width: size, height: size }}>
        No data
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = 40;
  const cx = 50;
  const cy = 50;
  const innerRadius = 24; // donut hole

  let currentAngle = -90; // start at top
  const slices = data.map((d) => {
    const angle = (d.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    const endAngle = currentAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(toRad(startAngle));
    const y1 = cy + radius * Math.sin(toRad(startAngle));
    const x2 = cx + radius * Math.cos(toRad(endAngle));
    const y2 = cy + radius * Math.sin(toRad(endAngle));

    const ix1 = cx + innerRadius * Math.cos(toRad(startAngle));
    const iy1 = cy + innerRadius * Math.sin(toRad(startAngle));
    const ix2 = cx + innerRadius * Math.cos(toRad(endAngle));
    const iy2 = cy + innerRadius * Math.sin(toRad(endAngle));

    const largeArc = angle > 180 ? 1 : 0;

    const path = [
      `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      `L ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
      "Z",
    ].join(" ");

    return { ...d, path, percent: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 100 100"
        style={{ width: size, height: size, flexShrink: 0 }}
      >
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="#fefae0"
            strokeWidth="0.5"
          />
        ))}
        {/* Center label */}
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill="#564337"
          fontFamily="Plus Jakarta Sans, sans-serif"
        >
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill="#564337"
          fontFamily="Be Vietnam Pro, sans-serif"
        >
          {totalLabel}
        </text>
      </svg>

      {/* Legend */}
      <div className="space-y-1.5 flex-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs text-[#564337] font-body truncate">{s.name}</span>
            <span className="text-xs text-[#a89070] font-body ml-auto flex-shrink-0">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
