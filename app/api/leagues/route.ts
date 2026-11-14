import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { prisma } from '@/lib/prisma';
import { drawCode } from '@/lib/invite-code';
import { currentSessionUser } from '@/lib/auth';
import { z } from 'zod';

const createLeagueSchema = z.object({
  name: z.string().min(1, "Le nom de la ligue est requis.").max(100),
  description: z.string().max(1000).optional(),
  draft_mode: z.enum(['salary_cap', 'exclusive_draft']),
  max_players: z.number().int().min(2).max(20).optional().default(10),
  season: z.number().int().min(2024).optional().default(2026),
});

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const validatedData = createLeagueSchema.parse(body);
    const initialBudget = validatedData.draft_mode === 'salary_cap' ? 100_000_000 : null;
    const handle = (user.email?.split('@')[0] || 'Mon Equipe').slice(0, 90);

    let league: { id: string } | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < 5; attempt++) {
      const inviteCode = drawCode(8);
      const shortCode = drawCode(6);
      try {
        league = await prisma.league.create({
          data: {
            name: validatedData.name,
            description: validatedData.description,
            draft_mode: validatedData.draft_mode,
            max_players: validatedData.max_players,
            season: validatedData.season,
            owner_id: user.id,
            invite_code: inviteCode,
            short_code: shortCode,
            members: {
              create: { user_id: user.id, role: 'owner' },
            },
            fantasy_teams: {
              create: {
                user_id: user.id,
                name: `${handle} F1`,
                current_budget: initialBudget,
              },
            },
          },
          select: { id: true },
        });
        break;
      } catch (error) {
        lastError = error;
        if (!isUniqueViolation(error)) throw error;
      }
    }

    if (!league) {
      console.error('Error creating league:', lastError);
      return NextResponse.json({ message: 'Impossible de créer la ligue' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Ligue créée', league }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}

export async function GET() {
  const supabase = createServerSupabaseClient();
  const user = await currentSessionUser(supabase);

  if (!user) {
    return NextResponse.json({ message: 'Non autorisé' }, { status: 401 });
  }

  try {
    const memberships = await prisma.leagueMember.findMany({
      where: { user_id: user.id },
      include: { league: true },
    });

    return NextResponse.json({ leagues: memberships.map((member) => member.league) });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Erreur interne' }, { status: 500 });
  }
}
