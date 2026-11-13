import * as THREE from 'three';
import { bankOffset } from '@/lib/circuit-banking';
import type { TrackSign } from '@/lib/circuit-places';
import { RUNOFF_RATIO, STREET_RUNOFF_RATIO } from '@/lib/clm';
import { bankAt, narrowAt, paintedHalf, paintedHalfAt, pointAt, type Track } from '@/lib/track-path';
import { boardTexture, checkerTexture, roadTexture, signTexture } from './textures';
import { mod, type RaceCtx } from './terrain';

const ASPHALT = 1 / 0.85;
/** Épaisseur des marquages posés sur le bitume, en demi-largeurs de piste (quelques centimètres à l'échelle de la voiture). */
const DECAL_LIFT = 0.004;
/** Demi-largeur du bac, en parts de la demi-piste. */
export const GRAVEL_BASIN_HALF = 1.48;
/** En dessous de cette fraction de largeur, le bac se resserre vers la peinture. */
export const TIGHTEN_THRESHOLD = 0.85;
/** Largeur de la transition qui accompagne le seuil de resserrement. */
export const TIGHTEN_SPAN = 0.15;
/** Angle au-delà duquel l'ancien anneau coupe franchement la piste actuelle. */
export const CROSSING_ANGLE = 1.05;

/** Demi-largeur du bac à une abscisse, peinture comprise quand la piste se resserre. */
export function basinHalf(half: number, narrow: number, paintedLimit: number): number {
  const gravelHalf = half * GRAVEL_BASIN_HALF;
  const tightened = THREE.MathUtils.clamp((narrow - TIGHTEN_THRESHOLD) / TIGHTEN_SPAN, 0, 1);
  return narrow * THREE.MathUtils.lerp(paintedLimit, gravelHalf, tightened);
}

export type Board = { s: number; x: number; y: number; label: string };

/** Demi-largeur du bac, celle autour de laquelle le dévers pivote. */
export function outerAt(ctx: RaceCtx, s: number): number {
  return basinHalf(ctx.half, narrowAt(ctx.track, s), paintedHalf(ctx.track));
}

/** Hausse du bitume à `lateral` mètres-jeu vers la gauche. */
export function bankHeight(ctx: RaceCtx, s: number, lateral: number): number {
  return bankOffset(lateral, bankAt(ctx.track, s), outerAt(ctx, s)).y;
}

/** Hauteur du milieu de piste, dévers compris. */
export function deck(ctx: RaceCtx, s: number): number {
  return ctx.surfaceAt(s) + ctx.roadLift + bankHeight(ctx, s, 0);
}

/** Distance du centre au rail : au vibreur en ville, au mur souple ailleurs. */
export function edgeReach(ctx: RaceCtx, s: number): number {
  const painted = paintedHalfAt(ctx.track, s);
  return painted * (ctx.biome.walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO);
}

function gravelColor(ctx: RaceCtx): string {
  if (ctx.biome.walls) return '#3a3e44';
  if (ctx.biome.night) return '#4a463c';
  if (ctx.biome.ground === 'sand') return '#e4c98a';
  if (ctx.biome.ground === 'dry') return '#d0bc90';
  return '#d5c09a';
}

export function buildTrack(ctx: RaceCtx) {
  const roadHalf = ctx.half * ASPHALT;
  const limit = paintedHalf(ctx.track);
  const keep = ctx.track.points.map((_, i) => ctx.track.narrow?.[i] ?? 1);
  const roadEdge = Float64Array.from(keep, (n) => roadHalf * n);
  // Là où la piste est resserrée, le bac s'arrête au bord du hors-piste pour ne pas mordre sur la portion voisine.
  const gravelEdge = Float64Array.from(keep, (n) => basinHalf(ctx.half, n, limit));
  if (ctx.biome.walls) {
    for (let i = 0; i < gravelEdge.length; i += 1) {
      const wall = edgeReach(ctx, ctx.track.points[i].s);
      if (gravelEdge[i] > wall) gravelEdge[i] = wall;
    }
  }
  const road = new THREE.Mesh(
    ribbon(ctx, roadEdge, ctx.roadLift),
    ctx.keep(new THREE.MeshStandardMaterial({
      map: ctx.keep(roadTexture()),
      roughness: 0.9,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })),
  );
  road.receiveShadow = true;
  ctx.scene.add(road);

  const gravel = new THREE.Mesh(
    ribbon(ctx, gravelEdge, ctx.roadLift * 0.45),
    // Le gravier recule en profondeur plutôt que d'avancer la route : un décalage sur la route la ferait passer devant les pneus.
    ctx.keep(new THREE.MeshStandardMaterial({
      color: gravelColor(ctx),
      roughness: 1,
      metalness: 0,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })),
  );
  gravel.receiveShadow = true;
  ctx.scene.add(gravel);
}

