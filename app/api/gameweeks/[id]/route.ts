import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { updateGameweekSchema } from '@/lib/validators';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { getCircuitSheet } from '@/lib/circuit-sheet';
import { z } from 'zod';

type Params = { params: { id: string } };

// GET /api/gameweeks/[id] — Détail d'un GP
export async function GET(req: NextRequest, { params }: Params) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: params.id },
      include: {
        performances: { include: { real_entity: true }, orderBy: { real_entity: { base_price: 'desc' } } },
      },
    });

    if (!gameweek) {
      return NextResponse.json({ message: 'GP non trouvé' }, { status: 404 });
    }

    const circuit_sheet = gameweek.circuit_id
      ? await getCircuitSheet(gameweek.circuit_id, gameweek.circuit_layout_id)
      : null;

    return NextResponse.json({ gameweek, circuit_sheet });
  } catch (error) {
    console.error('GET /api/gameweeks/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/gameweeks/[id] — Modifier un GP
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;
  if (!isPlatformAdmin(user!.id)) {
    return NextResponse.json({ message: 'Réservé à un admin plateforme' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateGameweekSchema.parse(body);

    const updateData: Record<string, unknown> = { ...data };
    if (data.race_date) updateData.race_date = new Date(data.race_date);
    if (data.qualifying_date) updateData.qualifying_date = new Date(data.qualifying_date);
    if (data.lock_time) updateData.lock_time = new Date(data.lock_time);

    const gameweek = await prisma.gameweek.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ gameweek });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('PATCH /api/gameweeks/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/gameweeks/[id] — Supprimer un GP
export async function DELETE(req: NextRequest, { params }: Params) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;
  if (!isPlatformAdmin(user!.id)) {
    return NextResponse.json({ message: 'Réservé à un admin plateforme' }, { status: 403 });
  }

  try {
    await prisma.gameweek.delete({ where: { id: params.id } });
    return NextResponse.json({ message: 'GP supprimé' });
  } catch (error) {
    console.error('DELETE /api/gameweeks/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
