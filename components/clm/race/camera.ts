import * as THREE from 'three';
import { bankAt } from '@/lib/track-path';
import type { RaceFrame } from '../race-view';
import { deck } from './road';
import { sampleGround, smooth, type RaceCtx } from './terrain';

/** Œil du pilote, au sommet du casque (repère local, mètres) : on voit le nez et les roues avant. */
const EYE = new THREE.Vector3(0.7, 0.74, 0);
/** Le pilote regarde la route à cette distance : sur une crête, il voit la descente au lieu du ciel. */
const COCKPIT_LOOK_M = 45;

export type CameraRig = {
  orbit: number;
  primed: boolean;
  cockpitMix: number;
  viewW: number;
  viewH: number;
  viewPr: number;
  orbitSpeed: number;
  worldUp: THREE.Vector3;
  sunDir: THREE.Vector3;
  overviewPos: THREE.Vector3;
  overviewLook: THREE.Vector3;
  chasePos: THREE.Vector3;
  chaseLook: THREE.Vector3;
  desiredPos: THREE.Vector3;
  desiredLook: THREE.Vector3;
  camPos: THREE.Vector3;
  lookPos: THREE.Vector3;
  viewDir: THREE.Vector3;
  viewRight: THREE.Vector3;
  viewUp: THREE.Vector3;
  cameraUp: THREE.Vector3;
  shadowFocus: THREE.Vector3;
  carFocus: THREE.Vector3;
  fogGoal: THREE.Color;
  cockpitPos: THREE.Vector3;
  cockpitLook: THREE.Vector3;
  rolledUp: THREE.Vector3;
};

export function createCameraRig(midX: number, midY: number, midZ: number, orbitSpeed: number, fogClear: THREE.Color): CameraRig {
  const overviewLook = new THREE.Vector3(midX, midY, midZ);
  const rig: CameraRig = {
    orbit: 0.4,
    primed: false,
    cockpitMix: 0,
    viewW: 0,
    viewH: 0,
    viewPr: 0,
    orbitSpeed,
    worldUp: new THREE.Vector3(0, 1, 0),
    sunDir: new THREE.Vector3(0.62, 1.25, 0.34).normalize(),
    overviewPos: new THREE.Vector3(),
    overviewLook,
    chasePos: new THREE.Vector3(),
    chaseLook: new THREE.Vector3(),
    desiredPos: new THREE.Vector3(),
    desiredLook: new THREE.Vector3(),
    camPos: overviewLook.clone(),
    lookPos: overviewLook.clone(),
    viewDir: new THREE.Vector3(),
    viewRight: new THREE.Vector3(),
    viewUp: new THREE.Vector3(),
    cameraUp: new THREE.Vector3(0, 1, 0),
    shadowFocus: new THREE.Vector3(),
    carFocus: new THREE.Vector3(),
    fogGoal: new THREE.Color('#f3d7b0').copy(fogClear),
    cockpitPos: new THREE.Vector3(),
    cockpitLook: new THREE.Vector3(),
    rolledUp: new THREE.Vector3(),
  };
  return rig;
}

