import { formatDate } from '@/lib/dates';
import { toWallClock, wallTime, zoneAbbreviation } from '@/lib/zoned-time';

/** "Mon, Dec 7, 2026, 12:00 PM CST": a price's start, read in the race's zone. */
export function formatStart(iso: string, timeZone: string): string {
  const wall = toWallClock(iso, timeZone);
  return `${formatDate(iso, timeZone)}, ${wallTime(wall)} ${zoneAbbreviation(wall, timeZone)}`;
}
