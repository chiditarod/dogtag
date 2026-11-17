import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { resetSeenThisSession, TOUR_OFF_KEY } from '@/features/tour/storage';
import { server } from '@/test/server';

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
