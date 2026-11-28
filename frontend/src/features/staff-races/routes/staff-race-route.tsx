import { useParams } from 'react-router-dom';
import { RaceOverview } from '../components/race-overview';

export function StaffRaceRoute() {
  const { raceId } = useParams();
  return <RaceOverview raceId={raceId} />;
}
