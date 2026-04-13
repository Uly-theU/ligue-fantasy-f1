'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

type Standing = {
  rank: number;
  team_id: string;
  team_name: string;
  user: { username: string; display_name: string | null; avatar_url: string | null };
  total_points: number;
  scores_by_round: Array<{ round: number; gp_name: string; points: number }>;
};

export default function StandingsPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ standings: Standing[] }>(`/api/leagues/${leagueId}/standings`)
      .then((d) => setStandings(d.standings))
      .finally(() => setLoading(false));
  }, [leagueId]);

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  const medalEmoji = ['🥇', '🥈', '🥉'];

  return (
    <div className="container py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Retour à la ligue">
          ←
        </Link>
        <h1 className="text-3xl font-bold">📊 Classement</h1>
      </div>

      {standings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun résultat encore. Le classement apparaîtra après le premier GP.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {standings.map((s) => (
            <Card key={s.team_id} className={s.rank <= 3 ? 'border-yellow-500/30' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Rang */}
                  <div className="text-2xl font-bold w-12 text-center">
                    {s.rank <= 3 ? medalEmoji[s.rank - 1] : s.rank}
                  </div>

                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold shrink-0">
                    {(s.user.display_name ?? s.user.username)?.[0]?.toUpperCase() ?? '?'}
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{s.team_name}</p>
                    <p className="text-xs text-muted-foreground">
                      @{s.user.username}
                    </p>
                  </div>

                  {/* Scores par round (mini sparkline en texte) */}
                  <div className="hidden md:flex gap-1 items-center">
                    {s.scores_by_round.slice(-5).map((sr) => (
                      <Badge key={sr.round} variant="outline" className="text-xs" title={`${sr.gp_name}: ${sr.points} pts`}>
                        R{sr.round}: {sr.points}
                      </Badge>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="text-right">
                    <p className="text-2xl font-bold">{s.total_points.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">points</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
