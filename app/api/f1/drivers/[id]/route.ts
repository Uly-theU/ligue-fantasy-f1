import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { F1_DATA_SOURCE } from '@/lib/f1-reference';
import { presentConstructor, presentF1Driver, presentSeason } from '@/lib/present-driver';

type Params = { params: { id: string } };

const seasonInclude = {
  orderBy: { year: 'desc' as const },
  include: { team: { select: { id: true, name: true } } },
};

export async function GET(_req: NextRequest, { params }: Params) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const entityId = z.string().uuid().safeParse(params.id);
    const entity = entityId.success
      ? await prisma.realEntity.findUnique({
          where: { id: entityId.data },
          include: {
            f1_driver: {
              include: {
                season_stats: seasonInclude,
                current_constructor: true,
              },
            },
          },
        })
      : null;

    const driver = entity
      ? entity.f1_driver
      : await prisma.f1Driver.findUnique({
          where: { id: params.id },
          include: {
            season_stats: seasonInclude,
            current_constructor: true,
          },
        });

    if (!driver) return NextResponse.json({ message: 'Pilote introuvable' }, { status: 404 });

    return NextResponse.json({
      source: F1_DATA_SOURCE,
      entity_id: entity?.id ?? null,
      driver: presentF1Driver(driver),
      constructor: presentConstructor(driver.current_constructor),
      seasons: driver.season_stats.map(presentSeason),
    });
  } catch (error) {
    console.error('GET /api/f1/drivers/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
