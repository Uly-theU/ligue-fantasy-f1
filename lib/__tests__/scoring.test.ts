import { describe, it, expect } from 'vitest';
import {
  calculateDriverScore,
  calculateTeamScore,
  DEFAULT_SCORING_RULES,
  type DriverPerformance,
  type ScoringRules,
} from '../scoring';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function basePerformance(overrides: Partial<DriverPerformance> = {}): DriverPerformance {
  return {
    race_position: null,
    qualifying_session: null,
    qualifying_position: null,
    fastest_lap: false,
    dotd: false,
    dnf: null,
    grid_penalty: 0,
    positions_gained: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  DEFAULT_SCORING_RULES                                              */
/* ------------------------------------------------------------------ */

describe('DEFAULT_SCORING_RULES', () => {
  it('contient les points de course P1 à P10', () => {
    expect(DEFAULT_SCORING_RULES.race_finish.P1).toBe(25);
    expect(DEFAULT_SCORING_RULES.race_finish.P10).toBe(1);
    expect(Object.keys(DEFAULT_SCORING_RULES.race_finish)).toHaveLength(10);
  });

  it('contient les points de qualification Q1-Q3', () => {
    expect(DEFAULT_SCORING_RULES.qualifying.Q3).toBe(3);
    expect(DEFAULT_SCORING_RULES.qualifying.Q2).toBe(1);
    expect(DEFAULT_SCORING_RULES.qualifying.Q1).toBe(0);
  });

  it('contient bonus et pénalités', () => {
    expect(DEFAULT_SCORING_RULES.bonuses.fastest_lap).toBe(1);
    expect(DEFAULT_SCORING_RULES.bonuses.driver_of_the_day).toBe(2);
    expect(DEFAULT_SCORING_RULES.penalties.dnf_mechanical).toBe(-5);
    expect(DEFAULT_SCORING_RULES.penalties.dnf_accident).toBe(-3);
  });
});

/* ------------------------------------------------------------------ */
/*  calculateDriverScore                                               */
/* ------------------------------------------------------------------ */

describe('calculateDriverScore', () => {
  const rules = DEFAULT_SCORING_RULES;

  it('P1 sans extras donne 25 points', () => {
    const perf = basePerformance({ race_position: 1 });
    const result = calculateDriverScore(perf, rules);
    expect(result.race).toBe(25);
    expect(result.total).toBe(25);
  });

  it('position hors top 10 donne 0 points de course', () => {
    const perf = basePerformance({ race_position: 15 });
    const result = calculateDriverScore(perf, rules);
    expect(result.race).toBe(0);
    expect(result.total).toBe(0);
  });

  it('DNF mécanique annule les points de course et applique la pénalité', () => {
    const perf = basePerformance({ race_position: 5, dnf: 'mechanical' });
    const result = calculateDriverScore(perf, rules);
    expect(result.race).toBe(0);
    expect(result.penalty).toBe(-5);
    expect(result.total).toBe(-5);
  });

  it('DNF accident applique -3', () => {
    const perf = basePerformance({ race_position: 3, dnf: 'accident' });
    const result = calculateDriverScore(perf, rules);
    expect(result.penalty).toBe(-3);
  });

  it('meilleur tour donne le bonus', () => {
    const perf = basePerformance({ race_position: 1, fastest_lap: true });
    const result = calculateDriverScore(perf, rules);
    expect(result.bonus).toBe(1);
    expect(result.total).toBe(26);
  });

  it('pilote du jour donne le bonus', () => {
    const perf = basePerformance({ race_position: 1, dotd: true });
    const result = calculateDriverScore(perf, rules);
    expect(result.bonus).toBe(2);
    expect(result.total).toBe(27);
  });

  it('positions gagnées ajoutent 0.5 par place', () => {
    const perf = basePerformance({ race_position: 5, positions_gained: 4 });
    const result = calculateDriverScore(perf, rules);
    expect(result.bonus).toBe(2); // 4 * 0.5
    expect(result.total).toBe(12); // 10 (P5) + 2
  });

  it('pénalité grille déduit -1 par place', () => {
    const perf = basePerformance({ race_position: 1, grid_penalty: 3 });
    const result = calculateDriverScore(perf, rules);
    expect(result.penalty).toBe(-3); // 3 * -1
    expect(result.total).toBe(22); // 25 - 3
  });

  it('qualification Q3 donne 3 points', () => {
    const perf = basePerformance({ qualifying_session: 'Q3' });
    const result = calculateDriverScore(perf, rules);
    expect(result.qualifying).toBe(3);
    expect(result.total).toBe(3);
  });

  it('scénario combiné : P2 + Q3 + fastest lap + DOTD + 3 places gagnées', () => {
    const perf = basePerformance({
      race_position: 2,
      qualifying_session: 'Q3',
      fastest_lap: true,
      dotd: true,
      positions_gained: 3,
    });
    const result = calculateDriverScore(perf, rules);
    expect(result.race).toBe(18);      // P2
    expect(result.qualifying).toBe(3); // Q3
    expect(result.bonus).toBe(4.5);    // 1 + 2 + 1.5
    expect(result.penalty).toBe(0);
    expect(result.total).toBe(25.5);
  });

  it('race_position null donne 0 points de course', () => {
    const perf = basePerformance({ race_position: null });
    const result = calculateDriverScore(perf, rules);
    expect(result.race).toBe(0);
    expect(result.total).toBe(0);
  });

  it('le détail contient les descriptions', () => {
    const perf = basePerformance({ race_position: 1, fastest_lap: true });
    const result = calculateDriverScore(perf, rules);
    expect(result.details).toContain('Course P1: +25');
    expect(result.details).toContain('Meilleur tour: +1');
  });
});

/* ------------------------------------------------------------------ */
/*  calculateTeamScore                                                 */
/* ------------------------------------------------------------------ */

describe('calculateTeamScore', () => {
  const rules = DEFAULT_SCORING_RULES;

  it('seuls les titulaires marquent des points', () => {
    const roster = [
      {
        real_entity_id: 'a',
        short_name: 'VER',
        is_starter: true,
        is_joker: false,
        performance: basePerformance({ race_position: 1 }),
      },
      {
        real_entity_id: 'b',
        short_name: 'HAM',
        is_starter: false,
        is_joker: false,
        performance: basePerformance({ race_position: 2 }),
      },
    ];
    const result = calculateTeamScore(roster, rules);
    expect(result.total).toBe(25); // Seulement VER (P1)
    expect(result.breakdown['VER']).toBeDefined();
    expect(result.breakdown['HAM']).toBeUndefined();
  });

  it('le joker double les points du pilote', () => {
    const roster = [
      {
        real_entity_id: 'a',
        short_name: 'VER',
        is_starter: true,
        is_joker: true,
        performance: basePerformance({ race_position: 1 }),
      },
    ];
    const result = calculateTeamScore(roster, rules);
    expect(result.total).toBe(50); // 25 * 2
    expect(result.breakdown['VER'].joker).toBe(true);
    expect(result.breakdown['VER'].total).toBe(50);
  });

  it('roster vide retourne 0', () => {
    const result = calculateTeamScore([], rules);
    expect(result.total).toBe(0);
    expect(Object.keys(result.breakdown)).toHaveLength(0);
  });

  it('pilote sans performance est ignoré', () => {
    const roster = [
      {
        real_entity_id: 'a',
        short_name: 'VER',
        is_starter: true,
        is_joker: false,
        performance: null,
      },
    ];
    const result = calculateTeamScore(roster, rules);
    expect(result.total).toBe(0);
  });

  it('somme correcte de plusieurs titulaires', () => {
    const roster = [
      {
        real_entity_id: 'a',
        short_name: 'VER',
        is_starter: true,
        is_joker: false,
        performance: basePerformance({ race_position: 1 }),
      },
      {
        real_entity_id: 'b',
        short_name: 'NOR',
        is_starter: true,
        is_joker: false,
        performance: basePerformance({ race_position: 3 }),
      },
    ];
    const result = calculateTeamScore(roster, rules);
    expect(result.total).toBe(40); // 25 + 15
  });
});
