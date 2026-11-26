import { Navigate } from 'react-router-dom';
import { useMe } from '@/features/auth/api/use-me';
import { staffLandingPath } from '@/features/staff/nav';

/** `/staff` goes to Races for those who see it, else Payments. */
export function StaffIndexRedirect() {
  const { data: me } = useMe();
  return <Navigate to={staffLandingPath(me?.roles ?? []).replace(/^\/staff\//, '')} replace />;
}
