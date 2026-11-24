import { DEFAULT_TIME_ZONE } from '@/lib/dates';
import type { PaymentFilterValues } from './types';

/** "$7,100" for whole dollars, "$7,100.50" otherwise. */
export function formatMoney(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100);
}

/** "Nov 20". Staff pages show times in the default race zone (payments carry no zone). */
export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: DEFAULT_TIME_ZONE,
  }).format(new Date(iso));
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

export function hasActiveFilters(values: PaymentFilterValues): boolean {
  return values.paymentType !== undefined || values.status !== 'all' || values.q !== '';
}
