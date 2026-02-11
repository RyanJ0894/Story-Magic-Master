export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');

    // Start the queue worker for background job processing.
    // The worker polls for 'queued' jobs and processes them with retry + lock support.
    // Only runs in persistent Node.js processes (Render.com), not in edge or build contexts.
    if (process.env.DATABASE_URL) {
      const { startWorker } = await import('./lib/queue/worker');
      startWorker({ pollIntervalMs: 5000, lockDurationSeconds: 600 });
      console.log('[Instrumentation] Queue worker started');
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
