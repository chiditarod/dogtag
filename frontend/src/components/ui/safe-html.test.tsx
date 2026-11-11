import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SafeHtml } from '@/components/ui/safe-html';

describe('SafeHtml', () => {
  it('styles anchors as visible links, even inside bold text', () => {
    render(
      <strong>
        <SafeHtml html={'Read the <a href="https://example.com/x">Core Philosophy</a>'} />
      </strong>,
    );
    const link = screen.getByRole('link', { name: 'Core Philosophy' });
    expect(link).toHaveAttribute('target', '_blank');
    const wrapper = link.parentElement!;
    expect(wrapper).toHaveClass('safe-html');
    expect(wrapper.className).toContain('[&_a]:text-link');
    expect(wrapper.className).toContain('[&_a]:underline');
    expect(wrapper.className).toContain('[&_a:focus-visible]:outline');
  });

  it('keeps link clicks from reaching ancestor handlers or toggling a label checkbox', async () => {
    const onAncestorClick = vi.fn();
    render(
      <div onClick={onAncestorClick}>
        <label>
          <input type="checkbox" />
          <SafeHtml html={'Follow the <a href="https://example.com/x">Core Philosophy</a>?'} />
        </label>
      </div>,
    );
    const box = screen.getByRole('checkbox');
    const link = screen.getByRole('link', { name: 'Core Philosophy' });
    link.addEventListener('click', (e) => e.preventDefault()); // no navigation in jsdom
    await userEvent.click(link);
    expect(onAncestorClick).not.toHaveBeenCalled();
    // Browsers already skip label activation for links; this locks that in.
    expect(box).not.toBeChecked();
  });
});
