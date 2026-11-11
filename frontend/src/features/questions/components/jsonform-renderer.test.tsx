import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '@/features/questions/__fixtures__/chiditarod_21.json';
import { JsonformRenderer } from '@/features/questions/components/jsonform-renderer';
import type { Jsonform } from '@/features/questions/types';

const jsonform = fixture as unknown as Jsonform;

function Harness({
  form = jsonform,
  initial = {},
  errors = {},
  onValue,
}: {
  form?: Jsonform;
  initial?: Record<string, string>;
  errors?: Record<string, string[]>;
  onValue?: (value: Record<string, string>) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <JsonformRenderer
      jsonform={form}
      value={value}
      errors={errors}
      onChange={(key, next) => {
        const merged = { ...value, [key]: next };
        setValue(merged);
        onValue?.(merged);
      }}
    />
  );
}

afterEach(() => vi.restoreAllMocks());

describe('JsonformRenderer with the chiditarod_21 form', () => {
  it('renders the four fieldset titles as groups', () => {
    render(<Harness />);
    for (const title of [
      "Let's get to know each other",
      'Ok, down to business',
      'FunDraising!',
      'Post-race shenannigans',
    ]) {
      expect(screen.getByRole('group', { name: title })).toBeInTheDocument();
    }
  });

  it('renders racer-type as radios', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const group = screen.getByRole('radiogroup', { name: /What type of team are you/ });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['Racer', 'Art Cart']);
    await userEvent.click(within(group).getByRole('radio', { name: 'Art Cart' }));
    expect(onValue).toHaveBeenLastCalledWith({ 'racer-type': 'Art Cart' });
    expect(within(group).getByRole('radio', { name: 'Art Cart' })).toBeChecked();
  });

  it('renders explain-theme and private-comments as textareas and others as inputs', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox', { name: /Your theme, what's it all about/ }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('textbox', { name: /Any private comments/ }).tagName).toBe('TEXTAREA');
    expect(screen.getByRole('textbox', { name: /Got Instagram ?\?/ }).tagName).toBe('INPUT');
  });

  it('renders larger enums as a select with a blank Choose one option', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const select = screen.getByRole('combobox', { name: /primary inspiration/ });
    expect(within(select).getAllByRole('option')[0]).toHaveTextContent('Choose one');
    expect(within(select).getAllByRole('option')).toHaveLength(22);
    await userEvent.selectOptions(select, 'Winning');
    expect(onValue).toHaveBeenLastCalledWith({ 'primary-inspiration': 'Winning' });
  });

  it('renders agree fields as checkboxes mapping to Yes and No', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const box = screen.getByRole('checkbox', { name: /Did you read and will you follow the race rules/ });
    expect(box).not.toBeChecked();
    await userEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith({ 'agree-to-rules': 'Yes' });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(onValue).toHaveBeenLastCalledWith({ 'agree-to-rules': 'No' });
  });

  it('shows the error for a field with aria wiring', () => {
    render(<Harness errors={{ 'agree-to-rules': ['You must agree to continue'] }} />);
    const box = screen.getByRole('checkbox', { name: /race rules/ });
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box).toHaveAccessibleDescription(/You must agree to continue/);
  });

  it('sanitizes HTML in titles, descriptions and help text', () => {
    render(<Harness />);
    const link = screen.getByRole('link', { name: 'Instagram' });
    expect(link).toHaveAttribute('href', 'https://www.instagram.com/chiditarod/');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Microgrant Program' })).toBeInTheDocument();
    expect(screen.getByText(/The primary mission of the CHIditarod/)).toBeInTheDocument();
  });

  it('renders an optional marker only on optional fields', () => {
    render(<Harness />);
    expect(screen.getByRole('textbox', { name: /Got Instagram ?\?/ }).closest('[data-field-key]')).toHaveTextContent(
      'Optional',
    );
    expect(screen.getByRole('textbox', { name: /Your theme/ }).closest('[data-field-key]')).not.toHaveTextContent(
      'Optional',
    );
  });

  it('marks invalid fields for focus handling', () => {
    const { container } = render(<Harness errors={{ instagram: ['Bad'] }} />);
    expect(container.querySelectorAll('[data-invalid="true"]')).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: /Got Instagram/ })).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('JsonformRenderer subset behaviour', () => {
  const form: Jsonform = {
    schema: {
      type: 'object',
      properties: {
        a: { type: 'string', title: 'Pick A', enum: ['x', 'y', 'z', 'w'], default: 'y' },
        b: { type: 'string', title: 'Pick B', enum: ['p', 'q', 'r', 's'] },
        c: { type: 'string', title: 'Radios forced', enum: ['one', 'two', 'three', 'four'] },
        d: { type: 'string', title: 'Select forced', enum: ['one', 'two'] },
        e: { type: 'string', title: 'Mapped', enum: ['m1', 'm2'] },
      },
    },
    form: [
      'a',
      'b',
      { key: 'c', type: 'radios' },
      { key: 'd', type: 'select', title: 'Overridden title', description: 'Hint here' },
      { key: 'e', titleMap: { m1: 'Mapped one', m2: 'Mapped two' } },
      { type: 'submit', title: 'Save' },
    ],
  };

  it('omits the blank option when a non-empty default exists and selects it', () => {
    render(<Harness form={form} initial={{ a: 'y' }} />);
    const a = screen.getByRole('combobox', { name: 'Pick A' });
    expect(within(a).queryByRole('option', { name: 'Choose one' })).not.toBeInTheDocument();
    expect(a).toHaveValue('y');
    const b = screen.getByRole('combobox', { name: 'Pick B' });
    expect(within(b).getByRole('option', { name: 'Choose one' })).toBeInTheDocument();
  });

  it('honours form-item type overrides, titles, descriptions and titleMap', () => {
    render(<Harness form={form} />);
    expect(screen.getByRole('radiogroup', { name: 'Radios forced' })).toBeInTheDocument();
    const d = screen.getByRole('combobox', { name: 'Overridden title' });
    expect(d).toHaveAccessibleDescription('Hint here');
    expect(screen.getByRole('radio', { name: 'Mapped two' })).toHaveAttribute('value', 'm2');
  });

  it('ignores submit items and warns once about unknown item types', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const withUnknown = {
      ...form,
      form: [...form.form!, { type: 'mystery-widget' }, { type: 'mystery-widget' }] as never,
    };
    const { unmount } = render(<Harness form={withUnknown} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalledTimes(1);
    unmount();
    render(<Harness form={withUnknown} />);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/mystery-widget/);
  });

  it('falls back to all schema properties when the form is missing', () => {
    render(<Harness form={{ schema: form.schema, form: undefined } as never} />);
    expect(screen.getByRole('combobox', { name: 'Pick A' })).toBeInTheDocument();
  });
});
