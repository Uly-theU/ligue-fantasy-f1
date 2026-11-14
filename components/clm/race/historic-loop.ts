import * as THREE from 'three';
import { surroundingsFor } from '@/lib/circuit-surroundings';
import { nearestCenter, paintClearance } from '@/lib/track-clearance';
import { paintedHalfAt, pointAt } from '@/lib/track-path';
import { CROSSING_ANGLE } from './road';
import { insideGrid, mod, sampleGround, type RaceCtx } from './terrain';

type OvalFrame = {
  x: number;
  y: number;
  ahead: number;
  nx: number;
  nz: number;
  turn: number;
  bank: number;
  s: number;
  dist: number;
  delta: number;
  painted: number;
  shared: boolean;
};

type OvalEdge = {
  lx: number;
  ly: number;
  lz: number;
  rx: number;
  ry: number;
  rz: number;
};

type Ribbon = { positions: number[]; indices: number[] };

export function resampleLoop(loop: number[][], step: number): Array<{ x: number; y: number }> {
  if (loop.length < 2) return [];
  const points = loop.map(([x, y]) => ({ x, y }));
  const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < step;
  const ring = closed ? points.slice(0, -1) : points;
  if (ring.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < ring.length; i += 1) cum.push(cum[i - 1] + Math.hypot(ring[i].x - ring[i - 1].x, ring[i].y - ring[i - 1].y));
  if (closed) cum.push(cum[cum.length - 1] + Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y));
  const length = cum[cum.length - 1];
  const count = Math.max(8, Math.round(length / step));
  const out: Array<{ x: number; y: number }> = [];
  let seg = 0;
  const spans = closed ? count : count + 1;
  for (let i = 0; i < (closed ? count : Math.min(spans, count)); i += 1) {
    const target = (i / count) * length;
    while (seg < cum.length - 2 && cum[seg + 1] < target - 1e-6) seg += 1;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-6 ? (target - cum[seg]) / span : 0;
    const a = ring[seg % ring.length];
    const b = ring[(seg + 1) % ring.length];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Creux lisse sous l'ancien anneau : plein au croisement, nul aux lèvres. */
export function bowl(ctx: RaceCtx, s: number): number {
  if (!ctx.underS.length) return 0;
  const depth = ctx.half * 0.85;
  const width = 120 * ctx.meter;
  let drop = 0;
  for (const at of ctx.underS) {
    let along = Math.abs(s - at);
    if (ctx.track.closed) along = Math.min(along, ctx.track.length - along);
    if (along >= width) continue;
    const t = along / width;
    drop = Math.min(drop, -depth * 0.5 * (1 + Math.cos(Math.PI * t)));
  }
  return drop;
}

/** Abscisses où l'ancien anneau coupe franchement la piste actuelle, lues sur les mêmes trames que le tablier. */
export function findUnderpasses(ctx: RaceCtx): number[] {
  const mapped = surroundingsFor(ctx.circuitId);
  if (!mapped) return [];
  const found: number[] = [];
  for (const loop of mapped.loops) {
    const samples = resampleLoop(loop, Math.max(ctx.half * 0.35, 1.2));
    if (samples.length < 8) continue;
    const frames = ovalFrames(ctx, samples);
    const count = frames.length;
    const seen = new Array<boolean>(count).fill(false);
    for (let start = 0; start < count; start += 1) {
      if (seen[start] || !crossesRoad(ctx, frames[start])) continue;
      let best = frames[start];
      let cursor = start;
      while (!seen[cursor] && crossesRoad(ctx, frames[cursor])) {
        seen[cursor] = true;
        if (frames[cursor].dist < best.dist) best = frames[cursor];
        cursor = (cursor + 1) % count;
        if (cursor === start) break;
      }
      found.push(best.s);
    }
  }
  return found;
}

/**
 * Ancien anneau, en béton. La ligne droite partagée avec le tracé actuel n'est pas redessinée.
 * Là où l'anneau coupe la piste, il reste au niveau du sol : c'est la piste actuelle qui descend dessous.
 * Le dévers suit le rayon lissé des deux courbes, jusqu'à 38°, pour que le tablier reste une bande.
 */
export function buildHistoric(ctx: RaceCtx, loops: number[][][]) {
  const halfW = 6 * ctx.meter;
  for (const loop of loops) {
    const samples = resampleLoop(loop, Math.max(ctx.half * 0.35, 1.2));
    const count = samples.length;
    if (count < 8) continue;
    const info = ovalFrames(ctx, samples);
    const bridged = info.map((frame) => crossesRoad(ctx, frame));
    const outsideLeft = info.reduce((sum, frame) => sum + frame.turn, 0) < 0;

    const deck: Ribbon = { positions: [], indices: [] };
    const lip: Ribbon = { positions: [], indices: [] };
    const skirt: Ribbon = { positions: [], indices: [] };
    let previous: OvalEdge | null = null;
    let first: OvalEdge | null = null;
    for (let i = 0; i < count; i += 1) {
      if (info[i].shared) {
        previous = null;
        continue;
      }
      const edge = ovalEdge(ctx, info[i], halfW, bridged[i], outsideLeft);
      if (!edge) {
        previous = null;
        continue;
      }
      if (!first) first = edge;
      linkOval(ctx, deck, lip, skirt, previous, edge, halfW * 14);
      previous = edge;
    }
    linkOval(ctx, deck, lip, skirt, previous, first, halfW * 14);
    addConcrete(ctx, deck.positions, deck.indices, '#7a756c');
    addConcrete(ctx, lip.positions, lip.indices, '#2c2a28');
    addConcrete(ctx, skirt.positions, skirt.indices, '#5e5952');
  }
}

/** L'anneau coupe franchement la piste actuelle ici : le tablier passe au-dessus, la piste dans la cuvette. */
function crossesRoad(ctx: RaceCtx, frame: OvalFrame): boolean {
  return frame.delta > CROSSING_ANGLE && frame.dist < frame.painted + 18 * ctx.meter;
}

/**
 * Cap et dévers lissés. Un angle OSM brut, sur un pas de quelques mètres,
 * donnerait un pic de 38° : une pointe, pas une courbe relevée.
 */
function ovalFrames(ctx: RaceCtx, samples: Array<{ x: number; y: number }>): OvalFrame[] {
  const count = samples.length;
  const cum = [0];
  for (let i = 1; i < count; i += 1) {
    cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
  }
  const gap = Math.hypot(samples[0].x - samples[count - 1].x, samples[0].y - samples[count - 1].y);
  const closed = gap < Math.max(ctx.half * 0.35, 1.2) * 1.5;
  const total = cum[count - 1] + (closed ? gap : 0);
  const reach = 90 * ctx.meter;
  const pointAtDist = (distance: number) => loopPoint(samples, cum, total, closed, distance);
  const headings = samples.map((_, index) => {
    const distance = cum[index];
    const back = closed ? reach : Math.min(reach, distance);
    const fore = closed ? reach : Math.min(reach, total - distance);
    const behind = pointAtDist(distance - back);
    const ahead = pointAtDist(distance + fore);
    return Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
  });
  const nearest = (distance: number) => {
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < count; i += 1) {
      let delta = Math.abs(cum[i] - distance);
      if (closed) delta = Math.min(delta, total - delta);
      if (delta >= bestDelta) continue;
      bestDelta = delta;
      best = i;
    }
    return best;
  };
  const raw = samples.map((_, index) => {
    const distance = cum[index];
    const behind = nearest(closed ? mod(distance - reach, total) : Math.max(0, distance - reach));
    const ahead = nearest(closed ? mod(distance + reach, total) : Math.min(total, distance + reach));
    let arc = cum[ahead] - cum[behind];
    if (closed && arc < 0) arc += total;
    if (!closed) arc = Math.abs(arc);
    const turn = Math.atan2(Math.sin(headings[ahead] - headings[behind]), Math.cos(headings[ahead] - headings[behind]));
    const radiusM = arc > 1e-3 ? (arc / Math.max(Math.abs(turn), 1e-4)) / Math.max(ctx.meter, 1e-6) : 1e6;
    const bank = radiusM < 640 ? ((38 * Math.PI) / 180) * THREE.MathUtils.clamp((640 - radiusM) / 300, 0, 1) : 0;
    return { turn, bank };
  });
  const blend = 45 * ctx.meter;
  return samples.map((curr, index) => {
    let sum = 0;
    let weight = 0;
    for (let other = 0; other < count; other += 1) {
      let delta = Math.abs(cum[other] - cum[index]);
      if (closed) delta = Math.min(delta, total - delta);
      if (delta > blend) continue;
      const influence = 1 - delta / blend;
      sum += raw[other].bank * influence;
      weight += influence;
    }
    const turn = raw[index].turn;
    const ahead = headings[index];
    const near = nearestCenter(ctx.track, curr.x, curr.y);
    const spot = pointAt(ctx.track, near.s);
    let delta = Math.abs(ahead - spot.angle) % Math.PI;
    if (delta > Math.PI / 2) delta = Math.PI - delta;
    const painted = paintedHalfAt(ctx.track, near.s);
    return {
      x: curr.x,
      y: curr.y,
      ahead,
      nx: -Math.sin(ahead),
      nz: Math.cos(ahead),
      turn,
      bank: weight > 0 ? sum / weight : 0,
      s: near.s,
      dist: near.distance,
      delta,
      painted,
      shared: delta < 0.4 && near.distance < painted,
    };
  });
}

