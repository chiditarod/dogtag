import { describe, expect, it } from 'vitest';
import { checkDates, type DateField } from './date-checks';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-11-25T12:00:00Z');
const GOOD: Record<DateField, string> = {
  registration_open: '2026-12-07T12:00',
  registration_close: '2027-02-15T00:00',
  final_edits_close: '2027-03-01T00:00',
  race_datetime: '2027-03-06T10:00',
};
const check = (overrides: Partial<Record<DateField, string>> = {}, zone = ZONE) =>
  checkDates({ ...GOOD, ...overrides }, zone, NOW);

describe('checkDates', () => {
  it('has nothing to say about good dates', () => {
    expect(check()).toEqual({ errors: {}, warnings: {} });
  });

  it('reports an empty date', () => {
    expect(check({ race_datetime: '' }).errors.race_datetime).toBe('Enter a date and time');
  });

  it('reports a time skipped by the clock change, naming the time, day and zone', () => {
    expect(check({ race_datetime: '2027-03-14T02:30' }).errors.race_datetime).toBe(
      "2:30 AM doesn't exist on Mar 14 in America/Chicago: clocks jump forward.",
    );
  });

  it('puts an order error on the earlier field of the pair, naming the later one', () => {
    const { errors } = check({ final_edits_close: '2027-03-15T00:00' });
    expect(errors.final_edits_close).toBe('Must be before Race day (Sat, Mar 6, 10:00 AM)');
    expect(Object.keys(errors)).toEqual(['final_edits_close']);
  });

  it('treats equal moments as out of order', () => {
    expect(check({ registration_close: GOOD.registration_open }).errors.registration_open).toMatch(
      /^Must be before Registration closes/,
    );
  });

  it('reports only the first failing pair', () => {
    const { errors } = check({ registration_open: '2027-03-02T00:00', final_edits_close: '2027-03-07T00:00' });
    expect(Object.keys(errors)).toEqual(['registration_open']);
    expect(errors.registration_open).toMatch(/^Must be before Registration closes/);
  });

  it('skips an order check when a date is missing or does not exist', () => {
    const { errors } = check({ registration_close: '' });
    expect(Object.keys(errors)).toEqual(['registration_close']);
  });

  it('warns, without an error, about a registration opening in the past', () => {
    const result = check({ registration_open: '2026-11-20T12:00' });
    expect(result.errors).toEqual({});
    expect(result.warnings.registration_open).toBe('This is in the past: registration opens as soon as you save.');
  });

  it('warns about the other dates being in the past too', () => {
    const past = checkDates(
      { ...GOOD, registration_open: '2026-11-01T10:00', registration_close: '2026-11-02T10:00',
        final_edits_close: '2026-11-03T10:00', race_datetime: '2026-11-04T10:00' },
      ZONE,
      NOW,
    );
    expect(past.warnings.race_datetime).toBe('This is in the past.');
  });

  it('never throws for a blank zone', () => {
    expect(() => check({}, '')).not.toThrow();
    expect(check({}, '').errors).toEqual({});
  });
});
