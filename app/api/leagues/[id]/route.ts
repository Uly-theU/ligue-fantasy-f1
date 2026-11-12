import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { currentSessionUser } from '@/lib/auth';
import { z } from 'zod';

type LeagueParams = {
  params: {
    id: string;
  };
};

const updateLeagueSchema = z.object({
  name: z.string().min(1, "Le nom de la ligue est requis.").max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  draft_mode: z.enum(['salary_cap', 'exclusive_draft']).optional(),
  max_players: z.number().int().min(2).max(20).optional(),
  status: z.enum(['setup', 'active', 'completed']).optional(),
  settings: z.record(z.any()).optional(),
});

function toLeagueDetail<T extends {
  members: Array<{
    user_id: string;
    role: string;
    profile: { username: string; display_name: string | null; avatar_url: string | null };
  }>;
}>(league: T) {
  const { members, ...rest } = league;
  return {
    ...rest,
    league_members: members.map((member) => ({
      user_id: member.user_id,
      role: member.role,
      profiles: member.profile,
    })),
  };
}

export async function GET(_req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          include: {
            profile: { select: { username: true, display_name: true, avatar_url: true } },
          },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }

    const isMember = league.members.some((member) => member.user_id === user.id);
    if (!isMember) {
      return NextResponse.json({ message: 'Accès refusé à cette ligue' }, { status: 403 });
    }

    return NextResponse.json({ league: toLeagueDetail(league) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const body = await req.json();
    const validatedData = updateLeagueSchema.parse(body);

    const existingLeague = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { owner_id: true },
    });

    if (!existingLeague) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }

    if (existingLeague.owner_id !== user.id) {
      return NextResponse.json({ message: 'Seul le propriétaire peut modifier la ligue' }, { status: 403 });
    }

    const data: Prisma.LeagueUpdateInput = {};
    if (validatedData.name !== undefined) data.name = validatedData.name;
    if (validatedData.description !== undefined) data.description = validatedData.description;
    if (validatedData.draft_mode !== undefined) data.draft_mode = validatedData.draft_mode;
    if (validatedData.max_players !== undefined) data.max_players = validatedData.max_players;
    if (validatedData.status !== undefined) data.status = validatedData.status;
    if (validatedData.settings !== undefined) data.settings = validatedData.settings as Prisma.InputJsonValue;

    const updatedLeague = await prisma.league.update({
      where: { id: leagueId },
      data,
    });

    return NextResponse.json({ message: 'Ligue mise à jour', league: updatedLeague });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: LeagueParams) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      select: { owner_id: true, status: true },
    });

    if (!league) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }

    if (league.owner_id !== user.id) {
      return NextResponse.json({ message: 'Seul le propriétaire peut supprimer la ligue' }, { status: 403 });
    }

    if (league.status !== 'setup') {
      return NextResponse.json({ message: 'Impossible de supprimer une ligue active ou terminée' }, { status: 400 });
    }

    await prisma.league.delete({ where: { id: leagueId } });

    return NextResponse.json({ message: 'Ligue supprimée' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}
