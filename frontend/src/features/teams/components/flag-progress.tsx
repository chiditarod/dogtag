import { useState, type CSSProperties } from 'react';
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
  // The animation is derived from the last change of steps and kept until the
  // steps change again, so re-renders with equal steps do not cut it short.
  const [shown, setShown] = useState({
    steps,
    landed: steps.map(() => false),
    salute: false,
  });
  let current = shown;
  if (steps.some((done, i) => done !== shown.steps[i])) {
    current = {
      steps,
      landed: steps.map((done, i) => done && !shown.steps[i]),
      salute: steps.every(Boolean) && !shown.steps.every(Boolean),
    };
    setShown(current);
  }
  const { landed, salute } = current;

  return (
    <div
      role="progressbar"
      data-tour="flag"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={4}
      aria-valuenow={steps.filter(Boolean).length}
      className={`rounded-lg border border-flag bg-white py-1.5 ${salute ? 'flag-salute' : ''}`.trim()}
    >
      <div className="h-[13px] bg-flag lg:h-4" />
      <div className="flex items-center justify-center gap-4 py-1.5">
        {steps.map((done, i) => (
          <ChicagoStar
            key={i}
            filled={done}
            className={`h-9 w-9 lg:h-11 lg:w-11 ${landed[i] && !salute ? 'star-land' : ''}`.trim()}
            style={{ '--i': i } as CSSProperties}
          />
        ))}
      </div>
      <div className="h-[13px] bg-flag lg:h-4" />
    </div>
  );
}
