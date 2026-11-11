import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { InfoTip } from '@/components/ui/info-tip';
import { useUpdateTeam } from '@/features/teams/api/use-update-team';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

const controlClass =
  'block w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

export function EditTeamBasics({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const [experience, setExperience] = useState('');
  const [missingExperience, setMissingExperience] = useState(false);
  const experienceRef = useRef<HTMLSelectElement>(null);
  const updateTeam = useUpdateTeam(team.id);
  const { reportError } = useTeamPageError();

  function openForm() {
    setExperience(team.experience === null ? '' : String(team.experience));
    setMissingExperience(false);
    updateTeam.reset();
    setOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (experience === '') {
      setMissingExperience(true);
      experienceRef.current?.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    updateTeam.mutate(
      {
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '').trim(),
        experience: Number(experience),
      },
      {
        onSuccess: () => setOpen(false),
        onError: (error) => reportError(error),
      },
    );
  }

  if (!open) {
    return (
      <Button variant="ghost" aria-expanded={false} onClick={openForm}>
        {t('team.edit')}
      </Button>
    );
  }

  const error = updateTeam.error;
  const fieldErrors = error instanceof ApiError ? error.errors : {};
  const showGenericError =
    !!error &&
    Object.keys(fieldErrors).length === 0 &&
    !(error instanceof ApiError && error.status === 403);

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {showGenericError && (
        <div
          role="alert"
          className="rounded-md border border-star bg-white p-3 text-sm text-starText"
        >
          {t('common.genericError')}
        </div>
      )}
      <Field label={t('teams.name')} name="name" error={fieldErrors.name}>
        <Input autoComplete="off" defaultValue={team.name} required />
      </Field>
      <Field
        label={t('teams.description')}
        name="description"
        error={fieldErrors.description}
      >
        {(control) => (
          <textarea
            {...control}
            rows={3}
            defaultValue={team.description ?? ''}
            required
            className={controlClass}
          />
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
            {team.race.experience_labels.map((label, index) => (
              <option key={index} value={index}>
                {label}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={updateTeam.isPending}>
          {t('team.save')}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {t('team.cancel')}
        </Button>
      </div>
    </form>
  );
}
