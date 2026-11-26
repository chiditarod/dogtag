import type { StaffUserRow, StaffUsersResponse } from './api/types';

export function staffUserRow(overrides: Partial<StaffUserRow> = {}): StaffUserRow {
  return {
    id: 1,
    first_name: 'Ada',
    last_name: 'Racer',
    email: 'ada@example.com',
    phone: '(312) 555-0142',
    roles: [],
    teams: [],
    ...overrides,
  };
}

export const emptyUsers: StaffUsersResponse = {
  users: [],
  meta: { page: 1, per_page: 35, total_count: 0, total_pages: 0 },
};
