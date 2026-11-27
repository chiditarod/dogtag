import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { StaffUser } from '../api/types';
import { useDeleteStaffUser } from '../api/use-staff-users';
import { userName } from './users-table';

function ConfirmDelete({ user, onClose, onDeleted }: { user: StaffUser; onClose: () => void; onDeleted: () => void }) {
  const titleId = useId();
  const navigate = useNavigate();
  const remove = useDeleteStaffUser(user.id);
  const pending = remove.isPending;
  const message =
    remove.error instanceof ApiError ? remove.error.error || t('common.genericError') : t('common.genericError');

  return (
    // Escape and Cancel do nothing while the request is in flight.
    <DialogSheet labelledBy={titleId} onClose={() => !pending && onClose()}>
      <div className="space-y-3 px-4 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold [overflow-wrap:anywhere]">
          {t('staff.users.deleteTitle', { name: userName(user) })}
        </h2>
        {remove.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t('staff.users.deleteCancel')}
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  // The user is gone, so unsaved edits must not be asked about.
                  onDeleted();
                  navigate('/staff/users');
                },
              })
            }
          >
            {t('staff.users.delete')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

/** Admins only (`can_destroy`). A user the server won't delete shows a disabled button and its reason. */
export function DeleteUser({ user, onDeleted }: { user: StaffUser; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const blockedId = useId();
  if (!user.can_destroy) return null;
  const blocked = user.delete_blocker;

  return (
    <div className="max-w-xs space-y-2">
      <Button
        variant="secondary"
        disabled={blocked !== null}
        aria-describedby={blocked ? blockedId : undefined}
        onClick={() => setOpen(true)}
      >
        {t('staff.users.delete')}
      </Button>
      {blocked && (
        <p id={blockedId} className="text-sm text-navy/70">
          {blocked}
        </p>
      )}
      {open && <ConfirmDelete user={user} onClose={() => setOpen(false)} onDeleted={onDeleted} />}
    </div>
  );
}
