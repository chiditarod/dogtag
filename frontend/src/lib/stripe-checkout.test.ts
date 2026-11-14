import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const scripts = () =>
  document.querySelectorAll<HTMLScriptElement>('script[src="https://checkout.stripe.com/checkout.js"]');

let openStripeCheckout: typeof import('@/lib/stripe-checkout').openStripeCheckout;

beforeEach(async () => {
  vi.resetModules();
  ({ openStripeCheckout } = await import('@/lib/stripe-checkout'));
});
afterEach(() => {
  scripts().forEach((script) => script.remove());
  delete window.StripeCheckout;
});

const options = { key: 'pk_test', amountCents: 30000, email: 'a@example.com', description: 'Fee' };

function installStripe(behaviour: 'token' | 'close') {
  const configure = vi.fn((config: { token: (t: { id: string; email: string }) => void; closed: () => void }) => ({
    open: vi.fn(() => {
      if (behaviour === 'token') {
        config.token({ id: 'tok_1', email: 'x@example.com' });
        config.closed();
      } else {
        config.closed();
      }
    }),
  }));
  window.StripeCheckout = { configure } as unknown as typeof window.StripeCheckout;
  return configure;
}

describe('openStripeCheckout', () => {
  it('injects the script once and resolves with the token', async () => {
    const first = openStripeCheckout(options);
    const second = openStripeCheckout(options);
    expect(scripts()).toHaveLength(1);

    const configure = installStripe('token');
    scripts()[0].dispatchEvent(new Event('load'));
    expect(await first).toEqual({ token: 'tok_1', email: 'x@example.com' });
    expect(await second).toEqual({ token: 'tok_1', email: 'x@example.com' });
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'pk_test', locale: 'auto', image: '/register/logo.png' }),
    );
  });

  it('resolves null when the popup is closed without a token', async () => {
    installStripe('close');
    await expect(openStripeCheckout(options)).resolves.toBeNull();
  });

  it('rejects when the script fails to load, and can retry afterwards', async () => {
    const failed = openStripeCheckout(options);
    scripts()[0].dispatchEvent(new Event('error'));
    await expect(failed).rejects.toThrow();
    expect(scripts()).toHaveLength(0);

    const retry = openStripeCheckout(options);
    expect(scripts()).toHaveLength(1);
    installStripe('token');
    scripts()[0].dispatchEvent(new Event('load'));
    await expect(retry).resolves.toEqual({ token: 'tok_1', email: 'x@example.com' });
  });
});
