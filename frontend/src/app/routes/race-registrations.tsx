import { useParams } from 'react-router-dom';
import { RegistrationsPage } from '@/features/registrations/components/registrations-page';

export function RaceRegistrationsRoute() {
  const { raceId } = useParams();
  // Digits only: Number() would also accept "1e1" or " 7".
  return <RegistrationsPage raceId={/^\d+$/.test(raceId ?? '') ? Number(raceId) : NaN} />;
}
