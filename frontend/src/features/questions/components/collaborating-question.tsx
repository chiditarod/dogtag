import { useId } from 'react';
import { InfoTip } from '@/components/ui/info-tip';
import { t } from '@/locales/en';

const choiceClass = 'flex min-h-11 items-center gap-3 rounded-md px-1 text-base text-navy';
const markClass = 'size-5 shrink-0 accent-link focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

interface CollaboratingQuestionProps {
  /** null while unanswered. */
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  errors?: string[];
}

/** "Same route as another team?" Yes/No; Yes reveals the team picker. */
export function CollaboratingQuestion({ value, onChange, disabled, errors }: CollaboratingQuestionProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const hasError = !!errors?.length;
  const choices = [
    { answer: true, label: t('questions.collaborating.yes') },
    { answer: false, label: t('questions.collaborating.no') },
  ];

  return (
    <div data-invalid={hasError || undefined} className="space-y-1">
      <div className="flex items-center gap-1">
        <span id={labelId} className="text-sm font-semibold text-navy">
          {t('questions.collaborating.label')}
        </span>
        <InfoTip label={t('questions.collaborating.tip')}>
          {t('questions.collaborating.tipBody')}
        </InfoTip>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-required="true"
        aria-invalid={hasError || undefined}
        aria-describedby={hasError ? errorId : undefined}
        className="flex flex-wrap gap-x-6"
      >
        {choices.map(({ answer, label }) => (
          <label key={label} className={choiceClass}>
            <input
              type="radio"
              name={`${id}-collaborating`}
              value={answer ? 'yes' : 'no'}
              className={markClass}
              checked={value === answer}
              disabled={disabled}
              onChange={() => onChange(answer)}
            />
            {label}
          </label>
        ))}
      </div>
      {hasError && (
        <ul id={errorId} className="space-y-0.5 text-sm text-starText">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
