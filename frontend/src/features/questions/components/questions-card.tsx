import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { useQuestions, useSaveAnswers } from '@/features/questions/api/use-questions';
import { JsonformRenderer } from '@/features/questions/components/jsonform-renderer';
import type { AnswerErrors, Answers, JsonformSchema } from '@/features/questions/types';
import {
  defaultAnswers,
  mapServerErrors,
  validateAnswers,
} from '@/features/questions/validate';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

const isAnswered = (value: string | undefined) => !!value?.trim();

/** Only schema keys, trimmed, with empty values omitted. */
function buildPayload(schema: JsonformSchema, draft: Answers): Answers {
  const payload: Answers = {};
  for (const key of Object.keys(schema.properties)) {
    const value = draft[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

export function QuestionsCard({ team }: { team: Team }) {
  const { checklist, race } = team;
  const open = race.open_for_registration;
  const query = useQuestions(team.id);
  const save = useSaveAnswers(team.id);
  const { reportError, clearError } = useTeamPageError();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answers | null>(null);
  const [errors, setErrors] = useState<AnswerErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const focusEditButton = useRef(false);

  const showForm = open && (editing || !checklist.questions.done);
  const jsonform = query.data?.jsonform;

  // Focus management: first invalid field after a failed save/validation, and
  // the Edit button after the form collapses.
  useEffect(() => {
    if (focusTick === 0) return;
    const invalid = formRef.current?.querySelector('[data-invalid="true"]');
    invalid?.querySelector<HTMLElement>('input, select, textarea')?.focus();
  }, [focusTick]);
  useEffect(() => {
    if (!showForm && focusEditButton.current) {
      focusEditButton.current = false;
      editButton.current?.focus();
    }
  }, [showForm]);

  if (query.isPending) return <QueryLoading />;
  if (query.isError) return <QueryError onRetry={() => void query.refetch()} />;
  if (!jsonform) return null;

  const { schema } = jsonform;
  const saved = query.data.answers;
  const keys = Object.keys(schema.properties);
  const answered = keys.filter((key) => isAnswered(saved[key])).length;
  const value = draft ?? defaultAnswers(schema, saved);

  function collapse() {
    setEditing(false);
    setDraft(null);
    setErrors({});
    setFormErrors([]);
    focusEditButton.current = true;
  }

  function startEditing() {
    setDraft(defaultAnswers(schema, saved));
    setStatus('');
    setEditing(true);
    requestAnimationFrame(() => {
      formRef.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    });
  }

  function handleChange(key: string, next: string) {
    setDraft({ ...value, [key]: next });
    if (errors[key]) {
      const remaining = { ...errors };
      delete remaining[key];
      setErrors(remaining);
    }
  }

  function showErrors(byKey: AnswerErrors, form: string[]) {
    setErrors(byKey);
    setFormErrors(form);
    setFocusTick((tick) => tick + 1);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload(schema, value);
    const invalid = validateAnswers(schema, payload);
    if (Object.keys(invalid).length) {
      showErrors(invalid, [t('questions.fixErrors')]);
      return;
    }
    setErrors({});
    setFormErrors([]);

    save.mutate(payload, {
      onSuccess: () => {
        clearError();
        setStatus(t('questions.saved'));
        collapse();
      },
      onError: (error) => {
        if (reportError(error)) return;
        if (error instanceof ApiError && error.error === 'invalid_answers') {
          const messages = Object.values(error.errors).flat();
          const { byKey, form } = mapServerErrors(messages, schema);
          showErrors(byKey, form);
          return;
        }
        setFormErrors([t('common.genericError')]);
      },
    });
  }

  return (
    <div className="space-y-4">
      <div role="status" className="sr-only">
        {status}
      </div>
      {showForm ? (
        <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-6">
          <JsonformRenderer
            jsonform={jsonform}
            value={value}
            onChange={handleChange}
            errors={errors}
          />
          {formErrors.length > 0 && (
            <div role="alert" className="space-y-1 text-sm text-starText">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={save.isPending}>
              {t('questions.save')}
            </Button>
            {editing && (
              <Button variant="secondary" onClick={collapse}>
                {t('questions.cancel')}
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-base text-navy">
            {t('questions.answered', { count: answered, total: keys.length })}
          </p>
          {open ? (
            <Button ref={editButton} variant="secondary" onClick={startEditing}>
              {t('questions.edit')}
            </Button>
          ) : (
            <p className="text-sm text-navy/80">{t('questions.closed')}</p>
          )}
        </div>
      )}
    </div>
  );
}
