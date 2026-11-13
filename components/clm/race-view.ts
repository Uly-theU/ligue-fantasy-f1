import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import * as THREE from 'three';
import { bankOffset } from '@/lib/circuit-banking';
import { biomeFor, type CircuitBiome, type GroundTone } from '@/lib/circuit-biome';
import { planBlocks, planPit, planStands, type Footprint, type Placed } from '@/lib/circuit-scenery';
import { surroundingsFor, type CircuitSurroundings } from '@/lib/circuit-surroundings';
import { CAR_WIDTH_M, metersPerUnit, ROAD_WIDTH_M, RUNOFF_RATIO, STREET_RUNOFF_RATIO, topSpeed } from '@/lib/clm';
import type { TrackSign } from '@/lib/circuit-places';
import type { ElevationSample } from '@/lib/grade';
import { nearestCenter, paintClearance } from '@/lib/track-clearance';
import { bankAt, narrowAt, paintedHalf, paintedHalfAt, pointAt, type Track } from '@/lib/track-path';

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

type Wheel = { hub: THREE.Group; spinner: THREE.Group };

type CarRig = {
  root: THREE.Group;
  front: Wheel[];
  spinners: THREE.Group[];
  brake: THREE.MeshStandardMaterial;
  spin: number;
};

type OvalFrame = {
  x: number;
  y: number;
  ahead: number;
  nx: number;
  nz: number;
  turn: number;
  bank: number;
  s: number;
  dist: number;
  delta: number;
  painted: number;
  shared: boolean;
};

type OvalEdge = {
  lx: number;
  ly: number;
  lz: number;
  rx: number;
  ry: number;
  rz: number;
};

type Ribbon = { positions: number[]; indices: number[] };

const ASPHALT = 1 / 0.85;
/**
 * Ferrari F2004, en mètres : 4,545 × 1,796 × 0,959, empattement 3,050.
 * L'aileron avant fait 1,40 m et reste entre les roues ; l'aileron arrière fait 1,00 m et culmine à 0,80 m.
 */
const LOCAL_CAR_WIDTH = 1.796;
const TYRE_RADIUS = 0.33;
/** Distance du centre de la voiture à chaque essieu, et demi-voie avant, dans le repère local (mètres). */
const AXLE_OFFSET = 1.525;
const TRACK_HALF_OFFSET = 0.735;
/** Épaisseur des marquages posés sur le bitume, en demi-largeurs de piste (quelques centimètres à l'échelle de la voiture). */
const DECAL_LIFT = 0.004;
/** Œil du pilote, au sommet du casque (repère local, mètres) : on voit le nez et les roues avant. */
const EYE = new THREE.Vector3(0.7, 0.74, 0);
/** Le pilote regarde la route à cette distance : sur une crête, il voit la descente au lieu du ciel. */
const COCKPIT_LOOK_M = 45;
/** Pente maximale affichée : le relief est exagéré pour se lire, sans faire de Spa un mur. */
const MAX_VISUAL_GRADE = 0.18;

