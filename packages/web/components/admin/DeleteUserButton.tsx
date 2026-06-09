'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
}

export function DeleteUserButton({ userId, userName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to delete user');
        setLoading(false);
        return;
      }

      setOpen(false);
      router.refresh();
    } catch {
      setError('Network error — please try again');
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!loading) {
      setOpen(next);
      if (!next) setError(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete User
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Delete user?</DialogTitle>
          <DialogDescription>
            This will permanently delete <strong>{userName}</strong> and all their projects, jobs,
            and data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive px-1">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleDelete()}
            disabled={loading}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
