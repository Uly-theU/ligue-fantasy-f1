import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { f1DriverCardInclude, presentF1Driver } from '@/lib/present-driver';

type Params = { params: { leagueId: string } };

/**
 * GET /api/draft/[leagueId]/status — État du draft en cours.
 *
 * Retourne la session, l'ordre, le tour actuel, les picks déjà faits,
 * et les pilotes encore disponibles.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    // Vérifier membership
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.leagueId, user_id: user!.id } },
    });
    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    // Charger la session la plus récente (en cours ou dernière complétée)
    const session = await prisma.draftSession.findFirst({
      where: { league_id: params.leagueId },
      orderBy: { created_at: 'desc' },
      include: {
        draft_picks: {
          include: {
            real_entity: true,
            profile: { select: { username: true, display_name: true } },
          },
          orderBy: { pick_number: 'asc' },
        },
      },
    });

    if (!session) {
      // Retourner les infos de draft windows pour le frontend
      const league = await prisma.league.findUnique({ where: { id: params.leagueId } });
      const leagueSettings = (league?.settings as Record<string, unknown>) ?? {};
      const draftWindows = (leagueSettings.draft_windows as Array<{ label: string; picks_per_player: number; draft_type?: string }>) ?? [];
      return NextResponse.json({ message: 'Aucun draft trouvé', draft_windows: draftWindows, completed_count: 0 }, { status: 404 });
    }

    // Compter les sessions complétées et charger les infos de league
    const completedCount = await prisma.draftSession.count({
      where: { league_id: params.leagueId, status: 'completed' },
    });
    const league = await prisma.league.findUnique({ where: { id: params.leagueId } });
    const leagueSettings = (league?.settings as Record<string, unknown>) ?? {};
    const draftWindows = (leagueSettings.draft_windows as Array<{ label: string; picks_per_player: number; draft_type?: string }>) ?? [];

    // Calculer qui doit jouer (snake draft)
    const turnOrder = session.turn_order;
    const settings = session.settings as Record<string, unknown>;
    const totalPicks = (settings.total_picks as number) ?? 7;
    const totalPicksNeeded = totalPicks * turnOrder.length;
    const currentPickNumber = session.draft_picks.length + 1;

    let currentPlayer: string | null = null;
    let currentRound = 1;
    let isComplete = false;

    if (currentPickNumber > totalPicksNeeded) {
      isComplete = true;
    } else {
      // Snake: round impair = ordre normal, round pair = inversé
      currentRound = Math.ceil(currentPickNumber / turnOrder.length);
      const posInRound = (currentPickNumber - 1) % turnOrder.length;
      const isReversed = currentRound % 2 === 0;
      const index = isReversed ? turnOrder.length - 1 - posInRound : posInRound;
      currentPlayer = turnOrder[index];
    }

    // Pilotes déjà draftés dans la ligue, y compris les périodes précédentes.
    const picked = await prisma.draftPick.findMany({
      where: { league_id: params.leagueId },
      select: { real_entity_id: true },
    });
    const pickedEntityIds = picked.map((pick) => pick.real_entity_id);

    // Pilotes disponibles
    const available = await prisma.realEntity.findMany({
      where: { sport: 'f1', active: true, id: { notIn: pickedEntityIds } },
      orderBy: { base_price: 'desc' },
      include: { f1_driver: { include: f1DriverCardInclude } },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        status: session.status,
        current_turn: currentPickNumber,
        current_round: currentRound,
        current_player: currentPlayer,
        is_complete: isComplete,
        turn_order: turnOrder,
        settings: session.settings,
        started_at: session.started_at,
      },
      picks: session.draft_picks,
      available_drivers: available.map((driver) => ({
        ...driver,
        f1_driver: presentF1Driver(driver.f1_driver),
      })),
      draft_windows: draftWindows,
      completed_count: completedCount,
      can_start_new: isComplete && draftWindows.length > 0 && completedCount < draftWindows.length,
    });
  } catch (error) {
    console.error('GET /api/draft/[leagueId]/status:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