/**
 * Piste en relief, monoplace et caméra.
 * Le tracé SVG est en (x, y) ; y devient z, l'altitude devient y.
 * Le dénivelé réel est étiré pour se lire depuis la voiture, au plus un dixième du circuit.
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

  private readonly track: Track;
  private readonly circuitId: string | null;
  private readonly biome: CircuitBiome;
  private readonly fogClear = new THREE.Color('#f3d7b0');
  private readonly fogOff = new THREE.Color('#d9c4a0');
  private readonly half: number;
  private readonly meter: number;
  private readonly scale: number;
  private readonly wheelRadius: number;
  private readonly top: number;
  private readonly span: number;
  private readonly midX: number;
  private readonly midZ: number;
  private readonly midY: number;
  private readonly roadLift: number;
  private readonly groundAt: (s: number) => number;
  private readonly underS: number[];
  private readonly reliefAt: (s: number) => number;
  private readonly surfaceAt: (s: number) => number;

  private readonly cols: number;
  private readonly rows: number;
  private readonly heights: Float32Array;
  private readonly originX: number;
  private readonly originZ: number;
  private readonly stepX: number;
  private readonly stepZ: number;

  private readonly player: CarRig;
  private readonly ghost: CarRig;
  private readonly lamps: THREE.MeshStandardMaterial;
  private readonly orbitSpeed: number;

  private readonly worldUp = new THREE.Vector3(0, 1, 0);
  private readonly sunDir = new THREE.Vector3(0.62, 1.25, 0.34).normalize();
  private readonly forward = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  private readonly rolledUp = new THREE.Vector3();
  private readonly rolledSide = new THREE.Vector3();
  private readonly basis = new THREE.Matrix4();
  private readonly overviewPos = new THREE.Vector3();
  private readonly overviewLook = new THREE.Vector3();
  private readonly chasePos = new THREE.Vector3();
  private readonly chaseLook = new THREE.Vector3();
  private readonly desiredPos = new THREE.Vector3();
  private readonly desiredLook = new THREE.Vector3();
  private readonly camPos = new THREE.Vector3();
  private readonly lookPos = new THREE.Vector3();
  private readonly viewDir = new THREE.Vector3();
  private readonly viewRight = new THREE.Vector3();
  private readonly viewUp = new THREE.Vector3();
  private readonly cameraUp = new THREE.Vector3(0, 1, 0);
  private readonly shadowFocus = new THREE.Vector3();
  private readonly carFocus = new THREE.Vector3();
  private readonly fogGoal = new THREE.Color('#f3d7b0');

  private orbit = 0.4;
  private primed = false;
  private cockpitMix = 0;
  private readonly cockpitPos = new THREE.Vector3();
  private readonly cockpitLook = new THREE.Vector3();
  private viewW = 0;
  private viewH = 0;
  private viewPr = 0;

  constructor(host: HTMLElement, track: Track, lengthKm: number, elevation?: ElevationSample[], signs: TrackSign[] = [], circuitId?: string | null) {
    this.host = host;
    this.track = track;
    this.circuitId = circuitId ?? null;
    this.biome = biomeFor(circuitId);
    this.fogClear.set(this.biome.fog);
    this.fogOff.copy(this.fogClear).offsetHSL(0.015, -0.08, -0.05);
    this.fogGoal.copy(this.fogClear);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.biome.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.setAttribute('aria-hidden', 'true');
    host.appendChild(canvas);

    const meters = metersPerUnit(track, lengthKm);
    this.meter = 1 / Math.max(meters, 1e-6);
    this.half = track.halfWidth;
    this.scale = (this.half * 2 * (CAR_WIDTH_M / ROAD_WIDTH_M)) / LOCAL_CAR_WIDTH;
    this.wheelRadius = TYRE_RADIUS * this.scale;
    this.top = Math.max(1e-6, topSpeed(track, lengthKm));
    this.roadLift = Math.max(0.04, this.meter * 0.04);

    const bounds = boundsOf(track);
    this.span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, this.meter * 40);
    this.midX = (bounds.minX + bounds.maxX) / 2;
    this.midZ = (bounds.minY + bounds.maxY) / 2;

    const relief = buildRelief(track, elevation, meters, this.span);
    this.groundAt = relief.at;
    this.underS = this.findUnderpasses();
    // Sous l'ancien anneau, la piste actuelle descend en cuvette. L'anneau, lui, garde le niveau du sol.
    this.reliefAt = (s) => this.groundAt(s) + this.bowl(s);
    // Le ruban est plan entre deux points du tracé : la voiture lit cette même surface, sinon elle s'enfonce dans les creux.
    const deck = track.points.map((point) => this.reliefAt(point.s));
    this.surfaceAt = (s) => {
      const points = track.points;
      const at = track.closed ? mod(s, track.length) : Math.max(0, Math.min(track.length, s));
      let lo = 0;
      let hi = points.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (points[mid].s <= at) lo = mid;
        else hi = mid - 1;
      }
      const next = track.closed ? (lo + 1) % points.length : Math.min(points.length - 1, lo + 1);
      const end = track.closed && next === 0 ? track.length : points[next].s;
      const span = end - points[lo].s;
      const t = span > 1e-6 ? THREE.MathUtils.clamp((at - points[lo].s) / span, 0, 1) : 0;
      return deck[lo] + (deck[next] - deck[lo]) * t;
    };
    let sum = 0;
    for (const point of track.points) sum += relief.at(point.s);
    this.midY = sum / Math.max(1, track.points.length);

    this.scene.background = this.keep(skyTexture(this.biome));
    this.fog = new THREE.Fog(this.fogClear, this.span * 3, this.span * 11);
    this.scene.fog = this.fog;
    this.scene.environmentIntensity = this.biome.night ? 0.22 : 0.55;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.envTarget = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.envTarget.texture;
    room.dispose();
    pmrem.dispose();

    const field = this.buildTerrain(bounds, this.reliefAt);
    this.cols = field.cols;
    this.rows = field.rows;
    this.heights = field.heights;
    this.originX = field.originX;
    this.originZ = field.originZ;
    this.stepX = field.stepX;
    this.stepZ = field.stepZ;

    this.buildTrack();
    this.buildStart();
    this.lamps = this.buildGantry();
    this.buildBoards(lengthKm);
    this.buildSigns(signs, meters);
    this.buildSurroundings();
    this.buildChevrons();

    this.player = this.makeCar(false);
    this.ghost = this.makeCar(true);
    this.ghost.root.visible = false;
    this.scene.add(this.player.root, this.ghost.root);

    this.scene.add(new THREE.HemisphereLight(this.biome.hemiSky, this.biome.hemiGround, this.biome.hemi));
    this.sun = new THREE.DirectionalLight(this.biome.sun, this.biome.sunIntensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.00025;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sunTarget);
    this.sun.target = this.sunTarget;
    const fill = new THREE.DirectionalLight(this.biome.night ? '#6e7c9a' : '#c5d7ef', this.biome.fill);
    fill.position.set(this.midX - this.span, this.midY + this.span, this.midZ - this.span * 0.4);
    this.scene.add(fill);

    this.orbitSpeed = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.18;
    this.overviewLook.set(this.midX, this.midY, this.midZ);
    this.camPos.copy(this.overviewLook);
    this.lookPos.copy(this.overviewLook);
  }

  render(frame: RaceFrame, dt: number) {
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    if (width < 2 || height < 2) return;

    const step = Math.max(0, Math.min(0.05, dt));
    this.placeCar(this.player, frame.car, frame.car.steer, frame.car.speed, step, false);
    this.player.brake.emissiveIntensity = frame.car.brake > 0.15 ? 2 : 0;
    if (frame.ghost) {
      this.ghost.root.visible = true;
      this.placeCar(this.ghost, frame.ghost, 0, frame.car.speed, step, true);
    } else {
      this.ghost.root.visible = false;
    }

    const lightsOn = frame.phase === 'countdown';
    this.lamps.color.set(lightsOn ? '#3a0000' : frame.go ? '#043318' : '#241416');
    this.lamps.emissive.set(lightsOn ? '#ff2a2a' : frame.go ? '#3dff86' : '#000000');
    this.lamps.emissiveIntensity = lightsOn || frame.go ? 2.4 : 0;

    const blend = smooth(frame.blend);
    const speedRatio = THREE.MathUtils.clamp(frame.car.speed / this.top, 0, 1);
    if (frame.blend < 0.8) this.orbit += step * this.orbitSpeed;
    const swing = this.span * 0.58;
    this.overviewPos.set(
      this.midX + Math.sin(this.orbit) * swing,
      this.midY + this.span * 0.4,
      this.midZ + Math.cos(this.orbit) * swing,
    );

    const fx = Math.cos(frame.camHeading);
    const fz = Math.sin(frame.camHeading);
    const carY = this.player.root.position.y;
    // Plus vite, la caméra se rapproche et s'abaisse : le sol défile au premier plan au lieu que la voiture rapetisse.
    const back = this.half * (2 - speedRatio * 0.3);
    const high = this.half * (0.5 - speedRatio * 0.1);
    const ahead = this.half * (1.15 + speedRatio * 0.4);
    // Hauteurs prises sur la route devant et derrière, pas sur la voiture : en montée comme sur une crête, la piste reste à l'image.
    const behindY = this.deck(frame.car.s - back);
    const aheadY = this.deck(frame.car.s + ahead);
    this.chasePos.set(frame.car.x - fx * back, Math.max(carY, behindY) + high, frame.car.y - fz * back);
    this.chaseLook.set(frame.car.x + fx * ahead, (carY + aheadY) / 2 + this.half * 0.12, frame.car.y + fz * ahead);
    const ground = this.sampleGround(this.chasePos.x, this.chasePos.z);
    if (this.chasePos.y < ground + this.half * 0.12) this.chasePos.y = ground + this.half * 0.12;

    this.cockpitMix += ((frame.view === 'cockpit' ? 1 : 0) - this.cockpitMix) * Math.min(1, step * 6);
    if (this.cockpitMix > 1e-3) {
      this.player.root.updateMatrixWorld();
      this.cockpitPos.copy(EYE).applyMatrix4(this.player.root.matrixWorld);
      const look = COCKPIT_LOOK_M * this.meter;
      const hx = Math.cos(frame.car.heading);
      const hz = Math.sin(frame.car.heading);
      const eyeHeight = EYE.y * this.scale;
      this.cockpitLook.set(
        this.cockpitPos.x + hx * look,
        this.deck(frame.car.s + look) + eyeHeight * 1.1,
        this.cockpitPos.z + hz * look,
      );
      this.chasePos.lerp(this.cockpitPos, this.cockpitMix);
      this.chaseLook.lerp(this.cockpitLook, this.cockpitMix);
    }
    this.desiredPos.lerpVectors(this.overviewPos, this.chasePos, blend);
    this.desiredLook.lerpVectors(this.overviewLook, this.chaseLook, blend);
    // Dans le cockpit, la caméra est vissée à la voiture : un retard ferait flotter le casque.
    const lag = this.primed ? 1 - Math.exp(-step * 8) : 1;
    const follow = THREE.MathUtils.lerp(lag, 1, this.cockpitMix * blend);
    this.camPos.lerp(this.desiredPos, follow);
    this.lookPos.lerp(this.desiredLook, follow);
    this.primed = true;

    const bank = bankAt(this.track, frame.car.s);
    // En poursuite l'horizon reste droit, le relevé se lit sur la piste. Dans le cockpit, la tête suit la voiture.
    const roll = THREE.MathUtils.clamp(-frame.car.steer, -1, 1) * THREE.MathUtils.lerp(0.045, 0.02, this.cockpitMix) * blend
      - bank * this.cockpitMix * blend;
    this.viewDir.subVectors(this.chaseLook, this.chasePos);
    if (this.viewDir.lengthSq() < 1e-8) this.viewDir.set(0, 0, 1);
    this.viewDir.normalize();
    this.viewRight.crossVectors(this.viewDir, this.worldUp);
    if (this.viewRight.lengthSq() < 1e-8) this.viewRight.set(1, 0, 0);
    this.viewRight.normalize();
    this.viewUp.crossVectors(this.viewRight, this.viewDir).normalize();
    this.rolledUp.copy(this.viewUp).multiplyScalar(Math.cos(roll)).addScaledVector(this.viewRight, Math.sin(roll));
    this.cameraUp.copy(this.worldUp).lerp(this.rolledUp, blend).normalize();

    const pr = Math.min(window.devicePixelRatio || 1, 1.75);
    if (this.viewW !== width || this.viewH !== height || this.viewPr !== pr) {
      this.viewW = width;
      this.viewH = height;
      this.viewPr = pr;
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(width, height, false);
    }
    this.camera.aspect = width / height;
    const chaseFov = 9 + speedRatio * speedRatio * 16;
    const cockpitFov = 19 + speedRatio * speedRatio * 10;
    this.camera.fov = 43 + blend * THREE.MathUtils.lerp(chaseFov, cockpitFov, this.cockpitMix);
    const nearRoad = THREE.MathUtils.lerp(this.half * 0.05, this.scale * 0.05, this.cockpitMix);
    this.camera.near = THREE.MathUtils.lerp(this.span * 0.025, nearRoad, blend);
    this.camera.far = THREE.MathUtils.lerp(this.span * 8, this.half * 50, blend);
    this.camera.up.copy(this.cameraUp);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.lookPos);
    this.camera.updateProjectionMatrix();

    this.fog.near = THREE.MathUtils.lerp(this.span * 2.8, this.half * 8, blend);
    this.fog.far = THREE.MathUtils.lerp(this.span * 9, this.half * 36, blend);
    this.fogGoal.copy(frame.phase === 'racing' && frame.car.offTrack ? this.fogOff : this.fogClear);
    this.fog.color.lerp(this.fogGoal, 1 - Math.exp(-step * 5));

    this.carFocus.set(frame.car.x, carY, frame.car.y);
    this.shadowFocus.lerpVectors(this.overviewLook, this.carFocus, blend);
    const shadowSpan = THREE.MathUtils.lerp(this.span * 0.7, this.half * 5, blend);
    this.sun.position.copy(this.shadowFocus).addScaledVector(this.sunDir, shadowSpan * 2.1);
    this.sunTarget.position.copy(this.shadowFocus);
    this.sunTarget.updateMatrixWorld();
    const shadow = this.sun.shadow.camera as THREE.OrthographicCamera;
    shadow.left = -shadowSpan;
    shadow.right = shadowSpan;
    shadow.top = shadowSpan;
    shadow.bottom = -shadowSpan;
    shadow.near = shadowSpan * 0.15;
    shadow.far = shadowSpan * 4.2;
    shadow.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.canvasRemove();
    this.scene.environment = null;
    this.envTarget?.dispose();
    for (const item of this.bin) item.dispose();
    this.bin.length = 0;
    this.renderer.dispose();
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

  private placeCar(rig: CarRig, pose: RacePose, steer: number, speed: number, dt: number, ghost: boolean) {
    const tangent = pointAt(this.track, pose.s);
    const along = Math.cos(pose.heading) * Math.cos(tangent.angle) + Math.sin(pose.heading) * Math.sin(tangent.angle);
    const axle = AXLE_OFFSET * this.scale;
    const frontS = pose.s + along * axle;
    const rearS = pose.s - along * axle;
    const front = this.deck(frontS);
    const rear = this.deck(rearS);
    const slope = THREE.MathUtils.clamp((front - rear) / (2 * axle), -0.7, 0.7);
    this.forward.set(Math.cos(pose.heading), slope, Math.sin(pose.heading)).normalize();
    this.side.crossVectors(this.forward, this.worldUp);
    if (this.side.lengthSq() < 1e-8) this.side.set(0, 0, 1);
    this.side.normalize();
    const nx = -Math.sin(tangent.angle);
    const nz = Math.cos(tangent.angle);
    const signedLeft = (pose.x - tangent.x) * nx + (pose.y - tangent.y) * nz;
    const bank = bankAt(this.track, pose.s);
    const steerRoll = ghost ? 0 : -steer * 0.08;
    const roll = steerRoll - bank;
    this.up.crossVectors(this.side, this.forward).normalize();
    this.rolledUp.copy(this.up).multiplyScalar(Math.cos(roll)).addScaledVector(this.side, Math.sin(roll)).normalize();
    this.rolledSide.crossVectors(this.forward, this.rolledUp).normalize();
    rig.root.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.forward, this.rolledUp, this.rolledSide));
    // Le roulis de braquage pivote autour du centre au sol : on remonte pour que la roue basse ne passe pas sous le bitume.
    // Le dévers, lui, est déjà dans la hauteur de la piste.
    const rollLift = Math.abs(Math.sin(steerRoll)) * TRACK_HALF_OFFSET * this.scale;
    const offCrown = this.bankHeight(pose.s, signedLeft) - this.bankHeight(pose.s, 0);
    rig.root.position.set(
      pose.x,
      (front + rear) / 2 + rollLift + offCrown,
      pose.y,
    );
    rig.spin = (rig.spin - (speed / this.wheelRadius) * dt) % (Math.PI * 2);
    for (const spinner of rig.spinners) spinner.rotation.z = rig.spin;
    const yaw = ghost ? 0 : -steer * 0.48;
    for (const wheel of rig.front) wheel.hub.rotation.y = yaw;
  }

  /** Hauteur du milieu de piste, dévers compris. */
  private deck(s: number): number {
    return this.surfaceAt(s) + this.roadLift + this.bankHeight(s, 0);
  }

  /** Hausse du bitume à `lateral` mètres-jeu vers la gauche. */
  private bankHeight(s: number, lateral: number): number {
    return bankOffset(lateral, bankAt(this.track, s), this.outerAt(s)).y;
  }

  /** Demi-largeur du bac, celle autour de laquelle le dévers pivote. */
  private outerAt(s: number): number {
    const n = narrowAt(this.track, s);
    const gravelHalf = this.half * 1.48;
    const limit = paintedHalf(this.track);
    return n * THREE.MathUtils.lerp(limit, gravelHalf, THREE.MathUtils.clamp((n - 0.85) / 0.15, 0, 1));
  }

  private sampleGround(x: number, z: number): number {
    if (this.stepX <= 0 || this.stepZ <= 0) return 0;
    const u = (x - this.originX) / this.stepX;
    const v = (z - this.originZ) / this.stepZ;
    const x0 = Math.floor(u);
    const y0 = Math.floor(v);
    if (x0 < 0 || y0 < 0 || x0 >= this.cols - 1 || y0 >= this.rows - 1) return this.midY;
    const tx = u - x0;
    const ty = v - y0;
    const i = y0 * this.cols + x0;
    const a = this.heights[i];
    const b = this.heights[i + 1];
    const c = this.heights[i + this.cols];
    const d = this.heights[i + this.cols + 1];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
  }

  private buildTerrain(bounds: Bounds, reliefAt: (s: number) => number) {
    const pad = Math.max(this.half * 8, this.span * 0.2);
    const minX = bounds.minX - pad;
    const maxX = bounds.maxX + pad;
    const minZ = bounds.minY - pad;
    const maxZ = bounds.maxY + pad;
    const cells = 96;
    const cols = cells + 1;
    const rows = cells + 1;
    const stepX = (maxX - minX) / cells;
    const stepZ = (maxZ - minZ) / cells;
    const exact = new Float32Array(cols * rows);
    const dist = new Float32Array(cols * rows);
    const points = this.track.points;
    const heightsAlong = points.map((point) => reliefAt(point.s));
    const cell = Math.max(this.half * 3, 1);
    const buckets = new Map<string, number[]>();
    for (let i = 0; i < points.length; i += 1) {
      const key = `${Math.floor(points[i].x / cell)}:${Math.floor(points[i].y / cell)}`;
      const list = buckets.get(key);
      if (list) list.push(i);
      else buckets.set(key, [i]);
    }
    for (let iy = 0; iy < rows; iy += 1) {
      const z = minZ + iy * stepZ;
      for (let ix = 0; ix < cols; ix += 1) {
        const x = minX + ix * stepX;
        const nearest = nearestPoint(buckets, points, cell, x, z);
        const index = iy * cols + ix;
        exact[index] = heightsAlong[nearest.index];
        dist[index] = nearest.distance;
      }
    }
    let soft = blur(exact, cols, rows);
    soft = blur(soft, cols, rows);
    const skirt = Math.max(1, Math.floor(cells * 0.07));
    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        const index = iy * cols + ix;
        const edge = smooth(THREE.MathUtils.clamp((dist[index] - this.half * 1.8) / (this.half * 6), 0, 1));
        let height = exact[index] * (1 - edge) + soft[index] * edge;
        const border = Math.min(ix, iy, cells - ix, cells - iy) / skirt;
        height = THREE.MathUtils.lerp(-0.4, height, smooth(THREE.MathUtils.clamp(border, 0, 1)));
        exact[index] = height;
      }
    }
    // Une maille fait jusqu'à 30 m : entre deux sommets, le sol remonterait au-dessus d'un bitume posé à quelques centimètres.
    // Tout sommet d'un triangle qui touche la chaussée passe donc sous elle.
    const reach = this.half * 1.48 + Math.hypot(stepX, stepZ);
    const margin = Math.max(this.roadLift * 2, this.half * 0.03);
    const stride = Math.max(Math.min(stepX, stepZ) * 0.5, 1e-3);
    for (let s = 0; s < this.track.length; s += stride) {
      const spot = pointAt(this.track, s);
      const floor = reliefAt(s) - margin;
      const ix0 = Math.max(0, Math.floor((spot.x - reach - minX) / stepX));
      const ix1 = Math.min(cells, Math.ceil((spot.x + reach - minX) / stepX));
      const iy0 = Math.max(0, Math.floor((spot.y - reach - minZ) / stepZ));
      const iy1 = Math.min(cells, Math.ceil((spot.y + reach - minZ) / stepZ));
      for (let iy = iy0; iy <= iy1; iy += 1) {
        for (let ix = ix0; ix <= ix1; ix += 1) {
          if (Math.hypot(minX + ix * stepX - spot.x, minZ + iy * stepZ - spot.y) > reach) continue;
          const index = iy * cols + ix;
          if (exact[index] > floor) exact[index] = floor;
        }
      }
    }

    const positions = new Float32Array(cols * rows * 3);
    const uvs = new Float32Array(cols * rows * 2);
    const indices: number[] = [];
    for (let iy = 0; iy < rows; iy += 1) {
      for (let ix = 0; ix < cols; ix += 1) {
        const index = iy * cols + ix;
        positions[index * 3] = minX + ix * stepX;
        positions[index * 3 + 1] = exact[index];
        positions[index * 3 + 2] = minZ + iy * stepZ;
        uvs[index * 2] = (ix * stepX) / (this.half * 4);
        uvs[index * 2 + 1] = (iy * stepZ) / (this.half * 4);
      }
    }
    for (let iy = 0; iy < cells; iy += 1) {
      for (let ix = 0; ix < cells; ix += 1) {
        const a = iy * cols + ix;
        indices.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
      }
    }
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const grass = this.keep(new THREE.MeshStandardMaterial({
      map: this.keep(groundTexture(this.biome.ground)),
      roughness: 1,
      metalness: 0,
    }));
    const ground = new THREE.Mesh(geometry, grass);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const baseTex = this.keep(groundTexture(this.biome.ground));
    baseTex.wrapS = THREE.RepeatWrapping;
    baseTex.wrapT = THREE.RepeatWrapping;
    baseTex.repeat.set(28, 28);
    const base = new THREE.Mesh(
      this.keep(new THREE.PlaneGeometry(this.span * 8, this.span * 8)),
      this.keep(new THREE.MeshStandardMaterial({ map: baseTex, roughness: 1, metalness: 0 })),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(this.midX, -0.4, this.midZ);
    base.receiveShadow = true;
    this.scene.add(base);
    return { cols, rows, heights: exact, originX: minX, originZ: minZ, stepX, stepZ };
  }

  private buildTrack() {
    const roadHalf = this.half * ASPHALT;
    const gravelHalf = this.half * 1.48;
    const limit = paintedHalf(this.track);
    const keep = this.track.points.map((_, i) => this.track.narrow?.[i] ?? 1);
    const roadEdge = Float64Array.from(keep, (n) => roadHalf * n);
    // Là où la piste est resserrée, le bac s'arrête au bord du hors-piste pour ne pas mordre sur la portion voisine.
    const gravelEdge = Float64Array.from(keep, (n) => n * THREE.MathUtils.lerp(limit, gravelHalf, THREE.MathUtils.clamp((n - 0.85) / 0.15, 0, 1)));
    if (this.biome.walls) {
      for (let i = 0; i < gravelEdge.length; i += 1) {
        const wall = this.edgeReach(this.track.points[i].s);
        if (gravelEdge[i] > wall) gravelEdge[i] = wall;
      }
    }
    const road = new THREE.Mesh(
      this.ribbon(roadEdge, this.roadLift),
      this.keep(new THREE.MeshStandardMaterial({
        map: this.keep(roadTexture()),
        roughness: 0.9,
        metalness: 0.05,
        side: THREE.DoubleSide,
      })),
    );
    road.receiveShadow = true;
    this.scene.add(road);

    const gravel = new THREE.Mesh(
      this.ribbon(gravelEdge, this.roadLift * 0.45),
      // Le gravier recule en profondeur plutôt que d'avancer la route : un décalage sur la route la ferait passer devant les pneus.
      this.keep(new THREE.MeshStandardMaterial({
        color: this.gravelColor(),
        roughness: 1,
        metalness: 0,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1,
      })),
    );
    gravel.receiveShadow = true;
    this.scene.add(gravel);
  }

  private ribbon(half: Float64Array, lift: number): THREE.BufferGeometry {
    const points = this.track.points;
    const count = this.track.closed ? points.length + 1 : points.length;
    const positions = new Float32Array(count * 2 * 3);
    const uvs = new Float32Array(count * 2 * 2);
    const repeat = Math.max(this.half * 4.2, 1e-3);
    for (let i = 0; i < count; i += 1) {
      const point = points[i % points.length];
      const width = half[i % points.length];
      const s = i === points.length ? this.track.length : point.s;
      const nx = -Math.sin(point.angle);
      const nz = Math.cos(point.angle);
      const y = this.reliefAt(s) + lift;
      const phi = bankAt(this.track, s);
      const outer = this.outerAt(s);
      const raisedLeft = bankOffset(width, phi, outer);
      const raisedRight = bankOffset(-width, phi, outer);
      const u = s / repeat;
      const left = i * 2;
      const right = left + 1;
      positions[left * 3] = point.x + nx * raisedLeft.lateral;
      positions[left * 3 + 1] = y + raisedLeft.y;
      positions[left * 3 + 2] = point.y + nz * raisedLeft.lateral;
      positions[right * 3] = point.x + nx * raisedRight.lateral;
      positions[right * 3 + 1] = y + raisedRight.y;
      positions[right * 3 + 2] = point.y + nz * raisedRight.lateral;
      uvs[left * 2] = 0;
      uvs[left * 2 + 1] = u;
      uvs[right * 2] = 1;
      uvs[right * 2 + 1] = u;
    }
    const indices: number[] = [];
    for (let i = 0; i < count - 1; i += 1) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildStart() {
    const start = this.track.points[0];
    const across = this.half * 2.02;
    const along = this.half * 0.26;
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -along / 2, 0, -across / 2,
      along / 2, 0, -across / 2,
      along / 2, 0, across / 2,
      -along / 2, 0, across / 2,
    ], 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.keep(new THREE.MeshStandardMaterial({
      map: this.keep(checkerTexture()),
      roughness: 0.8,
      side: THREE.DoubleSide,
    })));
    mesh.position.set(start.x, this.deck(0) + this.half * DECAL_LIFT, start.y);
    mesh.rotation.y = -start.angle;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  private buildGantry(): THREE.MeshStandardMaterial {
    const start = this.track.points[0];
    const nx = -Math.sin(start.angle);
    const nz = Math.cos(start.angle);
    const y = this.reliefAt(0) + this.roadLift;
    const reach = this.half * 1.42;
    const postH = this.half * 2.25;
    const metal = this.keep(new THREE.MeshStandardMaterial({ color: '#2a3038', roughness: 0.42, metalness: 0.72 }));
    const across = new THREE.Vector3(nx, 0, nz);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(this.keep(new THREE.BoxGeometry(this.half * 0.1, postH, this.half * 0.1)), metal);
      post.position.set(start.x + nx * reach * side, y + postH / 2, start.y + nz * reach * side);
      post.castShadow = true;
      this.scene.add(post);
    }
    const beam = new THREE.Mesh(this.keep(new THREE.BoxGeometry(reach * 2.15, this.half * 0.1, this.half * 0.1)), metal);
    beam.position.set(start.x, y + postH, start.y);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), across);
    beam.castShadow = true;
    this.scene.add(beam);
    const lamps = this.keep(new THREE.MeshStandardMaterial({
      color: '#241416',
      emissive: '#000000',
      roughness: 0.35,
      metalness: 0.1,
    }));
    const lampGeo = this.keep(new THREE.SphereGeometry(this.half * 0.075, 16, 12));
    for (let i = 0; i < 5; i += 1) {
      const offset = (i - 2) * reach * 0.34;
      const lamp = new THREE.Mesh(lampGeo, lamps);
      lamp.position.set(start.x + nx * offset, y + postH - this.half * 0.16, start.y + nz * offset);
      this.scene.add(lamp);
    }
    return lamps;
  }

  private buildBoards(lengthKm: number) {
    const labels = new Map<string, THREE.MeshStandardMaterial>();
    for (const label of ['50', '100', '150']) {
      labels.set(label, this.keep(new THREE.MeshStandardMaterial({
        map: this.keep(boardTexture(label)),
        roughness: 0.7,
      })));
    }
    const geometry = this.keep(new THREE.PlaneGeometry(this.half * 0.92, this.half * 0.46));
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3();
    const inward = new THREE.Vector3();
    for (const board of brakeBoards(this.track, lengthKm)) {
      const spot = pointAt(this.track, board.s);
      const y = this.reliefAt(board.s) + this.roadLift;
      const mesh = new THREE.Mesh(geometry, labels.get(board.label));
      mesh.position.set(board.x, y + this.half * 0.28, board.y);
      inward.set(spot.x - board.x, 0, spot.y - board.y);
      if (inward.lengthSq() < 1e-8) continue;
      inward.normalize();
      right.crossVectors(up, inward).normalize();
      mesh.quaternion.setFromRotationMatrix(this.basis.makeBasis(right, up, inward));
      mesh.castShadow = true;
      this.scene.add(mesh);
    }
  }

  /** Numéro de chaque virage, nom des virages et lignes droites connus, tournés vers la voiture qui arrive. */
  private buildSigns(signs: TrackSign[], meters: number) {
    if (!signs.length) return;
    const lead = 35 / Math.max(meters, 1e-6);
    const window = 40 / Math.max(meters, 1e-6);
    const post = this.keep(new THREE.MeshStandardMaterial({ color: '#2b2f38', roughness: 0.6, metalness: 0.4 }));
    const postGeo = this.keep(new THREE.BoxGeometry(this.half * 0.05, 1, this.half * 0.05));
    const up = new THREE.Vector3(0, 1, 0);
    const facing = new THREE.Vector3();
    const right = new THREE.Vector3();
    for (const sign of signs) {
      const apex = sign.at * this.track.length;
      const before = pointAt(this.track, apex - window);
      const after = pointAt(this.track, apex + window);
      const turn = Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle));
      const s = mod(sign.number != null ? apex - lead : apex, this.track.length);
      const spot = pointAt(this.track, s);
      const nx = Math.cos(spot.angle + Math.PI / 2);
      const nz = Math.sin(spot.angle + Math.PI / 2);
      // À l'extérieur du virage (là où l'on regarde en l'abordant), sinon de l'autre côté si une autre portion passe trop près.
      const outside = turn > 0 ? -1 : 1;
      let placed: { x: number; z: number; side: number } | null = null;
      for (const side of [outside, -outside]) {
        // Derrière le mur souple du dégagement (1,8 fois la limite peinte), pour ne jamais rouler à travers.
        for (const reach of [2.9, 2.5]) {
          const x = spot.x + nx * this.half * reach * side;
          const z = spot.y + nz * this.half * reach * side;
          if (clearance(this.track, x, z, s) < paintedHalf(this.track) * 1.25) continue;
          placed = { x, z, side };
          break;
        }
        if (placed) break;
      }
      if (!placed) continue;

      const wide = sign.name != null;
      const width = this.half * (wide ? 2.1 : 0.8);
      const height = this.half * (wide ? 0.56 : 0.8);
      const material = this.keep(new THREE.MeshStandardMaterial({
        map: this.keep(signTexture(sign)),
        roughness: 0.55,
        side: THREE.DoubleSide,
      }));
      const board = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(width, height)), material);
      const ground = this.reliefAt(s);
      const lift = this.half * 0.55;
      board.position.set(placed.x, ground + lift + height / 2, placed.z);
      // Face au pilote qui arrive, légèrement ouvert vers la piste.
      facing.set(-Math.cos(spot.angle), 0, -Math.sin(spot.angle))
        .addScaledVector(new THREE.Vector3(-nx * placed.side, 0, -nz * placed.side), 0.45)
        .normalize();
      right.crossVectors(up, facing).normalize();
      board.quaternion.setFromRotationMatrix(this.basis.makeBasis(right, up, facing));
      board.castShadow = true;
      this.scene.add(board);
      for (const offset of wide ? [-0.4, 0.4] : [0]) {
        const leg = new THREE.Mesh(postGeo, post);
        leg.scale.y = lift + height * 0.5;
        leg.position.set(
          placed.x + right.x * width * offset,
          ground + leg.scale.y / 2,
          placed.z + right.z * width * offset,
        );
        leg.castShadow = true;
        this.scene.add(leg);
      }
    }
  }

  /** Glissières ou murs au bord du mur souple, puis le décor du circuit, hors piste. */
  private buildSurroundings() {
    const mapped = surroundingsFor(this.circuitId);
    if (mapped) {
      this.buildWater(mapped);
      this.buildHistoric(mapped.loops);
    }
    this.buildRails();
    if (mapped && mapped.stands.length + mapped.blocks.length > 0) this.plantFootprints(mapped.stands, mapped.blocks);
    else {
      const pit = planPit(this.track, this.half, this.biome.walls);
      if (pit.box) this.plantPlaced([pit.box], 'pit');
      if (this.biome.stands) this.plantPlaced(planStands(this.track, this.half, pit.side, this.biome.walls), 'stand');
      this.plantPlaced(planBlocks(this.track, this.half, this.biome.blocks, this.biome.walls, this.biome.night), 'block');
    }
    this.buildTrees();
    this.buildTires();
    this.buildLamps();
  }

  private gravelColor(): string {
    if (this.biome.walls) return '#3a3e44';
    if (this.biome.night) return '#4a463c';
    if (this.biome.ground === 'sand') return '#e4c98a';
    if (this.biome.ground === 'dry') return '#d0bc90';
    return '#d5c09a';
  }

  /** Distance du centre au rail : au vibreur en ville, au mur souple ailleurs. */
  private edgeReach(s: number): number {
    const painted = paintedHalfAt(this.track, s);
    return painted * (this.biome.walls ? STREET_RUNOFF_RATIO : RUNOFF_RATIO);
  }

  /**
   * Un point au-delà du rail, du côté `side` (+1 = gauche dans le sens de la marche).
   * `extra` l'éloigne encore. `pad` est le rayon du décor : il ne doit couvrir aucune autre portion.
   */
  private beside(s: number, side: number, extra: number, pad = 0): Beside | null {
    const spot = pointAt(this.track, s);
    const nx = -Math.sin(spot.angle);
    const nz = Math.cos(spot.angle);
    const reach = this.edgeReach(s) + extra;
    const raised = bankOffset(side * reach, bankAt(this.track, s), this.outerAt(s));
    const x = spot.x + nx * raised.lateral;
    const z = spot.y + nz * raised.lateral;
    if (coversTrack(this.track, x, z, s, pad)) return null;
    return {
      x,
      z,
      y: this.surfaceAt(s) + this.roadLift + raised.y,
      nx,
      nz,
      angle: spot.angle,
      s: spot.s,
    };
  }

  private railPosts(spacing: number): Array<Array<Beside | null>> {
    const left: Array<Beside | null> = [];
    const right: Array<Beside | null> = [];
    let nextS = -1;
    for (const point of this.track.points) {
      if (point.s < nextS) continue;
      nextS = point.s + spacing;
      left.push(this.beside(point.s, 1, this.half * 0.02));
      right.push(this.beside(point.s, -1, this.half * 0.02));
    }
    return [left, right];
  }

  private buildRails() {
    const street = this.biome.walls;
    const height = this.half * (street ? 0.16 : 0.09);
    const spacing = this.half * (street ? 0.55 : 1.15);
    const rows = this.railPosts(spacing);
    const positions: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const capPositions: number[] = [];
    const capNormals: number[] = [];
    const capIndices: number[] = [];
    const pushQuad = (
      targetP: number[],
      targetN: number[],
      targetI: number[],
      a: Beside,
      b: Beside,
      side: number,
      y0: number,
      y1: number,
      nudge: number,
    ) => {
      const inn = -side;
      const ox = a.nx * inn * nudge;
      const oz = a.nz * inn * nudge;
      const base = targetP.length / 3;
      targetP.push(
        a.x + ox, a.y + y0, a.z + oz,
        b.x + ox, b.y + y0, b.z + oz,
        a.x + ox, a.y + y1, a.z + oz,
        b.x + ox, b.y + y1, b.z + oz,
      );
      const nx = a.nx * inn;
      const nz = a.nz * inn;
      targetN.push(nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz);
      targetI.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
    };
    const link = (row: Array<Beside | null>, side: number) => {
      for (let i = 0; i < row.length - 1; i += 1) {
        const a = row[i];
        const b = row[i + 1];
        if (!a || !b) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > spacing * 2.2) continue;
        if (this.chordCovers(a, b)) continue;
        pushQuad(positions, normals, indices, a, b, side, 0, height, 0);
        if (street) pushQuad(capPositions, capNormals, capIndices, a, b, side, height * 0.82, height, this.half * 0.012);
      }
      if (!this.track.closed || row.length < 3) return;
      const a = row[row.length - 1];
      const b = row[0];
      if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > spacing * 2.2 || this.chordCovers(a, b)) return;
      pushQuad(positions, normals, indices, a, b, side, 0, height, 0);
      if (street) pushQuad(capPositions, capNormals, capIndices, a, b, side, height * 0.82, height, this.half * 0.012);
    };
    link(rows[0], 1);
    link(rows[1], -1);
    const addSheet = (position: number[], normal: number[], index: number[], color: string, metalness: number, roughness: number) => {
      if (!position.length) return;
      const geometry = this.keep(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
      geometry.setIndex(index);
      const mesh = new THREE.Mesh(geometry, this.keep(new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        side: THREE.DoubleSide,
      })));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };
    addSheet(positions, normals, indices, street ? '#d7d1c6' : '#e4e8ee', street ? 0.04 : 0.62, street ? 0.9 : 0.4);
    addSheet(capPositions, capNormals, capIndices, '#c8102e', 0.08, 0.55);
  }

  private chordCovers(a: Beside, b: Beside): boolean {
    for (const t of [0.25, 0.5, 0.75]) {
      if (coversTrack(this.track, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, a.s + (b.s - a.s) * t, 0)) return true;
    }
    return false;
  }

  /** Bâtiment des stands, du côté le plus dégagé. Retourne ce côté pour placer les tribunes en face. */
  private plantPlaced(places: Placed[], kind: 'pit' | 'stand' | 'block') {
    if (!places.length) return;
    const scatter: Scatter[] = places.map((place) => {
      const deck = this.reliefAt(place.s) + this.roadLift + place.lift;
      const ground = kind === 'block'
        ? Math.max(this.sampleGround(place.x, place.y), deck - this.half * 0.35)
        : deck;
      return {
        x: place.x,
        y: ground + place.height / 2,
        z: place.y,
        sx: place.length,
        sy: place.height,
        sz: place.depth,
        yaw: -place.angle,
        color: place.color,
      };
    });
    if (kind === 'pit') {
      const place = scatter[0];
      const mesh = new THREE.Mesh(
        this.keep(new THREE.BoxGeometry(place.sx, place.sy, place.sz)),
        this.keep(new THREE.MeshStandardMaterial({ color: place.color, roughness: 0.78, metalness: 0.18 })),
      );
      mesh.position.set(place.x, place.y, place.z);
      mesh.rotation.y = place.yaw;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return;
    }
    if (kind === 'stand') {
      const map = this.keep(standTexture());
      this.plant(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
        map,
        roughness: 0.84,
        metalness: 0.02,
      }), scatter);
      return;
    }
    const map = this.keep(facadeTexture(this.biome.night));
    this.plant(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
      map,
      color: '#ffffff',
      emissive: '#ffffff',
      emissiveMap: map,
      emissiveIntensity: this.biome.night ? 0.9 : 0.05,
      roughness: 0.88,
      metalness: 0.04,
    }), scatter);
  }

  /** Tribunes et immeubles relevés le long du tracé réel, déjà rejetés s'ils mordent l'asphalte. */
  private plantFootprints(stands: Footprint[], blocks: Footprint[]) {
    const standPlaces: Placed[] = stands.map((box, index) => ({
      ...box,
      height: Math.min(Math.max(box.depth * 0.62, this.half * 0.38), this.half * 1.2),
      color: STAND_COLORS[index % STAND_COLORS.length],
    }));
    const blockPlaces: Placed[] = blocks.map((box) => {
      const seed = hash(Math.round(box.x * 10), Math.round(box.y * 10));
      let height = this.half * (0.75 + seed * (this.biome.walls ? 2.3 : 0.85));
      if (seed > 0.9) height *= 1.55;
      return { ...box, height, color: '#d9d3c6' };
    });
    this.plantPlaced(standPlaces, 'stand');
    this.plantPlaced(blockPlaces, 'block');
  }

  private insideGrid(x: number, z: number): boolean {
    if (this.stepX <= 0 || this.stepZ <= 0) return false;
    const u = (x - this.originX) / this.stepX;
    const v = (z - this.originZ) / this.stepZ;
    return u >= 0 && v >= 0 && u < this.cols - 1 && v < this.rows - 1;
  }

  private waterLevel(ring: number[][]): number {
    let low = Infinity;
    for (const [x, y] of ring) {
      if (!this.insideGrid(x, y)) continue;
      low = Math.min(low, this.sampleGround(x, y));
    }
    if (!Number.isFinite(low)) return -0.22;
    return low + Math.max(0.14, this.roadLift);
  }

  /** Plans d'eau et nappes de mer, posés à plat, jamais sur l'asphalte. */
  private buildWater(scene: CircuitSurroundings) {
    const positions: number[] = [];
    const addRing = (ring: number[][]) => {
      if (ring.length < 3) return;
      const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
      let faces: number[][] = [];
      try {
        faces = THREE.ShapeUtils.triangulateShape(contour, []);
      } catch {
        return;
      }
      const height = this.waterLevel(ring);
      for (const face of faces) {
        if (face.length < 3) continue;
        const tri = [contour[face[0]], contour[face[1]], contour[face[2]]];
        if (tri.some((point) => !point)) continue;
        const mx = (tri[0].x + tri[1].x + tri[2].x) / 3;
        const my = (tri[0].y + tri[1].y + tri[2].y) / 3;
        if (paintClearance(this.track, mx, my) < this.half * 0.25) continue;
        const edge = Math.max(
          Math.hypot(tri[0].x - tri[1].x, tri[0].y - tri[1].y),
          Math.hypot(tri[1].x - tri[2].x, tri[1].y - tri[2].y),
          Math.hypot(tri[2].x - tri[0].x, tri[2].y - tri[0].y),
        );
        if (edge > this.span * 1.35) continue;
        for (const point of tri) positions.push(point.x, height, point.y);
      }
    };
    for (const ring of scene.waters) addRing(ring);
    for (const ring of scene.sheets) addRing(ring);
    if (positions.length < 9) return;
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.keep(new THREE.MeshStandardMaterial({
      color: this.biome.night ? '#16324a' : '#2a7498',
      roughness: 0.16,
      metalness: 0.42,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })));
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  /**
   * Ancien anneau, en béton. La ligne droite partagée avec le tracé actuel n'est pas redessinée.
   * Là où l'anneau coupe la piste, il reste au niveau du sol : c'est la piste actuelle qui descend dessous.
   * Le dévers suit le rayon lissé des deux courbes, jusqu'à 38°, pour que le tablier reste une bande.
   */
  private buildHistoric(loops: number[][][]) {
    const halfW = 6 * this.meter;
    for (const loop of loops) {
      const samples = resampleLoop(loop, Math.max(this.half * 0.35, 1.2));
      const count = samples.length;
      if (count < 8) continue;
      const info = this.ovalFrames(samples);
      const bridged = info.map((frame) => this.crossesRoad(frame));
      const outsideLeft = info.reduce((sum, frame) => sum + frame.turn, 0) < 0;

      const deck: Ribbon = { positions: [], indices: [] };
      const lip: Ribbon = { positions: [], indices: [] };
      const skirt: Ribbon = { positions: [], indices: [] };
      let previous: OvalEdge | null = null;
      let first: OvalEdge | null = null;
      for (let i = 0; i < count; i += 1) {
        if (info[i].shared) {
          previous = null;
          continue;
        }
        const edge = this.ovalEdge(info[i], halfW, bridged[i], outsideLeft);
        if (!edge) {
          previous = null;
          continue;
        }
        if (!first) first = edge;
        this.linkOval(deck, lip, skirt, previous, edge, halfW * 14);
        previous = edge;
      }
      this.linkOval(deck, lip, skirt, previous, first, halfW * 14);
      this.addConcrete(deck.positions, deck.indices, '#7a756c');
      this.addConcrete(lip.positions, lip.indices, '#2c2a28');
      this.addConcrete(skirt.positions, skirt.indices, '#5e5952');
    }
  }

  /** L'anneau coupe franchement la piste actuelle ici : le tablier passe au-dessus, la piste dans la cuvette. */
  private crossesRoad(frame: OvalFrame): boolean {
    return frame.delta > 1.05 && frame.dist < frame.painted + 18 * this.meter;
  }

  /**
   * Cap et dévers lissés. Un angle OSM brut, sur un pas de quelques mètres,
   * donnerait un pic de 38° : une pointe, pas une courbe relevée.
   */
  private ovalFrames(samples: Array<{ x: number; y: number }>): OvalFrame[] {
    const count = samples.length;
    const cum = [0];
    for (let i = 1; i < count; i += 1) {
      cum.push(cum[i - 1] + Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
    }
    const gap = Math.hypot(samples[0].x - samples[count - 1].x, samples[0].y - samples[count - 1].y);
    const closed = gap < Math.max(this.half * 0.35, 1.2) * 1.5;
    const total = cum[count - 1] + (closed ? gap : 0);
    const reach = 90 * this.meter;
    const pointAtDist = (distance: number) => loopPoint(samples, cum, total, closed, distance);
    const headings = samples.map((_, index) => {
      const distance = cum[index];
      const back = closed ? reach : Math.min(reach, distance);
      const fore = closed ? reach : Math.min(reach, total - distance);
      const behind = pointAtDist(distance - back);
      const ahead = pointAtDist(distance + fore);
      return Math.atan2(ahead.y - behind.y, ahead.x - behind.x);
    });
    const nearest = (distance: number) => {
      let best = 0;
      let bestDelta = Infinity;
      for (let i = 0; i < count; i += 1) {
        let delta = Math.abs(cum[i] - distance);
        if (closed) delta = Math.min(delta, total - delta);
        if (delta >= bestDelta) continue;
        bestDelta = delta;
        best = i;
      }
      return best;
    };
    const raw = samples.map((_, index) => {
      const distance = cum[index];
      const behind = nearest(closed ? mod(distance - reach, total) : Math.max(0, distance - reach));
      const ahead = nearest(closed ? mod(distance + reach, total) : Math.min(total, distance + reach));
      let arc = cum[ahead] - cum[behind];
      if (closed && arc < 0) arc += total;
      if (!closed) arc = Math.abs(arc);
      const turn = Math.atan2(Math.sin(headings[ahead] - headings[behind]), Math.cos(headings[ahead] - headings[behind]));
      const radiusM = arc > 1e-3 ? (arc / Math.max(Math.abs(turn), 1e-4)) / Math.max(this.meter, 1e-6) : 1e6;
      const bank = radiusM < 640 ? ((38 * Math.PI) / 180) * THREE.MathUtils.clamp((640 - radiusM) / 300, 0, 1) : 0;
      return { turn, bank };
    });
    const blend = 45 * this.meter;
    return samples.map((curr, index) => {
      let sum = 0;
      let weight = 0;
      for (let other = 0; other < count; other += 1) {
        let delta = Math.abs(cum[other] - cum[index]);
        if (closed) delta = Math.min(delta, total - delta);
        if (delta > blend) continue;
        const influence = 1 - delta / blend;
        sum += raw[other].bank * influence;
        weight += influence;
      }
      const turn = raw[index].turn;
      const ahead = headings[index];
      const near = nearestCenter(this.track, curr.x, curr.y);
      const spot = pointAt(this.track, near.s);
      let delta = Math.abs(ahead - spot.angle) % Math.PI;
      if (delta > Math.PI / 2) delta = Math.PI - delta;
      const painted = paintedHalfAt(this.track, near.s);
      return {
        x: curr.x,
        y: curr.y,
        ahead,
        nx: -Math.sin(ahead),
        nz: Math.cos(ahead),
        turn,
        bank: weight > 0 ? sum / weight : 0,
        s: near.s,
        dist: near.distance,
        delta,
        painted,
        shared: delta < 0.4 && near.distance < painted,
      };
    });
  }

  /**
   * Décale le ruban hors de l'asphalte, sauf au croisement : là il reste en travers,
   * à l'altitude d'origine, pendant que la piste actuelle passe dans la cuvette.
   */
  private ovalEdge(frame: OvalFrame, halfW: number, overRoad: boolean, outsideLeft: boolean): OvalEdge | null {
    const awayX = frame.x - pointAt(this.track, frame.s).x;
    const awayY = frame.y - pointAt(this.track, frame.s).y;
    const away = Math.hypot(awayX, awayY) || 1;
    let shove = 0;
    let cx = frame.x;
    let cy = frame.y;
    if (overRoad) {
      const spot = pointAt(this.track, frame.s);
      cx = spot.x;
      cy = spot.y;
    } else {
      for (let step = 0; step < 10; step += 1) {
        cx = frame.x + (awayX / away) * shove;
        cy = frame.y + (awayY / away) * shove;
        const leftClear = paintClearance(this.track, cx + frame.nx * halfW, cy + frame.nz * halfW);
        const rightClear = paintClearance(this.track, cx - frame.nx * halfW, cy - frame.nz * halfW);
        if (paintClearance(this.track, cx, cy) > 0 && leftClear > 0 && rightClear > 0) break;
        shove += this.half * 0.2;
      }
      if (paintClearance(this.track, cx, cy) < 0) return null;
    }
    const dipped = this.insideGrid(cx, cy) ? this.sampleGround(cx, cy) : 0;
    const hold = THREE.MathUtils.clamp(Math.abs(this.bowl(frame.s)) / (this.half * 0.12), 0, 1);
    const ground = dipped * (1 - hold) + this.groundAt(frame.s) * hold;
    const rise = Math.sin(frame.bank) * halfW * 2;
    const base = ground + Math.max(this.half * 0.08, this.meter * 0.8);
    return {
      lx: cx + frame.nx * halfW,
      ly: base + (outsideLeft ? rise : 0),
      lz: cy + frame.nz * halfW,
      rx: cx - frame.nx * halfW,
      ry: base + (outsideLeft ? 0 : rise),
      rz: cy - frame.nz * halfW,
    };
  }

  /** Tablier en trois bandes (bord, béton, bord), plus le chant et le dessous. */
  private linkOval(deck: Ribbon, lip: Ribbon, skirt: Ribbon, previous: OvalEdge | null, edge: OvalEdge | null, limit: number) {
    if (!previous || !edge) return;
    if (Math.hypot(previous.lx - edge.lx, previous.lz - edge.lz) > limit) return;
    const band = 0.08;
    this.ovalQuad(lip, this.sliceEdge(previous, 0, band), this.sliceEdge(edge, 0, band));
    this.ovalQuad(deck, this.sliceEdge(previous, band, 1 - band), this.sliceEdge(edge, band, 1 - band));
    this.ovalQuad(lip, this.sliceEdge(previous, 1 - band, 1), this.sliceEdge(edge, 1 - band, 1));
    const thickness = Math.max(this.half * 0.03, this.meter * 0.25);
    const lower = (side: OvalEdge): OvalEdge => ({
      lx: side.lx, ly: side.ly - thickness, lz: side.lz,
      rx: side.rx, ry: side.ry - thickness, rz: side.rz,
    });
    const prevLow = lower(previous);
    const edgeLow = lower(edge);
    this.ovalQuad(skirt, edgeLow, prevLow);
    this.ovalQuad(skirt,
      { lx: previous.lx, ly: previous.ly, lz: previous.lz, rx: prevLow.lx, ry: prevLow.ly, rz: prevLow.lz },
      { lx: edge.lx, ly: edge.ly, lz: edge.lz, rx: edgeLow.lx, ry: edgeLow.ly, rz: edgeLow.lz },
    );
    this.ovalQuad(skirt,
      { lx: prevLow.rx, ly: prevLow.ry, lz: prevLow.rz, rx: previous.rx, ry: previous.ry, rz: previous.rz },
      { lx: edgeLow.rx, ly: edgeLow.ry, lz: edgeLow.rz, rx: edge.rx, ry: edge.ry, rz: edge.rz },
    );
  }

  private sliceEdge(edge: OvalEdge, from: number, to: number): OvalEdge {
    const at = (t: number) => ({
      x: edge.lx + (edge.rx - edge.lx) * t,
      y: edge.ly + (edge.ry - edge.ly) * t,
      z: edge.lz + (edge.rz - edge.lz) * t,
    });
    const start = at(from);
    const end = at(to);
    return { lx: start.x, ly: start.y, lz: start.z, rx: end.x, ry: end.y, rz: end.z };
  }

  /** Deux triangles qui ferment le rectangle gauche-droite, sans laisser un seul côté. */
  private ovalQuad(ribbon: Ribbon, previous: OvalEdge, edge: OvalEdge) {
    const base = ribbon.positions.length / 3;
    ribbon.positions.push(
      previous.lx, previous.ly, previous.lz,
      previous.rx, previous.ry, previous.rz,
      edge.lx, edge.ly, edge.lz,
      edge.rx, edge.ry, edge.rz,
    );
    ribbon.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }

  /** Creux lisse sous l'ancien anneau : plein au croisement, nul aux lèvres. */
  private bowl(s: number): number {
    if (!this.underS.length) return 0;
    const depth = this.half * 0.85;
    const width = 120 * this.meter;
    let drop = 0;
    for (const at of this.underS) {
      let along = Math.abs(s - at);
      if (this.track.closed) along = Math.min(along, this.track.length - along);
      if (along >= width) continue;
      const t = along / width;
      drop = Math.min(drop, -depth * 0.5 * (1 + Math.cos(Math.PI * t)));
    }
    return drop;
  }

  /** Abscisses où l'ancien anneau coupe franchement la piste actuelle, lues sur les mêmes trames que le tablier. */
  private findUnderpasses(): number[] {
    const mapped = surroundingsFor(this.circuitId);
    if (!mapped) return [];
    const found: number[] = [];
    for (const loop of mapped.loops) {
      const samples = resampleLoop(loop, Math.max(this.half * 0.35, 1.2));
      if (samples.length < 8) continue;
      const frames = this.ovalFrames(samples);
      const count = frames.length;
      const seen = new Array<boolean>(count).fill(false);
      for (let start = 0; start < count; start += 1) {
        if (seen[start] || !this.crossesRoad(frames[start])) continue;
        let best = frames[start];
        let cursor = start;
        while (!seen[cursor] && this.crossesRoad(frames[cursor])) {
          seen[cursor] = true;
          if (frames[cursor].dist < best.dist) best = frames[cursor];
          cursor = (cursor + 1) % count;
          if (cursor === start) break;
        }
        found.push(best.s);
      }
    }
    return found;
  }

  private addConcrete(positions: number[], indices: number[], color: string) {
    if (positions.length < 9) return;
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, this.keep(new THREE.MeshStandardMaterial({
      color,
      roughness: 0.94,
      metalness: 0.02,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })));
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);
  }

  private buildTrees() {
    if (this.biome.trees <= 0) return;
    const palms = this.biome.palms;
    const trunks: Scatter[] = [];
    const crowns: Scatter[] = [];
    const tops: Scatter[] = [];
    const colors = canopyPalette(this.biome);
    const points = this.track.points;
    const step = Math.max(1, Math.floor(points.length / 70));
    for (let i = 0; i < points.length; i += step) {
      if (hash(i, 21) > this.biome.trees) continue;
      const scale = (0.75 + hash(i, 22) * 0.55) * this.biome.treeScale;
      const canopyR = this.half * (palms ? 0.2 : 0.3) * scale;
      const trunkH = this.half * (palms ? 0.95 : 0.42) * scale;
      const extra = canopyR + this.half * (0.28 + hash(i, 23) * (this.biome.walls ? 1.15 : 4.4));
      const prefer = hash(i, 24) > 0.5 ? 1 : -1;
      const spot = this.beside(points[i].s, prefer, extra, canopyR)
        ?? this.beside(points[i].s, -prefer, extra, canopyR);
      if (!spot) continue;
      const ground = this.sampleGround(spot.x, spot.z);
      const yaw = hash(i, 25) * Math.PI * 2;
      const color = colors[trunks.length % colors.length];
      trunks.push({
        x: spot.x,
        y: ground + trunkH / 2,
        z: spot.z,
        sx: this.half * (palms ? 0.02 : 0.045) * scale,
        sy: trunkH,
        sz: this.half * (palms ? 0.02 : 0.045) * scale,
        yaw,
        color,
      });
      if (palms) {
        crowns.push({
          x: spot.x,
          y: ground + trunkH,
          z: spot.z,
          sx: canopyR,
          sy: canopyR * 0.42,
          sz: canopyR,
          yaw,
          color,
        });
      } else {
        const lowH = this.half * 0.34 * scale;
        const topH = this.half * 0.4 * scale;
        crowns.push({
          x: spot.x,
          y: ground + trunkH * 0.82,
          z: spot.z,
          sx: canopyR,
          sy: lowH,
          sz: canopyR,
          yaw,
          color,
        });
        tops.push({
          x: spot.x,
          y: ground + trunkH + topH * 0.15,
          z: spot.z,
          sx: canopyR * 0.68,
          sy: topH,
          sz: canopyR * 0.68,
          yaw,
          color,
        });
      }
    }
    if (!trunks.length) return;
    this.plant(new THREE.CylinderGeometry(1, 1.15, 1, 5), new THREE.MeshStandardMaterial({
      color: '#6a4a32',
      roughness: 0.92,
      metalness: 0,
    }), trunks, false);
    const leaves = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 });
    if (palms) this.plant(new THREE.SphereGeometry(1, 7, 5), leaves, crowns);
    else {
      this.plant(new THREE.ConeGeometry(1, 1, 6), leaves, crowns);
      this.plant(new THREE.ConeGeometry(1, 1, 6), leaves, tops);
    }
  }

  private buildTires() {
    const points = this.track.points;
    const step = Math.max(4, Math.round(points.length / 70));
    const places: Scatter[] = [];
    let last = -1e9;
    for (let i = 0; i < points.length; i += step) {
      const point = points[i];
      const next = points[(i + step) % points.length];
      const turn = Math.atan2(Math.sin(next.angle - point.angle), Math.cos(next.angle - point.angle));
      if (Math.abs(turn) < 0.32) continue;
      let along = point.s - last;
      if (along < 0) along += this.track.length;
      if (along < this.track.length * 0.035) continue;
      const size = this.half * 0.22;
      const spot = this.beside(point.s, turn > 0 ? -1 : 1, this.half * 0.2, size);
      if (!spot) continue;
      last = point.s;
      places.push({
        x: spot.x,
        y: spot.y + size / 2,
        z: spot.z,
        sx: size * 1.45,
        sy: size,
        sz: size,
        yaw: -spot.angle,
        color: '#1c1c1c',
      });
      if (places.length >= 16) break;
    }
    this.plant(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.96,
      metalness: 0,
    }), places);
  }

  private buildLamps() {
    if (!this.biome.night) return;
    const poles: Scatter[] = [];
    const bulbs: Scatter[] = [];
    let nextS = -1;
    for (const point of this.track.points) {
      if (point.s < nextS) continue;
      nextS = point.s + this.half * 9;
      const spot = this.beside(point.s, 1, this.half * 0.28) ?? this.beside(point.s, -1, this.half * 0.28);
      if (!spot) continue;
      const height = this.half * 0.72;
      poles.push({
        x: spot.x,
        y: spot.y + height / 2,
        z: spot.z,
        sx: this.half * 0.025,
        sy: height,
        sz: this.half * 0.025,
        yaw: 0,
        color: '#ffffff',
      });
      bulbs.push({
        x: spot.x,
        y: spot.y + height,
        z: spot.z,
        sx: this.half * 0.045,
        sy: this.half * 0.045,
        sz: this.half * 0.045,
        yaw: 0,
        color: '#ffffff',
      });
    }
    this.plant(new THREE.CylinderGeometry(1, 1, 1, 5), new THREE.MeshStandardMaterial({
      color: '#2a3038',
      roughness: 0.6,
      metalness: 0.4,
    }), poles, false);
    this.plant(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({
      color: '#ffe7c2',
      emissive: '#ffd9a0',
      emissiveIntensity: 2.4,
      roughness: 0.4,
    }), bulbs, false);
  }

  private plant(geometry: THREE.BufferGeometry, material: THREE.Material, places: Scatter[], tint = true) {
    if (!places.length) {
      geometry.dispose();
      material.dispose();
      return;
    }
    const mesh = new THREE.InstancedMesh(this.keep(geometry), this.keep(material), places.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < places.length; i += 1) {
      const place = places[i];
      dummy.position.set(place.x, place.y, place.z);
      dummy.rotation.set(0, place.yaw, 0);
      dummy.scale.set(place.sx, place.sy, place.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (tint) mesh.setColorAt(i, color.set(place.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    this.scene.add(mesh);
  }

  private buildChevrons() {
    const geometry = this.keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0.62, 0.03, 0,
      -0.4, 0.03, 0.3,
      -0.4, 0.03, -0.3,
    ], 3));
    geometry.computeVertexNormals();
    const material = this.keep(new THREE.MeshBasicMaterial({
      color: '#f7f7f7',
      side: THREE.DoubleSide,
    }));
    const step = Math.max(8, Math.round(this.track.points.length / 16));
    for (let i = step; i < this.track.points.length - step; i += step) {
      const point = this.track.points[i];
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(point.x, this.deck(point.s) + this.half * DECAL_LIFT, point.y);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.y = -point.angle;
      mesh.rotation.z = -bankAt(this.track, point.s);
      mesh.scale.setScalar(this.half * 0.5);
      this.scene.add(mesh);
    }
  }

  private makeCar(ghost: boolean): CarRig {
    const root = new THREE.Group();
    root.scale.setScalar(this.scale);
    const paint = this.keep(new THREE.MeshPhysicalMaterial({
      color: ghost ? '#f4f7fb' : '#e10600',
      metalness: ghost ? 0.08 : 0.58,
      roughness: ghost ? 0.32 : 0.26,
      clearcoat: ghost ? 0 : 0.72,
      clearcoatRoughness: 0.18,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }));
    const carbon = this.keep(new THREE.MeshStandardMaterial({
      color: '#16181c',
      roughness: 0.48,
      metalness: 0.45,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }));
    const rubber = this.keep(new THREE.MeshStandardMaterial({
      color: '#141414',
      roughness: 0.9,
      metalness: 0.04,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }));
    const metal = this.keep(new THREE.MeshStandardMaterial({
      color: '#d5d8dd',
      roughness: 0.32,
      metalness: 0.82,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }));
    const brake = this.keep(new THREE.MeshStandardMaterial({
      color: '#2a1010',
      emissive: '#ff2b2b',
      emissiveIntensity: 0,
      roughness: 0.4,
    }));
    const add = (mesh: THREE.Mesh) => {
      root.add(mesh);
      return mesh;
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
      return add(new THREE.Mesh(this.keep(new THREE.BoxGeometry(w, h, d)), material)).position.set(x, y, z);
    };
    const white = this.keep(new THREE.MeshStandardMaterial({
      color: '#f4f4f4',
      roughness: 0.4,
      metalness: 0.05,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }));
    box(2.6, 0.04, 1.3, 0.05, 0.07, 0, carbon);
    box(1.35, 0.32, 0.52, 0.35, 0.32, 0, paint);
    const nose = add(new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.05, 0.16, 1.22, 12)), paint));
    nose.rotation.z = -Math.PI / 2;
    nose.position.set(1.42, 0.3, 0);
    box(0.55, 0.025, 0.1, 1.55, 0.39, 0, white);
    box(0.32, 0.028, 1.4, 2.14, 0.085, 0, carbon);
    box(0.1, 0.02, 1.22, 2.02, 0.125, 0, carbon);
    box(0.34, 0.2, 0.02, 2.1, 0.15, 0.69, carbon);
    box(0.34, 0.2, 0.02, 2.1, 0.15, -0.69, carbon);
    box(0.03, 0.16, 0.03, 1.9, 0.18, 0.09, carbon);
    box(0.03, 0.16, 0.03, 1.9, 0.18, -0.09, carbon);
    box(0.04, 0.22, 0.28, 1.15, 0.16, 0, carbon);
    box(0.36, 0.32, 0.02, 0.85, 0.28, 0.46, carbon);
    box(0.36, 0.32, 0.02, 0.85, 0.28, -0.46, carbon);
    box(1.15, 0.34, 0.34, -0.05, 0.3, 0.4, paint);
    box(1.15, 0.34, 0.34, -0.05, 0.3, -0.4, paint);
    box(0.16, 0.12, 0.1, 0.05, 0.52, 0.28, carbon);
    box(0.16, 0.12, 0.1, 0.05, 0.52, -0.28, carbon);
    box(0.7, 0.26, 0.42, -0.45, 0.4, 0, paint);
    box(0.5, 0.34, 0.2, 0.32, 0.79, 0, carbon);
    const helmet = add(new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.13, 16, 12)), this.keep(new THREE.MeshStandardMaterial({
      color: ghost ? '#ffffff' : '#f2f2f2',
      roughness: 0.35,
      metalness: 0.15,
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
    }))));
    helmet.position.set(0.68, 0.58, 0);
    helmet.scale.set(1.05, 0.86, 0.92);
    box(0.22, 0.16, 0.28, 0.42, 0.66, 0, carbon);
    box(0.34, 0.04, 1, -1.98, 0.64, 0, carbon);
    box(0.12, 0.03, 0.92, -1.84, 0.74, 0, carbon);
    box(0.48, 0.55, 0.025, -2.0, 0.52, 0.5, paint);
    box(0.48, 0.55, 0.025, -2.0, 0.52, -0.5, paint);
    box(0.22, 0.03, 0.7, -1.9, 0.2, 0, carbon);
    box(0.4, 0.08, 0.72, -1.72, 0.1, 0, carbon);
    add(new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.06, 0.05, 0.16)), brake)).position.set(-2.16, 0.3, 0);

    const spinners: THREE.Group[] = [];
    const front: Wheel[] = [];
    const wheel = (x: number, z: number, steered: boolean, width: number) => {
      const hub = new THREE.Group();
      hub.position.set(x, TYRE_RADIUS, z);
      const spinner = new THREE.Group();
      const tire = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(TYRE_RADIUS, TYRE_RADIUS, width, 18)), rubber);
      tire.rotation.x = Math.PI / 2;
      const rim = new THREE.Mesh(this.keep(new THREE.CylinderGeometry(0.165, 0.165, width * 0.72, 12)), metal);
      rim.rotation.x = Math.PI / 2;
      spinner.add(tire, rim);
      hub.add(spinner);
      root.add(hub);
      spinners.push(spinner);
      if (steered) front.push({ hub, spinner });
    };
    wheel(1.525, 0.735, true, 0.305);
    wheel(1.525, -0.735, true, 0.305);
    wheel(-1.525, 0.7025, false, 0.391);
    wheel(-1.525, -0.7025, false, 0.391);

    if (!ghost) {
      const blob = new THREE.Mesh(
        this.keep(new THREE.PlaneGeometry(4.6, 1.9)),
        this.keep(new THREE.MeshBasicMaterial({
          map: this.keep(blobTexture()),
          transparent: true,
          depthWrite: false,
        })),
      );
      blob.name = 'blob';
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.03;
      root.add(blob);
    }

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || mesh.name === 'blob') return;
      mesh.castShadow = !ghost;
      mesh.receiveShadow = !ghost;
    });
    if (ghost) root.renderOrder = 2;
    return { root, front, spinners, brake, spin: 0 };
  }
}

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

