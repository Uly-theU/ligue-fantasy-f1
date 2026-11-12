import { gradeAccel, sampleElevation, type ElevationSample } from '@/lib/grade';
import { bankAt, localTrack, narrowTrack, nearestTrack, paintedHalf, paintedHalfAt, pointAt, type Track } from '@/lib/track-path';

/** Pointe en ligne droite, proche d'un piège à vitesse de Formule 1. */
export const TOP_SPEED_KMH = 345;
/** Accélération latérale de pointe, ordre de grandeur d'un pneu de Formule 1. */
const PEAK_GRIP_G = 5.6;
const LAUNCH_SECONDS = 0.42;
const BRAKE_SECONDS = 1.45;
/** Dans l'herbe, la vitesse tend vers cette part de la pointe, à ce rythme (par seconde). */
const GRASS_RATIO = 0.4;
const GRASS_DRAG = 2;
const GRASS_GRIP_G = 1.6;
const GRASS_TRACTION = 0.55;
/** Le dégagement est libre jusqu'à ce multiple de la limite peinte ; au-delà, un mur souple ramène vers la piste. */
export const RUNOFF_RATIO = 1.8;
/** En ville le rail est au bord de la piste : le mur s'arrête juste après la peinture. */
export const STREET_RUNOFF_RATIO = 1.12;
/** Contre le mur, le gaz ne rend que cette part de l'accélération. */
const WALL_ACCEL = 0.35;
/** Part de vitesse cédée lors d'un choc franc dans le mur. */
const IMPACT_LOSS = 0.45;
/** Couper : au-delà de cette marge (en demi-largeurs), le tracé gagné hors piste est repris en temps. */
const CUT_SLACK = 1.5;
/** Au-delà de cette part du tour sautée d'un coup, ce n'est plus une coupe : la voiture est remise en piste. */
const MAX_CUT_RATIO = 0.15;
const CUT_BASE_SECONDS = 1;
/** Le tracé gagné est compté comme roulé à cette part de la pointe : une chicane coupée ne doit jamais rapporter. */
const CUT_SPEED_RATIO = 0.2;
const PEAK_SLIP = 0.1;
/** Braquage maximal, en fraction de l'adhérence : pleine direction = au bord de la limite, sans la dépasser. */
const LOCK_AT_LIMIT = 0.95;
const LOCK_BRAKING = 1.15;
const STEER_IN = 3.2;
const STEER_OUT = 6;
const STEER_FAST_DAMP = 0.45;
const STEER_CURVE = 1.5;

/**
 * Les touches tournent le volant progressivement : plus on garde la touche, plus on braque.
 * À haute vitesse le volant tourne moins vite, pour qu'une touche effleurée corrige sans faire zigzaguer.
 */
export function rampSteer(current: number, target: number, dt: number, speedRatio = 0): number {
  const goal = clamp(target, -1, 1);
  if (current === goal) return goal;
  const dir = Math.sign(goal - current);
  const centering = current !== 0 && dir === -Math.sign(current);
  const stop = centering && Math.sign(goal) !== Math.sign(current) ? 0 : goal;
  const rateIn = STEER_IN * (1 - STEER_FAST_DAMP * clamp(speedRatio, 0, 1));
  const next = current + dir * (centering ? STEER_OUT : rateIn) * Math.max(0, dt);
  return dir > 0 ? Math.min(stop, next) : Math.max(stop, next);
}

/** Courbe de réponse : les petits braquages comptent peu, la pleine course reste entière. */
export function steerResponse(steer: number): number {
  const value = clamp(steer, -1, 1);
  return Math.sign(value) * Math.abs(value) ** STEER_CURVE;
}

export type ClmInput = {
  steer: number;
  brake: number;
  throttle: number;
};

export type ClmCar = {
  x: number;
  y: number;
  heading: number;
  vx: number;
  vy: number;
  speed: number;
  s: number;
  seen: number;
  time: number;
  finished: boolean;
  offTrack: boolean;
  accel: number;
  brake: number;
  /** Abscisse au moment de quitter la piste, et chemin parcouru dehors depuis. */
  offFrom: number | null;
  offPath: number;
  /** Secondes de pénalité déjà ajoutées au chrono pour des virages coupés. */
  penalty: number;
  /** Nombre de remises en piste au point de sortie. */
  rescues: number;
};

