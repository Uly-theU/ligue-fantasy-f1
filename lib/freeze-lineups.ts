import { prisma } from '@/lib/prisma';
import {
  gameweeksDueForClockFreeze,
  lineupSnapshotRows,
  rosterBlockedByClock,
} from '@/lib/lineup';

/**
 * Copie l'alignement de chaque équipe dont la ligue est active pour cette saison.
 * skipDuplicates respecte la clé (fantasy_team_id, gameweek_id, real_entity_id) :
 * un snapshot déjà écrit ne bloque pas les équipes encore absentes.
 */
export async function freezeLineupsForGameweek(gameweekId: string, season: number) {
  const teams = await prisma.fantasyTeam.findMany({
    where: { league: { season, status: 'active' } },
    include: { roster_assignments: true },
  });

  const data = lineupSnapshotRows(teams, gameweekId);
  if (data.length === 0) return;

  await prisma.lineupSnapshot.createMany({ data, skipDuplicates: true });
}

/**
 * Charge les GP de la saison (id, status, lock_time).
 * Si l'horloge fige l'alignement alors que le statut n'est pas encore locked/live,
 * copie ces GP avant le refus.
 */
export async function freezeRosterIfClockBlocked(season: number, now = new Date()): Promise<boolean> {
  const rows = await prisma.gameweek.findMany({
    where: { season },
    select: { id: true, status: true, lock_time: true },
  });

  if (!rosterBlockedByClock(rows, now)) return false;

  for (const gameweek of gameweeksDueForClockFreeze(rows, now)) {
    await freezeLineupsForGameweek(gameweek.id, season);
  }

  return true;
}
