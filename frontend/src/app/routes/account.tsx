import { AccountForm } from '@/features/account/components/account-form';
import { useMe } from '@/features/auth/api/use-me';
import { t } from '@/locales/en';

export function AccountRoute() {
  const { data: user } = useMe();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{t('account.heading')}</h1>
        {user && <p className="text-sm text-navy/80 [overflow-wrap:anywhere]">{user.email}</p>}
      </div>
      {user && <AccountForm user={user} />}
    </div>
  );
}
