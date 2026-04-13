import { describe, it, expect } from 'vitest';
import {
  createTeamSchema,
  updateTeamSchema,
  addToRosterSchema,
  updateRosterSchema,
  createGameweekSchema,
  upsertPerformanceSchema,
} from '../validators';

/* ------------------------------------------------------------------ */
/*  createTeamSchema                                                   */
/* ------------------------------------------------------------------ */

describe('createTeamSchema', () => {
  it('accepte un input valide', () => {
    const input = { league_id: '550e8400-e29b-41d4-a716-446655440000', name: 'Mon Écurie' };
    expect(createTeamSchema.parse(input)).toEqual(input);
  });

  it('rejette un nom vide', () => {
    expect(() =>
      createTeamSchema.parse({ league_id: '550e8400-e29b-41d4-a716-446655440000', name: '' }),
    ).toThrow();
  });

  it('rejette un league_id non-UUID', () => {
    expect(() => createTeamSchema.parse({ league_id: 'not-a-uuid', name: 'Test' })).toThrow();
  });

  it('rejette un nom trop long (>100)', () => {
    expect(() =>
      createTeamSchema.parse({ league_id: '550e8400-e29b-41d4-a716-446655440000', name: 'a'.repeat(101) }),
    ).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  updateTeamSchema                                                   */
/* ------------------------------------------------------------------ */

describe('updateTeamSchema', () => {
  it('accepte un objet vide (tout optionnel)', () => {
    expect(updateTeamSchema.parse({})).toEqual({});
  });

  it('accepte un nom valide', () => {
    expect(updateTeamSchema.parse({ name: 'Nouveau nom' })).toEqual({ name: 'Nouveau nom' });
  });
});

/* ------------------------------------------------------------------ */
/*  addToRosterSchema                                                  */
/* ------------------------------------------------------------------ */

describe('addToRosterSchema', () => {
  it('accepte un real_entity_id avec is_starter par défaut à false', () => {
    const result = addToRosterSchema.parse({ real_entity_id: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.is_starter).toBe(false);
  });

  it('accepte is_starter explicite', () => {
    const result = addToRosterSchema.parse({
      real_entity_id: '550e8400-e29b-41d4-a716-446655440000',
      is_starter: true,
    });
    expect(result.is_starter).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  updateRosterSchema                                                 */
/* ------------------------------------------------------------------ */

describe('updateRosterSchema', () => {
  it('accepte un tableau de starters valide', () => {
    const input = {
      starters: ['550e8400-e29b-41d4-a716-446655440000'],
      joker_id: '550e8400-e29b-41d4-a716-446655440000',
    };
    expect(updateRosterSchema.parse(input)).toEqual(input);
  });

  it('rejette des starters non-UUID', () => {
    expect(() => updateRosterSchema.parse({ starters: ['not-uuid'] })).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  createGameweekSchema                                               */
/* ------------------------------------------------------------------ */

describe('createGameweekSchema', () => {
  it('accepte un GP valide', () => {
    const input = {
      season: 2026,
      round_number: 1,
      name: 'GP de Bahreïn',
      circuit: 'Sakhir',
      country: 'Bahreïn',
      race_date: '2026-03-08T15:00:00Z',
    };
    expect(() => createGameweekSchema.parse(input)).not.toThrow();
  });

  it('rejette une saison invalide', () => {
    expect(() =>
      createGameweekSchema.parse({
        season: 2020,
        round_number: 1,
        name: 'Test',
        race_date: '2026-03-08T15:00:00Z',
      }),
    ).toThrow();
  });

  it('rejette une date de course invalide', () => {
    expect(() =>
      createGameweekSchema.parse({
        season: 2026,
        round_number: 1,
        name: 'Test',
        race_date: 'not-a-date',
      }),
    ).toThrow();
  });
});

/* ------------------------------------------------------------------ */
/*  upsertPerformanceSchema                                            */
/* ------------------------------------------------------------------ */

describe('upsertPerformanceSchema', () => {
  it('accepte une performance complète', () => {
    const input = {
      real_entity_id: '550e8400-e29b-41d4-a716-446655440000',
      results: {
        race_position: 1,
        qualifying_session: 'Q3' as const,
        fastest_lap: true,
        dotd: false,
        dnf: null,
        grid_penalty: 0,
        positions_gained: 5,
      },
    };
    expect(() => upsertPerformanceSchema.parse(input)).not.toThrow();
  });

  it('accepte les valeurs par défaut', () => {
    const input = {
      real_entity_id: '550e8400-e29b-41d4-a716-446655440000',
      results: {
        race_position: null,
        qualifying_session: null,
      },
    };
    const parsed = upsertPerformanceSchema.parse(input);
    expect(parsed.results.fastest_lap).toBe(false);
    expect(parsed.results.dotd).toBe(false);
    expect(parsed.results.dnf).toBeNull();
    expect(parsed.results.grid_penalty).toBe(0);
    expect(parsed.results.positions_gained).toBe(0);
  });

  it('rejette un qualifying_session invalide', () => {
    expect(() =>
      upsertPerformanceSchema.parse({
        real_entity_id: '550e8400-e29b-41d4-a716-446655440000',
        results: {
          race_position: null,
          qualifying_session: 'Q4',
        },
      }),
    ).toThrow();
  });

  it('rejette un dnf invalide', () => {
    expect(() =>
      upsertPerformanceSchema.parse({
        real_entity_id: '550e8400-e29b-41d4-a716-446655440000',
        results: {
          race_position: null,
          qualifying_session: null,
          dnf: 'collision',
        },
      }),
    ).toThrow();
  });
});
