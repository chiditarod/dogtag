import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FlagProgress } from '@/features/teams/components/flag-progress';

type Steps = [boolean, boolean, boolean, boolean];

const labels: [string, string, string, string] = ['Team', 'Racers', 'Questions', 'Fee'];

function stars() {
  return Array.from(
    screen.getByRole('progressbar').querySelectorAll<SVGSVGElement>('svg'),
  );
}

describe('FlagProgress', () => {
  it('shows the four labels in order as visible text', () => {
    render(<FlagProgress steps={[true, false, false, false]} label="Progress" starLabels={labels} />);
    const bar = screen.getByRole('progressbar');
    expect(Array.from(bar.querySelectorAll('span')).map((s) => s.textContent)).toEqual(labels);
    expect(screen.getByText('Questions')).toBeVisible();
  });

  it('is a progressbar with one star per step, filled in order', () => {
    render(<FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />);
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
    render(<FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />);
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
    expect(screen.getByRole('progressbar')).not.toHaveClass('flag-salute');
  });

  it('lands only the star whose step just became done', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />,
    );
    rerender(<FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />);
    expect(stars().map((s) => s.classList.contains('star-land'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('salutes when the fourth star lands', () => {
    const before: Steps = [true, true, true, false];
    const { rerender } = render(<FlagProgress steps={before} label="Progress" starLabels={labels} />);
    rerender(<FlagProgress steps={[true, true, true, true]} label="Progress" starLabels={labels} />);
    expect(screen.getByRole('progressbar')).toHaveClass('flag-salute');
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
  });

  it('keeps the landing class when re-rendered with unchanged steps', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />,
    );
    rerender(<FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />);
    rerender(<FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />);
    expect(stars().map((s) => s.classList.contains('star-land'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('keeps the salute class when re-rendered with unchanged steps', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />,
    );
    rerender(<FlagProgress steps={[true, true, true, true]} label="Progress" starLabels={labels} />);
    rerender(<FlagProgress steps={[true, true, true, true]} label="Progress" starLabels={labels} />);
    expect(screen.getByRole('progressbar')).toHaveClass('flag-salute');
  });

  it('clears the animation when the steps change again', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />,
    );
    rerender(<FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />);
    rerender(<FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />);
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
  });

  it('behaves the same under StrictMode', () => {
    const { rerender } = render(
      <StrictMode>
        <FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />
      </StrictMode>,
    );
    expect(stars().some((s) => s.classList.contains('star-land'))).toBe(false);
    rerender(
      <StrictMode>
        <FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />
      </StrictMode>,
    );
    rerender(
      <StrictMode>
        <FlagProgress steps={[true, true, true, false]} label="Progress" starLabels={labels} />
      </StrictMode>,
    );
    expect(stars().map((s) => s.classList.contains('star-land'))).toEqual([
      false,
      false,
      true,
      false,
    ]);
  });

  it('summarises done and to-do stars for assistive technology', () => {
    const { rerender } = render(
      <FlagProgress steps={[true, true, false, false]} label="Progress" starLabels={labels} />,
    );
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Team, Racers done; Questions, Fee to do',
    );
    rerender(<FlagProgress steps={[true, true, true, true]} label="Progress" starLabels={labels} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Team, Racers, Questions, Fee done',
    );
    rerender(<FlagProgress steps={[false, false, false, false]} label="Progress" starLabels={labels} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Team, Racers, Questions, Fee to do',
    );
  });

  it('draws the approved star geometry', () => {
    render(<FlagProgress steps={[true, false, false, false]} label="Progress" starLabels={labels} />);
    const points = stars()[0].querySelector('polygon')!.getAttribute('points')!;
    expect(points.split(' ').slice(0, 2)).toEqual(['12.000,2.000', '14.050,8.449']);
    expect(points.split(' ')).toHaveLength(12);
  });
});
