import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { InfoTip } from '@/components/ui/info-tip';

describe('InfoTip', () => {
  it('opens on Enter and shows its content', async () => {
    render(<InfoTip label="About the fee">Covers permits.</InfoTip>);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'About the fee' })).toHaveFocus();
    expect(screen.queryByText('Covers permits.')).not.toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByText('Covers permits.')).toBeInTheDocument();
  });

  it('opens on Space, and closes on Escape', async () => {
    render(<InfoTip label="About the fee">Covers permits.</InfoTip>);
    await userEvent.tab();
    await userEvent.keyboard(' ');
    expect(await screen.findByText('Covers permits.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByText('Covers permits.')).not.toBeInTheDocument();
  });

  it('opens on click and closes on outside click', async () => {
    render(
      <div>
        <InfoTip label="About the fee">Covers permits.</InfoTip>
        <p>Elsewhere</p>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'About the fee' }));
    expect(await screen.findByText('Covers permits.')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Elsewhere'));
    expect(screen.queryByText('Covers permits.')).not.toBeInTheDocument();
  });
});
