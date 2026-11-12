import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/safe-redirect';

describe('safeRedirectPath', () => {
  it('garde un chemin interne', () => {
    expect(safeRedirectPath('/league/abc')).toBe('/league/abc');
  });

  it('refuse une URL protocol-relative', () => {
    expect(safeRedirectPath('//exemple.test')).toBe('/dashboard');
    expect(safeRedirectPath('/\\exemple.test')).toBe('/dashboard');
  });

  it('décode avant de contrôler', () => {
    expect(safeRedirectPath('%2F%2Fexemple.test')).toBe('/dashboard');
  });
});
