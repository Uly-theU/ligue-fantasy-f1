/** Superposition de deux boucles fermées (tracé de référence → dessin F1DB), partagée par les scripts de construction. */

export type Pt = { x: number; y: number };

export function loopLength(points: Pt[]): number {
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    total += Math.hypot(next.x - points[i].x, next.y - points[i].y);
  }
  return total;
}

/** Rééchantillonne une boucle fermée en `count` points équidistants. */
export function resample(points: Pt[], count: number): Pt[] {
  const total = loopLength(points);
  const out: Pt[] = [];
  let index = 0;
  let walked = 0;
  for (let k = 0; k < count; k += 1) {
    const target = (k / count) * total;
    while (true) {
      const a = points[index % points.length];
      const b = points[(index + 1) % points.length];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      if (walked + seg >= target || index > points.length * 2) {
        const t = seg > 0 ? (target - walked) / seg : 0;
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        break;
      }
      walked += seg;
      index += 1;
    }
  }
  return out;
}

/**
 * Cherche le décalage, le sens et l'éventuel miroir qui superposent le mieux les deux boucles
 * (similitude au moindre carré : rotation + échelle + translation).
 * `place` envoie un point du repère de `geo` dans celui de `svg`.
 */
export function align(geo: Pt[], svg: Pt[]) {
  const n = geo.length;
  const centroid = (pts: Pt[]) => ({
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  });
  const svgCenter = centroid(svg);
  const q = svg.map((p) => ({ x: p.x - svgCenter.x, y: p.y - svgCenter.y }));
  const qq = q.reduce((s, p) => s + p.x * p.x + p.y * p.y, 0);
  let best = { residual: Infinity, shift: 0, reversed: false, mirrored: false, kr: 1, ki: 0, cx: 0, cy: 0 };
  for (const mirrored of [false, true]) {
    const flipped = geo.map((pt) => ({ x: pt.x, y: mirrored ? -pt.y : pt.y }));
    const geoCenter = centroid(flipped);
    const p = flipped.map((pt) => ({ x: pt.x - geoCenter.x, y: pt.y - geoCenter.y }));
    const pp = p.reduce((s, pt) => s + pt.x * pt.x + pt.y * pt.y, 0);
    for (const reversed of [false, true]) {
      for (let shift = 0; shift < n; shift += 1) {
        let re = 0;
        let im = 0;
        for (let i = 0; i < n; i += 1) {
          const g = p[mod(reversed ? shift - i : shift + i, n)];
          const s = q[i];
          re += g.x * s.x + g.y * s.y;
          im += g.x * s.y - g.y * s.x;
        }
        const residual = 1 - (re * re + im * im) / (pp * qq);
        if (residual < best.residual) {
          best = { residual, shift, reversed, mirrored, kr: re / pp, ki: im / pp, cx: geoCenter.x, cy: geoCenter.y };
        }
      }
    }
  }
  const { kr, ki, cx, cy, mirrored } = best;
  return {
    residual: best.residual,
    shift: best.shift,
    reversed: best.reversed,
    mirrored,
    place(pt: Pt): Pt {
      const gx = pt.x - cx;
      const gy = (mirrored ? -pt.y : pt.y) - cy;
      return { x: svgCenter.x + kr * gx - ki * gy, y: svgCenter.y + kr * gy + ki * gx };
    },
  };
}

export function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}
