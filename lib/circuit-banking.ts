import { pointAt, type Track } from '@/lib/track-path';

/**
 * Relevés publiés. Le sens est celui du virage : l'extérieur est le côté haut.
 * `length` est la longueur du relevé en fraction du tour, d'un bord à l'autre.
 */
export type BankSpec = { turn: number; length: number; degrees: number };

export const CIRCUIT_BANKING: Record<string, BankSpec[]> = {
  // Zandvoort, refait en 2020 : Hugenholtz et Arie Luyendyk, relevés à 18°.
  zandvoort: [
    { turn: 3, length: 0.055, degrees: 18 },
    { turn: 14, length: 0.042, degrees: 18 },
  ],
  // Madring, La Monumental : 548 m, peralte max 24 % soit 13,5°.
  madring: [
    { turn: 12, length: 548 / 5416, degrees: 13.5 },
  ],
};

type CornerAt = { number: number; at: number };

/** Zones de dévers du circuit, calées sur les virages numérotés. Vide si on n'a pas le relevé. */
export function bankingZones(circuitId: string | null | undefined, corners: CornerAt[] | null | undefined): BankSpec[] {
  const spec = circuitId ? CIRCUIT_BANKING[circuitId] : undefined;
  if (!spec || !corners?.length) return [];
  return spec.filter((item) => corners.some((corner) => corner.number === item.turn));
}

/**
 * Pose le dévers sur le tracé. Le profil suit une demi-cosinus : plein au milieu du virage, nul aux bords.
 * Le signe suit le virage, pour que le côté haut soit toujours l'extérieur.
 */
export function bankTrack(track: Track, circuitId: string | null | undefined, corners: CornerAt[] | null | undefined): Track {
  const spec = bankingZones(circuitId, corners);
  if (!spec.length || !corners) return track;
  const zones = spec.flatMap((item) => {
    const corner = corners.find((entry) => entry.number === item.turn);
    if (!corner) return [];
    return [{ at: corner.at, length: item.length, radians: (item.degrees * Math.PI) / 180, sign: turnSign(track, corner.at) }];
  });
  if (!zones.length) return track;
  const bank = track.points.map((point) => {
    const fraction = track.length > 0 ? point.s / track.length : 0;
    let value = 0;
    for (const zone of zones) {
      let gap = Math.abs(fraction - zone.at);
      if (track.closed) gap = Math.min(gap, 1 - gap);
      const half = zone.length / 2;
      if (gap >= half) continue;
      const window = 0.5 * (1 + Math.cos((Math.PI * gap) / half));
      value += zone.sign * zone.radians * window;
    }
    return value;
  });
  return { ...track, bank };
}

/**
 * Signe du dévers. Un cap qui augmente est un virage à droite : l'extérieur est à gauche,
 * donc le dévers est négatif (le côté gauche, latéral négatif, est le côté haut).
 */
function turnSign(track: Track, at: number): number {
  const span = track.length * 0.012;
  const before = pointAt(track, at * track.length - span);
  const after = pointAt(track, at * track.length + span);
  const delta = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
  return delta >= 0 ? -1 : 1;
}

/**
 * Décale un point du profil en travers. `lateral` est sa position avant relevé, positif vers la gauche.
 * On pivote autour du bord intérieur : il reste au sol, l'extérieur monte.
 * `outer` est la demi-largeur du bac, l'axe du relevé.
 */
export function bankOffset(lateral: number, bank: number, outer: number): { lateral: number; y: number } {
  if (Math.abs(bank) < 1e-4 || outer <= 0) return { lateral, y: 0 };
  const sign = Math.sign(bank);
  const sin = Math.sin(Math.abs(bank));
  const cos = Math.cos(Math.abs(bank));
  const inside = -sign * outer;
  const fromInside = (lateral - inside) * sign;
  return {
    y: fromInside * sin,
    lateral: inside + sign * fromInside * cos,
  };
}
