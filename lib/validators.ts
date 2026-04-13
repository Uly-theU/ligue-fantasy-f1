import { z } from 'zod';

// ── Teams ──────────────────────────────────────────

export const createTeamSchema = z.object({
  league_id: z.string().uuid(),
  name: z.string().min(1).max(100),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

// ── Roster ─────────────────────────────────────────

export const addToRosterSchema = z.object({
  real_entity_id: z.string().uuid(),
  is_starter: z.boolean().optional().default(false),
});

export const updateRosterSchema = z.object({
  starters: z.array(z.string().uuid()), // real_entity_ids to set as starters
  joker_id: z.string().uuid().optional(), // real_entity_id du pilote joker
});

// ── Gameweeks ──────────────────────────────────────

export const createGameweekSchema = z.object({
  season: z.number().int().min(2024).max(2030),
  round_number: z.number().int().min(1).max(30),
  name: z.string().min(1).max(100),
  circuit: z.string().max(100).optional(),
  country: z.string().max(50).optional(),
  race_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide'),
  qualifying_date: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
  lock_time: z.string().refine((d) => !isNaN(Date.parse(d)), 'Date invalide').optional(),
});

export const updateGameweekSchema = createGameweekSchema.partial().extend({
  status: z.enum(['upcoming', 'locked', 'live', 'completed', 'cancelled']).optional(),
});

// ── Performances (résultats réels) ─────────────────

export const upsertPerformanceSchema = z.object({
  real_entity_id: z.string().uuid(),
  results: z.object({
    race_position: z.number().int().min(1).max(20).nullable(),
    qualifying_session: z.enum(['Q1', 'Q2', 'Q3']).nullable(),
    qualifying_position: z.number().int().min(1).max(20).nullable().optional(),
    fastest_lap: z.boolean().default(false),
    dotd: z.boolean().default(false),
    dnf: z.enum(['mechanical', 'accident']).nullable().default(null),
    grid_penalty: z.number().int().min(0).default(0),
    positions_gained: z.number().int().default(0),
  }),
});
