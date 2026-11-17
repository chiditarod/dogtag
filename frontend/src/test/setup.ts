import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { resetSeenThisSession, TOUR_OFF_KEY } from '@/features/tour/storage';
import { server } from '@/test/server';

// jsdom swaps in its own AbortController/AbortSignal, and the undici bundled with Node 24
// rejects a jsdom signal in `new Request(url, { signal })` (React Router builds one on every
// navigation). Drop a foreign signal before the native Request sees it; tests never abort.
const NativeRequest = globalThis.Request;
const NativeAbortSignal = new NativeRequest('http://localhost').signal.constructor;
class SignalSafeRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (init?.signal && !(init.signal instanceof NativeAbortSignal)) {
      const { signal: _foreign, ...rest } = init;
      super(input, rest);
    } else {
      super(input, init);
    }
  }
}
globalThis.Request = SignalSafeRequest;

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
