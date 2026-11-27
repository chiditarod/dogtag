import { Field } from '@/components/ui/field';
import { SafeHtml } from '@/components/ui/safe-html';
import { t } from '@/locales/en';
import { useConfirmationPreview } from '../api/use-confirmation-preview';
import { confirmationLength } from '../race-form-checks';

interface ConfirmationTextCardProps {
  value: string;
  onChange: (text: string) => void;
  /** The limit the API reports (`confirmation_text_max_length`). */
  maxLength: number;
  error?: string[];
}

const textarea =
  'block w-full min-w-0 resize-y rounded-md border border-flag bg-white px-3 py-2 font-mono text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

/** The Markdown text with its character count and the server's rendering of it. */
export function ConfirmationTextCard({ value, onChange, maxLength, error = [] }: ConfirmationTextCardProps) {
  const html = useConfirmationPreview(value);
  const length = confirmationLength(value);
  const over = length > maxLength;
  const messages = over ? [t('staff.races.form.confirmationTooLong', { max: maxLength }), ...error] : error;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      <Field
        label={t('staff.races.form.confirmationLabel')}
        name="confirmation_text"
        help={t('staff.races.form.confirmationHelp')}
        error={messages}
      >
        {(control) => (
          <>
            <textarea {...control} className={textarea} rows={8} value={value} onChange={(e) => onChange(e.target.value)} />
            <p className={`text-sm ${over ? 'font-semibold text-starText' : 'text-navy/70'}`}>
              {t('staff.races.form.confirmationCount', { n: length, max: maxLength })}
            </p>
          </>
        )}
      </Field>
      {html && (
        <div
          role="region"
          aria-label={t('staff.races.form.confirmationPreview')}
          className="min-w-0 rounded-md border border-flag bg-page p-3"
        >
          <SafeHtml
            as="div"
            html={html}
            className="space-y-2 text-sm [overflow-wrap:anywhere] [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
          />
        </div>
      )}
    </div>
  );
}
