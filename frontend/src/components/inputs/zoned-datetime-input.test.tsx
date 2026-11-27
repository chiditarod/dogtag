import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ZonedDateTimeInput } from '@/components/inputs/zoned-datetime-input';

const ZONE = 'America/Chicago';

describe('ZonedDateTimeInput', () => {
  it('shows the zone abbreviation for the date shown', () => {
    const { rerender } = render(
      <ZonedDateTimeInput aria-label="Opens" value="2027-03-15T00:00" timeZone={ZONE} onValueChange={() => {}} />,
    );
    expect(screen.getByLabelText('Opens')).toHaveAttribute('type', 'datetime-local');
    expect(screen.getByText('CDT')).toBeInTheDocument();

    rerender(<ZonedDateTimeInput aria-label="Opens" value="2027-02-15T00:00" timeZone={ZONE} onValueChange={() => {}} />);
    expect(screen.getByText('CST')).toBeInTheDocument();
  });

  it('reports the typed value and passes control props through', async () => {
    const onValueChange = vi.fn();
    const onBlur = vi.fn();
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <ZonedDateTimeInput
          aria-label="Opens"
          value={value}
          timeZone={ZONE}
          onBlur={onBlur}
          onValueChange={(wall) => {
            onValueChange(wall);
            setValue(wall);
          }}
        />
      );
    }
    render(<Harness />);

    const input = screen.getByLabelText('Opens');
    await userEvent.type(input, '2027-03-15T09:30');
    expect(onValueChange).toHaveBeenLastCalledWith('2027-03-15T09:30');
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalled();
  });
});
