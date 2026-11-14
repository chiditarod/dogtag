import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { useCreateTeam } from '@/features/teams/api/use-create-team';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Race } from '@/types/api';

const controlClass =
  'block w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

export function CreateTeamForm({ race }: { race: Race }) {
  const navigate = useNavigate();
  const createTeam = useCreateTeam();
  const [experience, setExperience] = useState('');
  const [missingExperience, setMissingExperience] = useState(false);
  const experienceRef = useRef<HTMLSelectElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (experience === '') {
      setMissingExperience(true);
      experienceRef.current?.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    createTeam.mutate(
      {
        raceId: race.id,
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '').trim(),
        experience: Number(experience),
      },
      { onSuccess: ({ team }) => navigate(`/teams/${team.id}`) },
    );
  }

  const error = createTeam.error;
  const fieldErrors = error instanceof ApiError ? error.errors : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const message =
    error && !hasFieldErrors
      ? error instanceof ApiError && error.status === 403 && error.error
        ? error.error
        : t('common.genericError')
      : null;

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message && (
        <div
          role="alert"
          className="rounded-md border border-star bg-white p-3 text-sm text-starText"
        >
          {message}
        </div>
      )}
      <Field label={t('teams.name')} name="name" error={fieldErrors.name}>
        <Input autoComplete="off" required />
      </Field>
      <Field
        label={t('teams.description')}
        name="description"
        error={fieldErrors.description}
      >
        {(control) => (
          <textarea {...control} rows={3} required className={controlClass} />
        )}
      </Field>
      <Field
        label={t('teams.experience')}
        name="experience"
        error={
          missingExperience
            ? [t('teams.experienceRequired')]
            : fieldErrors.experience
        }
        hint={
          <InfoTip label={t('teams.experienceTip')}>
            {t('teams.experienceTipBody')}
          </InfoTip>
        }
      >
        {(control) => (
          <select
            {...control}
            ref={experienceRef}
            value={experience}
            onChange={(event) => {
              setExperience(event.target.value);
              setMissingExperience(false);
            }}
            required
            className={`${controlClass} min-h-11`}
          >
            <option value="">{t('teams.experiencePlaceholder')}</option>
            {race.experience_labels.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Button type="submit" loading={createTeam.isPending} className="w-full">
        {t('teams.create')}
      </Button>
    </form>
  );
}
