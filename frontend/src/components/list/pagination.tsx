import { Button } from '@/components/ui/button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  labels: { nav: string; prev: string; next: string; page: (page: number, total: number) => string };
}

export function Pagination({ page, totalPages, onPage, labels }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={labels.nav} className="flex items-center justify-between gap-2">
      <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <span aria-hidden="true">‹ </span>
        {labels.prev}
      </Button>
      <span className="text-sm font-semibold text-navy">{labels.page(page, totalPages)}</span>
      <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        {labels.next}
        <span aria-hidden="true"> ›</span>
      </Button>
    </nav>
  );
}
