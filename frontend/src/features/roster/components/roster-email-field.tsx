import { useState } from 'react';
import { EmailInput } from '@/components/inputs/email-input';
import { Field } from '@/components/ui/field';
import { emailProblem } from '@/features/roster/utils';
import { t } from '@/locales/en';

interface RosterEmailFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Emails of the other racers on the team, never the person being edited. */
  otherEmails: readonly string[];
  /** Server messages from a failed save. */
  error?: string[];
}

/** The racer's email; tabbing out checks its shape and the roster at once. */
export function RosterEmailField({
  value,
  onChange,
  otherEmails,
  error,
}: RosterEmailFieldProps) {
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <Field
      label={t('roster.email')}
      name="email"
      error={problem ? [problem] : error}
    >
      <EmailInput
        autoComplete="off"
        value={value}
        onChange={(next) => {
          setProblem(null);
          onChange(next);
        }}
        onBlur={(event) => setProblem(emailProblem(event.target.value, otherEmails))}
      />
    </Field>
  );
}