export function topSpeed(track: Track, lengthKm = 0): number {
  if (track.length <= 0) return 0;
  const km = lengthKm > 0 ? lengthKm : 4.304;
  return (track.length * TOP_SPEED_KMH) / (km * 3600);
}

/** Largeur hors-tout de la Ferrari F2004, et largeur d'asphalte d'un circuit de Grade 1. */
export const CAR_WIDTH_M = 1.796;
export const ROAD_WIDTH_M = 12;
/**
 * Demi-largeur jouable, en mètres. Les tracés F1DB sont bien plus larges ; on les ramène ici.
 * La voiture est dessinée à l'échelle de cette largeur : plus la piste est large, plus elle paraît lente.
 */
export const ROAD_HALF_M = 14;

export function metersPerUnit(track: Track, lengthKm = 0): number {
  return ((lengthKm > 0 ? lengthKm : 4.304) * 1000) / Math.max(track.length, 1e-6);
}

/**
 * Les dessins F1DB n'ont pas tous la même échelle : le trait y fait 41 m (Monaco) à 93 m (Monza).
 * On ramène la largeur à la référence, sans élargir un dessin serré où les portions se chevaucheraient.
 */
export function fitRoad(track: Track, lengthKm = 0, heightAt?: (s: number) => number): Track {
  const halfWidth = Math.min(track.halfWidth, ROAD_HALF_M / metersPerUnit(track, lengthKm));
  return narrowTrack(halfWidth === track.halfWidth ? track : { ...track, halfWidth }, heightAt);
}

export function createCar(track: Track): ClmCar {
  const start = track.points[0];
  return {
    x: start.x,
    y: start.y,
    heading: start.angle,
    vx: 0,
    vy: 0,
    speed: 0,
    s: 0,
    seen: 0,
    time: 0,
    finished: false,
    offTrack: false,
    accel: 0,
    brake: 0,
    offFrom: null,
    offPath: 0,
    penalty: 0,
    rescues: 0,
  };
}

/**
 * Le pas de progression ignore les sauts d'un bout à l'autre du circuit.
 * Le tour n'est bouclé qu'après avoir vraiment parcouru le tracé, dans le sens de la marche.
 */
export function noteLap(prevS: number, nextS: number, seen: number, length: number): { s: number; seen: number; finished: boolean } {
  const ahead = wrapForward(prevS, nextS, length);
  const back = wrapForward(nextS, prevS, length);
  if (Math.min(ahead, back) > length * 0.04) return { s: prevS, seen, finished: false };
  const finished = ahead < back && ahead < length * 0.04 && prevS > length * 0.85 && nextS < length * 0.15 && seen > length * 0.75;
  return { s: nextS, seen: finished ? seen : Math.max(seen, nextS), finished };
}

export function stepClm(
  track: Track,
  car: ClmCar,
  input: ClmInput,
  dt: number,
  lengthKm = 0,
  elevation?: ElevationSample[],
  runoff = RUNOFF_RATIO,
): ClmCar {
  if (car.finished) return car;
  let state = car;
  let left = Math.max(0, Math.min(dt, 2));
  while (left > 0) {
    const slice = Math.min(1 / 120, left);
    state = integrate(track, state, input, slice, lengthKm, elevation, runoff);
    left -= slice;
    if (state.finished) break;
  }
  return state;
}

export function speedKmh(speed: number, trackLength: number, lengthKm: number): number {
  if (trackLength <= 0 || lengthKm <= 0) return 0;
  return (speed / trackLength) * lengthKm * 3600;
}

export function formatLap(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return `${minutes}:${rest.toFixed(3).padStart(6, '0')}`;
}

