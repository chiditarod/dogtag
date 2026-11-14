import { useRef, type ComponentPropsWithRef, type FocusEvent } from 'react';
import { Input } from '@/components/ui/field';

export interface EmailInputProps
  extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}

export function EmailInput({
  value,
  onChange,
  invalid,
  onBlur,
  ...props
}: EmailInputProps) {
  const latest = useRef(value);
  latest.current = value;

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    const normalized = event.target.value.trim().toLowerCase();
    if (normalized !== latest.current) onChange(normalized);
    onBlur?.(event);
  }

  return (
    <Input
      inputMode="email"
      autoComplete="email"
      aria-invalid={invalid ? true : undefined}
      {...props}
      type="email"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={handleBlur}
    />
  );
}
