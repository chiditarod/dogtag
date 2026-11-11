import { ENV } from '@/config/env';

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  status: number;
  error: string;
  errors: FieldErrors;

  constructor(status: number, error: string, errors: FieldErrors = {}) {
    super(error);
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.errors = errors;
  }
}

export interface ApiInit extends Omit<RequestInit, 'body'> {
  body?: BodyInit | null;
  /** JSON-serialised request body; sets Content-Type. */
  json?: unknown;
  /** Do not call the unauthorized handler on a 401 (e.g. the /me probe). */
  skipUnauthorized?: boolean;
}

let unauthorizedHandler: () => void = () => {};

export function setUnauthorizedHandler(fn: () => void) {
  unauthorizedHandler = fn;
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

export function clearCsrfToken() {
  csrfToken = null;
  csrfRequest = null;
}

function getCsrfToken(): Promise<string> {
  if (csrfToken) return Promise.resolve(csrfToken);
  csrfRequest ??= apiFetch<{ token: string }>('/csrf', { skipUnauthorized: true })
    .then(({ token }) => {
      csrfToken = token;
      return token;
    })
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({}));
  return new ApiError(
    response.status,
    body.error || `HTTP ${response.status}`,
    body.errors || {},
  );
}

export async function apiFetch<T>(
  path: string,
  { json, skipUnauthorized, headers: initHeaders, body, ...init }: ApiInit = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const mutating = method !== 'GET' && method !== 'HEAD';
  const headers = new Headers(initHeaders);
  headers.set('Accept', 'application/json');
  if (json !== undefined) headers.set('Content-Type', 'application/json');

  for (let retried = false; ; retried = true) {
    if (mutating) headers.set('X-CSRF-Token', await getCsrfToken());

    const response = await fetch(`${ENV.API_URL}${path}`, {
      ...init,
      method,
      headers,
      body: json !== undefined ? JSON.stringify(json) : body,
      credentials: 'same-origin',
    });

    if (response.ok) {
      // 204 (and any other empty body, e.g. 202) resolves to undefined.
      const text = response.status === 204 ? '' : await response.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const error = await toApiError(response);
    if (mutating && !retried && error.status === 422 && error.error === 'invalid_csrf') {
      clearCsrfToken();
      continue;
    }
    if (error.status === 401 && !skipUnauthorized) unauthorizedHandler();
    throw error;
  }
}
