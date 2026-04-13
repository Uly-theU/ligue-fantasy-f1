import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

type Params = { params: { leagueId: string } };

type DraftWindow = {
  label: string;
  picks_per_player: number;
  draft_type: 'snake_random' | 'snake_reverse_standings' | 'nba_lottery';
};

/** Shuffle Fisher-Yates en place */
function shuffleArray(arr: string[]): string[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Génère l'ordre de draft selon le type demandé.
 *
 * - snake_random : shuffle aléatoire
 * - snake_reverse_standings : classement inversé (dernier choisit en premier)
 * - nba_lottery : loterie pondérée (plus mauvais = plus de chances),
 *   aléatoire si c'est le premier draft de la saison
 */
async function generateTurnOrder(
  memberIds: string[],
  draftType: DraftWindow['draft_type'],
  leagueId: string,
  isFirstDraft: boolean,
): Promise<string[]> {
  if (draftType === 'snake_random' || (draftType === 'nba_lottery' && isFirstDraft)) {
    return shuffleArray([...memberIds]);
  }

  // Récupérer le classement (total_points DESC)
  const teams = await prisma.fantasyTeam.findMany({
    where: { league_id: leagueId, user_id: { in: memberIds } },
    select: { user_id: true, total_points: true },
    orderBy: { total_points: 'desc' },
  });

  // Map user_id -> points, les membres sans équipe ont 0 points
  const pointsMap = new Map(teams.map((t) => [t.user_id, Number(t.total_points)]));
  const sortedByPoints = [...memberIds].sort(
    (a, b) => (pointsMap.get(b) ?? 0) - (pointsMap.get(a) ?? 0),
  );

  if (draftType === 'snake_reverse_standings') {
    // Dernier au classement choisit en premier
    return sortedByPoints.reverse();
  }

  // nba_lottery (pas premier draft) : loterie pondérée
  // Le dernier au classement a le plus de "boules"
  // Poids : rang 1 (meilleur) = 1 boule, rang 2 = 2 boules, …, rang N = N boules
  const n = sortedByPoints.length;
  const weighted = sortedByPoints.map((id, idx) => ({
    id,
    weight: idx + 1, // rang 0 (meilleur) = poids 1, rang N-1 (pire) = poids N
  }));

  const result: string[] = [];
  const remaining = [...weighted];

  for (let pick = 0; pick < n; pick++) {
    const totalWeight = remaining.reduce((sum, w) => sum + w.weight, 0);
    let rand = Math.random() * totalWeight;

    let selected = remaining[remaining.length - 1];
    for (const entry of remaining) {
      rand -= entry.weight;
      if (rand <= 0) {
        selected = entry;
        break;
      }
    }

    result.push(selected.id);
    const idx = remaining.indexOf(selected);
    remaining.splice(idx, 1);
  }

  return result;
}

/**
 * POST /api/draft/[leagueId]/start — Lancer le draft (owner only).
 *
 * Supporte 3 types de draft :
 * - snake_random : ordre aléatoire puis serpentin
 * - snake_reverse_standings : dernier au classement choisit en premier, puis serpentin
 * - nba_lottery : loterie pondérée par classement inversé (aléatoire si premier draft)
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const league = await prisma.league.findUnique({
      where: { id: params.leagueId },
      include: { members: true },
    });

    if (!league) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }

    if (league.owner_id !== user!.id) {
      return NextResponse.json({ message: 'Seul le propriétaire peut lancer le draft' }, { status: 403 });
    }

    if (league.draft_mode !== 'exclusive_draft') {
      return NextResponse.json({ message: 'Le draft n\'est disponible qu\'en mode exclusive_draft' }, { status: 400 });
    }

    if (league.status !== 'setup' && league.status !== 'active') {
      return NextResponse.json({ message: 'Impossible de lancer un draft sur une ligue terminée' }, { status: 400 });
    }

    // Vérifier qu'il n'y a pas déjà un draft en cours
    const existing = await prisma.draftSession.findFirst({
      where: { league_id: params.leagueId, status: { in: ['pending', 'in_progress'] } },
    });
    if (existing) {
      return NextResponse.json({ message: 'Un draft est déjà en cours', draft_session_id: existing.id }, { status: 409 });
    }

    // Compter les drafts déjà complétés
    const completedDrafts = await prisma.draftSession.count({
      where: { league_id: params.leagueId, status: 'completed' },
    });

    const settings = (league.settings as Record<string, unknown>) ?? {};
    const draftWindows = (settings.draft_windows as DraftWindow[]) ?? null;

    // Déterminer le nombre de picks et le type pour cette session
    let totalPicks: number;
    let draftLabel: string;
    let draftType: DraftWindow['draft_type'] = 'snake_random';

    if (draftWindows && draftWindows.length > 0) {
      if (completedDrafts >= draftWindows.length) {
        return NextResponse.json({ message: 'Toutes les périodes de draft ont été complétées' }, { status: 400 });
      }
      const currentWindow = draftWindows[completedDrafts];
      totalPicks = currentWindow.picks_per_player;
      draftLabel = currentWindow.label;
      draftType = currentWindow.draft_type ?? 'snake_random';
    } else {
      if (completedDrafts > 0) {
        return NextResponse.json({ message: 'Le draft a déjà été effectué' }, { status: 400 });
      }
      const rosterSize = (settings.roster_size as number) ?? 5;
      const benchSize = (settings.bench_size as number) ?? 2;
      totalPicks = rosterSize + benchSize;
      draftLabel = 'Draft initial';
    }

    // Générer l'ordre selon le type de draft
    const memberIds = league.members.map((m) => m.user_id);
    const isFirstDraft = completedDrafts === 0;
    const turnOrder = await generateTurnOrder(memberIds, draftType, params.leagueId, isFirstDraft);

    const timePerPick = (settings.time_per_pick_seconds as number) ?? 120;

    const draftSession = await prisma.draftSession.create({
      data: {
        league_id: params.leagueId,
        status: 'in_progress',
        current_turn: 1,
        turn_order: turnOrder,
        settings: {
          snake: true,
          time_per_pick_seconds: timePerPick,
          total_picks: totalPicks,
          label: draftLabel,
          window_index: completedDrafts,
          draft_type: draftType,
        },
        started_at: new Date(),
      },
    });

    // Passer la ligue en active si elle est encore en setup
    if (league.status === 'setup') {
      await prisma.league.update({
        where: { id: params.leagueId },
        data: { status: 'active' },
      });
    }

    return NextResponse.json({
      message: 'Draft lancé',
      draft_session: draftSession,
      turn_order: turnOrder,
      total_rounds: totalPicks,
      label: draftLabel,
      draft_type: draftType,
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/draft/[leagueId]/start:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
