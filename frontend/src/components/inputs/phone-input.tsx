import { useRef, type ChangeEvent, type ComponentPropsWithRef } from 'react';
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
  if (digits <= 0) return Math.min(1, display.length);
  let seen = 0;
  for (let i = 0; i < display.length; i += 1) {
    if (/\d/.test(display[i])) seen += 1;
    if (seen === digits) return i + 1;
  }
  return display.length;
}

const digitsOf = (s: string) => s.replace(/\D/g, '');

export function PhoneInput({
  value,
  onChange,
  onComplete,
  invalid,
  ref,
  ...props
}: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mergedRef = useMergedRef(inputRef, ref);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const el = event.target;
    const raw = el.value;
    const caret = el.selectionStart ?? raw.length;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    let digits = digitsOf(raw);
    let caretDigits = digitsOf(raw.slice(0, caret)).length;

    // Deleting only a separator would otherwise be a no-op that traps the
    // caret; delete the adjacent digit instead.
    const backward = inputType === 'deleteContentBackward';
    if (
      (backward || inputType === 'deleteContentForward') &&
      digits === digitsOf(value)
    ) {
      const index = backward ? caretDigits - 1 : caretDigits;
      if (index >= 0 && index < digits.length) {
        digits = digits.slice(0, index) + digits.slice(index + 1);
        caretDigits = index;
      }
    }

    const next = formatPhoneDisplay(digits);
    const atEnd = caret >= raw.length && next === formatPhoneDisplay(raw);
    onChange(next);
    if (phoneDigitCount(next) === 10 && phoneDigitCount(value) !== 10) {
      onComplete?.();
    }
    if (atEnd) return;
    // After React has applied (or restored) the controlled value, put the
    // caret back where the user was, counted in digits.
    queueMicrotask(() => {
      if (document.activeElement !== el) return;
      const pos = caretAfterDigits(el.value, caretDigits);
      el.setSelectionRange(pos, pos);
    });
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
