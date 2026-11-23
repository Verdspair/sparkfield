import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { LoopSubdivision } from 'three-subdivide';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BENCH_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  CRYO_BENCH_SLOT,
  PLAYER_DEPLOY_ROWS,
  type ArenaThemeId,
  type HexCoord,
} from '@pkg/contracts';
import type { PbrMaterialLibrary } from './pbrMaterials.js';
import {
  BENCH_SLOT_SPACING,
  BENCH_Z_OFFSET,
  HEX_RADIUS,
  SpringDamper,
  benchSlotToStageXZ,
  getHexesWithinRange,
  getSeatWorldOrigin,
  hexToStageXZ,
} from './spring.js';

const TOTAL_HEXES = BOARD_ROWS * BOARD_COLS;
const DEPLOY_START_ROW = BOARD_ROWS - PLAYER_DEPLOY_ROWS;
const INTEREST_POD_TIERS = 5;
const DECK_TEX_SIZE = 512;
const CLOUD_TEX_SIZE = 512;

export interface ArenaThemeLightingPreset {
  readonly keyColor: number;
  readonly keyIntensity: number;
  readonly keyPos: readonly [number, number, number];
  readonly rimColor: number;
  readonly rimIntensity: number;
  readonly rimPos: readonly [number, number, number];
  readonly hemiSkyColor: number;
  readonly hemiGroundColor: number;
  readonly hemiIntensity: number;
  readonly fillColor: number;
  readonly fillIntensity: number;
  readonly fillPos: readonly [number, number, number];
  readonly envIntensity: number;
  readonly fogColor: number;
  readonly fogDensity: number;
  readonly skyTop: THREE.Color;
  readonly skyMid: THREE.Color;
  readonly skyHorizon: THREE.Color;
}

export function getArenaThemeLightingPreset(theme: ArenaThemeId): ArenaThemeLightingPreset {
  if (theme === 'mercury_dyson_forge') {
    return {
      keyColor: 0xffbc66,
      keyIntensity: 1.82,
      keyPos: [8.5, 15.5, 7.5],
      rimColor: 0xff6e1a,
      rimIntensity: 1.18,
      rimPos: [1.5, 11.2, -15.5],
      hemiSkyColor: 0xf4b26e,
      hemiGroundColor: 0x160a06,
      hemiIntensity: 0.58,
      fillColor: 0x4ca8f0,
      fillIntensity: 0.72,
      fillPos: [-12.0, 8.5, 9.0],
      envIntensity: 0.68,
      fogColor: 0x1a0904,
      fogDensity: 0.0040,
      skyTop: new THREE.Color(0x100504),
      skyMid: new THREE.Color(0x5e1f0a),
      skyHorizon: new THREE.Color(0xf4761c),
    };
  }
  if (theme === 'event_horizon_observatory') {
    return {
      keyColor: 0xdde6ff,
      keyIntensity: 1.66,
      keyPos: [9.5, 16.5, 9.5],
      rimColor: 0x3ce8ff,
      rimIntensity: 1.06,
      rimPos: [0.5, 10.5, -15.5],
      hemiSkyColor: 0x9aa6ff,
      hemiGroundColor: 0x0e0a28,
      hemiIntensity: 0.62,
      fillColor: 0x7b5ef5,
      fillIntensity: 0.62,
      fillPos: [-11.5, 7.5, 8.5],
      envIntensity: 0.70,
      fogColor: 0x0a0724,
      fogDensity: 0.0038,
      skyTop: new THREE.Color(0x05041a),
      skyMid: new THREE.Color(0x191454),
      skyHorizon: new THREE.Color(0x523eb8),
    };
  }
  return {
    keyColor: 0xffe4b3,
    keyIntensity: 1.58,
    keyPos: [12.5, 16.5, 8.5],
    rimColor: 0x44c4ff,
    rimIntensity: 0.94,
    rimPos: [-11.5, 9.5, -13.5],
    hemiSkyColor: 0x8cd4ff,
    hemiGroundColor: 0x1c4a82,
    hemiIntensity: 0.74,
    fillColor: 0x5ab4f8,
    fillIntensity: 0.48,
    fillPos: [-7.5, 5.5, 11.5],
    envIntensity: 0.72,
    fogColor: 0x2474cc,
    fogDensity: 0.0034,
    skyTop: new THREE.Color(0x0a4aa8),
    skyMid: new THREE.Color(0x2288ea),
    skyHorizon: new THREE.Color(0xffd27a),
  };
}

interface RawDeckPbrBuffers {
  readonly size: number;
  readonly albedo: Uint8Array;
  readonly normal: Uint8Array;
  readonly roughness: Uint8Array;
}

const deckBufferCache = new Map<ArenaThemeId, RawDeckPbrBuffers>();
let cachedCloudDensityBuffer: Uint8Array | null = null;

function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function fbm2D(
  noise: (x: number, y: number) => number,
  x: number,
  y: number,
  octaves: number,
): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i += 1) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    freq *= 2.02;
    amp *= 0.5;
  }
  return sum / norm;
}

function buildNormalFromHeight(heights: Float32Array, size: number, strength: number): Uint8Array {
  const normal = new Uint8Array(size * size * 4);
  const mask = size - 1;
  for (let y = 0; y < size; y += 1) {
    const ym = (y - 1) & mask;
    const yp = (y + 1) & mask;
    for (let x = 0; x < size; x += 1) {
      const xm = (x - 1) & mask;
      const xp = (x + 1) & mask;
      const tl = heights[ym * size + xm]!;
      const t = heights[ym * size + x]!;
      const tr = heights[ym * size + xp]!;
      const l = heights[y * size + xm]!;
      const r = heights[y * size + xp]!;
      const bl = heights[yp * size + xm]!;
      const b = heights[yp * size + x]!;
      const br = heights[yp * size + xp]!;
      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);
      const p4 = (y * size + x) * 4;
      normal[p4] = clampByte((-dx * invLen * 0.5 + 0.5) * 255);
      normal[p4 + 1] = clampByte((-dy * invLen * 0.5 + 0.5) * 255);
      normal[p4 + 2] = clampByte((dz * invLen * 0.5 + 0.5) * 255);
      normal[p4 + 3] = 255;
    }
  }
  return normal;
}

function getOrBakeDeckBuffers(theme: ArenaThemeId): RawDeckPbrBuffers {
  const existing = deckBufferCache.get(theme);
  if (existing) return existing;

  const size = DECK_TEX_SIZE;
  const albedo = new Uint8Array(size * size * 4);
  const roughness = new Uint8Array(size * size * 4);
  const heights = new Float32Array(size * size);

  const seed =
    theme === 'orbital_elevator_port'
      ? 104729
      : theme === 'mercury_dyson_forge'
        ? 224737
        : 350377;
  const n1 = createNoise2D(createSeededRandom(seed));
  const n2 = createNoise2D(createSeededRandom(seed + 7919));

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    const cy = v - 0.5;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const cx = u - 0.5;
      const idx = y * size + x;
      const p4 = idx * 4;
      const rad = Math.hypot(cx, cy);
      const ang = Math.atan2(cy, cx);

      const innerFocus = Math.max(0, 1 - Math.pow(rad / 0.56, 2.1));
      const outerVignette = 0.76 + 0.28 * innerFocus;

      if (theme === 'orbital_elevator_port') {
        const warpX = fbm2D(n1, u * 3.4, v * 3.4, 4) * 0.35;
        const warpY = fbm2D(n2, u * 3.4 + 4.1, v * 3.4 + 2.7, 4) * 0.35;
        const veinWave = Math.sin((u * 6.5 + v * 4.2 + warpX * 3.2) * Math.PI);
        const vein = Math.pow(Math.max(0, 1 - Math.abs(veinWave)), 4.2);
        const fine = fbm2D(n2, u * 16.0 + warpY, v * 16.0 + warpX, 3) * 0.5 + 0.5;
        const tileU = Math.abs(((u * 8) % 1) - 0.5);
        const tileV = Math.abs(((v * 8) % 1) - 0.5);
        const seam = tileU > 0.482 || tileV > 0.482 ? 1 : 0;
        const compassRing =
          Math.abs(rad - 0.365) < 0.0045 ||
          Math.abs(rad - 0.225) < 0.0035 ||
          Math.abs(rad - 0.445) < 0.0030
            ? 1
            : 0;
        const compassTick =
          rad > 0.348 && rad < 0.365 && Math.abs(Math.sin(ang * 24)) < 0.06 ? 1 : 0;
        const skyInlay =
          rad > 0.228 && rad < 0.36 && Math.abs(Math.sin(ang * 4)) < 0.055 ? 1 : 0;

        let r = (238 + fine * 12 - vein * 34) * outerVignette;
        let g = (234 + fine * 10 - vein * 20) * (0.79 + 0.25 * innerFocus);
        let b = (226 + fine * 8 + vein * 16) * (0.82 + 0.20 * innerFocus);

        if (skyInlay) {
          r = (86 + fine * 16) * outerVignette;
          g = (164 + fine * 16) * (0.84 + 0.20 * innerFocus);
          b = (232 + fine * 12) * (0.88 + 0.14 * innerFocus);
        }
        if (compassRing || compassTick) {
          r = 238;
          g = 194;
          b = 94;
        }
        if (seam) {
          r *= 0.78;
          g *= 0.83;
          b *= 0.90;
        }

        albedo[p4] = clampByte(r);
        albedo[p4 + 1] = clampByte(g);
        albedo[p4 + 2] = clampByte(b);
        albedo[p4 + 3] = 255;

        const roughVal = seam
          ? 0.86
          : compassRing || compassTick
            ? 0.54
            : 0.64 + (1 - vein) * 0.10 + fine * 0.06 + (1 - innerFocus) * 0.08;
        const rByte = clampByte(roughVal * 255);
        roughness[p4] = rByte;
        roughness[p4 + 1] = rByte;
        roughness[p4 + 2] = rByte;
        roughness[p4 + 3] = 255;

        heights[idx] =
          0.58 + fine * 0.14 - vein * 0.06 - seam * 0.34 + (compassRing || compassTick ? 0.11 : 0);
      } else if (theme === 'mercury_dyson_forge') {
        const coarse = fbm2D(n1, u * 5.2, v * 5.2, 4) * 0.5 + 0.5;
        const grain = fbm2D(n2, u * 24.0, v * 6.0, 3) * 0.5 + 0.5;
        const stepBand = Math.abs(((rad * 7.5) % 1) - 0.5);
        const bronzeRib =
          stepBand > 0.44 || Math.abs(Math.sin(ang * 6)) < 0.042 ? 1 : 0;
        const plateX = Math.abs(((u * 6) % 1) - 0.5);
        const plateY = Math.abs(((v * 6) % 1) - 0.5);
        const groove = plateX > 0.478 || plateY > 0.478 ? 1 : 0;
        const deepSlag = plateX > 0.491 || plateY > 0.491 ? 1 : 0;
        const thermalLine =
          (Math.abs(rad - 0.39) < 0.0048 || Math.abs(rad - 0.25) < 0.0038) && !groove ? 1 : 0;

        let r = (30 + coarse * 18 + grain * 8) * (0.72 + 0.34 * innerFocus);
        let g = (23 + coarse * 13 + grain * 6) * (0.70 + 0.34 * innerFocus);
        let b = (24 + coarse * 12 + grain * 6) * (0.74 + 0.30 * innerFocus);

        if (bronzeRib) {
          r = (176 + grain * 36) * (0.78 + 0.26 * innerFocus);
          g = (110 + grain * 24) * (0.76 + 0.26 * innerFocus);
          b = (44 + grain * 14) * (0.74 + 0.24 * innerFocus);
        }
        if (groove) {
          r = deepSlag ? 210 : 16;
          g = deepSlag ? 88 : 11;
          b = deepSlag ? 18 : 10;
        }
        if (thermalLine) {
          r = 250;
          g = 138;
          b = 26;
        }

        albedo[p4] = clampByte(r);
        albedo[p4 + 1] = clampByte(g);
        albedo[p4 + 2] = clampByte(b);
        albedo[p4 + 3] = 255;

        const roughVal = groove
          ? 0.88
          : bronzeRib
            ? 0.54 + grain * 0.10
            : 0.72 + coarse * 0.12;
        const rByte = clampByte(roughVal * 255);
        roughness[p4] = rByte;
        roughness[p4 + 1] = rByte;
        roughness[p4 + 2] = rByte;
        roughness[p4 + 3] = 255;

        heights[idx] =
          0.44 + coarse * 0.18 + bronzeRib * 0.24 - groove * 0.38 - thermalLine * 0.16;
      } else {
        const strata = fbm2D(n1, u * 4.4, v * 4.4, 4) * 0.5 + 0.5;
        const speckle = fbm2D(n2, u * 18.0, v * 18.0, 3) * 0.5 + 0.5;
        const ringOuterA = Math.abs(rad - 0.44) < 0.0042;
        const ringOuterB = Math.abs(rad - 0.415) < 0.0028;
        const ringMid = Math.abs(rad - 0.31) < 0.0040;
        const ringInner = Math.abs(rad - 0.19) < 0.0036;
        const fineTick =
          rad > 0.417 && rad < 0.438 && Math.abs(Math.sin(ang * 36)) < 0.085;
        const majorTick =
          rad > 0.388 && rad < 0.438 && Math.abs(Math.sin(ang * 6)) < 0.042;
        const radialSpoke =
          rad > 0.192 && rad < 0.412 && Math.abs(Math.sin(ang * 4)) < 0.015;
        const innerCross =
          rad > 0.06 && rad < 0.188 && Math.abs(Math.sin(ang * 2)) < 0.014;
        const glyph =
          ringOuterA ||
          ringOuterB ||
          ringMid ||
          ringInner ||
          fineTick ||
          majorTick ||
          radialSpoke ||
          innerCross;
        const violetBand =
          rad > 0.315 && rad < 0.41 && Math.abs(Math.sin(ang * 6 + strata * 2.0)) < 0.058;

        let r = (18 + strata * 16 + speckle * 8) * (0.72 + 0.34 * innerFocus);
        let g = (24 + strata * 18 + speckle * 9) * (0.74 + 0.34 * innerFocus);
        let b = (62 + strata * 38 + speckle * 16) * (0.78 + 0.28 * innerFocus);

        if (violetBand) {
          r += 34 * innerFocus + 12;
          g += 28 * innerFocus + 12;
          b += 74 * innerFocus + 26;
        }
        if (glyph) {
          const isCyanRing = ringOuterB || ringInner || radialSpoke;
          if (isCyanRing) {
            r = 88 + speckle * 22;
            g = 216 + speckle * 24;
            b = 248;
          } else {
            const boost = majorTick || ringOuterA || ringMid ? 1.12 : 0.98;
            r = (228 + speckle * 20) * boost;
            g = (190 + speckle * 16) * boost;
            b = (102 + speckle * 12) * boost;
          }
        }

        albedo[p4] = clampByte(r);
        albedo[p4 + 1] = clampByte(g);
        albedo[p4 + 2] = clampByte(b);
        albedo[p4 + 3] = 255;

        const roughVal = glyph ? 0.50 : 0.70 + strata * 0.14;
        const rByte = clampByte(roughVal * 255);
        roughness[p4] = rByte;
        roughness[p4 + 1] = rByte;
        roughness[p4 + 2] = rByte;
        roughness[p4 + 3] = 255;

        heights[idx] = 0.48 + strata * 0.16 + speckle * 0.06 - (glyph ? 0.22 : 0);
      }
    }
  }

  const normal = buildNormalFromHeight(heights, size, 1.45);
  const built: RawDeckPbrBuffers = { size, albedo, normal, roughness };
  deckBufferCache.set(theme, built);
  return built;
}

function getOrBakeCloudDensityBuffer(): Uint8Array {
  if (cachedCloudDensityBuffer) return cachedCloudDensityBuffer;
  const size = CLOUD_TEX_SIZE;
  const data = new Uint8Array(size * size * 4);
  const noiseA = createNoise2D(createSeededRandom(55109));
  const noiseB = createNoise2D(createSeededRandom(88793));

  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    const ay = v * Math.PI * 2;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const ax = u * Math.PI * 2;
      const sx = Math.cos(ax) * 1.45 + Math.sin(ay) * 0.35;
      const sy = Math.sin(ax) * 1.45 + Math.cos(ay) * 0.35;
      const tx = Math.cos(ay) * 1.45 - Math.sin(ax) * 0.35;
      const ty = Math.sin(ay) * 1.45 + Math.cos(ax) * 0.35;

      const base = fbm2D(noiseA, sx + 2.1, sy + 1.3, 4) * 0.5 + 0.5;
      const puff = fbm2D(noiseB, tx * 2.1 - 1.7, ty * 2.1 + 3.4, 4) * 0.5 + 0.5;
      const density = Math.max(0, Math.min(1, base * 0.62 + puff * 0.48 - 0.12));
      const billow = Math.max(0, Math.min(1, puff * 0.72 + base * 0.28));

      const p4 = (y * size + x) * 4;
      data[p4] = clampByte(density * 255);
      data[p4 + 1] = clampByte(billow * 255);
      data[p4 + 2] = clampByte((1 - density * 0.45) * 255);
      data[p4 + 3] = 255;
    }
  }
  cachedCloudDensityBuffer = data;
  return data;
}

function makeDataTexture(
  data: Uint8Array,
  size: number,
  isColor: boolean,
  repeatX = 1,
  repeatY = 1,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(data), size, size, THREE.RGBAFormat);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function subdivideSmooth(
  baseGeo: THREE.BufferGeometry,
  iterations: number,
  preserveEdges = false,
): THREE.BufferGeometry {
  const out = LoopSubdivision.modify(baseGeo, iterations, {
    split: false,
    uvSmooth: true,
    preserveEdges,
    flatOnly: false,
  });
  baseGeo.dispose();
  out.computeVertexNormals();
  return out;
}

function createMatteMaterial(params: {
  color: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  map?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  normalScale?: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}): THREE.MeshStandardMaterial {
  const opts: THREE.MeshStandardMaterialParameters = {
    color: params.color,
    roughness: Math.max(0.36, params.roughness ?? 0.62),
    metalness: params.metalness ?? 0.12,
    envMapIntensity: Math.min(0.76, params.envMapIntensity ?? 0.46),
    emissiveIntensity: params.emissiveIntensity ?? 0,
    transparent: params.transparent ?? false,
    opacity: params.opacity ?? 1,
    side: params.side ?? THREE.FrontSide,
  };
  if (params.map) opts.map = params.map;
  if (params.normalMap) opts.normalMap = params.normalMap;
  if (params.roughnessMap) opts.roughnessMap = params.roughnessMap;
  if (params.normalScale !== undefined) {
    opts.normalScale = new THREE.Vector2(params.normalScale, params.normalScale);
  }
  if (params.emissive !== undefined) {
    opts.emissive = new THREE.Color(params.emissive);
  }
  return new THREE.MeshStandardMaterial(opts);
}

function createRoundedRectShape(width: number, depth: number, radius: number): THREE.Shape {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const r = Math.min(radius, hw * 0.45, hd * 0.45);
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hd);
  s.lineTo(hw - r, -hd);
  s.quadraticCurveTo(hw, -hd, hw, -hd + r);
  s.lineTo(hw, hd - r);
  s.quadraticCurveTo(hw, hd, hw - r, hd);
  s.lineTo(-hw + r, hd);
  s.quadraticCurveTo(-hw, hd, -hw, hd - r);
  s.lineTo(-hw, -hd + r);
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd);
  return s;
}

function createChamferedOctagonShape(width: number, depth: number, chamfer: number): THREE.Shape {
  const hw = width * 0.5;
  const hd = depth * 0.5;
  const c = Math.min(chamfer, hw * 0.42, hd * 0.42);
  const s = new THREE.Shape();
  s.moveTo(-hw + c, -hd);
  s.lineTo(hw - c, -hd);
  s.lineTo(hw, -hd + c);
  s.lineTo(hw, hd - c);
  s.lineTo(hw - c, hd);
  s.lineTo(-hw + c, hd);
  s.lineTo(-hw, hd - c);
  s.lineTo(-hw, -hd + c);
  s.closePath();
  return s;
}

function createOrganicSanctuaryShape(rx: number, rz: number): THREE.Shape {
  const s = new THREE.Shape();
  const pts = 24;
  for (let i = 0; i <= pts; i += 1) {
    const t = (i / pts) * Math.PI * 2;
    const harmonic = 1 + 0.035 * Math.cos(t * 4) + 0.022 * Math.cos(t * 6);
    const x = Math.cos(t) * rx * harmonic;
    const y = Math.sin(t) * rz * harmonic;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function normalizeExtrudedPlanarUvs(geo: THREE.BufferGeometry, spanX: number, spanZ: number): void {
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  if (!pos || !uv) return;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv.setXY(i, x / spanX + 0.5, z / spanZ + 0.5);
  }
  uv.needsUpdate = true;
}

function createPointyHexRingGeometry(outerR: number, innerR: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angle) * outerR;
    const y = Math.sin(angle) * outerR;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angle) * innerR;
    const y = Math.sin(angle) * innerR;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.005,
    bevelSize: 0.005,
    bevelSegments: 1,
  });
  geom.rotateX(-Math.PI * 0.5);
  return geom;
}

