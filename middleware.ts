import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bearerMatches } from '@/lib/cron-auth';
import { localBypassForHost } from '@/lib/local-auth';

/**
 * Middleware global : rafraîchit la session Supabase + protège les routes /api et /dashboard, /league, /profile.
 * Les routes publiques (/api/auth/callback, /, /login, /register) passent sans check.
 */

const PUBLIC_PATHS = ['/', '/login', '/register', '/api/auth/callback'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Médias publics de l'intro, disponibles avant toute connexion.
  if (pathname.startsWith('/intro/') || pathname.startsWith('/audio/')) {
    return NextResponse.next();
  }

  if (pathname === '/api/health') {
    return NextResponse.next();
  }

  if (pathname === '/api/cron' || pathname.startsWith('/api/cron/')) {
    if (!bearerMatches(req.headers.get('authorization'), process.env.CRON_SECRET)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next({ request: { headers: req.headers } });
  }

  if (localBypassForHost(req.nextUrl.hostname)) {
    return NextResponse.next({ request: { headers: req.headers } });
  }

  let res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '' });
          res = NextResponse.next({ request: { headers: req.headers } });
          res.cookies.set({ name, value: '', ...options });
        },
      },
    },
  );

  // Rafraîchir la session et vérifier le JWT côté serveur
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Laisser passer les routes publiques
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return res;
  }

  // Laisser passer les assets statiques
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) {
    return res;
  }

  // Protéger les pages et API
  if (!user) {
    // API → 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    // Pages → redirect vers /login
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf _next/static, _next/image, favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
