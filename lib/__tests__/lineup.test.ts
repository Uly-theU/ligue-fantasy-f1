import { describe, expect, it } from 'vitest';
import { rosterBlockedByClock, rosterEditBlocked, scoringLineup } from '@/lib/lineup';

describe('scoringLineup', () => {
  it('score la copie figée, pas le roster courant', () => {
    const snapshot = [
      { real_entity_id: 'A', is_starter: true, is_joker: false },
      { real_entity_id: 'B', is_starter: true, is_joker: true },
    ];
    const live = [{ real_entity_id: 'C', is_starter: true, is_joker: false }];
    const scored = scoringLineup(snapshot);
    expect(scored.map((driver) => driver.real_entity_id)).toEqual(['A', 'B']);
    expect(scored).not.toEqual(live);
  });
});

describe('rosterEditBlocked', () => {
  it('refuse pendant locked ou live', () => {
    expect(rosterEditBlocked(['locked'])).toBe(true);
    expect(rosterEditBlocked(['upcoming', 'live'])).toBe(true);
  });

  it('autorise quand les GP sont upcoming ou completed', () => {
    expect(rosterEditBlocked(['upcoming', 'completed'])).toBe(false);
  });
});

const lock = new Date('2026-03-14T14:00:00Z');

describe('rosterBlockedByClock', () => {
  it('refuse un GP locked ou live', () => {
    expect(rosterBlockedByClock([{ status: 'locked', lock_time: lock }], new Date('2026-03-14T13:00:00Z'))).toBe(true);
    expect(rosterBlockedByClock([{ status: 'live', lock_time: lock }], new Date('2026-03-14T13:00:00Z'))).toBe(true);
  });

  it('autorise à 13:00 UTC quand le lock est à 14:00 et les qualifs à 15:00', () => {
    expect(
      rosterBlockedByClock([{ status: 'upcoming', lock_time: lock }], new Date('2026-03-14T13:00:00Z')),
    ).toBe(false);
  });

  it('refuse à 14:30 UTC dans le même cas, statut encore upcoming', () => {
    expect(
      rosterBlockedByClock([{ status: 'upcoming', lock_time: lock }], new Date('2026-03-14T14:30:00Z')),
    ).toBe(true);
  });

  it('refuse un autre statut non terminal dont le lock est atteint', () => {
    expect(
      rosterBlockedByClock([{ status: 'scoring', lock_time: lock }], new Date('2026-03-14T14:30:00Z')),
    ).toBe(true);
  });

  it('autorise completed et cancelled même si le lock est passé', () => {
    const later = new Date('2026-03-20T18:00:00Z');
    expect(
      rosterBlockedByClock(
        [
          { status: 'completed', lock_time: lock },
          { status: 'cancelled', lock_time: lock },
        ],
        later,
      ),
    ).toBe(false);
  });

  it('bloque à l’instant exact du lock', () => {
    expect(rosterBlockedByClock([{ status: 'upcoming', lock_time: lock }], lock)).toBe(true);
  });
});
