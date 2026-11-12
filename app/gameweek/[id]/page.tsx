'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { CircuitSheetCard, type CircuitSheet } from '@/components/f1/circuit-sheet';

type Performance = {
  id: string;
  results: {
    race_position: number | null;
    qualifying_session: string | null;
    fastest_lap: boolean;
    dotd: boolean;
    dnf: string | null;
    positions_gained: number;
  };
  real_entity: {
    name: string;
    short_name: string;
    metadata: { team?: string };
  };
};

type Gameweek = {
  id: string;
  name: string;
  circuit: string | null;
  country: string | null;
  race_date: string;
  status: string;
  round_number: number;
  season: number;
  performances: Performance[];
};

export default function GameweekPage() {
  const { id } = useParams<{ id: string }>();
  const [gw, setGw] = useState<Gameweek | null>(null);
  const [circuitSheet, setCircuitSheet] = useState<CircuitSheet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ gameweek: Gameweek; circuit_sheet: CircuitSheet | null }>(`/api/gameweeks/${id}`)
      .then((d) => {
        setGw(d.gameweek);
        setCircuitSheet(d.circuit_sheet);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  if (!gw) {
    return <div className="container py-10"><p>GP introuvable.</p></div>;
  }

  // Sort performances by race position
  const sorted = [...gw.performances].sort((a, b) => {
    const pa = a.results.race_position ?? 99;
    const pb = b.results.race_position ?? 99;
    return pa - pb;
  });

  const statusMap: Record<string, string> = {
    upcoming: '📅 À venir',
    locked: '🔒 Verrouillé',
    live: '🔴 En direct',
    completed: '✅ Terminé',
  };

  return (
    <div className="container py-10 space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{gw.name}</h1>
          <Badge>{statusMap[gw.status] ?? gw.status}</Badge>
        </div>
        <p className="text-muted-foreground">
          {gw.circuit} · {gw.country} · Round {gw.round_number} · {new Date(gw.race_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {circuitSheet && <CircuitSheetCard sheet={circuitSheet} />}

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Résultats pas encore disponibles.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Résultats de la course</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sorted.map((p, idx) => {
                const r = p.results;
                const medalEmoji = ['🥇', '🥈', '🥉'];
                const pos = r.race_position;

                return (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="w-10 text-center text-lg font-bold">
                      {pos && pos <= 3 ? medalEmoji[pos - 1] : pos ? `P${pos}` : 'DNF'}
                    </div>
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {p.real_entity.short_name}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{p.real_entity.name}</p>
                      <p className="text-xs text-muted-foreground">{p.real_entity.metadata.team}</p>
                    </div>
                    <div className="flex gap-1">
                      {r.fastest_lap && <Badge variant="outline" className="text-xs">⚡ Meilleur tour</Badge>}
                      {r.dotd && <Badge variant="outline" className="text-xs">⭐ DOTD</Badge>}
                      {r.qualifying_session && <Badge variant="secondary" className="text-xs">{r.qualifying_session}</Badge>}
                      {r.dnf && <Badge variant="destructive" className="text-xs">DNF ({r.dnf})</Badge>}
                      {r.positions_gained > 0 && (
                        <Badge variant="outline" className="text-xs text-green-500">↑{r.positions_gained}</Badge>
                      )}
                      {r.positions_gained < 0 && (
                        <Badge variant="outline" className="text-xs text-red-500">↓{Math.abs(r.positions_gained)}</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
