'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCareer, formatPoints } from '@/lib/f1-reference';

export type DriverCardReference = {
  id: string;
  nationality_code: string;
  total_championship_wins: number;
  total_race_wins: number;
  total_podiums: number;
  total_pole_positions: number;
  season: {
    year: number;
    position: number | null;
    points: number;
    wins: number;
  } | null;
  current_constructor: {
    id: string;
    name: string;
    total_championship_wins: number;
    total_race_wins: number;
    total_podiums: number;
    total_pole_positions: number;
  } | null;
};

type SeasonRow = {
  year: number;
  position_text: string;
  points: number;
  wins: number;
  podiums: number;
  poles: number;
  constructor: { name: string } | null;
};

export function DriverReferenceLines({ driver }: { driver: DriverCardReference | null | undefined }) {
  if (!driver) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <p>{formatCareer(driver)}</p>
      {driver.season && (
        <p>
          {driver.season.year}
          {driver.season.position != null ? ` · P${driver.season.position}` : ''}
          {` · ${formatPoints(driver.season.points)} pts`}
          {driver.season.wins > 0 ? ` · ${driver.season.wins} victoire${driver.season.wins > 1 ? 's' : ''}` : ''}
        </p>
      )}
    </div>
  );
}

export function DriverHistory({ entityId }: { entityId: string }) {
  const [seasons, setSeasons] = useState<SeasonRow[] | null>(null);
  const [error, setError] = useState(false);

  async function load(open: boolean) {
    if (!open || seasons || error) return;
    try {
      const data = await apiFetch<{ seasons: SeasonRow[] }>(`/api/f1/drivers/${entityId}`);
      setSeasons(data.seasons);
    } catch {
      setError(true);
    }
  }

  return (
    <details className="text-xs" onToggle={(event) => load(event.currentTarget.open)}>
      <summary className="cursor-pointer text-muted-foreground">Historique par saison</summary>
      {error && <p className="mt-2 text-destructive">Historique indisponible.</p>}
      {seasons && (
        <ul className="mt-2 space-y-1">
          {seasons.map((season) => (
            <li key={season.year} className="flex gap-2 text-muted-foreground">
              <span className="w-12 font-medium text-foreground">{season.year}</span>
              <span className="w-8">P{season.position_text}</span>
              <span className="w-16">{formatPoints(season.points)} pts</span>
              <span className="flex-1 truncate">
                {season.constructor?.name ?? '—'}
                {season.wins > 0 ? ` · ${season.wins} victoire${season.wins > 1 ? 's' : ''}` : ''}
                {season.podiums > 0 ? ` · ${season.podiums} pod.` : ''}
                {season.poles > 0 ? ` · ${season.poles} pôle${season.poles > 1 ? 's' : ''}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
