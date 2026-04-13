import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo')

  if (code) {
    const supabase = createServerSupabaseClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  // Rediriger vers la page demandée ou le dashboard par défaut
  const destination = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/dashboard'
  return NextResponse.redirect(new URL(destination, requestUrl.origin))
}
