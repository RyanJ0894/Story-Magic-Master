'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { TIERS } from '@/lib/pricing-data';

interface PricingSectionProps {
  showEnterpriseRow?: boolean;
  compact?: boolean;
}

export function PricingSection({ showEnterpriseRow = true, compact = false }: PricingSectionProps) {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!annual ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
          Monthly
        </span>
        <button
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className={`relative w-12 h-6 rounded-full transition-colors ${annual ? 'bg-brand-600' : 'bg-[var(--color-border)]'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : 'translate-x-0'}`}
          />
        </button>
        <span className={`text-sm font-medium ${annual ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]'}`}>
          Annual
        </span>
        {annual && (
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gold-500/20 text-gold-500 border border-gold-500/30">
            Save 20%
          </span>
        )}
      </div>

      {/* Tier cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {TIERS.map((tier) => {
          const price = annual ? tier.annualMonthlyPrice : tier.monthlyPrice;
          return (
            <div
              key={tier.id}
              className={`relative p-6 rounded-2xl border flex flex-col ${
                tier.popular
                  ? 'border-gold-500 bg-gold-500/5'
                  : 'border-[var(--color-border)] bg-[var(--color-card)]'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gold-500 text-black text-xs font-bold rounded-full whitespace-nowrap">
                  Most Popular
                </div>
              )}
              <div className="mb-1">
                <h3 className="font-bold text-lg">{tier.name}</h3>
                <span className="text-xs text-[var(--color-muted-foreground)] font-medium uppercase tracking-widest">{tier.tagline}</span>
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)] mb-5 mt-1">{tier.description}</p>
              <div className="mb-1">
                <span className="text-3xl font-bold">${price}</span>
                <span className="text-[var(--color-muted-foreground)] text-sm">/mo</span>
              </div>
              {annual && tier.monthlyPrice > 0 && (
                <p className="text-xs text-[var(--color-muted-foreground)] mb-4">
                  ${tier.annualMonthlyPrice * 12}/yr billed annually
                </p>
              )}
              {(!annual || tier.monthlyPrice === 0) && <div className="mb-4" />}
              <a
                href={tier.href}
                className={`block text-center py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors mb-5 ${
                  tier.popular
                    ? 'bg-gold-500 text-black hover:bg-gold-600'
                    : 'border border-[var(--color-border)] hover:bg-[var(--color-muted)]'
                }`}
              >
                {tier.cta}
              </a>
              {!compact && (
                <ul className="space-y-2 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-500 flex-shrink-0 mt-0.5" />
                      <span className="text-[var(--color-muted-foreground)]">{f}</span>
                    </li>
                  ))}
                  {tier.limitations.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <XCircle className="w-3.5 h-3.5 text-[var(--color-muted-foreground)] flex-shrink-0 mt-0.5 opacity-40" />
                      <span className="text-[var(--color-muted-foreground)] opacity-40">{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Enterprise row */}
      {showEnterpriseRow && (
        <div className="mt-6 p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg">Enterprise</h3>
            <p className="text-sm text-[var(--color-muted-foreground)] mt-1">
              Team plans from $2,400/yr for 10 users — up to 200+ users with custom infrastructure, SSO, SOC 2, and dedicated support.
            </p>
          </div>
          <a
            href="mailto:sales@storymagicapp.net"
            className="flex-shrink-0 px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-semibold hover:bg-[var(--color-muted)] transition-colors whitespace-nowrap"
          >
            Contact Sales →
          </a>
        </div>
      )}

      {/* Trial note */}
      <p className="text-center text-xs text-[var(--color-muted-foreground)] mt-6">
        7-day free trial on Starter, Pro, and Creator. Cancel anytime. No charge until trial ends.
      </p>
    </div>
  );
}
