import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './pagination';

const labels = {
  nav: 'Pages',
  prev: 'Back',
  next: 'Forward',
  page: (page: number, total: number) => `Leaf ${page} / ${total}`,
};

describe('Pagination', () => {
  it('renders nothing for one page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPage={vi.fn()} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses the labels it is given', async () => {
    const onPage = vi.fn();
    render(<Pagination page={2} totalPages={3} onPage={onPage} labels={labels} />);
    expect(screen.getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByText('Leaf 2 / 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Forward/ }));
    expect(onPage).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onPage).toHaveBeenCalledWith(1);
  });

  it('disables Prev on page 1 and Next on the last page', () => {
    const { rerender } = render(<Pagination page={1} totalPages={3} onPage={vi.fn()} labels={labels} />);
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Forward/ })).toBeEnabled();
    rerender(<Pagination page={3} totalPages={3} onPage={vi.fn()} labels={labels} />);
    expect(screen.getByRole('button', { name: /Forward/ })).toBeDisabled();
  });
});