function ribbon(ctx: RaceCtx, half: Float64Array, lift: number): THREE.BufferGeometry {
  const points = ctx.track.points;
  const count = ctx.track.closed ? points.length + 1 : points.length;
  const positions = new Float32Array(count * 2 * 3);
  const uvs = new Float32Array(count * 2 * 2);
  const repeat = Math.max(ctx.half * 4.2, 1e-3);
  for (let i = 0; i < count; i += 1) {
    const point = points[i % points.length];
    const width = half[i % points.length];
    const s = i === points.length ? ctx.track.length : point.s;
    const nx = -Math.sin(point.angle);
    const nz = Math.cos(point.angle);
    const y = ctx.reliefAt(s) + lift;
    const phi = bankAt(ctx.track, s);
    const outer = outerAt(ctx, s);
    const raisedLeft = bankOffset(width, phi, outer);
    const raisedRight = bankOffset(-width, phi, outer);
    const u = s / repeat;
    const left = i * 2;
    const right = left + 1;
    positions[left * 3] = point.x + nx * raisedLeft.lateral;
    positions[left * 3 + 1] = y + raisedLeft.y;
    positions[left * 3 + 2] = point.y + nz * raisedLeft.lateral;
    positions[right * 3] = point.x + nx * raisedRight.lateral;
    positions[right * 3 + 1] = y + raisedRight.y;
    positions[right * 3 + 2] = point.y + nz * raisedRight.lateral;
    uvs[left * 2] = 0;
    uvs[left * 2 + 1] = u;
    uvs[right * 2] = 1;
    uvs[right * 2 + 1] = u;
  }
  const indices: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function buildStart(ctx: RaceCtx) {
  const start = ctx.track.points[0];
  const across = ctx.half * 2.02;
  const along = ctx.half * 0.26;
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -along / 2, 0, -across / 2,
    along / 2, 0, -across / 2,
    along / 2, 0, across / 2,
    -along / 2, 0, across / 2,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, ctx.keep(new THREE.MeshStandardMaterial({
    map: ctx.keep(checkerTexture()),
    roughness: 0.8,
    side: THREE.DoubleSide,
  })));
  mesh.position.set(start.x, deck(ctx, 0) + ctx.half * DECAL_LIFT, start.y);
  mesh.rotation.y = -start.angle;
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
}

export function buildGantry(ctx: RaceCtx): THREE.MeshStandardMaterial {
  const start = ctx.track.points[0];
  const nx = -Math.sin(start.angle);
  const nz = Math.cos(start.angle);
  const y = ctx.reliefAt(0) + ctx.roadLift;
  const reach = ctx.half * 1.42;
  const postH = ctx.half * 2.25;
  const metal = ctx.keep(new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.42, metalness: 0.72 }));
  const across = new THREE.Vector3(nx, 0, nz);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(ctx.keep(new THREE.BoxGeometry(ctx.half * 0.1, postH, ctx.half * 0.1)), metal);
    post.position.set(start.x + nx * reach * side, y + postH / 2, start.y + nz * reach * side);
    post.castShadow = true;
    ctx.scene.add(post);
  }
  const beam = new THREE.Mesh(ctx.keep(new THREE.BoxGeometry(reach * 2.15, ctx.half * 0.1, ctx.half * 0.1)), metal);
  beam.position.set(start.x, y + postH, start.y);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), across);
  beam.castShadow = true;
  ctx.scene.add(beam);
  const lamps = ctx.keep(new THREE.MeshStandardMaterial({
    color: '#241416',
    emissive: '#000000',
    roughness: 0.35,
    metalness: 0.1,
  }));
  const lampGeo = ctx.keep(new THREE.SphereGeometry(ctx.half * 0.075, 16, 12));
  for (let i = 0; i < 5; i += 1) {
    const offset = (i - 2) * reach * 0.34;
    const lamp = new THREE.Mesh(lampGeo, lamps);
    lamp.position.set(start.x + nx * offset, y + postH - ctx.half * 0.16, start.y + nz * offset);
    ctx.scene.add(lamp);
  }
  return lamps;
}

