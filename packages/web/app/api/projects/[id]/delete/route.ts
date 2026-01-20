import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { validateCsrf } from '@/lib/csrf';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  // CSRF protection
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Delete project (cascade will handle jobs and audio_outputs)
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
