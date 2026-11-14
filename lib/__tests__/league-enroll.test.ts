import { describe, expect, it } from 'vitest';
import { enrollMember, type EnrollTx } from '@/lib/league-enroll';

function memoryDb() {
  const members: string[] = [];
  const teams: string[] = [];
  let queue = Promise.resolve();

  const tx: EnrollTx = {
    countMembers: async () => members.length,
    insertMember: async (_leagueId, userId) => {
      members.push(userId);
    },
    insertTeam: async (_leagueId, userId) => {
      teams.push(userId);
    },
  };

  return {
    members,
    teams,
    transaction<T>(fn: (client: EnrollTx) => Promise<T>): Promise<T> {
      const run = queue.then(() => fn(tx));
      queue = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

describe('enrollMember', () => {
  it('ne laisse qu\'une inscription sur le dernier siège', async () => {
    const db = memoryDb();
    db.members.push('owner');
    const input = {
      leagueId: 'league',
      teamName: 'Équipe',
      budget: null,
      maxPlayers: 2,
    };
    const [first, second] = await Promise.all([
      enrollMember(db, { ...input, userId: 'a' }),
      enrollMember(db, { ...input, userId: 'b' }),
    ]);
    const successes = [first, second].filter((result) => result.ok).length;
    expect(successes).toBe(1);
    expect(db.members).toHaveLength(2);
    expect(db.teams).toHaveLength(1);
  });

  it('n\'inscrit pas le membre si l\'équipe échoue', async () => {
    const members: string[] = [];
    const db = {
      transaction<T>(fn: (client: EnrollTx) => Promise<T>): Promise<T> {
        const snapshot = [...members];
        return fn({
          countMembers: async () => members.length,
          insertMember: async (_leagueId, userId) => {
            members.push(userId);
          },
          insertTeam: async () => {
            throw new Error('team failed');
          },
        }).catch((error) => {
          members.splice(0, members.length, ...snapshot);
          throw error;
        });
      },
    };

    await expect(
      enrollMember(db, {
        leagueId: 'league',
        userId: 'a',
        teamName: 'Équipe',
        budget: null,
        maxPlayers: 10,
      }),
    ).rejects.toThrow('team failed');
    expect(members).toHaveLength(0);
  });
});
