import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOP_SPEED_KMH, createCar, cutPenalty, fitRoad, formatLap, nextRaceFrom, noteLap, rampSteer, RUNOFF_RATIO, speedKmh, stepClm, STREET_RUNOFF_RATIO, topSpeed } from '@/lib/clm';
import { profileAt } from '@/lib/grade';
import { narrowAt, narrowTrack, nearestTrack, orientTrack, paintedHalf, paintedHalfAt, pointAt, projectTrack, trackFromSvg } from '@/lib/track-path';

const SQUARE = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M10 10 H110 V110 H10 Z"/></svg>';
const STRAIGHT = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 50 H400"/></svg>';
const SEMICIRCLE = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="8" d="M0 0 A10 10 0 0 1 0 20"/></svg>';

describe('tracé SVG', () => {
  it('ferme un carré de 400 unités et reste sur la ligne', () => {
    const track = trackFromSvg(SQUARE);
    expect(track).not.toBeNull();
    expect(track!.closed).toBe(true);
    expect(track!.halfWidth).toBe(10);
    expect(track!.length).toBeCloseTo(400, 0);
    const onLine = projectTrack(track!, 60, 10, 0);
    expect(onLine.distance).toBeLessThan(0.25);
    expect(onLine.s).toBeGreaterThan(40);
    expect(onLine.s).toBeLessThan(60);
  });

  it('fait avancer l’abscisse en continu à l’extérieur d’un angle', () => {
    const track = trackFromSvg(SQUARE)!;
    const corner = track.points.reduce((best, point) => (Math.hypot(point.x - 110, point.y - 10) < Math.hypot(best.x - 110, best.y - 10) ? point : best));
    const values: number[] = [];
    for (let k = 0; k <= 30; k += 1) {
      const theta = -Math.PI / 2 + (k / 30) * (Math.PI / 2);
      values.push(projectTrack(track, 110 + 8 * Math.cos(theta), 10 + 8 * Math.sin(theta), corner.s).s);
    }
    const steps = values.slice(1).map((value, index) => value - values[index]);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps)).toBeLessThan((values[values.length - 1] - values[0]) / 5);
  });

  it('ne saute pas vers un autre tronçon du circuit', () => {
    const folded = '<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 0 H25 V12 H0"/></svg>';
    const track = trackFromSvg(folded)!;
    const stayed = projectTrack(track, 15, 10, 15);
    expect(stayed.s).toBeGreaterThan(10);
    expect(stayed.s).toBeLessThan(28);
  });

  it('ne téléporte pas vers la portion d’à côté quand les rubans se frôlent', () => {
    const folded = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 0 H120 V8 H0"/></svg>')!;
    const outbound = pointAt(folded, 40);
    const beside = stepClm(folded, {
      ...createCar(folded),
      x: outbound.x,
      y: outbound.y + paintedHalf(folded) + 4,
      s: outbound.s,
      heading: outbound.angle,
      speed: topSpeed(folded, 1) * 0.5,
      vx: Math.cos(outbound.angle) * topSpeed(folded, 1) * 0.5,
      vy: Math.sin(outbound.angle) * topSpeed(folded, 1) * 0.5,
    }, { steer: 0, brake: 0, throttle: 1 }, 0.4, 1);
    expect(alongTrack(beside.s, outbound.s, folded.length)).toBeLessThan(folded.length * 0.08);
  });

  it('reste sur l’asphalte même si le repère d’abscisse est ailleurs', () => {
    const svg = readFileSync(path.join(process.cwd(), 'lib/__tests__/fixtures/mexico-city-outline.svg'), 'utf8');
    const track = trackFromSvg(svg)!;
    const spot = pointAt(track, track.length * 0.62);
    const stale = pointAt(track, track.length * 0.12);
    expect(nearestTrack(track, spot.x, spot.y).distance).toBeLessThan(0.5);
    let car = {
      ...createCar(track),
      x: spot.x,
      y: spot.y,
      s: stale.s,
      heading: spot.angle,
      speed: 0,
      vx: 0,
      vy: 0,
    };
    car = stepClm(track, car, { steer: 0, brake: 0, throttle: 1 }, 0.6, 4.304);
    expect(car.offTrack).toBe(false);
    expect(car.speed).toBeGreaterThan(topSpeed(track, 4.304) * 0.15);
    expect(alongTrack(car.s, spot.s, track.length)).toBeLessThan(track.length * 0.08);

    const side = pointAt(track, track.length * 0.4);
    const grassX = side.x + Math.cos(side.angle + Math.PI / 2) * paintedHalf(track) * 2.2;
    const grassY = side.y + Math.sin(side.angle + Math.PI / 2) * paintedHalf(track) * 2.2;
    const off = stepClm(track, {
      ...createCar(track),
      x: grassX,
      y: grassY,
      s: side.s,
      heading: side.angle,
      speed: topSpeed(track, 4.304) * 0.4,
      vx: Math.cos(side.angle) * topSpeed(track, 4.304) * 0.4,
      vy: Math.sin(side.angle) * topSpeed(track, 4.304) * 0.4,
    }, { steer: 0, brake: 0, throttle: 0 }, 1 / 60, 4.304);
    expect(nearestTrack(track, grassX, grassY).distance).toBeGreaterThan(paintedHalf(track));
    expect(off.offTrack).toBe(true);
  });

  it('déplace la ligne de départ et retourne le sens du tour', () => {
    const square = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 0 H100 V100 H0 Z"/></svg>')!;
    const moved = orientTrack(square, { reverse: false, start: 0.125 });
    expect(moved.points[0].x).toBeCloseTo(50, 1);
    expect(moved.points[0].y).toBeCloseTo(0, 1);
    expect(Math.cos(moved.points[0].angle)).toBeCloseTo(1, 3);
    expect(moved.length).toBeCloseTo(square.length, 3);
    expect(pointAt(moved, 75).x).toBeCloseTo(100, 1);
    expect(pointAt(moved, 75).y).toBeCloseTo(25, 1);

    const flipped = orientTrack(square, { reverse: true, start: 0.125 });
    expect(flipped.points[0].x).toBeCloseTo(50, 1);
    expect(Math.cos(flipped.points[0].angle)).toBeCloseTo(-1, 3);
    expect(pointAt(flipped, 75).x).toBeCloseTo(0, 1);
    expect(pointAt(flipped, 75).y).toBeCloseTo(25, 1);
  });

  it('mesure un demi-cercle', () => {
    const track = trackFromSvg(SEMICIRCLE);
    expect(track).not.toBeNull();
    expect(track!.length).toBeCloseTo(Math.PI * 10, 0);
  });

  it('lit le tracé large de Mexico, pas le trait fin', () => {
    const svg = readFileSync(path.join(process.cwd(), 'lib/__tests__/fixtures/mexico-city-outline.svg'), 'utf8');
    const track = trackFromSvg(svg);
    expect(track).not.toBeNull();
    expect(track!.closed).toBe(true);
    expect(track!.halfWidth).toBe(10);
    expect(track!.length).toBeGreaterThan(600);
    expect(track!.length).toBeLessThan(2200);
    expect(track!.points.length).toBeGreaterThan(80);
  });
});

