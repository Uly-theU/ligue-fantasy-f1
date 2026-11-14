import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { syncGameweekStatuses } from '@/lib/sync-gameweeks';

// GET /api/f1/calendar?season=2026 — Calendrier des GP
export async function GET(req: NextRequest) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  const season = Number(req.nextUrl.searchParams.get('season') ?? 2026);

  try {
    await syncGameweekStatuses(season);

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
