import { describe, expect, it } from 'vitest';
import { safeNext } from '@/features/auth/utils';

describe('safeNext', () => {
  it.each(['/teams/5', '/teams/5?x=1', '/races/2/teams/new'])('keeps %s', (next) => {
    expect(safeNext(next, '/fallback')).toBe(next);
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    '/\t/evil.com',
    '/\nfoo',
    'teams',
    '',
    '/login',
    '/login?next=%2Fteams',
    '/signup',
    '/forgot-password/',
  ])('falls back for %j', (next) => {
    expect(safeNext(next, '/fallback')).toBe('/fallback');
  });

  it('falls back for null', () => {
    expect(safeNext(null, '/fallback')).toBe('/fallback');
  });
});
