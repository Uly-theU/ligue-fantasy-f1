/**
 * Construit lib/circuits/2026/elevation.json : profil d'altitude de chaque circuit 2026,
 * exprimé en fraction du tour depuis la ligne de départ du tracé F1DB, dans le sens de la course.
 *
 * Sources :
 * - Tracés géoréférencés : bacinger/f1-circuits (MIT) — https://github.com/bacinger/f1-circuits
 * - Altitudes : Open-Meteo Elevation API, Copernicus DEM GLO-90 (CC BY 4.0) — https://open-meteo.com ;
 *   si son quota horaire est atteint, OpenTopoData SRTM 30 m (domaine public) pour le circuit entier.
 *
 * Usage : ./node_modules/.bin/tsx scripts/build-circuit-elevation.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { trackFromSvg } from '../lib/track-path';
import { align, loopLength, mod, resample, type Pt } from './loop-fit';

const DIR = path.join(process.cwd(), 'lib/circuits/2026');
const GEO_BASE = 'https://raw.githubusercontent.com/bacinger/f1-circuits/master/circuits';
const ELEVATION_API = 'https://api.open-meteo.com/v1/elevation';
const FALLBACK_API = 'https://api.opentopodata.org/v1/srtm30m';
const STEP_M = 25;
const OUTPUT_STEP_M = 50;
const FIT_POINTS = 256;
const CACHE = path.join(tmpdir(), 'clm-elevation-cache');

/** Identifiant F1DB → identifiant bacinger/f1-circuits. */
const GEO_IDS: Record<string, string> = {
  melbourne: 'au-1953',
  shanghai: 'cn-2004',
  suzuka: 'jp-1962',
  miami: 'us-2022',
  montreal: 'ca-1978',
  monaco: 'mc-1929',
  catalunya: 'es-1991',
  spielberg: 'at-1969',
  silverstone: 'gb-1948',
  'spa-francorchamps': 'be-1925',
  hungaroring: 'hu-1986',
  zandvoort: 'nl-1948',
  monza: 'it-1922',
  madring: 'es-2026',
  baku: 'az-2016',
  sepang: 'my-1999',
  'marina-bay': 'sg-2008',
  austin: 'us-2012',
  'mexico-city': 'mx-1962',
  interlagos: 'br-1940',
  'las-vegas': 'us-2023',
  lusail: 'qa-2004',
  'yas-marina': 'ae-2009',
};

type Entry = { circuit_id: string; file: string; length_km: number; direction: string };

async function main() {
  const manifest = JSON.parse(readFileSync(path.join(DIR, 'manifest.json'), 'utf8')) as Entry[];
  const circuits: Record<string, unknown> = {};
  for (const entry of manifest) {
    const geoId = GEO_IDS[entry.circuit_id];
    if (!geoId) throw new Error(`Pas de tracé géoréférencé pour ${entry.circuit_id}`);
    const geo = await fetchJson(`${GEO_BASE}/${geoId}.geojson`);
    const coords = lineOf(geo);
    const lat0 = coords.reduce((sum, [, lat]) => sum + lat, 0) / coords.length;
    const lon0 = coords.reduce((sum, [lon]) => sum + lon, 0) / coords.length;
    const kx = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const ky = 110540;
    const local = coords.map(([lon, lat]) => ({ x: (lon - lon0) * kx, y: -(lat - lat0) * ky }));
    const geoLength = loopLength(local);

    const count = Math.max(64, Math.round(geoLength / STEP_M));
    const dense = resample(local, count);
    const latLon = dense.map((p) => ({ lat: lat0 - p.y / ky, lon: lon0 + p.x / kx }));
    const sampled = await elevations(latLon);
    const z = smooth(median(sampled.z, 2), Math.max(2, Math.round(150 / STEP_M / 2)));

    const svg = readFileSync(path.join(DIR, entry.file), 'utf8');
    const track = trackFromSvg(svg);
    if (!track) throw new Error(`Tracé SVG illisible : ${entry.file}`);
    const fit = align(resample(local, FIT_POINTS), resample(track.points, FIT_POINTS));
    // Le tracé GPS part en principe de la ligne de départ (faux à Monaco et Silverstone : build-circuit-corners.ts
    // avec FIX_START=1 recale ensuite la ligne sur le virage 1 de MultiViewer) ; le dessin F1DB part d'ailleurs, parfois à l'envers.
    const start = fit.reversed ? mod(fit.shift / FIT_POINTS, 1) : mod(-fit.shift / FIT_POINTS, 1);
    const reverse = (signedArea(track.points) > 0) !== (entry.direction === 'CLOCKWISE');

    const stride = Math.max(1, Math.round(OUTPUT_STEP_M / STEP_M));
    const kept: Array<[number, number]> = [];
    for (let i = 0; i < count; i += stride) {
      const g = i / count;
      const f = fit.reversed ? mod(fit.shift / FIT_POINTS - g, 1) : mod(g - fit.shift / FIT_POINTS, 1);
      const raced = reverse ? mod(start - f, 1) : mod(f - start, 1);
      kept.push([mod(round(raced, 4), 1), z[i]]);
    }
    const base = Math.min(...kept.map(([, height]) => height));
    const points = kept
      .map(([f, height]): [number, number] => [f, round(height - base, 1)])
      .sort((a, b) => a[0] - b[0]);

    const range = Math.max(...kept.map(([, height]) => height)) - base;
    circuits[entry.circuit_id] = {
      geo_id: geoId,
      elevation_source: sampled.source,
      fit: round(fit.residual, 4),
      reverse,
      start: round(start, 4),
      geo_length_m: Math.round(geoLength),
      base_m: Math.round(base),
      range_m: round(range, 1),
      points,
    };
    console.log(
      `${entry.circuit_id.padEnd(18)} ${geoId}  fit ${fit.residual.toFixed(4)}  depart ${(start * entry.length_km * 1000).toFixed(0).padStart(5)} m${reverse ? '  SVG A L\'ENVERS' : ''}${fit.mirrored ? ' miroir' : ''}  `
      + `longueur ${(geoLength / 1000).toFixed(3)} / ${entry.length_km} km  denivele ${range.toFixed(1)} m`,
    );
  }

  writeFileSync(
    path.join(DIR, 'elevation.json'),
    `${JSON.stringify({
      sources: {
        tracks: 'bacinger/f1-circuits (MIT) — https://github.com/bacinger/f1-circuits',
        'open-meteo-copernicus-glo90': 'Open-Meteo Elevation API, Copernicus DEM GLO-90 (CC BY 4.0) — https://open-meteo.com',
        'opentopodata-srtm30m': 'OpenTopoData, NASA SRTM 30 m (domaine public) — https://www.opentopodata.org',
      },
      note: 'start = fraction du dessin F1DB où se trouve la vraie ligne de départ ; reverse = dessin F1DB à l’envers du sens officiel ; points = [fraction du tour depuis la ligne de départ dans le sens de la course, altitude en m au-dessus du point le plus bas]',
      circuits,
    }, null, 1)}\n`,
  );
  console.log('Relancer ensuite FIX_START=1 tsx scripts/build-circuit-corners.ts pour recaler les lignes de départ.');
}

