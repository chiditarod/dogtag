import { useParams } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { NewFeeForm } from '../components/new-fee-form';
import { useFees } from '../api/use-staff-fees';

export function StaffFeeNewRoute() {
  const { raceId } = useParams();
  const { data, isPending, isError, refetch } = useFees(raceId);

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  return <NewFeeForm key={data.race.id} race={data.race} types={data.types} />;
}
