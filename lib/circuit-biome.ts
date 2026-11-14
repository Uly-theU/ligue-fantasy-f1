/** Ambiance d'un circuit : ciel, sol, et ce qui se tient hors du dégagement. */

export type GroundTone = 'grass' | 'sand' | 'dry' | 'tropical' | 'night' | 'night-sand';

export type CircuitBiome = {
  skyTop: string;
  skyHigh: string;
  skyHorizon: string;
  fog: string;
  ground: GroundTone;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  sun: string;
  sunIntensity: number;
  fill: number;
  exposure: number;
  /** Murs de béton. Sinon, une glissière. */
  walls: boolean;
  /** Part des emplacements qui reçoivent un arbre. */
  trees: number;
  /** Taille des arbres. 1 : rue. Les forêts montent, les Alpes encore plus. */
  treeScale: number;
  palms: boolean;
  /** Part des emplacements qui reçoivent un immeuble. */
  blocks: number;
  stands: boolean;
  night: boolean;
};

const MEADOW: CircuitBiome = {
  skyTop: '#6eaddf',
  skyHigh: '#d5e9f7',
  skyHorizon: '#f6e3c6',
  fog: '#f3d7b0',
  ground: 'grass',
  hemiSky: '#d7ecff',
  hemiGround: '#6d8a45',
  hemi: 0.82,
  sun: '#fff1d4',
  sunIntensity: 1.7,
  fill: 0.38,
  exposure: 1.08,
  walls: false,
  trees: 0.48,
  treeScale: 1.25,
  palms: false,
  blocks: 0.06,
  stands: true,
  night: false,
};

const FOREST: Partial<CircuitBiome> = {
  skyTop: '#6d90aa',
  skyHigh: '#c9d6da',
  skyHorizon: '#e3e6d6',
  fog: '#d4d6c8',
  hemiGround: '#3d6834',
  sunIntensity: 1.38,
  trees: 0.9,
  treeScale: 1.85,
  blocks: 0.02,
};

const COAST: Partial<CircuitBiome> = {
  skyTop: '#5aa3dc',
  skyHigh: '#d4eef8',
  skyHorizon: '#f7f3e8',
  fog: '#f3eadc',
  trees: 0.62,
  treeScale: 1.35,
};

const STREET: Partial<CircuitBiome> = {
  walls: true,
  treeScale: 1,
  trees: 0.04,
  blocks: 0.88,
  stands: false,
  ground: 'dry',
  hemiGround: '#8a7d62',
};

const NIGHT: Partial<CircuitBiome> = {
  skyTop: '#070b16',
  skyHigh: '#151d34',
  skyHorizon: '#242c42',
  fog: '#161c2c',
  ground: 'night',
  hemiSky: '#1a2748',
  hemiGround: '#141810',
  hemi: 0.32,
  sun: '#c5d2ef',
  sunIntensity: 0.26,
  fill: 0.07,
  exposure: 0.78,
  trees: 0.05,
  stands: false,
  night: true,
};

function withBiome(...patches: Array<Partial<CircuitBiome>>): CircuitBiome {
  return Object.assign({}, MEADOW, ...patches);
}

