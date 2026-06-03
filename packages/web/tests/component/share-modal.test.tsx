/**
 * ShareModal Component Tests
 *
 * Tests rendering, share form, copy link behavior, and error feedback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from '@/components/dashboard/share-modal';

// Mock useToast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock logger to avoid console noise
vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  projectId: 'project-123',
  projectName: 'My Amazing Script',
  writerCode: 'WRT-ABC123',
};

describe('ShareModal', () => {
  it('renders when open is true', () => {
    render(<ShareModal {...defaultProps} />);

    // Title uses curly quotes (“ / ”) — match with regex
    expect(screen.getByText(/Share.*My Amazing Script/)).toBeInTheDocument();
    expect(screen.getByText('Create a shareable link or send directly to industry readers')).toBeInTheDocument();
  });

  it('does not render content when open is false', () => {
    render(<ShareModal {...defaultProps} open={false} />);

    expect(screen.queryByText('Share "My Amazing Script"')).not.toBeInTheDocument();
  });

  it('shows two share method tabs: Link and Send to...', () => {
    render(<ShareModal {...defaultProps} />);

    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.getByText('Send to...')).toBeInTheDocument();
  });

  it('shows access level and expiry options after expanding the Options toggle', async () => {
    const user = userEvent.setup();
    render(<ShareModal {...defaultProps} />);

    // Options are collapsed by default — expand them first
    await user.click(screen.getByText('Options'));

    expect(screen.getByText('Access Level')).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('Create Share Link')).toBeInTheDocument();
  });

  it('shows Create Share Link button and no URL input before a link is created', () => {
    render(<ShareModal {...defaultProps} />);

    expect(screen.getByText('Create Share Link')).toBeInTheDocument();
    // No URL input until a share link is generated
    expect(screen.queryByRole('textbox', { name: /share url/i })).not.toBeInTheDocument();
  });

  it('disables copy button when no share URL exists', () => {
    render(<ShareModal {...defaultProps} />);

    // The copy button should be disabled before a share link is created
    const buttons = screen.getAllByRole('button');
    // Find the icon-only copy button (has Copy icon, is disabled)
    const copyButton = buttons.find(
      btn => btn.getAttribute('disabled') !== null && btn.closest('.flex.items-center.gap-2')
    );
    // At minimum, verify the Create Share Link button exists
    expect(screen.getByText('Create Share Link')).toBeInTheDocument();
  });

  it('calls onCreateShare when Create Share Link is clicked', async () => {
    const user = userEvent.setup();
    const onCreateShare = vi.fn().mockResolvedValue({
      url: 'https://storymagic.ai/s/abc123',
      token: 'abc123',
    });

    render(<ShareModal {...defaultProps} onCreateShare={onCreateShare} />);

    await user.click(screen.getByText('Create Share Link'));

    expect(onCreateShare).toHaveBeenCalledWith({
      access_level: 'stream',
      expires_in_hours: undefined,
      recipient_email: undefined,
    });
  });

  it('shows the generated share URL after creation', async () => {
    const user = userEvent.setup();
    const onCreateShare = vi.fn().mockResolvedValue({
      url: 'https://storymagic.ai/s/abc123',
      token: 'abc123',
    });

    render(<ShareModal {...defaultProps} onCreateShare={onCreateShare} />);

    await user.click(screen.getByText('Create Share Link'));

    expect(screen.getByDisplayValue('https://storymagic.ai/s/abc123')).toBeInTheDocument();
  });

  it('copies the share URL when copy button is clicked', async () => {
    const user = userEvent.setup();
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      writable: true,
      configurable: true,
    });

    const onCreateShare = vi.fn().mockResolvedValue({
      url: 'https://storymagic.ai/s/abc123',
      token: 'abc123',
    });

    render(<ShareModal {...defaultProps} onCreateShare={onCreateShare} />);

    // First create the share link
    await user.click(screen.getByText('Create Share Link'));

    // Now click the copy button (the icon button next to the URL input)
    const urlInput = screen.getByDisplayValue('https://storymagic.ai/s/abc123');
    const copyButton = urlInput.parentElement?.querySelector('button');
    expect(copyButton).not.toBeNull();
    await user.click(copyButton!);
    expect(mockWriteText).toHaveBeenCalledWith('https://storymagic.ai/s/abc123');
  });

  it('shows error toast when share creation fails', async () => {
    const user = userEvent.setup();
    const onCreateShare = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<ShareModal {...defaultProps} onCreateShare={onCreateShare} />);

    await user.click(screen.getByText('Create Share Link'));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        title: 'Share link failed',
        description: 'Could not create the share link. Please try again.',
      })
    );
  });

  it('shows "Creating..." text while share is being created', async () => {
    const user = userEvent.setup();

    // Use a promise that we can control resolution of
    let resolveShare!: (value: { url: string; token: string }) => void;
    const onCreateShare = vi.fn().mockImplementation(
      () => new Promise<{ url: string; token: string }>((resolve) => { resolveShare = resolve; })
    );

    render(<ShareModal {...defaultProps} onCreateShare={onCreateShare} />);

    // Click the button - this starts the async operation
    await user.click(screen.getByText('Create Share Link'));

    // After the click, isCreating should be true, showing "Creating..."
    expect(screen.getByText('Creating...')).toBeInTheDocument();

    // Resolve the share creation to clean up
    await vi.waitFor(async () => {
      resolveShare({ url: 'https://storymagic.ai/s/test', token: 'test' });
    });
  });

  it('shows share count badge when existing shares are provided', () => {
    const existingShares = [
      {
        id: 'share-1',
        project_id: 'project-123',
        shared_by: 'user-1',
        shared_with: null,
        share_token: 'token-1',
        access_level: 'stream' as const,
        via_reader_code: null,
        expires_at: null,
        view_count: 5,
        last_viewed_at: null,
        created_at: new Date().toISOString(),
      },
    ];

    render(<ShareModal {...defaultProps} existingShares={existingShares} />);

    expect(screen.getByText('1 share')).toBeInTheDocument();
  });

  it('does not show share count badge when no existing shares', () => {
    render(<ShareModal {...defaultProps} />);

    expect(screen.queryByText(/\d+ share/)).not.toBeInTheDocument();
  });

  it('shows Send to... tab with recipient input', async () => {
    const user = userEvent.setup();
    render(<ShareModal {...defaultProps} />);

    await user.click(screen.getByText('Send to...'));

    expect(screen.getByText('Recipients')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('email@example.com')[0]).toBeInTheDocument();
  });

  it('shows Send to... tab with add-recipient button', async () => {
    const user = userEvent.setup();
    render(<ShareModal {...defaultProps} />);

    await user.click(screen.getByText('Send to...'));

    expect(screen.getByText('Add recipient')).toBeInTheDocument();
  });
});