type Beside = {
  x: number;
  z: number;
  y: number;
  nx: number;
  nz: number;
  angle: number;
  s: number;
};

type Scatter = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  yaw: number;
  color: string;
};

function boundsOf(track: Track): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of track.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function buildRelief(track: Track, elevation: ElevationSample[] | undefined, metersPerUnit: number, span: number) {
  const nodes = (elevation ?? [])
    .filter((sample) => Number.isFinite(sample.s) && Number.isFinite(sample.z))
    .map((sample) => ({ s: track.closed ? mod(sample.s, track.length) : sample.s, z: sample.z }))
    .sort((a, b) => a.s - b.s);
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const node of nodes) {
    minZ = Math.min(minZ, node.z);
    maxZ = Math.max(maxZ, node.z);
  }
  if (!Number.isFinite(minZ)) {
    minZ = 0;
    maxZ = 0;
  }
  const raw = metersPerUnit > 0 ? (maxZ - minZ) / metersPerUnit : 0;
  const steepest = steepestGrade(nodes, track, metersPerUnit);
  const gentle = steepest > 0 ? Math.max(1, MAX_VISUAL_GRADE / steepest) : 3.2;
  const gain = raw > 0.25 ? THREE.MathUtils.clamp((span * 0.1) / raw, 1, Math.min(3.2, gentle)) : 1;
  const scale = metersPerUnit > 0 ? gain / metersPerUnit : 0;
  const at = (s: number) => (heightOf(nodes, s, track.length, track.closed) - minZ) * scale;
  return { at };
}

