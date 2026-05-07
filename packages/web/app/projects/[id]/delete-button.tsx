'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Trash2, Loader2 } from 'lucide-react';

interface DeleteProjectButtonProps {
  projectId: string;
}

export default function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="destructive"
      data-testid="delete-project-button"
      disabled={deleting}
      onClick={handleDelete}
    >
      {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
      Delete
    </Button>
  );
}
