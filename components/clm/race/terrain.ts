import * as THREE from 'three';
import type { CircuitBiome } from '@/lib/circuit-biome';
import type { ElevationSample } from '@/lib/grade';
import { pointAt, type Track } from '@/lib/track-path';
import { groundTexture } from './textures';

export type Keep = <T extends { dispose: () => void }>(item: T) => T;

/** État partagé que les modules lisent pendant la construction et le rendu. */
export type RaceCtx = {
  scene: THREE.Scene;
  track: Track;
  circuitId: string | null;
  biome: CircuitBiome;
  half: number;
  meter: number;
  scale: number;
  wheelRadius: number;
  top: number;
  span: number;
  midX: number;
  midZ: number;
  midY: number;
  roadLift: number;
  groundAt: (s: number) => number;
  underS: number[];
  reliefAt: (s: number) => number;
  surfaceAt: (s: number) => number;
  cols: number;
  rows: number;
  heights: Float32Array;
  originX: number;
  originZ: number;
  stepX: number;
  stepZ: number;
  keep: Keep;
  fogClear: THREE.Color;
  fogOff: THREE.Color;
};

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/** Pente maximale affichée : le relief est exagéré pour se lire, sans faire de Spa un mur. */
const MAX_VISUAL_GRADE = 0.18;

export function smooth(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function mod(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

export function boundsOf(track: Track): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of track.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

export function buildRelief(track: Track, elevation: ElevationSample[] | undefined, metersPerUnit: number, span: number) {
  const nodes = (elevation ?? [])
    .filter((sample) => Number.isFinite(sample.s) && Number.isFinite(sample.z))
    .map((sample) => ({ s: track.closed ? mod(sample.s, track.length) : sample.s, z: sample.z }))
    .sort((a, b) => a.s - b.s);
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const node of nodes) {
    minZ = Math.min(minZ, node.z);
    maxZ = Math.max(maxZ, node.z);
  }
  if (!Number.isFinite(minZ)) {
    minZ = 0;
    maxZ = 0;
  }
  const raw = metersPerUnit > 0 ? (maxZ - minZ) / metersPerUnit : 0;
  const steepest = steepestGrade(nodes, track, metersPerUnit);
  const gentle = steepest > 0 ? Math.max(1, MAX_VISUAL_GRADE / steepest) : 3.2;
  const gain = raw > 0.25 ? THREE.MathUtils.clamp((span * 0.1) / raw, 1, Math.min(3.2, gentle)) : 1;
  const scale = metersPerUnit > 0 ? gain / metersPerUnit : 0;
  const at = (s: number) => (heightOf(nodes, s, track.length, track.closed) - minZ) * scale;
  return { at };
}

/** Pente réelle la plus forte, mesurée sur 60 m pour ne pas lire le bruit du relevé. */
function steepestGrade(nodes: Array<{ s: number; z: number }>, track: Track, metersPerUnit: number): number {
  if (nodes.length < 2 || metersPerUnit <= 0) return 0;
  const step = 30 / metersPerUnit;
  let steepest = 0;
  for (let s = 0; s + (track.closed ? 0 : 2 * step) < track.length; s += step) {
    const dz = heightOf(nodes, s + 2 * step, track.length, track.closed) - heightOf(nodes, s, track.length, track.closed);
    steepest = Math.max(steepest, Math.abs(dz) / 60);
  }
  return steepest;
}

/** Catmull-Rom entre les nœuds : la pente ne casse pas à chaque nœud, sinon la voiture tressaute sur le relief exagéré. */
export function heightOf(nodes: Array<{ s: number; z: number }>, s: number, length: number, closed: boolean): number {
  const count = nodes.length;
  if (count === 0 || length <= 0) return 0;
  if (count === 1) return nodes[0].z;
  const at = closed ? mod(s, length) : Math.max(0, Math.min(length, s));
  if (!closed && at <= nodes[0].s) return nodes[0].z;
  if (!closed && at >= nodes[count - 1].s) return nodes[count - 1].z;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid].s <= at) lo = mid;
    else hi = mid - 1;
  }
  let i1 = nodes[lo].s <= at ? lo : count - 1;
  if (!closed) i1 = Math.min(i1, count - 2);
  const pick = (index: number) => nodes[closed ? (index + count) % count : Math.max(0, Math.min(count - 1, index))].z;
  const start = nodes[i1].s;
  let end = nodes[closed ? (i1 + 1) % count : i1 + 1].s;
  let pos = at;
  if (closed && end <= start) end += length;
  if (closed && pos < start) pos += length;
  const span = end - start;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (pos - start) / span)) : 0;
  const p0 = pick(i1 - 1);
  const p1 = pick(i1);
  const p2 = pick(i1 + 1);
  const p3 = pick(i1 + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/** Hauteur du ruban entre deux points du tracé. */
export function interpolateDeck(track: Track, deck: number[], s: number): number {
  const points = track.points;
  const at = track.closed ? mod(s, track.length) : Math.max(0, Math.min(track.length, s));
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (points[mid].s <= at) lo = mid;
    else hi = mid - 1;
  }
  const next = track.closed ? (lo + 1) % points.length : Math.min(points.length - 1, lo + 1);
  const end = track.closed && next === 0 ? track.length : points[next].s;
  const span = end - points[lo].s;
  const t = span > 1e-6 ? THREE.MathUtils.clamp((at - points[lo].s) / span, 0, 1) : 0;
  return deck[lo] + (deck[next] - deck[lo]) * t;
}

