import * as THREE from 'three';
import type { CircuitBiome } from '@/lib/circuit-biome';
import { planBlocks, planPit, planStands, type Footprint, type Placed } from '@/lib/circuit-scenery';
import { surroundingsFor, type CircuitSurroundings } from '@/lib/circuit-surroundings';
import { bankOffset } from '@/lib/circuit-banking';
import { paintClearance } from '@/lib/track-clearance';
import { bankAt, paintedHalf, paintedHalfAt, pointAt } from '@/lib/track-path';
import { buildHistoric } from './historic-loop';
import { edgeReach, outerAt } from './road';
import { insideGrid, sampleGround, type RaceCtx } from './terrain';
import { facadeTexture, hash, standTexture } from './textures';

type Beside = {
  x: number;
  z: number;
  y: number;
  nx: number;
  nz: number;
  angle: number;
  s: number;
};

type Scatter = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  color: string;
};

const STAND_COLORS = ['#9b1d32', '#e6e1d6', '#1e3f78', '#c6a15a', '#245c3a'];

function canopyPalette(biome: CircuitBiome): string[] {
  if (biome.night) return ['#1a3a28', '#143222', '#1e4030'];
  if (biome.treeScale >= 1.7) return ['#1c4a26', '#245832', '#163e20', '#2c6238'];
  if (biome.palms) return ['#1f7a45', '#2e8a48', '#176b3c'];
  if (biome.ground === 'dry' || biome.ground === 'sand' || biome.ground === 'night-sand') {
    return ['#6d7a3a', '#8a8444', '#5a6a32'];
  }
  return ['#2f6b32', '#3d7a38', '#245a30', '#4e8234'];
}

/** Vrai si le point (plus `pad`) recouvre la peinture d'une autre portion, épingle comprise. */
function coversTrack(ctx: RaceCtx, x: number, z: number, s: number, pad: number): boolean {
  const skip = Math.max(paintedHalf(ctx.track) * 2.4, ctx.track.length * 0.008);
  for (const point of ctx.track.points) {
    let along = Math.abs(point.s - s);
    if (ctx.track.closed) along = Math.min(along, ctx.track.length - along);
    if (along < skip) continue;
    if (Math.hypot(point.x - x, point.y - z) < paintedHalfAt(ctx.track, point.s) + pad) return true;
  }
  return false;
}

/**
 * Un point au-delà du rail, du côté `side` (+1 = gauche dans le sens de la marche).
 * `extra` l'éloigne encore. `pad` est le rayon du décor : il ne doit couvrir aucune autre portion.
 */
function beside(ctx: RaceCtx, s: number, side: number, extra: number, pad = 0): Beside | null {
  const spot = pointAt(ctx.track, s);
  const nx = -Math.sin(spot.angle);
  const nz = Math.cos(spot.angle);
  const reach = edgeReach(ctx, s) + extra;
  const raised = bankOffset(side * reach, bankAt(ctx.track, s), outerAt(ctx, s));
  const x = spot.x + nx * raised.lateral;
  const z = spot.y + nz * raised.lateral;
  if (coversTrack(ctx, x, z, s, pad)) return null;
  return {
    x,
    z,
    y: ctx.surfaceAt(s) + ctx.roadLift + raised.y,
    nx,
    nz,
    angle: spot.angle,
    s: spot.s,
  };
}

/** Glissières ou murs au bord du mur souple, puis le décor du circuit, hors piste. */
export function buildSurroundings(ctx: RaceCtx) {
  const mapped = surroundingsFor(ctx.circuitId);
  if (mapped) {
    buildWater(ctx, mapped);
    buildHistoric(ctx, mapped.loops);
  }
  buildRails(ctx);
  if (mapped && mapped.stands.length + mapped.blocks.length > 0) plantFootprints(ctx, mapped.stands, mapped.blocks);
  else {
    const pit = planPit(ctx.track, ctx.half, ctx.biome.walls);
    if (pit.box) plantPlaced(ctx, [pit.box], 'pit');
    if (ctx.biome.stands) plantPlaced(ctx, planStands(ctx.track, ctx.half, pit.side, ctx.biome.walls), 'stand');
    plantPlaced(ctx, planBlocks(ctx.track, ctx.half, ctx.biome.blocks, ctx.biome.walls, ctx.biome.night), 'block');
  }
  buildTrees(ctx);
  buildTires(ctx);
  buildLamps(ctx);
}

