import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/locales/en';
import { user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';
import type { StaffRace } from '../api/types';
import { TIME_ZONES, staffRace } from '../test-fixtures';

interface Sent {
  method: string;
  body: { race: Record<string, unknown> } | null;
}

function serve(race: StaffRace, sent: Sent, status = 200, response?: unknown) {
  const handle = (method: string) => async ({ request }: { request: Request }) => {
    sent.method = method;
    sent.body = (await request.json()) as Sent['body'];
    return HttpResponse.json(response ?? { race, time_zones: TIME_ZONES }, { status });
  };
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user: { ...user, roles: ['operator'] } })),
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 'tok' })),
    http.get(`/api/v1/staff/races/${race.id}`, () => HttpResponse.json({ race, time_zones: TIME_ZONES })),
    http.get('/api/v1/staff/races', () => HttpResponse.json({ races: [] })),
    http.post('/api/v1/staff/confirmation_preview', () => HttpResponse.json({ html: null })),
    http.put(`/api/v1/staff/races/${race.id}`, handle('PUT')),
    http.patch(`/api/v1/staff/races/${race.id}`, handle('PATCH')),
    http.post('/api/v1/staff/races', handle('POST')),
  );
}

async function openEdit(overrides: Partial<StaffRace> = {}, status = 200, response?: unknown) {
  const race = staffRace({ id: 7, ...overrides });
  const sent: Sent = { method: '', body: null };
  serve(race, sent, status, response);
  const rendered = renderApp(`/staff/races/${race.id}/edit`);
  await screen.findByRole('heading', { name: t('staff.races.form.editHeading'), level: 1 });
  return { ...rendered, race, sent };
}

const save = () => screen.getByRole('button', { name: t('staff.races.form.save') });
const field = (label: string) => screen.getByLabelText(label);
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

afterEach(() => {
  // @ts-expect-error jsdom has no scrollIntoView; tests that need it add their own.
  delete HTMLElement.prototype.scrollIntoView;
});