export function nearestPoint(buckets: Map<string, number[]>, points: Track['points'], cell: number, x: number, z: number) {
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  let best = 0;
  let bestD = Infinity;
  let found = false;
  for (let radius = 0; radius < 14; radius += 1) {
    for (let oz = -radius; oz <= radius; oz += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (radius > 0 && Math.abs(ox) !== radius && Math.abs(oz) !== radius) continue;
        const list = buckets.get(`${cx + ox}:${cz + oz}`);
        if (!list) continue;
        for (const index of list) {
          const dx = points[index].x - x;
          const dz = points[index].y - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = index;
            found = true;
          }
        }
      }
    }
    if (found && bestD <= (radius + 1) * cell * ((radius + 1) * cell)) break;
  }
  if (!found) {
    for (let i = 0; i < points.length; i += 1) {
      const dx = points[i].x - x;
      const dz = points[i].y - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return { index: best, distance: Math.sqrt(bestD) };
}

function blur(src: Float32Array, cols: number, rows: number): Float32Array {
  const dst = new Float32Array(src.length);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let sum = 0;
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        const yy = y + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          const xx = x + ox;
          if (xx < 0 || xx >= cols) continue;
          sum += src[yy * cols + xx];
          count += 1;
        }
      }
      dst[y * cols + x] = sum / count;
    }
  }
  return dst;
}

