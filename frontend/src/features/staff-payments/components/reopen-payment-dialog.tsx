import { useEffect, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { useReopenPayment } from '../api/use-reopen-payment';
import type { StaffPayment } from '../types';
import { formatMoney } from '../utils';

function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return t('staff.reopen.error.generic');
  switch (error.code) {
    case 'not_refunded':
    case 'in_progress':
      return t(`staff.reopen.error.${error.code}`);
    default:
      return error.error || t('staff.reopen.error.generic');
  }
}

/** Asks before reopening one refunded payment; the list refreshes itself when the call succeeds. */
export function ReopenPaymentDialog({ payment, onClose }: { payment: StaffPayment; onClose: () => void }) {
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reopen = useReopenPayment();
  const submitting = reopen.isPending;

  useEffect(() => titleRef.current?.focus(), []);

  return (
    // Escape and Cancel do nothing while the request is in flight, and the backdrop never closes.
    <DialogSheet labelledBy={titleId} onClose={() => !submitting && onClose()} className="sm:max-w-md">
      <div className="space-y-2 px-4 py-3">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-xl font-semibold focus:outline-none">
          {t('staff.reopen.title')}
        </h2>
        <p className="text-sm font-semibold [overflow-wrap:anywhere]">
          {t('staff.reopen.what', {
            team: payment.team.name,
            type: payment.payment_type,
            amount: formatMoney(payment.amount_cents),
          })}
        </p>
        <p className="text-sm text-navy">{t('staff.reopen.effect')}</p>
        {reopen.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {errorMessage(reopen.error)}
          </p>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-flag px-4 py-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" disabled={submitting} onClick={onClose}>
          {t('staff.reopen.cancel')}
        </Button>
        <Button loading={submitting} onClick={() => reopen.mutate(payment.id, { onSuccess: onClose })}>
          {t('staff.reopen.confirm')}
        </Button>
      </div>
    </DialogSheet>
  );
}
