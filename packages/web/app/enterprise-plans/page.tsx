'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check, Building2, Shield, Users, Headphones, Zap, GraduationCap, CheckCircle, Loader2 } from 'lucide-react';

const PLAN_TIERS: Record<string, string> = {
  'Starter Enterprise': 'creator',
  'Professional Enterprise': 'pro',
  'Studio Enterprise': 'studio',
  'Enterprise Unlimited': 'enterprise',
};

const ENTERPRISE_PLANS = [
  {
    name: 'Starter Enterprise',
    seats: '30 user accounts',
    price: '$6,000/year',
    priceNote: 'Upfront annual commitment',
    description: 'Ideal for mid-size talent agencies, production companies, and established film programs.',
    features: [
      '30 user accounts (equivalent to $900/month individually)',
      'Premium voice library — 50+ character voices',
      'Custom voice cloning for up to 5 voices',
      'Advanced collaboration suite (comments, version control, approvals)',
      'Priority audio processing',
      'Custom ambient sound library — 100+ background environments',
      'Advanced analytics dashboard',
      'Phone + email support (24-hour response)',
      'Additional users: $20/month | Bulk 31–75 users: $15/month each',
    ],
    highlighted: false,
  },
  {
    name: 'Professional Enterprise',
    seats: '50 user accounts',
    price: '$10,000/year',
    priceNote: 'Upfront annual commitment',
    description: 'Ideal for growing agencies and production companies managing multiple projects simultaneously.',
    features: [
      '50 user accounts (equivalent to $1,500/month individually)',
      'Everything in Starter Enterprise, plus:',
      'Premium voice library — 75+ character voices',
      'Custom voice cloning for up to 15 voices',
      'Multi-project workspace management',
      'Advanced permissions — reviewer, manager, admin roles',
      'Role-based access control (RBAC) + audit logs',
      'Script version comparison (A/B revisions)',
      'Shared notes + timestamped audio feedback',
      '300+ ambient environments + genre-based sound packs',
      'Additional users: $20/month | Bulk 31–75 users: $15/month each',
    ],
    highlighted: true,
  },
  {
    name: 'Studio Enterprise',
    seats: '75 user accounts',
    price: '$15,000/year',
    priceNote: 'Upfront annual commitment',
    description: 'Designed for major talent agencies, film studios, and large production companies.',
    features: [
      '75 user accounts (equivalent to $2,250/month individually)',
      'Everything in Professional Enterprise, plus:',
      'Unlimited custom voice cloning',
      'Dedicated account manager',
      '24/7 priority support — phone, email, chat',
      'Enterprise-grade security (SSO, advanced permissions)',
      'Custom ambient soundscapes for specific projects',
      'Advanced workflow automation',
      'Detailed reporting suite with exportable analytics',
      'Personalized onboarding and training',
      'Additional users: $20/month | Bulk 76–200 users: $15/month each',
    ],
    highlighted: false,
  },
  {
    name: 'Enterprise Unlimited',
    seats: '200+ user accounts',
    price: 'Custom pricing',
    priceNote: 'Base from $25,000/year · Contact sales',
    description: 'For major studios, large university systems, and enterprise-wide implementations.',
    features: [
      '200+ user accounts (custom)',
      'Everything in Studio Enterprise, plus:',
      'Dedicated infrastructure — private cloud deployment',
      'Custom feature development',
      'SOC 2 Type II + GDPR compliance',
      'Multiple admin hierarchies (department-level)',
      'Advanced usage controls and budget management',
      'Custom voice library development',
      'Exclusive early access to new features and betas',
      'Quarterly business reviews with product team',
      'Volume discounts for multi-year commitments',
    ],
    highlighted: false,
  },
];

const UNIVERSITY_PLANS = [
  {
    name: 'Academic Starter',
    price: '$1,200/year',
    priceNote: '50% off Starter Enterprise',
    seats: '10 student/faculty accounts',
    extra: 'Additional students: $7.50/month · Academic year licensing (Sep–May)',
  },
  {
    name: 'Academic Professional',
    price: '$3,000/year',
    priceNote: '50% off Professional Enterprise',
    seats: '30 student/faculty accounts',
    extra: 'Additional students: $15/month · Summer session access included',
  },
];

