import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ListCell, ListRow, ListTable } from './list-table';

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
];

describe('ListTable', () => {
  it('renders role=table with column headers', () => {
    render(
      <ListTable label="People" columns={columns}>
        <ListRow>
          <ListCell>Ada</ListCell>
          <ListCell label="Email">ada@example.com</ListCell>
        </ListRow>
      </ListTable>,
    );
    expect(screen.getByRole('table', { name: 'People' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Name', 'Email']);
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('cell')).toHaveLength(2);
  });

  it('cell labels are present for cards but hidden from sm', () => {
    render(
      <ListTable label="People" columns={columns}>
        <ListRow>
          <ListCell label="Email">ada@example.com</ListCell>
        </ListRow>
      </ListTable>,
    );
    const caption = screen.getByText('Email', { selector: 'span' });
    expect(caption.className).toContain('sm:hidden');
    expect(caption).not.toHaveAttribute('aria-hidden');
  });
});
