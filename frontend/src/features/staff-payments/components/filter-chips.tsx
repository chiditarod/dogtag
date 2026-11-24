import { t } from '@/locales/en';
import type { PaymentFilterValues, PaymentsFilterOptions } from '../types';

type ChipKey = 'paymentType' | 'status' | 'q';

interface FilterChipsProps {
  values: PaymentFilterValues;
  options: PaymentsFilterOptions | undefined;
  onRemove: (key: ChipKey) => void;
  onClearAll: () => void;
}

/** Removable chips for each active filter besides the race, plus Clear all. */
export function FilterChips({ values, options, onRemove, onClearAll }: FilterChipsProps) {
  const chips: { key: ChipKey; label: string }[] = [];
  if (values.paymentType !== undefined) {
    const type = options?.payment_types.find((candidate) => candidate.id === values.paymentType);
    chips.push({ key: 'paymentType', label: type?.name ?? String(values.paymentType) });
  }
  if (values.status === 'paid') {
    chips.push({ key: 'status', label: t('staff.payments.filters.statusPaid') });
  } else if (values.status === 'refunded') {
    chips.push({ key: 'status', label: t('staff.payments.filters.statusRefunded') });
  }
  if (values.q) chips.push({ key: 'q', label: t('staff.payments.filters.searchChip', { q: values.q }) });
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ul aria-label={t('staff.payments.filters.active')} className="flex min-w-0 flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key} className="min-w-0">
            <button
              type="button"
              aria-label={t('staff.payments.filters.remove', { label: chip.label })}
              onClick={() => onRemove(chip.key)}
              className="inline-flex min-h-8 max-w-full items-center gap-1 rounded-full bg-flag/50 px-3 text-sm font-semibold text-navy hover:bg-flag"
            >
              <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClearAll} className="text-sm font-semibold text-link hover:underline">
        {t('staff.payments.filters.clearAll')}
      </button>
    </div>
  );
}
