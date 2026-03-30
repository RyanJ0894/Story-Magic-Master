import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Privacy Policy — Story Magic',
  description: 'How Story Magic collects, uses, and protects your personal information.',
};

const EFFECTIVE_DATE = 'March 1, 2026';
const COMPANY = 'Story Magic';
const CONTACT_EMAIL = 'privacy@storymagicapp.net';
const APP_DOMAIN = 'app.storymagicapp.net';
const MARKETING_DOMAIN = 'storymagicapp.net';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      <main className="flex-1 pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Privacy Policy</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Effective date: {EFFECTIVE_DATE}
            </p>
          </div>

          <div className="prose-style space-y-10 text-[var(--color-foreground)]">

            {/* Intro */}
            <Section>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                {COMPANY} (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates{' '}
                <strong>{MARKETING_DOMAIN}</strong> and <strong>{APP_DOMAIN}</strong> (collectively,
                the &quot;Service&quot;). This Privacy Policy explains what information we collect,
                why we collect it, how we use and share it, and the choices you have. By using the
                Service you agree to the practices described here.
              </p>
            </Section>

            {/* 1 */}
            <Section title="1. Information We Collect">
              <SubSection title="1.1 Information you provide">
                <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                  <li><strong>Account data</strong> — name, email address, and password when you create an account via Clerk.</li>
                  <li><strong>Billing data</strong> — payment card details are collected and stored by Stripe. We receive only a tokenised reference and the last four digits of your card; we never store full card numbers.</li>
                  <li><strong>Script content</strong> — the screenplays and text you upload or paste for audio generation.</li>
                  <li><strong>Voice samples</strong> — audio recordings you upload for voice cloning (Pro and Creator plans).</li>
                  <li><strong>Communications</strong> — emails or messages you send to our support team.</li>
                </ul>
              </SubSection>
              <SubSection title="1.2 Information collected automatically">
                <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                  <li><strong>Usage data</strong> — pages visited, features used, generation job status, timestamps, and referring URLs.</li>
                  <li><strong>Device data</strong> — IP address, browser type, operating system, and device identifiers.</li>
                  <li><strong>Cookies and similar technologies</strong> — see our <Link href="/cookies" className="text-brand-500 hover:underline">Cookie Policy</Link> for details.</li>
                </ul>
              </SubSection>
              <SubSection title="1.3 Information from third parties">
                <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                  <li><strong>Clerk</strong> — authentication provider. We receive a user ID, email, and profile metadata.</li>
                  <li><strong>Stripe</strong> — payment processor. We receive subscription status, plan tier, and billing history.</li>
                  <li><strong>ElevenLabs</strong> — text-to-speech provider. Script text and voice parameters are transmitted to ElevenLabs to generate audio. ElevenLabs processes this data under their own privacy policy.</li>
                </ul>
              </SubSection>
            </Section>

            {/* 2 */}
            <Section title="2. How We Use Your Information">
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                <li>Provide, operate, and maintain the Service.</li>
                <li>Process payments and manage your subscription.</li>
                <li>Generate audio from your scripts using our AI pipeline.</li>
                <li>Send transactional emails (account verification, receipts, job completion notifications).</li>
                <li>Respond to support requests.</li>
                <li>Detect, investigate, and prevent fraudulent or unauthorised activity.</li>
                <li>Improve our models, features, and user experience using aggregated, anonymised usage data.</li>
                <li>Comply with legal obligations.</li>
              </ul>
              <p className="text-[var(--color-muted-foreground)] mt-4 leading-relaxed">
                We do <strong>not</strong> use your script content or voice samples to train AI models unless you give explicit, separate consent.
              </p>
            </Section>

            {/* 3 */}
            <Section title="3. Legal Bases for Processing (EEA / UK Users)">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Where GDPR or UK GDPR applies, we rely on the following legal bases:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)] mt-3">
                <li><strong>Contract performance</strong> — processing necessary to deliver the Service you signed up for.</li>
                <li><strong>Legitimate interests</strong> — security monitoring, fraud prevention, service improvement (where our interests are not overridden by your rights).</li>
                <li><strong>Legal obligation</strong> — compliance with applicable laws.</li>
                <li><strong>Consent</strong> — marketing communications and optional analytics cookies (you can withdraw at any time).</li>
              </ul>
            </Section>

            {/* 4 */}
            <Section title="4. How We Share Your Information">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We do not sell your personal data. We share information only as follows:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)] mt-3">
                <li><strong>Service providers</strong> — Clerk (auth), Stripe (payments), ElevenLabs (TTS), OpenAI / Groq (LLM), Supabase (file storage), Upstash (caching), Sentry (error monitoring), Render.com (infrastructure). Each operates under its own data processing agreement.</li>
                <li><strong>Legal requirements</strong> — when required by law, subpoena, or to protect the rights, safety, or property of {COMPANY} or others.</li>
                <li><strong>Business transfers</strong> — in connection with a merger, acquisition, or sale of assets, with appropriate confidentiality obligations.</li>
                <li><strong>Team members</strong> — if you use collaboration features, team members you invite can see the scripts and audio in shared projects.</li>
              </ul>
            </Section>

            {/* 5 */}
            <Section title="5. Data Retention">
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                <li><strong>Free plan</strong> — scripts and generated audio are deleted after 7 days of inactivity.</li>
                <li><strong>Starter plan</strong> — projects retained for 30 days of inactivity.</li>
                <li><strong>Pro plan</strong> — projects retained for 90 days.</li>
                <li><strong>Creator plan</strong> — unlimited storage; retained until you delete or cancel your account.</li>
                <li><strong>Account data</strong> — retained for the life of your account plus 90 days after deletion to allow recovery.</li>
                <li><strong>Billing records</strong> — retained for 7 years for legal and tax compliance.</li>
                <li><strong>Voice clones</strong> — retained while your subscription is active; deleted within 30 days of account deletion.</li>
              </ul>
            </Section>

            {/* 6 */}
            <Section title="6. Security">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We implement industry-standard measures including TLS encryption in transit, AES-256
                encryption at rest, isolated job sandboxing for script processing, and role-based
                access controls. No method of transmission over the internet is completely secure;
                we cannot guarantee absolute security.
              </p>
            </Section>

            {/* 7 */}
            <Section title="7. International Transfers">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Our servers are located in the United States (Oregon, via Render.com). If you access
                the Service from the EEA, UK, or another jurisdiction, your data may be transferred
                to and processed in the US. We rely on Standard Contractual Clauses and other
                approved mechanisms where required.
              </p>
            </Section>

            {/* 8 */}
            <Section title="8. Your Rights">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)] mt-3">
                <li><strong>Access</strong> a copy of the personal data we hold about you.</li>
                <li><strong>Rectify</strong> inaccurate or incomplete data.</li>
                <li><strong>Erase</strong> your data (subject to legal retention obligations).</li>
                <li><strong>Restrict</strong> processing in certain circumstances.</li>
                <li><strong>Object</strong> to processing based on legitimate interests.</li>
                <li><strong>Data portability</strong> — receive your data in a structured, machine-readable format.</li>
                <li><strong>Withdraw consent</strong> at any time for consent-based processing.</li>
                <li><strong>Lodge a complaint</strong> with your local data protection authority.</li>
              </ul>
              <p className="text-[var(--color-muted-foreground)] mt-4">
                To exercise these rights, email{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-500 hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . We will respond within 30 days.
              </p>
            </Section>

            {/* 9 */}
            <Section title="9. Children's Privacy">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                The Service is not directed at children under 13 (or under 16 in the EEA). We do
                not knowingly collect personal data from children. If you believe a child has
                provided us data, contact{' '}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-500 hover:underline">
                  {CONTACT_EMAIL}
                </a>{' '}
                and we will delete it promptly.
              </p>
            </Section>

            {/* 10 */}
            <Section title="10. Cookies">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We use cookies and similar technologies. See our{' '}
                <Link href="/cookies" className="text-brand-500 hover:underline">
                  Cookie Policy
                </Link>{' '}
                for the full list of cookies and how to manage them.
              </p>
            </Section>

            {/* 11 */}
            <Section title="11. Changes to This Policy">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We may update this Privacy Policy from time to time. When we make material changes
                we will notify you by email and update the effective date above. Your continued use
                of the Service after changes constitutes acceptance of the revised policy.
              </p>
            </Section>

            {/* 12 */}
            <Section title="12. Contact Us">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                For privacy questions or to exercise your rights:
              </p>
              <address className="not-italic mt-3 text-[var(--color-muted-foreground)] space-y-1">
                <p><strong>{COMPANY}</strong></p>
                <p>
                  Email:{' '}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-500 hover:underline">
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </address>
            </Section>

          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      {title && (
        <h2 className="text-xl font-bold">{title}</h2>
      )}
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[var(--color-foreground)]">{title}</h3>
      {children}
    </div>
  );
}
