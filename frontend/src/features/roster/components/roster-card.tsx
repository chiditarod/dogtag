import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChicagoStar } from '@/components/ui/chicago-star';
import { useMe } from '@/features/auth/api/use-me';
import {
  usePastRacers,
  type PastRacer,
} from '@/features/roster/api/use-past-racers';
import { useSetCaptain } from '@/features/roster/api/use-set-captain';
import {
  useAddPerson,
  useRemovePerson,
  useUpdatePerson,
  type PersonPayload,
} from '@/features/roster/api/use-person-mutations';
import { CrewPicker } from '@/features/roster/components/crew-picker';
import { PersonForm } from '@/features/roster/components/person-form';
import {
  FilledSlot,
  OpenSpotsItem,
  SlotItem,
} from '@/features/roster/components/roster-slot';
import {
  draftFromPerson,
  draftFromUser,
  emptyDraft,
  fullName,
  splitPersonErrors,
  yearsCount,
  type PersonDraft,
} from '@/features/roster/utils';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { completeButCaptain } from '@/features/teams/permissions';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Person, Team } from '@/types/api';

interface ActiveForm {
  /** Present when editing an existing person. */
  personId?: number;
  draft: PersonDraft;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`ml-1 h-4 w-4 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RosterCard({ team }: { team: Team }) {
  const { race, people, checklist } = team;
  const me = useMe().data;
  const { reportError, clearError } = useTeamPageError();
  const open = race.open_for_registration;
  const openSpots = Math.max(race.people_per_team - people.length, 0);
  const hasEmptySlot = openSpots > 0;

  const [active, setActive] = useState<ActiveForm | null>(null);
  const [picker, setPicker] = useState<{ reviewOnly?: PastRacer } | null>(null);
  // A roster that is already full when the page loads starts as a summary.
  const [collapsed, setCollapsed] = useState(() => checklist.racers.done || (checklist.finalized && !hasEmptySlot));
  const [wasFinalized, setWasFinalized] = useState(checklist.finalized);
  const [removing, setRemoving] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<string | null>(null);
  // A person just added: the cached roster catches up a render after the form
  // or picker closes, so focus waits for them before looking for its target.
  const awaitingPerson = useRef<number | null>(null);

  const add = useAddPerson(team.id);
  const update = useUpdatePerson(team.id, active?.personId);
  const remove = useRemovePerson(team.id);
  const setCaptain = useSetCaptain(team.id);
  const save = active?.personId === undefined ? add : update;

  // Past racers added through the picker, by the email they were listed under,
  // so one whose email was changed in review is not offered again.
  const [pickedFrom, setPickedFrom] = useState<ReadonlyMap<string, number>>(new Map());

  const pastRacers = usePastRacers(team.id, open && hasEmptySlot);
  const emailsOnTeam = new Set(people.map((person) => person.email.toLowerCase()));
  for (const [email, personId] of pickedFrom) {
    if (people.some((person) => person.id === personId)) emailsOnTeam.add(email);
  }
  const available = (pastRacers.data ?? []).filter(
    (racer) => !emailsOnTeam.has(racer.email.toLowerCase()),
  );

  // Put focus back on the control that opened a form, confirmation or the
  // picker. That control may be gone (Add yourself once you are on the team,
  // the pick button once nobody is left to pick): fall back to "+ Add someone
  // new", then to the list.
  useEffect(() => {
    const key = restoreFocus.current;
    if (!key || active || removing !== null || picker) return;
    const waitingFor = awaitingPerson.current;
    if (waitingFor !== null && !people.some((person) => person.id === waitingFor)) return;
    awaitingPerson.current = null;
    const find = (focusKey: string) =>
      rootRef.current?.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`);
    const target = find(key) ?? find('add') ?? find('list');
    if (target) {
      target.focus();
      restoreFocus.current = null;
    }
  }, [active, removing, picker, collapsed, people, team.captain_id]);

  // The last spot was filled: the picker has nothing left to offer.
  useEffect(() => {
    if (picker && !hasEmptySlot) setPicker(null);
  }, [picker, hasEmptySlot]);

  const captainId = team.captain_id;
  const captain = people.find((person) => person.id === captainId);
  const addingNew = active !== null && active.personId === undefined;
  // The account holder is not always a racer: offer to add them until their
  // email is on the roster, whoever the captain is.
  const canAddMe = Boolean(me) && !emailsOnTeam.has(me?.email.toLowerCase() ?? '');

  function openForm(next: ActiveForm) {
    add.reset();
    update.reset();
    setRemoving(null);
    setActive(next);
  }

  function closeForm(focusKey: string) {
    restoreFocus.current = focusKey;
    setActive(null);
  }

  function addYourself() {
    if (!me) return;
    const mine = available.find(
      (racer) => racer.email.toLowerCase() === me.email.toLowerCase(),
    );
    if (mine) {
      restoreFocus.current = 'add-me';
      setPicker({ reviewOnly: mine });
    } else {
      openForm({ draft: draftFromUser(me) });
    }
  }

  function submit(person: PersonPayload) {
    if (!active) return;
    const wasEditing = active.personId !== undefined;
    save.mutate(person, {
      onSuccess: ({ person: saved }) => {
        clearError();
        setStatus(
          t(wasEditing ? 'roster.saved' : 'roster.added', {
            name: fullName(saved),
          }),
        );
        if (!wasEditing) awaitingPerson.current = saved.id;
        const spotStillOpen = !wasEditing && people.length + 1 < race.people_per_team;
        closeForm(wasEditing || !spotStillOpen ? `edit-${saved.id}` : 'add');
      },
      onError: (error) => reportError(error),
    });
  }

  function makeCaptain(person: Person) {
    restoreFocus.current = `edit-${person.id}`;
    setCaptain.mutate(person.id, {
      onSuccess: () => {
        clearError();
        setStatus(t('roster.captainIs', { name: fullName(person) }));
      },
      onError: (error) => reportError(error),
    });
  }

  /** Inline text for a failed captain change; a 403 shows in the page banner instead. */
  function captainMessage() {
    const { error } = setCaptain;
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.status === 403) return null;
      return error.errors?.person_id?.[0] || error.error || t('common.genericError');
    }
    return t('common.genericError');
  }

  function confirmRemove(personId: number, name: string) {
    remove.mutate(personId, {
      onSuccess: () => {
        clearError();
        setStatus(t('roster.removed', { name }));
        restoreFocus.current = 'list';
        setRemoving(null);
      },
      onError: (error) => reportError(error),
    });
  }

  function removeMessage() {
    const { error } = remove;
    if (!error) return null;
    if (error instanceof ApiError) {
      if (error.status === 403) return null;
      return error.error || t('common.genericError');
    }
    return t('common.genericError');
  }

  const { fieldErrors, formErrors } = splitPersonErrors(save.error);
  // The server refuses to remove a racer from a team that is complete apart from its captain.
  const canRemove = open && !checklist.finalized && !completeButCaptain(team);

  const formFor = (title: string, initial: PersonDraft) => (
    <PersonForm
      otherEmails={people
        .filter((person) => person.id !== active?.personId)
        .map((person) => person.email)}
      title={title}
      initial={initial}
      pending={save.isPending}
      fieldErrors={fieldErrors}
      formErrors={formErrors}
      onSubmit={submit}
      onCancel={() =>
        closeForm(
          active?.personId === undefined ? 'add' : `edit-${active.personId}`,
        )
      }
    />
  );

  const rows = people.map((person) =>
    active?.personId === person.id ? (
      <SlotItem key={person.id}>
        {formFor(t('roster.editTitle', { name: fullName(person) }), active.draft)}
      </SlotItem>
    ) : (
      <SlotItem key={person.id}>
        <FilledSlot
          person={person}
          experienceLabel={
            person.experience === null
              ? undefined
              : yearsCount(person.experience)
          }
          captain={person.id === captainId}
          onMakeCaptain={open ? () => makeCaptain(person) : undefined}
          settingCaptain={setCaptain.isPending}
          canEdit
          canRemove={canRemove}
          confirmingRemove={removing === person.id}
          removing={remove.isPending}
          removeError={removing === person.id ? removeMessage() : null}
          onEdit={() =>
            openForm({ personId: person.id, draft: draftFromPerson(person) })
          }
          onAskRemove={() => {
            remove.reset();
            setActive(null);
            setRemoving(person.id);
          }}
          onCancelRemove={() => {
            restoreFocus.current = `remove-${person.id}`;
            remove.reset();
            setRemoving(null);
          }}
          onConfirmRemove={() => confirmRemove(person.id, person.first_name)}
        />
      </SlotItem>
    ),
  );

  // A spot can open later (e.g. after a refetch): show the rows, and keep them
  // shown if the roster fills again during the visit.
  if (collapsed && hasEmptySlot) setCollapsed(false);
  // The team just became fully registered: fold the card away.
  if (wasFinalized !== checklist.finalized) {
    setWasFinalized(checklist.finalized);
    if (checklist.finalized && !hasEmptySlot && !collapsed) setCollapsed(true);
  }
  if (collapsed && !hasEmptySlot) {
    return (
      <div ref={rootRef} className="space-y-1">
        <p role="status" className="sr-only">
          {status}
        </p>
        <p>{people.map((person) => person.first_name).join(', ')}</p>
        {captain && (
          <p className="flex items-center gap-1.5 text-sm font-semibold" data-testid="captain-summary">
            <ChicagoStar filled className="h-4 w-4 shrink-0" />
            {t('roster.captainIs', { name: fullName(captain) })}
          </p>
        )}
        <Button
          variant="ghost"
          className="-ml-4"
          data-focus-key="toggle"
          aria-expanded={false}
          onClick={() => {
            restoreFocus.current = 'list';
            setCollapsed(false);
          }}
        >
          {t('roster.showRacers')}
          <Chevron open={false} />
        </Button>
      </div>
    );
  }

  const showActions = open && hasEmptySlot && !addingNew;
  const canHide = !hasEmptySlot && !active && !picker;

  return (
    <div ref={rootRef} className="space-y-3">
      <p role="status" className="sr-only">
        {status}
      </p>
      {people.length > 0 && captainId === null && (
        <p className="text-sm font-semibold" data-testid="choose-captain">
          {t('roster.chooseCaptain')}
        </p>
      )}
      {captainMessage() && (
        <p role="alert" className="text-sm text-starText">
          {captainMessage()}
        </p>
      )}
      <ol
        aria-label={t('roster.slots')}
        tabIndex={-1}
        data-focus-key="list"
        className="focus:outline-none"
      >
        {rows}
        {hasEmptySlot && <OpenSpotsItem count={openSpots} open={open} />}
      </ol>
      {canHide && (
        <Button
          variant="ghost"
          className="-ml-4"
          aria-expanded
          onClick={() => {
            restoreFocus.current = 'toggle';
            setCollapsed(true);
          }}
        >
          {t('roster.hideRacers')}
          <Chevron open />
        </Button>
      )}
      {showActions && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {available.length > 0 && (
            <Button
              data-focus-key="pick"
              onClick={() => {
                restoreFocus.current = 'pick';
                setPicker({});
              }}
            >
              {t('roster.pickFromPast', { count: available.length })}
            </Button>
          )}
          <Button
            variant={available.length > 0 ? 'secondary' : 'primary'}
            data-focus-key="add"
            onClick={() => openForm({ draft: emptyDraft })}
          >
            {t('roster.add')}
          </Button>
          {canAddMe && (
            <Button variant="secondary" data-focus-key="add-me" onClick={addYourself}>
              {t('roster.addYourself')}
            </Button>
          )}
        </div>
      )}
      {addingNew && active && formFor(t('roster.addTitle'), active.draft)}
      {picker && (
        <CrewPicker
          team={team}
          racers={available}
          openSpots={openSpots}
          reviewOnly={picker.reviewOnly}
          onAdded={(person, racer) => {
            setPickedFrom((now) => new Map(now).set(racer.email.toLowerCase(), person.id));
            awaitingPerson.current = person.id;
            clearError();
            setStatus(t('roster.added', { name: fullName(person) }));
            if (people.length + 1 >= race.people_per_team) {
              restoreFocus.current = 'list';
            }
          }}
          onForbidden={reportError}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
