import { prisma } from '@/lib/prisma';
import { nextGameweekStatus, type GameweekStatus } from '@/lib/gameweek-status';
import { shouldFreezeLineup } from '@/lib/lineup';
import { freezeLineupsForGameweek } from '@/lib/freeze-lineups';

/**
 * Avance les statuts. Fige avant d'écrire le nouveau statut quand on quitte
 * upcoming ou locked, y compris le saut direct upcoming → completed.
 * Si le gel échoue, le statut ne change pas.
 */
export async function syncGameweekStatuses(season: number, now = new Date()) {
  const rows = await prisma.gameweek.findMany({ where: { season } });

  for (const row of rows) {
    const next = nextGameweekStatus(
      {
        status: row.status as GameweekStatus,
        lockTime: row.lock_time,
        qualifyingStart: row.qualifying_date,
        raceStart: row.race_date,
      },
      now,
    );

    if (next === row.status) continue;

    if (shouldFreezeLineup(row.status, next)) {
      await freezeLineupsForGameweek(row.id, season);
    }

    await prisma.gameweek.update({
      where: { id: row.id },
      data: { status: next },
    });
  }
}
