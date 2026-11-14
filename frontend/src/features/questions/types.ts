export interface JsonformProperty {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  pattern?: string;
  maxLength?: number;
  default?: string;
  /** Draft-03 style: per-property boolean (converted before validation). */
  required?: boolean;
}

export interface JsonformSchema {
  type?: string;
  properties: Record<string, JsonformProperty>;
  required?: string[];
}

export type TitleMap = Record<string, string> | Array<{ value: string; name: string }>;

/** A non-string `form` entry: a keyed field with overrides, or a structural item. */
export interface JsonformItemObject {
  key?: string;
  type?: string;
  title?: string;
  description?: string;
  titleMap?: TitleMap;
  items?: JsonformItem[];
  helpvalue?: string;
}

export type JsonformItem = string | JsonformItemObject;

export interface Jsonform {
  schema: JsonformSchema;
  form?: JsonformItem[];
}

export type Answers = Record<string, string>;
export type AnswerErrors = Record<string, string[]>;
