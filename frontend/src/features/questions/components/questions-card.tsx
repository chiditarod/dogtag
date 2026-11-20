import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { QueryError, QueryLoading } from '@/components/ui/query-state';
import { buddyOptionsQueryKey, useBuddyOptions } from '@/features/questions/api/use-buddy-options';
import {
  questionsQueryKey,
  useQuestions,
  useSaveAnswers,
} from '@/features/questions/api/use-questions';
import {
  BuddyFieldset,
  BuddyPicker,
} from '@/features/questions/components/buddy-picker';
import { CollaboratingQuestion } from '@/features/questions/components/collaborating-question';
import { JsonformRenderer } from '@/features/questions/components/jsonform-renderer';
import type {
  AnswerErrors,
  Answers,
  BuddySelection,
  JsonformSchema,
} from '@/features/questions/types';
import {
  defaultAnswers,
  hiddenKeys,
  mapServerErrors,
  validateAnswers,
} from '@/features/questions/validate';
import { useTeamPageError } from '@/features/teams/components/team-page-error';
import { ApiError } from '@/lib/api-client';
import { t } from '@/locales/en';
import type { Team } from '@/types/api';

const isAnswered = (value: string | undefined) => !!value?.trim();

/** Only visible schema keys, trimmed, with empty values omitted. */
function buildPayload(schema: JsonformSchema, draft: Answers, hidden: ReadonlySet<string>): Answers {
  const payload: Answers = {};
  for (const key of Object.keys(schema.properties)) {
    if (hidden.has(key)) continue;
    const value = draft[key]?.trim();
    if (value) payload[key] = value;
  }
  return payload;
}

function savedSelection(data: {
  buddy_team_ids: number[];
  other_buddies: string | null;
}): BuddySelection {
  const otherText = data.other_buddies ?? '';
  return {
    teamIds: data.buddy_team_ids,
    otherSelected: otherText.trim() !== '',
    otherText,
  };
}

export function QuestionsCard({ team }: { team: Team }) {
  const { checklist, race } = team;
  const open = race.open_for_registration;
  const query = useQuestions(team.id);
  const save = useSaveAnswers(team.id);
  const queryClient = useQueryClient();
  const { reportError, clearError } = useTeamPageError();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Answers | null>(null);
  const [buddyDraft, setBuddyDraft] = useState<BuddySelection | null>(null);
  // undefined: not touched yet, so the saved answer shows.
  const [collaboratingDraft, setCollaboratingDraft] = useState<boolean | null | undefined>(
    undefined,
  );
  const [collaboratingErrors, setCollaboratingErrors] = useState<string[]>([]);
  const [buddyErrors, setBuddyErrors] = useState<string[]>([]);
  const [errors, setErrors] = useState<AnswerErrors>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [focusTick, setFocusTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const focusEditButton = useRef(false);

  const showForm = open && (editing || !checklist.questions.done);
  const jsonform = query.data?.jsonform;
  const buddyOptions = useBuddyOptions(team.id, showForm && !!jsonform);

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
  const data = query.data;
  const saved = data.answers;
  const value = draft ?? defaultAnswers(schema, saved);
  const hidden = hiddenKeys(jsonform, value);
  const keys = Object.keys(schema.properties).filter((key) => !hidden.has(key));
  const answered = keys.filter((key) => isAnswered(saved[key])).length;
  const buddies = buddyDraft ?? savedSelection(data);
  const collaborating =
    collaboratingDraft === undefined ? data.collaborating : collaboratingDraft;

  function collapse() {
    setEditing(false);
    setDraft(null);
    setBuddyDraft(null);
    setBuddyErrors([]);
    setCollaboratingDraft(undefined);
    setCollaboratingErrors([]);
    setErrors({});
    setFormErrors([]);
    focusEditButton.current = true;
  }

  function startEditing() {
    setDraft(defaultAnswers(schema, saved));
    setBuddyDraft(savedSelection(data));
    setBuddyErrors([]);
    setCollaboratingDraft(data.collaborating);
    setCollaboratingErrors([]);
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

  function handleCollaboratingChange(next: boolean) {
    setCollaboratingDraft(next);
    setCollaboratingErrors([]);
    setBuddyErrors([]);
  }

  function handleBuddyChange(next: BuddySelection) {
    setBuddyDraft(next);
    setBuddyErrors([]);
  }

  function showErrors(byKey: AnswerErrors, form: string[]) {
    setErrors(byKey);
    setFormErrors(form);
    setFocusTick((tick) => tick + 1);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const payload = buildPayload(schema, value, hidden);
    const invalid = validateAnswers(schema, payload);
    const unanswered = collaborating === null;
    setCollaboratingErrors(unanswered ? [t('questions.collaborating.required')] : []);
    if (unanswered || Object.keys(invalid).length) {
      showErrors(invalid, [t('questions.fixErrors')]);
      return;
    }
    setErrors({});
    setFormErrors([]);
    setBuddyErrors([]);

    // A saved pick whose team is gone from the loaded options has no checkbox to
    // clear, so drop it; without loaded options, send the saved ids unchanged.
    // Picks go only with a Yes; the draft keeps them while the answer is No, but
    // saving No discards them.
    const known = buddyOptions.data && new Set(buddyOptions.data.map((option) => option.id));
    const input = {
      answers: payload,
      collaborating,
      buddy_team_ids: !collaborating
        ? []
        : known
          ? buddies.teamIds.filter((id) => known.has(id))
          : buddies.teamIds,
      other_buddies: collaborating && buddies.otherSelected ? buddies.otherText.trim() : '',
    };
    save.mutate(input, {
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
        if (error instanceof ApiError && error.error === 'invalid_buddies') {
          const { collaborating: onQuestion = [], ...rest } = error.errors;
          const messages = Object.values(rest).flat();
          if (onQuestion.length) {
            setCollaboratingErrors(onQuestion);
            setFocusTick((tick) => tick + 1);
          }
          if (messages.length || !onQuestion.length) {
            setBuddyErrors(messages.length ? messages : [t('common.genericError')]);
          }
          // Retry from fresh data in case the saved picks or the options went stale.
          void queryClient.invalidateQueries({ queryKey: questionsQueryKey(team.id) });
          void queryClient.invalidateQueries({ queryKey: buddyOptionsQueryKey(team.id) });
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
          <CollaboratingQuestion
            value={collaborating}
            onChange={handleCollaboratingChange}
            disabled={save.isPending}
            errors={collaboratingErrors}
          />
          {!collaborating ? null : buddyOptions.isError && !buddyOptions.data ? (
            <BuddyFieldset>
              <QueryError onRetry={() => void buddyOptions.refetch()} />
            </BuddyFieldset>
          ) : buddyOptions.isPending ? (
            <BuddyFieldset>
              <QueryLoading />
            </BuddyFieldset>
          ) : (
            <BuddyPicker
              options={buddyOptions.data}
              value={buddies}
              onChange={handleBuddyChange}
              disabled={save.isPending}
              error={buddyErrors}
            />
          )}
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
