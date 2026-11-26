import { DEFAULT_TIME_ZONE, formatShortDay } from '@/lib/dates';
import { en, t } from '@/locales/en';
import type { RegistrationStatus } from '@/types/api';
import type { PaymentFilterValues, PaymentsFilterOptions } from './types';

/** "Nov 20". Staff pages show times in the default race zone (payments carry no zone). */
export function formatShortDate(iso: string): string {
  return formatShortDay(iso, DEFAULT_TIME_ZONE);
}

/** "Nov 20, 2026", for the paid column. */
export function formatPaidDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(new Date(iso));
}

/** The URL names a race id the server does not know (it then lists nothing). */
export function raceNotFound(values: PaymentFilterValues, options: PaymentsFilterOptions | undefined): boolean {
  return typeof values.raceId === 'number' && !!options && !options.races.some((race) => race.id === values.raceId);
}

/** "open", "not yet open"; a status this build does not know yet shows as the server sent it. */
export function raceStatusLabel(status: RegistrationStatus): string {
  const key = `staff.payments.raceStatus.${status}`;
  return key in en ? t(key as keyof typeof en) : status;
}

export function hasActiveFilters(values: PaymentFilterValues): boolean {
  return values.paymentType !== undefined || values.status !== 'all' || values.q !== '';
}
