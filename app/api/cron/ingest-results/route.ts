import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ISO_TO_COUNTRY_NAME } from '@/lib/country-map';

const OPENF1_BASE = 'https://api.openf1.org/v1';

interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  country_name: string;
  circuit_short_name: string;
  year: number;
}

interface OpenF1Position {
  driver_number: number;
  position: number;
  date: string;
}

interface OpenF1Driver {
  driver_number: number;
  name_acronym: string;
  full_name: string;
  team_name: string;
}

interface OpenF1StartingGrid {
  driver_number: number;
  position: number;
}

interface OpenF1Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  is_pit_out_lap: boolean;
}

/** Fetch JSON depuis OpenF1 avec gestion d'erreur. Retourne [] si échec. */
async function openf1Fetch<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${OPENF1_BASE}${path}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** Convertit un code ISO pays en nom OpenF1. */
function countryNameForOpenF1(isoCode: string | null): string {
  if (!isoCode) return '';
  return ISO_TO_COUNTRY_NAME[isoCode] ?? isoCode;
}

/**
 * Trouve la session la plus proche de la date de course parmi les résultats OpenF1.
 * Gère les pays avec plusieurs GP (Italie x2, USA x3).
 */
function findClosestSession(sessions: OpenF1Session[], raceDate: Date): OpenF1Session | null {
  if (sessions.length === 0) return null;
  if (sessions.length === 1) return sessions[0];

  return sessions.reduce((closest, session) => {
    const diffCurrent = Math.abs(new Date(session.date_start).getTime() - raceDate.getTime());
    const diffClosest = Math.abs(new Date(closest.date_start).getTime() - raceDate.getTime());
    return diffCurrent < diffClosest ? session : closest;
  });
}

/**
 * Trouve le pilote ayant le meilleur tour (lap_duration le plus bas).
 * Ignore les pit out laps et les laps sans durée.
 */
function findFastestLapDriver(laps: OpenF1Lap[]): number | null {
  let bestTime = Infinity;
  let bestDriver: number | null = null;

  for (const lap of laps) {
    if (lap.is_pit_out_lap || lap.lap_duration === null || lap.lap_duration <= 0) continue;
    if (lap.lap_duration < bestTime) {
      bestTime = lap.lap_duration;
      bestDriver = lap.driver_number;
    }
  }

  return bestDriver;
}

/** Met à jour les statuts des gameweeks pour une saison donnée. */
async function updateGameweekStatuses(season: number) {
  const now = new Date();
  const raceBuffer = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  await prisma.gameweek.updateMany({
    where: { season, status: 'upcoming', lock_time: { lte: now, not: null } },
    data: { status: 'locked' },
  });
  await prisma.gameweek.updateMany({
    where: { season, status: 'locked', qualifying_date: { lte: now } },
    data: { status: 'live' },
  });
  await prisma.gameweek.updateMany({
    where: { season, status: 'live', race_date: { lte: raceBuffer } },
    data: { status: 'completed' },
  });
  await prisma.gameweek.updateMany({
    where: { season, status: 'upcoming', lock_time: null, race_date: { lte: raceBuffer } },
    data: { status: 'completed' },
  });
}

/**
 * Logique d'ingestion d'un GP unique.
 * Retourne un résumé ou null si rien à ingérer.
 */
