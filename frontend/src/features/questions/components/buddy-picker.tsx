import { useId, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import type { BuddyOption, BuddySelection } from '@/features/questions/types';
import { t } from '@/locales/en';

export const OTHER_BUDDIES_MAX_LENGTH = 1000;

const controlClass =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';
const choiceClass = 'flex min-h-11 items-center gap-3 rounded-md px-1 text-base text-navy';
const markClass = 'size-5 shrink-0 accent-link focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

interface BuddyPickerProps {
  options: BuddyOption[];
  value: BuddySelection;
  onChange: (value: BuddySelection) => void;
  disabled?: boolean;
  /** Server-side messages to show on the picker. */
  error?: string[];
}

/** Frame shared by the picker and its loading/error states. */
export function BuddyFieldset({
  children,
  describedBy,
}: {
  children: ReactNode;
  describedBy?: string;
}) {
  return (
    <fieldset className="min-w-0 space-y-3" aria-describedby={describedBy}>
      <legend className="font-heading text-lg font-medium text-navy">
        {t('questions.buddies.legend')}
      </legend>
      {children}
    </fieldset>
  );
}

export function BuddyPicker({ options, value, onChange, disabled, error }: BuddyPickerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) => option.name.toLowerCase().includes(needle))
    : options;
  const hasError = !!error?.length;

  function toggleTeam(teamId: number, checked: boolean) {
    const teamIds = checked
      ? [...value.teamIds, teamId]
      : value.teamIds.filter((existing) => existing !== teamId);
    onChange({ ...value, teamIds });
  }

  return (
    <BuddyFieldset describedBy={[hintId, hasError && errorId].filter(Boolean).join(' ')}>
      <p id={hintId} className="text-sm text-navy/80">
        {t('questions.buddies.hint')}
      </p>
      {options.length === 0 ? (
        <p className="text-base text-navy">{t('questions.buddies.empty')}</p>
      ) : (
        <>
          <input
            type="search"
            className={controlClass}
            aria-label={t('questions.buddies.search')}
            placeholder={t('questions.buddies.search')}
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              // Enter in the search box must not submit the surrounding form.
              if (event.key === 'Enter') event.preventDefault();
            }}
          />
          {visible.length === 0 ? (
            <p className="text-base text-navy">{t('questions.buddies.noMatches')}</p>
          ) : (
            <ul className="grid max-h-64 grid-cols-[minmax(0,1fr)] overflow-y-auto rounded-md border border-flag px-2">
              {visible.map((option) => {
                const status = t(
                  option.finalized ? 'questions.buddies.registered' : 'questions.buddies.inProgress',
                );
                return (
                  <li key={option.id}>
                    <label className={choiceClass}>
                      <input
                        type="checkbox"
                        className={markClass}
                        aria-label={`${option.name}, ${status}`}
                        checked={value.teamIds.includes(option.id)}
                        disabled={disabled}
                        onChange={(event) => toggleTeam(option.id, event.target.checked)}
                      />
                      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{option.name}</span>
                      <Badge tone={option.finalized ? 'success' : 'neutral'} className="shrink-0">
                        {status}
                      </Badge>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
      <label className={choiceClass}>
        <input
          type="checkbox"
          className={markClass}
          checked={value.otherSelected}
          disabled={disabled}
          onChange={(event) => onChange({ ...value, otherSelected: event.target.checked })}
        />
        {t('questions.buddies.other')}
      </label>
      {value.otherSelected && (
        <div className="space-y-1">
          <label htmlFor={`${id}-other`} className="block text-base font-semibold text-navy">
            {t('questions.buddies.otherLabel')}
          </label>
          <textarea
            id={`${id}-other`}
            rows={3}
            maxLength={OTHER_BUDDIES_MAX_LENGTH}
            className={controlClass}
            value={value.otherText}
            disabled={disabled}
            onChange={(event) => onChange({ ...value, otherText: event.target.value })}
          />
        </div>
      )}
      {hasError && (
        <div id={errorId} role="alert" className="space-y-1 text-sm text-starText">
          {error.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      )}
    </BuddyFieldset>
  );
}