describe('contre-la-montre', () => {
  it('formate le chrono et la vitesse', () => {
    expect(formatLap(65.432)).toBe('1:05.432');
    expect(formatLap(9.5)).toBe('0:09.500');
    expect(formatLap(Number.NaN)).toBe('—');
    expect(speedKmh(10, 100, 4)).toBeCloseTo(1440, 5);
    const mexico = trackFromSvg(readFileSync(path.join(process.cwd(), 'lib/__tests__/fixtures/mexico-city-outline.svg'), 'utf8'))!;
    expect(speedKmh(topSpeed(mexico, 4.304), mexico.length, 4.304)).toBeCloseTo(TOP_SPEED_KMH, 5);
  });

  it('garde le Grand Prix du jour jusqu’à minuit UTC', () => {
    const cutoff = nextRaceFrom(new Date('2026-10-25T23:30:00.000Z'));
    expect(cutoff.toISOString()).toBe('2026-10-25T00:00:00.000Z');
    expect(new Date('2026-10-25T00:00:00.000Z').getTime()).toBeGreaterThanOrEqual(cutoff.getTime());
    expect(new Date('2026-10-24T00:00:00.000Z').getTime()).toBeLessThan(cutoff.getTime());
  });

  it('ne valide le tour qu’après avoir bouclé dans le sens de la marche', () => {
    expect(noteLap(0, 1, 0, 100)).toEqual({ s: 1, seen: 1, finished: false });
    expect(noteLap(50, 90, 50, 100).s).toBe(50);
    expect(noteLap(40, 38, 40, 100)).toEqual({ s: 38, seen: 40, finished: false });
    expect(noteLap(99, 1, 70, 100).finished).toBe(false);
    expect(noteLap(99, 1, 80, 100)).toMatchObject({ s: 1, finished: true });
  });

  it('accélère sur l’asphalte, freine, et perd de la vitesse dans l’herbe', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const max = topSpeed(track);
    const launched = stepClm(track, createCar(track), { steer: 0, brake: 0, throttle: 1 }, 1);
    expect(launched.speed).toBeGreaterThan(max * 0.2);
    expect(launched.offTrack).toBe(false);
    const still = stepClm(track, createCar(track), { steer: 0, brake: 0, throttle: 0 }, 1);
    expect(still.speed).toBeLessThan(max * 0.05);

    const stopped = stepClm(track, { ...createCar(track), speed: max }, { steer: 0, brake: 1, throttle: 0 }, 2);
    expect(stopped.speed).toBeLessThan(1);

    const on = stepClm(track, { ...createCar(track), speed: max }, { steer: 0, brake: 0, throttle: 0 }, 0.6);
    const off = stepClm(track, { ...createCar(track), y: 90, speed: max }, { steer: 0, brake: 0, throttle: 0 }, 0.6);
    expect(off.offTrack).toBe(true);
    expect(off.speed).toBeLessThan(on.speed * 0.75);
  });

  it('laisse rouler dans le dégagement et ne ramène qu’au-delà', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const max = topSpeed(track);
    const start = pointAt(track, track.length * 0.3);
    const nx = Math.cos(start.angle + Math.PI / 2);
    const ny = Math.sin(start.angle + Math.PI / 2);
    const launch = (reach: number) => ({
      ...createCar(track),
      x: start.x + nx * paintedHalf(track) * reach,
      y: start.y + ny * paintedHalf(track) * reach,
      s: start.s,
      heading: start.angle,
      speed: max * 0.5,
      vx: Math.cos(start.angle) * max * 0.5,
      vy: Math.sin(start.angle) * max * 0.5,
    });
    const lateral = (car: { x: number; y: number }) => (car.x - start.x) * nx + (car.y - start.y) * ny;
    const runoff = launch(1.5);
    const drift = stepClm(track, runoff, { steer: 0, brake: 0, throttle: 1 }, 0.5);
    expect(drift.offTrack).toBe(true);
    expect(lateral(drift)).toBeCloseTo(lateral(runoff), 3);
    expect(drift.speed).toBeGreaterThan(max * 0.4);

    const beyond = launch(3);
    const pulled = stepClm(track, beyond, { steer: 0, brake: 0, throttle: 0 }, 0.5);
    expect(lateral(pulled)).toBeLessThan(lateral(beyond));
    expect(lateral(pulled)).toBeGreaterThan(paintedHalf(track) * RUNOFF_RATIO * 0.9);
  });

  it('s’arrête contre le mur : le choc ralentit, et le gaz rend moins', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const max = topSpeed(track);
    const start = pointAt(track, track.length * 0.4);
    const nx = Math.cos(start.angle + Math.PI / 2);
    const ny = Math.sin(start.angle + Math.PI / 2);
    const wall = paintedHalf(track) * RUNOFF_RATIO;
    const lateral = (car: { x: number; y: number }) => (car.x - start.x) * nx + (car.y - start.y) * ny;
    const pace = max * 0.35;
    const seated = {
      ...createCar(track),
      x: start.x + nx * wall,
      y: start.y + ny * wall,
      s: start.s,
      heading: start.angle,
      speed: pace,
      vx: Math.cos(start.angle) * pace,
      vy: Math.sin(start.angle) * pace,
    };
    const outward = max * 0.25;
    const into = {
      ...seated,
      x: start.x + nx * wall * 1.6,
      y: start.y + ny * wall * 1.6,
      vx: seated.vx + nx * outward,
      vy: seated.vy + ny * outward,
    };
    into.speed = Math.hypot(into.vx, into.vy);
    const hit = stepClm(track, into, { steer: 0, brake: 0, throttle: 1 }, 1 / 60);
    expect(lateral(hit)).toBeCloseTo(wall, 0);
    expect(hit.speed).toBeLessThan(into.speed * 0.9);
    expect(Math.hypot(hit.x - start.x, hit.y - start.y)).toBeGreaterThan(paintedHalf(track) * 1.4);

    const onRoad = {
      ...createCar(track),
      x: start.x,
      y: start.y,
      s: start.s,
      heading: start.angle,
      speed: pace,
      vx: Math.cos(start.angle) * pace,
      vy: Math.sin(start.angle) * pace,
    };
    const free = stepClm(track, onRoad, { steer: 0, brake: 0, throttle: 1 }, 0.35);
    const rubbing = stepClm(track, seated, { steer: 0, brake: 0, throttle: 1 }, 0.35);
    expect(rubbing.accel).toBeLessThan(free.accel * 0.5);
    expect(rubbing.speed).toBeLessThan(free.speed);
    expect(lateral(rubbing)).toBeGreaterThan(paintedHalf(track));
  });

  it('reprend la piste sur la portion voisine atteinte en coupant, contre une pénalité', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 0 H400 V80 H0 Z"/></svg>')!;
    const max = topSpeed(track);
    const cutter = {
      ...createCar(track),
      x: 360,
      y: 80,
      s: 380,
      heading: Math.PI,
      speed: max * 0.3,
      vx: -max * 0.3,
      vy: 0,
      offTrack: true,
      offFrom: 380,
      offPath: 0,
    };
    const back = stepClm(track, cutter, { steer: 0, brake: 0, throttle: 0 }, 1 / 120);
    expect(back.offTrack).toBe(false);
    expect(back.s).toBeGreaterThan(510);
    expect(back.s).toBeLessThan(530);
    expect(back.penalty).toBeGreaterThan(1);
    expect(back.time).toBeGreaterThan(back.penalty);

    const lost = stepClm(track, { ...cutter, x: 100 }, { steer: 0, brake: 0, throttle: 0 }, 1 / 120);
    expect(lost.rescues).toBe(1);
    expect(lost.s).toBe(380);
    expect(lost.speed).toBe(0);
    expect(lost.penalty).toBe(0);
  });

  it('reprend en temps le tracé gagné en coupant, pas un élargissement', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const max = topSpeed(track);
    const wide = track.halfWidth * 6;
    expect(cutPenalty(wide, wide * 1.05, track, max)).toBe(0);
    expect(cutPenalty(wide, wide - track.halfWidth, track, max)).toBe(0);
    const cut = cutPenalty(wide, wide * 0.3, track, max);
    expect(cut).toBeGreaterThanOrEqual(1);
    expect(cut).toBeGreaterThan(cutPenalty(wide, wide * 0.6, track, max));
    expect(cutPenalty(track.length * 0.9, 0, track, max)).toBe(0);
  });

  it('boucle Mexico en suivant le volant', () => {
    const svg = readFileSync(path.join(process.cwd(), 'lib/__tests__/fixtures/mexico-city-outline.svg'), 'utf8');
    const track = trackFromSvg(svg)!;
    let car = createCar(track);
    const dt = 1 / 60;
    const max = topSpeed(track, 4.304);
    for (let t = 0; t < 160 && !car.finished; t += dt) {
      const look = pointAt(track, car.s + 16 + car.speed * 0.28);
      const aim = Math.atan2(look.y - car.y, look.x - car.x);
      const diff = Math.atan2(Math.sin(aim - car.heading), Math.cos(aim - car.heading));
      const steer = Math.max(-1, Math.min(1, diff / 0.42));
      const tight = Math.abs(diff) > 0.16;
      const brake = tight && car.speed > max * 0.4 ? 1 : 0;
      const throttle = brake ? 0 : tight ? 0.35 : 1;
      car = stepClm(track, car, { steer, brake, throttle }, dt, 4.304);
    }
    expect(car.finished).toBe(true);
    expect(car.time).toBeGreaterThan(35);
    expect(car.time).toBeLessThan(140);
  });

  it('reste sous la limite à vitesse modérée et la dépasse à fond', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="800" d="M0 0 H4000"/></svg>')!;
    const max = topSpeed(track);
    const dt = 1 / 120;
    const slipOf = (car: ReturnType<typeof createCar>) => {
      const forward = car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading);
      const lateral = car.vx * Math.sin(car.heading) - car.vy * Math.cos(car.heading);
      return Math.abs(Math.atan2(lateral, Math.max(0.25, forward)));
    };
    let calm = { ...createCar(track), speed: max * 0.35, vx: max * 0.35, vy: 0 };
    let wild = { ...createCar(track), speed: max, vx: max, vy: 0 };
    let calmSlip = 0;
    let wildSlip = 0;
    for (let time = 0; time < 0.7; time += dt) {
      calm = stepClm(track, calm, { steer: 0.45, brake: 0, throttle: 0.4 }, dt);
      wild = stepClm(track, wild, { steer: 1, brake: 0, throttle: 1 }, dt);
      calmSlip = Math.max(calmSlip, slipOf(calm));
      wildSlip = Math.max(wildSlip, slipOf(wild));
    }
    expect(Math.abs(calm.heading - createCar(track).heading)).toBeGreaterThan(0.2);
    expect(calmSlip).toBeLessThan(0.1);
    expect(wildSlip).toBeGreaterThan(0.1);
    expect(wildSlip).toBeLessThan(0.3);
  });

  it('pivote plus fort si on freine en tournant', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="800" d="M0 0 H4000"/></svg>')!;
    const max = topSpeed(track);
    const start = createCar(track);
    const seeded = { ...start, speed: max * 0.7, vx: Math.cos(start.heading) * max * 0.7, vy: Math.sin(start.heading) * max * 0.7 };
    const coast = stepClm(track, seeded, { steer: 1, brake: 0, throttle: 0 }, 0.35);
    const flicked = stepClm(track, seeded, { steer: 1, brake: 1, throttle: 0 }, 0.35);
    const turned = (car: typeof coast) => Math.abs(Math.atan2(Math.sin(car.heading - start.heading), Math.cos(car.heading - start.heading)));
    expect(turned(flicked)).toBeGreaterThan(turned(coast) + 0.05);
  });

  it('tient la limite à pleine direction sans gaz, à toute vitesse', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="800" d="M0 0 H4000"/></svg>')!;
    const max = topSpeed(track);
    const dt = 1 / 120;
    for (const ratio of [0.35, 0.6, 1]) {
      let car = { ...createCar(track), speed: max * ratio, vx: max * ratio, vy: 0 };
      let peak = 0;
      for (let time = 0; time < 1; time += dt) {
        car = stepClm(track, car, { steer: 1, brake: 0, throttle: 0 }, dt);
        const forward = car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading);
        const lateral = car.vx * Math.sin(car.heading) - car.vy * Math.cos(car.heading);
        peak = Math.max(peak, Math.abs(Math.atan2(lateral, Math.max(0.25, forward))));
      }
      expect(peak).toBeGreaterThan(0.045);
      expect(peak).toBeLessThanOrEqual(0.1);
    }
  });

  it('braque progressivement au clavier et revient vite au centre', () => {
    let steer = 0;
    for (let i = 0; i < 6; i += 1) steer = rampSteer(steer, 1, 1 / 60);
    expect(steer).toBeGreaterThan(0.25);
    expect(steer).toBeLessThan(0.4);
    for (let i = 0; i < 30; i += 1) steer = rampSteer(steer, 1, 1 / 60);
    expect(steer).toBe(1);
    steer = rampSteer(steer, -1, 0.1);
    expect(steer).toBeCloseTo(0.4, 5);
    for (let i = 0; i < 10; i += 1) steer = rampSteer(steer, -1, 0.1);
    expect(steer).toBe(-1);
    expect(rampSteer(0.2, 0, 1)).toBe(0);
  });

  it('décroche à fond de gaz sans partir en tête-à-queue, et se rattrape en lâchant', () => {
    const track = trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="800" d="M0 0 H4000"/></svg>')!;
    const max = topSpeed(track);
    const seeded = { ...createCar(track), speed: max * 0.5, vx: max * 0.5, vy: 0 };
    const dt = 1 / 120;
    let held = seeded;
    let powered = seeded;
    for (let time = 0; time < 0.6; time += dt) {
      held = stepClm(track, held, { steer: 1, brake: 0, throttle: 0 }, dt);
      powered = stepClm(track, powered, { steer: 1, brake: 0, throttle: 1 }, dt);
    }
    const slip = (car: typeof held) => {
      const forward = car.vx * Math.cos(car.heading) + car.vy * Math.sin(car.heading);
      const lateral = car.vx * Math.sin(car.heading) - car.vy * Math.cos(car.heading);
      return Math.abs(Math.atan2(lateral, Math.max(0.25, forward)));
    };
    expect(slip(held)).toBeGreaterThan(0.045);
    expect(slip(held)).toBeLessThanOrEqual(0.1);
    expect(slip(powered)).toBeGreaterThan(0.1);
    expect(slip(powered)).toBeLessThan(0.3);
    let caught = powered;
    for (let time = 0; time < 0.7; time += dt) {
      caught = stepClm(track, caught, { steer: 0, brake: 0, throttle: 0 }, dt);
    }
    expect(slip(caught)).toBeLessThan(slip(powered) * 0.55);
  });

  it('affiche un plein de gaz en ligne droite et un plein de frein à haute vitesse', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const rolling = stepClm(track, createCar(track), { steer: 0, brake: 0, throttle: 1 }, 1 / 60);
    expect(rolling.accel).toBeGreaterThan(0.85);
    expect(rolling.brake).toBe(0);
    const max = topSpeed(track);
    const slowing = stepClm(track, { ...createCar(track), speed: max * 0.8, vx: max * 0.8, vy: 0 }, { steer: 0, brake: 1, throttle: 0 }, 1 / 60);
    expect(slowing.brake).toBeGreaterThan(0.85);
    expect(slowing.accel).toBe(0);
  });

  it('repart après un tête-à-queue au lieu de rester plantée en travers', () => {
    const track = trackFromSvg(STRAIGHT)!;
    const max = topSpeed(track);
    let car = { ...createCar(track), speed: max * 0.4, vx: 0, vy: max * 0.4 };
    const dt = 1 / 60;
    for (let t = 0; t < 1.5; t += dt) car = stepClm(track, car, { steer: 0, brake: 0, throttle: 1 }, dt);
    expect(car.vx).toBeGreaterThan(max * 0.06);
  });
});

