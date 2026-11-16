import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlagProgress } from '@/features/teams/components/flag-progress';

type Steps = [boolean, boolean, boolean, boolean];

function stars() {
  return Array.from(
    screen.getByRole('progressbar').querySelectorAll<SVGSVGElement>('svg'),
  );
}

describe('FlagProgress', () => {
  it('is a progressbar with one star per step, filled in order', () => {
    render(<FlagProgress steps={[true, true, false, false]} label="Progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Progress' });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '4');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(stars().map((s) => s.getAttribute('data-filled'))).toEqual([
      'true',
      'true',
      'false',
      'false',
    ]);
  });

  it('animates no star on first render', () => {
    render(<FlagProgress steps={[true, true, true, false]} label="Progress" />);
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
    expect(screen.getByRole('progressbar')).not.toHaveClass('flag-salute');
  });

  it('lands only the star whose step just became done', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, false, false]} label="Progress" />,
    );
    rerender(<FlagProgress steps={[true, true, true, false]} label="Progress" />);
    expect(stars().map((s) => s.classList.contains('star-land'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('salutes when the fourth star lands', () => {
    const before: Steps = [true, true, true, false];
    const { rerender } = render(<FlagProgress steps={before} label="Progress" />);
    rerender(<FlagProgress steps={[true, true, true, true]} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveClass('flag-salute');
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
  });
});
