import { Link } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useTeam } from '@/features/teams/api/use-team';
import { ChecklistCard } from '@/features/teams/components/checklist-card';
import {
  FeeCardSlot,
  QuestionsCardSlot,
  RosterCardSlot,
} from '@/features/teams/components/checklist-slots';
import { TeamHeader } from '@/features/teams/components/team-header';
import {
  TeamErrorBanner,
  TeamPageErrorProvider,
} from '@/features/teams/components/team-page-error';
import { YoureInCard } from '@/features/teams/components/youre-in-card';
import { feePill, isFeeOpensLater } from '@/features/teams/utils';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

export function TeamChecklist({ teamId }: { teamId: string }) {
  const { data: team, isPending, error, refetch } = useTeam(teamId, {
    pollForFundraisingUrl: true,
  });

  if (isPending) return <QueryLoading />;
  if (error && !team) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) {
      return (
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold">
            {t('team.notFound')}
          </h1>
          <Link to="/teams" className="text-link underline">
            {t('team.backToTeams')}
          </Link>
        </div>
      );
    }
    return <QueryError onRetry={() => void refetch()} />;
  }

  const { checklist } = team;
  return (
    <TeamPageErrorProvider teamId={teamId}>
      <div className="space-y-4">
        <TeamErrorBanner />
        <TeamHeader team={team} />
        <ChecklistCard
          number={1}
          title={t('team.racers')}
          status={checklist.racers.done ? 'done' : 'todo'}
          pill={t('team.racersPill', {
            filled: checklist.racers.filled,
            total: checklist.racers.total,
          })}
        >
          <RosterCardSlot team={team} />
        </ChecklistCard>
        {checklist.questions.required && (
          <ChecklistCard
            number={2}
            title={t('team.questions')}
            status={checklist.questions.done ? 'done' : 'todo'}
            pill={
              checklist.questions.done ? t('team.pillDone') : t('team.pillTodo')
            }
          >
            <QuestionsCardSlot team={team} />
          </ChecklistCard>
        )}
        <ChecklistCard
          number={3}
          title={t('team.fee')}
          status={
            checklist.fee.done && !isFeeOpensLater(checklist.fee)
              ? 'done'
              : 'todo'
          }
          pill={feePill(checklist.fee)}
        >
          <FeeCardSlot team={team} />
        </ChecklistCard>
        <YoureInCard checklist={checklist} />
      </div>
    </TeamPageErrorProvider>
  );
}
