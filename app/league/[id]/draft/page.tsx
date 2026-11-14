'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { DriverPortrait } from '@/components/ui/driver-portrait';
import { DriverReferenceLines, type DriverCardReference } from '@/components/f1/driver-reference';

type Driver = {
  id: string;
  name: string;
  short_name: string;
  base_price: number;
  metadata: { team?: string; car_number?: number };
  f1_driver?: DriverCardReference | null;
};

type Pick = {
  pick_number: number;
  round_number: number;
  real_entity: Driver;
  profile: { username: string; display_name: string | null };
};

type DraftSession = {
  id: string;
  status: string;
  current_turn: number;
  current_round: number;
  current_player: string | null;
  is_complete: boolean;
  turn_order: string[];
  settings?: { label?: string; window_index?: number; total_picks?: number; draft_type?: DraftType };
};

type DraftStatus = {
  session: DraftSession;
  picks: Pick[];
  available_drivers: Driver[];
};

type DraftType = 'snake_random' | 'snake_reverse_standings' | 'nba_lottery';
type DraftWindowConfig = { label: string; picks_per_player: number; draft_type: DraftType };

const draftTypeLabels: Record<DraftType, string> = {
  snake_random: 'Serpentin aléatoire',
  snake_reverse_standings: 'Serpentin grille inversée',
  nba_lottery: 'Loterie NBA',
};

type DraftStatusResponse = DraftStatus & {
  draft_windows: DraftWindowConfig[];
  completed_count: number;
  can_start_new: boolean;
};

export default function DraftPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [draft, setDraft] = useState<DraftStatus | null>(null);
  const [draftWindows, setDraftWindows] = useState<DraftWindowConfig[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [canStartNew, setCanStartNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const data = await apiFetch<DraftStatusResponse>(`/api/draft/${leagueId}/status`);
      setDraft(data);
      setDraftWindows(data.draft_windows ?? []);
      setCompletedCount(data.completed_count ?? 0);
      setCanStartNew(data.can_start_new ?? false);
    } catch (e: any) {
      // Pas de draft — essayer de récupérer les draft_windows depuis l'erreur 404
      if (e?.data?.draft_windows) {
        setDraftWindows(e.data.draft_windows);
        setCompletedCount(e.data.completed_count ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchStatus();
    // Poll every 5s for live updates (remplacer par Supabase Realtime en v2)
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  async function handleStartDraft() {
    try {
      await apiFetch(`/api/draft/${leagueId}/start`, { method: 'POST' });
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handlePick(driverId: string) {
    setPicking(driverId);
    setError('');
    try {
      await apiFetch(`/api/draft/${leagueId}/pick`, {
        method: 'POST',
        body: JSON.stringify({ real_entity_id: driverId }),
      });
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPicking(null);
    }
  }

  const isMyTurn = draft?.session.current_player === user?.id;

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  const draftLabel = draft?.session.settings?.label ?? 'Draft';
  const nextWindowIndex = completedCount;
  const nextWindow = draftWindows[nextWindowIndex] ?? null;

  // Pas de draft : bouton pour lancer
  if (!draft) {
    return (
      <div className="container py-10 space-y-6 text-center">
        <div className="flex items-center gap-3 justify-center">
          <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Retour à la ligue">
            ←
          </Link>
          <h1 className="text-3xl font-bold">🎯 Draft Exclusif</h1>
        </div>
        {draftWindows.length > 0 ? (
          <>
            <p className="text-muted-foreground">
              {draftWindows.length} période{draftWindows.length > 1 ? 's' : ''} de draft configurée{draftWindows.length > 1 ? 's' : ''}.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {draftWindows.map((w, i) => (
                <Badge key={i} variant={i === 0 ? 'default' : 'secondary'}>
                  {w.label} ({w.picks_per_player} picks · {draftTypeLabels[w.draft_type] ?? 'Serpentin aléatoire'})
                </Badge>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">Le draft n&apos;a pas encore démarré.</p>
        )}
        <Button size="lg" onClick={handleStartDraft}>
          Lancer {nextWindow ? nextWindow.label : 'le Draft'}
        </Button>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors text-2xl" aria-label="Retour à la ligue">
            ←
          </Link>
          <div>
          <h1 className="text-3xl font-bold">🎯 {draftLabel}</h1>
          <p className="text-muted-foreground">
            Round {draft.session.current_round} · Pick #{draft.session.current_turn}
            {draft.session.settings?.draft_type && (
              <> · {draftTypeLabels[draft.session.settings.draft_type]}</>
            )}
          </p>
          </div>
        </div>
        <div className="text-right space-y-2">
          {draft.session.is_complete ? (
            <div className="space-y-2">
              <Badge className="bg-green-600 text-white text-base px-4 py-1">{draftLabel} terminé ✓</Badge>
              {canStartNew && nextWindow && (
                <div>
                  <Button size="sm" onClick={handleStartDraft}>
                    Lancer : {nextWindow.label}
                  </Button>
                </div>
              )}
            </div>
          ) : isMyTurn ? (
            <Badge className="bg-green-600 text-white text-base px-4 py-1 animate-pulse">
              C&apos;est ton tour !
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-base px-4 py-1">
              En attente...
            </Badge>
          )}
        </div>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Historique des picks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">📋 Picks ({draft.picks.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {draft.picks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun pick encore</p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {[...draft.picks].reverse().map((p) => (
                  <div key={p.pick_number} className="flex items-center gap-3 p-2 rounded border text-sm">
                    <span className="text-muted-foreground w-8">#{p.pick_number}</span>
                    <span className="font-medium">{p.real_entity.name}</span>
                    <span className="text-xs text-muted-foreground">({p.real_entity.short_name})</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {p.profile.display_name ?? p.profile.username}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pilotes disponibles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              🏎️ Pilotes disponibles ({draft.available_drivers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {draft.available_drivers.map((d) => (
                <div key={d.id} className="flex items-center gap-3 p-2 rounded border">
                  <DriverPortrait shortName={d.short_name} name={d.name} className="h-9 w-9" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.metadata.team}</p>
                    <DriverReferenceLines driver={d.f1_driver} />
                  </div>
                  {isMyTurn && !draft.session.is_complete && (
                    <Button
                      size="sm"
                      disabled={picking === d.id}
                      onClick={() => handlePick(d.id)}
                    >
                      {picking === d.id ? '...' : 'Drafter'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
