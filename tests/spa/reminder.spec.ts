import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { clearInbox, countEmails, waitForEmail } from '../helpers/mailpit';
import { seed, type Seed } from '../helpers/seed';
import { railsEnv } from '../helpers/server-env';

/**
 * Registration reminders: a race closing in 23 hours with an unfinalized team
 * gets one closing-day reminder, and running the job again sends nothing new.
 */

interface Credentials {
  captain_email: string;
  race_name: string;
  team_id: number;
}

let seeded: Seed<Credentials>;

function runReminders() {
  execSync(`bundle exec rails runner 'Workers::RegistrationReminders.new.perform({})'`, {
    stdio: 'inherit',
    env: { ...process.env, ...railsEnv },
  });
}

test.describe('Registration reminders', () => {
  test.beforeAll(() => {
    seeded = seed<Credentials>('reminder');
  });
  test.afterAll(() => seeded.dispose());
  test.beforeEach(() => clearInbox());

  test('emails the captain once, even if the job runs again', async () => {
    const c = seeded.credentials;
    const query = { to: c.captain_email, subjectIncludes: c.race_name };

    runReminders();
    const reminder = await waitForEmail(query);
    expect(reminder.subject).toContain('Registration closes in 24 hours');
    expect(reminder.links.some((link) => link.includes(`/register/teams/${c.team_id}`))).toBe(true);

    runReminders();
    // Let any (wrongly) duplicated delivery land before counting.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await countEmails(query)).toBe(1);
  });
});
