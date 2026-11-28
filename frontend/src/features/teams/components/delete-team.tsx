import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { useDeleteTeam } from '@/features/teams/api/use-delete-team';
import { racerPermissions, type TeamPermissions } from '@/features/teams/permissions';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

interface DeleteTeamDialogProps {
  teamId: number;
  teamName: string;
  /** Called after the server deleted the team. */
  onDeleted: () => void;
  onClose: () => void;
}

/** The confirm sheet: deletes the team, and explains a refusal. Close does nothing while a delete is in flight. */
export function DeleteTeamDialog({ teamId, teamName, onDeleted, onClose }: DeleteTeamDialogProps) {
  const titleId = useId();
  const deleteTeam = useDeleteTeam(teamId);

  function confirm() {
    deleteTeam.mutate(undefined, { onSuccess: onDeleted });
  }

  const message =
    deleteTeam.error instanceof ApiError && deleteTeam.error.status === 403
      ? t('team.deleteRefused')
      : deleteTeam.error
        ? t('common.genericError')
        : null;

  return (
    <DialogSheet
      labelledBy={titleId}
      onClose={() => {
        if (!deleteTeam.isPending) onClose();
      }}
    >
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="font-display text-xl font-bold">
          {t('team.deleteTitle', { name: teamName })}
        </h2>
        <p>{t('team.deleteBody')}</p>
        {message && (
          <p role="alert" className="text-sm text-starText">
            {message}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" disabled={deleteTeam.isPending} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button loading={deleteTeam.isPending} onClick={confirm}>
            {t('team.deleteConfirm')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

/** Lets a captain throw away a team they started but have not finished or paid for. */
export function DeleteTeam({
  team,
  permissions = racerPermissions(team),
}: {
  team: Team;
  permissions?: TeamPermissions;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  if (!permissions.deleteTeam) return null;

  return (
    <>
      <div>
        <Button variant="ghost" className="-mx-4 text-starText" onClick={() => setOpen(true)}>
          {t('team.delete')}
        </Button>
      </div>
      {open && (
        <DeleteTeamDialog
          teamId={team.id}
          teamName={team.name}
          onDeleted={() => navigate('/teams', { replace: true })}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