/** Le Grand Prix du jour reste jouable jusqu'à minuit UTC. */
export function nextRaceFrom(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

function integrate(
  track: Track,
  car: ClmCar,
  input: ClmInput,
  dt: number,
  lengthKm: number,
  elevation?: ElevationSample[],
  runoff = RUNOFF_RATIO,
): ClmCar {
  const max = topSpeed(track, lengthKm);
  const steer = clamp(input.steer, -1, 1);
  const throttle = clamp(input.throttle, 0, 1);
  const braking = input.brake > 0.2;
  let vx = car.vx;
  let vy = car.vy;
  if (Math.hypot(vx, vy) < 1e-3 && car.speed > 1e-3) {
    vx = Math.cos(car.heading) * car.speed;
    vy = Math.sin(car.heading) * car.speed;
  }

  let speed = Math.hypot(vx, vy);
  const speedRatio = max > 0 ? Math.min(1, speed / max) : 0;
  const meters = ((lengthKm > 0 ? lengthKm : 4.304) * 1000) / Math.max(track.length, 1e-6);
  const road = elevation?.length
    ? sampleElevation(elevation, car.s, track.length, meters, speed * meters, track.closed)
    : { grade: 0, load: 1 };
  const traction = car.offTrack ? GRASS_TRACTION : 1 - throttle * Math.abs(steer) * speedRatio * 0.4;
  const grip = car.offTrack ? GRASS_GRIP_G : PEAK_GRIP_G;
  const aMax = (grip * 9.81 * Math.max(0.35, traction) * road.load) / meters;
  const turnRate = 1.15 + 1.35 * (1 - speedRatio) + (braking ? 0.95 : 0);
  const baseGrip = (grip * 9.81 * road.load) / meters;
  const gripYaw = (baseGrip * (braking ? LOCK_BRAKING : LOCK_AT_LIMIT)) / Math.max(speed, 1e-3);
  const peakSlip = Math.max(0.06, PEAK_SLIP - (braking ? 0 : throttle * Math.abs(steer) * 0.03));
  const priorSlip = Math.abs(Math.atan2(
    vx * Math.sin(car.heading) - vy * Math.cos(car.heading),
    Math.max(0.25, vx * Math.cos(car.heading) + vy * Math.sin(car.heading)),
  ));
  const aligning = Math.max(0.25, 1 - Math.max(0, priorSlip / peakSlip - 1) * 0.6);
  const heading = car.heading + steer * Math.min(turnRate, gripYaw) * aligning * dt;
  const hx = Math.cos(heading);
  const hy = Math.sin(heading);
  const leftX = hy;
  const leftY = -hx;

  let forward = vx * hx + vy * hy;
  let lateral = vx * leftX + vy * leftY;
  const slip = Math.atan2(lateral, Math.max(0.25, forward));
  const slipRatio = Math.abs(slip) / peakSlip;
  const curve = slipRatio <= 1
    ? Math.sin(slipRatio * Math.PI / 2)
    : Math.max(0.42, 1 - (slipRatio - 1) * 0.38);
  const latAccel = Math.abs(slip) < 1e-4 ? 0 : -Math.sign(slip) * aMax * curve;
  const longRoom = Math.sqrt(Math.max(0, aMax * aMax - latAccel * latAccel));
  const alongNow = localTrack(track, car.x, car.y, car.s);
  const alongLimit = paintedHalfAt(track, alongNow.s);
  const alongWall = alongLimit * runoff;
  // Un repère d'abscisse périmé est loin : ce n'est pas un mur, on ne déplace pas la voiture.
  const onWall = Number.isFinite(alongNow.distance)
    && alongNow.distance >= alongWall * 0.985
    && alongNow.distance < alongWall * 3;
  let forwardAccel = 0;
  if (braking) {
    forwardAccel = -max / BRAKE_SECONDS;
  } else if (throttle > 0.05 && max > 0) {
    const launch = (max / LAUNCH_SECONDS) * throttle;
    forwardAccel = launch - (launch / (max * max)) * forward * Math.abs(forward);
  } else {
    forwardAccel = -forward * 0.22;
  }
  forwardAccel = clamp(forwardAccel, -longRoom, longRoom);
  if (onWall && forwardAccel > 0) forwardAccel *= WALL_ACCEL;
  const gripRoom = aMax > 1e-6 ? longRoom / aMax : 0;
  const accel = (!braking && throttle > 0.05 ? clamp(gripRoom, 0, 1) : 0) * (onWall ? WALL_ACCEL : 1);
  const brakeLevel = braking ? clamp(gripRoom, 0, 1) : 0;
  forwardAccel += gradeAccel(road.grade) / meters;
  // Presque à l'arrêt, l'angle de dérive tend vers 90° : sans ce facteur, la traînée annule le gaz et la voiture reste plantée.
  const scrub = max > 0 ? clamp(forward / (max * 0.12), 0, 1) : 0;
  if (slipRatio > 1) forwardAccel -= speed * (slipRatio - 1) * 0.9 * scrub;
  if (forward < 0) forwardAccel = Math.max(0, forwardAccel);
  forward = Math.max(0, forward + forwardAccel * dt);
  lateral += latAccel * dt;
  // Le dévers pousse vers le bord bas : dans un virage relevé, c'est vers l'intérieur.
  if (!car.offTrack) lateral += (9.81 * Math.sin(bankAt(track, car.s)) / meters) * dt;
  vx = hx * forward + leftX * lateral;
  vy = hy * forward + leftY * lateral;
  speed = Math.hypot(vx, vy);
  if (speed > max) {
    vx *= max / speed;
    vy *= max / speed;
    speed = max;
  }

  let x = car.x + vx * dt;
  let y = car.y + vy * dt;

  const limit = paintedHalf(track);
  const local = localTrack(track, x, y, car.s);
  const nearest = nearestTrack(track, x, y);
  const localLimit = paintedHalfAt(track, local.s);
  const nearestLimit = paintedHalfAt(track, nearest.s);
  const guidedOnPaint = local.distance <= localLimit;
  // L'autre bord d'une épingle est à une largeur de piste le long du tour (Fairmont) : ce n'est pas le tronçon en cours.
  const sameSection = alongTrack(nearest.s, local.s, track.length) <= Math.max(track.halfWidth, track.length * 0.004);
  const nearestHere = sameSection && alongTrack(nearest.s, car.s, track.length) <= track.length * 0.04;
  // Pont ou passage inférieur : les deux tracés se superposent en plan. On ne change pas de portion.
  const bridge = track.closed && !nearestHere && stackedOn(track, local.s, nearest.s);
  // Déjà dehors, la voiture qui retrouve l'asphalte d'une autre portion reprend la piste là : la coupe est reprise en temps.
  // Il faut avoir quitté son propre dégagement : un simple débordement près d'une portion voisine (Monaco) n'y téléporte pas.
  const rejoinElsewhere = track.closed && car.offTrack && !nearestHere && !bridge && nearest.distance <= nearestLimit
    && local.distance > localLimit * RUNOFF_RATIO * 0.8;
  const onPaint = guidedOnPaint || (nearestHere && nearest.distance <= nearestLimit) || rejoinElsewhere;
  const offTrack = !onPaint;
  if (offTrack) {
    const anchor = nearestHere ? nearest : local;
    const wall = (nearestHere ? nearestLimit : localLimit) * runoff;
    const touching = Number.isFinite(anchor.distance) && anchor.distance >= wall * 0.985 && anchor.distance < wall * 3;
    if (touching && anchor.distance > wall) {
      const excess = anchor.distance - wall;
      const nx = (x - anchor.x) / anchor.distance;
      const ny = (y - anchor.y) / anchor.distance;
      // Le rail arrête la voiture où elle le touche. On ne la ramène pas au milieu de la piste.
      x -= nx * excess;
      y -= ny * excess;
      const outward = vx * nx + vy * ny;
      if (outward > 0) {
        vx -= nx * outward;
        vy -= ny * outward;
      }
      const severity = clamp(Math.max(0, outward) / Math.max(speed, 1) + excess / Math.max(wall, 1), 0, 1);
      const keep = 1 - severity * IMPACT_LOSS;
      vx *= keep;
      vy *= keep;
      speed = Math.hypot(vx, vy);
    } else if (!touching) {
      const cap = max * GRASS_RATIO;
      if (speed > cap) {
        const next = speed + (cap - speed) * Math.min(1, dt * GRASS_DRAG);
        const scale = next / speed;
        vx *= scale;
        vy *= scale;
        speed = next;
      }
    }
  }

  let s = car.s;
  let seen = car.seen;
  let finished = false;
  const lost = local.distance > Math.max(limit * 3, track.length * 0.05);
  if (track.closed && !bridge && nearest.distance <= nearestLimit && !guidedOnPaint && (lost || nearestHere || rejoinElsewhere)) {
    s = nearest.s;
    seen = car.seen;
  } else if (
    track.closed
    && local.distance <= localLimit * RUNOFF_RATIO
    && alongTrack(local.s, car.s, track.length) <= Math.max(track.halfWidth, track.length * 0.004)
  ) {
    // On suit le tronçon en cours, y compris dans le dégagement : l'autre bord de l'épingle ne devient pas l'abscisse.
    const noted = noteLap(car.s, local.s, car.seen, track.length);
    const clean = local.distance <= track.halfWidth * 1.05 && speed > max * 0.04;
    if (noted.finished && !clean) {
      s = car.s;
      seen = car.seen;
    } else {
      s = noted.s;
      seen = noted.seen;
      finished = noted.finished;
    }
  }

  let offFrom = car.offFrom;
  let offPath = car.offPath;
  let penalty = car.penalty;
  let time = car.time + dt;
  if (offTrack) {
    if (offFrom == null) {
      offFrom = car.s;
      offPath = 0;
    }
    offPath += speed * dt;
  } else if (offFrom != null) {
    const gained = wrapForward(offFrom, s, track.length);
    // Une portion bien plus loin dans le tour (Interlagos, le huit de Suzuka) n'est pas un raccourci : retour au point de sortie.
    if (gained > track.length * MAX_CUT_RATIO && gained < track.length / 2) return rescue(track, car, offFrom, dt);
    const cut = cutPenalty(gained, offPath, track, max);
    penalty += cut;
    time += cut;
    offFrom = null;
    offPath = 0;
  }

  return {
    x,
    y,
    heading,
    vx,
    vy,
    speed,
    s,
    seen,
    time,
    finished,
    offTrack,
    accel,
    brake: brakeLevel,
    offFrom,
    offPath,
    penalty,
    rescues: car.rescues,
  };
}

/** Les deux abscisses sont un pont : leurs tracés se croisent en plan, sans être le même virage. */
function stackedOn(track: Track, sA: number, sB: number): boolean {
  const reach = Math.max(paintedHalf(track) * 8, track.length * 0.03);
  // 2,5 demi-largeurs : les rubans se touchent. L'échantillon rate parfois le point le plus proche.
  const close = paintedHalf(track) * 2.5;
  const apart = Math.max(paintedHalf(track) * 8, track.length * 0.08);
  for (const da of [-1, -0.5, 0, 0.5, 1]) {
    const p = pointAt(track, sA + da * reach);
    for (const db of [-1, -0.5, 0, 0.5, 1]) {
      const q = pointAt(track, sB + db * reach);
      if (alongTrack(p.s, q.s, track.length) < apart) continue;
      if (Math.hypot(p.x - q.x, p.y - q.y) <= close) return true;
    }
  }
  return false;
}

function rescue(track: Track, car: ClmCar, s: number, dt: number): ClmCar {
  const spot = pointAt(track, s);
  return {
    ...car,
    x: spot.x,
    y: spot.y,
    heading: spot.angle,
    vx: 0,
    vy: 0,
    speed: 0,
    s,
    time: car.time + dt,
    offTrack: false,
    accel: 0,
    brake: 0,
    offFrom: null,
    offPath: 0,
    rescues: car.rescues + 1,
  };
}

/**
 * Élargir dans le dégagement fait parcourir au moins autant que le tracé : rien à reprendre.
 * Couper fait gagner plus de tracé qu'on n'a roulé dehors ; le gain est repris, et plus encore, en temps.
 */
export function cutPenalty(gained: number, driven: number, track: Track, max: number): number {
  if (max <= 0 || gained > track.length / 2) return 0;
  const saved = gained - driven - track.halfWidth * CUT_SLACK;
  if (saved <= 0) return 0;
  return Math.round((CUT_BASE_SECONDS + saved / (max * CUT_SPEED_RATIO)) * 10) / 10;
}

function wrapForward(from: number, to: number, length: number): number {
  if (length <= 0) return 0;
  let delta = (to - from) % length;
  if (delta < 0) delta += length;
  return delta;
}

function alongTrack(a: number, b: number, length: number): number {
  if (length <= 0) return Math.abs(a - b);
  return Math.min(wrapForward(a, b, length), wrapForward(b, a, length));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
