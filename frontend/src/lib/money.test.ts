import { describe, expect, it } from 'vitest';
import { formatMoney } from './money';

describe('formatMoney', () => {
  it('shows whole dollars without cents and others with two decimals', () => {
    expect(formatMoney(710000)).toBe('$7,100');
    expect(formatMoney(710050)).toBe('$7,100.50');
    expect(formatMoney(0)).toBe('$0');
  });
});
