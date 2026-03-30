import type { Metadata } from 'next';
import Link from 'next/link';
import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'Cookie Policy — Story Magic',
  description: 'How Story Magic uses cookies and similar tracking technologies.',
};

const EFFECTIVE_DATE = 'March 1, 2026';
const CONTACT_EMAIL = 'privacy@storymagicapp.net';

const COOKIES = [
  {
    category: 'Strictly Necessary',
    canOptOut: false,
    description:
      'Required for the Service to function. Without these cookies you cannot log in, manage your session, or process payments.',
    examples: [
      { name: '__session', provider: 'Clerk', purpose: 'Authentication session token', duration: 'Session' },
      { name: '__client_uat', provider: 'Clerk', purpose: 'User authentication state', duration: '1 year' },
      { name: 'next-auth.csrf-token', provider: 'Story Magic', purpose: 'CSRF protection', duration: 'Session' },
      { name: 'stripe-*', provider: 'Stripe', purpose: 'Payment session and fraud prevention', duration: 'Session' },
    ],
  },
  {
    category: 'Functional',
    canOptOut: true,
    description:
      'Enable enhanced functionality and personalisation, such as remembering your theme preference (dark/light mode).',
    examples: [
      { name: 'theme', provider: 'Story Magic', purpose: 'Stores dark/light mode preference', duration: '1 year' },
      { name: 'billing-period', provider: 'Story Magic', purpose: 'Remembers monthly/annual billing toggle on pricing page', duration: '30 days' },
    ],
  },
  {
    category: 'Analytics',
    canOptOut: true,
    description:
      'Help us understand how visitors interact with the Service so we can improve it. All data is aggregated and anonymised.',
    examples: [
      { name: '_vercel_*', provider: 'Vercel', purpose: 'Page performance and edge analytics (no PII)', duration: '24 hours' },
      { name: '__sentry_*', provider: 'Sentry', purpose: 'Error tracking and session replay (anonymised)', duration: 'Session' },
    ],
  },
];

export default function CookiesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      <main className="flex-1 pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3">Cookie Policy</h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              Effective date: {EFFECTIVE_DATE}
            </p>
          </div>

          <div className="space-y-10 text-[var(--color-foreground)]">

            <Section>
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                This Cookie Policy explains what cookies are, how Story Magic uses them, and what
                choices you have. It should be read alongside our{' '}
                <Link href="/privacy" className="text-brand-500 hover:underline">
                  Privacy Policy
                </Link>
                .
              </p>
            </Section>

            <Section title="1. What Are Cookies?">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Cookies are small text files placed on your device by a website you visit. They are
                widely used to make websites work, or work more efficiently, and to provide
                information to the site owner. Similar technologies include local storage, session
                storage, and pixels; this policy covers all of them.
              </p>
            </Section>

            <Section title="2. Cookies We Use">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed mb-6">
                We use the categories of cookies described below. Where a category is optional, you
                can opt out using the methods described in Section 3.
              </p>

              <div className="space-y-8">
                {COOKIES.map((cat) => (
                  <div
                    key={cat.category}
                    className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] overflow-hidden"
                  >
                    <div className="p-5 border-b border-[var(--color-border)] flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-[var(--color-foreground)]">{cat.category}</h3>
                        <p className="text-sm text-[var(--color-muted-foreground)] mt-1">{cat.description}</p>
                      </div>
                      <span
                        className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          cat.canOptOut
                            ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                            : 'bg-brand-600/15 text-brand-500'
                        }`}
                      >
                        {cat.canOptOut ? 'Optional' : 'Required'}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                            <th className="text-left py-2.5 px-4 font-semibold text-[var(--color-muted-foreground)]">Name</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-[var(--color-muted-foreground)]">Provider</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-[var(--color-muted-foreground)]">Purpose</th>
                            <th className="text-left py-2.5 px-4 font-semibold text-[var(--color-muted-foreground)]">Duration</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cat.examples.map((ex, i) => (
                            <tr
                              key={ex.name}
                              className={`border-b border-[var(--color-border)] last:border-0 ${
                                i % 2 === 0 ? '' : 'bg-[var(--color-background)]/50'
                              }`}
                            >
                              <td className="py-2.5 px-4 font-mono text-[var(--color-foreground)]">{ex.name}</td>
                              <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">{ex.provider}</td>
                              <td className="py-2.5 px-4 text-[var(--color-muted-foreground)]">{ex.purpose}</td>
                              <td className="py-2.5 px-4 text-[var(--color-muted-foreground)] whitespace-nowrap">{ex.duration}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="3. Managing Cookies">
              <SubSection title="Browser settings">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  Most browsers allow you to refuse or delete cookies through their settings.
                  Disabling strictly necessary cookies will prevent you from logging in or using the
                  Service. Refer to your browser&apos;s help documentation:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[var(--color-muted-foreground)] mt-2">
                  <li>Chrome: Settings → Privacy and security → Cookies and other site data</li>
                  <li>Firefox: Settings → Privacy &amp; Security → Cookies and Site Data</li>
                  <li>Safari: Preferences → Privacy → Manage Website Data</li>
                  <li>Edge: Settings → Cookies and site permissions</li>
                </ul>
              </SubSection>
              <SubSection title="Do Not Track">
                <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                  We honour the browser-level Do Not Track (DNT) signal by disabling optional analytics
                  cookies when DNT is enabled.
                </p>
              </SubSection>
              <SubSection title="Opt-out links">
                <ul className="list-disc pl-5 space-y-1 text-[var(--color-muted-foreground)]">
                  <li>
                    Sentry session replay:{' '}
                    <a
                      href="https://sentry.io/privacy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:underline"
                    >
                      sentry.io/privacy
                    </a>
                  </li>
                  <li>
                    Vercel analytics:{' '}
                    <a
                      href="https://vercel.com/legal/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand-500 hover:underline"
                    >
                      vercel.com/legal/privacy-policy
                    </a>
                  </li>
                </ul>
              </SubSection>
            </Section>

            <Section title="4. Third-Party Cookies">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Some cookies are set by third-party services we integrate (Clerk, Stripe, Sentry,
                Vercel). These third parties operate under their own privacy and cookie policies. We
                do not control third-party cookies and are not responsible for them.
              </p>
            </Section>

            <Section title="5. Changes to This Policy">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                We may update this Cookie Policy from time to time. We will update the effective date
                above and, where the changes are material, notify you by email or in-app notice.
              </p>
            </Section>

            <Section title="6. Contact">
              <p className="text-[var(--color-muted-foreground)] leading-relaxed">
                Questions about our use of cookies?
              </p>
              <address className="not-italic mt-3 text-[var(--color-muted-foreground)]">
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
