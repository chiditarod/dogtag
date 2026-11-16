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
      'Each star turns solid red when its step is done. Fill all four and your team is in.',
    );
    expect(stops[4].body).toBe(
      'When the first three stars are solid red, your spot is locked in and you get your team number.',
    );
  });

  it('leaves out the questions stop when the race has none', () => {
    const stops = teamTourStops(teamWithQuestions(false));
    expect(stops.map((stop) => stop.id)).toEqual(['flag', 'racers', 'fee', 'in']);
  });

  it('leaves out the fee stop when the race has no fee', () => {
    const noFee = buildChecklist().fee;
    const team = buildTeam({
      checklist: buildChecklist({
        questions: { required: true, done: false },
        fee: { ...noFee, done: true, amount_due_cents: null, requirement_id: null, items: [] },
      }),
    });
    expect(teamTourStops(team).map((stop) => stop.id)).toEqual(['flag', 'racers', 'questions', 'in']);
  });

  it('keeps the fee stop while a fee opens later', () => {
    const team = buildTeam({
      checklist: buildChecklist({
        fee: {
          done: true,
          amount_due_cents: null,
          paid_cents: 0,
          next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
          requirement_id: null,
          items: [
            {
              requirement_id: 3,
              name: 'Registration fee',
              done: false,
              amount_due_cents: null,
              paid_cents: 0,
              next_tier: { price_cents: 15000, begins_at: '2026-12-01T06:00:00.000Z' },
            },
          ],
        },
      }),
    });
    expect(teamTourStops(team).map((stop) => stop.id)).toContain('fee');
  });
});
