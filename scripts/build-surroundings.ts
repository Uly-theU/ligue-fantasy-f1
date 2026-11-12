/**
 * Cale les plans d'eau, les tribunes et les anciens anneaux OSM sur le tracé de chaque circuit.
 * Usage : tsx scripts/build-surroundings.ts [circuit_id]
 */
import { readFileSync, writeFileSync, writeSync } from 'node:fs';
import path from 'node:path';
import { biomeFor } from '../lib/circuit-biome';
import type { Footprint } from '../lib/circuit-scenery';
import { fitRoad, metersPerUnit } from '../lib/clm';
import { profileAt } from '../lib/grade';
import { boxOnPaint, nearestCenter } from '../lib/track-clearance';
import { orientTrack, pointAt, trackFromSvg, type Track } from '../lib/track-path';

const directory = path.join(process.cwd(), 'lib/circuits/2026');
const outFile = path.join(directory, 'surroundings.json');

const COORDS: Record<string, [number, number]> = {
  melbourne: [-37.8497, 144.968],
  shanghai: [31.3389, 121.2205],
  suzuka: [34.8431, 136.541],
  miami: [25.9581, -80.2389],
  montreal: [45.506, -73.522],
  monaco: [43.7347, 7.4206],
  catalunya: [41.57, 2.2611],
  spielberg: [47.2197, 14.7647],
  silverstone: [52.0786, -1.0169],
  'spa-francorchamps': [50.4372, 5.9714],
  hungaroring: [47.5789, 19.2486],
  zandvoort: [52.3888, 4.5409],
  monza: [45.6156, 9.2811],
  madring: [40.4653, -3.6153],
  baku: [40.3725, 49.8533],
  sepang: [2.7608, 101.7381],
  'marina-bay': [1.2914, 103.864],
  austin: [30.1328, -97.6411],
  'mexico-city': [19.4042, -99.0907],
  interlagos: [-23.7036, -46.6997],
  'las-vegas': [36.1147, -115.1728],
  lusail: [25.4901, 51.4542],
  'yas-marina': [24.4672, 54.6031],
};

type Ll = { lat: number; lon: number };
type Xy = [number, number];
type Way = { id: number; tags: Record<string, string>; pts: Ll[] };

type ManifestEntry = { circuit_id: string; file: string; length_km: number };
type Profile = { reverse: boolean; start: number; points: Array<[number, number]> };

const only = process.argv[2];

async function main() {
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'), 'utf8')) as ManifestEntry[];
  const elevation = JSON.parse(readFileSync(path.join(directory, 'elevation.json'), 'utf8')) as { circuits: Record<string, Profile> };
  const previous = JSON.parse(readFileSync(outFile, 'utf8')) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...previous };
  for (const race of manifest) {
    if (only && race.circuit_id !== only) continue;
    const coords = COORDS[race.circuit_id];
    if (!coords) continue;
    log(`${race.circuit_id} …`);
    try {
      const built = await buildOne(race, elevation.circuits[race.circuit_id], coords);
      if (built.fit_m > 42) {
        log(`  calage ${built.fit_m} m — eau précédente conservée`);
        continue;
      }
      const prev = previous[race.circuit_id] as { stands?: unknown; blocks?: unknown; loops?: unknown } | undefined;
      out[race.circuit_id] = {
        ...built,
        stands: prev?.stands ?? built.stands,
        blocks: prev?.blocks ?? built.blocks,
        loops: prev?.loops ?? built.loops,
      };
      log(`  fit ${built.fit_m} m · eau ${built.waters.length} · nappes ${built.sheets.length} · rives ${built.shores.length} · tribunes ${built.stands.length} · immeubles ${built.blocks.length} · anneaux ${built.loops.length}`);
    } catch (error) {
      log(`  échec (${error instanceof Error ? error.message : 'réseau'})`);
    }
    writeFileSync(outFile, JSON.stringify(out));
    await sleep(400);
  }
}

