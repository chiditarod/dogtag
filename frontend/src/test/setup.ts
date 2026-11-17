import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { resetSeenThisSession, TOUR_OFF_KEY } from '@/features/tour/storage';
import { server } from '@/test/server';

// CI runs on a slow 2-vCPU container; the 1 s default makes navigation waits flaky there.
configure({ asyncUtilTimeout: 5000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
// No test sees the guided tour unless it clears this key.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(TOUR_OFF_KEY, '1');
  resetSeenThisSession();
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
