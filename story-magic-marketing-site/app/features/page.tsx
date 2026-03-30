import { Nav } from '@/components/nav';
import { Footer } from '@/components/footer';
import {
  Mic2,
  Music2,
  Volume2,
  BarChart3,
  MessageSquare,
  FileText,
  Shield,
  Zap,
  Globe,
} from 'lucide-react';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.storymagicapp.net';

const FEATURE_GROUPS = [
  {
    title: 'AI Production',
    description: 'The full Director pipeline — from raw screenplay to final mixed audio.',
    features: [
      {
        icon: Mic2,
        title: 'AI Voice Casting',
        description:
          'Our Director agent reads your script and assigns voices based on character age, gender, personality, and tone — from a library of 50+ premium ElevenLabs voices. Each character gets a consistent voice across the entire production.',
      },
      {
        icon: Music2,
        title: 'Scene-Aware Music',
        description:
          'Background music is selected and mixed per-scene based on genre tags, emotional beat, and pacing. Tension, relief, romance, and action — all scored automatically.',
      },
      {
        icon: Volume2,
        title: 'Layered Sound Design',
        description:
          'Ambience layers (office hum, rain, city noise) and spot effects (doors, footsteps, impacts) are synchronized to dialogue and action lines using NLP scene parsing.',
      },
    ],
  },
  {
    title: 'Story Intelligence',
    description: 'Analytical tools that help you improve your script before you produce.',
    features: [
      {
        icon: BarChart3,
        title: 'StoryScore Analysis',
        description:
          'A multi-dimensional score across pacing, dialogue balance, conflict density, act structure, and emotional arc. Benchmarked against our corpus of 45+ produced films.',
      },
      {
        icon: MessageSquare,
        title: 'Story Adviser',
        description:
          'AI editorial feedback grounded in your story: character arc gaps, structural weaknesses, scene-level suggestions — all referenced to specific page numbers in your script.',
      },
    ],
  },
  {
    title: 'Export & Integration',
    description: 'Production-ready outputs in industry-standard formats.',
    features: [
      {
        icon: FileText,
        title: 'Production Reports',
        description:
          'PDF reports with character voice assignments, scene timing breakdowns, music cue sheets, and sound design notes — ready for your production team.',
      },
      {
        icon: Zap,
        title: 'Broadcast-Quality Audio',
        description:
          'M4A (AAC, 48kHz, 192kbps) mastered to EBU R128 -16 LUFS with -1.5 dB true peak limiting. Equal-power crossfades between scenes for seamless playback.',
      },
    ],
  },
  {
    title: 'Enterprise & Security',
    description: 'Built for studios with compliance requirements.',
    features: [
      {
        icon: Shield,
        title: 'Content Protection',
        description:
          'Scripts are processed in isolated job sandboxes with no cross-tenant data access. Stored content is encrypted at rest. TPN/MPAA compliance roadmap in progress.',
      },
      {
        icon: Globe,
        title: 'High Availability',
        description:
          '99.9% SLA target with auto-scaling on Render.com. Redis-backed job queue ensures no script is lost on restart. Sentry monitoring with PagerDuty alerting.',
      },
    ],
  },
];

export const metadata = {
  title: 'Features — Story Magic',
  description: 'Full feature breakdown for the Story Magic AI audio production platform.',
};

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-foreground)]">
      <Nav />

      <section className="pt-32 pb-16 px-4 sm:px-6 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4">Platform Features</h1>
        <p className="text-lg text-[var(--color-muted-foreground)] max-w-2xl mx-auto">
          Everything inside Story Magic — from script parsing to broadcast-quality audio export.
        </p>
      </section>

      {FEATURE_GROUPS.map((group) => (
        <section key={group.title} className="py-16 px-4 sm:px-6 border-t border-[var(--color-border)]">
          <div className="max-w-5xl mx-auto">
            <div className="mb-10">
              <h2 className="text-2xl font-bold mb-2">{group.title}</h2>
              <p className="text-[var(--color-muted-foreground)]">{group.description}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-6">
              {group.features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-brand-600/15 flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-brand-500" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-[var(--color-muted-foreground)] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}

      <section className="py-16 px-4 sm:px-6 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to try it?</h2>
        <p className="text-[var(--color-muted-foreground)] mb-8">
          Start free — no credit card required.
        </p>
        <a
          href={`${APP_URL}/signup`}
          className="inline-block px-8 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 transition-colors"
        >
          Get Started Free
        </a>
      </section>

      <Footer />
    </div>
  );
}
