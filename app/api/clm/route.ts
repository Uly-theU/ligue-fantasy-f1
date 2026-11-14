import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { nextRaceFrom } from '@/lib/clm';
import { bundledCircuits, bundledCorners, bundledElevation, bundledSvg, type BundledCircuit } from '@/lib/circuits-2026';
import { asNumber, countryLabel, DIRECTION_LABEL, normalizeTrackSvg } from '@/lib/f1-reference';
import { databaseUnreachable, prisma } from '@/lib/prisma';

/**
 * GET /api/clm — tracé du contre-la-montre.
 * Sans paramètre : le prochain Grand Prix. Avec `?circuit=<id F1DB>` : un circuit du calendrier 2026.
 */
export async function GET(request: Request) {
  const { errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;

  try {
    const wanted = new URL(request.url).searchParams.get('circuit');
    const catalog = bundledCircuits();
    let places = new Map<string, string>();
    let database = true;
    try {
      places = await placesOf(catalog.map((circuit) => circuit.circuit_id));
    } catch (error) {
      if (!databaseUnreachable(error)) throw error;
      database = false;
    }
    const circuits = catalog.map((circuit) => ({
      circuit_id: circuit.circuit_id,
      round: circuit.round,
      full_name: circuit.full_name,
      place_name: places.get(circuit.circuit_id) ?? null,
      range_m: bundledElevation(circuit.circuit_id)?.range_m ?? null,
    }));

    if (wanted) {
      const circuit = catalog.find((entry) => entry.circuit_id === wanted);
      if (!circuit) return NextResponse.json({ message: 'Circuit inconnu' }, { status: 404 });
      const svg = normalizeTrackSvg(bundledSvg(circuit));
      if (!svg) return NextResponse.json({ message: 'Le tracé de ce circuit n’est pas disponible' }, { status: 404 });
      return NextResponse.json({
        circuits,
        trial: {
          gameweek_id: null,
          name: circuit.full_name,
          circuit: circuit.full_name,
          country: null,
          round_number: circuit.round,
          race_date: circuit.date,
          circuit_id: circuit.circuit_id,
          full_name: circuit.full_name,
          place_name: places.get(circuit.circuit_id) ?? null,
          length_km: circuit.length_km,
          turns: circuit.turns,
          direction_label: DIRECTION_LABEL[circuit.direction] ?? null,
          svg,
          elevation: bundledElevation(circuit.circuit_id),
          corners: bundledCorners(circuit.circuit_id),
          next_race: false,
        },
      });
    }

    if (!database) {
      const circuit = nextBundled(catalog, new Date());
      const trial = circuit ? trialFromBundled(circuit, null, true) : null;
      if (!trial) return NextResponse.json({ message: 'Aucun Grand Prix à venir' }, { status: 404 });
      return NextResponse.json({ circuits, trial });
    }

    const gameweek = await prisma.gameweek.findFirst({
      where: { race_date: { gte: nextRaceFrom(new Date()) } },
      orderBy: [{ race_date: 'asc' }, { round_number: 'asc' }],
      include: { circuit_ref: true, layout: true },
    });
    if (!gameweek) {
      return NextResponse.json({ message: 'Aucun Grand Prix à venir' }, { status: 404 });
    }

    let svg = gameweek.layout?.svg ?? null;
    let lengthKm = asNumber(gameweek.layout?.length_km) ?? asNumber(gameweek.circuit_ref?.length_km);
    let turns = gameweek.layout?.turns ?? gameweek.circuit_ref?.turns ?? null;
    let layoutId = gameweek.layout?.svg ? gameweek.circuit_layout_id : null;
    if (!svg && gameweek.circuit_id) {
      const layout = await prisma.circuitLayout.findFirst({
        where: { circuit_id: gameweek.circuit_id, effective: true },
      });
      if (layout) {
        svg = layout.svg;
        layoutId = layout.id;
        lengthKm = lengthKm ?? asNumber(layout.length_km);
        turns = turns ?? layout.turns;
      }
    }

    const safeSvg = svg ? normalizeTrackSvg(svg) : null;
    if (!safeSvg) {
      return NextResponse.json({ message: 'Le tracé de ce circuit n’est pas encore disponible' }, { status: 404 });
    }

    const bundled = catalog.find((entry) => entry.circuit_id === gameweek.circuit_id);
    const sameLayout = bundled != null && bundled.layout_id === layoutId;
    const direction = gameweek.circuit_ref?.direction ?? '';
    return NextResponse.json({
      circuits,
      trial: {
        gameweek_id: gameweek.id,
        name: gameweek.name,
        circuit: gameweek.circuit,
        country: gameweek.country,
        round_number: gameweek.round_number,
        race_date: gameweek.race_date,
        circuit_id: gameweek.circuit_id,
        full_name: gameweek.circuit_ref?.full_name ?? gameweek.circuit,
        place_name: gameweek.circuit_ref ? `${gameweek.circuit_ref.place_name}, ${countryLabel(gameweek.circuit_ref.country_name)}` : null,
        length_km: lengthKm,
        turns,
        direction_label: DIRECTION_LABEL[direction] ?? null,
        svg: safeSvg,
        elevation: sameLayout ? bundledElevation(gameweek.circuit_id) : null,
        corners: sameLayout ? bundledCorners(gameweek.circuit_id) : null,
        next_race: true,
      },
    });
  } catch (error) {
    console.error('GET /api/clm:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

async function placesOf(ids: string[]): Promise<Map<string, string>> {
  const rows = await prisma.circuit.findMany({
    where: { id: { in: ids } },
    select: { id: true, place_name: true, country_name: true },
  });
  return new Map(rows.map((row) => [row.id, `${row.place_name}, ${countryLabel(row.country_name)}`]));
}

/** Prochain Grand Prix du calendrier livré, quand Postgres n'est pas joignable. */
function nextBundled(catalog: BundledCircuit[], now: Date): BundledCircuit | null {
  const cutoff = nextRaceFrom(now).toISOString().slice(0, 10);
  const upcoming = catalog.filter((circuit) => circuit.date >= cutoff);
  return upcoming[0] ?? catalog[catalog.length - 1] ?? null;
}

function trialFromBundled(circuit: BundledCircuit, place: string | null, nextRace: boolean) {
  const svg = normalizeTrackSvg(bundledSvg(circuit));
  if (!svg) return null;
  return {
    gameweek_id: null,
    name: circuit.full_name,
    circuit: circuit.full_name,
    country: null,
    round_number: circuit.round,
    race_date: circuit.date,
    circuit_id: circuit.circuit_id,
    full_name: circuit.full_name,
    place_name: place,
    length_km: circuit.length_km,
    turns: circuit.turns,
    direction_label: DIRECTION_LABEL[circuit.direction] ?? null,
    svg,
    elevation: bundledElevation(circuit.circuit_id),
    corners: bundledCorners(circuit.circuit_id),
    next_race: nextRace,
  };
}
