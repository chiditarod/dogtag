import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { DiscardDialog } from '@/components/ui/discard-dialog';
import { Field, Input } from '@/components/ui/field';
import { useLeaveGuard } from '@/components/ui/use-leave-guard';
import { ApiError, type FieldErrors } from '@/lib/api-client';
import { t } from '@/locales/en';
import { useCreateRace, useUpdateRace } from '../api/use-staff-races';
import { buildRacePayload, type RaceFormValues } from '../build-race-payload';
import { DATE_FIELDS, type DateField } from '../date-checks';
import { checkRaceForm } from '../race-form-checks';
import { ConfirmationTextCard } from './confirmation-text-card';
import { JsonformEditor } from './jsonform-editor';
import { RaceDatesCard } from './race-dates-card';

interface RaceFormProps {
  /** The values the form opens with; also what "unsaved changes" is measured against. */
  initial: RaceFormValues;
  /** Present when editing a saved race; absent for a new one. */
  raceId?: number;
  raceName?: string;
  timeZones: string[];
  confirmationMaxLength: number;
  /** For tests. */
  now?: Date;
}

const link = 'font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';
const textarea =
  'block w-full min-w-0 rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

/** Server errors that have a field on this page; anything else is listed in the Save bar. */
const SHOWN_ERRORS = new Set<string>([
  'name',
  'time_zone',
  'max_teams',
  'people_per_team',
  'jsonform',
  'filter_field',
  'experience_labels_text',
  'classy_campaign_id',
  'classy_default_goal',
  'confirmation_text',
  ...DATE_FIELDS,
]);

function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId} className="min-w-0 space-y-4">
      <h2 id={titleId} className="font-display text-lg font-medium">
        {title}
      </h2>
      {children}
    </Card>
  );
}

const listed = (...messages: (string | undefined)[]) => messages.filter((m): m is string => !!m);

