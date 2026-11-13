import * as THREE from 'three';
import { bankAt, pointAt } from '@/lib/track-path';
import type { RacePose } from '../race-view';
import { bankHeight, deck } from './road';
import type { RaceCtx } from './terrain';
import { blobTexture } from './textures';

type Wheel = { hub: THREE.Group; spinner: THREE.Group };

export type CarRig = {
  root: THREE.Group;
  front: Wheel[];
  spinners: THREE.Group[];
  brake: THREE.MeshStandardMaterial;
  spin: number;
};

export type CarMotion = {
  worldUp: THREE.Vector3;
  forward: THREE.Vector3;
  side: THREE.Vector3;
  up: THREE.Vector3;
  rolledUp: THREE.Vector3;
  rolledSide: THREE.Vector3;
  basis: THREE.Matrix4;
};

/**
 * Ferrari F2004, en mètres : 4,545 × 1,796 × 0,959, empattement 3,050.
 * L'aileron avant fait 1,40 m et reste entre les roues ; l'aileron arrière fait 1,00 m et culmine à 0,80 m.
 */
export const LOCAL_CAR_WIDTH = 1.796;
export const TYRE_RADIUS = 0.33;
/** Distance du centre de la voiture à chaque essieu, et demi-voie avant, dans le repère local (mètres). */
const AXLE_OFFSET = 1.525;
const TRACK_HALF_OFFSET = 0.735;

export function createCarMotion(): CarMotion {
  return {
    worldUp: new THREE.Vector3(0, 1, 0),
    forward: new THREE.Vector3(),
    side: new THREE.Vector3(),
    up: new THREE.Vector3(),
    rolledUp: new THREE.Vector3(),
    rolledSide: new THREE.Vector3(),
    basis: new THREE.Matrix4(),
  };
}

export function setBrakeLight(rig: CarRig, brake: number) {
  rig.brake.emissiveIntensity = brake > 0.15 ? 2 : 0;
}

export function placeCar(motion: CarMotion, ctx: RaceCtx, rig: CarRig, pose: RacePose, steer: number, speed: number, dt: number, ghost: boolean) {
  const tangent = pointAt(ctx.track, pose.s);
  const along = Math.cos(pose.heading) * Math.cos(tangent.angle) + Math.sin(pose.heading) * Math.sin(tangent.angle);
  const axle = AXLE_OFFSET * ctx.scale;
  const frontS = pose.s + along * axle;
  const rearS = pose.s - along * axle;
  const front = deck(ctx, frontS);
  const rear = deck(ctx, rearS);
  const slope = THREE.MathUtils.clamp((front - rear) / (2 * axle), -0.7, 0.7);
  motion.forward.set(Math.cos(pose.heading), slope, Math.sin(pose.heading)).normalize();
  motion.side.crossVectors(motion.forward, motion.worldUp);
  if (motion.side.lengthSq() < 1e-8) motion.side.set(0, 0, 1);
  motion.side.normalize();
  const nx = -Math.sin(tangent.angle);
  const nz = Math.cos(tangent.angle);
  const signedLeft = (pose.x - tangent.x) * nx + (pose.y - tangent.y) * nz;
  const bank = bankAt(ctx.track, pose.s);
  const steerRoll = ghost ? 0 : -steer * 0.08;
  const roll = steerRoll - bank;
  motion.up.crossVectors(motion.side, motion.forward).normalize();
  motion.rolledUp.copy(motion.up).multiplyScalar(Math.cos(roll)).addScaledVector(motion.side, Math.sin(roll)).normalize();
  motion.rolledSide.crossVectors(motion.forward, motion.rolledUp).normalize();
  rig.root.quaternion.setFromRotationMatrix(motion.basis.makeBasis(motion.forward, motion.rolledUp, motion.rolledSide));
  // Le roulis de braquage pivote autour du centre au sol : on remonte pour que la roue basse ne passe pas sous le bitume.
  // Le dévers, lui, est déjà dans la hauteur de la piste.
  const rollLift = Math.abs(Math.sin(steerRoll)) * TRACK_HALF_OFFSET * ctx.scale;
  const offCrown = bankHeight(ctx, pose.s, signedLeft) - bankHeight(ctx, pose.s, 0);
  rig.root.position.set(
    pose.x,
    (front + rear) / 2 + rollLift + offCrown,
    pose.y,
  );
  rig.spin = (rig.spin - (speed / ctx.wheelRadius) * dt) % (Math.PI * 2);
  for (const spinner of rig.spinners) spinner.rotation.z = rig.spin;
  const yaw = ghost ? 0 : -steer * 0.48;
  for (const wheel of rig.front) wheel.hub.rotation.y = yaw;
}

