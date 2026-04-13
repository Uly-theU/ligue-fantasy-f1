import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

type Params = { params: { id: string } }; // league_id

// GET /api/leagues/[id]/standings — Classement de la ligue
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    // Vérifier que l'utilisateur est membre
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });

    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const teams = await prisma.fantasyTeam.findMany({
      where: { league_id: params.id },
      include: {
        profile: { select: { username: true, display_name: true, avatar_url: true } },
        scores: {
          include: { gameweek: { select: { round_number: true, name: true } } },
          orderBy: { gameweek: { round_number: 'asc' } },
        },
      },
      orderBy: { total_points: 'desc' },
    });

    const standings = teams.map((team, index) => ({
      rank: index + 1,
      team_id: team.id,
      team_name: team.name,
      user: team.profile,
      total_points: Number(team.total_points),
      scores_by_round: team.scores.map((s) => ({
        round: s.gameweek.round_number,
        gp_name: s.gameweek.name,
        points: Number(s.total_points),
      })),
    }));

    return NextResponse.json({ standings });
  } catch (error) {
    console.error('GET /api/leagues/[id]/standings:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
