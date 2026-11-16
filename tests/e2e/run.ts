/**
 * Per-run context for the registration e2e suite: the resolved target, the run
 * id and the hand-off file between the race-setup and registration projects.
 *
 * Loads .env.e2e (gitignored) with dotenv. dotenv never overrides a variable
 * that is already set, so values exported in the shell win. Secret values are
 * never logged.
 */
import dotenv from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { resolveTarget, type Target } from './target';

const ENV_FILE = '.env.e2e';

/** Names (not values) the file defines that the shell did not already set. */
export const e2eFileKeys: string[] = existsSync(ENV_FILE)
  ? Object.keys(dotenv.parse(readFileSync(ENV_FILE))).filter((key) => process.env[key] === undefined)
  : [];

dotenv.config({ path: ENV_FILE, quiet: true });

export const target: Target = resolveTarget(process.env);

/** Set once by global setup (E2E_RUN_ID); workers inherit it. */
export function runId(): string {
  const id = process.env.E2E_RUN_ID;
  if (!id) throw new Error('E2E_RUN_ID is not set: global setup has not run');
  return id;
}

export interface RaceState {
  raceId: number;
  raceName: string;
}

function raceStatePath(): string {
  return join(process.cwd(), 'playwright', '.state', `race-${runId()}.json`);
}

export function writeRaceState(state: RaceState): void {
  const path = raceStatePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state));
}

export function readRaceState(): RaceState {
  const path = raceStatePath();
  if (!existsSync(path)) throw new Error(`Race state file missing (${path}): did the race-setup project run?`);
  return JSON.parse(readFileSync(path, 'utf8')) as RaceState;
}
