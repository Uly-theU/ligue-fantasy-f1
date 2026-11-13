/**
 * Trois ligues en draft exclusif, trois Grands Prix.
 * Serpentin, puis rattrapage au classement inversé, puis loterie.
 * L'app doit répondre sur http://127.0.0.1:3000.
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { BETA_PLAYERS } from '../lib/local-auth';

const BASE = 'http://127.0.0.1:3000';

type Perf = {
  race_position: number;
  qualifying_session: 'Q1' | 'Q2' | 'Q3';
  qualifying_position: number;
  fastest_lap: boolean;
  dotd: boolean;
  dnf: null;
  grid_penalty: number;
  positions_gained: number;
};

type Window = {
  label: string;
  picks_per_player: number;
  draft_type: 'snake_random' | 'snake_reverse_standings' | 'nba_lottery';
};

const DRIVERS: Array<{ name: string; short: string; price: number; team: string; number: number }> = [
  ['Lando Norris', 'NOR', 30, 'McLaren', 4],
  ['Oscar Piastri', 'PIA', 28, 'McLaren', 81],
  ['Max Verstappen', 'VER', 26, 'Red Bull', 1],
  ['Charles Leclerc', 'LEC', 22, 'Ferrari', 16],
  ['George Russell', 'RUS', 18, 'Mercedes', 63],
  ['Lewis Hamilton', 'HAM', 16, 'Ferrari', 44],
  ['Carlos Sainz', 'SAI', 12, 'Williams', 55],
  ['Fernando Alonso', 'ALO', 10, 'Aston Martin', 14],
  ['Pierre Gasly', 'GAS', 8, 'Alpine', 10],
  ['Esteban Ocon', 'OCO', 8, 'Haas', 31],
  ['Alexander Albon', 'ALB', 6, 'Williams', 23],
  ['Yuki Tsunoda', 'TSU', 6, 'Racing Bulls', 22],
  ['Kimi Antonelli', 'ANT', 14, 'Mercedes', 12],
  ['Liam Lawson', 'LAW', 7, 'Racing Bulls', 30],
  ['Isack Hadjar', 'HAD', 7, 'Racing Bulls', 6],
  ['Oliver Bearman', 'BEA', 9, 'Haas', 87],
  ['Franco Colapinto', 'COL', 6, 'Alpine', 43],
  ['Gabriel Bortoleto', 'BOR', 6, 'Audi', 5],
  ['Nico Hulkenberg', 'HUL', 8, 'Audi', 27],
  ['Lance Stroll', 'STR', 7, 'Aston Martin', 18],
  ['Jack Doohan', 'DOO', 5, 'Alpine', 7],
  ['Valtteri Bottas', 'BOT', 5, 'Cadillac', 77],
].map(([name, short, price, team, number]) => ({
  name: String(name),
  short: String(short),
  price: Number(price) * 1_000_000,
  team: String(team),
  number: Number(number),
}));

const BOARD = DRIVERS.map((driver) => driver.short);

const PREFERENCES: Record<string, string[]> = {
  camille: rotate(BOARD, 0),
  nassim: rotate(BOARD, 2),
  ines: rotate(BOARD, 3),
  hugo: rotate(BOARD, 5),
  lea: rotate(BOARD, 4),
};

const RACES = [
  {
    round: 18,
    name: "Grand Prix des États-Unis",
    circuit: 'Circuit of the Americas',
    country: 'US',
    order: rotate(BOARD, 0),
  },
  {
    round: 19,
    name: 'Grand Prix de Mexico',
    circuit: 'Autódromo Hermanos Rodríguez',
    country: 'MX',
    order: rotate(BOARD, 2),
  },
  {
    round: 20,
    name: 'Grand Prix de Las Vegas',
    circuit: 'Las Vegas Strip Circuit',
    country: 'US',
    order: rotate(BOARD, 5),
  },
];

function rotate(list: string[], by: number): string[] {
  return [...list.slice(by), ...list.slice(0, by)];
}

function loadEnv(path: string) {
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key]) continue;
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function call(playerId: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `beta-player=${playerId}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) as Record<string, unknown> : {};
  } catch {
    body = { message: text };
  }
  return { status: res.status, body };
}

async function api(playerId: string, path: string, init?: RequestInit) {
  const result = await call(playerId, path, init);
  if (result.status >= 400) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${result.status} ${JSON.stringify(result.body)}`);
  }
  return result.body;
}

function onClock(turnOrder: string[], pickNumber: number): string {
  const size = turnOrder.length;
  const round = Math.ceil(pickNumber / size);
  const pos = (pickNumber - 1) % size;
  const index = round % 2 === 0 ? size - 1 - pos : pos;
  return turnOrder[index];
}

async function createLeague(name: string, description: string, windows: Window[], rosterSize: number) {
  const owner = BETA_PLAYERS[0];
  const created = await api(owner.id, '/api/leagues', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description,
      draft_mode: 'exclusive_draft',
      max_players: 5,
    }),
  });
  const leagueId = (created.league as { id: string }).id;
  const detail = await api(owner.id, `/api/leagues/${leagueId}`);
  const invite = (detail.league as { invite_code: string; short_code: string }).invite_code;
  const code = (detail.league as { short_code: string }).short_code;
  for (const player of BETA_PLAYERS.slice(1)) {
    await api(player.id, `/api/leagues/${leagueId}/join`, {
      method: 'POST',
      body: JSON.stringify({ invite_code: invite }),
    });
  }
  await api(owner.id, `/api/leagues/${leagueId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      settings: {
        roster_size: rosterSize,
        bench_size: 0,
        draft_windows: windows,
      },
    }),
  });
  console.log(`\n${name} · ${code} · ${invite}`);
  return leagueId;
}

async function runDraft(
  leagueId: string,
  label: string,
  checks: { refuseTurn: boolean; refuseDuplicate: boolean },
  already: Set<string>,
) {
  const owner = BETA_PLAYERS[0];
  const started = await api(owner.id, `/api/draft/${leagueId}/start`, { method: 'POST' });
  const turnOrder = started.turn_order as string[];
  const rounds = started.total_rounds as number;
  const draftType = started.draft_type as string;
  const names = new Map<string, string>(BETA_PLAYERS.map((player) => [player.id, player.displayName]));
  console.log(`  ${label} (${draftType}) : ${turnOrder.map((id) => names.get(id)).join(' → ')}`);

  const taken = new Set<string>();
  const picks = new Map<string, string[]>();
  const total = rounds * turnOrder.length;

  if (checks.refuseTurn) {
    const intruder = turnOrder[1];
    const refused = await call(intruder, `/api/draft/${leagueId}/pick`, {
      method: 'POST',
      body: JSON.stringify({ real_entity_id: ids.get('NOR') }),
    });
    console.log(`  Hors tour : ${refused.status} ${String(refused.body.message)}`);
  }

  for (let pick = 1; pick <= total; pick += 1) {
    const playerId = onClock(turnOrder, pick);
    const player = BETA_PLAYERS.find((item) => item.id === playerId);
    if (!player) throw new Error('Joueur hors liste');
    const status = await api(playerId, `/api/draft/${leagueId}/status`);
    const available = status.available_drivers as Array<{ id: string; short_name: string }>;
    const availableIds = new Map(available.map((driver) => [driver.short_name, driver.id]));
    if (checks.refuseDuplicate && pick === 2) {
      const duplicate = await call(playerId, `/api/draft/${leagueId}/pick`, {
        method: 'POST',
        body: JSON.stringify({ real_entity_id: ids.get([...taken][0]) }),
      });
      console.log(`  Pilote déjà pris : ${duplicate.status} ${String(duplicate.body.message)}`);
    }
    const choice = PREFERENCES[player.username].find((code) => availableIds.has(code) && !already.has(code));
    if (!choice) throw new Error(`Plus de pilote pour ${player.displayName}`);
    const entityId = availableIds.get(choice);
    const result = await api(playerId, `/api/draft/${leagueId}/pick`, {
      method: 'POST',
      body: JSON.stringify({ real_entity_id: entityId }),
    });
    taken.add(choice);
    already.add(choice);
    const mine = picks.get(playerId) ?? [];
    mine.push(choice);
    picks.set(playerId, mine);
    const info = result.pick as { pick_number: number; round: number; short_name: string };
    console.log(`  #${info.pick_number} T${info.round} ${player.displayName} prend ${info.short_name}`);
  }

  return { turnOrder, picks };
}

async function setJokers(leagueId: string, picks: Map<string, string[]>, jokerIndex: number) {
  for (const player of BETA_PLAYERS) {
    const mine = picks.get(player.id) ?? [];
    const team = await api(player.id, `/api/teams/${leagueId}`);
    const roster = (team.team as {
      roster_assignments: Array<{ real_entity_id: string; real_entity: { short_name: string } }>;
    }).roster_assignments;
    const byShort = new Map(roster.map((entry) => [entry.real_entity.short_name, entry.real_entity_id]));
    const starters = mine.map((code) => byShort.get(code)).filter((id): id is string => Boolean(id));
    const jokerCode = mine[Math.min(jokerIndex, mine.length - 1)];
    await api(player.id, `/api/teams/${leagueId}/roster`, {
      method: 'PATCH',
      body: JSON.stringify({ starters, joker_id: byShort.get(jokerCode) }),
    });
  }
}

async function race(round: number, order: string[]) {
  const gameweek = await prisma.gameweek.findUnique({
    where: { season_round_number: { season: 2026, round_number: round } },
  });
  if (!gameweek) throw new Error(`Manche ${round} absente`);
  await prisma.gameweek.update({
    where: { id: gameweek.id },
    data: {
      status: 'upcoming',
      lock_time: new Date('2026-10-01T14:00:00Z'),
      qualifying_date: new Date('2026-10-01T15:00:00Z'),
      race_date: new Date('2026-10-02T12:00:00Z'),
    },
  });
  await api(BETA_PLAYERS[0].id, '/api/f1/calendar?season=2026');
  for (let index = 0; index < order.length; index += 1) {
    const position = index + 1;
    const session = position <= 10 ? 'Q3' : position <= 16 ? 'Q2' : 'Q1';
    const results: Perf = {
      race_position: position,
      qualifying_session: session,
      qualifying_position: position,
      fastest_lap: position === 1,
      dotd: false,
      dnf: null,
      grid_penalty: 0,
      positions_gained: 0,
    };
    const entityId = ids.get(order[index]);
    if (!entityId) continue;
    await prisma.performance.upsert({
      where: { gameweek_id_real_entity_id: { gameweek_id: gameweek.id, real_entity_id: entityId } },
      update: { results },
      create: { gameweek_id: gameweek.id, real_entity_id: entityId, results },
    });
  }
  await prisma.score.deleteMany({ where: { gameweek_id: gameweek.id } });
  const scored = await fetch(`${BASE}/api/cron/calculate-scores`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET ?? ''}` },
  });
  const scoredText = await scored.text();
  if (!scored.ok) throw new Error(`Scoring ${scored.status} ${scoredText}`);
  const payload = JSON.parse(scoredText) as { message?: string; gameweeks_scored?: number };
  if (!payload.gameweeks_scored) throw new Error(`Scoring vide : ${scoredText}`);
  console.log(`  Course ${round} scorée (${payload.gameweeks_scored} manche)`);
}

async function printTable(leagueId: string, title: string) {
  const table = await api(BETA_PLAYERS[0].id, `/api/leagues/${leagueId}/standings`);
  const rows = table.standings as Array<{
    rank: number;
    total_points: number;
    user: { display_name: string | null; username: string };
    scores_by_round: Array<{ round: number; points: number }>;
  }>;
  console.log(`\n${title}`);
  for (const row of rows) {
    const byRound = row.scores_by_round.map((score) => `R${score.round}:${score.points}`).join(' ');
    console.log(`  ${row.rank}. ${row.user.display_name ?? row.user.username} · ${row.total_points} pts · ${byRound}`);
  }
  return rows;
}

const ids = new Map<string, string>();
let prisma: PrismaClient;

async function main() {
  loadEnv(new URL('../.env.local', import.meta.url).pathname);
  prisma = new PrismaClient();

  for (const driver of DRIVERS) {
    const row = await prisma.realEntity.upsert({
      where: { name: driver.name },
      update: { short_name: driver.short, base_price: driver.price, active: true },
      create: {
        name: driver.name,
        short_name: driver.short,
        base_price: driver.price,
        sport: 'f1',
        active: true,
        metadata: { team: driver.team, car_number: driver.number },
      },
    });
    ids.set(driver.short, row.id);
  }

  await prisma.league.updateMany({
    where: { name: 'Grille de test', status: 'active' },
    data: { status: 'completed' },
  });
  const previous = await prisma.league.findMany({
    where: { name: { in: ['Draft serpentin', 'Draft rattrapage', 'Draft loterie'] } },
    select: { id: true },
  });
  const previousIds = previous.map((league) => league.id);
  if (previousIds.length > 0) {
    await prisma.score.deleteMany({ where: { fantasy_team: { league_id: { in: previousIds } } } });
    await prisma.league.deleteMany({ where: { id: { in: previousIds } } });
  }

  for (const [index, event] of RACES.entries()) {
    const when = new Date(Date.UTC(2026, 10, 14 + index * 7, 15, 0, 0));
    const lock = new Date(when.getTime() - 25 * 60 * 60 * 1000);
    const quali = new Date(when.getTime() - 24 * 60 * 60 * 1000);
    await prisma.gameweek.upsert({
      where: { season_round_number: { season: 2026, round_number: event.round } },
      update: {
        name: event.name,
        circuit: event.circuit,
        country: event.country,
        status: 'upcoming',
        lock_time: lock,
        qualifying_date: quali,
        race_date: when,
      },
      create: {
        season: 2026,
        round_number: event.round,
        name: event.name,
        circuit: event.circuit,
        country: event.country,
        status: 'upcoming',
        lock_time: lock,
        qualifying_date: quali,
        race_date: when,
      },
    });
  }

  const serpent = await createLeague(
    'Draft serpentin',
    'Un seul draft, trois Grands Prix.',
    [{ label: 'Draft initial', picks_per_player: 3, draft_type: 'snake_random' }],
    3,
  );
  const rattrapage = await createLeague(
    'Draft rattrapage',
    'Deux choix, deux courses, puis un draft inversé.',
    [
      { label: 'Draft initial', picks_per_player: 2, draft_type: 'snake_random' },
      { label: 'Mi-saison', picks_per_player: 2, draft_type: 'snake_reverse_standings' },
    ],
    4,
  );
  const loterie = await createLeague(
    'Draft loterie',
    'Deux choix, une course, puis une loterie.',
    [
      { label: 'Draft initial', picks_per_player: 2, draft_type: 'snake_random' },
      { label: 'Loterie', picks_per_player: 2, draft_type: 'nba_lottery' },
    ],
    4,
  );

  const serpentTaken = new Set<string>();
  const rattrapageTaken = new Set<string>();
  const loterieTaken = new Set<string>();
  const serpentPicks = await runDraft(serpent, 'Draft initial', { refuseTurn: true, refuseDuplicate: true }, serpentTaken);
  const rattrapagePicks = await runDraft(rattrapage, 'Draft initial', { refuseTurn: false, refuseDuplicate: false }, rattrapageTaken);
  const loteriePicks = await runDraft(loterie, 'Draft initial', { refuseTurn: false, refuseDuplicate: false }, loterieTaken);

  await setJokers(serpent, serpentPicks.picks, 0);
  await setJokers(rattrapage, rattrapagePicks.picks, 0);
  await setJokers(loterie, loteriePicks.picks, 0);
  console.log('\nAustin — joker sur le premier choix');
  await race(18, RACES[0].order);

  await setJokers(serpent, serpentPicks.picks, 1);
  await setJokers(rattrapage, rattrapagePicks.picks, 1);
  await setJokers(loterie, loteriePicks.picks, 1);
  console.log('Mexico — joker sur le deuxième choix');
  await race(19, RACES[1].order);

  const before = await printTable(rattrapage, 'Avant le draft inversé');
  const last = before[before.length - 1];
  const second = await runDraft(rattrapage, 'Mi-saison', { refuseTurn: false, refuseDuplicate: false }, rattrapageTaken);
  const firstName = BETA_PLAYERS.find((player) => player.id === second.turnOrder[0])?.displayName;
  console.log(`  Premier au draft inversé : ${firstName} (dernier au classement : ${last.user.display_name})`);
  for (const [playerId, codes] of second.picks) {
    const previous = rattrapagePicks.picks.get(playerId) ?? [];
    rattrapagePicks.picks.set(playerId, [...previous, ...codes]);
  }

  const lotteryTable = await printTable(loterie, 'Avant la loterie');
  const lottery = await runDraft(loterie, 'Loterie', { refuseTurn: false, refuseDuplicate: false }, loterieTaken);
  console.log('  Classement utilisé pour les boules :');
  for (const row of [...lotteryTable].reverse()) {
    console.log(`    ${row.user.display_name} · ${row.total_points} pts`);
  }
  for (const [playerId, codes] of lottery.picks) {
    const previous = loteriePicks.picks.get(playerId) ?? [];
    loteriePicks.picks.set(playerId, [...previous, ...codes]);
  }

  await setJokers(serpent, serpentPicks.picks, 2);
  await setJokers(rattrapage, rattrapagePicks.picks, 2);
  await setJokers(loterie, loteriePicks.picks, 0);
  console.log('\nLas Vegas — nouvelles grilles');
  await race(20, RACES[2].order);

  await printTable(serpent, 'Draft serpentin');
  await printTable(rattrapage, 'Draft rattrapage');
  await printTable(loterie, 'Draft loterie');
  console.log(`\nLigues\n  serpentin ${serpent}\n  rattrapage ${rattrapage}\n  loterie ${loterie}`);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma?.$disconnect();
  process.exit(1);
});