/** Pente réelle la plus forte, mesurée sur 60 m pour ne pas lire le bruit du relevé. */
function steepestGrade(nodes: Array<{ s: number; z: number }>, track: Track, metersPerUnit: number): number {
  if (nodes.length < 2 || metersPerUnit <= 0) return 0;
  const step = 30 / metersPerUnit;
  let steepest = 0;
  for (let s = 0; s + (track.closed ? 0 : 2 * step) < track.length; s += step) {
    const dz = heightOf(nodes, s + 2 * step, track.length, track.closed) - heightOf(nodes, s, track.length, track.closed);
    steepest = Math.max(steepest, Math.abs(dz) / 60);
  }
  return steepest;
}

/** Catmull-Rom entre les nœuds : la pente ne casse pas à chaque nœud, sinon la voiture tressaute sur le relief exagéré. */
function heightOf(nodes: Array<{ s: number; z: number }>, s: number, length: number, closed: boolean): number {
  const count = nodes.length;
  if (count === 0 || length <= 0) return 0;
  if (count === 1) return nodes[0].z;
  const at = closed ? mod(s, length) : Math.max(0, Math.min(length, s));
  if (!closed && at <= nodes[0].s) return nodes[0].z;
  if (!closed && at >= nodes[count - 1].s) return nodes[count - 1].z;
  let lo = 0;
  let hi = count - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (nodes[mid].s <= at) lo = mid;
    else hi = mid - 1;
  }
  let i1 = nodes[lo].s <= at ? lo : count - 1;
  if (!closed) i1 = Math.min(i1, count - 2);
  const pick = (index: number) => nodes[closed ? (index + count) % count : Math.max(0, Math.min(count - 1, index))].z;
  const start = nodes[i1].s;
  let end = nodes[closed ? (i1 + 1) % count : i1 + 1].s;
  let pos = at;
  if (closed && end <= start) end += length;
  if (closed && pos < start) pos += length;
  const span = end - start;
  const t = span > 1e-6 ? Math.max(0, Math.min(1, (pos - start) / span)) : 0;
  const p0 = pick(i1 - 1);
  const p1 = pick(i1);
  const p2 = pick(i1 + 1);
  const p3 = pick(i1 + 2);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

