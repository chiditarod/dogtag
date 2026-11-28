import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { DeleteTeamDialog } from '@/features/teams/components/delete-team';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { registrationsQueryKey, useRegistrations } from '../api/use-registrations';
import { useRegistrationFilters } from '../use-registration-filters';
import type { RegistrationRow, RegistrationsTab } from '../types';
import { activeAnswers, filterOptions, filterRows } from '../utils';
import { RegistrationFilters } from './registration-filters';
import { RegistrationTabs } from './registration-tabs';
import { RegistrationsList } from './registrations-list';
import { StaffEmailLinks } from './staff-email-links';

const NO_FIELDS: { key: string; label: string }[] = [];

function BackLink() {
  return (
    <Link to="/" className="text-sm font-semibold text-link hover:underline">
      ‹ {t('registrations.allRaces')}
    </Link>
  );
}

function RaceNotFound() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold">{t('registrations.raceNotFound')}</h1>
      <Link to="/" className="text-link underline">
        {t('registrations.allRaces')}
      </Link>
    </div>
  );
}

function emptyMessage(tab: RegistrationsTab, waitlist: boolean) {
  if (tab === 'registered') return t('registrations.emptyRegistered');
  return t(waitlist ? 'registrations.emptyWaitlist' : 'registrations.emptyRegistering');
}

/** Who's registered for a race: finalized teams, and teams still registering (or waiting). */
export function RegistrationsPage({ raceId }: { raceId: number }) {
  const queryClient = useQueryClient();
  const { data, isPending, error, refetch } = useRegistrations(raceId);
  const fields = data?.filter_fields ?? NO_FIELDS;
  const { tab, q, answers: urlAnswers, setTab, setQ, setAnswer, clearFilters } = useRegistrationFilters(fields);
  const [deleting, setDeleting] = useState<RegistrationRow | null>(null);

  // Options come from both tabs so the selects do not change when the tab does.
  const options = useMemo(() => {
    const rows = [...(data?.finalized ?? []), ...(data?.registering ?? [])];
    return Object.fromEntries(fields.map((field) => [field.key, filterOptions(rows, field.key)]));
  }, [data, fields]);
  const answers = useMemo(() => activeAnswers(urlAnswers, options), [urlAnswers, options]);

  const registered = useMemo(() => filterRows(data?.finalized ?? [], q, answers), [data, q, answers]);
  const registering = useMemo(() => filterRows(data?.registering ?? [], q, answers), [data, q, answers]);

  if (!Number.isInteger(raceId) || raceId <= 0) return <RaceNotFound />;
  if (isPending) return <QueryLoading />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) return <RaceNotFound />;
    return <QueryError onRetry={() => void refetch()} />;
  }

  const waitlist = data.registering_kind === 'waitlist';
  const shown = tab === 'registered' ? registered : registering;
  const unfilteredCount = (tab === 'registered' ? data.finalized : data.registering).length;
  const countKey = `registrations.teamCount_${shown.length === 1 ? 'one' : 'other'}` as const;
  const emailLists = data.emails && (tab === 'registered' ? data.emails.finalized : data.emails.registering);

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold">{t('registrations.heading')}</h1>
          <p className="text-navy/70 [overflow-wrap:anywhere]">
            {t('registrations.subtitle', {
              race: data.race.name,
              taken: data.race.finalized_count,
              max: data.race.max_teams,
            })}
          </p>
        </div>
        {data.emails && emailLists && <StaffEmailLinks to={data.emails.to} lists={emailLists} />}
      </div>
      <RegistrationFilters
        q={q}
        onSearch={setQ}
        onClear={clearFilters}
        countMessage={t(countKey, { n: shown.length })}
        fields={data.filter_fields}
        options={options}
        answers={answers}
        onAnswer={setAnswer}
      />
      <RegistrationTabs
        tab={tab}
        onChange={setTab}
        counts={{ registered: registered.length, registering: registering.length }}
        kind={data.registering_kind}
      >
        {shown.length === 0 ? (
          <p className="py-4 text-navy/70">
            {unfilteredCount === 0 ? emptyMessage(tab, waitlist) : t('registrations.noMatches')}
          </p>
        ) : (
          <RegistrationsList
            rows={shown}
            tab={tab}
            kind={data.registering_kind}
            fields={data.filter_fields}
            staff={data.viewer.staff}
            timeZone={data.race.time_zone}
            onDelete={setDeleting}
          />
        )}
      </RegistrationTabs>
      {deleting && (
        <DeleteTeamDialog
          teamId={deleting.id}
          teamName={deleting.name}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            void queryClient.invalidateQueries({ queryKey: registrationsQueryKey(raceId) });
          }}
        />
      )}
    </div>
  );
}
