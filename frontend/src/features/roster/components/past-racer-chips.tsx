import type { PastRacer } from '@/features/roster/api/use-past-racers';
import { racerChipLabel } from '@/features/roster/utils';
import { t } from '@/locales/en';

export const MAX_CHIPS = 3;

interface PastRacerChipsProps {
  /** Already filtered to people not on the team, most recent first. */
  racers: PastRacer[];
  onPick: (racer: PastRacer) => void;
  onShowMore: () => void;
}

export const chipClass =
  'inline-flex min-h-11 items-center rounded-full border border-flag bg-white px-3 py-1 font-sans text-sm text-navy hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

export function PastRacerChips({
  racers,
  onPick,
  onShowMore,
}: PastRacerChipsProps) {
  if (racers.length === 0) return null;
  const extra = racers.length - MAX_CHIPS;
  return (
    <div
      role="group"
      aria-label={t('roster.pastRacers')}
      className="flex flex-wrap gap-2"
    >
      {racers.slice(0, MAX_CHIPS).map((racer) => (
        <button
          key={racer.email}
          type="button"
          title={racer.last_race_name ?? undefined}
          onClick={() => onPick(racer)}
          className={chipClass}
        >
          {racerChipLabel(racer)}
        </button>
      ))}
      {extra > 0 && (
        <button
          type="button"
          onClick={onShowMore}
          className={`${chipClass} font-semibold text-link`}
        >
          {t('roster.more', { count: extra })}
        </button>
      )}
    </div>
  );
}
