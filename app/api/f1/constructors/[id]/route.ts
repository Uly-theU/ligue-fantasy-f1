import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { asNumber, F1_DATA_SOURCE } from '@/lib/f1-reference';

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const constructor = await prisma.f1Constructor.findUnique({
      where: { id: params.id },
      include: { season_stats: { orderBy: { year: 'desc' } } },
    });
    if (!constructor) return NextResponse.json({ message: 'Écurie introuvable' }, { status: 404 });

    return NextResponse.json({
      source: F1_DATA_SOURCE,
      constructor: {
        id: constructor.id,
        name: constructor.name,
        full_name: constructor.full_name,
        country_name: constructor.country_name,
        country_code: constructor.country_code,
        color: constructor.color,
        active: constructor.active,
        total_championship_wins: constructor.total_championship_wins,
        total_race_entries: constructor.total_race_entries,
        total_race_starts: constructor.total_race_starts,
        total_race_wins: constructor.total_race_wins,
        total_podiums: constructor.total_podiums,
        total_pole_positions: constructor.total_pole_positions,
        total_fastest_laps: constructor.total_fastest_laps,
        total_points: asNumber(constructor.total_points),
        best_championship_position: constructor.best_championship_position,
        best_race_result: constructor.best_race_result,
      },
      seasons: constructor.season_stats.map((season) => ({
        year: season.year,
        position: season.position,
        position_text: season.position_text,
        points: asNumber(season.points) ?? 0,
        wins: season.wins,
        podiums: season.podiums,
        poles: season.poles,
        fastest_laps: season.fastest_laps,
        starts: season.starts,
      })),
    });
  } catch (error) {
    console.error('GET /api/f1/constructors/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