async function buildOne(race: ManifestEntry, profile: Profile, [lat, lon]: [number, number]) {
  const drawn = trackFromSvg(readFileSync(path.join(directory, race.file), 'utf8'))!;
  const raced = orientTrack(drawn, profile);
  const track = fitRoad(raced, race.length_km, (s) => profileAt(profile.points, raced.length > 0 ? s / raced.length : 0));
  const mpu = metersPerUnit(track, race.length_km);
  const fetched = await fetchScene(lat, lon);
  const ways = fetched.ways;
  const raceways = ways.filter((way) => way.tags.highway === 'raceway' && way.pts.length > 4);
  const gpWays = raceways.filter((way) => !isHistoric(way.tags) && !isPit(way.tags));
  const historicWays = raceways.filter((way) => isHistoric(way.tags));
  const candidates = fetched.lines.slice();
  const traced = follow(gpWays.map((way) => way.pts), 450);
  if (traced.length > 8) candidates.push(traced);
  let aligned: PlacedChain | null = null;
  for (const candidate of candidates) {
    const fit = align(track, [candidate], race.length_km);
    if (fit && (!aligned || fit.errorM < aligned.errorM)) aligned = fit;
  }
  if (!aligned) {
    const lengths = candidates.map((candidate) => Math.round(lengthOf(candidate, lat, lon))).sort((a, b) => b - a).slice(0, 6);
    log(`  aucune ligne dans la fenêtre (${race.length_km} km) : ${lengths.join(', ') || 'vide'}`);
  }
  const empty = { fit_m: aligned?.errorM ?? 999, waters: [] as Xy[][], sheets: [] as Xy[][], shores: [] as Xy[][], stands: [] as Footprint[], blocks: [] as Footprint[], loops: [] as Xy[][] };
  if (!aligned || aligned.errorM > 42) return { ...empty, fit_m: round(aligned?.errorM ?? 999) };

  const islands = await fetchIslands(lat, lon);
  if (islands.length) log(`  îles candidates ${islands.length}`);
  const laid = layoutWater(ways, islands, aligned.apply, track, mpu);
  const waters = laid.waters;
  const sheets = laid.sheets;

  const biome = biomeFor(race.circuit_id);
  const stands: Footprint[] = [];
  const blocks: Footprint[] = [];
  for (const way of ways) {
    if (!way.tags.building) continue;
    const ring = way.pts.map((pt) => aligned.apply(pt.lat, pt.lon));
    const box = footprintOf(ring);
    if (!box) continue;
    const cleared = shove(track, box, track.halfWidth * 0.04);
    if (!cleared) continue;
    const nearest = nearestCenter(track, cleared.x, cleared.y);
    const heading = pointAt(track, nearest.s).angle;
    const lengthM = cleared.length * mpu;
    const depthM = cleared.depth * mpu;
    const distM = nearest.distance * mpu;
    if (lengthM < 12 || lengthM > 280 || distM > 75) continue;
    const parallel = headingDelta(cleared.angle, heading) < 0.5;
    const placed: Footprint = { ...cleared, s: round(nearest.s), lift: 0 };
    if (parallel && lengthM > 20 && lengthM / Math.max(depthM, 0.1) > 2.1) stands.push(placed);
    else if (distM < 50 && lengthM > 14 && (biome.walls || lengthM > 36)) blocks.push(placed);
    if (stands.length + blocks.length > 400) break;
  }

  const loops: Xy[][] = [];
  for (const chain of stitch(historicWays.map((way) => way.pts), 90)) {
    const lenM = lengthOf(chain, lat, lon);
    if (lenM < 800) continue;
    const ring = simplify(chain.map((pt) => aligned.apply(pt.lat, pt.lon)), 10 / mpu);
    if (ring.length < 8) continue;
    loops.push(ring.map(roundPt));
  }

  return {
    fit_m: round(aligned.errorM),
    waters,
    sheets,
    shores: [],
    stands: dedupe(stands).slice(0, 160),
    blocks: dedupe(blocks).slice(0, 200),
    loops: loops.slice(0, 6),
  };
}

function footprintOf(ring: Xy[]): Omit<Footprint, 's' | 'lift'> | null {
  if (ring.length < 3) return null;
  let best: Omit<Footprint, 's' | 'lift'> | null = null;
  let bestArea = Infinity;
  const step = Math.max(1, Math.floor(ring.length / 16));
  for (let i = 0; i < ring.length; i += step) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const edge = Math.atan2(b[1] - a[1], b[0] - a[0]);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const cos = Math.cos(-edge);
    const sin = Math.sin(-edge);
    for (const [x, y] of ring) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    }
    const width = maxX - minX;
    const height = maxY - minY;
    const area = width * height;
    if (!(area > 0) || area >= bestArea) continue;
    bestArea = area;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const long = width >= height;
    best = {
      x: round(cx * Math.cos(edge) - cy * Math.sin(edge)),
      y: round(cx * Math.sin(edge) + cy * Math.cos(edge)),
      angle: round(long ? edge : edge + Math.PI / 2),
      length: round(long ? width : height),
      depth: round(long ? height : width),
    };
  }
  return best;
}

function shove(track: Track, box: Omit<Footprint, 's' | 'lift'>, margin: number): Omit<Footprint, 's' | 'lift'> | null {
  const hit = (x: number, y: number, length = box.length, depth = box.depth) => boxOnPaint(track, x, y, box.angle, length, depth, margin);
  if (!hit(box.x, box.y)) return box;
  const nearest = nearestCenter(track, box.x, box.y);
  const spot = pointAt(track, nearest.s);
  let dx = box.x - spot.x;
  let dy = box.y - spot.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-3) return null;
  dx /= len;
  dy /= len;
  for (let step = 1; step <= 10; step += 1) {
    const shift = box.depth * 0.18 * step;
    const x = box.x + dx * shift;
    const y = box.y + dy * shift;
    if (!hit(x, y)) return { ...box, x: round(x), y: round(y) };
  }
  for (let depth = box.depth * 0.75; depth > box.length * 0.12; depth *= 0.75) {
    if (!hit(box.x, box.y, box.length, depth)) return { ...box, depth: round(depth) };
  }
  return null;
}

type PlacedChain = { chain: Ll[]; errorM: number; apply: (lat: number, lon: number) => Xy };

function align(track: Track, chains: Ll[][], lengthKm: number): PlacedChain | null {
  let best: PlacedChain | null = null;
  for (const chain of chains) {
    const lenM = lengthOf(chain, chain[0].lat, chain[0].lon);
    if (lenM < lengthKm * 1000 * 0.65 || lenM > lengthKm * 1000 * 1.28) continue;
    const fitted = fitChain(track, chain, lenM);
    if (fitted && (!best || fitted.errorM < best.errorM)) best = { chain, ...fitted };
  }
  return best;
}

