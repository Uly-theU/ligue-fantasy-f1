-- Horodatages réels, copie d'alignement, unicité du draft.
-- À appliquer sur la base locale ou Supabase avant d'utiliser l'app.
-- Les dates existantes (minuit) gardent minuit tant que le seed n'est pas relancé.

ALTER TABLE gameweeks
  ALTER COLUMN race_date TYPE timestamptz USING race_date::timestamptz,
  ALTER COLUMN qualifying_date TYPE timestamptz USING qualifying_date::timestamptz;

CREATE TABLE lineup_snapshots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  fantasy_team_id uuid NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  gameweek_id uuid NOT NULL REFERENCES gameweeks(id) ON DELETE CASCADE,
  real_entity_id uuid NOT NULL REFERENCES real_entities(id),
  is_starter boolean NOT NULL DEFAULT false,
  is_joker boolean NOT NULL DEFAULT false,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fantasy_team_id, gameweek_id, real_entity_id)
);

ALTER TABLE draft_picks ADD COLUMN league_id uuid;

UPDATE draft_picks AS pick
SET league_id = session.league_id
FROM draft_sessions AS session
WHERE session.id = pick.draft_session_id
  AND pick.league_id IS NULL;

ALTER TABLE draft_picks
  ALTER COLUMN league_id SET NOT NULL;

ALTER TABLE draft_picks
  ADD CONSTRAINT draft_picks_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE draft_picks
  ADD CONSTRAINT draft_picks_league_driver_key UNIQUE (league_id, real_entity_id);

ALTER TABLE draft_picks
  ADD CONSTRAINT draft_picks_session_pick_key UNIQUE (draft_session_id, pick_number);
