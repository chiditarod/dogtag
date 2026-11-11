import { formatPhoneDisplay } from '@/components/inputs/format';
import type { PastRacer } from '@/features/roster/api/use-past-racers';
import { ApiError, type FieldErrors } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Person, Race } from '@/types/api';

/** Form state: every value is a string; `experience` is a label index or "". */
export interface PersonDraft {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  zipcode: string;
  experience: string;
  twitter: string;
}

export const emptyDraft: PersonDraft = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  zipcode: '',
  experience: '',
  twitter: '',
};

export const PERSON_FIELDS = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'zipcode',
  'experience',
  'twitter',
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
    zipcode: person.zipcode ?? '',
    experience: person.experience === null ? '' : String(person.experience),
    twitter: person.twitter ?? '',
  };
}

/** A returning racer has raced one more time than their last entry. */
export function draftFromPastRacer(racer: PastRacer, race: Race): PersonDraft {
  const lastIndex = Math.max(race.experience_labels.length - 1, 0);
  return {
    first_name: racer.first_name,
    last_name: racer.last_name,
    email: racer.email,
    phone: formatPhoneDisplay(racer.phone ?? ''),
    zipcode: racer.zipcode ?? '',
    experience:
      racer.experience === null
        ? ''
        : String(Math.min(racer.experience + 1, lastIndex)),
    twitter: racer.twitter ?? '',
  };
}

export const racerChipLabel = (racer: PastRacer) =>
  racer.last_raced_year
    ? `${fullName(racer)} · ${racer.last_raced_year}`
    : fullName(racer);

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