/**
 * Décale le ruban hors de l'asphalte, sauf au croisement : là il reste en travers,
 * à l'altitude d'origine, pendant que la piste actuelle passe dans la cuvette.
 */
function ovalEdge(ctx: RaceCtx, frame: OvalFrame, halfW: number, overRoad: boolean, outsideLeft: boolean): OvalEdge | null {
  const awayX = frame.x - pointAt(ctx.track, frame.s).x;
  const awayY = frame.y - pointAt(ctx.track, frame.s).y;
  const away = Math.hypot(awayX, awayY) || 1;
  let shove = 0;
  let cx = frame.x;
  let cy = frame.y;
  if (overRoad) {
    const spot = pointAt(ctx.track, frame.s);
    cx = spot.x;
    cy = spot.y;
  } else {
    for (let step = 0; step < 10; step += 1) {
      cx = frame.x + (awayX / away) * shove;
      cy = frame.y + (awayY / away) * shove;
      const leftClear = paintClearance(ctx.track, cx + frame.nx * halfW, cy + frame.nz * halfW);
      const rightClear = paintClearance(ctx.track, cx - frame.nx * halfW, cy - frame.nz * halfW);
      if (paintClearance(ctx.track, cx, cy) > 0 && leftClear > 0 && rightClear > 0) break;
      shove += ctx.half * 0.2;
    }
    if (paintClearance(ctx.track, cx, cy) < 0) return null;
  }
  const dipped = insideGrid(ctx, cx, cy) ? sampleGround(ctx, cx, cy) : 0;
  const hold = THREE.MathUtils.clamp(Math.abs(bowl(ctx, frame.s)) / (ctx.half * 0.12), 0, 1);
  const ground = dipped * (1 - hold) + ctx.groundAt(frame.s) * hold;
  const rise = Math.sin(frame.bank) * halfW * 2;
  const base = ground + Math.max(ctx.half * 0.08, ctx.meter * 0.8);
  return {
    lx: cx + frame.nx * halfW,
    ly: base + (outsideLeft ? rise : 0),
    lz: cy + frame.nz * halfW,
    rx: cx - frame.nx * halfW,
    ry: base + (outsideLeft ? 0 : rise),
    rz: cy - frame.nz * halfW,
  };
}

