'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { ClassementLigue, type LigneClassementLigue } from '@/components/clm/arcade/ClassementLigue';
import { TimeTrial } from '@/components/clm/time-trial';
import { useToast } from '@/components/ui/toast';
import { apiFetch, ApiError } from '@/lib/api';
import { bankTrack } from '@/lib/circuit-banking';
import { trackSigns } from '@/lib/circuit-places';
import { fitRoad, metersPerUnit } from '@/lib/clm';
import { parseLapInputs, type ClmInputSpan } from '@/lib/clm-replay';
import { profileAt, smoothElevation, type ElevationSample } from '@/lib/grade';
import { orientTrack, trackFromSvg } from '@/lib/track-path';
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

type ClmTrial = {
  name: string;
  circuit_id: string | null;
  length_km: number | null;
  svg: string;
  elevation: {
    reverse: boolean;
    start: number;
    points: Array<[number, number]>;
  } | null;
  corners: Array<{ number: number; at: number }> | null;
};

type Duel = {
  userId: string;
  label: string;
  spans: ClmInputSpan[];
  trial: ClmTrial;
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
  const [duel, setDuel] = useState<Duel | null>(null);
  const [duelLoading, setDuelLoading] = useState(false);
  const duelLock = useRef(false);

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
      setDuel(null);
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

  const trial = duel?.trial ?? null;
  const track = useMemo(() => {
    if (!trial) return null;
    const drawn = trackFromSvg(trial.svg);
    if (!drawn) return null;
    const raced = trial.elevation ? orientTrack(drawn, trial.elevation) : drawn;
    const heightAt = trial.elevation
      ? (s: number) => profileAt(trial.elevation!.points, raced.length > 0 ? s / raced.length : 0)
      : undefined;
    return bankTrack(fitRoad(raced, trial.length_km ?? 0, heightAt), trial.circuit_id, trial.corners);
  }, [trial]);
  const elevation = useMemo<ElevationSample[] | undefined>(() => {
    if (!trial?.elevation || !track) return undefined;
    const raw = trial.elevation.points.map(([fraction, z]) => ({ s: fraction * track.length, z }));
    return smoothElevation(raw, track.length, metersPerUnit(track, trial.length_km ?? 0), track.closed);
  }, [trial, track]);
  const signs = useMemo(
    () => (trial?.elevation ? trackSigns(trial.circuit_id, trial.corners) : []),
    [trial],
  );

  async function affronter(ligne: LigneClassementLigue) {
    if (!gameweek || duelLock.current) return;
    duelLock.current = true;
    setDuelLoading(true);
    try {
      const data = await apiFetch<{ lap: { inputs: string; circuit_id: string } }>(
        `/api/leagues/${leagueId}/clm?gameweek=${gameweek.id}&user=${ligne.id}`,
      );
      const spans = await parseLapInputs(data.lap.inputs);
      if (!spans || spans.length === 0) {
        toast('Le tour choisi ne peut pas être rejoué.', { variant: 'error' });
        return;
      }
      const course = await apiFetch<{ trial: ClmTrial }>(
        `/api/clm?circuit=${encodeURIComponent(data.lap.circuit_id)}`,
      );
      if (!course.trial?.svg) {
        toast('Le tracé de ce circuit n’est pas disponible.', { variant: 'error' });
        return;
      }
      setDuel({ userId: ligne.id, label: ligne.joueur, spans, trial: course.trial });
    } catch (reason) {
      const message = reason instanceof ApiError ? reason.message : 'Impossible de charger le fantôme.';
      toast(message, { variant: 'error' });
    } finally {
      duelLock.current = false;
      setDuelLoading(false);
    }
  }

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
      ) : gameweek && ranking && duel ? (
        track ? (
          <TimeTrial
            key={`${duel.userId}:${duel.trial.circuit_id ?? gameweek.id}`}
            track={track}
            lengthKm={duel.trial.length_km ?? 0}
            circuitId={duel.trial.circuit_id ?? gameweek.id}
            gameweekId={gameweek.id}
            elevation={elevation}
            signs={signs}
            ghostInputs={duel.spans}
            circuitName={`${duel.trial.name} · ${duel.label}`}
            onLeave={() => setDuel(null)}
            leaveLabel="Classement"
          />
        ) : (
          <section className="clm-arcade" aria-label="Classement contre-la-montre">
            <h2 className="clm-arcade__titre">Classement</h2>
            <p>Ce tracé ne peut pas être parcouru.</p>
            <div className="clm-arcade__actions">
              <button type="button" onClick={() => setDuel(null)}>Retour au classement</button>
            </div>
          </section>
        )
      ) : gameweek && ranking ? (
        <>
          {duelLoading ? <p>Chargement du fantôme…</p> : null}
          <ClassementLigue
            detail={gameweekDetail(gameweek)}
            lignes={toLignes(ranking, userId)}
            onAffronter={(ligne) => { void affronter(ligne); }}
          />
        </>
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