describe('RaceForm (edit)', () => {
  it('shows the section cards in order, with the race filled in', async () => {
    await openEdit();

    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Basics',
      'Dates',
      'Questions (JSONForm)',
      'Experience choices',
      'Fundraising (Classy)',
      'Confirmation text',
    ]);
    expect(field('Name')).toHaveValue('CHIditarod 2027');
    expect(field('Max teams')).toHaveValue('100');
    expect(field('Racers per team')).toHaveValue('5');
    expect(field('Registration opens')).toHaveValue('2026-12-07T12:00');
    expect(field('Team experience choices')).toHaveValue('New\nVeteran');
    expect(screen.getByText('One per line. These are the team-level choices; racers type their own years.')).toBeInTheDocument();
    expect(field('Campaign ID')).toHaveValue('12345');
    expect(field('Default team goal ($)')).toHaveValue('1500');
    expect(screen.getByRole('link', { name: t('staff.races.form.cancel') })).toHaveAttribute('href', '/register/staff/races/7');
    expect(save()).toBeDisabled();
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it('sends only the changed name, with no dates, then opens the overview', async () => {
    const { sent, router } = await openEdit();

    type('Name', 'CHIditarod 2028');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await userEvent.click(save());

    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/7'));
    expect(sent.body).toEqual({ race: { name: 'CHIditarod 2028' } });
    expect(sent.method).toBe('PUT');
    expect(await screen.findByRole('heading', { name: 'CHIditarod 2027', level: 1 })).toBeInTheDocument();
  });

  it('sends a changed date as a wall clock and numbers as numbers', async () => {
    const { sent } = await openEdit();

    type('Race day', '2027-03-14T10:00');
    type('Max teams', '120');
    type('Default team goal ($)', '');
    await userEvent.click(save());

    await waitFor(() => expect(sent.body).not.toBeNull());
    expect(sent.body).toEqual({
      race: { race_datetime: '2027-03-14T10:00', max_teams: 120, classy_default_goal: null },
    });
  });

  it('shows a 422 under its field, scrolls to it and focuses it', async () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    await openEdit(
      {},
      422,
      { error: 'Validation failed', errors: { final_edits_close: ['must be before Race day'] } },
    );

    type('Name', 'Other');
    await userEvent.click(save());

    const message = await screen.findByText('must be before Race day');
    expect(within(field('Final edits close').closest('div[class*="space-y"]') as HTMLElement).getByText('must be before Race day'))
      .toBeInTheDocument();
    expect(message).toBeInTheDocument();
    await waitFor(() => expect(field('Final edits close')).toHaveFocus());
    expect(scrollIntoView).toHaveBeenCalled();
    expect(scrollIntoView.mock.contexts[0]).toBe(field('Final edits close'));
    expect(screen.getByRole('alert')).toHaveTextContent(t('staff.races.form.fixErrors'));

    // Editing the field answers the complaint.
    type('Final edits close', '2027-03-01T00:00');
    expect(screen.queryByText('must be before Race day')).not.toBeInTheDocument();
  });

  it('shows the jsonform error under the editor', async () => {
    await openEdit({}, 422, { error: 'Validation failed', errors: { jsonform: ['field "x" is required, so it cannot have showWhen'] } });

    type('Name', 'Other');
    await userEvent.click(save());

    expect(await screen.findByText('field "x" is required, so it cannot have showWhen')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Questions JSON' })).toHaveFocus());
  });

  it('lists a server error that has no field on the page in the Save bar', async () => {
    await openEdit({}, 422, { error: 'Validation failed', errors: { base: ['something else'] } });

    type('Name', 'Other');
    await userEvent.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent('base: something else');
  });

  it('does not send while a date is out of order, and shows why', async () => {
    const { sent } = await openEdit();

    type('Race day', '2027-02-01T10:00');
    await userEvent.click(save());

    expect(await screen.findByText(/Must be before Race day/)).toBeInTheDocument();
    await waitFor(() => expect(field('Final edits close')).toHaveFocus());
    expect(sent.body).toBeNull();
  });

  it('does not send a blank name, a non-number, or text over the limit', async () => {
    const { sent } = await openEdit();

    type('Name', '  ');
    type('Max teams', 'lots');
    type('Confirmation text (Markdown)', 'x'.repeat(5001));
    await userEvent.click(save());

    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByText('Enter a whole number above 0')).toBeInTheDocument();
    expect(screen.getByText('Over the 5000 character limit.')).toBeInTheDocument();
    expect(screen.getByText('5001 / 5000')).toBeInTheDocument();
    await waitFor(() => expect(field('Name')).toHaveFocus());
    expect(sent.body).toBeNull();
  });

  it('does not send while the questions JSON does not parse', async () => {
    const { sent } = await openEdit();

    fireEvent.change(screen.getByRole('textbox', { name: 'Questions JSON' }), { target: { value: '{ nope' } });
    await userEvent.click(save());

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Questions JSON' })).toHaveFocus());
    expect(sent.body).toBeNull();
  });

  it('sends the zone with all four dates when the zone changes', async () => {
    const { sent } = await openEdit();

    await userEvent.selectOptions(field('Time zone'), 'America/New_York');
    await userEvent.click(save());

    await waitFor(() => expect(sent.body).not.toBeNull());
    expect(sent.body?.race).toEqual({
      time_zone: 'America/New_York',
      registration_open: '2026-12-07T12:00',
      registration_close: '2027-02-02T00:00',
      final_edits_close: '2027-03-02T00:00',
      race_datetime: '2027-03-13T11:00',
    });
  });

  it('sends ticked filter fields as an array', async () => {
    const { sent } = await openEdit();

    await userEvent.click(screen.getByRole('checkbox', { name: 'a' }));
    await userEvent.click(save());

    await waitFor(() => expect(sent.body).not.toBeNull());
    expect(sent.body?.race).toEqual({ filter_field: ['a'] });
  });

  it('asks the browser to confirm leaving while there are unsaved changes, and not after', async () => {
    await openEdit();
    const leave = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(leave()).toBe(false);

    type('Name', 'Other');
    expect(leave()).toBe(true);

    type('Name', 'CHIditarod 2027');
    expect(leave()).toBe(false);
  });

  it('shows a debounced server preview of the confirmation text', async () => {
    await openEdit({ confirmation_text: null });
    const previews: string[] = [];
    server.use(
      http.post('/api/v1/staff/confirmation_preview', async ({ request }) => {
        const { text } = (await request.json()) as { text: string };
        previews.push(text);
        return HttpResponse.json({ html: `<p><strong>${text}</strong></p>` });
      }),
    );
    expect(screen.queryByRole('region', { name: t('staff.races.form.confirmationPreview') })).not.toBeInTheDocument();

    type('Confirmation text (Markdown)', 'You');
    type('Confirmation text (Markdown)', 'You are in');

    const preview = await screen.findByRole('region', { name: t('staff.races.form.confirmationPreview') });
    expect(within(preview).getByText('You are in')).toBeInTheDocument();
    expect(previews).toEqual(['You are in']);
    expect(screen.getByText('10 / 5000')).toBeInTheDocument();

    type('Confirmation text (Markdown)', '');
    expect(screen.queryByRole('region', { name: t('staff.races.form.confirmationPreview') })).not.toBeInTheDocument();
  });
});

