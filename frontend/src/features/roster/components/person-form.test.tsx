import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersonForm } from '@/features/roster/components/person-form';
import { buildRace } from '@/test/fixtures';

function setup(props: Partial<Parameters<typeof PersonForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <PersonForm race={buildRace()} onSubmit={onSubmit} onCancel={onCancel} {...props} />,
  );
  return { user, onSubmit, onCancel };
}

describe('PersonForm', () => {
  it('has fields in order: first, last, email, phone, zip, years, twitter', () => {
    setup();
    const form = document.querySelector('form')!;
    const order = Array.from(form.elements)
      .map((el) => (el as HTMLInputElement).name)
      .filter(Boolean);
    expect(order).toEqual([
      'first_name',
      'last_name',
      'email',
      'phone',
      'zipcode',
      'experience',
      'twitter',
    ]);
    expect(screen.getByPlaceholderText('@handle')).toBeInTheDocument();
  });

  it('offers the race experience labels and explains years racing', async () => {
    const { user } = setup();
    const select = screen.getByLabelText('Years racing');
    expect(select).toHaveDisplayValue('Select one');
    expect(screen.getByRole('option', { name: 'Raced once before' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'About years racing' }));
    expect(
      await screen.findByText("Count CHIditarods you've raced, not counting this one."),
    ).toBeInTheDocument();
  });

  it('submits an API-shaped payload (phone ddd-ddd-dddd, email trimmed and lowercased)', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('First name'), ' Dee ');
    await user.type(screen.getByLabelText('Last name'), 'Lamb');
    await user.type(screen.getByLabelText('Email'), 'Dee@Example.com');
    await user.type(screen.getByLabelText('Phone'), '3125550144');
    await user.type(screen.getByLabelText('ZIP code'), '60601');
    await user.selectOptions(screen.getByLabelText('Years racing'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Dee',
      last_name: 'Lamb',
      email: 'dee@example.com',
      phone: '312-555-0144',
      zipcode: '60601',
      experience: 2,
      twitter: '',
    });
  });

  it('auto-advances after the phone completes but not after the ZIP', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Phone'), '3125550144');
    expect(screen.getByLabelText('ZIP code')).toHaveFocus();
    await user.type(screen.getByLabelText('ZIP code'), '60601');
    expect(screen.getByLabelText('ZIP code')).toHaveFocus();
    await user.type(screen.getByLabelText('ZIP code'), '-1234');
    expect(screen.getByLabelText('ZIP code')).toHaveValue('60601-1234');
  });

  it('requires a years-racing choice before submitting', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose how many years they have raced')).toBeInTheDocument();
    expect(screen.getByLabelText('Years racing')).toHaveFocus();
  });

  it('Cancel closes without saving', async () => {
    const { user, onSubmit, onCancel } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows server field errors under their fields and form-level errors in an alert', () => {
    setup({
      fieldErrors: { phone: ['should be in the form 555-867-5309'] },
      formErrors: ['people already added to this team'],
    });
    expect(screen.getByLabelText('Phone')).toHaveAccessibleDescription(
      'should be in the form 555-867-5309',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('people already added to this team');
  });
});
