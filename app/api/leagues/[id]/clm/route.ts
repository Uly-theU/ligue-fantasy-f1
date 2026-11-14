import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUser } from '@/lib/auth';
import { rankLeagueClm } from '@/lib/clm-league';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

const leagueClmQuerySchema = z.object({
  gameweek: z.string().uuid(),
  user: z.string().uuid().optional(),
});

// GET /api/leagues/[id]/clm?gameweek=… — Classement contre-la-montre de la ligue
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const rival = req.nextUrl.searchParams.get('user');
  const parsed = leagueClmQuerySchema.safeParse({
    gameweek: req.nextUrl.searchParams.get('gameweek'),
    ...(rival ? { user: rival } : {}),
  });
  if (!parsed.success) {
    return NextResponse.json({ message: 'Données invalides', errors: parsed.error.errors }, { status: 400 });
  }

  try {
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user.id } },
    });
    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parsed.data.gameweek },
      select: { id: true, name: true, round_number: true, circuit: true, circuit_id: true },
    });
    if (!gameweek) {
      return NextResponse.json({ message: 'Grand Prix introuvable' }, { status: 404 });
    }

    const members = await prisma.leagueMember.findMany({
      where: { league_id: params.id },
      include: {
        profile: { select: { username: true, display_name: true } },
      },
    });

    if (parsed.data.user) {
      const target = members.find((entry) => entry.user_id === parsed.data.user);
      if (!target) {
        return NextResponse.json({ message: 'Tour introuvable' }, { status: 404 });
      }
      const lap = await prisma.timeTrialLap.findUnique({
        where: {
          user_id_gameweek_id: { user_id: parsed.data.user, gameweek_id: gameweek.id },
        },
        select: { user_id: true, inputs: true, official_time: true, circuit_id: true },
      });
      const circuitId = lap?.circuit_id ?? gameweek.circuit_id;
      if (!lap || lap.inputs.length === 0 || !circuitId) {
        return NextResponse.json({ message: 'Tour introuvable' }, { status: 404 });
      }
      return NextResponse.json({
        lap: {
          user_id: lap.user_id,
          inputs: lap.inputs,
          official_time: lap.official_time,
          circuit_id: circuitId,
        },
      });
    }

    const laps = members.length === 0
      ? []
      : await prisma.timeTrialLap.findMany({
          where: {
            gameweek_id: gameweek.id,
            user_id: { in: members.map((entry) => entry.user_id) },
          },
          select: {
            user_id: true,
            official_time: true,
            sectors: true,
            created_at: true,
          },
        });

    const ranking = rankLeagueClm(
      members.map((entry) => ({
        user_id: entry.user_id,
        username: entry.profile.username,
        display_name: entry.profile.display_name,
      })),
      laps,
    );

    return NextResponse.json({
      gameweek: {
        id: gameweek.id,
        name: gameweek.name,
        round_number: gameweek.round_number,
        circuit: gameweek.circuit,
      },
      ranking,
    });
  } catch (error) {
    console.error('GET /api/leagues/[id]/clm:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}
