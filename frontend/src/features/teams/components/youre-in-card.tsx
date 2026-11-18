import { ChecklistCard } from '@/features/teams/components/checklist-card';
import { FundraisingStatus } from '@/features/teams/components/fundraising-status';
import { t } from '@/locales/en';
import type { Checklist } from '@/types/api';

export function YoureInCard({ checklist }: { checklist: Checklist }) {
  if (!checklist.finalized) {
    return (
      <ChecklistCard
        anchor="step-in"
        title={t('team.youreIn')}
        status="todo"
        pill=""
        locked
        tourId="in"
      >
        {t('team.locked')}
      </ChecklistCard>
    );
  }

  return (
    <ChecklistCard
      anchor="step-in"
      title={t('team.fullyRegistered')}
      status="done"
      pill={t('team.pillDone')}
      tourId="in"
    >
      {checklist.team_number !== null && (
        <p className="font-display text-3xl font-semibold text-starText">
          {t('team.teamNumber')}
          {checklist.team_number}
        </p>
      )}
      <FundraisingStatus checklist={checklist} />
    </ChecklistCard>
  );
}
