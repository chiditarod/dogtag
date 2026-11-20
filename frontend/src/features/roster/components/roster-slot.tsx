import { useEffect, useRef, type ReactNode } from 'react';
import { formatPhoneDisplay } from '@/components/inputs/format';
import { Button } from '@/components/ui/button';
import { ChicagoStar } from '@/components/ui/chicago-star';
import { fullName, initials } from '@/features/roster/utils';
import { t } from '@/locales/en';
import type { Person } from '@/types/api';

export function Avatar({ person }: { person: Person }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-flag font-sans text-sm font-semibold text-navy"
    >
      {initials(person)}
    </span>
  );
}

interface FilledSlotProps {
  person: Person;
  /** "12 years racing"; absent when the racer has no years yet. */
  experienceLabel: string | undefined;
  captain: boolean;
  /** Shown on every other racer while registration is open; absent hides the button. */
  onMakeCaptain?: () => void;
  /** A captain change is in flight: every Make captain button waits. */
  settingCaptain?: boolean;
  /** Edit is allowed through the final-edits window. */
  canEdit: boolean;
  canRemove: boolean;
  confirmingRemove: boolean;
  removing: boolean;
  removeError: string | null;
  onEdit: () => void;
  onAskRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
}

export function FilledSlot({
  person,
  experienceLabel,
  captain,
  onMakeCaptain,
  settingCaptain = false,
  canEdit,
  canRemove,
  confirmingRemove,
  removing,
  removeError,
  onEdit,
  onAskRemove,
  onCancelRemove,
  onConfirmRemove,
}: FilledSlotProps) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmingRemove) keepRef.current?.focus();
  }, [confirmingRemove]);

  const name = fullName(person);

  return (
    <div
      className={`space-y-3 ${captain ? '-mx-2 rounded-md bg-flag/30 px-2 py-2' : ''}`}
      data-captain={captain ? 'true' : undefined}
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Avatar person={person} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{name}</p>
              {captain && (
                <>
                  <span data-testid="captain-star" className="flex shrink-0">
                    <ChicagoStar filled className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-navy px-2 py-0.5 text-xs font-semibold text-white">
                    {t('roster.captain')}
                  </span>
                </>
              )}
            </div>
            <p className="truncate text-sm text-navy/80" title={person.email}>
              {person.email}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-navy/80">
              {person.phone && (
                <span className="whitespace-nowrap">{formatPhoneDisplay(person.phone)}</span>
              )}
              {person.instagram && <span className="whitespace-nowrap">{person.instagram}</span>}
              {person.tiktok && <span className="whitespace-nowrap">{person.tiktok}</span>}
            </div>
            {experienceLabel && <p className="text-xs text-navy/60">{experienceLabel}</p>}
          </div>
        </div>
        {!confirmingRemove && (
          <div className="flex flex-wrap gap-1 pl-[3.25rem] sm:shrink-0 sm:flex-nowrap sm:pl-0">
            {canEdit && (
              <Button
                variant="ghost"
                className="sm:min-h-9"
                aria-label={`${t('roster.edit')} ${name}`}
                data-focus-key={`edit-${person.id}`}
                onClick={onEdit}
              >
                {t('roster.edit')}
              </Button>
            )}
            {onMakeCaptain && !captain && (
              <Button
                variant="ghost"
                className="sm:min-h-9"
                aria-label={t('roster.makeCaptainLabel', { name })}
                data-focus-key={`captain-${person.id}`}
                disabled={settingCaptain}
                onClick={onMakeCaptain}
              >
                {t('roster.makeCaptain')}
              </Button>
            )}
            {canRemove && (
              <Button
                variant="ghost"
                className="sm:min-h-9"
                aria-label={`${t('roster.remove')} ${name}`}
                data-focus-key={`remove-${person.id}`}
                onClick={onAskRemove}
              >
                {t('roster.remove')}
              </Button>
            )}
          </div>
        )}
      </div>
      {confirmingRemove && (
        <div className="space-y-2 rounded-md border border-flag bg-page p-3">
          <p className="text-sm font-semibold">
            {t('roster.confirmRemove', { name: person.first_name })}
          </p>
          {removeError && (
            <p role="alert" className="text-sm text-starText">
              {removeError}
            </p>
          )}
          <div className="flex gap-2">
            <Button loading={removing} onClick={onConfirmRemove}>
              {t('roster.confirmYes')}
            </Button>
            <Button ref={keepRef} variant="secondary" onClick={onCancelRemove}>
              {t('roster.confirmKeep')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const rowClass = 'border-t border-flag/60 py-3 first:border-t-0 first:pt-0 last:pb-0';

export function SlotItem({ children }: { children: ReactNode }) {
  return <li className={rowClass}>{children}</li>;
}

/** One row for every open spot: a dashed circle each, then the count. */
export function OpenSpotsItem({ count, open }: { count: number; open: boolean }) {
  const key = open ? 'roster.spotsToFill' : 'roster.openSpots';
  return (
    <li className={`${rowClass} flex flex-wrap items-center gap-3 font-semibold`}>
      <span aria-hidden="true" className="flex flex-wrap gap-1.5">
        {Array.from({ length: count }, (_, index) => (
          <span
            key={index}
            className="h-6 w-6 rounded-full border-2 border-dashed border-flag"
          />
        ))}
      </span>
      {t(count === 1 ? `${key}_one` : `${key}_other`, { count })}
    </li>
  );
}