/** Aire signée en coordonnées écran (y vers le bas) : positive = sens horaire. */
function signedArea(points: Pt[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area / 2;
}

function lineOf(geo: any): Array<[number, number]> {
  const geometry = geo.features?.[0]?.geometry;
  if (geometry?.type === 'LineString') return geometry.coordinates;
  if (geometry?.type === 'MultiLineString') return geometry.coordinates.flat();
  throw new Error('GeoJSON inattendu');
}

/** Un circuit entier vient d'une seule source, pour que le profil reste cohérent. */
async function elevations(points: Array<{ lat: number; lon: number }>): Promise<{ z: number[]; source: string }> {
  try {
    const z: number[] = [];
    for (let i = 0; i < points.length; i += 100) {
      const chunk = points.slice(i, i + 100);
      const url = `${ELEVATION_API}?latitude=${chunk.map((p) => p.lat.toFixed(6)).join(',')}&longitude=${chunk.map((p) => p.lon.toFixed(6)).join(',')}`;
      const data = await fetchJson(url, false);
      if (!Array.isArray(data.elevation) || data.elevation.length !== chunk.length) throw new Error('Réponse altitude inattendue');
      z.push(...data.elevation.map(Number));
    }
    return { z, source: 'open-meteo-copernicus-glo90' };
  } catch {
    const z: number[] = [];
    for (let i = 0; i < points.length; i += 100) {
      const chunk = points.slice(i, i + 100);
      const url = `${FALLBACK_API}?locations=${chunk.map((p) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`).join('|')}`;
      const data = await fetchJson(url, true);
      if (!Array.isArray(data.results) || data.results.length !== chunk.length) throw new Error('Réponse altitude inattendue');
      z.push(...data.results.map((result: { elevation: number }) => Number(result.elevation)));
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
    return { z, source: 'opentopodata-srtm30m' };
  }
}

function median(values: number[], radius: number): number[] {
  const n = values.length;
  return values.map((_, i) => {
    const window: number[] = [];
    for (let k = -radius; k <= radius; k += 1) window.push(values[mod(i + k, n)]);
    window.sort((a, b) => a - b);
    return window[radius];
  });
}

function smooth(values: number[], radius: number): number[] {
  const n = values.length;
  return values.map((_, i) => {
    let sum = 0;
    for (let k = -radius; k <= radius; k += 1) sum += values[mod(i + k, n)];
    return sum / (radius * 2 + 1);
  });
}

async function fetchJson(url: string, patient = true): Promise<any> {
  const cached = path.join(CACHE, `${createHash('sha1').update(url).digest('hex')}.json`);
  if (existsSync(cached)) return JSON.parse(readFileSync(cached, 'utf8'));
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      mkdirSync(CACHE, { recursive: true });
      writeFileSync(cached, JSON.stringify(data));
      return data;
    }
    if (!patient && response.status === 429) throw new Error('Quota atteint');
    const wait = response.status === 429 ? 5_000 : 2000 * (attempt + 1);
    console.log(`  ${response.status}, nouvel essai dans ${Math.round(wait / 1000)} s`);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  throw new Error(`Échec de ${url}`);
}

function round(value: number, digits: number): number {
  const k = 10 ** digits;
  return Math.round(value * k) / k;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
