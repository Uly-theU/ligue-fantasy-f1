'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import Link from 'next/link';

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  fantasy_teams: Array<{
    id: string;
    name: string;
    total_points: number;
    league: { id: string; name: string; season: number };
  }>;
  leagues: Array<{
    role: string;
    league: { id: string; name: string; status: string };
  }>;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    try {
      const data = await apiFetch<{ profile: Profile }>('/api/auth/profile');
      setProfile(data.profile);
      setUsername(data.profile.username);
      setDisplayName(data.profile.display_name ?? '');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Impossible de charger le profil', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          username: username || undefined,
          display_name: displayName || undefined,
        }),
      });
      await fetchProfile();
      setEditing(false);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  if (!profile) {
    return <div className="container py-10"><p>Profil introuvable.</p></div>;
  }

  // Trier les équipes par points décroissants
  const sortedTeams = [...profile.fantasy_teams].sort((a, b) => Number(b.total_points) - Number(a.total_points));
  const totalPoints = sortedTeams.reduce((sum, t) => sum + Number(t.total_points), 0);

  return (
    <div className="container py-10 space-y-6 max-w-2xl">
      {/* Profil */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-2xl font-bold">
              {(profile.display_name ?? profile.username)?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Nom d'utilisateur"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={30}
                  />
                  <Input
                    placeholder="Nom d'affichage"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Annuler</Button>
                  </div>
                </div>
              ) : (
                <>
                  <CardTitle>{profile.display_name ?? profile.username}</CardTitle>
                  <CardDescription>@{profile.username} · {user?.email}</CardDescription>
                </>
              )}
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                Modifier
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{profile.leagues.length}</p>
              <p className="text-xs text-muted-foreground">Ligues</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{profile.fantasy_teams.length}</p>
              <p className="text-xs text-muted-foreground">Équipes</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalPoints.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Points totaux</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Équipes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏁 Mes Équipes</CardTitle>
        </CardHeader>
        <CardContent>
          {sortedTeams.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune équipe encore.</p>
          ) : (
            <div className="space-y-3">
              {sortedTeams.map((t) => (
                <Link key={t.id} href={`/league/${t.league.id}/team`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                    <div>
                      <p className="font-medium text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.league.name} · Saison {t.league.season}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{Number(t.total_points).toFixed(1)}</p>
                      <p className="text-xs text-muted-foreground">pts</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ligues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🏆 Mes Ligues</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {profile.leagues.map((l) => (
              <Link key={l.league.id} href={`/league/${l.league.id}`}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                  <p className="font-medium text-sm">{l.league.name}</p>
                  <div className="flex gap-2">
                    <Badge variant={l.league.status === 'active' ? 'default' : 'secondary'}>
                      {l.league.status}
                    </Badge>
                    {l.role === 'owner' && <Badge variant="outline">Owner</Badge>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Info compte */}
      <p className="text-xs text-muted-foreground text-center">
        Membre depuis le {new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
    </div>
  );
}
