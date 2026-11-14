import type { User } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';

/** Identifiant stable, unique, d'au plus 30 caractères, dérivé du compte Supabase. */
export function profileUsername(user: { id: string; email?: string | null }): string {
  const local = user.email?.split('@')[0] ?? 'pilote';
  const cleaned = local.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'pilote';
  const suffix = user.id.replace(/-/g, '').slice(0, 8);
  return `${cleaned}${suffix}`.slice(0, 30);
}

/** Vrai si le pseudo a encore la forme fabriquée à la création : local-part nettoyé + 8 hex de l'id. */
export function usernameLooksGenerated(username: string, userId: string): boolean {
  const suffix = userId.replace(/-/g, '').slice(0, 8);
  if (!/^[0-9a-fA-F]{8}$/.test(suffix)) return false;
  if (!username.endsWith(suffix)) return false;
  const prefix = username.slice(0, -suffix.length);
  return prefix.length >= 1 && prefix.length <= 20 && /^[a-z0-9]+$/.test(prefix);
}

const CHOSEN_USERNAME = /^[a-z0-9]{2,30}$/;

/** Pseudo posé par les joueurs de test. Un compte Supabase n'en a pas. */
export function chosenUsername(user: { user_metadata?: Record<string, unknown> | null }): string | null {
  const value = user.user_metadata?.username;
  return typeof value === 'string' && CHOSEN_USERNAME.test(value) ? value : null;
}

function displayNameOf(user: User): string | null {
  const meta = user.user_metadata ?? {};
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) return meta.full_name.trim().slice(0, 50);
  if (typeof meta.display_name === 'string' && meta.display_name.trim()) return meta.display_name.trim().slice(0, 50);
  return null;
}

function avatarOf(user: User): string | null {
  const avatar = user.user_metadata?.avatar_url;
  return typeof avatar === 'string' && avatar.length > 0 ? avatar : null;
}

/**
 * Le trigger Supabase `auth.users → profiles` ne voit pas la base Docker.
 * On crée le profil ici, avec le même id que le compte Supabase.
 * Une mise à jour du pseudo dans l'app n'est pas écrasée.
 */
export async function ensureProfile(user: User): Promise<void> {
  const preferred = chosenUsername(user);
  const username = preferred ?? profileUsername(user);
  const displayName = displayNameOf(user);
  const existing = await prisma.profile.findUnique({
    where: { id: user.id },
    select: { username: true },
  });

  if (!existing) {
    await prisma.profile.create({
      data: {
        id: user.id,
        username,
        display_name: displayName,
        avatar_url: avatarOf(user),
      },
    });
    return;
  }

  if (preferred && preferred !== existing.username && usernameLooksGenerated(existing.username, user.id)) {
    await prisma.profile.update({
      where: { id: user.id },
      data: { username: preferred, display_name: displayName },
    });
  }
}
