'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type Driver = {
  id: string;
  name: string;
  short_name: string;
  base_price: number;
  metadata: { team?: string; car_number?: number };
};

type RosterEntry = {
  id: string;
  real_entity_id: string;
  is_starter: boolean;
  is_joker: boolean;
  acquisition_price: number | null;
  real_entity: Driver;
};

type Team = {
  id: string;
  name: string;
  current_budget: number | null;
  total_points: number;
  roster_assignments: RosterEntry[];
};

export default function TeamPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTeam();
  }, [leagueId]);

  async function fetchTeam() {
    try {
      const data = await apiFetch<{ team: Team }>(`/api/teams/${leagueId}`);
      setTeam(data.team);
      setNewName(data.team.name);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Impossible de charger ton équipe', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRename() {
    setSaving(true);
    try {
      await apiFetch(`/api/teams/${leagueId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: newName }),
      });
      await fetchTeam();
      setEditingName(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors du renommage', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveDriver(entityId: string) {
    try {
      await apiFetch(`/api/teams/${leagueId}/roster/${entityId}`, { method: 'DELETE' });
      await fetchTeam();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors du retrait du pilote', { variant: 'error' });
    }
  }

  async function handleSetLineup() {
    if (!team) return;
    const starters = team.roster_assignments.filter((r) => r.is_starter).map((r) => r.real_entity_id);
    const joker = team.roster_assignments.find((r) => r.is_joker)?.real_entity_id;
    try {
      await apiFetch(`/api/teams/${leagueId}/roster`, {
        method: 'PATCH',
        body: JSON.stringify({ starters, joker_id: joker }),
      });
      await fetchTeam();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    }
  }

  function toggleStarter(entityId: string) {
    if (!team) return;
    setTeam({
      ...team,
      roster_assignments: team.roster_assignments.map((r) =>
        r.real_entity_id === entityId ? { ...r, is_starter: !r.is_starter } : r,
      ),
    });
  }

  function setJoker(entityId: string) {
    if (!team) return;
    setTeam({
      ...team,
      roster_assignments: team.roster_assignments.map((r) => ({
        ...r,
        is_joker: r.real_entity_id === entityId ? !r.is_joker : false,
      })),
    });
  }

  function formatPrice(price: number) {
    return `${(price / 1_000_000).toFixed(0)}M$`;
  }

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  if (!team) {
    return (
      <div className="container py-10 text-center space-y-4">
        <p className="text-muted-foreground text-lg">Tu n&apos;as pas encore d&apos;équipe dans cette ligue.</p>
        <Button variant="outline" onClick={() => { setLoading(true); fetchTeam(); }}>Réessayer</Button>
      </div>
    );
  }

  const starters = team.roster_assignments.filter((r) => r.is_starter);
  const bench = team.roster_assignments.filter((r) => !r.is_starter);

  return (
    <div className="container py-10 space-y-6">
      {/* Header équipe */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors text-2xl" aria-label="Retour à la ligue">
            ←
          </Link>
        <div className="space-y-1">
          {editingName ? (
            <div className="flex gap-2 items-center">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-64" />
              <Button size="sm" onClick={handleRename} disabled={saving}>OK</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>✕</Button>
            </div>
          ) : (
            <h1 className="text-3xl font-bold cursor-pointer" onClick={() => setEditingName(true)}>
              {team.name} ✏️
            </h1>
          )}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>🏆 {Number(team.total_points).toFixed(1)} pts</span>
            {team.current_budget !== null && <span>💰 {formatPrice(team.current_budget)} restants</span>}
            <span>👥 {team.roster_assignments.length} pilotes</span>
          </div>
        </div>
        </div>
        <Button onClick={handleSetLineup} size="sm">Sauver l&apos;alignement</Button>
      </div>

      {/* Titulaires */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏁 Titulaires ({starters.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {starters.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun titulaire sélectionné</p>
          ) : (
            <div className="space-y-2">
              {starters.map((r) => (
                <DriverRow
                  key={r.id}
                  entry={r}
                  formatPrice={formatPrice}
                  onToggleStarter={() => toggleStarter(r.real_entity_id)}
                  onToggleJoker={() => setJoker(r.real_entity_id)}
                  onRemove={() => handleRemoveDriver(r.real_entity_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remplaçants */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🪑 Remplaçants ({bench.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {bench.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun remplaçant</p>
          ) : (
            <div className="space-y-2">
              {bench.map((r) => (
                <DriverRow
                  key={r.id}
                  entry={r}
                  formatPrice={formatPrice}
                  onToggleStarter={() => toggleStarter(r.real_entity_id)}
                  onRemove={() => handleRemoveDriver(r.real_entity_id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DriverRow({
  entry,
  formatPrice,
  onToggleStarter,
  onToggleJoker,
  onRemove,
}: {
  entry: RosterEntry;
  formatPrice: (n: number) => string;
  onToggleStarter: () => void;
  onToggleJoker?: () => void;
  onRemove: () => void;
}) {
  const d = entry.real_entity;
  const meta = d.metadata;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
        {d.short_name}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{d.name}</p>
        <p className="text-xs text-muted-foreground">{meta.team} · #{meta.car_number}</p>
      </div>
      <span className="text-xs text-muted-foreground">{formatPrice(d.base_price)}</span>
      {entry.is_joker && <Badge className="bg-yellow-500 text-black">JOKER ×2</Badge>}
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onToggleStarter} title={entry.is_starter ? 'Mettre au banc' : 'Titulariser'} aria-label={entry.is_starter ? 'Mettre au banc' : 'Titulariser'}>
          {entry.is_starter ? '↓' : '↑'}
        </Button>
        {entry.is_starter && onToggleJoker && (
          <Button variant="ghost" size="sm" onClick={onToggleJoker} title="Joker ×2" aria-label="Activer/désactiver le joker">
            🃏
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onRemove} className="text-destructive" title="Retirer" aria-label="Retirer le pilote">
          ✕
        </Button>
      </div>
    </div>
  );
}
