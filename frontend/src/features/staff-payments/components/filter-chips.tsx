import { FilterChips as SharedFilterChips } from '@/components/list/filter-chips';
import { t } from '@/locales/en';
import type { PaymentFilterValues, PaymentsFilterOptions } from '../types';

type ChipKey = 'teamId' | 'paymentType' | 'status' | 'q';

interface FilterChipsProps {
  values: PaymentFilterValues;
  options: PaymentsFilterOptions | undefined;
  onRemove: (key: ChipKey) => void;
  onClearAll: () => void;
  /** Refund mode: the status is fixed to Paid, so it is not a chip. */
  hideStatus?: boolean;
}

/** Builds a chip for each active filter besides the race. */
export function FilterChips({ values, options, onRemove, onClearAll, hideStatus }: FilterChipsProps) {
  const chips: { key: ChipKey; label: string }[] = [];
  if (values.teamId !== undefined) {
    // No options yet: show the number until the server names the team (or says there is none).
    const label = !options
      ? t('staff.payments.filters.teamChip', { name: `#${values.teamId}` })
      : options.team
        ? t('staff.payments.filters.teamChip', { name: options.team.name })
        : t('staff.payments.filters.teamNotFound');
    chips.push({ key: 'teamId', label });
  }
  if (values.paymentType !== undefined) {
    const type = options?.payment_types.find((candidate) => candidate.id === values.paymentType);
    chips.push({ key: 'paymentType', label: type?.name ?? String(values.paymentType) });
  }
  if (hideStatus) {
    // Fixed by Refund mode.
  } else if (values.status === 'paid') {
    chips.push({ key: 'status', label: t('staff.payments.filters.statusPaid') });
  } else if (values.status === 'refunded') {
    chips.push({ key: 'status', label: t('staff.payments.filters.statusRefunded') });
  }
  if (values.q) chips.push({ key: 'q', label: t('staff.payments.filters.searchChip', { q: values.q }) });

  return (
    <SharedFilterChips
      chips={chips}
      onRemove={(key) => onRemove(key as ChipKey)}
      onClearAll={onClearAll}
      label={t('staff.payments.filters.active')}
      removeLabel={(label) => t('staff.payments.filters.remove', { label })}
      clearAllLabel={t('staff.payments.filters.clearAll')}
    />
  );
}
