import { describe, expect, it, vi } from 'vitest';
import fixture from '@/features/questions/__fixtures__/chiditarod_21.json';
import {
  defaultAnswers,
  draft04ToDraft07,
  hiddenKeys,
  isAgreeField,
  mapServerErrors,
  validateAnswers,
} from '@/features/questions/validate';
import type { Jsonform, JsonformItem, JsonformSchema } from '@/features/questions/types';

const schema = fixture.schema as unknown as JsonformSchema;

const valid: Record<string, string> = {
  'racer-type': 'Racer',
  'raced-in-past': 'No',
  'theme-chosen': 'Yes',
  'explain-theme': 'TBD',
  'primary-inspiration': 'Winning',
  'secondary-inspiration': 'Pleasure',
  'racing-for-time': 'No',
  collaborating: 'No',
  'agree-to-core-philosophy': 'Yes',
  'agree-to-rules': 'Yes',
  'agree-to-sabotage': 'Yes',
  'agree-to-cart-deposit': 'Yes',
  'agree-to-cart-food-poundage': 'Yes',
  'agree-not-a-donation': 'Yes',
  'agree-to-orientation': 'Yes',
  'flame-effects': 'No',
  fundraising: 'Probably',
  'cart-parking': 'Short Term',
};

describe('draft04ToDraft07', () => {
  it('moves per-property required booleans into a top-level required array', () => {
    const out = draft04ToDraft07({
      type: 'object',
      properties: {
        a: { type: 'string', required: true },
        b: { type: 'string', required: false },
        c: { type: 'string', maxLength: 3 },
      },
    });
    expect(out.required).toEqual(['a']);
    expect(out.properties).toEqual({
      a: { type: 'string' },
      b: { type: 'string' },
      c: { type: 'string', maxLength: 3 },
    });
  });

  it('does not mutate the source schema', () => {
    const before = JSON.stringify(schema);
    draft04ToDraft07(schema as never);
    expect(JSON.stringify(schema)).toBe(before);
  });
});

