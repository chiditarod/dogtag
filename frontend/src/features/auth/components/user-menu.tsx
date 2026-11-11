import { Link, useNavigate } from 'react-router-dom';
import { useLogout } from '@/features/auth/api/use-login';
import { useMe } from '@/features/auth/api/use-me';
import { t } from '@/locales/en';

export function UserMenu() {
  const { data: user } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  if (!user) {
    return (
      <Link to="/login" className="font-semibold text-link hover:underline">
        {t('layout.login')}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden font-semibold sm:inline">{user.first_name}</span>
      <Link to="/teams" className="font-semibold text-link hover:underline">
        {t('layout.myTeams')}
      </Link>
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, { onSuccess: () => navigate('/') })
        }
        className="font-semibold text-link hover:underline disabled:opacity-60"
      >
        {t('layout.logout')}
      </button>
    </div>
  );
}
