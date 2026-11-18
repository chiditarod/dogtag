import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FundraisingStatus } from '@/features/teams/components/fundraising-status';
import { buildChecklist } from '@/test/fixtures';

describe('FundraisingStatus', () => {
  const pending = buildChecklist({ classy_expected: true, classy_fundraising_url: null });

  it('announces the pending state from the full variant only', () => {
    render(<FundraisingStatus checklist={pending} />);
    expect(screen.getByRole('status')).toHaveTextContent('being set up');
  });

  it('renders the compact variant as plain text, not a live region', () => {
    render(<FundraisingStatus checklist={pending} compact />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText(/being set up/)).toBeInTheDocument();
  });
});
