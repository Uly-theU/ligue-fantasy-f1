import { describe, expect, it } from 'vitest';
import { codeWithRetry } from '@/lib/invite-code';

describe('codeWithRetry', () => {
  it('retire un code déjà pris', () => {
    const draws = ['AAAAAAAA', 'BBBBBBBB'];
    const code = codeWithRetry(() => draws.shift()!, (value) => value === 'AAAAAAAA');
    expect(code).toBe('BBBBBBBB');
  });
});
