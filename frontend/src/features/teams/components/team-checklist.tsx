import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useMe } from '@/features/auth/api/use-me';
import { useTeam } from '@/features/teams/api/use-team';
import { ChecklistCard } from '@/features/teams/components/checklist-card';
import {
  FeeCardSlot,
  QuestionsCardSlot,
  RosterCardSlot,
} from '@/features/teams/components/checklist-slots';
import { TeamHeader } from '@/features/teams/components/team-header';
import {
  TeamErrorBanner,
  TeamPageErrorProvider,
} from '@/features/teams/components/team-page-error';
import { YoureInCard } from '@/features/teams/components/youre-in-card';
import { GuidedTour } from '@/features/tour/components/guided-tour';
import { markSeen, shouldAutoStart } from '@/features/tour/storage';
import { noFeeDue, teamTourStops } from '@/features/tour/stops';
import { feePill, stepStates } from '@/features/teams/utils';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

export function TeamChecklist({ teamId }: { teamId: string }) {
  const { data: team, isPending, error, refetch } = useTeam(teamId, {
    pollForFundraisingUrl: true,
  });

  const { data: me } = useMe();
  const [tourOpen, setTourOpen] = useState(false);
  const replayRef = useRef<HTMLButtonElement>(null);
  const autoStartChecked = useRef(false);
  const focusReplayOnClose = useRef(false);

  // Stops depend only on whether the race has questions and a fee, so a
  // refetch of the team (the page polls) hands the open tour the same content.
  const questionsRequired = team?.checklist.questions.required;
  const feeLeftOut = team ? noFeeDue(team) : undefined;
  const stops = useMemo(
    () => (team ? teamTourStops(team) : []),
    [questionsRequired, feeLeftOut],
  );

  // Once per mount, when both the team and the signed-in user are known.
  useEffect(() => {
    if (!team || !me || autoStartChecked.current) return;
    autoStartChecked.current = true;
    if (
      team.race.open_for_registration &&
      !team.checklist.finalized &&
      shouldAutoStart(me.id)
    ) {
      setTourOpen(true);
    }
  }, [team, me]);

  // The tour restores focus to what had it before it opened (the page body on
  // an auto-start) as it unmounts; this effect runs after that and wins. On a
  // phone the last stop is far down the page: go back to the top instead of
  // letting focus jump the replay button to the screen's top edge.
  useEffect(() => {
    if (!tourOpen && focusReplayOnClose.current) {
      focusReplayOnClose.current = false;
      if (window.scrollY > 0 && typeof window.scrollTo === 'function') {
        window.scrollTo({ top: 0 });
      }
      replayRef.current?.focus({ preventScroll: true });
    }
  }, [tourOpen]);

  function endTour() {
    if (me) markSeen(me.id);
    focusReplayOnClose.current = true;
    setTourOpen(false);
  }

  if (isPending) return <QueryLoading />;
  if (error && !team) {
    if (error instanceof ApiError && [403, 404].includes(error.status)) {
      return (
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold">
            {t('team.notFound')}
          </h1>
          <Link to="/teams" className="text-link underline">
            {t('team.backToTeams')}
          </Link>
        </div>
      );
    }
    return <QueryError onRetry={() => void refetch()} />;
  }

  const { checklist } = team;
  // The same states drive the flag, so a heading star and the flag agree.
  const [racersDone, questionsDone, feeDone] = stepStates(team);
  const status = (done: boolean) => (done ? 'done' : 'todo');
  return (
    <TeamPageErrorProvider teamId={teamId}>
      <div className="space-y-4">
        <TeamErrorBanner />
        <div className="space-y-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10 lg:space-y-0">
          {/* Not sticky while the edit form is open: a sticky rail taller than
              the viewport could never show its Save button. */}
          <div className="lg:sticky lg:top-6 lg:has-[form]:static">
            <TeamHeader
              team={team}
              replayRef={replayRef}
              onTakeTour={() => setTourOpen(true)}
            />
          </div>
          <div className="divide-y divide-flag rounded-lg border border-flag bg-white">
            <ChecklistCard
              anchor="step-racers"
              tourId="racers"
              title={t('team.racers')}
              status={status(racersDone)}
              pill={t('team.racersPill', {
                filled: checklist.racers.filled,
                total: checklist.racers.total,
              })}
            >
              <RosterCardSlot team={team} />
            </ChecklistCard>
            {checklist.questions.required && (
              <ChecklistCard
                anchor="step-questions"
                tourId="questions"
                title={t('team.questions')}
                status={status(questionsDone)}
                pill={questionsDone ? t('team.pillDone') : t('team.pillTodo')}
              >
                <QuestionsCardSlot team={team} />
              </ChecklistCard>
            )}
            <ChecklistCard
              anchor="step-fee"
              tourId="fee"
              title={t('team.fee')}
              status={status(feeDone)}
              pill={feePill(checklist.fee, team.race.time_zone)}
            >
              <FeeCardSlot team={team} />
            </ChecklistCard>
            <YoureInCard checklist={checklist} />
          </div>
        </div>
      </div>
      {tourOpen && <GuidedTour stops={stops} onEnd={endTour} />}
    </TeamPageErrorProvider>
  );
}
