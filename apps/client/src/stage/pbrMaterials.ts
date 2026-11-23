import * as THREE from 'three';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

export interface PbrFourMapSet {
  readonly albedoMap: THREE.DataTexture;
  readonly normalMap: THREE.DataTexture;
  readonly roughnessMap: THREE.DataTexture;
  readonly aoCurvatureMap: THREE.DataTexture;
  readonly emissiveMap?: THREE.DataTexture;
}

export interface FactionVisualPalette {
  readonly primaryHex: number;
  readonly secondaryHex: number;
  readonly accentHex: number;
  readonly primaryRgb: readonly [number, number, number];
  readonly secondaryRgb: readonly [number, number, number];
  readonly accentRgb: readonly [number, number, number];
  readonly backdropTopCss: string;
  readonly backdropMidCss: string;
  readonly backdropBotCss: string;
}

export interface ShellFurOptions {
  readonly baseColor: number;
  readonly tipColor: number;
  readonly rimColor: number;
  readonly layers?: number;
  readonly furLength?: number;
  readonly densityScale?: number;
  readonly rimStrength?: number;
  readonly droop?: number;
  readonly windStrength?: number;
  readonly opacityBoost?: number;
}

export interface ShellFurAssembly {
  readonly group: THREE.Group;
  readonly materials: THREE.ShaderMaterial[];
  readonly geometries: THREE.BufferGeometry[];
  update(elapsedSec: number): void;
  dispose(): void;
}

export interface SoftSssOptions {
  readonly baseColor: number;
  readonly deepColor: number;
  readonly sssColor: number;
  readonly rimColor: number;
  readonly opacity?: number;
  readonly sssStrength?: number;
  readonly fresnelPower?: number;
  readonly sheenStrength?: number;
  readonly emissiveBoost?: number;
}

export const FACTION_PALETTES: Readonly<Record<string, FactionVisualPalette>> = {
  戴森工团: {
    primaryHex: 0xdab266,
    secondaryHex: 0xc27f42,
    accentHex: 0xebd196,
    primaryRgb: [0.85, 0.70, 0.40],
    secondaryRgb: [0.76, 0.50, 0.26],
    accentRgb: [0.92, 0.82, 0.59],
    backdropTopCss: '#2c2014',
    backdropMidCss: '#4b341d',
    backdropBotCss: '#171924',
  },
  云端星环: {
    primaryHex: 0xdbeafe,
    secondaryHex: 0x2f7cf6,
    accentHex: 0x56d4fc,
    primaryRgb: [0.86, 0.92, 1.0],
    secondaryRgb: [0.18, 0.49, 0.96],
    accentRgb: [0.34, 0.83, 0.99],
    backdropTopCss: '#0c2a5e',
    backdropMidCss: '#1c549c',
    backdropBotCss: '#0b1936',
  },
  钟慢远征: {
    primaryHex: 0xdfa946,
    secondaryHex: 0x16c8e0,
    accentHex: 0xf8cc66,
    primaryRgb: [0.87, 0.66, 0.27],
    secondaryRgb: [0.09, 0.78, 0.88],
    accentRgb: [0.97, 0.80, 0.40],
    backdropTopCss: '#102f40',
    backdropMidCss: '#22566b',
    backdropBotCss: '#0d1c28',
  },
  木卫冰海: {
    primaryHex: 0x68b3d1,
    secondaryHex: 0x306a94,
    accentHex: 0x5bb89d,
    primaryRgb: [0.41, 0.70, 0.82],
    secondaryRgb: [0.19, 0.42, 0.58],
    accentRgb: [0.36, 0.72, 0.62],
    backdropTopCss: '#11293a',
    backdropMidCss: '#1c465c',
    backdropBotCss: '#0f1b28',
  },
  深空阵列: {
    primaryHex: 0x6698c9,
    secondaryHex: 0xd6b576,
    accentHex: 0x8b82c4,
    primaryRgb: [0.40, 0.60, 0.79],
    secondaryRgb: [0.84, 0.71, 0.46],
    accentRgb: [0.55, 0.51, 0.77],
    backdropTopCss: '#142342',
    backdropMidCss: '#223863',
    backdropBotCss: '#10182b',
  },
  反物质院: {
    primaryHex: 0x523c75,
    secondaryHex: 0xa86cc2,
    accentHex: 0xc996df,
    primaryRgb: [0.32, 0.24, 0.46],
    secondaryRgb: [0.66, 0.42, 0.76],
    accentRgb: [0.79, 0.59, 0.87],
    backdropTopCss: '#231636',
    backdropMidCss: '#3c2559',
    backdropBotCss: '#151021',
  },
  星门摆渡: {
    primaryHex: 0x4aa888,
    secondaryHex: 0xd6b576,
    accentHex: 0x82cbb1,
    primaryRgb: [0.29, 0.66, 0.53],
    secondaryRgb: [0.84, 0.71, 0.46],
    accentRgb: [0.51, 0.80, 0.69],
    backdropTopCss: '#122b28',
    backdropMidCss: '#1f4942',
    backdropBotCss: '#101c1d',
  },
  失控蜂群: {
    primaryHex: 0xb8505f,
    secondaryHex: 0xc95e6d,
    accentHex: 0xde8794,
    primaryRgb: [0.86, 0.21, 0.30],
    secondaryRgb: [0.96, 0.25, 0.37],
    accentRgb: [1.0, 0.43, 0.52],
    backdropTopCss: '#3b0e1e',
    backdropMidCss: '#701832',
    backdropBotCss: '#170b14',
  },
};

export const COST_TIER_COLORS: Readonly<Record<number, number>> = {
  1: 0x94a3b8,
  2: 0x10b981,
  3: 0x3b82f6,
  4: 0xa855f7,
  5: 0xf59e0b,
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noiseCache = new Map<number, NoiseFunction2D>();

function getSeededNoise2D(seed: number): NoiseFunction2D {
  const existing = noiseCache.get(seed);
  if (existing) return existing;
  const fn = createNoise2D(mulberry32(seed));
  noiseCache.set(seed, fn);
  return fn;
}

function tileableSimplex(
  noise: NoiseFunction2D,
  u: number,
  v: number,
  freq: number,
  offsetX = 0,
  offsetY = 0,
): number {
  const x = u * freq;
  const y = v * freq;
  const sx = u * u * (3 - 2 * u);
  const sy = v * v * (3 - 2 * v);

  const n00 = noise(x + offsetX, y + offsetY);
  const n10 = noise(x - freq + offsetX, y + offsetY);
  const n01 = noise(x + offsetX, y - freq + offsetY);
  const n11 = noise(x - freq + offsetX, y - freq + offsetY);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;
  return (nx0 * (1 - sy) + nx1 * sy) * 0.5 + 0.5;
}

function simplexFbmTileable(
  u: number,
  v: number,
  baseFreq: number,
  octaves: number,
  seed: number,
): number {
  const noise = getSeededNoise2D(seed);
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let freq = baseFreq;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * tileableSimplex(noise, u, v, freq, o * 17.3, o * 29.7);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return clamp01(sum / norm);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function toByte(v01: number): number {
  return Math.round(clamp01(v01) * 255);
}

function configureDataTexture(
  data: Uint8Array,
  size: number,
  isSrgb: boolean,
  repeat = 1,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = isSrgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.channel = 0;
  tex.needsUpdate = true;
  return tex;
}

function heightFieldToNormalBuffer(
  heights: Float32Array,
  size: number,
  strength: number,
): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const hL = heights[y * size + xm] ?? 0;
      const hR = heights[y * size + xp] ?? 0;
      const hD = heights[ym * size + x] ?? 0;
      const hU = heights[yp * size + x] ?? 0;
      const dx = (hL - hR) * strength;
      const dy = (hD - hU) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);
      const idx = (y * size + x) * 4;
      data[idx] = toByte(dx * invLen * 0.5 + 0.5);
      data[idx + 1] = toByte(dy * invLen * 0.5 + 0.5);
      data[idx + 2] = toByte(dz * invLen * 0.5 + 0.5);
      data[idx + 3] = 255;
    }
  }
  return data;
}

