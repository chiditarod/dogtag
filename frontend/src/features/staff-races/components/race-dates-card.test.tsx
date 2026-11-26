import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DateField } from '../date-checks';
import { RaceDatesCard } from './race-dates-card';

const NOW = new Date('2026-11-25T12:00:00Z');
const VALUES: Record<DateField, string> = {
  registration_open: '2026-12-07T12:00',
  registration_close: '2027-02-15T00:00',
  final_edits_close: '2027-03-15T00:00',
  race_datetime: '2027-03-20T10:00',
};
const ZONES = ['America/Chicago', 'America/New_York'];

type Props = Partial<React.ComponentProps<typeof RaceDatesCard>>;

function Harness({ values: initial = VALUES, timeZone: initialZone = 'America/Chicago', ...props }: Props) {
  const [values, setValues] = useState(initial);
  const [timeZone, setTimeZone] = useState(initialZone);
  return (
    <RaceDatesCard
      timeZone={timeZone}
      initialTimeZone="America/Chicago"
      timeZones={ZONES}
      values={values}
      serverErrors={{}}
      now={NOW}
      onChange={(field, wall) => setValues((current) => ({ ...current, [field]: wall }))}
      onTimeZoneChange={setTimeZone}
      {...props}
    />
  );
}

const field = (name: string) => screen.getByLabelText(name);
const group = (name: string) => field(name).closest('div[class*="space-y"]') as HTMLElement;

describe('RaceDatesCard', () => {
  it('labels each date with the zone abbreviation for that date', () => {
    render(<Harness />);

    expect(within(group('Registration closes')).getByText('CST')).toBeInTheDocument();
    expect(within(group('Final edits close')).getByText('CDT')).toBeInTheDocument();
    expect(field('Registration opens')).toHaveAttribute('type', 'datetime-local');
    expect(field('Registration opens')).toHaveAttribute('step', '60');
    expect(field('Registration opens')).toHaveValue('2026-12-07T12:00');
  });

  it('shows what racers will see, with a midnight close shown as the day before', () => {
    render(<Harness />);

    expect(screen.getByText('Racers see: opens Mon, Dec 7, 2026')).toBeInTheDocument();
    expect(screen.getByText('Racers see: closes Sun, Feb 14, 2027')).toBeInTheDocument();
    expect(screen.getByText('Racers see: final edits until Sun, Mar 14, 2027')).toBeInTheDocument();
    expect(screen.getByText('Racers see: race day Sat, Mar 20, 2027')).toBeInTheDocument();
    expect(screen.getByText('Midnight Feb 15 = racers see "Sun, Feb 14, 2027".')).toBeInTheDocument();
    expect(screen.getByText('Midnight Mar 15 = racers see "Sun, Mar 14, 2027".')).toBeInTheDocument();
  });

  it('has no midnight hint for a time that is not midnight, or for the opening and race day', () => {
    render(<Harness values={{ ...VALUES, registration_close: '2027-02-15T23:59', race_datetime: '2027-03-20T00:00' }} />);

    expect(screen.queryByText(/Midnight Feb 15/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Midnight Mar 20/)).not.toBeInTheDocument();
  });

  it('shows the zone note only after the zone changes, then follows the new zone', async () => {
    render(<Harness />);
    expect(screen.queryByText(/You changed the time zone/)).not.toBeInTheDocument();
    expect(screen.getByText('All dates below are in this zone.')).toBeInTheDocument();

    await userEvent.selectOptions(field('Time zone'), 'America/New_York');

    expect(
      screen.getByText(
        'You changed the time zone from America/Chicago to America/New_York. The times above are now read in the new zone; check them before saving.',
      ),
    ).toBeInTheDocument();
    expect(within(group('Registration closes')).getByText('EST')).toBeInTheDocument();
  });

  it('keeps a saved zone the list does not offer', () => {
    render(<Harness timeZone="Pacific/Chatham" initialTimeZone="Pacific/Chatham" />);

    expect(within(field('Time zone')).getByRole('option', { name: 'Pacific/Chatham' })).toBeInTheDocument();
  });

  it('reports a problem on blur, not before, and clears it once fixed', async () => {
    render(<Harness values={{ ...VALUES, final_edits_close: '2027-04-15T00:00' }} />);
    expect(screen.queryByText(/Must be before Race day/)).not.toBeInTheDocument();

    await userEvent.click(field('Final edits close'));
    await userEvent.tab();

    expect(screen.getByText('Must be before Race day (Sat, Mar 20, 10:00 AM)')).toBeInTheDocument();
    expect(field('Final edits close')).toBeInvalid();
    expect(screen.queryByText(/Racers see: final edits/)).not.toBeInTheDocument();

    await userEvent.clear(field('Final edits close'));
    await userEvent.type(field('Final edits close'), '2027-03-15T00:00');
    expect(screen.queryByText(/Must be before Race day/)).not.toBeInTheDocument();
  });

  it('shows a warning for a past opening and the clock-change gap', async () => {
    render(<Harness values={{ ...VALUES, registration_open: '2026-11-20T12:00', race_datetime: '2027-03-14T02:30' }} />);

    await userEvent.click(field('Registration opens'));
    await userEvent.click(field('Race day'));
    await userEvent.tab();

    expect(screen.getByText('This is in the past: registration opens as soon as you save.')).toBeInTheDocument();
    expect(field('Registration opens')).not.toBeInvalid();
    expect(screen.getByText("2:30 AM doesn't exist on Mar 14 in America/Chicago: clocks jump forward.")).toBeInTheDocument();
  });

  it('shows every problem at once when showAllErrors is set, and server errors always', () => {
    render(
      <Harness
        values={{ ...VALUES, registration_open: '', race_datetime: '' }}
        showAllErrors
        serverErrors={{ final_edits_close: ['must be before Race day'], time_zone: ['is not a time zone'] }}
      />,
    );

    expect(screen.getAllByText('Enter a date and time')).toHaveLength(2);
    expect(screen.getByText('must be before Race day')).toBeInTheDocument();
    expect(screen.getByText('is not a time zone')).toBeInTheDocument();
    expect(field('Time zone')).toBeInvalid();
  });

  it('reports edits through onChange and does not throw with a blank zone', () => {
    const onChange = vi.fn();
    render(<Harness timeZone="" initialTimeZone="" onChange={onChange} />);

    fireEvent.change(field('Race day'), { target: { value: '2027-03-20T11:00' } });

    expect(onChange).toHaveBeenLastCalledWith('race_datetime', '2027-03-20T11:00');
  });
});
