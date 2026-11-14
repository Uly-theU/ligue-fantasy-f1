import { describe, expect, it } from 'vitest';
import { bearerMatches } from '@/lib/cron-auth';

describe('bearerMatches', () => {
  it('accepte le secret exact', () => {
    expect(bearerMatches('Bearer local-test-secret', 'local-test-secret')).toBe(true);
  });

  it('refuse un secret vide', () => {
    expect(bearerMatches('Bearer ', '')).toBe(false);
    expect(bearerMatches('Bearer secret', undefined)).toBe(false);
  });

  it('refuse un bearer absent ou faux', () => {
    expect(bearerMatches(null, 'local-test-secret')).toBe(false);
    expect(bearerMatches('Bearer other', 'local-test-secret')).toBe(false);
  });
});
