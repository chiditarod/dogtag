import { Card } from '@/components/ui/card';
import { SignupForm } from '@/features/auth/components/signup-form';
import { t } from '@/locales/en';

export function SignupRoute() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('signup.heading')}</h1>
      <Card>
        <SignupForm />
      </Card>
    </div>
  );
}
