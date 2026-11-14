/** Ids séparés par des virgules dans ADMIN_USER_IDS. Un owner de ligue n'est pas admin. */
export function isPlatformAdmin(userId: string | undefined, adminUserIds = process.env.ADMIN_USER_IDS): boolean {
  if (!userId) return false;
  const ids = (adminUserIds ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return ids.includes(userId);
}
