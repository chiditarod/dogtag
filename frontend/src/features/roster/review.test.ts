import { describe, expect, it } from 'vitest';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import {
  applyFieldErrors,
  experienceNote,
  initialLines,
  lineValue,
  unconfirmedCount,
} from '@/features/roster/review';
import type { PersonDraft } from '@/features/roster/utils';
import { buildRace } from '@/test/fixtures';

const race = buildRace();

const draft: PersonDraft = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '(312) 555-0111',
  zipcode: '60614',
  experience: '1',
  instagram: '@ada',
};

const racer: PastRacer = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  email: 'ada@example.com',
  phone: '312-555-0111',
  zipcode: '60614',
  experience: 0,
  instagram: null,
  last_team_name: 'Cart Pushers',
  last_race_name: 'CHIditarod 2025',
  last_raced_year: 2025,
};

describe('initialLines', () => {
  it('starts every line of a complete draft unconfirmed and closed', () => {
    const lines = initialLines(draft);
    expect(Object.values(lines)).toHaveLength(6);
    for (const line of Object.values(lines)) {
      expect(line).toEqual({ confirmed: false, editing: false, error: null });
    }
  });

  it('opens a blank required line with the missing message', () => {
    const lines = initialLines({ ...draft, phone: '' });
    expect(lines.phone).toEqual({
      confirmed: false,
      editing: true,
      error: 'Phone is missing. Add it to continue.',
    });
    expect(lines.email.editing).toBe(false);
  });

  it('leaves a blank instagram closed and shows None', () => {
    const blank = { ...draft, instagram: '' };
    expect(initialLines(blank).instagram.editing).toBe(false);
    expect(lineValue('instagram', blank, race)).toBe('None');
  });

  it('opens the years line when there is no years value', () => {
    expect(initialLines({ ...draft, experience: '' }).experience.editing).toBe(true);
  });
});

describe('lineValue', () => {
  it('joins the name and shows the experience label', () => {
    expect(lineValue('name', draft, race)).toBe('Ada Lovelace');
    expect(lineValue('experience', draft, race)).toBe('Raced once before');
    expect(lineValue('experience', { ...draft, experience: '' }, race)).toBe('');
  });
});

describe('experienceNote', () => {
  it('says what the value was when it was bumped', () => {
    expect(experienceNote(racer, draft, race)).toBe('was "This is our first" last time');
  });

  it('is null when the racer was already at the last label', () => {
    expect(
      experienceNote({ ...racer, experience: 2 }, { ...draft, experience: '2' }, race),
    ).toBeNull();
  });
});

describe('applyFieldErrors', () => {
  it('reopens the hit lines, unconfirmed, with the first message', () => {
    const confirmed = Object.fromEntries(
      Object.entries(initialLines(draft)).map(([key, line]) => [
        key,
        { ...line, confirmed: true },
      ]),
    ) as ReturnType<typeof initialLines>;
    const lines = applyFieldErrors(confirmed, {
      first_name: ["can't be blank"],
      email: ['is invalid'],
    });
    expect(lines.name).toEqual({ confirmed: false, editing: true, error: "can't be blank" });
    expect(lines.email).toEqual({ confirmed: false, editing: true, error: 'is invalid' });
    expect(lines.phone.confirmed).toBe(true);
    expect(unconfirmedCount(lines)).toBe(2);
  });
});

describe('unconfirmedCount', () => {
  it('counts an open line even when its confirmed flag is still true', () => {
    const lines = initialLines(draft);
    const confirmed = Object.fromEntries(
      Object.entries(lines).map(([key, line]) => [key, { ...line, confirmed: true }]),
    ) as ReturnType<typeof initialLines>;
    expect(unconfirmedCount(confirmed)).toBe(0);
    expect(
      unconfirmedCount({ ...confirmed, email: { ...confirmed.email, editing: true } }),
    ).toBe(1);
  });
});
