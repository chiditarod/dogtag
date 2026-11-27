import { useParams } from 'react-router-dom';
import { NotFound } from '@/components/ui/not-found';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { ApiError } from '@/lib/api-client';
import { NewFeeForm } from '../components/new-fee-form';
import { useFees } from '../api/use-staff-fees';

export function StaffFeeNewRoute() {
  const { raceId } = useParams();
  const { data, error, isPending, isError, refetch } = useFees(raceId);

  if (isPending) return <QueryLoading />;
  if (isError) {
    return error instanceof ApiError && error.status === 404 ? <NotFound /> : <QueryError onRetry={() => void refetch()} />;
  }
  return <NewFeeForm key={data.race.id} race={data.race} types={data.types} />;
}
