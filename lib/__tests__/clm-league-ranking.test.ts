import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/leagues/[id]/clm/route';
import { formatClmGap, formatClmSectors, formatClmTime } from '@/lib/clm-league';

const LEAGUE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_LEAGUE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const GAMEWEEK_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
const BOB_ID = '22222222-2222-4222-8222-222222222222';
const CARA_ID = '33333333-3333-4333-8333-333333333333';
const DINA_ID = '44444444-4444-4444-8444-444444444444';

type Profile = {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Member = {
  league_id: string;
  user_id: string;
  profile: Profile;
};

type StoredLap = {
  user_id: string;
  gameweek_id: string;
  official_time: number;
  sectors: number[];
  penalty: number;
  inputs: string;
  circuit_id: string | null;
  created_at: Date;
};

type GameweekRow = {
  id: string;
  name: string;
  round_number: number;
  circuit: string | null;
  circuit_id?: string | null;
};

type RankingRow = {
  rank: number | null;
  user_id: string;
  username: string;
  display_name: string | null;
  official_time: number | null;
  sectors: number[] | null;
  gap: number | null;
  submitted_at: string | null;
};

const h = vi.hoisted(() => {
  const members: Member[] = [];
  const laps: StoredLap[] = [];
  const gameweeks = new Map<string, GameweekRow>();
  const getAuthUser = vi.fn();
  const prisma = {
    leagueMember: {
      findUnique: vi.fn(async ({ where }: { where: { league_id_user_id: { league_id: string; user_id: string } } }) => {
        const key = where.league_id_user_id;
        return members.find((member) => member.league_id === key.league_id && member.user_id === key.user_id) ?? null;
      }),
      findMany: vi.fn(async ({ where }: { where: { league_id: string } }) => {
        return members.filter((member) => member.league_id === where.league_id);
      }),
    },
    gameweek: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => gameweeks.get(where.id) ?? null),
    },
    timeTrialLap: {
      findMany: vi.fn(async ({ where }: { where: { gameweek_id: string; user_id?: { in: string[] } } }) => {
        const ids = where.user_id?.in;
        return laps.filter((lap) => (
          lap.gameweek_id === where.gameweek_id
          && (ids == null || ids.includes(lap.user_id))
        ));
      }),
      findUnique: vi.fn(async ({ where }: { where: { user_id_gameweek_id: { user_id: string; gameweek_id: string } } }) => {
        const key = where.user_id_gameweek_id;
        return laps.find((lap) => lap.user_id === key.user_id && lap.gameweek_id === key.gameweek_id) ?? null;
      }),
    },
  };
  return { members, laps, gameweeks, prisma, getAuthUser };
});

vi.mock('@/lib/auth', () => ({ getAuthUser: h.getAuthUser }));
vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }));

