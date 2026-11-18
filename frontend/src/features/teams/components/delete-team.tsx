import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { useDeleteTeam } from '@/features/teams/api/use-delete-team';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

/** Lets a captain throw away a team they started but have not finished or paid for. */
export function DeleteTeam({ team }: { team: Team }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const navigate = useNavigate();
  const deleteTeam = useDeleteTeam(team.id);

  if (!team.deletable || !team.race.open_for_registration) return null;

  function confirm() {
    deleteTeam.mutate(undefined, {
      onSuccess: () => navigate('/teams', { replace: true }),
    });
  }

  const message =
    deleteTeam.error instanceof ApiError && deleteTeam.error.status === 403
      ? t('team.deleteRefused')
      : deleteTeam.error
        ? t('common.genericError')
        : null;

  return (
    <>
      <div>
        <Button variant="ghost" className="-mx-4 text-starText" onClick={() => setOpen(true)}>
          {t('team.delete')}
        </Button>
      </div>
      {open && (
        <DialogSheet
          labelledBy={titleId}
          onClose={() => {
            if (!deleteTeam.isPending) setOpen(false);
          }}
        >
          <div className="space-y-4 p-5">
            <h2 id={titleId} className="font-display text-xl font-bold">
              {t('team.deleteTitle', { name: team.name })}
            </h2>
            <p>{t('team.deleteBody')}</p>
            {message && (
              <p role="alert" className="text-sm text-starText">
                {message}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" disabled={deleteTeam.isPending} onClick={() => setOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button loading={deleteTeam.isPending} onClick={confirm}>
                {t('team.deleteConfirm')}
              </Button>
            </div>
          </div>
        </DialogSheet>
      )}
    </>
  );
}
