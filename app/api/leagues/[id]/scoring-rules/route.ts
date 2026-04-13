import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { DEFAULT_SCORING_RULES } from '@/lib/scoring';
import { z } from 'zod';

type Params = { params: { id: string } }; // league_id

// GET /api/leagues/[id]/scoring-rules — Règles de scoring de la ligue
export async function GET(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const member = await prisma.leagueMember.findUnique({
      where: { league_id_user_id: { league_id: params.id, user_id: user!.id } },
    });
    if (!member) {
      return NextResponse.json({ message: 'Accès refusé' }, { status: 403 });
    }

    const scoringRule = await prisma.scoringRule.findUnique({
      where: { league_id: params.id },
    });

    return NextResponse.json({
      rules: scoringRule?.rules ?? DEFAULT_SCORING_RULES,
      is_custom: !!scoringRule,
    });
  } catch (error) {
    console.error('GET /api/leagues/[id]/scoring-rules:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/leagues/[id]/scoring-rules — Définir/remplacer les règles (owner only)
export async function PUT(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const league = await prisma.league.findUnique({ where: { id: params.id } });
    if (!league) {
      return NextResponse.json({ message: 'Ligue introuvable' }, { status: 404 });
    }
    if (league.owner_id !== user!.id) {
      return NextResponse.json({ message: 'Seul le propriétaire peut modifier les règles' }, { status: 403 });
    }
    if (league.status !== 'setup') {
      return NextResponse.json({ message: 'Les règles ne peuvent être modifiées qu\'en phase setup' }, { status: 400 });
    }

    const body = await req.json();

    // Validation légère : on vérifie la structure de base
    const rulesSchema = z.object({
      race_finish: z.record(z.number()),
      qualifying: z.record(z.number()),
      bonuses: z.object({
        fastest_lap: z.number(),
        driver_of_the_day: z.number(),
        positions_gained_per_place: z.number(),
      }),
      penalties: z.object({
        dnf_mechanical: z.number(),
        dnf_accident: z.number(),
        grid_penalty_per_place: z.number(),
      }),
    });

    const rules = rulesSchema.parse(body);

    const scoringRule = await prisma.scoringRule.upsert({
      where: { league_id: params.id },
      update: { rules: rules as object },
      create: { league_id: params.id, rules: rules as object },
    });

    return NextResponse.json({ message: 'Règles mises à jour', scoring_rule: scoringRule });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('PUT /api/leagues/[id]/scoring-rules:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