/** Tablier en trois bandes (bord, béton, bord), plus le chant et le dessous. */
function linkOval(ctx: RaceCtx, deck: Ribbon, lip: Ribbon, skirt: Ribbon, previous: OvalEdge | null, edge: OvalEdge | null, limit: number) {
  if (!previous || !edge) return;
  if (Math.hypot(previous.lx - edge.lx, previous.lz - edge.lz) > limit) return;
  const band = 0.08;
  ovalQuad(lip, sliceEdge(previous, 0, band), sliceEdge(edge, 0, band));
  ovalQuad(deck, sliceEdge(previous, band, 1 - band), sliceEdge(edge, band, 1 - band));
  ovalQuad(lip, sliceEdge(previous, 1 - band, 1), sliceEdge(edge, 1 - band, 1));
  const thickness = Math.max(ctx.half * 0.03, ctx.meter * 0.25);
  const lower = (side: OvalEdge): OvalEdge => ({
    lx: side.lx, ly: side.ly - thickness, lz: side.lz,
    rx: side.rx, ry: side.ry - thickness, rz: side.rz,
  });
  const prevLow = lower(previous);
  const edgeLow = lower(edge);
  ovalQuad(skirt, edgeLow, prevLow);
  ovalQuad(skirt,
    { lx: previous.lx, ly: previous.ly, lz: previous.lz, rx: prevLow.lx, ry: prevLow.ly, rz: prevLow.lz },
    { lx: edge.lx, ly: edge.ly, lz: edge.lz, rx: edgeLow.lx, ry: edgeLow.ly, rz: edgeLow.lz },
  );
  ovalQuad(skirt,
    { lx: prevLow.rx, ly: prevLow.ry, lz: prevLow.rz, rx: previous.rx, ry: previous.ry, rz: previous.rz },
    { lx: edgeLow.rx, ly: edgeLow.ry, lz: edgeLow.rz, rx: edge.rx, ry: edge.ry, rz: edge.rz },
  );
}

