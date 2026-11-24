import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { t } from '@/locales/en';
import { buildRace, user } from '@/test/fixtures';
import { renderApp } from '@/test/render-app';
import { server } from '@/test/server';

function mockRaces(...races: ReturnType<typeof buildRace>[]) {
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ user })),
    http.get('/api/v1/races', () => HttpResponse.json({ races })),
  );
}

const noCount = t('intro.summaryNoCount');

describe('RegistrationIntro', () => {
  it("uses the first open race's team size", async () => {
    mockRaces(
      buildRace({ id: 1, open_for_registration: false, people_per_team: 7 }),
      buildRace({ id: 2, people_per_team: 5 }),
      buildRace({ id: 3, people_per_team: 4 }),
    );
    renderApp('/');
    expect(
      await screen.findByText(t('intro.summary', { n: 5 })),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: t('intro.toggle') }),
    );
    expect(screen.getByText(t('intro.step2', { n: 5 }))).toBeInTheDocument();
  });

  it('drops the number when no race is open', async () => {
    mockRaces(buildRace({ open_for_registration: false }));
    renderApp('/');
    await screen.findByText('CHIditarod 2027');
    expect(screen.getByText(noCount)).toBeInTheDocument();
    expect(screen.getByText(t('intro.step2NoCount'))).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\{n\}|undefined|NaN/);
  });

  it('shows the no-count copy while loading and on error', async () => {
    server.use(
      http.get('/api/v1/me', () => HttpResponse.json({ user })),
      http.get('/api/v1/races', () =>
        HttpResponse.json({ error: 'boom', errors: {} }, { status: 500 }),
      ),
    );
    renderApp('/');
    expect(screen.getByText(noCount)).toBeInTheDocument();
    await screen.findByText(t('races.heading'));
    expect(screen.getByText(noCount)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\{n\}|undefined|NaN/);
  });

  it('toggle opens and closes the steps', async () => {
    mockRaces(buildRace());
    renderApp('/');
    const toggle = await screen.findByRole('button', {
      name: t('intro.toggle'),
    });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(toggle.getAttribute('aria-controls')!)!;
    expect(panel).toHaveClass('hidden');
    expect(panel).toHaveTextContent(t('intro.step3'));
    expect(panel).toHaveTextContent(t('intro.waitlist'));
    expect(panel.querySelectorAll('li')).toHaveLength(4);

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveClass('hidden');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(panel).toHaveClass('hidden');
  });

  it('shows the intro above Choose your race', async () => {
    mockRaces(buildRace());
    renderApp('/');
    const intro = await screen.findByRole('heading', {
      name: t('intro.heading'),
    });
    const races = screen.getByRole('heading', { name: t('races.heading') });
    expect(
      intro.compareDocumentPosition(races) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
