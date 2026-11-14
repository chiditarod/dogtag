import { SafeHtml } from '@/components/ui/safe-html';
import { JsonformField } from '@/features/questions/components/jsonform-field';
import type {
  AnswerErrors,
  Answers,
  Jsonform,
  JsonformItem,
} from '@/features/questions/types';

interface JsonformRendererProps {
  jsonform: Jsonform;
  value: Answers;
  onChange: (key: string, value: string) => void;
  errors: AnswerErrors;
}

const warnedTypes = new Set<string>();

function warnUnknown(type: string) {
  if (warnedTypes.has(type)) return;
  warnedTypes.add(type);
  console.warn(`JsonformRenderer: unsupported form item type "${type}" ignored`);
}

const richText =
  'space-y-2 text-sm text-navy [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5';

/**
 * Renders the Joshfire JSONForm subset used by race questions: fieldsets,
 * help text, and keyed fields. `submit` items are ignored (the card has its
 * own Save).
 */
export function JsonformRenderer({ jsonform, value, onChange, errors }: JsonformRendererProps) {
  const { schema } = jsonform;
  const items: JsonformItem[] = jsonform.form?.length
    ? jsonform.form
    : Object.keys(schema.properties);

  function renderItem(item: JsonformItem, index: number) {
    const object = typeof item === 'string' ? undefined : item;
    const key = typeof item === 'string' ? item : item.key;
    if (key !== undefined) {
      const property = schema.properties[key];
      if (!property) return null;
      return (
        <JsonformField
          key={key}
          fieldKey={key}
          property={property}
          item={object}
          value={value[key]}
          errors={errors[key]}
          onChange={(next) => onChange(key, next)}
        />
      );
    }

    const structural = object ?? {};
    switch (structural.type) {
      case 'fieldset':
        return (
          <fieldset key={index} className="space-y-5 border-0 p-0">
            {structural.title && (
              <legend className="mb-3 text-lg font-bold text-navy">
                <SafeHtml html={structural.title} />
              </legend>
            )}
            {structural.items?.map(renderItem)}
          </fieldset>
        );
      case 'help':
        return structural.helpvalue ? (
          <SafeHtml key={index} as="div" html={structural.helpvalue} className={richText} />
        ) : null;
      case 'submit':
        return null;
      default:
        warnUnknown(String(structural.type));
        return null;
    }
  }

  return <div className="space-y-6">{items.map(renderItem)}</div>;
}
