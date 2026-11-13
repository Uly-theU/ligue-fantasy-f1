'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { ClassementLigue, type LigneClassementLigue } from '@/components/clm/arcade/ClassementLigue';
import { useToast } from '@/components/ui/toast';
import { apiFetch, ApiError } from '@/lib/api';
import {
  clmPlayerLabel,
  formatClmGap,
  formatClmSectors,
  formatClmTime,
  type LeagueClmRow,
} from '@/lib/clm-league';
import { pickWeekend, type WeekendGameweek } from '@/lib/weekend';

type ClmGameweek = {
  id: string;
  name: string;
  round_number: number;
  circuit: string | null;
};

type ClmResponse = {
  gameweek: ClmGameweek;
  ranking: LeagueClmRow[];
};

export default function LeagueClmPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const userId = user?.id;
  const [gameweek, setGameweek] = useState<ClmGameweek | null>(null);
  const [ranking, setRanking] = useState<LeagueClmRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading || userId) return;
    router.push('/login');
  }, [authLoading, userId, router]);

  useEffect(() => {
    if (authLoading || !userId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setEmpty(null);
      try {
        const gameweekId = await resolveGameweek(leagueId);
        if (cancelled) return;
        if (!gameweekId) {
          setGameweek(null);
          setRanking(null);
          setEmpty('Aucun Grand Prix à classer pour cette saison.');
          return;
        }
        const data = await apiFetch<ClmResponse>(`/api/leagues/${leagueId}/clm?gameweek=${gameweekId}`);
        if (cancelled) return;
        setGameweek(data.gameweek);
        setRanking(data.ranking);
      } catch (reason) {
        if (cancelled) return;
        const message = reason instanceof ApiError ? reason.message : 'Impossible de charger le classement.';
        setGameweek(null);
        setRanking(null);
        setError(message);
        toast(message, { variant: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId, leagueId, toast, attempt]);

  return (
    <div className="container space-y-6 py-10">
      <div className="flex items-center gap-3">
        <Link
          href={`/league/${leagueId}`}
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Retour à la ligue"
        >
          ←
        </Link>
        <h1 className="text-3xl font-bold">Contre-la-montre</h1>
      </div>

      {loading ? (
        <section className="clm-arcade" aria-busy="true" aria-label="Classement contre-la-montre">
          <h2 className="clm-arcade__titre">Classement</h2>
          <p>Chargement du classement…</p>
        </section>
      ) : error ? (
        <section className="clm-arcade" aria-label="Classement contre-la-montre">
          <h2 className="clm-arcade__titre">Classement</h2>
          <p>{error}</p>
          <div className="clm-arcade__actions">
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>
              Réessayer
            </button>
          </div>
        </section>
      ) : empty ? (
        <section className="clm-arcade" aria-label="Classement contre-la-montre">
          <h2 className="clm-arcade__titre">Classement</h2>
          <p>{empty}</p>
        </section>
      ) : gameweek && ranking && ranking.length === 0 ? (
        <section className="clm-arcade" aria-label="Classement contre-la-montre">
          <h2 className="clm-arcade__titre">Classement</h2>
          <p>Aucun membre dans cette ligue.</p>
        </section>
      ) : gameweek && ranking ? (
        <ClassementLigue detail={gameweekDetail(gameweek)} lignes={toLignes(ranking, userId)} />
      ) : null}
    </div>
  );
}

async function resolveGameweek(leagueId: string): Promise<string | null> {
  const requested = new URLSearchParams(window.location.search).get('gameweek');
  if (requested) return requested;
  const leagueData = await apiFetch<{ league: { season: number } }>(`/api/leagues/${leagueId}`);
  const calendar = await apiFetch<{ gameweeks: WeekendGameweek[] }>(
    `/api/f1/calendar?season=${leagueData.league.season}`,
  );
  return pickWeekend(calendar.gameweeks, new Date())?.id ?? null;
}

function gameweekDetail(gameweek: ClmGameweek): string {
  const circuit = gameweek.circuit ? ` · ${gameweek.circuit}` : '';
  return `Manche ${gameweek.round_number} · ${gameweek.name}${circuit}`;
}

function toLignes(ranking: LeagueClmRow[], userId: string | undefined): LigneClassementLigue[] {
  return ranking.map((row) => ({
    id: row.user_id,
    rang: row.rank,
    joueur: clmPlayerLabel(row),
    temps: row.official_time == null ? null : formatClmTime(row.official_time),
    secteurs: row.sectors == null ? null : formatClmSectors(row.sectors),
    ecart: row.rank == null ? null : formatClmGap(row.gap, row.rank),
    courant: row.user_id === userId,
  }));
}
