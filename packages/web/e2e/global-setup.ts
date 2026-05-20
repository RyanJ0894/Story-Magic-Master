import { clerkSetup } from '@clerk/testing/playwright';

/**
 * Called once before any test worker starts.
 * Fetches a Clerk testing token from the backend API and writes it to
 * process.env.CLERK_TESTING_TOKEN so every worker can inject it into
 * FAPI requests via setupClerkTestingToken({ page }).
 *
 * Requires: CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in env.
 */
export default async function globalSetup() {
  await clerkSetup();
}
