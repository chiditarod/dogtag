import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { resetSeenThisSession, TOUR_OFF_KEY } from '@/features/tour/storage';
import { server } from '@/test/server';

// jsdom swaps in its own AbortController/AbortSignal, and the undici bundled with Node 24
// rejects a jsdom signal in `new Request(url, { signal })` (React Router builds one on every
// navigation). Tests never abort a request, so drop the signal before the native Request sees it.
// (An instanceof check cannot tell them apart: undici builds Request.signal from jsdom's class.)
const NativeRequest = globalThis.Request;
class SignalFreeRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal) {
      const { signal: _dropped, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
}
globalThis.Request = SignalFreeRequest;

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
