import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';
import { asNumber, CIRCUIT_TYPE_LABEL, DIRECTION_LABEL } from '@/lib/f1-reference';

export async function GET() {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const circuits = await prisma.circuit.findMany({ orderBy: { name: 'asc' } });
    return NextResponse.json({
      circuits: circuits.map((circuit) => ({
        id: circuit.id,
        name: circuit.name,
        full_name: circuit.full_name,
        place_name: circuit.place_name,
        country_name: circuit.country_name,
        country_code: circuit.country_code,
        circuit_type_label: CIRCUIT_TYPE_LABEL[circuit.circuit_type] ?? circuit.circuit_type,
        direction_label: DIRECTION_LABEL[circuit.direction] ?? circuit.direction,
        length_km: asNumber(circuit.length_km),
        turns: circuit.turns,
        total_races: circuit.total_races,
      })),
    });
  } catch (error) {
    console.error('GET /api/f1/circuits:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
