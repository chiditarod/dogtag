import { describe, expect, it } from 'vitest';
import { fromWallClock, isInPast, toWallClock, zoneAbbreviation } from './zoned-time';

describe('toWallClock', () => {
  it('formats an instant as the wall clock in the zone', () => {
    expect(toWallClock('2026-12-07T18:00:00Z', 'America/Chicago')).toBe('2026-12-07T12:00');
  });

  it('returns an empty string for null', () => {
    expect(toWallClock(null, 'America/Chicago')).toBe('');
  });

  it('shows midnight as 00:00, not 24:00', () => {
    expect(toWallClock('2026-12-07T06:00:00Z', 'America/Chicago')).toBe('2026-12-07T00:00');
  });
});

describe('fromWallClock', () => {
  it('converts a wall clock to an ISO instant', () => {
    expect(fromWallClock('2026-12-07T12:00', 'America/Chicago')).toBe('2026-12-07T18:00:00.000Z');
  });

  it('returns null for a time skipped by a spring-forward gap', () => {
    expect(fromWallClock('2027-03-14T02:30', 'America/Chicago')).toBeNull();
  });

  it('returns the earlier instant for an ambiguous fall-back time', () => {
    expect(fromWallClock('2027-11-07T01:30', 'America/Chicago')).toBe('2027-11-07T06:30:00.000Z');
  });

  it('picks the earlier instant and finds gaps in zones east of UTC too', () => {
    expect(fromWallClock('2027-10-31T01:30', 'Europe/London')).toBe('2027-10-31T00:30:00.000Z');
    expect(fromWallClock('2027-09-26T02:30', 'Pacific/Auckland')).toBeNull();
  });

  it('handles midnight', () => {
    expect(fromWallClock('2026-12-07T00:00', 'America/Chicago')).toBe('2026-12-07T06:00:00.000Z');
  });

  it('returns null for unparseable input', () => {
    expect(fromWallClock('', 'America/Chicago')).toBeNull();
    expect(fromWallClock('nonsense', 'America/Chicago')).toBeNull();
  });

  it.each(['Europe/London', 'Pacific/Auckland', 'America/Chicago'])('round trips in %s', (zone) => {
    for (const wall of ['2027-01-15T09:30', '2027-07-15T09:30', '2027-12-31T23:59']) {
      const iso = fromWallClock(wall, zone);
      expect(iso).not.toBeNull();
      expect(toWallClock(iso, zone)).toBe(wall);
    }
  });
});

describe('zoneAbbreviation', () => {
  it('gives CDT in summer and CST in winter', () => {
    expect(zoneAbbreviation('2027-03-15T00:00', 'America/Chicago')).toBe('CDT');
    expect(zoneAbbreviation('2027-02-15T00:00', 'America/Chicago')).toBe('CST');
  });

  it('still answers for a wall clock that does not exist', () => {
    expect(zoneAbbreviation('2027-03-14T02:30', 'America/Chicago')).toMatch(/^C[SD]T$/);
  });
});

describe('isInPast', () => {
  const now = new Date('2026-12-07T18:00:00Z');

  it('compares the wall clock in the zone against now', () => {
    expect(isInPast('2026-12-07T11:59', 'America/Chicago', now)).toBe(true);
    expect(isInPast('2026-12-07T12:01', 'America/Chicago', now)).toBe(false);
  });

  it('is false for a blank or nonexistent wall clock', () => {
    expect(isInPast('', 'America/Chicago', now)).toBe(false);
    expect(isInPast('2027-03-14T02:30', 'America/Chicago', now)).toBe(false);
  });
});
