import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { usePasswordReset } from '@/features/auth/api/use-password-reset';
import { t } from '@/locales/en';

export function ForgotPasswordForm() {
  const reset = usePasswordReset();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    reset.mutate(String(form.get('email') ?? ''));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {reset.isSuccess && (
        <div role="status" className="rounded-md border border-flag bg-white p-3 text-sm">
          {t('forgotPassword.sent')}
        </div>
      )}
      {reset.isError && (
        <div role="alert" className="rounded-md border border-star bg-white p-3 text-sm text-starText">
          {t('common.genericError')}
        </div>
      )}
      <Field label={t('auth.email')} name="email">
        <Input type="email" autoComplete="email" required />
      </Field>
      <Button type="submit" loading={reset.isPending} className="w-full">
        {t('forgotPassword.submit')}
      </Button>
      <p className="text-sm">
        <Link to="/login" className="text-link underline">
          {t('forgotPassword.back')}
        </Link>
      </p>
    </form>
  );
}
