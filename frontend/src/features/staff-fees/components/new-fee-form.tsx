import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ZonedDateTimeInput } from '@/components/inputs/zoned-datetime-input';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';
import { Card } from '@/components/ui/card';
import { DiscardDialog } from '@/components/ui/discard-dialog';
import { Field, Input } from '@/components/ui/field';
import { useLeaveGuard } from '@/components/ui/use-leave-guard';
import { ApiError, type FieldErrors } from '@/lib/api-client';
import { toWallClock } from '@/lib/zoned-time';
import { t } from '@/locales/en';
import { FEE_TYPE_LABELS, type FeeRace } from '../api/types';
import { useCreateFee } from '../api/use-staff-fees';
import { checkPrice, parseDollars, racersPayLine } from '../price-checks';

const link = 'text-sm font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link';
const select =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

const DEFAULT_TYPE = 'PaymentRequirement';
/** Server error keys with a field of their own on this form. */
const SHOWN_ERRORS = new Set(['name', 'type', 'tier.price', 'tier.begin_at']);

interface NewFeeFormProps {
  race: FeeRace;
  /** The requirement types the server lets a new fee use. */
  types: string[];
}

/** A new fee with its first price in one step; the price starts when registration opens. */
export function NewFeeForm({ race, types }: NewFeeFormProps) {
  const [initialBegin] = useState(() => toWallClock(race.registration_open, race.time_zone));
  const [name, setName] = useState('');
  const [type, setType] = useState(DEFAULT_TYPE);
  const [dollars, setDollars] = useState('');
  const [begin, setBegin] = useState(initialBegin);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const create = useCreateFee(race.id);
  const navigate = useNavigate();

  const dirty = name !== '' || type !== DEFAULT_TYPE || dollars !== '' || begin !== initialBegin;
  const { blocker, allowLeave } = useLeaveGuard(dirty);

  const checks = checkPrice({ price: dollars, begin }, [], race.time_zone);
  const nameProblem = name.trim() === '' ? t('staff.fees.nameBlank') : undefined;
  const cents = parseDollars(dollars);

  /** Editing a field answers the server's complaint about its old value. */
  function edited(...keys: string[]) {
    setServerErrors((current) => {
      if (!keys.some((key) => key in current)) return current;
      return Object.fromEntries(Object.entries(current).filter(([key]) => !keys.includes(key)));
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (nameProblem || Object.keys(checks.errors).length > 0 || cents === null) return;
    create.mutate(
      { requirement: { name: name.trim(), type }, tier: { price: cents, begin_at: begin } },
      {
        onSuccess: ({ requirement }) => {
          allowLeave();
          navigate(`/staff/races/${race.id}/requirements/${requirement.id}`);
        },
        onError: (error) => setServerErrors(error instanceof ApiError ? error.errors : {}),
      },
    );
  }

  const messages = (own: string | undefined, key: string): string[] => [
    ...(attempted && own ? [own] : []),
    ...(serverErrors[key] ?? []),
  ];
  const unlisted = Object.entries(serverErrors).filter(([key]) => !SHOWN_ERRORS.has(key));
  const failure = create.error;
  const failureText =
    failure instanceof ApiError ? failure.error || t('common.genericError') : failure ? t('common.genericError') : null;
  // A 422 whose messages are all under fields needs no extra line.
  const showFailure = create.isError && (unlisted.length > 0 || Object.keys(serverErrors).length === 0);
  const payLine = cents !== null && !checks.errors.begin_at ? racersPayLine(cents, begin, race.time_zone) : '';

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Link to={`/staff/races/${race.id}`} className={link}>
          {t('staff.fees.back', { name: race.name })}
        </Link>
        <h1 className="font-display text-2xl font-semibold">{t('staff.fees.newTitle')}</h1>
      </div>

      <Card className="min-w-0">
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label={t('staff.fees.nameCard')} name="name" help={t('staff.fees.nameHelp')} error={messages(nameProblem, 'name')}>
            <Input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                edited('name');
              }}
            />
          </Field>

          <Field
            label={t('staff.fees.type')}
            name="type"
            help={types.includes('MockPaymentRequirement') ? t('staff.fees.typeMockHelp') : undefined}
            error={serverErrors.type}
            className="sm:max-w-sm"
          >
            {(control) => (
              <select
                {...control}
                className={select}
                value={type}
                onChange={(event) => {
                  setType(event.target.value);
                  edited('type');
                }}
              >
                {types.map((option) => (
                  <option key={option} value={option}>
                    {FEE_TYPE_LABELS[option] ?? option}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
            <Field label={t('staff.fees.firstPrice')} name="price" error={messages(checks.errors.price, 'tier.price')}>
              {(control) => (
                <div className="flex items-center gap-1">
                  <span aria-hidden="true" className="text-navy/70">
                    {t('staff.fees.priceDollarsPrefix')}
                  </span>
                  <Input
                    {...control}
                    inputMode="numeric"
                    autoComplete="off"
                    value={dollars}
                    onChange={(event) => {
                      setDollars(event.target.value);
                      edited('tier.price');
                    }}
                  />
                </div>
              )}
            </Field>
            <div className="space-y-1">
              <Field label={t('staff.fees.starts')} name="begin_at" error={messages(checks.errors.begin_at, 'tier.begin_at')}>
                {(control) => (
                  <ZonedDateTimeInput
                    {...control}
                    value={begin}
                    timeZone={race.time_zone}
                    onValueChange={(wall) => {
                      setBegin(wall);
                      edited('tier.begin_at');
                    }}
                  />
                )}
              </Field>
              {payLine && <p className="text-sm text-navy/80">{payLine}</p>}
              {checks.warning && <p className="text-sm text-amber-900">{checks.warning}</p>}
            </div>
          </div>
          <p className="text-sm text-navy/80">{t('staff.fees.firstStartHelp')}</p>

          {showFailure && (
            <div role="alert" className="space-y-1 text-sm font-semibold text-starText">
              {Object.keys(serverErrors).length === 0 && <p>{failureText}</p>}
              {unlisted.map(([key, list]) => (
                <p key={key}>{key === 'base' ? list.join(', ') : `${key}: ${list.join(', ')}`}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ButtonLink to={`/staff/races/${race.id}`} variant="secondary">
              {t('staff.fees.cancelPrice')}
            </ButtonLink>
            <Button type="submit" loading={create.isPending}>
              {t('staff.fees.addFee')}
            </Button>
          </div>
        </form>
      </Card>

      {blocker.state === 'blocked' && (
        <DiscardDialog body={t('staff.fees.discardBody')} onKeep={() => blocker.reset()} onDiscard={() => blocker.proceed()} />
      )}
    </div>
  );
}
