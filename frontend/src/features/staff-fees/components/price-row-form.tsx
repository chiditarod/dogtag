import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { ZonedDateTimeInput } from '@/components/inputs/zoned-datetime-input';
import { ApiError } from '@/lib/api-client';
import { fromWallClock, toWallClock } from '@/lib/zoned-time';
import { t } from '@/locales/en';
import type { FeeRace, FeeTier, TierPayload } from '../api/types';
import { checkPrice, firstPriceGap, parseDollars, type PriceChecks, racersPayLine } from '../price-checks';

export interface PriceRowFormProps {
  /** The price being edited; leave out to add one. */
  initial?: FeeTier;
  /** The fee's other prices (without `initial`), which the new values must not repeat. */
  others: FeeTier[];
  race: FeeRace;
  /** Saves the changes. Reject with an `ApiError` to show its messages; resolve to close the form. */
  onSave: (payload: TierPayload) => Promise<unknown>;
  onCancel: () => void;
  /** Whether the dollars or the start differ from `initial` (an empty add form is clean). */
  onDirtyChange: (dirty: boolean) => void;
}

type Field = 'price' | 'begin_at';

/** The cell classes shared with the table rows: a table cell from `sm`, a stacked block below it. */
const cell = 'px-3 py-2 sm:table-cell sm:align-top';
const label = 'mb-1 block text-sm font-semibold text-navy sm:sr-only';

function Messages({ id, messages }: { id: string; messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul id={id} className="mt-1 space-y-0.5 text-sm text-starText">
      {messages.map((message) => (
        <li key={message}>{message}</li>
      ))}
    </ul>
  );
}

/**
 * One row of the prices table as a form: dollars and a start in the race zone. Its cells are laid
 * out by the row around it (`display: contents`), so they line up with the other rows' columns.
 * It sends `price` only when the dollars changed and `begin_at` only when the wall clock changed.
 */
