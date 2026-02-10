import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-muted py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/signup">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold text-foreground mb-8">
          Terms of Service
        </h1>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-muted-foreground">
            Last updated: January 2026
          </p>

          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Story Magic, you accept and agree to be bound by these Terms of Service.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            Story Magic provides AI-powered audio production services that transform scripts into audio experiences.
          </p>

          <h2>3. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </p>

          <h2>4. Content and Intellectual Property</h2>
          <p>
            You retain ownership of scripts you upload. Generated audio outputs are licensed to you for your use according to your subscription plan.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>
            You agree not to use the service to generate content that is illegal, harmful, or infringes on third-party rights.
          </p>

          <h2>6. Limitation of Liability</h2>
          <p>
            Story Magic is provided &quot;as is&quot; without warranties. We are not liable for any indirect or consequential damages.
          </p>

          <h2>7. Contact</h2>
          <p>
            For questions about these terms, please contact support@storymagic.ai
          </p>
        </div>
      </div>
    </div>
  );
}
