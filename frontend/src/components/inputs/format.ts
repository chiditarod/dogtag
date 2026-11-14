const digitsOf = (s: string) => s.replace(/\D/g, '');

/** Turns whatever was typed or pasted into `(ddd) ddd-dddd`, progressively. */
export function formatPhoneDisplay(raw: string): string {
  let digits = digitsOf(raw);
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export const phoneDigitCount = (display: string) =>
  digitsOf(formatPhoneDisplay(display)).length;

/** `ddd-ddd-dddd` for a complete number, otherwise the raw value untouched. */
export function toApiPhone(display: string): string {
  const digits = formatPhoneDisplay(display).replace(/\D/g, '');
  return digits.length === 10
    ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    : display;
}

/** Mirrors the Rails regex in `app/models/person.rb`. */
const EMAIL_PATTERN = /^([^@\s]+)@((?:[-a-z0-9]+\.)+[a-z]{2,})$/i;
export const isLikelyEmail = (s: string) => EMAIL_PATTERN.test(s);

/** Digits and at most one hyphen, shaped as `ddddd` or `ddddd-dddd`. */
export function formatZipDisplay(raw: string): string {
  const digits = digitsOf(raw).slice(0, 9);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  if (digits.length === 5 && raw.includes('-') && raw.lastIndexOf('-') > 4) {
    return `${digits}-`;
  }
  return digits;
}

export const zipDigitCount = (display: string) => digitsOf(display).length;
