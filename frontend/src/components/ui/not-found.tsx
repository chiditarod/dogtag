import { Link } from 'react-router-dom';
import { t } from '@/locales/en';

export function NotFound() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold">{t('notFound.heading')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to="/" className="text-link underline">
        {t('notFound.home')}
      </Link>
    </div>
  );
}
