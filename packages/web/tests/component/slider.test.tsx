/**
 * UX-I-02 (2026-06-22): aria-label must be forwarded from the Slider Root
 * down to the Thumb (the focusable element screen readers announce). The
 * earlier code only spread aria-label onto Root, where Radix did not
 * propagate it to the Thumb in this @radix-ui/react-slider version.
 *
 * Pinning this with a component test so a future refactor of `Slider`
 * can't quietly regress accessibility.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Slider } from '@/components/ui/slider';

describe('Slider — UX-I-02 aria-label forwarding', () => {
  it('forwards aria-label to the slider thumb (the role="slider" element)', () => {
    render(<Slider aria-label="Music gain — +3 dB" defaultValue={[0]} min={-8} max={8} />);
    const thumb = screen.getByRole('slider');
    expect(thumb).toHaveAttribute('aria-label', 'Music gain — +3 dB');
  });

  it('forwards aria-labelledby when aria-label is not given', () => {
    render(
      <>
        <span id="lbl-narration">Narration speed</span>
        <Slider aria-labelledby="lbl-narration" defaultValue={[1]} min={0.85} max={1.2} step={0.05} />
      </>,
    );
    const thumb = screen.getByRole('slider');
    expect(thumb).toHaveAttribute('aria-labelledby', 'lbl-narration');
  });

  it('renders without aria attributes when none are passed (no spurious empty labels)', () => {
    render(<Slider defaultValue={[0]} min={0} max={10} />);
    const thumb = screen.getByRole('slider');
    expect(thumb).not.toHaveAttribute('aria-label');
    expect(thumb).not.toHaveAttribute('aria-labelledby');
  });
});
