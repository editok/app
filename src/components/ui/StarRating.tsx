import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  max?: number;
  size?: number;
  readOnly?: boolean;
  onChange?: (value: number) => void;
}

export default function StarRating({ value, max = 5, size = 24, readOnly = false, onChange }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: max }).map((_, i) => {
        const filled = i < Math.round(value);
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(i + 1)}
            className={`transition-all ${readOnly ? 'cursor-default' : 'hover:scale-125 active:scale-95'} ${filled ? 'text-warning-400' : 'text-ink-200 dark:text-ink-700'}`}
            aria-label={`${i + 1} star`}
          >
            <Star className={`${filled ? 'fill-current' : ''}`} style={{ width: size, height: size }} />
          </button>
        );
      })}
    </div>
  );
}
