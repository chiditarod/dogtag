import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_DEBOUNCE_MS, SearchBox } from './search-box';

describe('SearchBox', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sends trimmed text once after 300 ms', () => {
    const onSearch = vi.fn();
    render(<SearchBox value="" onSearch={onSearch} label="Search" />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '  ada ' } });
    act(() => void vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(onSearch).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith('ada');
    // The box keeps what was typed.
    expect(screen.getByLabelText('Search')).toHaveValue('  ada ');
  });

  it('does not restart the debounce when onSearch changes identity', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<SearchBox value="" onSearch={first} label="Search" />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'ada' } });
    act(() => void vi.advanceTimersByTime(200));
    rerender(<SearchBox value="" onSearch={second} label="Search" />);
    act(() => void vi.advanceTimersByTime(100));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('ada');
  });

  it('shows the new value when it changes from outside', () => {
    const { rerender } = render(<SearchBox value="ada" onSearch={vi.fn()} label="Search" />);
    expect(screen.getByLabelText('Search')).toHaveValue('ada');
    rerender(<SearchBox value="" onSearch={vi.fn()} label="Search" />);
    expect(screen.getByLabelText('Search')).toHaveValue('');
  });
});
