import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { updateTeamSchema } from '@/lib/validators';
import { z } from 'zod';

type Params = { params: { id: string } }; // id = league_id

// GET /api/teams/[leagueId] — Mon équipe dans une ligue
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
      include: {
        roster_assignments: {
          include: { real_entity: true },
          orderBy: { is_starter: 'desc' },
        },
        scores: {
          include: { gameweek: true },
          orderBy: { gameweek: { round_number: 'desc' } },
          take: 5,
        },
      },
    });

    if (!team) {
      return NextResponse.json({ message: 'Aucune équipe trouvée dans cette ligue' }, { status: 404 });
    }

    return NextResponse.json({ team });
  } catch (error) {
    console.error('GET /api/teams/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams/[leagueId] — Mettre à jour le nom de l'équipe
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { name } = updateTeamSchema.parse(body);

    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });

    if (!team) {
      return NextResponse.json({ message: 'Équipe non trouvée' }, { status: 404 });
    }

    const updated = await prisma.fantasyTeam.update({
      where: { id: team.id },
      data: { name: name ?? team.name },
    });

    return NextResponse.json({ team: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('PUT /api/teams/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/teams/[leagueId] — Supprimer mon équipe (owner de ligue seulement)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const team = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });

    if (!team) {
      return NextResponse.json({ message: 'Équipe non trouvée' }, { status: 404 });
    }

    await prisma.fantasyTeam.delete({ where: { id: team.id } });

    return NextResponse.json({ message: 'Équipe supprimée' });
  } catch (error) {
    console.error('DELETE /api/teams/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
