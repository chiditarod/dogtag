import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProgressSegments } from '@/components/ui/progress-segments';

describe('ui primitives', () => {
  it('renders a button', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('disables a button while loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('renders a card with children', () => {
    render(<Card>Hello card</Card>);
    expect(screen.getByText('Hello card')).toBeInTheDocument();
  });

  it('renders a badge', () => {
    render(<Badge tone="success">Done</Badge>);
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders progress segments with accessible value', () => {
    render(<ProgressSegments total={5} filled={3} label="Roster" />);
    const bar = screen.getByRole('progressbar', { name: 'Roster' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar.children).toHaveLength(5);
  });
});
