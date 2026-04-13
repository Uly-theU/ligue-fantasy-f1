'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';

type League = {
  id: string;
  short_code: string | null;
  name: string;
  status: string;
  season: number;
  draft_mode: string;
  invite_code: string;
  max_players: number;
};


export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  // Create league form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newMode, setNewMode] = useState<'salary_cap' | 'exclusive_draft'>('salary_cap');
  const [creating, setCreating] = useState(false);

  // Join league
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLeagueId, setJoinLeagueId] = useState('');
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchLeagues();
  }, [user, authLoading]);

  async function fetchLeagues() {
    try {
      const data = await apiFetch<{ leagues: League[] }>('/api/leagues');
      setLeagues(data.leagues);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Impossible de charger les ligues', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await apiFetch('/api/leagues', {
        method: 'POST',
        body: JSON.stringify({ name: newName, draft_mode: newMode }),
      });
      setShowCreate(false);
      setNewName('');
      await fetchLeagues();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la création', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoining(true);
    try {
      await apiFetch(`/api/leagues/${joinLeagueId}/join`, {
        method: 'POST',
        body: JSON.stringify({ invite_code: joinCode }),
      });
      setShowJoin(false);
      setJoinCode('');
      setJoinLeagueId('');
      await fetchLeagues();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Impossible de rejoindre la ligue', { variant: 'error' });
    } finally {
      setJoining(false);
    }
  }

  const statusLabel: Record<string, string> = {
    setup: 'Configuration',
    active: 'En cours',
    completed: 'Terminée',
  };

  const statusVariant = (s: string): 'default' | 'secondary' | 'outline' =>
    s === 'active' ? 'default' : s === 'completed' ? 'secondary' : 'outline';

  if (authLoading || loading) {
    return (
      <div className="container py-10">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes Ligues</h1>
          <p className="text-muted-foreground">Gère tes ligues Fantasy F1</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowJoin(!showJoin)}>
            Rejoindre
          </Button>
          <Button onClick={() => setShowCreate(!showCreate)}>
            + Créer une ligue
          </Button>
        </div>
      </div>

      {/* Formulaire création */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvelle ligue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="Nom de la ligue"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="flex-1"
              />
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newMode}
                onChange={(e) => setNewMode(e.target.value as 'salary_cap' | 'exclusive_draft')}
              >
                <option value="salary_cap">💰 Budget Fixe</option>
                <option value="exclusive_draft">🎯 Draft Exclusif</option>
              </select>
              <Button type="submit" disabled={creating}>
                {creating ? 'Création...' : 'Créer'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Formulaire rejoindre */}
      {showJoin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rejoindre une ligue</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="ID de la ligue (6 caractères)"
                value={joinLeagueId}
                onChange={(e) => setJoinLeagueId(e.target.value.toUpperCase())}
                maxLength={6}
                required
              />
              <Input
                placeholder="Code d'invitation (8 caractères)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
              />
              <Button type="submit" disabled={joining}>
                {joining ? 'En cours...' : 'Rejoindre'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des ligues */}
      {leagues.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-lg">Aucune ligue pour le moment</p>
            <p className="text-sm text-muted-foreground mt-1">Crée une ligue ou rejoins-en une avec un code d&apos;invitation !</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {leagues.map((league) => (
            <Link key={league.id} href={`/league/${league.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardContent className="py-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-lg">{league.name}</h3>
                      <Badge variant={statusVariant(league.status)}>
                        {statusLabel[league.status] ?? league.status}
                      </Badge>
                      <Badge variant="outline">
                        {league.draft_mode === 'salary_cap' ? '💰 Budget' : '🎯 Draft'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Saison {league.season} · ID : <code className="bg-muted px-1 rounded font-bold">{league.short_code}</code> · Code d&apos;invitation : <code className="bg-muted px-1 rounded">{league.invite_code}</code>
                    </p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
