import { log } from '@/lib/logger';
import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (!stripePromise) {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (!publishableKey) {
      log.warn(
        'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Stripe checkout will not work.'
      );
      return Promise.resolve(null);
    }

    stripePromise = loadStripe(publishableKey);
  }

  return stripePromise;
}

// Note: redirectToCheckout has been deprecated in favor of redirect URLs
// We now use the checkout session URL directly from the server response
