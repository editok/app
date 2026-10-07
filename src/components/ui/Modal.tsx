import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { useSound } from '../../contexts/SoundContext';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'sm:max-w-md 2xl:max-w-lg',
  md: 'sm:max-w-lg 2xl:max-w-xl',
  lg: 'sm:max-w-2xl 2xl:max-w-3xl',
  xl: 'sm:max-w-4xl 2xl:max-w-5xl',
};

export default function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const { play } = useSound();
  const handleClose = () => { play('back'); onClose(); };
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
      window.addEventListener('keydown', onKey);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', onKey);
      };
    }
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 p-2 animate-fade-in">
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" onClick={handleClose} />
      <div className={`relative bg-white dark:bg-ink-900 rounded-t-2xl sm:rounded-xl shadow-float w-full ${sizes[size]} animate-bounce-in max-h-[92vh] sm:max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-ink-100 dark:border-ink-800">
          <h3 className="text-base sm:text-lg font-semibold text-ink-900 dark:text-white pr-2">{title || ' '}</h3>
          <button onClick={handleClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-ink-100 dark:hover:bg-ink-800 transition-all hover:scale-110 active:scale-95 shrink-0">
            <X className="w-5 h-5 text-ink-500 dark:text-ink-400" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-4 sm:px-6 2xl:px-8 py-5 2xl:py-6">{children}</div>
        {footer && <div className="px-4 sm:px-6 2xl:px-8 py-4 2xl:py-5 border-t border-ink-100 dark:border-ink-800 flex justify-end gap-3 flex-wrap">{footer}</div>}
      </div>
    </div>
  );
}
