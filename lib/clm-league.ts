/** Classement de ligue du contre-la-montre. Un joueur, un tour, un Grand Prix. */

export type LeagueClmMember = {
  user_id: string;
  username: string;
  display_name: string | null;
};

export type LeagueClmLap = {
  user_id: string;
  official_time: number;
  sectors: unknown;
  created_at: Date;
};

export type LeagueClmRow = {
  rank: number | null;
  user_id: string;
  username: string;
  display_name: string | null;
  official_time: number | null;
  sectors: number[] | null;
  gap: number | null;
  submitted_at: string | null;
};

export function rankLeagueClm(members: LeagueClmMember[], laps: LeagueClmLap[]): LeagueClmRow[] {
  const bestByUser = new Map<string, LeagueClmLap>();
  for (const lap of laps) {
    const current = bestByUser.get(lap.user_id);
    if (!current || preferLap(lap, current)) bestByUser.set(lap.user_id, lap);
  }

  const timed: Array<LeagueClmMember & { lap: LeagueClmLap }> = [];
  const pending: LeagueClmMember[] = [];
  for (const member of members) {
    const lap = bestByUser.get(member.user_id);
    if (lap) timed.push({ ...member, lap });
    else pending.push(member);
  }

  timed.sort((a, b) => {
    if (a.lap.official_time !== b.lap.official_time) return a.lap.official_time - b.lap.official_time;
    const submitted = a.lap.created_at.getTime() - b.lap.created_at.getTime();
    if (submitted !== 0) return submitted;
    return a.username.localeCompare(b.username, 'fr');
  });
  pending.sort((a, b) => a.username.localeCompare(b.username, 'fr'));

  const leader = timed[0]?.lap.official_time ?? null;
  const ranked = timed.map((entry, index) => rowFromLap(entry, index + 1, leader));
  return ranked.concat(pending.map((member) => emptyRow(member)));
}

export function clmPlayerLabel(player: { username: string; display_name: string | null }): string {
  const name = player.display_name?.trim();
  return name ? name : player.username;
}

export function formatClmTime(seconds: number): string {
  const total = Math.round(Math.abs(seconds) * 1000);
  const minutes = Math.floor(total / 60_000);
  const remainder = total % 60_000;
  const secs = Math.floor(remainder / 1000);
  const millis = remainder % 1000;
  return `${minutes}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function formatClmSectors(sectors: number[] | null): string {
  if (!sectors || sectors.length === 0) return '—';
  return sectors.map((value) => value.toFixed(3)).join(' · ');
}

/** Le premier affiche un tiret. Les suivants affichent l’écart, même nul. */
export function formatClmGap(gap: number | null, rank: number | null): string {
  if (gap == null || rank == null || rank === 1) return '—';
  const rounded = Math.round(gap * 1000) / 1000;
  const sign = rounded < 0 ? '-' : '+';
  const abs = Math.abs(rounded);
  if (abs < 60) return `${sign}${abs.toFixed(3)}`;
  return `${sign}${formatClmTime(abs)}`;
}

function preferLap(next: LeagueClmLap, current: LeagueClmLap): boolean {
  if (next.official_time !== current.official_time) return next.official_time < current.official_time;
  return next.created_at.getTime() < current.created_at.getTime();
}

function rowFromLap(
  entry: LeagueClmMember & { lap: LeagueClmLap },
  rank: number,
  leader: number | null,
): LeagueClmRow {
  return {
    rank,
    user_id: entry.user_id,
    username: entry.username,
    display_name: entry.display_name,
    official_time: entry.lap.official_time,
    sectors: readSectors(entry.lap.sectors),
    gap: leader == null ? null : roundMillis(entry.lap.official_time - leader),
    submitted_at: entry.lap.created_at.toISOString(),
  };
}

function emptyRow(member: LeagueClmMember): LeagueClmRow {
  return {
    rank: null,
    user_id: member.user_id,
    username: member.username,
    display_name: member.display_name,
    official_time: null,
    sectors: null,
    gap: null,
    submitted_at: null,
  };
}

function readSectors(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const sectors: number[] = [];
  for (const item of value) {
    if (typeof item !== 'number' || !Number.isFinite(item)) return null;
    sectors.push(item);
  }
  return sectors;
}

function roundMillis(value: number): number {
  return Math.round(value * 1000) / 1000;
}
