/**
 * Dashboard Component Tests (TD-042)
 *
 * Tests for remaining dashboard components:
 * - WriterDashboardClient
 * - ReaderDashboardClient
 * - ReaderScriptCard
 * - ShareModal
 * - SubscriptionCard
 *
 * WriterScriptCard is already tested in writer-script-card.test.tsx
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  WriterScriptSummary,
  Subscription,
  SubscriptionLimits,
  ReaderLibraryEntryDetailed,
  ScriptShare,
} from '@/lib/types/marketplace';

// =============================================================================
// Mocks
// =============================================================================

const mockApiFetch = vi.fn();
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Import components after mocks
import { WriterDashboardClient } from '@/components/dashboard/writer-dashboard-client';
import { ReaderDashboardClient } from '@/components/dashboard/reader-dashboard-client';
import { ReaderScriptCard, ReaderScriptCardCompact } from '@/components/dashboard/reader-script-card';
import { ShareModal } from '@/components/dashboard/share-modal';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';

// =============================================================================
// Test Fixtures
// =============================================================================

function createWriterScript(overrides: Partial<WriterScriptSummary> = {}): WriterScriptSummary {
  return {
    project_id: 'project-123',
    name: 'The Great Screenplay',
    status: 'completed',
    page_count: 110,
    created_at: new Date().toISOString(),
    share_count: 3,
    reader_count: 2,
    total_views: 15,
    audio_generated: true,
    ...overrides,
  };
}

function createSubscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub-123',
    user_id: 'user-123',
    plan: 'writer_pro',
    status: 'active',
    stripe_customer_id: 'cus_123',
    stripe_subscription_id: 'sub_123',
    stripe_price_id: 'price_123',
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    cancel_at_period_end: false,
    generations_used: 3,
    generations_limit: 15,
    downloads_used: 1,
    downloads_limit: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function createLimits(overrides: Partial<SubscriptionLimits> = {}): SubscriptionLimits {
  return {
    generations_remaining: 12,
    generations_limit: 15,
    downloads_remaining: 4,
    downloads_limit: 5,
    period_ends: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function createReaderEntry(overrides: Partial<ReaderLibraryEntryDetailed> = {}): ReaderLibraryEntryDetailed {
  return {
    id: 'entry-123',
    reader_id: 'user-123',
    project_id: 'project-123',
    source: 'received',
    share_id: 'share-123',
    status: 'active',
    is_favorited: false,
    notes: null,
    tags: null,
    last_played_at: null,
    play_position_seconds: 0,
    completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    script_name: 'Test Screenplay',
    page_count: 95,
    writer_name: 'Jane Writer',
    writer_code: 'JW12345',
    writer_subscribed: true,
    duration_seconds: 5400,
    ...overrides,
  };
}

// =============================================================================
// SubscriptionCard
// =============================================================================

describe('SubscriptionCard', () => {
  it('renders no-subscription state with pricing', () => {
    render(
      <SubscriptionCard
        subscription={null}
        limits={createLimits({ generations_remaining: 0, generations_limit: 0, downloads_remaining: 0, downloads_limit: 0 })}
      />
    );

    expect(screen.getByText('No Active Subscription')).toBeInTheDocument();
    expect(screen.getByText('Subscribe Now')).toBeInTheDocument();
    expect(screen.getByText('Basic')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });

  it('renders active subscription with plan name', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ plan: 'writer_pro' })}
        limits={createLimits()}
      />
    );

    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('shows generation usage progress', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits({ generations_remaining: 12, generations_limit: 15 })}
      />
    );

    expect(screen.getByText('Audio Generations')).toBeInTheDocument();
    expect(screen.getByText('3 / 15')).toBeInTheDocument();
  });

  it('shows download usage progress', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits({ downloads_remaining: 4, downloads_limit: 5 })}
      />
    );

    expect(screen.getByText('Downloads')).toBeInTheDocument();
    expect(screen.getByText('1 / 5')).toBeInTheDocument();
  });

  it('shows upgrade button for basic plan', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ plan: 'writer_basic' })}
        limits={createLimits()}
      />
    );

    expect(screen.getByText('Basic Plan')).toBeInTheDocument();
    // Button text includes icon, use role query
    const buttons = screen.getAllByRole('button');
    const upgradeBtn = buttons.find((b) => b.textContent?.includes('Upgrade to Pro'));
    expect(upgradeBtn).toBeTruthy();
  });

  it('does not show upgrade button for pro plan', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ plan: 'writer_pro' })}
        limits={createLimits()}
      />
    );

    expect(screen.queryByText('Upgrade to Pro')).not.toBeInTheDocument();
  });

  it('shows manage subscription button', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits()}
      />
    );

    expect(screen.getByText('Manage Subscription')).toBeInTheDocument();
  });

  it('calls onUpgrade when Subscribe Now is clicked', async () => {
    const user = userEvent.setup();
    const onUpgrade = vi.fn();

    render(
      <SubscriptionCard
        subscription={null}
        limits={createLimits({ generations_remaining: 0, generations_limit: 0, downloads_remaining: 0, downloads_limit: 0 })}
        onUpgrade={onUpgrade}
      />
    );

    await user.click(screen.getByText('Subscribe Now'));
    expect(onUpgrade).toHaveBeenCalled();
  });

  it('calls onManage when Manage Subscription is clicked', async () => {
    const user = userEvent.setup();
    const onManage = vi.fn();

    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits()}
        onManage={onManage}
      />
    );

    await user.click(screen.getByText('Manage Subscription'));
    expect(onManage).toHaveBeenCalled();
  });

  it('shows trial status badge for trialing subscription', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ status: 'trialing' })}
        limits={createLimits()}
      />
    );

    expect(screen.getByText('Trial')).toBeInTheDocument();
  });

  it('shows low generation warning', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits({ generations_remaining: 1 })}
      />
    );

    expect(screen.getByText('Only 1 generation remaining')).toBeInTheDocument();
  });

  it('shows zero generation warning', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription()}
        limits={createLimits({ generations_remaining: 0 })}
      />
    );

    expect(screen.getByText('No generations remaining this period')).toBeInTheDocument();
  });

  it('shows cancellation notice', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ cancel_at_period_end: true })}
        limits={createLimits()}
      />
    );

    expect(screen.getByText(/Cancels in/)).toBeInTheDocument();
  });

  it('shows renewal notice for active sub', () => {
    render(
      <SubscriptionCard
        subscription={createSubscription({ cancel_at_period_end: false })}
        limits={createLimits()}
      />
    );

    expect(screen.getByText(/Renews in/)).toBeInTheDocument();
  });
});

// =============================================================================
// ReaderScriptCard
// =============================================================================

describe('ReaderScriptCard', () => {
  it('renders script name and writer', () => {
    render(<ReaderScriptCard entry={createReaderEntry()} />);

    expect(screen.getByText('Test Screenplay')).toBeInTheDocument();
    expect(screen.getByText('Jane Writer')).toBeInTheDocument();
  });

  it('renders page count', () => {
    render(<ReaderScriptCard entry={createReaderEntry()} />);
    expect(screen.getByText(/95 pages/)).toBeInTheDocument();
  });

  it('shows play button for active entries', () => {
    render(<ReaderScriptCard entry={createReaderEntry()} />);

    const playButton = screen.getByLabelText('Play');
    expect(playButton).toBeInTheDocument();
  });

  it('calls onPlay when play button is clicked', async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn();

    render(<ReaderScriptCard entry={createReaderEntry()} onPlay={onPlay} />);

    await user.click(screen.getByLabelText('Play'));
    expect(onPlay).toHaveBeenCalled();
  });

  it('shows pause button when playing', () => {
    render(<ReaderScriptCard entry={createReaderEntry()} isPlaying={true} />);

    expect(screen.getByLabelText('Pause')).toBeInTheDocument();
  });

  it('calls onPause when pause button is clicked', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();

    render(
      <ReaderScriptCard entry={createReaderEntry()} isPlaying={true} onPause={onPause} />
    );

    await user.click(screen.getByLabelText('Pause'));
    expect(onPause).toHaveBeenCalled();
  });

  it('shows favorite button', () => {
    render(<ReaderScriptCard entry={createReaderEntry()} />);

    expect(screen.getByLabelText('Add to favorites')).toBeInTheDocument();
  });

  it('shows unfavorite button when favorited', () => {
    render(
      <ReaderScriptCard entry={createReaderEntry({ is_favorited: true })} />
    );

    expect(screen.getByLabelText('Remove from favorites')).toBeInTheDocument();
  });

  it('calls onFavorite when favorite button is clicked', async () => {
    const user = userEvent.setup();
    const onFavorite = vi.fn();

    render(<ReaderScriptCard entry={createReaderEntry()} onFavorite={onFavorite} />);

    await user.click(screen.getByLabelText('Add to favorites'));
    expect(onFavorite).toHaveBeenCalled();
  });

  it('shows archived state with unlock button', () => {
    render(
      <ReaderScriptCard entry={createReaderEntry({ status: 'archived' })} />
    );

    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('Unlock $5')).toBeInTheDocument();
  });

  it('shows unlock button for archived entries and calls onUnlock', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();

    render(
      <ReaderScriptCard
        entry={createReaderEntry({ status: 'archived' })}
        onUnlock={onUnlock}
      />
    );

    // The play area shows lock icon
    expect(screen.getByLabelText('Unlock script')).toBeInTheDocument();

    await user.click(screen.getByText('Unlock $5'));
    expect(onUnlock).toHaveBeenCalled();
  });

  it('shows progress bar when partially listened', () => {
    render(
      <ReaderScriptCard
        entry={createReaderEntry({
          play_position_seconds: 1800,
          duration_seconds: 5400,
        })}
      />
    );

    // Should show time formats
    expect(screen.getByText('30:00')).toBeInTheDocument(); // 1800 seconds
    expect(screen.getByText('1:30:00')).toBeInTheDocument(); // 5400 seconds
  });

  it('shows completed badge when finished', () => {
    render(
      <ReaderScriptCard
        entry={createReaderEntry({ completed: true })}
      />
    );

    expect(screen.getByText('Finished')).toBeInTheDocument();
  });

  it('shows owned badge for purchased entries', () => {
    render(
      <ReaderScriptCard
        entry={createReaderEntry({ source: 'purchased' })}
      />
    );

    expect(screen.getByText('Owned')).toBeInTheDocument();
  });

  it('shows notes preview when notes exist', () => {
    render(
      <ReaderScriptCard
        entry={createReaderEntry({ notes: 'Great opening sequence, needs work on Act 2.' })}
      />
    );

    expect(screen.getByText('Great opening sequence, needs work on Act 2.')).toBeInTheDocument();
  });

  it('shows archived message with unlock info', () => {
    render(
      <ReaderScriptCard entry={createReaderEntry({ status: 'archived' })} />
    );

    expect(
      screen.getByText(/Writer's subscription ended/)
    ).toBeInTheDocument();
  });
});

describe('ReaderScriptCardCompact', () => {
  it('renders script name and writer', () => {
    render(<ReaderScriptCardCompact entry={createReaderEntry()} />);

    expect(screen.getByText('Test Screenplay')).toBeInTheDocument();
    expect(screen.getByText('by Jane Writer')).toBeInTheDocument();
  });

  it('shows favorite star when favorited', () => {
    const { container } = render(
      <ReaderScriptCardCompact entry={createReaderEntry({ is_favorited: true })} />
    );

    // The star icon has fill-amber-500 class
    const stars = container.querySelectorAll('[class*="fill-amber"]');
    expect(stars.length).toBeGreaterThan(0);
  });

  it('shows lock icon for archived entries', () => {
    const { container } = render(
      <ReaderScriptCardCompact entry={createReaderEntry({ status: 'archived' })} />
    );

    expect(container.querySelector('[class*="opacity-60"]')).toBeInTheDocument();
  });
});

// =============================================================================
// ShareModal
// =============================================================================

describe('ShareModal', () => {
  it('renders modal with project name', () => {
    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    // Title uses curly quotes (" / ") — match with regex
    expect(screen.getByText(/Share.*My Screenplay/)).toBeInTheDocument();
  });

  it('renders tab navigation with Link and Send to...', () => {
    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.getByText('Send to...')).toBeInTheDocument();
  });

  it('shows access level and expiry controls after expanding Options', async () => {
    const user = userEvent.setup();
    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    // Options are collapsed by default — expand first
    await user.click(screen.getByText('Options'));

    expect(screen.getByText('Access Level')).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
  });

  it('shows create share link button', () => {
    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    expect(screen.getByText('Create Share Link')).toBeInTheDocument();
  });

  it('shows Create Share Link button before a link is created', () => {
    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    expect(screen.getByText('Create Share Link')).toBeInTheDocument();
  });

  it('calls onCreateShare when button clicked', async () => {
    const user = userEvent.setup();
    const onCreateShare = vi.fn().mockResolvedValue({
      url: 'https://storymagic.ai/s/abc123',
      token: 'abc123',
    });

    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
        onCreateShare={onCreateShare}
      />
    );

    await user.click(screen.getByText('Create Share Link'));

    expect(onCreateShare).toHaveBeenCalledWith(
      expect.objectContaining({
        access_level: 'stream',
      })
    );
  });

  it('shows share count badge when existing shares are provided', () => {
    const existingShares: ScriptShare[] = [
      {
        id: 'share-1',
        project_id: 'project-123',
        shared_by: 'user-123',
        shared_with: null,
        share_token: 'token-1',
        access_level: 'stream',
        via_reader_code: null,
        expires_at: null,
        view_count: 10,
        last_viewed_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
        existingShares={existingShares}
      />
    );

    expect(screen.getByText('1 share')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ShareModal
        open={false}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    expect(screen.queryByText('Share "My Screenplay"')).not.toBeInTheDocument();
  });

  it('renders Send to... tab with bulk share form', async () => {
    const user = userEvent.setup();

    render(
      <ShareModal
        open={true}
        onOpenChange={vi.fn()}
        projectId="project-123"
        projectName="My Screenplay"
        writerCode="ABC123"
      />
    );

    await user.click(screen.getByText('Send to...'));

    expect(screen.getByText('Recipients')).toBeInTheDocument();
    expect(screen.getByText('Add recipient')).toBeInTheDocument();
  });
});

// =============================================================================
// WriterDashboardClient
// =============================================================================

describe('WriterDashboardClient', () => {
  const defaultProps = {
    scripts: [createWriterScript()],
    subscription: createSubscription(),
    limits: createLimits(),
    writerCode: 'WR12345',
    stats: {
      totalScripts: 5,
      totalShares: 10,
      totalReaders: 8,
      totalViews: 50,
    },
  };

  it('renders without crashing', () => {
    render(<WriterDashboardClient {...defaultProps} />);
    expect(screen.getByText('WR12345')).toBeInTheDocument();
  });

  it('displays stats row with correct values', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Scripts')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Shares')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Readers')).toBeInTheDocument();
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('Total Views')).toBeInTheDocument();
  });

  it('renders the writer code card', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('Your Writer Code')).toBeInTheDocument();
    expect(screen.getByText('WR12345')).toBeInTheDocument();
    expect(screen.getByText('Copy Link')).toBeInTheDocument();
  });

  it('renders the scripts list header', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('My Scripts')).toBeInTheDocument();
    expect(screen.getByText('Upload Script')).toBeInTheDocument();
  });

  it('shows empty state when no scripts', () => {
    render(
      <WriterDashboardClient {...defaultProps} scripts={[]} />
    );

    expect(screen.getByText('No scripts yet')).toBeInTheDocument();
    expect(screen.getByText('Upload your first screenplay to get started')).toBeInTheDocument();
  });

  it('renders script cards for each script', () => {
    const scripts = [
      createWriterScript({ project_id: 'p1', name: 'Script One' }),
      createWriterScript({ project_id: 'p2', name: 'Script Two' }),
    ];

    render(<WriterDashboardClient {...defaultProps} scripts={scripts} />);

    expect(screen.getByText('Script One')).toBeInTheDocument();
    expect(screen.getByText('Script Two')).toBeInTheDocument();
  });

  it('renders subscription card in sidebar', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('Pro Plan')).toBeInTheDocument();
  });

  it('renders getting started tips', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Upload your script')).toBeInTheDocument();
  });
});

// =============================================================================
// ReaderDashboardClient
// =============================================================================

describe('ReaderDashboardClient', () => {
  const defaultProps = {
    entries: [
      createReaderEntry({ id: 'e1', source: 'received' as const }),
    ],
    readerCode: 'RD98765',
    stats: {
      totalScripts: 3,
      activeCount: 2,
      archivedCount: 0,
      favoritedCount: 1,
    },
  };

  it('renders without crashing', () => {
    render(<ReaderDashboardClient {...defaultProps} />);
    expect(screen.getByText('RD98765')).toBeInTheDocument();
  });

  it('renders the reader code card', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Your Reader Code')).toBeInTheDocument();
    expect(screen.getByText('RD98765')).toBeInTheDocument();
    expect(screen.getByText('Copy Code')).toBeInTheDocument();
    expect(screen.getByText('QR Code')).toBeInTheDocument();
  });

  it('renders library tabs', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('renders the search bar', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByPlaceholderText('Search scripts...')).toBeInTheDocument();
  });

  it('renders library stats in sidebar', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Library Stats')).toBeInTheDocument();
    expect(screen.getByText('Total Scripts')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Favorited')).toBeInTheDocument();
  });

  it('renders pricing info in sidebar', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Receive from writers')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('shows empty state for received tab when no entries', () => {
    render(
      <ReaderDashboardClient
        {...defaultProps}
        entries={[]}
      />
    );

    expect(screen.getByText('No scripts received yet')).toBeInTheDocument();
  });

  it('renders received scripts', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Test Screenplay')).toBeInTheDocument();
  });

  it('shows recently played section', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('Recently Played')).toBeInTheDocument();
  });

  it('shows no listening history message when nothing played', () => {
    render(<ReaderDashboardClient {...defaultProps} />);

    expect(screen.getByText('No listening history yet')).toBeInTheDocument();
  });

  it('shows recently played entries in sidebar', () => {
    const entries = [
      createReaderEntry({
        id: 'played-1',
        source: 'received',
        last_played_at: new Date().toISOString(),
        play_position_seconds: 300,
        duration_seconds: 3600,
        script_name: 'Playing Script',
      }),
    ];

    render(
      <ReaderDashboardClient
        {...defaultProps}
        entries={entries}
      />
    );

    // The recently played list shows the script name (appears twice: once in main list, once in recent)
    const playingScripts = screen.getAllByText('Playing Script');
    expect(playingScripts.length).toBeGreaterThanOrEqual(1);

    // Should show completion percentage
    expect(screen.getByText(/8% complete/)).toBeInTheDocument();
  });
});
