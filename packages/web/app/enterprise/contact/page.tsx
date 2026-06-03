import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Mail, ArrowLeft } from 'lucide-react';

export default function EnterpriseContactPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Enterprise Access Required</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This area is available to Enterprise plan members only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            To get Enterprise access, reach out to the Story Magic team and we&apos;ll
            provision your account directly.
          </p>
          <a
            href="mailto:info@storymagicapp.net?subject=Enterprise%20Access%20Request"
            className="flex items-center justify-center gap-2 w-full rounded-md bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium h-10 px-4 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact Us for Access
          </a>
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
