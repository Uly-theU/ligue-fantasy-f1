import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { asNumber } from '@/lib/f1-reference';

export async function GET() {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const constructors = await prisma.f1Constructor.findMany({
      where: { active: true },
      orderBy: [{ total_championship_wins: 'desc' }, { total_race_wins: 'desc' }, { name: 'asc' }],
    });
    return NextResponse.json({
      constructors: constructors.map((constructor) => ({
        id: constructor.id,
        name: constructor.name,
        full_name: constructor.full_name,
        country_name: constructor.country_name,
        country_code: constructor.country_code,
        color: constructor.color,
        total_championship_wins: constructor.total_championship_wins,
        total_race_wins: constructor.total_race_wins,
        total_podiums: constructor.total_podiums,
        total_pole_positions: constructor.total_pole_positions,
        total_fastest_laps: constructor.total_fastest_laps,
        total_points: asNumber(constructor.total_points),
        best_championship_position: constructor.best_championship_position,
      })),
    });
  } catch (error) {
    console.error('GET /api/f1/constructors:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
