/**
 * Moteur de scoring Fantasy F1
 *
 * Calcule les points d'un pilote pour un GP donné en appliquant
 * les scoring_rules d'une ligue aux performances réelles.
 */

export interface ScoringRules {
  race_finish: Record<string, number>; // { "P1": 25, "P2": 18, ... }
  qualifying: Record<string, number>;  // { "Q3": 3, "Q2": 1, "Q1": 0 }
  bonuses: {
    fastest_lap: number;
    driver_of_the_day: number;
    positions_gained_per_place: number;
  };
  penalties: {
    dnf_mechanical: number;
    dnf_accident: number;
    grid_penalty_per_place: number;
  };
}

export interface DriverPerformance {
  race_position: number | null;
  qualifying_session: string | null; // "Q1", "Q2", "Q3"
  qualifying_position: number | null;
  fastest_lap: boolean;
  dotd: boolean;               // Driver of the Day
  dnf: 'mechanical' | 'accident' | 'unspecified' | null;
  grid_penalty: number;
  positions_gained: number;
}

export interface DriverScoreBreakdown {
  race: number;
  qualifying: number;
  bonus: number;
  penalty: number;
  total: number;
  details: string[];
}

/**
 * Calcule le score d'un pilote pour un GP.
 */
export function calculateDriverScore(
  performance: DriverPerformance,
  rules: ScoringRules,
): DriverScoreBreakdown {
  let race = 0;
  let qualifying = 0;
  let bonus = 0;
  let penalty = 0;
  const details: string[] = [];

  // 1. Points de course. Tout DNF, y compris sans cause connue, retire les points d'arrivée.
  if (performance.race_position && !performance.dnf) {
    const posKey = `P${performance.race_position}`;
    const pts = rules.race_finish[posKey] ?? 0;
    race = pts;
    if (pts > 0) details.push(`Course ${posKey}: +${pts}`);
  }

  // 2. Points de qualification
  if (performance.qualifying_session) {
    const qPts = rules.qualifying[performance.qualifying_session] ?? 0;
    qualifying = qPts;
    if (qPts > 0) details.push(`Qualifs ${performance.qualifying_session}: +${qPts}`);
  }

  // 3. Bonus
  if (performance.fastest_lap) {
    bonus += rules.bonuses.fastest_lap;
    details.push(`Meilleur tour: +${rules.bonuses.fastest_lap}`);
  }
  if (performance.dotd) {
    bonus += rules.bonuses.driver_of_the_day;
    details.push(`Pilote du jour: +${rules.bonuses.driver_of_the_day}`);
  }
  if (performance.positions_gained > 0) {
    const gainPts = performance.positions_gained * rules.bonuses.positions_gained_per_place;
    bonus += gainPts;
    details.push(`+${performance.positions_gained} places: +${gainPts}`);
  }

  // 4. Pénalités
  if (performance.dnf === 'mechanical') {
    penalty += rules.penalties.dnf_mechanical;
    details.push(`DNF mécanique: ${rules.penalties.dnf_mechanical}`);
  } else if (performance.dnf === 'accident') {
    penalty += rules.penalties.dnf_accident;
    details.push(`DNF accident: ${rules.penalties.dnf_accident}`);
  }
  if (performance.grid_penalty > 0) {
    const gridPts = performance.grid_penalty * rules.penalties.grid_penalty_per_place;
    penalty += gridPts;
    details.push(`Pénalité grille (${performance.grid_penalty}): ${gridPts}`);
  }

  const total = race + qualifying + bonus + penalty;

  return { race, qualifying, bonus, penalty, total, details };
}

/**
 * Calcule le score total d'une équipe fantasy pour un GP.
 * Applique le multiplicateur joker (x2).
 */
export function calculateTeamScore(
  roster: Array<{
    real_entity_id: string;
    short_name: string;
    is_starter: boolean;
    is_joker: boolean;
    performance: DriverPerformance | null;
  }>,
  rules: ScoringRules,
): {
  breakdown: Record<string, DriverScoreBreakdown & { joker: boolean }>;
  total: number;
} {
  const breakdown: Record<string, DriverScoreBreakdown & { joker: boolean }> = {};
  let total = 0;

  for (const entry of roster) {
    // Seuls les titulaires marquent des points
    if (!entry.is_starter || !entry.performance) continue;

    const driverScore = calculateDriverScore(entry.performance, rules);
    const multiplier = entry.is_joker ? 2 : 1;
    const finalTotal = driverScore.total * multiplier;

    if (entry.is_joker) {
      driverScore.details.push(`Joker x2`);
    }

    breakdown[entry.short_name] = {
      ...driverScore,
      total: finalTotal,
      joker: entry.is_joker,
    };

    total += finalTotal;
  }

  return { breakdown, total };
}

/**
 * Règles de scoring par défaut.
 */
export const DEFAULT_SCORING_RULES: ScoringRules = {
  race_finish: {
    P1: 25, P2: 18, P3: 15, P4: 12, P5: 10,
    P6: 8, P7: 6, P8: 4, P9: 2, P10: 1,
  },
  qualifying: { Q3: 3, Q2: 1, Q1: 0 },
  bonuses: {
    fastest_lap: 1,
    driver_of_the_day: 2,
    positions_gained_per_place: 0.5,
  },
  penalties: {
    dnf_mechanical: -5,
    dnf_accident: -3,
    grid_penalty_per_place: -1,
  },
};
