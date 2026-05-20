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

  it('dismiss persists to localStorage so banner does not re-show', () => {
    render(<PwaInstallPrompt />);
    fireBip();

    fireEvent.click(screen.getByTestId('pwa-dismiss-button'));

    expect(localStorageMock.getItem('pwa-install-dismissed')).toBe('1');
  });

  it('does not show banner if already dismissed in a prior session', () => {
    localStorageMock.setItem('pwa-install-dismissed', '1');
    render(<PwaInstallPrompt />);
    fireBip();

    // Even after BIP fires, banner should stay hidden
    expect(screen.queryByTestId('pwa-install-prompt')).toBeNull();
  });
});
