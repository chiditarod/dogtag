import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useTeams } from '@/features/teams/api/use-teams';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

function teamStatus({ checklist }: Team): string {
  if (checklist.finalized) {
    return `${t('teams.finalized')}${checklist.team_number ?? ''}`;
  }
  const unit =
    checklist.remaining === 1 ? 'teams.thingsLeft_one' : 'teams.thingsLeft_other';
  return `${checklist.remaining} ${t(unit)}`;
}

export function MyTeams() {
  const { data, isPending, isError, refetch } = useTeams();

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  if (data.length === 0) {
    return (
      <div className="space-y-2">
        <p>{t('teams.empty')}</p>
        <Link to="/" className="text-link underline">
          {t('teams.emptyLink')}
        </Link>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {data.map((team) => (
        <li key={team.id}>
          <Card className="space-y-1">
            <h2 className="font-display text-xl font-semibold">
              <Link
                to={`/teams/${team.id}`}
                aria-label={`${t('teams.view')}: ${team.name}`}
                className="text-link hover:underline"
              >
                {team.name}
              </Link>
            </h2>
            <p>{team.race.name}</p>
            <p className="text-sm">{teamStatus(team)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
