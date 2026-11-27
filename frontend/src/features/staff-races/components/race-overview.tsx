import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button-link';
import { InfoTip } from '@/components/ui/info-tip';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { formatDate, formatDeadline } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { t } from '@/locales/en';
import type { StaffRace, StaffRacePaymentRequirement } from '../api/types';
import { useStaffRace } from '../api/use-staff-races';
import { DeleteRace } from './delete-race';
import { StatusBadge } from './status-badge';

const STAFF_EMAIL = 'dogtag@chiditarod.org';
const link = 'font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

function OverviewCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id={titleId} className="font-display text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

/** Label and value rows; the grid track is `minmax(0,1fr)` so a long value wraps instead of widening the page. */
function Rows({ rows }: { rows: [label: string, value: ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(0,1fr)] gap-y-2 text-sm sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:gap-x-3">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[minmax(0,1fr)] sm:contents">
          <dt className="text-navy/70">{label}</dt>
          <dd className="font-semibold [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function questionCount(jsonform: string | null): number | null {
  if (!jsonform) return null;
  try {
    const properties = (JSON.parse(jsonform) as { schema?: { properties?: Record<string, unknown> } }).schema
      ?.properties;
    return properties ? Object.keys(properties).length : null;
  } catch {
    return null;
  }
}

function TeamsCard({ race }: { race: StaffRace }) {
  const { finalized, registering } = race.teams;
  return (
    <OverviewCard title={t('staff.race.teams')}>
      <p className="text-2xl font-bold">
        {race.max_teams === null
          ? t('staff.race.finalized', { n: finalized })
          : t('staff.race.finalizedOf', { n: finalized, max: race.max_teams })}
      </p>
      {registering > 0 && (
        <p className="text-sm text-navy/70">
          {race.full
            ? t('staff.race.onWaitlist', { n: registering })
            : t('staff.races.stillRegistering', { n: registering })}
        </p>
      )}
    </OverviewCard>
  );
}

function MoneyCard({ race }: { race: StaffRace }) {
  const { net_cents, gross_cents, refunded_cents } = race.money;
  return (
    <OverviewCard title={t('staff.race.money')}>
      <p className="text-2xl font-bold">{formatMoney(net_cents)}</p>
      <p className="text-sm text-navy/70">{t('staff.race.moneyCaption')}</p>
      <p className="text-sm">
        {t('staff.race.moneyDetail', { gross: formatMoney(gross_cents), refunded: formatMoney(refunded_cents) })}
      </p>
    </OverviewCard>
  );
}

function ExportCard({ race }: { race: StaffRace }) {
  const base = `/api/v1/staff/races/${race.id}/export.csv`;
  return (
    <OverviewCard
      title={t('staff.race.export')}
      action={<InfoTip label={t('staff.race.exportTip')}>{t('staff.race.exportTipText')}</InfoTip>}
    >
      <ul className="space-y-2 text-sm">
        <li>
          <a href={`${base}?finalized=true`} className={link}>
            {t('staff.race.exportRegistered')}
          </a>
        </li>
        <li>
          <a href={base} className={link}>
            {t('staff.race.exportAll')}
          </a>
        </li>
      </ul>
    </OverviewCard>
  );
}

function DatesCard({ race }: { race: StaffRace }) {
  const zone = race.time_zone;
  return (
    <OverviewCard title={t('staff.race.dates')}>
      <Rows
        rows={[
          [t('staff.race.date.registrationOpen'), formatDate(race.registration_open, zone)],
          [t('staff.race.date.registrationClose'), formatDeadline(race.registration_close, zone)],
          [t('staff.race.date.finalEditsClose'), formatDeadline(race.final_edits_close, zone)],
          [t('staff.race.date.raceDay'), formatDate(race.race_datetime, zone)],
        ]}
      />
    </OverviewCard>
  );
}

function FeeRow({ raceId, fee }: { raceId: number; fee: StaffRacePaymentRequirement }) {
  return (
    <li>
      <Link
        to={`/staff/races/${raceId}/requirements/${fee.id}`}
        className="block rounded-md border border-flag p-3 text-sm hover:bg-page focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
      >
        <span className="block font-semibold text-link [overflow-wrap:anywhere]">{fee.name}</span>
        <span className={`block ${fee.enabled ? 'text-navy/70' : 'font-semibold text-starText'}`}>
          {fee.enabled ? t('staff.race.feeEnabled') : t('staff.race.feeDisabled')}
        </span>
        <span className="block text-navy/70">
          {fee.current_price_cents === null ? t('staff.race.feeNoPrice') : formatMoney(fee.current_price_cents)}
          {' · '}
          {t(fee.tier_count === 1 ? 'staff.race.tiers_one' : 'staff.race.tiers_other', { n: fee.tier_count })}
        </span>
      </Link>
    </li>
  );
}

function FeesCard({ race }: { race: StaffRace }) {
  return (
    <OverviewCard
      title={t('staff.race.fees')}
      action={
        <Link to={`/staff/races/${race.id}/requirements/new`} className={`text-sm ${link}`}>
          {t('staff.race.addFee')}
        </Link>
      }
    >
      {race.payment_requirements.length === 0 ? (
        <p className="text-sm">{t('staff.race.noFees')}</p>
      ) : (
        <ul className="space-y-2">
          {race.payment_requirements.map((fee) => (
            <FeeRow key={fee.id} raceId={race.id} fee={fee} />
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function QuestionsCard({ race }: { race: StaffRace }) {
  const count = questionCount(race.jsonform);
  return (
    <OverviewCard title={t('staff.race.questions')}>
      <Rows
        rows={[
          [t('staff.race.racersPerTeam'), race.people_per_team ?? t('staff.race.notSet')],
          [t('staff.race.questionCount'), count ?? t('staff.race.none')],
          [t('staff.race.filterFields'), race.filter_field.length > 0 ? race.filter_field.join(', ') : t('staff.race.none')],
        ]}
      />
    </OverviewCard>
  );
}

function ExperienceCard({ race }: { race: StaffRace }) {
  const labels = race.experience_labels_text.split('\n').filter((label) => label.trim() !== '');
  return (
    <OverviewCard title={t('staff.race.experience')}>
      {labels.length === 0 ? (
        <p className="text-sm">{t('staff.race.none')}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {labels.map((label) => (
            <li key={label} className="[overflow-wrap:anywhere]">
              {label}
            </li>
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}

function FundraisingCard({ race }: { race: StaffRace }) {
  const notSet = t('staff.race.notSet');
  const length = race.confirmation_text?.length ?? 0;
  return (
    <OverviewCard title={t('staff.race.fundraising')}>
      <Rows
        rows={[
          [t('staff.race.classyCampaign'), race.classy_campaign_id ?? notSet],
          [t('staff.race.classyGoal'), race.classy_default_goal === null ? notSet : formatMoney(race.classy_default_goal * 100)],
          [t('staff.race.confirmationText'), length > 0 ? t('staff.race.confirmationSet', { n: length }) : notSet],
        ]}
      />
    </OverviewCard>
  );
}

/** `@` stays readable; `&`, `#`, `?`, `%` and `,` in an address must not end it or start another header. */
export function bccMailto(emails: string[]): string {
  const bcc = emails.map((email) => encodeURIComponent(email).replace(/%40/g, '@')).join(',');
  return `mailto:${STAFF_EMAIL}?bcc=${bcc}`;
}

/** A full race makes a mailto too long for many mail apps, so the plain list can be copied as well. */
function EmailRacers({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setCopied(true);
    } catch {
      // Clipboard blocked: the mailto link above still works.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <a href={bccMailto(emails)} className={link}>
        {t('staff.race.emailRacers')}
      </a>
      <Button variant="secondary" onClick={() => void copy()}>
        {t('staff.race.copyEmails')}
      </Button>
      <span role="status" className="text-sm font-semibold text-navy/70">
        {copied ? t('staff.race.copied') : ''}
      </span>
    </div>
  );
}

export function RaceOverview({ raceId }: { raceId: string | undefined }) {
  const { data, isPending, isError, refetch } = useStaffRace(raceId);

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  const { race } = data;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link to="/staff/races" className={`text-sm ${link}`}>
          {t('staff.race.back')}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl font-semibold [overflow-wrap:anywhere]">{race.name}</h1>
          <StatusBadge status={race.registration_status} />
        </div>
        <p className="text-sm text-navy/70">
          {t('staff.race.raceDay', { date: formatDate(race.race_datetime, race.time_zone), zone: race.time_zone })}
        </p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to={`/races/${race.id}/registrations`} variant="secondary">
            {t('staff.race.registered')}
          </ButtonLink>
          <ButtonLink to={`/races/${race.id}/teams/new`} variant="secondary">
            {t('staff.race.startTeam')}
          </ButtonLink>
          <ButtonLink to={`/staff/races/${race.id}/edit`}>{t('staff.race.edit')}</ButtonLink>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        <TeamsCard race={race} />
        <MoneyCard race={race} />
        <ExportCard race={race} />
        <DatesCard race={race} />
        <FeesCard race={race} />
        <QuestionsCard race={race} />
        <ExperienceCard race={race} />
        <FundraisingCard race={race} />
      </div>

      {race.racer_emails.length > 0 && <EmailRacers emails={race.racer_emails} />}
      <DeleteRace race={race} />
    </div>
  );
}