export function sampleGround(ctx: RaceCtx, x: number, z: number): number {
  if (ctx.stepX <= 0 || ctx.stepZ <= 0) return 0;
  const u = (x - ctx.originX) / ctx.stepX;
  const v = (z - ctx.originZ) / ctx.stepZ;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  if (x0 < 0 || y0 < 0 || x0 >= ctx.cols - 1 || y0 >= ctx.rows - 1) return ctx.midY;
  const tx = u - x0;
  const ty = v - y0;
  const i = y0 * ctx.cols + x0;
  const a = ctx.heights[i];
  const b = ctx.heights[i + 1];
  const c = ctx.heights[i + ctx.cols];
  const d = ctx.heights[i + ctx.cols + 1];
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

export function insideGrid(ctx: RaceCtx, x: number, z: number): boolean {
  if (ctx.stepX <= 0 || ctx.stepZ <= 0) return false;
  const u = (x - ctx.originX) / ctx.stepX;
  const v = (z - ctx.originZ) / ctx.stepZ;
  return u >= 0 && v >= 0 && u < ctx.cols - 1 && v < ctx.rows - 1;
}

export function buildTerrain(ctx: RaceCtx, bounds: Bounds, reliefAt: (s: number) => number, basinHalfWidth: number) {
  const pad = Math.max(ctx.half * 8, ctx.span * 0.2);
  const minX = bounds.minX - pad;
  const maxX = bounds.maxX + pad;
  const minZ = bounds.minY - pad;
  const maxZ = bounds.maxY + pad;
  const cells = 96;
  const cols = cells + 1;
  const rows = cells + 1;
  const stepX = (maxX - minX) / cells;
  const stepZ = (maxZ - minZ) / cells;
  const exact = new Float32Array(cols * rows);
  const dist = new Float32Array(cols * rows);
  const points = ctx.track.points;
  const heightsAlong = points.map((point) => reliefAt(point.s));
  const cell = Math.max(ctx.half * 3, 1);
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < points.length; i += 1) {
    const key = `${Math.floor(points[i].x / cell)}:${Math.floor(points[i].y / cell)}`;
    const list = buckets.get(key);
    if (list) list.push(i);
    else buckets.set(key, [i]);
  }
  for (let iy = 0; iy < rows; iy += 1) {
    const z = minZ + iy * stepZ;
    for (let ix = 0; ix < cols; ix += 1) {
      const x = minX + ix * stepX;
      const nearest = nearestPoint(buckets, points, cell, x, z);
      const index = iy * cols + ix;
      exact[index] = heightsAlong[nearest.index];
      dist[index] = nearest.distance;
    }
  }
  let soft = blur(exact, cols, rows);
  soft = blur(soft, cols, rows);
  const skirt = Math.max(1, Math.floor(cells * 0.07));
  for (let iy = 0; iy < rows; iy += 1) {
    for (let ix = 0; ix < cols; ix += 1) {
      const index = iy * cols + ix;
      const edge = smooth(THREE.MathUtils.clamp((dist[index] - ctx.half * 1.8) / (ctx.half * 6), 0, 1));
      let height = exact[index] * (1 - edge) + soft[index] * edge;
      const border = Math.min(ix, iy, cells - ix, cells - iy) / skirt;
      height = THREE.MathUtils.lerp(-0.4, height, smooth(THREE.MathUtils.clamp(border, 0, 1)));
      exact[index] = height;
    }
  }
  // Une maille fait jusqu'à 30 m : entre deux sommets, le sol remonterait au-dessus d'un bitume posé à quelques centimètres.
  // Tout sommet d'un triangle qui touche la chaussée passe donc sous elle.
  const reach = basinHalfWidth + Math.hypot(stepX, stepZ);
  const margin = Math.max(ctx.roadLift * 2, ctx.half * 0.03);
  const stride = Math.max(Math.min(stepX, stepZ) * 0.5, 1e-3);
  for (let s = 0; s < ctx.track.length; s += stride) {
    const spot = pointAt(ctx.track, s);
    const floor = reliefAt(s) - margin;
    const ix0 = Math.max(0, Math.floor((spot.x - reach - minX) / stepX));
    const ix1 = Math.min(cells, Math.ceil((spot.x + reach - minX) / stepX));
    const iy0 = Math.max(0, Math.floor((spot.y - reach - minZ) / stepZ));
    const iy1 = Math.min(cells, Math.ceil((spot.y + reach - minZ) / stepZ));
    for (let iy = iy0; iy <= iy1; iy += 1) {
      for (let ix = ix0; ix <= ix1; ix += 1) {
        if (Math.hypot(minX + ix * stepX - spot.x, minZ + iy * stepZ - spot.y) > reach) continue;
        const index = iy * cols + ix;
        if (exact[index] > floor) exact[index] = floor;
      }
    }
  }

  const positions = new Float32Array(cols * rows * 3);
  const uvs = new Float32Array(cols * rows * 2);
  const indices: number[] = [];
  for (let iy = 0; iy < rows; iy += 1) {
    for (let ix = 0; ix < cols; ix += 1) {
      const index = iy * cols + ix;
      positions[index * 3] = minX + ix * stepX;
      positions[index * 3 + 1] = exact[index];
      positions[index * 3 + 2] = minZ + iy * stepZ;
      uvs[index * 2] = (ix * stepX) / (ctx.half * 4);
      uvs[index * 2 + 1] = (iy * stepZ) / (ctx.half * 4);
    }
  }
  for (let iy = 0; iy < cells; iy += 1) {
    for (let ix = 0; ix < cells; ix += 1) {
      const a = iy * cols + ix;
      indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
    }
  }
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const grass = ctx.keep(new THREE.MeshStandardMaterial({
    map: ctx.keep(groundTexture(ctx.biome.ground)),
    roughness: 1,
    metalness: 0,
  }));
  const ground = new THREE.Mesh(geometry, grass);
  ground.receiveShadow = true;
  ctx.scene.add(ground);

  const baseTex = ctx.keep(groundTexture(ctx.biome.ground));
  baseTex.wrapS = THREE.RepeatWrapping;
  baseTex.wrapT = THREE.RepeatWrapping;
  baseTex.repeat.set(28, 28);
  const base = new THREE.Mesh(
    ctx.keep(new THREE.PlaneGeometry(ctx.span * 8, ctx.span * 8)),
    ctx.keep(new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1, metalness: 0 })),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.set(ctx.midX, -0.4, ctx.midZ);
  base.receiveShadow = true;
  ctx.scene.add(base);
  ctx.cols = cols;
  ctx.rows = rows;
  ctx.heights = exact;
  ctx.originX = minX;
  ctx.originZ = minZ;
  ctx.stepX = stepX;
  ctx.stepZ = stepZ;
}
