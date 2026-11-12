import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { f1DriverCardInclude, presentF1Driver } from '@/lib/present-driver';

// GET /api/f1/drivers — Liste des pilotes F1 actifs, avec stats carrière
export async function GET() {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const drivers = await prisma.realEntity.findMany({
      where: { sport: 'f1', active: true },
      orderBy: { base_price: 'desc' },
      include: { f1_driver: { include: f1DriverCardInclude } },
    });

    return NextResponse.json({
      drivers: drivers.map((driver) => ({
        ...driver,
        f1_driver: presentF1Driver(driver.f1_driver),
      })),
    });
  } catch (error) {
    console.error('GET /api/f1/drivers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
