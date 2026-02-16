'use client';

import { useClerk } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function SignOutButton() {
  const { signOut } = useClerk();

  return (
    <Button
      variant="ghost"
      size="sm"
      data-testid="signout-button"
      onClick={() => signOut({ redirectUrl: '/login' })}
    >
      <LogOut className="w-4 h-4 mr-2" />
      Sign out
    </Button>
  );
}
