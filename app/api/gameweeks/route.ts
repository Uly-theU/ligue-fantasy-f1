import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { createGameweekSchema } from '@/lib/validators';
import { z } from 'zod';

// POST /api/gameweeks — Créer un GP (admin only / dev)
export async function POST(req: NextRequest) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const data = createGameweekSchema.parse(body);

    const gameweek = await prisma.gameweek.create({
      data: {
        season: data.season,
        round_number: data.round_number,
        name: data.name,
        circuit: data.circuit,
        country: data.country,
        race_date: new Date(data.race_date),
        qualifying_date: data.qualifying_date ? new Date(data.qualifying_date) : null,
        lock_time: data.lock_time ? new Date(data.lock_time) : null,
      },
    });

    return NextResponse.json({ gameweek }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: 'Données invalides', errors: error.errors }, { status: 400 });
    }
    console.error('POST /api/gameweeks:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
