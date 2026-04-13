'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const { user, supabase, loading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2 font-bold text-lg" aria-label="Accueil Fantasy F1">
            🏎️ <span className="hidden sm:inline">Fantasy F1</span>
          </Link>
          {user && (
            <>
              <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Mes Ligues
              </Link>
              <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Profil
              </Link>
              <Link href="/beta" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Beta testeur
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          ) : user ? (
            <>
              <span className="text-sm text-muted-foreground hidden md:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Déconnexion
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">Connexion</Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
