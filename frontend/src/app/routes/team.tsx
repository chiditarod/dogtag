import { useParams } from 'react-router-dom';
import { TeamChecklist } from '@/features/teams/components/team-checklist';

export function TeamRoute() {
  const { teamId } = useParams();
  return <TeamChecklist teamId={teamId ?? ''} />;
}