interface RawPbrMapBuffers {
  readonly albedo: Uint8Array;
  readonly normal: Uint8Array;
  readonly roughness: Uint8Array;
  readonly aoCurv: Uint8Array;
  readonly emissive?: Uint8Array;
}

const rawUnitMapBufferCache = new Map<string, RawPbrMapBuffers>();

function wrapRawBuffers(buffers: RawPbrMapBuffers, size: number, repeat: number): PbrFourMapSet {
  return {
    albedoMap: configureDataTexture(new Uint8Array(buffers.albedo), size, true, repeat),
    normalMap: configureDataTexture(new Uint8Array(buffers.normal), size, false, repeat),
    roughnessMap: configureDataTexture(new Uint8Array(buffers.roughness), size, false, repeat),
    aoCurvatureMap: configureDataTexture(new Uint8Array(buffers.aoCurv), size, false, repeat),
    emissiveMap: buffers.emissive
      ? configureDataTexture(new Uint8Array(buffers.emissive), size, true, repeat)
      : undefined,
  };
}

export function bakeBasaltTitaniumMaps(size = 256): PbrFourMapSet {
  const key = `basalt:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 2);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const emissive = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const grain = simplexFbmTileable(u, v, 6, 4, 101);
      const strata = simplexFbmTileable(u, v, 3, 3, 419);
      const microGrain = simplexFbmTileable(u, v, 18, 2, 211);

      const dx = u - 0.5;
      const dy = v - 0.5;
      const radial = Math.hypot(dx, dy);
      const orbitRingA = Math.exp(-Math.pow((radial - 0.34) / 0.011, 2));
      const orbitRingB = Math.exp(-Math.pow((radial - 0.19) / 0.008, 2));
      const etchPattern = clamp01(Math.max(orbitRingA, orbitRingB * 0.72));

      heights[idx] = grain * 0.42 + strata * 0.24 + microGrain * 0.12 - etchPattern * 0.30;

      const slateR = 0.145 + grain * 0.044 + strata * 0.022;
      const slateG = 0.188 + grain * 0.052 + strata * 0.025;
      const slateB = 0.275 + grain * 0.066 + strata * 0.030;

      albedo[p4] = toByte(slateR + etchPattern * 0.08);
      albedo[p4 + 1] = toByte(slateG + etchPattern * 0.12);
      albedo[p4 + 2] = toByte(slateB + etchPattern * 0.16);
      albedo[p4 + 3] = 255;

      const roughVal = clamp01(0.70 + grain * 0.16 + microGrain * 0.06 - etchPattern * 0.12);
      const rByte = toByte(roughVal);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      const aoVal = clamp01(0.90 + grain * 0.10);
      const metalVal = clamp01(0.26 + etchPattern * 0.24);
      aoCurv[p4] = toByte(aoVal);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(metalVal);
      aoCurv[p4 + 3] = toByte(grain);

      const em = etchPattern * 0.38;
      emissive[p4] = toByte(em * 0.45);
      emissive[p4 + 1] = toByte(em * 0.80);
      emissive[p4 + 2] = toByte(em * 0.96);
      emissive[p4 + 3] = 255;
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 1.35),
    roughness,
    aoCurv,
    emissive,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 2);
}

export function bakeBrushedChampagneGoldMaps(size = 256): PbrFourMapSet {
  const key = `gold:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  const brushNoise = getSeededNoise2D(503);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const brushFine = tileableSimplex(brushNoise, u, v, 4, 0, 0) * 0.45 +
        simplexFbmTileable(u * 0.5, v, 14, 2, 607) * 0.55;
      heights[idx] = brushFine * 0.24;

      const rCol = 0.96 * (0.95 + brushFine * 0.06);
      const gCol = 0.82 * (0.95 + brushFine * 0.06);
      const bCol = 0.48 * (0.95 + brushFine * 0.06);

      albedo[p4] = toByte(rCol);
      albedo[p4 + 1] = toByte(gCol);
      albedo[p4 + 2] = toByte(bCol);
      albedo[p4 + 3] = 255;

      const finalRough = clamp01(0.34 + brushFine * 0.14);
      const finalMetal = clamp01(0.68 + brushFine * 0.10);
      const rByte = toByte(finalRough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(0.95 + brushFine * 0.05);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(finalMetal);
      aoCurv[p4 + 3] = toByte(brushFine);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.72),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeWhitePorcelainArmorMaps(size = 128): PbrFourMapSet {
  const key = `porcelain:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const glaze = simplexFbmTileable(u, v, 5, 3, 733);
      const silkMicro = simplexFbmTileable(u, v, 16, 2, 761);
      const blend = glaze * 0.7 + silkMicro * 0.3;
      heights[idx] = blend * 0.14;

      const base = clamp01(0.89 + blend * 0.055);
      albedo[p4] = toByte(base);
      albedo[p4 + 1] = toByte(base * 0.992);
      albedo[p4 + 2] = toByte(clamp01(base * 1.005));
      albedo[p4 + 3] = 255;

      const rough = clamp01(0.55 + blend * 0.12);
      const rByte = toByte(rough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(0.95 + blend * 0.05);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.12);
      aoCurv[p4 + 3] = toByte(blend);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.42),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeSapphirePhotonLatticeMaps(size = 128): PbrFourMapSet {
  const key = `sapphire:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 2);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const swirl = simplexFbmTileable(u, v, 6, 3, 811);
      const lattice =
        Math.abs(Math.sin((u + v * 0.5 + swirl * 0.12) * Math.PI * 6)) *
        Math.abs(Math.sin((v - u * 0.5 - swirl * 0.12) * Math.PI * 6));
      const facet = clamp01(lattice * 0.65 + swirl * 0.35);
      heights[idx] = facet * 0.38;

      albedo[p4] = toByte(0.16 + facet * 0.16);
      albedo[p4 + 1] = toByte(0.46 + facet * 0.26);
      albedo[p4 + 2] = toByte(0.76 + facet * 0.18);
      albedo[p4 + 3] = 255;

      const rByte = toByte(0.42 + (1 - facet) * 0.16);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(0.84 + facet * 0.16);
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.32 + facet * 0.18);
      aoCurv[p4 + 3] = toByte(facet);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.85),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 2);
}

export function bakeRadialContactShadowTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const core = r >= 1 ? 0 : Math.exp(-r * r * 5.4);
      const penumbra = r >= 1 ? 0 : Math.pow(Math.cos(r * Math.PI * 0.5), 1.75);
      const falloff = clamp01(core * 0.44 + penumbra * 0.62);
      const p4 = (y * size + x) * 4;
      data[p4] = 6;
      data[p4 + 1] = 10;
      data[p4 + 2] = 22;
      data[p4 + 3] = toByte(falloff * 0.78);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function bakeSoftRadialGlowTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  const half = (size - 1) * 0.5;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - half) / half;
      const dy = (y - half) / half;
      const r = Math.hypot(dx, dy);
      const core = r >= 1 ? 0 : Math.exp(-r * r * 5.2);
      const halo = r >= 1 ? 0 : Math.pow(1 - r, 2.4) * 0.55;
      const alpha = clamp01(core * 0.92 + halo);
      const p4 = (y * size + x) * 4;
      data[p4] = 255;
      data[p4 + 1] = 252;
      data[p4 + 2] = 244;
      data[p4 + 3] = toByte(alpha);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

