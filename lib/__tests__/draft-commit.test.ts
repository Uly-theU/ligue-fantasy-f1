import { describe, expect, it } from 'vitest';
import { commitDraftPick, type DraftCommitTx } from '@/lib/draft-commit';

function memoryDb() {
  const drivers = new Set<string>();
  const picks = new Set<string>();
  let queue = Promise.resolve();

  const tx: DraftCommitTx = {
    driverTakenInLeague: async (leagueId, realEntityId) => drivers.has(`${leagueId}:${realEntityId}`),
    pickNumberTaken: async (sessionId, pickNumber) => picks.has(`${sessionId}:${pickNumber}`),
    createPick: async (input) => {
      const driverKey = `${input.leagueId}:${input.realEntityId}`;
      const pickKey = `${input.sessionId}:${input.pickNumber}`;
      if (drivers.has(driverKey) || picks.has(pickKey)) throw new Error('unique');
      drivers.add(driverKey);
      picks.add(pickKey);
    },
  };

  return {
    drivers,
    transaction<T>(fn: (client: DraftCommitTx) => Promise<T>): Promise<T> {
      const run = queue.then(() => fn(tx));
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

describe('commitDraftPick', () => {
  it('refuse un pilote déjà pris dans une autre session de la ligue', async () => {
    const db = memoryDb();
    await commitDraftPick(db, {
      leagueId: 'league',
      sessionId: 'session-1',
      userId: 'u1',
      realEntityId: 'driver',
      pickNumber: 1,
      roundNumber: 1,
    });
    const second = await commitDraftPick(db, {
      leagueId: 'league',
      sessionId: 'session-2',
      userId: 'u2',
      realEntityId: 'driver',
      pickNumber: 1,
      roundNumber: 1,
    });
    expect(second.ok).toBe(false);
    expect(db.drivers.size).toBe(1);
  });

  it('n\'enregistre qu\'un pick quand deux requêtes partent ensemble', async () => {
    const db = memoryDb();
    const input = {
      leagueId: 'league',
      sessionId: 'session',
      userId: 'u1',
      realEntityId: 'driver',
      pickNumber: 3,
      roundNumber: 1,
    };
    const [first, second] = await Promise.all([
      commitDraftPick(db, input),
      commitDraftPick(db, input),
    ]);
    const successes = [first, second].filter((result) => result.ok).length;
    expect(successes).toBe(1);
    expect(db.drivers.size).toBe(1);
  });
});
