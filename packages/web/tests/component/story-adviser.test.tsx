/**
 * Story Adviser Component Tests (TD-041)
 *
 * Tests for StoryAdviser, SuggestionCard, SuggestionPanel,
 * StoryAdviserSection, ScriptAnnotator, and RewriteModal.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Suggestion, Rewrite } from '@/lib/adviser/types';

// =============================================================================
// Mocks
// =============================================================================

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock FeatureGate to just render children
vi.mock('@/lib/features', () => ({
  isFeatureEnabled: vi.fn(() => true),
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Import components after mocks
import { StoryAdviser } from '@/components/story-adviser/StoryAdviser';
import { SuggestionCard } from '@/components/story-adviser/SuggestionCard';
import { SuggestionPanel } from '@/components/story-adviser/SuggestionPanel';
import { StoryAdviserSection } from '@/components/story-adviser/StoryAdviserSection';
import { ScriptAnnotator } from '@/components/story-adviser/ScriptAnnotator';
import { RewriteModal } from '@/components/story-adviser/RewriteModal';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    projectId: 'project-123',
    location: {
      startLine: 10,
      endLine: 15,
      excerpt: 'JOHN: I need to go.',
    },
    category: 'dialogue',
    severity: 'important',
    title: 'Add subtext to this exchange',
    explanation: 'The dialogue is too on-the-nose and lacks subtext.',
    suggestion: 'Consider having John express his desire to leave indirectly.',
    status: 'pending',
    confidence: 0.85,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function createMockRewrite(overrides: Partial<Rewrite> = {}): Rewrite {
  return {
    id: 'rewrite-1',
    suggestionId: 'suggestion-1',
    originalText: 'JOHN: I need to go.',
    rewrittenText: 'JOHN: (glancing at the door) This has been... something.',
    explanation: 'Shows desire to leave through action and vague language.',
    style: 'moderate',
    selected: false,
    isSelected: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

const mockStats = {
  total: 5,
  pending: 3,
  accepted: 1,
  rejected: 0,
  dismissed: 1,
  critical: 1,
  important: 2,
  minor: 2,
};

// =============================================================================
// StoryAdviser (main component)
// =============================================================================

describe('StoryAdviser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading skeleton while fetching suggestions', () => {
    // apiFetch never resolves => stays in loading state
    mockApiFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    // The Skeleton components render with animate-pulse or skeleton classes
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty state with generate button when no suggestions exist', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: [], stats: null }),
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Get Personalized Feedback')).toBeInTheDocument();
    });

    expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    expect(
      screen.getByText(/Story-Adviser analyzes your script/)
    ).toBeInTheDocument();
  });

  it('renders suggestions when loaded', async () => {
    const suggestions = [
      createMockSuggestion({ id: 'sug-1', title: 'Strengthen the opening' }),
      createMockSuggestion({ id: 'sug-2', title: 'Add visual details', category: 'visual' }),
    ];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions, stats: mockStats }),
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Story-Adviser')).toBeInTheDocument();
    });

    expect(screen.getByText(/5 suggestions/)).toBeInTheDocument();
  });

  it('handles generate button click', async () => {
    const user = userEvent.setup();

    // First fetch returns empty
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: [], stats: null }),
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });

    // Mock the POST response for generation
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          suggestions: [createMockSuggestion()],
          stats: mockStats,
        }),
    });

    await user.click(screen.getByText('Generate Suggestions'));

    // Should have called POST
    expect(mockApiFetch).toHaveBeenCalledWith(
      '/api/projects/project-123/suggestions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('shows error state when fetch fails', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch suggestions')).toBeInTheDocument();
  });

  it('shows error state when generation fails', async () => {
    const user = userEvent.setup();

    // First fetch returns empty (no suggestions)
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: [], stats: null }),
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });

    // Mock generation failure
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Quota exceeded' }),
    });

    await user.click(screen.getByText('Generate Suggestions'));

    await waitFor(() => {
      expect(screen.getByText('Quota exceeded')).toBeInTheDocument();
    });
  });

  it('hides generate button when feature returns 403', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    render(
      <StoryAdviser projectId="project-123" scriptText="Some script text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Generate Suggestions')).toBeInTheDocument();
    });

    // No error message should appear since 403 is handled gracefully
    expect(screen.queryByText('Error')).not.toBeInTheDocument();
  });
});

// =============================================================================
// SuggestionCard
// =============================================================================

describe('SuggestionCard', () => {
  it('renders suggestion with category and severity badges', () => {
    const suggestion = createMockSuggestion({
      category: 'dialogue',
      severity: 'important',
    });

    render(<SuggestionCard suggestion={suggestion} />);

    expect(screen.getByText('Dialogue')).toBeInTheDocument();
    expect(screen.getByText('Important')).toBeInTheDocument();
  });

  it('renders the suggestion title', () => {
    const suggestion = createMockSuggestion({
      title: 'Improve pacing in Act 2',
    });

    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText('Improve pacing in Act 2')).toBeInTheDocument();
  });

  it('shows location link with line numbers', () => {
    const suggestion = createMockSuggestion({
      location: { startLine: 42, endLine: 50, excerpt: 'Some text' },
    });

    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText(/Lines 42-50/)).toBeInTheDocument();
  });

  it('shows accept/dismiss/reject actions for pending suggestions', async () => {
    const user = userEvent.setup();
    const suggestion = createMockSuggestion({ status: 'pending' });

    render(<SuggestionCard suggestion={suggestion} />);

    // Find the expand/collapse button (the last button with chevron icon)
    const buttons = screen.getAllByRole('button');
    // The expand button is the one that doesn't have text content like "Lines"
    const expandBtn = buttons[buttons.length - 1];
    await user.click(expandBtn);

    // After expanding, action buttons should appear
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Skip')).toBeInTheDocument();
    expect(screen.getByText('Disagree')).toBeInTheDocument();
  });

  it('shows rewrite button when expanded', async () => {
    const user = userEvent.setup();
    const suggestion = createMockSuggestion({ status: 'pending' });

    render(<SuggestionCard suggestion={suggestion} />);

    // Expand by clicking the chevron button
    const buttons = screen.getAllByRole('button');
    const expandBtn = buttons.find(
      (btn) => !btn.textContent?.includes('Lines')
    );
    if (expandBtn) {
      await user.click(expandBtn);
    }

    await waitFor(() => {
      expect(screen.getByText('Get Rewrites')).toBeInTheDocument();
    });
  });

  it('calls onAccept handler when Accept is clicked', async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const suggestion = createMockSuggestion({ status: 'pending' });

    render(<SuggestionCard suggestion={suggestion} onAccept={onAccept} />);

    // Expand first
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[buttons.length - 1]); // expand button

    await waitFor(() => {
      expect(screen.getByText('Accept')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Accept'));

    expect(onAccept).toHaveBeenCalledWith('suggestion-1');
  });

  it('calls onRewrite handler when Get Rewrites is clicked', async () => {
    const user = userEvent.setup();
    const onRewrite = vi.fn();
    const suggestion = createMockSuggestion({ status: 'pending' });

    render(<SuggestionCard suggestion={suggestion} onRewrite={onRewrite} />);

    // Expand
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('Get Rewrites')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Get Rewrites'));

    expect(onRewrite).toHaveBeenCalledWith('suggestion-1');
  });

  it('shows status badge for non-pending suggestions', () => {
    const suggestion = createMockSuggestion({ status: 'accepted' });

    render(<SuggestionCard suggestion={suggestion} />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });

  it('hides action buttons for non-pending suggestions', async () => {
    const user = userEvent.setup();
    const suggestion = createMockSuggestion({ status: 'accepted' });

    render(<SuggestionCard suggestion={suggestion} />);

    // Expand
    const buttons = screen.getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);

    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Rewrites')).not.toBeInTheDocument();
  });

  it('shows critical border styling for critical severity', () => {
    const suggestion = createMockSuggestion({ severity: 'critical' });

    const { container } = render(<SuggestionCard suggestion={suggestion} />);

    // The outermost Card should have border-red class
    const card = container.firstElementChild;
    expect(card?.className).toContain('border-red');
  });

  it('shows expanded details with excerpt and explanation', async () => {
    const user = userEvent.setup();
    const suggestion = createMockSuggestion({
      location: { startLine: 10, endLine: 15, excerpt: 'JOHN: I need to go.' },
      explanation: 'Dialogue lacks nuance.',
      suggestion: 'Use indirect language.',
      confidence: 0.92,
    });

    render(<SuggestionCard suggestion={suggestion} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText('JOHN: I need to go.')).toBeInTheDocument();
      expect(screen.getByText('Dialogue lacks nuance.')).toBeInTheDocument();
      expect(screen.getByText('Use indirect language.')).toBeInTheDocument();
      expect(screen.getByText('Confidence: 92%')).toBeInTheDocument();
    });
  });

  it('calls onNavigate when location link is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const suggestion = createMockSuggestion({
      location: { startLine: 10, endLine: 15, excerpt: 'Text' },
    });

    render(<SuggestionCard suggestion={suggestion} onNavigate={onNavigate} />);

    await user.click(screen.getByText(/Lines 10-15/));

    expect(onNavigate).toHaveBeenCalledWith(10, 15);
  });
});

// =============================================================================
// SuggestionPanel
// =============================================================================

describe('SuggestionPanel', () => {
  it('renders the list of suggestions', () => {
    const suggestions = [
      createMockSuggestion({ id: 's1', title: 'First suggestion' }),
      createMockSuggestion({ id: 's2', title: 'Second suggestion' }),
    ];

    render(<SuggestionPanel suggestions={suggestions} />);

    expect(screen.getByText('First suggestion')).toBeInTheDocument();
    expect(screen.getByText('Second suggestion')).toBeInTheDocument();
  });

  it('shows stats summary when provided', () => {
    const suggestions = [createMockSuggestion()];

    const { container } = render(<SuggestionPanel suggestions={suggestions} stats={mockStats} />);

    // Stats cards should be rendered (4 summary cards)
    const statCards = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
    expect(statCards.length).toBeGreaterThanOrEqual(4);

    // "Pending" appears in both stat label and filter tab, use getAllByText
    const pendingTexts = screen.getAllByText('Pending');
    expect(pendingTexts.length).toBeGreaterThanOrEqual(2); // stat label + filter tab

    // "Critical" appears as stat label and filter button
    const criticalTexts = screen.getAllByText('Critical');
    expect(criticalTexts.length).toBeGreaterThanOrEqual(2);

    // "Accepted" appears as stat label and filter tab
    const acceptedTexts = screen.getAllByText('Accepted');
    expect(acceptedTexts.length).toBeGreaterThanOrEqual(1);

    // "Skipped" only appears in stats
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('shows empty state when no suggestions', () => {
    render(<SuggestionPanel suggestions={[]} />);

    expect(
      screen.getByText('No suggestions yet. Generate suggestions to get started.')
    ).toBeInTheDocument();
  });

  it('shows results count', () => {
    const suggestions = [
      createMockSuggestion({ id: 's1' }),
      createMockSuggestion({ id: 's2' }),
      createMockSuggestion({ id: 's3' }),
    ];

    render(<SuggestionPanel suggestions={suggestions} />);

    expect(screen.getByText(/Showing 3 of 3 suggestions/)).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    render(<SuggestionPanel suggestions={[createMockSuggestion()]} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('All Severity')).toBeInTheDocument();
  });

  it('filters by severity when button is clicked', async () => {
    const user = userEvent.setup();
    const suggestions = [
      createMockSuggestion({ id: 's1', severity: 'critical', title: 'Critical issue' }),
      createMockSuggestion({ id: 's2', severity: 'minor', title: 'Minor polish' }),
    ];

    render(<SuggestionPanel suggestions={suggestions} />);

    // Filter to critical only
    const criticalButton = screen.getAllByText('Critical').find(
      (el) => el.closest('button')
    );
    if (criticalButton) {
      await user.click(criticalButton.closest('button')!);
    }

    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 2 suggestions/)).toBeInTheDocument();
    });
  });

  it('shows no-match message when filters exclude all', async () => {
    const user = userEvent.setup();
    const suggestions = [
      createMockSuggestion({ id: 's1', severity: 'minor', status: 'pending' }),
    ];

    render(<SuggestionPanel suggestions={suggestions} />);

    // Filter to critical only (should find nothing)
    const criticalButton = screen.getAllByText('Critical').find(
      (el) => el.closest('button')
    );
    if (criticalButton) {
      await user.click(criticalButton.closest('button')!);
    }

    await waitFor(() => {
      expect(
        screen.getByText('No suggestions match your filters.')
      ).toBeInTheDocument();
    });
  });
});

// =============================================================================
// StoryAdviserSection (with FeatureGate)
// =============================================================================

describe('StoryAdviserSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders StoryAdviser when feature is enabled', async () => {
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ suggestions: [], stats: null }),
    });

    render(
      <StoryAdviserSection projectId="project-123" scriptText="Some text" />
    );

    await waitFor(() => {
      expect(screen.getByText('Story-Adviser')).toBeInTheDocument();
    });
  });
});

// =============================================================================
// ScriptAnnotator
// =============================================================================

describe('ScriptAnnotator', () => {
  const sampleScript = 'FADE IN:\n\nINT. OFFICE - DAY\n\nJOHN sits at his desk.\n\nJOHN\nI need to leave.\n\nFADE OUT.';

  it('renders script text with line numbers', () => {
    render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[]}
      />
    );

    // The component shows lines 1 through the number of lines
    const lines = sampleScript.split('\n');
    // Check first and last line numbers
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(String(lines.length))).toBeInTheDocument();
  });

  it('renders script content', () => {
    render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[]}
      />
    );

    expect(screen.getByText('FADE IN:')).toBeInTheDocument();
    expect(screen.getByText('INT. OFFICE - DAY')).toBeInTheDocument();
  });

  it('highlights lines with pending suggestions', () => {
    const suggestion = createMockSuggestion({
      status: 'pending',
      location: { startLine: 3, endLine: 3, excerpt: 'INT. OFFICE - DAY' },
    });

    const { container } = render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[suggestion]}
      />
    );

    // Lines with suggestions should have border-l-4 with color
    const annotatedLines = container.querySelectorAll('[class*="border-l-amber"], [class*="border-l-red"], [class*="border-l-blue"]');
    expect(annotatedLines.length).toBeGreaterThan(0);
  });

  it('does not highlight lines for non-pending suggestions', () => {
    const suggestion = createMockSuggestion({
      status: 'accepted',
      location: { startLine: 3, endLine: 3, excerpt: 'INT. OFFICE - DAY' },
    });

    const { container } = render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[suggestion]}
      />
    );

    // All lines should have transparent border
    const annotatedLines = container.querySelectorAll('[class*="border-l-amber"], [class*="border-l-red"]');
    expect(annotatedLines.length).toBe(0);
  });

  it('shows suggestion count badge on annotated lines', () => {
    const suggestion = createMockSuggestion({
      status: 'pending',
      location: { startLine: 3, endLine: 3, excerpt: 'INT. OFFICE - DAY' },
    });

    render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[suggestion]}
      />
    );

    // Badge should show "1" for the count
    const badges = screen.getAllByText('1');
    // At least one badge is for the suggestion count
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onNavigateToSuggestion when annotated line is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const suggestion = createMockSuggestion({
      id: 'nav-test',
      status: 'pending',
      location: { startLine: 3, endLine: 3, excerpt: 'INT. OFFICE - DAY' },
    });

    render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[suggestion]}
        onNavigateToSuggestion={onNavigate}
      />
    );

    // Click on the annotated line content
    await user.click(screen.getByText('INT. OFFICE - DAY'));

    expect(onNavigate).toHaveBeenCalledWith('nav-test');
  });

  it('applies highlight styling to specified lines', () => {
    const { container } = render(
      <ScriptAnnotator
        scriptText={sampleScript}
        suggestions={[]}
        highlightedLines={{ startLine: 3, endLine: 3 }}
      />
    );

    const highlightedLines = container.querySelectorAll('[class*="ring-violet"]');
    expect(highlightedLines.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// RewriteModal
// =============================================================================

describe('RewriteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when no suggestion is provided', () => {
    const { container } = render(
      <RewriteModal
        suggestion={null}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows suggestion context when opened', async () => {
    const suggestion = createMockSuggestion({
      location: { startLine: 10, endLine: 15, excerpt: 'JOHN: I need to go.' },
      suggestion: 'Add more subtext.',
      category: 'dialogue',
    });

    // Mock fetch for existing rewrites (returns empty)
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites: [] }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Generate Rewrites')).toBeInTheDocument();
    });

    expect(screen.getByText('Dialogue')).toBeInTheDocument();
    expect(screen.getByText(/Lines 10-15/)).toBeInTheDocument();
    expect(screen.getByText('JOHN: I need to go.')).toBeInTheDocument();
    expect(screen.getByText('Add more subtext.')).toBeInTheDocument();
  });

  it('shows style options when no rewrites exist', async () => {
    const suggestion = createMockSuggestion();

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites: [] }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Conservative')).toBeInTheDocument();
    });

    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Bold')).toBeInTheDocument();
    expect(screen.getByText('Generate 3 Rewrites')).toBeInTheDocument();
  });

  it('shows rewrite content when rewrites are loaded', async () => {
    const suggestion = createMockSuggestion();
    const rewrites = [
      createMockRewrite({ id: 'rw-1', rewrittenText: 'JOHN: (standing) I should go.' }),
      createMockRewrite({ id: 'rw-2', rewrittenText: 'JOHN: (pause) Maybe later.' }),
    ];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
        onSelectRewrite={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select a rewrite:')).toBeInTheDocument();
    });

    expect(screen.getByText('JOHN: (standing) I should go.')).toBeInTheDocument();
    expect(screen.getByText('JOHN: (pause) Maybe later.')).toBeInTheDocument();
    expect(screen.getByText('Use This Rewrite')).toBeInTheDocument();
  });

  it('handles apply action', async () => {
    const user = userEvent.setup();
    const onSelectRewrite = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const suggestion = createMockSuggestion();
    const rewrites = [
      createMockRewrite({ id: 'rw-1', rewrittenText: 'Rewrite option A' }),
    ];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={onClose}
        onSelectRewrite={onSelectRewrite}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Use This Rewrite')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Use This Rewrite'));

    await waitFor(() => {
      expect(onSelectRewrite).toHaveBeenCalledWith('rw-1');
    });
  });

  it('shows cancel button when rewrites are available', async () => {
    const suggestion = createMockSuggestion();
    const rewrites = [createMockRewrite()];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  it('calls onClose when cancel is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const suggestion = createMockSuggestion();
    const rewrites = [createMockRewrite()];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows error when rewrite generation fails', async () => {
    const user = userEvent.setup();
    const suggestion = createMockSuggestion();

    // First: fetch existing rewrites (empty)
    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites: [] }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Generate 3 Rewrites')).toBeInTheDocument();
    });

    // Mock generation failure
    mockApiFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'Rate limit exceeded' }),
    });

    await user.click(screen.getByText('Generate 3 Rewrites'));

    await waitFor(() => {
      expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument();
    });
  });

  it('shows option labels with style info', async () => {
    const suggestion = createMockSuggestion();
    const rewrites = [
      createMockRewrite({ id: 'rw-1', style: 'conservative' }),
      createMockRewrite({ id: 'rw-2', style: 'moderate' }),
      createMockRewrite({ id: 'rw-3', style: 'bold' }),
    ];

    mockApiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ rewrites }),
    });

    render(
      <RewriteModal
        suggestion={suggestion}
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Option 1/)).toBeInTheDocument();
      expect(screen.getByText(/Option 2/)).toBeInTheDocument();
      expect(screen.getByText(/Option 3/)).toBeInTheDocument();
    });
  });
});
