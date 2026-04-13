'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

type LeagueDetail = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  season: number;
  draft_mode: string;
  invite_code: string;
  short_code: string | null;
  max_players: number;
  owner_id: string;
  league_members: Array<{
    user_id: string;
    role: string;
    profiles: { username: string; display_name: string | null; avatar_url: string | null };
  }>;
};

type Gameweek = {
  id: string;
  name: string;
  circuit: string | null;
  country: string | null;
  race_date: string;
  qualifying_date: string | null;
  lock_time: string | null;
  status: string;
  round_number: number;
};

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [nextGP, setNextGP] = useState<Gameweek | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ league: LeagueDetail }>(`/api/leagues/${id}`),
      apiFetch<{ gameweeks: Gameweek[] }>('/api/f1/calendar?season=2026').catch(() => ({ gameweeks: [] })),
    ]).then(([leagueData, calendarData]) => {
      setLeague(leagueData.league);
      const now = new Date();
      const upcoming = calendarData.gameweeks.find((gw) => new Date(gw.race_date) > now);
      setNextGP(upcoming ?? null);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  if (!league) {
    return (
      <div className="container py-10 text-center space-y-4">
        <p className="text-muted-foreground text-lg">Ligue introuvable.</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Réessayer</Button>
      </div>
    );
  }

  const isOwner = user?.id === league.owner_id;

  const navItems = [
    { href: `/league/${id}/team`, label: '🏁 Mon Équipe', always: true },
    { href: `/league/${id}/standings`, label: '📊 Classement', always: true },
    { href: `/league/${id}/market`, label: '💰 Marché', show: league.draft_mode === 'salary_cap' },
    { href: `/league/${id}/draft`, label: '🎯 Draft', show: league.draft_mode === 'exclusive_draft' },
    { href: `/league/${id}/chat`, label: '💬 Chat', always: true },
    { href: `/league/${id}/rules`, label: '📋 Règles', always: true },
  ];

  return (
    <div className="container py-10 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{league.name}</h1>
            <Badge>{league.status === 'active' ? 'En cours' : league.status === 'completed' ? 'Terminée' : 'Configuration'}</Badge>
          </div>
          {league.description && <p className="text-muted-foreground">{league.description}</p>}
          <p className="text-sm text-muted-foreground">
            Saison {league.season} · {league.draft_mode === 'salary_cap' ? '💰 Budget Fixe' : '🎯 Draft Exclusif'}
          </p>
          <p className="text-sm text-muted-foreground">
            ID : <code className="bg-muted px-1 rounded font-bold">{league.short_code ?? league.id.substring(0, 6)}</code> · Code d&apos;invitation : <code className="bg-muted px-1 rounded">{league.invite_code}</code>
          </p>
        </div>
        {isOwner && league.status === 'setup' && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/league/${id}/settings`}>⚙️ Paramètres</Link>
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-2 flex-wrap">
        {navItems.filter((n) => n.always || n.show).map((item) => (
          <Button key={item.href} variant="outline" size="sm" asChild>
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>

      {/* Prochain GP */}
      {nextGP && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg">🏁</span>
                <h3 className="font-semibold">Prochain GP : {nextGP.name}</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                {nextGP.circuit && `${nextGP.circuit} · `}
                {nextGP.country && `${nextGP.country} · `}
                Round {nextGP.round_number}
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-1 text-sm">
              <div>
                <span className="text-muted-foreground">Course : </span>
                <span className="font-medium">
                  {new Date(nextGP.race_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Roster verrouillé : </span>
                <span className="font-medium text-orange-400">
                  {nextGP.lock_time
                    ? new Date(nextGP.lock_time).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
                      + ' à ' + new Date(nextGP.lock_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : nextGP.qualifying_date
                      ? new Date(nextGP.qualifying_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) + ' à 14:00 (début qualifications)'
                      : 'Non défini'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Membres */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Membres ({league.league_members.length}/{league.max_players})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {league.league_members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-3 p-3 rounded-lg border"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-bold">
                  {(m.profiles.display_name ?? m.profiles.username)?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {m.profiles.display_name ?? m.profiles.username}
                  </p>
                  <p className="text-xs text-muted-foreground">@{m.profiles.username}</p>
                </div>
                {m.role === 'owner' && <Badge variant="secondary">Owner</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
