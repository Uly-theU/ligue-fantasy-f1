import type { DriverPerformance } from '@/lib/scoring';
import { qualifyingSessionForPosition } from '@/lib/qualifying';

/** Ligne OpenF1 GET /v1/session_result. Pas de champ pilote du jour ni de pénalité de grille. */
export interface OpenF1SessionResult {
  driver_number: number;
  position: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

export interface OpenF1GridSlot {
  driver_number: number;
  position: number;
}

export interface OpenF1PositionSample {
  driver_number: number;
  position: number;
  date: string;
}

/**
 * Construit la performance scorée.
 * La position officielle vient de session_result. Le dernier échantillon /position est ignoré.
 * OpenF1 ne dit pas si l'abandon est mécanique ou un accident : dnf = 'unspecified', sans pénalité inventée.
 * La pénalité de grille est l'écart grille − position de qualifications quand les deux existent.
 * dotd reste false : la source ne le fournit pas.
 */
export function mapOfficialResult(input: {
  race: OpenF1SessionResult;
  qualifyingPosition: number | null;
  gridPosition: number | null;
  fastestLap: boolean;
  positionSamples?: OpenF1PositionSample[];
}): DriverPerformance {
  const retired = input.race.dnf || input.race.dns || input.race.dsq;
  const quali = input.qualifyingPosition;
  const grid = input.gridPosition;
  const racePosition = input.race.position;

  const gridPenalty =
    grid !== null && quali !== null && grid > quali ? grid - quali : 0;

  const positionsGained =
    !retired && grid !== null && racePosition !== null ? grid - racePosition : 0;

  return {
    race_position: racePosition,
    qualifying_session: quali === null ? null : qualifyingSessionForPosition(quali),
    qualifying_position: quali,
    fastest_lap: input.fastestLap,
    dotd: false,
    dnf: retired ? 'unspecified' : null,
    grid_penalty: gridPenalty,
    positions_gained: positionsGained,
  };
}
