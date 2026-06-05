/**
 * EnterpriseErrorBoundary Component Tests
 *
 * Verifies:
 * - Children rendered when no error
 * - Fallback UI rendered when child throws
 * - componentDidCatch reports to Sentry
 * - Reload button is present in fallback
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ── Sentry mock ────────────────────────────────────────────────────────────
// Use vi.hoisted so the variable is available when vi.mock factory runs
const { mockCaptureException } = vi.hoisted(() => ({
  mockCaptureException: vi.fn(),
}));
vi.mock('@sentry/nextjs', () => ({ captureException: mockCaptureException }));

// ── Button mock (avoids full Radix tree) ──────────────────────────────────
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

import { EnterpriseErrorBoundary } from '@/components/enterprise/EnterpriseErrorBoundary';

// ── Helper component that throws on demand ─────────────────────────────────
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test error from child');
  return <div data-testid="child">OK</div>;
}

// Suppress React's console.error for expected boundary errors
const originalError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  vi.clearAllMocks();
});
afterEach(() => {
  console.error = originalError;
});

describe('EnterpriseErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <EnterpriseErrorBoundary>
        <Bomb shouldThrow={false} />
      </EnterpriseErrorBoundary>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <EnterpriseErrorBoundary>
        <Bomb shouldThrow={true} />
      </EnterpriseErrorBoundary>
    );
    expect(screen.queryByTestId('child')).toBeNull();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('calls Sentry.captureException with the thrown error', () => {
    const err = new Error('test error from child');
    render(
      <EnterpriseErrorBoundary>
        <Bomb shouldThrow={true} />
      </EnterpriseErrorBoundary>
    );
    expect(mockCaptureException).toHaveBeenCalledOnce();
    expect(mockCaptureException.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
