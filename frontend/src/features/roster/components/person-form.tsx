import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EmailInput } from '@/components/inputs/email-input';
import { toApiPhone } from '@/components/inputs/format';
import { PhoneInput } from '@/components/inputs/phone-input';
import { useAutoAdvance } from '@/components/inputs/use-auto-advance';
import { ZipInput } from '@/components/inputs/zip-input';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import type { PersonPayload } from '@/features/roster/api/use-person-mutations';
import { emptyDraft, type PersonDraft } from '@/features/roster/utils';
import type { FieldErrors } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Race } from '@/types/api';

interface PersonFormProps {
  race: Race;
  initial?: PersonDraft;
  /** Accessible name for the form, e.g. "Add a racer". */
  title?: string;
  pending?: boolean;
  fieldErrors?: FieldErrors;
  formErrors?: string[];
  onSubmit: (person: PersonPayload) => void;
  onCancel: () => void;
}

const selectClass =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

export function PersonForm({
  race,
  initial = emptyDraft,
  title,
  pending = false,
  fieldErrors = {},
  formErrors = [],
  onSubmit,
  onCancel,
}: PersonFormProps) {
  const [draft, setDraft] = useState(initial);
  const [missingExperience, setMissingExperience] = useState(false);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const experienceRef = useRef<HTMLSelectElement>(null);
  const advance = useAutoAdvance();

  useEffect(() => {
    firstNameRef.current?.focus();
  }, []);

  const set = (field: keyof PersonDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.experience === '') {
      setMissingExperience(true);
      experienceRef.current?.focus();
      return;
    }
    onSubmit({
      first_name: draft.first_name.trim(),
      last_name: draft.last_name.trim(),
      email: draft.email.trim().toLowerCase(),
      phone: toApiPhone(draft.phone),
      zipcode: draft.zipcode.trim(),
      experience: Number(draft.experience),
      twitter: draft.twitter.trim(),
    });
  }

  return (
    <form
      aria-label={title}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4"
    >
      {formErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-star bg-white p-3 text-sm text-starText"
        >
          <ul className="space-y-0.5">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('roster.firstName')}
          name="first_name"
          error={fieldErrors.first_name}
        >
          <Input
            ref={firstNameRef}
            autoComplete="off"
            value={draft.first_name}
            onChange={(event) => set('first_name')(event.target.value)}
          />
        </Field>
        <Field
          label={t('roster.lastName')}
          name="last_name"
          error={fieldErrors.last_name}
        >
          <Input
            autoComplete="off"
            value={draft.last_name}
            onChange={(event) => set('last_name')(event.target.value)}
          />
        </Field>
      </div>
      <Field label={t('roster.email')} name="email" error={fieldErrors.email}>
        <EmailInput
          autoComplete="off"
          value={draft.email}
          onChange={set('email')}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('roster.phone')} name="phone" error={fieldErrors.phone}>
          <PhoneInput
            ref={phoneRef}
            autoComplete="off"
            value={draft.phone}
            onChange={set('phone')}
            onComplete={() => advance(phoneRef.current)}
          />
        </Field>
        {/* No auto-advance from ZIP: ZIP+4 users would be cut off. */}
        <Field label={t('roster.zip')} name="zipcode" error={fieldErrors.zipcode}>
          <ZipInput
            autoComplete="off"
            value={draft.zipcode}
            onChange={set('zipcode')}
          />
        </Field>
      </div>
      <Field
        label={t('roster.years')}
        name="experience"
        error={
          missingExperience
            ? [t('roster.yearsRequired')]
            : fieldErrors.experience
        }
        hint={
          <InfoTip label={t('roster.yearsTip')}>
            {t('roster.yearsTipBody')}
          </InfoTip>
        }
      >
        {(control) => (
          <select
            {...control}
            ref={experienceRef}
            value={draft.experience}
            onChange={(event) => {
              set('experience')(event.target.value);
              setMissingExperience(false);
            }}
            className={selectClass}
          >
            <option value="">{t('roster.yearsPlaceholder')}</option>
            {race.experience_labels.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field
        label={t('roster.twitter')}
        name="twitter"
        error={fieldErrors.twitter}
      >
        <Input
          autoComplete="off"
          autoCapitalize="none"
          placeholder={t('roster.twitterPlaceholder')}
          value={draft.twitter}
          onChange={(event) => set('twitter')(event.target.value)}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={pending}>
          {t('roster.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {t('roster.cancel')}
        </Button>
      </div>
    </form>
  );
}
