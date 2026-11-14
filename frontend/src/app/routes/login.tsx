import { Card } from '@/components/ui/card';
import { LoginForm } from '@/features/auth/components/login-form';
import { t } from '@/locales/en';

export function LoginRoute() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('login.heading')}</h1>
      <Card>
        <LoginForm />
      </Card>
    </div>
  );
}
