/**
 * LoginPage Component Tests
 *
 * LoginPage is an async Next.js server component — call it as an async function
 * and render the resolved JSX rather than using JSX syntax directly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from '@/app/login/[[...rest]]/page';

// next/image is a server-side optimised component; stub it for tests.
vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

describe('LoginPage', () => {
  it('renders the Story Magic logo image', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByAltText('Story Magic')).toBeInTheDocument();
  });

  it('renders the Clerk SignIn component', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(page);
    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it('renders with the correct layout classes', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    const { container } = render(page);
    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveClass('min-h-screen');
    expect(wrapper).toHaveClass('flex');
    expect(wrapper).toHaveClass('items-center');
    expect(wrapper).toHaveClass('justify-center');
  });

  it('wraps the logo in a home link', async () => {
    const page = await LoginPage({ searchParams: Promise.resolve({}) });
    render(page);
    const logoLink = screen.getByRole('link');
    expect(logoLink).toHaveAttribute('href', '/');
  });
});
