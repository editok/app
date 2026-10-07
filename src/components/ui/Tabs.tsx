import { ReactNode } from 'react';
import { useSound } from '../../contexts/SoundContext';

interface TabsProps {
  tabs: { key: string; label: string; icon?: ReactNode; count?: number }[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ tabs, active, onChange, className = '' }: TabsProps) {
  const { play } = useSound();
  return (
    <div className={`flex items-center gap-1 border-b border-ink-100 dark:border-ink-800 overflow-x-auto scrollbar-hide ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => { play('select'); onChange(tab.key); }}
          className={`flex items-center gap-2 min-h-11 px-4 py-2.5 2xl:px-5 2xl:py-3 text-sm 2xl:text-base font-medium border-b-2 -mb-px transition-all whitespace-nowrap flex-shrink-0 ${
            active === tab.key
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-200 hover:border-ink-200 dark:hover:border-ink-700'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.count != null && (
            <span className={`px-1.5 py-0.5 text-xs rounded-md transition-all ${active === tab.key ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300' : 'bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400'}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
