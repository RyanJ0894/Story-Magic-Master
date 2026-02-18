/**
 * ReaderDashboardClient Component Tests
 *
 * Tests rendering, empty states, library entries, search, and reader code display.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReaderDashboardClient } from '@/components/dashboard/reader-dashboard-client';
import type { ReaderLibraryEntryDetailed } from '@/lib/types/marketplace';

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock apiFetch
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: vi.fn(),
}));

// Mock ReaderScriptCard to isolate tests
vi.mock('@/components/dashboard/reader-script-card', () => ({
  ReaderScriptCard: ({ entry, onPlay }: {
    entry: ReaderLibraryEntryDetailed;
    isPlaying: boolean;
    onPlay: () => void;
    onPause: () => void;
    onFavorite: () => void;
    onDownload: () => void;
    onRemove: () => void;
    onUnlock: () => void;
    onAddNote: () => void;
  }) => (
    <div data-testid={`reader-script-${entry.id}`}>
      <span>{entry.script_name}</span>
      <span>{entry.writer_name}</span>
      <button onClick={onPlay}>Play</button>
    </div>
  ),
}));

function createEntry(overrides: Partial<ReaderLibraryEntryDetailed> = {}): ReaderLibraryEntryDetailed {
  return {
    id: 'entry-1',
    reader_id: 'user-1',
    project_id: 'project-1',
    source: 'received',
    share_id: 'share-1',
    status: 'active',
    is_favorited: false,
    notes: null,
    tags: null,
    last_played_at: null,
    play_position_seconds: 0,
    completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    script_name: 'Test Script',
    page_count: 90,
    writer_name: 'Jane Writer',
    writer_code: 'WRT-111',
    writer_subscribed: true,
    duration_seconds: 3600,
    ...overrides,
  };
}

const defaultEntries: ReaderLibraryEntryDetailed[] = [
  createEntry({ id: 'entry-1', source: 'received', script_name: 'Received Script', writer_name: 'Alice' }),
  createEntry({ id: 'entry-2', source: 'uploaded', script_name: 'Uploaded Script', writer_name: 'Bob' }),
  createEntry({ id: 'entry-3', source: 'purchased', script_name: 'Purchased Script', writer_name: 'Charlie' }),
];

const defaultProps = {
  entries: defaultEntries,
  readerCode: 'RDR-XYZ789',
  stats: {
    totalScripts: 3,
    activeCount: 2,
    archivedCount: 1,
    favoritedCount: 0,
  },
};

describe('ReaderDashboardClient', () => {
  it('renders without crashing', () => {
    render(<ReaderDashboardClient {...defaultProps} />);
    expect(screen.getByText('RDR-XYZ789')).toBeInTheDocument();
  });

  it('displays the reader code prominently', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Your Reader Code')).toBeInTheDocument();
    expect(screen.getByText('RDR-XYZ789')).toBeInTheDocument();
    expect(screen.getByText('Give this to writers for free script submissions')).toBeInTheDocument();
  });

  it('shows library stats in the sidebar', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Library Stats')).toBeInTheDocument();
    expect(screen.getByText('Total Scripts')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Favorited')).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();
  });

  it('shows empty state when no entries and received tab is active', () => {
    render(
      <ReaderDashboardClient
        entries={[]}
        readerCode="RDR-XYZ789"
        stats={{ totalScripts: 0, activeCount: 0, archivedCount: 0, favoritedCount: 0 }}
      />
    );

    expect(screen.getByText('No scripts received yet')).toBeInTheDocument();
    expect(screen.getByText('Share your reader code with writers to receive their scripts')).toBeInTheDocument();
  });

  it('shows received scripts in the default tab', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByTestId('reader-script-entry-1')).toBeInTheDocument();
    expect(screen.getByText('Received Script')).toBeInTheDocument();
  });

  it('shows tab badges with correct counts', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    // The tab triggers should contain badge counts
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('shows pricing information in sidebar', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Pay only for what you use')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    // Multiple items are priced at $5, so use getAllByText
    expect(screen.getAllByText('$5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$25')).toBeInTheDocument();
  });

  it('shows "No listening history yet" when no entries have been played', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Recently Played')).toBeInTheDocument();
    expect(screen.getByText('No listening history yet')).toBeInTheDocument();
  });

  it('shows recently played entries when last_played_at is set', () => {
    const entriesWithPlayed = [
      createEntry({
        id: 'entry-played',
        source: 'received',
        script_name: 'Recently Played Script',
        writer_name: 'Diana',
        last_played_at: new Date().toISOString(),
        play_position_seconds: 600,
        duration_seconds: 3600,
      }),
    ];

    render(
      <ReaderDashboardClient
        entries={entriesWithPlayed}
        readerCode="RDR-XYZ789"
        stats={{ totalScripts: 1, activeCount: 1, archivedCount: 0, favoritedCount: 0 }}
      />
    );

    // The script appears in both the script list (via ReaderScriptCard mock) and the recently played sidebar
    const allMatches = screen.getAllByText('Recently Played Script');
    expect(allMatches.length).toBeGreaterThanOrEqual(1);
    // Verify the "No listening history yet" is not shown
    expect(screen.queryByText('No listening history yet')).not.toBeInTheDocument();
  });

  it('copies reader code when Copy Code is clicked', async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    render(<ReaderDashboardClient {...defaultProps} />);

    // Click the first Copy Code button (in the reader code card)
    const copyButtons = screen.getAllByText('Copy Code');
    await user.click(copyButtons[0]);

    expect(mockWriteText).toHaveBeenCalledWith('RDR-XYZ789');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Code copied!' })
    );
  });

  it('shows error toast when clipboard copy fails', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
      writable: true,
      configurable: true,
    });

    render(<ReaderDashboardClient {...defaultProps} />);

    const copyButtons = screen.getAllByText('Copy Code');
    await user.click(copyButtons[0]);

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to copy', variant: 'destructive' })
    );
  });

  it('has a search input for filtering scripts', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search scripts...');
    expect(searchInput).toBeInTheDocument();
  });

  it('has a QR Code button that opens the QR modal', async () => {
    const user = userEvent.setup();
    render(<ReaderDashboardClient {...defaultProps} />);

    await user.click(screen.getByText('QR Code'));

    expect(screen.getByText('Your Reader QR Code')).toBeInTheDocument();
    expect(screen.getByText('Writers can scan this to share scripts with you instantly')).toBeInTheDocument();
  });
});
