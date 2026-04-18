'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Loader2 } from 'lucide-react';

interface Props {
  writerId: string;
  initialSubscribed: boolean;
}

export function WriterSubscribeButton({ writerId, initialSubscribed }: Props) {
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/writers/${writerId}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setSubscribed(data.subscribed);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={subscribed ? 'outline' : 'default'}
      size="sm"
      onClick={toggle}
      disabled={loading}
      aria-pressed={subscribed}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : subscribed ? (
        <BellOff className="w-4 h-4 mr-2" />
      ) : (
        <Bell className="w-4 h-4 mr-2" />
      )}
      {subscribed ? 'Unsubscribe' : 'Subscribe'}
    </Button>
  );
}