function nearestPoint(buckets: Map<string, number[]>, points: Track['points'], cell: number, x: number, z: number) {
  const cx = Math.floor(x / cell);
  const cz = Math.floor(z / cell);
  let best = 0;
  let bestD = Infinity;
  let found = false;
  for (let radius = 0; radius < 14; radius += 1) {
    for (let oz = -radius; oz <= radius; oz += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        if (radius > 0 && Math.abs(ox) !== radius && Math.abs(oz) !== radius) continue;
        const list = buckets.get(`${cx + ox}:${cz + oz}`);
        if (!list) continue;
        for (const index of list) {
          const dx = points[index].x - x;
          const dz = points[index].y - z;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = index;
            found = true;
          }
        }
      }
    }
    if (found && bestD <= (radius + 1) * cell * ((radius + 1) * cell)) break;
  }
  if (!found) {
    for (let i = 0; i < points.length; i += 1) {
      const dx = points[i].x - x;
      const dz = points[i].y - z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  return { index: best, distance: Math.sqrt(bestD) };
}

function blur(src: Float32Array, cols: number, rows: number): Float32Array {
  const dst = new Float32Array(src.length);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      let sum = 0;
      let count = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        const yy = y + oy;
        if (yy < 0 || yy >= rows) continue;
        for (let ox = -1; ox <= 1; ox += 1) {
          const xx = x + ox;
          if (xx < 0 || xx >= cols) continue;
          sum += src[yy * cols + xx];
          count += 1;
        }
      }
      dst[y * cols + x] = sum / count;
    }
  }
  return dst;
}

