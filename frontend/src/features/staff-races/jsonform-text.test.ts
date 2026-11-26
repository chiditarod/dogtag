import { describe, expect, it } from 'vitest';
import { jsonErrorLocation, parseJsonform } from './jsonform-text';

function failure(text: string): unknown {
  try {
    JSON.parse(text);
  } catch (error) {
    return error;
  }
  throw new Error('expected the text not to parse');
}

describe('jsonErrorLocation', () => {
  it('turns "position N" into a line and column', () => {
    const text = '{\n  "a": }';
    // "{\n" is 2 characters, then two spaces and `"a": ` put the } at index 11.
    expect(jsonErrorLocation(text, new SyntaxError('Unexpected token } in JSON at position 10'))).toEqual({
      line: 2,
      column: 9,
    });
  });

  it('reads "line N column M" first', () => {
    const error = new SyntaxError("Expected ',' or '}' after property value in JSON at position 30 (line 4 column 7)");

    expect(jsonErrorLocation('anything', error)).toEqual({ line: 4, column: 7 });
  });

  it('reads the Firefox wording', () => {
    const error = new SyntaxError("JSON.parse: expected ',' or '}' after property value in object at line 3 column 2 of the JSON data");

    expect(jsonErrorLocation('anything', error)).toEqual({ line: 3, column: 2 });
  });

  it('is null when the message says nothing about where', () => {
    expect(jsonErrorLocation('{', new SyntaxError('bad'))).toBeNull();
    expect(jsonErrorLocation('{', 'not an error')).toBeNull();
  });

  it('finds the real location of a real parse failure on a two-line text', () => {
    const text = '{\n  "a": 1,\n}';
    const location = jsonErrorLocation(text, failure(text));

    expect(location?.line).toBe(3);
  });
});

describe('parseJsonform', () => {
  it('parses a jsonform and lists its keys and titles', () => {
    const result = parseJsonform(
      JSON.stringify({ schema: { type: 'object', properties: { a: { title: 'Alpha' }, b: {} } } }),
    );

    expect(result).toMatchObject({ ok: true, keys: ['a', 'b'] });
    expect(result.ok && result.titles).toEqual({ a: 'Alpha', b: 'b' });
  });

  it('treats blank text as no questions', () => {
    expect(parseJsonform('  ')).toEqual({ ok: true, jsonform: null, keys: [], titles: {} });
  });

  it('reports invalid JSON with its location', () => {
    const result = parseJsonform('{\n  "a": }');

    expect(result.ok).toBe(false);
    expect(!result.ok && result.location?.line).toBe(2);
  });

  it('finds a location even when the engine names none', () => {
    const cases: [string, { line: number; column: number }][] = [
      ['{\n  "a": }', { line: 2, column: 8 }],
      ['{"a": [1, 2,]}', { line: 1, column: 13 }],
      ['{"a": "x\n"}', { line: 1, column: 9 }],
      ['{"a": tru}', { line: 1, column: 7 }],
      ['{"a": 1} x', { line: 1, column: 10 }],
      ['{"a": 1', { line: 1, column: 8 }],
    ];
    for (const [text, location] of cases) {
      const result = parseJsonform(text);
      expect(result.ok, text).toBe(false);
      expect(!result.ok && result.location, text).toEqual(location);
    }
  });

  it('rejects JSON that has no schema with properties', () => {
    for (const text of ['[]', '{}', '{"schema": {}}', '"x"', 'null']) {
      const result = parseJsonform(text);
      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toMatch(/schema/i);
    }
  });
});
