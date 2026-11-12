import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ensureProfile } from '@/lib/ensure-profile'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')

  if (code) {
    const supabase = createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await ensureProfile(user)
  }

  // Rediriger vers la page demandée ou le dashboard par défaut
  const destination = safeRedirectPath(redirectTo)
  return NextResponse.redirect(new URL(destination, requestUrl.origin))
}
