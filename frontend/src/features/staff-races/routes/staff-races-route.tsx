import { Link } from 'react-router-dom';
import { t } from '@/locales/en';
import { RacesList } from '../components/races-list';

export function StaffRacesRoute() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('staff.races.heading')}</h1>
        <Link
          to="/staff/races/new"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-star px-4 py-2 text-sm font-semibold text-white hover:bg-starText"
        >
          {t('staff.races.new')}
        </Link>
      </div>
      <RacesList />
    </div>
  );
}
