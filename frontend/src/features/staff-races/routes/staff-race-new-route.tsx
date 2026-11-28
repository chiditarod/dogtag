import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { raceFormValues } from '../build-race-payload';
import { useNewStaffRace } from '../api/use-staff-races';
import { RaceForm } from '../components/race-form';

export function StaffRaceNewRoute() {
  const { data, isPending, isError, refetch } = useNewStaffRace();

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  return (
    <RaceForm
      initial={raceFormValues(data.race)}
      timeZones={data.time_zones}
      confirmationMaxLength={data.race.confirmation_text_max_length}
    />
  );
}
