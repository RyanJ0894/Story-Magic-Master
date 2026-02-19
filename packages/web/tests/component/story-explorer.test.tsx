/**
 * Story Explorer Component Tests
 *
 * Tests for StoryExplorer and StoryExplorerSection components.
 * Mocks @xyflow/react since it requires ResizeObserver/canvas.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// =============================================================================
// Mocks
// =============================================================================

// Mock @xyflow/react
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="react-flow">{children}</div>
  ),
  MiniMap: () => <div data-testid="minimap" />,
  Controls: () => <div data-testid="controls" />,
  Background: () => <div data-testid="background" />,
  BackgroundVariant: { Dots: 'dots' },
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  BaseEdge: () => null,
  getStraightPath: () => ['M0,0 L100,100', 50, 50],
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Variable to control feature flag mock
let mockFeatureEnabled = true;
vi.mock('@/lib/features', () => ({
  isFeatureEnabled: () => mockFeatureEnabled,
  FeatureGate: ({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) =>
    mockFeatureEnabled ? <>{children}</> : <>{fallback}</>,
}));

// Import after mocks
import { StoryExplorer } from '@/components/story-explorer/StoryExplorer';
import { StoryExplorerSection } from '@/components/story-explorer/StoryExplorerSection';

const mockDirectorJson = {
  scenes: [
    {
      scene_id: 'scene-1',
      heading: 'INT. OFFICE - DAY',
      mood: 'tense',
      intensity: 7,
      dialogue: [
        { character: 'ALICE', text: 'Hello', age: 35, gender: 'female' },
        { character: 'BOB', text: 'Hi' },
      ],
      music: [{ track: 'cue' }],
      ambience: [],
      sfx: [],
    },
    {
      scene_id: 'scene-2',
      heading: 'EXT. PARK - NIGHT',
      mood: 'dark',
      dialogue: [{ character: 'BOB', text: 'Run!' }],
      music: [],
      ambience: [],
      sfx: [{ sound: 'gunshot' }],
    },
  ],
};

// =============================================================================
// StoryExplorer Tests
// =============================================================================

describe('StoryExplorer', () => {
  beforeEach(() => {
    mockFeatureEnabled = true;
  });

  it('renders graph with valid directorJson', () => {
    render(<StoryExplorer directorJson={mockDirectorJson} />);
    expect(screen.getByTestId('react-flow')).toBeDefined();
  });

  it('shows empty state with no scenes', () => {
    render(<StoryExplorer directorJson={{ scenes: [] }} />);
    expect(screen.getByText(/generate audio first/i)).toBeDefined();
  });

  it('Scene Flow tab is active by default', () => {
    render(<StoryExplorer directorJson={mockDirectorJson} />);
    const sceneTab = screen.getByRole('tab', { name: /scene flow/i });
    expect(sceneTab.getAttribute('aria-selected')).toBe('true');
  });

  it('Character Network tab is present', () => {
    render(<StoryExplorer directorJson={mockDirectorJson} />);
    expect(screen.getByRole('tab', { name: /character network/i })).toBeDefined();
  });

  it('tab switching works', async () => {
    const user = userEvent.setup();
    render(<StoryExplorer directorJson={mockDirectorJson} />);
    const charTab = screen.getByRole('tab', { name: /character network/i });
    await user.click(charTab);
    expect(charTab.getAttribute('aria-selected')).toBe('true');
  });
});

// =============================================================================
// StoryExplorerSection Tests
// =============================================================================

describe('StoryExplorerSection', () => {
  beforeEach(() => {
    mockFeatureEnabled = true;
  });

  it('shows placeholder when no directorJson', () => {
    render(<StoryExplorerSection directorJson={null} />);
    expect(screen.getByText(/generate audio to unlock/i)).toBeDefined();
  });

  it('renders graph when directorJson exists', () => {
    render(<StoryExplorerSection directorJson={mockDirectorJson} />);
    expect(screen.getByTestId('react-flow')).toBeDefined();
  });

  it('shows Coming Soon when feature flag is off', () => {
    mockFeatureEnabled = false;
    render(<StoryExplorerSection directorJson={mockDirectorJson} />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });

  it('renders section title', () => {
    render(<StoryExplorerSection directorJson={mockDirectorJson} />);
    expect(screen.getByText('Story Explorer')).toBeDefined();
  });
});
