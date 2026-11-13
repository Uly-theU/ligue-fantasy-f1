import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { biomeFor } from '@/lib/circuit-biome';
import { CAR_WIDTH_M, metersPerUnit, ROAD_WIDTH_M, topSpeed } from '@/lib/clm';
import type { TrackSign } from '@/lib/circuit-places';
import type { ElevationSample } from '@/lib/grade';
import type { Track } from '@/lib/track-path';
import { createCameraRig, frameCamera } from './race/camera';
import { LOCAL_CAR_WIDTH, TYRE_RADIUS, createCarMotion, makeCar, placeCar, setBrakeLight } from './race/car';
import { bowl, findUnderpasses } from './race/historic-loop';
import { GRAVEL_BASIN_HALF, buildBoards, buildChevrons, buildGantry, buildSigns, buildStart, buildTrack, setGantryLights } from './race/road';
import { buildSurroundings } from './race/scenery';
import { boundsOf, buildRelief, buildTerrain, interpolateDeck, type RaceCtx } from './race/terrain';
import { skyTexture } from './race/textures';

export type RacePhase = 'ready' | 'countdown' | 'racing' | 'finished';

export type RacePose = {
  x: number;
  y: number;
  heading: number;
  s: number;
};

export type RaceCamera = 'chase' | 'cockpit';

export type RaceFrame = {
  car: RacePose & { speed: number; steer: number; brake: number; offTrack: boolean };
  ghost: RacePose | null;
  blend: number;
  camHeading: number;
  phase: RacePhase;
  go: boolean;
  view: RaceCamera;
};

/**
 * Piste en relief, monoplace et caméra.
 * Le tracé SVG est en (x, y) ; y devient z, l'altitude devient y.
 * Le dénivelé réel est étiré pour se lire depuis la voiture, au plus un dixième du circuit.
 * Le détail vit dans `race/` : ici on ne fait qu'assembler.
 */