describe('validateAnswers', () => {
  it('returns {} for a valid full answer set', () => {
    expect(validateAnswers(schema, valid)).toEqual({});
  });

  it('accepts valid optional answers', () => {
    expect(validateAnswers(schema, { ...valid, instagram: '@chiditarod' })).toEqual({});
  });

  it('asks for agreement when an agree field is unchecked or No', () => {
    const missing = { ...valid };
    delete missing['agree-to-rules'];
    expect(validateAnswers(schema, missing)['agree-to-rules']).toEqual(['You must agree to continue']);
    expect(validateAnswers(schema, { ...valid, 'agree-to-rules': 'No' })['agree-to-rules']).toEqual([
      'You must agree to continue',
    ]);
    expect(validateAnswers(schema, { ...valid, 'agree-to-rules': '' })['agree-to-rules']).toEqual([
      'You must agree to continue',
    ]);
  });

  it('reports a pattern error for a bad instagram handle', () => {
    const errors = validateAnswers(schema, { ...valid, instagram: 'bad' });
    expect(Object.keys(errors)).toEqual(['instagram']);
    expect(errors.instagram[0]).toMatch(/format/i);
  });

  it('reports maxLength', () => {
    const errors = validateAnswers(schema, { ...valid, instagram: '@' + 'a'.repeat(16) });
    expect(errors.instagram[0]).toMatch(/16/);
  });

  it('treats empty strings as missing for required fields and ignores empty optional fields', () => {
    const errors = validateAnswers(schema, { ...valid, 'explain-theme': '', instagram: '', 'racer-type': '' });
    expect(Object.keys(errors).sort()).toEqual(['explain-theme', 'racer-type']);
    expect(errors['explain-theme'][0]).toMatch(/required|answer/i);
  });

  it('reports every missing required key with allErrors', () => {
    const errors = validateAnswers(schema, {});
    expect(Object.keys(errors)).toHaveLength(Object.values(schema.properties).filter((p) => p.required === true).length);
  });

  it('rejects values outside an enum', () => {
    expect(validateAnswers(schema, { ...valid, 'racer-type': 'Hovercraft' })['racer-type']).toHaveLength(1);
  });

  it('skips client validation (returns {}) and warns once when ajv cannot compile the schema', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ruby: JsonformSchema = {
      type: 'object',
      properties: { handle: { type: 'string', pattern: '\\A[a-z]+\\z', required: true } },
    } as unknown as JsonformSchema;

    expect(validateAnswers(ruby, {})).toEqual({});
    expect(validateAnswers(ruby, { handle: 'NOT VALID' })).toEqual({});
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('caches the compiled validator per schema object', () => {
    const first = validateAnswers(schema, valid);
    const second = validateAnswers(schema, valid);
    expect(first).toEqual(second);
  });
});

describe('isAgreeField', () => {
  it('recognises agree-* yes/no pattern fields only', () => {
    expect(isAgreeField('agree-to-rules', schema.properties['agree-to-rules'])).toBe(true);
    expect(isAgreeField('flame-effects', schema.properties['flame-effects'])).toBe(false);
    expect(isAgreeField('theme-chosen', schema.properties['theme-chosen'])).toBe(false);
  });
});

describe('defaultAnswers', () => {
  it('only returns non-empty defaults for missing answers', () => {
    const s: JsonformSchema = {
      type: 'object',
      properties: { a: { type: 'string', default: 'x' }, b: { type: 'string', default: '' }, c: { type: 'string', default: 'z' } },
    };
    expect(defaultAnswers(s, { c: 'mine' })).toEqual({ a: 'x', c: 'mine' });
  });
});

describe('mapServerErrors', () => {
  it('maps json-schema gem messages to keys and keeps the rest form-level', () => {
    const { byKey, form } = mapServerErrors(
      [
        `The property '#/racer-type' value "Hover" did not match one of the following values: Racer, Art Cart in schema 4a1c`,
        `The property '#/' did not contain a required property of 'explain-theme' in schema 4a1c`,
        `The property '#/nonexistent' of type integer did not match`,
        'Something else broke',
      ],
      schema,
    );
    expect(byKey['racer-type']).toHaveLength(1);
    expect(byKey['racer-type'][0]).toMatch(/did not match one of the following values/);
    expect(byKey['racer-type'][0]).not.toMatch(/in schema/);
    expect(byKey['explain-theme']).toHaveLength(1);
    expect(form).toEqual([expect.stringMatching(/nonexistent/), 'Something else broke']);
  });
});

describe('hiddenKeys', () => {
  const properties = { a: { type: 'string' }, b: { type: 'string' }, c: { type: 'string' } };
  const jsonformWith = (form: JsonformItem[]): Jsonform => ({
    schema: { type: 'object', properties },
    form,
  });
  const showC = (showWhen: unknown) => jsonformWith(['a', 'b', { key: 'c', showWhen }]);

  it('hides a field until the controlling answer matches', () => {
    const jsonform = showC({ a: 'Yes' });
    expect(hiddenKeys(jsonform, { a: 'No' })).toEqual(new Set(['c']));
    expect(hiddenKeys(jsonform, { a: 'Yes' })).toEqual(new Set());
    expect(hiddenKeys(jsonform, {})).toEqual(new Set(['c']));
  });

  it('finds showWhen on items nested in fieldsets', () => {
    const jsonform = jsonformWith([
      'a',
      { type: 'fieldset', items: ['b', { key: 'c', showWhen: { a: 'Yes' } }] },
    ]);
    expect(hiddenKeys(jsonform, { a: 'No' })).toEqual(new Set(['c']));
    expect(hiddenKeys(jsonform, { a: 'Yes' })).toEqual(new Set());
  });

  it('a hidden controller hides its dependents', () => {
    const jsonform = jsonformWith([
      'a',
      { key: 'b', showWhen: { a: 'Yes' } },
      { key: 'c', showWhen: { b: 'x' } },
    ]);
    expect(hiddenKeys(jsonform, { a: 'No', b: 'x' })).toEqual(new Set(['b', 'c']));
    expect(hiddenKeys(jsonform, { a: 'Yes', b: 'x' })).toEqual(new Set());
  });

  it('cycles and self references leave every field visible', () => {
    const cycle = jsonformWith([
      { key: 'a', showWhen: { b: 'x' } },
      { key: 'b', showWhen: { a: 'y' } },
      'c',
    ]);
    expect(hiddenKeys(cycle, {})).toEqual(new Set());
    const self = jsonformWith([{ key: 'a', showWhen: { a: 'x' } }, 'b', 'c']);
    expect(hiddenKeys(self, {})).toEqual(new Set());
  });

  it.each([
    ['an array', []],
    ['null', null],
    ['a string', 'Yes'],
    ['two pairs', { a: 'Yes', b: 'No' }],
    ['a non-string value', { a: 1 }],
    ['an unknown controlling key', { missing: 'Yes' }],
  ])('ignores a malformed showWhen (%s)', (_label, showWhen) => {
    expect(hiddenKeys(showC(showWhen), { a: 'No' }).has('c')).toBe(false);
  });

  it('has no conditions when the form list is empty', () => {
    expect(hiddenKeys({ schema: { type: 'object', properties } }, {})).toEqual(new Set());
    expect(hiddenKeys(jsonformWith([]), {})).toEqual(new Set());
  });
});
