/**
 * StoryScore Action Buttons Tests
 *
 * Tests that View History, Get Suggestions, and Export Report
 * buttons are wired up and functional.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =============================================================================
// Mocks
// =============================================================================

const mockApiFetch = vi.fn();
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Import after mocks
import StoryScore from '@/components/storyscore/StoryScore';

const dim = (score: number) => ({ score, reasoning: 'Test reasoning' });
const mockScore = {
  id: 'score-1',
  projectId: 'proj-1',
  version: 1,
  overallScore: 7.8,
  rating: 'CONSIDER' as const,
  confidence: 0.85,
  modelVersion: 'gpt-4',
  strengths: ['Strong dialogue'],
  weaknesses: ['Pacing issues'],
  categoryScores: { concept: 7.5, structure: 7.0, character: 8.0, craft: 8.0 },
  dimensions: {
    premiseOriginality: dim(8),
    loglineClarity: dim(7),
    commercialViability: dim(7),
    threeActIntegrity: dim(7),
    pacingMomentum: dim(6),
    stakesEscalation: dim(7),
    protagonistArc: dim(8),
    supportingCast: dim(8),
    castability: dim(8),
    dialogueQuality: dim(9),
    visualStorytelling: dim(7),
    technicalExecution: dim(8),
  },
  createdAt: new Date().toISOString(),
};

// =============================================================================
// Tests
// =============================================================================

describe('StoryScore action buttons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful fetch of existing score
    mockApiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ score: mockScore }),
    });
  });

  it('View History button is enabled and clickable', async () => {
    const user = userEvent.setup();
    render(<StoryScore projectId="proj-1" scriptText="test script" />);

    await waitFor(() => {
      expect(screen.getByText('View History')).toBeDefined();
    });

    const btn = screen.getByText('View History').closest('button')!;
    expect(btn.disabled).toBe(false);

    // Mock scrollIntoView
    const mockElement = { scrollIntoView: vi.fn() };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as unknown as HTMLElement);

    await user.click(btn);
    expect(document.getElementById).toHaveBeenCalledWith('revision-section');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('Get Suggestions button is enabled and clickable', async () => {
    const user = userEvent.setup();
    render(<StoryScore projectId="proj-1" scriptText="test script" />);

    await waitFor(() => {
      expect(screen.getByText('Get Suggestions')).toBeDefined();
    });

    const btn = screen.getByText('Get Suggestions').closest('button')!;
    expect(btn.disabled).toBe(false);

    const mockElement = { scrollIntoView: vi.fn() };
    vi.spyOn(document, 'getElementById').mockReturnValue(mockElement as unknown as HTMLElement);

    await user.click(btn);
    expect(document.getElementById).toHaveBeenCalledWith('story-adviser-section');
    expect(mockElement.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('ExportButton renders in place of disabled Export Report', async () => {
    render(<StoryScore projectId="proj-1" scriptText="test script" />);

    await waitFor(() => {
      expect(screen.getByText('View History')).toBeDefined();
    });

    // ExportButton(s) should render with "Export PDF" text (header + actions area)
    const exportBtns = screen.getAllByText('Export PDF');
    expect(exportBtns.length).toBeGreaterThanOrEqual(2);

    // Old disabled "Export Report" button should not exist
    expect(screen.queryByText('Export Report')).toBeNull();
  });
});
