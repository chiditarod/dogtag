import { describe, expect, it } from 'vitest';
import type { RegistrationRow } from './types';
import { activeAnswers, filterOptions, filterRows, mailtoHref } from './utils';

function row(id: number, name: string, answers: Record<string, string | null> = {}): RegistrationRow {
  return {
    id,
    name,
    description: null,
    mine: false,
    can_show: false,
    deletable: false,
    percent_complete: 100,
    experience_label: 'Rookie',
    racer_years: 0,
    answers,
    waitlist_position: null,
    created_at: '2026-11-01T00:00:00Z',
    staff: null,
  };
}

const rows = [
  row(1, 'Doge Sled', { 'racer-type': 'Racer', theme: 'Dogs' }),
  row(2, 'Cart Wheels', { 'racer-type': 'Mixed', theme: 'Dogs' }),
  row(3, 'Plain Team', { 'racer-type': null }),
];

describe('filterRows', () => {
  it('matches the name case-insensitively by substring', () => {
    expect(filterRows(rows, 'doge', {}).map((r) => r.id)).toEqual([1]);
  });

  it('ignores surrounding spaces', () => {
    expect(filterRows(rows, '  doge  ', {}).map((r) => r.id)).toEqual([1]);
  });

  it('ANDs the answer filters', () => {
    expect(filterRows(rows, '', { 'racer-type': 'Racer', theme: 'Dogs' }).map((r) => r.id)).toEqual([1]);
    expect(filterRows(rows, '', { theme: 'Dogs' }).map((r) => r.id)).toEqual([1, 2]);
    expect(filterRows(rows, 'wheels', { 'racer-type': 'Racer' })).toEqual([]);
  });

  it('returns every row without filters', () => {
    expect(filterRows(rows, '', {})).toHaveLength(3);
  });
});

describe('filterOptions', () => {
  it('drops nulls and duplicates and sorts', () => {
    expect(filterOptions(rows, 'racer-type')).toEqual(['Mixed', 'Racer']);
    expect(filterOptions(rows, 'missing')).toEqual([]);
  });
});

describe('activeAnswers', () => {
  it('drops a filter whose value is no longer an option', () => {
    expect(
      activeAnswers({ 'racer-type': 'Gone', theme: 'Dogs' }, { 'racer-type': ['Racer'], theme: ['Dogs'] }),
    ).toEqual({ theme: 'Dogs' });
  });
});

describe('mailtoHref', () => {
  it('puts the recipients in bcc', () => {
    expect(mailtoHref('dogtag@chiditarod.org', ['a@x.com', 'b@y.com'])).toBe(
      'mailto:dogtag@chiditarod.org?bcc=a%40x.com%2Cb%40y.com',
    );
  });
});
