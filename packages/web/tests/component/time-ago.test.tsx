/**
 * TimeAgo component tests — covers the SSR-safety contract that fixes
 * STORY-MAGIC-1F. The crucial behaviour is that the first render produces
 * stable output (no Date.now read), then the post-mount effect snaps in
 * the real relative-time string.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { TimeAgo } from '@/components/ui/time-ago';

describe('<TimeAgo />', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the <time> element with the ISO in dateTime and title (server-safe accessibility)', () => {
    const iso = '2026-06-13T12:00:00.000Z';
    const { container } = render(<TimeAgo iso={iso} />);
    const el = container.querySelector('time');
    expect(el).toBeTruthy();
    expect(el?.getAttribute('datetime')).toBe(iso);
    expect(el?.getAttribute('title')).toBe(iso);
  });

  it('SSR render produces empty text (no Date.now read) — the actual hydration-mismatch fix', () => {
    // renderToString simulates what Next.js sends down the wire: a single
    // server pass with no useEffect ever firing. If this output disagreed
    // with the client's first render, React would try to patch the DOM
    // and crash on parentNode (STORY-MAGIC-1F). Empty text guarantees
    // they agree.
    vi.setSystemTime(new Date('2026-06-13T12:05:00Z'));
    const iso = '2026-06-13T12:00:00.000Z';
    const html = renderToString(<TimeAgo iso={iso} />);
    // The <time> tag is present, datetime/title are populated, but the
    // inner text is empty. HTML attribute names are case-insensitive;
    // React 19's SSR emits `dateTime` (camelCase) literally — browsers
    // and validators read it as datetime either way.
    expect(html).toMatch(/<time[^>]*>\s*<\/time>/);
    expect(html.toLowerCase()).toContain(`datetime="${iso.toLowerCase()}"`);
    expect(html).toContain(`title="${iso}"`);
    // Crucially: NO "ago" / "now" string in the SSR output.
    expect(html).not.toMatch(/ago|now/);
  });

  it('after mount: renders a relative-time string', async () => {
    vi.setSystemTime(new Date('2026-06-13T12:05:00Z'));
    const iso = '2026-06-13T12:00:00.000Z'; // 5 minutes earlier
    render(<TimeAgo iso={iso} />);
    // Flush the useEffect timer + state update.
    await act(async () => {
      await Promise.resolve();
    });
    const el = screen.getByText('5m ago', { selector: 'time' });
    expect(el).toBeTruthy();
  });

  it('refreshes once per minute as time advances', async () => {
    vi.setSystemTime(new Date('2026-06-13T12:05:00Z'));
    const iso = '2026-06-13T12:00:00.000Z'; // 5m ago at mount
    render(<TimeAgo iso={iso} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('5m ago', { selector: 'time' })).toBeTruthy();

    // Advance the wall clock by 2 minutes and let the interval fire.
    await act(async () => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(screen.getByText('7m ago', { selector: 'time' })).toBeTruthy();
  });

  it('formats < 1 minute as "just now"', async () => {
    vi.setSystemTime(new Date('2026-06-13T12:00:30Z'));
    const iso = '2026-06-13T12:00:00.000Z'; // 30s ago
    render(<TimeAgo iso={iso} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('just now', { selector: 'time' })).toBeTruthy();
  });

  it('formats > 60 minutes as hours', async () => {
    vi.setSystemTime(new Date('2026-06-13T15:00:00Z'));
    const iso = '2026-06-13T12:00:00.000Z'; // 3h ago
    render(<TimeAgo iso={iso} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('3h ago', { selector: 'time' })).toBeTruthy();
  });

  it('formats > 24 hours as days', async () => {
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'));
    const iso = '2026-06-13T12:00:00.000Z'; // 2d ago
    render(<TimeAgo iso={iso} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('2d ago', { selector: 'time' })).toBeTruthy();
  });

  it('clamps negative diffs (clock skew) to "just now" without throwing', async () => {
    vi.setSystemTime(new Date('2026-06-13T12:00:00Z'));
    const iso = '2026-06-13T12:05:00.000Z'; // 5 min IN THE FUTURE
    render(<TimeAgo iso={iso} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('just now', { selector: 'time' })).toBeTruthy();
  });
});
