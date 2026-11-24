import { Link } from 'react-router-dom';
import { t } from '@/locales/en';

export function NotAllowed() {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-2xl font-semibold">
        {t('staff.notAllowed.heading')}
      </h1>
      <p>{t('staff.notAllowed.body')}</p>
      <Link to="/" className="text-link underline">
        {t('notFound.home')}
      </Link>
    </div>
  );
}
