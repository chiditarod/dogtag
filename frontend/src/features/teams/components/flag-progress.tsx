import { useEffect, useRef, type CSSProperties } from 'react';
import { ChicagoStar } from '@/components/ui/chicago-star';

type Steps = [boolean, boolean, boolean, boolean];

interface FlagProgressProps {
  steps: Steps;
  label: string;
}

/**
 * The four stars of the Chicago flag between two flag-blue bars. A star is
 * solid once its step is done. A star that just became done scales in; when
 * the fourth lands, all four pulse once in order.
 */
export function FlagProgress({ steps, label }: FlagProgressProps) {
  const previous = useRef(steps);
  useEffect(() => {
    previous.current = steps;
  });

  const landed = steps.map((done, i) => done && !previous.current[i]);
  const salute = steps.every(Boolean) && !previous.current.every(Boolean);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={steps.filter(Boolean).length}
      className={`rounded-lg border border-flag bg-white px-3 py-2 ${salute ? 'flag-salute' : ''}`.trim()}
    >
      <div className="h-2 rounded-full bg-flag" />
      <div className="flex items-center justify-center gap-4 py-2">
        {steps.map((done, i) => (
          <ChicagoStar
            key={i}
            filled={done}
            className={`h-9 w-9 lg:h-11 lg:w-11 ${landed[i] && !salute ? 'star-land' : ''}`.trim()}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <div className="h-2 rounded-full bg-flag" />
    </div>
  );
}
