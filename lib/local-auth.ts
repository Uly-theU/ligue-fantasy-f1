import type { User } from '@supabase/supabase-js';

/** Joueurs de test. Ids stables : les ligues locales survivent à un redémarrage. */
export const BETA_PLAYERS = [
  { id: '00000000-0000-4000-8000-000000000001', username: 'camille', displayName: 'Camille Morel', email: 'camille@beta.local' },
  { id: '00000000-0000-4000-8000-000000000002', username: 'nassim', displayName: 'Nassim Belkacem', email: 'nassim@beta.local' },
  { id: '00000000-0000-4000-8000-000000000003', username: 'ines', displayName: 'Inès Laurent', email: 'ines@beta.local' },
  { id: '00000000-0000-4000-8000-000000000004', username: 'hugo', displayName: 'Hugo Petit', email: 'hugo@beta.local' },
  { id: '00000000-0000-4000-8000-000000000005', username: 'lea', displayName: 'Léa Bernard', email: 'lea@beta.local' },
] as const;

export type BetaPlayer = (typeof BETA_PLAYERS)[number];

/** Premier joueur de test. Conservé pour les données déjà créées en local. */
export const LOCAL_AUTH_USER_ID = BETA_PLAYERS[0].id;

export const BETA_PLAYER_COOKIE = 'beta-player';

export function isLoopbackHost(host: string | null | undefined): boolean {
  if (!host) return false;
  let hostname = host.trim().toLowerCase();
  if (hostname.startsWith('[')) {
    const end = hostname.indexOf(']');
    hostname = end === -1 ? hostname : hostname.slice(1, end);
  } else {
    hostname = hostname.split(':')[0] ?? hostname;
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function localBypassForHost(host: string | null | undefined): boolean {
  return process.env.LOCAL_AUTH_BYPASS === '1' && isLoopbackHost(host);
}

export function betaPlayerById(id: string | null | undefined): BetaPlayer | null {
  if (!id) return null;
  return BETA_PLAYERS.find((player) => player.id === id) ?? null;
}

/** N'accepte qu'un des cinq ids. Un autre identifiant ne devient pas une session. */
export function betaPlayerFromCookie(cookieHeader: string | null | undefined): BetaPlayer | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1 || trimmed.slice(0, eq) !== BETA_PLAYER_COOKIE) continue;
    let value = trimmed.slice(eq + 1);
    try {
      value = decodeURIComponent(value);
    } catch {
      return null;
    }
    return betaPlayerById(value);
  }
  return null;
}

export function betaPlayerCookie(id: string): string {
  return `${BETA_PLAYER_COOKIE}=${id}; Path=/; SameSite=Lax; Max-Age=31536000`;
}

export function clearBetaPlayerCookie(): string {
  return `${BETA_PLAYER_COOKIE}=; Path=/; Max-Age=0`;
}

export function localAuthUser(player: BetaPlayer = BETA_PLAYERS[0]): User {
  return {
    id: player.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: player.email,
    app_metadata: {},
    user_metadata: { display_name: player.displayName, username: player.username },
    created_at: '2026-01-01T00:00:00.000Z',
  } as User;
}

