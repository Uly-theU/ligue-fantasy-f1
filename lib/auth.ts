import { headers } from 'next/headers';
import { databaseUnreachable } from '@/lib/prisma';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { ensureProfile } from '@/lib/ensure-profile';
import { betaPlayerFromCookie, localAuthUser, localBypassForHost } from '@/lib/local-auth';
import type { User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type AuthReader = {
  auth: {
    getUser: () => Promise<{ data: { user: User | null } }>;
  };
};

export async function currentSessionUser(supabase: AuthReader): Promise<User | null> {
  if (localBypassForHost(headers().get('host'))) {
    const player = betaPlayerFromCookie(headers().get('cookie'));
    if (!player) return null;
    const user = localAuthUser(player);
    try {
      await ensureProfile(user);
    } catch (error) {
      if (!databaseUnreachable(error)) throw error;
    }
    return user;
  }

  const user = (await supabase.auth.getUser()).data.user;
  if (user) await ensureProfile(user);
  return user;
}

/**
 * Get the authenticated Supabase user or return a 401 response.
 * Usage:
 *   const { user, supabase, errorResponse } = await getAuthUser();
 *   if (errorResponse) return errorResponse;
 */
export async function getAuthUser() {
  const bypass = localBypassForHost(headers().get('host'));
  const supabase = bypass ? null : createServerSupabaseClient();
  const user = await currentSessionUser(
    supabase ?? { auth: { getUser: async () => ({ data: { user: null } }) } },
  );

  if (!user) {
    return {
      user: null,
      supabase,
      errorResponse: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, supabase, errorResponse: null };
}
