'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Star, MessageSquare, Play } from 'lucide-react';

export interface ExchangeScript {
  id: string;
  slug: string | null;
  name: string;
  tagline: string | null;
  genre: string | null;
  pageCount: number;
  hasPreview: boolean;
  reviewCount: number;
  listedAt: string | Date | null;
  writer: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
  };
  avgRating?: number | null;
}

interface Props {
  script: ExchangeScript;
}

export function ExchangeScriptCard({ script }: Props) {
  const href = script.slug ? `/exchange/${script.slug}` : `/exchange/${script.id}`;

  return (
    <Link href={href} className="group block focus-visible:outline-none">
      <Card className="h-full transition-shadow group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-primary">
        <CardContent className="p-5 flex flex-col gap-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold text-sm leading-snug truncate">{script.name}</h3>
            </div>
            {script.genre && (
              <Badge variant="secondary" className="shrink-0 text-xs capitalize">
                {script.genre}
              </Badge>
            )}
          </div>

          {/* Tagline */}
          {script.tagline && (
            <p className="text-sm text-muted-foreground line-clamp-2">{script.tagline}</p>
          )}

          {/* Meta row */}
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-1">
            <div className="flex items-center gap-3">
              <span>{script.pageCount}p</span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {script.reviewCount}
              </span>
              {script.avgRating != null && (
                <span className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  {script.avgRating.toFixed(1)}
                </span>
              )}
              {script.hasPreview && (
                <span className="flex items-center gap-1 text-primary font-medium">
                  <Play className="w-3 h-3" />
                  Preview
                </span>
              )}
            </div>
            <span className="truncate max-w-[100px]">
              {script.writer.fullName ?? 'Anonymous'}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
