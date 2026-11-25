import { RaceList } from '@/features/races/components/race-list';
import { RegistrationIntro } from '@/features/races/components/registration-intro';
import { t } from '@/locales/en';

export function RacesRoute() {
  return (
    <div className="mx-auto max-w-xl space-y-4 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-8 lg:space-y-0">
      <RegistrationIntro />
      <div className="space-y-4">
        <h1 className="font-display text-2xl font-semibold">{t('races.heading')}</h1>
        <RaceList />
      </div>
    </div>
  );
}
