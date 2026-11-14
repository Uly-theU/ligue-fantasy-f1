import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getCircuitSheet } from '@/lib/circuit-sheet';

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const sheet = await getCircuitSheet(params.id);
    if (!sheet) return NextResponse.json({ message: 'Circuit introuvable' }, { status: 404 });
    return NextResponse.json(sheet);
  } catch (error) {
    console.error('GET /api/f1/circuits/[id]:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
