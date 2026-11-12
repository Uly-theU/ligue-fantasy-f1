import { describe, expect, it } from 'vitest';
import { nextGameweekStatus } from '@/lib/gameweek-status';

const saturday = {
  lock: new Date('2026-03-14T14:00:00Z'),
  quali: new Date('2026-03-14T15:00:00Z'),
  race: new Date('2026-03-15T15:00:00Z'),
};

describe('nextGameweekStatus', () => {
  it('reste upcoming avant le lock', () => {
    const status = nextGameweekStatus(
      {
        status: 'upcoming',
        lockTime: saturday.lock,
        qualifyingStart: saturday.quali,
        raceStart: saturday.race,
      },
      new Date('2026-03-14T13:00:00Z'),
    );
    expect(status).toBe('upcoming');
  });

  it('passe locked après le lock et avant les qualifications', () => {
    const status = nextGameweekStatus(
      {
        status: 'upcoming',
        lockTime: saturday.lock,
        qualifyingStart: saturday.quali,
        raceStart: saturday.race,
      },
      new Date('2026-03-14T14:30:00Z'),
    );
    expect(status).toBe('locked');
  });

  it('ne marque pas completed avant la course', () => {
    const status = nextGameweekStatus(
      {
        status: 'live',
        lockTime: saturday.lock,
        qualifyingStart: saturday.quali,
        raceStart: saturday.race,
      },
      new Date('2026-03-15T02:00:00Z'),
    );
    expect(status).not.toBe('completed');
    expect(status).toBe('live');
  });

  it('passe completed trois heures après le départ', () => {
    const status = nextGameweekStatus(
      {
        status: 'live',
        lockTime: saturday.lock,
        qualifyingStart: saturday.quali,
        raceStart: saturday.race,
      },
      new Date('2026-03-15T18:00:00Z'),
    );
    expect(status).toBe('completed');
  });
});
