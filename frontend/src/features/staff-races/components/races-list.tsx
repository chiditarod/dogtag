import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { formatDate, formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { StaffRaceSummary } from '../api/types';
import { useStaffRaces } from '../api/use-staff-races';

const headCell = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-navy/70';
const cell = 'block min-w-0 px-3 py-0.5 sm:table-cell sm:py-2 sm:align-top';

/** Shown only below `sm`, where each row is a card with no column header (kept in the accessibility tree). */
function Label({ children }: { children: string }) {
  return <span className="mr-1 text-xs font-semibold uppercase text-navy/60 sm:hidden">{children} </span>;
}

function StatusBadge({ status }: { status: StaffRaceSummary['registration_status'] }) {
  switch (status) {
    case 'open':
      return <Badge tone="success">{t('races.open')}</Badge>;
    case 'waitlist':
      return <Badge tone="warning">{t('races.waitlist')}</Badge>;
    case 'closed':
      return <Badge>{t('races.closed')}</Badge>;
    case 'not_yet_open':
      return <Badge>{t('staff.races.notYetOpen')}</Badge>;
  }
}

function RegistrationCell({ race }: { race: StaffRaceSummary }) {
  const when =
    race.registration_status === 'not_yet_open'
      ? t('staff.races.opensOn', { date: formatDate(race.registration_open, race.time_zone) })
      : race.registration_status === 'closed'
        ? null
        : t('staff.races.closesOn', { date: formatDeadline(race.registration_close, race.time_zone) });
  return (
    <>
      <StatusBadge status={race.registration_status} />
      {when && <p className="mt-1 text-sm text-navy/70">{when}</p>}
    </>
  );
}

function TeamsCell({ race }: { race: StaffRaceSummary }) {
  const { finalized, total } = race.teams;
  const registering = total - finalized;
  return (
    <>
      <p>
        {race.max_teams === null
          ? t('staff.races.registered', { n: finalized })
          : t('staff.races.registeredOf', { n: finalized, max: race.max_teams })}
      </p>
      {registering > 0 && (
        <p className="text-navy/70">{t('staff.races.stillRegistering', { n: registering })}</p>
      )}
    </>
  );
}

function SetupCell({ problems }: { problems: string[] }) {
  if (problems.length === 0) return <p>{t('staff.races.ready')}</p>;
  return (
    <>
      {problems.map((problem) => (
        <p key={problem} className="font-semibold text-starText">
          {problem}
        </p>
      ))}
    </>
  );
}

/** One markup: a table from `sm`, stacked cards below it. */
export function RacesList() {
  const { data, isPending, isError, refetch } = useStaffRaces();

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  if (data.length === 0) return <p>{t('staff.races.empty')}</p>;

  return (
    <div className="space-y-3">
      <div role="table" aria-label={t('staff.races.list')} className="block w-full sm:table">
        <div role="rowgroup" className="hidden sm:table-header-group">
          <div role="row" className="sm:table-row">
            {(['race', 'raceDay', 'registration', 'teams', 'setup'] as const).map((column) => (
              <div key={column} role="columnheader" className={`${headCell} sm:table-cell`}>
                {t(`staff.races.col.${column}`)}
              </div>
            ))}
          </div>
        </div>
        <div role="rowgroup" className="block space-y-3 sm:table-row-group sm:space-y-0">
          {data.map((race) => (
            <div
              key={race.id}
              role="row"
              data-race-id={race.id}
              className="grid grid-cols-[minmax(0,1fr)] rounded-lg border border-flag bg-white py-2 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:py-0"
            >
              <div role="cell" className={`${cell} break-words font-semibold`}>
                <Link to={`/staff/races/${race.id}`} className="text-link hover:underline">
                  {race.name}
                </Link>
              </div>
              <div role="cell" className={`${cell} text-sm`}>
                <Label>{t('staff.races.col.raceDay')}</Label>
                {formatDate(race.race_datetime, race.time_zone)}
              </div>
              <div role="cell" className={cell}>
                <Label>{t('staff.races.col.registration')}</Label>
                <RegistrationCell race={race} />
              </div>
              <div role="cell" className={`${cell} text-sm`}>
                <Label>{t('staff.races.col.teams')}</Label>
                <TeamsCell race={race} />
              </div>
              <div role="cell" className={`${cell} break-words text-sm`}>
                <Label>{t('staff.races.col.setup')}</Label>
                <SetupCell problems={race.setup_problems} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-navy/70">{t('staff.races.caption')}</p>
    </div>
  );
}
