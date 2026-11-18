import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DialogSheet } from '@/components/ui/dialog-sheet';

function Sheet({ onClose }: { onClose: () => void }) {
  return (
    <DialogSheet labelledBy="t" onClose={onClose} closeOnBackdrop>
      <h2 id="t">Title</h2>
      <p>Inside</p>
    </DialogSheet>
  );
}

describe('DialogSheet', () => {
  it('does not close when a drag starts inside and ends on the backdrop', () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.pointerDown(screen.getByText('Inside'));
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the press starts and ends on the backdrop', async () => {
    const onClose = vi.fn();
    render(<Sheet onClose={onClose} />);
    await userEvent.click(screen.getByRole('dialog').parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the opener when it is still on the page', async () => {
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <h1>Page</h1>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && <Sheet onClose={() => setOpen(false)} />}
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('focuses the page heading when the opener is gone', async () => {
    function Page() {
      const [state, setState] = useState<'idle' | 'open' | 'gone'>('idle');
      return (
        <>
          <h1>Page</h1>
          {state === 'idle' && <button onClick={() => setState('open')}>Open</button>}
          {state === 'open' && <Sheet onClose={() => setState('gone')} />}
        </>
      );
    }
    render(<Page />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Page' })).toHaveFocus();
  });
});
