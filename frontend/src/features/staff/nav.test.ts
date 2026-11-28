import { describe, expect, it } from 'vitest';
import { STAFF_NAV, rolesFor, staffLandingPath, staffNavItems } from '@/features/staff/nav';

describe('staffNavItems', () => {
  it('gives refunders Users then Payments', () => {
    expect(staffNavItems(['refunder']).map((item) => item.to)).toEqual(['/staff/users', '/staff/payments']);
  });

  it('gives operators and admins Races, Users, Emails then Payments', () => {
    const expected = ['/staff/races', '/staff/users', '/staff/emails', '/staff/payments'];
    expect(staffNavItems(['operator']).map((item) => item.to)).toEqual(expected);
    expect(staffNavItems(['admin']).map((item) => item.to)).toEqual(expected);
  });

  it('gives a user with several roles each item once, in display order', () => {
    expect(staffNavItems(['refunder', 'operator']).map((item) => item.to)).toEqual(
      STAFF_NAV.map((item) => item.to),
    );
  });

  it('gives racers, and a user with no roles, nothing', () => {
    expect(staffNavItems(['racer'])).toEqual([]);
    expect(staffNavItems([])).toEqual([]);
  });

  it('rolesFor reads the roles of a nav item, and none for an unknown path', () => {
    expect(rolesFor('/staff/races')).toEqual(['admin', 'operator']);
    expect(rolesFor('/staff/payments')).toContain('refunder');
    expect(rolesFor('/staff/emails')).toEqual(['admin', 'operator']);
    expect(rolesFor('/staff/users')).toEqual(['admin', 'operator', 'refunder']);
    expect(rolesFor('/staff/nope')).toEqual([]);
  });
});

describe('staffLandingPath', () => {
  it('lands refunders on Payments and operators and admins on Races', () => {
    expect(staffLandingPath(['refunder'])).toBe('/staff/payments');
    expect(staffLandingPath(['operator'])).toBe('/staff/races');
    expect(staffLandingPath(['admin'])).toBe('/staff/races');
    expect(staffLandingPath(['refunder', 'operator'])).toBe('/staff/races');
  });
});
