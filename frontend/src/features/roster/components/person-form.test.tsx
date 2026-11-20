import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PersonForm } from '@/features/roster/components/person-form';

function setup(props: Partial<Parameters<typeof PersonForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <PersonForm otherEmails={[]} onSubmit={onSubmit} onCancel={onCancel} {...props} />,
  );
  return { user, onSubmit, onCancel };
}

describe('PersonForm', () => {
  it('has fields in order: first, last, email, phone, years, instagram, tiktok', () => {
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
      'experience',
      'instagram',
      'tiktok',
    ]);
    expect(screen.getAllByPlaceholderText('@handle')).toHaveLength(2);
  });

  it('takes years racing as a typed number and explains it', async () => {
    const { user } = setup();
    const years = screen.getByLabelText('Years racing');
    expect(years).toHaveValue('');
    expect(years).toHaveAttribute('inputmode', 'numeric');
    expect(years).not.toHaveAttribute('type', 'number');
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
    await user.type(screen.getByLabelText('Years racing'), '12');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith({
      first_name: 'Dee',
      last_name: 'Lamb',
      email: 'dee@example.com',
      phone: '312-555-0144',
      experience: 12,
      instagram: '',
      tiktok: '',
    });
  });

  it('submits the Instagram and TikTok handles and no twitter key', async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByLabelText('First name'), 'Sam');
    await user.type(screen.getByLabelText('Last name'), 'Okafor');
    await user.type(screen.getByLabelText('Email'), 'sam@example.com');
    await user.type(screen.getByLabelText('Phone'), '3125550144');
    await user.type(screen.getByLabelText('Years racing'), '1');
    await user.type(screen.getByLabelText('Instagram (optional)'), '@sam.okafor');
    await user.type(screen.getByLabelText('TikTok (optional)'), '@sam_o');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.instagram).toBe('@sam.okafor');
    expect(submitted.tiktok).toBe('@sam_o');
    await user.type(screen.getByLabelText('TikTok (optional)'), '@sam_o');
    expect(submitted).not.toHaveProperty('twitter');
  });

  it('auto-advances to years racing after the phone completes', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('Phone'), '3125550144');
    expect(screen.getByLabelText('Years racing')).toHaveFocus();
  });

  it('requires years racing as digits before submitting', async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter how many years they have raced')).toBeInTheDocument();
    expect(screen.getByLabelText('Years racing')).toHaveFocus();

    await user.type(screen.getByLabelText('Years racing'), 'abc');
    expect(screen.queryByText('Enter how many years they have raced')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter how many years they have raced')).toBeInTheDocument();
  });

  it('sends 100 to the server, whose message is shown under the field', () => {
    setup({ fieldErrors: { experience: ['must be less than or equal to 99'] } });
    expect(screen.getByLabelText('Years racing')).toHaveAccessibleDescription(
      expect.stringContaining('must be less than or equal to 99'),
    );
  });

  describe('email check on blur', () => {
    const emailField = () => screen.getByLabelText('Email');

    it('flags a malformed address as soon as the field loses focus', async () => {
      const { user } = setup();
      await user.type(emailField(), 'dee@example');
      expect(screen.queryByText('Enter a valid email address')).toBeNull();
      await user.tab();
      expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
      expect(emailField()).toBeInvalid();
      expect(emailField()).toHaveAccessibleDescription('Enter a valid email address');
    });

    it('flags an address already on the roster, ignoring case and spaces', async () => {
      const { user } = setup({ otherEmails: ['ada@example.com'] });
      await user.type(emailField(), ' Ada@Example.com ');
      await user.tab();
      expect(screen.getByText('Is already on this team')).toBeInTheDocument();
    });

    it('clears on the next change and never blocks typing or saving', async () => {
      const { user } = setup({ otherEmails: ['ada@example.com'] });
      await user.type(emailField(), 'ada@example.com');
      await user.tab();
      expect(screen.getByText('Is already on this team')).toBeInTheDocument();
      await user.type(emailField(), 'x');
      expect(screen.queryByText('Is already on this team')).toBeNull();
    });

    it('says nothing for a blank field or a fresh address', async () => {
      const { user } = setup({ otherEmails: ['ada@example.com'] });
      await user.click(emailField());
      await user.tab();
      expect(emailField()).not.toBeInvalid();
      await user.type(emailField(), 'bo@example.com');
      await user.tab();
      expect(emailField()).not.toBeInvalid();
    });
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
