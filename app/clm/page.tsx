'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { TimeTrial } from '@/components/clm/time-trial';
import { CircuitLore } from '@/components/f1/circuit-lore';
import { trackSigns } from '@/lib/circuit-places';
import { apiFetch, ApiError } from '@/lib/api';
import { bankTrack } from '@/lib/circuit-banking';
import { fitRoad, metersPerUnit } from '@/lib/clm';
import { profileAt, smoothElevation, type ElevationSample } from '@/lib/grade';
import { orientTrack, trackFromSvg } from '@/lib/track-path';

type Trial = {
  gameweek_id: string | null;
  name: string;
  circuit: string | null;
  country: string | null;
  round_number: number;
  race_date: string;
  circuit_id: string | null;
  full_name: string | null;
  place_name: string | null;
  length_km: number | null;
  turns: number | null;
  direction_label: string | null;
  svg: string;
  elevation: {
    range_m: number;
    elevation_source: string;
    reverse: boolean;
    start: number;
    points: Array<[number, number]>;
  } | null;
  corners: Array<{ number: number; at: number }> | null;
  next_race: boolean;
};

type CircuitOption = {
  circuit_id: string;
  round: number;
  full_name: string;
  place_name: string | null;
  range_m: number | null;
};

const NEXT_RACE = '';

export default function ClmPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [choice, setChoice] = useState<string | null>(null);
  const [trial, setTrial] = useState<Trial | null>(null);
  const [circuits, setCircuits] = useState<CircuitOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setChoice(new URLSearchParams(window.location.search).get('circuit') ?? NEXT_RACE);
  }, []);

  useEffect(() => {
    if (authLoading || choice == null) return;
    if (!user) {
      router.push('/login?redirectTo=/clm');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiFetch<{ trial: Trial; circuits: CircuitOption[] }>(choice ? `/api/clm?circuit=${encodeURIComponent(choice)}` : '/api/clm')
      .then((data) => {
        if (cancelled) return;
        setTrial(data.trial);
        setCircuits(data.circuits);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof ApiError ? reason.message : 'Impossible de charger le circuit');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, choice]);

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
  // Les virages sont relevés depuis la ligne du profil d'altitude : sans lui, ils tomberaient ailleurs.
  const signs = useMemo(
    () => (trial?.elevation ? trackSigns(trial.circuit_id, trial.corners) : []),
    [trial],
  );

  const pick = (value: string) => {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set('circuit', value);
    else url.searchParams.delete('circuit');
    window.history.replaceState(null, '', url);
    setChoice(value);
  };

  const picker = circuits.length > 0 && (
    <label className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Circuit</span>
      <select
        value={choice ?? NEXT_RACE}
        onChange={(event) => pick(event.target.value)}
        className="h-9 min-w-0 flex-1 rounded-md border border-white/15 bg-[#120e30] px-3 text-sm sm:max-w-md"
      >
        <option value={NEXT_RACE}>Prochain Grand Prix</option>
        {circuits.map((circuit) => (
          <option key={circuit.circuit_id} value={circuit.circuit_id}>
            {`R${circuit.round} · ${circuit.full_name}${circuit.range_m != null ? ` · ${Math.round(circuit.range_m)} m de dénivelé` : ''}`}
          </option>
        ))}
      </select>
    </label>
  );

  if (authLoading || loading) {
    return (
      <div className="container max-w-5xl py-6">
        {picker}
        <div className="h-[min(68vh,720px)] animate-pulse rounded-3xl border border-white/10 bg-white/5" />
      </div>
    );
  }

  if (error || !trial || !track) {
    return (
      <div className="container max-w-5xl py-6">
        {picker}
        <div className="py-16 text-center space-y-4">
          <p className="text-lg">{error ?? 'Ce tracé ne peut pas être parcouru.'}</p>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>Réessayer</Button>
        </div>
      </div>
    );
  }

  const when = new Date(trial.race_date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const facts = [
    trial.length_km != null ? `${trial.length_km.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} km` : null,
    trial.turns != null ? `${trial.turns} virages` : null,
    trial.direction_label,
    trial.elevation ? `${Math.round(trial.elevation.range_m)} m de dénivelé` : null,
  ].filter(Boolean);
  const trialKey = trial.circuit_id ?? trial.gameweek_id ?? 'clm';

  return (
    <div className="container max-w-5xl py-6">
      {picker}
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-ember">
          Contre-la-montre · Round {trial.round_number}{trial.next_race ? ' · Prochain Grand Prix' : ''}
        </p>
        <h1 className="text-3xl font-bold">{trial.name}</h1>
        <p className="text-sm text-muted-foreground">
          {[
            trial.full_name && trial.full_name !== trial.name ? trial.full_name : null,
            trial.place_name,
            when,
          ].filter(Boolean).join(' · ')}
        </p>
        {facts.length > 0 && <p className="text-sm text-muted-foreground">{facts.join(' · ')}</p>}
        <CircuitLore circuitId={trial.circuit_id} />
      </header>
      <TimeTrial
        key={trialKey}
        track={track}
        lengthKm={trial.length_km ?? 0}
        circuitId={trialKey}
        elevation={elevation}
        signs={signs}
      />
      <p className="mt-3 text-center text-[11px] text-white/40">
        Tracé F1DB, CC BY 4.0
        {trial.elevation
          ? trial.elevation.elevation_source === 'opentopodata-srtm30m'
            ? ' · Altitudes NASA SRTM via OpenTopoData · Géoréférencement bacinger/f1-circuits'
            : ' · Altitudes Copernicus DEM via Open-Meteo, CC BY 4.0 · Géoréférencement bacinger/f1-circuits'
          : ''}
        {signs.length > 0 ? ' · Numéros des virages MultiViewer' : ''}
      </p>
    </div>
  );
}
