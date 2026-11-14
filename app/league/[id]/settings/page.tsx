'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeagueDetail {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  draft_mode: 'salary_cap' | 'exclusive_draft';
  max_players: number;
  status: string;
  invite_code: string;
  season: number;
  settings: { roster_size?: number; bench_size?: number; budget?: number; [key: string]: unknown };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeagueSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // --- State ---
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Info fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [rosterSize, setRosterSize] = useState(5);
  const [benchSize, setBenchSize] = useState(2);
  const [budget, setBudget] = useState(100);
  const [savingInfo, setSavingInfo] = useState(false);

  // Draft mode
  const [draftMode, setDraftMode] = useState<'salary_cap' | 'exclusive_draft'>('exclusive_draft');
  const [savingMode, setSavingMode] = useState(false);

  // Draft windows
  type DraftType = 'snake_random' | 'snake_reverse_standings' | 'nba_lottery';
  type DraftWindow = { label: string; picks_per_player: number; draft_type: DraftType };
  const [draftWindows, setDraftWindows] = useState<DraftWindow[]>([
    { label: 'Draft initial', picks_per_player: 5, draft_type: 'snake_random' },
  ]);
  const [savingWindows, setSavingWindows] = useState(false);

  // Scoring rules
  const [rules, setRules] = useState<ScoringRules>(structuredClone(DEFAULT_SCORING_RULES));
  const [savingRules, setSavingRules] = useState(false);

  // Delete
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // --- Auth guard ---
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirectTo=/league/${id}/settings`);
    }
  }, [authLoading, user, router, id]);

  // --- Fetch league + scoring rules ---
  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const { league: l } = await apiFetch<{ league: LeagueDetail }>(`/api/leagues/${id}`);

        // Contrôle d'accès : owner + setup uniquement
        if (l.owner_id !== user!.id || l.status !== 'setup') {
          toast("Vous n'avez pas accès aux paramètres de cette ligue.", { variant: 'error' });
          router.push(`/league/${id}`);
          return;
        }

        setLeague(l);
        setName(l.name);
        setDescription(l.description ?? '');
        setMaxPlayers(l.max_players);
        setRosterSize((l.settings?.roster_size as number) ?? 5);
        setBenchSize((l.settings?.bench_size as number) ?? 2);
        setBudget(((l.settings?.budget as number) ?? 100_000_000) / 1_000_000);
        setDraftMode(l.draft_mode);
        if (Array.isArray(l.settings?.draft_windows) && l.settings.draft_windows.length > 0) {
          setDraftWindows(l.settings.draft_windows as DraftWindow[]);
        } else {
          const rs = (l.settings?.roster_size as number) ?? 5;
          const bs = (l.settings?.bench_size as number) ?? 2;
          setDraftWindows([{ label: 'Draft initial', picks_per_player: rs + bs, draft_type: 'snake_random' }]);
        }

        // Charger les scoring rules
        const { rules: r } = await apiFetch<{ rules: ScoringRules }>(`/api/leagues/${id}/scoring-rules`);
        setRules(r);
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Impossible de charger les paramètres', { variant: 'error' });
        router.push(`/league/${id}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, id, router, toast]);

  // --- Handlers ---

  async function handleSaveInfo() {
    setSavingInfo(true);
    try {
      await apiFetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          description: description || null,
          max_players: maxPlayers,
          settings: { roster_size: rosterSize, bench_size: benchSize, budget: budget * 1_000_000 },
        }),
      });
      setLeague((prev) => prev ? { ...prev, name, description, max_players: maxPlayers, settings: { ...prev.settings, roster_size: rosterSize, bench_size: benchSize, budget: budget * 1_000_000 } } : prev);
      toast('Informations mises à jour', { variant: 'success' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleSaveDraftMode() {
    setSavingMode(true);
    try {
      await apiFetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ draft_mode: draftMode }),
      });
      setLeague((prev) => prev ? { ...prev, draft_mode: draftMode } : prev);
      toast('Mode de draft mis à jour', { variant: 'success' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setSavingMode(false);
    }
  }

  async function handleSaveDraftWindows() {
    setSavingWindows(true);
    try {
      await apiFetch(`/api/leagues/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ settings: { ...league?.settings, draft_windows: draftWindows } }),
      });
      setLeague((prev) => prev ? { ...prev, settings: { ...prev.settings, draft_windows: draftWindows } } : prev);
      toast('Périodes de draft mises à jour', { variant: 'success' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setSavingWindows(false);
    }
  }

  function addDraftWindow() {
    setDraftWindows((prev) => [...prev, { label: `Draft ${prev.length + 1}`, picks_per_player: 2, draft_type: 'snake_random' }]);
  }

  function removeDraftWindow(index: number) {
    setDraftWindows((prev) => prev.filter((_, i) => i !== index));
  }

  function updateDraftWindow(index: number, field: keyof DraftWindow, value: string | number) {
    setDraftWindows((prev) => prev.map((w, i) => i === index ? { ...w, [field]: value } : w));
  }

  async function handleSaveRules() {
    setSavingRules(true);
    try {
      await apiFetch(`/api/leagues/${id}/scoring-rules`, {
        method: 'PUT',
        body: JSON.stringify(rules),
      });
      toast('Règles de scoring mises à jour', { variant: 'success' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la sauvegarde', { variant: 'error' });
    } finally {
      setSavingRules(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/leagues/${id}`, { method: 'DELETE' });
      toast('Ligue supprimée', { variant: 'success' });
      router.push('/dashboard');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Erreur lors de la suppression', { variant: 'error' });
      setDeleting(false);
    }
  }

  // --- Scoring helpers ---

  function updateRaceFinish(position: string, value: number) {
    setRules((prev) => ({
      ...prev,
      race_finish: { ...prev.race_finish, [position]: value },
    }));
  }

  function updateQualifying(session: string, value: number) {
    setRules((prev) => ({
      ...prev,
      qualifying: { ...prev.qualifying, [session]: value },
    }));
  }

  function updateBonus(key: keyof ScoringRules['bonuses'], value: number) {
    setRules((prev) => ({
      ...prev,
      bonuses: { ...prev.bonuses, [key]: value },
    }));
  }

  function updatePenalty(key: keyof ScoringRules['penalties'], value: number) {
    setRules((prev) => ({
      ...prev,
      penalties: { ...prev.penalties, [key]: value },
    }));
  }

  // --- Render ---

  if (authLoading || loading) {
    return (
      <div className="container py-10 space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!league) return null;

  return (
    <div className="container py-10 space-y-8 max-w-3xl">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <Link href={`/league/${id}`} className="text-muted-foreground hover:text-foreground transition-colors text-2xl" aria-label="Retour à la ligue">
            ←
          </Link>
          <h1 className="text-3xl font-bold">Paramètres de la ligue</h1>
        </div>
        <p className="text-muted-foreground">Configurez votre ligue avant de la lancer.</p>
      </div>

      {/* ---- Section 1 : Informations ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
          <CardDescription>Nom, description et capacité de la ligue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="league-name" className="text-sm font-medium">Nom de la ligue</label>
            <Input
              id="league-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="Ma ligue F1"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="league-desc" className="text-sm font-medium">Description</label>
            <textarea
              id="league-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Description optionnelle..."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="max-players" className="text-sm font-medium">Nombre maximum de joueurs</label>
            <Input
              id="max-players"
              type="number"
              min={2}
              max={20}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value) || 2)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="roster-size" className="text-sm font-medium">Pilotes titulaires</label>
              <Input
                id="roster-size"
                type="number"
                min={1}
                max={10}
                value={rosterSize}
                onChange={(e) => setRosterSize(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">Pilotes qui marquent des points chaque GP</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="bench-size" className="text-sm font-medium">Pilotes remplaçants</label>
              <Input
                id="bench-size"
                type="number"
                min={0}
                max={5}
                value={benchSize}
                onChange={(e) => setBenchSize(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Pilotes sur le banc (ne marquent pas)</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Total : <strong>{rosterSize + benchSize}</strong> pilotes par équipe ({rosterSize} titulaires + {benchSize} remplaçants)
          </p>
          {draftMode === 'salary_cap' && (
            <div className="space-y-2 pt-2 border-t">
              <label htmlFor="budget" className="text-sm font-medium">Budget initial (en millions €)</label>
              <Input
                id="budget"
                type="number"
                min={10}
                max={500}
                value={budget}
                onChange={(e) => setBudget(parseInt(e.target.value) || 10)}
              />
              <p className="text-xs text-muted-foreground">Chaque joueur démarrera avec {budget}M€ pour recruter des pilotes sur le marché</p>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveInfo} disabled={savingInfo || !name.trim()}>
            {savingInfo ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </CardFooter>
      </Card>

      {/* ---- Section 2 : Mode de draft ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Mode de jeu</CardTitle>
          <CardDescription>Choisissez comment les joueurs constitueront leur équipe.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setDraftMode('exclusive_draft')}
            className={cn(
              'rounded-lg border-2 p-4 text-left transition-colors',
              draftMode === 'exclusive_draft'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50',
            )}
          >
            <div className="font-semibold">🎯 Draft Exclusif</div>
            <p className="text-sm text-muted-foreground mt-1">
              Chaque pilote ne peut être drafté que par un seul joueur. Tour par tour, en serpentin.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setDraftMode('salary_cap')}
            className={cn(
              'rounded-lg border-2 p-4 text-left transition-colors',
              draftMode === 'salary_cap'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50',
            )}
          >
            <div className="font-semibold">💰 Budget Fixe</div>
            <p className="text-sm text-muted-foreground mt-1">
              Chaque joueur dispose d&apos;un budget pour acheter des pilotes sur le marché.
            </p>
          </button>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveDraftMode} disabled={savingMode || draftMode === league.draft_mode}>
            {savingMode ? 'Sauvegarde...' : 'Sauvegarder le mode'}
          </Button>
        </CardFooter>
      </Card>

      {/* ---- Section 2b : Périodes de draft (exclusive_draft only) ---- */}
      {draftMode === 'exclusive_draft' && (
        <Card>
          <CardHeader>
            <CardTitle>Périodes de draft</CardTitle>
            <CardDescription>
              Configurez les différentes sessions de draft de la saison. Chaque période permet aux joueurs de drafter un nombre de pilotes défini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {draftWindows.map((w, i) => (
              <div key={i} className="space-y-3 p-3 rounded-lg border">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs text-muted-foreground">Nom de la période</label>
                    <Input
                      value={w.label}
                      onChange={(e) => updateDraftWindow(i, 'label', e.target.value)}
                      placeholder="Ex: Draft mi-saison"
                    />
                  </div>
                  <div className="w-32 space-y-1">
                    <label className="text-xs text-muted-foreground">Picks / joueur</label>
                    <Input
                      type="number"
                      min={1}
                      max={22}
                      value={w.picks_per_player}
                      onChange={(e) => updateDraftWindow(i, 'picks_per_player', parseInt(e.target.value) || 1)}
                    />
                  </div>
                  {draftWindows.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeDraftWindow(i)} className="text-destructive hover:text-destructive">
                      ✕
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Type de draft</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={w.draft_type}
                    onChange={(e) => updateDraftWindow(i, 'draft_type', e.target.value)}
                  >
                    <option value="snake_random">Serpentin aléatoire</option>
                    <option value="snake_reverse_standings">Serpentin grille inversée</option>
                    <option value="nba_lottery">Lottery NBA</option>
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {w.draft_type === 'snake_random' && "Ordre du 1er tour aléatoire, puis serpentin."}
                    {w.draft_type === 'snake_reverse_standings' && "Le dernier au classement choisit en premier, puis serpentin."}
                    {w.draft_type === 'nba_lottery' && "Tirage pondéré : les derniers au classement ont plus de chances d'obtenir un bon pick. Aléatoire pour la 1ère draft."}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={addDraftWindow}>
                + Ajouter une période
              </Button>
              <p className="text-xs text-muted-foreground">
                Total : {draftWindows.reduce((sum, w) => sum + w.picks_per_player, 0)} picks par joueur sur la saison
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveDraftWindows} disabled={savingWindows || draftWindows.length === 0}>
              {savingWindows ? 'Sauvegarde...' : 'Sauvegarder les périodes'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* ---- Section 3 : Règles de scoring ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Règles de scoring</CardTitle>
          <CardDescription>Personnalisez les points attribués pour chaque action.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Course */}
          <div>
            <h3 className="text-sm font-semibold mb-3">🏁 Points de course</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {Array.from({ length: 10 }, (_, i) => {
                const pos = `P${i + 1}`;
                return (
                  <div key={pos} className="space-y-1">
                    <label htmlFor={`race-${pos}`} className="text-xs text-muted-foreground">{pos}</label>
                    <Input
                      id={`race-${pos}`}
                      type="number"
                      value={rules.race_finish[pos] ?? 0}
                      onChange={(e) => updateRaceFinish(pos, parseFloat(e.target.value) || 0)}
                      className="h-9"
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Qualifications */}
          <div>
            <h3 className="text-sm font-semibold mb-3">⏱️ Points de qualification</h3>
            <div className="grid grid-cols-3 gap-3">
              {['Q1', 'Q2', 'Q3'].map((q) => (
                <div key={q} className="space-y-1">
                  <label htmlFor={`qual-${q}`} className="text-xs text-muted-foreground">{q}</label>
                  <Input
                    id={`qual-${q}`}
                    type="number"
                    value={rules.qualifying[q] ?? 0}
                    onChange={(e) => updateQualifying(q, parseFloat(e.target.value) || 0)}
                    className="h-9"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Bonus */}
          <div>
            <h3 className="text-sm font-semibold mb-3">⭐ Bonus</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="bonus-fl" className="text-xs text-muted-foreground">Meilleur tour</label>
                <Input
                  id="bonus-fl"
                  type="number"
                  step="0.5"
                  value={rules.bonuses.fastest_lap}
                  onChange={(e) => updateBonus('fastest_lap', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bonus-dotd" className="text-xs text-muted-foreground">Pilote du jour</label>
                <Input
                  id="bonus-dotd"
                  type="number"
                  step="0.5"
                  value={rules.bonuses.driver_of_the_day}
                  onChange={(e) => updateBonus('driver_of_the_day', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="bonus-pos" className="text-xs text-muted-foreground">Par place gagn��e</label>
                <Input
                  id="bonus-pos"
                  type="number"
                  step="0.1"
                  value={rules.bonuses.positions_gained_per_place}
                  onChange={(e) => updateBonus('positions_gained_per_place', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Pénalités */}
          <div>
            <h3 className="text-sm font-semibold mb-3">🚫 Pénalités</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="pen-mech" className="text-xs text-muted-foreground">DNF mécanique</label>
                <Input
                  id="pen-mech"
                  type="number"
                  step="0.5"
                  value={rules.penalties.dnf_mechanical}
                  onChange={(e) => updatePenalty('dnf_mechanical', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pen-acc" className="text-xs text-muted-foreground">DNF accident</label>
                <Input
                  id="pen-acc"
                  type="number"
                  step="0.5"
                  value={rules.penalties.dnf_accident}
                  onChange={(e) => updatePenalty('dnf_accident', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="pen-grid" className="text-xs text-muted-foreground">Par place de pénalité grille</label>
                <Input
                  id="pen-grid"
                  type="number"
                  step="0.5"
                  value={rules.penalties.grid_penalty_per_place}
                  onChange={(e) => updatePenalty('grid_penalty_per_place', parseFloat(e.target.value) || 0)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button onClick={handleSaveRules} disabled={savingRules}>
            {savingRules ? 'Sauvegarde...' : 'Sauvegarder les règles'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setRules(structuredClone(DEFAULT_SCORING_RULES))}
          >
            Réinitialiser par défaut
          </Button>
        </CardFooter>
      </Card>

      {/* ---- Section 4 : Zone de danger ---- */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zone de danger</CardTitle>
          <CardDescription>Actions irréversibles. Soyez prudent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Tapez <strong>{league.name}</strong> pour confirmer la suppression définitive de cette ligue et de toutes ses données.
          </p>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={league.name}
          />
        </CardContent>
        <CardFooter>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting || confirmName !== league.name}
          >
            {deleting ? 'Suppression...' : 'Supprimer la ligue'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
