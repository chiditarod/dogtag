import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type ComponentPropsWithRef,
} from 'react';
import { Input } from '@/components/ui/field';
import { formatPhoneDisplay, phoneDigitCount } from '@/components/inputs/format';
import { useMergedRef } from '@/components/inputs/use-merged-ref';

export interface PhoneInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> {
  /** The display string, e.g. `(312) 555-0144`. Use `toApiPhone` to submit. */
  value: string;
  onChange: (display: string) => void;
  /** Fires once when the value reaches 10 digits. */
  onComplete?: () => void;
  invalid?: boolean;
}

function caretAfterDigits(display: string, digits: number) {
  if (digits <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (/\d/.test(display[i])) seen += 1;
    if (seen === digits) return i + 1;
  }
  return display.length;
}

export function PhoneInput({
  value,
  onChange,
  onComplete,
  invalid,
  ref,
  ...props
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretDigits = useRef<number | null>(null);
  const mergedRef = useMergedRef(inputRef, ref);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (caretDigits.current === null || !el) return;
    const pos = caretAfterDigits(el.value, caretDigits.current);
    caretDigits.current = null;
    if (document.activeElement === el) el.setSelectionRange(pos, pos);
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const el = event.target;
    const next = formatPhoneDisplay(el.value);
    const caret = el.selectionStart ?? el.value.length;
    // Only restore the caret for mid-string edits; at the end it is natural.
    caretDigits.current =
      caret < el.value.length
        ? formatPhoneDisplay(el.value.slice(0, caret)).replace(/\D/g, '').length
        : null;
    onChange(next);
    if (phoneDigitCount(next) === 10 && phoneDigitCount(value) !== 10) {
      onComplete?.();
    }
  }

  return (
    <Input
      inputMode="tel"
      autoComplete="tel-national"
      aria-invalid={invalid ? true : undefined}
      {...props}
      ref={mergedRef}
      type="tel"
      value={value}
      onChange={handleChange}
    />
  );
}
