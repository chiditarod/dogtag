import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DialogSheet } from '@/components/ui/dialog-sheet';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import { useCreateRefundBatch } from '../api/use-create-refund-batch';
import type { RefundBatch, StaffPayment } from '../types';
import { formatMoney } from '../utils';

interface ConfirmRefundDialogProps {
  /** The rows the staff member ticked when the dialog opened. */
  snapshot: StaffPayment[];
  /** The page's live selection; if it differs from the snapshot the dialog refuses. */
  current: Map<number, StaffPayment>;
  /** The latest fetched rows of the list, to spot a row that moved on while the dialog was open. */
  latestRows: StaffPayment[];
  onConfirmed: (batch: RefundBatch) => void;
  onClose: () => void;
}

/** True when `typed` is REFUND and the count, ignoring case and spaces around and between the words. */
export function matchesConfirmation(typed: string, count: number): boolean {
  return typed.trim().replace(/\s+/g, ' ').toUpperCase() === `REFUND ${count}`;
}

function snapshotChanged(snapshot: StaffPayment[], current: Map<number, StaffPayment>, latestRows: StaffPayment[]) {
  if (snapshot.length !== current.size || snapshot.some((row) => !current.has(row.id))) return true;
  return snapshot.some((row) => {
    const latest = latestRows.find((candidate) => candidate.id === row.id);
    return latest !== undefined && (latest.status !== 'paid' || latest.amount_cents !== row.amount_cents);
  });
}

function errorMessage(error: unknown, snapshot: StaffPayment[]): string {
  if (!(error instanceof ApiError)) return t('staff.refund.error.generic');
  switch (error.code) {
    case 'batch_too_large':
    case 'selection_changed':
      return t(`staff.refund.error.${error.code}`);
    case 'confirmation_mismatch':
      return t('staff.refund.error.confirmation_mismatch', { n: snapshot.length });
    case 'not_refundable': {
      const teams = Object.entries(error.errors).map(([id, reasons]) => {
        const row = snapshot.find((candidate) => String(candidate.id) === id);
        return `${row?.team.name ?? `#${id}`} (${reasons.join(', ')})`;
      });
      return t('staff.refund.error.not_refundable', { teams: teams.join('; ') });
    }
    default:
      return error.error || t('staff.refund.error.generic');
  }
}

export function ConfirmRefundDialog({ snapshot, current, latestRows, onConfirmed, onClose }: ConfirmRefundDialogProps) {
  const titleId = useId();
  const inputId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [typed, setTyped] = useState('');
  const create = useCreateRefundBatch();
  const submitting = create.isPending;
  const count = snapshot.length;
  const totalCents = snapshot.reduce((sum, row) => sum + row.amount_cents, 0);
  const changed = snapshotChanged(snapshot, current, latestRows);
  const canConfirm = !changed && !submitting && matchesConfirmation(typed, count);

  useEffect(() => titleRef.current?.focus(), []);

  function confirm() {
    if (!canConfirm) return;
    create.mutate(
      { ids: snapshot.map((row) => row.id), confirmation: `REFUND ${count}`, expectedTotalCents: totalCents },
      { onSuccess: onConfirmed },
    );
  }

  return (
    // Escape and the Cancel button do nothing while the request is in flight, and the backdrop never closes.
    <DialogSheet labelledBy={titleId} onClose={() => !submitting && onClose()} className="sm:max-w-xl">
      <div className="border-b border-flag px-4 py-3">
        <h2 id={titleId} ref={titleRef} tabIndex={-1} className="font-display text-xl font-semibold focus:outline-none">
          {t(count === 1 ? 'staff.refund.title_one' : 'staff.refund.title_other', { n: count })}
        </h2>
        <p className="mt-1 text-base font-bold text-starText">{t('staff.refund.irreversible')}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        <ul aria-label={t('staff.refund.list')} className="divide-y divide-flag">
          {snapshot.map((row) => (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 py-2 text-sm">
              <span className="font-semibold [overflow-wrap:anywhere]">{row.team.name}</span>
              <span className="font-semibold">{formatMoney(row.amount_cents)}</span>
              <span className="text-navy/70 [overflow-wrap:anywhere]">{row.owner?.email ?? ''}</span>
              <span className="text-navy/70">{row.payment_type}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-navy">{t('staff.refund.emailNote')}</p>
      </div>
      <div className="space-y-2 border-t border-flag px-4 py-3">
        <p className="text-base font-bold">{t('staff.refund.total', { total: formatMoney(totalCents) })}</p>
        <label htmlFor={inputId} className="block text-sm font-semibold">
          {t('staff.refund.typeLabel', { n: count })}
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={typed}
          disabled={submitting}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') confirm();
          }}
          className="min-h-11 w-full rounded-md border border-flag bg-white px-3 text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link disabled:opacity-60"
        />
        {changed && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {t('staff.refund.changed')}
          </p>
        )}
        {create.isError && (
          <p role="alert" className="text-sm font-semibold text-starText">
            {errorMessage(create.error, snapshot)}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={submitting} onClick={onClose}>
            {t('staff.refund.cancel')}
          </Button>
          <Button disabled={!canConfirm} loading={submitting} onClick={confirm}>
            {t(count === 1 ? 'staff.refund.confirm_one' : 'staff.refund.confirm_other', { n: count })}
          </Button>
        </div>
      </div>
    </DialogSheet>
  );
}
