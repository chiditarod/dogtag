import { t } from '@/locales/en';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { fromWallClock, isInPast, toWallClock, wallClockProblem, wallDay, wallTime, zoneAbbreviation } from '@/lib/zoned-time';
import type { FeeTier } from './api/types';

/** The server's cap on one price, in cents ($100,000). */
export const MAX_PRICE_CENTS = 10_000_000;

const DOLLARS = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/**
 * "140", "$140", "140.00" or "1,000" as cents; null when it is not an amount or is under $1.
 * Part dollars ("1.50") come back as cents so `checkPrice` can say why they are refused.
 */
export function parseDollars(text: string): number | null {
  const match = DOLLARS.exec(text.trim());
  if (!match) return null;
  const dollars = Number(match[1].replace(/,/g, ''));
  const cents = Number((match[2] ?? '').padEnd(2, '0'));
  const total = dollars * 100 + cents;
  return Number.isSafeInteger(total) && total >= 100 ? total : null;
}

export interface PriceChecks {
  errors: { price?: string; begin_at?: string };
  warning?: string;
}

function priceProblem(text: string, others: FeeTier[]): string | undefined {
  const cents = parseDollars(text);
  if (cents === null || cents % 100 !== 0) return t('staff.fees.priceWhole');
  if (cents > MAX_PRICE_CENTS) return t('staff.fees.priceTooBig');
  if (others.some((other) => other.price_cents === cents)) {
    return t('staff.fees.priceDuplicate', { price: formatMoney(cents) });
  }
  return undefined;
}

/**
 * Checks a price being added or edited (`begin` is a `datetime-local` wall clock in `timeZone`).
 * `others` is the fee's other prices, without the one being edited. Errors block a save; the
 * warning does not.
 */
export function checkPrice(
  draft: { price: string; begin: string },
  others: FeeTier[],
  timeZone: string,
  now: Date = new Date(),
): PriceChecks {
  const errors: PriceChecks['errors'] = {};
  const price = priceProblem(draft.price, others);
  if (price) errors.price = price;

  const problem = wallClockProblem(draft.begin, timeZone);
  if (problem) {
    errors.begin_at = problem;
  } else {
    const iso = fromWallClock(draft.begin, timeZone);
    if (iso !== null && others.some((other) => new Date(other.begin_at).getTime() === new Date(iso).getTime())) {
      errors.begin_at = t('staff.fees.startDuplicate');
    }
  }

  const warning = !errors.begin_at && isInPast(draft.begin, timeZone, now) ? t('staff.fees.startPast') : undefined;
  return warning ? { errors, warning } : { errors };
}

/**
 * The client side of the server's "has no price when registration opens" rule: set when the
 * earliest start is after registration opens. Starts that are null are skipped, as the server
 * skips them; with no dated price there is nothing to describe here.
 */
export function firstPriceGap(starts: (string | null)[], registrationOpen: string, timeZone: string): string | null {
  const times = starts.filter((start): start is string => start !== null).map((start) => new Date(start).getTime());
  if (times.length === 0) return null;
  const first = Math.min(...times);
  if (first <= new Date(registrationOpen).getTime()) return null;

  const day = (ms: number) => wallDay(toWallClock(new Date(ms).toISOString(), timeZone));
  return t('staff.fees.firstPriceGap', { start: day(first), open: day(new Date(registrationOpen).getTime()) });
}

/** "Racers pay $140 from Mon, Feb 1, 2027, 12:00 AM CST" for a start entered as a wall clock. */
export function racersPayLine(cents: number, wall: string, timeZone: string): string {
  const iso = fromWallClock(wall, timeZone);
  if (iso === null) return '';
  return t('staff.fees.racersPay', {
    price: formatMoney(cents),
    date: formatDate(iso, timeZone),
    time: wallTime(wall),
    zone: zoneAbbreviation(wall, timeZone),
  });
}
