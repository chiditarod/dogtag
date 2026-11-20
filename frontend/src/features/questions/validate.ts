import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import type {
  AnswerErrors,
  Answers,
  Jsonform,
  JsonformItem,
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

/** Cached for schemas ajv cannot compile; the server's 422 is then the only gate. */
const NO_CLIENT_VALIDATION = 'none';
const compiled = new WeakMap<JsonformSchema, ValidateFunction | typeof NO_CLIENT_VALIDATION>();

/**
 * Race schemas are validated server-side with Ruby, so they may hold things
 * ajv rejects (Ruby-only regex like `\A`/`\z`, unknown formats). Never let
 * that block saving: skip client validation for that schema instead.
 */
function validatorFor(schema: JsonformSchema) {
  let validate = compiled.get(schema);
  if (!validate) {
    try {
      validate = ajv.compile(draft04ToDraft07(schema));
    } catch (error) {
      console.warn('Skipping client-side question validation; schema did not compile.', error);
      validate = NO_CLIENT_VALIDATION;
    }
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
  if (validate === NO_CLIENT_VALIDATION) return {};
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

interface Condition {
  controller: string;
  expected: string;
}

/** A valid showWhen is a one-pair object of strings naming a schema key; anything else is ignored. */
function parseShowWhen(showWhen: unknown, schema: JsonformSchema): Condition | undefined {
  if (typeof showWhen !== 'object' || showWhen === null || Array.isArray(showWhen)) return;
  const entries = Object.entries(showWhen);
  if (entries.length !== 1) return;
  const [controller, expected] = entries[0];
  if (typeof expected !== 'string' || !(controller in schema.properties)) return;
  return { controller, expected };
}

function collectConditions(
  items: JsonformItem[] | undefined,
  schema: JsonformSchema,
  conditions: Map<string, Condition>,
) {
  for (const item of items ?? []) {
    if (typeof item === 'string') continue;
    if (item.key !== undefined && !conditions.has(item.key)) {
      const condition = parseShowWhen(item.showWhen, schema);
      if (condition) conditions.set(item.key, condition);
    }
    collectConditions(item.items, schema, conditions);
  }
}

/**
 * Schema keys hidden by a `showWhen` on their form item, given the current
 * answers (defaults already applied). A field is hidden when its controlling
 * answer is not exactly the expected value, or when its controller is itself
 * hidden. A cycle leaves its fields visible.
 */
export function hiddenKeys(jsonform: Jsonform, answers: Answers): Set<string> {
  const conditions = new Map<string, Condition>();
  collectConditions(jsonform.form, jsonform.schema, conditions);

  // Walks the controller chain; undefined means the chain loops.
  function isHidden(key: string, seen: Set<string>): boolean | undefined {
    const condition = conditions.get(key);
    if (!condition) return false;
    if (seen.has(key)) return undefined;
    seen.add(key);
    const controllerHidden = isHidden(condition.controller, seen);
    if (controllerHidden === undefined) return undefined;
    return controllerHidden || answers[condition.controller] !== condition.expected;
  }

  const hidden = new Set<string>();
  for (const key of conditions.keys()) {
    if (isHidden(key, new Set()) === true) hidden.add(key);
  }
  return hidden;
}

const SCHEMA_SUFFIX =/ in schema \S+.*$/;
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
