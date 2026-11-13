import { Prisma, type PrismaClient } from '@prisma/client';
import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { courseForGameweek, type GameweekCourseSource } from '@/lib/clm-course';
import { parseLapInputs, replayLap } from '@/lib/clm-replay';
import { targetGameweekStatus, type GameweekStatus } from '@/lib/gameweek-status';
import { prisma } from '@/lib/prisma';
import { submitTimeTrialLapSchema } from '@/lib/validators';

const MAX_BODY_BYTES = 256 * 1024;
const GAMEWEEK_STATUSES: readonly GameweekStatus[] = ['upcoming', 'locked', 'live', 'completed', 'cancelled'];

type ReplayWrite = {
  userId: string;
  gameweekId: string;
  circuitId: string | null;
  inputs: string;
  time: number;
  sectors: [number, number, number];
  penalty: number;
};

type LapStore = Pick<PrismaClient, 'timeTrialLap'>;

type ClockedGameweek = GameweekCourseSource & {
  id: string;
  status: string;
  race_date: Date;
  lock_time: Date | null;
  qualifying_date: Date | null;
};

/**
 * POST /api/clm/laps — homologation d'un tour.
 * Le temps du corps n'est pas un champ validé : le serveur rejoue les entrées.
 */
export async function POST(request: Request) {
  const { user, errorResponse } = await getAuthUser();
  if (errorResponse) return errorResponse;
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Requête trop volumineuse' }, { status: 413 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ message: 'Entrées invalides' }, { status: 400 });
  }

  const parsed = submitTimeTrialLapSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Entrées invalides', errors: parsed.error.errors }, { status: 400 });
  }

  const spans = await parseLapInputs(parsed.data.inputs);
  if (!spans) {
    return NextResponse.json({ message: 'Entrées invalides' }, { status: 400 });
  }

  try {
    const gameweek = await prisma.gameweek.findUnique({
      where: { id: parsed.data.gameweek_id },
      include: { layout: true, circuit_ref: true },
    });
    if (!gameweek) {
      return NextResponse.json({ message: 'Grand Prix introuvable' }, { status: 404 });
    }
    if (grandPrixClosed(gameweek, new Date())) {
      return NextResponse.json({ message: 'Grand Prix clos' }, { status: 409 });
    }

    const course = courseForGameweek(gameweek);
    if (!course) {
      return NextResponse.json({ message: 'Le tracé de ce circuit n’est pas disponible' }, { status: 404 });
    }

    const replay = replayLap(course.track, spans, {
      lengthKm: course.lengthKm,
      elevation: course.elevation,
      runoff: course.runoff,
    });
    if (!replay.completed) {
      return NextResponse.json({ message: 'Tour non bouclé' }, { status: 422 });
    }

    const kept = await persistBest({
      userId: user.id,
      gameweekId: gameweek.id,
      circuitId: gameweek.circuit_id,
      inputs: parsed.data.inputs,
      time: replay.time,
      sectors: replay.sectors,
      penalty: replay.penalty,
    });

    return NextResponse.json({
      time: replay.time,
      sectors: replay.sectors,
      penalty: replay.penalty,
      saved: kept.saved,
    });
  } catch (error) {
    console.error('POST /api/clm/laps:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

function grandPrixClosed(gameweek: ClockedGameweek, now: Date): boolean {
  if (gameweek.status === 'completed' || gameweek.status === 'cancelled') return true;
  if (!(gameweek.race_date instanceof Date) || Number.isNaN(gameweek.race_date.getTime())) return true;
  const status = GAMEWEEK_STATUSES.includes(gameweek.status as GameweekStatus)
    ? gameweek.status as GameweekStatus
    : 'upcoming';
  const target = targetGameweekStatus({
    status,
    lockTime: gameweek.lock_time,
    qualifyingStart: gameweek.qualifying_date,
    raceStart: gameweek.race_date,
  }, now);
  return target === 'completed' || target === 'cancelled';
}

async function persistBest(input: ReplayWrite): Promise<{ saved: boolean }> {
  try {
    return await prisma.$transaction((tx) => writeBest(tx, input));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return writeBest(prisma, input);
  }
}

async function writeBest(db: LapStore, input: ReplayWrite): Promise<{ saved: boolean }> {
  const where = { user_id_gameweek_id: { user_id: input.userId, gameweek_id: input.gameweekId } };
  const existing = await db.timeTrialLap.findUnique({ where });
  if (existing && existing.official_time <= input.time) return { saved: false };

  const data = {
    circuit_id: input.circuitId,
    official_time: input.time,
    sectors: input.sectors,
    penalty: input.penalty,
    inputs: input.inputs,
    created_at: new Date(),
  };
  if (existing) {
    await db.timeTrialLap.update({ where, data });
  } else {
    await db.timeTrialLap.create({
      data: {
        user_id: input.userId,
        gameweek_id: input.gameweekId,
        ...data,
      },
    });
  }
  return { saved: true };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