export function frameCamera(
  ctx: RaceCtx,
  rig: CameraRig,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  fog: THREE.Fog,
  sun: THREE.DirectionalLight,
  sunTarget: THREE.Object3D,
  playerRoot: THREE.Object3D,
  frame: RaceFrame,
  step: number,
  width: number,
  height: number,
) {
  const blend = smooth(frame.blend);
  const speedRatio = THREE.MathUtils.clamp(frame.car.speed / ctx.top, 0, 1);
  if (frame.blend < 0.8) rig.orbit += step * rig.orbitSpeed;
  const swing = ctx.span * 0.58;
  rig.overviewPos.set(
    ctx.midX + Math.sin(rig.orbit) * swing,
    ctx.midY + ctx.span * 0.4,
    ctx.midZ + Math.cos(rig.orbit) * swing,
  );

  const fx = Math.cos(frame.camHeading);
  const fz = Math.sin(frame.camHeading);
  const carY = playerRoot.position.y;
  // Plus vite, la caméra se rapproche et s'abaisse : le sol défile au premier plan au lieu que la voiture rapetisse.
  const back = ctx.half * (2 - speedRatio * 0.3);
  const high = ctx.half * (0.5 - speedRatio * 0.1);
  const ahead = ctx.half * (1.15 + speedRatio * 0.4);
  // Hauteurs prises sur la route devant et derrière, pas sur la voiture : en montée comme sur une crête, la piste reste à l'image.
  const behindY = deck(ctx, frame.car.s - back);
  const aheadY = deck(ctx, frame.car.s + ahead);
  rig.chasePos.set(frame.car.x - fx * back, Math.max(carY, behindY) + high, frame.car.y - fz * back);
  rig.chaseLook.set(frame.car.x + fx * ahead, (carY + aheadY) / 2 + ctx.half * 0.12, frame.car.y + fz * ahead);
  const ground = sampleGround(ctx, rig.chasePos.x, rig.chasePos.z);
  if (rig.chasePos.y < ground + ctx.half * 0.12) rig.chasePos.y = ground + ctx.half * 0.12;

  rig.cockpitMix += ((frame.view === 'cockpit' ? 1 : 0) - rig.cockpitMix) * Math.min(1, step * 6);
  if (rig.cockpitMix > 1e-3) {
    playerRoot.updateMatrixWorld();
    rig.cockpitPos.copy(EYE).applyMatrix4(playerRoot.matrixWorld);
    const look = COCKPIT_LOOK_M * ctx.meter;
    const hx = Math.cos(frame.car.heading);
    const hz = Math.sin(frame.car.heading);
    const eyeHeight = EYE.y * ctx.scale;
    rig.cockpitLook.set(
      rig.cockpitPos.x + hx * look,
      deck(ctx, frame.car.s + look) + eyeHeight * 1.1,
      rig.cockpitPos.z + hz * look,
    );
    rig.chasePos.lerp(rig.cockpitPos, rig.cockpitMix);
    rig.chaseLook.lerp(rig.cockpitLook, rig.cockpitMix);
  }
  rig.desiredPos.lerpVectors(rig.overviewPos, rig.chasePos, blend);
  rig.desiredLook.lerpVectors(rig.overviewLook, rig.chaseLook, blend);
  // Dans le cockpit, la caméra est vissée à la voiture : un retard ferait flotter le casque.
  const lag = rig.primed ? 1 - Math.exp(-step * 8) : 1;
  const follow = THREE.MathUtils.lerp(lag, 1, rig.cockpitMix * blend);
  rig.camPos.lerp(rig.desiredPos, follow);
  rig.lookPos.lerp(rig.desiredLook, follow);
  rig.primed = true;

  const bank = bankAt(ctx.track, frame.car.s);
  // En poursuite l'horizon reste droit, le relevé se lit sur la piste. Dans le cockpit, la tête suit la voiture.
  const roll = THREE.MathUtils.clamp(-frame.car.steer, -1, 1) * THREE.MathUtils.lerp(0.045, 0.02, rig.cockpitMix) * blend
    - bank * rig.cockpitMix * blend;
  rig.viewDir.subVectors(rig.chaseLook, rig.chasePos);
  if (rig.viewDir.lengthSq() < 1e-8) rig.viewDir.set(0, 0, 1);
  rig.viewDir.normalize();
  rig.viewRight.crossVectors(rig.viewDir, rig.worldUp);
  if (rig.viewRight.lengthSq() < 1e-8) rig.viewRight.set(1, 0, 0);
  rig.viewRight.normalize();
  rig.viewUp.crossVectors(rig.viewRight, rig.viewDir).normalize();
  rig.rolledUp.copy(rig.viewUp).multiplyScalar(Math.cos(roll)).addScaledVector(rig.viewRight, Math.sin(roll));
  rig.cameraUp.copy(rig.worldUp).lerp(rig.rolledUp, blend).normalize();

  const pr = Math.min(window.devicePixelRatio || 1, 1.75);
  if (rig.viewW !== width || rig.viewH !== height || rig.viewPr !== pr) {
    rig.viewW = width;
    rig.viewH = height;
    rig.viewPr = pr;
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
  }
  camera.aspect = width / height;
  const chaseFov = 9 + speedRatio * speedRatio * 16;
  const cockpitFov = 19 + speedRatio * speedRatio * 10;
  camera.fov = 43 + blend * THREE.MathUtils.lerp(chaseFov, cockpitFov, rig.cockpitMix);
  const nearRoad = THREE.MathUtils.lerp(ctx.half * 0.05, ctx.scale * 0.05, rig.cockpitMix);
  camera.near = THREE.MathUtils.lerp(ctx.span * 0.025, nearRoad, blend);
  camera.far = THREE.MathUtils.lerp(ctx.span * 8, ctx.half * 50, blend);
  camera.up.copy(rig.cameraUp);
  camera.position.copy(rig.camPos);
  camera.lookAt(rig.lookPos);
  camera.updateProjectionMatrix();

  fog.near = THREE.MathUtils.lerp(ctx.span * 2.8, ctx.half * 8, blend);
  fog.far = THREE.MathUtils.lerp(ctx.span * 9, ctx.half * 36, blend);
  rig.fogGoal.copy(frame.phase === 'racing' && frame.car.offTrack ? ctx.fogOff : ctx.fogClear);
  fog.color.lerp(rig.fogGoal, 1 - Math.exp(-step * 5));

  rig.carFocus.set(frame.car.x, carY, frame.car.y);
  rig.shadowFocus.lerpVectors(rig.overviewLook, rig.carFocus, blend);
  const shadowSpan = THREE.MathUtils.lerp(ctx.span * 0.7, ctx.half * 5, blend);
  sun.position.copy(rig.shadowFocus).addScaledVector(rig.sunDir, shadowSpan * 2.1);
  sunTarget.position.copy(rig.shadowFocus);
  sunTarget.updateMatrixWorld();
  const shadow = sun.shadow.camera as THREE.OrthographicCamera;
  shadow.left = -shadowSpan;
  shadow.right = shadowSpan;
  shadow.top = shadowSpan;
  shadow.bottom = -shadowSpan;
  shadow.near = shadowSpan * 0.15;
  shadow.far = shadowSpan * 4.2;
  shadow.updateProjectionMatrix();
}
