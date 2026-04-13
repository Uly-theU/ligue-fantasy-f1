import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { z } from 'zod';

type Params = { params: { leagueId: string } };

const pickSchema = z.object({
  real_entity_id: z.string().uuid(),
});

/**
 * POST /api/draft/[leagueId]/pick — Sélectionner un pilote pendant le draft.
 *
 * Vérifie que c'est bien le tour du joueur (snake draft),
 * que le pilote est disponible, puis crée le pick et l'ajoute au roster.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { real_entity_id } = pickSchema.parse(body);

    // Session de draft active
    const session = await prisma.draftSession.findFirst({
      where: { league_id: params.leagueId, status: 'in_progress' },
      include: { draft_picks: true },
    });

    if (!session) {
      return NextResponse.json({ message: 'Aucun draft en cours' }, { status: 404 });
    }

    const turnOrder = session.turn_order;
    const settings = session.settings as Record<string, unknown>;
    const totalPicksPerPlayer = (settings.total_picks as number) ?? 7;
    const totalPicksNeeded = totalPicksPerPlayer * turnOrder.length;
    const currentPickNumber = session.draft_picks.length + 1;

    if (currentPickNumber > totalPicksNeeded) {
      return NextResponse.json({ message: 'Le draft est terminé' }, { status: 400 });
    }

    // Déterminer qui doit jouer (snake)
    const currentRound = Math.ceil(currentPickNumber / turnOrder.length);
    const posInRound = (currentPickNumber - 1) % turnOrder.length;
    const isReversed = currentRound % 2 === 0;
    const index = isReversed ? turnOrder.length - 1 - posInRound : posInRound;
    const expectedPlayer = turnOrder[index];

    if (user!.id !== expectedPlayer) {
      return NextResponse.json({ message: 'Ce n\'est pas ton tour' }, { status: 403 });
    }

    // Vérifier que le pilote n'est pas déjà drafté
    const alreadyPicked = session.draft_picks.some((p) => p.real_entity_id === real_entity_id);
    if (alreadyPicked) {
      return NextResponse.json({ message: 'Ce pilote a déjà été drafté' }, { status: 409 });
    }

    // Vérifier que le pilote existe et est actif
    const driver = await prisma.realEntity.findUnique({ where: { id: real_entity_id } });
    if (!driver || !driver.active) {
      return NextResponse.json({ message: 'Pilote introuvable ou inactif' }, { status: 404 });
    }

    // Récupérer ou créer l'équipe fantasy
    let team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.leagueId, user_id: user!.id } },
    });

    if (!team) {
      team = await prisma.fantasyTeam.create({
        data: {
          league_id: params.leagueId,
          user_id: user!.id,
          name: `Équipe de ${user!.email?.split('@')[0] ?? 'Joueur'}`,
        },
      });
    }

    // Transaction : créer le pick + ajouter au roster + éventuellement compléter le draft
    const isLastPick = currentPickNumber >= totalPicksNeeded;

    await prisma.$transaction([
      prisma.draftPick.create({
        data: {
          draft_session_id: session.id,
          user_id: user!.id,
          real_entity_id,
          pick_number: currentPickNumber,
          round_number: currentRound,
        },
      }),
      prisma.rosterAssignment.create({
        data: {
          fantasy_team_id: team.id,
          real_entity_id,
          is_starter: currentRound <= ((settings.roster_size as number) ?? 5),
        },
      }),
      prisma.draftSession.update({
        where: { id: session.id },
        data: {
          current_turn: currentPickNumber + 1,
          ...(isLastPick
            ? { status: 'completed', completed_at: new Date() }
            : {}),
        },
      }),
    ]);

    return NextResponse.json({
      message: `${driver.name} drafté par ${user!.email}`,
      pick: {
        pick_number: currentPickNumber,
        round: currentRound,
        driver: driver.name,
        short_name: driver.short_name,
      },
      draft_complete: isLastPick,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/draft/[leagueId]/pick:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
