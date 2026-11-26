import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useMe } from '@/features/auth/api/use-me';
import { useMarkConfirmationSeen } from '@/features/teams/api/use-mark-confirmation-seen';
import { useTeam } from '@/features/teams/api/use-team';
import { ChecklistCard } from '@/features/teams/components/checklist-card';
import {
  FeeCardSlot,
  QuestionsCardSlot,
  RosterCardSlot,
} from '@/features/teams/components/checklist-slots';
import { CompletionDialog } from '@/features/teams/components/completion-dialog';
import { TeamHeader } from '@/features/teams/components/team-header';
import {
  TeamErrorBanner,
  TeamPageErrorProvider,
} from '@/features/teams/components/team-page-error';
import { YoureInCard } from '@/features/teams/components/youre-in-card';
import { useTeamPermissions } from '@/features/teams/use-team-permissions';
import { StaffTeamPanel } from '@/features/staff-teams/components/staff-team-panel';
import { isStaff } from '@/features/staff/utils';
import type { Team } from '@/types/api';
import { GuidedTour } from '@/features/tour/components/guided-tour';
import { markSeen, shouldAutoStart } from '@/features/tour/storage';
import { noFeeDue, teamTourStops } from '@/features/tour/stops';
import { cardSteps, feePill } from '@/features/teams/utils';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

interface TeamPageBodyProps {
  team: Team;
  teamUpdatedAt: number;
  replayRef: RefObject<HTMLButtonElement | null>;
  onTakeTour: () => void;
}

/** The header and cards. Permissions are computed here once, so one staff request serves the page. */
function TeamPageBody({ team, teamUpdatedAt, replayRef, onTakeTour }: TeamPageBodyProps) {
  const { permissions, staffTeam, staffQuery, staffState } = useTeamPermissions(team, { teamUpdatedAt });
  const { checklist } = team;
  // Card statuses come from the checklist, not stepStates: a finalized team's
  // flag is forced full, but a regressed step's card should still read "to do".
  const [racersDone, questionsDone, feeDone] = cardSteps(checklist);
  const status = (done: boolean) => (done ? 'done' : 'todo');
  return (
    <div className="space-y-4">
      <TeamErrorBanner />
      <div className="space-y-6 lg:grid lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10 lg:space-y-0">
        {/* Not sticky while the edit form is open: a sticky rail taller than
            the viewport could never show its Save button. Nor while the Staff
            card is in the rail (any state but 'none'), which makes it taller than
            the viewport too. */}
        <div
          className={
            staffState === 'none'
              ? 'lg:sticky lg:top-6 lg:has-[form]:static'
              : 'lg:has-[form]:static'
          }
        >
          <TeamHeader
            team={team}
            replayRef={replayRef}
            onTakeTour={onTakeTour}
            permissions={permissions}
            staffState={staffState}
          />
          {staffState !== 'none' && (
            <StaffTeamPanel team={team} staffTeam={staffTeam} query={staffQuery} />
          )}
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
            <RosterCardSlot team={team} permissions={permissions} />
          </ChecklistCard>
          {checklist.questions.required && (
            <ChecklistCard
              anchor="step-questions"
              tourId="questions"
              title={t('team.questions')}
              status={status(questionsDone)}
              pill={questionsDone ? t('team.pillDone') : t('team.pillTodo')}
            >
              <QuestionsCardSlot team={team} permissions={permissions} />
            </ChecklistCard>
          )}
          <ChecklistCard
            anchor="step-fee"
            tourId="fee"
            title={t('team.fee')}
            status={status(feeDone)}
            pill={feePill(checklist.fee, team.race.time_zone)}
          >
            <FeeCardSlot team={team} permissions={permissions} staffTeam={staffTeam} />
          </ChecklistCard>
          <YoureInCard checklist={checklist} />
        </div>
      </div>
    </div>
  );
}

export function TeamChecklist({ teamId }: { teamId: string }) {
  const { data: team, isPending, error, refetch, dataUpdatedAt } = useTeam(teamId, {
    pollForFundraisingUrl: true,
  });

  const { data: me } = useMe();
  const [dismissed, setDismissed] = useState(false);
  const markConfirmationSeen = useMarkConfirmationSeen(Number(teamId));
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
    // Staff open pages to look, not to be walked through; Take the tour still works.
    if (
      team.race.open_for_registration &&
      !team.checklist.finalized &&
      !isStaff(me) &&
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

  // The confirmation takes over: end an open tour rather than hide it, so it
  // does not come back at stop 1 over a finalized team.
  const confirmationShowing = !!team?.checklist.show_confirmation && !dismissed;
  useEffect(() => {
    if (confirmationShowing) setTourOpen(false);
  }, [confirmationShowing]);

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
  const showDialog = checklist.show_confirmation && !dismissed;
  return (
    <TeamPageErrorProvider teamId={teamId}>
      <TeamPageBody
        team={team}
        teamUpdatedAt={dataUpdatedAt}
        replayRef={replayRef}
        onTakeTour={() => setTourOpen(true)}
      />
      {showDialog && (
        <CompletionDialog
          team={team}
          onClose={() => {
            setDismissed(true);
            // A failed POST is not worth a banner: the dialog just closes and
            // shows again on the next visit.
            markConfirmationSeen.mutate(undefined, { onError: () => {} });
          }}
        />
      )}
      {tourOpen && !showDialog && <GuidedTour stops={stops} onEnd={endTour} />}
    </TeamPageErrorProvider>
  );
}
