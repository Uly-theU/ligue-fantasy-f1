import { afterEach, describe, expect, it } from 'vitest';
import {
  BETA_PLAYERS,
  betaPlayerCookie,
  betaPlayerFromCookie,
  clearBetaPlayerCookie,
  isLoopbackHost,
  localAuthUser,
  localBypassForHost,
} from '@/lib/local-auth';

describe('accès local sans connexion', () => {
  afterEach(() => {
    delete process.env.LOCAL_AUTH_BYPASS;
  });

  it('reconnaît la machine locale', () => {
    expect(isLoopbackHost('localhost:3000')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('[::1]:3000')).toBe(true);
    expect(isLoopbackHost('ligue-fantasy-f1.vercel.app')).toBe(false);
  });

  it('n’ouvre le passage que sur la machine locale, et seulement si on le demande', () => {
    expect(localBypassForHost('localhost:3000')).toBe(false);
    process.env.LOCAL_AUTH_BYPASS = '1';
    expect(localBypassForHost('localhost:3000')).toBe(true);
    expect(localBypassForHost('ligue-fantasy-f1.vercel.app')).toBe(false);
  });
});

describe('joueurs de test', () => {
  it('en propose cinq, avec des identifiants et des pseudos distincts', () => {
    expect(BETA_PLAYERS).toHaveLength(5);
    expect(new Set(BETA_PLAYERS.map((player) => player.id)).size).toBe(5);
    expect(new Set(BETA_PLAYERS.map((player) => player.username)).size).toBe(5);
  });

  it('retrouve le joueur choisi dans le cookie, et refuse un autre identifiant', () => {
    const ines = BETA_PLAYERS[2];
    expect(betaPlayerFromCookie(`theme=dark; ${betaPlayerCookie(ines.id)}`)?.username).toBe('ines');
    expect(betaPlayerFromCookie('beta-player=11111111-2222-4333-8444-555555555555')).toBeNull();
    expect(betaPlayerFromCookie(null)).toBeNull();
    expect(betaPlayerFromCookie(clearBetaPlayerCookie())).toBeNull();
  });

  it('fabrique la session du joueur choisi', () => {
    const user = localAuthUser(BETA_PLAYERS[4]);
    expect(user.id).toBe(BETA_PLAYERS[4].id);
    expect(user.email).toBe('lea@beta.local');
    expect(user.user_metadata.display_name).toBe('Léa Bernard');
  });
});
