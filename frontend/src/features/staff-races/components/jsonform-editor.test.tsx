import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { JsonformEditor } from './jsonform-editor';

const jsonform = (properties: Record<string, object>) =>
  JSON.stringify({ schema: { type: 'object', properties }, form: Object.keys(properties) }, null, 2);

const TWO = jsonform({
  'racer-type': { type: 'string', title: 'What type of team are you?', enum: ['Racer', 'Art Cart'] },
  notes: { type: 'string' },
});

function Harness({
  initial = TWO,
  filter = [],
  error,
  onFilter = () => {},
}: {
  initial?: string;
  filter?: string[];
  error?: string[];
  onFilter?: (value: string[]) => void;
}) {
  const [value, setValue] = useState(initial);
  const [filterField, setFilterField] = useState(filter);
  return (
    <JsonformEditor
      value={value}
      onChange={setValue}
      filterField={filterField}
      onFilterFieldChange={(next) => {
        setFilterField(next);
        onFilter(next);
      }}
      error={error}
    />
  );
}

const textarea = () => screen.getByRole('textbox', { name: 'Questions JSON' });
const preview = () => within(screen.getByRole('region', { name: 'Preview' }));
const edit = (text: string) => fireEvent.change(textarea(), { target: { value: text } });

describe('JsonformEditor', () => {
  it('shows a monospace textarea and a preview of the questions with its caption', () => {
    render(<Harness />);

    expect(textarea()).toHaveValue(TWO);
    expect(textarea().className).toContain('font-mono');
    expect(screen.getByText('Preview: what racers see. Answers here are not saved.')).toBeInTheDocument();
    expect(preview().getByText('What type of team are you?')).toBeInTheDocument();
    expect(screen.queryByText(/Preview shows the last version that parsed/)).not.toBeInTheDocument();
  });

  it('shows the line and column of a parse error and keeps the previous preview', () => {
    render(<Harness />);

    edit('{\n  "schema": }');

    expect(screen.getByText(/^Line 2, column \d+: /)).toBeInTheDocument();
    expect(textarea()).toBeInvalid();
    expect(screen.getByText('Preview shows the last version that parsed.')).toBeInTheDocument();
    expect(preview().getByText('What type of team are you?')).toBeInTheDocument();
  });

  it('says what is missing when the JSON has no schema', () => {
    render(<Harness />);

    edit('{"form": []}');

    expect(screen.getByText(/needs a "schema" with "properties"/i)).toBeInTheDocument();
    expect(screen.getByText('Preview shows the last version that parsed.')).toBeInTheDocument();
  });

  it('shows the server error under the editor', () => {
    render(<Harness error={['is not valid JSONForm']} />);

    expect(screen.getByText('is not valid JSONForm')).toBeInTheDocument();
    expect(textarea()).toBeInvalid();
  });

  it('lists a checkbox per question labelled by title or key, and ticking one adds its key', async () => {
    const onFilter = vi.fn();
    render(<Harness filter={['notes']} onFilter={onFilter} />);

    expect(screen.getByRole('checkbox', { name: 'notes' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'What type of team are you?' })).not.toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'What type of team are you?' }));

    // In the schema's order, not the order they were ticked.
    expect(onFilter).toHaveBeenLastCalledWith(['racer-type', 'notes']);
    expect(screen.getByRole('checkbox', { name: 'What type of team are you?' })).toBeChecked();

    await userEvent.click(screen.getByRole('checkbox', { name: 'notes' }));
    expect(onFilter).toHaveBeenLastCalledWith(['racer-type']);
  });

  it('drops a ticked key from the value when its question leaves the schema', () => {
    const onFilter = vi.fn();
    render(<Harness filter={['racer-type', 'notes']} onFilter={onFilter} />);

    edit(jsonform({ notes: { type: 'string' } }));

    expect(onFilter).toHaveBeenLastCalledWith(['notes']);
    expect(screen.queryByRole('checkbox', { name: 'What type of team are you?' })).not.toBeInTheDocument();
  });

  it('keeps the ticks while the text is broken', () => {
    const onFilter = vi.fn();
    render(<Harness filter={['notes']} onFilter={onFilter} />);

    edit('{ nope');

    expect(onFilter).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'notes' })).toBeChecked();
  });

  it('says the preview cannot draw questions it cannot read instead of crashing, and recovers', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<Harness />);

    edit(JSON.stringify({ schema: { type: 'object', properties: { a: { type: 'string' } } }, form: [null] }));
    expect(screen.getByText("The preview can't draw these questions. Check the form list.")).toBeInTheDocument();
    expect(textarea()).toBeInTheDocument();

    edit(TWO);
    expect(preview().getByText('What type of team are you?')).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it('has no preview or checkboxes for blank text', () => {
    render(<Harness initial="" />);

    expect(screen.queryByText(/^Preview: what racers see/)).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('keeps preview answers local and gives a Show preview button for small screens', async () => {
    render(<Harness />);
    const toggle = screen.getByRole('button', { name: 'Show preview' });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Hide preview' })).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Racer' }));
    expect(screen.getByRole('radio', { name: 'Racer' })).toBeChecked();
  });
});