export class RaceView {
  private readonly host: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 500);
  private readonly fog: THREE.Fog;
  private readonly sun: THREE.DirectionalLight;
  private readonly sunTarget = new THREE.Object3D();
  private readonly bin: Array<{ dispose: () => void }> = [];
  private readonly seen = new Set<object>();
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private released = false;
  private readonly ctx: RaceCtx;
  private readonly player: ReturnType<typeof makeCar>;
  private readonly ghost: ReturnType<typeof makeCar>;
  private readonly lamps: THREE.MeshStandardMaterial;
  private readonly motion = createCarMotion();
  private readonly framing: ReturnType<typeof createCameraRig>;

  constructor(host: HTMLElement, track: Track, lengthKm: number, elevation?: ElevationSample[], signs: TrackSign[] = [], circuitId?: string | null) {
    this.host = host;
    const biome = biomeFor(circuitId);
    const fogClear = new THREE.Color('#f3d7b0');
    const fogOff = new THREE.Color('#d9c4a0');
    fogClear.set(biome.fog);
    fogOff.copy(fogClear).offsetHSL(0.015, -0.08, -0.05);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = biome.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const meters = metersPerUnit(track, lengthKm);
    const meter = 1 / Math.max(meters, 1e-6);
    const half = track.halfWidth;
    const scale = (half * 2 * (CAR_WIDTH_M / ROAD_WIDTH_M)) / LOCAL_CAR_WIDTH;
    const bounds = boundsOf(track);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, meter * 40);

    this.ctx = {
      scene: this.scene,
      track,
      circuitId: circuitId ?? null,
      biome,
      half,
      meter,
      scale,
      wheelRadius: TYRE_RADIUS * scale,
      top: Math.max(1e-6, topSpeed(track, lengthKm)),
      span,
      midX: (bounds.minX + bounds.maxX) / 2,
      midZ: (bounds.minY + bounds.maxY) / 2,
      midY: 0,
      roadLift: Math.max(0.04, meter * 0.04),
      groundAt: () => 0,
      underS: [],
      reliefAt: () => 0,
      surfaceAt: () => 0,
      cols: 0,
      rows: 0,
      heights: new Float32Array(0),
      originX: 0,
      originZ: 0,
      stepX: 0,
      stepZ: 0,
      keep: (item) => this.keep(item),
      fogClear,
      fogOff,
    };

    const relief = buildRelief(track, elevation, meters, this.ctx.span);
    this.ctx.groundAt = relief.at;
    this.ctx.underS = findUnderpasses(this.ctx);
    // Sous l'ancien anneau, la piste actuelle descend en cuvette. L'anneau, lui, garde le niveau du sol.
    this.ctx.reliefAt = (s) => this.ctx.groundAt(s) + bowl(this.ctx, s);
    // Le ruban est plan entre deux points du tracé : la voiture lit cette même surface, sinon elle s'enfonce dans les creux.
    const deckHeights = track.points.map((point) => this.ctx.reliefAt(point.s));
    this.ctx.surfaceAt = (s) => interpolateDeck(track, deckHeights, s);
    let sum = 0;
    for (const point of track.points) sum += relief.at(point.s);
    this.ctx.midY = sum / Math.max(1, track.points.length);

    this.scene.background = this.keep(skyTexture(biome));
    this.fog = new THREE.Fog(fogClear, span * 3, span * 11);
    this.scene.fog = this.fog;
    this.scene.environmentIntensity = biome.night ? 0.22 : 0.55;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envTarget.texture;
    room.dispose();
    pmrem.dispose();

    buildTerrain(this.ctx, bounds, this.ctx.reliefAt, this.ctx.half * GRAVEL_BASIN_HALF);
    buildTrack(this.ctx);
    buildStart(this.ctx);
    this.lamps = buildGantry(this.ctx);
    buildBoards(this.ctx, lengthKm);
    buildSigns(this.ctx, signs, meters);
    buildSurroundings(this.ctx);
    buildChevrons(this.ctx);

    this.player = makeCar(this.ctx, false);
    this.ghost = makeCar(this.ctx, true);
    this.ghost.root.visible = false;
    this.scene.add(this.player.root, this.ghost.root);

    this.scene.add(new THREE.HemisphereLight(biome.hemiSky, biome.hemiGround, biome.hemi));
    this.sun = new THREE.DirectionalLight(biome.sun, biome.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;
    const fill = new THREE.DirectionalLight(biome.night ? '#6e7c9a' : '#c5d7ef', biome.fill);
    fill.position.set(this.ctx.midX - span, this.ctx.midY + span, this.ctx.midZ - span * 0.4);
    this.scene.add(fill);

    const orbitSpeed = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.18;
    this.framing = createCameraRig(this.ctx.midX, this.ctx.midY, this.ctx.midZ, orbitSpeed, fogClear);
  }

  render(frame: RaceFrame, dt: number) {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width < 2 || height < 2) return;

    const step = Math.max(0, Math.min(0.05, dt));
    placeCar(this.motion, this.ctx, this.player, frame.car, frame.car.steer, frame.car.speed, step, false);
    setBrakeLight(this.player, frame.car.brake);
    if (frame.ghost) {
      this.ghost.root.visible = true;
      placeCar(this.motion, this.ctx, this.ghost, frame.ghost, 0, frame.car.speed, step, true);
    } else {
      this.ghost.root.visible = false;
    }

    setGantryLights(this.lamps, frame.phase === 'countdown', frame.go);
    frameCamera(
      this.ctx,
      this.framing,
      this.camera,
      this.renderer,
      this.fog,
      this.sun,
      this.sunTarget,
      this.player.root,
      frame,
      step,
      width,
      height,
    );
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.released) return;
    this.released = true;
    this.canvasRemove();
    this.scene.environment = null;
    this.envTarget?.dispose();
    this.envTarget = null;
    this.releaseShadowMap();
    this.releaseInstances();
    for (const item of this.bin) item.dispose();
    this.bin.length = 0;
    this.seen.clear();
    // Tant que l'écouteur de three est en place, la perte reste définitive.
    // dispose() le retire : l'appeler avant rendrait le contexte au navigateur.
    this.renderer.forceContextLoss();
    this.renderer.dispose();
  }

  /** La carte n'existe qu'après un rendu : on la lâche une fois, passe comprise. */
  private releaseShadowMap() {
    const shadow = this.sun.shadow;
    const map = shadow.map;
    const pass = shadow.mapPass;
    shadow.map = null;
    shadow.mapPass = null;
    map?.dispose();
    if (pass && pass !== map) pass.dispose();
  }

  /** Chaque maillage instancié porte ses propres tampons, en plus de la géométrie partagée. */
  private releaseInstances() {
    const released = new Set<THREE.InstancedMesh>();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh) || released.has(object)) return;
      released.add(object);
      object.dispose();
    });
  }

  private canvasRemove() {
    const canvas = this.renderer.domElement;
    if (canvas.parentElement === this.host) this.host.removeChild(canvas);
  }

  private keep<T extends { dispose: () => void }>(item: T): T {
    if (!this.seen.has(item)) {
      this.seen.add(item);
      this.bin.push(item);
    }
    return item;
  }
}
