/**
 * Fait jouer les cinq profils de test sur un Grand Prix.
 * L'app doit répondre sur http://127.0.0.1:3000 et Postgres sur DATABASE_URL.
 */
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { BETA_PLAYERS } from '../lib/local-auth';

const BASE = 'http://127.0.0.1:3000';

type Perf = {
  race_position: number | null;
  qualifying_session: 'Q1' | 'Q2' | 'Q3' | null;
  qualifying_position: number | null;
  fastest_lap: boolean;
  dotd: boolean;
  dnf: null;
  grid_penalty: number;
  positions_gained: number;
};

const DRIVERS = [
  { name: 'Lando Norris', short: 'NOR', price: 30_000_000, team: 'McLaren', number: 4 },
  { name: 'Oscar Piastri', short: 'PIA', price: 28_000_000, team: 'McLaren', number: 81 },
  { name: 'Max Verstappen', short: 'VER', price: 26_000_000, team: 'Red Bull', number: 1 },
  { name: 'Charles Leclerc', short: 'LEC', price: 22_000_000, team: 'Ferrari', number: 16 },
  { name: 'George Russell', short: 'RUS', price: 18_000_000, team: 'Mercedes', number: 63 },
  { name: 'Lewis Hamilton', short: 'HAM', price: 16_000_000, team: 'Ferrari', number: 44 },
  { name: 'Carlos Sainz', short: 'SAI', price: 12_000_000, team: 'Williams', number: 55 },
  { name: 'Fernando Alonso', short: 'ALO', price: 10_000_000, team: 'Aston Martin', number: 14 },
  { name: 'Pierre Gasly', short: 'GAS', price: 8_000_000, team: 'Alpine', number: 10 },
  { name: 'Esteban Ocon', short: 'OCO', price: 8_000_000, team: 'Haas', number: 31 },
  { name: 'Alexander Albon', short: 'ALB', price: 6_000_000, team: 'Williams', number: 23 },
  { name: 'Yuki Tsunoda', short: 'TSU', price: 6_000_000, team: 'Racing Bulls', number: 22 },
] as const;

const RESULTS: Record<string, Perf> = {
  NOR: perf(1, 'Q3', true),
  VER: perf(2, 'Q3'),
  LEC: perf(3, 'Q3'),
  PIA: perf(4, 'Q3'),
  RUS: perf(5, 'Q3'),
  HAM: perf(6, 'Q3'),
  SAI: perf(7, 'Q3'),
  ALO: perf(8, 'Q3'),
  GAS: perf(9, 'Q3'),
  ALB: perf(10, 'Q3'),
  OCO: perf(11, 'Q2'),
  TSU: perf(12, 'Q2'),
};

const PLANS: Record<string, { buy: string[]; joker: string }> = {
  camille: { buy: ['NOR', 'LEC', 'RUS', 'HAM', 'ALO'], joker: 'NOR' },
  nassim: { buy: ['PIA', 'VER', 'SAI', 'GAS', 'ALB'], joker: 'VER' },
  ines: { buy: ['PIA', 'LEC', 'RUS', 'ALO', 'OCO'], joker: 'LEC' },
  hugo: { buy: ['NOR', 'HAM', 'SAI', 'GAS', 'TSU'], joker: 'HAM' },
  lea: { buy: ['VER', 'RUS', 'ALO', 'ALB', 'OCO'], joker: 'RUS' },
};

