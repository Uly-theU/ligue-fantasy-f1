import { prisma } from '@/lib/prisma';
import { asNumber, CIRCUIT_TYPE_LABEL, countryLabel, DIRECTION_LABEL, F1_DATA_SOURCE } from '@/lib/f1-reference';

export async function getCircuitSheet(circuitId: string, layoutId?: string | null) {
  const circuit = await prisma.circuit.findUnique({ where: { id: circuitId } });
  if (!circuit) return null;

  const layout = layoutId
    ? await prisma.circuitLayout.findUnique({ where: { id: layoutId } })
    : await prisma.circuitLayout.findFirst({ where: { circuit_id: circuitId, effective: true } });

  const recent = await prisma.raceRecord.findMany({
    where: { circuit_id: circuitId, winner_driver_id: { not: null } },
    orderBy: [{ year: 'desc' }, { round: 'desc' }],
    take: 8,
    include: {
      winner_driver: { select: { display_name: true, full_name: true, abbreviation: true } },
      winner_constructor: { select: { name: true } },
      pole_driver: { select: { display_name: true, full_name: true } },
      fastest_lap_driver: { select: { abbreviation: true } },
    },
  });

  const grouped = await prisma.raceRecord.groupBy({
    by: ['winner_driver_id'],
    where: { circuit_id: circuitId, winner_driver_id: { not: null } },
    _count: { _all: true },
    orderBy: { _count: { winner_driver_id: 'desc' } },
    take: 3,
  });

  const winnerIds = grouped.flatMap((row) => (row.winner_driver_id ? [row.winner_driver_id] : []));
  const winners = winnerIds.length
    ? await prisma.f1Driver.findMany({
        where: { id: { in: winnerIds } },
        select: { id: true, display_name: true, full_name: true },
      })
    : [];
  const winnerName = new Map(winners.map((driver) => [driver.id, driver.display_name || driver.full_name]));

  return {
    source: F1_DATA_SOURCE,
    circuit: {
      id: circuit.id,
      name: circuit.name,
      full_name: circuit.full_name,
      place_name: circuit.place_name,
      country_name: countryLabel(circuit.country_name),
      country_code: circuit.country_code,
      circuit_type: circuit.circuit_type,
      circuit_type_label: CIRCUIT_TYPE_LABEL[circuit.circuit_type] ?? circuit.circuit_type,
      direction: circuit.direction,
      direction_label: DIRECTION_LABEL[circuit.direction] ?? circuit.direction,
      length_km: asNumber(circuit.length_km) ?? 0,
      turns: circuit.turns,
      total_races: circuit.total_races,
      latitude: asNumber(circuit.latitude) ?? 0,
      longitude: asNumber(circuit.longitude) ?? 0,
    },
    layout: layout
      ? {
          id: layout.id,
          effective: layout.effective,
          length_km: asNumber(layout.length_km) ?? 0,
          turns: layout.turns,
          svg: layout.svg,
        }
      : null,
    recent_races: recent.map((race) => ({
      year: race.year,
      round: race.round,
      official_name: race.official_name,
      winner_name: race.winner_driver?.display_name || race.winner_driver?.full_name || null,
      winner_abbreviation: race.winner_driver?.abbreviation ?? null,
      constructor_name: race.winner_constructor?.name ?? null,
      pole_name: race.pole_driver?.display_name || race.pole_driver?.full_name || null,
      fastest_lap_abbreviation: race.fastest_lap_driver?.abbreviation ?? null,
      fastest_lap_time: race.fastest_lap_time,
    })),
    top_winners: grouped.flatMap((row) => {
      if (!row.winner_driver_id) return [];
      return [{
        driver_id: row.winner_driver_id,
        full_name: winnerName.get(row.winner_driver_id) ?? row.winner_driver_id,
        wins: row._count._all,
      }];
    }),
  };
}