export function makeCar(ctx: RaceCtx, ghost: boolean): CarRig {
  const root = new THREE.Group();
  root.scale.setScalar(ctx.scale);
  const paint = ctx.keep(new THREE.MeshPhysicalMaterial({
    color: ghost ? '#f4f7fb' : '#e10600',
    metalness: ghost ? 0.08 : 0.58,
    roughness: ghost ? 0.32 : 0.26,
    clearcoat: ghost ? 0 : 0.72,
    clearcoatRoughness: 0.18,
    transparent: ghost,
    opacity: ghost ? 0.42 : 1,
    depthWrite: !ghost,
  }));
  const carbon = ctx.keep(new THREE.MeshStandardMaterial({
    color: '#16181c',
    roughness: 0.48,
    metalness: 0.45,
    transparent: ghost,
    opacity: ghost ? 0.42 : 1,
    depthWrite: !ghost,
  }));
  const rubber = ctx.keep(new THREE.MeshStandardMaterial({
    color: '#141414',
    roughness: 0.9,
    metalness: 0.04,
    transparent: ghost,
    opacity: ghost ? 0.42 : 1,
    depthWrite: !ghost,
  }));
  const metal = ctx.keep(new THREE.MeshStandardMaterial({
    color: '#d5d8dd',
    roughness: 0.32,
    metalness: 0.82,
    transparent: ghost,
    opacity: ghost ? 0.42 : 1,
    depthWrite: !ghost,
  }));
  const brake = ctx.keep(new THREE.MeshStandardMaterial({
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
    return add(new THREE.Mesh(ctx.keep(new THREE.BoxGeometry(w, h, d)), material)).position.set(x, y, z);
  };
  const white = ctx.keep(new THREE.MeshStandardMaterial({
    color: '#f4f4f4',
    roughness: 0.4,
    metalness: 0.05,
    transparent: ghost,
    opacity: ghost ? 0.42 : 1,
    depthWrite: !ghost,
  }));
  box(2.6, 0.04, 1.3, 0.05, 0.07, 0, carbon);
  box(1.35, 0.32, 0.52, 0.35, 0.32, 0, paint);
  const nose = add(new THREE.Mesh(ctx.keep(new THREE.CylinderGeometry(0.05, 0.16, 1.22, 12)), paint));
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
  const helmet = add(new THREE.Mesh(ctx.keep(new THREE.SphereGeometry(0.13, 16, 12)), ctx.keep(new THREE.MeshStandardMaterial({
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
  add(new THREE.Mesh(ctx.keep(new THREE.BoxGeometry(0.06, 0.05, 0.16)), brake)).position.set(-2.16, 0.3, 0);

  const spinners: THREE.Group[] = [];
  const front: Wheel[] = [];
  const wheel = (x: number, z: number, steered: boolean, width: number) => {
    const hub = new THREE.Group();
    hub.position.set(x, TYRE_RADIUS, z);
    const spinner = new THREE.Group();
    const tire = new THREE.Mesh(ctx.keep(new THREE.CylinderGeometry(TYRE_RADIUS, TYRE_RADIUS, width, 18)), rubber);
    tire.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(ctx.keep(new THREE.CylinderGeometry(0.165, 0.165, width * 0.72, 12)), metal);
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
      ctx.keep(new THREE.PlaneGeometry(4.6, 1.9)),
      ctx.keep(new THREE.MeshBasicMaterial({
        map: ctx.keep(blobTexture()),
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
