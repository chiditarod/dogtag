import { Badge } from '@/components/ui/badge';
import { t } from '@/locales/en';
import type { StaffPayment } from '../types';
import { formatMoney, formatPaidDate, formatShortDate } from '../utils';

function StatusBadge({ payment }: { payment: StaffPayment }) {
  const label =
    payment.status === 'refunded' && payment.refunded_at
      ? t('staff.payments.status.refunded', { date: formatShortDate(payment.refunded_at) })
      : payment.status === 'refunded'
        ? t('staff.payments.statusRefundedPlain')
        : t(`staff.payments.status.${payment.status}` as 'staff.payments.status.paid');
  const tone = payment.status === 'paid' ? 'success' : payment.status === 'refunding' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}

const headCell = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-navy/70';
const cell = 'block min-w-0 px-3 py-0.5 sm:table-cell sm:py-2 sm:align-top';

/** Mobile label shown only below `sm`, where each row is a card. */
function Label({ children }: { children: string }) {
  return (
    <span aria-hidden="true" className="mr-1 text-xs font-semibold uppercase text-navy/60 sm:hidden">
      {children}
    </span>
  );
}

/** One markup: a table from `sm`, stacked cards below it. */
export function PaymentsTable({ payments }: { payments: StaffPayment[] }) {
  return (
    <div role="table" aria-label={t('staff.payments.list')} className="block w-full sm:table">
      <div role="rowgroup" className="hidden sm:table-header-group">
        <div role="row" className="sm:table-row">
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
            className="grid grid-cols-[minmax(0,1fr)] rounded-lg border border-flag bg-white py-2 sm:table-row sm:rounded-none sm:border-0 sm:border-t sm:py-0"
          >
            <div role="cell" className={`${cell} font-semibold [overflow-wrap:anywhere]`}>
              {payment.team.name}
            </div>
            <div role="cell" className={`${cell} text-sm [overflow-wrap:anywhere]`}>
              <Label>{t('staff.payments.col.owner')}</Label>
              {payment.owner && (
                <>
                  <span>{payment.owner.name}</span>{' '}
                  <span className="text-navy/70">{payment.owner.email}</span>
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
