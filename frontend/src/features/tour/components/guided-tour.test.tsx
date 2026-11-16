import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GuidedTour } from '@/features/tour/components/guided-tour';
import { teamTourStops, type TourStop } from '@/features/tour/stops';
import { buildChecklist, buildTeam } from '@/test/fixtures';

const stops = (): TourStop[] =>
  teamTourStops(
    buildTeam({ checklist: buildChecklist({ questions: { required: true, done: false } }) }),
  );

let rects: Record<string, DOMRect>;

function Page({
  targets,
  tourStops,
  onEnd,
}: {
  targets: string[];
  tourStops: TourStop[];
  onEnd: () => void;
}) {
  return (
    <>
      {targets.map((id) => (
        <div key={id} data-tour={id}>
          {id}
        </div>
      ))}
      <GuidedTour stops={tourStops} onEnd={onEnd} />
    </>
  );
}

function renderTour(targets = ['flag', 'racers', 'fee']) {
  const onEnd = vi.fn();
  const user = userEvent.setup();
  const view = render(<Page targets={targets} tourStops={stops()} onEnd={onEnd} />);
  return { onEnd, user, view };
}

const ring = () => screen.getByTestId('tour-ring');

describe('GuidedTour', () => {
  beforeEach(() => {
    rects = {
      flag: new DOMRect(100, 50, 200, 40),
      racers: new DOMRect(100, 300, 400, 30),
      fee: new DOMRect(100, 600, 400, 30),
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        return rects[this.dataset.tour ?? ''] ?? new DOMRect();
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens on the first stop that is on the page and skips the missing ones', () => {
    renderTour();
    const dialog = screen.getByRole('dialog', { name: 'Four stars, four steps' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveTextContent('1 of 3');
    expect(screen.getByRole('heading', { name: 'Four stars, four steps' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument();
  });

  it('steps forward with Next and back with Prev', async () => {
    const { user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toHaveTextContent('2 of 3');
    expect(screen.getByRole('heading', { name: 'Add your racers' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Prev' }));
    expect(screen.getByRole('dialog', { name: 'Four stars, four steps' })).toHaveTextContent(
      '1 of 3',
    );
  });

  it('reads Done on the last stop and ends the tour with it', async () => {
    const { onEnd, user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Pay the registration fee' })).toHaveTextContent(
      '3 of 3',
    );
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ends from any stop with End tour, and with Escape', async () => {
    const { onEnd, user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'End tour' }));
    expect(onEnd).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('button', { name: 'End tour' }));
    expect(onEnd).toHaveBeenCalledTimes(2);
    await user.keyboard('{Escape}');
    expect(onEnd).toHaveBeenCalledTimes(3);
  });

  it('keeps Tab inside the popup', async () => {
    const { user } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    screen.getByRole('button', { name: 'Next' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'End tour' })).toHaveFocus();

    screen.getByRole('heading', { name: 'Add your racers' }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  });

  it('renders nothing and does not end when no target is on the page', async () => {
    const { onEnd, user } = renderTour([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('moves the highlight when the window is resized', () => {
    renderTour();
    expect(ring().style.top).toBe('44px');
    expect(ring().style.left).toBe('94px');
    rects.flag = new DOMRect(300, 400, 200, 40);
    act(() => {
      fireEvent(window, new Event('resize'));
    });
    expect(ring().style.top).toBe('394px');
    expect(ring().style.left).toBe('294px');
  });

  it('places the popup next to the target from lg and pins it to the bottom below', () => {
    const { view } = renderTour();
    expect(screen.getByRole('dialog').style.top).not.toBe('');
    view.unmount();

    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query }));
    renderTour();
    expect(screen.getByRole('dialog').style.top).toBe('');
  });

  it('stays on its stop when the parent re-renders with equal stops', async () => {
    const { onEnd, user, view } = renderTour();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    view.rerender(<Page targets={['flag', 'racers', 'fee']} tourStops={stops()} onEnd={onEnd} />);
    expect(screen.getByRole('dialog', { name: 'Add your racers' })).toBeInTheDocument();
  });

  it('returns focus to where it was when it closes', () => {
    const onEnd = vi.fn();
    const { rerender } = render(<button type="button">Opener</button>);
    screen.getByRole('button', { name: 'Opener' }).focus();
    rerender(
      <>
        <button type="button">Opener</button>
        <div data-tour="flag" />
        <GuidedTour stops={stops()} onEnd={onEnd} />
      </>,
    );
    expect(screen.getByRole('heading', { name: 'Four stars, four steps' })).toHaveFocus();
    rerender(
      <>
        <button type="button">Opener</button>
        <div data-tour="flag" />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Opener' })).toHaveFocus();
  });
});