let cachedCloudData: Uint8Array | null = null;
let cachedCloudSize = 0;

export function bakeSimplexCloudTexture(size = 256): THREE.DataTexture {
  if (!cachedCloudData || cachedCloudSize !== size) {
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      const v = y / size;
      for (let x = 0; x < size; x += 1) {
        const u = x / size;
        const p4 = (y * size + x) * 4;
        const base = simplexFbmTileable(u, v, 3, 4, 3001);
        const wisp = simplexFbmTileable(u, v, 7, 3, 3109);
        const billow = clamp01(Math.pow(base * 0.72 + wisp * 0.28, 1.15));
        const ridge = clamp01(1 - Math.abs(wisp * 2 - 1));
        data[p4] = toByte(billow);
        data[p4 + 1] = toByte(wisp);
        data[p4 + 2] = toByte(ridge);
        data[p4 + 3] = 255;
      }
    }
    cachedCloudData = data;
    cachedCloudSize = size;
  }
  return configureDataTexture(new Uint8Array(cachedCloudData), size, false, 1);
}

let cachedFurData: Uint8Array | null = null;
let cachedFurSize = 0;

export function bakeShellFurDensityTexture(size = 256, seed = 4201): THREE.DataTexture {
  if (!cachedFurData || cachedFurSize !== size) {
    const data = new Uint8Array(size * size * 4);
    const fineNoise = getSeededNoise2D(seed);
    const clumpNoise = getSeededNoise2D(seed + 73);
    const strandNoise = getSeededNoise2D(seed + 191);

    for (let y = 0; y < size; y += 1) {
      const v = y / size;
      for (let x = 0; x < size; x += 1) {
        const u = x / size;
        const p4 = (y * size + x) * 4;

        const clump = tileableSimplex(clumpNoise, u, v, 10, 1.7, 3.1);
        const mediumTuft = tileableSimplex(strandNoise, u, v, 24, 5.2, 8.4);
        const fineHair = tileableSimplex(fineNoise, u, v, 56, 11.1, 17.9);
        const microStrand = tileableSimplex(fineNoise, u * 0.85, v * 1.15, 84, 23.4, 9.2);

        const rawHeight = fineHair * 0.44 + microStrand * 0.24 + mediumTuft * 0.20 + clump * 0.12;
        const shaped = clamp01(Math.pow(rawHeight, 0.86) * 1.14 - 0.06);
        const ao = clamp01(0.55 + clump * 0.45);
        const warmth = clamp01(mediumTuft * 0.6 + clump * 0.4);

        data[p4] = toByte(shaped);
        data[p4 + 1] = toByte(ao);
        data[p4 + 2] = toByte(warmth);
        data[p4 + 3] = 255;
      }
    }
    cachedFurData = data;
    cachedFurSize = size;
  }
  return configureDataTexture(new Uint8Array(cachedFurData), size, false, 1);
}

