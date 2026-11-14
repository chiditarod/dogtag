import { describe, expect, it } from 'vitest';
import { DEFAULT_TIME_ZONE, formatDate, formatDeadline } from '@/lib/dates';

describe('formatDate', () => {
  it('formats in the passed zone', () => {
    // 05:30 UTC on Mar 6 is still Mar 5 in Chicago and Los Angeles.
    expect(formatDate('2027-03-06T05:30:00Z', 'America/Chicago')).toBe('Fri, Mar 5, 2027');
    expect(formatDate('2027-03-06T07:30:00Z', 'America/Chicago')).toBe('Sat, Mar 6, 2027');
    expect(formatDate('2027-03-06T07:30:00Z', 'America/Los_Angeles')).toBe('Fri, Mar 5, 2027');
  });

  it('shows an opening at local midnight as that day', () => {
    expect(formatDate('2026-12-15T06:00:00Z', 'America/Chicago')).toBe('Tue, Dec 15, 2026');
  });

  it('falls back to Chicago when the zone is absent or unknown', () => {
    expect(DEFAULT_TIME_ZONE).toBe('America/Chicago');
    expect(formatDate('2027-03-06T05:30:00Z', undefined)).toBe('Fri, Mar 5, 2027');
    expect(formatDate('2027-03-06T05:30:00Z', null)).toBe('Fri, Mar 5, 2027');
    expect(formatDate('2027-03-06T05:30:00Z', 'Mars/Olympus_Mons')).toBe('Fri, Mar 5, 2027');
  });
});

describe('formatDeadline', () => {
  it('shows a deadline at exactly local midnight as the previous day', () => {
    // 2027-02-15 00:00 CST
    expect(formatDeadline('2027-02-15T06:00:00Z', 'America/Chicago')).toBe('Sun, Feb 14, 2027');
  });

  it('applies the rule in daylight time too', () => {
    // 2027-07-01 00:00 CDT
    expect(formatDeadline('2027-07-01T05:00:00Z', 'America/Chicago')).toBe('Wed, Jun 30, 2027');
  });

  it('leaves non-midnight deadlines alone', () => {
    expect(formatDeadline('2027-02-15T06:00:01Z', 'America/Chicago')).toBe('Mon, Feb 15, 2027');
    expect(formatDeadline('2027-02-15T18:00:00Z', 'America/Chicago')).toBe('Mon, Feb 15, 2027');
  });

  it('checks midnight in the passed zone', () => {
    // Midnight in Los Angeles is 2am in Chicago.
    expect(formatDeadline('2027-02-15T08:00:00Z', 'America/Los_Angeles')).toBe('Sun, Feb 14, 2027');
    expect(formatDeadline('2027-02-15T08:00:00Z', 'America/Chicago')).toBe('Mon, Feb 15, 2027');
  });
});
