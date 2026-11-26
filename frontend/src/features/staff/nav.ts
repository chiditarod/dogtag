import type { t } from '@/locales/en';

export type StaffNavItem = { to: string; labelKey: Parameters<typeof t>[0]; roles: string[] };

/** The one place staff nav items and the roles that see them live, in display order. */
export const STAFF_NAV: StaffNavItem[] = [
  { to: '/staff/races', labelKey: 'staff.nav.races', roles: ['admin', 'operator'] },
  { to: '/staff/payments', labelKey: 'staff.nav.payments', roles: ['admin', 'operator', 'refunder'] },
];

/** Items a user with these roles may see. The server stays the real gate. */
export function staffNavItems(roles: string[]): StaffNavItem[] {
  return STAFF_NAV.filter((item) => item.roles.some((role) => roles.includes(role)));
}
