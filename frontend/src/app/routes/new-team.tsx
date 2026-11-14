import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useRace } from '@/features/races/api/use-races';
import { CreateTeamForm } from '@/features/teams/components/create-team-form';
import { t } from '@/locales/en';

export function NewTeamRoute() {
  const { raceId } = useParams();
  const { data: race, isPending, isError, refetch } = useRace(raceId);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('teams.newHeading')}</h1>
      {isPending ? (
        <QueryLoading />
      ) : isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : (
        <>
          <p className="font-semibold">{race.name}</p>
          <Card>
            <CreateTeamForm race={race} />
          </Card>
        </>
      )}
    </div>
  );
}