describe('largeur resserrée', () => {
  it('rétrécit la zone roulable là où une autre portion passe à côté, pas ailleurs', () => {
    const folded = narrowTrack(trackFromSvg('<svg xmlns="http://www.w3.org/2000/svg"><path stroke-width="20" d="M0 0 H120 V20 H0"/></svg>')!);
    const square = narrowTrack(trackFromSvg(SQUARE)!);
    expect(paintedHalfAt(folded, 60)).toBeLessThan(paintedHalf(folded));
    expect(paintedHalfAt(folded, 60) * 2).toBeLessThanOrEqual(20);
    expect(narrowAt(square, 50)).toBe(1);
    const bridged = narrowTrack(folded, (s) => (s < 80 ? 0 : 10));
    expect(narrowAt(bridged, 60)).toBe(1);
  });
});

describe('passage sous le Búnker', () => {
  it('reste sur la sortie du virage 14 au lieu de sauter sur le pont', () => {
    const dir = path.join(process.cwd(), 'lib/circuits/2026');
    const svg = readFileSync(path.join(dir, '14-madring.svg'), 'utf8');
    const profile = (JSON.parse(readFileSync(path.join(dir, 'elevation.json'), 'utf8')) as {
      circuits: Record<string, { reverse: boolean; start: number; points: Array<[number, number]> }>;
    }).circuits.madring;
    const drawn = orientTrack(trackFromSvg(svg)!, profile);
    const track = fitRoad(drawn, 5.416, (s) => profileAt(profile.points, drawn.length > 0 ? s / drawn.length : 0));
    const spot = pointAt(track, 0.545 * track.length);
    const speed = topSpeed(track, 5.416) * 0.55;
    let car = {
      ...createCar(track),
      x: spot.x,
      y: spot.y,
      s: spot.s,
      seen: spot.s,
      heading: spot.angle,
      speed,
      vx: Math.cos(spot.angle) * speed,
      vy: Math.sin(spot.angle) * speed,
    };
    const dt = 1 / 120;
    for (let t = 0; t < 3; t += dt) {
      const look = pointAt(track, car.s + track.halfWidth * 4);
      const aim = Math.atan2(look.y - car.y, look.x - car.x);
      const diff = Math.atan2(Math.sin(aim - car.heading), Math.cos(aim - car.heading));
      const steer = Math.max(-1, Math.min(1, diff / 0.35));
      const before = car.s / track.length;
      car = stepClm(track, car, { steer, brake: 0, throttle: 0.7 }, dt, 5.416);
      const after = car.s / track.length;
      const forward = (after - before + 1) % 1;
      expect(forward).toBeLessThan(0.02);
      expect(car.rescues).toBe(0);
    }
    expect(car.s / track.length).toBeGreaterThan(0.56);
    expect(car.s / track.length).toBeLessThan(0.7);
    expect(narrowAt(track, 0.56 * track.length)).toBe(1);
  });
});

