import { formatPhoneDisplay, toApiPhone } from '@/components/inputs/format';
import type { User } from '@/features/auth/api/use-me';
import type { PersonPayload } from '@/features/roster/api/use-person-mutations';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import { ApiError, type FieldErrors } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Person } from '@/types/api';

/** Form state: every value is a string; `experience` is the typed number of years or "". */
export interface PersonDraft {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  experience: string;
  instagram: string;
  tiktok: string;
}

export const emptyDraft: PersonDraft = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  experience: '',
  instagram: '',
  tiktok: '',
};

export const PERSON_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'experience',
  'instagram',
  'tiktok',
] as const;

export const fullName = (person: { first_name: string; last_name: string }) =>
  `${person.first_name} ${person.last_name}`.trim();

export const initials = (person: { first_name: string; last_name: string }) =>
  `${person.first_name.charAt(0)}${person.last_name.charAt(0)}`.toUpperCase();

export function draftFromPerson(person: Person): PersonDraft {
  return {
    first_name: person.first_name,
    last_name: person.last_name,
    email: person.email,
    phone: formatPhoneDisplay(person.phone ?? ''),
    experience: person.experience === null ? '' : String(person.experience),
    instagram: person.instagram ?? '',
    tiktok: person.tiktok ?? '',
  };
}

export const MAX_YEARS = 99;

/** "1 year racing", "12 years racing". */
export const yearsCount = (count: number) =>
  t(count === 1 ? 'roster.yearsCount_one' : 'roster.yearsCount_other', { count });

/** Years racing must be typed as digits; the server enforces the 0-99 range. */
export const yearsProblem = (value: string): string | null =>
  /^\d+$/.test(value.trim()) ? null : t('roster.yearsRequired');

/** Same shape rule as `Person`'s email format validation. */
const EMAIL_SHAPE = /^[^@\s]+@([-a-z0-9]+\.)+[a-z]{2,}$/i;

/**
 * What is wrong with an email the racer just tabbed out of, or null. Blank is
 * left to the required check; `otherEmails` are the rest of the roster, never
 * the person being edited.
 */
export function emailProblem(email: string, otherEmails: readonly string[]): string | null {
  const value = email.trim().toLowerCase();
  if (!value) return null;
  if (!EMAIL_SHAPE.test(value)) return t('roster.emailInvalid');
  if (otherEmails.some((other) => other.trim().toLowerCase() === value)) {
    return t('roster.emailOnTeam');
  }
  return null;
}

/** A returning racer has raced one more time than their last entry. */
export function draftFromPastRacer(racer: PastRacer): PersonDraft {
  return {
    first_name: racer.first_name,
    last_name: racer.last_name,
    email: racer.email,
    phone: formatPhoneDisplay(racer.phone ?? ''),
    experience:
      racer.experience === null
        ? ''
        : String(Math.min(racer.experience + 1, MAX_YEARS)),
    instagram: racer.instagram ?? '',
    tiktok: racer.tiktok ?? '',
  };
}

/** The signed-in captain adding themselves: only what the account knows. */
export function draftFromUser(user: User): PersonDraft {
  return {
    ...emptyDraft,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: formatPhoneDisplay(user.phone ?? ''),
  };
}

/**
 * Trims every field, lowercases the email, converts the phone to ddd-ddd-dddd.
 * A blank years value is sent as null, so the server rejects it too.
 */
export function payloadFromDraft(draft: PersonDraft): PersonPayload {
  return {
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    email: draft.email.trim().toLowerCase(),
    phone: toApiPhone(draft.phone),
    experience: draft.experience === '' ? null : Number(draft.experience),
    instagram: draft.instagram.trim(),
    tiktok: draft.tiktok.trim(),
  };
}

/**
 * Splits a failed person mutation into per-field messages and form-level
 * messages (`maximum`, `generic`, anything else). 403s are shown by the page
 * banner, so they produce nothing here.
 */
export function splitPersonErrors(error: unknown): {
  fieldErrors: FieldErrors;
  formErrors: string[];
} {
  if (!error) return { fieldErrors: {}, formErrors: [] };
  if (error instanceof ApiError) {
    if (error.status === 403) return { fieldErrors: {}, formErrors: [] };
    const fieldErrors: FieldErrors = {};
    const formErrors: string[] = [];
    for (const [key, messages] of Object.entries(error.errors)) {
      if ((PERSON_FIELDS as readonly string[]).includes(key)) {
        fieldErrors[key] = messages;
      } else {
        formErrors.push(...messages);
      }
    }
    const hasErrors = Object.keys(fieldErrors).length > 0 || formErrors.length > 0;
    return {
      fieldErrors,
      formErrors: hasErrors ? formErrors : [t('common.genericError')],
    };
  }
  return { fieldErrors: {}, formErrors: [t('common.genericError')] };
}
