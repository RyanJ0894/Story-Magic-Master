'use client';

import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Coins } from 'lucide-react';

interface Props {
  userId: string;
  userName: string;
}

export function GrantCreditsButton({ userId, userName }: Props) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed < 1 || parsed > 10000) {
      setError('Amount must be between 1 and 10,000');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/admin/credits/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount: parsed, reason: 'admin_grant' }),
      });
      const data = await res.json() as { newBalance?: number; error?: string };

      if (!res.ok) {
        setError(data.error ?? 'Failed to grant credits');
      } else {
        setResult(`Granted ${parsed} credits. New balance: ${data.newBalance}`);
        setAmount('10');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setResult(null);
      setError(null);
      setAmount('10');
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full">
          <Coins className="w-4 h-4 mr-2" />
          Grant Credits
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Grant Credits</DialogTitle>
          <DialogDescription>
            Add scene credits to <strong>{userName}</strong>&apos;s account.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="credit-amount">Credits to grant</Label>
            <Input
              id="credit-amount"
              type="number"
              min={1}
              max={10000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="10"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && <p className="text-sm text-green-600">{result}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Granting…' : 'Grant Credits'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
