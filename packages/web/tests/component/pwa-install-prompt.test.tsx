/**
 * PwaInstallPrompt Component Tests
 *
 * Tests the PWA install banner: visibility on `beforeinstallprompt`,
 * install flow, dismiss + localStorage persistence.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ── localStorage mock ──────────────────────────────────────────────────────
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

import { PwaInstallPrompt } from '@/components/pwa/PwaInstallPrompt';

function fireBip(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const mockPrompt = vi.fn().mockResolvedValue(undefined);
  const userChoicePromise = Promise.resolve({ outcome });

  const event = Object.assign(new Event('beforeinstallprompt'), {
    prompt: mockPrompt,
    userChoice: userChoicePromise,
    preventDefault: vi.fn(),
  });

  act(() => {
    window.dispatchEvent(event);
  });

  return { mockPrompt, userChoicePromise };
}

describe('PwaInstallPrompt', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('is not rendered before beforeinstallprompt fires', () => {
    render(<PwaInstallPrompt />);
    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('becomes visible after beforeinstallprompt fires', () => {
    render(<PwaInstallPrompt />);
    fireBip();
    expect(screen.getByTestId('pwa-install-prompt')).toBeDefined();
  });

  it('calls prompt() when Install button is clicked', async () => {
    render(<PwaInstallPrompt />);
    const { mockPrompt } = fireBip();

    const installBtn = screen.getByTestId('pwa-install-button');
    await act(async () => { fireEvent.click(installBtn); });

    expect(mockPrompt).toHaveBeenCalledOnce();
  });

  it('hides after user accepts install', async () => {
    render(<PwaInstallPrompt />);
    fireBip('accepted');

    const installBtn = screen.getByTestId('pwa-install-button');
    await act(async () => { fireEvent.click(installBtn); });

    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('dismiss button hides the banner', () => {
    render(<PwaInstallPrompt />);
    fireBip();

    fireEvent.click(screen.getByTestId('pwa-dismiss-button'));
    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('dismiss persists a timestamp to localStorage (UX-I-05 — 30-day TTL)', () => {
    render(<PwaInstallPrompt />);
    fireBip();

    const before = Date.now();
    fireEvent.click(screen.getByTestId('pwa-dismiss-button'));
    const after = Date.now();

    const stored = localStorageMock.getItem('pwa-install-dismissed');
    expect(stored).not.toBeNull();
    const ts = Number(stored);
    expect(Number.isFinite(ts)).toBe(true);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('does not show banner if dismissed within the 30-day TTL window', () => {
    // Fresh timestamp from "now" — should still be suppressed.
    localStorageMock.setItem('pwa-install-dismissed', String(Date.now()));
    render(<PwaInstallPrompt />);
    fireBip();

    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });

  it('shows banner again if last dismiss was more than 30 days ago (UX-I-05)', () => {
    // 31 days ago — past the TTL.
    const longAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    localStorageMock.setItem('pwa-install-dismissed', String(longAgo));
    render(<PwaInstallPrompt />);
    fireBip();

    expect(screen.queryByTestId('pwa-install-prompt')).not.toBeNull();
  });

  it('shows banner again if legacy "1" dismiss value is stored (migration)', () => {
    // Prior versions stored the literal '1' — we treat that as expired so
    // returning users get a re-prompt opportunity after the deploy.
    localStorageMock.setItem('pwa-install-dismissed', '1');
    render(<PwaInstallPrompt />);
    fireBip();

    expect(screen.queryByTestId('pwa-install-prompt')).not.toBeNull();
  });
});
