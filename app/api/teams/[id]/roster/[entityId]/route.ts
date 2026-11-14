import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { ROSTER_FROZEN_MESSAGE } from '@/lib/lineup';
import { freezeRosterIfClockBlocked } from '@/lib/freeze-lineups';

type Params = { params: { id: string; entityId: string } };

// DELETE /api/teams/[leagueId]/roster/[entityId] — Retirer un pilote du roster
export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
      include: { league: true },
    });

    if (!team) {
      return NextResponse.json({ message: 'Équipe non trouvée' }, { status: 404 });
    }

    if (team.league.status === 'completed') {
      return NextResponse.json({ message: 'La ligue est terminée' }, { status: 403 });
    }

    if (await freezeRosterIfClockBlocked(team.league.season)) {
      return NextResponse.json({ message: ROSTER_FROZEN_MESSAGE }, { status: 403 });
    }

    const assignment = await prisma.rosterAssignment.findUnique({
      where: {
        fantasy_team_id_real_entity_id: {
          fantasy_team_id: team.id,
          real_entity_id: params.entityId,
        },
      },
      include: { real_entity: true },
    });

    if (!assignment) {
      return NextResponse.json({ message: 'Ce pilote n\'est pas dans ton roster' }, { status: 404 });
    }

    // Rembourser en mode salary_cap
    const refund =
      team.league.draft_mode === 'salary_cap' && assignment.acquisition_price
        ? assignment.acquisition_price
        : 0;

    await prisma.$transaction([
      prisma.rosterAssignment.delete({ where: { id: assignment.id } }),
      ...(refund > 0
        ? [
            prisma.fantasyTeam.update({
              where: { id: team.id },
              data: { current_budget: { increment: refund } },
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      message: `${assignment.real_entity.name} retiré du roster`,
      refund,
    });
  } catch (error) {
    console.error('DELETE /api/teams/[id]/roster/[entityId]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
