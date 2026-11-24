import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useMyTeamsByRace } from '@/features/races/api/use-my-teams-by-race';
import { useRaces } from '@/features/races/api/use-races';
import { RaceTeams } from '@/features/races/components/race-teams';
import { formatDate, formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Race } from '@/types/api';

function RaceStatus({ race }: { race: Race }) {
  switch (race.registration_status) {
    case 'open':
      return <Badge tone="success">{t('races.open')}</Badge>;
    case 'waitlist':
      return <Badge tone="warning">{t('races.waitlist')}</Badge>;
    case 'closed':
      return <Badge tone="danger">{t('races.closed')}</Badge>;
    case 'not_yet_open':
      return (
        <>
          <Badge tone="danger">{t('races.closed')}</Badge>
          <span className="text-sm">
            {t('races.opens')} {formatDate(race.registration_open, race.time_zone)}
          </span>
        </>
      );
  }
}

export function RaceList() {
  const { data, isPending, isError, refetch } = useRaces();
  const teamsByRace = useMyTeamsByRace();

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  if (data.length === 0) return <p>{t('races.empty')}</p>;

  return (
    <ul className="space-y-4">
      {data.map((race) => {
        const myTeams = teamsByRace.get(race.id) ?? [];
        const hasTeam = myTeams.length > 0;
        return (
          <li key={race.id}>
            <Card className="space-y-2">
              <h2 className="font-display text-xl font-semibold">{race.name}</h2>
              <p>{formatDate(race.race_datetime, race.time_zone)}</p>
              <p className="text-sm">
                {t('races.closes')}{' '}
                {formatDeadline(race.registration_close, race.time_zone)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <RaceStatus race={race} />
              </div>
              {hasTeam && <RaceTeams teams={myTeams} />}
              {race.open_for_registration && (
                <Link
                  to={`/races/${race.id}/teams/new`}
                  className={`inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2 text-sm font-semibold ${
                    hasTeam
                      ? 'border border-link text-link hover:bg-flag/20'
                      : 'bg-star text-white hover:bg-starText'
                  }`}
                >
                  {hasTeam ? t('races.startAnother') : t('races.start')}
                </Link>
              )}
              <div>
                <Link
                  to={`/races/${race.id}/registrations`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline"
                >
                  {t('races.whoRegistered')}
                </Link>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
