'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { betaPlayerFromCookie, isLoopbackHost, localAuthUser } from '@/lib/local-auth';
import type { User, SupabaseClient } from '@supabase/supabase-js';

type AuthContext = {
  user: User | null;
  supabase: SupabaseClient | null;
  loading: boolean;
};

const AuthCtx = createContext<AuthContext | null>(null);

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === '1' && isLoopbackHost(window.location.hostname)) {
      const player = betaPlayerFromCookie(document.cookie);
      setUser(player ? localAuthUser(player) : null);
      setLoading(false);
      return;
    }

    const client = createClient();
    setSupabase(client);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    client.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, supabase, loading }}>
      {children}
    </AuthCtx.Provider>
  );
}