/** Un décor par circuit du calendrier 2026. La clé est l'id F1DB. */
export const CIRCUIT_BIOMES: Record<string, CircuitBiome> = {
  melbourne: withBiome(COAST, { trees: 0.74, blocks: 0.04 }),
  shanghai: withBiome({ trees: 0.32, blocks: 0.14, hemiGround: '#5f7a48' }),
  suzuka: withBiome(FOREST),
  miami: withBiome(STREET, COAST, {
    palms: true,
    trees: 0.38,
    blocks: 0.62,
    ground: 'tropical',
    stands: true,
    sunIntensity: 1.82,
  }),
  montreal: withBiome(COAST, {
    trees: 0.7,
    skyTop: '#6e9ec8',
    skyHigh: '#d5e4ee',
    skyHorizon: '#e7eef2',
    fog: '#dce6ea',
    hemiGround: '#4d7340',
  }),
  monaco: withBiome(STREET, {
    skyTop: '#3e86d8',
    skyHigh: '#c5e6f6',
    skyHorizon: '#f6e6cc',
    fog: '#f3e2c8',
    blocks: 0.94,
    trees: 0.02,
    hemiSky: '#d5ecff',
  }),
  catalunya: withBiome({
    ground: 'dry',
    trees: 0.34,
    hemiGround: '#8a7a40',
    skyTop: '#4e92d0',
    skyHigh: '#f0dcc0',
    skyHorizon: '#f6e6cc',
    fog: '#f0dcc0',
    sunIntensity: 1.8,
  }),
  spielberg: withBiome(FOREST, { trees: 0.82, treeScale: 2.4, skyTop: '#5f97cf', skyHigh: '#d4e6f2', fog: '#d5e0e6' }),
  silverstone: withBiome({ trees: 0.42, hemiGround: '#5e8a3c' }),
  'spa-francorchamps': withBiome(FOREST, { trees: 0.96, skyTop: '#5f849c', hemi: 0.7 }),
  hungaroring: withBiome({ trees: 0.72, sunIntensity: 1.78, hemiGround: '#6a8a38' }),
  zandvoort: withBiome(COAST, { ground: 'sand', trees: 0.2, blocks: 0, hemiGround: '#a89058' }),
  monza: withBiome({ trees: 0.7, blocks: 0.04, hemiGround: '#4e7a34' }),
  madring: withBiome({
    ground: 'dry',
    trees: 0.14,
    blocks: 0.38,
    hemiGround: '#8a7844',
    skyTop: '#4a8ed4',
    skyHorizon: '#f4e0c0',
    fog: '#edd6b4',
    sunIntensity: 1.82,
  }),
  baku: withBiome(STREET, {
    skyTop: '#4c8ed2',
    skyHigh: '#f0d8b4',
    skyHorizon: '#f6e0c0',
    fog: '#f0d6b2',
    blocks: 0.8,
    sunIntensity: 1.85,
    hemiGround: '#a08050',
  }),
  sepang: withBiome({
    ground: 'tropical',
    palms: true,
    trees: 0.58,
    skyTop: '#3f8ed4',
    skyHigh: '#c5e4f5',
    hemiGround: '#2f7a3a',
    sunIntensity: 1.8,
  }),
  'marina-bay': withBiome(STREET, NIGHT, { blocks: 0.92, ground: 'night' }),
  austin: withBiome({
    ground: 'dry',
    trees: 0.46,
    hemiGround: '#7a7040',
    skyHorizon: '#f6e2c4',
    fog: '#f0d8b4',
    sun: '#fff0d0',
    sunIntensity: 1.84,
  }),
  'mexico-city': withBiome({
    skyTop: '#2f6fc4',
    skyHigh: '#b7d6f2',
    skyHorizon: '#f6f1e6',
    fog: '#e7dcc8',
    ground: 'dry',
    trees: 0.16,
    blocks: 0.24,
    sunIntensity: 1.88,
    exposure: 1.12,
    hemiGround: '#8a7a48',
  }),
  interlagos: withBiome({
    ground: 'tropical',
    trees: 0.78,
    hemiGround: '#3a7834',
    skyTop: '#4a96d4',
    sunIntensity: 1.72,
  }),
  'las-vegas': withBiome(STREET, NIGHT, { ground: 'night-sand', blocks: 0.8, palms: true, trees: 0.08 }),
  lusail: withBiome(NIGHT, { ground: 'night-sand', blocks: 0.3, stands: true, trees: 0.02 }),
  'yas-marina': withBiome({
    skyTop: '#24345c',
    skyHigh: '#d2643e',
    skyHorizon: '#f0a56c',
    fog: '#c98462',
    ground: 'sand',
    hemiSky: '#f0b48a',
    hemiGround: '#6a5038',
    hemi: 0.55,
    sun: '#ffb07a',
    sunIntensity: 0.9,
    fill: 0.2,
    exposure: 0.98,
    palms: true,
    trees: 0.2,
    blocks: 0.42,
  }),
};

const FALLBACK = withBiome({ trees: 0.45, blocks: 0.05 });

export function biomeFor(circuitId: string | null | undefined): CircuitBiome {
  if (!circuitId) return FALLBACK;
  return CIRCUIT_BIOMES[circuitId] ?? FALLBACK;
}