function fitChain(track: Track, chain: Ll[], lenM: number): { errorM: number; apply: (lat: number, lon: number) => Xy } | null {
  const lat0 = chain.reduce((sum, pt) => sum + pt.lat, 0) / chain.length;
  const lon0 = chain.reduce((sum, pt) => sum + pt.lon, 0) / chain.length;
  const local = chain.map((pt) => project(pt, lat0, lon0));
  const scale = track.length / lenM;
  const n = 80;
  const src = resample(local, n, true);
  const dst = resample(track.points.map((pt) => [pt.x, pt.y] as Xy), n, true);
  if (src.length < n || dst.length < n) return null;
  let best = Infinity;
  let pick = { cos: 1, sin: 0, ocx: 0, ocy: 0, tcx: 0, tcy: 0, mirror: 1 };
  for (const mirror of [1, -1]) {
    const mirrored = src.map(([x, y]) => [x, y * mirror] as Xy);
    for (const reverse of [false, true]) {
      for (let shift = 0; shift < n; shift += 1) {
        let ocx = 0;
        let ocy = 0;
        let tcx = 0;
        let tcy = 0;
        const pairs: Array<[Xy, Xy]> = [];
        for (let i = 0; i < n; i += 1) {
          const j = reverse ? (shift - i + n) % n : (shift + i) % n;
          pairs.push([mirrored[i], dst[j]]);
          ocx += mirrored[i][0];
          ocy += mirrored[i][1];
          tcx += dst[j][0];
          tcy += dst[j][1];
        }
        ocx /= n;
        ocy /= n;
        tcx /= n;
        tcy /= n;
        let a = 0;
        let b = 0;
        for (const [p, q] of pairs) {
          const px = (p[0] - ocx) * scale;
          const py = (p[1] - ocy) * scale;
          a += px * (q[0] - tcx) + py * (q[1] - tcy);
          b += px * (q[1] - tcy) - py * (q[0] - tcx);
        }
        const theta = Math.atan2(b, a);
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        let err = 0;
        for (const [p, q] of pairs) {
          const px = (p[0] - ocx) * scale;
          const py = (p[1] - ocy) * scale;
          const x = px * cos - py * sin + tcx;
          const y = px * sin + py * cos + tcy;
          err += Math.hypot(x - q[0], y - q[1]);
        }
        err /= n;
        if (err < best) {
          best = err;
          pick = { cos, sin, ocx, ocy, tcx, tcy, mirror };
        }
      }
    }
  }
  const mpu = (track.length > 0 ? lenM / track.length : 1);
  return {
    errorM: best * mpu,
    apply: (lat, lon) => {
      const p = project({ lat, lon }, lat0, lon0);
      const px = (p[0] - pick.ocx) * scale;
      const py = (p[1] * pick.mirror - pick.ocy) * scale;
      return [px * pick.cos - py * pick.sin + pick.tcx, px * pick.sin + py * pick.cos + pick.tcy];
    },
  };
}

function project(pt: Ll, lat0: number, lon0: number): Xy {
  const x = (pt.lon - lon0) * 111320 * Math.cos((lat0 * Math.PI) / 180);
  const y = (pt.lat - lat0) * 111320;
  return [x, y];
}

function lengthOf(chain: Ll[], lat0: number, lon0: number): number {
  const pts = chain.map((pt) => project(pt, lat0, lon0));
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  if (chain.length > 2) {
    const gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
    if (gap < 40) len += gap;
  }
  return len;
}

function growEnds(pieces: Ll[][], maxGap: number): Ll[] {
  const unused = pieces.map((pts) => pts.slice()).filter((pts) => pts.length > 1);
  if (!unused.length) return [];
  let start = 0;
  let longest = -1;
  for (let i = 0; i < unused.length; i += 1) {
    const len = lengthOf(unused[i], unused[i][0].lat, unused[i][0].lon);
    if (len > longest) {
      longest = len;
      start = i;
    }
  }
  const chain = unused.splice(start, 1)[0];
  while (unused.length) {
    const tail = chain[chain.length - 1];
    const head = chain[0];
    let pick = -1;
    let gap = maxGap;
    let reverse = false;
    let atHead = false;
    for (let i = 0; i < unused.length; i += 1) {
      const way = unused[i];
      const options: Array<[number, boolean, boolean]> = [
        [metersBetween(tail, way[0]), false, false],
        [metersBetween(tail, way[way.length - 1]), true, false],
        [metersBetween(head, way[0]), false, true],
        [metersBetween(head, way[way.length - 1]), true, true],
      ];
      for (const [distance, flipped, headJoin] of options) {
        if (distance >= gap) continue;
        pick = i;
        gap = distance;
        reverse = flipped;
        atHead = headJoin;
      }
    }
    if (pick < 0) break;
    const next = reverse ? unused.splice(pick, 1)[0].reverse() : unused.splice(pick, 1)[0];
    if (atHead) chain.unshift(...next.slice(0, -1));
    else chain.push(...next.slice(1));
  }
  return chain;
}

function follow(ways: Ll[][], maxGap: number): Ll[] {
  const unused = ways.map((way) => way.slice()).filter((way) => way.length > 1);
  if (!unused.length) return [];
  let start = 0;
  let longest = -1;
  for (let i = 0; i < unused.length; i += 1) {
    const len = lengthOf(unused[i], unused[i][0].lat, unused[i][0].lon);
    if (len > longest) {
      longest = len;
      start = i;
    }
  }
  const chain = unused.splice(start, 1)[0];
  while (unused.length) {
    const tail = chain[chain.length - 1];
    let pick = -1;
    let next: Ll[] | null = null;
    let gap = maxGap;
    for (let i = 0; i < unused.length; i += 1) {
      const way = unused[i];
      for (let k = 0; k < way.length; k += 1) {
        const distance = metersBetween(tail, way[k]);
        if (distance >= gap) continue;
        const forward = way.slice(k);
        const backward = way.slice(0, k + 1).reverse();
        const candidate = overlap(chain, forward) <= overlap(chain, backward) ? forward : backward;
        if (candidate.length < 2 || overlap(chain, candidate) > 0.55) continue;
        pick = i;
        next = candidate;
        gap = distance;
      }
    }
    if (pick < 0 || !next) break;
    unused.splice(pick, 1);
    chain.push(...next.slice(1));
  }
  return chain;
}

