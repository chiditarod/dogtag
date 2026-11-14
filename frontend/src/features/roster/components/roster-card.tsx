import { useEffect, useRef, useState } from 'react';
import { useMe } from '@/features/auth/api/use-me';
import {
  usePastRacers,
  type PastRacer,
} from '@/features/roster/api/use-past-racers';
import {
  useAddPerson,
  useRemovePerson,
  useUpdatePerson,
  type PersonPayload,
} from '@/features/roster/api/use-person-mutations';
import { PastRacerList } from '@/features/roster/components/past-racer-list';
import { PersonForm } from '@/features/roster/components/person-form';
import {
  EmptySlot,
  FilledSlot,
  SlotItem,
} from '@/features/roster/components/roster-slot';
import {
  draftFromPastRacer,
  draftFromPerson,
  emptyDraft,
  fullName,
  splitPersonErrors,
  type PersonDraft,
} from '@/features/roster/utils';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

interface ActiveForm {
  /** Slot index the form is rendered in. */
  slot: number;
  /** Present when editing an existing person. */
  personId?: number;
  draft: PersonDraft;
}

export function RosterCard({ team }: { team: Team }) {
  const { race, people, checklist } = team;
  const me = useMe().data;
  const { reportError, clearError } = useTeamPageError();
  const open = race.open_for_registration;
  const slotCount = Math.max(race.people_per_team, people.length);
  const hasEmptySlot = people.length < slotCount;

  const [active, setActive] = useState<ActiveForm | null>(null);
  const [picker, setPicker] = useState<{ slot: number } | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const listRef = useRef<HTMLOListElement>(null);
  const restoreFocus = useRef<string | null>(null);

  const add = useAddPerson(team.id);
  const update = useUpdatePerson(team.id, active?.personId);
  const remove = useRemovePerson(team.id);
  const save = active?.personId === undefined ? add : update;

  const pastRacers = usePastRacers(team.id, open && hasEmptySlot);
  const emailsOnTeam = new Set(people.map((person) => person.email.toLowerCase()));
  const available = (pastRacers.data ?? []).filter(
    (racer) => !emailsOnTeam.has(racer.email.toLowerCase()),
  );

  // Put focus back on the control that opened a form or confirmation.
  useEffect(() => {
    const key = restoreFocus.current;
    if (!key || active || removing !== null) return;
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-focus-key="${key}"]`,
    );
    if (target) {
      target.focus();
      restoreFocus.current = null;
    }
  }, [active, removing, people]);

  const captainId = people.find(
    (person) => person.email.toLowerCase() === me?.email.toLowerCase(),
  )?.id;

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

  function pickRacer(racer: PastRacer, slot: number) {
    setPicker(null);
    openForm({ slot, draft: draftFromPastRacer(racer, race) });
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
        closeForm(`edit-${saved.id}`);
      },
      onError: (error) => reportError(error),
    });
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
  const canRemove = open && !checklist.finalized;

  const formFor = (title: string, initial: PersonDraft) => (
    <PersonForm
      race={race}
      title={title}
      initial={initial}
      pending={save.isPending}
      fieldErrors={fieldErrors}
      formErrors={formErrors}
      onSubmit={submit}
      onCancel={() =>
        closeForm(
          active?.personId === undefined
            ? `add-${active?.slot}`
            : `edit-${active.personId}`,
        )
      }
    />
  );

  return (
    <div className="space-y-3">
      <p role="status" className="sr-only">
        {status}
      </p>
      <ol
        ref={listRef}
        aria-label={t('roster.slots')}
        tabIndex={-1}
        data-focus-key="list"
        className="space-y-2 focus:outline-none"
      >
        {Array.from({ length: slotCount }, (_, index) => {
          const person = people[index];
          if (person) {
            if (active?.personId === person.id) {
              return (
                <SlotItem key={person.id}>
                  {formFor(
                    t('roster.editTitle', { name: fullName(person) }),
                    active.draft,
                  )}
                </SlotItem>
              );
            }
            return (
              <SlotItem key={person.id}>
                <FilledSlot
                  person={person}
                  experienceLabel={
                    person.experience === null
                      ? undefined
                      : race.experience_labels[person.experience]
                  }
                  captain={person.id === captainId}
                  canEdit
                  canRemove={canRemove}
                  confirmingRemove={removing === person.id}
                  removing={remove.isPending}
                  removeError={removing === person.id ? removeMessage() : null}
                  onEdit={() =>
                    openForm({
                      slot: index,
                      personId: person.id,
                      draft: draftFromPerson(person),
                    })
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
                  onConfirmRemove={() =>
                    confirmRemove(person.id, person.first_name)
                  }
                />
              </SlotItem>
            );
          }
          return (
            <SlotItem key={`empty-${index}`}>
              {active?.personId === undefined && active?.slot === index ? (
                formFor(t('roster.addTitle'), active.draft)
              ) : (
                <EmptySlot
                  index={index}
                  canAdd={open}
                  pastRacers={available}
                  onAdd={() => openForm({ slot: index, draft: emptyDraft })}
                  onPick={(racer) => pickRacer(racer, index)}
                  onShowMore={() => setPicker({ slot: index })}
                />
              )}
            </SlotItem>
          );
        })}
      </ol>
      {picker && (
        <PastRacerList
          racers={available}
          onPick={(racer) => pickRacer(racer, picker.slot)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
