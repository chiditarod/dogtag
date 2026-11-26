import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ResultCount } from './result-count';

describe('ResultCount', () => {
  it('is an empty live status until there is a message', () => {
    const { rerender } = render(<ResultCount />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    rerender(<ResultCount message="3 payments" />);
    expect(screen.getByRole('status')).toHaveTextContent('3 payments');
    expect(screen.getByRole('status').className).toContain('sr-only');
  });
});
