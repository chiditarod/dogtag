import { FeeCard } from '@/features/payments/components/fee-card';
import { QuestionsCard } from '@/features/questions/components/questions-card';
import { RosterCard } from '@/features/roster/components/roster-card';
import type { StaffTeam } from '@/features/staff-teams/types';
import { racerPermissions, type TeamPermissions } from '@/features/teams/permissions';
import type { Team } from '@/types/api';

/**
 * Body slots for the checklist cards. TeamChecklist renders each inside its
 * ChecklistCard. Each takes the team and the page's `permissions` (computed
 * once by `TeamChecklist`); the fee card also takes the staff team, for its
 * Payments links and Checkout email.
 */
interface SlotProps {
  team: Team;
  /** Computed once by `TeamChecklist`; defaults to a racer's rules. */
  permissions?: TeamPermissions;
}

export function RosterCardSlot({ team, permissions = racerPermissions(team) }: SlotProps) {
  return <RosterCard team={team} permissions={permissions} />;
}

export function QuestionsCardSlot({ team, permissions = racerPermissions(team) }: SlotProps) {
  return <QuestionsCard team={team} permissions={permissions} />;
}

export function FeeCardSlot({
  team,
  permissions = racerPermissions(team),
  staffTeam,
}: SlotProps & { staffTeam?: StaffTeam }) {
  return <FeeCard team={team} permissions={permissions} staffTeam={staffTeam} />;
}
