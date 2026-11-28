import { Link, useNavigate } from 'react-router-dom';
import { useLogout } from '@/features/auth/api/use-login';
import { useMe } from '@/features/auth/api/use-me';
import { isStaff } from '@/features/staff/utils';
import { t } from '@/locales/en';

interface UserMenuProps {
  /** Show the Staff link to staff. The staff layout turns it off: its own nav covers it. */
  staffLink?: boolean;
}

/**
 * Wraps onto more lines rather than widening the header: at 320px a long first
 * name plus My teams, Staff and Log out is wider than the room beside the logo.
 */
export function UserMenu({ staffLink = true }: UserMenuProps) {
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
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 whitespace-nowrap">
      <span className="max-w-[8rem] truncate font-semibold">{user.first_name}</span>
      <Link to="/teams" className="font-semibold text-link hover:underline">
        {t('layout.myTeams')}
      </Link>
      <Link to="/account" className="font-semibold text-link hover:underline">
        {t('layout.account')}
      </Link>
      {staffLink && isStaff(user) && (
        <Link to="/staff/payments" className="font-semibold text-link hover:underline">
          {t('layout.staff')}
        </Link>
      )}
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