function railPosts(ctx: RaceCtx, spacing: number): Array<Array<Beside | null>> {
  const left: Array<Beside | null> = [];
  const right: Array<Beside | null> = [];
  let nextS = -1;
  for (const point of ctx.track.points) {
    if (point.s < nextS) continue;
    nextS = point.s + spacing;
    left.push(beside(ctx, point.s, 1, ctx.half * 0.02));
    right.push(beside(ctx, point.s, -1, ctx.half * 0.02));
  }
  return [left, right];
}

function buildRails(ctx: RaceCtx) {
  const street = ctx.biome.walls;
  const height = ctx.half * (street ? 0.16 : 0.09);
  const spacing = ctx.half * (street ? 0.55 : 1.15);
  const rows = railPosts(ctx, spacing);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const capPositions: number[] = [];
  const capNormals: number[] = [];
  const capIndices: number[] = [];
  const pushQuad = (
    targetP: number[],
    targetN: number[],
    targetI: number[],
    a: Beside,
    b: Beside,
    side: number,
    y0: number,
    y1: number,
    nudge: number,
  ) => {
    const inn = -side;
    const ox = a.nx * inn * nudge;
    const oz = a.nz * inn * nudge;
    const base = targetP.length / 3;
    targetP.push(
      a.x + ox, a.y + y0, a.z + oz,
      b.x + ox, b.y + y0, b.z + oz,
      a.x + ox, a.y + y1, a.z + oz,
      b.x + ox, b.y + y1, b.z + oz,
    );
    const nx = a.nx * inn;
    const nz = a.nz * inn;
    targetN.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
    targetI.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
  };
  const link = (row: Array<Beside | null>, side: number) => {
    for (let i = 0; i < row.length - 1; i += 1) {
      const a = row[i];
      const b = row[i + 1];
      if (!a || !b) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) > spacing * 2.2) continue;
      if (chordCovers(ctx, a, b)) continue;
      pushQuad(positions, normals, indices, a, b, side, 0, height, 0);
      if (street) pushQuad(capPositions, capNormals, capIndices, a, b, side, height * 0.82, height, ctx.half * 0.012);
    }
    if (!ctx.track.closed || row.length < 3) return;
    const a = row[row.length - 1];
    const b = row[0];
    if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > spacing * 2.2 || chordCovers(ctx, a, b)) return;
    pushQuad(positions, normals, indices, a, b, side, 0, height, 0);
    if (street) pushQuad(capPositions, capNormals, capIndices, a, b, side, height * 0.82, height, ctx.half * 0.012);
  };
  link(rows[0], 1);
  link(rows[1], -1);
  const addSheet = (position: number[], normal: number[], index: number[], color: string, metalness: number, roughness: number) => {
    if (!position.length) return;
    const geometry = ctx.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
    geometry.setIndex(index);
    const mesh = new THREE.Mesh(geometry, ctx.keep(new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      side: THREE.DoubleSide,
    })));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
  };
  addSheet(positions, normals, indices, street ? '#d7d1c6' : '#e4e8ee', street ? 0.04 : 0.62, street ? 0.9 : 0.4);
  addSheet(capPositions, capNormals, capIndices, '#c8102e', 0.08, 0.55);
}

