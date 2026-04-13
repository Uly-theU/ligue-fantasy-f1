import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * Get the authenticated Supabase user or return a 401 response.
 * Usage:
 *   const { user, supabase, errorResponse } = await getAuthUser();
 *   if (errorResponse) return errorResponse;
 */
export async function getAuthUser() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      supabase,
      errorResponse: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, supabase, errorResponse: null };
}