describe('GET /api/leagues/[id]/clm', () => {
  beforeEach(() => {
    h.members.length = 0;
    h.laps.length = 0;
    h.gameweeks.clear();
    h.getAuthUser.mockReset();
    h.prisma.leagueMember.findUnique.mockClear();
    h.prisma.leagueMember.findMany.mockClear();
    h.prisma.gameweek.findUnique.mockClear();
    h.prisma.timeTrialLap.findMany.mockClear();
    h.prisma.timeTrialLap.findUnique.mockClear();
    h.gameweeks.set(GAMEWEEK_ID, {
      id: GAMEWEEK_ID,
      name: 'Grand Prix d’Italie',
      round_number: 16,
      circuit: 'Monza',
    });
    signIn(VIEWER_ID);
  });

  it('répond 401 sans session', async () => {
    h.getAuthUser.mockResolvedValue({
      user: null,
      supabase: null,
      errorResponse: NextResponse.json({ message: 'Unauthorized' }, { status: 401 }),
    });
    const response = await get(GAMEWEEK_ID);
    expect(response.status).toBe(401);
    expect(h.prisma.timeTrialLap.findMany).not.toHaveBeenCalled();
  });

  it('répond 400 si le Grand Prix est absent ou invalide', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    const missing = await get(null);
    expect(missing.status).toBe(400);
    const invalid = await get('pas-un-uuid');
    expect(invalid.status).toBe(400);
    expect(h.prisma.leagueMember.findUnique).not.toHaveBeenCalled();
  });

  it('répond 403 si l’utilisateur n’est pas membre', async () => {
    devenirMembre(VIEWER_ID, 'ada', OTHER_LEAGUE_ID);
    devenirMembre(BOB_ID, 'bob');
    const response = await get(GAMEWEEK_ID);
    expect(response.status).toBe(403);
    expect(response.json).toEqual({ message: 'Accès refusé' });
    expect(h.prisma.gameweek.findUnique).not.toHaveBeenCalled();
    expect(h.prisma.timeTrialLap.findMany).not.toHaveBeenCalled();
  });

  it('répond 404 si le Grand Prix est introuvable', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    const response = await get('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(response.status).toBe(404);
    expect(h.prisma.timeTrialLap.findMany).not.toHaveBeenCalled();
  });

  it('classe du plus rapide au plus lent, départage l’égalité par la date, et met l’écart au premier', async () => {
    devenirMembre(VIEWER_ID, 'ada', LEAGUE_ID, 'Ada');
    devenirMembre(BOB_ID, 'bob', LEAGUE_ID, 'Bob');
    devenirMembre(CARA_ID, 'cara', LEAGUE_ID, 'Cara');
    devenirMembre(DINA_ID, 'dina');
    soumettre({
      user_id: BOB_ID,
      official_time: 80,
      sectors: [20, 30, 30],
      created_at: new Date('2026-09-06T10:00:00.000Z'),
    });
    soumettre({
      user_id: CARA_ID,
      official_time: 80,
      sectors: [21, 29, 30],
      created_at: new Date('2026-09-06T11:00:00.000Z'),
    });
    soumettre({
      user_id: VIEWER_ID,
      official_time: 91.25,
      sectors: [30.1, 30.2, 30.95],
      created_at: new Date('2026-09-06T09:00:00.000Z'),
    });

    const response = await get(GAMEWEEK_ID);
    expect(response.status).toBe(200);
    expect(response.json.gameweek).toEqual({
      id: GAMEWEEK_ID,
      name: 'Grand Prix d’Italie',
      round_number: 16,
      circuit: 'Monza',
    });

    const ranking = response.json.ranking as RankingRow[];
    expect(ranking.map((row) => row.user_id)).toEqual([BOB_ID, CARA_ID, VIEWER_ID, DINA_ID]);
    expect(ranking[0]).toMatchObject({
      rank: 1,
      username: 'bob',
      display_name: 'Bob',
      official_time: 80,
      sectors: [20, 30, 30],
      gap: 0,
      submitted_at: '2026-09-06T10:00:00.000Z',
    });
    expect(ranking[1]).toMatchObject({
      rank: 2,
      user_id: CARA_ID,
      official_time: 80,
      gap: 0,
      submitted_at: '2026-09-06T11:00:00.000Z',
    });
    expect(ranking[2]).toMatchObject({
      rank: 3,
      user_id: VIEWER_ID,
      official_time: 91.25,
      gap: 11.25,
    });
    expect(ranking[3]).toMatchObject({
      rank: null,
      user_id: DINA_ID,
      username: 'dina',
      display_name: null,
      official_time: null,
      sectors: null,
      gap: null,
      submitted_at: null,
    });
    expect(JSON.stringify(response.json)).not.toContain('journal-secret');
  });

  it('une seconde soumission du même joueur ne crée pas une seconde ligne', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    soumettre({
      user_id: VIEWER_ID,
      official_time: 90,
      sectors: [30, 30, 30],
      created_at: new Date('2026-09-06T10:00:00.000Z'),
      inputs: 'premier-journal',
    });
    soumettre({
      user_id: VIEWER_ID,
      official_time: 80,
      sectors: [26, 27, 27],
      created_at: new Date('2026-09-06T11:00:00.000Z'),
      inputs: 'second-journal',
    });

    expect(h.laps.filter((lap) => lap.user_id === VIEWER_ID && lap.gameweek_id === GAMEWEEK_ID)).toHaveLength(1);

    const response = await get(GAMEWEEK_ID);
    expect(response.status).toBe(200);
    const lines = (response.json.ranking as RankingRow[]).filter((row) => row.user_id === VIEWER_ID);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      rank: 1,
      official_time: 80,
      sectors: [26, 27, 27],
      gap: 0,
      submitted_at: '2026-09-06T11:00:00.000Z',
    });
    expect(response.json.ranking).toHaveLength(1);
  });

  it('renvoie les entrées du membre choisi sans les mettre dans le classement', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    devenirMembre(BOB_ID, 'bob');
    soumettre({
      user_id: BOB_ID,
      official_time: 80,
      sectors: [20, 30, 30],
      created_at: new Date('2026-09-06T10:00:00.000Z'),
      inputs: 'clm1.journal-bob',
      circuit_id: 'monza',
    });

    const hidden = await get(GAMEWEEK_ID);
    expect(JSON.stringify(hidden.json)).not.toContain('clm1.journal-bob');
    h.prisma.timeTrialLap.findMany.mockClear();

    const rival = await getUser(BOB_ID);
    expect(rival.status).toBe(200);
    expect(rival.json.lap).toEqual({
      user_id: BOB_ID,
      inputs: 'clm1.journal-bob',
      official_time: 80,
      circuit_id: 'monza',
    });
    expect(h.prisma.timeTrialLap.findMany).not.toHaveBeenCalled();
  });

  it('reprend le circuit du Grand Prix quand le tour n’en a pas', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    devenirMembre(BOB_ID, 'bob');
    h.gameweeks.set(GAMEWEEK_ID, {
      id: GAMEWEEK_ID,
      name: 'Grand Prix d’Italie',
      round_number: 16,
      circuit: 'Monza',
      circuit_id: 'monza',
    });
    soumettre({
      user_id: BOB_ID,
      official_time: 80,
      sectors: [20, 30, 30],
      created_at: new Date('2026-09-06T10:00:00.000Z'),
      circuit_id: null,
    });

    const rival = await getUser(BOB_ID);
    expect(rival.status).toBe(200);
    expect(rival.json.lap).toMatchObject({ circuit_id: 'monza', inputs: 'journal-secret' });
  });

  it('répond 404 si le membre n’a pas de tour, ou s’il n’est pas dans la ligue', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    devenirMembre(BOB_ID, 'bob');
    const missing = await getUser(BOB_ID);
    expect(missing.status).toBe(404);
    const outsider = await getUser(CARA_ID);
    expect(outsider.status).toBe(404);
    expect(h.prisma.timeTrialLap.findUnique).toHaveBeenCalledTimes(1);
  });

  it('répond 400 si le joueur demandé n’est pas un identifiant', async () => {
    devenirMembre(VIEWER_ID, 'ada');
    const response = await getUser('bob');
    expect(response.status).toBe(400);
    expect(h.prisma.leagueMember.findUnique).not.toHaveBeenCalled();
  });
});

