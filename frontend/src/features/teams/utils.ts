import { formatDate } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Checklist } from '@/types/api';

/**
 * Before any pricing tier is active the backend reports `fee.done` with no
 * amount due and a `next_tier`; that is "opens later", not "paid". Once
 * something has been paid, a requirement opening later does not undo "paid".
 */
export function isFeeOpensLater(fee: Checklist['fee']): boolean {
  return (
    fee.done &&
    fee.paid_cents === 0 &&
    fee.amount_due_cents === null &&
    fee.next_tier !== null
  );
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function feePill(fee: Checklist['fee']): string {
  if (isFeeOpensLater(fee)) {
    return `${t('team.pillOpens')} ${formatDate(fee.next_tier!.begins_at)}`;
  }
  if (fee.done) return t('team.pillPaid');
  return fee.amount_due_cents === null
    ? t('team.pillTodo')
    : formatCents(fee.amount_due_cents);
}
