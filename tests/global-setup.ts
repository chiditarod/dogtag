import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Global setup runs once before all tests:
 * - builds the React registration SPA (skip with SPA_BUILD=skip)
 * - cleans up any stale test data from previous runs
 */
async function globalSetup() {
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

  console.log('✅ Global setup complete\n');
}

export default globalSetup;
