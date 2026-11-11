import { MyTeams } from '@/features/teams/components/my-teams';
import { t } from '@/locales/en';

export function TeamsRoute() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('teams.listHeading')}</h1>
      <MyTeams />
    </div>
  );
}
