'use client';

import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

interface DeleteProjectButtonProps {
  projectId: string;
}

export default function DeleteProjectButton({ projectId }: DeleteProjectButtonProps) {
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
      return;
    }

    // Submit the form programmatically
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `/api/projects/${projectId}/delete`;
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <Button
      type="button"
      variant="destructive"
      data-testid="delete-project-button"
      onClick={handleDelete}
    >
      <Trash2 className="w-4 h-4 mr-2" />
      Delete
    </Button>
  );
}
