import type { ReactNode } from 'react';
import { useMe } from '@/features/auth/api/use-me';
import { NotAllowed } from '@/features/staff/components/not-allowed';
import { isStaff } from '@/features/staff/utils';

interface RequireStaffProps {
  children: ReactNode;
  /** When given, the user needs one of these roles as well as being staff (e.g. a page refunders may not open). */
  roles?: string[];
}

/** Render under RequireAuth. The server remains the real gate. */
export function RequireStaff({ children, roles }: RequireStaffProps) {
  const { data } = useMe();
  const allowed = isStaff(data) && (!roles || roles.some((role) => data?.roles?.includes(role)));
  return allowed ? <>{children}</> : <NotAllowed />;
}
