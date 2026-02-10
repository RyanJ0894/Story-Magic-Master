import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  FileText,
  Sparkles,
  BarChart3,
  Lightbulb,
  GitBranch,
  Volume2,
  CreditCard,
  HelpCircle,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

export const metadata = {
  title: 'User Guide | Story Magic',
  description: 'Learn how to use Story Magic to transform your scripts into immersive audio experiences',
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">Story Magic</span>
            </Link>

            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                User Guide
              </h1>
              <p className="text-muted-foreground">
                Everything you need to know about Story Magic
              </p>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { href: '#getting-started', icon: Sparkles, label: 'Getting Started' },
                { href: '#storyscore', icon: BarChart3, label: 'StoryScore Analysis' },
                { href: '#story-adviser', icon: Lightbulb, label: 'Story-Adviser' },
                { href: '#revisions', icon: GitBranch, label: 'Revisions' },
                { href: '#audio-generation', icon: Volume2, label: 'Audio Generation' },
                { href: '#billing', icon: CreditCard, label: 'Billing & Plans' },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                >
                  <item.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  <span className="font-medium text-foreground">{item.label}</span>
                  <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Getting Started */}
        <section id="getting-started" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Getting Started</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>
                Story Magic transforms your screenplays and scripts into professional-quality audio
                experiences using AI-powered voice synthesis, intelligent music selection, and
                immersive sound design.
              </p>

              <h3>Creating Your First Project</h3>
              <ol>
                <li>
                  <strong>Click "New Project"</strong> from your dashboard
                </li>
                <li>
                  <strong>Upload your script</strong> - You can paste text directly or upload a PDF
                  file (up to 120 pages)
                </li>
                <li>
                  <strong>Review the analysis</strong> - Story Magic will parse your script and
                  identify characters, scenes, and dialogue
                </li>
                <li>
                  <strong>Generate audio</strong> - Click generate to create your immersive audio
                  experience
                </li>
              </ol>

              <h3>Supported Script Formats</h3>
              <ul>
                <li>
                  <strong>Plain text</strong> - Paste directly into the editor
                </li>
                <li>
                  <strong>PDF</strong> - Industry-standard screenplay PDFs
                </li>
                <li>
                  <strong>Fountain</strong> - Popular screenplay markup format
                </li>
              </ul>

              <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-violet-800 dark:text-violet-200 m-0">
                  <strong>Tip:</strong> For best results, use properly formatted screenplays with
                  clear character names, dialogue, and scene headings.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* StoryScore */}
        <section id="storyscore" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">StoryScore Analysis</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>
                StoryScore is our AI-powered script quality analysis system that evaluates your
                screenplay across multiple storytelling dimensions, providing actionable insights
                to improve your script.
              </p>

              <h3>Score Dimensions</h3>
              <p>Your script is analyzed across four key dimensions:</p>

              <div className="not-prose grid gap-3 my-4">
                {[
                  {
                    title: 'Premise & Originality',
                    description:
                      'How unique and compelling is your central concept? Does it offer a fresh perspective?',
                  },
                  {
                    title: 'Dialogue Quality',
                    description:
                      'Is the dialogue natural, distinctive per character, and does it serve the story?',
                  },
                  {
                    title: 'Three-Act Integrity',
                    description:
                      'Does your script have proper structure with clear setup, confrontation, and resolution?',
                  },
                  {
                    title: 'Protagonist Arc',
                    description:
                      'Does your main character have a clear journey with meaningful transformation?',
                  },
                ].map((dim, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border"
                  >
                    <h4 className="font-semibold text-foreground mb-1">
                      {dim.title}
                    </h4>
                    <p className="text-sm text-muted-foreground m-0">
                      {dim.description}
                    </p>
                  </div>
                ))}
              </div>

              <h3>Understanding Your Score</h3>
              <ul>
                <li>
                  <strong>90-100:</strong> Exceptional - Your script excels in this dimension
                </li>
                <li>
                  <strong>70-89:</strong> Strong - Solid foundation with room for polish
                </li>
                <li>
                  <strong>50-69:</strong> Developing - Good start, focus improvements here
                </li>
                <li>
                  <strong>Below 50:</strong> Needs Work - Priority area for revision
                </li>
              </ul>

              <h3>Score Trajectory</h3>
              <p>
                As you revise your script, Story Magic tracks your score changes over time. The
                Score Trajectory chart shows how your script has improved through revisions,
                helping you see the impact of your changes.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Story-Adviser */}
        <section id="story-adviser" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Lightbulb className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Story-Adviser</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>
                Story-Adviser is your AI writing companion that provides targeted, actionable
                suggestions to improve your script based on StoryScore analysis.
              </p>

              <h3>Types of Suggestions</h3>
              <ul>
                <li>
                  <strong>Dialogue improvements</strong> - More natural speech patterns,
                  character-specific voice
                </li>
                <li>
                  <strong>Structure recommendations</strong> - Pacing adjustments, scene ordering
                </li>
                <li>
                  <strong>Character development</strong> - Deeper arcs, clearer motivations
                </li>
                <li>
                  <strong>Visual storytelling</strong> - Show-don&apos;t-tell opportunities
                </li>
              </ul>

              <h3>Working with Suggestions</h3>
              <ol>
                <li>Review each suggestion and its rationale</li>
                <li>
                  <strong>Accept</strong> suggestions you agree with to automatically apply them
                </li>
                <li>
                  <strong>Modify</strong> suggestions to fit your vision before applying
                </li>
                <li>
                  <strong>Reject</strong> suggestions that don&apos;t fit your story - this helps
                  Story-Adviser learn your preferences
                </li>
              </ol>

              <h3>Providing Feedback</h3>
              <p>
                Your feedback on suggestions helps improve Story-Adviser. When rejecting a
                suggestion, you can specify why (not relevant, already addressed, disagree with
                approach, etc.) to help refine future suggestions.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Revisions */}
        <section id="revisions" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Revision System</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>
                Story Magic maintains a complete history of your script revisions, allowing you to
                track changes, compare versions, and understand how your script has evolved.
              </p>

              <h3>Revision Timeline</h3>
              <p>
                The Revision Timeline shows every version of your script with timestamps and
                scores. You can:
              </p>
              <ul>
                <li>View any previous version of your script</li>
                <li>See how scores changed between revisions</li>
                <li>Restore earlier versions if needed</li>
              </ul>

              <h3>Comparing Revisions</h3>
              <p>
                The Diff View lets you compare any two versions of your script side-by-side,
                highlighting:
              </p>
              <ul>
                <li>
                  <span className="text-green-600 dark:text-green-400 font-semibold">
                    Added lines
                  </span>{' '}
                  - New content in the newer version
                </li>
                <li>
                  <span className="text-red-600 dark:text-red-400 font-semibold">Removed lines</span>{' '}
                  - Content deleted from the older version
                </li>
                <li>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                    Modified lines
                  </span>{' '}
                  - Lines that were changed
                </li>
              </ul>

              <h3>Auto-Save</h3>
              <p>
                Your work is automatically saved as you edit. New revisions are created when you:
              </p>
              <ul>
                <li>Apply Story-Adviser suggestions</li>
                <li>Manually save a new version</li>
                <li>Generate new audio</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Audio Generation */}
        <section id="audio-generation" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Audio Generation</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>
                Story Magic transforms your script into a fully-produced audio experience with
                professional voice acting, music, ambience, and sound effects.
              </p>

              <h3>The Audio Pipeline</h3>
              <ol>
                <li>
                  <strong>Script Parsing</strong> - Characters, dialogue, and scenes are identified
                </li>
                <li>
                  <strong>Voice Casting</strong> - AI selects appropriate voices based on character
                  descriptions
                </li>
                <li>
                  <strong>Audio Direction</strong> - Music, ambience, and SFX are selected for each
                  scene
                </li>
                <li>
                  <strong>Voice Synthesis</strong> - High-quality text-to-speech generates dialogue
                </li>
                <li>
                  <strong>Professional Mixing</strong> - All elements are mixed to broadcast
                  standards
                </li>
              </ol>

              <h3>Output Quality</h3>
              <ul>
                <li>
                  <strong>Format:</strong> M4A (AAC codec)
                </li>
                <li>
                  <strong>Loudness:</strong> -16 LUFS (EBU R128 broadcast standard)
                </li>
                <li>
                  <strong>True Peak:</strong> -1 dB maximum
                </li>
              </ul>

              <h3>Processing Time</h3>
              <p>Generation time varies based on script length:</p>
              <ul>
                <li>
                  <strong>Short scripts (1-5 pages):</strong> 2-5 minutes
                </li>
                <li>
                  <strong>Medium scripts (5-30 pages):</strong> 5-15 minutes
                </li>
                <li>
                  <strong>Feature-length (30-120 pages):</strong> 15-60 minutes
                </li>
              </ul>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800 dark:text-blue-200 m-0">
                  <strong>Note:</strong> You&apos;ll receive a notification when your audio is
                  ready. You can navigate away while processing continues in the background.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Billing */}
        <section id="billing" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Billing & Plans</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>Story Magic offers flexible plans to fit your needs.</p>

              <h3>Available Plans</h3>
              <div className="not-prose grid gap-3 my-4">
                {[
                  {
                    name: 'Free',
                    pages: '3 pages/month',
                    features: ['Basic voice selection', 'Standard audio quality'],
                  },
                  {
                    name: 'Creator',
                    pages: '50 pages/month',
                    features: [
                      'Premium voices',
                      'StoryScore analysis',
                      'Story-Adviser suggestions',
                    ],
                  },
                  {
                    name: 'Pro',
                    pages: '200 pages/month',
                    features: ['All Creator features', 'Priority processing', 'Revision history'],
                  },
                  {
                    name: 'Studio',
                    pages: '1,000 pages/month',
                    features: ['All Pro features', 'API access', 'Custom voice cloning'],
                  },
                ].map((plan, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-foreground">{plan.name}</h4>
                      <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                        {plan.pages}
                      </span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {plan.features.map((f, j) => (
                        <li key={j}>• {f}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <h3>Usage Tracking</h3>
              <p>
                Your usage is tracked by script pages processed. You can see your current usage in
                the dashboard header. Usage resets at the start of each billing cycle.
              </p>

              <h3>Upgrading Your Plan</h3>
              <p>
                You can upgrade your plan at any time from your account settings. Upgrades take
                effect immediately, and you&apos;ll receive prorated credit for your current plan.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Help */}
        <section id="help" className="mb-12 scroll-mt-20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Need Help?</h2>
          </div>

          <Card>
            <CardContent className="pt-6 prose dark:prose-invert max-w-none">
              <p>We&apos;re here to help you get the most out of Story Magic.</p>

              <h3>Contact Support</h3>
              <p>
                For technical issues or questions, reach out to our support team at{' '}
                <a href="mailto:support@storymagic.ai">support@storymagic.ai</a>
              </p>

              <h3>Frequently Asked Questions</h3>
              <div className="not-prose space-y-3 my-4">
                {[
                  {
                    q: 'Why is my script parsing incorrectly?',
                    a: 'Ensure your script follows standard screenplay formatting with clear character names (in caps), dialogue, and scene headings (INT./EXT.).',
                  },
                  {
                    q: 'Can I customize voice assignments?',
                    a: 'Yes! After initial parsing, you can reassign voices to any character before generating audio.',
                  },
                  {
                    q: 'What happens if audio generation fails?',
                    a: 'Failed generations don\'t count against your page limit. Try again, or contact support if the issue persists.',
                  },
                  {
                    q: 'Can I download my audio in different formats?',
                    a: 'Currently we provide M4A format. MP3 and WAV exports are planned for future releases.',
                  },
                ].map((faq, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-lg border border-border"
                  >
                    <h4 className="font-semibold text-foreground mb-1">{faq.q}</h4>
                    <p className="text-sm text-muted-foreground m-0">{faq.a}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Back to Dashboard */}
        <div className="text-center">
          <Link href="/dashboard">
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-border mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-muted-foreground">
          <p className="mb-2">
            <a
              href="https://www.storymagicapp.net"
              className="text-violet-600 hover:text-violet-700 font-medium"
            >
              www.StoryMagicApp.net
            </a>
          </p>
          <p>&copy; 2026 Story Magic. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
