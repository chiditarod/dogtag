import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MyTeams } from '@/features/teams/components/my-teams';
import { t } from '@/locales/en';

export function TeamsRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  // Read once, then drop it from history so a reload does not show the notice again.
  const [notice] = useState(() => (location.state as { notice?: string } | null)?.notice);

  useEffect(() => {
    if (!notice) return;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: null },
    );
    // Runs once on mount; the notice is captured above.
  }, []);

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
