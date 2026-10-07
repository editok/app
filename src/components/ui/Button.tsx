import { ButtonHTMLAttributes, ReactNode, MouseEvent } from 'react';
import { useSound } from '../../contexts/SoundContext';

type Variant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-glow dark:bg-primary-600 dark:hover:bg-primary-500',
  secondary: 'bg-ink-100 dark:bg-ink-800 text-ink-700 dark:text-ink-200 hover:bg-ink-200 dark:hover:bg-ink-700',
  success: 'bg-success-600 text-white hover:bg-success-700 shadow-sm hover:shadow-glow-success',
  danger: 'bg-error-600 text-white hover:bg-error-700 shadow-sm hover:shadow-glow-error',
  outline: 'border border-ink-200 dark:border-ink-700 text-ink-700 dark:text-ink-200 hover:bg-ink-50 dark:hover:bg-ink-800 bg-white dark:bg-ink-900',
  ghost: 'text-ink-600 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 2xl:px-3.5 2xl:py-2 2xl:text-sm',
  md: 'px-4 py-2.5 text-sm gap-2 2xl:px-5 2xl:py-3 2xl:text-base',
  lg: 'px-5 py-3 text-base gap-2 2xl:px-6 2xl:py-3.5 2xl:text-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  iconRight,
  children,
  className = '',
  disabled,
  onClick,
  ...rest
}: ButtonProps) {
  const { play } = useSound();
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    const soundType = variant === 'success' ? 'success' : variant === 'danger' ? 'error' : 'click';
    play(soundType);
    onClick?.(e);
  };
  return (
    <button
      className={`inline-flex items-center justify-center font-medium rounded-xl transition-all duration-200 active:scale-95 hover:scale-[1.03] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        icon
      )}
      {children}
      {iconRight}
    </button>
  );
}
