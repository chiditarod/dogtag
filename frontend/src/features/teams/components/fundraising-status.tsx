import { t } from '@/locales/en';
import type { Checklist } from '@/types/api';

interface FundraisingStatusProps {
  checklist: Checklist;
  /** Header and dialog variant: plain text without the hint; only the full variant is a live region. */
  compact?: boolean;
}

export function FundraisingStatus({ checklist, compact = false }: FundraisingStatusProps) {
  if (checklist.classy_fundraising_url) {
    return (
      <a
        href={checklist.classy_fundraising_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded-md bg-star px-4 py-2 text-sm font-semibold text-white hover:bg-starText focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
      >
        {t('team.fundraisingLink')}
      </a>
    );
  }
  if (!checklist.classy_expected) return null;
  return (
    <div role={compact ? undefined : 'status'} className="space-y-1 text-sm">
      <p>{t('team.fundraisingPending')}</p>
      {!compact && <p className="text-navy/70">{t('team.fundraisingPendingHint')}</p>}
    </div>
  );
}