describe('RaceForm (new)', () => {
  const defaults = {
    name: null,
    time_zone: 'America/Chicago',
    max_teams: null,
    people_per_team: 5,
    registration_open: null,
    registration_close: null,
    final_edits_close: null,
    race_datetime: null,
    jsonform: null,
    filter_field: [],
    experience_labels_text: '',
    classy_campaign_id: null,
    classy_default_goal: null,
    confirmation_text: null,
    confirmation_text_max_length: 5000,
  };

  it('starts from the defaults and creates the race, then opens its overview', async () => {
    const created = staffRace({ id: 31, name: 'Race 2028' });
    const sent: Sent = { method: '', body: null };
    serve(created, sent, 201);
    server.use(
      http.get('/api/v1/staff/races/new', () => HttpResponse.json({ race: defaults, time_zones: TIME_ZONES })),
    );
    const { router } = renderApp('/staff/races/new');
    await screen.findByRole('heading', { name: t('staff.races.form.newHeading'), level: 1 });

    expect(field('Racers per team')).toHaveValue('5');
    expect(field('Time zone')).toHaveValue('America/Chicago');
    expect(screen.queryByText(/You changed the time zone/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('staff.races.form.cancel') })).toHaveAttribute('href', '/register/staff/races');

    // Nothing to send yet: the form says what is missing.
    await userEvent.click(screen.getByRole('button', { name: t('staff.races.form.create') }));
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getAllByText('Enter a date and time')).toHaveLength(4);
    expect(sent.body).toBeNull();

    type('Name', 'Race 2028');
    type('Max teams', '90');
    type('Registration opens', '2026-12-07T12:00');
    type('Registration closes', '2027-02-15T00:00');
    type('Final edits close', '2027-03-01T00:00');
    type('Race day', '2027-03-06T10:00');
    await userEvent.click(screen.getByRole('button', { name: t('staff.races.form.create') }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/register/staff/races/31'));
    expect(sent.method).toBe('POST');
    expect(sent.body?.race).toMatchObject({
      name: 'Race 2028',
      time_zone: 'America/Chicago',
      max_teams: 90,
      people_per_team: 5,
      jsonform: null,
      confirmation_text: null,
      registration_open: '2026-12-07T12:00',
      race_datetime: '2027-03-06T10:00',
      filter_field: [],
    });
  });
});
