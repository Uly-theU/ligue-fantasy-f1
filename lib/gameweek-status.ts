export const RACE_WINDOW_MS = 3 * 60 * 60 * 1000;

export type GameweekStatus = 'upcoming' | 'locked' | 'live' | 'completed' | 'cancelled';

export interface GameweekClock {
  status: GameweekStatus;
  lockTime: Date | null;
  qualifyingStart: Date | null;
  raceStart: Date;
}

const FORWARD: GameweekStatus[] = ['upcoming', 'locked', 'live', 'completed'];

/**
 * Statut cible d'après l'horloge, sans regarder le statut courant.
 * Le GP passe locked au lock, live au début des qualifications,
 * completed à la fin de la fenêtre de course (départ + 3 h).
 */
export function targetGameweekStatus(clock: GameweekClock, now: Date): GameweekStatus {
  if (clock.status === 'cancelled') return 'cancelled';

  const nowMs = now.getTime();
  const raceEnd = clock.raceStart.getTime() + RACE_WINDOW_MS;

  if (nowMs >= raceEnd) return 'completed';
  if (clock.qualifyingStart && nowMs >= clock.qualifyingStart.getTime()) return 'live';
  if (clock.lockTime && nowMs >= clock.lockTime.getTime()) return 'locked';
  return 'upcoming';
}

/** N'avance le statut que vers l'avant. Un cancelled reste cancelled. */
export function nextGameweekStatus(clock: GameweekClock, now: Date): GameweekStatus {
  const target = targetGameweekStatus(clock, now);
  if (target === 'cancelled' || clock.status === 'cancelled') return 'cancelled';

  const currentIndex = FORWARD.indexOf(clock.status);
  const targetIndex = FORWARD.indexOf(target);
  if (currentIndex === -1 || targetIndex === -1) return clock.status;
  return targetIndex > currentIndex ? target : clock.status;
}
