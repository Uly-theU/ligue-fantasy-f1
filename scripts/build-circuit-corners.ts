/**
 * Construit lib/circuits/2026/corners.json : numéro officiel de chaque virage des circuits 2026,
 * placé en fraction du tour depuis la ligne de départ, dans le sens de la course (même repère que elevation.json).
 *
 * Source : fiches circuit de MultiViewer (numérotation de la FOM, tracé et position de chaque virage),
 * https://api.multiviewer.app/api/v1/circuits/<clé>/<année>. La clé de circuit est celle d'OpenF1.
 * Le tracé MultiViewer est superposé au dessin F1DB comme pour les altitudes, puis chaque virage est projeté dessus.
 *
 * Usage : ./node_modules/.bin/tsx scripts/build-circuit-corners.ts (après build-circuit-elevation.ts)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { orientTrack, pointAt, projectTrack, trackFromSvg } from '../lib/track-path';
import { align, mod, resample, type Pt } from './loop-fit';

const DIR = path.join(process.cwd(), 'lib/circuits/2026');
const API = 'https://api.multiviewer.app/api/v1/circuits';
const FIT_POINTS = 256;
const YEARS = [2026, 2025];

/** Identifiant F1DB → clé de circuit OpenF1 / MultiViewer. */
const CIRCUIT_KEYS: Record<string, number> = {
  melbourne: 10,
  shanghai: 49,
  suzuka: 46,
  miami: 151,
  montreal: 23,
  monaco: 22,
  catalunya: 15,
  spielberg: 19,
  silverstone: 2,
  'spa-francorchamps': 7,
  hungaroring: 4,
  zandvoort: 55,
  monza: 39,
  madring: 153,
  baku: 144,
  sepang: 12,
  'marina-bay': 61,
  austin: 9,
  'mexico-city': 65,
  interlagos: 14,
  'las-vegas': 152,
  lusail: 150,
  'yas-marina': 70,
};

type Entry = { circuit_id: string; file: string; turns: number };
type Sheet = { x: number[]; y: number[]; year: number; corners: Array<{ number: number; letter?: string; trackPosition: Pt }> };

const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);

type Profile = { reverse: boolean; start: number; points: Array<[number, number]>; start_source?: string };
type Corner = { number: number; at: number };

