import { Component, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { JsonformRenderer } from '@/features/questions/components/jsonform-renderer';
import type { Answers, Jsonform } from '@/features/questions/types';
import { t } from '@/locales/en';
import { parseJsonform } from '../jsonform-text';

interface JsonformEditorProps {
  /** The stored text, as typed. */
  value: string;
  onChange: (text: string) => void;
  /** Schema keys shown as filters and columns on Who's registered. */
  filterField: string[];
  onFilterFieldChange: (keys: string[]) => void;
  /** Server messages for the text. */
  error?: string[];
}

const textarea =
  'block w-full min-w-0 resize-y whitespace-pre rounded-md border border-flag bg-white px-3 py-2 font-mono text-sm text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';

/**
 * Valid JSON can still hold something the renderer cannot draw (a `null` form item, say). The preview says so
 * instead of taking the whole page down, and tries again when the questions change.
 */
class PreviewBoundary extends Component<{ resetKey: unknown; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { resetKey: unknown }) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? (
      <p role="status" className="text-sm font-semibold text-starText">
        {t('staff.races.form.previewFailed')}
      </p>
    ) : (
      this.props.children
    );
  }
}

/** The questions as JSON text, with a live preview of the last text that parsed and the filter-field choices. */
export function JsonformEditor({ value, onChange, filterField, onFilterFieldChange, error = [] }: JsonformEditorProps) {
  const parsed = useMemo(() => parseJsonform(value), [value]);
  // The last parsed questions: a broken text keeps showing (and offering filters for) the version before it.
  const [good, setGood] = useState(() => (parsed.ok ? parsed : null));
  if (parsed.ok && parsed !== good) setGood(parsed);

  const [answers, setAnswers] = useState<Answers>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  const parseMessage = parsed.ok
    ? undefined
    : parsed.location
      ? t('staff.races.form.parseError', { ...parsed.location, message: parsed.message })
      : parsed.message === t('staff.races.form.noSchema')
        ? parsed.message
        : t('staff.races.form.parseErrorPlain', { message: parsed.message });
  const messages = [parseMessage, ...error].filter((message): message is string => !!message);

  const keys = good?.keys ?? [];
  const jsonform: Jsonform | null = good?.jsonform ?? null;

  function handleChange(text: string) {
    onChange(text);
    const next = parseJsonform(text);
    if (!next.ok) return;
    // A question that left the schema cannot stay a filter.
    const kept = filterField.filter((key) => next.keys.includes(key));
    if (kept.length !== filterField.length) onFilterFieldChange(kept);
  }

  function toggle(key: string, checked: boolean) {
    const selected = new Set(filterField);
    if (checked) selected.add(key);
    else selected.delete(key);
    onFilterFieldChange(keys.filter((candidate) => selected.has(candidate)));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Field label={t('staff.races.form.questionsJson')} name="jsonform" error={messages}>
          {(control) => (
            <textarea
              {...control}
              className={textarea}
              rows={16}
              wrap="off"
              spellCheck={false}
              value={value}
              onChange={(event) => handleChange(event.target.value)}
            />
          )}
        </Field>
        {!parsed.ok && jsonform && (
          <p className="text-sm text-navy/80 lg:col-start-1">{t('staff.races.form.previewStale')}</p>
        )}

        {jsonform && (
          <div className="min-w-0 space-y-2 lg:row-span-2 lg:row-start-1 lg:col-start-2">
            <Button
              variant="secondary"
              className="sm:hidden"
              aria-expanded={previewOpen}
              onClick={() => setPreviewOpen((open) => !open)}
            >
              {previewOpen ? t('staff.races.form.hidePreview') : t('staff.races.form.showPreview')}
            </Button>
            <div
              role="region"
              aria-label={t('staff.races.form.previewRegion')}
              className={`${previewOpen ? 'block' : 'hidden sm:block'} space-y-3 rounded-md border border-flag bg-page p-3`}
            >
              <p className="text-sm text-navy/70">{t('staff.races.form.previewCaption')}</p>
              <PreviewBoundary resetKey={jsonform}>
                <JsonformRenderer
                  jsonform={jsonform}
                  value={answers}
                  onChange={(key, next) => setAnswers((current) => ({ ...current, [key]: next }))}
                  errors={{}}
                />
              </PreviewBoundary>
            </div>
          </div>
        )}
      </div>

      {keys.length > 0 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy">{t('staff.races.form.filterLegend')}</legend>
          <p className="text-sm text-navy/80">{t('staff.races.form.filterHelp')}</p>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-4 sm:grid-cols-2">
            {keys.map((key) => (
              <label key={key} className="flex min-h-11 items-center gap-2 text-sm [overflow-wrap:anywhere]">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-link"
                  checked={filterField.includes(key)}
                  onChange={(event) => toggle(key, event.target.checked)}
                />
                {good?.titles[key] ?? key}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
