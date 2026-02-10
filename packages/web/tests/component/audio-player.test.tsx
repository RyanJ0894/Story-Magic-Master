/**
 * AudioPlayer Component Tests
 *
 * Tests the audio player UI: rendering, play/pause, track list, download.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AudioPlayer from '@/app/projects/[id]/audio-player';

const mockOutputs = [
  {
    id: 'output-1',
    file_name: 'scene-1-final.m4a',
    file_path: 'audio/project-123/scene-1-final.m4a',
    duration_seconds: 180,
    format: 'm4a',
  },
  {
    id: 'output-2',
    file_name: 'scene-2-final.m4a',
    file_path: 'audio/project-123/scene-2-final.m4a',
    duration_seconds: 240,
    format: 'm4a',
  },
];

describe('AudioPlayer', () => {
  it('renders "No audio available" when outputs is empty', () => {
    render(<AudioPlayer outputs={[]} />);
    expect(screen.getByText('No audio available')).toBeInTheDocument();
  });

  it('renders the player with play button for a single output', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);

    expect(screen.getByTestId('audio-player')).toBeInTheDocument();
    expect(screen.getByTestId('audio-play-pause-button')).toBeInTheDocument();
    expect(screen.getByLabelText('Play')).toBeInTheDocument();
  });

  it('displays the file name', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);
    expect(screen.getByText('scene-1-final.m4a')).toBeInTheDocument();
  });

  it('renders a download button with correct href', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);

    const downloadLink = screen.getByTestId('download-button');
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute(
      'href',
      expect.stringContaining('scene-1-final.m4a')
    );
  });

  it('renders the seek slider with aria attributes', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);

    const slider = screen.getByRole('slider', { name: 'Seek' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuemin', '0');
  });

  it('renders volume controls', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);

    expect(screen.getByLabelText('Mute')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
  });

  it('shows track list when multiple outputs exist', () => {
    render(<AudioPlayer outputs={mockOutputs} />);

    expect(screen.getByText('All Outputs')).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Audio tracks' })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('does not show track list for a single output', () => {
    render(<AudioPlayer outputs={[mockOutputs[0]]} />);
    expect(screen.queryByText('All Outputs')).not.toBeInTheDocument();
  });

  it('marks the first track as selected by default', () => {
    render(<AudioPlayer outputs={mockOutputs} />);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveAttribute('aria-selected', 'true');
    expect(options[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('switches tracks when a track is clicked', async () => {
    const user = userEvent.setup();
    render(<AudioPlayer outputs={mockOutputs} />);

    const options = screen.getAllByRole('option');
    await user.click(options[1]);

    expect(options[1]).toHaveAttribute('aria-selected', 'true');
    expect(options[0]).toHaveAttribute('aria-selected', 'false');
  });
});