function overlap(chain: Ll[], way: Ll[]): number {
  const tail = chain[chain.length - 1];
  let close = 0;
  let counted = 0;
  for (const point of way) {
    if (metersBetween(point, tail) < 40) continue;
    counted += 1;
    let best = Infinity;
    for (let i = 0; i < chain.length; i += 6) best = Math.min(best, metersBetween(point, chain[i]));
    if (best < 18) close += 1;
  }
  if (counted < 3) return 0;
  return close / counted;
}

function metersBetween(a: Ll, b: Ll): number {
  const dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111320;
  return Math.hypot(dx, dy);
}

function stitch(ways: Ll[][], meters: number): Ll[][] {
  const unused = ways.map((way) => way.slice());
  const chains: Ll[][] = [];
  const near = (a: Ll, b: Ll) => {
    const dx = (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180);
    const dy = (a.lat - b.lat) * 111320;
    return Math.hypot(dx, dy) < meters;
  };
  while (unused.length) {
    let chain = unused.pop()!;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < unused.length; i += 1) {
        const way = unused[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        let next: Ll[] | null = null;
        if (near(tail, way[0])) next = chain.concat(way.slice(1));
        else if (near(tail, way[way.length - 1])) next = chain.concat(way.slice(0, -1).reverse());
        else if (near(head, way[way.length - 1])) next = way.concat(chain.slice(1));
        else if (near(head, way[0])) next = way.slice().reverse().concat(chain.slice(1));
        if (!next) continue;
        chain = next;
        unused.splice(i, 1);
        grew = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

function resample(points: Xy[], count: number, close: boolean): Xy[] {
  if (points.length < 2) return [];
  const ring = close && Math.hypot(points[0][0] - points[points.length - 1][0], points[0][1] - points[points.length - 1][1]) < 1
    ? points.slice(0, -1)
    : points;
  const cum = [0];
  for (let i = 1; i < ring.length; i += 1) cum.push(cum[i - 1] + Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]));
  if (close) cum.push(cum[cum.length - 1] + Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]));
  const length = cum[cum.length - 1];
  const out: Xy[] = [];
  let seg = 0;
  for (let i = 0; i < count; i += 1) {
    const target = (i / count) * length;
    while (seg < cum.length - 2 && cum[seg + 1] < target - 1e-6) seg += 1;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-6 ? (target - cum[seg]) / span : 0;
    const a = ring[seg % ring.length];
    const b = ring[(seg + 1) % ring.length];
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

function boundsOf(track: Track, pad: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of track.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

function clipPoly(ring: Xy[], box: { minX: number; minY: number; maxX: number; maxY: number }): Xy[] {
  let output = ring;
  const edges: Array<(p: Xy) => boolean> = [
    (p) => p[0] >= box.minX,
    (p) => p[0] <= box.maxX,
    (p) => p[1] >= box.minY,
    (p) => p[1] <= box.maxY,
  ];
  const cuts: Array<(a: Xy, b: Xy) => Xy> = [
    (a, b) => hit(a, b, box.minX, 0),
    (a, b) => hit(a, b, box.maxX, 0),
    (a, b) => hit(a, b, box.minY, 1),
    (a, b) => hit(a, b, box.maxY, 1),
  ];
  for (let e = 0; e < 4; e += 1) {
    const input = output;
    output = [];
    for (let i = 0; i < input.length; i += 1) {
      const a = input[i];
      const b = input[(i + 1) % input.length];
      const ain = edges[e](a);
      const bin = edges[e](b);
      if (ain && bin) output.push(b);
      else if (ain && !bin) output.push(cuts[e](a, b));
      else if (!ain && bin) output.push(cuts[e](a, b), b);
    }
    if (output.length < 3) return [];
  }
  return output;
}

function hit(a: Xy, b: Xy, edge: number, axis: 0 | 1): Xy {
  const other = axis === 0 ? 1 : 0;
  const denom = (b[axis] - a[axis]) || 1e-9;
  const t = (edge - a[axis]) / denom;
  const p: Xy = [0, 0];
  p[axis] = edge;
  p[other] = a[other] + (b[other] - a[other]) * t;
  return p;
}

function clipLine(ring: Xy[], box: { minX: number; minY: number; maxX: number; maxY: number }): Xy[] {
  const inside = (p: Xy) => p[0] >= box.minX && p[0] <= box.maxX && p[1] >= box.minY && p[1] <= box.maxY;
  const kept = ring.filter((point, index) => inside(point) || (index > 0 && inside(ring[index - 1])) || (index + 1 < ring.length && inside(ring[index + 1])));
  return simplify(kept, 0);
}

function simplify(points: Xy[], min: number): Xy[] {
  if (!points.length) return [];
  const out: Xy[] = [points[0]];
  for (const point of points) {
    const last = out[out.length - 1];
    if (Math.hypot(point[0] - last[0], point[1] - last[1]) >= Math.max(min, 1e-6)) out.push(point);
  }
  return out;
}

function polyLength(ring: Xy[]): number {
  let length = 0;
  for (let i = 1; i < ring.length; i += 1) {
    length += Math.hypot(ring[i].x - ring[i - 1].x, ring[i].y - ring[i - 1].y);
  }
  return length;
}

function closed(pts: Ll[], meters: number): boolean {
  if (pts.length < 4) return false;
  const a = pts[0];
  const b = pts[pts.length - 1];
  const lat = (a.lat + b.lat) / 2;
  const dx = (a.lon - b.lon) * 111320 * Math.cos((lat * Math.PI) / 180);
  const dy = (a.lat - b.lat) * 111320;
  return Math.hypot(dx, dy) < meters;
}

function shoelace(ring: Xy[]): number {
  let area = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function headingDelta(a: number, b: number): number {
  let delta = Math.abs(a - b) % Math.PI;
  if (delta > Math.PI / 2) delta = Math.PI - delta;
  return delta;
}

function dedupe(boxes: Footprint[]): Footprint[] {
  const kept: Footprint[] = [];
  for (const box of boxes) {
    if (kept.some((other) => Math.hypot(other.x - box.x, other.y - box.y) < Math.min(box.length, other.length) * 0.35)) continue;
    kept.push(box);
  }
  return kept;
}

function isHistoric(tags: Record<string, string>): boolean {
  const name = `${tags.name ?? ''} ${tags.note ?? ''}`;
  return /sopraelevata|alta velocit|anello/i.test(name);
}

function isPit(tags: Record<string, string>): boolean {
  return /pit/i.test(tags.name ?? '');
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundPt(point: Xy): Xy {
  return [round(point[0]), round(point[1])];
}



type Box = { minX: number; minY: number; maxX: number; maxY: number };

/** Lacs et ports gardés tels quels. Mer, fleuve et tour d'île deviennent une nappe, pas un rectangle. */
function layoutWater(
  ways: Way[],
  islands: Ll[][],
  apply: (lat: number, lon: number) => Xy,
  track: Track,
  mpu: number,
): { waters: Xy[][]; sheets: Xy[][] } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of track.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const span = Math.max(maxX - minX, maxY - minY, 1);
  const reach = Math.max(260 / mpu, Math.min(span * 0.24, 640 / mpu));
  const bounds = boundsOf(track, reach);
  const waters: Xy[][] = [];
  const coasts: Xy[][] = [];
  for (const way of ways) {
    if (way.tags.highway === 'raceway' || way.tags.building || way.tags.place === 'island') continue;
    const projected = simplify(way.pts.map((pt) => apply(pt.lat, pt.lon)), 8 / mpu);
    if (way.tags.natural === 'coastline') {
      const line = clipLine(projected, bounds);
      if (line.length > 3) coasts.push(line);
      continue;
    }
    if (ornament(way.tags)) continue;
    const watery = way.tags.natural === 'water' || way.tags.water || way.tags.leisure === 'marina'
      || way.tags.landuse === 'basin' || way.tags.landuse === 'reservoir' || way.tags.landuse === 'harbour';
    if (!watery || !closed(way.pts, 30)) continue;
    const clipped = clipPoly(projected, bounds);
    if (clipped.length < 4) continue;
    const area = Math.abs(shoelace(clipped));
    if (area < 400 / (mpu * mpu)) continue;
    const cover = coverFraction(clipped, track);
    const framed = frameShare(clipped, bounds);
    if (framed > 0.28 && area * mpu * mpu > 30000) continue;
    if (cover > 0.42 && (area * mpu * mpu > 50000 || framed > 0.4)) continue;
    waters.push(clipped.map(roundPt));
  }
  waters.sort((a, b) => Math.abs(shoelace(b)) - Math.abs(shoelace(a)));

  let host: Xy[] | null = null;
  let hostArea = Infinity;
  for (const chain of islands) {
    if (!closed(chain, 90)) continue;
    const ring = openRing(simplify(chain.map((pt) => apply(pt.lat, pt.lon)), 14 / mpu));
    if (ring.length < 8 || coverFraction(ring, track) < 0.55) continue;
    const area = Math.abs(shoelace(ring));
    if (area < hostArea) {
      host = ring;
      hostArea = area;
    }
  }

  const kept = waters.filter((ring) => !host || !floodsIsland(ring, host)).slice(0, 16);
  const sheets: Xy[][] = [];
  if (host) sheets.push(...band(host, reach, shoelace(host) >= 0 ? 1 : -1, track, bounds, true));
  const pieces: Xy[][] = [];
  for (const line of coasts) pieces.push(...splitJump(line, 70 / mpu));
  for (const chain of stitchXy(pieces, 22 / mpu)) {
    const runs = splitWhen(chain, (pt) => coastBlocked(pt, kept, host, 16 / mpu));
    for (const run of runs) {
      if (run.length < 4) continue;
      const len = polyLength(run);
      if (len < 70 / mpu) continue;
      const end = Math.hypot(run[0][0] - run[run.length - 1][0], run[0][1] - run[run.length - 1][1]);
      if (len < 320 / mpu && len > end * 2.6) continue;
      const smooth = simplifyDP(run, 20 / mpu);
      if (smooth.length < 2) continue;
      sheets.push(...band(smooth, reach, seaSide(smooth, reach, track), track, bounds, false));
    }
  }
  return { waters: kept, sheets: sheets.slice(0, 800) };
}

function floodsIsland(water: Xy[], island: Xy[]): boolean {
  const wet = boundsOfRing(water);
  const isle = boundsOfRing(island);
  const width = Math.max(1e-6, isle.maxX - isle.minX);
  const height = Math.max(1e-6, isle.maxY - isle.minY);
  const overlapW = Math.max(0, Math.min(wet.maxX, isle.maxX) - Math.max(wet.minX, isle.minX)) / width;
  const overlapH = Math.max(0, Math.min(wet.maxY, isle.maxY) - Math.max(wet.minY, isle.minY)) / height;
  return overlapW > 0.55 && overlapH > 0.55 && Math.abs(shoelace(water)) > Math.abs(shoelace(island)) * 0.18;
}

function boundsOfRing(ring: Xy[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of ring) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return { minX, minY, maxX, maxY };
}

function ornament(tags: Record<string, string>): boolean {
  if (tags.amenity === 'fountain' || tags.fountain || tags.water === 'fountain') return true;
  if (tags.intermittent === 'yes') return true;
  if (tags['demolished:natural'] || tags.location === 'underground' || tags.tunnel === 'yes') return true;
  return tags.water === 'wastewater' || tags.water === 'sewage';
}

function coverFraction(ring: Xy[], track: Track): number {
  const step = Math.max(1, Math.floor(track.points.length / 70));
  let inside = 0;
  let total = 0;
  for (let i = 0; i < track.points.length; i += step) {
    total += 1;
    if (pointInRing(ring, track.points[i].x, track.points[i].y)) inside += 1;
  }
  return total ? inside / total : 0;
}

function frameShare(ring: Xy[], box: Box): number {
  const eps = Math.max(1.5, (box.maxX - box.minX) * 0.004);
  let on = 0;
  for (const point of ring) {
    if (
      Math.abs(point[0] - box.minX) <= eps || Math.abs(point[0] - box.maxX) <= eps
      || Math.abs(point[1] - box.minY) <= eps || Math.abs(point[1] - box.maxY) <= eps
    ) on += 1;
  }
  return ring.length ? on / ring.length : 0;
}

function pointInRing(ring: Xy[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const cross = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
    if (cross) inside = !inside;
  }
  return inside;
}

function distToSeg(point: Xy, a: Xy, b: Xy): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy || 1e-9;
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / len));
  return Math.hypot(point[0] - (a[0] + dx * t), point[1] - (a[1] + dy * t));
}

