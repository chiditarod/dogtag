import { ListCell, ListRow, ListTable } from '@/components/list/list-table';
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

const COLUMNS = ['team', 'owner', 'type', 'amount', 'paid', 'status'] as const;

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
  const columns = [
    ...(refund
      ? [
          {
            key: 'select',
            className: 'w-12',
            label: <span className="sr-only">{t('staff.payments.refundMode.selectColumn')}</span>,
          },
        ]
      : []),
    ...COLUMNS.map((column) => ({ key: column, label: t(`staff.payments.col.${column}`) })),
  ];
  return (
    <ListTable label={t('staff.payments.list')} columns={columns}>
      {payments.map((payment) => (
        <ListRow
          key={payment.id}
          data-payment-id={payment.id}
          data-selected={refund ? refund.selected.has(payment.id) : undefined}
          className={refund && payment.status !== 'paid' ? 'bg-page text-navy/60' : 'bg-white'}
        >
          {refund && (
            <div role="cell" className="px-1 sm:table-cell sm:align-top">
              <SelectBox payment={payment} refund={refund} />
            </div>
          )}
          <ListCell className="break-words font-semibold">{payment.team.name}</ListCell>
          <ListCell label={t('staff.payments.col.owner')} className="break-words text-sm">
            {payment.owner && (
              <>
                <span>{payment.owner.name}</span>{' '}
                {/* An email has no spaces to break at, so it may break anywhere. */}
                <span className="text-navy/70 [overflow-wrap:anywhere]">{payment.owner.email}</span>
              </>
            )}
          </ListCell>
          <ListCell label={t('staff.payments.col.type')} className="text-sm">
            {payment.payment_type}
          </ListCell>
          <ListCell label={t('staff.payments.col.amount')} className="text-sm">
            {formatMoney(payment.amount_cents)}
          </ListCell>
          <ListCell label={t('staff.payments.col.paid')} className="text-sm">
            {formatPaidDate(payment.paid_at)}
          </ListCell>
          <ListCell>
            <StatusBadge payment={payment} />
          </ListCell>
        </ListRow>
      ))}
    </ListTable>
  );
}
