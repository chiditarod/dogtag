import type { Team } from '@/types/api';

/**
 * Body slots for the checklist cards. TeamChecklist renders each inside its
 * ChecklistCard; later tasks replace these placeholders (same `{ team }`
 * props) with the real card bodies:
 *   RosterCardSlot    -> Task 23 (card 1, racers)
 *   QuestionsCardSlot -> Task 24 (card 2, team questions)
 *   FeeCardSlot       -> Task 25 (card 3, registration fee)
 */
interface SlotProps {
  team: Team;
}

export function RosterCardSlot({ team }: SlotProps) {
  void team;
  return null;
}

export function QuestionsCardSlot({ team }: SlotProps) {
  void team;
  return null;
}

export function FeeCardSlot({ team }: SlotProps) {
  void team;
  return null;
}
