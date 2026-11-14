-- Référentiel F1 : circuits, tracés, pilotes, écuries, saisons, historique des GP.
-- Source des données : F1DB (https://github.com/f1db/f1db), licence CC BY 4.0.

CREATE TABLE circuits (
  id varchar(80) PRIMARY KEY,
  name varchar(120) NOT NULL,
  full_name varchar(200) NOT NULL,
  previous_names text[] NOT NULL DEFAULT '{}',
  circuit_type varchar(20) NOT NULL,
  direction varchar(20) NOT NULL,
  place_name varchar(120) NOT NULL,
  country_id varchar(80) NOT NULL,
  country_name varchar(80) NOT NULL,
  country_code varchar(2) NOT NULL,
  latitude numeric(10, 6) NOT NULL,
  longitude numeric(10, 6) NOT NULL,
  length_km numeric(6, 3) NOT NULL,
  turns smallint NOT NULL,
  total_races smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE circuit_layouts (
  id varchar(80) PRIMARY KEY,
  circuit_id varchar(80) NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  effective boolean NOT NULL DEFAULT false,
  length_km numeric(6, 3) NOT NULL,
  turns smallint NOT NULL,
  svg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX circuit_layouts_circuit_id_idx ON circuit_layouts(circuit_id);

CREATE TABLE constructors (
  id varchar(80) PRIMARY KEY,
  name varchar(120) NOT NULL,
  full_name varchar(200) NOT NULL,
  country_id varchar(80) NOT NULL,
  country_name varchar(80) NOT NULL,
  country_code varchar(2) NOT NULL,
  color varchar(7),
  active boolean NOT NULL DEFAULT false,
  total_championship_wins integer NOT NULL DEFAULT 0,
  total_race_entries integer NOT NULL DEFAULT 0,
  total_race_starts integer NOT NULL DEFAULT 0,
  total_race_wins integer NOT NULL DEFAULT 0,
  total_podiums integer NOT NULL DEFAULT 0,
  total_points numeric(10, 1) NOT NULL DEFAULT 0,
  total_pole_positions integer NOT NULL DEFAULT 0,
  total_fastest_laps integer NOT NULL DEFAULT 0,
  best_championship_position integer,
  best_race_result integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE f1_drivers (
  id varchar(80) PRIMARY KEY,
  first_name varchar(80) NOT NULL,
  last_name varchar(120) NOT NULL,
  full_name varchar(200) NOT NULL,
  display_name varchar(120) NOT NULL DEFAULT '',
  abbreviation varchar(3) NOT NULL,
  permanent_number varchar(2),
  nationality_id varchar(80) NOT NULL,
  nationality_name varchar(80) NOT NULL,
  nationality_code varchar(2) NOT NULL,
  date_of_birth date,
  total_championship_wins integer NOT NULL DEFAULT 0,
  total_race_entries integer NOT NULL DEFAULT 0,
  total_race_starts integer NOT NULL DEFAULT 0,
  total_race_wins integer NOT NULL DEFAULT 0,
  total_race_laps integer NOT NULL DEFAULT 0,
  total_podiums integer NOT NULL DEFAULT 0,
  total_points numeric(10, 1) NOT NULL DEFAULT 0,
  total_pole_positions integer NOT NULL DEFAULT 0,
  total_fastest_laps integer NOT NULL DEFAULT 0,
  total_sprint_starts integer NOT NULL DEFAULT 0,
  total_sprint_wins integer NOT NULL DEFAULT 0,
  total_driver_of_the_day integer NOT NULL DEFAULT 0,
  total_grand_slams integer NOT NULL DEFAULT 0,
  best_championship_position integer,
  best_race_result integer,
  best_grid integer,
  current_constructor_id varchar(80) REFERENCES constructors(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX f1_drivers_abbreviation_idx ON f1_drivers(abbreviation);
CREATE INDEX f1_drivers_current_constructor_id_idx ON f1_drivers(current_constructor_id);

CREATE TABLE driver_season_stats (
  driver_id varchar(80) NOT NULL REFERENCES f1_drivers(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  constructor_id varchar(80) REFERENCES constructors(id) ON DELETE SET NULL,
  position smallint,
  position_text varchar(8) NOT NULL,
  points numeric(10, 1) NOT NULL DEFAULT 0,
  wins smallint NOT NULL DEFAULT 0,
  podiums smallint NOT NULL DEFAULT 0,
  poles smallint NOT NULL DEFAULT 0,
  fastest_laps smallint NOT NULL DEFAULT 0,
  starts smallint NOT NULL DEFAULT 0,
  entries smallint NOT NULL DEFAULT 0,
  race_laps integer NOT NULL DEFAULT 0,
  sprint_starts smallint NOT NULL DEFAULT 0,
  sprint_wins smallint NOT NULL DEFAULT 0,
  driver_of_the_day smallint NOT NULL DEFAULT 0,
  best_race_result smallint,
  best_grid smallint,
  PRIMARY KEY (driver_id, year)
);

CREATE INDEX driver_season_stats_constructor_id_idx ON driver_season_stats(constructor_id);
CREATE INDEX driver_season_stats_year_idx ON driver_season_stats(year);

CREATE TABLE constructor_season_stats (
  constructor_id varchar(80) NOT NULL REFERENCES constructors(id) ON DELETE CASCADE,
  year smallint NOT NULL,
  position smallint,
  position_text varchar(8) NOT NULL,
  points numeric(10, 1) NOT NULL DEFAULT 0,
  wins smallint NOT NULL DEFAULT 0,
  podiums smallint NOT NULL DEFAULT 0,
  podium_races smallint NOT NULL DEFAULT 0,
  poles smallint NOT NULL DEFAULT 0,
  fastest_laps smallint NOT NULL DEFAULT 0,
  starts smallint NOT NULL DEFAULT 0,
  entries smallint NOT NULL DEFAULT 0,
  one_twos smallint NOT NULL DEFAULT 0,
  sprint_starts smallint NOT NULL DEFAULT 0,
  sprint_wins smallint NOT NULL DEFAULT 0,
  best_race_result smallint,
  best_grid smallint,
  PRIMARY KEY (constructor_id, year)
);

CREATE INDEX constructor_season_stats_year_idx ON constructor_season_stats(year);

CREATE TABLE race_records (
  id integer PRIMARY KEY,
  year smallint NOT NULL,
  round smallint NOT NULL,
  official_name varchar(240) NOT NULL,
  grand_prix_id varchar(80) NOT NULL,
  date date NOT NULL,
  circuit_id varchar(80) NOT NULL REFERENCES circuits(id),
  circuit_layout_id varchar(80) REFERENCES circuit_layouts(id) ON DELETE SET NULL,
  laps smallint,
  distance_km numeric(7, 3),
  course_length_km numeric(6, 3),
  turns smallint,
  direction varchar(20),
  winner_driver_id varchar(80) REFERENCES f1_drivers(id) ON DELETE SET NULL,
  winner_constructor_id varchar(80) REFERENCES constructors(id) ON DELETE SET NULL,
  pole_driver_id varchar(80) REFERENCES f1_drivers(id) ON DELETE SET NULL,
  fastest_lap_driver_id varchar(80) REFERENCES f1_drivers(id) ON DELETE SET NULL,
  fastest_lap_time varchar(16),
  UNIQUE (year, round)
);

CREATE INDEX race_records_circuit_id_year_idx ON race_records(circuit_id, year);
CREATE INDEX race_records_winner_driver_id_idx ON race_records(winner_driver_id);

ALTER TABLE real_entities
  ADD COLUMN driver_id varchar(80) REFERENCES f1_drivers(id) ON DELETE SET NULL;

CREATE INDEX real_entities_driver_id_idx ON real_entities(driver_id);

ALTER TABLE gameweeks
  ADD COLUMN circuit_id varchar(80) REFERENCES circuits(id) ON DELETE SET NULL,
  ADD COLUMN circuit_layout_id varchar(80) REFERENCES circuit_layouts(id) ON DELETE SET NULL;

CREATE INDEX gameweeks_circuit_id_idx ON gameweeks(circuit_id);
CREATE INDEX gameweeks_circuit_layout_id_idx ON gameweeks(circuit_layout_id);

COMMENT ON TABLE circuits IS 'Circuits F1. Source : F1DB, licence CC BY 4.0.';
COMMENT ON TABLE race_records IS 'Historique des Grands Prix (vainqueur, pôle, meilleur tour). Source : F1DB, CC BY 4.0.';
