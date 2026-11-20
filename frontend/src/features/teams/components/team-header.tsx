import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmationText } from '@/features/teams/components/confirmation-text';
import { DeleteTeam } from '@/features/teams/components/delete-team';
import { FundraisingStatus } from '@/features/teams/components/fundraising-status';
import { EditTeamBasics } from '@/features/teams/components/edit-team-basics';
import { FlagProgress } from '@/features/teams/components/flag-progress';
import { formatDate, formatDeadline } from '@/lib/dates';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';
import { isFeeOpensLater, stepStates } from '@/features/teams/utils';

function remainingText(team: Team): string {
  const { remaining, finalized, fee } = team.checklist;
  const { time_zone } = team.race;
  if (finalized) return t('team.fullyRegistered');
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

interface LeftItem {
  anchor: string;
  label: string;
}

/** Unfinished steps, in page order, for the "What's left" list. */
function leftItems({ checklist, captain_id }: Team): LeftItem[] {
  if (checklist.finalized) return [];
  const items: LeftItem[] = [];
  const openSpots = checklist.racers.total - checklist.racers.filled;
  if (openSpots > 0) {
    items.push({
      anchor: 'step-racers',
      label: t(openSpots === 1 ? 'team.leftRacers_one' : 'team.leftRacers_other', {
        count: openSpots,
      }),
    });
  }
  if (checklist.racers.filled > 0 && captain_id === null) {
    items.push({ anchor: 'step-racers', label: t('team.leftCaptain') });
  }
  if (checklist.questions.required && !checklist.questions.done) {
    items.push({ anchor: 'step-questions', label: t('team.leftQuestions') });
  }
  if (!checklist.fee.done && !isFeeOpensLater(checklist.fee)) {
    items.push({ anchor: 'step-fee', label: t('team.leftFee') });
  }
  return items;
}

interface TeamHeaderProps {
  team: Team;
  onTakeTour: () => void;
  /** Lets the page return focus here when the tour ends. */
  replayRef?: Ref<HTMLButtonElement>;
}

export function TeamHeader({ team, onTakeTour, replayRef }: TeamHeaderProps) {
  const { race } = team;
  const items = leftItems(team);
  return (
    <section aria-label={t('team.summary')} className="space-y-3">
      <FlagProgress
        steps={stepStates(team)}
        label={t('team.progress')}
        starLabels={[t('team.star.team'), t('team.star.racers'), t('team.star.questions'), t('team.star.fee')]}
      />
      <div>
        <h1 className="font-display text-3xl font-bold [overflow-wrap:anywhere] lg:text-4xl">
          {team.name}
        </h1>
        <p className="font-semibold">{race.name}</p>
        <p className="text-sm">{formatDate(race.race_datetime, race.time_zone)}</p>
        <p className="text-sm text-navy/70">
          {`${t('team.closes')} ${formatDeadline(race.registration_close, race.time_zone)}`}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3">
        <p
          className={`font-display text-lg font-semibold ${
            team.checklist.finalized ? 'text-starText' : ''
          }`}
        >
          {remainingText(team)}
        </p>
        {/* When the edit form opens it takes a full row of its own. */}
        <div className="has-[form]:basis-full">
          <EditTeamBasics team={team} />
        </div>
      </div>
      {team.checklist.finalized && (
        <div className="space-y-2">
          {team.checklist.team_number !== null && (
            <p className="font-display text-2xl font-semibold text-starText">
              {t('team.teamNumber')}
              {team.checklist.team_number}
            </p>
          )}
          <FundraisingStatus checklist={team.checklist} compact />
        </div>
      )}
      {team.checklist.finalized && <ConfirmationText html={team.checklist.confirmation_html} />}
      {items.length > 0 && (
        <div className="hidden border-t border-flag pt-3 lg:block">
          <ul aria-label={t('team.whatsLeft')}>
            {items.map(({ anchor, label }) => (
              <li key={label}>
                <a
                  href={`#${anchor}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-link hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
                >
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* The negative margin cancels the ghost padding, like the edit toggle. */}
      <div>
        <Button ref={replayRef} variant="ghost" className="-mx-4" onClick={onTakeTour}>
          {t('tour.replay')}
        </Button>
      </div>
      <DeleteTeam team={team} />
    </section>
  );
}
