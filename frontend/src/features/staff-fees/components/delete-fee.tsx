import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Fee } from '../api/types';
import { useDeleteFee } from '../api/use-staff-fees';

function ConfirmDelete({ fee, onClose, onDeleted }: { fee: Fee; onClose: () => void; onDeleted: () => void }) {
  const titleId = useId();
  const navigate = useNavigate();
  const remove = useDeleteFee(fee.id);
  const pending = remove.isPending;
  const message =
    remove.error instanceof ApiError ? remove.error.error || t('common.genericError') : t('common.genericError');

  return (
    // Escape and Cancel do nothing while the request is in flight.
    <DialogSheet labelledBy={titleId} onClose={() => !pending && onClose()}>
      <div className="space-y-3 px-4 py-4">
        <h2 id={titleId} className="font-display text-xl font-semibold [overflow-wrap:anywhere]">
          {t('staff.fees.deleteTitle', { name: fee.name })}
        </h2>
        <p className="text-sm">{t('staff.fees.deleteBody')}</p>
        {remove.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {message}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            {t('staff.fees.deleteCancel')}
          </Button>
          <Button
            loading={pending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  // The fee is gone, so an unsaved name must not be asked about.
                  onDeleted();
                  navigate(`/staff/races/${fee.race_id}`);
                },
              })
            }
          >
            {t('staff.fees.delete')}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}

/**
 * Admins only (`can_destroy`). A fee that teams have paid cannot be deleted, so the button is
 * disabled with the server's reason.
 */
export function DeleteFee({ fee, onDeleted }: { fee: Fee; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const blockedId = useId();
  if (!fee.can_destroy) return null;
  const blocked = fee.destroy_blocked_reason;

  return (
    <div className="max-w-xs space-y-2">
      <Button
        variant="secondary"
        disabled={blocked !== null}
        aria-describedby={blocked ? blockedId : undefined}
        onClick={() => setOpen(true)}
      >
        {t('staff.fees.delete')}
      </Button>
      {blocked && (
        <p id={blockedId} className="text-sm text-navy/70">
          {blocked}
        </p>
      )}
      {open && <ConfirmDelete fee={fee} onClose={() => setOpen(false)} onDeleted={onDeleted} />}
    </div>
  );
}
