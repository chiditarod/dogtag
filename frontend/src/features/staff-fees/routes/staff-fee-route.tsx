import { useParams } from 'react-router-dom';
import { FeePage } from '../components/fee-page';

export function StaffFeeRoute() {
  const { raceId, requirementId } = useParams();
  // A different fee gets a fresh page, never the previous one's typed name.
  return <FeePage key={requirementId} raceId={raceId} feeId={requirementId} />;
}
