interface PieChartProps {
  data: { name: string; value: number; color: string }[];
  size?: number;
  totalLabel?: string;
}

export default function PieChart({ data, size = 120, totalLabel = "次" }: PieChartProps) {
  if (!data || data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-[#8aa0cb]" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" className="h-[84px] w-[84px]" aria-hidden="true">
          <defs>
            <linearGradient id="pie-empty-a" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#cfe0ff" />
              <stop offset="100%" stopColor="#a7c2ff" />
            </linearGradient>
          </defs>
          <ellipse cx="60" cy="94" rx="26" ry="7" fill="#e9f0ff" />
          <path d="M40 52h40l-4 22H44z" fill="url(#pie-empty-a)" opacity="0.72" />
          <path d="M44 45h24l6 7H50z" fill="#dce7ff" />
          <path d="M44 52h40l-4 8H48z" fill="#bcd0ff" />
          <path d="M42 60h36l-3 14H45z" fill="#c9dbff" />
          <path d="M42 46h10l2 6H44z" fill="#f4f8ff" />
          <path d="M79 48l3-6" stroke="#b6cbff" strokeWidth="2" strokeLinecap="round" />
          <path d="M30 39l2 4" stroke="#b6cbff" strokeWidth="2" strokeLinecap="round" />
          <path d="M90 36l-2 5" stroke="#b6cbff" strokeWidth="2" strokeLinecap="round" />
          <circle cx="31" cy="36" r="2" fill="#d3e1ff" />
          <circle cx="88" cy="31" r="2" fill="#d3e1ff" />
          <circle cx="79" cy="40" r="1.5" fill="#d3e1ff" />
        </svg>
        <div className="text-xs font-medium text-[#8aa0cb]">No data</div>
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
            stroke="#f8faff"
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
          fill="#1f2b45"
          fontFamily="var(--font-geist-sans), sans-serif"
        >
          {total >= 1000 ? `${(total / 1000).toFixed(1)}k` : total}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          fontSize="8"
          fontWeight="700"
          fill="#7c879f"
          fontFamily="var(--font-geist-sans), sans-serif"
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
            <span className="text-xs text-[#394766] font-medium truncate">{s.name}</span>
            <span className="text-xs text-[#8aa0cb] font-medium ml-auto flex-shrink-0">{s.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
