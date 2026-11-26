import type { Team } from '@/types/api';

/** Something that stops a racer from paying but not staff. Each gap gets its own warning line. */
export type StaffPayGap =
  | { kind: 'roster'; filled: number; total: number }
  | { kind: 'closed' }
  | { kind: 'waitlist' };

/** The reasons a racer could not pay this team's fee right now, in the order the card warns about them. */
export function staffPayGaps({ checklist, race }: Team): StaffPayGap[] {
  const { filled, total } = checklist.racers;
  const gaps: StaffPayGap[] = [];
  if (filled < total) gaps.push({ kind: 'roster', filled, total });
  if (!race.open_for_registration) gaps.push({ kind: 'closed' });
  if (race.full) gaps.push({ kind: 'waitlist' });
  return gaps;
}
