import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Terms of Service — Story Magic',
  description: 'Terms and conditions governing use of the Story Magic platform.',
};

const EFFECTIVE_DATE = 'March 1, 2026';
const COMPANY = 'Story Magic';
const CONTACT_EMAIL = 'legal@storymagicapp.net';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      <main className="flex-1 pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Terms of Service</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Effective date: {EFFECTIVE_DATE}
            </p>
          </div>

          <div className="space-y-10 text-[var(--color-foreground)]">

            <Section>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of{' '}
                {COMPANY}&apos;s websites and platform (collectively, the &quot;Service&quot;).
                By creating an account or using the Service, you agree to be bound by these Terms. If
                you do not agree, do not use the Service.
              </p>
            </Section>

            <Section title="1. Eligibility">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                You must be at least 13 years old (or 16 in the EEA) to use the Service. By using
                the Service you represent that you meet this requirement. If you are using the Service
                on behalf of a company or other legal entity, you represent that you have the authority
                to bind that entity to these Terms.
              </p>
            </Section>

            <Section title="2. Account Registration">
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                <li>You must provide accurate, current, and complete information when registering.</li>
                <li>You are responsible for maintaining the security of your account credentials and for all activity under your account.</li>
                <li>You must notify us immediately at <a href={`mailto:${CONTACT_EMAIL}`} className="text-brand-500 hover:underline">{CONTACT_EMAIL}</a> if you suspect unauthorised access.</li>
                <li>You may not share your account with others or create accounts on behalf of third parties without our written consent.</li>
              </ul>
            </Section>

            <Section title="3. Plans, Payments, and Billing">
              <SubSection title="3.1 Free plan">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  The Free plan is provided at no charge subject to the usage limits described on our{' '}
                  <Link href="/pricing" className="text-brand-500 hover:underline">Pricing page</Link>.
                  We reserve the right to change or discontinue the Free plan with 30 days&apos; notice.
                </p>
              </SubSection>
              <SubSection title="3.2 Paid plans and trials">
                <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)]">
                  <li>Paid plans (Starter, Pro, Creator) are billed monthly or annually in advance.</li>
                  <li>A 7-day free trial is available on Starter, Pro, and Creator plans. Your card will not be charged during the trial. If you do not cancel before the trial ends, you will be charged the applicable plan rate.</li>
                  <li>All fees are in US dollars and exclusive of taxes. You are responsible for all applicable taxes.</li>
                  <li>Payments are processed by Stripe. By providing payment information you authorise us to charge the selected payment method on a recurring basis.</li>
                </ul>
              </SubSection>
              <SubSection title="3.3 Upgrades and downgrades">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  You may upgrade your plan at any time; the new rate takes effect immediately with a
                  prorated charge. Downgrades take effect at the end of your current billing period.
                  Unused script quota does not roll over.
                </p>
              </SubSection>
              <SubSection title="3.4 Refunds">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  Payments are non-refundable except as required by applicable law or at our sole
                  discretion. If you believe you were charged in error, contact us within 30 days.
                </p>
              </SubSection>
            </Section>

            <Section title="4. Acceptable Use">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)] mt-3">
                <li>Upload content that is unlawful, defamatory, obscene, or infringes the rights of third parties.</li>
                <li>Generate audio that impersonates a real person without their consent, or creates deepfakes intended to deceive.</li>
                <li>Clone a voice without the explicit written consent of the person whose voice is being reproduced.</li>
                <li>Attempt to reverse-engineer, scrape, or circumvent any security measures of the Service.</li>
                <li>Resell or redistribute access to the Service without our written permission.</li>
                <li>Use the Service in any way that violates applicable laws or regulations, including export control laws.</li>
                <li>Engage in any activity that imposes an unreasonable or disproportionately large load on our infrastructure.</li>
              </ul>
              <p className="text-[var(--color-muted-foreground)] mt-4 leading-relaxed">
                We reserve the right to suspend or terminate accounts that violate these rules without
                refund.
              </p>
            </Section>

            <Section title="5. Your Content">
              <SubSection title="5.1 Ownership">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  You retain all intellectual property rights in the scripts, voice samples, and other
                  content you upload (&quot;Your Content&quot;). By uploading content, you grant{' '}
                  {COMPANY} a limited, non-exclusive, royalty-free licence to process, store, and
                  transmit Your Content solely to provide the Service.
                </p>
              </SubSection>
              <SubSection title="5.2 Generated audio">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  Subject to your compliance with these Terms and your plan&apos;s commercial use
                  rights, you own the audio output generated from Your Content. Free and Starter plan
                  outputs are licensed for personal, non-commercial use only. Pro and Creator plan
                  outputs include commercial use rights as described on the{' '}
                  <Link href="/pricing" className="text-brand-500 hover:underline">Pricing page</Link>.
                </p>
              </SubSection>
              <SubSection title="5.3 Our licence to improve">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  We do <strong>not</strong> use Your Content to train AI models without your separate,
                  explicit consent. We may use anonymised, aggregated usage metrics (not your content)
                  to improve the Service.
                </p>
              </SubSection>
              <SubSection title="5.4 Content responsibility">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  You are solely responsible for ensuring you have all necessary rights to upload and
                  process Your Content through the Service, including rights to any third-party scripts,
                  music references, or voice recordings.
                </p>
              </SubSection>
            </Section>

            <Section title="6. Voice Cloning">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Voice cloning features (available on Pro and Creator plans) allow you to create a
                synthetic voice model from an audio sample. You represent and warrant that:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[var(--color-muted-foreground)] mt-3">
                <li>You have obtained the explicit, informed, written consent of the person whose voice is being cloned.</li>
                <li>The voice sample is legally obtained and you hold all necessary rights to use it.</li>
                <li>You will not use cloned voices to impersonate, defame, or deceive.</li>
              </ul>
              <p className="text-[var(--color-muted-foreground)] mt-4 leading-relaxed">
                Violation of this section may result in immediate account termination and legal action.
              </p>
            </Section>

            <Section title="7. Voice Marketplace">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                If you apply to join the Story Magic Voice Marketplace as a voice talent, additional
                terms govern your participation, including revenue share, quality standards, and
                content restrictions. Those terms are provided during the application process and
                supplement these Terms.
              </p>
            </Section>

            <Section title="8. Intellectual Property">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                The Service, including its software, AI models, interface, and branding, is owned by
                {COMPANY} and its licensors and is protected by copyright, trademark, and other laws.
                You may not copy, modify, distribute, sell, or lease any part of the Service, or
                reverse-engineer any of our software, except as permitted by law or with our written
                consent.
              </p>
            </Section>

            <Section title="9. Third-Party Services">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                The Service integrates third-party services including ElevenLabs (text-to-speech),
                OpenAI and Groq (language models), Clerk (authentication), and Stripe (payments).
                Your use of the Service is also subject to those providers&apos; terms of service and
                privacy policies. We are not responsible for the practices of third-party services.
              </p>
            </Section>

            <Section title="10. Disclaimers">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed uppercase text-xs tracking-wide font-medium">
                The service is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any
                kind, express or implied, including but not limited to merchantability, fitness for a
                particular purpose, and non-infringement. We do not warrant that the service will be
                uninterrupted, error-free, or that generated audio will meet your specific
                requirements.
              </p>
            </Section>

            <Section title="11. Limitation of Liability">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed uppercase text-xs tracking-wide font-medium">
                To the fullest extent permitted by law, {COMPANY} and its officers, directors,
                employees, and licensors shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages, including loss of profits or data, arising from
                your use of the service. Our total aggregate liability to you for any claim shall not
                exceed the greater of (a) the fees you paid in the 12 months preceding the claim or
                (b) US $100.
              </p>
            </Section>

            <Section title="12. Indemnification">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                You agree to indemnify and hold harmless {COMPANY} and its officers, directors,
                employees, and agents from and against any claims, liabilities, damages, losses, and
                expenses (including reasonable legal fees) arising from (a) your use of the Service,
                (b) Your Content, (c) your violation of these Terms, or (d) your violation of any
                third-party rights.
              </p>
            </Section>

            <Section title="13. Termination">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                You may cancel your account at any time from your account settings. We may suspend or
                terminate your access immediately for breach of these Terms, without refund.
                Termination does not affect rights or obligations accrued prior to termination.
                Sections 5 (Your Content — ownership), 8, 10, 11, and 12 survive termination.
              </p>
            </Section>

            <Section title="14. Governing Law and Disputes">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                These Terms are governed by the laws of the State of California, USA, without regard
                to conflict-of-law principles. Any dispute arising from these Terms or the Service
                shall be resolved by binding arbitration under the rules of the American Arbitration
                Association, except that either party may seek injunctive relief in a court of
                competent jurisdiction. You waive any right to participate in a class action lawsuit
                or class-wide arbitration.
              </p>
            </Section>

            <Section title="15. Changes to These Terms">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We may update these Terms from time to time. For material changes we will provide at
                least 14 days&apos; notice by email or in-app notification before the changes take
                effect. Your continued use of the Service after the effective date of the revised Terms
                constitutes your acceptance.
              </p>
            </Section>

            <Section title="16. Contact">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Questions about these Terms?
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
      {title && <h2 className="text-xl font-bold">{title}</h2>}
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
