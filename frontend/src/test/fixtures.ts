import type { Checklist, Person, Race, Team } from '@/types/api';

export const user = {
  id: 1,
  first_name: 'Ada',
  last_name: 'L',
  email: 'ada@example.com',
  phone: null,
};

export function buildRace(overrides: Partial<Race> = {}): Race {
  return {
    id: 1,
    name: 'CHIditarod 2027',
    race_datetime: '2027-03-06T16:00:00.000Z',
    registration_open: '2026-12-01T06:00:00.000Z',
    registration_close: '2027-02-20T06:00:00.000Z',
    final_edits_close: '2027-02-27T06:00:00.000Z',
    open_for_registration: true,
    full: false,
    people_per_team: 5,
    experience_labels: ['This is our first', 'Raced once before', 'Twice'],
    jsonform: null,
    stripe_publishable_key: 'pk_test',
    payment_requirements: [],
    ...overrides,
  };
}

export function buildChecklist(overrides: Partial<Checklist> = {}): Checklist {
  return {
    racers: { filled: 1, total: 5, done: false },
    questions: { required: false, done: true },
    fee: {
      done: false,
      amount_due_cents: 15000,
      paid_cents: 0,
      next_tier: null,
      requirement_id: 3,
    },
    finalized: false,
    remaining: 2,
    team_number: null,
    classy_fundraising_url: null,
    ...overrides,
  };
}

export function buildTeam(overrides: Partial<Team> = {}): Team {
  return {
    id: 9,
    name: 'Cart Pushers',
    description: 'We push carts',
    experience: 1,
    race: buildRace(),
    people: [],
    checklist: buildChecklist(),
    ...overrides,
  };
}

export function buildPerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 1,
    first_name: 'Ada',
    last_name: 'L',
    email: 'ada@example.com',
    phone: '312-555-0100',
    zipcode: '60601',
    experience: 1,
    twitter: null,
    ...overrides,
  };
}