async function main() {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as Entry[];
  const elevationFile = JSON.parse(readFileSync(path.join(DIR, 'elevation.json'), 'utf8')) as { circuits: Record<string, Profile> };
  const previous = existsSync(path.join(DIR, 'corners.json'))
    ? (JSON.parse(readFileSync(path.join(DIR, 'corners.json'), 'utf8')).circuits as Record<string, unknown>)
    : {};
  const circuits: Record<string, unknown> = ONLY.length ? { ...previous } : {};
  let patched = false;
  for (const entry of manifest) {
    if (ONLY.length && !ONLY.includes(entry.circuit_id)) continue;
    const drawn = trackFromSvg(readFileSync(path.join(DIR, entry.file), 'utf8'));
    if (!drawn) throw new Error(`Tracé SVG illisible : ${entry.file}`);
    const profile = elevationFile.circuits[entry.circuit_id];
    if (!profile) throw new Error(`Pas de profil d'altitude pour ${entry.circuit_id} : lancer build-circuit-elevation.ts d'abord`);
    const key = CIRCUIT_KEYS[entry.circuit_id];
    const sheet = key == null ? null : await fetchSheet(key);

    if (!sheet) {
      const corners = detectCorners(orientTrack(drawn, profile), entry.turns);
      circuits[entry.circuit_id] = { source: 'geometry', corners };
      console.log(`${entry.circuit_id.padEnd(18)} pas de fiche MultiViewer : ${corners.length}/${entry.turns} virages déduits de la géométrie`);
      continue;
    }

    let track = orientTrack(drawn, profile);
    const outline = sheet.x.map((x, i) => ({ x, y: sheet.y[i] }));
    const dense = resample(outline, FIT_POINTS);
    let fit = align(dense, resample(track.points, FIT_POINTS));
    // Les sous-virages lettrés (1A, 12A au Hungaroring) ne font pas partie de la numérotation officielle.
    const numbered = sheet.corners.filter((corner) => !corner.letter);
    const project = (current: typeof track) => numbered
      .map((corner) => {
        const spot = fit.place(corner.trackPosition);
        // Le rang sur le contour donne l'abscisse attendue : sans lui, un virage peut tomber sur la portion voisine (Baku).
        const j = nearestIndex(dense, corner.trackPosition);
        const i = fit.reversed ? mod(fit.shift - j, FIT_POINTS) : mod(j - fit.shift, FIT_POINTS);
        const near = projectTrack(current, spot.x, spot.y, (i / FIT_POINTS) * current.length);
        return { number: corner.number, at: round(near.s / current.length, 4), off: near.distance / current.halfWidth };
      })
      .sort((a, b) => a.number - b.number);
    const ordered = (list: ReturnType<typeof project>) => {
      // Dans une enfilade serrée (vieille ville de Baku), deux virages voisins peuvent se croiser de quelques mètres.
      for (let i = 1; i < list.length; i += 1) {
        const gap = mod(list[i].at - list[0].at, 1);
        const before = mod(list[i - 1].at - list[0].at, 1);
        if (gap < before && before - gap < 0.02) list[i].at = round(mod(list[0].at + before + 0.0005, 1), 4);
      }
      return list;
    };
    let corners = ordered(project(track));

    // Le contour MultiViewer part de la ligne : son virage 1 dit où la ligne doit être.
    const t1 = numbered.find((corner) => corner.number === 1);
    const expected = t1 ? alongLoop(outline, t1.trackPosition) : null;
    const shift = expected == null ? 0 : wrapHalf(corners[0].at - expected);
    let note = '';
    if (Math.abs(shift) > START_TOLERANCE) {
      if (process.env.FIX_START) {
        const next = moveStart(profile, shift);
        elevationFile.circuits[entry.circuit_id] = next;
        patched = true;
        track = orientTrack(drawn, next);
        fit = align(dense, resample(track.points, FIT_POINTS));
        corners = ordered(project(track));
        note = `  LIGNE DÉPLACÉE de ${(shift * 100).toFixed(1)} % (start ${profile.start} → ${next.start})`;
      } else {
        note = `  LIGNE DE DÉPART DÉCALÉE de ${(shift * 100).toFixed(1)} % du tour (FIX_START=1 pour corriger)`;
      }
    }

    if (process.env.TRACE === entry.circuit_id) console.log(corners.map((corner) => `${corner.number}:${(corner.at * 100).toFixed(1)}%/${corner.off.toFixed(2)}`).join(' '));
    const disorder = corners.filter((corner, i) => i > 0 && mod(corner.at - corners[0].at, 1) < mod(corners[i - 1].at - corners[0].at, 1)).map((corner) => corner.number);
    const far = corners.filter((corner) => corner.off > 1.5).map((corner) => corner.number);
    circuits[entry.circuit_id] = {
      source: 'multiviewer',
      circuit_key: key,
      year: sheet.year,
      fit: round(fit.residual, 4),
      corners: corners.map(({ number, at }) => ({ number, at })),
    };
    console.log(
      `${entry.circuit_id.padEnd(18)} clé ${String(key).padStart(3)}  ${sheet.year}  fit ${fit.residual.toFixed(4)}  ${corners.length}/${entry.turns} virages`
      + `  T1 à ${(corners[0].at * 100).toFixed(1)} %${expected != null ? ` (attendu ${(expected * 100).toFixed(1)} %)` : ''}`
      + `${disorder.length ? `  HORS ORDRE ${disorder.join(',')}` : ''}${far.length ? `  LOIN DU TRACÉ ${far.join(',')}` : ''}${note}`,
    );
  }
  if (patched) writeFileSync(path.join(DIR, 'elevation.json'), `${JSON.stringify(elevationFile, null, 1)}\n`);
  writeFileSync(
    path.join(DIR, 'corners.json'),
    `${JSON.stringify({
      sources: {
        multiviewer: 'MultiViewer (numérotation FOM) — https://api.multiviewer.app',
        geometry: 'Pas de fiche MultiViewer : virages les plus marqués du tracé F1DB, au nombre officiel, numérotés depuis la ligne',
      },
      note: 'at = fraction du tour depuis la ligne de départ dans le sens de la course, même repère que elevation.json',
      circuits,
    }, null, 1)}\n`,
  );
}

