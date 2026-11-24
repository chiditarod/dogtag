import { Link } from 'react-router-dom';
import { ListCell, ListRow, ListTable } from '@/components/list/list-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatShortDay, formatSince } from '@/lib/dates';
import { t } from '@/locales/en';
import type { RegistrationRow, RegistrationsTab } from '../types';

interface RegistrationsListProps {
  rows: RegistrationRow[];
  tab: RegistrationsTab;
  kind: 'registering' | 'waitlist';
  fields: { key: string; label: string }[];
  staff: boolean;
  timeZone: string;
  onDelete: (row: RegistrationRow) => void;
}

function TeamCell({ row, waitlist, timeZone }: { row: RegistrationRow; waitlist: boolean; timeZone: string }) {
  return (
    <ListCell className="[overflow-wrap:anywhere]">
      <div>
        {row.can_show ? (
          <Link to={`/teams/${row.id}`} className="font-semibold text-link hover:underline">
            {row.name}
          </Link>
        ) : (
          <span className="font-semibold">{row.name}</span>
        )}
        {row.mine && (
          <span className="ml-2 inline-block rounded-full bg-navy px-2 py-px align-middle text-xs text-white">
            {t('registrations.mine')}
          </span>
        )}
      </div>
      {row.description && <p className="text-sm text-navy/70">{row.description}</p>}
      {waitlist && (
        <p className="text-sm text-navy/70">
          {t('registrations.waitlistSince', { date: formatShortDay(row.created_at, timeZone) })}
        </p>
      )}
    </ListCell>
  );
}

function Progress({ percent }: { percent: number }) {
  return (
    <div>
      <div
        role="progressbar"
        aria-label={t('registrations.col.progress')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="my-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-flag/40"
      >
        <div className="h-full bg-star" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-sm text-navy/70">{t('registrations.percentDone', { n: percent })}</span>
    </div>
  );
}

/** One table (cards below `sm`) for the tab on screen. Staff get the number, payments and new-team columns. */
export function RegistrationsList({ rows, tab, kind, fields, staff, timeZone, onDelete }: RegistrationsListProps) {
  const registered = tab === 'registered';
  const waitlist = !registered && kind === 'waitlist';
  const deletable = rows.some((row) => row.deletable);

  const columns = [
    ...(staff && registered ? [{ key: 'number', label: t('registrations.col.number') }] : []),
    { key: 'team', label: t('registrations.col.team') },
    ...fields.map((field) => ({ key: `f_${field.key}`, label: field.label })),
    ...(staff && registered
      ? [{ key: 'experience', label: t('registrations.col.experience') }]
      : [{ key: 'teamExperience', label: t('registrations.col.teamExperience') }]),
    ...(registered
      ? staff
        ? []
        : [{ key: 'racerYears', label: t('registrations.col.racerYears') }]
      : [
          waitlist
            ? { key: 'position', label: t('registrations.col.position') }
            : { key: 'progress', label: t('registrations.col.progress') },
        ]),
    ...(staff
      ? [
          { key: 'payments', label: t('registrations.col.payments') },
          { key: 'newTeam', label: t('registrations.col.newTeam') },
        ]
      : []),
    ...(deletable
      ? [{ key: 'actions', label: <span className="sr-only">{t('registrations.col.actions')}</span> }]
      : []),
  ];

  return (
    <ListTable label={t('registrations.list')} columns={columns}>
      {rows.map((row) => (
        <ListRow key={row.id} data-team-id={row.id} className="bg-white">
          {staff && registered && (
            <ListCell label={t('registrations.col.number')} className="font-semibold">
              {row.staff?.assigned_team_number ?? t('registrations.noAnswer')}
            </ListCell>
          )}
          <TeamCell row={row} waitlist={waitlist} timeZone={timeZone} />
          {fields.map((field) => (
            <ListCell key={field.key} label={field.label} className="text-sm [overflow-wrap:anywhere]">
              {row.answers[field.key] ?? t('registrations.noAnswer')}
            </ListCell>
          ))}
          {staff && registered ? (
            <ListCell label={t('registrations.col.experience')} className="text-sm">
              <div className="[overflow-wrap:anywhere]">
                {t('registrations.teamExperience', { label: row.experience_label })}
              </div>
              <div className="text-navy/70">{t('registrations.racerYears', { years: row.racer_years })}</div>
            </ListCell>
          ) : (
            <ListCell label={t('registrations.col.teamExperience')} className="text-sm">
              {row.experience_label}
            </ListCell>
          )}
          {registered && !staff && (
            <ListCell label={t('registrations.col.racerYears')} className="text-sm">
              {row.racer_years}
            </ListCell>
          )}
          {!registered && (
            <ListCell label={t(waitlist ? 'registrations.col.position' : 'registrations.col.progress')}>
              {waitlist ? (
                <span className="font-display font-semibold text-starText">#{row.waitlist_position}</span>
              ) : (
                <Progress percent={row.percent_complete} />
              )}
            </ListCell>
          )}
          {staff && (
            <>
              <ListCell label={t('registrations.col.payments')} className="text-sm">
                {row.staff && (
                  <>
                    <Badge tone={row.staff.payments_paid === row.staff.payments_total ? 'success' : 'warning'}>
                      {t('registrations.paid', { paid: row.staff.payments_paid, total: row.staff.payments_total })}
                    </Badge>
                    <div className="text-navy/70">{formatSince(row.staff.updated_at, timeZone)}</div>
                  </>
                )}
              </ListCell>
              <ListCell className="text-sm max-sm:empty:hidden">
                {row.staff?.new_team === true && <Badge>{t('registrations.newTeamTag')}</Badge>}
              </ListCell>
            </>
          )}
          {deletable && (
            <ListCell className="max-sm:empty:hidden sm:text-right">
              {row.deletable && (
                <Button
                  variant="ghost"
                  className="text-starText"
                  aria-label={t('registrations.deleteLabel', { name: row.name })}
                  onClick={() => onDelete(row)}
                >
                  {t('registrations.delete')}
                </Button>
              )}
            </ListCell>
          )}
        </ListRow>
      ))}
    </ListTable>
  );
}