export function PriceRowForm({ initial, others, race, onSave, onCancel, onDirtyChange }: PriceRowFormProps) {
  const ids = useId();
  const initialWall = initial ? toWallClock(initial.begin_at, race.time_zone) : '';
  const [dollars, setDollars] = useState(initial ? String(initial.price_cents / 100) : '');
  const [begin, setBegin] = useState(initialWall);
  const [touched, setTouched] = useState<Record<Field, boolean>>({ price: false, begin_at: false });
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<ApiError | Error | null>(null);

  // The price as shown ("50.5", "0") counts as unchanged even where `parseDollars` would refuse it.
  const priceChanged = initial
    ? parseDollars(dollars) !== initial.price_cents && dollars.trim() !== String(initial.price_cents / 100)
    : dollars.trim() !== '';
  const beginChanged = begin !== initialWall;
  const dirty = priceChanged || beginChanged;

  // The page's leave guard reads this; a form that closes (saved or cancelled) is clean again.
  const report = useRef(onDirtyChange);
  report.current = onDirtyChange;
  useEffect(() => {
    report.current(dirty);
  }, [dirty]);
  useEffect(() => () => report.current(false), []);

  // An edit that leaves the price alone is not held to the whole-dollar rule (a legacy tier may be
  // at odd cents or $0), and a start it did not touch is not warned about being in the past.
  const priceUntouched = Boolean(initial) && !priceChanged;
  const checked = checkPrice({ price: dollars, begin }, others, race.time_zone);
  const errors = { ...checked.errors };
  if (priceUntouched) delete errors.price;
  const checks: PriceChecks = { errors, warning: !initial || beginChanged ? checked.warning : undefined };
  const apiErrors = serverError instanceof ApiError ? serverError.errors : {};
  const shown = (field: Field): string[] => [
    ...(touched[field] && checks.errors[field] ? [checks.errors[field]] : []),
    ...(apiErrors[field] ?? []),
  ];
  const priceMessages = shown('price');
  const beginMessages = shown('begin_at');
  const hasFieldErrors = Object.keys(apiErrors).some((key) => key === 'price' || key === 'begin_at');
  const failure =
    serverError && !hasFieldErrors
      ? serverError instanceof ApiError && serverError.error
        ? serverError.error
        : t('common.genericError')
      : null;

  // The prices as they would be after the save, for the registration-opening gap.
  const draftStart = fromWallClock(begin, race.time_zone) ?? initial?.begin_at ?? null;
  const gap = firstPriceGap([...others.map((other) => other.begin_at), draftStart], race.registration_open, race.time_zone);
  const cents = priceUntouched && initial ? initial.price_cents : parseDollars(dollars);
  const valid = Object.keys(checks.errors).length === 0 && cents !== null;

  /** Typing clears the server's message, which was about the old value. */
  function edited(change: () => void) {
    change();
    if (serverError) setServerError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({ price: true, begin_at: true });
    if (Object.keys(checks.errors).length > 0 || cents === null) return;
    // An edit sends only what changed; an add sends both.
    const payload: TierPayload = {
      ...(!initial || priceChanged ? { price: cents } : {}),
      ...(!initial || beginChanged ? { begin_at: begin } : {}),
    };
    setPending(true);
    setServerError(null);
    try {
      await onSave(payload);
    } catch (error) {
      setServerError(error instanceof Error ? error : new Error(String(error)));
      setPending(false);
    }
  }

  const priceId = `${ids}-price`;
  const beginId = `${ids}-begin`;
  const priceErrorId = `${ids}-price-error`;
  const beginErrorId = `${ids}-begin-error`;
  const payLine: ReactNode =
    valid && cents !== null ? <p className="mt-1 text-sm text-navy/80">{racersPayLine(cents, begin, race.time_zone)}</p> : null;

  return (
    <form onSubmit={submit} noValidate className="contents">
      <div role="cell" className={cell}>
        <label htmlFor={priceId} className={label}>
          {t('staff.fees.price')}
        </label>
        <div className="flex items-center gap-1 sm:max-w-36">
          <span aria-hidden="true" className="text-navy/70">
            {t('staff.fees.priceDollarsPrefix')}
          </span>
          <Input
            id={priceId}
            name="price"
            inputMode="numeric"
            autoComplete="off"
            value={dollars}
            aria-invalid={priceMessages.length > 0 ? true : undefined}
            aria-describedby={priceMessages.length > 0 ? priceErrorId : undefined}
            onChange={(event) => edited(() => setDollars(event.target.value))}
            onBlur={() => setTouched((current) => ({ ...current, price: true }))}
          />
        </div>
        <Messages id={priceErrorId} messages={priceMessages} />
      </div>
      <div role="cell" className={cell}>
        <label htmlFor={beginId} className={label}>
          {t('staff.fees.starts')}
        </label>
        <ZonedDateTimeInput
          id={beginId}
          name="begin_at"
          value={begin}
          timeZone={race.time_zone}
          aria-invalid={beginMessages.length > 0 ? true : undefined}
          aria-describedby={beginMessages.length > 0 ? beginErrorId : undefined}
          onValueChange={(wall) => edited(() => setBegin(wall))}
          onBlur={() => setTouched((current) => ({ ...current, begin_at: true }))}
        />
        <Messages id={beginErrorId} messages={beginMessages} />
        {payLine}
        {checks.warning && <p className="mt-1 text-sm text-amber-900">{checks.warning}</p>}
        {gap && (
          <p role="note" className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {gap}
          </p>
        )}
        {failure && (
          <p role="alert" className="mt-2 text-sm font-semibold text-starText">
            {failure}
          </p>
        )}
      </div>
      <div role="cell" className="hidden px-3 py-2 sm:table-cell" />
      <div role="cell" className={`${cell} sm:whitespace-nowrap sm:text-right`}>
        {/* Stacked until `lg`: side by side they push the table past the card at 640px. */}
        <div className="flex flex-col-reverse gap-2 lg:flex-row lg:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onCancel}>
            {t('staff.fees.cancelPrice')}
          </Button>
          <Button type="submit" loading={pending}>
            {initial ? t('staff.fees.savePrice') : t('staff.fees.addPrice')}
          </Button>
        </div>
      </div>
    </form>
  );
}