function perf(position: number, session: Perf['qualifying_session'], fastest = false): Perf {
  return {
    race_position: position <= 10 ? position : position,
    qualifying_session: session,
    qualifying_position: position,
    fastest_lap: fastest,
    dotd: false,
    dnf: null,
    grid_penalty: 0,
    positions_gained: 0,
  };
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

async function api(playerId: string, path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `beta-player=${playerId}`,
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) as Record<string, unknown> : {};
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status} ${text}`);
  }
  return body;
}

async function main() {
  loadEnv(new URL('../.env.local', import.meta.url).pathname);
  const prisma = new PrismaClient();

  const ids = new Map<string, string>();
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

  const gameweek = await prisma.gameweek.upsert({
    where: { season_round_number: { season: 2026, round_number: 21 } },
    update: {
      name: 'Grand Prix du Brésil',
      circuit: 'Autódromo José Carlos Pace',
      country: 'BR',
      status: 'upcoming',
      lock_time: new Date('2026-11-07T14:00:00Z'),
      qualifying_date: new Date('2026-11-07T15:00:00Z'),
      race_date: new Date('2026-11-08T15:00:00Z'),
    },
    create: {
      season: 2026,
      round_number: 21,
      name: 'Grand Prix du Brésil',
      circuit: 'Autódromo José Carlos Pace',
      country: 'BR',
      status: 'upcoming',
      lock_time: new Date('2026-11-07T14:00:00Z'),
      qualifying_date: new Date('2026-11-07T15:00:00Z'),
      race_date: new Date('2026-11-08T15:00:00Z'),
    },
  });

  const camille = BETA_PLAYERS[0];
  const created = await api(camille.id, '/api/leagues', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Grille de test',
      description: 'Cinq joueurs, un Grand Prix du Brésil.',
      draft_mode: 'salary_cap',
      max_players: 5,
    }),
  });
  const leagueId = (created.league as { id: string }).id;
  const detail = await api(camille.id, `/api/leagues/${leagueId}`);
  const invite = (detail.league as { invite_code: string }).invite_code;
  console.log(`Ligue ${leagueId} · code ${invite}`);

  for (const player of BETA_PLAYERS.slice(1)) {
    await api(player.id, `/api/leagues/${leagueId}/join`, {
      method: 'POST',
      body: JSON.stringify({ invite_code: invite }),
    });
    console.log(`${player.displayName} rejoint`);
  }

  for (const player of BETA_PLAYERS) {
    const plan = PLANS[player.username];
    if (!plan) throw new Error(`Pas de grille pour ${player.username}`);
    for (const code of plan.buy) {
      const entityId = ids.get(code);
      if (!entityId) throw new Error(code);
      await api(player.id, `/api/teams/${leagueId}/roster`, {
        method: 'POST',
        body: JSON.stringify({ real_entity_id: entityId, is_starter: false }),
      });
    }
    await api(player.id, `/api/teams/${leagueId}/roster`, {
      method: 'PATCH',
      body: JSON.stringify({
        starters: plan.buy.map((code) => ids.get(code)),
        joker_id: ids.get(plan.joker),
      }),
    });
    console.log(`${player.displayName} aligne ${plan.buy.join(', ')} · joker ${plan.joker}`);
  }

  await api(camille.id, `/api/leagues/${leagueId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });

  await prisma.gameweek.update({
    where: { id: gameweek.id },
    data: {
      status: 'upcoming',
      lock_time: new Date('2026-11-01T14:00:00Z'),
      qualifying_date: new Date('2026-11-01T15:00:00Z'),
      race_date: new Date('2026-11-02T12:00:00Z'),
    },
  });
  await api(camille.id, '/api/f1/calendar?season=2026');

  for (const [code, results] of Object.entries(RESULTS)) {
    const entityId = ids.get(code);
    if (!entityId) continue;
    await prisma.performance.upsert({
      where: { gameweek_id_real_entity_id: { gameweek_id: gameweek.id, real_entity_id: entityId } },
      update: { results },
      create: { gameweek_id: gameweek.id, real_entity_id: entityId, results },
    });
  }

  await prisma.score.deleteMany({ where: { gameweek_id: gameweek.id } });
  const secret = process.env.CRON_SECRET;
  const scored = await fetch(`${BASE}/api/cron/calculate-scores`, {
    headers: { Authorization: `Bearer ${secret ?? ''}` },
  });
  const scoredBody = await scored.text();
  if (!scored.ok) throw new Error(`Scoring ${scored.status} ${scoredBody}`);
  console.log(scoredBody);

  const table = await api(camille.id, `/api/leagues/${leagueId}/standings`);
  const rows = table.standings as Array<{
    rank: number;
    team_name: string;
    total_points: number;
    user: { display_name: string | null; username: string };
  }>;
  console.log('\nClassement — Grand Prix du Brésil');
  for (const row of rows) {
    console.log(`${row.rank}. ${row.user.display_name ?? row.user.username} · ${row.team_name} · ${row.total_points} pts`);
  }
  console.log(`\nOuvrir /league/${leagueId}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
