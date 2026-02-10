/**
 * WriterScriptCard Component Tests
 *
 * Tests the project card rendering, status badges, actions, and stats.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WriterScriptCard, WriterScriptCardCompact } from '@/components/dashboard/writer-script-card';
import type { WriterScriptSummary } from '@/lib/types/marketplace';

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

const draftScript: WriterScriptSummary = {
  project_id: 'project-456',
  name: 'Work in Progress',
  status: 'draft',
  page_count: 30,
  created_at: new Date().toISOString(),
  share_count: 0,
  reader_count: 0,
  total_views: 0,
  audio_generated: false,
};

describe('WriterScriptCard', () => {
  it('renders the script name as a link', () => {
    render(<WriterScriptCard script={mockScript} />);

    const link = screen.getByText('The Great Screenplay');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/projects/project-123');
  });

  it('shows the page count', () => {
    render(<WriterScriptCard script={mockScript} />);
    expect(screen.getByText(/110 pages/)).toBeInTheDocument();
  });

  it('shows "Audio ready" for completed scripts with audio', () => {
    render(<WriterScriptCard script={mockScript} />);
    expect(screen.getByText(/Audio ready/)).toBeInTheDocument();
  });

  it('shows Ready status badge for completed scripts', () => {
    render(<WriterScriptCard script={mockScript} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows Draft status badge for draft scripts', () => {
    render(<WriterScriptCard script={draftScript} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows Share and Play buttons for scripts with audio', () => {
    render(<WriterScriptCard script={mockScript} />);

    expect(screen.getByText('Share')).toBeInTheDocument();
    expect(screen.getByText('Play')).toBeInTheDocument();
  });

  it('shows Generate Audio button for scripts without audio', () => {
    render(<WriterScriptCard script={draftScript} />);
    expect(screen.getByText('Generate Audio')).toBeInTheDocument();
  });

  it('calls onShare when Share button is clicked', async () => {
    const onShare = vi.fn();
    const user = userEvent.setup();

    render(<WriterScriptCard script={mockScript} onShare={onShare} />);
    await user.click(screen.getByText('Share'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('calls onGenerate when Generate Audio button is clicked', async () => {
    const onGenerate = vi.fn();
    const user = userEvent.setup();

    render(<WriterScriptCard script={draftScript} onGenerate={onGenerate} />);
    await user.click(screen.getByText('Generate Audio'));

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('shows stats row with reader, share, and view counts', () => {
    render(<WriterScriptCard script={mockScript} />);

    expect(screen.getByText('2 readers')).toBeInTheDocument();
    expect(screen.getByText('3 shares')).toBeInTheDocument();
    expect(screen.getByText('15 views')).toBeInTheDocument();
  });

  it('hides stats row for scripts without audio or engagement', () => {
    render(<WriterScriptCard script={draftScript} />);

    expect(screen.queryByText(/readers/)).not.toBeInTheDocument();
    expect(screen.queryByText(/shares/)).not.toBeInTheDocument();
    expect(screen.queryByText(/views/)).not.toBeInTheDocument();
  });
});

describe('WriterScriptCardCompact', () => {
  it('renders the script name as a link', () => {
    render(<WriterScriptCardCompact script={mockScript} />);

    const link = screen.getByText('The Great Screenplay');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/projects/project-123');
  });

  it('shows status badge', () => {
    render(<WriterScriptCardCompact script={mockScript} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows page count and reader count', () => {
    render(<WriterScriptCardCompact script={mockScript} />);
    expect(screen.getByText(/110p/)).toBeInTheDocument();
    expect(screen.getByText(/2 readers/)).toBeInTheDocument();
  });
});
