import { Button } from '@/components/ui/button';
import { t } from '@/locales/en';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, totalPages, onPage }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={t('staff.payments.pagination')} className="flex items-center justify-between gap-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span aria-hidden="true">‹ </span>
        {t('staff.payments.prev')}
      </Button>
      <span className="text-sm font-semibold text-navy">
        {t('staff.payments.page', { page, total: totalPages })}
      </span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {t('staff.payments.next')}
        <span aria-hidden="true"> ›</span>
      </Button>
    </nav>
  );
}
