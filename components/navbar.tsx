'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { StreakField } from '@/components/fx/StreakField';
import { clearBetaPlayerCookie } from '@/lib/local-auth';
import type { User } from '@supabase/supabase-js';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Mes Ligues' },
  { href: '/clm', label: 'CLM' },
  { href: '/profile', label: 'Profil' },
  { href: '/beta', label: 'Beta testeur' },
] as const;

export function Navbar() {
  const { user, supabase, loading } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const betaPlayer = user ? isBetaPlayer(user) : false;

  const handleLogout = async () => {
    if (betaPlayer) {
      document.cookie = clearBetaPlayerCookie();
      window.location.assign('/login');
      return;
    }
    await supabase?.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 w-full overflow-hidden border-b border-white/15 bg-[rgb(12_8_40/0.62)] backdrop-blur-xl">
      <StreakField />
      <div className="relative container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-semibold tracking-tight text-lg" aria-label="Accueil Fantasy F1">
            <span className="flex h-2.5 w-2.5 rounded-full bg-ember shadow-[0_0_12px_rgb(225_6_0/0.85)]" aria-hidden />
            <span>Fantasy <span className="text-ember">F1</span></span>
          </Link>
          {user && (
            <div className="hidden sm:flex items-center gap-6">
              {NAV_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.href === '/clm' ? 'Contre-la-montre' : undefined}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="sm:hidden"
              aria-expanded={menuOpen}
              aria-controls="nav-menu-mobile"
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </Button>
          )}
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          ) : user ? (
            <>
              <span className="text-sm text-muted-foreground hidden md:inline">
                {accountLabel(user)}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                {betaPlayer ? 'Changer de joueur' : 'Déconnexion'}
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Connexion</Link>
            </Button>
          )}
        </div>
      </div>

      {user && menuOpen && (
        <div id="nav-menu-mobile" className="sm:hidden border-t border-white/10 bg-night/50 backdrop-blur-xl">
          <ul className="container flex flex-col py-2">
            {NAV_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  title={item.href === '/clm' ? 'Contre-la-montre' : undefined}
                  className="block py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}

function accountLabel(user: User): string {
  const name = user.user_metadata?.display_name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return user.email ?? 'Joueur';
}

function isBetaPlayer(user: User): boolean {
  return user.email?.endsWith('@beta.local') ?? false;
}
