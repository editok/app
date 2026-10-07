import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface Crumb {
  label: string;
  onClick?: () => void;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm animate-fade-in">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-ink-300 dark:text-ink-600" />}
          {item.onClick && i < items.length - 1 ? (
            <button onClick={item.onClick} className="text-ink-500 dark:text-ink-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors font-medium">
              {item.label}
            </button>
          ) : (
            <span className={`font-semibold ${i === items.length - 1 ? 'text-ink-800 dark:text-ink-100' : 'text-ink-500 dark:text-ink-400'}`}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-slide-up">
      <div className="w-16 h-16 rounded-2xl bg-ink-50 dark:bg-ink-800 flex items-center justify-center text-ink-300 dark:text-ink-600 mb-4 animate-float">{icon}</div>
      <h3 className="text-base font-semibold text-ink-700 dark:text-ink-200">{title}</h3>
      <p className="text-sm text-ink-400 dark:text-ink-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-5 animate-bounce-in">{action}</div>}
    </div>
  );
}
