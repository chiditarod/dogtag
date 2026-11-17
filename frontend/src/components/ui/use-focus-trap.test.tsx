import { fireEvent, render, screen } from '@testing-library/react';
import { useRef, type KeyboardEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFocusTrap } from '@/components/ui/use-focus-trap';

function Trap({
  onEscape,
  onInnerKeyDown,
}: {
  onEscape: () => void;
  onInnerKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, onEscape);
  return (
    <div ref={ref}>
      <input aria-label="Search" onKeyDown={onInnerKeyDown} />
      <button type="button">Last</button>
    </div>
  );
}

describe('useFocusTrap', () => {
  it('calls onEscape on Escape', () => {
    const onEscape = vi.fn();
    render(<Trap onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('leaves an Escape alone when a control inside already handled it', () => {
    const onEscape = vi.fn();
    render(
      <Trap
        onEscape={onEscape}
        onInnerKeyDown={(event) => {
          if (event.key === 'Escape') event.preventDefault();
        }}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('leaves an Escape alone while an IME composition is open', () => {
    const onEscape = vi.fn();
    render(<Trap onEscape={onEscape} />);
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Search' }), {
      key: 'Escape',
      isComposing: true,
    });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('stops listening once unmounted', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Trap onEscape={onEscape} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });
});
