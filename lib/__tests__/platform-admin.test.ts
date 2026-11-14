import { describe, expect, it } from 'vitest';
import { isPlatformAdmin } from '@/lib/platform-admin';

describe('isPlatformAdmin', () => {
  it('accepte un id listé', () => {
    expect(isPlatformAdmin('admin-1', 'admin-1, admin-2')).toBe(true);
  });

  it('refuse un membre et un owner absents de la liste', () => {
    expect(isPlatformAdmin('owner-1', 'admin-1')).toBe(false);
    expect(isPlatformAdmin('member-1', '')).toBe(false);
  });
});
