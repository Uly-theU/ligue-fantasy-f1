import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET /api/f1/drivers — Liste des pilotes F1 actifs
export async function GET(req: NextRequest) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const drivers = await prisma.realEntity.findMany({
      where: { sport: 'f1', active: true },
      orderBy: { base_price: 'desc' },
    });

    return NextResponse.json({ drivers });
  } catch (error) {
    console.error('GET /api/f1/drivers:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
