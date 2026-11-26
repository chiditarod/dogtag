import { ButtonLink } from '@/components/ui/button-link';
import { t } from '@/locales/en';
import { RacesList } from '../components/races-list';

export function StaffRacesRoute() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">{t('staff.races.heading')}</h1>
        <ButtonLink to="/staff/races/new">{t('staff.races.new')}</ButtonLink>
      </div>
      <RacesList />
    </div>
  );
}
