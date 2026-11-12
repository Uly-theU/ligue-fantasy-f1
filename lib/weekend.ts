import { targetGameweekStatus } from '@/lib/gameweek-status';

export interface WeekendGameweek {
  id: string;
  name: string;
  circuit: string | null;
  country: string | null;
  race_date: string;
  qualifying_date: string | null;
  lock_time: string | null;
  status: string;
  round_number: number;
}

export type WeekendPhase = 'open' | 'locked' | 'live' | 'done';

export interface LineupState {
  hasTeam: boolean;
  rosterCount: number;
  starterCount: number;
  rosterSize: number;
  hasJoker: boolean;
  unavailable: boolean;
}

export interface WeekendAction {
  href: string;
  label: string;
  hint: string;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function rosterSizeFromSettings(settings: unknown): number {
  if (!settings || typeof settings !== 'object' || !('roster_size' in settings)) return 5;
  const size = (settings as { roster_size?: unknown }).roster_size;
  if (typeof size === 'number' && Number.isInteger(size) && size > 0) return size;
  return 5;
}

/** Phase d'après l'horloge : le statut stocké ne fige pas l'écran. */
export function weekendPhase(gameweek: WeekendGameweek, now: Date): WeekendPhase {
  const raceStart = parseDate(gameweek.race_date);
  if (!raceStart) return 'done';
  const status = targetGameweekStatus(
    {
      status: 'upcoming',
      lockTime: parseDate(gameweek.lock_time),
      qualifyingStart: parseDate(gameweek.qualifying_date),
      raceStart,
    },
    now,
  );
  if (status === 'completed') return 'done';
  if (status === 'live') return 'live';
  if (status === 'locked') return 'locked';
  return 'open';
}

/** Le premier Grand Prix dont la course n'est pas terminée. Sinon le dernier disputé. */
export function pickWeekend(gameweeks: WeekendGameweek[], now: Date): WeekendGameweek | null {
  const sorted = gameweeks
    .filter((gameweek) => gameweek.status !== 'cancelled' && parseDate(gameweek.race_date))
    .sort((a, b) => a.round_number - b.round_number);
  const current = sorted.find((gameweek) => weekendPhase(gameweek, now) !== 'done');
  return current ?? sorted.at(-1) ?? null;
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function openLineupHint(lineup: LineupState): string {
  const { starterCount, rosterSize, hasJoker } = lineup;
  const joker = 'Le joker double les points d’un titulaire.';
  if (starterCount === rosterSize && hasJoker) {
    return `${plural(rosterSize, 'titulaire', 'titulaires')}, joker posé. Tu peux encore changer jusqu’au verrou.`;
  }
  if (starterCount > rosterSize) {
    return `${plural(starterCount, 'titulaire', 'titulaires')} sur ${rosterSize}. Ramène la grille au bon nombre.`;
  }
  if (starterCount === rosterSize) {
    return `${plural(rosterSize, 'titulaire', 'titulaires')}. Il manque le joker.`;
  }
  if (starterCount === 0) {
    return `Aucun titulaire. Il en faut ${rosterSize}. ${joker}`;
  }
  return `${plural(starterCount, 'titulaire', 'titulaires')} sur ${rosterSize}. ${joker}`;
}

/** Une seule action pour l'écran du week-end. */
export function weekendAction(input: {
  leagueId: string;
  phase: WeekendPhase;
  gameweekId: string;
  draftMode: string;
  lineup: LineupState;
}): WeekendAction {
  const team = `/league/${input.leagueId}/team`;
  const draft = `/league/${input.leagueId}/draft`;
  const market = `/league/${input.leagueId}/market`;
  const gameweek = `/gameweek/${input.gameweekId}`;

  if (input.phase === 'locked') {
    return {
      href: team,
      label: 'Voir l’alignement figé',
      hint: 'Les titulaires et le joker de ce Grand Prix ne bougent plus.',
    };
  }
  if (input.phase === 'live') {
    return {
      href: gameweek,
      label: 'Suivre le Grand Prix',
      hint: 'L’alignement est figé. Les points se jouent maintenant.',
    };
  }
  if (input.phase === 'done') {
    return {
      href: gameweek,
      label: 'Lire les points',
      hint: 'Le Grand Prix est terminé.',
    };
  }
  if (input.lineup.unavailable) {
    return {
      href: team,
      label: 'Poser l’alignement',
      hint: 'L’état de l’alignement n’a pas pu être lu.',
    };
  }
  if (!input.lineup.hasTeam) {
    return {
      href: team,
      label: 'Poser l’alignement',
      hint: 'Ton écurie n’est pas encore créée.',
    };
  }
  if (input.lineup.rosterCount === 0 && input.draftMode === 'exclusive_draft') {
    return {
      href: draft,
      label: 'Entrer au draft',
      hint: 'Le draft constitue l’écurie. L’alignement vient ensuite.',
    };
  }
  if (input.lineup.rosterCount === 0) {
    return {
      href: market,
      label: 'Composer l’écurie',
      hint: 'Choisis tes pilotes, puis pose les titulaires et le joker.',
    };
  }

  const complete = input.lineup.starterCount === input.lineup.rosterSize && input.lineup.hasJoker;
  return {
    href: team,
    label: complete ? 'Revoir l’alignement' : 'Poser l’alignement',
    hint: openLineupHint(input.lineup),
  };
}
