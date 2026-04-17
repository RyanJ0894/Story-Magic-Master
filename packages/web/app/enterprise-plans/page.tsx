'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Building2, Shield, Users, Headphones, Zap } from 'lucide-react';

const ENTERPRISE_PLANS = [
  {
    name: 'Studio Team',
    seats: '10 users',
    price: '$2,400/yr',
    priceNote: '$200/mo billed annually',
    description: 'Perfect for small production studios and creative teams.',
    features: [
      '10 user seats',
      'Unlimited scripts per month',
      'Up to 150 pages per script',
      '150+ premium AI voice library',
      'Custom voice cloning (20 voices)',
      'Team collaboration workspace',
      'Centralized billing & admin panel',
      'Priority processing',
      'Commercial use rights',
      'All export formats (M4A, WAV, MP3)',
      'Dedicated onboarding',
      '99.9% uptime SLA',
    ],
    highlighted: false,
  },
  {
    name: 'Production House',
    seats: '25 users',
    price: '$4,800/yr',
    priceNote: '$400/mo billed annually',
    description: 'For mid-size production companies with active development slates.',
    features: [
      '25 user seats',
      'Unlimited scripts per month',
      'Up to 150 pages per script',
      '150+ premium AI voice library',
      'Custom voice cloning (50 voices)',
      'Team collaboration workspace',
      'Role-based access control',
      'Advanced analytics & usage reports',
      'Centralized billing & admin panel',
      'Priority processing (3× faster)',
      'Commercial use rights',
      'All export formats (M4A, WAV, MP3)',
      'White-label audio',
      'SSO (SAML 2.0)',
      'Dedicated account manager',
      '99.9% uptime SLA',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    seats: '50–200+ users',
    price: 'Custom pricing',
    priceNote: 'Contact sales for a quote',
    description: 'Tailored infrastructure for major studios and enterprise entertainment clients.',
    features: [
      '50–200+ user seats (custom)',
      'Unlimited scripts per month',
      'Extended page limits (custom)',
      'Unlimited voice cloning',
      'Custom AI voice training',
      'Dedicated cloud infrastructure',
      'Custom integrations & API access',
      'SOC 2 Type II compliance',
      'TPN/MPAA content protection',
      'Multi-tenancy with data isolation',
      'Audit logging (7-year retention)',
      'SSO / SAML / SCIM provisioning',
      'Custom SLA (up to 99.99%)',
      'On-site training & onboarding',
      'Dedicated engineering support',
    ],
    highlighted: false,
  },
];

const ENTERPRISE_FEATURES = [
  { icon: Shield, title: 'SOC 2 & TPN Compliance', description: 'Enterprise-grade security with content protection standards for the entertainment industry.' },
  { icon: Users, title: 'Team Management', description: 'Role-based access, centralized billing, and usage analytics across your entire organization.' },
  { icon: Zap, title: 'Priority Infrastructure', description: 'Dedicated processing queues, custom integrations, and SLA-backed uptime guarantees.' },
  { icon: Headphones, title: 'Dedicated Support', description: 'Named account managers, on-site training, and direct engineering access.' },
];

export default function EnterprisePlansPage() {
  const router = useRouter();

  useEffect(() => {
    // Verify password gate was passed
    if (typeof window !== 'undefined' && !sessionStorage.getItem('enterprise_access')) {
      router.replace('/enterprise');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/">
              <Image src="/logo.png" alt="Story Magic" width={56} height={56} className="rounded-lg" />
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/pricing">
                <Button variant="ghost" size="sm">All Plans</Button>
              </Link>
              <a href="mailto:enterprise@storymagicapp.net">
                <Button size="sm">Contact Sales</Button>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full text-sm font-medium mb-4">
            <Building2 className="w-4 h-4" />
            Enterprise Packages
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Built for teams and studios
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Scale Story Magic across your entire organization with enterprise-grade security,
            compliance, and dedicated support.
          </p>
        </div>

        {/* Enterprise Feature Highlights */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {ENTERPRISE_FEATURES.map((feat) => (
            <div key={feat.title} className="bg-background rounded-xl border border-border p-5">
              <feat.icon className="w-6 h-6 text-violet-600 dark:text-violet-400 mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{feat.title}</h3>
              <p className="text-sm text-muted-foreground">{feat.description}</p>
            </div>
          ))}
        </div>

        {/* Plan Cards */}
        <div className="grid gap-6 lg:grid-cols-3 mb-16">
          {ENTERPRISE_PLANS.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlighted
                  ? 'border-violet-500 dark:border-violet-400 shadow-lg shadow-violet-500/10'
                  : ''
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="brand-gradient text-white px-3">Most Popular</Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {plan.seats}
                </p>
                <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 space-y-6">
                {/* Price */}
                <div className="py-3 border-y border-border">
                  <p className="text-2xl font-bold text-foreground">{plan.price}</p>
                  <p className="text-xs text-muted-foreground mt-1">{plan.priceNote}</p>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={`mailto:enterprise@storymagicapp.net?subject=${encodeURIComponent(`Enterprise Inquiry — ${plan.name}`)}`}
                  className="mt-auto"
                >
                  <Button
                    className={`w-full ${plan.highlighted ? 'brand-gradient brand-gradient-hover' : ''}`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    Contact Sales
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Not sure which plan is right for your team?
          </p>
          <a href="mailto:enterprise@storymagicapp.net">
            <Button size="lg" variant="outline">
              Schedule a Demo
            </Button>
          </a>
        </div>
      </main>
    </div>
  );
}
