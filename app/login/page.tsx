'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PhotoPlate } from '@/components/ui/photo-plate';
import { BETA_PLAYERS, betaPlayerCookie, isLoopbackHost } from '@/lib/local-auth';

export default function LoginPage() {
  const { supabase, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [gate, setGate] = useState<'unknown' | 'beta' | 'supabase'>('unknown');

  useEffect(() => {
    const beta = process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === '1' && isLoopbackHost(window.location.hostname);
    setGate(beta ? 'beta' : 'supabase');
  }, []);

  useEffect(() => {
    if (gate === 'unknown' || authLoading) return;
    if (user) router.replace('/dashboard');
  }, [gate, authLoading, user, router]);

  function choosePlayer(id: string) {
    document.cookie = betaPlayerCookie(id);
    window.location.assign('/dashboard');
  }

  const handleGoogleLogin = async () => {
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) setMessage(error.message);
    setLoading(false);
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage('Lien de connexion envoyé ! Vérifie ta boîte mail.');
    }
    setLoading(false);
  };

  if (gate === 'unknown' || authLoading || user) {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4">
        <div className="h-40 w-full max-w-md animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (gate === 'beta') {
    return (
      <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg space-y-6">
          <div className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember">Testeurs</p>
            <h1 className="text-3xl font-semibold tracking-tight">Qui joue ?</h1>
            <p className="text-sm text-muted-foreground">
              Cinq joueurs de test, sans compte. Le choix reste sur cette machine.
            </p>
          </div>
          <ul className="space-y-2">
            {BETA_PLAYERS.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => choosePlayer(player.id)}
                  className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left transition-colors hover:border-white/25"
                >
                  <span>
                    <span className="block font-medium">{player.displayName}</span>
                    <span className="text-sm text-muted-foreground">@{player.username}</span>
                  </span>
                  <span aria-hidden className="text-muted-foreground">→</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-10">
      <PhotoPlate src="/photos/circuits/mclaren.jpg" alt="" scrim="veil" className="w-full max-w-md">
      <Card className="w-full border-0 bg-transparent shadow-none backdrop-blur-none">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Connexion</CardTitle>
          <CardDescription>Connecte-toi pour accéder à tes ligues</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" variant="outline" onClick={handleGoogleLogin} disabled={loading}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuer avec Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-night/70 px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-3">
            <Input
              type="email"
              placeholder="ton@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Envoi...' : 'Recevoir un lien magique'}
            </Button>
          </form>

          {message && (
            <p className="text-sm text-center text-muted-foreground">{message}</p>
          )}
        </CardContent>
      </Card>
      </PhotoPlate>
    </div>
  );
}
