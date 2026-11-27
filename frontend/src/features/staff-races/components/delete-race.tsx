import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { StaffRace } from '../api/types';
import { useDeleteRace } from '../api/use-staff-races';

function ConfirmDelete({ race, onClose }: { race: StaffRace; onClose: () => void }) {
  const titleId = useId();
  const navigate = useNavigate();
  const remove = useDeleteRace(race.id);
  const pending = remove.isPending;
  const message =
    remove.error instanceof ApiError ? remove.error.error || t('common.genericError') : t('common.genericError');

  return (
    // Escape and Cancel do nothing while the request is in flight.
    <DialogSheet labelledBy={titleId} onClose={() => !pending && onClose()}>
      <div className="space-y-3 px-4 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold [overflow-wrap:anywhere]">
          {t('staff.race.deleteTitle', { name: race.name })}
        </h2>
        <p className="text-sm">{t('staff.race.deleteBody')}</p>
        {remove.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t('staff.race.deleteCancel')}
          </Button>
          <Button
            loading={pending}
            onClick={() => remove.mutate(undefined, { onSuccess: () => navigate('/staff/races') })}
          >
            {t('staff.race.delete')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

/** Admins only (`can_destroy`). A race that has teams cannot be deleted, so the button is disabled with the reason. */
export function DeleteRace({ race }: { race: StaffRace }) {
  const [open, setOpen] = useState(false);
  const blockedId = useId();
  if (!race.can_destroy) return null;

  return (
    <div className="space-y-2">
      <Button
        variant="secondary"
        disabled={race.has_teams}
        aria-describedby={race.has_teams ? blockedId : undefined}
        onClick={() => setOpen(true)}
      >
        {t('staff.race.delete')}
      </Button>
      {race.has_teams && (
        <p id={blockedId} className="text-sm text-navy/70">
          {t('staff.race.deleteBlocked')}
        </p>
      )}
      {open && <ConfirmDelete race={race} onClose={() => setOpen(false)} />}
    </div>
  );
}
