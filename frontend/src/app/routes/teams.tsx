import { useLocation } from 'react-router-dom';
import { MyTeams } from '@/features/teams/components/my-teams';
import { t } from '@/locales/en';

export function TeamsRoute() {
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;

  return (
    <div className="space-y-4">
      {notice === 'passwordChanged' && (
        <div
          role="status"
          className="rounded-md border border-[#6cbf8a] bg-[#e9f7ef] p-3 text-sm text-navy"
        >
          {t('teams.passwordChanged')}
        </div>
      )}
      <h1 className="font-display text-2xl font-semibold">{t('teams.listHeading')}</h1>
      <MyTeams />
    </div>
  );
}