function createChamferedHexTileGeometry(radius: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.009,
    bevelSize: 0.020,
    bevelSegments: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -height * 0.5, 0);
  const pos = geo.attributes.position;
  if (pos) {
    const uvs = new Float32Array(pos.count * 2);
    const invSpan = 1 / (radius * 2.04);
    for (let i = 0; i < pos.count; i += 1) {
      uvs[i * 2] = pos.getX(i) * invSpan + 0.5;
      uvs[i * 2 + 1] = pos.getZ(i) * invSpan + 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  geo.computeVertexNormals();
  return geo;
}

function createChamferedBenchPadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.545, 0.615, 0.068, 8, 1);
  const pos = geo.attributes.position;
  if (pos) {
    const uvs = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i += 1) {
      uvs[i * 2] = pos.getX(i) / 1.24 + 0.5;
      uvs[i * 2 + 1] = pos.getZ(i) / 1.24 + 0.5;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  }
  geo.computeVertexNormals();
  return geo;
}

function createArenaSkyDomeShader(preset: ArenaThemeLightingPreset, themeIndex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTime: { value: 0 },
      uThemeIndex: { value: themeIndex },
      uTopColor: { value: preset.skyTop.clone() },
      uMidColor: { value: preset.skyMid.clone() },
      uHorizonColor: { value: preset.skyHorizon.clone() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uThemeIndex;
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      varying vec3 vDir;

      float hash2(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float waveNoise(vec2 p) {
        return sin(p.x) * cos(p.y) * 0.5 + 0.5;
      }

      float roundStars(vec3 d, float scale, float density) {
        vec2 uv = vec2(atan(d.x, d.z) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415926 + 0.5);
        vec2 gv = fract(uv * vec2(scale * 2.0, scale)) - 0.5;
        vec2 id = floor(uv * vec2(scale * 2.0, scale));
        float rnd = hash2(id);
        if (rnd < density) return 0.0;
        vec2 jitter = (vec2(hash2(id + 11.3), hash2(id + 29.7)) - 0.5) * 0.55;
        float dist = length(gv - jitter);
        float core = smoothstep(0.16, 0.02, dist);
        float twinkle = 0.65 + 0.35 * sin(uTime * 2.0 + rnd * 60.0);
        return core * core * twinkle;
      }

      void main() {
        vec3 d = normalize(vDir);
        float northBand = smoothstep(-0.35, 0.85, -d.z);
        float y = d.y;

        vec3 col;
        if (uThemeIndex < 0.5) {
          vec3 zenith = vec3(0.04, 0.28, 0.70);
          vec3 skyMid = vec3(0.14, 0.56, 0.92);
          vec3 horizonWarm = vec3(1.0, 0.80, 0.46);
          vec3 lowerSky = vec3(0.09, 0.42, 0.82);
          vec3 eqCol = mix(skyMid, horizonWarm, northBand * 0.52);
          col = mix(lowerSky, eqCol, smoothstep(-0.62, -0.02, y));
          col = mix(col, zenith, smoothstep(0.0, 0.52, y));
          float sunGlow = pow(max(0.0, dot(d, normalize(vec3(0.18, 0.14, -0.96)))), 5.0);
          col += vec3(1.0, 0.88, 0.60) * sunGlow * 0.58;
          float cirrus = waveNoise(d.xz * 6.5 + vec2(uTime * 0.035, -uTime * 0.02))
                       * waveNoise(d.xz * 12.0 - vec2(uTime * 0.025, uTime * 0.04));
          col = mix(col, vec3(1.0, 0.99, 0.96), cirrus * smoothstep(-0.14, 0.35, y) * 0.28);
        } else if (uThemeIndex < 1.5) {
          vec3 abyss = vec3(0.028, 0.010, 0.014);
          vec3 horizonGlow = vec3(0.54, 0.16, 0.03) * (0.35 + 0.65 * northBand);
          vec3 lowerEmber = vec3(0.05, 0.016, 0.012);
          col = mix(lowerEmber, horizonGlow, smoothstep(-0.64, -0.06, y));
          col = mix(col, abyss, smoothstep(0.0, 0.45, y));
          float streamA = waveNoise(vec2(d.x * 5.6 + uTime * 0.06, d.z * 6.2 - d.y * 4.5));
          float streamB = waveNoise(vec2(d.z * 9.8 - uTime * 0.04, d.x * 8.2 + d.y * 6.4));
          col += vec3(0.68, 0.22, 0.03) * streamA * streamB * (0.20 + 0.80 * northBand) * 0.58;
          float corona = pow(max(0.0, dot(d, normalize(vec3(0.0, -0.14, -0.98)))), 5.0);
          col += vec3(1.0, 0.52, 0.10) * corona * 0.78;
          float s = roundStars(d, 54.0, 0.956);
          col += vec3(1.0, 0.86, 0.62) * s * 0.82;
        } else {
          vec3 deepVoid = vec3(0.012, 0.014, 0.064);
          vec3 lowerVoid = vec3(0.018, 0.024, 0.098);
          vec3 horizonNeb = vec3(0.10, 0.075, 0.34);
          col = mix(lowerVoid, horizonNeb, smoothstep(-0.66, -0.06, y));
          col = mix(col, deepVoid, smoothstep(0.0, 0.48, y));
          float diag = exp(-pow((d.x * 0.55 + d.y * 0.65 - d.z * 0.22) * 2.3, 2.0));
          float cloudA = waveNoise(vec2(d.x * 5.8 - uTime * 0.03, d.z * 5.8 + d.y * 4.4));
          float cloudB = waveNoise(vec2(d.z * 10.2 + uTime * 0.025, d.x * 8.8 - d.y * 6.2));
          float neb = cloudA * cloudB;
          col += vec3(0.28, 0.16, 0.68) * (0.25 + 0.75 * diag) * neb * 0.68;
          col += vec3(0.12, 0.64, 0.88) * (1.0 - diag * 0.4) * neb * 0.42;
          col += vec3(0.88, 0.62, 0.24) * diag * neb * northBand * 0.28;
          float s1 = roundStars(d, 58.0, 0.942);
          float s2 = roundStars(d + vec3(0.17, -0.11, 0.23), 34.0, 0.958);
          col += vec3(0.76, 0.95, 1.0) * s1 * 1.18;
          col += vec3(1.0, 0.88, 0.62) * s2 * 0.96;
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createCloudSeaShader(cloudTex: THREE.DataTexture, layerOffset: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uCloudTex: { value: cloudTex },
      uLayerOffset: { value: layerOffset },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform sampler2D uCloudTex;
      uniform float uLayerOffset;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      void main() {
        vec2 uv1 = vUv * 2.6 + vec2(uTime * 0.0085 + uLayerOffset, uTime * 0.0042);
        vec2 uv2 = vUv * 4.4 + vec2(-uTime * 0.0055, uTime * 0.0068 - uLayerOffset);
        vec3 s1 = texture2D(uCloudTex, uv1).rgb;
        vec3 s2 = texture2D(uCloudTex, uv2).rgb;
        float density = smoothstep(0.34, 0.86, s1.r * 0.65 + s2.r * 0.45);
        float billow = clamp(s1.g * 0.6 + s2.g * 0.4, 0.0, 1.0);

        vec3 shadowCol = vec3(0.16, 0.48, 0.86);
        vec3 midCloud = vec3(0.56, 0.82, 0.98);
        vec3 cloudWhite = vec3(1.0, 0.98, 0.94);
        vec3 sunriseTint = vec3(1.0, 0.84, 0.50);

        float northWarm = smoothstep(-4.0, -24.0, vWorldPos.z);
        vec3 col = mix(shadowCol, midCloud, smoothstep(0.18, 0.56, billow));
        col = mix(col, cloudWhite, smoothstep(0.52, 0.88, billow));
        col = mix(col, sunriseTint, northWarm * 0.44 * billow);

        float radialEdge = 1.0 - smoothstep(20.0, 35.0, length(vWorldPos.xz));
        float alpha = density * radialEdge * (0.68 - uLayerOffset * 0.16);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createVerticalLightPillarShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalView;
      void main() {
        float edge = pow(abs(vNormalView.z), 1.45);
        float vertFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.68, vUv.y);
        float pulse = 0.78 + 0.22 * sin(vUv.y * 18.0 - uTime * 2.4);
        vec3 col = mix(vec3(0.55, 0.86, 1.0), vec3(0.98, 0.91, 0.72), vUv.y * 0.45);
        float alpha = edge * vertFade * pulse * 0.36;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createSolarCoronaShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vPos;
      void main() {
        float rim = pow(1.0 - max(0.0, vNormal.z), 2.0);
        float w1 = sin(vPos.x * 3.8 + sin(vPos.y * 2.6 + uTime * 0.45) * 1.4 + uTime * 0.55) * 0.5 + 0.5;
        float w2 = cos(vPos.y * 5.4 - cos(vPos.x * 4.2 - uTime * 0.6) * 1.3 + vPos.z * 2.8) * 0.5 + 0.5;
        float w3 = sin((vPos.x + vPos.y) * 9.5 + uTime * 0.9) * cos((vPos.x - vPos.z) * 8.2 - uTime * 0.7) * 0.5 + 0.5;
        float plasma = clamp(w1 * 0.45 + w2 * 0.35 + w3 * 0.25, 0.0, 1.0);
        vec3 deepCore = vec3(0.66, 0.22, 0.06);
        vec3 midPlasma = vec3(0.92, 0.48, 0.13);
        vec3 coronaEdge = vec3(0.99, 0.80, 0.38);
        vec3 col = mix(deepCore, midPlasma, smoothstep(0.18, 0.86, plasma));
        col = mix(col, coronaEdge, clamp(rim * 0.88 + pow(plasma, 3.0) * 0.28, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}

function createAccretionDiskShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vLocal;
      void main() {
        float r = length(vLocal);
        float ang = atan(vLocal.y, vLocal.x);
        float normR = clamp((r - 1.32) / 3.05, 0.0, 1.0);
        float spiralA = sin(ang * 3.0 - normR * 14.0 + uTime * 1.45) * 0.5 + 0.5;
        float spiralB = sin(ang * 6.0 - normR * 22.0 + uTime * 2.25) * 0.5 + 0.5;
        float fineDust = sin(ang * 11.0 - normR * 34.0 + uTime * 3.0) * 0.5 + 0.5;
        float bands = spiralA * 0.50 + spiralB * 0.32 + fineDust * 0.18;

        float innerEdge = smoothstep(0.0, 0.11, normR);
        float photonRim = exp(-pow((normR - 0.06) / 0.045, 2.0));
        float outerEdge = 1.0 - smoothstep(0.42, 1.0, normR);
        float doppler = 0.74 + 0.38 * cos(ang + 0.45);

        vec3 photonWhite = vec3(0.96, 0.98, 1.0);
        vec3 hotCyan = vec3(0.24, 0.86, 1.0);
        vec3 midViolet = vec3(0.54, 0.32, 0.98);
        vec3 outerIndigo = vec3(0.16, 0.18, 0.58);

        vec3 col = mix(hotCyan, midViolet, smoothstep(0.10, 0.54, normR));
        col = mix(col, outerIndigo, smoothstep(0.50, 0.95, normR));
        col = mix(col, photonWhite, photonRim * 0.78);
        col *= (0.70 + 0.46 * bands) * doppler;

        float alpha = innerEdge * outerEdge * (0.46 + 0.50 * bands) + photonRim * 0.38;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.96));
      }
    `,
  });
}

function createDeployHexFlowShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0.28 },
      uHighlight: { value: 0.0 },
      uBaseColor: { value: new THREE.Color(0x52c8f5) },
      uAccentColor: { value: new THREE.Color(0xf4cf82) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uHighlight;
      uniform vec3 uBaseColor;
      uniform vec3 uAccentColor;
      varying vec3 vWorldPos;

      void main() {
        float diag = vWorldPos.x * 0.36 - vWorldPos.z * 0.52;
        float sweep = 0.5 + 0.5 * sin(diag * 1.45 - uTime * 2.8);
        float ripple = 0.5 + 0.5 * sin(length(vWorldPos.xz - vec2(0.0, 2.6)) * 1.15 - uTime * 2.2);
        float flow = mix(0.42, 0.65 + 0.35 * (sweep * 0.62 + ripple * 0.38), uHighlight);
        vec3 col = mix(uAccentColor, uBaseColor, 0.35 + 0.45 * sweep * uHighlight);
        float alpha = clamp(uOpacity * (0.72 + 0.56 * flow), 0.0, 0.92);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(col * (0.85 + 0.45 * uHighlight * sweep), alpha);
      }
    `,
  });
}

function createBenchArcGlowShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocal;
      varying vec3 vColor;
      void main() {
        vLocal = position;
        vColor = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vLocal;
      varying vec3 vColor;

      void main() {
        float ang = atan(vLocal.z, vLocal.x);
        float arcMask = smoothstep(-0.15, 0.25, sin(ang * 2.0));
        float pulse = 0.70 + 0.30 * sin(uTime * 2.4 + ang * 2.0);
        float alpha = (0.34 + 0.48 * arcMask) * pulse;
        gl_FragColor = vec4(vColor * (0.95 + 0.28 * arcMask), clamp(alpha, 0.0, 0.86));
      }
    `,
  });
}

function createCloudWaterfallShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float flowA = sin(vUv.x * 22.0 + sin(vUv.y * 5.0 + uTime * 0.45) * 1.4) * 0.5 + 0.5;
        float flowB = cos(vUv.x * 36.0 - vUv.y * 9.0 - uTime * 0.95) * 0.5 + 0.5;
        float wisp = flowA * 0.60 + flowB * 0.40;
        float topFade = smoothstep(1.0, 0.72, vUv.y);
        float bottomFade = smoothstep(0.0, 0.52, vUv.y);
        float edgeFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        vec3 mistCol = mix(vec3(0.68, 0.85, 0.98), vec3(0.98, 0.99, 1.0), vUv.y * 0.75 + wisp * 0.25);
        float alpha = topFade * bottomFade * edgeFade * (0.20 + 0.38 * wisp);
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(mistCol, alpha);
      }
    `,
  });
}

function createShuttleWakeShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        float lengthFade = pow(clamp(vUv.y, 0.0, 1.0), 1.65) * smoothstep(1.0, 0.90, vUv.y);
        float widthFade = exp(-pow((vUv.x - 0.5) * 3.8, 2.0));
        float shimmer = 0.78 + 0.22 * sin(vUv.y * 16.0 - uTime * 8.0);
        vec3 col = mix(vec3(0.45, 0.84, 1.0), vec3(1.0, 0.90, 0.66), smoothstep(0.55, 0.95, vUv.y));
        float alpha = lengthFade * widthFade * shimmer * 0.64;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createMoltenForgeTrenchShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorldPos;

      void main() {
        float waveA = sin(vWorldPos.x * 1.1 + vWorldPos.z * 0.9 - uTime * 1.45) * 0.5 + 0.5;
        float waveB = cos(vWorldPos.x * 2.1 - vWorldPos.z * 1.6 + uTime * 0.95) * 0.5 + 0.5;
        float breath = 0.56 + 0.44 * (waveA * 0.6 + waveB * 0.4);
        vec3 deepEmber = vec3(0.76, 0.24, 0.04);
        vec3 brightAmber = vec3(1.0, 0.64, 0.18);
        vec3 col = mix(deepEmber, brightAmber, breath);
        gl_FragColor = vec4(col, 0.34 + 0.30 * breath);
      }
    `,
  });
}

function createSolarCoronaHaloShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float flare = 0.74 + 0.26 * sin(ang * 10.0 + uTime * 0.45) * cos(ang * 6.0 - uTime * 0.32);
        float ring = exp(-pow((r - 0.52) / 0.16, 2.0));
        float soft = exp(-r * r * 2.4) * 0.35;
        vec3 col = mix(vec3(0.95, 0.38, 0.08), vec3(1.0, 0.80, 0.38), ring * 0.72 + soft);
        float alpha = (ring * 0.46 * flare + soft * 0.32) * smoothstep(1.0, 0.62, r);
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createGravitationalVortexShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;

      void main() {
        vec2 p = (vUv - 0.5) * 2.0;
        float r = length(p);
        float ang = atan(p.y, p.x);
        float swirlA = sin(ang * 4.0 - r * 14.0 + uTime * 1.1) * 0.5 + 0.5;
        float swirlB = cos(ang * 7.0 - r * 22.0 + uTime * 1.65) * 0.5 + 0.5;
        float dust = swirlA * 0.58 + swirlB * 0.42;
        float lensHalo = exp(-pow((r - 0.34) / 0.06, 2.0));
        float outerMask = smoothstep(0.24, 0.42, r) * smoothstep(0.98, 0.48, r);
        vec3 col = mix(vec3(0.36, 0.24, 0.92), vec3(0.26, 0.88, 1.0), lensHalo * 0.78 + dust * 0.24);
        float alpha = (outerMask * dust * 0.38 + lensHalo * 0.44) * smoothstep(1.0, 0.75, r);
        if (alpha < 0.006) discard;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.68));
      }
    `,
  });
}

