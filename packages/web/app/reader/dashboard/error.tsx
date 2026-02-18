'use client';

export default function ReaderDashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl text-center">
      <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
      <p className="text-muted-foreground mb-4">{error.message}</p>
      <button onClick={reset} className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90">
        Try again
      </button>
    </div>
  );
}
