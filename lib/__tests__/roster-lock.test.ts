import { describe, expect, it } from 'vitest';
import {
  gameweeksDueForClockFreeze,
  lineupSnapshotRows,
  rosterBlockedByClock,
  shouldFreezeLineup,
} from '@/lib/lineup';

const lock = new Date('2026-03-14T14:00:00Z');
const at13 = new Date('2026-03-14T13:00:00Z');
const at1430 = new Date('2026-03-14T14:30:00Z');

describe('rosterBlockedByClock', () => {
  it('reste ouvert à 13:00 UTC (lock 14:00, qualifs 15:00, upcoming)', () => {
    expect(rosterBlockedByClock([{ status: 'upcoming', lock_time: lock }], at13)).toBe(false);
  });

  it('fige à 14:30 UTC alors que le statut stocké est encore upcoming', () => {
    expect(rosterBlockedByClock([{ status: 'upcoming', lock_time: lock }], at1430)).toBe(true);
  });

  it('ne bloque pas une saison dont tous les GP sont terminés ou annulés', () => {
    const afterRace = new Date('2026-03-16T12:00:00Z');
    expect(
      rosterBlockedByClock(
        [
          { status: 'completed', lock_time: lock },
          { status: 'cancelled', lock_time: new Date('2026-03-21T14:00:00Z') },
        ],
        afterRace,
      ),
    ).toBe(false);
  });

  it('bloque si un seul GP non terminal a dépassé son lock', () => {
    expect(
      rosterBlockedByClock(
        [
          { status: 'completed', lock_time: lock },
          { status: 'upcoming', lock_time: lock },
        ],
        at1430,
      ),
    ).toBe(true);
  });
});

describe('gameweeksDueForClockFreeze', () => {
  const rows = [
    { id: 'passe', status: 'upcoming', lock_time: lock },
    { id: 'futur', status: 'upcoming', lock_time: new Date('2026-03-21T14:00:00Z') },
    { id: 'deja-locked', status: 'locked', lock_time: lock },
    { id: 'fini', status: 'completed', lock_time: lock },
    { id: 'annule', status: 'cancelled', lock_time: lock },
  ];

  it('ne sélectionne rien avant le lock', () => {
    expect(gameweeksDueForClockFreeze(rows, at13).map((row) => row.id)).toEqual([]);
  });

  it('ne copie que les GP dont le lock est atteint et le statut pas encore locked ou live', () => {
    expect(gameweeksDueForClockFreeze(rows, at1430).map((row) => row.id)).toEqual(['passe']);
  });
});

describe('shouldFreezeLineup', () => {
  it('fige le saut direct upcoming → completed du cron du dimanche', () => {
    expect(shouldFreezeLineup('upcoming', 'completed')).toBe(true);
  });

  it('fige en quittant upcoming ou locked', () => {
    expect(shouldFreezeLineup('upcoming', 'locked')).toBe(true);
    expect(shouldFreezeLineup('locked', 'live')).toBe(true);
    expect(shouldFreezeLineup('locked', 'completed')).toBe(true);
  });

  it('ne refait pas la copie quand le statut ne change pas ou part de live', () => {
    expect(shouldFreezeLineup('upcoming', 'upcoming')).toBe(false);
    expect(shouldFreezeLineup('live', 'completed')).toBe(false);
  });
});

describe('lineupSnapshotRows', () => {
  it('prépare une ligne pour chaque équipe, pas seulement la première', () => {
    const rows = lineupSnapshotRows(
      [
        {
          id: 'equipe-a',
          roster_assignments: [
            { real_entity_id: 'ver', is_starter: true, is_joker: true },
          ],
        },
        {
          id: 'equipe-b',
          roster_assignments: [
            { real_entity_id: 'nor', is_starter: true, is_joker: false },
            { real_entity_id: 'lec', is_starter: false, is_joker: false },
          ],
        },
        { id: 'equipe-vide', roster_assignments: [] },
      ],
      'gp-1',
    );

    expect(rows).toEqual([
      {
        fantasy_team_id: 'equipe-a',
        gameweek_id: 'gp-1',
        real_entity_id: 'ver',
        is_starter: true,
        is_joker: true,
      },
      {
        fantasy_team_id: 'equipe-b',
        gameweek_id: 'gp-1',
        real_entity_id: 'nor',
        is_starter: true,
        is_joker: false,
      },
      {
        fantasy_team_id: 'equipe-b',
        gameweek_id: 'gp-1',
        real_entity_id: 'lec',
        is_starter: false,
        is_joker: false,
      },
    ]);
  });
});
