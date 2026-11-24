import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterChips } from './filter-chips';

const text = { label: 'Active filters', removeLabel: (chip: string) => `Remove ${chip}`, clearAllLabel: 'Clear all' };
const chips = [
  { key: 'status', label: 'Paid' },
  { key: 'q', label: 'Search: ada' },
];

describe('FilterChips', () => {
  it('renders nothing without chips', () => {
    const { container } = render(<FilterChips chips={[]} onRemove={vi.fn()} onClearAll={vi.fn()} {...text} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('removes one chip', async () => {
    const onRemove = vi.fn();
    render(<FilterChips chips={chips} onRemove={onRemove} onClearAll={vi.fn()} {...text} />);
    expect(screen.getByRole('list', { name: 'Active filters' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Search: ada' }));
    expect(onRemove).toHaveBeenCalledWith('q');
  });

  it('clears all', async () => {
    const onClearAll = vi.fn();
    render(<FilterChips chips={chips} onRemove={vi.fn()} onClearAll={onClearAll} {...text} />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
