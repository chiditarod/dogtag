import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useSignup, type SignupInput } from '@/features/auth/api/use-signup';
import { safeNext } from '@/features/auth/utils';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

export function SignupForm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const signup = useSignup();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: keyof SignupInput) => String(form.get(name) ?? '');
    signup.mutate(
      {
        first_name: value('first_name'),
        last_name: value('last_name'),
        email: value('email'),
        phone: value('phone'),
        password: value('password'),
        password_confirmation: value('password_confirmation'),
      },
      {
        onSuccess: () =>
          navigate(safeNext(params.get('next'), '/'), { replace: true }),
      },
    );
  }

  const error = signup.error;
  const fieldErrors = error instanceof ApiError ? error.errors : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const message = error && !hasFieldErrors ? t('common.genericError') : null;
  const errorsFor = (name: string) => fieldErrors[name];

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
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t('signup.firstName')}
          name="first_name"
          error={errorsFor('first_name')}
        >
          <Input autoComplete="given-name" required />
        </Field>
        <Field
          label={t('signup.lastName')}
          name="last_name"
          error={errorsFor('last_name')}
        >
          <Input autoComplete="family-name" required />
        </Field>
      </div>
      <Field label={t('auth.email')} name="email" error={errorsFor('email')}>
        <Input type="email" autoComplete="email" required />
      </Field>
      <Field label={t('signup.phone')} name="phone" error={errorsFor('phone')}>
        <Input type="tel" autoComplete="tel" required />
      </Field>
      <Field
        label={t('auth.password')}
        name="password"
        error={errorsFor('password')}
      >
        <Input type="password" autoComplete="new-password" required />
      </Field>
      <Field
        label={t('signup.passwordConfirmation')}
        name="password_confirmation"
        error={errorsFor('password_confirmation')}
      >
        <Input type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" loading={signup.isPending} className="w-full">
        {t('signup.submit')}
      </Button>
      <p className="text-sm">
        {t('signup.loginPrompt')}{' '}
        <Link to="/login" className="text-link underline">
          {t('signup.loginLink')}
        </Link>
      </p>
    </form>
  );
}
