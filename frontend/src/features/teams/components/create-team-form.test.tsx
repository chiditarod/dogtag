import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearCsrfToken } from '@/lib/api-client';
import { t } from '@/locales/en';
import { buildRace, buildTeam, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

beforeEach(() => {
  server.use(
    http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/races/1', () => HttpResponse.json({ race: buildRace() })),
  );
});
afterEach(() => clearCsrfToken());

async function fillAndSubmit() {
  await userEvent.type(await screen.findByLabelText(t('teams.name')), 'Cart Pushers');
  await userEvent.type(screen.getByLabelText(t('teams.description')), 'We push carts');
  await userEvent.selectOptions(screen.getByLabelText(t('teams.experience')), 'Raced once before');
  await userEvent.click(screen.getByRole('button', { name: t('teams.create') }));
}

describe('CreateTeamForm', () => {
  it('offers the race experience labels, with the value as the index', async () => {
    renderApp('/races/1/teams/new');
    const select = await screen.findByLabelText(t('teams.experience'));
    const options = Array.from((select as HTMLSelectElement).options);
    expect(options.map((o) => [o.value, o.text])).toEqual([
      ['', t('teams.experiencePlaceholder')],
      ['0', 'This is our first'],
      ['1', 'Raced once before'],
      ['2', 'Twice'],
    ]);
    await userEvent.click(screen.getByRole('button', { name: t('teams.experienceTip') }));
    expect(await screen.findByText(t('teams.experienceTipBody'))).toBeInTheDocument();
  });

  it('blocks submit and flags the select when no years-racing option is chosen', async () => {
    let posted = false;
    server.use(
      http.post('/api/v1/teams', () => {
        posted = true;
        return HttpResponse.json({ team: buildTeam() }, { status: 201 });
      }),
    );
    renderApp('/races/1/teams/new');
    await userEvent.type(await screen.findByLabelText(t('teams.name')), 'Cart Pushers');
    await userEvent.type(screen.getByLabelText(t('teams.description')), 'We push carts');
    await userEvent.click(screen.getByRole('button', { name: t('teams.create') }));
    const select = screen.getByLabelText(t('teams.experience'));
    expect(await screen.findByText(t('teams.experienceRequired'))).toBeInTheDocument();
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveFocus();
    expect(posted).toBe(false);
    await userEvent.selectOptions(select, 'Twice');
    expect(screen.queryByText(t('teams.experienceRequired'))).toBeNull();
  });

  it('shows a duplicate-name 422 under Name', async () => {
    server.use(
      http.post('/api/v1/teams', () =>
        HttpResponse.json(
          { error: 'invalid', errors: { name: ['has already been taken'] } },
          { status: 422 },
        ),
      ),
    );
    renderApp('/races/1/teams/new');
    await fillAndSubmit();
    const input = await screen.findByLabelText(t('teams.name'));
    expect(await screen.findByText('has already been taken')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('posts the team and navigates to /teams/9 on 201', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/teams', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ team: buildTeam({ id: 9 }) }, { status: 201 });
      }),
      http.get('/api/v1/teams/9', () => HttpResponse.json({ team: buildTeam({ id: 9 }) })),
    );
    const { router } = renderApp('/races/1/teams/new');
    await fillAndSubmit();
    await screen.findByRole('heading', { level: 1, name: 'Cart Pushers' });
    expect(router.state.location.pathname).toBe('/register/teams/9');
    expect(body).toEqual({
      race_id: 1,
      team: { name: 'Cart Pushers', description: 'We push carts', experience: 1 },
    });
  });

  it('shows the closed message as a banner on 403', async () => {
    server.use(
      http.post('/api/v1/teams', () =>
        HttpResponse.json(
          { error: 'Registration is closed for this race.', errors: {} },
          { status: 403 },
        ),
      ),
    );
    renderApp('/races/1/teams/new');
    await fillAndSubmit();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Registration is closed for this race.',
    );
  });

  it('shows an error with retry when the race fails to load', async () => {
    server.use(
      http.get('/api/v1/races/1', () =>
        HttpResponse.json({ error: 'not_found', errors: {} }, { status: 404 }),
      ),
    );
    renderApp('/races/1/teams/new');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('common.retry') })).toBeInTheDocument();
  });
});
