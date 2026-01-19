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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ArrowLeft, FileText, Loader2, Sparkles, Wand2 } from 'lucide-react';

// Show demo button (enabled for demos)
const SHOW_DEMO_BUTTON = true;

export default function NewProjectPage() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [scriptText, setScriptText] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // AI Demo Script Generator state
  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingScript, setGeneratingScript] = useState(false);

  // Estimate page count (~250 words per page)
  const wordCount = scriptText.trim().split(/\s+/).filter(Boolean).length;
  const pageCount = Math.max(1, Math.ceil(wordCount / 250));

  // Generate demo script using AI
  const generateDemoScript = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe the scene you want');
      return;
    }

    setGeneratingScript(true);

    try {
      const response = await fetch('/api/generate-demo-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate script');
      }

      const data = await response.json();

      setName(data.title);
      setDescription(data.description);
      setScriptText(data.script);
      setShowAiDialog(false);
      setAiPrompt('');
      toast.success('Script generated!');
    } catch (error) {
      toast.error('Failed to generate script. Please try again.');
    } finally {
      setGeneratingScript(false);
    }
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
                  onClick={() => setShowAiDialog(true)}
                  className="text-violet-600 border-violet-300 hover:bg-violet-50"
                >
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Demo Script
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

      {/* AI Script Generator Dialog */}
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-500" />
              Generate Demo Script
            </DialogTitle>
            <DialogDescription>
              Describe the scene you want and AI will write a short screenplay for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="E.g., A tense confrontation between a detective and a suspect in a rainy alley at night..."
              rows={4}
              className="resize-none"
              disabled={generatingScript}
            />
            <p className="text-xs text-slate-500">
              The AI will generate a ~1 page scene with proper screenplay formatting.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAiDialog(false)}
              disabled={generatingScript}
            >
              Cancel
            </Button>
            <Button
              onClick={generateDemoScript}
              disabled={generatingScript || !aiPrompt.trim()}
              className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            >
              {generatingScript ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
