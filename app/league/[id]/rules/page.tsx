'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { type ScoringRules, DEFAULT_SCORING_RULES } from '@/lib/scoring';

interface LeagueDetail {
  id: string;
  name: string;
  draft_mode: 'salary_cap' | 'exclusive_draft';
  max_players: number;
  status: string;
  season: number;
  settings: {
    roster_size?: number;
    bench_size?: number;
    budget?: number;
    draft_windows?: Array<{ label: string; picks_per_player: number; draft_type?: string }>;
    [key: string]: unknown;
  };
}

const draftTypeLabels: Record<string, string> = {
  snake_random: 'Serpentin aléatoire',
  snake_reverse_standings: 'Serpentin grille inversée',
  nba_lottery: 'Loterie NBA',
};

export default function RulesPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const [league, setLeague] = useState<LeagueDetail | null>(null);
  const [rules, setRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ league: LeagueDetail }>(`/api/leagues/${leagueId}`),
      apiFetch<{ rules: ScoringRules }>(`/api/leagues/${leagueId}/scoring-rules`).catch(() => ({ rules: DEFAULT_SCORING_RULES })),
    ]).then(([l, r]) => {
      setLeague(l.league);
      setRules(r.rules);
    }).finally(() => setLoading(false));
  }, [leagueId]);

  if (loading) {
    return (
      <div className="container py-10 space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded" />
        <div className="h-48 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!league) return null;

  const rosterSize = (league.settings?.roster_size as number) ?? 5;
  const benchSize = (league.settings?.bench_size as number) ?? 2;
  const budget = (league.settings?.budget as number) ?? 100_000_000;

  function formatPrice(value: number) {
    return `${(value / 1_000_000).toFixed(0)}M€`;
  }

  // Trier les positions de course par points décroissants
  const racePositions = Object.entries(rules.race_finish)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="container py-10 space-y-8 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors text-2xl" aria-label="Retour à la ligue">
          &larr;
        </Link>
        <h1 className="text-3xl font-bold">Règles de la ligue</h1>
      </div>

      {/* ---- Règles fixes ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Règles générales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RuleLine label="Saison" value={`${league.season}`} />
          <RuleLine label="Verrouillage des rosters" value="Les rosters sont verrouillés au début de chaque séance de qualification (samedi). Vous ne pouvez plus modifier votre alignement ni vos pilotes jusqu'à la fin du Grand Prix." />
          <RuleLine label="Joker" value="Vous pouvez désigner 1 pilote titulaire comme Joker chaque semaine. Ses points sont multipliés par 2. Le joker peut être changé tant que le roster n'est pas verrouillé." />
          <RuleLine label="Remplaçants" value="Les pilotes sur le banc ne marquent pas de points. Ils servent de réserve pour les rotations entre les GP." />
          <RuleLine label="Résultats" value="Les scores sont calculés automatiquement après chaque Grand Prix, à partir des données officielles de la F1." />
        </CardContent>
      </Card>

      {/* ---- Règles de la ligue (owner) ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration de la ligue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <RuleLine label="Joueurs max" value={`${league.max_players} joueurs`} />
          <RuleLine label="Pilotes titulaires" value={`${rosterSize} par équipe`} />
          <RuleLine label="Pilotes remplaçants" value={`${benchSize} par équipe`} />
          <RuleLine
            label="Mode de jeu"
            value={league.draft_mode === 'salary_cap' ? 'Budget Fixe (marché libre)' : 'Draft Exclusif (tour par tour)'}
          />
          {league.draft_mode === 'salary_cap' && (
            <RuleLine label="Budget initial" value={formatPrice(budget)} />
          )}
          <RuleLine
            label="Statut"
            value={
              league.status === 'setup' ? 'Configuration en cours'
              : league.status === 'active' ? 'Saison en cours'
              : 'Terminée'
            }
          />
        </CardContent>
      </Card>

      {/* ---- Mode Draft / Marché ---- */}
      <Card>
        <CardHeader>
          <CardTitle>
            {league.draft_mode === 'salary_cap' ? 'Règles du marché' : 'Règles du draft'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {league.draft_mode === 'salary_cap' ? (
            <>
              <RuleLine label="Fonctionnement" value="Chaque joueur dispose d'un budget pour acheter des pilotes sur le marché. Les prix sont fixés en début de saison selon les performances attendues." />
              <RuleLine label="Achat" value="Vous pouvez acheter un pilote tant que votre budget le permet et que votre roster n'est pas complet." />
              <RuleLine label="Vente" value="Retirer un pilote de votre roster vous rembourse son prix d'acquisition." />
              <RuleLine label="Exclusivité" value="Plusieurs joueurs peuvent avoir le même pilote dans leur équipe." />
            </>
          ) : (
            <>
              <RuleLine label="Fonctionnement" value="Les joueurs choisissent leurs pilotes à tour de rôle. Chaque pilote ne peut être sélectionné que par un seul joueur." />
              <RuleLine label="Ordre" value="Le draft suit un ordre serpentin : l'ordre s'inverse à chaque tour. Si vous passez en dernier au tour 1, vous passez en premier au tour 2." />
              <RuleLine label="Exclusivité" value="Chaque pilote est unique — une fois drafté, il n'est plus disponible pour les autres joueurs." />
              {league.settings?.draft_windows && league.settings.draft_windows.length > 0 ? (
                <>
                  <div className="pt-2 border-t border-border/50">
                    <span className="text-sm font-medium text-muted-foreground">Périodes de draft ({league.settings.draft_windows.length})</span>
                  </div>
                  {league.settings.draft_windows.map((w, i) => (
                    <RuleLine
                      key={i}
                      label={w.label}
                      value={`${w.picks_per_player} picks par joueur — ${draftTypeLabels[w.draft_type ?? 'snake_random'] ?? 'Serpentin aléatoire'}`}
                    />
                  ))}
                  <RuleLine
                    label="Total sur la saison"
                    value={`${league.settings.draft_windows.reduce((sum, w) => sum + w.picks_per_player, 0)} picks par joueur`}
                  />
                </>
              ) : (
                <RuleLine label="Tours" value={`${rosterSize + benchSize} tours (${rosterSize} titulaires + ${benchSize} remplaçants)`} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ---- Barème de scoring ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Barème de scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Course */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Points de course</h3>
            <div className="flex flex-wrap gap-2">
              {racePositions.map(([pos, pts]) => (
                <Badge key={pos} variant="secondary" className="text-sm">
                  {pos} = {pts} pts
                </Badge>
              ))}
            </div>
          </div>

          {/* Qualifications */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Points de qualification</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(rules.qualifying)
                .sort(([, a], [, b]) => b - a)
                .map(([session, pts]) => (
                  <Badge key={session} variant="secondary" className="text-sm">
                    {session} = {pts} pts
                  </Badge>
                ))}
            </div>
          </div>

          {/* Bonus */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Bonus</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Meilleur tour en course</span>
                <span className="text-green-500 font-medium">+{rules.bonuses.fastest_lap} pt{rules.bonuses.fastest_lap > 1 ? 's' : ''}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Pilote du jour (DOTD)</span>
                <span className="text-green-500 font-medium">+{rules.bonuses.driver_of_the_day} pts</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Par place gagnée (vs grille de départ)</span>
                <span className="text-green-500 font-medium">+{rules.bonuses.positions_gained_per_place} pt/place</span>
              </div>
            </div>
          </div>

          {/* Pénalités */}
          <div>
            <h3 className="text-sm font-semibold mb-2">Pénalités</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Abandon mécanique (DNF)</span>
                <span className="text-red-500 font-medium">{rules.penalties.dnf_mechanical} pts</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span>Abandon par accident (DNF)</span>
                <span className="text-red-500 font-medium">{rules.penalties.dnf_accident} pts</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Pénalité sur la grille</span>
                <span className="text-red-500 font-medium">{rules.penalties.grid_penalty_per_place} pt/place</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RuleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm font-medium text-muted-foreground sm:w-48 shrink-0">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
