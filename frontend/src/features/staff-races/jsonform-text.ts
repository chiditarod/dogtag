import type { Jsonform } from '@/features/questions/types';
import { t } from '@/locales/en';

export interface JsonLocation {
  line: number;
  column: number;
}

/**
 * Where a `JSON.parse` failure happened. Engines word it differently: V8 says `(line 2 column 5)` or
 * `at position 10`, Firefox says `at line 2 column 5 of the JSON data`. Null when the message says nothing.
 */
export function jsonErrorLocation(text: string, error: unknown): JsonLocation | null {
  const message = error instanceof Error ? error.message : '';
  const lineColumn = /line (\d+) column (\d+)/i.exec(message);
  if (lineColumn) return { line: Number(lineColumn[1]), column: Number(lineColumn[2]) };

  const position = /position (\d+)/i.exec(message);
  if (!position) return null;
  return locationAt(text, Number(position[1]));
}

/** The engine's own wording without its `(line N column M)` tail, which the location already says. */
function bareMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\s*\(line \d+ column \d+\)\s*$/i, '');
}

/**
 * The index of the first character JSON cannot continue with (the text's length when it ends early),
 * or -1 for valid text. Chrome's newer messages for some errors carry no position, so this finds one
 * the same way in every browser.
 */
function firstSyntaxError(text: string): number {
  let at = 0;
  const skip = () => {
    while (at < text.length && ' \t\n\r'.includes(text[at])) at += 1;
  };
  const fail = (): never => {
    throw at;
  };
  const expect = (char: string) => {
    if (text[at] !== char) fail();
    at += 1;
  };
  const string = () => {
    expect('"');
    for (;;) {
      const char = text[at];
      if (char === undefined || char < ' ') fail();
      at += 1;
      if (char === '"') return;
      if (char !== '\\') continue;
      const escape = text[at];
      if (escape === 'u') {
        if (!/^[0-9a-fA-F]{4}/.test(text.slice(at + 1, at + 5))) {
          at += 1;
          fail();
        }
        at += 5;
      } else if (escape !== undefined && '"\\/bfnrt'.includes(escape)) {
        at += 1;
      } else {
        fail();
      }
    }
  };
  const members = (close: string, member: () => void) => {
    at += 1;
    skip();
    if (text[at] === close) {
      at += 1;
      return;
    }
    for (;;) {
      member();
      skip();
      if (text[at] === ',') {
        at += 1;
        skip();
        continue;
      }
      expect(close);
      return;
    }
  };
  const value = (): void => {
    skip();
    const char = text[at];
    if (char === '{') {
      members('}', () => {
        string();
        skip();
        expect(':');
        value();
      });
    } else if (char === '[') {
      members(']', value);
    } else if (char === '"') {
      string();
    } else {
      const literal = /-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?|true|false|null/y;
      literal.lastIndex = at;
      const hit = literal.exec(text);
      if (!hit) fail();
      at += hit![0].length;
    }
  };

  try {
    value();
    skip();
    return at < text.length ? at : -1;
  } catch (position) {
    return position as number;
  }
}

/** Line and column (1-based) of an index in the text. */
function locationAt(text: string, index: number): JsonLocation {
  const before = text.slice(0, index);
  return { line: before.split('\n').length, column: index - (before.lastIndexOf('\n') + 1) + 1 };
}

export type ParsedJsonform =
  | { ok: true; jsonform: Jsonform | null; keys: string[]; titles: Record<string, string> }
  | { ok: false; message: string; location: JsonLocation | null };

/** What the editor needs from the text: the parsed questions, or why they cannot be read. Blank is "no questions". */
export function parseJsonform(text: string): ParsedJsonform {
  if (text.trim() === '') return { ok: true, jsonform: null, keys: [], titles: {} };

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const index = firstSyntaxError(text);
    const location = jsonErrorLocation(text, error) ?? (index >= 0 ? locationAt(text, index) : null);
    return { ok: false, message: bareMessage(error), location };
  }

  const properties = (value as { schema?: { properties?: unknown } } | null)?.schema?.properties;
  if (typeof properties !== 'object' || properties === null || Array.isArray(properties)) {
    return { ok: false, message: t('staff.races.form.noSchema'), location: null };
  }

  const entries = Object.entries(properties as Record<string, { title?: unknown } | null>);
  return {
    ok: true,
    jsonform: value as Jsonform,
    keys: entries.map(([key]) => key),
    titles: Object.fromEntries(
      entries.map(([key, property]) => [key, typeof property?.title === 'string' && property.title ? property.title : key]),
    ),
  };
}
