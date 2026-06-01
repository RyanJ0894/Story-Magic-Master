'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function EnterpriseTeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center px-4">
      <p className="text-muted-foreground text-sm">
        Something went wrong loading this page.
      </p>
      <Button variant="outline" size="sm" onClick={reset}>
        Reload
      </Button>
    </div>
  );
}
