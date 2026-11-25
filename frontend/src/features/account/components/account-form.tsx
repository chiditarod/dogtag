import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { EmailInput } from '@/components/inputs/email-input';
import { formatPhoneDisplay, toApiPhone } from '@/components/inputs/format';
import { PhoneInput } from '@/components/inputs/phone-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';
import { useUpdateAccount } from '@/features/account/api/use-update-account';
import type { User } from '@/features/auth/api/use-me';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';

export function AccountForm({ user }: { user: User }) {
  const update = useUpdateAccount();
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(formatPhoneDisplay(user.phone ?? ''));
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    update.mutate(
      {
        user: {
          first_name: firstName,
          last_name: lastName,
          email: email.trim().toLowerCase(),
          phone: toApiPhone(phone),
          password,
          password_confirmation: passwordConfirmation,
        },
        current_password: currentPassword,
      },
      {
        onSuccess: () => {
          setPassword('');
          setPasswordConfirmation('');
          setCurrentPassword('');
        },
      },
    );
  }

  const error = update.error;
  const fieldErrors = error instanceof ApiError ? error.errors : {};
  const hasFieldErrors = Object.keys(fieldErrors).length > 0;
  const message = error ? t(hasFieldErrors ? 'account.checkFields' : 'common.genericError') : null;
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
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-medium">{t('account.details')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('signup.firstName')} name="first_name" error={errorsFor('first_name')}>
            <Input
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </Field>
          <Field label={t('signup.lastName')} name="last_name" error={errorsFor('last_name')}>
            <Input
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </Field>
        </div>
        <Field
          label={t('auth.email')}
          name="email"
          help={t('account.emailHelp')}
          error={errorsFor('email')}
        >
          <EmailInput value={email} onChange={setEmail} required />
        </Field>
        <Field label={t('signup.phone')} name="phone" error={errorsFor('phone')}>
          <PhoneInput value={phone} onChange={setPhone} required />
        </Field>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-medium">{t('account.changePassword')}</h2>
        <Field
          label={t('account.newPassword')}
          name="password"
          help={t('account.newPasswordHelp')}
          error={errorsFor('password')}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
        <Field
          label={t('account.confirmPassword')}
          name="password_confirmation"
          error={errorsFor('password_confirmation')}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
          />
        </Field>
      </Card>
      <div className="rounded border-l-4 border-link bg-flag/20 p-3">
        <Field
          label={t('account.currentPassword')}
          name="current_password"
          help={t('account.currentPasswordHelp')}
          error={errorsFor('current_password')}
        >
          {(control) => (
            <>
              <Input
                {...control}
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
              <p className="text-sm">
                <Link to="/forgot-password" className="text-link underline">
                  {t('account.forgot')}
                </Link>
              </p>
            </>
          )}
        </Field>
      </div>
      <Button type="submit" loading={update.isPending} className="w-full">
        {t('account.save')}
      </Button>
      <p role="status" className="text-sm font-semibold text-navy">
        {update.isSuccess ? t('account.saved') : null}
      </p>
    </form>
  );
}
