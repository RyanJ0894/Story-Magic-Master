export const dynamic = 'force-dynamic';

import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  return <AuthenticateWithRedirectCallback />;
}