export function RaceForm({ initial: initialProp, raceId, raceName, timeZones, confirmationMaxLength, now }: RaceFormProps) {
  const isNew = raceId === undefined;
  const [initial] = useState(initialProp);
  const [values, setValues] = useState(initial);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [saved, setSaved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const navigate = useNavigate();
  const create = useCreateRace();
  const update = useUpdateRace(raceId ?? '');
  const mutation = isNew ? create : update;

  const dirty = !saved && JSON.stringify(values) !== JSON.stringify(initial);
  const { blocker, allowLeave } = useLeaveGuard(dirty);
  const checks = checkRaceForm(values, confirmationMaxLength, now);
  const shown = (message: string | undefined) => (attempted ? message : undefined);

  // After a failed save, scroll to and focus the first field showing a problem (in page order).
  useEffect(() => {
    if (focusRequest === 0) return;
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (!field) return;
    field.scrollIntoView?.({ block: 'center' });
    field.focus({ preventScroll: true });
  }, [focusRequest]);

  function set<K extends keyof RaceFormValues>(key: K, value: RaceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // A server complaint was about the value that was sent; editing it answers it.
    setServerErrors((current) => {
      if (!(key in current)) return current;
      const { [key]: _answered, ...rest } = current;
      return rest;
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (checks.blocked) {
      setFocusRequest((n) => n + 1);
      return;
    }
    mutation.mutate(buildRacePayload(initial, values, isNew), {
      onSuccess: ({ race }) => {
        allowLeave();
        setSaved(true);
        navigate(`/staff/races/${race.id}`);
      },
      onError: (error) => {
        if (error instanceof ApiError) setServerErrors(error.errors);
        setFocusRequest((n) => n + 1);
      },
    });
  }

  const error = (key: string) => serverErrors[key] ?? [];
  const unlisted = Object.entries(serverErrors).filter(([key]) => !SHOWN_ERRORS.has(key));
  const failure = mutation.error;
  const failureText =
    failure instanceof ApiError && failure.status === 422 && Object.keys(failure.errors).length > 0 && unlisted.length === 0
      ? t('staff.races.form.fixErrors')
      : failure instanceof ApiError
        ? failure.error || t('common.genericError')
        : t('common.genericError');
  const cancelTo = isNew ? '/staff/races' : `/staff/races/${raceId}`;

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-2">
        <Link to={cancelTo} className={`text-sm ${link}`}>
          {isNew ? t('staff.race.back') : t('staff.races.form.backToRace', { name: raceName ?? '' })}
        </Link>
        <h1 className="font-display text-2xl font-semibold">
          {isNew ? t('staff.races.form.newHeading') : t('staff.races.form.editHeading')}
        </h1>
      </div>

      <Section title={t('staff.races.form.basics')}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Field
            label={t('staff.races.form.name')}
            name="name"
            error={listed(shown(checks.fields.name), ...error('name'))}
          >
            <Input type="text" value={values.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field
            label={t('staff.races.form.maxTeams')}
            name="max_teams"
            error={listed(shown(checks.fields.max_teams), ...error('max_teams'))}
          >
            <Input
              type="text"
              inputMode="numeric"
              value={values.max_teams}
              onChange={(e) => set('max_teams', e.target.value)}
            />
          </Field>
          <Field
            label={t('staff.races.form.peoplePerTeam')}
            name="people_per_team"
            error={listed(shown(checks.fields.people_per_team), ...error('people_per_team'))}
          >
            <Input
              type="text"
              inputMode="numeric"
              value={values.people_per_team}
              onChange={(e) => set('people_per_team', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <RaceDatesCard
        timeZone={values.time_zone}
        // A new race has no saved zone to have changed from.
        initialTimeZone={isNew ? '' : initial.time_zone}
        timeZones={timeZones}
        values={Object.fromEntries(DATE_FIELDS.map((field) => [field, values[field]])) as Record<DateField, string>}
        onChange={(field, wall) => set(field, wall)}
        onTimeZoneChange={(zone) => set('time_zone', zone)}
        serverErrors={{
          ...serverErrors,
          time_zone: listed(shown(checks.fields.time_zone), ...error('time_zone')),
        }}
        showAllErrors={attempted}
        now={now}
      />

      <Section title={t('staff.races.form.questions')}>
        <JsonformEditor
          value={values.jsonform}
          onChange={(text) => set('jsonform', text)}
          filterField={values.filter_field}
          onFilterFieldChange={(keys) => set('filter_field', keys)}
          error={[...error('jsonform'), ...error('filter_field')]}
        />
      </Section>

      <Section title={t('staff.races.form.experience')}>
        <Field
          label={t('staff.races.form.experienceLabel')}
          name="experience_labels_text"
          help={t('staff.races.form.experienceHelp')}
          error={error('experience_labels_text')}
        >
          {(control) => (
            <textarea
              {...control}
              className={textarea}
              rows={6}
              value={values.experience_labels_text}
              onChange={(e) => set('experience_labels_text', e.target.value)}
            />
          )}
        </Field>
      </Section>

      <Section title={t('staff.races.form.fundraising')}>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
          <Field
            label={t('staff.races.form.campaign')}
            name="classy_campaign_id"
            error={listed(shown(checks.fields.classy_campaign_id), ...error('classy_campaign_id'))}
          >
            <Input
              type="text"
              inputMode="numeric"
              value={values.classy_campaign_id}
              onChange={(e) => set('classy_campaign_id', e.target.value)}
            />
          </Field>
          <Field
            label={t('staff.races.form.goal')}
            name="classy_default_goal"
            error={listed(shown(checks.fields.classy_default_goal), ...error('classy_default_goal'))}
          >
            <Input
              type="text"
              inputMode="numeric"
              value={values.classy_default_goal}
              onChange={(e) => set('classy_default_goal', e.target.value)}
            />
          </Field>
        </div>
      </Section>

      <Section title={t('staff.races.form.confirmation')}>
        <ConfirmationTextCard
          value={values.confirmation_text}
          onChange={(text) => set('confirmation_text', text)}
          maxLength={confirmationMaxLength}
          error={error('confirmation_text')}
        />
      </Section>

      <div className="sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-flag bg-white px-4 py-3">
        {mutation.isError && (
          <div role="alert" className="space-y-1 text-sm font-semibold text-starText">
            <p>{failureText}</p>
            {unlisted.map(([key, messages]) => (
              <p key={key}>{`${key}: ${messages.join(', ')}`}</p>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span role="status" className="text-sm font-semibold text-navy/70">
            {dirty ? t('staff.races.form.unsaved') : ''}
          </span>
          <span className="flex flex-wrap gap-2">
            <ButtonLink to={cancelTo} variant="secondary">
              {t('staff.races.form.cancel')}
            </ButtonLink>
            <Button type="submit" loading={mutation.isPending} disabled={!isNew && !dirty}>
              {isNew ? t('staff.races.form.create') : t('staff.races.form.save')}
            </Button>
          </span>
        </div>
      </div>
      {blocker.state === 'blocked' && (
        <DiscardDialog
          body={t('staff.races.form.discardBody')}
          onKeep={() => blocker.reset()}
          onDiscard={() => blocker.proceed()}
        />
      )}
    </form>
  );
}
