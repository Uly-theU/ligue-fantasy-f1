export function formatRemaining(lock: Date, now: Date): string {
  const totalMinutes = Math.max(1, Math.floor((lock.getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 48) {
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;
    return restHours === 0 ? `${days} j` : `${days} j ${restHours} h`;
  }
  if (hours >= 1) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

/** Libellé du verrou : décompte, déjà passé, ou heure absente. */
export function lockTimeLabel(lockTime: string | null, now: Date): { status: string; local: string | null } {
  if (!lockTime) return { status: 'Heure de verrou non définie', local: null };
  const lock = new Date(lockTime);
  if (Number.isNaN(lock.getTime())) return { status: 'Heure de verrou non définie', local: null };
  const localDate = lock.toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const zone = new Intl.DateTimeFormat('fr-FR', { timeZoneName: 'short' })
    .formatToParts(lock)
    .find((part) => part.type === 'timeZoneName')?.value;
  const local = zone ? `${localDate} ${zone}` : localDate;
  if (lock.getTime() <= now.getTime()) return { status: 'Verrouillé', local };
  return { status: `Verrou dans ${formatRemaining(lock, now)}`, local };
}
