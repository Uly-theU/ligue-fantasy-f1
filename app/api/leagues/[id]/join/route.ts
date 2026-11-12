import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { enrollMember } from '@/lib/league-enroll';
import { currentSessionUser } from '@/lib/auth';
import { z } from 'zod';

type LeagueJoinParams = {
  params: {
    id: string;
  };
};

const joinLeagueSchema = z.object({
  invite_code: z.string().length(8, "Le code d'invitation doit contenir 8 caractères."),
});

export async function POST(req: NextRequest, { params }: LeagueJoinParams) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const paramId = params.id;

  try {
    const body = await req.json();
    const { invite_code } = joinLeagueSchema.parse(body);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paramId);
    const league = await prisma.league.findFirst({
      where: {
        invite_code,
        ...(isUuid ? { id: paramId } : { short_code: paramId }),
      },
    });

    if (!league) {
      return NextResponse.json({ message: 'Code ou ligue invalide' }, { status: 400 });
    }

    const existingMember = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: league.id, user_id: user.id } },
    });

    if (existingMember) {
      return NextResponse.json({ message: 'Tu es déjà dans cette ligue' }, { status: 409 });
    }

    const settings = (league.settings ?? {}) as Record<string, unknown>;
    const initialBudget = league.draft_mode === 'salary_cap'
      ? (settings.budget as number) ?? 100_000_000
      : null;

    const result = await enrollMember(
      {
        transaction: (fn) =>
          prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT id FROM league_members WHERE league_id = ${league.id}::uuid FOR UPDATE`;
            return fn({
              countMembers: (leagueId) => tx.leagueMember.count({ where: { league_id: leagueId } }),
              insertMember: async (leagueId, userId) => {
                await tx.leagueMember.create({
                  data: { league_id: leagueId, user_id: userId, role: 'member' },
                });
              },
              insertTeam: async (leagueId, userId, name, budget) => {
                await tx.fantasyTeam.create({
                  data: { league_id: leagueId, user_id: userId, name, current_budget: budget },
                });
              },
            });
          }),
      },
      {
        leagueId: league.id,
        userId: user.id,
        teamName: `${user.email?.split('@')[0] || 'Mon Equipe'} F1`,
        budget: initialBudget,
        maxPlayers: league.max_players,
      },
    );

    if (!result.ok) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    return NextResponse.json({ message: 'Tu as rejoint la ligue' }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}
