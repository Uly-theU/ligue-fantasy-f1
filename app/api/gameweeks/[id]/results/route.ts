import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { upsertPerformanceSchema } from '@/lib/validators';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { freezeLineupsForGameweek } from '@/lib/freeze-lineups';
import { z } from 'zod';

type Params = { params: { id: string } }; // gameweek_id

// GET /api/gameweeks/[id]/results — Résultats d'un GP
export async function GET(req: NextRequest, { params }: Params) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const performances = await prisma.performance.findMany({
      where: { gameweek_id: params.id },
      include: { real_entity: true },
    });

    return NextResponse.json({ performances });
  } catch (error) {
    console.error('GET /api/gameweeks/[id]/results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/gameweeks/[id]/results — Saisir/mettre à jour les résultats d'un pilote
export async function POST(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;
  if (!isPlatformAdmin(user!.id)) {
    return NextResponse.json({ message: 'Réservé à un admin plateforme' }, { status: 403 });
  }

  try {
    const body = await req.json();

    // Accepte un array ou un seul objet
    const items = Array.isArray(body) ? body : [body];
    const validated = items.map((item) => upsertPerformanceSchema.parse(item));

    const gameweek = await prisma.gameweek.findUnique({
      where: { id: params.id },
      select: { season: true },
    });
    if (!gameweek) {
      return NextResponse.json({ message: 'GP non trouvé' }, { status: 404 });
    }

    const results = await prisma.$transaction(
      validated.map((v) =>
        prisma.performance.upsert({
          where: {
            gameweek_id_real_entity_id: {
              gameweek_id: params.id,
              real_entity_id: v.real_entity_id,
            },
          },
          update: { results: v.results as object },
          create: {
            gameweek_id: params.id,
            real_entity_id: v.real_entity_id,
            results: v.results as object,
          },
        }),
      ),
    );

    // Geler avant completed : si la copie échoue, le GP ne passe pas à completed.
    await freezeLineupsForGameweek(params.id, gameweek.season);

    await prisma.gameweek.update({
      where: { id: params.id },
      data: { status: 'completed' },
    });

    return NextResponse.json({ message: `${results.length} résultat(s) enregistré(s)`, performances: results });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/gameweeks/[id]/results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
