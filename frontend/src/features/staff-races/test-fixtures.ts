import type { StaffRaceSummary } from './api/types';

export function staffRaceSummary(overrides: Partial<StaffRaceSummary> = {}): StaffRaceSummary {
  return {
    id: 1,
    name: 'CHIditarod 2027',
    race_datetime: '2027-03-13T17:00:00Z',
    registration_open: '2026-12-07T18:00:00Z',
    registration_close: '2027-02-02T06:00:00Z',
    final_edits_close: '2027-03-02T06:00:00Z',
    time_zone: 'America/Chicago',
    max_teams: 100,
    registration_status: 'open',
    setup_problems: [],
    teams: { finalized: 40, total: 52 },
    ...overrides,
  };
}