async function ingestGameweek(gameweekId: string) {
  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) return null;

  const countryName = encodeURIComponent(countryNameForOpenF1(gameweek.country));

  // 1. Trouver les sessions Race et Qualifying sur OpenF1
  const [raceSessions, qualifSessions] = await Promise.all([
    openf1Fetch<OpenF1Session>(`/sessions?year=${gameweek.season}&session_type=Race&country_name=${countryName}`),
    openf1Fetch<OpenF1Session>(`/sessions?year=${gameweek.season}&session_type=Qualifying&country_name=${countryName}`),
  ]);

  if (raceSessions.length === 0) return null;

  // Désambiguer si plusieurs GP dans le même pays (IT x2, US x3)
  const raceSession = findClosestSession(raceSessions, gameweek.race_date)!;
  const qualifSession = findClosestSession(qualifSessions, gameweek.race_date);

  // 2. Récupérer en parallèle les données
  const [racePositions, openf1Drivers, startingGrid, qualifPositions, laps] = await Promise.all([
    openf1Fetch<OpenF1Position>(`/position?session_key=${raceSession.session_key}`),
    openf1Fetch<OpenF1Driver>(`/drivers?session_key=${raceSession.session_key}`),
    openf1Fetch<OpenF1StartingGrid>(`/starting_grid?session_key=${raceSession.session_key}`),
    qualifSession
      ? openf1Fetch<OpenF1Position>(`/position?session_key=${qualifSession.session_key}`)
      : Promise.resolve([] as OpenF1Position[]),
    openf1Fetch<OpenF1Lap>(`/laps?session_key=${raceSession.session_key}`),
  ]);

  // Positions finales de course
  const finalRacePositions = new Map<number, number>();
  for (const pos of racePositions) {
    finalRacePositions.set(pos.driver_number, pos.position);
  }

  // Grille de départ
  const gridPositions = new Map<number, number>();
  for (const g of startingGrid) {
    gridPositions.set(g.driver_number, g.position);
  }

  // Positions finales de qualification
  const finalQualifPositions = new Map<number, number>();
  for (const pos of qualifPositions) {
    finalQualifPositions.set(pos.driver_number, pos.position);
  }

  const fastestLapDriver = findFastestLapDriver(laps);

  // Mapping driver_number → acronym
  const driverNumberToAcronym = new Map<number, string>();
  for (const d of openf1Drivers) {
    driverNumberToAcronym.set(d.driver_number, d.name_acronym);
  }

  // 3. Mapper sur nos real_entities
  const ourDrivers = await prisma.realEntity.findMany({
    where: { sport: 'f1', active: true },
  });
  const shortNameToEntity = new Map(ourDrivers.map((d) => [d.short_name, d]));

  let ingested = 0;

  for (const [driverNumber, racePosition] of finalRacePositions) {
    const acronym = driverNumberToAcronym.get(driverNumber);
    if (!acronym) continue;

    const entity = shortNameToEntity.get(acronym);
    if (!entity) continue;

    const qualifPos = finalQualifPositions.get(driverNumber) ?? null;
    const qualifyingSession = qualifPos !== null
      ? (qualifPos <= 10 ? 'Q3' : qualifPos <= 15 ? 'Q2' : 'Q1')
      : null;

    const gridPos = gridPositions.get(driverNumber) ?? null;
    const positionsGained = gridPos !== null ? gridPos - racePosition : 0;

    const hasFastestLap = fastestLapDriver === driverNumber;

    const results = {
      race_position: racePosition,
      qualifying_session: qualifyingSession,
      qualifying_position: qualifPos,
      fastest_lap: hasFastestLap,
      dotd: false,
      dnf: null,
      grid_penalty: 0,
      positions_gained: positionsGained,
    };

    await prisma.performance.upsert({
      where: {
        gameweek_id_real_entity_id: {
          gameweek_id: gameweekId,
          real_entity_id: entity.id,
        },
      },
      update: { results },
      create: { gameweek_id: gameweekId, real_entity_id: entity.id, results },
    });

    ingested++;
  }

  // Marquer le GP comme completed
  await prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: 'completed' },
  });

  return {
    gameweek_id: gameweekId,
    name: gameweek.name,
    openf1_session_key: raceSession.session_key,
    qualif_session_key: qualifSession?.session_key ?? null,
    drivers_ingested: ingested,
    total_drivers_found: finalRacePositions.size,
  };
}

// ─── Handlers ─────────────────────────────────────────

/**
 * GET /api/cron/ingest-results
 *
 * Handler pour les crons Vercel (GET).
 * Auto-détecte les GP à ingérer : course passée, pas encore de performances.
 */
export async function GET(req: NextRequest) {
  // Auth Vercel Cron : Authorization: Bearer <CRON_SECRET>
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const token = authHeader?.replace('Bearer ', '');
    if (token !== cronSecret) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // 1. Mettre à jour les statuts
    await updateGameweekStatuses(2026);

    // 2. Trouver les GP qui ont besoin d'ingestion :
    //    course passée + status completed + pas de performances enregistrées
    const now = new Date();
    const candidates = await prisma.gameweek.findMany({
      where: {
        season: 2026,
        race_date: { lte: now },
        status: { notIn: ['cancelled', 'upcoming'] },
      },
      include: { _count: { select: { performances: true } } },
      orderBy: { round_number: 'asc' },
    });

    const toIngest = candidates.filter((gw) => gw._count.performances === 0);

    if (toIngest.length === 0) {
      return NextResponse.json({ message: 'Aucun GP à ingérer', candidates_checked: candidates.length });
    }

    const results = [];
    for (const gw of toIngest) {
      const result = await ingestGameweek(gw.id);
      if (result) results.push(result);
    }

    return NextResponse.json({
      message: `Ingestion terminée`,
      gameweeks_ingested: results.length,
      details: results,
    });
  } catch (error) {
    console.error('GET /api/cron/ingest-results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/cron/ingest-results
 *
 * Handler pour appels manuels avec un gameweek_id spécifique.
 * Body: { gameweek_id: string }
 */
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { gameweek_id } = body;

    if (!gameweek_id) {
      return NextResponse.json({ message: 'gameweek_id requis' }, { status: 400 });
    }

    const result = await ingestGameweek(gameweek_id);
    if (!result) {
      return NextResponse.json({ message: 'GP introuvable ou aucune session Race sur OpenF1' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Ingestion terminée', ...result });
  } catch (error) {
    console.error('POST /api/cron/ingest-results:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
