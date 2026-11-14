export interface LineupDriver {
  real_entity_id: string;
  is_starter: boolean;
  is_joker: boolean;
}

export interface GameweekLockRow {
  status: string;
  lock_time: Date | null;
}

export interface LineupSnapshotRow {
  fantasy_team_id: string;
  gameweek_id: string;
  real_entity_id: string;
  is_starter: boolean;
  is_joker: boolean;
}

export const ROSTER_FROZEN_MESSAGE = "L'alignement est figé pour le Grand Prix en cours";

const TERMINAL_STATUSES = new Set(['completed', 'cancelled']);

/** Le scoring lit la copie figée. Le roster courant n'est pas un repli. */
export function scoringLineup<T>(snapshot: T[]): T[] {
  return snapshot;
}

/** Édition refusée tant qu'un GP de la saison est locked ou live. */
export function rosterEditBlocked(statuses: string[]): boolean {
  return statuses.some((status) => status === 'locked' || status === 'live');
}

/**
 * Refus dès qu'un GP non terminal a atteint son lock, même si le statut stocké
 * est encore upcoming. completed et cancelled ne bloquent plus.
 */
export function rosterBlockedByClock(rows: GameweekLockRow[], now: Date): boolean {
  return rows.some((row) => gameweekBlocksRoster(row, now));
}

/**
 * GP à copier avant le 403 : le lock horaire est atteint, mais le statut
 * n'est pas encore locked ou live (personne n'a encore fait avancer l'horloge).
 */
export function gameweeksDueForClockFreeze<T extends GameweekLockRow & { id: string }>(
  rows: T[],
  now: Date,
): T[] {
  return rows.filter((row) => {
    if (row.status === 'locked' || row.status === 'live') return false;
    if (TERMINAL_STATUSES.has(row.status)) return false;
    return lockTimeReached(row.lock_time, now);
  });
}

/**
 * Copie exigée en quittant upcoming ou locked.
 * Couvre le saut direct upcoming → completed du cron du dimanche.
 */
export function shouldFreezeLineup(previousStatus: string, nextStatus: string): boolean {
  if (nextStatus === previousStatus) return false;
  return previousStatus === 'upcoming' || previousStatus === 'locked';
}

/** Une ligne par pilote de chaque équipe. Les snapshots déjà présents sont ignorés plus tard. */
export function lineupSnapshotRows(
  teams: Array<{
    id: string;
    roster_assignments: Array<{
      real_entity_id: string;
      is_starter: boolean;
      is_joker: boolean;
    }>;
  }>,
  gameweekId: string,
): LineupSnapshotRow[] {
  return teams.flatMap((team) =>
    team.roster_assignments.map((assignment) => ({
      fantasy_team_id: team.id,
      gameweek_id: gameweekId,
      real_entity_id: assignment.real_entity_id,
      is_starter: assignment.is_starter,
      is_joker: assignment.is_joker,
    })),
  );
}

function gameweekBlocksRoster(row: GameweekLockRow, now: Date): boolean {
  if (row.status === 'locked' || row.status === 'live') return true;
  if (TERMINAL_STATUSES.has(row.status)) return false;
  return lockTimeReached(row.lock_time, now);
}

function lockTimeReached(lockTime: Date | null, now: Date): boolean {
  if (!lockTime) return false;
  return lockTime.getTime() <= now.getTime();
}
