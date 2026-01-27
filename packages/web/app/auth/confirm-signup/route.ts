import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email',
    });

    if (!error) {
      // Email confirmed successfully, redirect to dashboard
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  // If verification fails, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