function createSoftParticleShader(
  colorA: number,
  colorB: number,
  pointSize: number,
  driftSpeed: number,
  riseDir: number,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uPointSize: { value: pointSize },
      uSpeed: { value: driftSpeed },
      uRiseDir: { value: riseDir },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform float uPointSize;
      uniform float uSpeed;
      uniform float uRiseDir;
      varying float vMix;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        float cycle = fract(aPhase + uTime * uSpeed);
        p.y += (cycle - 0.5) * 4.8 * uRiseDir;
        p.x += sin(uTime * 0.7 + aPhase * 18.0) * 0.38;
        p.z += cos(uTime * 0.6 + aPhase * 14.0) * 0.32;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uPointSize * aScale * (26.0 / max(4.0, -mv.z)), 2.5, 22.0);
        vMix = fract(aPhase * 7.13);
        vAlpha = smoothstep(0.0, 0.18, cycle) * smoothstep(1.0, 0.78, cycle);
      }
    `,
    fragmentShader: `
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying float vMix;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float soft = smoothstep(0.5, 0.08, d);
        vec3 col = mix(uColorA, uColorB, vMix);
        gl_FragColor = vec4(col, soft * soft * vAlpha * 0.72);
      }
    `,
  });
}

function createCrystalPodShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float aActive;
      varying vec2 vUv;
      varying float vActive;
      void main() {
        vUv = uv;
        vActive = aActive;
        vec4 localPosition = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          localPosition = instanceMatrix * localPosition;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * localPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying float vActive;
      void main() {
        float pulse = 0.88 + 0.12 * sin(vUv.y * 10.0 - uTime * 3.4);
        vec3 idleCrystal = vec3(0.14, 0.26, 0.36) * 0.82;
        vec3 activeHoneyGold = vec3(0.92, 0.70, 0.28) * (0.98 + 0.12 * pulse);
        vec3 col = mix(idleCrystal, activeHoneyGold, vActive);
        float alpha = mix(0.56, 0.92, vActive);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function normalizeArenaGeometryForMerge(
  geo: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.getAttribute('normal')) {
    g.computeVertexNormals();
  }
  const posAttr = g.getAttribute('position');
  const count = posAttr ? posAttr.count : 0;
  if (!g.getAttribute('uv')) {
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  for (const key of Object.keys(g.attributes)) {
    if (key !== 'position' && key !== 'normal' && key !== 'uv') {
      g.deleteAttribute(key);
    }
  }
  g.applyMatrix4(matrix);
  if (matrix.determinant() < 0 && count >= 3) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const norm = g.getAttribute('normal') as THREE.BufferAttribute;
    const uv = g.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i + 2 < count; i += 3) {
      const i1 = i + 1;
      const i2 = i + 2;
      const px = pos.getX(i1);
      const py = pos.getY(i1);
      const pz = pos.getZ(i1);
      pos.setXYZ(i1, pos.getX(i2), pos.getY(i2), pos.getZ(i2));
      pos.setXYZ(i2, px, py, pz);

      const nx = norm.getX(i1);
      const ny = norm.getY(i1);
      const nz = norm.getZ(i1);
      norm.setXYZ(i1, norm.getX(i2), norm.getY(i2), norm.getZ(i2));
      norm.setXYZ(i2, nx, ny, nz);

      const ux = uv.getX(i1);
      const uy = uv.getY(i1);
      uv.setXY(i1, uv.getX(i2), uv.getY(i2));
      uv.setXY(i2, ux, uy);
    }
    pos.needsUpdate = true;
    norm.needsUpdate = true;
    uv.needsUpdate = true;
  }
  return g;
}

function normalizeColoredGeometryForMerge(
  source: THREE.BufferGeometry,
  matrix: THREE.Matrix4,
  hexColor: number,
): THREE.BufferGeometry {
  const g = normalizeArenaGeometryForMerge(source, matrix);
  const count = g.getAttribute('position').count;
  const col = new THREE.Color(hexColor);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}

function pruneArenaEmptyGroups(root: THREE.Object3D, skipSet: ReadonlySet<THREE.Object3D>): void {
  for (let i = root.children.length - 1; i >= 0; i -= 1) {
    const child = root.children[i]!;
    if (skipSet.has(child)) continue;
    if (child instanceof THREE.Group) {
      pruneArenaEmptyGroups(child, skipSet);
      if (child.children.length === 0) {
        root.remove(child);
      }
    }
  }
}

function batchArenaStaticChildrenByMaterial(
  group: THREE.Group,
  skipSet: ReadonlySet<THREE.Object3D>,
  bloomTargets: THREE.Object3D[],
  ownedGeos: THREE.BufferGeometry[],
): void {
  group.updateMatrixWorld(true);
  const invGroupMat = group.matrixWorld.clone().invert();
  const bloomSet = new Set<THREE.Object3D>(bloomTargets);
  const normalBuckets = new Map<THREE.Material, THREE.Mesh[]>();
  const bloomBuckets = new Map<THREE.Material, THREE.Mesh[]>();

  const collect = (node: THREE.Object3D): void => {
    for (const child of node.children) {
      if (skipSet.has(child)) continue;
      if (
        child instanceof THREE.Mesh &&
        !(child instanceof THREE.InstancedMesh) &&
        !(child instanceof THREE.SkinnedMesh)
      ) {
        if (child.visible && !Array.isArray(child.material) && child.children.length === 0) {
          const isBloom = bloomSet.has(child);
          const map = isBloom ? bloomBuckets : normalBuckets;
          let arr = map.get(child.material);
          if (!arr) {
            arr = [];
            map.set(child.material, arr);
          }
          arr.push(child);
        }
        continue;
      }
      if (child.children.length > 0) {
        collect(child);
      }
    }
  };

  collect(group);

  const flush = (buckets: Map<THREE.Material, THREE.Mesh[]>, isBloom: boolean): void => {
    for (const [mat, meshes] of buckets.entries()) {
      if (meshes.length < 2) continue;
      const baked: THREE.BufferGeometry[] = [];
      const relMat = new THREE.Matrix4();
      for (const mesh of meshes) {
        relMat.multiplyMatrices(invGroupMat, mesh.matrixWorld);
        baked.push(normalizeArenaGeometryForMerge(mesh.geometry, relMat));
      }
      const mergedGeo = mergeGeometries(baked, false);
      for (const b of baked) b.dispose();
      if (!mergedGeo) continue;
      mergedGeo.computeBoundingSphere();
      ownedGeos.push(mergedGeo);
      const mergedMesh = new THREE.Mesh(mergedGeo, mat);
      group.add(mergedMesh);
      for (const mesh of meshes) {
        mesh.parent?.remove(mesh);
        if (isBloom) {
          const idx = bloomTargets.indexOf(mesh);
          if (idx >= 0) bloomTargets.splice(idx, 1);
        }
      }
      if (isBloom) {
        bloomTargets.push(mergedMesh);
      }
    }
  };

  flush(normalBuckets, false);
  flush(bloomBuckets, true);
  pruneArenaEmptyGroups(group, skipSet);
}

function disposeUnusedArenaGeos(
  root: THREE.Object3D,
  ownedGeos: THREE.BufferGeometry[],
  protectedGeos: ReadonlySet<THREE.BufferGeometry>,
): void {
  const used = new Set<THREE.BufferGeometry>(protectedGeos);
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.Line) {
      used.add(obj.geometry);
    }
  });
  let write = 0;
  for (let i = 0; i < ownedGeos.length; i += 1) {
    const g = ownedGeos[i]!;
    if (used.has(g)) {
      ownedGeos[write] = g;
      write += 1;
    } else {
      g.dispose();
    }
  }
  ownedGeos.length = write;
}

interface AirshipRig {
  readonly phase: number;
  readonly radiusX: number;
  readonly radiusZ: number;
  readonly centerZ: number;
  readonly baseY: number;
  readonly speed: number;
}

interface RadarScannerRig {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly speed: number;
}

interface DysonTowerRig {
  readonly pos: THREE.Vector3;
  readonly scale: number;
  readonly baseEuler: THREE.Euler;
  readonly phase: number;
}

interface FloatingReefRig {
  readonly x: number;
  readonly baseY: number;
  readonly z: number;
  readonly scale: number;
  readonly phase: number;
  readonly amp: number;
  readonly rotSpeed: number;
  rotY: number;
  readonly rockVariant: number;
  readonly rockSlot: number;
  readonly isGoldBand: boolean;
  readonly bandSlot: number;
  readonly shardSlot: number;
}

interface ArmillaryTowerRig {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly phase: number;
}

export class ArenaStageAssembly {
  public readonly root = new THREE.Group();
  public readonly bloomTargets: THREE.Object3D[] = [];

  private readonly sharedBloomTargets: THREE.Object3D[] = [];
  private readonly themeBloomTargets: Record<ArenaThemeId, THREE.Object3D[]> = {
    orbital_elevator_port: [],
    mercury_dyson_forge: [],
    event_horizon_observatory: [],
  };

  private readonly materials: PbrMaterialLibrary;
  private currentTheme: ArenaThemeId = 'orbital_elevator_port';
  private readonly skyDomeMat: THREE.ShaderMaterial;
  private readonly scoutPadsMesh: THREE.InstancedMesh;

  private readonly hexBezelInstanced: THREE.InstancedMesh;
  private readonly deployBezelInstanced: THREE.InstancedMesh;
  private readonly hexPlateInstanced: THREE.InstancedMesh;
  private readonly themeHexTileMats: Record<ArenaThemeId, THREE.MeshStandardMaterial>;
  private readonly themeBenchRingColors: Record<ArenaThemeId, number> = {
    orbital_elevator_port: 0xe8be66,
    mercury_dyson_forge: 0xf2a33a,
    event_horizon_observatory: 0x52dcff,
  };
  private readonly hexHoverSprings: SpringDamper[] = [];
  private hoveredHexIndex = -1;
  private readonly hoverFresnelRing: THREE.Mesh;
  private readonly deployFlowMat: THREE.ShaderMaterial;
  private readonly battleGridOpacitySpring = new SpringDamper(0.28, 14, 0.85);
  private readonly deployHighlightSpring = new SpringDamper(0.28, 14, 0.85);
  private readonly deployFlowHighlightSpring = new SpringDamper(0, 14, 0.85);
  private deployHighlightActive = false;

  private readonly rangeDashedLines: THREE.LineSegments;
  private readonly swapArcGroup = new THREE.Group();
  private readonly swapArcMesh: THREE.Mesh;
  private readonly swapArrowStart: THREE.Mesh;
  private readonly swapArrowEnd: THREE.Mesh;
  private readonly swapArcCurve: THREE.QuadraticBezierCurve3;

  private readonly benchRingsInstanced: THREE.InstancedMesh;
  private readonly benchArcMat: THREE.ShaderMaterial;
  private readonly benchArcInstanced: THREE.InstancedMesh;
  private readonly benchDepressSprings: SpringDamper[] = [];
  private readonly benchOccupied: boolean[] = new Array<boolean>(BENCH_SLOTS).fill(false);
  private readonly cryoCanopyMesh: THREE.Mesh;
  private readonly cryoLampMat: THREE.MeshStandardMaterial;
  private readonly cryoSlideSpring = new SpringDamper(0, 18, 0.78);
  private cryoEnabled = false;

  private readonly interestCollarsInstanced: THREE.InstancedMesh;
  private readonly interestPodCoords: { x: number; z: number; tier: number }[] = [];
  private readonly interestLiftSprings: SpringDamper[] = [];
  private readonly interestCrystalMat: THREE.ShaderMaterial;
  private readonly interestActiveAttr: THREE.InstancedBufferAttribute;
  private currentGold = 0;

  private readonly conduitShaderMat: THREE.ShaderMaterial;
  private conduitSweepProgress = 1.5;

  private readonly themeRoots: Record<ArenaThemeId, THREE.Group>;
  private readonly animatedShaderMats: THREE.ShaderMaterial[] = [];

  private readonly airships: AirshipRig[] = [];
  private readonly airshipPartInstanced: THREE.InstancedMesh[] = [];
  private readonly radarScanners: RadarScannerRig[] = [];
  private readonly radarScannerInstanced: THREE.InstancedMesh[] = [];
  private readonly dysonTowers: DysonTowerRig[] = [];
  private readonly dysonMirrorInstanced: THREE.InstancedMesh[] = [];
  private dysonOuterGear: THREE.Object3D | null = null;
  private dysonInnerGear: THREE.Object3D | null = null;
  private readonly floatingReefs: FloatingReefRig[] = [];
  private readonly reefRockInstanced: THREE.InstancedMesh[] = [];
  private reefGoldBandInstanced: THREE.InstancedMesh | null = null;
  private reefAmethystBandInstanced: THREE.InstancedMesh | null = null;
  private reefShardInstanced: THREE.InstancedMesh | null = null;
  private readonly armillaryTowers: ArmillaryTowerRig[] = [];
  private armillaryOuterInstanced: THREE.InstancedMesh | null = null;
  private armillaryMidInstanced: THREE.InstancedMesh | null = null;
  private armillaryInnerInstanced: THREE.InstancedMesh | null = null;
  private armillaryCoreInstanced: THREE.InstancedMesh | null = null;
  private readonly blackHoleSpinners: THREE.Object3D[] = [];

  private elapsedSec = 0;
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPos = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly tempEuler = new THREE.Euler();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);
  private readonly tempColor = new THREE.Color();
  private readonly tempYAxis = new THREE.Vector3(0, 1, 0);

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private readonly ownedTextures: THREE.Texture[] = [];

  constructor(materials: PbrMaterialLibrary, initialTheme: ArenaThemeId = 'orbital_elevator_port') {
    this.materials = materials;

    const initialPreset = getArenaThemeLightingPreset(initialTheme);
    const initialIdx =
      initialTheme === 'mercury_dyson_forge'
        ? 1
        : initialTheme === 'event_horizon_observatory'
          ? 2
          : 0;
    this.skyDomeMat = createArenaSkyDomeShader(initialPreset, initialIdx);
    this.ownedMaterials.push(this.skyDomeMat);
    const skyGeo = new THREE.SphereGeometry(98, 36, 24);
    this.ownedGeometries.push(skyGeo);
    const skyDome = new THREE.Mesh(skyGeo, this.skyDomeMat);
    this.root.add(skyDome);

    const skyportMaps = this.createThemeDeckTextures('orbital_elevator_port');
    const dysonMaps = this.createThemeDeckTextures('mercury_dyson_forge');
    const horizonMaps = this.createThemeDeckTextures('event_horizon_observatory');

    this.themeHexTileMats = {
      orbital_elevator_port: createMatteMaterial({
        color: 0x5c90c4,
        map: materials.hexEngravedMaps.albedoMap,
        normalMap: materials.hexEngravedMaps.normalMap,
        roughnessMap: materials.hexEngravedMaps.roughnessMap,
        normalScale: 0.82,
        roughness: 0.58,
        metalness: 0.16,
        envMapIntensity: 0.52,
        transparent: true,
        opacity: 0.72,
      }),
      mercury_dyson_forge: createMatteMaterial({
        color: 0x3f2c22,
        map: materials.hexEngravedMaps.albedoMap,
        normalMap: materials.hexEngravedMaps.normalMap,
        roughnessMap: materials.hexEngravedMaps.roughnessMap,
        normalScale: 0.90,
        roughness: 0.64,
        metalness: 0.34,
        envMapIntensity: 0.52,
        transparent: true,
        opacity: 0.70,
      }),
      event_horizon_observatory: createMatteMaterial({
        color: 0x2c2b6e,
        map: materials.hexEngravedMaps.albedoMap,
        normalMap: materials.hexEngravedMaps.normalMap,
        roughnessMap: materials.hexEngravedMaps.roughnessMap,
        normalScale: 0.86,
        roughness: 0.62,
        metalness: 0.24,
        envMapIntensity: 0.54,
        transparent: true,
        opacity: 0.70,
      }),
    };
    this.ownedMaterials.push(
      this.themeHexTileMats.orbital_elevator_port,
      this.themeHexTileMats.mercury_dyson_forge,
      this.themeHexTileMats.event_horizon_observatory,
    );

    const scoutPadGeo = new THREE.CylinderGeometry(7.8, 8.2, 0.36, 6);
    const scoutPadMat = createMatteMaterial({
      color: 0x2a3345,
      roughness: 0.74,
      metalness: 0.18,
      envMapIntensity: 0.28,
    });
    this.ownedGeometries.push(scoutPadGeo);
    this.ownedMaterials.push(scoutPadMat);
    const scoutPads = new THREE.InstancedMesh(scoutPadGeo, scoutPadMat, 7);
    for (let s = 1; s < 8; s += 1) {
      const origin = getSeatWorldOrigin(s);
      this.tempMatrix.makeTranslation(origin.x, -0.20, origin.z + 0.6);
      scoutPads.setMatrixAt(s - 1, this.tempMatrix);
    }
    scoutPads.instanceMatrix.needsUpdate = true;
    this.scoutPadsMesh = scoutPads;
    this.root.add(scoutPads);

    const bezelGeo = createPointyHexRingGeometry(HEX_RADIUS * 0.965, HEX_RADIUS * 0.902, 0.018);
    const deployRingGeo = createPointyHexRingGeometry(HEX_RADIUS * 0.955, HEX_RADIUS * 0.875, 0.014);
    const plateGeo = createChamferedHexTileGeometry(HEX_RADIUS * 0.892, 0.036);
    this.deployFlowMat = createDeployHexFlowShader();
    this.ownedGeometries.push(bezelGeo, deployRingGeo, plateGeo);
    this.ownedMaterials.push(this.deployFlowMat);
    this.animatedShaderMats.push(this.deployFlowMat);

    this.hexBezelInstanced = new THREE.InstancedMesh(bezelGeo, materials.hexBezelGoldMat, TOTAL_HEXES);
    this.deployBezelInstanced = new THREE.InstancedMesh(
      deployRingGeo,
      this.deployFlowMat,
      PLAYER_DEPLOY_ROWS * BOARD_COLS,
    );
    this.hexPlateInstanced = new THREE.InstancedMesh(
      plateGeo,
      this.themeHexTileMats[initialTheme],
      TOTAL_HEXES,
    );

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const idx = row * BOARD_COLS + col;
        this.hexHoverSprings.push(new SpringDamper(0, 28, 0.68));
        this.writeHexInstanceTransform(idx, row, col, 0);
      }
    }
    this.root.add(this.hexPlateInstanced, this.hexBezelInstanced, this.deployBezelInstanced);

    const hoverRingGeo = createPointyHexRingGeometry(HEX_RADIUS * 0.88, HEX_RADIUS * 0.77, 0.014);
    const hoverRingMat = materials.createBloomEmissiveMaterial(0x52c8f5, 0.92);
    hoverRingMat.transparent = true;
    hoverRingMat.opacity = 0.86;
    this.ownedGeometries.push(hoverRingGeo);
    this.hoverFresnelRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    this.hoverFresnelRing.visible = false;
    this.root.add(this.hoverFresnelRing);
    this.sharedBloomTargets.push(this.hoverFresnelRing);

    const emptyLineGeo = new THREE.BufferGeometry();
    emptyLineGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0xe6be72,
      dashSize: 0.22,
      gapSize: 0.13,
      transparent: true,
      opacity: 0.90,
    });
    this.ownedGeometries.push(emptyLineGeo);
    this.ownedMaterials.push(dashedMat);
    this.rangeDashedLines = new THREE.LineSegments(emptyLineGeo, dashedMat);
    this.rangeDashedLines.visible = false;
    this.root.add(this.rangeDashedLines);

    this.swapArcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(1, 0.2, 0),
    );
    const arcTubeGeo = new THREE.TubeGeometry(this.swapArcCurve, 20, 0.036, 6, false);
    const arrowGeo = new THREE.ConeGeometry(0.11, 0.28, 6);
    const swapMat = materials.createBloomEmissiveMaterial(0xe8be72, 0.94);
    this.ownedGeometries.push(arcTubeGeo, arrowGeo);

    this.swapArcMesh = new THREE.Mesh(arcTubeGeo, swapMat);
    this.swapArrowStart = new THREE.Mesh(arrowGeo, swapMat);
    this.swapArrowEnd = new THREE.Mesh(arrowGeo, swapMat);
    this.swapArcGroup.add(this.swapArcMesh, this.swapArrowStart, this.swapArrowEnd);
    this.swapArcGroup.visible = false;
    this.root.add(this.swapArcGroup);
    this.sharedBloomTargets.push(this.swapArcMesh, this.swapArrowStart, this.swapArrowEnd);

    const benchPadGeo = createChamferedBenchPadGeometry();
    const clawGeo = new THREE.BoxGeometry(0.10, 0.08, 0.18);
    const slotRingGeo = new THREE.TorusGeometry(0.49, 0.028, 6, 18);
    slotRingGeo.rotateX(Math.PI * 0.5);
    const benchArcGeo = new THREE.RingGeometry(0.515, 0.585, 24);
    benchArcGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(benchPadGeo, clawGeo, slotRingGeo, benchArcGeo);

    const benchPadMat = createMatteMaterial({
      color: 0xc8d2e2,
      map: materials.benchPlateMaps.albedoMap,
      normalMap: materials.benchPlateMaps.normalMap,
      roughnessMap: materials.benchPlateMaps.roughnessMap,
      normalScale: 0.76,
      roughness: 0.62,
      metalness: 0.34,
      envMapIntensity: 0.38,
    });
    const benchClawMat = createMatteMaterial({
      color: 0xc9a86c,
      roughness: 0.54,
      metalness: 0.54,
      envMapIntensity: 0.40,
    });
    const benchRingMat = createMatteMaterial({
      color: 0xffffff,
      roughness: 0.52,
      metalness: 0.48,
      envMapIntensity: 0.36,
      emissive: 0x6b5326,
      emissiveIntensity: 0.30,
    });
    this.benchArcMat = createBenchArcGlowShader();
    const benchNumMat = new THREE.MeshBasicMaterial({
      map: materials.benchSlotNumberAtlas,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    this.ownedMaterials.push(benchPadMat, benchClawMat, benchRingMat, this.benchArcMat, benchNumMat);
    this.animatedShaderMats.push(this.benchArcMat);

    const benchPads = new THREE.InstancedMesh(benchPadGeo, benchPadMat, BENCH_SLOTS);
    const clawsInstanced = new THREE.InstancedMesh(clawGeo, benchClawMat, BENCH_SLOTS * 4);
    this.benchRingsInstanced = new THREE.InstancedMesh(slotRingGeo, benchRingMat, BENCH_SLOTS);
    this.benchArcInstanced = new THREE.InstancedMesh(benchArcGeo, this.benchArcMat, BENCH_SLOTS);

    const numeralParts: THREE.BufferGeometry[] = [];
    let clawIdx = 0;
    const cornerOffsets: readonly [number, number][] = [
      [-0.50, -0.50],
      [0.50, -0.50],
      [-0.50, 0.50],
      [0.50, 0.50],
    ];

    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const center = benchSlotToStageXZ(slot);
      this.tempMatrix.makeTranslation(center.x, 0.025, center.z);
      benchPads.setMatrixAt(slot, this.tempMatrix);

      for (const [ox, oz] of cornerOffsets) {
        this.tempPos.set(center.x + ox, 0.06, center.z + oz);
        this.tempQuat.setFromAxisAngle(this.tempYAxis, Math.atan2(ox, oz));
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        clawsInstanced.setMatrixAt(clawIdx, this.tempMatrix);
        clawIdx += 1;
      }

      this.tempMatrix.makeTranslation(center.x, 0.056, center.z);
      this.benchRingsInstanced.setMatrixAt(slot, this.tempMatrix);
      this.tempMatrix.makeTranslation(center.x, 0.062, center.z);
      this.benchArcInstanced.setMatrixAt(slot, this.tempMatrix);
      const slotColHex =
        slot === CRYO_BENCH_SLOT ? 0x67d4ea : this.themeBenchRingColors[initialTheme];
      this.tempColor.setHex(slotColHex);
      this.benchRingsInstanced.setColorAt(slot, this.tempColor);
      this.benchArcInstanced.setColorAt(slot, this.tempColor);
      this.benchDepressSprings.push(new SpringDamper(0, 26, 0.72));

      const numPlate = new THREE.PlaneGeometry(0.54, 0.26);
      numPlate.rotateX(-Math.PI * 0.5);
      const uvAttr = numPlate.getAttribute('uv');
      const u0 = slot / BENCH_SLOTS;
      const u1 = (slot + 1) / BENCH_SLOTS;
      for (let k = 0; k < uvAttr.count; k += 1) {
        const rawU = uvAttr.getX(k);
        uvAttr.setX(k, u0 + rawU * (u1 - u0));
      }
      numeralParts.push(
        normalizeArenaGeometryForMerge(
          numPlate,
          new THREE.Matrix4().makeTranslation(center.x, 0.068, center.z + 0.72),
        ),
      );
      numPlate.dispose();
    }
    const mergedNumeralsGeo = mergeGeometries(numeralParts, false)!;
    for (const np of numeralParts) np.dispose();
    this.ownedGeometries.push(mergedNumeralsGeo);
    const benchNumeralsMesh = new THREE.Mesh(mergedNumeralsGeo, benchNumMat);

    benchPads.instanceMatrix.needsUpdate = true;
    clawsInstanced.instanceMatrix.needsUpdate = true;
    this.benchRingsInstanced.instanceMatrix.needsUpdate = true;
    this.benchArcInstanced.instanceMatrix.needsUpdate = true;
    if (this.benchRingsInstanced.instanceColor) {
      this.benchRingsInstanced.instanceColor.needsUpdate = true;
    }
    if (this.benchArcInstanced.instanceColor) {
      this.benchArcInstanced.instanceColor.needsUpdate = true;
    }
    this.root.add(
      benchPads,
      clawsInstanced,
      this.benchRingsInstanced,
      this.benchArcInstanced,
      benchNumeralsMesh,
    );

    const slot8Pos = benchSlotToStageXZ(CRYO_BENCH_SLOT);
    const canopyGeo = new THREE.CylinderGeometry(0.56, 0.62, 0.68, 12, 1, false, 0, Math.PI);
    canopyGeo.rotateZ(Math.PI * 0.5);
    canopyGeo.rotateY(Math.PI * 0.5);
    const lampGeo = new THREE.BoxGeometry(0.76, 0.04, 0.08);
    this.ownedGeometries.push(canopyGeo, lampGeo);

    const cryoCanopyMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0xa6e8fa),
      roughness: 0.24,
      metalness: 0.06,
      envMapIntensity: 0.48,
      clearcoat: 0.85,
      clearcoatRoughness: 0.14,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      emissive: new THREE.Color(0x38bdf8),
      emissiveIntensity: 0.26,
    });
    this.ownedMaterials.push(cryoCanopyMat);
    this.cryoCanopyMesh = new THREE.Mesh(canopyGeo, cryoCanopyMat);
    this.cryoCanopyMesh.position.set(slot8Pos.x, 0.14, slot8Pos.z + 0.52);
    this.cryoLampMat = materials.createBloomEmissiveMaterial(0x45b9e8, 0.58);
    const cryoLamp = new THREE.Mesh(lampGeo, this.cryoLampMat);
    cryoLamp.position.set(slot8Pos.x, 0.07, slot8Pos.z + 0.64);
    this.root.add(this.cryoCanopyMesh, cryoLamp);
    this.sharedBloomTargets.push(cryoLamp);

    const podHousingGeo = new THREE.CylinderGeometry(0.30, 0.42, 0.18, 6);
    const podCrystalGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.34, 6);
    const podCollarGeo = new THREE.TorusGeometry(0.28, 0.035, 6, 6);
    podCollarGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(podHousingGeo, podCrystalGeo, podCollarGeo);

    const podBaseMat = createMatteMaterial({
      color: 0x3b4252,
      roughness: 0.66,
      metalness: 0.30,
      envMapIntensity: 0.32,
    });
    const podCollarMat = createMatteMaterial({
      color: 0xc9a565,
      roughness: 0.56,
      metalness: 0.48,
      envMapIntensity: 0.36,
    });
    this.ownedMaterials.push(podBaseMat, podCollarMat);

    const totalPods = INTEREST_POD_TIERS * 2;
    const basesInstanced = new THREE.InstancedMesh(podHousingGeo, podBaseMat, totalPods);
    this.interestCollarsInstanced = new THREE.InstancedMesh(podCollarGeo, podCollarMat, totalPods);

    const zSegments = [3.6, 1.8, 0.0, -1.8, -3.6];
    const sides = [-7.32, 7.32];

    this.interestActiveAttr = new THREE.InstancedBufferAttribute(new Float32Array(totalPods), 1);
    podCrystalGeo.setAttribute('aActive', this.interestActiveAttr);
    this.interestCrystalMat = createCrystalPodShader();
    this.ownedMaterials.push(this.interestCrystalMat);
    const interestCoresInstanced = new THREE.InstancedMesh(
      podCrystalGeo,
      this.interestCrystalMat,
      totalPods,
    );
    let cIdx = 0;
    for (const sideX of sides) {
      for (let tier = 0; tier < INTEREST_POD_TIERS; tier += 1) {
        this.tempMatrix.makeTranslation(sideX, 0.29, zSegments[tier]!);
        interestCoresInstanced.setMatrixAt(cIdx, this.tempMatrix);
        cIdx += 1;
      }
    }
    interestCoresInstanced.instanceMatrix.needsUpdate = true;
    this.root.add(interestCoresInstanced);

    let pIdx = 0;
    for (const sideX of sides) {
      for (let tier = 0; tier < INTEREST_POD_TIERS; tier += 1) {
        const pz = zSegments[tier]!;
        this.interestPodCoords.push({ x: sideX, z: pz, tier });
        this.interestLiftSprings.push(new SpringDamper(0, 20, 0.76));

        this.tempMatrix.makeTranslation(sideX, 0.08, pz);
        basesInstanced.setMatrixAt(pIdx, this.tempMatrix);

        this.tempMatrix.makeTranslation(sideX, 0.22, pz);
        this.interestCollarsInstanced.setMatrixAt(pIdx, this.tempMatrix);
        pIdx += 1;
      }
    }
    basesInstanced.instanceMatrix.needsUpdate = true;
    this.interestCollarsInstanced.instanceMatrix.needsUpdate = true;
    this.root.add(basesInstanced, this.interestCollarsInstanced);

    this.conduitShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uSweep: { value: 1.5 },
        uTime: { value: 0 },
        uBaseColor: { value: new THREE.Color(0x63b7e0) },
        uPulseColor: { value: new THREE.Color(0xe6be72) },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSweep;
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        varying vec2 vUv;
        void main() {
          float dist = abs(vUv.y - uSweep);
          float pulse = smoothstep(0.24, 0.0, dist);
          float baseBreath = 0.24 + 0.08 * sin(uTime * 2.2 + vUv.y * 6.0);
          vec3 col = mix(uBaseColor * baseBreath, uPulseColor * 0.96, pulse);
          gl_FragColor = vec4(col, 0.74);
        }
      `,
    });
    this.ownedMaterials.push(this.conduitShaderMat);

    const conduitGeo = new THREE.PlaneGeometry(0.14, 13.4);
    conduitGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(conduitGeo);
    const conduitsInstanced = new THREE.InstancedMesh(conduitGeo, this.conduitShaderMat, 2);
    this.tempMatrix.makeTranslation(-6.58, 0.018, 0.45);
    conduitsInstanced.setMatrixAt(0, this.tempMatrix);
    this.tempMatrix.makeTranslation(6.58, 0.018, 0.45);
    conduitsInstanced.setMatrixAt(1, this.tempMatrix);
    conduitsInstanced.instanceMatrix.needsUpdate = true;
    this.root.add(conduitsInstanced);

    const aoParts: THREE.BufferGeometry[] = [];
    const podShadowRaw = new THREE.PlaneGeometry(1.18, 1.18);
    podShadowRaw.rotateX(-Math.PI * 0.5);
    for (const coord of this.interestPodCoords) {
      aoParts.push(
        normalizeArenaGeometryForMerge(
          podShadowRaw,
          new THREE.Matrix4().makeTranslation(coord.x, 0.008, coord.z),
        ),
      );
    }
    podShadowRaw.dispose();
    const benchShadowRaw = new THREE.PlaneGeometry(14.8, 2.35);
    benchShadowRaw.rotateX(-Math.PI * 0.5);
    aoParts.push(
      normalizeArenaGeometryForMerge(
        benchShadowRaw,
        new THREE.Matrix4().makeTranslation(0, 0.004, BENCH_Z_OFFSET + 0.05),
      ),
    );
    benchShadowRaw.dispose();
    const mergedBoardAoGeo = mergeGeometries(aoParts, false)!;
    for (const ap of aoParts) ap.dispose();
    this.ownedGeometries.push(mergedBoardAoGeo);
    this.root.add(new THREE.Mesh(mergedBoardAoGeo, materials.contactShadowMat));

    this.themeRoots = {
      orbital_elevator_port: this.buildOrbitalElevatorTheme(skyportMaps),
      mercury_dyson_forge: this.buildMercuryDysonTheme(dysonMaps),
      event_horizon_observatory: this.buildEventHorizonTheme(horizonMaps),
    };
    this.root.add(
      this.themeRoots.orbital_elevator_port,
      this.themeRoots.mercury_dyson_forge,
      this.themeRoots.event_horizon_observatory,
    );

    disposeUnusedArenaGeos(
      this.root,
      this.ownedGeometries,
      new Set<THREE.BufferGeometry>([this.rangeDashedLines.geometry, this.swapArcMesh.geometry]),
    );

    this.setTheme(initialTheme);
  }

  private createThemeDeckTextures(theme: ArenaThemeId): {
    albedo: THREE.DataTexture;
    normal: THREE.DataTexture;
    roughness: THREE.DataTexture;
  } {
    const raw = getOrBakeDeckBuffers(theme);
    const albedo = makeDataTexture(raw.albedo, raw.size, true, 1, 1);
    const normal = makeDataTexture(raw.normal, raw.size, false, 1, 1);
    const roughness = makeDataTexture(raw.roughness, raw.size, false, 1, 1);
    this.ownedTextures.push(albedo, normal, roughness);
    return { albedo, normal, roughness };
  }

  private buildOrbitalElevatorTheme(maps: {
    albedo: THREE.DataTexture;
    normal: THREE.DataTexture;
    roughness: THREE.DataTexture;
  }): THREE.Group {
    const g = new THREE.Group();
    const bloom = this.themeBloomTargets.orbital_elevator_port;

    const marbleDeckMat = createMatteMaterial({
      color: 0xf8f6f0,
      map: maps.albedo,
      normalMap: maps.normal,
      roughnessMap: maps.roughness,
      normalScale: 0.78,
      roughness: 0.58,
      metalness: 0.08,
      envMapIntensity: 0.50,
    });
    const porcelainMat = createMatteMaterial({
      color: 0xf7f8fc,
      roughness: 0.54,
      metalness: 0.08,
      envMapIntensity: 0.48,
    });
    const seaBlueMat = createMatteMaterial({
      color: 0x2b84d6,
      roughness: 0.54,
      metalness: 0.18,
      envMapIntensity: 0.52,
    });
    const champagneMat = createMatteMaterial({
      color: 0xe8be66,
      roughness: 0.38,
      metalness: 0.66,
      envMapIntensity: 0.68,
    });
    const canopyTintMat = createMatteMaterial({
      color: 0x1e74c6,
      roughness: 0.46,
      metalness: 0.28,
      envMapIntensity: 0.58,
    });
    const skyLightMat = createMatteMaterial({
      color: 0x66e2ff,
      roughness: 0.44,
      metalness: 0.06,
      envMapIntensity: 0.40,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.05,
    });
    const warmEngineMat = createMatteMaterial({
      color: 0xffd578,
      roughness: 0.46,
      metalness: 0.10,
      envMapIntensity: 0.40,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.05,
    });
    this.ownedMaterials.push(
      marbleDeckMat,
      porcelainMat,
      seaBlueMat,
      champagneMat,
      canopyTintMat,
      skyLightMat,
      warmEngineMat,
    );

    const deckShape = createRoundedRectShape(15.6, 15.8, 2.35);
    const deckGeo = new THREE.ExtrudeGeometry(deckShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.10,
      bevelSize: 0.14,
      bevelSegments: 4,
    });
    deckGeo.rotateX(Math.PI * 0.5);
    normalizeExtrudedPlanarUvs(deckGeo, 16.0, 16.2);
    this.ownedGeometries.push(deckGeo);

    const deckMesh = new THREE.Mesh(deckGeo, marbleDeckMat);
    deckMesh.position.set(0, -0.144, 0.80);
    g.add(deckMesh);

    const hullShape = createRoundedRectShape(16.4, 16.5, 2.75);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.14,
      bevelSize: 0.20,
      bevelSegments: 4,
    });
    hullGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(hullGeo);
    const hullMesh = new THREE.Mesh(hullGeo, porcelainMat);
    hullMesh.position.set(0, -0.44, 0.80);
    g.add(hullMesh);

    const trimRingShape = createRoundedRectShape(16.1, 16.2, 2.55);
    const trimHole = createRoundedRectShape(15.5, 15.6, 2.25);
    trimRingShape.holes.push(trimHole);
    const trimGeo = new THREE.ExtrudeGeometry(trimRingShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    trimGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(trimGeo);
    const trimMesh = new THREE.Mesh(trimGeo, champagneMat);
    trimMesh.position.set(0, -0.08, 0.80);
    g.add(trimMesh);

    const benchPlinthGeo = subdivideSmooth(new THREE.BoxGeometry(14.1, 0.24, 1.72, 4, 1, 2), 1);
    this.ownedGeometries.push(benchPlinthGeo);
    const benchPlinth = new THREE.Mesh(benchPlinthGeo, porcelainMat);
    benchPlinth.position.set(0, -0.12, BENCH_Z_OFFSET);
    g.add(benchPlinth);

    const arcadeRibCage = new THREE.BoxGeometry(0.42, 0.86, 0.52, 2, 2, 2);
    const arcadeRibGeo = subdivideSmooth(arcadeRibCage, 1);
    const arcadeCurveWest = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.05, 0.42, -5.6),
      new THREE.Vector3(-8.22, 0.56, -2.4),
      new THREE.Vector3(-8.25, 0.54, 1.4),
      new THREE.Vector3(-8.12, 0.44, 5.2),
      new THREE.Vector3(-7.75, 0.34, 7.3),
    ]);
    const arcadeRailWestGeo = new THREE.TubeGeometry(arcadeCurveWest, 36, 0.13, 10, false);
    const arcadeLightWestGeo = new THREE.TubeGeometry(arcadeCurveWest, 32, 0.045, 8, false);
    const arcadeCurveEast = new THREE.CatmullRomCurve3([
      new THREE.Vector3(8.05, 0.42, -5.6),
      new THREE.Vector3(8.22, 0.56, -2.4),
      new THREE.Vector3(8.25, 0.54, 1.4),
      new THREE.Vector3(8.12, 0.44, 5.2),
      new THREE.Vector3(7.75, 0.34, 7.3),
    ]);
    const arcadeRailEastGeo = new THREE.TubeGeometry(arcadeCurveEast, 36, 0.13, 10, false);
    const arcadeLightEastGeo = new THREE.TubeGeometry(arcadeCurveEast, 32, 0.045, 8, false);
    const northGalleryCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.55, 0.40, -6.75),
      new THREE.Vector3(-4.2, 0.56, -7.28),
      new THREE.Vector3(0, 0.62, -7.42),
      new THREE.Vector3(4.2, 0.56, -7.28),
      new THREE.Vector3(7.55, 0.40, -6.75),
    ]);
    const northGalleryGeo = new THREE.TubeGeometry(northGalleryCurve, 36, 0.16, 10, false);
    this.ownedGeometries.push(
      arcadeRibGeo,
      arcadeRailWestGeo,
      arcadeLightWestGeo,
      arcadeRailEastGeo,
      arcadeLightEastGeo,
      northGalleryGeo,
    );

    g.add(
      new THREE.Mesh(arcadeRailWestGeo, porcelainMat),
      new THREE.Mesh(arcadeRailEastGeo, porcelainMat),
      new THREE.Mesh(northGalleryGeo, porcelainMat),
    );
    const glowWest = new THREE.Mesh(arcadeLightWestGeo, skyLightMat);
    glowWest.position.y = -0.14;
    const glowEast = new THREE.Mesh(arcadeLightEastGeo, skyLightMat);
    glowEast.position.y = -0.14;
    g.add(glowWest, glowEast);
    bloom.push(glowWest, glowEast);

    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i += 1) {
        const z = -5.2 + i * 2.35;
        const rib = new THREE.Mesh(arcadeRibGeo, porcelainMat);
        rib.position.set(side * 8.12, 0.16, z);
        rib.rotation.z = side * 0.16;
        g.add(rib);
      }
    }

    const twinArchOuter = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-8.4, -2.2, -8.3),
      new THREE.Vector3(-6.2, 0.45, -8.8),
      new THREE.Vector3(-2.6, 1.55, -9.2),
      new THREE.Vector3(0, 1.78, -9.35),
      new THREE.Vector3(2.6, 1.55, -9.2),
      new THREE.Vector3(6.2, 0.45, -8.8),
      new THREE.Vector3(8.4, -2.2, -8.3),
    ]);
    const twinArchInner = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7.7, -2.2, -8.6),
      new THREE.Vector3(-5.6, 0.15, -9.15),
      new THREE.Vector3(-2.3, 1.15, -9.55),
      new THREE.Vector3(0, 1.36, -9.7),
      new THREE.Vector3(2.3, 1.15, -9.55),
      new THREE.Vector3(5.6, 0.15, -9.15),
      new THREE.Vector3(7.7, -2.2, -8.6),
    ]);
    const archTrackAGeo = new THREE.TubeGeometry(twinArchOuter, 48, 0.24, 12, false);
    const archTrackBGeo = new THREE.TubeGeometry(twinArchInner, 48, 0.18, 10, false);
    const archCoveGeo = new THREE.TubeGeometry(twinArchInner, 44, 0.055, 8, false);
    const strutGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.68, 8);
    this.ownedGeometries.push(archTrackAGeo, archTrackBGeo, archCoveGeo, strutGeo);

    g.add(
      new THREE.Mesh(archTrackAGeo, porcelainMat),
      new THREE.Mesh(archTrackBGeo, seaBlueMat),
    );
    const archCove = new THREE.Mesh(archCoveGeo, skyLightMat);
    archCove.position.y = -0.14;
    g.add(archCove);
    bloom.push(archCove);

    const cableGeo = new THREE.CylinderGeometry(0.022, 0.022, 1.0, 6);
    const archSpineFinGeo = new THREE.BoxGeometry(0.08, 0.34, 0.56);
    const beaconPedestalGeo = new THREE.CylinderGeometry(0.14, 0.19, 0.22, 6);
    const beaconCapGeo = new THREE.TorusGeometry(0.145, 0.022, 6, 12);
    beaconCapGeo.rotateX(Math.PI * 0.5);
    const beaconOpticGeo = new THREE.SphereGeometry(0.068, 8, 6);
    this.ownedGeometries.push(
      cableGeo,
      archSpineFinGeo,
      beaconPedestalGeo,
      beaconCapGeo,
      beaconOpticGeo,
    );

    for (let i = 1; i <= 11; i += 1) {
      const t = i / 12;
      const pA = twinArchOuter.getPoint(t);
      const pB = twinArchInner.getPoint(t);
      const mid = pA.clone().add(pB).multiplyScalar(0.5);
      const dir = pB.clone().sub(pA);
      const strut = new THREE.Mesh(strutGeo, champagneMat);
      strut.position.copy(mid);
      strut.scale.y = dir.length() / 0.68;
      strut.quaternion.setFromUnitVectors(this.tempYAxis, dir.normalize());
      g.add(strut);

      if (i % 2 === 1) {
        const fin = new THREE.Mesh(archSpineFinGeo, seaBlueMat);
        fin.position.copy(pA).add(new THREE.Vector3(0, 0.22, 0));
        fin.lookAt(twinArchOuter.getPoint(Math.min(0.99, t + 0.04)));
        g.add(fin);
      }
      if (i < 11) {
        const pNextB = twinArchInner.getPoint((i + 1) / 12);
        const diagDir = pNextB.clone().sub(pA);
        const diagCable = new THREE.Mesh(cableGeo, champagneMat);
        diagCable.position.copy(pA).add(pNextB).multiplyScalar(0.5);
        diagCable.scale.y = diagDir.length();
        diagCable.quaternion.setFromUnitVectors(this.tempYAxis, diagDir.normalize());
        g.add(diagCable);
      }
    }

    for (const side of [-1, 1]) {
      const stayTop = new THREE.Vector3(side * 6.5, 1.38, -8.35);
      const stayAnchorA = new THREE.Vector3(side * 7.85, 0.24, -6.45);
      const stayAnchorB = new THREE.Vector3(side * 4.45, 0.26, -7.25);
      for (const anchor of [stayAnchorA, stayAnchorB]) {
        const dVec = anchor.clone().sub(stayTop);
        const stay = new THREE.Mesh(cableGeo, champagneMat);
        stay.position.copy(stayTop).add(anchor).multiplyScalar(0.5);
        stay.scale.y = dVec.length();
        stay.quaternion.setFromUnitVectors(this.tempYAxis, dVec.normalize());
        g.add(stay);
      }
    }

    const beaconSpots: readonly [number, number, number, boolean][] = [
      [-7.72, 0.08, -6.52, true],
      [7.72, 0.08, -6.52, true],
      [-7.98, 0.12, -3.55, false],
      [7.98, 0.12, -3.55, false],
      [-8.06, 0.12, 0.45, true],
      [8.06, 0.12, 0.45, true],
      [-7.92, 0.12, 4.45, false],
      [7.92, 0.12, 4.45, false],
      [-7.22, 0.06, 7.62, true],
      [7.22, 0.06, 7.62, true],
      [-3.45, 0.06, 8.28, false],
      [3.45, 0.06, 8.28, false],
    ];
    for (const [bx, by, bz, isCyan] of beaconSpots) {
      const ped = new THREE.Mesh(beaconPedestalGeo, seaBlueMat);
      ped.position.set(bx, by, bz);
      const cap = new THREE.Mesh(beaconCapGeo, champagneMat);
      cap.position.set(bx, by + 0.10, bz);
      const optic = new THREE.Mesh(beaconOpticGeo, isCyan ? skyLightMat : warmEngineMat);
      optic.position.set(bx, by + 0.16, bz);
      g.add(ped, cap, optic);
      bloom.push(optic);
    }

    const pylonBodyGeo = subdivideSmooth(new THREE.CylinderGeometry(0.44, 0.72, 4.4, 8, 3), 1);
    const pylonFinGeo = subdivideSmooth(new THREE.BoxGeometry(0.24, 2.8, 1.15, 2, 3, 2), 1);
    const pylonCollarGeo = new THREE.TorusGeometry(0.62, 0.075, 10, 24);
    pylonCollarGeo.rotateX(Math.PI * 0.5);
    const pillarRingGeo = new THREE.TorusGeometry(1.15, 0.10, 10, 32);
    pillarRingGeo.rotateX(Math.PI * 0.5);
    const beamGeo = new THREE.CylinderGeometry(0.72, 0.92, 9.2, 24, 1, true);
    const beamMat = createVerticalLightPillarShader();
    this.ownedGeometries.push(pylonBodyGeo, pylonFinGeo, pylonCollarGeo, pillarRingGeo, beamGeo);
    this.ownedMaterials.push(beamMat);
    this.animatedShaderMats.push(beamMat);

    for (const side of [-1, 1]) {
      const pylon = new THREE.Group();
      pylon.position.set(side * 6.5, -0.55, -8.35);
      pylon.add(new THREE.Mesh(pylonBodyGeo, porcelainMat));
      const fin = new THREE.Mesh(pylonFinGeo, seaBlueMat);
      fin.position.set(side * 0.42, -0.15, 0);
      const collarA = new THREE.Mesh(pylonCollarGeo, champagneMat);
      collarA.position.y = 0.72;
      const collarB = new THREE.Mesh(pylonCollarGeo, skyLightMat);
      collarB.scale.setScalar(0.84);
      collarB.position.y = 1.28;
      pylon.add(fin, collarA, collarB);
      bloom.push(collarB);
      g.add(pylon);
    }

    const elevatorCore = new THREE.Group();
    elevatorCore.position.set(0, -0.8, -9.95);
    const baseRing = new THREE.Mesh(pillarRingGeo, porcelainMat);
    baseRing.position.y = -0.85;
    const goldRing = new THREE.Mesh(pillarRingGeo, champagneMat);
    goldRing.scale.setScalar(0.84);
    goldRing.position.y = -0.58;
    const lightBeam = new THREE.Mesh(beamGeo, beamMat);
    lightBeam.position.y = 1.65;
    elevatorCore.add(baseRing, goldRing, lightBeam);
    g.add(elevatorCore);

    const bridgeSpanGeo = subdivideSmooth(new THREE.BoxGeometry(2.65, 0.24, 1.38, 3, 1, 2), 1);
    const padDiskGeo = new THREE.CylinderGeometry(1.52, 1.24, 0.34, 24);
    const padTrimGeo = new THREE.TorusGeometry(1.54, 0.065, 10, 32);
    padTrimGeo.rotateX(Math.PI * 0.5);
    const domeBaseGeo = new THREE.CylinderGeometry(0.96, 1.10, 0.52, 16);
    const domeCapGeo = new THREE.SphereGeometry(0.95, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.54);
    const domeRibGeo = new THREE.TorusGeometry(0.97, 0.032, 6, 20, Math.PI);
    const scannerRingGeo = new THREE.TorusGeometry(1.22, 0.042, 8, 28);
    scannerRingGeo.rotateX(Math.PI * 0.5);
    const mastGeo = new THREE.CylinderGeometry(0.035, 0.065, 1.15, 8);
    const beaconGeo = new THREE.OctahedronGeometry(0.14, 1);
    this.ownedGeometries.push(
      bridgeSpanGeo,
      padDiskGeo,
      padTrimGeo,
      domeBaseGeo,
      domeCapGeo,
      domeRibGeo,
      scannerRingGeo,
      mastGeo,
      beaconGeo,
    );

    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 10.25, -0.05, -1.65);

      const bridge = new THREE.Mesh(bridgeSpanGeo, porcelainMat);
      bridge.position.set(-side * 1.45, -0.05, 0);
      const pad = new THREE.Mesh(padDiskGeo, porcelainMat);
      pad.position.set(0.1 * side, -0.14, 0);
      const padTrim = new THREE.Mesh(padTrimGeo, champagneMat);
      padTrim.position.set(0.1 * side, 0.03, 0);

      const domeBase = new THREE.Mesh(domeBaseGeo, seaBlueMat);
      domeBase.position.set(0.1 * side, 0.28, 0);
      const domeCap = new THREE.Mesh(domeCapGeo, porcelainMat);
      domeCap.position.set(0.1 * side, 0.52, 0);
      for (let r = 0; r < 3; r += 1) {
        const rib = new THREE.Mesh(domeRibGeo, champagneMat);
        rib.position.set(0.1 * side, 0.52, 0);
        rib.rotation.y = (r * Math.PI) / 3;
        wing.add(rib);
      }

      this.radarScanners.push({
        x: side * 10.35,
        y: 0.57,
        z: -1.65,
        speed: side < 0 ? 0.52 : -0.46,
      });

      const mast = new THREE.Mesh(mastGeo, champagneMat);
      mast.position.set(0.1 * side, 1.56, 0);
      const topBeacon = new THREE.Mesh(beaconGeo, skyLightMat);
      topBeacon.position.set(0.1 * side, 2.18, 0);
      bloom.push(topBeacon);

      wing.add(bridge, pad, padTrim, domeBase, domeCap, mast, topBeacon);
      g.add(wing);

      const southWing = new THREE.Group();
      southWing.position.set(side * 9.85, -0.12, 3.35);
      const sBridge = new THREE.Mesh(bridgeSpanGeo, porcelainMat);
      sBridge.scale.set(0.84, 0.9, 0.78);
      sBridge.position.set(-side * 1.15, 0, 0);
      const sPad = new THREE.Mesh(padDiskGeo, porcelainMat);
      sPad.scale.set(0.76, 0.85, 0.76);
      const sTrim = new THREE.Mesh(padTrimGeo, seaBlueMat);
      sTrim.scale.setScalar(0.76);
      sTrim.position.y = 0.14;
      const sBollard = new THREE.Mesh(domeBaseGeo, porcelainMat);
      sBollard.scale.set(0.36, 1.05, 0.36);
      sBollard.position.y = 0.36;
      const sLamp = new THREE.Mesh(beaconGeo, skyLightMat);
      sLamp.position.y = 0.76;
      bloom.push(sLamp);
      southWing.add(sBridge, sPad, sTrim, sBollard, sLamp);
      g.add(southWing);
    }

    const hullBase = new THREE.BoxGeometry(0.46, 0.32, 1.48, 2, 2, 3);
    const shuttleHullGeo = subdivideSmooth(hullBase, 1);
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0.34);
    wingShape.lineTo(0.88, -0.18);
    wingShape.lineTo(0.82, -0.36);
    wingShape.lineTo(0, -0.10);
    wingShape.lineTo(-0.82, -0.36);
    wingShape.lineTo(-0.88, -0.18);
    wingShape.closePath();
    const shuttleWingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    shuttleWingGeo.rotateX(Math.PI * 0.5);
    const cockpitGeo = subdivideSmooth(new THREE.BoxGeometry(0.28, 0.18, 0.56, 2, 1, 2), 1);
    const tailFinGeo = new THREE.BoxGeometry(0.06, 0.32, 0.42);
    const enginePodGeo = new THREE.CylinderGeometry(0.075, 0.095, 0.36, 10);
    enginePodGeo.rotateX(Math.PI * 0.5);
    const engineGlowGeo = new THREE.SphereGeometry(0.075, 10, 8);
    this.ownedGeometries.push(
      shuttleHullGeo,
      shuttleWingGeo,
      cockpitGeo,
      tailFinGeo,
      enginePodGeo,
      engineGlowGeo,
    );

    const shuttleSpecs: readonly {
      phase: number;
      radiusX: number;
      radiusZ: number;
      centerZ: number;
      baseY: number;
      speed: number;
    }[] = [
      { phase: 0.2, radiusX: 9.2, radiusZ: 2.4, centerZ: -8.2, baseY: 0.55, speed: 0.24 },
      { phase: 2.3, radiusX: 10.6, radiusZ: 3.1, centerZ: -7.6, baseY: 0.95, speed: 0.19 },
      { phase: 4.4, radiusX: 8.4, radiusZ: 2.0, centerZ: -9.0, baseY: 0.18, speed: 0.28 },
    ];
    const scannerDishBaked = normalizeArenaGeometryForMerge(
      beaconGeo,
      new THREE.Matrix4().makeTranslation(1.22, 0.06, 0),
    );
    this.ownedGeometries.push(scannerDishBaked);
    const scannerRingsInst = new THREE.InstancedMesh(
      scannerRingGeo,
      champagneMat,
      this.radarScanners.length,
    );
    const scannerDishesInst = new THREE.InstancedMesh(
      scannerDishBaked,
      skyLightMat,
      this.radarScanners.length,
    );
    scannerRingsInst.frustumCulled = false;
    scannerDishesInst.frustumCulled = false;
    for (let i = 0; i < this.radarScanners.length; i += 1) {
      const sc = this.radarScanners[i]!;
      this.tempMatrix.makeTranslation(sc.x, sc.y, sc.z);
      scannerRingsInst.setMatrixAt(i, this.tempMatrix);
      scannerDishesInst.setMatrixAt(i, this.tempMatrix);
    }
    scannerRingsInst.instanceMatrix.needsUpdate = true;
    scannerDishesInst.instanceMatrix.needsUpdate = true;
    this.radarScannerInstanced.push(scannerRingsInst, scannerDishesInst);
    g.add(scannerRingsInst, scannerDishesInst);

    const hullColPart = normalizeColoredGeometryForMerge(shuttleHullGeo, new THREE.Matrix4(), 0xeef2f6);
    const wingColPart = normalizeColoredGeometryForMerge(
      shuttleWingGeo,
      new THREE.Matrix4().makeTranslation(0, 0.02, -0.08),
      0x6ea2cc,
    );
    const canopyColPart = normalizeColoredGeometryForMerge(
      cockpitGeo,
      new THREE.Matrix4().makeTranslation(0, 0.14, 0.24),
      0x3f6e96,
    );
    const finPart = normalizeColoredGeometryForMerge(
      tailFinGeo,
      new THREE.Matrix4().makeTranslation(0, 0.22, -0.52),
      0xd4b57a,
    );
    const engLPart = normalizeColoredGeometryForMerge(
      enginePodGeo,
      new THREE.Matrix4().makeTranslation(-0.34, -0.02, -0.46),
      0xd4b57a,
    );
    const engRPart = normalizeColoredGeometryForMerge(
      enginePodGeo,
      new THREE.Matrix4().makeTranslation(0.34, -0.02, -0.46),
      0xd4b57a,
    );
    const shuttleCompositeGeo = mergeGeometries(
      [hullColPart, wingColPart, canopyColPart, finPart, engLPart, engRPart],
      false,
    )!;
    hullColPart.dispose();
    wingColPart.dispose();
    canopyColPart.dispose();
    finPart.dispose();
    engLPart.dispose();
    engRPart.dispose();

    const shuttleCompositeMat = createMatteMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.22,
      envMapIntensity: 0.36,
    });
    shuttleCompositeMat.vertexColors = true;
    this.ownedMaterials.push(shuttleCompositeMat);

    const glowLPart = normalizeArenaGeometryForMerge(
      engineGlowGeo,
      new THREE.Matrix4().makeTranslation(-0.34, -0.02, -0.66),
    );
    const glowRPart = normalizeArenaGeometryForMerge(
      engineGlowGeo,
      new THREE.Matrix4().makeTranslation(0.34, -0.02, -0.66),
    );
    const shuttleGlowGeo = mergeGeometries([glowLPart, glowRPart], false)!;
    glowLPart.dispose();
    glowRPart.dispose();
    this.ownedGeometries.push(shuttleCompositeGeo, shuttleGlowGeo);

    const shipCount = shuttleSpecs.length;
    const wakeStripRaw = new THREE.PlaneGeometry(0.18, 2.35, 1, 2);
    wakeStripRaw.rotateX(-Math.PI * 0.5);
    const wakeL = normalizeArenaGeometryForMerge(
      wakeStripRaw,
      new THREE.Matrix4().makeTranslation(-0.34, -0.02, -1.86),
    );
    const wakeR = normalizeArenaGeometryForMerge(
      wakeStripRaw,
      new THREE.Matrix4().makeTranslation(0.34, -0.02, -1.86),
    );
    wakeStripRaw.dispose();
    const shuttleWakeGeo = mergeGeometries([wakeL, wakeR], false)!;
    wakeL.dispose();
    wakeR.dispose();
    const shuttleWakeMat = createShuttleWakeShader();
    this.ownedGeometries.push(shuttleWakeGeo);
    this.ownedMaterials.push(shuttleWakeMat);
    this.animatedShaderMats.push(shuttleWakeMat);

    const shipBodyInst = new THREE.InstancedMesh(shuttleCompositeGeo, shuttleCompositeMat, shipCount);
    const shipGlowInst = new THREE.InstancedMesh(shuttleGlowGeo, warmEngineMat, shipCount);
    const shipWakeInst = new THREE.InstancedMesh(shuttleWakeGeo, shuttleWakeMat, shipCount);
    const shipMeshes = [shipBodyInst, shipGlowInst, shipWakeInst];
    for (const sm of shipMeshes) {
      sm.frustumCulled = false;
      this.airshipPartInstanced.push(sm);
      g.add(sm);
    }
    for (let i = 0; i < shuttleSpecs.length; i += 1) {
      const sp = shuttleSpecs[i]!;
      this.airships.push({ ...sp });
      const ang = sp.phase;
      const x = Math.cos(ang) * sp.radiusX;
      const z = sp.centerZ + Math.sin(ang) * sp.radiusZ;
      const y = sp.baseY + Math.sin(ang * 2.0) * 0.24;
      const vx = -Math.sin(ang) * sp.radiusX;
      const vz = Math.cos(ang) * sp.radiusZ;
      this.tempPos.set(x, y, z);
      this.tempEuler.set(0, Math.atan2(vx, vz), -Math.cos(ang) * 0.16);
      this.tempQuat.setFromEuler(this.tempEuler);
      this.tempScale.set(1, 1, 1);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      for (const sm of shipMeshes) {
        sm.setMatrixAt(i, this.tempMatrix);
      }
    }
    for (const sm of shipMeshes) {
      sm.instanceMatrix.needsUpdate = true;
    }

    const cloudBuf = getOrBakeCloudDensityBuffer();
    const cloudTex = makeDataTexture(cloudBuf, CLOUD_TEX_SIZE, false, 1, 1);
    this.ownedTextures.push(cloudTex);

    const cloudPlaneGeo = new THREE.PlaneGeometry(70, 62, 1, 1);
    cloudPlaneGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(cloudPlaneGeo);

    const cloudMatUpper = createCloudSeaShader(cloudTex, 0.0);
    const cloudMatLower = createCloudSeaShader(cloudTex, 0.42);
    this.ownedMaterials.push(cloudMatUpper, cloudMatLower);
    this.animatedShaderMats.push(cloudMatUpper, cloudMatLower);

    const cloudUpper = new THREE.Mesh(cloudPlaneGeo, cloudMatUpper);
    cloudUpper.position.set(0, -2.35, -3.5);
    const cloudLower = new THREE.Mesh(cloudPlaneGeo, cloudMatLower);
    cloudLower.position.set(0, -4.15, -4.5);
    g.add(cloudUpper, cloudLower);

    const cloudPuffGeo = new THREE.SphereGeometry(1.0, 10, 7);
    const cloudPuffMat = createMatteMaterial({
      color: 0xfffaf0,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.18,
      transparent: true,
      opacity: 0.78,
    });
    const cloudUnderMat = createMatteMaterial({
      color: 0x7ab8eb,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.16,
      transparent: true,
      opacity: 0.64,
    });
    this.ownedGeometries.push(cloudPuffGeo);
    this.ownedMaterials.push(cloudPuffMat, cloudUnderMat);

    const bankCenters: readonly [number, number, number, number][] = [
      [-13.2, -2.2, -5.8, 1.15],
      [13.4, -2.3, -5.2, 1.20],
      [-14.0, -2.4, 2.0, 1.25],
      [13.8, -2.2, 2.6, 1.18],
      [-8.4, -2.7, -12.6, 1.35],
      [8.2, -2.7, -12.2, 1.38],
    ];
    const lobeOffsets: readonly [number, number, number, number, boolean][] = [
      [0, 0.15, 0, 1.25, true],
      [-1.15, -0.10, 0.35, 0.95, true],
      [1.10, -0.05, -0.25, 1.02, true],
      [0.25, -0.28, 0.72, 0.88, false],
      [-0.45, -0.24, -0.68, 0.84, false],
    ];
    for (const [bx, by, bz, bs] of bankCenters) {
      const bank = new THREE.Group();
      bank.position.set(bx, by, bz);
      for (const [ox, oy, oz, os, isTop] of lobeOffsets) {
        const lobe = new THREE.Mesh(cloudPuffGeo, isTop ? cloudPuffMat : cloudUnderMat);
        lobe.position.set(ox * bs, oy * bs, oz * bs);
        lobe.scale.set(os * bs * 1.15, os * bs * 0.52, os * bs * 0.95);
        bank.add(lobe);
      }
      g.add(bank);
    }

    const waterfallMat = createCloudWaterfallShader();
    this.ownedMaterials.push(waterfallMat);
    this.animatedShaderMats.push(waterfallMat);
    const waterfallParts: THREE.BufferGeometry[] = [];
    const fallSpecs: readonly { x: number; y: number; z: number; rx: number; rz: number; h: number; ry: number }[] = [
      { x: -8.35, y: -1.95, z: -2.2, rx: 0.45, rz: 4.8, h: 3.1, ry: Math.PI * 0.5 },
      { x: 8.35, y: -1.95, z: -2.2, rx: 0.45, rz: 4.8, h: 3.1, ry: -Math.PI * 0.5 },
      { x: -8.25, y: -2.05, z: 3.4, rx: 0.45, rz: 4.2, h: 3.0, ry: Math.PI * 0.5 },
      { x: 8.25, y: -2.05, z: 3.4, rx: 0.45, rz: 4.2, h: 3.0, ry: -Math.PI * 0.5 },
      { x: 0.0, y: -2.0, z: 8.95, rx: 7.4, rz: 0.45, h: 2.9, ry: 0.0 },
      { x: -10.3, y: -1.65, z: -1.65, rx: 1.55, rz: 1.55, h: 2.4, ry: 0.4 },
      { x: 10.3, y: -1.65, z: -1.65, rx: 1.55, rz: 1.55, h: 2.4, ry: -0.4 },
    ];
    for (const fs of fallSpecs) {
      const cylRaw = new THREE.CylinderGeometry(1.0, 1.24, fs.h, 12, 4, true, -Math.PI * 0.42, Math.PI * 0.84);
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(fs.x, fs.y, fs.z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, fs.ry, 0)),
        new THREE.Vector3(fs.rx, 1.0, fs.rz),
      );
      waterfallParts.push(normalizeArenaGeometryForMerge(cylRaw, m));
      cylRaw.dispose();
    }
    const mergedWaterfallGeo = mergeGeometries(waterfallParts, false)!;
    for (const wp of waterfallParts) wp.dispose();
    this.ownedGeometries.push(mergedWaterfallGeo);
    g.add(new THREE.Mesh(mergedWaterfallGeo, waterfallMat));

    batchArenaStaticChildrenByMaterial(g, new Set<THREE.Object3D>(), bloom, this.ownedGeometries);
    return g;
  }

  private buildMercuryDysonTheme(maps: {
    albedo: THREE.DataTexture;
    normal: THREE.DataTexture;
    roughness: THREE.DataTexture;
  }): THREE.Group {
    const g = new THREE.Group();
    const bloom = this.themeBloomTargets.mercury_dyson_forge;

    const forgeDeckMat = createMatteMaterial({
      color: 0xe6d2be,
      map: maps.albedo,
      normalMap: maps.normal,
      roughnessMap: maps.roughness,
      normalScale: 0.92,
      roughness: 0.62,
      metalness: 0.28,
      envMapIntensity: 0.54,
    });
    const obsidianMat = createMatteMaterial({
      color: 0x1d1a22,
      roughness: 0.68,
      metalness: 0.28,
      envMapIntensity: 0.42,
    });
    const darkIronMat = createMatteMaterial({
      color: 0x2f2b36,
      roughness: 0.58,
      metalness: 0.46,
      envMapIntensity: 0.52,
    });
    const antiqueBronzeMat = createMatteMaterial({
      color: 0xc87a32,
      roughness: 0.44,
      metalness: 0.62,
      envMapIntensity: 0.62,
    });
    const gildedMirrorMat = createMatteMaterial({
      color: 0xf2bf54,
      roughness: 0.36,
      metalness: 0.74,
      envMapIntensity: 0.72,
    });
    const amberChannelMat = createMatteMaterial({
      color: 0xff8224,
      roughness: 0.48,
      metalness: 0.12,
      envMapIntensity: 0.32,
      emissive: 0xff6600,
      emissiveIntensity: 1.18,
    });
    this.ownedMaterials.push(
      forgeDeckMat,
      obsidianMat,
      darkIronMat,
      antiqueBronzeMat,
      gildedMirrorMat,
      amberChannelMat,
    );

    const upperDeckShape = createChamferedOctagonShape(15.6, 15.8, 1.85);
    const upperDeckGeo = new THREE.ExtrudeGeometry(upperDeckShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.12,
      bevelSegments: 2,
    });
    upperDeckGeo.rotateX(Math.PI * 0.5);
    normalizeExtrudedPlanarUvs(upperDeckGeo, 16.0, 16.2);
    this.ownedGeometries.push(upperDeckGeo);

    const upperDeck = new THREE.Mesh(upperDeckGeo, forgeDeckMat);
    upperDeck.position.set(0, -0.125, 0.80);
    g.add(upperDeck);

    const lowerStepShape = createChamferedOctagonShape(16.9, 17.0, 2.35);
    const lowerStepGeo = new THREE.ExtrudeGeometry(lowerStepShape, {
      depth: 0.46,
      bevelEnabled: true,
      bevelThickness: 0.10,
      bevelSize: 0.16,
      bevelSegments: 2,
    });
    lowerStepGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(lowerStepGeo);

    const lowerStep = new THREE.Mesh(lowerStepGeo, obsidianMat);
    lowerStep.position.set(0, -0.40, 0.80);
    g.add(lowerStep);

    const bronzeRimShape = createChamferedOctagonShape(16.2, 16.4, 2.05);
    const bronzeRimHole = createChamferedOctagonShape(15.5, 15.7, 1.80);
    bronzeRimShape.holes.push(bronzeRimHole);
    const bronzeRimGeo = new THREE.ExtrudeGeometry(bronzeRimShape, {
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 1,
    });
    bronzeRimGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(bronzeRimGeo);
    const bronzeRim = new THREE.Mesh(bronzeRimGeo, antiqueBronzeMat);
    bronzeRim.position.set(0, -0.05, 0.80);
    g.add(bronzeRim);

    const benchFoundryGeo = subdivideSmooth(new THREE.BoxGeometry(14.0, 0.24, 1.72, 4, 1, 2), 1);
    this.ownedGeometries.push(benchFoundryGeo);
    const benchFoundry = new THREE.Mesh(benchFoundryGeo, darkIronMat);
    benchFoundry.position.set(0, -0.12, BENCH_Z_OFFSET);
    g.add(benchFoundry);

    const channelSideGeo = new THREE.BoxGeometry(0.18, 0.05, 12.6);
    const channelNorthGeo = new THREE.BoxGeometry(11.8, 0.05, 0.18);
    const buttressGeo = subdivideSmooth(new THREE.BoxGeometry(0.68, 0.54, 1.05, 2, 2, 2), 1);
    this.ownedGeometries.push(channelSideGeo, channelNorthGeo, buttressGeo);

    for (const side of [-1, 1]) {
      const ch = new THREE.Mesh(channelSideGeo, amberChannelMat);
      ch.position.set(side * 7.82, 0.05, 0.65);
      g.add(ch);
      bloom.push(ch);

      for (let i = 0; i < 4; i += 1) {
        const bz = -4.2 + i * 3.1;
        const buttress = new THREE.Mesh(buttressGeo, antiqueBronzeMat);
        buttress.position.set(side * 8.15, 0.10, bz);
        g.add(buttress);
      }
    }
    const northChannel = new THREE.Mesh(channelNorthGeo, amberChannelMat);
    northChannel.position.set(0, 0.06, -6.96);
    g.add(northChannel);
    bloom.push(northChannel);

    const sunGeo = new THREE.SphereGeometry(5.85, 36, 24);
    const sunMat = createSolarCoronaShader();
    const containmentArcAGeo = new THREE.TorusGeometry(6.45, 0.18, 10, 56, Math.PI * 0.92);
    const containmentArcBGeo = new THREE.TorusGeometry(7.25, 0.12, 8, 56, Math.PI * 0.86);
    const sunNodeGeo = new THREE.CylinderGeometry(0.24, 0.30, 0.44, 6);
    this.ownedGeometries.push(sunGeo, containmentArcAGeo, containmentArcBGeo, sunNodeGeo);
    this.ownedMaterials.push(sunMat);
    this.animatedShaderMats.push(sunMat);

    const moltenMat = createMoltenForgeTrenchShader();
    const coronaHaloMat = createSolarCoronaHaloShader();
    this.ownedMaterials.push(moltenMat, coronaHaloMat);
    this.animatedShaderMats.push(moltenMat, coronaHaloMat);

    const moltenParts: THREE.BufferGeometry[] = [];
    const trenchStripX = new THREE.PlaneGeometry(13.6, 0.24);
    trenchStripX.rotateX(-Math.PI * 0.5);
    for (const tz of [-6.86, 8.38]) {
      moltenParts.push(
        normalizeArenaGeometryForMerge(trenchStripX, new THREE.Matrix4().makeTranslation(0, -0.04, tz)),
      );
    }
    trenchStripX.dispose();
    const trenchStripZ = new THREE.PlaneGeometry(0.24, 13.8);
    trenchStripZ.rotateX(-Math.PI * 0.5);
    for (const tx of [-7.72, 7.72]) {
      moltenParts.push(
        normalizeArenaGeometryForMerge(trenchStripZ, new THREE.Matrix4().makeTranslation(tx, -0.04, 0.72)),
      );
    }
    trenchStripZ.dispose();
    const ventGrateRaw = new THREE.PlaneGeometry(0.88, 0.42);
    ventGrateRaw.rotateX(-Math.PI * 0.5);
    for (const side of [-1, 1]) {
      for (let v = 0; v < 4; v += 1) {
        const vz = -4.2 + v * 3.1;
        moltenParts.push(
          normalizeArenaGeometryForMerge(
            ventGrateRaw,
            new THREE.Matrix4().makeTranslation(side * 8.15, -0.02, vz),
          ),
        );
      }
    }
    ventGrateRaw.dispose();
    const mergedMoltenGeo = mergeGeometries(moltenParts, false)!;
    for (const mp of moltenParts) mp.dispose();
    this.ownedGeometries.push(mergedMoltenGeo);
    g.add(new THREE.Mesh(mergedMoltenGeo, moltenMat));

    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.set(0, -4.45, -11.65);
    const haloGeo = new THREE.PlaneGeometry(18.5, 18.5);
    this.ownedGeometries.push(haloGeo);
    const coronaHalo = new THREE.Mesh(haloGeo, coronaHaloMat);
    coronaHalo.position.set(0, -3.45, -12.6);
    const arcA = new THREE.Mesh(containmentArcAGeo, antiqueBronzeMat);
    arcA.position.set(0, -4.25, -10.45);
    arcA.rotation.z = Math.PI * 0.04;
    const arcB = new THREE.Mesh(containmentArcBGeo, darkIronMat);
    arcB.position.set(0, -4.35, -9.85);
    arcB.rotation.z = Math.PI * 0.07;
    g.add(coronaHalo, sunMesh, arcA, arcB);

    for (let i = 0; i < 7; i += 1) {
      const ang = Math.PI * 0.14 + (i / 6) * Math.PI * 0.72;
      const node = new THREE.Mesh(sunNodeGeo, amberChannelMat);
      node.position.set(
        Math.cos(ang) * 6.45,
        -4.25 + Math.sin(ang) * 6.45,
        -10.35,
      );
      node.rotation.z = ang - Math.PI * 0.5;
      g.add(node);
      bloom.push(node);
    }

    const plinthGeo = new THREE.CylinderGeometry(0.95, 1.24, 0.64, 6);
    const mastGeo = new THREE.CylinderGeometry(0.28, 0.44, 1.55, 6);
    const yokeGeo = new THREE.TorusGeometry(0.72, 0.09, 8, 16, Math.PI);
    const hexFrameGeo = createPointyHexRingGeometry(1.12, 0.88, 0.16);
    hexFrameGeo.rotateX(Math.PI * 0.5);
    const petalShape = new THREE.Shape();
    petalShape.moveTo(0, 0.16);
    petalShape.lineTo(0.40, 0.84);
    petalShape.lineTo(-0.40, 0.84);
    petalShape.closePath();
    const petalGeo = new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.018,
      bevelSize: 0.018,
      bevelSegments: 1,
    });
    const coreNeedleGeo = new THREE.ConeGeometry(0.14, 0.64, 6);
    coreNeedleGeo.rotateX(Math.PI * 0.5);
    const backingPlateGeo = new THREE.CylinderGeometry(0.86, 0.76, 0.14, 6);
    backingPlateGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(
      plinthGeo,
      mastGeo,
      yokeGeo,
      hexFrameGeo,
      petalGeo,
      coreNeedleGeo,
      backingPlateGeo,
    );

    const towerLayout: readonly [number, number, number, number][] = [
      [-9.0, -0.20, -5.2, 0.96],
      [-10.4, 0.10, -1.9, 1.08],
      [-10.5, -0.05, 1.7, 1.02],
      [-9.2, -0.22, 4.9, 0.90],
      [9.0, -0.20, -5.2, 0.96],
      [10.4, 0.10, -1.9, 1.08],
      [10.5, -0.05, 1.7, 1.02],
      [9.2, -0.22, 4.9, 0.90],
    ];

    const backingBaked = normalizeArenaGeometryForMerge(
      backingPlateGeo,
      new THREE.Matrix4().makeTranslation(0, 0, -0.10),
    );
    const needleBaked = normalizeArenaGeometryForMerge(
      coreNeedleGeo,
      new THREE.Matrix4().makeTranslation(0, 0, 0.24),
    );
    const petalParts: THREE.BufferGeometry[] = [];
    const petalRotZ = new THREE.Matrix4();
    const petalLocal = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0, -0.02),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0)),
      new THREE.Vector3(1, 1, 1),
    );
    const petalFinal = new THREE.Matrix4();
    for (let p = 0; p < 6; p += 1) {
      petalRotZ.makeRotationZ((p * Math.PI) / 3);
      petalFinal.multiplyMatrices(petalRotZ, petalLocal);
      petalParts.push(normalizeArenaGeometryForMerge(petalGeo, petalFinal));
    }
    const mergedPetalsGeo = mergeGeometries(petalParts, false)!;
    for (const pp of petalParts) pp.dispose();
    this.ownedGeometries.push(backingBaked, needleBaked, mergedPetalsGeo);

    const towerCount = towerLayout.length;
    const mirrorFramesInst = new THREE.InstancedMesh(hexFrameGeo, antiqueBronzeMat, towerCount);
    const mirrorBackingsInst = new THREE.InstancedMesh(backingBaked, darkIronMat, towerCount);
    const mirrorNeedlesInst = new THREE.InstancedMesh(needleBaked, amberChannelMat, towerCount);
    const mirrorPetalsInst = new THREE.InstancedMesh(mergedPetalsGeo, gildedMirrorMat, towerCount);
    const mirrorMeshes = [
      mirrorFramesInst,
      mirrorBackingsInst,
      mirrorNeedlesInst,
      mirrorPetalsInst,
    ];
    for (const mm of mirrorMeshes) {
      mm.frustumCulled = false;
      this.dysonMirrorInstanced.push(mm);
      g.add(mm);
    }
    bloom.push(mirrorNeedlesInst);

    const trussStrutGeo = new THREE.CylinderGeometry(0.055, 0.075, 1.48, 6);
    const hydraulicGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.92, 6);
    const towerCollarGeo = new THREE.TorusGeometry(0.46, 0.065, 6, 12);
    towerCollarGeo.rotateX(Math.PI * 0.5);
    const gussetGeo = new THREE.BoxGeometry(0.18, 0.42, 0.48);
    this.ownedGeometries.push(trussStrutGeo, hydraulicGeo, towerCollarGeo, gussetGeo);

    const aimHelper = new THREE.Object3D();
    towerLayout.forEach(([tx, ty, tz, sc], idx) => {
      const tower = new THREE.Group();
      tower.position.set(tx, ty, tz);
      tower.scale.setScalar(sc);

      const plinth = new THREE.Mesh(plinthGeo, obsidianMat);
      plinth.position.y = -0.18;
      const mast = new THREE.Mesh(mastGeo, darkIronMat);
      mast.position.y = 0.72;
      const collarA = new THREE.Mesh(towerCollarGeo, antiqueBronzeMat);
      collarA.position.y = 0.34;
      const collarB = new THREE.Mesh(towerCollarGeo, antiqueBronzeMat);
      collarB.scale.setScalar(0.76);
      collarB.position.y = 1.12;
      const yoke = new THREE.Mesh(yokeGeo, antiqueBronzeMat);
      yoke.position.y = 1.56;
      yoke.rotation.z = Math.PI;
      yoke.rotation.y = tx < 0 ? 0.55 : -0.55;

      for (let leg = 0; leg < 4; leg += 1) {
        const ang = (leg * Math.PI) / 2 + Math.PI * 0.25;
        const strut = new THREE.Mesh(trussStrutGeo, darkIronMat);
        strut.position.set(Math.cos(ang) * 0.56, 0.58, Math.sin(ang) * 0.56);
        strut.rotation.z = Math.cos(ang) * 0.30;
        strut.rotation.x = -Math.sin(ang) * 0.30;
        tower.add(strut);

        const gusset = new THREE.Mesh(gussetGeo, antiqueBronzeMat);
        gusset.position.set(Math.cos(ang) * 0.88, 0.04, Math.sin(ang) * 0.88);
        gusset.rotation.y = -ang;
        tower.add(gusset);
      }

      for (const hSide of [-1, 1]) {
        const piston = new THREE.Mesh(hydraulicGeo, antiqueBronzeMat);
        piston.position.set(hSide * 0.32, 1.32, tx < 0 ? 0.16 : -0.16);
        piston.rotation.z = hSide * 0.18;
        tower.add(piston);
      }

      tower.add(plinth, mast, collarA, collarB, yoke);
      g.add(tower);

      aimHelper.position.set(0, 1.85, 0);
      aimHelper.rotation.set(0, 0, 0);
      const targetX = tx < 0 ? 1.8 : -1.8;
      aimHelper.lookAt(targetX, 3.6, 5.2);
      const baseEuler = aimHelper.rotation.clone();
      const worldPos = new THREE.Vector3(tx, ty + 1.85 * sc, tz);
      this.dysonTowers.push({
        pos: worldPos,
        scale: sc,
        baseEuler,
        phase: idx * 0.78,
      });

      this.tempQuat.setFromEuler(baseEuler);
      this.tempScale.setScalar(sc);
      this.tempMatrix.compose(worldPos, this.tempQuat, this.tempScale);
      for (const mm of mirrorMeshes) {
        mm.setMatrixAt(idx, this.tempMatrix);
      }
    });
    this.tempScale.set(1, 1, 1);
    for (const mm of mirrorMeshes) {
      mm.instanceMatrix.needsUpdate = true;
    }

    const outerGearGroup = new THREE.Group();
    outerGearGroup.position.set(0, -1.75, 0.45);
    const gearRingGeo = new THREE.TorusGeometry(10.2, 0.36, 10, 48);
    gearRingGeo.rotateX(Math.PI * 0.5);
    const gearToothGeo = new THREE.BoxGeometry(0.68, 0.44, 0.88);
    const spokeGeo = new THREE.BoxGeometry(0.44, 0.26, 20.0);
    const innerGearRingGeo = new THREE.TorusGeometry(8.8, 0.26, 8, 42);
    innerGearRingGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(gearRingGeo, gearToothGeo, spokeGeo, innerGearRingGeo);

    const gearFlangeGeo = new THREE.TorusGeometry(9.72, 0.14, 8, 48);
    gearFlangeGeo.rotateX(Math.PI * 0.5);
    const gearNotchGeo = new THREE.BoxGeometry(0.42, 0.54, 0.62);
    const gearCoilGeo = new THREE.BoxGeometry(0.32, 0.20, 0.44);
    this.ownedGeometries.push(gearFlangeGeo, gearNotchGeo, gearCoilGeo);

    const gearCompositeMat = createMatteMaterial({
      color: 0xffffff,
      roughness: 0.60,
      metalness: 0.48,
      envMapIntensity: 0.38,
    });
    gearCompositeMat.vertexColors = true;
    this.ownedMaterials.push(gearCompositeMat);

    const outerGearParts: THREE.BufferGeometry[] = [
      normalizeColoredGeometryForMerge(gearRingGeo, new THREE.Matrix4(), 0xa26f3c),
      normalizeColoredGeometryForMerge(gearFlangeGeo, new THREE.Matrix4().makeTranslation(0, 0.16, 0), 0xb88248),
      normalizeColoredGeometryForMerge(gearFlangeGeo, new THREE.Matrix4().makeTranslation(0, -0.16, 0), 0x8f5f30),
    ];
    const gearCoilParts: THREE.BufferGeometry[] = [];
    const teethCount = 24;
    for (let t = 0; t < teethCount; t += 1) {
      const ang = (t / teethCount) * Math.PI * 2;
      this.tempPos.set(Math.cos(ang) * 10.68, 0, Math.sin(ang) * 10.68);
      this.tempQuat.setFromAxisAngle(this.tempYAxis, -ang + Math.PI * 0.5);
      this.tempScale.set(1, 1, 1);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      outerGearParts.push(normalizeColoredGeometryForMerge(gearToothGeo, this.tempMatrix, 0xa26f3c));

      this.tempPos.set(Math.cos(ang + 0.13) * 10.22, 0.08, Math.sin(ang + 0.13) * 10.22);
      this.tempQuat.setFromAxisAngle(this.tempYAxis, -(ang + 0.13) + Math.PI * 0.5);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      outerGearParts.push(normalizeColoredGeometryForMerge(gearNotchGeo, this.tempMatrix, 0x261d19));

      if (t % 3 === 0) {
        this.tempPos.set(Math.cos(ang) * 9.85, 0.24, Math.sin(ang) * 9.85);
        this.tempQuat.setFromAxisAngle(this.tempYAxis, -ang + Math.PI * 0.5);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        gearCoilParts.push(normalizeArenaGeometryForMerge(gearCoilGeo, this.tempMatrix));
      }
    }
    for (let s = 0; s < 4; s += 1) {
      outerGearParts.push(
        normalizeColoredGeometryForMerge(
          spokeGeo,
          new THREE.Matrix4().makeRotationY((s * Math.PI) / 4),
          0x3b2e28,
        ),
      );
    }
    const mergedOuterGearGeo = mergeGeometries(outerGearParts, false)!;
    const mergedGearCoilGeo = mergeGeometries(gearCoilParts, false)!;
    for (const p of outerGearParts) p.dispose();
    for (const p of gearCoilParts) p.dispose();
    this.ownedGeometries.push(mergedOuterGearGeo, mergedGearCoilGeo);
    outerGearGroup.add(
      new THREE.Mesh(mergedOuterGearGeo, gearCompositeMat),
      new THREE.Mesh(mergedGearCoilGeo, amberChannelMat),
    );
    g.add(outerGearGroup);
    this.dysonOuterGear = outerGearGroup;

    const innerGearGroup = new THREE.Group();
    innerGearGroup.position.set(0, -2.25, 0.45);
    const innerParts: THREE.BufferGeometry[] = [
      normalizeColoredGeometryForMerge(innerGearRingGeo, new THREE.Matrix4(), 0x3b2e28),
    ];
    for (let t = 0; t < 18; t += 1) {
      const ang = (t / 18) * Math.PI * 2;
      this.tempPos.set(Math.cos(ang) * 9.22, 0, Math.sin(ang) * 9.22);
      this.tempQuat.setFromAxisAngle(this.tempYAxis, -ang + Math.PI * 0.5);
      this.tempScale.set(0.75, 0.72, 0.72);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      innerParts.push(normalizeColoredGeometryForMerge(gearToothGeo, this.tempMatrix, 0xc99349));
    }
    this.tempScale.set(1, 1, 1);
    const mergedInnerGearGeo = mergeGeometries(innerParts, false)!;
    for (const ip of innerParts) ip.dispose();
    this.ownedGeometries.push(mergedInnerGearGeo);
    innerGearGroup.add(new THREE.Mesh(mergedInnerGearGeo, gearCompositeMat));
    g.add(innerGearGroup);
    this.dysonInnerGear = innerGearGroup;

    const emberCount = 96;
    const emberPos = new Float32Array(emberCount * 3);
    const emberPhase = new Float32Array(emberCount);
    const emberScale = new Float32Array(emberCount);
    const rng = createSeededRandom(49157);
    for (let i = 0; i < emberCount; i += 1) {
      const ang = rng() * Math.PI * 2;
      const rad = 7.6 + rng() * 6.2;
      emberPos[i * 3] = Math.cos(ang) * rad;
      emberPos[i * 3 + 1] = -1.4 + rng() * 2.2;
      emberPos[i * 3 + 2] = Math.sin(ang) * rad - 0.8;
      emberPhase[i] = rng();
      emberScale[i] = 0.65 + rng() * 1.15;
    }
    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    emberGeo.setAttribute('aPhase', new THREE.BufferAttribute(emberPhase, 1));
    emberGeo.setAttribute('aScale', new THREE.BufferAttribute(emberScale, 1));
    const emberMat = createSoftParticleShader(0xf5b858, 0xe06d1b, 10.5, 0.14, 1.0);
    this.ownedGeometries.push(emberGeo);
    this.ownedMaterials.push(emberMat);
    this.animatedShaderMats.push(emberMat);
    g.add(new THREE.Points(emberGeo, emberMat));

    batchArenaStaticChildrenByMaterial(
      g,
      new Set<THREE.Object3D>([outerGearGroup, innerGearGroup]),
      bloom,
      this.ownedGeometries,
    );
    return g;
  }

  private buildEventHorizonTheme(maps: {
    albedo: THREE.DataTexture;
    normal: THREE.DataTexture;
    roughness: THREE.DataTexture;
  }): THREE.Group {
    const g = new THREE.Group();
    const bloom = this.themeBloomTargets.event_horizon_observatory;

    const astrolabeDeckMat = createMatteMaterial({
      color: 0xd8d6ff,
      map: maps.albedo,
      normalMap: maps.normal,
      roughnessMap: maps.roughness,
      normalScale: 0.84,
      roughness: 0.62,
      metalness: 0.20,
      envMapIntensity: 0.54,
    });
    const obsidianRockMat = createMatteMaterial({
      color: 0x171538,
      roughness: 0.70,
      metalness: 0.20,
      envMapIntensity: 0.42,
    });
    const amethystStoneMat = createMatteMaterial({
      color: 0x3a2e82,
      roughness: 0.58,
      metalness: 0.26,
      envMapIntensity: 0.52,
    });
    const astralGoldMat = createMatteMaterial({
      color: 0xe8be66,
      roughness: 0.38,
      metalness: 0.64,
      envMapIntensity: 0.68,
    });
    const violetArcMat = createMatteMaterial({
      color: 0xb084ff,
      roughness: 0.46,
      metalness: 0.14,
      envMapIntensity: 0.38,
      emissive: 0x8b5cf6,
      emissiveIntensity: 1.12,
    });
    const goldArcMat = createMatteMaterial({
      color: 0x60e8ff,
      roughness: 0.44,
      metalness: 0.18,
      envMapIntensity: 0.40,
      emissive: 0x22d3ee,
      emissiveIntensity: 1.08,
    });
    this.ownedMaterials.push(
      astrolabeDeckMat,
      obsidianRockMat,
      amethystStoneMat,
      astralGoldMat,
      violetArcMat,
      goldArcMat,
    );

    const sanctuaryShape = createOrganicSanctuaryShape(8.35, 8.65);
    const sanctuaryGeo = new THREE.ExtrudeGeometry(sanctuaryShape, {
      depth: 0.34,
      bevelEnabled: true,
      bevelThickness: 0.10,
      bevelSize: 0.16,
      bevelSegments: 3,
    });
    sanctuaryGeo.rotateX(Math.PI * 0.5);
    normalizeExtrudedPlanarUvs(sanctuaryGeo, 17.0, 17.4);
    this.ownedGeometries.push(sanctuaryGeo);

    const sanctuaryMesh = new THREE.Mesh(sanctuaryGeo, astrolabeDeckMat);
    sanctuaryMesh.position.set(0, -0.144, 0.72);
    g.add(sanctuaryMesh);

    const underRockCage = new THREE.CylinderGeometry(8.1, 3.6, 2.25, 12, 2);
    const posAttr = underRockCage.attributes.position;
    if (posAttr) {
      for (let i = 0; i < posAttr.count; i += 1) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        if (y < 0.8) {
          const ang = Math.atan2(z, x);
          const scaleNoise = 0.96 + 0.08 * Math.sin(ang * 5.0 + y * 1.4) + 0.05 * Math.cos(ang * 3.0);
          posAttr.setX(i, x * scaleNoise);
          posAttr.setZ(i, z * scaleNoise);
        }
      }
    }
    const underRockGeo = subdivideSmooth(underRockCage, 1);
    this.ownedGeometries.push(underRockGeo);
    const underRock = new THREE.Mesh(underRockGeo, obsidianRockMat);
    underRock.position.set(0, -1.52, 0.72);
    g.add(underRock);

    const crescentGeo = new THREE.TorusGeometry(8.55, 0.10, 8, 28, Math.PI * 0.26);
    crescentGeo.rotateX(Math.PI * 0.5);
    const dialStudGeo = new THREE.BoxGeometry(0.10, 0.04, 0.28);
    const dialPointerGeo = new THREE.ConeGeometry(0.14, 0.44, 4);
    dialPointerGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(crescentGeo, dialStudGeo, dialPointerGeo);
    for (let i = 0; i < 6; i += 1) {
      const seg = new THREE.Mesh(crescentGeo, i % 2 === 0 ? astralGoldMat : violetArcMat);
      seg.position.set(0, 0.04, 0.72);
      seg.rotation.y = (i * Math.PI) / 3 + 0.18;
      g.add(seg);
      if (i % 2 === 1) bloom.push(seg);
    }
    for (let i = 0; i < 24; i += 1) {
      const ang = (i / 24) * Math.PI * 2;
      const isCardinal = i % 3 === 0;
      const r = isCardinal ? 8.12 : 8.24;
      const marker = new THREE.Mesh(isCardinal ? dialPointerGeo : dialStudGeo, astralGoldMat);
      marker.position.set(Math.cos(ang) * r, 0.036, 0.72 + Math.sin(ang) * r);
      marker.rotation.y = -ang + Math.PI * 0.5;
      g.add(marker);
    }

    const benchCrescentGeo = subdivideSmooth(new THREE.BoxGeometry(13.8, 0.20, 1.66, 6, 1, 2), 2);
    this.ownedGeometries.push(benchCrescentGeo);
    const benchCrescent = new THREE.Mesh(benchCrescentGeo, amethystStoneMat);
    benchCrescent.position.set(0, -0.12, BENCH_Z_OFFSET);
    g.add(benchCrescent);

    const bhCenter = new THREE.Vector3(0, -0.22, -9.55);
    const bhCoreGeo = new THREE.SphereGeometry(1.34, 32, 24);
    const bhCoreMat = new THREE.MeshBasicMaterial({ color: 0x020206 });
    const photonRingGeo = new THREE.TorusGeometry(1.39, 0.046, 10, 56);
    const diskGeo = new THREE.RingGeometry(1.40, 4.85, 72, 4);
    const diskMat = createAccretionDiskShader();
    const lensUpperGeo = new THREE.TorusGeometry(2.20, 0.11, 10, 48, Math.PI);
    const lensLowerGeo = new THREE.TorusGeometry(2.04, 0.08, 10, 48, Math.PI);
    const haloArcGeo = new THREE.TorusGeometry(3.75, 0.048, 8, 56);
    this.ownedGeometries.push(
      bhCoreGeo,
      photonRingGeo,
      diskGeo,
      lensUpperGeo,
      lensLowerGeo,
      haloArcGeo,
    );
    this.ownedMaterials.push(bhCoreMat, diskMat);
    this.animatedShaderMats.push(diskMat);

    const bhGroup = new THREE.Group();
    bhGroup.position.copy(bhCenter);

    const bhCore = new THREE.Mesh(bhCoreGeo, bhCoreMat);
    const photonRing = new THREE.Mesh(photonRingGeo, goldArcMat);
    photonRing.rotation.x = 0.35;

    const accretionDisk = new THREE.Mesh(diskGeo, diskMat);
    accretionDisk.rotation.set(1.16, 0.08, 0.16);

    const lensUpper = new THREE.Mesh(lensUpperGeo, goldArcMat);
    lensUpper.rotation.set(0.32, 0.04, 0.06);
    const lensLower = new THREE.Mesh(lensLowerGeo, violetArcMat);
    lensLower.rotation.set(0.32, 0.04, Math.PI + 0.06);

    const outerHalo = new THREE.Mesh(haloArcGeo, violetArcMat);
    outerHalo.rotation.set(1.22, -0.14, -0.12);

    const vortexGeo = new THREE.PlaneGeometry(11.4, 11.4);
    const vortexMat = createGravitationalVortexShader();
    this.ownedGeometries.push(vortexGeo);
    this.ownedMaterials.push(vortexMat);
    this.animatedShaderMats.push(vortexMat);
    const vortexMesh = new THREE.Mesh(vortexGeo, vortexMat);
    vortexMesh.rotation.set(0.38, 0.04, 0.08);
    vortexMesh.position.set(0, 0.10, -0.18);

    bhGroup.add(bhCore, photonRing, accretionDisk, lensUpper, lensLower, outerHalo, vortexMesh);
    bloom.push(photonRing, lensUpper, lensLower, outerHalo);
    this.blackHoleSpinners.push(outerHalo);
    g.add(bhGroup);

    const cage = new THREE.SphereGeometry(0.96, 8, 6);
    const pa = cage.attributes.position;
    if (pa) {
      for (let i = 0; i < pa.count; i += 1) {
        const x = pa.getX(i);
        const y = pa.getY(i);
        const z = pa.getZ(i);
        const warp =
          1.0 +
          0.18 * Math.sin(x * 2.8 + 0.7) * Math.cos(z * 2.6 - 0.7) +
          0.12 * Math.cos((x - z) * 3.4 + 0.7);
        const sy = y > 0 ? 0.46 : 1.38;
        pa.setXYZ(i, x * warp, y * sy * warp, z * warp);
      }
    }
    const smoothReef = subdivideSmooth(cage, 1);
    const underSpireA = new THREE.ConeGeometry(0.24, 1.15, 5);
    underSpireA.rotateX(Math.PI);
    const underSpireB = new THREE.ConeGeometry(0.14, 0.72, 5);
    underSpireB.rotateX(Math.PI);
    const underSpireC = new THREE.ConeGeometry(0.12, 0.64, 5);
    underSpireC.rotateX(Math.PI);
    const unifiedReefGeo = mergeGeometries(
      [
        normalizeArenaGeometryForMerge(smoothReef, new THREE.Matrix4()),
        normalizeArenaGeometryForMerge(underSpireA, new THREE.Matrix4().makeTranslation(0, -1.52, 0)),
        normalizeArenaGeometryForMerge(
          underSpireB,
          new THREE.Matrix4().compose(
            new THREE.Vector3(0.32, -1.16, 0.22),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(0.14, 0.4, -0.18)),
            new THREE.Vector3(1, 1, 1),
          ),
        ),
        normalizeArenaGeometryForMerge(
          underSpireC,
          new THREE.Matrix4().compose(
            new THREE.Vector3(-0.30, -1.08, -0.20),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, 0.2, 0.20)),
            new THREE.Vector3(1, 1, 1),
          ),
        ),
      ],
      false,
    )!;
    smoothReef.dispose();
    underSpireA.dispose();
    underSpireB.dispose();
    underSpireC.dispose();
    this.ownedGeometries.push(unifiedReefGeo);
    const reefBandGeo = new THREE.TorusGeometry(0.86, 0.036, 8, 20);
    reefBandGeo.rotateX(Math.PI * 0.5);
    const reefCrystalGeo = new THREE.OctahedronGeometry(0.24, 0);
    this.ownedGeometries.push(reefBandGeo, reefCrystalGeo);

    const reefSpots: readonly [number, number, number, number][] = [
      [-9.4, -0.35, -6.6, 1.12],
      [-7.2, -0.55, -8.3, 0.96],
      [-11.4, -0.15, -4.1, 1.18],
      [-11.8, -0.40, 1.9, 1.05],
      [-10.4, -0.25, 4.8, 1.10],
      [-8.7, -0.30, 7.1, 0.88],
      [9.4, -0.35, -6.6, 1.12],
      [7.2, -0.55, -8.3, 0.96],
      [11.4, -0.15, -4.1, 1.18],
      [11.8, -0.40, 1.9, 1.05],
      [10.4, -0.25, 4.8, 1.10],
      [8.7, -0.30, 7.1, 0.88],
      [-4.6, -1.05, -8.8, 0.84],
      [4.6, -1.05, -8.8, 0.84],
    ];

    const reefBandBaked = normalizeArenaGeometryForMerge(
      reefBandGeo,
      new THREE.Matrix4().makeTranslation(0, 0.08, 0),
    );
    const shardTop = normalizeArenaGeometryForMerge(
      reefCrystalGeo,
      new THREE.Matrix4().compose(
        new THREE.Vector3(0, 0.62, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(0.8, 1.6, 0.8),
      ),
    );
    const shardBottom = normalizeArenaGeometryForMerge(
      reefCrystalGeo,
      new THREE.Matrix4().compose(
        new THREE.Vector3(0, -1.78, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(0.55, 1.45, 0.55),
      ),
    );
    const reefShardBaked = mergeGeometries([shardTop, shardBottom], false)!;
    shardTop.dispose();
    shardBottom.dispose();
    this.ownedGeometries.push(reefBandBaked, reefShardBaked);

    let shardCount = 0;
    for (let idx = 0; idx < reefSpots.length; idx += 1) {
      if (idx % 3 === 0) shardCount += 1;
    }

    const unifiedRockInst = new THREE.InstancedMesh(
      unifiedReefGeo,
      obsidianRockMat,
      reefSpots.length,
    );
    unifiedRockInst.frustumCulled = false;
    this.reefRockInstanced.push(unifiedRockInst);
    g.add(unifiedRockInst);

    const unifiedBandMat = createMatteMaterial({
      color: 0xffffff,
      roughness: 0.58,
      metalness: 0.42,
      envMapIntensity: 0.36,
    });
    this.ownedMaterials.push(unifiedBandMat);
    this.reefGoldBandInstanced = new THREE.InstancedMesh(
      reefBandBaked,
      unifiedBandMat,
      reefSpots.length,
    );
    this.reefAmethystBandInstanced = null;
    this.reefShardInstanced = new THREE.InstancedMesh(reefShardBaked, violetArcMat, shardCount);
    this.reefGoldBandInstanced.frustumCulled = false;
    this.reefShardInstanced.frustumCulled = false;
    g.add(this.reefGoldBandInstanced, this.reefShardInstanced);

    let shardCursor = 0;
    reefSpots.forEach(([rx, ry, rz, rs], idx) => {
      const shardSlot = idx % 3 === 0 ? shardCursor : -1;
      if (shardSlot >= 0) shardCursor += 1;
      const isGoldBand = idx % 2 === 0;

      this.tempPos.set(rx, ry, rz);
      this.tempQuat.setFromAxisAngle(this.tempYAxis, idx * 1.15);
      this.tempScale.setScalar(rs);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      unifiedRockInst.setMatrixAt(idx, this.tempMatrix);
      this.reefGoldBandInstanced!.setMatrixAt(idx, this.tempMatrix);
      this.tempColor.setHex(isGoldBand ? 0xc9a35b : 0x5c4699);
      this.reefGoldBandInstanced!.setColorAt(idx, this.tempColor);
      if (shardSlot >= 0) {
        this.reefShardInstanced!.setMatrixAt(shardSlot, this.tempMatrix);
      }

      this.floatingReefs.push({
        x: rx,
        baseY: ry,
        z: rz,
        scale: rs,
        phase: idx * 0.85,
        amp: 0.14 + (idx % 3) * 0.05,
        rotSpeed: (idx % 2 === 0 ? 1 : -1) * 0.08,
        rotY: idx * 1.15,
        rockVariant: 0,
        rockSlot: idx,
        isGoldBand: true,
        bandSlot: idx,
        shardSlot,
      });
    });
    this.tempScale.set(1, 1, 1);
    unifiedRockInst.instanceMatrix.needsUpdate = true;
    this.reefGoldBandInstanced.instanceMatrix.needsUpdate = true;
    if (this.reefGoldBandInstanced.instanceColor) {
      this.reefGoldBandInstanced.instanceColor.needsUpdate = true;
    }
    this.reefShardInstanced.instanceMatrix.needsUpdate = true;

    const orbitalTrackCurves: readonly THREE.CatmullRomCurve3[] = [
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-9.4, 0.15, -6.4),
        new THREE.Vector3(-11.2, 0.45, -2.5),
        new THREE.Vector3(-11.5, 0.25, 2.2),
        new THREE.Vector3(-9.4, 0.10, 6.4),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(9.4, 0.15, -6.4),
        new THREE.Vector3(11.2, 0.45, -2.5),
        new THREE.Vector3(11.5, 0.25, 2.2),
        new THREE.Vector3(9.4, 0.10, 6.4),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-8.2, -0.15, -7.8),
        new THREE.Vector3(-4.4, 0.42, -8.5),
        new THREE.Vector3(0, 0.65, -8.3),
        new THREE.Vector3(4.4, 0.42, -8.5),
        new THREE.Vector3(8.2, -0.15, -7.8),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-10.6, -0.55, -4.6),
        new THREE.Vector3(-9.6, -0.10, 0.4),
        new THREE.Vector3(-10.2, -0.45, 5.2),
      ]),
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(10.6, -0.55, -4.6),
        new THREE.Vector3(9.6, -0.10, 0.4),
        new THREE.Vector3(10.2, -0.45, 5.2),
      ]),
    ];

    orbitalTrackCurves.forEach((curve, idx) => {
      const tubeGeo = new THREE.TubeGeometry(curve, 36, idx < 3 ? 0.042 : 0.028, 8, false);
      this.ownedGeometries.push(tubeGeo);
      const track = new THREE.Mesh(tubeGeo, idx % 2 === 0 ? violetArcMat : goldArcMat);
      g.add(track);
      bloom.push(track);
    });

    reefSpots.forEach(([rx, ry, rz], idx) => {
      const ang = Math.atan2(rz - 0.72, rx);
      const rimX = Math.cos(ang) * 8.48;
      const rimZ = 0.72 + Math.sin(ang) * 8.48;
      const midX = (rx + rimX) * 0.5;
      const midZ = (rz + rimZ) * 0.5;
      const tetherCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(rx, ry - 0.55, rz),
        new THREE.Vector3(midX, ry - 0.85, midZ),
        new THREE.Vector3(rimX, -0.06, rimZ),
      ]);
      const tetherGeo = new THREE.TubeGeometry(tetherCurve, 12, 0.015, 5, false);
      this.ownedGeometries.push(tetherGeo);
      const tether = new THREE.Mesh(tetherGeo, idx % 2 === 0 ? violetArcMat : goldArcMat);
      g.add(tether);
    });

    const armBaseGeo = subdivideSmooth(new THREE.CylinderGeometry(1.15, 0.62, 1.25, 8, 2), 1);
    const armCollarGeo = new THREE.TorusGeometry(1.08, 0.08, 8, 24);
    armCollarGeo.rotateX(Math.PI * 0.5);
    const cradleStrutGeo = new THREE.TorusGeometry(1.12, 0.065, 8, 20, Math.PI * 0.58);
    const outerArmGeo = new THREE.TorusGeometry(1.18, 0.072, 10, 36);
    const midArmGeo = new THREE.TorusGeometry(0.92, 0.056, 8, 32);
    const innerArmGeo = new THREE.TorusGeometry(0.66, 0.046, 8, 28);
    const astralCoreGeo = new THREE.OctahedronGeometry(0.28, 0);
    const spireNeedleGeo = new THREE.ConeGeometry(0.08, 0.95, 6);
    this.ownedGeometries.push(
      armBaseGeo,
      armCollarGeo,
      cradleStrutGeo,
      outerArmGeo,
      midArmGeo,
      innerArmGeo,
      astralCoreGeo,
      spireNeedleGeo,
    );

    this.armillaryOuterInstanced = new THREE.InstancedMesh(outerArmGeo, astralGoldMat, 2);
    this.armillaryMidInstanced = new THREE.InstancedMesh(midArmGeo, violetArcMat, 2);
    this.armillaryInnerInstanced = new THREE.InstancedMesh(innerArmGeo, astralGoldMat, 2);
    this.armillaryCoreInstanced = new THREE.InstancedMesh(astralCoreGeo, goldArcMat, 2);
    this.armillaryOuterInstanced.frustumCulled = false;
    this.armillaryMidInstanced.frustumCulled = false;
    this.armillaryInnerInstanced.frustumCulled = false;
    this.armillaryCoreInstanced.frustumCulled = false;
    g.add(
      this.armillaryOuterInstanced,
      this.armillaryMidInstanced,
      this.armillaryInnerInstanced,
      this.armillaryCoreInstanced,
    );
    bloom.push(this.armillaryMidInstanced, this.armillaryCoreInstanced);

    const sidesArm = [-1, 1];
    for (let idx = 0; idx < sidesArm.length; idx += 1) {
      const side = sidesArm[idx]!;
      const tower = new THREE.Group();
      const tx = side * 10.05;
      const ty = 0.05;
      const tz = -1.15;
      tower.position.set(tx, ty, tz);

      const base = new THREE.Mesh(armBaseGeo, obsidianRockMat);
      base.position.y = -0.35;
      const collar = new THREE.Mesh(armCollarGeo, astralGoldMat);
      collar.position.y = 0.24;
      tower.add(base, collar);

      for (let c = 0; c < 4; c += 1) {
        const strut = new THREE.Mesh(cradleStrutGeo, amethystStoneMat);
        strut.position.y = 1.02;
        strut.rotation.y = (c * Math.PI) / 2;
        strut.rotation.z = -Math.PI * 0.22;
        tower.add(strut);
      }

      const sphereCenterY = 1.56;
      const finial = new THREE.Mesh(spireNeedleGeo, astralGoldMat);
      finial.position.y = sphereCenterY + 1.48;
      tower.add(finial);
      g.add(tower);

      const cy = ty + sphereCenterY;
      this.tempScale.set(1, 1, 1);
      this.tempPos.set(tx, cy, tz);

      this.tempEuler.set(0, side < 0 ? 0 : Math.PI * 0.65, 0);
      this.tempQuat.setFromEuler(this.tempEuler);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.armillaryOuterInstanced.setMatrixAt(idx, this.tempMatrix);

      this.tempEuler.set(0.65, 0.4, 0.2);
      this.tempQuat.setFromEuler(this.tempEuler);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.armillaryMidInstanced.setMatrixAt(idx, this.tempMatrix);

      this.tempEuler.set(1.1, -0.5, 0.8);
      this.tempQuat.setFromEuler(this.tempEuler);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.armillaryInnerInstanced.setMatrixAt(idx, this.tempMatrix);

      this.tempQuat.identity();
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.armillaryCoreInstanced.setMatrixAt(idx, this.tempMatrix);

      this.armillaryTowers.push({
        x: tx,
        y: ty,
        z: tz,
        phase: side < 0 ? 0 : Math.PI * 0.65,
      });
    }
    this.armillaryOuterInstanced.instanceMatrix.needsUpdate = true;
    this.armillaryMidInstanced.instanceMatrix.needsUpdate = true;
    this.armillaryInnerInstanced.instanceMatrix.needsUpdate = true;
    this.armillaryCoreInstanced.instanceMatrix.needsUpdate = true;

    const dustCount = 104;
    const dustPos = new Float32Array(dustCount * 3);
    const dustPhase = new Float32Array(dustCount);
    const dustScale = new Float32Array(dustCount);
    const drng = createSeededRandom(61231);
    for (let i = 0; i < dustCount; i += 1) {
      const ang = drng() * Math.PI * 2;
      const rad = 7.4 + drng() * 6.8;
      dustPos[i * 3] = Math.cos(ang) * rad;
      dustPos[i * 3 + 1] = 0.6 + drng() * 3.0;
      dustPos[i * 3 + 2] = Math.sin(ang) * rad - 0.8;
      dustPhase[i] = drng();
      dustScale[i] = 0.55 + drng() * 1.1;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhase, 1));
    dustGeo.setAttribute('aScale', new THREE.BufferAttribute(dustScale, 1));
    const dustMat = createSoftParticleShader(0xd8d4ff, 0xb68cf5, 9.2, 0.08, -1.0);
    this.ownedGeometries.push(dustGeo);
    this.ownedMaterials.push(dustMat);
    this.animatedShaderMats.push(dustMat);
    g.add(new THREE.Points(dustGeo, dustMat));

    batchArenaStaticChildrenByMaterial(
      g,
      new Set<THREE.Object3D>([outerHalo]),
      bloom,
      this.ownedGeometries,
    );
    return g;
  }

  private writeHexInstanceTransform(idx: number, row: number, col: number, liftY: number): void {
    const { x, z } = hexToStageXZ(row, col);
    this.tempMatrix.makeTranslation(x, 0.006 + liftY, z);
    this.hexBezelInstanced.setMatrixAt(idx, this.tempMatrix);
    if (row >= DEPLOY_START_ROW) {
      const deployIdx = (row - DEPLOY_START_ROW) * BOARD_COLS + col;
      this.tempMatrix.makeTranslation(x, 0.011 + liftY, z);
      this.deployBezelInstanced.setMatrixAt(deployIdx, this.tempMatrix);
    }
    this.tempMatrix.makeTranslation(x, -0.020 + liftY, z);
    this.hexPlateInstanced.setMatrixAt(idx, this.tempMatrix);
  }

  public setScoutPadsVisible(visible: boolean): void {
    this.scoutPadsMesh.visible = visible;
  }

  public getActiveBloomTargets(): readonly THREE.Object3D[] {
    return [...this.sharedBloomTargets, ...this.themeBloomTargets[this.currentTheme]];
  }

  public setTheme(theme: ArenaThemeId): void {
    this.currentTheme = theme;
    this.themeRoots.orbital_elevator_port.visible = theme === 'orbital_elevator_port';
    this.themeRoots.mercury_dyson_forge.visible = theme === 'mercury_dyson_forge';
    this.themeRoots.event_horizon_observatory.visible = theme === 'event_horizon_observatory';

    this.hexPlateInstanced.material = this.themeHexTileMats[theme];

    const preset = getArenaThemeLightingPreset(theme);
    const themeIdx =
      theme === 'mercury_dyson_forge' ? 1 : theme === 'event_horizon_observatory' ? 2 : 0;
    this.skyDomeMat.uniforms['uThemeIndex']!.value = themeIdx;
    this.skyDomeMat.uniforms['uTopColor']!.value.copy(preset.skyTop);
    this.skyDomeMat.uniforms['uMidColor']!.value.copy(preset.skyMid);
    this.skyDomeMat.uniforms['uHorizonColor']!.value.copy(preset.skyHorizon);

    if (theme === 'mercury_dyson_forge') {
      this.conduitShaderMat.uniforms['uBaseColor']!.value.setHex(0xf07218);
      this.conduitShaderMat.uniforms['uPulseColor']!.value.setHex(0xffcf5c);
      this.deployFlowMat.uniforms['uBaseColor']!.value.setHex(0xff9b2e);
      this.deployFlowMat.uniforms['uAccentColor']!.value.setHex(0xffe07d);
    } else if (theme === 'event_horizon_observatory') {
      this.conduitShaderMat.uniforms['uBaseColor']!.value.setHex(0x38d8ff);
      this.conduitShaderMat.uniforms['uPulseColor']!.value.setHex(0xc084fc);
      this.deployFlowMat.uniforms['uBaseColor']!.value.setHex(0x46e0ff);
      this.deployFlowMat.uniforms['uAccentColor']!.value.setHex(0xf5cf72);
    } else {
      this.conduitShaderMat.uniforms['uBaseColor']!.value.setHex(0x38bdf8);
      this.conduitShaderMat.uniforms['uPulseColor']!.value.setHex(0xf4c85a);
      this.deployFlowMat.uniforms['uBaseColor']!.value.setHex(0x38c8ff);
      this.deployFlowMat.uniforms['uAccentColor']!.value.setHex(0xffd268);
    }

    this.bloomTargets.length = 0;
    this.bloomTargets.push(...this.sharedBloomTargets, ...this.themeBloomTargets[theme]);

    const ringHex = this.themeBenchRingColors[theme];
    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      if (!this.benchOccupied[slot]) {
        this.tempColor.setHex(slot === CRYO_BENCH_SLOT ? 0x67d4ea : ringHex);
        this.benchRingsInstanced.setColorAt(slot, this.tempColor);
        this.benchArcInstanced.setColorAt(slot, this.tempColor);
      }
    }
    if (this.benchRingsInstanced.instanceColor) {
      this.benchRingsInstanced.instanceColor.needsUpdate = true;
    }
    if (this.benchArcInstanced.instanceColor) {
      this.benchArcInstanced.instanceColor.needsUpdate = true;
    }

    this.triggerConduitSweep();
  }

  public getTheme(): ArenaThemeId {
    return this.currentTheme;
  }

  public setBattleGridDimmed(inBattle: boolean): void {
    this.battleGridOpacitySpring.setTarget(inBattle ? 0.16 : 0.28);
    if (inBattle) {
      this.deployHighlightActive = false;
      this.deployHighlightSpring.setTarget(0.0);
      this.deployFlowHighlightSpring.setTarget(0.0);
    } else {
      this.deployHighlightSpring.setTarget(this.deployHighlightActive ? 0.78 : 0.30);
      this.deployFlowHighlightSpring.setTarget(this.deployHighlightActive ? 1.0 : 0.0);
    }
  }

  public setDeployHighlightActive(active: boolean): void {
    this.deployHighlightActive = active;
    this.deployHighlightSpring.setTarget(active ? 0.82 : 0.30);
    this.deployFlowHighlightSpring.setTarget(active ? 1.0 : 0.0);
  }

  public setHoveredHex(coord: HexCoord | null): void {
    const nextIdx = coord ? coord.row * BOARD_COLS + coord.col : -1;
    if (nextIdx === this.hoveredHexIndex) return;
    if (this.hoveredHexIndex >= 0) {
      this.hexHoverSprings[this.hoveredHexIndex]?.setTarget(0);
    }
    this.hoveredHexIndex = nextIdx;
    if (nextIdx >= 0 && coord) {
      this.hexHoverSprings[nextIdx]?.setTarget(0.04);
      const { x, z } = hexToStageXZ(coord.row, coord.col);
      this.hoverFresnelRing.position.set(x, 0.052, z);
      this.hoverFresnelRing.visible = true;
      if (coord.row >= DEPLOY_START_ROW) {
        this.deployHighlightSpring.setTarget(0.74);
      }
    } else {
      this.hoverFresnelRing.visible = false;
      if (!this.deployHighlightActive) {
        this.deployHighlightSpring.setTarget(0.28);
      }
    }
  }

  public setRangeHighlight(origin: HexCoord | null, range: number | null): void {
    if (!origin || !range || range <= 0) {
      this.rangeDashedLines.visible = false;
      return;
    }
    const hexes = getHexesWithinRange(origin, range);
    const verts: number[] = [];
    const r = HEX_RADIUS * 0.94;
    for (const hc of hexes) {
      const center = hexToStageXZ(hc.row, hc.col);
      for (let i = 0; i < 6; i += 1) {
        const a0 = (Math.PI / 3) * i + Math.PI / 6;
        const a1 = (Math.PI / 3) * ((i + 1) % 6) + Math.PI / 6;
        verts.push(
          center.x + Math.cos(a0) * r,
          0.038,
          center.z + Math.sin(a0) * r,
          center.x + Math.cos(a1) * r,
          0.038,
          center.z + Math.sin(a1) * r,
        );
      }
    }
    const nextGeo = new THREE.BufferGeometry();
    nextGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.rangeDashedLines.geometry.dispose();
    this.rangeDashedLines.geometry = nextGeo;
    this.rangeDashedLines.computeLineDistances();
    this.rangeDashedLines.visible = verts.length > 0;
  }

  public setFriendlySwapArc(
    fromXZ: { x: number; z: number } | null,
    toXZ: { x: number; z: number } | null,
  ): void {
    if (!fromXZ || !toXZ) {
      this.swapArcGroup.visible = false;
      return;
    }
    const dist = Math.hypot(toXZ.x - fromXZ.x, toXZ.z - fromXZ.z);
    if (dist < 0.25) {
      this.swapArcGroup.visible = false;
      return;
    }
    const midX = (fromXZ.x + toXZ.x) * 0.5;
    const midZ = (fromXZ.z + toXZ.z) * 0.5;
    const archH = Math.min(2.4, 0.85 + dist * 0.24);

    this.swapArcCurve.v0.set(fromXZ.x, 0.22, fromXZ.z);
    this.swapArcCurve.v1.set(midX, archH, midZ);
    this.swapArcCurve.v2.set(toXZ.x, 0.22, toXZ.z);

    const newTube = new THREE.TubeGeometry(this.swapArcCurve, 20, 0.036, 6, false);
    this.swapArcMesh.geometry.dispose();
    this.swapArcMesh.geometry = newTube;

    const tStart = this.swapArcCurve.getTangent(0.05).negate();
    this.swapArrowStart.position.copy(this.swapArcCurve.getPoint(0.04));
    this.swapArrowStart.quaternion.setFromUnitVectors(this.tempYAxis, tStart);

    const tEnd = this.swapArcCurve.getTangent(0.95);
    this.swapArrowEnd.position.copy(this.swapArcCurve.getPoint(0.96));
    this.swapArrowEnd.quaternion.setFromUnitVectors(this.tempYAxis, tEnd);

    this.swapArcGroup.visible = true;
  }

  public setBenchOccupancy(occupiedSlots: ReadonlySet<number>): void {
    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const occ = occupiedSlots.has(slot);
      this.benchOccupied[slot] = occ;
      this.benchDepressSprings[slot]?.setTarget(occ ? -0.025 : 0);
    }
  }

  public setCryoPodEnabled(enabled: boolean): void {
    this.cryoEnabled = enabled;
    this.cryoSlideSpring.setTarget(enabled ? 1 : 0);
  }

  public setIntegerGold(gold: number): void {
    this.currentGold = Math.max(0, Math.floor(gold));
    for (let i = 0; i < this.interestPodCoords.length; i += 1) {
      const info = this.interestPodCoords[i]!;
      const threshold = (info.tier + 1) * 10;
      this.interestLiftSprings[i]?.setTarget(this.currentGold >= threshold ? 1 : 0);
    }
  }

  public triggerConduitSweep(): void {
    this.conduitSweepProgress = -0.25;
  }

  public update(dt: number): void {
    this.elapsedSec += dt;
    this.skyDomeMat.uniforms['uTime']!.value = this.elapsedSec;
    for (const mat of this.animatedShaderMats) {
      mat.uniforms['uTime']!.value = this.elapsedSec;
    }

    this.materials.hexBezelGoldMat.opacity = this.battleGridOpacitySpring.step(dt);
    const deployOpacity = this.deployHighlightSpring.step(dt);
    this.materials.hexBezelDeployMat.opacity = deployOpacity;
    this.deployFlowMat.uniforms['uOpacity']!.value = deployOpacity;
    this.deployFlowMat.uniforms['uHighlight']!.value = this.deployFlowHighlightSpring.step(dt);

    let anyHexMoved = false;
    for (let i = 0; i < TOTAL_HEXES; i += 1) {
      const sp = this.hexHoverSprings[i]!;
      if (!sp.isSettled()) {
        const yLift = sp.step(dt);
        const row = Math.floor(i / BOARD_COLS);
        const col = i % BOARD_COLS;
        this.writeHexInstanceTransform(i, row, col, yLift);
        anyHexMoved = true;
      }
    }
    if (anyHexMoved) {
      this.hexBezelInstanced.instanceMatrix.needsUpdate = true;
      this.deployBezelInstanced.instanceMatrix.needsUpdate = true;
      this.hexPlateInstanced.instanceMatrix.needsUpdate = true;
    }

    if (this.hoveredHexIndex >= 0) {
      const lift = this.hexHoverSprings[this.hoveredHexIndex]?.value ?? 0;
      this.hoverFresnelRing.position.y = 0.022 + lift;
    }

    const breath = 0.5 + 0.5 * Math.sin(this.elapsedSec * 3.1);
    const defaultBenchHex = this.themeBenchRingColors[this.currentTheme];
    let benchMoved = false;
    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const sp = this.benchDepressSprings[slot]!;
      if (!sp.isSettled() || this.benchOccupied[slot]) {
        const dep = sp.step(dt);
        const center = benchSlotToStageXZ(slot);
        this.tempMatrix.makeTranslation(center.x, 0.056 + dep, center.z);
        this.benchRingsInstanced.setMatrixAt(slot, this.tempMatrix);
        this.tempMatrix.makeTranslation(center.x, 0.062 + dep, center.z);
        this.benchArcInstanced.setMatrixAt(slot, this.tempMatrix);
        if (this.benchOccupied[slot]) {
          const boost = 1.0 + breath * 0.22;
          this.tempColor.setRGB(0.92 * boost, 0.82 * boost, 0.58 * boost);
        } else {
          this.tempColor.setHex(slot === CRYO_BENCH_SLOT ? 0x67d4ea : defaultBenchHex);
        }
        this.benchRingsInstanced.setColorAt(slot, this.tempColor);
        this.benchArcInstanced.setColorAt(slot, this.tempColor);
        benchMoved = true;
      }
    }
    if (benchMoved) {
      this.benchRingsInstanced.instanceMatrix.needsUpdate = true;
      this.benchArcInstanced.instanceMatrix.needsUpdate = true;
      if (this.benchRingsInstanced.instanceColor) {
        this.benchRingsInstanced.instanceColor.needsUpdate = true;
      }
      if (this.benchArcInstanced.instanceColor) {
        this.benchArcInstanced.instanceColor.needsUpdate = true;
      }
    }

    const cryoT = this.cryoSlideSpring.step(dt);
    const slot8XZ = benchSlotToStageXZ(CRYO_BENCH_SLOT);
    this.cryoCanopyMesh.position.z = slot8XZ.z + 0.54 * (1 - cryoT);
    this.cryoCanopyMesh.position.y = 0.12 + cryoT * 0.24;
    this.cryoLampMat.emissiveIntensity = this.cryoEnabled ? 0.92 + breath * 0.26 : 0.28;

    for (let i = 0; i < this.interestPodCoords.length; i += 1) {
      const lift = this.interestLiftSprings[i]!.step(dt);
      const coord = this.interestPodCoords[i]!;
      const rotY = lift * Math.PI * 0.5 + (lift > 0.5 ? this.elapsedSec * 0.45 : 0);
      this.tempPos.set(coord.x, 0.22 + lift * 0.14, coord.z);
      this.tempQuat.setFromAxisAngle(this.tempYAxis, rotY);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.interestCollarsInstanced.setMatrixAt(i, this.tempMatrix);
    }
    this.interestCollarsInstanced.instanceMatrix.needsUpdate = true;

    this.interestCrystalMat.uniforms['uTime']!.value = this.elapsedSec;
    for (let tier = 0; tier < INTEREST_POD_TIERS; tier += 1) {
      const liftVal = this.interestLiftSprings[tier]!.value;
      this.interestActiveAttr.setX(tier, liftVal);
      this.interestActiveAttr.setX(tier + INTEREST_POD_TIERS, liftVal);
    }
    this.interestActiveAttr.needsUpdate = true;

    if (this.conduitSweepProgress < 1.35) {
      this.conduitSweepProgress += dt * 1.65;
    }
    this.conduitShaderMat.uniforms['uSweep']!.value = this.conduitSweepProgress;
    this.conduitShaderMat.uniforms['uTime']!.value = this.elapsedSec;

    if (this.currentTheme === 'orbital_elevator_port') {
      this.tempScale.set(1, 1, 1);
      for (let i = 0; i < this.airships.length; i += 1) {
        const sh = this.airships[i]!;
        const ang = this.elapsedSec * sh.speed + sh.phase;
        const x = Math.cos(ang) * sh.radiusX;
        const z = sh.centerZ + Math.sin(ang) * sh.radiusZ;
        const y = sh.baseY + Math.sin(ang * 2.0) * 0.24;
        const vx = -Math.sin(ang) * sh.radiusX;
        const vz = Math.cos(ang) * sh.radiusZ;
        this.tempPos.set(x, y, z);
        this.tempEuler.set(0, Math.atan2(vx, vz), -Math.cos(ang) * 0.16);
        this.tempQuat.setFromEuler(this.tempEuler);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        for (const inst of this.airshipPartInstanced) {
          inst.setMatrixAt(i, this.tempMatrix);
        }
      }
      for (const inst of this.airshipPartInstanced) {
        inst.instanceMatrix.needsUpdate = true;
      }
      for (let i = 0; i < this.radarScanners.length; i += 1) {
        const sc = this.radarScanners[i]!;
        this.tempPos.set(sc.x, sc.y, sc.z);
        this.tempQuat.setFromAxisAngle(this.tempYAxis, this.elapsedSec * sc.speed);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        for (const inst of this.radarScannerInstanced) {
          inst.setMatrixAt(i, this.tempMatrix);
        }
      }
      for (const inst of this.radarScannerInstanced) {
        inst.instanceMatrix.needsUpdate = true;
      }
    } else if (this.currentTheme === 'mercury_dyson_forge') {
      for (let i = 0; i < this.dysonTowers.length; i += 1) {
        const tower = this.dysonTowers[i]!;
        this.tempEuler.set(
          tower.baseEuler.x,
          tower.baseEuler.y,
          Math.sin(this.elapsedSec * 0.58 + tower.phase) * 0.26,
          tower.baseEuler.order,
        );
        this.tempQuat.setFromEuler(this.tempEuler);
        this.tempScale.setScalar(tower.scale);
        this.tempMatrix.compose(tower.pos, this.tempQuat, this.tempScale);
        for (const inst of this.dysonMirrorInstanced) {
          inst.setMatrixAt(i, this.tempMatrix);
        }
      }
      this.tempScale.set(1, 1, 1);
      for (const inst of this.dysonMirrorInstanced) {
        inst.instanceMatrix.needsUpdate = true;
      }
      if (this.dysonOuterGear) {
        this.dysonOuterGear.rotation.y = this.elapsedSec * 0.085;
      }
      if (this.dysonInnerGear) {
        this.dysonInnerGear.rotation.y = -this.elapsedSec * 0.13;
      }
    } else if (this.currentTheme === 'event_horizon_observatory') {
      for (const reef of this.floatingReefs) {
        reef.rotY += dt * reef.rotSpeed;
        const ry = reef.baseY + Math.sin(this.elapsedSec * 0.85 + reef.phase) * reef.amp;
        this.tempPos.set(reef.x, ry, reef.z);
        this.tempQuat.setFromAxisAngle(this.tempYAxis, reef.rotY);
        this.tempScale.setScalar(reef.scale);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.reefRockInstanced[reef.rockVariant]!.setMatrixAt(reef.rockSlot, this.tempMatrix);
        if (reef.isGoldBand) {
          this.reefGoldBandInstanced!.setMatrixAt(reef.bandSlot, this.tempMatrix);
        } else {
          this.reefAmethystBandInstanced!.setMatrixAt(reef.bandSlot, this.tempMatrix);
        }
        if (reef.shardSlot >= 0) {
          this.reefShardInstanced!.setMatrixAt(reef.shardSlot, this.tempMatrix);
        }
      }
      this.tempScale.set(1, 1, 1);
      for (const ri of this.reefRockInstanced) ri.instanceMatrix.needsUpdate = true;
      if (this.reefGoldBandInstanced) this.reefGoldBandInstanced.instanceMatrix.needsUpdate = true;
      if (this.reefAmethystBandInstanced) {
        this.reefAmethystBandInstanced.instanceMatrix.needsUpdate = true;
      }
      if (this.reefShardInstanced) this.reefShardInstanced.instanceMatrix.needsUpdate = true;

      for (let i = 0; i < this.armillaryTowers.length; i += 1) {
        const arm = this.armillaryTowers[i]!;
        const cy = arm.y + 1.56;
        this.tempPos.set(arm.x, cy, arm.z);

        this.tempEuler.set(0, this.elapsedSec * 0.28 + arm.phase, 0);
        this.tempQuat.setFromEuler(this.tempEuler);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.armillaryOuterInstanced?.setMatrixAt(i, this.tempMatrix);

        this.tempEuler.set(0.65 + this.elapsedSec * 0.42, 0.40 - this.elapsedSec * 0.30, 0.2);
        this.tempQuat.setFromEuler(this.tempEuler);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.armillaryMidInstanced?.setMatrixAt(i, this.tempMatrix);

        this.tempEuler.set(1.1, -0.5, 0.80 + this.elapsedSec * 0.56);
        this.tempQuat.setFromEuler(this.tempEuler);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.armillaryInnerInstanced?.setMatrixAt(i, this.tempMatrix);

        this.tempPos.set(arm.x, cy + Math.sin(this.elapsedSec * 1.6 + arm.phase) * 0.08, arm.z);
        this.tempQuat.setFromAxisAngle(this.tempYAxis, -this.elapsedSec * 0.72);
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        this.armillaryCoreInstanced?.setMatrixAt(i, this.tempMatrix);
      }
      if (this.armillaryOuterInstanced) this.armillaryOuterInstanced.instanceMatrix.needsUpdate = true;
      if (this.armillaryMidInstanced) this.armillaryMidInstanced.instanceMatrix.needsUpdate = true;
      if (this.armillaryInnerInstanced) this.armillaryInnerInstanced.instanceMatrix.needsUpdate = true;
      if (this.armillaryCoreInstanced) this.armillaryCoreInstanced.instanceMatrix.needsUpdate = true;

      for (const sp of this.blackHoleSpinners) {
        sp.rotation.z = this.elapsedSec * 0.22;
      }
    }
  }

  public dispose(): void {
    this.rangeDashedLines.geometry.dispose();
    this.swapArcMesh.geometry.dispose();
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.ownedTextures) t.dispose();
  }
}
