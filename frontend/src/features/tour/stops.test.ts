import { describe, expect, it } from 'vitest';
import { teamTourStops } from '@/features/tour/stops';
import { buildChecklist, buildTeam } from '@/test/fixtures';

const teamWithQuestions = (required: boolean) =>
  buildTeam({ checklist: buildChecklist({ questions: { required, done: false } }) });

describe('teamTourStops', () => {
  it('has five stops in order when the race has questions', () => {
    const stops = teamTourStops(teamWithQuestions(true));
    expect(stops.map((stop) => stop.id)).toEqual(['flag', 'racers', 'questions', 'fee', 'in']);
    expect(stops.map((stop) => stop.title)).toEqual([
      'Four stars, four steps',
      'Add your racers',
      'Answer the team questions',
      'Pay the registration fee',
      "You're in",
    ]);
    expect(stops[0].body).toBe(
      'Each star turns red when its step is done. Fill all four and your team is in.',
    );
  });

  it('leaves out the questions stop when the race has none', () => {
    const stops = teamTourStops(teamWithQuestions(false));
    expect(stops.map((stop) => stop.id)).toEqual(['flag', 'racers', 'fee', 'in']);
  });
});
