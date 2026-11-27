import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ButtonLink } from './button-link';

describe('ButtonLink', () => {
  it('renders a router link for `to` and a plain anchor for `href`, both with the focus ring', () => {
    render(
      <MemoryRouter basename="/register" initialEntries={["/register"]}>
        <ButtonLink to="/staff/races/new">Inside</ButtonLink>
        <ButtonLink href="/races/1/registrations" variant="secondary">
          Legacy
        </ButtonLink>
      </MemoryRouter>,
    );
    const inside = screen.getByRole('link', { name: 'Inside' });
    const legacy = screen.getByRole('link', { name: 'Legacy' });
    expect(inside).toHaveAttribute('href', '/register/staff/races/new');
    expect(legacy).toHaveAttribute('href', '/races/1/registrations');
    for (const link of [inside, legacy]) {
      expect(link.className).toContain('focus-visible:ring-2');
      expect(link.className).toContain('focus-visible:ring-link');
    }
  });
});
