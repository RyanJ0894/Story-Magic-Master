import { WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
      <WifiOff className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-semibold">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-xs text-sm">
        Story Magic needs a connection to generate new audio. Previously played audio is still
        available below.
      </p>
      <a
        href="/dashboard"
        className="mt-2 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Go to Dashboard
      </a>
    </main>
  );
}
