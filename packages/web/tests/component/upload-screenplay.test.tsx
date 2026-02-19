/**
 * UploadScreenplay Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Mock apiFetch
const mockApiFetch = vi.fn();
vi.mock('@/lib/api/fetch', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

import { UploadScreenplay } from '@/components/project/upload-screenplay';

describe('UploadScreenplay', () => {
  const defaultProps = {
    name: '',
    onNameChange: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the drop zone', () => {
    render(<UploadScreenplay {...defaultProps} />);

    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    expect(screen.getByText(/Drop your screenplay here/)).toBeInTheDocument();
  });

  it('shows file info after selecting a file', async () => {
    const user = userEvent.setup();
    render(<UploadScreenplay {...defaultProps} />);

    const file = new File(['script content'], 'test-script.txt', {
      type: 'text/plain',
    });

    const input = screen.getByTestId('file-input');
    await user.upload(input, file);

    expect(screen.getByTestId('file-info')).toBeInTheDocument();
    expect(screen.getByText('test-script.txt')).toBeInTheDocument();
  });

  it('upload button is disabled without a file', () => {
    render(<UploadScreenplay {...defaultProps} name="Test" />);

    const button = screen.getByTestId('upload-button');
    expect(button).toBeDisabled();
  });

  it('upload button is disabled without a project name', async () => {
    const user = userEvent.setup();
    render(<UploadScreenplay {...defaultProps} />);

    const file = new File(['content'], 'script.txt', { type: 'text/plain' });
    await user.upload(screen.getByTestId('file-input'), file);

    // Name is still empty (auto-fill calls onNameChange but prop stays empty in this test)
    const button = screen.getByTestId('upload-button');
    expect(button).toBeDisabled();
  });

  it('auto-fills project name from filename when name is empty', async () => {
    const onNameChange = vi.fn();
    const user = userEvent.setup();
    render(<UploadScreenplay {...defaultProps} onNameChange={onNameChange} />);

    const file = new File(['content'], 'My Screenplay.txt', {
      type: 'text/plain',
    });
    await user.upload(screen.getByTestId('file-input'), file);

    expect(onNameChange).toHaveBeenCalledWith('My Screenplay');
  });

  it('clears selected file when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<UploadScreenplay {...defaultProps} />);

    const file = new File(['content'], 'script.txt', { type: 'text/plain' });
    await user.upload(screen.getByTestId('file-input'), file);

    expect(screen.getByTestId('file-info')).toBeInTheDocument();

    await user.click(screen.getByTestId('clear-file'));

    expect(screen.queryByTestId('file-info')).not.toBeInTheDocument();
  });
});
