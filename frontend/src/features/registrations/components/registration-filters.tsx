import { useId, useState } from 'react';
import { ResultCount } from '@/components/list/result-count';
import { SearchBox } from '@/components/list/search-box';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { t } from '@/locales/en';

const control =
  'min-h-11 w-full rounded-md border border-flag bg-white px-3 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

interface FieldFilters {
  fields: { key: string; label: string }[];
  options: Record<string, string[]>;
  answers: Record<string, string>;
  onAnswer: (key: string, value: string | undefined) => void;
}

/** One select per filter field, first option "Any". */
function FilterSelects({ fields, options, answers, onAnswer, idPrefix }: FieldFilters & { idPrefix: string }) {
  return (
    <>
      {fields.map((field) => (
        <div key={field.key} className="min-w-0 sm:w-48">
          <label htmlFor={`${idPrefix}-${field.key}`} className="mb-1 block text-sm font-semibold text-navy">
            {field.label}
          </label>
          <select
            id={`${idPrefix}-${field.key}`}
            className={control}
            value={answers[field.key] ?? ''}
            onChange={(event) => onAnswer(field.key, event.target.value || undefined)}
          >
            <option value="">{t('registrations.any')}</option>
            {options[field.key]?.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      ))}
    </>
  );
}

interface RegistrationFiltersProps extends FieldFilters {
  q: string;
  onSearch: (q: string) => void;
  onClear: () => void;
  /** The sentence the live region announces for the tab on screen. */
  countMessage: string;
}

/** Search always; one select per filter field inline from `sm`, and behind a Filters sheet below it. */
export function RegistrationFilters({
  q,
  onSearch,
  onClear,
  countMessage,
  ...fieldFilters
}: RegistrationFiltersProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();
  const active = Object.keys(fieldFilters.answers).length;
  const hasFields = fieldFilters.fields.length > 0;

  return (
    <div className="space-y-3">
      {/* The open sheet is modal, so the live count moves into it. */}
      {!sheetOpen && <ResultCount message={countMessage} />}
      <div className="flex gap-3 sm:flex-wrap sm:items-end">
        <SearchBox
          value={q}
          onSearch={onSearch}
          label={t('registrations.search')}
          placeholder={t('registrations.search')}
          className="min-w-0 flex-1 sm:max-w-xs"
        />
        {hasFields && (
          <>
            <div className="hidden min-w-0 gap-3 sm:flex sm:flex-wrap sm:items-end">
              <FilterSelects {...fieldFilters} idPrefix="inline" />
              {active > 0 && (
                <Button variant="ghost" onClick={onClear}>
                  {t('registrations.clearFilters')}
                </Button>
              )}
            </div>
            <Button variant="secondary" className="shrink-0 sm:hidden" onClick={() => setSheetOpen(true)}>
              {active > 0 ? t('registrations.filtersCount', { n: active }) : t('registrations.filters')}
            </Button>
          </>
        )}
      </div>
      {sheetOpen && (
        <DialogSheet labelledBy={titleId} onClose={() => setSheetOpen(false)}>
          <div className="flex items-center justify-between border-b border-flag px-4 py-3">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {t('registrations.filtersTitle')}
            </h2>
          </div>
          <div className="space-y-4 overflow-y-auto px-4 py-4">
            <FilterSelects {...fieldFilters} idPrefix="sheet" />
          </div>
          <div className="flex flex-col gap-2 border-t border-flag px-4 py-3">
            <ResultCount message={countMessage} />
            <Button onClick={() => setSheetOpen(false)}>{t('registrations.done')}</Button>
            {active > 0 && (
              <Button variant="ghost" onClick={onClear}>
                {t('registrations.clearFilters')}
              </Button>
            )}
          </div>
        </DialogSheet>
      )}
    </div>
  );
}
