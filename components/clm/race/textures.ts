import * as THREE from 'three';
import type { CircuitBiome, GroundTone } from '@/lib/circuit-biome';
import type { TrackSign } from '@/lib/circuit-places';

export function hash(x: number, y: number): number {
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

export function roadTexture(): THREE.CanvasTexture {
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

export function groundTexture(tone: GroundTone): THREE.CanvasTexture {
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

export function checkerTexture(): THREE.CanvasTexture {
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

export function boardTexture(label: string): THREE.CanvasTexture {
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
export function signTexture(sign: TrackSign): THREE.CanvasTexture {
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

export function blobTexture(): THREE.CanvasTexture {
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

export function skyTexture(biome: CircuitBiome): THREE.CanvasTexture {
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

export function standTexture(): THREE.CanvasTexture {
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

export function facadeTexture(night: boolean): THREE.CanvasTexture {
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