function chordCovers(ctx: RaceCtx, a: Beside, b: Beside): boolean {
  for (const t of [0.25, 0.5, 0.75]) {
    if (coversTrack(ctx, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, a.s + (b.s - a.s) * t, 0)) return true;
  }
  return false;
}

/** Bâtiment des stands, du côté le plus dégagé. Retourne ce côté pour placer les tribunes en face. */
function plantPlaced(ctx: RaceCtx, places: Placed[], kind: 'pit' | 'stand' | 'block') {
  if (!places.length) return;
  const scatter: Scatter[] = places.map((place) => {
    const deck = ctx.reliefAt(place.s) + ctx.roadLift + place.lift;
    const ground = kind === 'block'
      ? Math.max(sampleGround(ctx, place.x, place.y), deck - ctx.half * 0.35)
      : deck;
    return {
      x: place.x,
      y: ground + place.height / 2,
      z: place.y,
      sx: place.length,
      sy: place.height,
      sz: place.depth,
      yaw: -place.angle,
      color: place.color,
    };
  });
  if (kind === 'pit') {
    const place = scatter[0];
    const mesh = new THREE.Mesh(
      ctx.keep(new THREE.BoxGeometry(place.sx, place.sy, place.sz)),
      ctx.keep(new THREE.MeshStandardMaterial({ color: place.color, roughness: 0.78, metalness: 0.18 })),
    );
    mesh.position.set(place.x, place.y, place.z);
    mesh.rotation.y = place.yaw;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ctx.scene.add(mesh);
    return;
  }
  if (kind === 'stand') {
    const map = ctx.keep(standTexture());
    plant(ctx, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
      map,
      roughness: 0.84,
      metalness: 0.02,
    }), scatter);
    return;
  }
  const map = ctx.keep(facadeTexture(ctx.biome.night));
  plant(ctx, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
    map,
    color: '#ffffff',
    emissive: '#ffffff',
    emissiveMap: map,
    emissiveIntensity: ctx.biome.night ? 0.9 : 0.05,
    roughness: 0.88,
    metalness: 0.04,
  }), scatter);
}

/** Tribunes et immeubles relevés le long du tracé réel, déjà rejetés s'ils mordent l'asphalte. */
function plantFootprints(ctx: RaceCtx, stands: Footprint[], blocks: Footprint[]) {
  const standPlaces: Placed[] = stands.map((box, index) => ({
    ...box,
    height: Math.min(Math.max(box.depth * 0.62, ctx.half * 0.38), ctx.half * 1.2),
    color: STAND_COLORS[index % STAND_COLORS.length],
  }));
  const blockPlaces: Placed[] = blocks.map((box) => {
    const seed = hash(Math.round(box.x * 10), Math.round(box.y * 10));
    let height = ctx.half * (0.75 + seed * (ctx.biome.walls ? 2.3 : 0.85));
    if (seed > 0.9) height *= 1.55;
    return { ...box, height, color: '#d9d3c6' };
  });
  plantPlaced(ctx, standPlaces, 'stand');
  plantPlaced(ctx, blockPlaces, 'block');
}

function waterLevel(ctx: RaceCtx, ring: number[][]): number {
  let low = Infinity;
  for (const [x, y] of ring) {
    if (!insideGrid(ctx, x, y)) continue;
    low = Math.min(low, sampleGround(ctx, x, y));
  }
  if (!Number.isFinite(low)) return -0.22;
  return low + Math.max(0.14, ctx.roadLift);
}

