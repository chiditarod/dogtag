import { useRef, useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmailInput } from '@/components/inputs/email-input';
import { PhoneInput } from '@/components/inputs/phone-input';
import { useAutoAdvance } from '@/components/inputs/use-auto-advance';
import { ZipInput } from '@/components/inputs/zip-input';
import { Field } from '@/components/ui/field';

function PhoneThenNext({ onComplete }: { onComplete?: () => void }) {
  const [phone, setPhone] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const advance = useAutoAdvance();
  return (
    <form>
      <label>
        Phone
        <PhoneInput
          ref={ref}
          name="phone"
          value={phone}
          onChange={setPhone}
          onComplete={() => {
            onComplete?.();
            advance(ref.current);
          }}
        />
      </label>
      <label>
        Next
        <input name="next" />
      </label>
    </form>
  );
}

function ControlledPhone({ onComplete }: { onComplete: () => void }) {
  const [phone, setPhone] = useState('');
  return (
    <PhoneInput
      name="phone"
      aria-label="Phone"
      value={phone}
      onChange={setPhone}
      onComplete={onComplete}
    />
  );
}

describe('PhoneInput', () => {
  it('formats as digits are typed and advances focus at ten digits', async () => {
    const onComplete = vi.fn();
    render(<PhoneThenNext onComplete={onComplete} />);
    const phone = screen.getByLabelText('Phone');
    await userEvent.type(phone, '3125550144');
    expect(phone).toHaveValue('(312) 555-0144');
    expect(phone).toHaveAttribute('inputmode', 'tel');
    expect(phone).toHaveAttribute('autocomplete', 'tel-national');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Next')).toHaveFocus();
  });

  it('fires onComplete again only after dropping below ten digits', async () => {
    const onComplete = vi.fn();
    render(<ControlledPhone onComplete={onComplete} />);
    const phone = screen.getByLabelText('Phone');
    await userEvent.type(phone, '3125550144');
    await userEvent.type(phone, '9');
    expect(onComplete).toHaveBeenCalledTimes(1);
    await userEvent.type(phone, '{Backspace}');
    expect(phone).toHaveValue('(312) 555-014');
    await userEvent.type(phone, '4');
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('formats a pasted +1 number', async () => {
    render(<ControlledPhone onComplete={() => {}} />);
    const phone = screen.getByLabelText('Phone');
    await userEvent.click(phone);
    await userEvent.paste('+1 (312) 555-0144');
    expect(phone).toHaveValue('(312) 555-0144');
  });

  it('does not lose digits when editing in the middle', async () => {
    render(<ControlledPhone onComplete={() => {}} />);
    const phone = screen.getByLabelText<HTMLInputElement>('Phone');
    await userEvent.type(phone, '312555');
    phone.setSelectionRange(4, 4);
    await userEvent.keyboard('9');
    expect(phone).toHaveValue('(312) 955-5');
    expect(phone.selectionStart).toBe(7);
  });

  it('forwards the aria props injected by Field', () => {
    render(
      <Field label="Phone" name="phone" error={['is invalid']}>
        <PhoneInput value="" onChange={() => {}} />
      </Field>,
    );
    const input = screen.getByLabelText('Phone');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby')!;
    expect(document.getElementById(describedBy)).toHaveTextContent('is invalid');
    expect(input).toHaveAttribute('name', 'phone');
  });
});

describe('EmailInput', () => {
  function ControlledEmail() {
    const [email, setEmail] = useState('');
    return <EmailInput aria-label="Email" name="email" value={email} onChange={setEmail} />;
  }

  it('lowercases on blur', async () => {
    render(<ControlledEmail />);
    const email = screen.getByLabelText('Email');
    await userEvent.type(email, 'Ada@Example.COM');
    expect(email).toHaveValue('Ada@Example.COM');
    await userEvent.tab();
    expect(email).toHaveValue('ada@example.com');
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
  });

  it('forwards Field aria props', () => {
    render(
      <Field label="Email" name="email" error={['is taken']}>
        <EmailInput value="" onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('ZipInput', () => {
  function ControlledZip({ onComplete }: { onComplete: () => void }) {
    const [zip, setZip] = useState('');
    return <ZipInput aria-label="Zip" name="zip" value={zip} onChange={setZip} onComplete={onComplete} />;
  }

  it('accepts digits and one hyphen, up to ddddd-dddd', async () => {
    const onComplete = vi.fn();
    render(<ControlledZip onComplete={onComplete} />);
    const zip = screen.getByLabelText('Zip');
    await userEvent.type(zip, '6a0601');
    expect(zip).toHaveValue('60601');
    expect(onComplete).toHaveBeenCalledTimes(1);
    await userEvent.type(zip, '-00019');
    expect(zip).toHaveValue('60601-0001');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(zip).toHaveAttribute('inputmode', 'numeric');
    expect(zip).toHaveAttribute('autocomplete', 'postal-code');
  });
});
