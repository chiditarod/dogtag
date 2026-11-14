import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useLogin } from '@/features/auth/api/use-login';
import { safeNext } from '@/features/auth/utils';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

export function LoginForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const login = useLogin();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    login.mutate(
      {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        remember_me: form.get('remember_me') === 'on',
      },
      {
        onSuccess: () =>
          navigate(safeNext(params.get('next'), '/teams'), { replace: true }),
      },
    );
  }

  const error = login.error;
  const message =
    error instanceof ApiError && error.error === 'login_failed'
      ? t('login.failed')
      : error && t('common.genericError');

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message && (
        <div
          role="alert"
          className="rounded-md border border-star bg-white p-3 text-sm text-starText"
        >
          {message}
        </div>
      )}
      <Field label={t('auth.email')} name="email">
        <Input type="email" autoComplete="email" required />
      </Field>
      <Field label={t('auth.password')} name="password">
        <Input type="password" autoComplete="current-password" required />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="remember_me" className="h-4 w-4" />
        {t('auth.rememberMe')}
      </label>
      <Button type="submit" loading={login.isPending} className="w-full">
        {t('login.submit')}
      </Button>
      <p className="text-sm">
        <Link to="/forgot-password" className="text-link underline">
          {t('login.forgot')}
        </Link>
      </p>
      <p className="text-sm">
        {t('login.signupPrompt')}{' '}
        <Link
          to={`/signup${params.get('next') ? `?next=${encodeURIComponent(params.get('next')!)}` : ''}`}
          className="text-link underline"
        >
          {t('login.signupLink')}
        </Link>
      </p>
    </form>
  );
}
