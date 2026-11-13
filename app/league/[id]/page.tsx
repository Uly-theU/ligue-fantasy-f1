'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch, ApiError } from '@/lib/api';
import { lockTimeLabel } from '@/lib/lock-label';
import { PhotoPlate } from '@/components/ui/photo-plate';
import { circuitPhoto } from '@/lib/photos';
import { useToast } from '@/components/ui/toast';
import {
  pickWeekend,
  rosterSizeFromSettings,
  weekendAction,
  weekendPhase,
  type LineupState,
  type WeekendGameweek,
} from '@/lib/weekend';

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
  settings: unknown;
  league_members: Array<{
    user_id: string;
    role: string;
    profiles: { username: string; display_name: string | null; avatar_url: string | null };
  }>;
};

type RosterEntry = {
  real_entity_id: string;
  is_starter: boolean;
  is_joker: boolean;
};

type TeamSlim = {
  roster_assignments: RosterEntry[];
};

const MODE_LABEL: Record<string, string> = {
  salary_cap: 'Budget fixe',
  exclusive_draft: 'Draft exclusif',
};

export default function LeaguePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [weekend, setWeekend] = useState<WeekendGameweek | null>(null);
  const [lineup, setLineup] = useState<LineupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const leagueData = await apiFetch<{ league: LeagueDetail }>(`/api/leagues/${id}`);
        const [calendarData, teamData] = await Promise.all([
          apiFetch<{ gameweeks: WeekendGameweek[] }>(`/api/f1/calendar?season=${leagueData.league.season}`).catch(() => ({
            gameweeks: [] as WeekendGameweek[],
          })),
          apiFetch<{ team: TeamSlim }>(`/api/teams/${id}`)
            .then((data) => ({ team: data.team, unavailable: false }))
            .catch((reason: unknown) => {
              if (reason instanceof ApiError && reason.status === 404) return { team: null, unavailable: false };
              return { team: null, unavailable: true };
            }),
        ]);
        if (cancelled) return;
        const rosterSize = rosterSizeFromSettings(leagueData.league.settings);
        setLeague(leagueData.league);
        setWeekend(pickWeekend(calendarData.gameweeks, new Date()));
        setLineup(lineupFromTeam(teamData.team, rosterSize, teamData.unavailable));
      } catch (reason) {
        if (cancelled) return;
        setLeague(null);
        setError(reason instanceof ApiError ? reason.message : 'Impossible de charger la ligue.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function copyInvite() {
    if (!league) return;
    try {
      await navigator.clipboard.writeText(league.invite_code);
      toast('Code copié', { variant: 'success' });
    } catch {
      toast('Impossible de copier le code', { variant: 'error' });
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-8">
        <div className="mx-auto h-[28rem] max-w-6xl animate-pulse rounded-3xl bg-muted" />
      </div>
    );
  }

  if (!league) {
    return (
      <div className="container py-10 text-center space-y-4">
        <p className="text-muted-foreground text-lg">{error ?? 'Ligue introuvable.'}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>Réessayer</Button>
      </div>
    );
  }

  const isOwner = user?.id === league.owner_id;
  const phase = weekend ? weekendPhase(weekend, now) : null;
  const action = weekend && phase && lineup
    ? weekendAction({
        leagueId: id,
        phase,
        gameweekId: weekend.id,
        draftMode: league.draft_mode,
        lineup,
      })
    : null;
  const lockLabel = weekend ? lockTimeLabel(weekend.lock_time, now) : null;

  const links = [
    { href: `/league/${id}/team`, label: 'Mon équipe' },
    { href: `/league/${id}/standings`, label: 'Classement' },
    { href: `/league/${id}/clm`, label: 'Contre-la-montre' },
    league.draft_mode === 'salary_cap'
      ? { href: `/league/${id}/market`, label: 'Marché' }
      : { href: `/league/${id}/draft`, label: 'Draft' },
    { href: `/league/${id}/chat`, label: 'Chat' },
    { href: `/league/${id}/rules`, label: 'Règles' },
    ...(isOwner && league.status === 'setup' ? [{ href: `/league/${id}/settings`, label: 'Paramètres' }] : []),
  ].filter((item) => item.href !== action?.href);

  return (
    <div className="px-4 pb-16 pt-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember">
              Saison {league.season}
              {' · '}
              {MODE_LABEL[league.draft_mode] ?? league.draft_mode}
              {league.status === 'setup' ? ' · Configuration' : ''}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{league.name}</h1>
            {league.description && <p className="max-w-xl text-sm text-muted-foreground">{league.description}</p>}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              ID <code className="rounded bg-muted px-1 font-bold text-foreground">{league.short_code ?? league.id.slice(0, 6)}</code>
              {' · '}
              Code <code className="rounded bg-muted px-1 font-bold text-foreground">{league.invite_code}</code>
            </span>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => void copyInvite()}>
              Copier le code
            </Button>
          </div>
        </header>

        {weekend && action && phase ? (
          <PhotoPlate
            src={circuitPhoto(weekend.country, weekend.round_number)}
            alt={weekend.circuit ?? weekend.name}
            scrim="left"
            className="min-h-[28rem]"
          >
            <div className="flex min-h-[28rem] max-w-xl flex-col justify-end gap-5 p-8 sm:p-12">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/75">
                Manche {weekend.round_number}
                {phase === 'locked' ? ' · alignement figé' : ''}
                {phase === 'live' ? ' · en piste' : ''}
                {phase === 'done' ? ' · terminé' : ''}
              </p>
              <div className="space-y-2">
                <h2 className="text-4xl font-semibold tracking-tight sm:text-6xl">{weekend.name}</h2>
                <p className="text-sm text-white/80">
                  {weekend.circuit ? `${weekend.circuit} · ` : ''}
                  {new Date(weekend.race_date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
              </div>
              {phase === 'open' && lockLabel && (
                <div>
                  <p className="text-2xl font-semibold text-ember">{lockLabel.status}</p>
                  {lockLabel.local && <p className="mt-1 text-sm text-white/70">{lockLabel.local}</p>}
                </div>
              )}
              <div className="space-y-3">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href={action.href}>{action.label}</Link>
                </Button>
                <p className="text-sm text-white/80">{action.hint}</p>
              </div>
            </div>
          </PhotoPlate>
        ) : (
          <div className="rounded-3xl border border-white/10 px-8 py-16">
            <h2 className="text-2xl font-semibold">Calendrier indisponible</h2>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              La saison {league.season} n’a pas encore de Grand Prix à afficher.
            </p>
          </div>
        )}

        <nav aria-label="Autour de la ligue" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Membres ({league.league_members.length}/{league.max_players})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {league.league_members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {(member.profiles.display_name ?? member.profiles.username)?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.profiles.display_name ?? member.profiles.username}
                    </p>
                    <p className="text-xs text-muted-foreground">@{member.profiles.username}</p>
                  </div>
                  {member.role === 'owner' && <Badge variant="secondary">Propriétaire</Badge>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function lineupFromTeam(team: TeamSlim | null, rosterSize: number, unavailable: boolean): LineupState {
  if (!team) {
    return {
      hasTeam: false,
      rosterCount: 0,
      starterCount: 0,
      rosterSize,
      hasJoker: false,
      unavailable,
    };
  }
  const starters = team.roster_assignments.filter((entry) => entry.is_starter);
  return {
    hasTeam: true,
    rosterCount: team.roster_assignments.length,
    starterCount: starters.length,
    rosterSize,
    hasJoker: starters.some((entry) => entry.is_joker),
    unavailable: false,
  };
}