function distToRing(point: Xy, ring: Xy[]): number {
  let best = Infinity;
  for (let i = 0; i < ring.length; i += 1) best = Math.min(best, distToSeg(point, ring[i], ring[(i + 1) % ring.length]));
  return best;
}

function coastBlocked(point: Xy, waters: Xy[][], island: Xy[] | null, margin: number): boolean {
  if (island && (pointInRing(island, point[0], point[1]) || distToRing(point, island) <= margin)) return true;
  return waters.some((ring) => pointInRing(ring, point[0], point[1]) || distToRing(point, ring) <= margin);
}

function openRing(ring: Xy[]): Xy[] {
  if (ring.length > 2 && Math.hypot(ring[0][0] - ring[ring.length - 1][0], ring[0][1] - ring[ring.length - 1][1]) < 1) {
    return ring.slice(0, -1);
  }
  return ring;
}

function splitJump(line: Xy[], max: number): Xy[][] {
  if (!line.length) return [];
  const runs: Xy[][] = [[line[0]]];
  for (let i = 1; i < line.length; i += 1) {
    const prev = line[i - 1];
    if (Math.hypot(line[i][0] - prev[0], line[i][1] - prev[1]) > max) runs.push([]);
    runs[runs.length - 1].push(line[i]);
  }
  return runs.filter((run) => run.length > 1);
}

