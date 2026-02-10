/**
 * LoginForm Component Tests
 *
 * Tests the login page form rendering, validation, and interactions.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockSupabaseClient, mockRouterPush } from '../setup-component.js';
import LoginPage from '@/app/login/page';

describe('LoginPage', () => {
  it('renders the login form with email and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-button')).toBeInTheDocument();
    expect(screen.getByTestId('login-magic-link-button')).toBeInTheDocument();
  });

  it('renders the Story Magic branding', () => {
    render(<LoginPage />);

    expect(screen.getByText('Story Magic')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders a link to the signup page', () => {
    render(<LoginPage />);

    const signupLink = screen.getByText('Sign up for free');
    expect(signupLink).toBeInTheDocument();
    expect(signupLink.closest('a')).toHaveAttribute('href', '/signup');
  });

  it('renders a forgot password link', () => {
    render(<LoginPage />);

    const forgotLink = screen.getByText('Forgot password?');
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink.closest('a')).toHaveAttribute('href', '/forgot-password');
  });

  it('allows typing in email and password fields', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    const emailInput = screen.getByTestId('login-email-input');
    const passwordInput = screen.getByTestId('login-password-input');

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');

    expect(emailInput).toHaveValue('test@example.com');
    expect(passwordInput).toHaveValue('password123');
  });

  it('calls Supabase signInWithPassword on form submit', async () => {
    const user = userEvent.setup();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });

    render(<LoginPage />);

    await user.type(screen.getByTestId('login-email-input'), 'test@example.com');
    await user.type(screen.getByTestId('login-password-input'), 'password123');
    await user.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('redirects to dashboard on successful login', async () => {
    const user = userEvent.setup();
    mockSupabaseClient.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123' }, session: {} },
      error: null,
    });

    render(<LoginPage />);

    await user.type(screen.getByTestId('login-email-input'), 'test@example.com');
    await user.type(screen.getByTestId('login-password-input'), 'password123');
    await user.click(screen.getByTestId('login-submit-button'));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows loading state while submitting', async () => {
    const user = userEvent.setup();

    // Delay the resolution to observe loading state
    mockSupabaseClient.auth.signInWithPassword.mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: {}, error: null }), 100))
    );

    render(<LoginPage />);

    await user.type(screen.getByTestId('login-email-input'), 'test@example.com');
    await user.type(screen.getByTestId('login-password-input'), 'password123');
    await user.click(screen.getByTestId('login-submit-button'));

    expect(screen.getByText('Signing in...')).toBeInTheDocument();
  });
});
