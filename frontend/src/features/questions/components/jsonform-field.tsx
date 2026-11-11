import { useId } from 'react';
import { SafeHtml } from '@/components/ui/safe-html';
import { isAgreeField } from '@/features/questions/validate';
import type {
  JsonformItemObject,
  JsonformProperty,
  TitleMap,
} from '@/features/questions/types';
import { t } from '@/locales/en';

interface Option {
  value: string;
  label: string;
}

interface JsonformFieldProps {
  fieldKey: string;
  property: JsonformProperty;
  /** Form item overrides (type, title, description, titleMap), if any. */
  item?: JsonformItemObject;
  value: string | undefined;
  errors: string[] | undefined;
  onChange: (value: string) => void;
}

const controlClass =
  'block min-h-11 w-full rounded-md border border-flag bg-white px-3 py-2 font-sans text-base text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-link aria-[invalid=true]:border-star';
const choiceClass =
  'flex min-h-11 items-center gap-3 rounded-md px-1 text-base text-navy';
const markClass = 'size-5 shrink-0 accent-link focus:outline-none focus-visible:ring-2 focus-visible:ring-link';

function optionsFor(property: JsonformProperty, titleMap?: TitleMap): Option[] {
  if (Array.isArray(titleMap)) {
    return titleMap.map(({ value, name }) => ({ value, label: name }));
  }
  if (titleMap) {
    return Object.entries(titleMap).map(([value, label]) => ({ value, label }));
  }
  return (property.enum ?? []).map((value) => ({ value, label: value }));
}

type Kind = 'checkbox' | 'radios' | 'select' | 'textarea' | 'text';

function kindFor(
  fieldKey: string,
  property: JsonformProperty,
  item: JsonformItemObject | undefined,
  options: Option[],
): Kind {
  if (isAgreeField(fieldKey, property)) return 'checkbox';
  if (item?.type === 'textarea') return 'textarea';
  if (item?.type === 'radios') return 'radios';
  if (item?.type === 'select') return 'select';
  if (options.length) return options.length <= 3 ? 'radios' : 'select';
  return 'text';
}

export function JsonformField({
  fieldKey,
  property,
  item,
  value,
  errors,
  onChange,
}: JsonformFieldProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const options = optionsFor(property, item?.titleMap);
  const kind = kindFor(fieldKey, property, item, options);
  const title = item?.title ?? property.title ?? fieldKey;
  const description = item?.description ?? property.description;
  const hasError = !!errors?.length;
  const current = value ?? property.default ?? '';
  const describedBy =
    [description ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  const control = {
    id,
    name: fieldKey,
    'aria-invalid': hasError ? (true as const) : undefined,
    'aria-describedby': describedBy,
  };

  const titleNode = <SafeHtml html={title} />;
  const optionalMark = !property.required && kind !== 'checkbox' && (
    <span className="text-sm text-navy/70">{t('questions.optional')}</span>
  );

  let body;
  switch (kind) {
    case 'checkbox':
      body = (
        <label className={`${choiceClass} items-start py-2 font-semibold`}>
          <input
            {...control}
            type="checkbox"
            className={`${markClass} mt-0.5`}
            checked={current === 'Yes'}
            onChange={(event) => onChange(event.target.checked ? 'Yes' : 'No')}
          />
          {titleNode}
        </label>
      );
      break;
    case 'radios':
      body = (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <span id={labelId} className="text-sm font-semibold text-navy">
              {titleNode}
            </span>
            {optionalMark}
          </div>
          <div
            role="radiogroup"
            aria-labelledby={labelId}
            aria-invalid={control['aria-invalid']}
            aria-describedby={describedBy}
            className="flex flex-wrap gap-x-6"
          >
            {options.map((option) => (
              <label key={option.value} className={choiceClass}>
                <input
                  type="radio"
                  name={`${id}-${fieldKey}`}
                  value={option.value}
                  className={markClass}
                  checked={current === option.value}
                  onChange={() => onChange(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </>
      );
      break;
    default:
      body = (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <label htmlFor={id} className="text-sm font-semibold text-navy">
              {titleNode}
            </label>
            {optionalMark}
          </div>
          {kind === 'select' ? (
            <select
              {...control}
              className={controlClass}
              value={current}
              onChange={(event) => onChange(event.target.value)}
            >
              {!property.default && <option value="">{t('questions.choose')}</option>}
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : kind === 'textarea' ? (
            <textarea
              {...control}
              rows={4}
              className={controlClass}
              value={current}
              onChange={(event) => onChange(event.target.value)}
            />
          ) : (
            <input
              {...control}
              type="text"
              className={controlClass}
              value={current}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </>
      );
  }

  return (
    <div data-field-key={fieldKey} data-invalid={hasError || undefined} className="space-y-1">
      {body}
      {description && (
        <SafeHtml
          as="div"
          id={hintId}
          html={description}
          className="space-y-2 text-sm text-navy/80 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
        />
      )}
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