/** Plans d'eau et nappes de mer, posés à plat, jamais sur l'asphalte. */
function buildWater(ctx: RaceCtx, scene: CircuitSurroundings) {
  const positions: number[] = [];
  const addRing = (ring: number[][]) => {
    if (ring.length < 3) return;
    const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
    let faces: number[][] = [];
    try {
      faces = THREE.ShapeUtils.triangulateShape(contour, []);
    } catch {
      return;
    }
    const height = waterLevel(ctx, ring);
    for (const face of faces) {
      if (face.length < 3) continue;
      const tri = [contour[face[0]], contour[face[1]], contour[face[2]]];
      if (tri.some((point) => !point)) continue;
      const mx = (tri[0].x + tri[1].x + tri[2].x) / 3;
      const my = (tri[0].y + tri[1].y + tri[2].y) / 3;
      if (paintClearance(ctx.track, mx, my) < ctx.half * 0.25) continue;
      const edge = Math.max(
        Math.hypot(tri[0].x - tri[1].x, tri[0].y - tri[1].y),
        Math.hypot(tri[1].x - tri[2].x, tri[1].y - tri[2].y),
        Math.hypot(tri[2].x - tri[0].x, tri[2].y - tri[0].y),
      );
      if (edge > ctx.span * 1.35) continue;
      for (const point of tri) positions.push(point.x, height, point.y);
    }
  };
  for (const ring of scene.waters) addRing(ring);
  for (const ring of scene.sheets) addRing(ring);
  if (positions.length < 9) return;
  const geometry = ctx.keep(new THREE.BufferGeometry());
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, ctx.keep(new THREE.MeshStandardMaterial({
    color: ctx.biome.night ? '#16324a' : '#2a7498',
    roughness: 0.16,
    metalness: 0.42,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })));
  mesh.receiveShadow = true;
  ctx.scene.add(mesh);
}

function buildTrees(ctx: RaceCtx) {
  if (ctx.biome.trees <= 0) return;
  const palms = ctx.biome.palms;
  const trunks: Scatter[] = [];
  const crowns: Scatter[] = [];
  const tops: Scatter[] = [];
  const colors = canopyPalette(ctx.biome);
  const points = ctx.track.points;
  const step = Math.max(1, Math.floor(points.length / 70));
  for (let i = 0; i < points.length; i += step) {
    if (hash(i, 21) > ctx.biome.trees) continue;
    const scale = (0.75 + hash(i, 22) * 0.55) * ctx.biome.treeScale;
    const canopyR = ctx.half * (palms ? 0.2 : 0.3) * scale;
    const trunkH = ctx.half * (palms ? 0.95 : 0.42) * scale;
    const extra = canopyR + ctx.half * (0.28 + hash(i, 23) * (ctx.biome.walls ? 1.15 : 4.4));
    const prefer = hash(i, 24) > 0.5 ? 1 : -1;
    const spot = beside(ctx, points[i].s, prefer, extra, canopyR)
      ?? beside(ctx, points[i].s, -prefer, extra, canopyR);
    if (!spot) continue;
    const ground = sampleGround(ctx, spot.x, spot.z);
    const yaw = hash(i, 25) * Math.PI * 2;
    const color = colors[trunks.length % colors.length];
    trunks.push({
      x: spot.x,
      y: ground + trunkH / 2,
      z: spot.z,
      sx: ctx.half * (palms ? 0.02 : 0.045) * scale,
      sy: trunkH,
      sz: ctx.half * (palms ? 0.02 : 0.045) * scale,
      yaw,
      color,
    });
    if (palms) {
      crowns.push({
        x: spot.x,
        y: ground + trunkH,
        z: spot.z,
        sx: canopyR,
        sy: canopyR * 0.42,
        sz: canopyR,
        yaw,
        color,
      });
    } else {
      const lowH = ctx.half * 0.34 * scale;
      const topH = ctx.half * 0.4 * scale;
      crowns.push({
        x: spot.x,
        y: ground + trunkH * 0.82,
        z: spot.z,
        sx: canopyR,
        sy: lowH,
        sz: canopyR,
        yaw,
        color,
      });
      tops.push({
        x: spot.x,
        y: ground + trunkH + topH * 0.15,
        z: spot.z,
        sx: canopyR * 0.68,
        sy: topH,
        sz: canopyR * 0.68,
        yaw,
        color,
      });
    }
  }
  if (!trunks.length) return;
  plant(ctx, new THREE.CylinderGeometry(1, 1.15, 1, 5), new THREE.MeshStandardMaterial({
    color: '#6a4a32',
    roughness: 0.92,
    metalness: 0,
  }), trunks, false);
  const leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
  if (palms) plant(ctx, new THREE.SphereGeometry(1, 7, 5), leaves, crowns);
  else {
    plant(ctx, new THREE.ConeGeometry(1, 1, 6), leaves, crowns);
    plant(ctx, new THREE.ConeGeometry(1, 1, 6), leaves, tops);
  }
}

