import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isUnauthorized, useMe } from '@/features/auth/api/use-me';
import { loginPath } from '@/features/auth/utils';
import { t } from '@/locales/en';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, error, isPending } = useMe();

  if (isPending) return <p role="status">{t('common.loading')}</p>;
  if (isUnauthorized(error)) {
    return (
      <Navigate to={loginPath(location.pathname + location.search)} replace />
    );
  }
  if (error || !data) return <p role="alert">{t('common.genericError')}</p>;
  return <>{children}</>;
}
