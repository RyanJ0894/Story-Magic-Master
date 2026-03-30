/**
 * Impact StoryBuilder — Partner Program
 *
 * Three sponsorship tiers with CSR value props targeted at ElevenLabs, Render,
 * Google, Anthropic, and other technology companies.
 */

export interface PartnerTier {
  id: 'community' | 'impact' | 'sustaining';
  name: string;
  annualAmount: number;
  tagline: string;
  description: string;
  benefits: string[];
  storiesPerYear: number;   // estimated stories their contribution funds
  badgeColor: string;       // Tailwind class
  featured: boolean;
}

export const PARTNER_TIERS: PartnerTier[] = [
  {
    id: 'community',
    name: 'Community Partner',
    annualAmount: 2500,
    tagline: 'Start your impact.',
    description:
      'Your contribution directly funds 25 stories per year — giving individuals who have survived trauma, housing instability, and systemic barriers the tools to tell their story in their own voice.',
    benefits: [
      'Logo on Impact page and story gallery',
      'Partner badge on your company profile',
      '25 funded stories annually attributed to your company',
      'Annual impact report with story metrics',
      'Social media recognition (2 posts/year)',
    ],
    storiesPerYear: 25,
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    featured: false,
  },
  {
    id: 'impact',
    name: 'Impact Partner',
    annualAmount: 10000,
    tagline: 'Make a measurable difference.',
    description:
      'At the Impact tier, your company becomes a named sponsor of a full quarterly cohort — 100 stories, one season, one community. This is the tier where you can say you moved the needle.',
    benefits: [
      'Everything in Community',
      'Named "Season Sponsor" for one quarterly cohort',
      'Featured placement on Impact landing page',
      '100 funded stories annually',
      'Co-branded blog post + case study',
      'Speaking opportunity at annual Impact showcase',
      'Quarterly impact reports',
      'Direct contact with story authors (opt-in)',
    ],
    storiesPerYear: 100,
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    featured: true,
  },
  {
    id: 'sustaining',
    name: 'Sustaining Partner',
    annualAmount: 25000,
    tagline: 'Own the mission.',
    description:
      'Sustaining Partners are the foundation this program runs on. At this tier, your company is woven into every piece of Impact content we produce — and you receive co-branding rights for the StoryBuilder platform itself.',
    benefits: [
      'Everything in Impact',
      'Co-branding on the StoryBuilder platform',
      'Dedicated partner page on storymagicapp.net',
      '250+ funded stories annually',
      'Press release announcing partnership',
      'Story selection advisory role (quarterly)',
      'Annual Impact Gala invitation (2 seats)',
      'Custom prize drawing sponsor opportunity',
      'ESG / CSR reporting materials',
    ],
    storiesPerYear: 250,
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    featured: false,
  },
];

/** Technology companies we are actively targeting for the partner program */
export const TARGET_PARTNERS = [
  {
    name: 'ElevenLabs',
    reason: 'Powers the voices behind every story — a natural fit for in-kind or cash support.',
    suggestedTier: 'sustaining' as const,
  },
  {
    name: 'Render',
    reason: 'Our infrastructure partner. Hosting credits offset per-story compute costs.',
    suggestedTier: 'impact' as const,
  },
  {
    name: 'Google',
    reason: 'Gemini powers batch scoring; Google.org has active grants for narrative-for-good projects.',
    suggestedTier: 'impact' as const,
  },
  {
    name: 'Anthropic',
    reason: 'Claude powers StoryScore and story expansion. Strong mission alignment.',
    suggestedTier: 'sustaining' as const,
  },
  {
    name: 'Adobe Foundation',
    reason: 'Storytelling and creative empowerment are core to their social impact mandate.',
    suggestedTier: 'community' as const,
  },
];

export function getTierById(id: string): PartnerTier | undefined {
  return PARTNER_TIERS.find(t => t.id === id);
}
