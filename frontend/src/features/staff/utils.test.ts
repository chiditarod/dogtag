import { describe, expect, it } from 'vitest';
import type { User } from '@/features/auth/api/use-me';
import { isStaff, STAFF_ROLES } from '@/features/staff/utils';
import { user } from '@/test/fixtures';

const withRoles = (roles: string[]): User => ({ ...user, roles });

describe('isStaff', () => {
  it.each(STAFF_ROLES)('is true for %s', (role) => {
    expect(isStaff(withRoles([role]))).toBe(true);
  });

  it('is true when a staff role sits among unknown roles', () => {
    expect(isStaff(withRoles(['volunteer', 'refunder']))).toBe(true);
  });

  it('is false for no roles or only unknown roles', () => {
    expect(isStaff(withRoles([]))).toBe(false);
    expect(isStaff(withRoles(['volunteer']))).toBe(false);
    expect(isStaff(withRoles(['Admin']))).toBe(false);
  });

  it('is false with no user or a user without roles', () => {
    expect(isStaff(undefined)).toBe(false);
    const { roles: _roles, ...noRoles } = user;
    expect(isStaff(noRoles as User)).toBe(false);
  });
});