export function setGantryLights(lamps: THREE.MeshStandardMaterial, countdown: boolean, go: boolean) {
  lamps.color.set(countdown ? '#3a0000' : go ? '#043318' : '#241416');
  lamps.emissive.set(countdown ? '#ff2a2a' : go ? '#3dff86' : '#000000');
  lamps.emissiveIntensity = countdown || go ? 2.4 : 0;
}

export function buildBoards(ctx: RaceCtx, lengthKm: number) {
  const labels = new Map<string, THREE.MeshStandardMaterial>();
  for (const label of ['50', '100', '150']) {
    labels.set(label, ctx.keep(new THREE.MeshStandardMaterial({
      map: ctx.keep(boardTexture(label)),
      roughness: 0.7,
    })));
  }
  const geometry = ctx.keep(new THREE.PlaneGeometry(ctx.half * 0.92, ctx.half * 0.46));
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3();
  const inward = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (const board of brakeBoards(ctx.track, lengthKm)) {
    const spot = pointAt(ctx.track, board.s);
    const y = ctx.reliefAt(board.s) + ctx.roadLift;
    const mesh = new THREE.Mesh(geometry, labels.get(board.label));
    mesh.position.set(board.x, y + ctx.half * 0.28, board.y);
    inward.set(spot.x - board.x, 0, spot.y - board.y);
    if (inward.lengthSq() < 1e-8) continue;
    inward.normalize();
    right.crossVectors(up, inward).normalize();
    mesh.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, inward));
    mesh.castShadow = true;
    ctx.scene.add(mesh);
  }
}

/** Numéro de chaque virage, nom des virages et lignes droites connus, tournés vers la voiture qui arrive. */
export function buildSigns(ctx: RaceCtx, signs: TrackSign[], meters: number) {
  if (!signs.length) return;
  const lead = 35 / Math.max(meters, 1e-6);
  const window = 40 / Math.max(meters, 1e-6);
  const post = ctx.keep(new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6, metalness: 0.4 }));
  const postGeo = ctx.keep(new THREE.BoxGeometry(ctx.half * 0.05, 1, ctx.half * 0.05));
  const up = new THREE.Vector3(0, 1, 0);
  const facing = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  for (const sign of signs) {
    const apex = sign.at * ctx.track.length;
    const before = pointAt(ctx.track, apex - window);
    const after = pointAt(ctx.track, apex + window);
    const turn = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
    const s = mod(sign.number != null ? apex - lead : apex, ctx.track.length);
    const spot = pointAt(ctx.track, s);
    const nx = Math.cos(spot.angle + Math.PI / 2);
    const nz = Math.sin(spot.angle + Math.PI / 2);
    // À l'extérieur du virage (là où l'on regarde en l'abordant), sinon de l'autre côté si une autre portion passe trop près.
    const outside = turn > 0 ? -1 : 1;
    let placed: { x: number; z: number; side: number } | null = null;
    for (const side of [outside, -outside]) {
      // Derrière le mur souple du dégagement (1,8 fois la limite peinte), pour ne jamais rouler à travers.
      for (const reach of [2.9, 2.5]) {
        const x = spot.x + nx * ctx.half * reach * side;
        const z = spot.y + nz * ctx.half * reach * side;
        if (clearance(ctx.track, x, z, s) < paintedHalf(ctx.track) * 1.25) continue;
        placed = { x, z, side };
        break;
      }
      if (placed) break;
    }
    if (!placed) continue;

    const wide = sign.name != null;
    const width = ctx.half * (wide ? 2.1 : 0.8);
    const height = ctx.half * (wide ? 0.56 : 0.8);
    const material = ctx.keep(new THREE.MeshStandardMaterial({
      map: ctx.keep(signTexture(sign)),
      roughness: 0.55,
      side: THREE.DoubleSide,
    }));
    const board = new THREE.Mesh(ctx.keep(new THREE.PlaneGeometry(width, height)), material);
    const ground = ctx.reliefAt(s);
    const lift = ctx.half * 0.55;
    board.position.set(placed.x, ground + lift + height / 2, placed.z);
    // Face au pilote qui arrive, légèrement ouvert vers la piste.
    facing.set(-Math.cos(spot.angle), 0, -Math.sin(spot.angle))
      .addScaledVector(new THREE.Vector3(-nx * placed.side, 0, -nz * placed.side), 0.45)
      .normalize();
    right.crossVectors(up, facing).normalize();
    board.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, facing));
    board.castShadow = true;
    ctx.scene.add(board);
    for (const offset of wide ? [-0.4, 0.4] : [0]) {
      const leg = new THREE.Mesh(postGeo, post);
      leg.scale.y = lift + height * 0.5;
      leg.position.set(
        placed.x + right.x * width * offset,
        ground + leg.scale.y / 2,
        placed.z + right.z * width * offset,
      );
      leg.castShadow = true;
      ctx.scene.add(leg);
    }
  }
}