function splitWhen(line: Xy[], blocked: (point: Xy) => boolean): Xy[][] {
  const runs: Xy[][] = [];
  let current: Xy[] = [];
  for (const point of line) {
    if (blocked(point)) {
      if (current.length) runs.push(current);
      current = [];
    } else current.push(point);
  }
  if (current.length) runs.push(current);
  return runs;
}

function stitchXy(parts: Xy[][], gap: number): Xy[][] {
  const unused = parts.map((part) => part.slice()).filter((part) => part.length > 1);
  const chains: Xy[][] = [];
  const near = (a: Xy, b: Xy) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= gap;
  while (unused.length) {
    let chain = unused.pop()!;
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = 0; i < unused.length; i += 1) {
        const way = unused[i];
        const head = chain[0];
        const tail = chain[chain.length - 1];
        let next: Xy[] | null = null;
        if (near(tail, way[0])) next = chain.concat(way.slice(1));
        else if (near(tail, way[way.length - 1])) next = chain.concat(way.slice().reverse().slice(1));
        else if (near(head, way[way.length - 1])) next = way.concat(chain.slice(1));
        else if (near(head, way[0])) next = way.slice().reverse().concat(chain.slice(1));
        if (!next) continue;
        chain = next;
        unused.splice(i, 1);
        grew = true;
        break;
      }
    }
    chains.push(chain);
  }
  return chains;
}

function edgeNormal(a: Xy, b: Xy, side: number): [number, number] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  return [(dy / len) * side, (-dx / len) * side];
}

function seaSide(line: Xy[], reach: number, track: Track): number {
  let right = 0;
  let left = 0;
  const step = Math.max(1, Math.floor(line.length / 14));
  const probe = reach * 0.35;
  for (let i = 0; i < line.length - 1; i += step) {
    const a = line[i];
    const b = line[Math.min(line.length - 1, i + 1)];
    const [nx, ny] = edgeNormal(a, b, 1);
    right += nearestCenter(track, a[0] + nx * probe, a[1] + ny * probe).distance;
    left += nearestCenter(track, a[0] - nx * probe, a[1] - ny * probe).distance;
  }
  return right >= left ? 1 : -1;
}

function stopAtTrack(origin: Xy, nx: number, ny: number, maxReach: number, track: Track): number {
  const home = nearestCenter(track, origin[0], origin[1]);
  if (home.distance < track.halfWidth * 1.6) return 0;
  const step = Math.max(track.halfWidth, maxReach / 10);
  let reach = maxReach;
  for (let dist = step; dist < maxReach; dist += step) {
    const hit = nearestCenter(track, origin[0] + nx * dist, origin[1] + ny * dist);
    let along = Math.abs(hit.s - home.s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along > track.length * 0.035 && hit.distance < track.halfWidth * 2.2) {
      reach = Math.max(step, dist - step);
      break;
    }
  }
  return reach;
}

