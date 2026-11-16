import { useId, useRef, useState } from 'react';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import {
  useAddPerson,
  type PersonPayload,
} from '@/features/roster/api/use-person-mutations';
import {
  CrewPickList,
  SEARCH_THRESHOLD,
} from '@/features/roster/components/crew-pick-list';
import { CrewReview, type ReportFieldErrors } from '@/features/roster/components/crew-review';
import { splitPersonErrors } from '@/features/roster/utils';
import { ApiError } from '@/lib/api-client';
import type { Person, Team } from '@/types/api';

interface CrewPickerProps {
  team: Team;
  /** Past racers who are not already on the team. */
  racers: PastRacer[];
  openSpots: number;
  /** Skips the list and reviews this one person ("Add yourself"). */
  reviewOnly?: PastRacer;
  /** `racer` is the past racer the person came from; their email may have changed. */
  onAdded: (person: Person, racer: PastRacer) => void;
  /** A 403: the parent shows the page banner and this dialog closes itself. */
  onForbidden: (error: unknown) => void;
  onClose: () => void;
}

/**
 * Pick several past racers from a checklist, then confirm each person's six
 * details one at a time. Each person is saved as soon as they are confirmed.
 */
export function CrewPicker({
  team,
  racers,
  openSpots,
  reviewOnly,
  onAdded,
  onForbidden,
  onClose,
}: CrewPickerProps) {
  const titleId = useId();
  const add = useAddPerson(team.id);
  const [step, setStep] = useState<'pick' | 'review'>(reviewOnly ? 'review' : 'pick');
  const [picked, setPicked] = useState<string[]>([]);
  // A snapshot taken when "Review N racers" is pressed, in tick order.
  const [queue, setQueue] = useState<PastRacer[]>(reviewOnly ? [reviewOnly] : []);
  const [position, setPosition] = useState(0);
  // `add.isPending` lags a render behind, so a double tap needs its own guard.
  const saving = useRef(false);

  const current = queue[position];

  function toggle(email: string) {
    setPicked((now) =>
      now.includes(email) ? now.filter((e) => e !== email) : [...now, email],
    );
  }

  function startReview() {
    setQueue(
      picked.flatMap((email) => racers.find((racer) => racer.email === email) ?? []),
    );
    setPosition(0);
    setStep('review');
  }

  function next() {
    add.reset();
    if (position + 1 < queue.length) setPosition(position + 1);
    else onClose();
  }

  function backToList() {
    add.reset();
    setPicked(queue.slice(position).map((racer) => racer.email));
    setStep('pick');
  }

  // Closing mid-save would still save the person, but skip the success
  // handling below, so Close and Escape wait for the save to finish.
  function requestClose() {
    if (!saving.current) onClose();
  }

  function save(payload: PersonPayload, reportFieldErrors: ReportFieldErrors) {
    if (saving.current) return;
    saving.current = true;
    const racer = current;
    add.mutate(payload, {
      onSuccess: ({ person }) => {
        onAdded(person, racer);
        next();
      },
      onError: (error) => {
        if (error instanceof ApiError && error.status === 403) {
          onForbidden(error);
          onClose();
          return;
        }
        reportFieldErrors(splitPersonErrors(error).fieldErrors);
      },
      onSettled: () => {
        saving.current = false;
      },
    });
  }

  const picking = step === 'pick' || !current;
  // A searchable list gets a fixed height so the dialog does not shrink and
  // jump as the search narrows it.
  const height =
    picking && racers.length > SEARCH_THRESHOLD
      ? 'h-[90dvh] sm:h-[min(40rem,90dvh)]'
      : undefined;

  return (
    <DialogSheet labelledBy={titleId} onClose={requestClose} className={height}>
      {picking ? (
        <CrewPickList
          titleId={titleId}
          racers={racers}
          picked={picked}
          openSpots={openSpots}
          onToggle={toggle}
          onReview={startReview}
          onClose={requestClose}
        />
      ) : (
        <CrewReview
          key={current.email}
          titleId={titleId}
          racer={current}
          race={team.race}
          index={position + 1}
          total={queue.length}
          pending={add.isPending}
          formErrors={splitPersonErrors(add.error).formErrors}
          onSave={save}
          onSkip={next}
          onBack={reviewOnly ? undefined : backToList}
          onClose={requestClose}
        />
      )}
    </DialogSheet>
  );
}
