import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function drawCode(length: number, bytes: Uint8Array = randomBytes(length)): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

export function codeWithRetry(draw: () => string, taken: (code: string) => boolean, maxTries = 5): string {
  let last = '';
  for (let i = 0; i < maxTries; i++) {
    last = draw();
    if (!taken(last)) return last;
  }
  throw new Error('CODE_COLLISION');
}
