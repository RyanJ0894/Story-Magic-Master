import { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { SwaggerUIWrapper } from '@/components/docs/swagger-ui';
import { openApiSpec } from '@/lib/api/openapi';

export const metadata: Metadata = {
  title: 'API Documentation | Story Magic',
  description: 'Complete API reference for the Story Magic platform',
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <h1 className="font-bold text-xl">API Documentation</h1>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/api/docs" target="_blank">
                <Button variant="outline" size="sm">
                  OpenAPI JSON
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        <SwaggerUIWrapper spec={openApiSpec} />
      </main>
    </div>
  );
}
