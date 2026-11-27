import { Navigate } from 'react-router-dom';
import { useMe } from '@/features/auth/api/use-me';
import { staffNavItems } from '@/features/staff/nav';

/** `/staff` goes to the first nav item the user may see (Payments if the list is empty). */
export function StaffIndexRedirect() {
  const { data: me } = useMe();
  const first = staffNavItems(me?.roles ?? [])[0];
  const to = first ? first.to.replace(/^\/staff\//, '') : 'payments';
  return <Navigate to={to} replace />;
}
