import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';
import { target } from './e2e/run';

/**
 * Global setup runs once before all tests:
 * - sets E2E_RUN_ID (workers inherit it)
 * - locally: builds the React registration SPA (skip with SPA_BUILD=skip),
 *   cleans up stale test data and ensures the operator login exists
 * - on staging: nothing else. No SPA build and no rails/bundle commands.
 */
async function globalSetup() {
  process.env.E2E_RUN_ID = randomUUID().replace(/-/g, '').slice(0, 8);

  if (target.name === 'staging') {
    console.log(`\n🌐 Staging target (${new URL(target.baseURL).hostname}): skipping SPA build and Rails tasks`);
    console.log(`✅ Global setup complete (run ${process.env.E2E_RUN_ID})\n`);
    return;
  }

  if (process.env.SPA_BUILD === 'skip') {
    console.log('\n⏭️  SPA_BUILD=skip: using the existing public/register build');
  } else {
    console.log('\n🏗️  Building the registration SPA...');
    if (!existsSync(join(process.cwd(), 'frontend', 'node_modules'))) {
      execSync('npm --prefix frontend ci', { stdio: 'inherit', cwd: process.cwd() });
    }
    execSync('npm --prefix frontend run build', { stdio: 'inherit', cwd: process.cwd() });
  }

  console.log('\n🧹 Running global setup: cleaning test database...');

  try {
    execSync('bundle exec rails test_seeds:cleanup', {
      stdio: 'inherit',
      cwd: process.cwd()
    });
  } catch (error) {
    // Ignore errors if no test data exists
    console.log('  (No test data to clean up)');
  }

  // The staff login for the registration suite (idempotent; cleanup keeps it).
  execSync('bundle exec rails test_seeds:operator', { stdio: 'inherit', cwd: process.cwd() });

  console.log(`✅ Global setup complete (run ${process.env.E2E_RUN_ID})\n`);
}

export default globalSetup;
