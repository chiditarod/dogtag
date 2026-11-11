import { describe, expect, it } from 'vitest';
import {
  formatPhoneDisplay,
  formatZipDisplay,
  isLikelyEmail,
  toApiPhone,
} from '@/components/inputs/format';

describe('formatPhoneDisplay', () => {
  it.each(['+1 (312) 555-0144', '3125550144', '312.555.0144', '13125550144'])(
    'formats %s',
    (raw) => expect(formatPhoneDisplay(raw)).toBe('(312) 555-0144'),
  );

  it('formats progressively as digits are typed', () => {
    expect(formatPhoneDisplay('')).toBe('');
    expect(formatPhoneDisplay('3')).toBe('(3');
    expect(formatPhoneDisplay('312')).toBe('(312');
    expect(formatPhoneDisplay('3125')).toBe('(312) 5');
    expect(formatPhoneDisplay('3125550')).toBe('(312) 555-0');
  });

  it('caps at ten digits', () => {
    expect(formatPhoneDisplay('312555014499')).toBe('(312) 555-0144');
  });
});

describe('toApiPhone', () => {
  it('gives ddd-ddd-dddd for ten digits', () => {
    expect(toApiPhone('(312) 555-0144')).toBe('312-555-0144');
  });

  it('returns the raw value when not ten digits', () => {
    expect(toApiPhone('(312) 555')).toBe('(312) 555');
  });
});

describe('isLikelyEmail', () => {
  it('mirrors the Rails regex', () => {
    expect(isLikelyEmail('ada@example.com')).toBe(true);
    expect(isLikelyEmail('Ada+race@Sub.Example.org')).toBe(true);
    expect(isLikelyEmail('ada@example')).toBe(false);
    expect(isLikelyEmail('ada @example.com')).toBe(false);
    expect(isLikelyEmail('@example.com')).toBe(false);
    expect(isLikelyEmail('ada@example.c')).toBe(false);
  });
});

describe('formatZipDisplay', () => {
  it('allows ddddd and ddddd-dddd', () => {
    expect(formatZipDisplay('60601')).toBe('60601');
    expect(formatZipDisplay('606010001')).toBe('60601-0001');
    expect(formatZipDisplay('60601-0001')).toBe('60601-0001');
    expect(formatZipDisplay('60601-')).toBe('60601-');
    expect(formatZipDisplay('6060-1')).toBe('60601');
    expect(formatZipDisplay('60601-00012345')).toBe('60601-0001');
    expect(formatZipDisplay('ab606')).toBe('606');
  });
});
