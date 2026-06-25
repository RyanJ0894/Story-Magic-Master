/**
 * useJobStream — EventSource consumer for /api/jobs/[id]/stream.
 *
 * Opt-in alternative to the polling-based job-status loop in
 * generate-button.tsx. When this hook is active (mount with a real
 * `jobId` AND the realtime flag is on at the call site), it:
 *
 *   1. Opens an EventSource to /api/jobs/[id]/stream
 *   2. Receives a JobStatus payload on every Postgres NOTIFY-triggered
 *      server push (~50 ms after the worker writes progress)
 *   3. Counts consecutive errors and **falls back permanently** to
 *      polling after 3 errors within 30 s
 *
 * Wire shape matches /api/jobs/[id] exactly so callers can swap channels
 * without changing how they consume JobStatus.
 *
 * Design notes (full doc: docs/REALTIME_JOB_SYNC_2026-06-25.md):
 *
 *   - **EventSource auto-reconnect.** The browser API reconnects on
 *     transient drops on its own. Our error counter only trips after
 *     3 errors in 30 s — that's a real backend problem, not a one-off
 *     network blip.
 *
 *   - **Fallback is a one-way trip per session.** Once we decide to
 *     fall back, we don't try SSE again until the next page mount.
 *     Avoids flapping when the server is in a degraded state.
 *
 *   - **No internal polling here.** The fallback signal is returned to
 *     the caller (generate-button.tsx); the existing polling loop in
 *     that component continues to run as the safety net.
 */

import { useEffect, useRef, useState } from 'react';
import { log } from '@/lib/logger';

export interface JobStatusFromStream {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | string;
  progress: { step?: string; percent?: number; details?: string; [k: string]: unknown };
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  segments?: Array<{ index: number; status: string; audioUrl: string | null }> | null;
  firstAudioUrl?: string | null;
  audio_url?: string | null;
  retry_count?: number;
  max_retries?: number;
}

export interface UseJobStreamResult {
  /** Latest JobStatus pushed by the server. Null until first event arrives. */
  status: JobStatusFromStream | null;
  /** True after we've decided to give up on SSE for this session. */
  fellBack: boolean;
}

const ERROR_THRESHOLD = 3;
const ERROR_WINDOW_MS = 30_000;

/**
 * Subscribe to a job's real-time stream. Caller passes a falsy jobId to
 * skip the subscription entirely.
 */
export function useJobStream(jobId: string | null): UseJobStreamResult {
  const [status, setStatus] = useState<JobStatusFromStream | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const errorTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    if (!jobId) return;

    let es: EventSource | null = null;
    let cancelled = false;

    try {
      es = new EventSource(`/api/jobs/${jobId}/stream`);
    } catch (err) {
      log.warn('[useJobStream] EventSource constructor threw, falling back to polling', { err });
      setFellBack(true);
      return;
    }

    es.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(ev.data) as JobStatusFromStream;
        setStatus(parsed);
      } catch (err) {
        log.warn('[useJobStream] failed to parse SSE payload', { err });
      }
    };

    es.onerror = () => {
      if (cancelled) return;
      const now = Date.now();
      const tsList = errorTimestampsRef.current;
      tsList.push(now);
      // Drop timestamps outside the rolling window.
      while (tsList.length > 0 && tsList[0] < now - ERROR_WINDOW_MS) {
        tsList.shift();
      }
      if (tsList.length >= ERROR_THRESHOLD) {
        log.info('[useJobStream] error threshold tripped, falling back to polling', {
          errorsIn30s: tsList.length,
        });
        try { es?.close(); } catch { /* noop */ }
        es = null;
        setFellBack(true);
      }
      // Otherwise: browser auto-reconnect handles the transient blip.
    };

    return () => {
      cancelled = true;
      if (es) {
        try { es.close(); } catch { /* noop */ }
      }
    };
  }, [jobId]);

  return { status, fellBack };
}
