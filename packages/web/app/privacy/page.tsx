import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link href="/signup">
          <Button variant="ghost" className="mb-8">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Privacy Policy
        </h1>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-slate-600 dark:text-slate-400">
            Last updated: January 2026
          </p>

          <h2>1. Information We Collect</h2>
          <p>
            We collect information you provide directly, including your name, email address, and scripts you upload for processing.
          </p>

          <h2>2. How We Use Your Information</h2>
          <p>
            We use your information to provide and improve our services, process your scripts, and communicate with you about your account.
          </p>

          <h2>3. Data Storage and Security</h2>
          <p>
            Your data is stored securely using industry-standard encryption. Scripts and generated audio are processed on secure servers.
          </p>

          <h2>4. Third-Party Services</h2>
          <p>
            We use third-party services for authentication (Supabase), payment processing (Stripe), and AI processing (OpenAI, ElevenLabs). These services have their own privacy policies.
          </p>

          <h2>5. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. You can request deletion of your data at any time.
          </p>

          <h2>6. Your Rights</h2>
          <p>
            You have the right to access, correct, or delete your personal data. Contact us to exercise these rights.
          </p>

          <h2>7. Contact</h2>
          <p>
            For privacy inquiries, please contact privacy@storymagic.ai
          </p>
        </div>
      </div>
    </div>
  );
}
