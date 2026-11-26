import { useParams } from 'react-router-dom';
import { NotFound } from '@/components/ui/not-found';
import { UserPage } from '../components/user-page';

export function StaffUserRoute() {
  const { userId } = useParams();
  if (!userId || !/^\d+$/.test(userId)) return <NotFound />;
  // A different user gets a fresh page, never the previous one's typed edits.
  return <UserPage key={userId} userId={Number(userId)} />;
}
