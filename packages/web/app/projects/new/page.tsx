'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Loader2, Sparkles, Wand2 } from 'lucide-react';

// Demo script for development testing
const DEMO_SCRIPT = `INT. COFFEE SHOP - MORNING

SARAH, 28, a software developer, sits at a corner table with her laptop. MARCUS, 35, her older brother, approaches with two coffees.

MARCUS
I got you the usual. Double shot, oat milk.

SARAH
Thanks. Sit down, we need to talk.

MARCUS
That sounds ominous.

He sits across from her, concerned.

SARAH
I'm leaving my job. I got an offer from a startup in Seattle.

MARCUS
Seattle? That's across the country. What about Mom?

SARAH
She'll understand. This is my shot, Marcus. Lead engineer, equity stake, the whole thing.

MARCUS
(sighing)
You always were the brave one.

The BARISTA, 22, calls out from the counter.

BARISTA
Order for Rebecca!

SARAH
Look, I'm not asking for permission. I just wanted you to hear it from me first.

MARCUS
When do you leave?

SARAH
Two weeks.

Marcus stares at his coffee, processing the news.

MARCUS
Then I guess we better make these two weeks count.

He raises his cup. Sarah smiles and clinks hers against it.

FADE OUT.`;

// Feature flag: only show demo button in development
const SHOW_DEMO_BUTTON = process.env.NODE_ENV === 'development';

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Estimate page count (~250 words per page)
  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(wordCount / 250));

  // Load demo script for testing
  const loadDemoScript = () => {
    setName('Coffee Shop Scene');
    setDescription('A brother and sister discuss life changes over coffee');
    setScriptText(DEMO_SCRIPT);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in to create a project');
      router.push('/login');
      return;
    }

    // Check usage limit
    const { data: remaining } = await supabase.rpc('get_remaining_pages', {
      p_user_id: user.id,
    });

    if (remaining !== null && pageCount > remaining) {
      toast.error(`You only have ${remaining} pages remaining. Upgrade to continue.`);
      setLoading(false);
      return;
    }

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name,
        description,
        script_text: scriptText,
        page_count: pageCount,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success('Project created!');
    router.push(`/projects/${project.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold text-slate-900 dark:text-white">New Project</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Create a New Project
              </CardTitle>
              {SHOW_DEMO_BUTTON && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadDemoScript}
                  className="text-violet-600 border-violet-300 hover:bg-violet-50"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Load Demo Script
                </Button>
              )}
            </div>
            <CardDescription>
              Paste your screenplay and we&apos;ll transform it into an immersive audio experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="My Screenplay"
                    className="h-11"
                    data-testid="project-name-input"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="A short description"
                    className="h-11"
                    data-testid="project-description-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="script">Script *</Label>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-slate-500">
                      {wordCount.toLocaleString()} words
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium" data-testid="page-count-display">
                      ~{pageCount} page{pageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <Textarea
                  id="script"
                  value={scriptText}
                  onChange={(e) => setScriptText(e.target.value)}
                  required
                  rows={20}
                  className="font-mono text-sm resize-none"
                  data-testid="script-textarea"
                  placeholder={`Paste your screenplay here...

INT. COFFEE SHOP - DAY

SARAH (30s, tired but determined) sits alone at a corner table, nursing a cold coffee.

SARAH
(to herself)
This is it. Today's the day.

The door CHIMES. MARCUS (40s, distinguished) enters...`}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  This will use <strong className="text-slate-900 dark:text-white">{pageCount}</strong> page{pageCount !== 1 ? 's' : ''} from your quota.
                </p>
                <div className="flex gap-3">
                  <Link href="/dashboard">
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button
                    type="submit"
                    disabled={loading || !name || !scriptText}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                    data-testid="create-project-button"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Project'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
