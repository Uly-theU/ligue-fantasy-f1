/** Vrai seulement si le bearer est exactement CRON_SECRET, secret non vide. */
export function bearerMatches(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const prefix = 'Bearer ';
  if (!authorization?.startsWith(prefix)) return false;
  const token = authorization.slice(prefix.length);
  return constantTimeEqual(token, secret);
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i]! ^ right[i]!;
  return diff === 0;
}