function densify(line: Xy[], max: number, closed: boolean): Xy[] {
  if (line.length < 2) return line.slice();
  const out: Xy[] = [];
  const count = closed ? line.length : line.length - 1;
  for (let i = 0; i < count; i += 1) {
    const a = line[i];
    const b = line[(i + 1) % line.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(len / Math.max(max, 1e-3)));
    for (let s = 0; s < steps; s += 1) {
      const t = s / steps;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (!closed) out.push(line[line.length - 1]);
  return out;
}

function simplifyDP(points: Xy[], epsilon: number): Xy[] {
  if (points.length < 3) return points.slice();
  let max = 0;
  let index = 0;
  const a = points[0];
  const b = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = distToSeg(points[i], a, b);
    if (distance > max) {
      max = distance;
      index = i;
    }
  }
  if (max <= epsilon) return [a, b];
  const left = simplifyDP(points.slice(0, index + 1), epsilon);
  const right = simplifyDP(points.slice(index), epsilon);
  return left.slice(0, -1).concat(right);
}

function band(line: Xy[], reach: number, side: number, track: Track, bounds: Box, closed: boolean): Xy[][] {
  const source = closed ? openRing(line) : line;
  const dense = densify(source, Math.max(8, reach * 0.12), closed);
  const hole = closed ? source : null;
  const count = dense.length;
  const edges = closed ? count : count - 1;
  const quads: Xy[][] = [];
  for (let i = 0; i < edges; i += 1) {
    const a = dense[i];
    const b = dense[(i + 1) % count];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-3) continue;
    const [nx, ny] = edgeNormal(a, b, side);
    const width = Math.min(
      stopAtTrack(a, nx, ny, reach, track),
      stopAtTrack(b, nx, ny, reach, track),
    );
    if (width < track.halfWidth * 2.5) continue;
    const outerB: Xy = [b[0] + nx * width, b[1] + ny * width];
    const outerA: Xy = [a[0] + nx * width, a[1] + ny * width];
    const midX = (a[0] + b[0] + outerA[0] + outerB[0]) / 4;
    const midY = (a[1] + b[1] + outerA[1] + outerB[1]) / 4;
    if (hole && pointInRing(hole, midX, midY)) continue;
    const inner = nearestCenter(track, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2).distance;
    const outer = nearestCenter(track, (outerA[0] + outerB[0]) / 2, (outerA[1] + outerB[1]) / 2).distance;
    if (outer + track.halfWidth < inner) continue;
    const clipped = clipPoly([a, b, outerB, outerA], bounds);
    if (clipped.length < 3 || Math.abs(shoelace(clipped)) < 4) continue;
    quads.push(clipped.map(roundPt));
  }
  return quads;
}

type Scene = { ways: Way[]; lines: Ll[][] };

type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{ type: string; role?: string; geometry?: Array<{ lat: number; lon: number }> }>;
};

const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

async function overpass(query: string): Promise<OverpassElement[]> {
  let last = 'overpass';
  for (const endpoint of OVERPASS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'text/plain', 'user-agent': 'ligue-fantasy-f1 surroundings' },
        body: query,
        signal: AbortSignal.timeout(40000),
      });
      if (!response.ok) {
        last = `${response.status}`;
        continue;
      }
      const json = await response.json() as { elements?: OverpassElement[] };
      return json.elements ?? [];
    } catch (error) {
      last = error instanceof Error ? error.message : 'réseau';
    }
  }
  throw new Error(last);
}

async function fetchIslands(lat: number, lon: number): Promise<Ll[][]> {
  let listed: OverpassElement[] = [];
  try {
    listed = await overpass(`
[out:json][timeout:25];
(
  relation["place"="island"](around:3600,${lat},${lon});
  way["place"="island"](around:3600,${lat},${lon});
);
out tags bb;
`);
  } catch {
    return [];
  }
  const small = listed.filter((element) => {
    const box = element.bounds;
    if (!box) return false;
    const dx = (box.maxlon - box.minlon) * 111320 * Math.cos(((box.minlat + box.maxlat) / 2) * Math.PI / 180);
    const dy = (box.maxlat - box.minlat) * 111320;
    const span = Math.hypot(dx, dy);
    return span > 200 && span < 8000;
  });
  if (!small.length) return [];
  await sleep(300);
  const relations = small.filter((element) => element.type === 'relation').map((element) => element.id);
  const wayIds = small.filter((element) => element.type === 'way').map((element) => element.id);
  let query = '[out:json][timeout:30];(';
  if (relations.length) query += `relation(id:${relations.join(',')});`;
  if (wayIds.length) query += `way(id:${wayIds.join(',')});`;
  query += ');out geom;';
  let geom: OverpassElement[] = [];
  try {
    geom = await overpass(query);
  } catch {
    return [];
  }
  const found: Ll[][] = [];
  for (const element of geom) {
    if (element.type === 'way' && element.geometry && element.geometry.length > 8) {
      const pts = element.geometry.map((pt) => ({ lat: pt.lat, lon: pt.lon }));
      if (closed(pts, 70)) found.push(pts);
    }
    if (element.type === 'relation' && element.members) {
      const pieces = element.members
        .filter((member) => member.type === 'way' && member.geometry && member.geometry.length > 1 && member.role !== 'inner')
        .map((member) => member.geometry!.map((pt) => ({ lat: pt.lat, lon: pt.lon })));
      const ring = closeRing(pieces);
      if (ring.length > 12 && ring.length < 2500 && closed(ring, 90)) found.push(ring);
    }
  }
  return found;
}

