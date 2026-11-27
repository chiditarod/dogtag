import { useParams } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { raceFormValues } from '../build-race-payload';
import { useStaffRace } from '../api/use-staff-races';
import { RaceForm } from '../components/race-form';

export function StaffRaceEditRoute() {
  const { raceId } = useParams();
  const { data, isPending, isError, refetch } = useStaffRace(raceId);

  if (isPending) return <QueryLoading />;
  if (isError) return <QueryError onRetry={() => void refetch()} />;
  const { race } = data;
  return (
    <RaceForm
      // A different race gets a fresh form, never the previous one's edits.
      key={race.id}
      initial={raceFormValues(race)}
      raceId={race.id}
      raceName={race.name}
      timeZones={data.time_zones}
      confirmationMaxLength={race.confirmation_text_max_length}
    />
  );
}
