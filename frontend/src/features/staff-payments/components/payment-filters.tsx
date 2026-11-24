import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { t } from '@/locales/en';
import type { PaymentFilterValues, PaymentsFilterOptions } from '../types';
import { raceNotFound, raceStatusLabel } from '../utils';

const SEARCH_DEBOUNCE_MS = 300;

const control =
  'min-h-11 w-full rounded-md border border-flag bg-white px-3 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-60';

type SetFilter = <K extends keyof PaymentFilterValues>(key: K, value: PaymentFilterValues[K]) => void;

interface FilterProps {
  values: PaymentFilterValues;
  options: PaymentsFilterOptions | undefined;
  setFilter: SetFilter;
}

function raceValue(values: PaymentFilterValues, options: PaymentsFilterOptions | undefined) {
  return String(values.raceId ?? options?.race_id ?? 'all');
}

/** Race, payment type and status. Shown inline from `sm` and in the sheet below it. */
function FilterControls({ values, options, setFilter, idPrefix }: FilterProps & { idPrefix: string }) {
  const statusName = `${idPrefix}-status`;
  const statuses = [
    ['all', t('staff.payments.filters.statusAll')],
    ['paid', t('staff.payments.filters.statusPaid')],
    ['refunded', t('staff.payments.filters.statusRefunded')],
  ] as const;
  const noType = !options || options.payment_types.length === 0;
  return (
    <>
      <div className="min-w-0 sm:w-56">
        <label htmlFor={`${idPrefix}-race`} className="mb-1 block text-sm font-semibold text-navy">
          {t('staff.payments.filters.race')}
        </label>
        <select
          id={`${idPrefix}-race`}
          className={control}
          value={raceValue(values, options)}
          onChange={(event) =>
            setFilter('raceId', event.target.value === 'all' ? 'all' : Number(event.target.value))
          }
        >
          {raceNotFound(values, options) && (
            <option value={values.raceId}>{t('staff.payments.filters.raceNotFound')}</option>
          )}
          <option value="all">{t('staff.payments.filters.allRaces')}</option>
          {options?.races.map((race) => (
            <option key={race.id} value={race.id}>
              {`${race.name} (${raceStatusLabel(race.registration_status)})`}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 sm:w-48">
        <label htmlFor={`${idPrefix}-type`} className="mb-1 block text-sm font-semibold text-navy">
          {t('staff.payments.filters.type')}
        </label>
        <select
          id={`${idPrefix}-type`}
          className={control}
          disabled={noType}
          value={values.paymentType ?? ''}
          onChange={(event) =>
            setFilter('paymentType', event.target.value ? Number(event.target.value) : undefined)
          }
        >
          <option value="">{t('staff.payments.filters.allTypes')}</option>
          {options?.payment_types.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-semibold text-navy">
          {t('staff.payments.filters.status')}
        </legend>
        <div className="flex overflow-hidden rounded-md border border-flag">
          {statuses.map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-11 flex-1 cursor-pointer items-center justify-center bg-white px-3 text-sm font-semibold text-navy has-[:checked]:bg-flag/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-link"
            >
              <input
                type="radio"
                name={statusName}
                className="sr-only"
                checked={values.status === value}
                onChange={() => setFilter('status', value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** A search box that waits for a pause in typing before it changes the URL. */
function SearchBox({ values, setFilter }: Pick<FilterProps, 'values' | 'setFilter'>) {
  const [text, setText] = useState(values.q);
  const sent = useRef(values.q);
  const id = useId();

  useEffect(() => {
    // The URL changed from outside (Clear all, a chip): follow it.
    if (values.q !== sent.current) {
      sent.current = values.q;
      setText(values.q);
    }
  }, [values.q]);

  useEffect(() => {
    // Only the trimmed text goes to the URL, so spaces alone send nothing and the box keeps what was typed.
    const next = text.trim();
    if (next === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = next;
      setFilter('q', next);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text, setFilter]);

  return (
    <div className="min-w-0 flex-1 sm:basis-full lg:min-w-48 lg:basis-0">
      <label htmlFor={id} className="sr-only">
        {t('staff.payments.filters.search')}
      </label>
      <input
        id={id}
        type="search"
        className={control}
        placeholder={t('staff.payments.filters.searchPlaceholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  );
}

/** Announces the number of matching payments once a response settles; empty while one loads. */
function ResultCount({ count }: { count: number | undefined }) {
  return (
    <p role="status" className="sr-only">
      {count === undefined ? '' : t(`staff.payments.count_${count === 1 ? 'one' : 'other'}`, { n: count })}
    </p>
  );
}

function showLabel(count: number | undefined) {
  if (count === undefined) return t('staff.payments.filters.showPending');
  return t(`staff.payments.filters.show_${count === 1 ? 'one' : 'other'}`, { n: count });
}

/**
 * `totalCount` is undefined until the response for the current filters settles, so neither the sheet
 * button nor the live count shows a number from the previous filters.
 */
export function PaymentFilters({
  values,
  options,
  setFilter,
  totalCount,
  onClearAll,
  canClear,
  searchReset,
}: FilterProps & {
  totalCount: number | undefined;
  onClearAll: () => void;
  canClear: boolean;
  /** Changes on Clear all: the search box remounts, which cancels a pending debounce and empties it. */
  searchReset: number;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();

  return (
    <div className="space-y-3">
      {/* The open sheet is modal, so the live count moves into it. */}
      {!sheetOpen && <ResultCount count={totalCount} />}
      {/* Search has its own row until lg, and the inline controls wrap, so nothing overflows just above sm. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SearchBox key={searchReset} values={values} setFilter={setFilter} />
        <div className="hidden min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <FilterControls values={values} options={options} setFilter={setFilter} idPrefix="inline" />
        </div>
        <Button variant="secondary" className="sm:hidden" onClick={() => setSheetOpen(true)}>
          {t('staff.payments.filters.open')}
        </Button>
      </div>
      {sheetOpen && (
        <DialogSheet labelledBy={titleId} onClose={() => setSheetOpen(false)}>
          <div className="flex items-center justify-between border-b border-flag px-4 py-3">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {t('staff.payments.filters.sheetTitle')}
            </h2>
          </div>
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <FilterControls values={values} options={options} setFilter={setFilter} idPrefix="sheet" />
          </div>
          <div className="flex flex-col gap-2 border-t border-flag px-4 py-3">
            <ResultCount count={totalCount} />
            <Button onClick={() => setSheetOpen(false)}>{showLabel(totalCount)}</Button>
            {canClear && (
              <Button variant="ghost" onClick={onClearAll}>
                {t('staff.payments.filters.clearAll')}
              </Button>
            )}
          </div>
        </DialogSheet>
      )}
    </div>
  );
}
