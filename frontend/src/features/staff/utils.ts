import type { User } from '@/features/auth/api/use-me';

export const STAFF_ROLES = ['admin', 'refunder', 'operator'] as const;

/** Any staff role. The server stays the real gate; this only decides what to show. */
export function isStaff(user: User | undefined): boolean {
  return !!user?.roles?.some((role) => (STAFF_ROLES as readonly string[]).includes(role));
}
