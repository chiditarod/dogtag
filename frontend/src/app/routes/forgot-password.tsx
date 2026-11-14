import { Card } from '@/components/ui/card';
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form';
import { t } from '@/locales/en';

export function ForgotPasswordRoute() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('forgotPassword.heading')}</h1>
      <Card>
        <ForgotPasswordForm />
      </Card>
    </div>
  );
}
