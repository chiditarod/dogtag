import { t } from '@/locales/en';
import type { PaymentsSummary } from '../types';
import { formatMoney } from '@/lib/money';

export function ProgressLine({ summary }: { summary: PaymentsSummary }) {
  return (
    <p className="text-sm font-semibold text-navy">
      {t('staff.payments.progress', {
        done: summary.refunded_count,
        count: summary.count,
        doneAmount: formatMoney(summary.refunded_cents),
        total: formatMoney(summary.total_cents),
      })}
    </p>
  );
}
