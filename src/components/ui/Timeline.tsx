import { ReactNode } from 'react';
import { Check } from 'lucide-react';

interface TimelineItem {
  title: string;
  description?: string;
  time?: string;
  status: 'completed' | 'current' | 'pending';
  icon?: ReactNode;
}

export function VerticalTimeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex gap-3.5" style={{ animation: `staggerIn 0.3s ease ${i * 60}ms both` }}>
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                item.status === 'completed'
                  ? 'bg-success-500 text-white'
                  : item.status === 'current'
                  ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-500/20 animate-pulse-glow'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500'
              }`}
            >
              {item.status === 'completed' ? <Check className="w-4 h-4" /> : item.icon || <span className="text-xs font-bold">{i + 1}</span>}
            </div>
            {i < items.length - 1 && (
              <div className={`w-0.5 flex-1 min-h-[2rem] self-stretch ${item.status === 'completed' ? 'bg-success-200 dark:bg-success-500/30' : 'bg-ink-100 dark:bg-ink-800'}`} />
            )}
          </div>
          <div className="pt-1 pb-6">
            <p className={`text-sm font-semibold ${item.status === 'pending' ? 'text-ink-400 dark:text-ink-500' : 'text-ink-800 dark:text-ink-100'}`}>{item.title}</p>
            {item.description && <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5">{item.description}</p>}
            {item.time && <p className="text-xs text-ink-400 dark:text-ink-500 mt-1">{item.time}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

interface Stage {
  label: string;
  status: 'completed' | 'current' | 'pending';
  date?: string;
  index?: number;
}

export function HorizontalTimeline({ stages }: { stages: Stage[] }) {
  return (
    <div className="flex items-center w-full overflow-x-auto pb-2">
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center flex-shrink-0" style={{ animation: `staggerIn 0.3s ease ${i * 80}ms both` }}>
          <div className="flex flex-col items-center text-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                stage.status === 'completed'
                  ? 'bg-success-500 text-white'
                  : stage.status === 'current'
                  ? 'bg-primary-500 text-white ring-4 ring-primary-100 dark:ring-primary-500/20 animate-pulse-glow'
                  : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500'
              }`}
            >
              {stage.status === 'completed' ? <Check className="w-5 h-5" /> : (stage.index ?? i) + 1}
            </div>
            <p className={`text-xs font-semibold mt-2 break-words text-center max-w-[80px] ${stage.status === 'pending' ? 'text-ink-400 dark:text-ink-500' : 'text-ink-700 dark:text-ink-200'}`}>
              {stage.label}
            </p>
            {stage.date && <p className="text-xs text-ink-400 dark:text-ink-500 mt-0.5">{stage.date}</p>}
          </div>
          {i < stages.length - 1 && (
            <div className={`h-0.5 flex-1 min-w-[2rem] mx-1 rounded-full transition-all ${stage.status === 'completed' ? 'bg-success-300 dark:bg-success-500/40' : 'bg-ink-200 dark:bg-ink-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
