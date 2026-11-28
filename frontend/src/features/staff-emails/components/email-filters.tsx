import { useId, useState } from 'react';
import { ResultCount } from '@/components/list/result-count';
import { SearchBox } from '@/components/list/search-box';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { t } from '@/locales/en';
import type { EmailFilterValues, EmailStatusFilter } from '../api/types';
import { kindLabel } from '../kinds';

const control =
  'min-h-11 w-full rounded-md border border-flag bg-white px-3 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

const STATUSES: EmailStatusFilter[] = ['any', 'sent', 'queued', 'failed'];

type SetFilter = <K extends keyof EmailFilterValues>(key: K, value: EmailFilterValues[K]) => void;

interface SelectProps {
  values: EmailFilterValues;
  kinds: string[];
  setFilter: SetFilter;
}

/** Status and kind. Shown inline from `sm` and in the sheet below it. */
function FilterSelects({ values, kinds, setFilter, idPrefix }: SelectProps & { idPrefix: string }) {
  // A kind in the URL that the server does not list still shows, so the select never claims "Any" while filtering.
  const kindOptions = values.kind && !kinds.includes(values.kind) ? [...kinds, values.kind] : kinds;
  return (
    <>
      <div className="min-w-0 sm:w-40">
        <label htmlFor={`${idPrefix}-status`} className="mb-1 block text-sm font-semibold text-navy">
          {t('staff.emails.filters.status')}
        </label>
        <select
          id={`${idPrefix}-status`}
          className={control}
          value={values.status}
          onChange={(event) => setFilter('status', event.target.value as EmailStatusFilter)}
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`staff.emails.filters.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-0 sm:w-56">
        <label htmlFor={`${idPrefix}-kind`} className="mb-1 block text-sm font-semibold text-navy">
          {t('staff.emails.filters.kind')}
        </label>
        <select
          id={`${idPrefix}-kind`}
          className={control}
          value={values.kind ?? ''}
          onChange={(event) => setFilter('kind', event.target.value || undefined)}
        >
          <option value="">{t('staff.emails.filters.any')}</option>
          {kindOptions.map((kind) => (
            <option key={kind} value={kind}>
              {kindLabel(kind)}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

interface EmailFiltersProps extends SelectProps {
  /** The live-region sentence; undefined (so empty) while a response loads. */
  countMessage: string | undefined;
  /** Whether any filter is set, so the sheet offers Clear all. */
  canClear: boolean;
  onClearAll: () => void;
}

/** Recipient search always; the status and kind selects inline from `sm`, behind `Filters (n)` below it. */
export function EmailFilters({ values, kinds, setFilter, countMessage, canClear, onClearAll }: EmailFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();
  // The team and user filters are chips only, so the sheet button counts just what the sheet holds.
  const active = (values.status !== 'any' ? 1 : 0) + (values.kind ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* The open sheet is modal, so the live count moves into it. */}
      {!sheetOpen && <ResultCount message={countMessage} />}
      <div className="flex gap-3 sm:flex-wrap sm:items-end">
        <SearchBox
          value={values.recipient}
          onSearch={(recipient) => setFilter('recipient', recipient)}
          label={t('staff.emails.filters.recipient')}
          placeholder={t('staff.emails.filters.recipient')}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        <div className="hidden min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <FilterSelects values={values} kinds={kinds} setFilter={setFilter} idPrefix="inline" />
        </div>
        <Button variant="secondary" className="shrink-0 sm:hidden" onClick={() => setSheetOpen(true)}>
          {active > 0 ? t('staff.emails.filters.openCount', { n: active }) : t('staff.emails.filters.open')}
        </Button>
      </div>
      {sheetOpen && (
        <DialogSheet labelledBy={titleId} onClose={() => setSheetOpen(false)}>
          <div className="flex items-center justify-between border-b border-flag px-4 py-3">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {t('staff.emails.filters.sheetTitle')}
            </h2>
          </div>
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <FilterSelects values={values} kinds={kinds} setFilter={setFilter} idPrefix="sheet" />
          </div>
          <div className="flex flex-col gap-2 border-t border-flag px-4 py-3">
            <ResultCount message={countMessage} />
            <Button onClick={() => setSheetOpen(false)}>{t('staff.emails.filters.done')}</Button>
            {canClear && (
              <Button variant="ghost" onClick={onClearAll}>
                {t('staff.emails.filters.clearAll')}
              </Button>
            )}
          </div>
        </DialogSheet>
      )}
    </div>
  );
}