/** Au-delà, le virage 1 du jeu n'est pas là où MultiViewer le place depuis la ligne : le tracé GPS ne part pas de la ligne. */
const START_TOLERANCE = 0.15;

/** Avance la ligne de `shift` (fraction du tour couru) et réexprime le profil depuis la nouvelle ligne. */
function moveStart(profile: Profile, shift: number): Profile {
  const start = round(mod(profile.start + (profile.reverse ? -shift : shift), 1), 4);
  const points = profile.points
    .map(([f, z]): [number, number] => [round(mod(f - shift, 1), 4), z])
    .sort((a, b) => a[0] - b[0]);
  return { ...profile, start, points, start_source: 'multiviewer-t1' };
}

/** Virages marqués du tracé quand aucune fiche n'existe : pics de changement de cap, les `count` plus forts. */
function detectCorners(track: ReturnType<typeof orientTrack>, count: number): Corner[] {
  const step = track.length / 1500;
  const window = track.length * 0.012;
  const heading = (s: number) => {
    const a = pointAt(track, s - window / 2);
    const b = pointAt(track, s + window / 2);
    return Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle));
  };
  const turn: number[] = [];
  for (let k = 0; k < 1500; k += 1) turn.push(heading(k * step));
  const peaks: Array<{ k: number; value: number }> = [];
  for (let k = 0; k < turn.length; k += 1) {
    const here = Math.abs(turn[k]);
    if (here < 0.2) continue;
    if (here >= Math.abs(turn[mod(k - 1, turn.length)]) && here > Math.abs(turn[(k + 1) % turn.length])) peaks.push({ k, value: turn[k] });
  }
  const gap = Math.round(window / step);
  const kept: typeof peaks = [];
  for (const peak of peaks.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))) {
    const clash = kept.some((other) => Math.min(mod(peak.k - other.k, turn.length), mod(other.k - peak.k, turn.length)) < gap
      && Math.sign(other.value) === Math.sign(peak.value));
    if (!clash) kept.push(peak);
    if (kept.length === count) break;
  }
  return kept
    .sort((a, b) => a.k - b.k)
    .map((peak, index) => ({ number: index + 1, at: round(peak.k / turn.length, 4) }));
}

function nearestIndex(points: Pt[], target: Pt): number {
  let best = 0;
  let bestD = Infinity;
  points.forEach((p, i) => {
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Fraction du contour parcourue depuis son premier point jusqu'au point le plus proche de `target`. */
function alongLoop(points: Pt[], target: Pt): number {
  const best = nearestIndex(points, target);
  let along = 0;
  let total = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    const seg = Math.hypot(next.x - points[i].x, next.y - points[i].y);
    if (i < best) along += seg;
    total += seg;
  }
  return total > 0 ? along / total : 0;
}

function wrapHalf(value: number): number {
  return mod(value + 0.5, 1) - 0.5;
}

async function fetchSheet(key: number): Promise<Sheet | null> {
  for (const year of YEARS) {
    const response = await fetch(`${API}/${key}/${year}`, { headers: { 'User-Agent': 'ligue-fantasy-f1 build script' } });
    if (!response.ok) continue;
    const data = await response.json() as Sheet;
    if (Array.isArray(data.x) && data.x.length > 50 && Array.isArray(data.corners) && data.corners.length > 0) return data;
  }
  return null;
}

function round(value: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
