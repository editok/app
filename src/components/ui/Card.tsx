import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
  onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
  onTouchMove?: React.TouchEventHandler<HTMLDivElement>;
  onTouchEnd?: React.TouchEventHandler<HTMLDivElement>;
}

export function Card({ children, className = '', padding = true, hover = false, style, onTouchStart, onTouchMove, onTouchEnd }: CardProps) {
  return (
    <div
      className={`bg-white dark:bg-ink-900 rounded-xl shadow-card border border-ink-100/60 dark:border-ink-800 ${padding ? 'p-5 2xl:p-6 3xl:p-7' : ''} ${hover ? 'transition-all duration-300 hover:shadow-float hover:border-primary-200 dark:hover:border-primary-500/30 hover:-translate-y-0.5' : ''} ${className}`}
      style={style}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: { value: string; up: boolean };
  color?: 'primary' | 'success' | 'warning' | 'error' | 'purple';
}

const colorMap = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-500/15', text: 'text-primary-600 dark:text-primary-400', glow: 'group-hover:shadow-glow' },
  success: { bg: 'bg-success-50 dark:bg-success-500/15', text: 'text-success-600 dark:text-success-400', glow: 'group-hover:shadow-glow-success' },
  warning: { bg: 'bg-warning-50 dark:bg-warning-500/15', text: 'text-warning-600 dark:text-warning-400', glow: '' },
  error: { bg: 'bg-error-50 dark:bg-error-500/15', text: 'text-error-600 dark:text-error-400', glow: 'group-hover:shadow-glow-error' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-500/15', text: 'text-purple-600 dark:text-purple-400', glow: '' },
};

export function StatCard({ label, value, icon, trend, color = 'primary' }: StatCardProps) {
  const c = colorMap[color];
  return (
    <Card hover className={`group ${c.glow}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm 2xl:text-base text-ink-500 dark:text-ink-400 font-medium">{label}</p>
          <p className="text-2xl 2xl:text-3xl 3xl:text-4xl font-bold text-ink-900 dark:text-white mt-2 tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs font-semibold ${trend.up ? 'text-success-600 dark:text-success-400' : 'text-error-600 dark:text-error-400'}`}>
                {trend.up ? '↑' : '↓'} {trend.value}
              </span>
              <span className="text-xs text-ink-400 dark:text-ink-500">vs last month</span>
            </div>
          )}
        </div>
        <div className={`w-11 h-11 2xl:w-12 2xl:h-12 3xl:w-14 3xl:h-14 rounded-xl flex items-center justify-center ${c.bg} ${c.text} transition-transform group-hover:scale-125 group-hover:rotate-6 duration-300`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}
