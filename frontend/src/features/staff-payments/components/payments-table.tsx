import { Badge } from '@/components/ui/badge';
import { t } from '@/locales/en';
import type { StaffPayment } from '../types';
import { formatMoney, formatPaidDate, formatShortDate } from '../utils';

function StatusBadge({ payment }: { payment: StaffPayment }) {
  const label =
    payment.status === 'refunded' && payment.refunded_at
      ? t('staff.payments.status.refunded', { date: formatShortDate(payment.refunded_at) })
      : payment.status === 'refunded'
        ? t('staff.payments.status.refundedUndated')
        : t(`staff.payments.status.${payment.status}` as 'staff.payments.status.paid');
  const tone = payment.status === 'paid' ? 'success' : payment.status === 'refunding' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

const headCell = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-navy/70';
const cell = 'block min-w-0 px-3 py-0.5 sm:table-cell sm:py-2 sm:align-top';

/**
 * Mobile label shown only below `sm`, where each row is a card and has no column header, so screen readers
 * read it too. `sm:hidden` takes it out of the table (and the accessibility tree) from `sm`.
 */
function Label({ children }: { children: string }) {
  return (
    <span className="mr-1 text-xs font-semibold uppercase text-navy/60 sm:hidden">
      {children}{' '}
    </span>
  );
}

export interface RefundSelection {
  selected: Map<number, StaffPayment>;
  onToggle: (payment: StaffPayment) => void;
  isFull: boolean;
  /** The rows on screen belong to the previous filters while the new ones load: nothing can be ticked. */
  stale: boolean;
  /** Id of the note that says why the rest are disabled at the cap. */
  capNoteId: string;
}

/** The tick box, a 44px target; nothing for rows that cannot be refunded. */
function SelectBox({ payment, refund }: { payment: StaffPayment; refund: RefundSelection }) {
  if (payment.status !== 'paid') return null;
  const checked = refund.selected.has(payment.id);
  const capped = refund.isFull && !checked;
  const disabled = capped || refund.stale;
  return (
    <label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center">
      <input
        type="checkbox"
        className="size-6 accent-star disabled:cursor-not-allowed"
        aria-label={t('staff.payments.refundMode.select', { team: payment.team.name })}
        aria-describedby={capped ? refund.capNoteId : undefined}
        checked={checked}
        disabled={disabled}
        onChange={() => refund.onToggle(payment)}
      />
    </label>
  );
}

/** One markup: a table from `sm`, stacked cards below it. Pass `refund` to show tick boxes (Refund mode). */
export function PaymentsTable({ payments, refund }: { payments: StaffPayment[]; refund?: RefundSelection }) {
  return (
    <div role="table" aria-label={t('staff.payments.list')} className="block w-full sm:table">
      <div role="rowgroup" className="hidden sm:table-header-group">
        <div role="row" className="sm:table-row">
          {refund && <div role="columnheader" className="w-12 sm:table-cell" aria-label={t('staff.payments.refundMode.selectColumn')} />}
          {(['team', 'owner', 'type', 'amount', 'paid', 'status'] as const).map((column) => (
            <div key={column} role="columnheader" className={`${headCell} sm:table-cell`}>
              {t(`staff.payments.col.${column}`)}
            </div>
          ))}
        </div>
      </div>
      <div role="rowgroup" className="block space-y-3 sm:table-row-group sm:space-y-0">
        {payments.map((payment) => (
          <div
            key={payment.id}
            role="row"
            data-payment-id={payment.id}
            data-selected={refund ? refund.selected.has(payment.id) : undefined}
            className={`grid grid-cols-[minmax(0,1fr)] rounded-lg border border-flag py-2 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:py-0 ${
              refund && payment.status !== 'paid' ? 'bg-page text-navy/60' : 'bg-white'
            }`}
          >
            {refund && (
              <div role="cell" className="px-1 sm:table-cell sm:align-top">
                <SelectBox payment={payment} refund={refund} />
              </div>
            )}
            <div role="cell" className={`${cell} break-words font-semibold`}>
              {payment.team.name}
            </div>
            <div role="cell" className={`${cell} break-words text-sm`}>
              <Label>{t('staff.payments.col.owner')}</Label>
              {payment.owner && (
                <>
                  <span>{payment.owner.name}</span>{' '}
                  {/* An email has no spaces to break at, so it may break anywhere. */}
                  <span className="text-navy/70 [overflow-wrap:anywhere]">{payment.owner.email}</span>
                </>
              )}
            </div>
            <div role="cell" className={`${cell} text-sm`}>
              <Label>{t('staff.payments.col.type')}</Label>
              {payment.payment_type}
            </div>
            <div role="cell" className={`${cell} text-sm`}>
              <Label>{t('staff.payments.col.amount')}</Label>
              {formatMoney(payment.amount_cents)}
            </div>
            <div role="cell" className={`${cell} text-sm`}>
              <Label>{t('staff.payments.col.paid')}</Label>
              {formatPaidDate(payment.paid_at)}
            </div>
            <div role="cell" className={cell}>
              <StatusBadge payment={payment} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
