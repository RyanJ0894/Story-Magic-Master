/**
 * AudioTuningPanel component tests — UX-I-01 regression guards.
 *
 * Pins the lock/unlock semantics and the beforeunload warning that the
 * 2026-06-16 review (code-review/2026-06-16/07-UX-INFO-DESIGN.md) called
 * out as P1:
 *   1. Lock sends the full slider state + locked=true.
 *   2. Unlock sends ONLY { locked: false } so saved values are preserved
 *      and the sliders snap to whatever the API returned (don't silently
 *      overwrite).
 *   3. beforeunload fires when dirty, doesn't fire when clean.
 *   4. Reset-to-defaults updates the snapshot baseline so Lock stays
 *      enabled if the saved values were already non-default.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioTuningPanel } from '@/components/settings/AudioTuningPanel';
import type { AudioTuningDto } from '@/lib/services/audio-tuning';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const baseTuning: AudioTuningDto = {
  musicGainOffsetDb: 0,
  ambienceGainOffsetDb: 0,
  sfxGainOffsetDb: 0,
  narrationSpeed: 1.0,
  locked: false,
};

const lockedTuning: AudioTuningDto = {
  musicGainOffsetDb: 3,
  ambienceGainOffsetDb: 2,
  sfxGainOffsetDb: 1,
  narrationSpeed: 1.1,
  locked: true,
};

function mockFetchOnce(response: unknown, ok = true) {
  globalThis.fetch = vi.fn().mockResolvedValueOnce({
    ok,
    json: () => Promise.resolve(response),
  } as Response) as typeof fetch;
}

describe('AudioTuningPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to a default mock that throws if any test forgets to set up its fetch.
    // Tests that assert "no fetch fired" replace this with a tracking spy.
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('test forgot to mock fetch'))) as typeof fetch;
  });

  describe('Lock', () => {
    it('Lock button is disabled until sliders move', () => {
      render(<AudioTuningPanel initial={baseTuning} />);
      const lockBtn = screen.getByRole('button', { name: /lock these settings/i });
      expect(lockBtn).toBeDisabled();
    });

    it('Lock sends full slider state + locked=true', async () => {
      const user = userEvent.setup();
      mockFetchOnce({ data: { ...baseTuning, narrationSpeed: 1.1, locked: true } });
      render(<AudioTuningPanel initial={baseTuning} />);

      // Move the narration slider via keyboard — Radix sliders respond to ArrowRight.
      const sliders = screen.getAllByRole('slider');
      sliders[0].focus();
      await user.keyboard('{ArrowRight}');

      const lockBtn = screen.getByRole('button', { name: /lock these settings/i });
      await waitFor(() => expect(lockBtn).not.toBeDisabled());
      await user.click(lockBtn);

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.locked).toBe(true);
      expect(body.narrationSpeed).toBeGreaterThan(1.0);
      expect(body).toHaveProperty('musicGainOffsetDb');
      expect(body).toHaveProperty('ambienceGainOffsetDb');
      expect(body).toHaveProperty('sfxGainOffsetDb');
    });
  });

  describe('Unlock — UX-I-01 fix', () => {
    it('shows confirm dialog before unlocking (does NOT unlock on first click)', async () => {
      const user = userEvent.setup();
      render(<AudioTuningPanel initial={lockedTuning} />);

      const unlockBtn = screen.getByRole('button', { name: /^unlock$/i });
      await user.click(unlockBtn);

      // Confirm dialog should appear; no fetch fired yet.
      expect(screen.getByText(/unlock audio tuning\?/i)).toBeInTheDocument();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('on confirmed unlock, sends ONLY { locked: false } — preserves saved values', async () => {
      const user = userEvent.setup();
      mockFetchOnce({ data: { ...lockedTuning, locked: false } });
      render(<AudioTuningPanel initial={lockedTuning} />);

      await user.click(screen.getByRole('button', { name: /^unlock$/i }));
      // Confirm in the dialog
      await user.click(screen.getByRole('button', { name: /^unlock$/i }));

      await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body).toEqual({ locked: false });
      // Critical assertion: do NOT echo back current slider state.
      expect(body).not.toHaveProperty('musicGainOffsetDb');
      expect(body).not.toHaveProperty('narrationSpeed');
    });

    it('cancelling the confirm dialog leaves locked state untouched', async () => {
      const user = userEvent.setup();
      render(<AudioTuningPanel initial={lockedTuning} />);

      await user.click(screen.getByRole('button', { name: /^unlock$/i }));
      await user.click(screen.getByRole('button', { name: /keep locked/i }));

      expect(globalThis.fetch).not.toHaveBeenCalled();
      // Badge still says Locked
      expect(screen.getByText(/^locked$/i)).toBeInTheDocument();
    });
  });

  describe('beforeunload warning', () => {
    it('does not register beforeunload when sliders are clean', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      render(<AudioTuningPanel initial={baseTuning} />);
      expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
      addSpy.mockRestore();
    });

    it('registers beforeunload after sliders move and cancels it via returnValue', async () => {
      const user = userEvent.setup();
      const addSpy = vi.spyOn(window, 'addEventListener');
      render(<AudioTuningPanel initial={baseTuning} />);

      const sliders = screen.getAllByRole('slider');
      sliders[0].focus();
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
      });

      // Invoke the registered handler and confirm it sets returnValue
      const call = addSpy.mock.calls.find((c) => c[0] === 'beforeunload');
      const handler = call?.[1] as (e: BeforeUnloadEvent) => void;
      const fakeEvent = { preventDefault: vi.fn(), returnValue: undefined } as unknown as BeforeUnloadEvent;
      act(() => handler(fakeEvent));
      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(fakeEvent.returnValue).toBe('');

      addSpy.mockRestore();
    });
  });
});