/** Vrai si le point (plus `pad`) recouvre la peinture d'une autre portion, épingle comprise. */
function coversTrack(track: Track, x: number, z: number, s: number, pad: number): boolean {
  const skip = Math.max(paintedHalf(track) * 2.4, track.length * 0.008);
  for (const point of track.points) {
    let along = Math.abs(point.s - s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along < skip) continue;
    if (Math.hypot(point.x - x, point.y - z) < paintedHalfAt(track, point.s) + pad) return true;
  }
  return false;
}

function clearance(track: Track, x: number, z: number, s: number): number {
  let best = Infinity;
  for (const point of track.points) {
    let along = Math.abs(point.s - s);
    if (track.closed) along = Math.min(along, track.length - along);
    if (along < track.length * 0.05) continue;
    best = Math.min(best, Math.hypot(point.x - x, point.y - z));
  }
  return best;
}

type Board = { s: number; x: number; y: number; label: string };

function brakeBoards(track: Track, lengthKm: number): Board[] {
  const km = lengthKm > 0 ? lengthKm : 4.304;
  const perMeter = track.length / (km * 1000);
  const ahead = [50, 100, 150].map((meters) => meters * perMeter);
  const labels = ['50', '100', '150'];
  const boards: Board[] = [];
  let last = -1e9;
  for (let i = 0; i < track.points.length; i += 1) {
    const next = track.points[(i + 6) % track.points.length];
    const turn = Math.atan2(Math.sin(next.angle - track.points[i].angle), Math.cos(next.angle - track.points[i].angle));
    let span = next.s - track.points[i].s;
    if (span < 0) span += track.length;
    if (span < 8 || Math.abs(turn) < 0.55) continue;
    const along = track.points[i].s - last;
    if (along >= 0 && along < track.length * 0.08) continue;
    last = track.points[i].s;
    const side = turn > 0 ? 1 : -1;
    for (let k = 0; k < ahead.length; k += 1) {
      let s = track.points[i].s - ahead[k];
      if (s < 0) s += track.length;
      const spot = pointAt(track, s);
      const x = spot.x + Math.cos(spot.angle + Math.PI / 2) * track.halfWidth * 1.85 * side;
      const y = spot.y + Math.sin(spot.angle + Math.PI / 2) * track.halfWidth * 1.85 * side;
      if (clearance(track, x, y, s) < paintedHalf(track) * 1.15) continue;
      boards.push({ s, x, y, label: labels[k] });
    }
  }
  return boards;
}