export function buildChevrons(ctx: RaceCtx) {
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0.62, 0.03, 0,
    -0.4, 0.03, 0.3,
    -0.4, 0.03, -0.3,
  ], 3));
  geometry.computeVertexNormals();
  const material = ctx.keep(new THREE.MeshBasicMaterial({
    color: '#f7f7f7',
    side: THREE.DoubleSide,
  }));
  const step = Math.max(8, Math.round(ctx.track.points.length / 16));
  for (let i = step; i < ctx.track.points.length - step; i += step) {
    const point = ctx.track.points[i];
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(point.x, deck(ctx, point.s) + ctx.half * DECAL_LIFT, point.y);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = -point.angle;
    mesh.rotation.z = -bankAt(ctx.track, point.s);
    mesh.scale.setScalar(ctx.half * 0.5);
    ctx.scene.add(mesh);
  }
}

function clearance(track: Track, x: number, z: number, s: number): number {
  let best = Infinity;
  for (const point of track.points) {
    let along = Math.abs(point.s - s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along < track.length * 0.05) continue;
    best = Math.min(best, Math.hypot(point.x - x, point.y - z));
  }
  return best;
}

export function brakeBoards(track: Track, lengthKm: number): Board[] {
  const km = lengthKm > 0 ? lengthKm : 4.304;
  const perMeter = track.length / (km * 1000);
  const ahead = [50, 100, 150].map((meters) => meters * perMeter);
  const labels = ['50', '100', '150'];
  const boards: Board[] = [];
  let last = -1e9;
  for (let i = 0; i < track.points.length; i += 1) {
    const next = track.points[(i + 6) % track.points.length];
    const turn = Math.atan2(Math.sin(next.angle - track.points[i].angle), Math.cos(next.angle - track.points[i].angle));
    let span = next.s - track.points[i].s;
    if (span < 0) span += track.length;
    if (span < 8 || Math.abs(turn) < 0.55) continue;
    const along = track.points[i].s - last;
    if (along >= 0 && along < track.length * 0.08) continue;
    last = track.points[i].s;
    const side = turn > 0 ? 1 : -1;
    for (let k = 0; k < ahead.length; k += 1) {
      let s = track.points[i].s - ahead[k];
      if (s < 0) s += track.length;
      const spot = pointAt(track, s);
      const x = spot.x + Math.cos(spot.angle + Math.PI / 2) * track.halfWidth * 1.85 * side;
      const y = spot.y + Math.sin(spot.angle + Math.PI / 2) * track.halfWidth * 1.85 * side;
      if (clearance(track, x, y, s) < paintedHalf(track) * 1.15) continue;
      boards.push({ s, x, y, label: labels[k] });
    }
  }
  return boards;
}
