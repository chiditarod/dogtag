import { t } from '@/locales/en';
import type { Team } from '@/types/api';

export type TourStopId = 'flag' | 'racers' | 'questions' | 'fee' | 'in';

export interface TourStop {
  id: TourStopId;
  title: string;
  body: string;
}

const ORDER: TourStopId[] = ['flag', 'racers', 'questions', 'fee', 'in'];

/** In order flag, racers, questions, fee, in; 'questions' is left out when the race has none. */
export function teamTourStops(team: Team): TourStop[] {
  return ORDER.filter((id) => id !== 'questions' || team.checklist.questions.required).map(
    (id) => ({ id, title: t(`tour.${id}.title`), body: t(`tour.${id}.body`) }),
  );
}
