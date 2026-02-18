/**
 * WriterDashboardClient Component Tests
 *
 * Tests rendering, stats display, empty states, script list, and interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WriterDashboardClient } from '@/components/dashboard/writer-dashboard-client';
import type { WriterScriptSummary, Subscription, SubscriptionLimits } from '@/lib/types/marketplace';

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock child components to isolate unit behavior
vi.mock('@/components/dashboard/subscription-card', () => ({
  SubscriptionCard: ({ subscription, onUpgrade, onManage }: {
    subscription: unknown;
    limits: unknown;
    onUpgrade: () => void;
    onManage: () => void;
  }) => (
    <div data-testid="subscription-card">
      <button onClick={onUpgrade}>Upgrade</button>
      <button onClick={onManage}>Manage</button>
    </div>
  ),
}));

vi.mock('@/components/dashboard/writer-script-card', () => ({
  WriterScriptCard: ({ script, onShare, onGenerate, onDelete, onViewAnalytics }: {
    script: WriterScriptSummary;
    onShare?: () => void;
    onGenerate?: () => void;
    onDelete?: () => void;
    onViewAnalytics?: () => void;
  }) => (
    <div data-testid={`script-card-${script.project_id}`}>
      <span>{script.name}</span>
      {onShare && <button onClick={onShare}>Share</button>}
      {onGenerate && <button onClick={onGenerate}>Generate</button>}
      {onDelete && <button onClick={onDelete}>Delete</button>}
      {onViewAnalytics && <button onClick={onViewAnalytics}>Analytics</button>}
    </div>
  ),
}));

vi.mock('@/components/dashboard/share-modal', () => ({
  ShareModal: ({ open, projectName }: { open: boolean; projectName: string; onOpenChange: (v: boolean) => void; projectId: string; writerCode: string }) =>
    open ? <div data-testid="share-modal">Sharing: {projectName}</div> : null,
}));

// Mock apiFetch
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: vi.fn(),
}));

const mockScript: WriterScriptSummary = {
  project_id: 'project-123',
  name: 'The Great Screenplay',
  status: 'completed',
  page_count: 110,
  created_at: new Date().toISOString(),
  share_count: 3,
  reader_count: 2,
  total_views: 15,
  audio_generated: true,
};

const mockScript2: WriterScriptSummary = {
  project_id: 'project-456',
  name: 'Another Script',
  status: 'draft',
  page_count: 50,
  created_at: new Date().toISOString(),
  share_count: 0,
  reader_count: 0,
  total_views: 0,
  audio_generated: false,
};

const mockSubscription: Subscription = {
  id: 'sub-1',
  user_id: 'user-1',
  plan: 'writer_pro',
  status: 'active',
  stripe_customer_id: null,
  stripe_subscription_id: null,
  stripe_price_id: null,
  current_period_start: null,
  current_period_end: null,
  cancel_at_period_end: false,
  generations_used: 3,
  generations_limit: 15,
  downloads_used: 1,
  downloads_limit: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockLimits: SubscriptionLimits = {
  generations_remaining: 12,
  generations_limit: 15,
  downloads_remaining: 4,
  downloads_limit: 5,
  period_ends: null,
};

const defaultProps = {
  scripts: [mockScript, mockScript2],
  subscription: mockSubscription,
  limits: mockLimits,
  writerCode: 'WRT-ABC123',
  stats: {
    totalScripts: 2,
    totalShares: 3,
    totalReaders: 2,
    totalViews: 15,
  },
};

describe('WriterDashboardClient', () => {
  it('renders without crashing', () => {
    render(<WriterDashboardClient {...defaultProps} />);
    expect(screen.getByText('WRT-ABC123')).toBeInTheDocument();
  });

  it('displays the stats row with correct counts', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('Scripts')).toBeInTheDocument();
    expect(screen.getByText('Shares')).toBeInTheDocument();
    expect(screen.getByText('Readers')).toBeInTheDocument();
    expect(screen.getByText('Total Views')).toBeInTheDocument();

    // Verify all stat labels are present with their expected values nearby
    const scriptsLabel = screen.getByText('Scripts');
    expect(scriptsLabel.parentElement?.querySelector('.text-2xl')).toHaveTextContent('2');

    const viewsLabel = screen.getByText('Total Views');
    expect(viewsLabel.parentElement?.querySelector('.text-2xl')).toHaveTextContent('15');
  });

  it('displays the writer code prominently', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('WRT-ABC123')).toBeInTheDocument();
    expect(screen.getByText('Your Writer Code')).toBeInTheDocument();
    expect(screen.getByText('Share this code with agents and producers')).toBeInTheDocument();
  });

  it('shows the projects list when scripts are provided', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('My Scripts')).toBeInTheDocument();
    expect(screen.getByTestId('script-card-project-123')).toBeInTheDocument();
    expect(screen.getByTestId('script-card-project-456')).toBeInTheDocument();
    expect(screen.getByText('The Great Screenplay')).toBeInTheDocument();
    expect(screen.getByText('Another Script')).toBeInTheDocument();
  });

  it('shows empty state when no scripts', () => {
    render(
      <WriterDashboardClient
        {...defaultProps}
        scripts={[]}
        stats={{ totalScripts: 0, totalShares: 0, totalReaders: 0, totalViews: 0 }}
      />
    );

    expect(screen.getByText('No scripts yet')).toBeInTheDocument();
    expect(screen.getByText('Upload your first screenplay to get started')).toBeInTheDocument();
  });

  it('has Upload Script button linking to /projects/new', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    // There is an "Upload Script" link in the header area
    const uploadLinks = screen.getAllByText('Upload Script');
    expect(uploadLinks.length).toBeGreaterThan(0);

    // At least one should link to /projects/new
    const linkElements = uploadLinks.map(el => el.closest('a')).filter(Boolean);
    expect(linkElements.some(link => link?.getAttribute('href') === '/projects/new')).toBe(true);
  });

  it('shows Upload Script button in empty state linking to /projects/new', () => {
    render(
      <WriterDashboardClient
        {...defaultProps}
        scripts={[]}
        stats={{ totalScripts: 0, totalShares: 0, totalReaders: 0, totalViews: 0 }}
      />
    );

    const uploadLinks = screen.getAllByText('Upload Script');
    const linkElements = uploadLinks.map(el => el.closest('a')).filter(Boolean);
    expect(linkElements.some(link => link?.getAttribute('href') === '/projects/new')).toBe(true);
  });

  it('renders the subscription card', () => {
    render(<WriterDashboardClient {...defaultProps} />);
    expect(screen.getByTestId('subscription-card')).toBeInTheDocument();
  });

  it('renders the Getting Started tips section', () => {
    render(<WriterDashboardClient {...defaultProps} />);

    expect(screen.getByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByText('Upload your script')).toBeInTheDocument();
    expect(screen.getByText('Generate audio')).toBeInTheDocument();
    expect(screen.getByText('Share with industry')).toBeInTheDocument();
  });

  it('copies the shareable link when Copy Link is clicked', async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    render(<WriterDashboardClient {...defaultProps} />);

    await user.click(screen.getByText('Copy Link'));

    expect(mockWriteText).toHaveBeenCalledWith('http://localhost:22000/w/WRT-ABC123');
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Link copied!' })
    );
  });

  it('shows error toast when clipboard copy fails', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('fail')) },
      writable: true,
      configurable: true,
    });

    render(<WriterDashboardClient {...defaultProps} />);

    await user.click(screen.getByText('Copy Link'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Failed to copy', variant: 'destructive' })
    );
  });

  it('opens the share modal when Share is clicked on a script card', async () => {
    const user = userEvent.setup();

    render(<WriterDashboardClient {...defaultProps} />);

    // Initially no share modal
    expect(screen.queryByTestId('share-modal')).not.toBeInTheDocument();

    // Click Share on the first script card
    const scriptCard = screen.getByTestId('script-card-project-123');
    await user.click(within(scriptCard).getByText('Share'));

    expect(screen.getByTestId('share-modal')).toBeInTheDocument();
    expect(screen.getByText('Sharing: The Great Screenplay')).toBeInTheDocument();
  });
});