async function fetchScene(lat: number, lon: number): Promise<Scene> {
  const landscape = await ask(`
[out:json][timeout:35];
(
  way["highway"="raceway"](around:3400,${lat},${lon});
  relation["type"~"circuit|raceway"](around:3400,${lat},${lon});
  relation["route"="raceway"](around:3400,${lat},${lon});
  way["natural"="water"](around:2400,${lat},${lon});
  way["water"](around:2400,${lat},${lon});
  way["natural"="coastline"](around:2600,${lat},${lon});
  way["leisure"="marina"](around:2400,${lat},${lon});
  way["landuse"="basin"](around:2400,${lat},${lon});
  way["landuse"="reservoir"](around:2400,${lat},${lon});
  way["landuse"="harbour"](around:2400,${lat},${lon});
  relation["leisure"="marina"](around:2400,${lat},${lon});
  relation["landuse"="harbour"](around:2400,${lat},${lon});
  relation["natural"="water"]["water"!~"river|canal|sea"](around:2400,${lat},${lon});
);
out geom;
`);
  const race = landscape.ways.filter((way) => way.tags.highway === 'raceway' && way.pts.length > 2);
  if (!race.length) return landscape;
  let minLat = 90;
  let minLon = 180;
  let maxLat = -90;
  let maxLon = -180;
  for (const way of race) {
    for (const pt of way.pts) {
      minLat = Math.min(minLat, pt.lat);
      maxLat = Math.max(maxLat, pt.lat);
      minLon = Math.min(minLon, pt.lon);
      maxLon = Math.max(maxLon, pt.lon);
    }
  }
  const pad = 0.0006;
  try {
    const built = await ask(`
[out:json][timeout:35][bbox:${minLat - pad},${minLon - pad},${maxLat + pad},${maxLon + pad}];
way["building"];
out geom;
`);
    return { ways: landscape.ways.concat(built.ways), lines: landscape.lines };
  } catch {
    return landscape;
  }
}

async function ask(query: string): Promise<Scene> {
  const elements = await overpass(query);
  const ways: Way[] = [];
  const lines: Ll[][] = [];
  const seen = new Set<number>();
  for (const element of elements) {
        if (element.type === 'way' && element.geometry && !seen.has(element.id)) {
          seen.add(element.id);
          ways.push({
            id: element.id,
            tags: element.tags ?? {},
            pts: element.geometry.map((pt) => ({ lat: pt.lat, lon: pt.lon })),
          });
        }
        const tags = element.tags ?? {};
        const basin = tags.natural === 'water' || tags.water || tags.leisure === 'marina' || tags.landuse === 'harbour' || tags.landuse === 'basin';
        if (element.type === 'relation' && element.members && basin && tags.water !== 'river' && tags.water !== 'canal' && tags.water !== 'sea') {
          const pieces = element.members
            .filter((member) => member.type === 'way' && member.geometry && member.geometry.length > 1 && member.role !== 'inner')
            .map((member) => member.geometry!.map((pt) => ({ lat: pt.lat, lon: pt.lon })));
          const ring = closeRing(pieces);
          if (ring.length > 12 && ring.length < 2200) {
            ways.push({ id: element.id, tags: { ...tags, natural: 'water', water: tags.water ?? tags.leisure ?? 'lake' }, pts: ring });
          }
        }
        if (element.type === 'relation' && element.members && /circuit|raceway/.test(`${element.tags?.type ?? ''} ${element.tags?.route ?? ''}`)) {
          for (const line of orderCircuit(element.members)) {
            if (line.length > 12) lines.push(line);
          }
        }
  }
  return { ways, lines };
}

function orderCircuit(members: Array<{ type: string; role?: string; geometry?: Array<{ lat: number; lon: number }> }>): Ll[][] {
  const pieces = members
    .filter((member) => member.type === 'way' && member.role !== 'pit_lane' && member.geometry && member.geometry.length > 1)
    .map((member) => member.geometry!.map((pt) => ({ lat: pt.lat, lon: pt.lon })));
  return [walkOrdered(pieces), follow(pieces, 60), growEnds(pieces, 80), growEnds(pieces, 180)];
}

function closeRing(pieces: Ll[][]): Ll[] {
  if (!pieces.length) return [];
  const rest = pieces.map((pts) => pts.slice());
  let chain = rest.shift()!;
  while (rest.length) {
    const tail = chain[chain.length - 1];
    let best = -1;
    let bestGap = 220;
    let reverse = false;
    for (let i = 0; i < rest.length; i++) {
      const forward = metersBetween(tail, rest[i][0]);
      const back = metersBetween(tail, rest[i][rest[i].length - 1]);
      if (forward < bestGap) {
        bestGap = forward;
        best = i;
        reverse = false;
      }
      if (back < bestGap) {
        bestGap = back;
        best = i;
        reverse = true;
      }
    }
    if (best < 0) break;
    const next = reverse ? rest.splice(best, 1)[0].reverse() : rest.splice(best, 1)[0];
    chain = chain.concat(next.slice(1));
  }
  if (chain.length > 2 && metersBetween(chain[0], chain[chain.length - 1]) < 250) chain.push(chain[0]);
  return chain;
}

function walkOrdered(pieces: Ll[][]): Ll[] {
  let best: Ll[] = [];
  let bestLen = 0;
  let chain: Ll[] = [];
  const commit = () => {
    const len = chain.length > 1 ? lengthOf(chain, chain[0].lat, chain[0].lon) : 0;
    if (len > bestLen) {
      best = chain;
      bestLen = len;
    }
  };
  for (const pts of pieces) {
    if (!chain.length) {
      chain = pts.slice();
      continue;
    }
    const tail = chain[chain.length - 1];
    const forward = metersBetween(tail, pts[0]);
    const back = metersBetween(tail, pts[pts.length - 1]);
    if (Math.min(forward, back) > 80) {
      commit();
      chain = pts.slice();
      continue;
    }
    const next = back < forward ? pts.slice().reverse() : pts;
    chain = chain.concat(next.slice(1));
  }
  commit();
  return best;
}

function log(message: string) {
  writeSync(1, `${message}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