function buildTires(ctx: RaceCtx) {
  const points = ctx.track.points;
  const step = Math.max(4, Math.round(points.length / 70));
  const places: Scatter[] = [];
  let last = -1e9;
  for (let i = 0; i < points.length; i += step) {
    const point = points[i];
    const next = points[(i + step) % points.length];
    const turn = Math.atan2(Math.sin(next.angle - point.angle), Math.cos(next.angle - point.angle));
    if (Math.abs(turn) < 0.32) continue;
    let along = point.s - last;
    if (along < 0) along += ctx.track.length;
    if (along < ctx.track.length * 0.035) continue;
    const size = ctx.half * 0.22;
    const spot = beside(ctx, point.s, turn > 0 ? -1 : 1, ctx.half * 0.2, size);
    if (!spot) continue;
    last = point.s;
    places.push({
      x: spot.x,
      y: spot.y + size / 2,
      z: spot.z,
      sx: size * 1.45,
      sy: size,
      sz: size,
      yaw: -spot.angle,
      color: '#1c1c1c',
    });
    if (places.length >= 16) break;
  }
  plant(ctx, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
    color: '#ffffff',
    roughness: 0.96,
    metalness: 0,
  }), places);
}

function buildLamps(ctx: RaceCtx) {
  if (!ctx.biome.night) return;
  const poles: Scatter[] = [];
  const bulbs: Scatter[] = [];
  let nextS = -1;
  for (const point of ctx.track.points) {
    if (point.s < nextS) continue;
    nextS = point.s + ctx.half * 9;
    const spot = beside(ctx, point.s, 1, ctx.half * 0.28) ?? beside(ctx, point.s, -1, ctx.half * 0.28);
    if (!spot) continue;
    const height = ctx.half * 0.72;
    poles.push({
      x: spot.x,
      y: spot.y + height / 2,
      z: spot.z,
      sx: ctx.half * 0.025,
      sy: height,
      sz: ctx.half * 0.025,
      yaw: 0,
      color: '#ffffff',
    });
    bulbs.push({
      x: spot.x,
      y: spot.y + height,
      z: spot.z,
      sx: ctx.half * 0.045,
      sy: ctx.half * 0.045,
      sz: ctx.half * 0.045,
      yaw: 0,
      color: '#ffffff',
    });
  }
  plant(ctx, new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({
    color: '#2a3038',
    roughness: 0.6,
    metalness: 0.4,
  }), poles, false);
  plant(ctx, new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({
    color: '#ffe7c2',
    emissive: '#ffd9a0',
    emissiveIntensity: 2.4,
    roughness: 0.4,
  }), bulbs, false);
}

function plant(ctx: RaceCtx, geometry: THREE.BufferGeometry, material: THREE.Material, places: Scatter[], tint = true) {
  if (!places.length) {
    geometry.dispose();
    material.dispose();
    return;
  }
  const mesh = new THREE.InstancedMesh(ctx.keep(geometry), ctx.keep(material), places.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < places.length; i += 1) {
    const place = places[i];
    dummy.position.set(place.x, place.y, place.z);
    dummy.rotation.set(0, place.yaw, 0);
    dummy.scale.set(place.sx, place.sy, place.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (tint) mesh.setColorAt(i, color.set(place.color));
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  ctx.scene.add(mesh);
}
