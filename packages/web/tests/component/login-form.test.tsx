/**
 * LoginPage Component Tests
 *
 * Tests the login page rendering with Clerk's SignIn component.
 * The login page now uses Clerk's prebuilt <SignIn /> instead of a custom form.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('renders the Story Magic branding', () => {
    render(<LoginPage />);

    expect(screen.getByText('Story Magic')).toBeInTheDocument();
  });

  it('renders the Clerk SignIn component', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('renders with the correct layout classes', () => {
    const { container } = render(<LoginPage />);

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('min-h-screen');
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('items-center');
    expect(wrapper).toHaveClass('justify-center');
  });

  it('renders the sparkles icon', () => {
    render(<LoginPage />);

    const icon = document.querySelector('.lucide-sparkles');
    expect(icon).toBeInTheDocument();
  });
});
