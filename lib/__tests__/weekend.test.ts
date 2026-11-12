import { describe, expect, it } from 'vitest';
import { formatRemaining } from '@/lib/lock-label';
import { pickWeekend, rosterSizeFromSettings, weekendAction, weekendPhase, type LineupState, type WeekendGameweek } from '@/lib/weekend';

const emptyLineup: LineupState = {
  hasTeam: true,
  rosterCount: 0,
  starterCount: 0,
  rosterSize: 5,
  hasJoker: false,
  unavailable: false,
};

function gp(round: number, race: string, extra: Partial<WeekendGameweek> = {}): WeekendGameweek {
  return {
    id: `gw-${round}`,
    name: `GP ${round}`,
    circuit: 'Circuit',
    country: 'AU',
    race_date: race,
    qualifying_date: null,
    lock_time: null,
    status: 'upcoming',
    round_number: round,
    ...extra,
  };
}

describe('formatRemaining', () => {
  it('compte les jours au-delà de deux journées', () => {
    const now = new Date('2026-11-04T12:00:00Z');
    const lock = new Date('2026-11-07T15:00:00Z');
    expect(formatRemaining(lock, now)).toBe('3 j 3 h');
  });
});

describe('pickWeekend', () => {
  const calendar = [
    gp(20, '2026-10-25T15:00:00Z', { qualifying_date: '2026-10-24T15:00:00Z', lock_time: '2026-10-24T14:00:00Z' }),
    gp(21, '2026-11-08T15:00:00Z', { qualifying_date: '2026-11-07T15:00:00Z', lock_time: '2026-11-07T14:00:00Z' }),
    gp(22, '2026-11-22T15:00:00Z', { qualifying_date: '2026-11-21T15:00:00Z', lock_time: '2026-11-21T14:00:00Z' }),
  ];

  it('choisit le prochain Grand Prix encore ouvert', () => {
    const picked = pickWeekend(calendar, new Date('2026-11-04T12:00:00Z'));
    expect(picked?.round_number).toBe(21);
    expect(weekendPhase(picked!, new Date('2026-11-04T12:00:00Z'))).toBe('open');
  });

  it('reste sur le Grand Prix verrouillé, puis sur celui en piste', () => {
    expect(weekendPhase(calendar[1], new Date('2026-11-07T14:30:00Z'))).toBe('locked');
    expect(weekendPhase(calendar[1], new Date('2026-11-07T15:30:00Z'))).toBe('live');
    expect(pickWeekend(calendar, new Date('2026-11-07T15:30:00Z'))?.round_number).toBe(21);
  });

  it('passe au suivant une fois la fenêtre de course close', () => {
    expect(pickWeekend(calendar, new Date('2026-11-08T19:00:00Z'))?.round_number).toBe(22);
  });

  it('ignore un Grand Prix annulé', () => {
    const picked = pickWeekend(
      [gp(21, '2026-11-08T15:00:00Z', { status: 'cancelled' }), calendar[2]],
      new Date('2026-11-04T12:00:00Z'),
    );
    expect(picked?.round_number).toBe(22);
  });
});

describe('weekendAction', () => {
  const base = {
    leagueId: 'ligue',
    phase: 'open' as const,
    gameweekId: 'gw',
    draftMode: 'salary_cap',
    lineup: emptyLineup,
  };

  it('envoie vers le marché tant que l’écurie est vide', () => {
    expect(weekendAction(base)).toMatchObject({
      href: '/league/ligue/market',
      label: 'Composer l’écurie',
    });
  });

  it('envoie au draft quand le mode exclusif n’a encore aucun pilote', () => {
    expect(weekendAction({ ...base, draftMode: 'exclusive_draft' }).label).toBe('Entrer au draft');
  });

  it('demande l’alignement tant que la grille ou le joker manque', () => {
    const action = weekendAction({
      ...base,
      lineup: { ...emptyLineup, rosterCount: 7, starterCount: 3, hasJoker: false },
    });
    expect(action).toMatchObject({ href: '/league/ligue/team', label: 'Poser l’alignement' });
    expect(action.hint).toContain('3 titulaires sur 5');
  });

  it('propose de revoir une grille déjà complète', () => {
    expect(
      weekendAction({
        ...base,
        lineup: { ...emptyLineup, rosterCount: 7, starterCount: 5, hasJoker: true },
      }).label,
    ).toBe('Revoir l’alignement');
  });

  it('fige l’action après le verrou et ouvre la course ensuite', () => {
    expect(weekendAction({ ...base, phase: 'locked' }).label).toBe('Voir l’alignement figé');
    expect(weekendAction({ ...base, phase: 'live' }).href).toBe('/gameweek/gw');
    expect(weekendAction({ ...base, phase: 'done' }).label).toBe('Lire les points');
  });
});

describe('rosterSizeFromSettings', () => {
  it('retombe sur 5 si le réglage est absent', () => {
    expect(rosterSizeFromSettings({})).toBe(5);
    expect(rosterSizeFromSettings({ roster_size: 4 })).toBe(4);
  });
});