describe('épingle du Fairmont', () => {
  it('garde les rubans séparés et ne saute pas sur l’autre bord', () => {
    const dir = path.join(process.cwd(), 'lib/circuits/2026');
    const svg = readFileSync(path.join(dir, '06-monaco.svg'), 'utf8');
    const profile = (JSON.parse(readFileSync(path.join(dir, 'elevation.json'), 'utf8')) as {
      circuits: Record<string, { reverse: boolean; start: number; points: Array<[number, number]> }>;
    }).circuits.monaco;
    const drawn = orientTrack(trackFromSvg(svg)!, profile);
    const lengthKm = 3.337;
    const track = fitRoad(drawn, lengthKm, (s) => profileAt(profile.points, drawn.length > 0 ? s / drawn.length : 0));

    let overlap = 0;
    for (const p of track.points) {
      const frac = p.s / track.length;
      if (frac < 0.32 || frac > 0.46) continue;
      for (const q of track.points) {
        const separation = alongTrack(p.s, q.s, track.length);
        if (separation < track.length * 0.02) continue;
        const gap = Math.hypot(p.x - q.x, p.y - q.y);
        const room = gap - (paintedHalfAt(track, p.s) + paintedHalfAt(track, q.s));
        if (room < overlap) overlap = room;
      }
    }
    expect(overlap).toBeGreaterThanOrEqual(-0.05);

    const spot = pointAt(track, 0.3 * track.length);
    const speed = topSpeed(track, lengthKm) * 0.35;
    let car = {
      ...createCar(track),
      x: spot.x,
      y: spot.y,
      s: spot.s,
      seen: spot.s,
      heading: spot.angle,
      speed,
      vx: Math.cos(spot.angle) * speed,
      vy: Math.sin(spot.angle) * speed,
    };
    const dt = 1 / 120;
    for (let t = 0; t < 25 && car.s / track.length < 0.5; t += dt) {
      const look = pointAt(track, car.s + track.halfWidth * 3.5);
      const aim = Math.atan2(look.y - car.y, look.x - car.x);
      const diff = Math.atan2(Math.sin(aim - car.heading), Math.cos(aim - car.heading));
      const steer = Math.max(-1, Math.min(1, diff / 0.35));
      const before = car.s / track.length;
      car = stepClm(track, car, { steer, brake: diff > 0.4 ? 0.4 : 0, throttle: 0.45 }, dt, lengthKm, undefined, STREET_RUNOFF_RATIO);
      let delta = car.s / track.length - before;
      if (delta > 0.5) delta -= 1;
      if (delta < -0.5) delta += 1;
      expect(delta).toBeLessThan(0.005);
      expect(delta).toBeGreaterThan(-0.02);
      expect(car.rescues).toBe(0);
    }
    expect(car.s / track.length).toBeGreaterThan(0.46);
  });
});

function alongTrack(from: number, to: number, length: number): number {
  const delta = Math.abs(from - to);
  return Math.min(delta, length - delta);
}
