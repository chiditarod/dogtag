import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Field, Input } from '@/components/ui/field';

describe('Field', () => {
  it('describes the control with the help text, then the error', () => {
    render(
      <Field label="Description" name="description" help="Tell us your theme" error={['Description is required']}>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Description');
    expect(input).toHaveAccessibleDescription('Tell us your theme Description is required');
    expect(input).toBeInvalid();
  });

  it('has no description when there is no help and no error', () => {
    render(
      <Field label="Name" name="name">
        <Input />
      </Field>,
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby');
  });
});
