import { t } from '@/locales/en';
import type { Team } from '@/types/api';

export type TourStopId = 'flag' | 'racers' | 'questions' | 'fee' | 'in';

export interface TourStop {
  id: TourStopId;
  title: string;
  body: string;
}

const ORDER: TourStopId[] = ['flag', 'racers', 'questions', 'fee', 'in'];

/** True when the race asks no fee at all (the fee card reads "No registration fee is due."). */
export const noFeeDue = ({ checklist }: Team) =>
  checklist.fee.done && checklist.fee.items.length === 0;

/** In order flag (the four stars: team, racers, questions, fee), racers, questions, fee, in; 'questions' and 'fee' are left out when the race has none. */
export function teamTourStops(team: Team): TourStop[] {
  return ORDER.filter(
    (id) =>
      (id !== 'questions' || team.checklist.questions.required) && (id !== 'fee' || !noFeeDue(team)),
  ).map((id) => ({ id, title: t(`tour.${id}.title`), body: t(`tour.${id}.body`) }));
}