const ENTERPRISE_FEATURES = [
  { icon: Shield, title: 'SOC 2 & Compliance', description: 'Enterprise-grade security with content protection standards for the entertainment industry.' },
  { icon: Users, title: 'Team Management', description: 'Role-based access, centralized billing, and usage analytics across your entire organization.' },
  { icon: Zap, title: 'Priority Infrastructure', description: 'Dedicated processing queues, custom integrations, and SLA-backed uptime guarantees.' },
  { icon: Headphones, title: 'Dedicated Support', description: 'Named account managers, on-site training, and direct engineering access.' },
];

export default function EnterprisePlansPage() {
  const router = useRouter();
  const [activating, setActivating] = useState<string | null>(null);
  const [activated, setActivated] = useState<string | null>(null);
  const directUpgradeEnabled = process.env.NEXT_PUBLIC_ALLOW_DIRECT_UPGRADE === 'true';

  const handleActivate = async (planName: string) => {
    const tier = PLAN_TIERS[planName];
    if (!tier) return;
    setActivating(planName);
    try {
      const res = await fetch('/api/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      if (res.ok) {
        setActivated(planName);
        setTimeout(() => router.push('/enterprise/dashboard'), 1500);
      }
    } finally {
      setActivating(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <Link href="/">
              <Image src="/logo.png" alt="Story Magic" width={112} height={112} className="rounded-lg" />
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
            All enterprise packages include annual commitments with upfront payment, advanced admin controls,
            priority support, and bulk user management.
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
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4 mb-16">
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
                {directUpgradeEnabled && plan.name !== 'Enterprise Unlimited' ? (
                  <Button
                    onClick={() => handleActivate(plan.name)}
                    disabled={!!activating || !!activated}
                    className={`w-full mt-auto ${plan.highlighted ? 'brand-gradient brand-gradient-hover' : ''}`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {activated === plan.name ? (
                      <><CheckCircle className="w-4 h-4 mr-2 text-green-500" /> Activated!</>
                    ) : activating === plan.name ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Activating…</>
                    ) : (
                      'Activate Plan'
                    )}
                  </Button>
                ) : (
                  <a
                    href={`mailto:enterprise@storymagicapp.net?subject=${encodeURIComponent(`Enterprise Inquiry — ${plan.name}`)}`}
                    className="mt-auto"
                  >
                    <Button
                      className={`w-full ${plan.highlighted ? 'brand-gradient brand-gradient-hover' : ''}`}
                      variant={plan.highlighted ? 'default' : 'outline'}
                    >
                      {plan.name === 'Enterprise Unlimited' ? 'Contact Sales' : 'Get Started'}
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* University Program */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-3">
            <GraduationCap className="w-6 h-6 text-violet-500" />
            <h2 className="text-2xl font-bold text-foreground">University Program</h2>
            <Badge variant="outline" className="text-violet-600 border-violet-500">Academic Pricing</Badge>
          </div>
          <p className="text-muted-foreground mb-6">
            Exclusive pricing for accredited film schools and university programs.
            Requires academic accreditation verification. Limited to educational use only.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            {UNIVERSITY_PLANS.map((plan) => (
              <Card key={plan.name} className="border-purple-700/50 bg-purple-950/10">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-foreground text-lg">{plan.name}</h3>
                      <p className="text-sm text-muted-foreground">{plan.seats}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-foreground">{plan.price}</p>
                      <p className="text-xs text-green-500 font-medium">{plan.priceNote}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">{plan.extra}</p>
                  <a href={`mailto:enterprise@storymagicapp.net?subject=${encodeURIComponent(`University Program — ${plan.name}`)}`}>
                    <Button variant="outline" size="sm" className="w-full border-purple-700/50">
                      Apply for Academic Pricing
                    </Button>
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Add-On Services */}
        <div className="rounded-xl border border-border bg-background p-6 mb-12">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="font-bold text-foreground">Add-On Services</h3>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <p className="font-medium text-foreground mb-2">Voice</p>
              <p>Professional voice cloning — $500/voice</p>
              <p className="mt-1">Voice coaching consultation — $200/hr</p>
              <p className="mt-1">Celebrity/talent voice licensing — custom</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Audio</p>
              <p>Expanded music library — $200/month</p>
              <p className="mt-1">Custom soundscape development — $1,000/environment</p>
              <p className="mt-1">Premium SFX library — $100/month</p>
            </div>
            <div>
              <p className="font-medium text-foreground mb-2">Professional Services</p>
              <p>Dedicated onboarding — $2,500 one-time</p>
            </div>
          </div>
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
