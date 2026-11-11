import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import type {
  AnswerErrors,
  Answers,
  JsonformProperty,
  JsonformSchema,
} from '@/features/questions/types';
import { t } from '@/locales/en';

const ajv = new Ajv({ allErrors: true, strict: false });

/** `agree-*` fields: enum No/Yes with pattern ^Yes$, rendered as one checkbox. */
export function isAgreeField(key: string, property: JsonformProperty | undefined) {
  return (
    key.startsWith('agree-') &&
    property?.pattern === '^Yes$' &&
    !!property.enum?.includes('Yes')
  );
}

/**
 * Race payloads use draft-03 style per-property `required: true`. Moves those
 * into the top-level `required` array ajv expects and drops the booleans.
 * Returns a copy.
 */
export function draft04ToDraft07(schema: JsonformSchema): JsonformSchema {
  const required = new Set(schema.required ?? []);
  const properties: Record<string, JsonformProperty> = {};
  for (const [key, { required: isRequired, ...rest }] of Object.entries(schema.properties)) {
    if (isRequired === true) required.add(key);
    properties[key] = rest;
  }
  const converted: Record<string, unknown> = { ...schema, properties };
  delete converted.required;
  delete converted.$schema;
  if (required.size) converted.required = [...required];
  return converted as unknown as JsonformSchema;
}

const compiled = new WeakMap<JsonformSchema, ValidateFunction>();

function validatorFor(schema: JsonformSchema) {
  let validate = compiled.get(schema);
  if (!validate) {
    validate = ajv.compile(draft04ToDraft07(schema));
    compiled.set(schema, validate);
  }
  return validate;
}

function messageFor(
  error: ErrorObject,
  key: string,
  property: JsonformProperty | undefined,
) {
  if (isAgreeField(key, property)) return t('questions.agree');
  switch (error.keyword) {
    case 'required':
      return t('questions.required');
    case 'maxLength':
      return t('questions.tooLong', { max: property?.maxLength ?? 0 });
    case 'enum':
      return t('questions.badChoice');
    default:
      return t('questions.badFormat');
  }
}

const unescapePointer = (segment: string) =>
  segment.replace(/~1/g, '/').replace(/~0/g, '~');

/**
 * Validates answers against the race's schema (empty strings count as
 * missing). Returns per-key messages; `{}` means valid.
 */
export function validateAnswers(schema: JsonformSchema, answers: Answers): AnswerErrors {
  const data: Answers = {};
  for (const [key, value] of Object.entries(answers)) {
    if (key in schema.properties && value !== '') data[key] = value;
  }

  const validate = validatorFor(schema);
  validate(data);

  const errors: AnswerErrors = {};
  for (const error of validate.errors ?? []) {
    const key =
      error.keyword === 'required'
        ? String(error.params.missingProperty)
        : unescapePointer(error.instancePath.split('/')[1] ?? '');
    if (!key) continue;
    const message = messageFor(error, key, schema.properties[key]);
    const list = (errors[key] ??= []);
    if (!list.includes(message)) list.push(message);
  }
  return errors;
}

/** Fills in non-empty schema defaults for questions without a saved answer. */
export function defaultAnswers(schema: JsonformSchema, answers: Answers): Answers {
  const result: Answers = { ...answers };
  for (const [key, property] of Object.entries(schema.properties)) {
    if (result[key] === undefined && property.default) result[key] = property.default;
  }
  return result;
}

const SCHEMA_SUFFIX = / in schema \S+.*$/;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Maps json-schema gem messages ("The property '#/racer-type' value ... did
 * not match ...") onto question keys. Anything without a known key is returned
 * as a form-level message.
 */
export function mapServerErrors(messages: string[], schema: JsonformSchema) {
  const byKey: AnswerErrors = {};
  const form: string[] = [];

  for (const raw of messages) {
    const message = raw.replace(SCHEMA_SUFFIX, '');
    const missing = /required property of '([^']+)'/.exec(message)?.[1];
    const pointer = /'#\/([^'\s]+)'/.exec(message)?.[1];
    const key = missing ?? pointer;

    if (key && key in schema.properties) {
      const text = missing
        ? t('questions.required')
        : capitalize(message.replace(/^The property '[^']*'\s*/, ''));
      (byKey[key] ??= []).push(text);
    } else {
      form.push(message);
    }
  }
  return { byKey, form };
}
