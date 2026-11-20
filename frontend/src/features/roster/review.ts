import type { PastRacer } from '@/features/roster/api/use-past-racers';
import { fullName, type PersonDraft } from '@/features/roster/utils';
import type { FieldErrors } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Race } from '@/types/api';

export type LineKey =
  | 'name'
  | 'email'
  | 'phone'
  | 'experience'
  | 'instagram'
  | 'tiktok';

export const LINE_KEYS: readonly LineKey[] = [
  'name',
  'email',
  'phone',
  'experience',
  'instagram',
  'tiktok',
];

export interface LineState {
  confirmed: boolean;
  editing: boolean;
  error: string | null;
}

export type ReviewLines = Record<LineKey, LineState>;

export function lineLabel(key: LineKey): string {
  switch (key) {
    case 'name':
      return t('roster.name');
    case 'email':
      return t('roster.email');
    case 'phone':
      return t('roster.phone');
    case 'experience':
      return t('roster.years');
    case 'instagram':
      return t('roster.instagramLine');
    case 'tiktok':
      return t('roster.tiktokLine');
  }
}

/** Instagram and TikTok are optional, so it is never blank. */
export function isLineBlank(key: LineKey, draft: PersonDraft): boolean {
  switch (key) {
    case 'name':
      return !draft.first_name.trim() || !draft.last_name.trim();
    case 'instagram':
    case 'tiktok':
      return false;
    default:
      return !draft[key].trim();
  }
}

export const missingMessage = (key: LineKey) =>
  t('roster.missing', { label: lineLabel(key) });

/** Blank required lines start open, with the missing message. */
export function initialLines(draft: PersonDraft): ReviewLines {
  return Object.fromEntries(
    LINE_KEYS.map((key) => {
      const blank = isLineBlank(key, draft);
      const state: LineState = {
        confirmed: false,
        editing: blank,
        error: blank ? missingMessage(key) : null,
      };
      return [key, state];
    }),
  ) as ReviewLines;
}

export function lineValue(key: LineKey, draft: PersonDraft, race: Race): string {
  switch (key) {
    case 'name':
      return fullName(draft);
    case 'experience':
      return draft.experience === ''
        ? ''
        : (race.experience_labels[Number(draft.experience)] ?? '');
    case 'instagram':
    case 'tiktok':
      return draft[key].trim() || t('roster.none');
    default:
      return draft[key];
  }
}

/** Says what the years value was when carrying it forward changed it. */
export function experienceNote(
  racer: PastRacer,
  draft: PersonDraft,
  race: Race,
): string | null {
  if (racer.experience === null || draft.experience === '') return null;
  if (Number(draft.experience) === racer.experience) return null;
  const label = race.experience_labels[racer.experience];
  return label === undefined ? null : t('roster.yearsWas', { label });
}

/** Server field errors reopen their lines, unconfirmed, with the first message. */
export function applyFieldErrors(
  lines: ReviewLines,
  fieldErrors: FieldErrors,
): ReviewLines {
  const next = { ...lines };
  for (const key of LINE_KEYS) {
    const names = key === 'name' ? ['first_name', 'last_name'] : [key];
    const message = names.map((name) => fieldErrors[name]?.[0]).find(Boolean);
    if (message) next[key] = { confirmed: false, editing: true, error: message };
  }
  return next;
}

/** An open editor never counts as confirmed, whatever its flag says. */
export const unconfirmedCount = (lines: ReviewLines): number =>
  LINE_KEYS.filter((key) => !lines[key].confirmed || lines[key].editing).length;
