import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET /api/f1/calendar?season=2026 — Calendrier des GP
export async function GET(req: NextRequest) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  const season = Number(req.nextUrl.searchParams.get('season') ?? 2026);

  try {
    const now = new Date();
    const raceBuffer = new Date(now.getTime() - 3 * 60 * 60 * 1000); // race_date + 3h

    // Transitions progressives des statuts
    // upcoming → locked (lock_time dépassé)
    await prisma.gameweek.updateMany({
      where: { season, status: 'upcoming', lock_time: { lte: now, not: null } },
      data: { status: 'locked' },
    });
    // locked → live (qualifying_date dépassé)
    await prisma.gameweek.updateMany({
      where: { season, status: 'locked', qualifying_date: { lte: now } },
      data: { status: 'live' },
    });
    // live → completed (race_date + 3h dépassé)
    await prisma.gameweek.updateMany({
      where: { season, status: 'live', race_date: { lte: raceBuffer } },
      data: { status: 'completed' },
    });
    // Fallback : upcoming sans lock_time dont la course est passée → completed
    await prisma.gameweek.updateMany({
      where: { season, status: 'upcoming', lock_time: null, race_date: { lte: raceBuffer } },
      data: { status: 'completed' },
    });

    const gameweeks = await prisma.gameweek.findMany({
      where: { season },
      orderBy: { round_number: 'asc' },
    });

    return NextResponse.json({ gameweeks });
  } catch (error) {
    console.error('GET /api/f1/calendar:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