export function createShellFurGroup(
  baseGeo: THREE.BufferGeometry,
  options: ShellFurOptions,
): ShellFurAssembly {
  const layers = Math.max(4, Math.min(14, options.layers ?? 10));
  const furLength = options.furLength ?? 0.048;
  const densityScale = options.densityScale ?? 8.5;
  const rimStrength = options.rimStrength ?? 0.82;
  const droop = options.droop ?? 0.014;
  const windStrength = options.windStrength ?? 0.004;
  const opacityBoost = options.opacityBoost ?? 1.0;

  const baseColor = new THREE.Color(options.baseColor);
  const tipColor = new THREE.Color(options.tipColor);
  const rimColor = new THREE.Color(options.rimColor);
  const furMap = bakeShellFurDensityTexture(256);

  const group = new THREE.Group();
  const materials: THREE.ShaderMaterial[] = [];
  const geometries: THREE.BufferGeometry[] = [baseGeo];

  if (!baseGeo.getAttribute('normal')) {
    baseGeo.computeVertexNormals();
  }

  for (let i = 0; i < layers; i += 1) {
    const h = layers > 1 ? i / (layers - 1) : 0;
    const isHaloShell = i >= layers - 2;
    const mat = new THREE.ShaderMaterial({
      transparent: i > 0,
      depthWrite: !isHaloShell,
      side: i === 0 ? THREE.FrontSide : THREE.DoubleSide,
      uniforms: {
        uFurMap: { value: furMap },
        uTime: { value: 0 },
        uShellHeight: { value: h },
        uFurLength: { value: furLength },
        uDensityScale: { value: densityScale },
        uDroop: { value: droop },
        uWind: { value: windStrength },
        uBaseColor: { value: baseColor.clone() },
        uTipColor: { value: tipColor.clone() },
        uRimColor: { value: rimColor.clone() },
        uRimStrength: { value: rimStrength },
        uOpacityBoost: { value: opacityBoost },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uShellHeight;
        uniform float uFurLength;
        uniform float uDroop;
        uniform float uWind;
        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        void main() {
          vObjPos = position;
          vObjNormal = normalize(normal);

          float h2 = uShellHeight * uShellHeight;
          vec3 displaced = position + vObjNormal * (uShellHeight * uFurLength);
          displaced.y -= uDroop * h2;
          displaced.x += sin(uTime * 1.9 + position.y * 5.0 + position.z * 3.0) * uWind * h2;

          vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
          vWorldNormal = normalize(mat3(modelMatrix) * vObjNormal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uFurMap;
        uniform float uShellHeight;
        uniform float uDensityScale;
        uniform vec3 uBaseColor;
        uniform vec3 uTipColor;
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform float uOpacityBoost;

        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;

        vec3 sampleTriplanar(vec3 p, vec3 n) {
          vec3 w = pow(abs(normalize(n)), vec3(4.0));
          w /= max(w.x + w.y + w.z, 0.0001);
          vec3 sx = texture2D(uFurMap, p.yz * uDensityScale).rgb;
          vec3 sy = texture2D(uFurMap, p.xz * uDensityScale).rgb;
          vec3 sz = texture2D(uFurMap, p.xy * uDensityScale).rgb;
          return sx * w.x + sy * w.y + sz * w.z;
        }

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(vViewDir);
          vec3 furSample = sampleTriplanar(vObjPos, vObjNormal);

          float strand = furSample.r;
          float clumpAo = furSample.g;
          float warmth = furSample.b;

          float alpha = 1.0;
          if (uShellHeight > 0.001) {
            float cutoff = uShellHeight * 0.84;
            float strandMask = smoothstep(cutoff, cutoff + 0.16, strand);
            if (strandMask < 0.08) discard;
            alpha = clamp(strandMask * mix(0.95, 0.48, uShellHeight) * uOpacityBoost, 0.0, 1.0);
          }

          vec3 keyDir = normalize(vec3(0.55, 0.72, 0.62));
          vec3 fillDir = normalize(vec3(-0.68, 0.45, -0.58));

          float wrapKey = clamp((dot(N, keyDir) + 0.62) / 1.62, 0.0, 1.0);
          float wrapFill = clamp((dot(N, fillDir) + 0.55) / 1.55, 0.0, 1.0);
          float hemi = N.y * 0.5 + 0.5;

          float rootAo = mix(0.46, 1.06, pow(uShellHeight, 0.62)) * mix(0.84, 1.06, clumpAo);
          vec3 furTint = mix(uBaseColor, uTipColor, pow(uShellHeight, 0.78));
          furTint *= mix(vec3(0.94, 0.92, 1.02), vec3(1.06, 1.00, 0.96), warmth);

          vec3 lit = furTint * (
            vec3(0.28, 0.27, 0.36) * mix(0.75, 1.15, hemi) +
            vec3(0.86, 0.82, 0.78) * wrapKey * 0.78 +
            vec3(0.48, 0.56, 0.82) * wrapFill * 0.36
          ) * rootAo;

          float ndotv = max(dot(N, V), 0.0);
          float velvetFuzz = pow(1.0 - ndotv, 2.25);
          float rimMask = uRimStrength * velvetFuzz * (0.38 + 0.62 * uShellHeight);
          lit += uRimColor * rimMask * (0.65 + 0.35 * wrapFill);

          gl_FragColor = vec4(lit, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(baseGeo, mat);
    mesh.renderOrder = i;
    group.add(mesh);
    materials.push(mat);
  }

  return {
    group,
    materials,
    geometries,
    update(elapsedSec: number): void {
      for (const mat of materials) {
        mat.uniforms['uTime']!.value = elapsedSec;
      }
    },
    dispose(): void {
      furMap.dispose();
      for (const m of materials) m.dispose();
      for (const g of geometries) g.dispose();
    },
  };
}

export function createSoftSssMaterial(options: SoftSssOptions): THREE.ShaderMaterial {
  const baseColor = new THREE.Color(options.baseColor);
  const deepColor = new THREE.Color(options.deepColor);
  const sssColor = new THREE.Color(options.sssColor);
  const rimColor = new THREE.Color(options.rimColor);
  const opacity = options.opacity ?? 0.94;
  const sssStrength = options.sssStrength ?? 0.72;
  const fresnelPower = options.fresnelPower ?? 2.35;
  const sheenStrength = options.sheenStrength ?? 0.14;
  const emissiveBoost = options.emissiveBoost ?? 0.16;

  return new THREE.ShaderMaterial({
    transparent: opacity < 0.999,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: baseColor },
      uDeepColor: { value: deepColor },
      uSssColor: { value: sssColor },
      uRimColor: { value: rimColor },
      uOpacity: { value: opacity },
      uSssStrength: { value: sssStrength },
      uFresnelPower: { value: fresnelPower },
      uSheenStrength: { value: sheenStrength },
      uEmissiveBoost: { value: emissiveBoost },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vObjPos;

      void main() {
        vObjPos = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uBaseColor;
      uniform vec3 uDeepColor;
      uniform vec3 uSssColor;
      uniform vec3 uRimColor;
      uniform float uOpacity;
      uniform float uSssStrength;
      uniform float uFresnelPower;
      uniform float uSheenStrength;
      uniform float uEmissiveBoost;

      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vObjPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);
        vec3 L1 = normalize(vec3(0.55, 0.74, 0.65));
        vec3 L2 = normalize(vec3(-0.65, 0.45, -0.60));

        float wrap1 = clamp((dot(N, L1) + 0.70) / 1.70, 0.0, 1.0);
        float wrap2 = clamp((dot(N, L2) + 0.55) / 1.55, 0.0, 1.0);
        float hemi = N.y * 0.5 + 0.5;

        vec3 bodyCol = mix(uDeepColor, uBaseColor, smoothstep(0.12, 0.88, wrap1 * 0.72 + hemi * 0.28));

        vec3 backDir1 = normalize(L1 + N * 0.42);
        float backScatter1 = pow(clamp(dot(V, -backDir1), 0.0, 1.0), 2.8);
        vec3 backDir2 = normalize(L2 + N * 0.42);
        float backScatter2 = pow(clamp(dot(V, -backDir2), 0.0, 1.0), 2.4);
        float ndotv = max(dot(N, V), 0.0);
        float thicknessGlow = (1.0 - ndotv * 0.68) * (0.45 + 0.55 * wrap1);

        float caustic = 0.5 + 0.5 * sin(vObjPos.x * 11.0 + uTime * 1.4) * cos(vObjPos.z * 9.5 - uTime * 1.1);
        vec3 sss = uSssColor * (backScatter1 * 0.65 + backScatter2 * 0.45 + thicknessGlow * 0.42) * uSssStrength * (0.90 + caustic * 0.14);

        float fresnel = pow(1.0 - ndotv, uFresnelPower);
        vec3 rim = uRimColor * fresnel * 0.62;

        vec3 H = normalize(L1 + V);
        float softSheen = pow(max(dot(N, H), 0.0), 16.0) * uSheenStrength;

        vec3 col = bodyCol * (0.48 + wrap1 * 0.52 + wrap2 * 0.22) + sss + rim + vec3(0.95, 0.99, 1.0) * softSheen + uSssColor * uEmissiveBoost;
        float outAlpha = clamp(mix(uOpacity * 0.86, 0.98, fresnel * 0.75 + 0.25), 0.0, 1.0);
        gl_FragColor = vec4(col, outAlpha);
      }
    `,
  });
}

export function buildProceduralStudioEnvMap(
  renderer: THREE.WebGLRenderer,
): { envTexture: THREE.Texture; renderTarget: THREE.WebGLRenderTarget } {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x2d3a52);

  const domeGeo = new THREE.SphereGeometry(28, 32, 20);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y * 0.5 + 0.5;

        vec3 ground = vec3(0.13, 0.21, 0.34);
        vec3 horizon = vec3(0.64, 0.58, 0.50);
        vec3 zenith = vec3(0.18, 0.44, 0.84);

        vec3 col = mix(ground, horizon, smoothstep(0.14, 0.50, h));
        col = mix(col, zenith, smoothstep(0.50, 0.96, h));

        float warmKey = pow(max(dot(d, normalize(vec3(0.48, 0.62, 0.62))), 0.0), 3.2);
        float coolRim = pow(max(dot(d, normalize(vec3(-0.64, 0.46, -0.60))), 0.0), 2.8);
        float softBounce = pow(max(dot(d, normalize(vec3(0.32, -0.38, 0.84))), 0.0), 2.4);

        col += vec3(0.72, 0.58, 0.36) * warmKey;
        col += vec3(0.26, 0.48, 0.76) * coolRim;
        col += vec3(0.14, 0.18, 0.24) * softBounce;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  envScene.add(new THREE.Mesh(domeGeo, domeMat));

  const renderTarget = pmrem.fromScene(envScene, 0.08);
  domeGeo.dispose();
  domeMat.dispose();
  pmrem.dispose();

  return { envTexture: renderTarget.texture, renderTarget };
}

export function bakeUnitArmorPanelMaps(size = 256): PbrFourMapSet {
  const key = `armor:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const silkWave = simplexFbmTileable(u, v, 5, 3, 911);
      const microVelvet = simplexFbmTileable(u, v, 18, 2, 977);
      const satinGrain = silkWave * 0.62 + microVelvet * 0.38;

      heights[idx] = satinGrain * 0.12;

      const tone = clamp01(0.945 + satinGrain * 0.048);
      albedo[p4] = toByte(tone);
      albedo[p4 + 1] = toByte(clamp01(tone * 0.996));
      albedo[p4 + 2] = toByte(clamp01(tone * 1.004));
      albedo[p4 + 3] = 255;

      const roughVal = clamp01(0.90 + (1 - satinGrain) * 0.10);
      const rByte = toByte(roughVal);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(clamp01(0.96 + satinGrain * 0.04));
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(clamp01(0.16 + satinGrain * 0.06));
      aoCurv[p4 + 3] = toByte(satinGrain);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.28),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeUnitCarbonFiberMaps(size = 256): PbrFourMapSet {
  const key = `carbon:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 3);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  const cells = 42;
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const gx = u * cells;
      const gy = v * cells;
      const ix = Math.floor(gx);
      const iy = Math.floor(gy);
      const fx = gx - ix;
      const fy = gy - iy;

      const twillPhase = (ix + iy) & 3;
      const isWarp = twillPhase < 2;
      const strandCoord = isWarp ? fx : fy;
      const dome = Math.sin(strandCoord * Math.PI);
      const softNap = simplexFbmTileable(u, v, 8, 3, 1103);
      const weave = dome * 0.48 + softNap * 0.52;

      heights[idx] = weave * 0.20;

      const baseTone = clamp01(0.88 + weave * 0.09 + (isWarp ? 0.01 : -0.01));
      albedo[p4] = toByte(baseTone);
      albedo[p4 + 1] = toByte(baseTone);
      albedo[p4 + 2] = toByte(clamp01(baseTone * 1.012));
      albedo[p4 + 3] = 255;

      const roughVal = clamp01(0.92 + (1 - weave) * 0.08);
      const rByte = toByte(roughVal);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = toByte(clamp01(0.92 + weave * 0.08));
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.12);
      aoCurv[p4 + 3] = toByte(weave);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.44),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 3);
}

export function bakeUnitPolishedTrimMaps(size = 256): PbrFourMapSet {
  const key = `trim:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const aniso = simplexFbmTileable(u * 0.25, v, 16, 2, 1217) * 0.65 +
        simplexFbmTileable(u, v, 8, 2, 1301) * 0.35;
      heights[idx] = aniso * 0.09;

      const tone = clamp01(0.95 + aniso * 0.05);
      albedo[p4] = toByte(tone);
      albedo[p4 + 1] = toByte(tone);
      albedo[p4 + 2] = toByte(tone);
      albedo[p4 + 3] = 255;

      const roughVal = clamp01(0.88 + aniso * 0.12);
      const rByte = toByte(roughVal);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = 255;
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.72);
      aoCurv[p4 + 3] = toByte(aniso);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.26),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeUnitEnergyLatticeMaps(size = 256): PbrFourMapSet {
  const key = `energy:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 2);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const idx = y * size + x;
      const p4 = idx * 4;

      const plasma = simplexFbmTileable(u, v, 5, 3, 1453);
      const ripple = 0.5 + 0.5 * Math.sin((u * 4 + v * 2 + plasma * 0.85) * Math.PI * 2);
      const lum = clamp01(0.84 + ripple * 0.10 + plasma * 0.06);

      heights[idx] = ripple * 0.14 + plasma * 0.12;
      albedo[p4] = toByte(lum);
      albedo[p4 + 1] = toByte(lum);
      albedo[p4 + 2] = toByte(lum);
      albedo[p4 + 3] = 255;

      const rByte = toByte(0.36 + (1 - ripple) * 0.14);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      aoCurv[p4] = 255;
      aoCurv[p4 + 1] = rByte;
      aoCurv[p4 + 2] = toByte(0.10);
      aoCurv[p4 + 3] = toByte(lum);
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 0.28),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 2);
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lenSq = vx * vx + vy * vy;
  const t = lenSq > 1e-6 ? clamp01((wx * vx + wy * vy) / lenSq) : 0;
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

const DIGIT_SEGMENTS: Readonly<Record<number, readonly [number, number, number, number][]>> = {
  0: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, 0.5, -0.85],
    [0.5, -0.85, -0.5, -0.85],
    [-0.5, -0.85, -0.5, 0.85],
    [-0.36, -0.45, 0.36, 0.45],
  ],
  1: [
    [-0.22, 0.58, 0.14, 0.85],
    [0.14, 0.85, 0.14, -0.85],
    [-0.36, -0.85, 0.48, -0.85],
  ],
  2: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, 0.5, 0.05],
    [0.5, 0.05, -0.5, 0.05],
    [-0.5, 0.05, -0.5, -0.85],
    [-0.5, -0.85, 0.5, -0.85],
  ],
  3: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, 0.5, -0.85],
    [-0.34, 0.02, 0.5, 0.02],
    [-0.5, -0.85, 0.5, -0.85],
  ],
  4: [
    [-0.5, 0.85, -0.5, 0.02],
    [-0.5, 0.02, 0.5, 0.02],
    [0.44, 0.85, 0.44, -0.85],
  ],
  5: [
    [0.5, 0.85, -0.5, 0.85],
    [-0.5, 0.85, -0.5, 0.05],
    [-0.5, 0.05, 0.5, 0.05],
    [0.5, 0.05, 0.5, -0.85],
    [0.5, -0.85, -0.5, -0.85],
  ],
  6: [
    [0.46, 0.85, -0.5, 0.85],
    [-0.5, 0.85, -0.5, -0.85],
    [-0.5, -0.85, 0.5, -0.85],
    [0.5, -0.85, 0.5, 0.04],
    [0.5, 0.04, -0.5, 0.04],
  ],
  7: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, -0.08, -0.85],
  ],
  8: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, 0.5, -0.85],
    [0.5, -0.85, -0.5, -0.85],
    [-0.5, -0.85, -0.5, 0.85],
    [-0.5, 0.02, 0.5, 0.02],
  ],
  9: [
    [-0.5, 0.85, 0.5, 0.85],
    [0.5, 0.85, 0.5, -0.85],
    [-0.5, -0.85, 0.5, -0.85],
    [-0.5, 0.85, -0.5, 0.04],
    [-0.5, 0.04, 0.5, 0.04],
  ],
};

let cachedBenchAtlasData: Uint8Array | null = null;

export function bakeHexMicroEngravedMaps(size = 256): PbrFourMapSet {
  const key = `hex-micro-engraved:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    const dy = (v - 0.5) * 2.0;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const dx = (u - 0.5) * 2.0;
      const idx = y * size + x;
      const p4 = idx * 4;

      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      const hexDist = Math.max(ay * 0.8660254 + ax * 0.5, ax) / 0.8660254;
      const rad = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);

      const grain = simplexFbmTileable(u, v, 10, 3, 9103);
      const outerGroove = Math.exp(-Math.pow((hexDist - 0.84) / 0.024, 2.0));
      const innerHexLine = Math.exp(-Math.pow((hexDist - 0.68) / 0.014, 2.0));
      const compassRing = Math.exp(-Math.pow((rad - 0.44) / 0.012, 2.0));
      const centerPip = Math.exp(-Math.pow(rad / 0.055, 2.0));
      const vertexSpoke =
        hexDist > 0.69 && hexDist < 0.83
          ? Math.exp(-Math.pow(Math.sin(ang * 3.0) / 0.065, 2.0))
          : 0;
      const outerChamfer = clamp01((hexDist - 0.78) / 0.14);

      const engraved = clamp01(
        outerGroove * 0.92 + innerHexLine * 0.64 + compassRing * 0.48 + vertexSpoke * 0.56,
      );
      const edgeHighlight = Math.exp(-Math.pow((hexDist - 0.80) / 0.018, 2.0)) * 0.14;

      const lum = clamp01(
        0.84 +
          (grain - 0.5) * 0.10 -
          engraved * 0.24 -
          outerChamfer * 0.10 +
          edgeHighlight +
          centerPip * 0.06,
      );
      const tintR = clamp01(lum * (1.0 + innerHexLine * 0.04));
      const tintG = clamp01(lum * (1.0 + compassRing * 0.02));
      const tintB = clamp01(lum * (1.02 - innerHexLine * 0.02));

      albedo[p4] = toByte(tintR);
      albedo[p4 + 1] = toByte(tintG);
      albedo[p4 + 2] = toByte(tintB);
      albedo[p4 + 3] = 255;

      const rough = clamp01(0.66 + engraved * 0.16 + (grain - 0.5) * 0.08 - edgeHighlight * 0.35);
      const rByte = toByte(rough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      const ao = clamp01(1.0 - outerGroove * 0.34 - innerHexLine * 0.18 - outerChamfer * 0.18);
      aoCurv[p4] = toByte(ao);
      aoCurv[p4 + 1] = toByte(ao);
      aoCurv[p4 + 2] = toByte(ao);
      aoCurv[p4 + 3] = 255;

      heights[idx] =
        0.62 +
        grain * 0.06 -
        outerGroove * 0.36 -
        innerHexLine * 0.18 -
        compassRing * 0.12 -
        vertexSpoke * 0.14 -
        outerChamfer * 0.16 +
        centerPip * 0.06;
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 1.35),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeBenchSlotPlateMaps(size = 256): PbrFourMapSet {
  const key = `bench-slot-plate:${size}`;
  const cached = rawUnitMapBufferCache.get(key);
  if (cached) return wrapRawBuffers(cached, size, 1);

  const pixelCount = size * size;
  const albedo = new Uint8Array(pixelCount * 4);
  const roughness = new Uint8Array(pixelCount * 4);
  const aoCurv = new Uint8Array(pixelCount * 4);
  const heights = new Float32Array(pixelCount);

  for (let y = 0; y < size; y += 1) {
    const v = (y + 0.5) / size;
    const dy = (v - 0.5) * 2.0;
    for (let x = 0; x < size; x += 1) {
      const u = (x + 0.5) / size;
      const dx = (u - 0.5) * 2.0;
      const idx = y * size + x;
      const p4 = idx * 4;

      const rad = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      const brush = simplexFbmTileable(u * 0.5 + rad * 0.4, v, 14, 3, 7309);
      const ringA = Math.exp(-Math.pow((rad - 0.78) / 0.022, 2.0));
      const ringB = Math.exp(-Math.pow((rad - 0.52) / 0.016, 2.0));
      const ringC = Math.exp(-Math.pow((rad - 0.24) / 0.015, 2.0));
      const radialSeam =
        rad > 0.25 && rad < 0.77 ? Math.exp(-Math.pow(Math.sin(ang * 4.0) / 0.045, 2.0)) : 0;
      const dockWell = clamp01(1.0 - rad / 0.85);
      const groove = clamp01(ringA * 0.9 + ringB * 0.65 + ringC * 0.55 + radialSeam * 0.52);

      const baseR = 0.24 + brush * 0.07 + dockWell * 0.06 - groove * 0.10 + ringB * 0.08;
      const baseG = 0.28 + brush * 0.07 + dockWell * 0.07 - groove * 0.11 + ringB * 0.07;
      const baseB = 0.36 + brush * 0.08 + dockWell * 0.08 - groove * 0.12 + ringB * 0.04;

      albedo[p4] = toByte(baseR);
      albedo[p4 + 1] = toByte(baseG);
      albedo[p4 + 2] = toByte(baseB);
      albedo[p4 + 3] = 255;

      const rough = clamp01(0.56 + groove * 0.22 + (brush - 0.5) * 0.08);
      const rByte = toByte(rough);
      roughness[p4] = rByte;
      roughness[p4 + 1] = rByte;
      roughness[p4 + 2] = rByte;
      roughness[p4 + 3] = 255;

      const ao = clamp01(1.0 - ringA * 0.35 - ringB * 0.20 - radialSeam * 0.18);
      aoCurv[p4] = toByte(ao);
      aoCurv[p4 + 1] = toByte(ao);
      aoCurv[p4 + 2] = toByte(ao);
      aoCurv[p4 + 3] = 255;

      heights[idx] = 0.58 + brush * 0.06 - groove * 0.34 - (1.0 - dockWell) * 0.14;
    }
  }

  const buffers: RawPbrMapBuffers = {
    albedo,
    normal: heightFieldToNormalBuffer(heights, size, 1.45),
    roughness,
    aoCurv,
  };
  rawUnitMapBufferCache.set(key, buffers);
  return wrapRawBuffers(buffers, size, 1);
}

export function bakeBenchSlotNumberAtlas(): THREE.DataTexture {
  const cellW = 64;
  const cellH = 64;
  const slots = 9;
  const width = cellW * slots;
  const height = cellH;

  if (!cachedBenchAtlasData) {
    const data = new Uint8Array(width * height * 4);
    for (let slot = 0; slot < slots; slot += 1) {
      const rightDigit = slot + 1;
      const segLeft = DIGIT_SEGMENTS[0]!;
      const segRight = DIGIT_SEGMENTS[rightDigit]!;
      const isCryo = slot === 8;

      for (let y = 0; y < cellH; y += 1) {
        const v = (y + 0.5) / cellH;
        const ny = (v - 0.52) / 0.28;
        for (let x = 0; x < cellW; x += 1) {
          const u = (x + 0.5) / cellW;
          const lx = (u - 0.34) / 0.13;
          const rx = (u - 0.66) / 0.13;

          let minD = 99.0;
          for (const [ax, ay, bx, by] of segLeft) {
            const d = pointToSegmentDist(lx, ny, ax, ay, bx, by);
            if (d < minD) minD = d;
          }
          for (const [ax, ay, bx, by] of segRight) {
            const d = pointToSegmentDist(rx, ny, ax, ay, bx, by);
            if (d < minD) minD = d;
          }

          const digitCore = clamp01((0.18 - minD) / 0.11);
          const digitHalo = Math.exp(-Math.pow(minD / 0.30, 2.0)) * 0.36;

          const bracketL =
            Math.abs(u - 0.11) < 0.022 && Math.abs(v - 0.52) < 0.18 ? 0.68 : 0;
          const bracketR =
            Math.abs(u - 0.89) < 0.022 && Math.abs(v - 0.52) < 0.18 ? 0.68 : 0;
          const baseRule =
            Math.abs(v - 0.17) < 0.022 && Math.abs(u - 0.5) < 0.32
              ? 0.55 * (1.0 - Math.abs(u - 0.5) / 0.34)
              : 0;

          const plateMask =
            Math.abs(u - 0.5) < 0.44 && Math.abs(v - 0.50) < 0.38 ? 0.52 : 0;
          const ink = clamp01(digitCore * 0.98 + digitHalo * 0.65 + bracketL + bracketR + baseRule);
          const alpha = clamp01(Math.max(plateMask, ink));
          const gx = slot * cellW + x;
          const p4 = (y * width + gx) * 4;
          const bgR = 0.08;
          const bgG = 0.11;
          const bgB = 0.17;
          if (isCryo) {
            data[p4] = toByte(bgR * (1 - ink) + (0.64 + digitCore * 0.34) * ink);
            data[p4 + 1] = toByte(bgG * (1 - ink) + (0.94 + digitCore * 0.06) * ink);
            data[p4 + 2] = toByte(bgB * (1 - ink) + 1.0 * ink);
          } else {
            data[p4] = toByte(bgR * (1 - ink) + (0.98 + digitCore * 0.02) * ink);
            data[p4 + 1] = toByte(bgG * (1 - ink) + (0.86 + digitCore * 0.10) * ink);
            data[p4 + 2] = toByte(bgB * (1 - ink) + (0.58 + digitCore * 0.28) * ink);
          }
          data[p4 + 3] = toByte(alpha);
        }
      }
    }
    cachedBenchAtlasData = data;
  }

  const tex = new THREE.DataTexture(
    new Uint8Array(cachedBenchAtlasData),
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function applyUnitVertexColorVibrancy(
  mat: THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial,
  satBoost = 0.82,
): void {
  const satLiteral = satBoost.toFixed(3);
  mat.customProgramCacheKey = () => `sparkfield-unit-vc-lin-${satLiteral}`;
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
        vec3 _sfLinVc = pow(max(vColor.rgb, vec3(0.0)), vec3(2.0));
        float _sfLuma = dot(_sfLinVc, vec3(0.2126, 0.7152, 0.0722));
        vec3 _sfSatVc = clamp(mix(vec3(_sfLuma), _sfLinVc, ${satLiteral}), vec3(0.0), vec3(1.0));
        diffuseColor.rgb *= _sfSatVc;
        diffuseColor.a *= vColor.a;
      #endif`,
    );
  };
}

export class PbrMaterialLibrary {
  public readonly basaltMaps: PbrFourMapSet;
  public readonly champagneGoldMaps: PbrFourMapSet;
  public readonly porcelainMaps: PbrFourMapSet;
  public readonly sapphireMaps: PbrFourMapSet;
  public readonly unitArmorMaps: PbrFourMapSet;
  public readonly unitCarbonMaps: PbrFourMapSet;
  public readonly unitTrimMaps: PbrFourMapSet;
  public readonly unitEnergyMaps: PbrFourMapSet;
  public readonly hexEngravedMaps: PbrFourMapSet;
  public readonly benchPlateMaps: PbrFourMapSet;
  public readonly benchSlotNumberAtlas: THREE.DataTexture;
  public readonly contactShadowTex: THREE.DataTexture;

  public readonly hexTileBasaltMat: THREE.MeshStandardMaterial;
  public readonly hexBezelGoldMat: THREE.MeshStandardMaterial;
  public readonly hexBezelDeployMat: THREE.MeshStandardMaterial;
  public readonly deckArmorMat: THREE.MeshStandardMaterial;
  public readonly deckTrimTitaniumMat: THREE.MeshStandardMaterial;
  public readonly brushedGoldMat: THREE.MeshStandardMaterial;
  public readonly porcelainArmorMat: THREE.MeshStandardMaterial;
  public readonly sapphireLatticeMat: THREE.MeshStandardMaterial;
  public readonly cryoGlassMat: THREE.MeshPhysicalMaterial;
  public readonly obsidianSatinMat: THREE.MeshStandardMaterial;

  public readonly unitArmorMat: THREE.MeshPhysicalMaterial;
  public readonly unitMatteMat: THREE.MeshPhysicalMaterial;
  public readonly unitTrimMat: THREE.MeshPhysicalMaterial;

  public readonly starPedestal1Mat: THREE.MeshStandardMaterial;
  public readonly starPedestal2Mat: THREE.MeshStandardMaterial;
  public readonly starPedestal3Mat: THREE.MeshStandardMaterial;

  public readonly allyRingMat: THREE.MeshStandardMaterial;
  public readonly enemyRingMat: THREE.MeshStandardMaterial;
  public readonly contactShadowMat: THREE.MeshBasicMaterial;

  private readonly factionMaterials = new Map<string, THREE.MeshStandardMaterial>();
  private readonly costRingMaterials = new Map<number, THREE.MeshStandardMaterial>();
  private readonly extraDisposables: { dispose(): void }[] = [];

  constructor() {
    this.basaltMaps = bakeBasaltTitaniumMaps(256);
    this.champagneGoldMaps = bakeBrushedChampagneGoldMaps(256);
    this.porcelainMaps = bakeWhitePorcelainArmorMaps(128);
    this.sapphireMaps = bakeSapphirePhotonLatticeMaps(128);
    this.unitArmorMaps = bakeUnitArmorPanelMaps(256);
    this.unitCarbonMaps = bakeUnitCarbonFiberMaps(256);
    this.unitTrimMaps = bakeUnitPolishedTrimMaps(256);
    this.unitEnergyMaps = bakeUnitEnergyLatticeMaps(256);
    this.hexEngravedMaps = bakeHexMicroEngravedMaps(256);
    this.benchPlateMaps = bakeBenchSlotPlateMaps(256);
    this.benchSlotNumberAtlas = bakeBenchSlotNumberAtlas();
    this.contactShadowTex = bakeRadialContactShadowTexture(64);

    this.hexTileBasaltMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc2d2e8),
      map: this.basaltMaps.albedoMap,
      normalMap: this.basaltMaps.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55),
      roughnessMap: this.basaltMaps.roughnessMap,
      aoMap: this.basaltMaps.aoCurvatureMap,
      aoMapIntensity: 0.60,
      emissive: new THREE.Color(0x38bdf8),
      emissiveMap: this.basaltMaps.emissiveMap ?? null,
      emissiveIntensity: 0.14,
      roughness: 0.72,
      metalness: 0.34,
      envMapIntensity: 0.40,
    });

    this.hexBezelGoldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe8be66),
      normalMap: this.champagneGoldMaps.normalMap,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughness: 0.38,
      metalness: 0.68,
      envMapIntensity: 0.62,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.14,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    this.hexBezelDeployMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf5cc68),
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.36,
      metalness: 0.70,
      envMapIntensity: 0.66,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.36,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
    });

    this.deckArmorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xb6c8e0),
      map: this.basaltMaps.albedoMap,
      normalMap: this.basaltMaps.normalMap,
      normalScale: new THREE.Vector2(0.62, 0.62),
      roughnessMap: this.basaltMaps.roughnessMap,
      emissive: new THREE.Color(0x2d6da3),
      emissiveMap: this.basaltMaps.emissiveMap ?? null,
      emissiveIntensity: 0.22,
      roughness: 0.68,
      metalness: 0.34,
      envMapIntensity: 0.54,
    });

    this.deckTrimTitaniumMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xdce8f7),
      map: this.porcelainMaps.albedoMap,
      normalMap: this.porcelainMaps.normalMap,
      roughness: 0.44,
      metalness: 0.48,
      envMapIntensity: 0.58,
    });

    this.brushedGoldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe8be66),
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.34,
      metalness: 0.72,
      envMapIntensity: 0.72,
    });

    this.porcelainArmorMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xfafcff),
      map: this.porcelainMaps.albedoMap,
      normalMap: this.porcelainMaps.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughness: 0.52,
      metalness: 0.10,
      envMapIntensity: 0.54,
    });

    this.sapphireLatticeMat = new THREE.MeshStandardMaterial({
      map: this.sapphireMaps.albedoMap,
      normalMap: this.sapphireMaps.normalMap,
      roughness: 0.46,
      metalness: 0.36,
      envMapIntensity: 0.60,
      emissive: new THREE.Color(0x2563eb),
      emissiveIntensity: 0.42,
    });

    this.cryoGlassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x7ce6ff),
      roughness: 0.28,
      metalness: 0.04,
      envMapIntensity: 0.54,
      transmission: 0.44,
      transparent: true,
      opacity: 0.68,
      emissive: new THREE.Color(0x22d3ee),
      emissiveIntensity: 0.36,
    });

    this.obsidianSatinMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x322456),
      normalMap: this.porcelainMaps.normalMap,
      roughness: 0.58,
      metalness: 0.26,
      envMapIntensity: 0.50,
      emissive: new THREE.Color(0x5b21b6),
      emissiveIntensity: 0.24,
    });

    this.starPedestal1Mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xc8dcf0),
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.42,
      metalness: 0.58,
      envMapIntensity: 0.58,
    });

    this.starPedestal2Mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf2cb6c),
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.36,
      metalness: 0.70,
      envMapIntensity: 0.66,
      emissive: new THREE.Color(0xe6ac38),
      emissiveIntensity: 0.26,
    });

    this.starPedestal3Mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xffdc78),
      map: this.champagneGoldMaps.albedoMap,
      normalMap: this.champagneGoldMaps.normalMap,
      roughness: 0.30,
      metalness: 0.76,
      envMapIntensity: 0.74,
      emissive: new THREE.Color(0xf5b82e),
      emissiveIntensity: 0.48,
    });

    this.allyRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0x38bdf8),
      roughness: 0.38,
      metalness: 0.52,
      envMapIntensity: 0.58,
      emissive: new THREE.Color(0x0ea5e9),
      emissiveIntensity: 0.58,
    });

    this.enemyRingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf43f5e),
      roughness: 0.40,
      metalness: 0.52,
      envMapIntensity: 0.58,
      emissive: new THREE.Color(0xe11d48),
      emissiveIntensity: 0.54,
    });

    this.unitArmorMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      map: this.unitArmorMaps.albedoMap,
      normalMap: this.unitArmorMaps.normalMap,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: this.unitArmorMaps.roughnessMap,
      roughness: 0.52,
      metalness: 0.16,
      envMapIntensity: 0.58,
      clearcoat: 0.0,
      sheen: 0.08,
      sheenRoughness: 0.64,
      sheenColor: new THREE.Color(0xfff6e5),
      side: THREE.DoubleSide,
    });
    applyUnitVertexColorVibrancy(this.unitArmorMat, 0.82);

    this.unitMatteMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      map: this.unitCarbonMaps.albedoMap,
      normalMap: this.unitCarbonMaps.normalMap,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: this.unitCarbonMaps.roughnessMap,
      roughness: 0.78,
      metalness: 0.10,
      envMapIntensity: 0.44,
      sheen: 0.10,
      sheenRoughness: 0.74,
      sheenColor: new THREE.Color(0xc8dcf8),
      side: THREE.DoubleSide,
    });
    applyUnitVertexColorVibrancy(this.unitMatteMat, 0.82);

    this.unitTrimMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      map: this.unitTrimMaps.albedoMap,
      normalMap: this.unitTrimMaps.normalMap,
      normalScale: new THREE.Vector2(0.22, 0.22),
      roughnessMap: this.unitTrimMaps.roughnessMap,
      roughness: 0.32,
      metalness: 0.74,
      envMapIntensity: 0.74,
      clearcoat: 0.0,
      side: THREE.DoubleSide,
    });
    applyUnitVertexColorVibrancy(this.unitTrimMat, 0.82);

    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      depthWrite: false,
    });
  }

  public getFactionAccentMaterial(faction: string): THREE.MeshStandardMaterial {
    const existing = this.factionMaterials.get(faction);
    if (existing) return existing;

    const palette = FACTION_PALETTES[faction];
    const hex = palette?.secondaryHex ?? 0xe8be66;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(hex),
      emissiveIntensity: 0.14,
      normalMap: this.porcelainMaps.normalMap,
      roughness: 0.44,
      metalness: 0.44,
      envMapIntensity: 0.60,
    });
    this.factionMaterials.set(faction, mat);
    return mat;
  }

  public getCostRingMaterial(cost: number): THREE.MeshStandardMaterial {
    const clamped = Math.max(1, Math.min(5, Math.round(cost)));
    const existing = this.costRingMaterials.get(clamped);
    if (existing) return existing;

    const hex = COST_TIER_COLORS[clamped] ?? 0x94a3b8;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(hex),
      emissiveIntensity: clamped >= 5 ? 0.72 : clamped === 4 ? 0.56 : clamped === 3 ? 0.44 : 0.30,
      roughness: 0.38,
      metalness: 0.60,
      envMapIntensity: 0.58,
    });
    this.costRingMaterials.set(clamped, mat);
    return mat;
  }

  public createBloomEmissiveMaterial(colorHex: number, intensity = 1.12): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(colorHex),
      emissive: new THREE.Color(colorHex),
      emissiveIntensity: intensity,
      roughness: 0.34,
      metalness: 0.20,
      envMapIntensity: 0.44,
      toneMapped: false,
    });
    this.extraDisposables.push(mat);
    return mat;
  }

  public createUnitEnergyMaterial(colorHex: number, intensity = 0.86): THREE.MeshStandardMaterial {
    const boostedIntensity = Math.min(1.45, Math.max(0.76, intensity * 1.32));
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      color: new THREE.Color(colorHex),
      map: this.unitEnergyMaps.albedoMap,
      normalMap: this.unitEnergyMaps.normalMap,
      normalScale: new THREE.Vector2(0.20, 0.20),
      emissive: new THREE.Color(colorHex),
      emissiveMap: this.unitEnergyMaps.albedoMap,
      emissiveIntensity: boostedIntensity,
      roughness: 0.32,
      metalness: 0.12,
      envMapIntensity: 0.44,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    applyUnitVertexColorVibrancy(mat, 0.82);
    this.extraDisposables.push(mat);
    return mat;
  }

  public createUnitCrystalMaterial(
    colorHex: number,
    intensity = 0.48,
    opacity = 0.68,
  ): THREE.MeshPhysicalMaterial {
    const boostedIntensity = Math.min(0.95, Math.max(0.42, intensity * 1.32));
    const mat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      color: new THREE.Color(0xffffff),
      map: this.unitEnergyMaps.albedoMap,
      emissive: new THREE.Color(colorHex),
      emissiveMap: this.unitEnergyMaps.albedoMap,
      emissiveIntensity: boostedIntensity,
      roughness: 0.28,
      metalness: 0.06,
      envMapIntensity: 0.56,
      clearcoat: 0.0,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    applyUnitVertexColorVibrancy(mat, 0.82);
    this.extraDisposables.push(mat);
    return mat;
  }

  public dispose(): void {
    const mapSets = [
      this.basaltMaps,
      this.champagneGoldMaps,
      this.porcelainMaps,
      this.sapphireMaps,
      this.unitArmorMaps,
      this.unitCarbonMaps,
      this.unitTrimMaps,
      this.unitEnergyMaps,
      this.hexEngravedMaps,
      this.benchPlateMaps,
    ];
    for (const s of mapSets) {
      s.albedoMap.dispose();
      s.normalMap.dispose();
      s.roughnessMap.dispose();
      s.aoCurvatureMap.dispose();
      s.emissiveMap?.dispose();
    }
    this.benchSlotNumberAtlas.dispose();
    this.contactShadowTex.dispose();

    const coreMats = [
      this.hexTileBasaltMat,
      this.hexBezelGoldMat,
      this.hexBezelDeployMat,
      this.deckArmorMat,
      this.deckTrimTitaniumMat,
      this.brushedGoldMat,
      this.porcelainArmorMat,
      this.sapphireLatticeMat,
      this.cryoGlassMat,
      this.obsidianSatinMat,
      this.unitArmorMat,
      this.unitMatteMat,
      this.unitTrimMat,
      this.starPedestal1Mat,
      this.starPedestal2Mat,
      this.starPedestal3Mat,
      this.allyRingMat,
      this.enemyRingMat,
      this.contactShadowMat,
    ];
    for (const m of coreMats) m.dispose();
    for (const m of this.factionMaterials.values()) m.dispose();
    for (const m of this.costRingMaterials.values()) m.dispose();
    for (const d of this.extraDisposables) d.dispose();
    this.factionMaterials.clear();
    this.costRingMaterials.clear();
  }
}