describe('affichage des temps', () => {
  it('formate le chrono, les secteurs et l’écart au premier', () => {
    expect(formatClmTime(80)).toBe('1:20.000');
    expect(formatClmTime(81.234)).toBe('1:21.234');
    expect(formatClmSectors([22.551, 25.102, 24.785])).toBe('22.551 · 25.102 · 24.785');
    expect(formatClmSectors(null)).toBe('—');
    expect(formatClmGap(0, 1)).toBe('—');
    expect(formatClmGap(0, 2)).toBe('+0.000');
    expect(formatClmGap(1.234, 2)).toBe('+1.234');
    expect(formatClmGap(null, null)).toBe('—');
  });
});

function signIn(userId: string) {
  h.getAuthUser.mockResolvedValue({
    user: { id: userId },
    supabase: null,
    errorResponse: null,
  });
}

function devenirMembre(userId: string, username: string, leagueId = LEAGUE_ID, displayName: string | null = null) {
  h.members.push({
    league_id: leagueId,
    user_id: userId,
    profile: { username, display_name: displayName, avatar_url: null },
  });
}

/** La base n’accepte qu’un tour par joueur et par Grand Prix : la seconde soumission remplace la plus lente. */
function soumettre(input: {
  user_id: string;
  official_time: number;
  sectors: number[];
  created_at: Date;
  inputs?: string;
  circuit_id?: string | null;
}) {
  const next: StoredLap = {
    user_id: input.user_id,
    gameweek_id: GAMEWEEK_ID,
    official_time: input.official_time,
    sectors: input.sectors,
    penalty: 0,
    inputs: input.inputs ?? 'journal-secret',
    circuit_id: input.circuit_id === undefined ? 'monza' : input.circuit_id,
    created_at: input.created_at,
  };
  const index = h.laps.findIndex((lap) => lap.user_id === next.user_id && lap.gameweek_id === next.gameweek_id);
  if (index === -1) {
    h.laps.push(next);
    return;
  }
  if (next.official_time < h.laps[index].official_time) h.laps[index] = next;
}

async function get(gameweek: string | null) {
  const query = gameweek == null ? '' : `?gameweek=${encodeURIComponent(gameweek)}`;
  return call(query);
}

async function getUser(userId: string) {
  return call(`?gameweek=${encodeURIComponent(GAMEWEEK_ID)}&user=${encodeURIComponent(userId)}`);
}

async function call(query: string) {
  const response = await GET(
    new NextRequest(`http://localhost/api/leagues/${LEAGUE_ID}/clm${query}`),
    { params: { id: LEAGUE_ID } },
  );
  const json = await response.json() as {
    message?: string;
    gameweek?: GameweekRow;
    ranking?: RankingRow[];
    lap?: { user_id: string; inputs: string; official_time: number; circuit_id: string };
  };
  return { status: response.status, json };
}
