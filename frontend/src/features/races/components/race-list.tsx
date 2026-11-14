import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useRaces } from '@/features/races/api/use-races';
import { formatDate, formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Race } from '@/types/api';

function RaceStatus({ race }: { race: Race }) {
  if (race.open_for_registration && !race.full) {
    return <Badge tone="success">{t('races.open')}</Badge>;
  }
  if (race.open_for_registration) {
    return <Badge tone="warning">{t('races.waitlist')}</Badge>;
  }
  const opensLater = new Date(race.registration_open).getTime() > Date.now();
  return (
    <>
      <Badge tone="danger">{t('races.closed')}</Badge>
      {opensLater && (
        <span className="text-sm">
          {t('races.opens')} {formatDate(race.registration_open, race.time_zone)}
        </span>
      )}
    </>
  );
}

export function RaceList() {
  const { data, isPending, isError, refetch } = useRaces();

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  if (data.length === 0) return <p>{t('races.empty')}</p>;

  return (
    <ul className="space-y-4">
      {data.map((race) => (
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
            {race.open_for_registration && (
              <Link
                to={`/races/${race.id}/teams/new`}
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-star px-4 py-2 text-sm font-semibold text-white hover:bg-starText"
              >
                {t('races.start')}
              </Link>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
