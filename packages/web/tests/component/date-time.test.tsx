/**
 * <DateTime> component tests — SSR-safety contract (same class as
 * STORY-MAGIC-1F). The crucial invariant: server-rendered HTML must
 * be empty so it can't disagree with the client's first render.
 */

import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { DateTime } from '@/components/ui/date-time';

describe('<DateTime />', () => {
  const ISO = '2026-06-13T22:30:45.000Z';

  it('SSR produces an empty <time> with the ISO in datetime/title — no locale leakage', () => {
    const html = renderToString(<DateTime iso={ISO} mode="datetime" />);
    expect(html).toMatch(/<time[^>]*>\s*<\/time>/);
    expect(html.toLowerCase()).toContain(`datetime="${ISO.toLowerCase()}"`);
    expect(html).toContain(`title="${ISO}"`);
    // No formatted date strings — server doesn't know the user's locale.
    expect(html).not.toMatch(/\d{1,2}\/\d{1,2}/);
    expect(html).not.toMatch(/AM|PM/);
  });

  it('after mount renders a formatted string in mode="date"', async () => {
    const { container } = render(<DateTime iso={ISO} mode="date" />);
    await act(async () => { await Promise.resolve(); });
    const t = container.querySelector('time');
    expect(t?.textContent).not.toBe('');
    // Should look like a date (numbers + separators).
    expect(t?.textContent ?? '').toMatch(/\d/);
  });

  it('after mount renders a formatted string in mode="time"', async () => {
    const { container } = render(<DateTime iso={ISO} mode="time" />);
    await act(async () => { await Promise.resolve(); });
    const t = container.querySelector('time');
    expect(t?.textContent).not.toBe('');
    expect(t?.textContent ?? '').toMatch(/\d/);
  });

  it('after mount renders a formatted string in default mode="datetime"', async () => {
    const { container } = render(<DateTime iso={ISO} />);
    await act(async () => { await Promise.resolve(); });
    const t = container.querySelector('time');
    expect(t?.textContent).not.toBe('');
    expect(t?.textContent ?? '').toMatch(/\d/);
  });

  it('falls back to empty text for an unparseable ISO without throwing', async () => {
    const { container } = render(<DateTime iso="not-an-iso" />);
    await act(async () => { await Promise.resolve(); });
    const t = container.querySelector('time');
    expect(t?.textContent).toBe('');
    expect(t?.getAttribute('datetime')).toBe('not-an-iso');
  });

  it('honors a custom Intl.DateTimeFormatOptions when provided', async () => {
    const { container } = render(
      <DateTime iso={ISO} options={{ year: 'numeric' }} />,
    );
    await act(async () => { await Promise.resolve(); });
    const t = container.querySelector('time');
    expect(t?.textContent).toBe('2026');
  });
});
