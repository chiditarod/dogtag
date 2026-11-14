import { ChecklistCard } from '@/features/teams/components/checklist-card';
import { t } from '@/locales/en';
import type { Checklist } from '@/types/api';

export function YoureInCard({ checklist }: { checklist: Checklist }) {
  if (!checklist.finalized) {
    return (
      <ChecklistCard
        number={4}
        title={t('team.youreIn')}
        status="todo"
        pill={t('team.pillLocked')}
        locked
      >
        <p className="text-sm">{t('team.locked')}</p>
      </ChecklistCard>
    );
  }

  return (
    <ChecklistCard
      number={4}
      title={t('team.youreIn')}
      status="done"
      pill={t('team.pillDone')}
    >
      {checklist.team_number !== null && (
        <p className="font-display text-3xl font-semibold text-starText">
          {t('team.teamNumber')}
          {checklist.team_number}
        </p>
      )}
      {checklist.classy_fundraising_url ? (
        <a
          href={checklist.classy_fundraising_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-md bg-star px-4 py-2 text-sm font-semibold text-white hover:bg-starText focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
        >
          {t('team.fundraisingLink')}
        </a>
      ) : (
        checklist.classy_expected && (
          <div role="status" className="space-y-1 text-sm">
            <p>{t('team.fundraisingPending')}</p>
            <p className="text-navy/70">{t('team.fundraisingPendingHint')}</p>
          </div>
        )
      )}
    </ChecklistCard>
  );
}