function smooth(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function mod(value: number, length: number): number {
  if (length <= 0) return 0;
  return ((value % length) + length) % length;
}

function loopPoint(
  samples: Array<{ x: number; y: number }>,
  cum: number[],
  total: number,
  closed: boolean,
  distance: number,
): { x: number; y: number } {
  const count = samples.length;
  let d = distance;
  if (closed) d = mod(d, total);
  else d = Math.max(0, Math.min(total, d));
  if (closed && d >= cum[count - 1]) {
    const span = total - cum[count - 1];
    const t = span > 1e-6 ? (d - cum[count - 1]) / span : 0;
    const a = samples[count - 1];
    const b = samples[0];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }
  let seg = 0;
  while (seg < count - 2 && cum[seg + 1] < d) seg += 1;
  const span = cum[seg + 1] - cum[seg];
  const t = span > 1e-6 ? (d - cum[seg]) / span : 0;
  const a = samples[seg];
  const b = samples[seg + 1];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function resampleLoop(loop: number[][], step: number): Array<{ x: number; y: number }> {
  if (loop.length < 2) return [];
  const points = loop.map(([x, y]) => ({ x, y }));
  const closed = Math.hypot(points[0].x - points[points.length - 1].x, points[0].y - points[points.length - 1].y) < step;
  const ring = closed ? points.slice(0, -1) : points;
  if (ring.length < 2) return [];
  const cum = [0];
  for (let i = 1; i < ring.length; i += 1) cum.push(cum[i - 1] + Math.hypot(ring[i].x - ring[i - 1].x, ring[i].y - ring[i - 1].y));
  if (closed) cum.push(cum[cum.length - 1] + Math.hypot(ring[0].x - ring[ring.length - 1].x, ring[0].y - ring[ring.length - 1].y));
  const length = cum[cum.length - 1];
  const count = Math.max(8, Math.round(length / step));
  const out: Array<{ x: number; y: number }> = [];
  let seg = 0;
  const spans = closed ? count : count + 1;
  for (let i = 0; i < (closed ? count : Math.min(spans, count)); i += 1) {
    const target = (i / count) * length;
    while (seg < cum.length - 2 && cum[seg + 1] < target - 1e-6) seg += 1;
    const span = cum[seg + 1] - cum[seg];
    const t = span > 1e-6 ? (target - cum[seg]) / span : 0;
    const a = ring[seg % ring.length];
    const b = ring[(seg + 1) % ring.length];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function paint(canvas: HTMLCanvasElement, wrapT: THREE.Wrapping = THREE.ClampToEdgeWrapping): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = wrapT;
  texture.anisotropy = 8;
  return texture;
}

function roadTexture(): THREE.CanvasTexture {
  const across = 128;
  const along = 256;
  const canvas = document.createElement('canvas');
  canvas.width = across;
  canvas.height = along;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas, THREE.RepeatWrapping);
  const image = ctx.createImageData(across, along);
  for (let y = 0; y < along; y += 1) {
    for (let x = 0; x < across; x += 1) {
      const v = x / (across - 1);
      const u = y / along;
      const i = (y * across + x) * 4;
      const kerb = v < 0.075 || v > 0.925;
      const line = (v >= 0.075 && v < 0.108) || (v > 0.892 && v <= 0.925);
      const dash = Math.abs(v - 0.5) < 0.014 && Math.floor(u * 18) % 2 === 0;
      let r = 0;
      let g = 0;
      let b = 0;
      if (kerb) {
        const stripe = Math.floor(u * 24) % 2 === 0;
        r = stripe ? 225 : 244;
        g = stripe ? 22 : 244;
        b = stripe ? 28 : 244;
      } else if (line || dash) {
        r = 236;
        g = 236;
        b = 236;
      } else {
        const n = hash(x, y);
        const base = 52 + n * 16;
        r = base;
        g = base;
        b = base + 1;
      }
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return paint(canvas, THREE.RepeatWrapping);
}

const GROUND_TINT: Record<GroundTone, [number, number, number]> = {
  grass: [46, 108, 50],
  sand: [168, 146, 92],
  dry: [124, 122, 70],
  tropical: [32, 104, 46],
  night: [18, 32, 24],
  'night-sand': [72, 62, 44],
};

function groundTexture(tone: GroundTone): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas, THREE.RepeatWrapping);
  const [br, bg, bb] = GROUND_TINT[tone];
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = hash(x, y);
      const i = (y * size + x) * 4;
      image.data[i] = Math.min(255, br + n * 22);
      image.data[i + 1] = Math.min(255, bg + n * 28);
      image.data[i + 2] = Math.min(255, bb + n * 16);
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = paint(canvas, THREE.RepeatWrapping);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

function checkerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#f5f5f5' : '#161616';
      ctx.fillRect(col * 32, row * 32, 32, 32);
    }
  }
  return paint(canvas);
}

function boardTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  ctx.fillStyle = '#f4f1ea';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 112);
  ctx.fillStyle = '#161616';
  ctx.font = '700 78px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 128, 70);
  const texture = paint(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** Numéro dans un carré jaune, nom en blanc sur fond nuit à côté ; une ligne droite n'a que son nom. */
function signTexture(sign: TrackSign): THREE.CanvasTexture {
  const wide = sign.name != null;
  const canvas = document.createElement('canvas');
  canvas.width = wide ? 768 : 256;
  canvas.height = wide ? 205 : 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = '#15123a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#f4f1ea';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.textBaseline = 'middle';
  let textLeft = 28;
  if (sign.number != null) {
    const box = wide ? h - 40 : h - 48;
    const x = wide ? 20 : (w - box) / 2;
    const y = (h - box) / 2;
    ctx.fillStyle = '#ffd21f';
    ctx.fillRect(x, y, box, box);
    ctx.fillStyle = '#15123a';
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(box * (sign.number >= 10 ? 0.62 : 0.74))}px sans-serif`;
    ctx.fillText(String(sign.number), x + box / 2, y + box / 2 + box * 0.04);
    textLeft = x + box + 24;
  }
  if (sign.name) {
    const room = w - textLeft - 28;
    let size = 84;
    ctx.font = `700 ${size}px sans-serif`;
    while (size > 34 && ctx.measureText(sign.name).width > room) {
      size -= 4;
      ctx.font = `700 ${size}px sans-serif`;
    }
    ctx.fillStyle = '#f4f1ea';
    ctx.textAlign = sign.number != null ? 'left' : 'center';
    const x = sign.number != null ? textLeft : w / 2;
    if (ctx.measureText(sign.name).width <= room) {
      ctx.fillText(sign.name, x, h / 2 + 4);
    } else {
      // Nom trop long même petit (« Maggotts, Becketts, Chapel ») : deux lignes.
      const words = sign.name.split(' ');
      const cut = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, cut).join(' '), x, h / 2 - size * 0.55);
      ctx.fillText(words.slice(cut).join(' '), x, h / 2 + size * 0.6);
    }
  }
  const texture = paint(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function blobTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = paint(canvas);
  texture.premultiplyAlpha = true;
  return texture;
}

function skyTexture(biome: CircuitBiome): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, biome.skyTop);
  gradient.addColorStop(0.42, biome.skyHigh);
  gradient.addColorStop(0.7, biome.skyHorizon);
  gradient.addColorStop(1, biome.fog);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 512);
  const texture = paint(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

const STAND_COLORS = ['#9b1d32', '#e6e1d6', '#1e3f78', '#c6a15a', '#245c3a'];

function canopyPalette(biome: CircuitBiome): string[] {
  if (biome.night) return ['#1a3a28', '#143222', '#1e4030'];
  if (biome.treeScale >= 1.7) return ['#1c4a26', '#245832', '#163e20', '#2c6238'];
  if (biome.palms) return ['#1f7a45', '#2e8a48', '#176b3c'];
  if (biome.ground === 'dry' || biome.ground === 'sand' || biome.ground === 'night-sand') {
    return ['#6d7a3a', '#8a8444', '#5a6a32'];
  }
  return ['#2f6b32', '#3d7a38', '#245a30', '#4e8234'];
}

function standTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  ctx.fillStyle = '#d8d4cc';
  ctx.fillRect(0, 0, 64, 128);
  ctx.fillStyle = '#2c3138';
  ctx.fillRect(0, 0, 64, 12);
  for (let y = 18; y < 124; y += 14) {
    ctx.fillStyle = y % 28 === 18 ? '#6a7280' : '#9aa2ae';
    ctx.fillRect(0, y, 64, 7);
  }
  return paint(canvas);
}

function facadeTexture(night: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return paint(canvas);
  ctx.fillStyle = night ? '#2a2e36' : '#c9c3b6';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 60; x += 14) {
      const lit = hash(x, y) > (night ? 0.35 : 0.82);
      ctx.fillStyle = night ? (lit ? '#ffd18a' : '#141820') : (lit ? '#f4f7fb' : '#7ea0b8');
      ctx.fillRect(x, y, 8, 10);
    }
  }
  return paint(canvas);
}
