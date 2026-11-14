export interface EnrollDb {
  transaction<T>(fn: (tx: EnrollTx) => Promise<T>): Promise<T>;
}

export interface EnrollTx {
  countMembers(leagueId: string): Promise<number>;
  insertMember(leagueId: string, userId: string): Promise<void>;
  insertTeam(leagueId: string, userId: string, name: string, budget: number | null): Promise<void>;
}

export type EnrollResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * Comptage, membre et équipe dans la même transaction.
 * Si l'équipe échoue, l'exception sort de la transaction et le membre n'est pas gardé.
 */
export async function enrollMember(
  db: EnrollDb,
  input: {
    leagueId: string;
    userId: string;
    teamName: string;
    budget: number | null;
    maxPlayers: number | null;
  },
): Promise<EnrollResult> {
  return db.transaction(async (tx) => {
    const count = await tx.countMembers(input.leagueId);
    if (input.maxPlayers !== null && count >= input.maxPlayers) {
      return { ok: false, status: 403, message: 'La ligue est complète' };
    }
    await tx.insertMember(input.leagueId, input.userId);
    await tx.insertTeam(input.leagueId, input.userId, input.teamName, input.budget);
    return { ok: true };
  });
}
