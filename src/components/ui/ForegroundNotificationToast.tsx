import { useEffect, useState, useCallback } from 'react';
import { X, Bell } from 'lucide-react';

interface ToastPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ActiveToast extends ToastPayload {
  id: number;
}

export function ForegroundNotificationToast() {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent).detail as ToastPayload;
      if (!payload || !payload.title) return;
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-3), { ...payload, id }]);
      setTimeout(() => dismiss(id), 5000);
    };
    window.addEventListener('editok-foreground-notification', handler);
    return () => window.removeEventListener('editok-foreground-notification', handler);
  }, [dismiss]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE') {
        const page = event.data.page as string;
        const params = event.data.params as Record<string, unknown> | undefined;
        if (page) {
          const ev = new CustomEvent('editok-navigate', { detail: { page, params } });
          window.dispatchEvent(ev);
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[calc(100vw-2rem)] sm:w-auto sm:max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white dark:bg-ink-800 rounded-xl shadow-float border border-ink-100 dark:border-ink-700 p-3.5 flex items-start gap-3 animate-slide-up"
        >
          <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400 flex items-center justify-center flex-shrink-0">
            <Bell className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-900 dark:text-white truncate">{toast.title}</p>
            <p className="text-xs text-ink-500 dark:text-ink-400 mt-0.5 line-clamp-2">{toast.body}</p>
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-ink-300 hover:text-ink-500 dark:text-ink-600 dark:hover:text-ink-400 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
