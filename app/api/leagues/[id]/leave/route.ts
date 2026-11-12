import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { currentSessionUser } from '@/lib/auth';

type LeagueLeaveParams = {
  params: {
    id: string;
  };
};

export async function DELETE(_req: NextRequest, { params }: LeagueLeaveParams) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  const leagueId = params.id;

  try {
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: leagueId, user_id: user.id } },
      select: { id: true, role: true },
    });

    if (!member) {
      return NextResponse.json({ message: 'Tu n\'es pas membre de cette ligue' }, { status: 404 });
    }

    if (member.role === 'owner') {
      return NextResponse.json(
        { message: 'Le propriétaire ne peut pas quitter la ligue. Transfère la propriété ou supprime la ligue.' },
        { status: 403 },
      );
    }

    await prisma.$transaction([
      prisma.fantasyTeam.deleteMany({ where: { league_id: leagueId, user_id: user.id } }),
      prisma.leagueMember.delete({ where: { id: member.id } }),
    ]);

    return NextResponse.json({ message: 'Tu as quitté la ligue' }, { status: 200 });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}
