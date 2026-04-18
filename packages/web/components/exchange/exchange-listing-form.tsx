'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Globe, EyeOff, Loader2, ExternalLink } from 'lucide-react';

const GENRES = [
  'drama', 'comedy', 'thriller', 'horror', 'sci-fi',
  'fantasy', 'action', 'romance', 'documentary', 'animation', 'other',
] as const;

interface Listing {
  isPublic: boolean;
  slug: string | null;
  tagline: string | null;
  genre: string | null;
  listedAt: string | null;
}

interface Props {
  projectId: string;
  initialListing: Listing | null;
}

export function ExchangeListingForm({ projectId, initialListing }: Props) {
  const [listing, setListing] = useState<Listing | null>(initialListing);
  const [tagline, setTagline] = useState(initialListing?.tagline ?? '');
  const [genre, setGenre] = useState(initialListing?.genre ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!tagline || !genre) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagline, genre, is_public: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? 'Failed to update listing');
      } else {
        const data = await res.json();
        setListing({
          isPublic: data.listing.exchangeIsPublic,
          slug: data.listing.exchangeSlug,
          tagline: data.listing.exchangeTagline,
          genre: data.listing.exchangeGenre,
          listedAt: data.listing.exchangeListedAt,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function unlist() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/exchange`, { method: 'DELETE' });
      if (res.ok) {
        setListing((prev) => prev ? { ...prev, isPublic: false } : prev);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        {listing?.isPublic ? (
          <Badge variant="outline" className="border-green-500 text-green-600 gap-1">
            <Globe className="w-3 h-3" />
            Listed on Exchange
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <EyeOff className="w-3 h-3" />
            Not listed
          </Badge>
        )}
        {listing?.isPublic && listing.slug && (
          <a
            href={`/exchange/${listing.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="One line that makes readers want to read it"
            maxLength={280}
          />
          <p className="text-xs text-muted-foreground">{tagline.length}/280</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="genre">Genre</Label>
          <Select value={genre} onValueChange={setGenre}>
            <SelectTrigger id="genre">
              <SelectValue placeholder="Select genre" />
            </SelectTrigger>
            <SelectContent>
              {GENRES.map((g) => (
                <SelectItem key={g} value={g} className="capitalize">
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex gap-3">
          <Button type="submit" disabled={loading || !tagline || !genre}>
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {listing?.isPublic ? 'Update Listing' : 'List on Exchange'}
          </Button>
          {listing?.isPublic && (
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={unlist}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Unlist
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
