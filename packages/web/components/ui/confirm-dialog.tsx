"use client";

/**
 * ConfirmDialog — shared destructive-action confirmation.
 *
 * Replaces window.confirm() across the app. window.confirm is:
 *   - Silently returns `true` in iOS standalone PWA mode (the most
 *     marketing-relevant install path), turning every destructive call
 *     into a silent action.
 *   - Blocking on the main thread.
 *   - Untranslatable / unstyleable.
 *
 * Mirrors the inline Dialog pattern at app/enterprise/(gated)/team/page.tsx
 * which is the original reference implementation.
 *
 * Usage:
 *   const [confirm, setConfirm] = useState<{ id: string } | null>(null);
 *   <ConfirmDialog
 *     open={confirm !== null}
 *     title="Delete project?"
 *     description={`"${name}" will be permanently removed. This cannot be undone.`}
 *     confirmLabel="Delete"
 *     variant="destructive"
 *     onConfirm={() => confirm && void doDelete(confirm.id)}
 *     onCancel={() => setConfirm(null)}
 *   />
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** Called when the user clicks confirm. Closing the dialog is the caller's job (typically via setOpen(null)). */
  onConfirm: () => void;
  /** Called when the user dismisses (cancel button, Escape, backdrop click). */
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
