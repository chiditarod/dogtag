import { RaceList } from '@/features/races/components/race-list';
import { t } from '@/locales/en';

export function RacesRoute() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('races.heading')}</h1>
      <RaceList />
    </div>
  );
}
