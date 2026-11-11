import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/server';
import {
  apiFetch,
  ApiError,
  clearCsrfToken,
  setUnauthorizedHandler,
} from '@/lib/api-client';

afterEach(() => {
  clearCsrfToken();
  setUnauthorizedHandler(() => {});
});

describe('apiFetch', () => {
  it('prefixes /api/v1 and returns parsed JSON without a CSRF token on GET', async () => {
    const csrf = vi.fn();
    server.use(
      http.get('/api/v1/csrf', () => {
        csrf();
        return HttpResponse.json({ token: 'x' });
      }),
      http.get('/api/v1/me', () => HttpResponse.json({ user: { id: 1 } })),
    );
    await expect(apiFetch('/me')).resolves.toEqual({ user: { id: 1 } });
    expect(csrf).not.toHaveBeenCalled();
  });

  it('fetches, caches and sends the CSRF token on non-GET requests', async () => {
    const csrf = vi.fn();
    const seen: (string | null)[] = [];
    server.use(
      http.get('/api/v1/csrf', () => {
        csrf();
        return HttpResponse.json({ token: 'tok-1' });
      }),
      http.post('/api/v1/things', ({ request }) => {
        seen.push(request.headers.get('X-CSRF-Token'));
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );
    await apiFetch('/things', { method: 'POST', json: { a: 1 } });
    await apiFetch('/things', { method: 'POST', json: { a: 2 } });
    expect(seen).toEqual(['tok-1', 'tok-1']);
    expect(csrf).toHaveBeenCalledTimes(1);
  });

  it('refetches the token and retries once after invalid_csrf', async () => {
    const tokens = ['stale', 'fresh'];
    const seen: (string | null)[] = [];
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: tokens.shift() })),
      http.post('/api/v1/things', ({ request }) => {
        const token = request.headers.get('X-CSRF-Token');
        seen.push(token);
        return token === 'fresh'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ error: 'invalid_csrf', errors: {} }, { status: 422 });
      }),
    );
    await expect(apiFetch('/things', { method: 'POST' })).resolves.toEqual({ ok: true });
    expect(seen).toEqual(['stale', 'fresh']);
  });

  it('does not retry invalid_csrf more than once', async () => {
    const posts = vi.fn();
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.post('/api/v1/things', () => {
        posts();
        return HttpResponse.json({ error: 'invalid_csrf', errors: {} }, { status: 422 });
      }),
    );
    await expect(apiFetch('/things', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      error: 'invalid_csrf',
    });
    expect(posts).toHaveBeenCalledTimes(2);
  });

  it('calls the unauthorized handler on 401 and throws ApiError', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get('/api/v1/teams', () =>
        HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 }),
      ),
    );
    await expect(apiFetch('/teams')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('skips the handler when skipUnauthorized is set', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get('/api/v1/me', () =>
        HttpResponse.json({ error: 'not_authenticated', errors: {} }, { status: 401 }),
      ),
    );
    await expect(apiFetch('/me', { skipUnauthorized: true })).rejects.toMatchObject({
      status: 401,
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('exposes the error envelope and does not call the handler on 422', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.post('/api/v1/session', () =>
        HttpResponse.json({ error: 'login_failed', errors: { base: ['bad'] } }, { status: 422 }),
      ),
    );
    await expect(
      apiFetch('/session', { method: 'POST', json: {} }),
    ).rejects.toMatchObject({ status: 422, error: 'login_failed', errors: { base: ['bad'] } });
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns undefined for 204', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.delete('/api/v1/session', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(apiFetch('/session', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('returns undefined for an empty 202 body', async () => {
    server.use(
      http.get('/api/v1/csrf', () => HttpResponse.json({ token: 't' })),
      http.post('/api/v1/password_resets', () => new HttpResponse(null, { status: 202 })),
    );
    await expect(
      apiFetch('/password_resets', { method: 'POST', json: { email: 'a@b.c' } }),
    ).resolves.toBeUndefined();
  });
});
