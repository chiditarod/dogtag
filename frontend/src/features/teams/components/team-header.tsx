import { ProgressSegments } from '@/components/ui/progress-segments';
import { EditTeamBasics } from '@/features/teams/components/edit-team-basics';
import { formatDate, formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';
import { isFeeOpensLater } from '@/features/teams/utils';

function remainingText(team: Team): string {
  const { remaining, finalized, fee } = team.checklist;
  const { time_zone } = team.race;
  if (finalized) return t('team.youreIn');
  if (remaining === 0) {
    return isFeeOpensLater(fee)
      ? t('team.nothingYet', {
          date: formatDate(fee.next_tier!.begins_at, time_zone),
        })
      : t('team.almostThere');
  }
  const unit = remaining === 1 ? 'teams.thingsLeft_one' : 'teams.thingsLeft_other';
  return `${remaining} ${t(unit)}`;
}

/** 4 segments: racers, questions (counts as done when not required), fee, finalized. */
function completedSteps({ checklist }: Team): number {
  return [
    checklist.racers.done,
    !checklist.questions.required || checklist.questions.done,
    checklist.fee.done && !isFeeOpensLater(checklist.fee),
    checklist.finalized,
  ].filter(Boolean).length;
}

export function TeamHeader({ team }: { team: Team }) {
  const { race } = team;
  return (
    <section
      aria-label={t('team.summary')}
      className="space-y-3 rounded-lg border border-flag bg-white p-4 shadow-sm"
    >
      <div>
        <h1 className="font-display text-2xl font-semibold">{team.name}</h1>
        <p className="font-semibold">{race.name}</p>
        <p className="text-sm">{formatDate(race.race_datetime, race.time_zone)}</p>
        <p className="text-sm text-navy/70">
          {`${t('team.closes')} ${formatDeadline(race.registration_close, race.time_zone)}`}
        </p>
      </div>
      <p
        className={`font-display text-lg font-semibold ${
          team.checklist.finalized ? 'text-starText' : ''
        }`}
      >
        {remainingText(team)}
      </p>
      <ProgressSegments
        total={4}
        filled={completedSteps(team)}
        label={t('team.progress')}
      />
      <EditTeamBasics team={team} />
    </section>
  );
}
