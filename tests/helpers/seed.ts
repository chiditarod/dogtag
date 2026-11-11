import { execSync } from 'child_process';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';

/** Environment the Rails server runs with (see playwright.config.ts); reused for rails runner. */
export const railsEnv = {
  APP_HOST: `localhost:${process.env.TEST_PORT || '3099'}`,
  SIDEKIQ_INLINE: 'true',
  REGISTRATION_UI: 'spa',
  SMTP_HOST: 'localhost',
  SMTP_PORT: '1025',
};

export interface Seed<T> {
  uniqueId: string;
  credentials: T;
  /** Removes the credentials file (database rows are swept by test_seeds:cleanup). */
  dispose: () => void;
}

/** Runs `rails test_seeds:<task>` with a fresh TEST_UNIQUE_ID and reads back its credentials JSON. */
export function seed<T>(task: string): Seed<T> {
  const uniqueId = randomUUID();
  const file = join(process.cwd(), 'tmp', `test_credentials_${uniqueId}.json`);
  execSync(`bundle exec rails test_seeds:${task}`, {
    stdio: 'inherit',
    env: { ...process.env, TEST_UNIQUE_ID: uniqueId },
  });
  return {
    uniqueId,
    credentials: JSON.parse(readFileSync(file, 'utf-8')) as T,
    dispose: () => {
      if (existsSync(file)) unlinkSync(file);
    },
  };
}
