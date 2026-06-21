/**
 * ProjectReactionBar (item n) — Like / Pass / Undecided at the project level.
 *
 * Pins:
 *   - The component sends sceneIndex-less POSTs so the server treats it
 *     as project-level (per the 2026-06-21 upsert branch in comments/route.ts).
 *   - Only one reaction can be "active" at a time (visually + state-wise).
 *   - The compact ProjectReactionBadge renders nothing when reaction is null.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectReactionBar, ProjectReactionBadge } from '@/components/project/ProjectReactionBar';

vi.mock('@/lib/api/fetch', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { apiFetch } from '@/lib/api/fetch';

const mockApiFetch = apiFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectReactionBar', () => {
  it('renders three buttons and prompt copy in non-compact mode', () => {
    render(<ProjectReactionBar projectId="p1" />);
    expect(screen.getByText(/How do you feel about this script/i)).toBeInTheDocument();
    expect(screen.getByTestId('project-reaction-like')).toBeInTheDocument();
    expect(screen.getByTestId('project-reaction-dislike')).toBeInTheDocument();
    expect(screen.getByTestId('project-reaction-undecided')).toBeInTheDocument();
  });

  it('omits the prompt copy in compact mode', () => {
    render(<ProjectReactionBar projectId="p1" compact />);
    expect(screen.queryByText(/How do you feel about this script/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('project-reaction-like')).toBeInTheDocument();
  });

  it('sends POST without sceneIndex when Like is clicked (project-level)', async () => {
    // First call: the GET hydrate fired by the component's useEffect.
    // Second call: the POST under test.
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ comments: [] }) });
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    render(<ProjectReactionBar projectId="proj-1" />);

    fireEvent.click(screen.getByTestId('project-reaction-like'));

    // Component fires a GET on mount (hydrate) + a POST on click = 2 calls.
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalledTimes(2));
    const postCall = mockApiFetch.mock.calls.find(
      (c) => c[1]?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const [path, options] = postCall!;
    expect(path).toBe('/api/projects/proj-1/comments');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({ reactionType: 'like' }); // NO sceneIndex
  });

  it('marks the active reaction with aria-pressed=true after a successful save', async () => {
    // First call: the GET hydrate fired by the component's useEffect.
    // Second call: the POST under test.
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ comments: [] }) });
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    render(<ProjectReactionBar projectId="proj-1" />);

    fireEvent.click(screen.getByTestId('project-reaction-dislike'));

    await waitFor(() => {
      expect(screen.getByTestId('project-reaction-dislike')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('project-reaction-like')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  it('hydrates from initialReaction prop', () => {
    render(<ProjectReactionBar projectId="p1" initialReaction="like" />);
    expect(screen.getByTestId('project-reaction-like')).toHaveAttribute('aria-pressed', 'true');
  });

  it('does NOT update aria-pressed when the POST fails', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<ProjectReactionBar projectId="p1" />);
    fireEvent.click(screen.getByTestId('project-reaction-like'));
    // give the catch path a tick
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId('project-reaction-like')).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables all three buttons while a save is in flight', async () => {
    let resolveFetch!: (v: unknown) => void;
    mockApiFetch.mockImplementationOnce(
      () => new Promise((res) => { resolveFetch = res; }),
    );
    render(<ProjectReactionBar projectId="p1" />);
    fireEvent.click(screen.getByTestId('project-reaction-like'));
    await waitFor(() => {
      expect(screen.getByTestId('project-reaction-like')).toBeDisabled();
      expect(screen.getByTestId('project-reaction-dislike')).toBeDisabled();
      expect(screen.getByTestId('project-reaction-undecided')).toBeDisabled();
    });
    resolveFetch({ ok: true, status: 201 });
  });

  it('fires onReactionChange callback with the new reaction value', async () => {
    // First call: the GET hydrate fired by the component's useEffect.
    // Second call: the POST under test.
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ comments: [] }) });
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    const onChange = vi.fn();
    render(<ProjectReactionBar projectId="p1" onReactionChange={onChange} />);
    fireEvent.click(screen.getByTestId('project-reaction-undecided'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('undecided');
    });
  });
});

describe('ProjectReactionBadge', () => {
  it('renders nothing when reaction is null', () => {
    const { container } = render(<ProjectReactionBadge reaction={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when reaction is undefined', () => {
    const { container } = render(<ProjectReactionBadge reaction={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Liked" label for like', () => {
    render(<ProjectReactionBadge reaction="like" />);
    expect(screen.getByText('Liked')).toBeInTheDocument();
    expect(screen.getByTestId('project-reaction-badge-like')).toBeInTheDocument();
  });

  it('shows "Passed" label for dislike (Ryan vocabulary)', () => {
    render(<ProjectReactionBadge reaction="dislike" />);
    expect(screen.getByText('Passed')).toBeInTheDocument();
  });

  it('shows "Undecided" label for undecided', () => {
    render(<ProjectReactionBadge reaction="undecided" />);
    expect(screen.getByText('Undecided')).toBeInTheDocument();
  });
});
