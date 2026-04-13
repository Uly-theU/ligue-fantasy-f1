import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { createTeamSchema } from '@/lib/validators';
import { z } from 'zod';

// POST /api/teams — Créer une équipe dans une ligue
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { league_id, name } = createTeamSchema.parse(body);

    // Vérifier que l'utilisateur est membre de la ligue
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id, user_id: user!.id } },
      include: { league: true },
    });

    if (!member) {
      return NextResponse.json({ message: 'Tu n\'es pas membre de cette ligue' }, { status: 403 });
    }

    // Vérifier qu'il n'a pas déjà une équipe
    const existing = await prisma.fantasyTeam.findUnique({
      where: { league_id_user_id: { league_id, user_id: user!.id } },
    });

    if (existing) {
      return NextResponse.json({ message: 'Tu as déjà une équipe dans cette ligue' }, { status: 409 });
    }

    // Budget initial en mode salary_cap
    const settings = member.league.settings as Record<string, unknown>;
    const initialBudget =
      member.league.draft_mode === 'salary_cap'
        ? (settings?.budget as number) ?? 100_000_000
        : null;

    const team = await prisma.fantasyTeam.create({
      data: {
        league_id,
        user_id: user!.id,
        name,
        current_budget: initialBudget,
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/teams:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
