import { CLM_STEP_SECONDS, createCar, crossingFraction, stepClm, type ClmInput } from '@/lib/clm';
import type { LapSample } from '@/lib/clm-record';
import type { ElevationSample } from '@/lib/grade';
import type { Track } from '@/lib/track-path';

/**
 * Même entrée pendant `steps` pas de physique (1/120 s).
 * Le volant est celui passé à `stepClm`, après la rampe et la courbe de réponse.
 * Les nombres restent en float64 : un arrondi changerait le temps rejoué.
 */
export type ClmInputSpan = {
  steer: number;
  throttle: number;
  brake: number;
  steps: number;
};

export type LapInputLog = {
  spans: ClmInputSpan[];
};

export type ReplayLapOptions = {
  lengthKm?: number;
  elevation?: ElevationSample[];
  runoff?: number;
};

export type ReplayLapResult =
  | {
      completed: true;
      time: number;
      sectors: [number, number, number];
      penalty: number;
      /** Même forme que le record, lue par `sampleAtTime`. Abscisse croissante. */
      samples: LapSample[];
    }
  | {
      completed: false;
      outcome: 'tour non bouclé';
    };

const SERIAL_PREFIX = 'clm1.';

export function createLapInputLog(): LapInputLog {
  return { spans: [] };
}

/** Volant dans [-1, 1], gaz et frein dans [0, 1]. Une valeur déjà dans l’intervalle n’est pas modifiée. */
export function clampClmInput(input: ClmInput): ClmInput {
  return {
    steer: clampAxis(input.steer, -1, 1),
    throttle: clampAxis(input.throttle, 0, 1),
    brake: clampAxis(input.brake, 0, 1),
  };
}

export function recordLapInput(log: LapInputLog, input: ClmInput): void {
  const step = clampClmInput(input);
  const last = log.spans[log.spans.length - 1];
  if (last && last.steer === step.steer && last.throttle === step.throttle && last.brake === step.brake) {
    last.steps += 1;
    return;
  }
  log.spans.push({ steer: step.steer, throttle: step.throttle, brake: step.brake, steps: 1 });
}

/**
 * Rejoue les plages avec le même `stepClm` que la course.
 * Les entrées hors bornes sont ramenées dans l’intervalle avant le pas.
 */
export function replayLap(track: Track, inputs: readonly ClmInputSpan[], options: ReplayLapOptions = {}): ReplayLapResult {
  const lengthKm = options.lengthKm ?? 0;
  let car = createCar(track);
  const sectorAt: [number | null, number | null] = [null, null];
  const marks = [track.length / 3, (2 * track.length) / 3];
  const samples: LapSample[] = [];

  for (const span of inputs) {
    const input = clampClmInput(span);
    const count = spanCount(span.steps);
    for (let i = 0; i < count; i += 1) {
      const prevS = car.s;
      const prevTime = car.time;
      const prevPenalty = car.penalty;
      car = stepClm(track, car, input, CLM_STEP_SECONDS, lengthKm, options.elevation, options.runoff);
      noteSectors(track.length, marks, sectorAt, prevS, prevTime, prevPenalty, car);
      if (car.finished) {
        const time = car.time;
        samples.push({ t: time, s: track.length, x: car.x, y: car.y, h: car.heading });
        return {
          completed: true,
          time,
          sectors: [sectorAt[0] ?? time, sectorAt[1] ?? time, time],
          penalty: car.penalty,
          samples,
        };
      }
      noteReplaySample(samples, car, track.length);
    }
  }

  return { completed: false, outcome: 'tour non bouclé' };
}

/**
 * Forme sérialisée des plages. Le JSON brut d’un tour clavier dépasse 20 Ko
 * parce que la rampe du volant produit une valeur nouvelle à chaque pas :
 * on garde ces valeurs exactes et on comprime le tableau.
 */
export async function serializeLapInputs(spans: readonly ClmInputSpan[]): Promise<string> {
  const json = JSON.stringify(spans.map((span) => [span.steer, span.throttle, span.brake, span.steps]));
  const compressed = await deflateRaw(new TextEncoder().encode(json));
  return SERIAL_PREFIX + encodeBase64(compressed);
}

export async function parseLapInputs(raw: string): Promise<ClmInputSpan[] | null> {
  if (!raw.startsWith(SERIAL_PREFIX)) return null;
  try {
    const json = new TextDecoder().decode(await inflateRaw(decodeBase64(raw.slice(SERIAL_PREFIX.length))));
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return null;
    const spans: ClmInputSpan[] = [];
    for (const item of value) {
      const span = spanFromRow(item);
      if (!span) return null;
      spans.push(span);
    }
    return spans;
  } catch {
    return null;
  }
}

/** Un échantillon par pas tant que l'abscisse avance. Le pas final est posé à l'arrivée. */
function noteReplaySample(
  samples: LapSample[],
  car: { time: number; s: number; x: number; y: number; heading: number },
  length: number,
): void {
  if (!(length > 0) || car.s >= length) return;
  const last = samples[samples.length - 1];
  if (last && (car.s < last.s || car.time <= last.t)) return;
  samples.push({ t: car.time, s: car.s, x: car.x, y: car.y, h: car.heading });
}

function noteSectors(
  length: number,
  marks: number[],
  sectorAt: [number | null, number | null],
  prevS: number,
  prevTime: number,
  prevPenalty: number,
  car: { s: number; time: number; penalty: number },
): void {
  if (!(length > 0)) return;
  for (let index = 0; index < marks.length; index += 1) {
    if (sectorAt[index] != null) continue;
    const fraction = crossingFraction(prevS, car.s, marks[index], length);
    if (fraction == null) continue;
    const penalty = car.penalty - prevPenalty;
    const driven = car.time - prevTime - penalty;
    sectorAt[index] = prevTime + fraction * driven + penalty;
  }
}

function spanFromRow(item: unknown): ClmInputSpan | null {
  if (!Array.isArray(item) || item.length !== 4) return null;
  const [steer, throttle, brake, steps] = item;
  if (![steer, throttle, brake, steps].every((part) => typeof part === 'number' && Number.isFinite(part))) return null;
  const count = spanCount(steps);
  if (count <= 0) return null;
  const input = clampClmInput({ steer, throttle, brake });
  return { steer: input.steer, throttle: input.throttle, brake: input.brake, steps: count };
}

function spanCount(steps: number): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.floor(steps);
}

function clampAxis(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(bytes, new CompressionStream('deflate-raw'));
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  return pipeBytes(bytes, new DecompressionStream('deflate-raw'));
}

async function pipeBytes(bytes: Uint8Array, codec: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);
  // Node 20 refuse un ArrayBuffer nu. La lecture avance avec l’écriture, sinon le tampon bloque.
  const written = writeAll(codec.writable, payload);
  const reader = codec.readable.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  await written;
  return out;
}

function writeAll(writable: WritableStream<BufferSource>, bytes: Uint8Array): Promise<void> {
  const writer = writable.getWriter();
  // Uint8Array<ArrayBufferLike> n’est pas un BufferSource pour ce TypeScript. À l’exécution, Node 20 attend bien un Uint8Array.
  return writer.write(bytes as BufferSource).then(() => writer.close());
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
