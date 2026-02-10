/**
 * ThemeToggle Component Tests
 *
 * Tests the theme toggle button cycling through light → dark → system.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = 'system';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockTheme === 'system' ? 'light' : mockTheme,
  }),
}));

import { ThemeToggle } from '@/components/theme-toggle';

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = 'system';
  });

  it('renders a toggle button', () => {
    render(<ThemeToggle />);

    const button = screen.getByTestId('theme-toggle');
    expect(button).toBeInTheDocument();
  });

  it('has an accessible aria-label', () => {
    render(<ThemeToggle />);

    const button = screen.getByTestId('theme-toggle');
    expect(button).toHaveAttribute('aria-label', 'System theme');
  });

  it('cycles from system to light on click', async () => {
    mockTheme = 'system';
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('cycles from light to dark on click', async () => {
    mockTheme = 'light';
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('cycles from dark to system on click', async () => {
    mockTheme = 'dark';
    const user = userEvent.setup();
    render(<ThemeToggle />);

    await user.click(screen.getByTestId('theme-toggle'));
    expect(mockSetTheme).toHaveBeenCalledWith('system');
  });

  it('shows correct aria-label for light mode', () => {
    mockTheme = 'light';
    render(<ThemeToggle />);

    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Light mode');
  });

  it('shows correct aria-label for dark mode', () => {
    mockTheme = 'dark';
    render(<ThemeToggle />);

    expect(screen.getByTestId('theme-toggle')).toHaveAttribute('aria-label', 'Dark mode');
  });
});
