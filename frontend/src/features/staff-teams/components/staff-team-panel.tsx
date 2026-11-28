import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { QueryError } from '@/components/ui/query-state';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';
import type { StaffTeam, StaffTeamPerson } from '../types';
import { newTeamLabel } from '../utils';
import { NewTeamSelect } from './new-team-select';

const linkClass =
  'text-link underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';
const longText = '[overflow-wrap:anywhere]';

const fullName = ({ first_name, last_name }: StaffTeamPerson) => `${first_name} ${last_name}`.trim();

function Row({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b border-flag/40 py-1.5 last:border-b-0">
      <dt className="font-semibold">{label}</dt>
      <dd className={`min-w-0 grow basis-40 ${wide ? 'basis-full' : ''} ${longText}`}>{children}</dd>
    </div>
  );
}

function Contact({ person }: { person: StaffTeamPerson }) {
  return (
    <>
      <span className="font-semibold">{fullName(person)}</span>
      <br />
      <a href={`mailto:${person.email}`} className={linkClass}>
        {person.email}
      </a>
      {person.phone && (
        <>
          {' · '}
          <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} className={linkClass}>
            {person.phone}
          </a>
        </>
      )}
    </>
  );
}

function collaboratingText(value: boolean | null): string {
  if (value === null) return t('staff.team.notAnswered');
  return t(value ? 'staff.team.newTeamYes' : 'staff.team.newTeamNo');
}

function Details({ team, staffTeam }: { team: Team; staffTeam: StaffTeam }) {
  const { can, account_holder, captain } = staffTeam;
  const linkItem = 'inline-flex min-h-11 items-center';
  return (
    <>
      <dl className="mt-2 text-sm">
        <Row label={t('staff.team.teamNumber')}>
          {staffTeam.team_number ?? t('staff.team.teamNumberNone')}
        </Row>
        <Row label={t('staff.team.newTeam')} wide={can.set_new_team}>
          {can.set_new_team ? <NewTeamSelect staffTeam={staffTeam} /> : newTeamLabel(staffTeam)}
        </Row>
        <Row label={t('staff.team.collaborating')}>{collaboratingText(staffTeam.collaborating)}</Row>
        <Row label={t('staff.team.racingWith')}>
          {staffTeam.racing_with.length > 0 ? staffTeam.racing_with.join('; ') : t('staff.team.none')}
        </Row>
        <Row label={t('staff.team.captain')}>
          {captain ? <Contact person={captain} /> : t('staff.team.noCaptain')}
        </Row>
        <Row label={t('staff.team.accountHolder')}>
          {account_holder ? (
            <>
              <Link to={`/staff/users/${account_holder.id}`} className={`${linkClass} font-semibold`}>
                {fullName(account_holder)}
              </Link>
              <br />
              <a href={`mailto:${account_holder.email}`} className={linkClass}>
                {account_holder.email}
              </a>
            </>
          ) : (
            t('staff.team.noAccountHolder')
          )}
        </Row>
      </dl>
      <ul className="mt-2 flex flex-wrap gap-x-4 border-t border-flag/40 pt-1 text-sm">
        <li className={linkItem}>
          {can.view_emails ? (
            <Link to={`/staff/emails?team_id=${team.id}`} className={linkClass}>
              {t('staff.team.emails', { n: staffTeam.sent_emails_count })}
            </Link>
          ) : (
            <span>{t('staff.team.emails', { n: staffTeam.sent_emails_count })}</span>
          )}
        </li>
        {can.view_payments && (
          <li className={linkItem}>
            <Link to={`/staff/payments?race_id=${team.race.id}&team_id=${team.id}`} className={linkClass}>
              {t('staff.team.payments')}
            </Link>
          </li>
        )}
        <li className={linkItem}>
          <Link to={`/races/${team.race.id}/registrations`} className={linkClass}>
            {t('staff.team.registered')}
          </Link>
        </li>
      </ul>
    </>
  );
}

function summaryLine({ captain, can, sent_emails_count }: StaffTeam): string {
  return [
    captain ? t('staff.team.summaryCaptain', { name: fullName(captain) }) : t('staff.team.noCaptain'),
    can.view_emails && t('staff.team.emails', { n: sent_emails_count }),
    can.view_payments && t('staff.team.payments'),
  ]
    .filter(Boolean)
    .join(' · ');
}

interface StaffTeamPanelProps {
  team: Team;
  /** Undefined until `GET /staff/teams/:id` answers. */
  staffTeam: StaffTeam | undefined;
  query: { isError: boolean; refetch: () => unknown };
}

/**
 * The Staff card under the team header: who the team is to the organizers, the new-team flag and
 * links to the staff pages for this team. Every staff role sees it; `staffTeam.can` decides what
 * is editable and linked. Below `lg` it starts collapsed behind a one-line summary.
 */
export function StaffTeamPanel({ team, staffTeam, query }: StaffTeamPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  let content: ReactNode;
  if (staffTeam) {
    content = (
      <>
        <h2 className="hidden items-center justify-between gap-2 font-display text-lg font-medium lg:flex">
          {t('staff.team.heading')}
          <Badge className="bg-navy text-white">{t('staff.team.badge')}</Badge>
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left font-display text-base font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-link lg:hidden"
        >
          <span>
            <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
            {t('staff.team.details')}
          </span>
          <Badge className="bg-navy text-white">{t('staff.team.badge')}</Badge>
        </button>
        {!open && (
          <p className={`text-sm text-navy/70 lg:hidden ${longText}`}>{summaryLine(staffTeam)}</p>
        )}
        <div id={bodyId} className={open ? '' : 'hidden lg:block'}>
          <Details team={team} staffTeam={staffTeam} />
        </div>
      </>
    );
  } else if (query.isError) {
    content = <QueryError onRetry={() => void query.refetch()} />;
  } else {
    content = (
      <p role="status" className="text-sm">
        {t('staff.team.loading')}
      </p>
    );
  }
  return (
    <section
      aria-label={t('staff.team.heading')}
      className="mt-4 rounded-lg border-2 border-navy bg-white p-3"
    >
      {content}
    </section>
  );
}
