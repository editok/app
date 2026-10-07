interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, height = 200, formatValue }: BarChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
          <div className="text-xs font-semibold text-ink-700 opacity-0 group-hover:opacity-100 transition-opacity">
            {formatValue ? formatValue(d.value) : d.value}
          </div>
          <div className="w-full flex items-end" style={{ height: height - 40 }}>
            <div
              className="w-full rounded-t-lg transition-all duration-500 ease-out hover:opacity-80"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: d.color || 'linear-gradient(180deg, #60a5fa 0%, #3b82f6 100%)',
              }}
            />
          </div>
          <p className="text-xs text-ink-500 font-medium truncate w-full text-center">{d.label}</p>
        </div>
      ))}
    </div>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
}

export function LineChart({ data, height = 200, color = '#3b82f6' }: LineChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = Math.min(...data.map((d) => d.value), 0);
  const range = max - min || 1;
  const w = 100;
  const h = 100;
  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * w,
    y: h - ((d.value - min) / range) * (h - 10) - 5,
  ...d,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <div className="w-full" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#lineGrad)" />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill={color} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="flex justify-between mt-2">
        {data.map((d, i) => (
          <span key={i} className="text-xs text-ink-400 truncate flex-1 text-center min-w-0">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}

export function DonutChart({ data, size = 160, thickness = 24 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  if (total === 0) {
    return (
      <div className="flex items-center gap-6">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={thickness} className="text-ink-200 dark:text-ink-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-ink-400">0</span>
            <span className="text-xs text-ink-400">Total</span>
          </div>
        </div>
        <div className="space-y-2">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
              <span className="text-sm text-ink-600 font-medium min-w-0 truncate">{d.label}</span>
              <span className="text-sm text-ink-400 ml-auto pl-4 shrink-0">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {data.map((d, i) => {
            const len = (d.value / total) * circ;
            const seg = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += len;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-ink-900">{total}</span>
          <span className="text-xs text-ink-400">Total</span>
        </div>
      </div>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
            <span className="text-sm text-ink-600 font-medium min-w-0 truncate">{d.label}</span>
            <span className="text-sm text-ink-400 ml-auto pl-4 shrink-0">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
