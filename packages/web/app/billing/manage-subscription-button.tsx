'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink } from 'lucide-react';

export default function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);

    try {
      const response = await apiFetch('/api/stripe/portal', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleManageSubscription} disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <ExternalLink className="w-4 h-4 mr-2" />
          Manage Subscription
        </>
      )}
    </Button>
  );
}
