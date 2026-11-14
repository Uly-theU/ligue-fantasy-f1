import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRecord, sampleAtTime, type LapSample } from '@/lib/clm-record';
import type { Track, TrackPoint } from '@/lib/track-path';
import type { RaceFrame } from './race-view';

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three');

  class WebGLRenderer {
    domElement: HTMLCanvasElement;
    shadowMap: { enabled: boolean; type: number };
    outputColorSpace: string;
    toneMapping: number;
    toneMappingExposure: number;

    constructor() {
      this.domElement = document.createElement('canvas');
      this.shadowMap = { enabled: false, type: actual.PCFSoftShadowMap };
      this.outputColorSpace = actual.SRGBColorSpace;
      this.toneMapping = actual.ACESFilmicToneMapping;
      this.toneMappingExposure = 1;
    }

    forceContextLoss() {}

    dispose() {}

    render() {}

    setSize() {}

    setPixelRatio() {}

    getPixelRatio() {
      return 1;
    }
  }

  class PMREMGenerator {
    fromScene() {
      const texture = new actual.Texture();
      return {
        texture,
        dispose() {
          texture.dispose();
        },
      };
    }

    dispose() {}
  }

  return { ...actual, WebGLRenderer, PMREMGenerator };
});

import { RaceView } from './race-view';

type OpenView = {
  ghost: { spin: number; spinners: Array<{ rotation: { z: number } }> };
  player: { spin: number; spinners: Array<{ rotation: { z: number } }> };
  ctx: { wheelRadius: number };
  render: (frame: RaceFrame, dt: number) => void;
  dispose: () => void;
};

function oval(): Track {
  const count = 32;
  const radius = 40;
  const length = 2 * Math.PI * radius;
  const points: TrackPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      s: (i / count) * length,
      angle: angle + Math.PI / 2,
    });
  }
  return { points, length, halfWidth: 6, closed: true };
}

function hostOf(): HTMLElement {
  const host = document.createElement('div');
  Object.defineProperty(host, 'clientWidth', { value: 640 });
  Object.defineProperty(host, 'clientHeight', { value: 360 });
  document.body.appendChild(host);
  return host;
}

function frame(track: Track, ghost: RaceFrame['ghost'], ghostSamples: LapSample[] | undefined, playerSpeed: number): RaceFrame {
  const start = track.points[0];
  return {
    car: {
      x: start.x,
      y: start.y,
      heading: start.angle,
      s: start.s,
      speed: playerSpeed,
      steer: 0,
      brake: 0,
      offTrack: false,
    },
    ghost,
    ghostSamples,
    blend: 0,
    camHeading: start.angle,
    phase: 'racing',
    go: false,
    view: 'chase',
  };
}

describe('roues du fantôme', () => {
  const hosts: HTMLElement[] = [];

  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  });

  afterEach(() => {
    for (const host of hosts) host.remove();
    hosts.length = 0;
  });

  it('avance les roues du fantôme à la vitesse de ses échantillons, joueur à l’arrêt', () => {
    const track = oval();
    const host = hostOf();
    hosts.push(host);
    const view = new RaceView(host, track, 5.3) as unknown as OpenView;
    const start = track.points[0];
    const ahead = track.points[8];
    const samples: LapSample[] = [
      { t: 0, s: start.s, x: start.x, y: start.y, h: start.angle },
      { t: 2, s: ahead.s, x: ahead.x, y: ahead.y, h: ahead.angle },
    ];
    const record = buildRecord(2, samples, track.length);
    const ghost = sampleAtTime(record.samples, 1)!;
    const step = 0.02;
    view.render(frame(track, { x: ghost.x, y: ghost.y, heading: ghost.h, s: ghost.s }, record.samples, 0), step);

    const speed = Math.hypot(ahead.x - start.x, ahead.y - start.y) / 2;
    const expected = (0 - (speed / view.ctx.wheelRadius) * step) % (Math.PI * 2);
    expect(view.ghost.spin).toBeCloseTo(expected, 5);
    expect(view.ghost.spin).not.toBe(0);
    expect(view.ghost.spinners[0].rotation.z).toBeCloseTo(view.ghost.spin, 5);
    expect(view.player.spin).toBe(0);
    expect(view.player.spinners[0].rotation.z).toBe(0);
    view.dispose();
  });

  it('laisse les roues du fantôme immobiles quand ses échantillons sont arrêtés, même si le joueur file', () => {
    const track = oval();
    const host = hostOf();
    hosts.push(host);
    const view = new RaceView(host, track, 5.3) as unknown as OpenView;
    const start = track.points[0];
    const samples: LapSample[] = [
      { t: 0, s: start.s, x: start.x, y: start.y, h: start.angle },
      { t: 1, s: start.s, x: start.x, y: start.y, h: start.angle },
    ];
    const record = buildRecord(1, samples, track.length);
    view.render(frame(track, { x: start.x, y: start.y, heading: start.angle, s: start.s }, record.samples, 400), 0.02);
    expect(view.ghost.spin).toBe(0);
    expect(view.ghost.spinners.every((spinner) => spinner.rotation.z === 0)).toBe(true);
    expect(view.player.spin).not.toBe(0);
    view.dispose();
  });

  it('sans échantillons sur l’image, suit le déplacement du fantôme et ignore la vitesse du joueur', () => {
    const track = oval();
    const host = hostOf();
    hosts.push(host);
    const view = new RaceView(host, track, 5.3) as unknown as OpenView;
    const start = track.points[0];
    const ahead = track.points[4];
    const step = 0.02;
    const stopped = { x: start.x, y: start.y, heading: start.angle, s: start.s };
    view.render(frame(track, stopped, undefined, 400), step);
    expect(view.ghost.spin).toBe(0);
    view.render(frame(track, { x: ahead.x, y: ahead.y, heading: ahead.angle, s: ahead.s }, undefined, 400), step);
    const speed = Math.hypot(ahead.x - start.x, ahead.y - start.y) / step;
    const expected = (0 - (speed / view.ctx.wheelRadius) * step) % (Math.PI * 2);
    expect(view.ghost.spin).toBeCloseTo(expected, 5);
    expect(view.ghost.spin).not.toBe(0);
    view.dispose();
  });
});
