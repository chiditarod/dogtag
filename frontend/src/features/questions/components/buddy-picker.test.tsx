import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BuddyPicker } from '@/features/questions/components/buddy-picker';
import type { BuddyOption, BuddySelection } from '@/features/questions/types';

const options: BuddyOption[] = [
  { id: 3, name: 'Apple Cart', finalized: false },
  { id: 1, name: 'Apple Racers', finalized: true },
  { id: 2, name: 'Zebra Crossing', finalized: true },
];

const empty: BuddySelection = { teamIds: [], otherSelected: false, otherText: '' };

let latest: BuddySelection;

function Harness({ teams = options, initial = empty }: { teams?: BuddyOption[]; initial?: BuddySelection }) {
  const [value, setValue] = useState(initial);
  latest = value;
  return (
    <BuddyPicker
      options={teams}
      value={value}
      onChange={(next) => {
        latest = next;
        setValue(next);
      }}
    />
  );
}

describe('BuddyPicker', () => {
  it('lists teams in the order given with a status tag each and Other… last', () => {
    render(<Harness />);
    const group = screen.getByRole('group', { name: 'Teams you want to race with' });
    const boxes = within(group).getAllByRole('checkbox');
    expect(boxes.map((box) => box.getAttribute('aria-label') ?? '')).toEqual([
      'Apple Cart, Still registering',
      'Apple Racers, Fully registered',
      'Zebra Crossing, Fully registered',
      '',
    ]);
    expect(within(group).getAllByText('Fully registered')).toHaveLength(2);
    expect(within(group).getAllByText('Still registering')).toHaveLength(1);
    expect(boxes[3]).toHaveAccessibleName('Other…');
  });

  it('names each checkbox with team name and status', () => {
    render(<Harness />);
    expect(screen.getByRole('checkbox', { name: 'Apple Racers, Fully registered' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Apple Cart, Still registering' })).toBeInTheDocument();
  });

  it('filters by the search box without losing selections', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: /Zebra Crossing/ }));
    await user.type(screen.getByRole('searchbox', { name: 'Search teams' }), 'APPLE');
    expect(screen.queryByRole('checkbox', { name: /Zebra Crossing/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: /Apple/ })).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: /Apple Racers/ }));
    expect(latest.teamIds).toEqual([2, 1]);
    await user.clear(screen.getByRole('searchbox', { name: 'Search teams' }));
    expect(screen.getByRole('checkbox', { name: /Zebra Crossing/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Apple Racers/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Apple Cart/ })).not.toBeChecked();
  });

  it('selecting Other… reveals the free-text field and deselecting hides it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.queryByRole('textbox', { name: 'Which other teams or people?' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Other…' }));
    const text = screen.getByRole('textbox', { name: 'Which other teams or people?' });
    expect(text).toHaveAttribute('maxlength', '1000');
    await user.type(text, 'The Dee Team');
    expect(latest).toEqual({ teamIds: [], otherSelected: true, otherText: 'The Dee Team' });
    await user.click(screen.getByRole('checkbox', { name: 'Other…' }));
    expect(screen.queryByRole('textbox', { name: 'Which other teams or people?' })).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no teams but still offers Other…', () => {
    render(<Harness teams={[]} />);
    expect(
      screen.getByText("No other teams yet. Use Other… to name teams that haven't signed up."),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Other…' })).toBeInTheDocument();
  });
});
