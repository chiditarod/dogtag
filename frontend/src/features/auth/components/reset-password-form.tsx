import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { usePasswordResetToken, useResetPassword } from '@/features/auth/api/use-reset-password';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

function BackToLogin() {
  return (
    <p className="text-sm">
      <Link to="/login" className="text-link underline">
        {t('resetPassword.back')}
      </Link>
    </p>
  );
}

function ExpiredLink() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold">{t('resetPassword.expiredHeading')}</h1>
      <Card className="space-y-4">
        <p>{t('resetPassword.expiredBody')}</p>
        <Link
          to="/forgot-password"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-star px-4 py-2 font-sans text-sm font-semibold text-white transition-colors hover:bg-starText focus:outline-none focus-visible:ring-2 focus-visible:ring-link"
        >
          {t('resetPassword.newLink')}
        </Link>
      </Card>
      <BackToLogin />
    </div>
  );
}

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404;

export function ResetPasswordForm({ token }: { token: string }) {
  const check = usePasswordResetToken(token);
  const reset = useResetPassword(token);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [mismatch, setMismatch] = useState(false);

  if (check.isPending) return <QueryLoading />;
  if (isNotFound(check.error) || isNotFound(reset.error)) return <ExpiredLink />;
  if (check.isError) return <QueryError onRetry={() => void check.refetch()} />;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmation) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    reset.mutate(
      { password, password_confirmation: confirmation },
      {
        onSuccess: () =>
          navigate('/teams', { state: { notice: 'passwordChanged' }, replace: true }),
      },
    );
  }

  const fieldErrors = reset.error instanceof ApiError ? reset.error.errors : {};
  const baseError = fieldErrors.base?.[0];
  const otherError = reset.isError && !fieldErrors.password && !fieldErrors.password_confirmation;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">{t('resetPassword.heading')}</h1>
        <p className="text-sm text-navy/80">
          {t('resetPassword.for', { email: check.data.email })}
        </p>
      </div>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {otherError && (
            <div
              role="alert"
              className="rounded-md border border-star bg-white p-3 text-sm text-starText"
            >
              {baseError ?? t('common.genericError')}
            </div>
          )}
          <Field
            label={t('resetPassword.newPassword')}
            name="password"
            help={t('resetPassword.help')}
            error={fieldErrors.password}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Field
            label={t('resetPassword.confirm')}
            name="password_confirmation"
            error={mismatch ? [t('resetPassword.mismatch')] : fieldErrors.password_confirmation}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value);
                setMismatch(false);
              }}
              required
            />
          </Field>
          <Button type="submit" loading={reset.isPending} className="w-full">
            {t('resetPassword.submit')}
          </Button>
        </form>
      </Card>
      <BackToLogin />
    </div>
  );
}
