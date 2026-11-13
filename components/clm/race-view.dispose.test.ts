import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebGLRenderTarget } from 'three';
import type { Track, TrackPoint } from '@/lib/track-path';

const rendererMocks = vi.hoisted(() => ({
  forceContextLoss: vi.fn(),
  dispose: vi.fn(),
}));

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

    forceContextLoss() {
      rendererMocks.forceContextLoss();
    }

    dispose() {
      rendererMocks.dispose();
    }

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
import { InstancedMesh, type DirectionalLight, type Scene } from 'three';

type OpenView = {
  sun: DirectionalLight;
  scene: Scene;
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

describe('RaceView.dispose', () => {
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
    rendererMocks.forceContextLoss.mockClear();
    rendererMocks.dispose.mockClear();
  });

  it('perd le contexte et libère la carte d’ombres et chaque InstancedMesh une seule fois', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    const view = new RaceView(host, oval(), 5.3) as unknown as OpenView;

    const shadowMap = { dispose: vi.fn() };
    const shadowPass = { dispose: vi.fn() };
    view.sun.shadow.map = shadowMap as unknown as WebGLRenderTarget;
    view.sun.shadow.mapPass = shadowPass as unknown as WebGLRenderTarget;

    const meshes: InstancedMesh[] = [];
    view.scene.traverse((object) => {
      if (object instanceof InstancedMesh) meshes.push(object);
    });
    expect(meshes.length).toBeGreaterThan(0);
    const meshDisposes = meshes.map((mesh) => vi.spyOn(mesh, 'dispose'));

    view.dispose();
    view.dispose();

    expect(rendererMocks.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
    expect(shadowMap.dispose).toHaveBeenCalledTimes(1);
    expect(shadowPass.dispose).toHaveBeenCalledTimes(1);
    for (const spy of meshDisposes) expect(spy).toHaveBeenCalledTimes(1);
  });
});
