import { Button } from '@/components/ui/button';
import { t } from '@/locales/en';

/** Shared loading and error (with retry) states for a TanStack query. */
export function QueryLoading() {
  return <p role="status">{t('common.loading')}</p>;
}

export function QueryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-2">
      <p>{t('common.genericError')}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
