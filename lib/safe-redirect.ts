const FALLBACK = '/dashboard';

/** Chemin interne à un seul slash initial. Tout le reste revient au dashboard. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return FALLBACK;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return FALLBACK;
  }

  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return FALLBACK;
  }
  if (decoded.includes('\\') || decoded.includes('://')) return FALLBACK;
  return decoded;
}
