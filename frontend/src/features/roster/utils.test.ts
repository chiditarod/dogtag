import { describe, expect, it } from 'vitest';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import {
  draftFromPastRacer,
  emailProblem,
  emptyDraft,
  payloadFromDraft,
  yearsCount,
  yearsProblem,
} from '@/features/roster/utils';

describe('payloadFromDraft', () => {
  const draft = {
    first_name: '  Dee ',
    last_name: ' Lamb  ',
    email: '  Dee@Example.COM ',
    phone: '(312) 555-0144',
    experience: '2',
    instagram: ' @dee ',
    tiktok: ' @Dee.Lamb ',
  };

  it('trims every field, lowercases the email and converts the phone', () => {
    expect(payloadFromDraft(draft)).toEqual({
      first_name: 'Dee',
      last_name: 'Lamb',
      email: 'dee@example.com',
      phone: '312-555-0144',
      experience: 2,
      instagram: '@dee',
      tiktok: '@Dee.Lamb',
    });
  });

  it('keeps 0 years as 0', () => {
    expect(payloadFromDraft({ ...draft, experience: '0' }).experience).toBe(0);
  });

  it('sends null, not 0, for a blank years value', () => {
    expect(payloadFromDraft({ ...draft, experience: '' }).experience).toBeNull();
    expect(payloadFromDraft(emptyDraft).experience).toBeNull();
  });
});

describe('years racing', () => {
  it('counts years with a singular form', () => {
    expect(yearsCount(1)).toBe('1 year racing');
    expect(yearsCount(0)).toBe('0 years racing');
    expect(yearsCount(12)).toBe('12 years racing');
  });

  it('accepts digits and rejects blank or anything else', () => {
    expect(yearsProblem('0')).toBeNull();
    expect(yearsProblem('99')).toBeNull();
    for (const bad of ['', ' ', 'abc', '1.5', '-1', '1e2']) {
      expect(yearsProblem(bad)).toBe('Enter how many years they have raced');
    }
  });
});

describe('draftFromPastRacer', () => {
  const racer: PastRacer = {
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: null,
    experience: 7,
    instagram: null,
    tiktok: null,
    last_team_name: null,
    last_race_name: null,
    last_raced_year: null,
  };

  it('carries a past racer forward as one more year, capped at 99', () => {
    expect(draftFromPastRacer(racer).experience).toBe('8');
    expect(draftFromPastRacer({ ...racer, experience: 99 }).experience).toBe('99');
    expect(draftFromPastRacer({ ...racer, experience: null }).experience).toBe('');
  });
});

describe('emailProblem', () => {
  const roster = ['ada@example.com'];

  it('is null for blank or good addresses not on the roster', () => {
    expect(emailProblem('', roster)).toBeNull();
    expect(emailProblem('bo@example.com', roster)).toBeNull();
    expect(emailProblem('bo@sub.example.co', [])).toBeNull();
  });

  it('flags addresses that are not plausible', () => {
    for (const bad of ['bad@email', 'bademail.com', '@bad.com', 'bad@email.a', 'a b@c.com']) {
      expect(emailProblem(bad, roster)).toBe('Enter a valid email address');
    }
  });

  it('flags a roster duplicate regardless of case', () => {
    expect(emailProblem('ADA@example.com', roster)).toBe('Is already on this team');
  });
});
