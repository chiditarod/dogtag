const CHECKOUT_SRC = 'https://checkout.stripe.com/checkout.js';
const LOGO = '/register/logo.png';

interface CheckoutToken {
  id: string;
  email: string;
}

interface CheckoutHandler {
  open: (options: {
    name?: string;
    description: string;
    amount: number;
    currency: string;
    email: string;
  }) => void;
}

interface StripeCheckoutGlobal {
  configure: (options: {
    key: string;
    locale: string;
    image: string;
    token: (token: CheckoutToken) => void;
    closed: () => void;
  }) => CheckoutHandler;
}

declare global {
  interface Window {
    StripeCheckout?: StripeCheckoutGlobal;
  }
}

export interface CheckoutOptions {
  key: string;
  amountCents: number;
  email: string;
  description: string;
  /** Title shown in the popup (the legacy flow uses the race name). */
  name?: string;
}

let scriptPromise: Promise<void> | null = null;

/** Injects checkout.js once; a failed load is forgotten so a retry can work. */
function loadCheckoutScript(): Promise<void> {
  if (window.StripeCheckout) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error('Stripe Checkout failed to load'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Opens the legacy Stripe Checkout popup. Resolves with the card token and the
 * email entered, or null when the user closes the popup without paying.
 * Rejects if checkout.js cannot be loaded.
 */
export async function openStripeCheckout({
  key,
  amountCents,
  email,
  description,
  name,
}: CheckoutOptions): Promise<{ token: string; email: string } | null> {
  await loadCheckoutScript();
  const checkout = window.StripeCheckout;
  if (!checkout) throw new Error('Stripe Checkout is unavailable');

  return new Promise((resolve) => {
    const handler = checkout.configure({
      key,
      locale: 'auto',
      image: LOGO,
      // Checkout calls `token` before `closed`, so a null here means "dismissed".
      token: (token) => resolve({ token: token.id, email: token.email }),
      closed: () => resolve(null),
    });
    handler.open({ name, description, amount: amountCents, currency: 'usd', email });
  });
}