function sliceEdge(edge: OvalEdge, from: number, to: number): OvalEdge {
  const at = (t: number) => ({
    x: edge.lx + (edge.rx - edge.lx) * t,
    y: edge.ly + (edge.ry - edge.ly) * t,
    z: edge.lz + (edge.rz - edge.lz) * t,
  });
  const start = at(from);
  const end = at(to);
  return { lx: start.x, ly: start.y, lz: start.z, rx: end.x, ry: end.y, rz: end.z };
}

/** Deux triangles qui ferment le rectangle gauche-droite, sans laisser un seul côté. */
function ovalQuad(ribbon: Ribbon, previous: OvalEdge, edge: OvalEdge) {
  const base = ribbon.positions.length / 3;
  ribbon.positions.push(
    previous.lx, previous.ly, previous.lz,
    previous.rx, previous.ry, previous.rz,
    edge.lx, edge.ly, edge.lz,
    edge.rx, edge.ry, edge.rz,
  );
  ribbon.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
}

function addConcrete(ctx: RaceCtx, positions: number[], indices: number[], color: string) {
  if (positions.length < 9) return;
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, ctx.keep(new THREE.MeshStandardMaterial({
    color,
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  })));
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  ctx.scene.add(mesh);
}

function loopPoint(
  samples: Array<{ x: number; y: number }>,
  cum: number[],
  total: number,
  closed: boolean,
  distance: number,
): { x: number; y: number } {
  const count = samples.length;
  let d = distance;
  if (closed) d = mod(d, total);
  else d = Math.max(0, Math.min(total, d));
  if (closed && d >= cum[count - 1]) {
    const span = total - cum[count - 1];
    const t = span > 1e-6 ? (d - cum[count - 1]) / span : 0;
    const a = samples[count - 1];
    const b = samples[0];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  let seg = 0;
  while (seg < count - 2 && cum[seg + 1] < d) seg += 1;
  const span = cum[seg + 1] - cum[seg];
  const t = span > 1e-6 ? (d - cum[seg]) / span : 0;
  const a = samples[seg];
  const b = samples[seg + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
