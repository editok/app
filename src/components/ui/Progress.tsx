interface ProgressProps {
  value: number;
  max?: number;
  color?: 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  stageLabel?: string;
}

const colorMap = {
  primary: 'bg-primary-500 shadow-primary-500/30',
  success: 'bg-success-500 shadow-success-500/30',
  warning: 'bg-warning-500 shadow-warning-500/30',
  error: 'bg-error-500 shadow-error-500/30',
};

const sizeMap = {
  sm: 'h-2.5',
  md: 'h-3.5',
  lg: 'h-4',
};

export default function Progress({ value, max = 100, color = 'primary', size = 'md', showLabel = false, stageLabel }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const displayPct = Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;

  return (
    <div className="w-full min-w-0" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={stageLabel || 'Progress'}>
      <div className={`flex items-end justify-between gap-2 ${showLabel ? 'mb-2' : 'mb-1.5'}`}>
        {showLabel && stageLabel ? (
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-400 dark:text-ink-500">{stageLabel}</span>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-sm font-bold tabular-nums text-primary-500 dark:text-primary-400">{displayPct}</span>
      </div>
      <div className={`relative ${sizeMap[size]} overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800`}>
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${colorMap[color]} shadow-md transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%`, minWidth: pct > 0 ? '4px' : '0' }}
        />
      </div>
    </div>
  );
}
