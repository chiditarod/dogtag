import { Button } from '@/components/ui/button';
import { t } from '@/locales/en';
import { formatMoney } from '../utils';

interface RefundBarProps {
  count: number;
  limit: number;
  totalCents: number;
  onReview?: () => void;
}

/** Pinned to the bottom of the screen in Refund mode; the button is full width on mobile. */
export function RefundBar({ count, limit, totalCents, onReview }: RefundBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-star bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(18,32,47,0.12)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm font-semibold text-navy">
          {t('staff.payments.refundMode.barCount', { n: count, limit, total: formatMoney(totalCents) })}
        </p>
        <Button disabled={count === 0} onClick={onReview} className="w-full sm:w-auto">
          {t('staff.payments.refundMode.review', { n: count })}
        </Button>
      </div>
    </div>
  );
}
