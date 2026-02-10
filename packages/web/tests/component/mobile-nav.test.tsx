/**
 * MobileNav Component Tests
 *
 * Tests the mobile navigation menu toggle, links, and accessibility.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MobileNav } from '@/app/mobile-nav';

describe('MobileNav', () => {
  it('renders the hamburger menu button', () => {
    render(<MobileNav />);

    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens menu when hamburger button is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows navigation links when menu is open', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByText('User Guide')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Get Started')).toBeInTheDocument();
  });

  it('links to the correct pages', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));

    expect(screen.getByText('User Guide').closest('a')).toHaveAttribute('href', '/guide');
    expect(screen.getByText('Sign In').closest('a')).toHaveAttribute('href', '/login');
    expect(screen.getByText('Get Started').closest('a')).toHaveAttribute('href', '/signup');
  });

  it('closes menu when a link is clicked', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('User Guide')).toBeInTheDocument();

    await user.click(screen.getByText('User Guide'));

    // Menu should close — hamburger shows again
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('toggles menu closed when clicked again', async () => {
    const user = userEvent.setup();
    render(<MobileNav />);

    // Open
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByText('Sign In')).toBeInTheDocument();

    // Close
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });

  it('does not show links when menu is closed', () => {
    render(<MobileNav />);

    expect(screen.queryByText('User Guide')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign In')).not.toBeInTheDocument();
    expect(screen.queryByText('Get Started')).not.toBeInTheDocument();
  });
});
