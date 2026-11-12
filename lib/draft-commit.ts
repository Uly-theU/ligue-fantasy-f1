export interface DraftCommitDb {
  transaction<T>(fn: (tx: DraftCommitTx) => Promise<T>): Promise<T>;
}

export interface DraftCommitTx {
  driverTakenInLeague(leagueId: string, realEntityId: string): Promise<boolean>;
  pickNumberTaken(sessionId: string, pickNumber: number): Promise<boolean>;
  createPick(input: {
    leagueId: string;
    sessionId: string;
    userId: string;
    realEntityId: string;
    pickNumber: number;
    roundNumber: number;
  }): Promise<void>;
}

export type DraftCommitResult =
  | { ok: true }
  | { ok: false; status: 409; message: string };

/** Écrit le pick dans la transaction. La contrainte simulée ou SQL refuse le doublon. */
export async function commitDraftPick(
  db: DraftCommitDb,
  input: {
    leagueId: string;
    sessionId: string;
    userId: string;
    realEntityId: string;
    pickNumber: number;
    roundNumber: number;
  },
): Promise<DraftCommitResult> {
  try {
    return await db.transaction(async (tx) => {
      if (await tx.driverTakenInLeague(input.leagueId, input.realEntityId)) {
        return { ok: false, status: 409, message: 'Ce pilote a déjà été drafté' };
      }
      if (await tx.pickNumberTaken(input.sessionId, input.pickNumber)) {
        return { ok: false, status: 409, message: 'Ce choix a déjà été pris' };
      }
      await tx.createPick(input);
      return { ok: true };
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : '';
    if (code === 'P2002' || message === 'unique') {
      return { ok: false, status: 409, message: 'Ce pilote a déjà été drafté' };
    }
    throw error;
  }
}
