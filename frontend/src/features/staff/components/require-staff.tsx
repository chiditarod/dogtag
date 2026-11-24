import type { ReactNode } from 'react';
import { useMe } from '@/features/auth/api/use-me';
import { NotAllowed } from '@/features/staff/components/not-allowed';
import { isStaff } from '@/features/staff/utils';

/** Render under RequireAuth. The server remains the real gate. */
export function RequireStaff({ children }: { children: ReactNode }) {
  const { data } = useMe();
  return isStaff(data) ? <>{children}</> : <NotAllowed />;
}
