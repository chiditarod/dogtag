import { describe, expect, it } from 'vitest';
import type { FeeTier } from './api/types';
import { checkPrice, firstPriceGap, parseDollars, racersPayLine } from './price-checks';

const ZONE = 'America/Chicago';
const NOW = new Date('2026-12-01T12:00:00Z');

function tier(overrides: Partial<FeeTier> = {}): FeeTier {
  return {
    id: 1,
    price_cents: 12000,
    begin_at: '2027-01-01T06:00:00Z',
    status: 'later',
    can_destroy: true,
    destroy_blocked_reason: null,
    ...overrides,
  };
}

describe('parseDollars', () => {
  it('reads dollars as cents', () => {
    expect(parseDollars('140')).toBe(14000);
    expect(parseDollars('$140')).toBe(14000);
    expect(parseDollars(' 140.00 ')).toBe(14000);
    expect(parseDollars('1,000')).toBe(100000);
    expect(parseDollars('$1,250.00')).toBe(125000);
  });

  it('keeps part dollars so checkPrice can refuse them', () => {
    expect(parseDollars('1.50')).toBe(150);
  });

  it('is null for nothing usable', () => {
    for (const text of ['0.50', '0', '', '  ', 'abc', '-5', '12abc', '1.234', '$']) {
      expect(parseDollars(text), text).toBeNull();
    }
  });
});

describe('checkPrice', () => {
  const ok = { price: '140', begin: '2027-02-01T00:00' };

  it('is clean for a good future price', () => {
    expect(checkPrice(ok, [tier()], ZONE, NOW)).toEqual({ errors: {} });
  });

  it('wants whole dollars of at least $1', () => {
    for (const price of ['', 'abc', '0', '0.50', '1.50']) {
      expect(checkPrice({ ...ok, price }, [], ZONE, NOW).errors.price, price).toBe('Whole dollars only, $1 or more.');
    }
  });

  it('caps the price at $100,000', () => {
    expect(checkPrice({ ...ok, price: '100000' }, [], ZONE, NOW).errors.price).toBeUndefined();
    expect(checkPrice({ ...ok, price: '100001' }, [], ZONE, NOW).errors.price).toBe('Must be $100,000 or less.');
  });

  it('refuses a price another start already has', () => {
    expect(checkPrice({ ...ok, price: '$120' }, [tier()], ZONE, NOW).errors.price).toBe(
      'This fee already has a $120 price.',
    );
  });

  it('compares only with the prices it is given, so the one being edited is left out of them', () => {
    const editing = tier({ id: 1, price_cents: 12000, begin_at: '2027-01-01T06:00:00Z' });
    const other = tier({ id: 2, price_cents: 14000, begin_at: '2027-02-01T06:00:00Z' });
    const mine = { price: '120', begin: '2027-01-01T00:00' };

    // The caller passes the fee's other prices: the edited price's own values are not duplicates ...
    expect(checkPrice(mine, [other], ZONE, NOW).errors).toEqual({});
    // ... and the same values are duplicates when that price is (wrongly) among them.
    expect(checkPrice(mine, [editing, other], ZONE, NOW).errors).toEqual({
      price: 'This fee already has a $120 price.',
      begin_at: 'A price already starts at this time.',
    });
    // Another price's values still are.
    expect(checkPrice({ price: '140', begin: '2027-02-01T00:00' }, [other], ZONE, NOW).errors).toEqual({
      price: 'This fee already has a $140 price.',
      begin_at: 'A price already starts at this time.',
    });
  });

  it('reports a start the zone skips', () => {
    const result = checkPrice({ ...ok, begin: '2027-03-14T02:30' }, [], ZONE, NOW);
    expect(result.errors.begin_at).toMatch(/doesn't exist/);
  });

  it('requires a start', () => {
    expect(checkPrice({ ...ok, begin: '' }, [], ZONE, NOW).errors.begin_at).toBe('Enter a date and time');
  });

  it('refuses a start that is the same instant as another price', () => {
    // 2027-01-01T06:00Z is midnight in Chicago.
    const result = checkPrice({ ...ok, begin: '2027-01-01T00:00' }, [tier()], ZONE, NOW);
    expect(result.errors.begin_at).toBe('A price already starts at this time.');
  });

  it('warns, without blocking, about a start in the past', () => {
    const result = checkPrice({ ...ok, begin: '2026-11-01T00:00' }, [], ZONE, NOW);
    expect(result).toEqual({ errors: {}, warning: 'This is in the past.' });
  });

  it('reports both fields at once', () => {
    const result = checkPrice({ price: '', begin: '' }, [], ZONE, NOW);
    expect(Object.keys(result.errors).sort()).toEqual(['begin_at', 'price']);
  });
});

describe('firstPriceGap', () => {
  const open = '2026-12-07T18:00:00Z';

  it('is null when the first price starts at or before opening', () => {
    expect(firstPriceGap(['2026-12-07T18:00:00Z'], open, ZONE)).toBeNull();
    expect(firstPriceGap(['2027-01-01T06:00:00Z', '2026-12-01T06:00:00Z'], open, ZONE)).toBeNull();
  });

  it('is null with no dated price, which the server reports instead', () => {
    expect(firstPriceGap([], open, ZONE)).toBeNull();
    expect(firstPriceGap([null], open, ZONE)).toBeNull();
  });

  it('explains the gap, skipping undated prices', () => {
    expect(firstPriceGap([null, '2027-01-01T06:00:00Z', '2027-02-01T06:00:00Z'], open, ZONE)).toBe(
      "The first price starts Jan 1, after registration opens (Dec 7). Teams can't pay this fee from Dec 7 to Jan 1.",
    );
  });

  it('reads the days in the race zone', () => {
    // 03:00Z on Dec 8 is still Dec 7 in Chicago.
    expect(firstPriceGap(['2026-12-08T03:00:00Z'], '2026-12-07T01:00:00Z', ZONE)).toContain('starts Dec 7,');
  });
});

describe('racersPayLine', () => {
  it('names the price, the day, the time and the zone', () => {
    expect(racersPayLine(14000, '2027-02-01T00:00', ZONE)).toBe('Racers pay $140 from Mon, Feb 1, 2027, 12:00 AM CST');
  });
});
