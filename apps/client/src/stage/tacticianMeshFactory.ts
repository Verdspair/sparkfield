import * as THREE from 'three';
import { LoopSubdivision } from 'three-subdivide';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  createShellFurGroup,
  createSoftSssMaterial,
  type PbrMaterialLibrary,
} from './pbrMaterials.js';
import type { TacticianEmoteKind, TacticianId } from './types.js';

export interface TacticianCatalogEntry {
  readonly id: TacticianId;
  readonly name: string;
  readonly subtitle: string;
  readonly factionLabel: string;
  readonly rarity: 'free_signature';
  readonly accentHex: string;
  readonly secondaryHex: string;
  readonly description: string;
}

export const TACTICIAN_IDS: readonly TacticianId[] = [
  'tactician_lumina_bell',
  'tactician_europa_fin',
  'tactician_singularity_mew',
];

export const DEFAULT_TACTICIAN_ID: TacticianId = 'tactician_lumina_bell';

export const TACTICIAN_CATALOG: readonly TacticianCatalogEntry[] = [
  {
    id: 'tactician_lumina_bell',
    name: '星汐 · 小铃',
    subtitle: 'Lumina-Bell',
    factionLabel: '戴森工团',
    rarity: 'free_signature',
    accentHex: '#f2c97d',
    secondaryHex: '#4fd1ff',
    description: '三瓣白瓷锻金星穹光铃、精切引力晶芯与三道黄铜星轨环领航圣体',
  },
  {
    id: 'tactician_europa_fin',
    name: '冰核 · 小鲸',
    subtitle: 'Europa-Fin',
    factionLabel: '木卫冰海',
    rarity: 'free_signature',
    accentHex: '#4fd1ff',
    secondaryHex: '#34d399',
    description: '半透明冰蓝玉质深海星鳐、幽蓝星轨荧光肋骨与镀金测绘背冠灵体',
  },
  {
    id: 'tactician_singularity_mew',
    name: '奇点 · 小猫',
    subtitle: 'Singularity-Mew',
    factionLabel: '视界观测台',
    rarity: 'free_signature',
    accentHex: '#c084fc',
    secondaryHex: '#f2c97d',
    description: '黑曜天鹅绒短毛星穹猞猁、冷金竖瞳与尾尖微缩事件视界吸积环灵兽',
  },
];

export interface TacticianRig {
  readonly id: TacticianId;
  readonly root: THREE.Group;
  readonly visualPivot: THREE.Group;
  readonly bloomTargets: THREE.Object3D[];
  triggerEmote(kind: TacticianEmoteKind): number;
  update(dt: number, elapsedSec: number): void;
  dispose(): void;
}

interface BurstParticle {
  readonly pos: THREE.Vector3;
  readonly vel: THREE.Vector3;
  scale: number;
  age: number;
  life: number;
  active: boolean;
}

function smoothSubdivide(
  rawGeo: THREE.BufferGeometry,
  iterations = 1,
  split = false,
  stripUv = false,
): THREE.BufferGeometry {
  const scaled = rawGeo.clone();
  scaled.scale(10, 10, 10);
  const sub = LoopSubdivision.modify(scaled, iterations, {
    split,
    uvSmooth: true,
    preserveEdges: false,
  });
  scaled.dispose();
  rawGeo.dispose();
  sub.scale(0.1, 0.1, 0.1);
  const clean = new THREE.BufferGeometry();
  const pos = sub.getAttribute('position');
  clean.setAttribute('position', pos.clone());
  const uv = sub.getAttribute('uv');
  if (uv && !stripUv) {
    clean.setAttribute('uv', uv.clone());
  }
  sub.dispose();
  const merged = mergeVertices(clean, 1e-4);
  clean.dispose();
  merged.computeVertexNormals();
  return merged;
}

function createTaperedCurveGeo(
  points: THREE.Vector3[],
  radii: number[],
  tubularSegs: number,
  radialSegs: number,
  aspectX = 1.0,
  capEnds = true,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points);
  const frames = curve.computeFrenetFrames(tubularSegs, false);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const getRadius = (t: number): number => {
    const scaled = t * (radii.length - 1);
    const i0 = Math.min(radii.length - 1, Math.floor(scaled));
    const i1 = Math.min(radii.length - 1, i0 + 1);
    const f = scaled - i0;
    return (radii[i0] ?? 0.05) * (1 - f) + (radii[i1] ?? 0.05) * f;
  };

  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const b = new THREE.Vector3();
  const v = new THREE.Vector3();

  for (let i = 0; i <= tubularSegs; i += 1) {
    const t = i / tubularSegs;
    curve.getPointAt(t, p);
    n.copy(frames.normals[i]!);
    b.copy(frames.binormals[i]!);
    const r = Math.max(0.0025, getRadius(t));

    for (let j = 0; j <= radialSegs; j += 1) {
      const ang = (j / radialSegs) * Math.PI * 2;
      const ca = Math.cos(ang) * r * aspectX;
      const sa = Math.sin(ang) * r;
      v.copy(p).addScaledVector(n, ca).addScaledVector(b, sa);
      positions.push(v.x, v.y, v.z);
      uvs.push(j / radialSegs, t);
    }
  }

  const stride = radialSegs + 1;
  for (let i = 0; i < tubularSegs; i += 1) {
    for (let j = 0; j < radialSegs; j += 1) {
      const a = i * stride + j;
      const bIdx = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, d, bIdx, bIdx, d, c);
    }
  }

  if (capEnds) {
    const startCenterIdx = positions.length / 3;
    const pStart = curve.getPointAt(0);
    positions.push(pStart.x, pStart.y, pStart.z);
    uvs.push(0.5, 0);
    for (let j = 0; j < radialSegs; j += 1) {
      indices.push(startCenterIdx, j, j + 1);
    }
    const endCenterIdx = positions.length / 3;
    const pEnd = curve.getPointAt(1);
    positions.push(pEnd.x, pEnd.y, pEnd.z);
    uvs.push(0.5, 1);
    const base = tubularSegs * stride;
    for (let j = 0; j < radialSegs; j += 1) {
      indices.push(endCenterIdx, base + j + 1, base + j);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function bellRadiusProfile(t: number): number {
  const rimFlare = Math.pow(1 - t, 2.25) * 0.24;
  const shoulder = Math.sin(Math.pow(t, 0.76) * Math.PI) * 0.132;
  const baseTaper = 0.084 + (1 - t) * 0.145;
  return baseTaper + rimFlare + shoulder;
}

function bellHeightProfile(t: number): number {
  return 0.56 + Math.pow(t, 0.94) * 0.65;
}

function createSculptedBellPetalGeo(
  halfArcRad = 0.66,
  wallThick = 0.030,
  uSegs = 12,
  vSegs = 14,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const evalShell = (
    uNorm: number,
    t: number,
    isInner: boolean,
  ): [number, number, number] => {
    const edgeFactor = Math.abs(uNorm);
    const archCut =
      Math.pow(edgeFactor, 1.85) * (0.14 * Math.sin(t * Math.PI) + 0.055 * (1 - t));
    const spanMod =
      1.0 -
      0.26 * Math.pow(t, 1.38) -
      0.11 * Math.sin(t * Math.PI) +
      0.08 * Math.pow(1 - t, 2.1);
    const theta = uNorm * halfArcRad * spanMod;
    const baseR = bellRadiusProfile(t);
    const flute = Math.cos(uNorm * Math.PI * 0.5) * 0.024 * Math.sin(t * Math.PI * 0.85);
    const edgeBevel = Math.pow(edgeFactor, 3.0) * wallThick * 0.28;
    const localThick = wallThick * (0.74 + 0.34 * (1 - t)) - edgeBevel;
    const r = baseR + flute + (isInner ? -localThick : 0.0);
    const scallopDrop =
      -Math.cos(uNorm * Math.PI * 0.5) * 0.062 * Math.pow(1 - t, 2.2) +
      archCut * 0.28;
    const y = bellHeightProfile(t) + scallopDrop;
    return [Math.sin(theta) * r, y, Math.cos(theta) * r];
  };

  const stride = uSegs + 1;
  const layerVerts = (vSegs + 1) * stride;

  for (let layer = 0; layer < 2; layer += 1) {
    const isInner = layer === 1;
    for (let iv = 0; iv <= vSegs; iv += 1) {
      const t = iv / vSegs;
      for (let iu = 0; iu <= uSegs; iu += 1) {
        const uNorm = (iu / uSegs) * 2 - 1;
        const [x, y, z] = evalShell(uNorm, t, isInner);
        positions.push(x, y, z);
        uvs.push(iu / uSegs, t);
      }
    }
  }

  for (let iv = 0; iv < vSegs; iv += 1) {
    for (let iu = 0; iu < uSegs; iu += 1) {
      const a = iv * stride + iu;
      const b = (iv + 1) * stride + iu;
      const c = (iv + 1) * stride + iu + 1;
      const d = iv * stride + iu + 1;
      indices.push(a, d, b, b, d, c);

      const ia = layerVerts + a;
      const ib = layerVerts + b;
      const ic = layerVerts + c;
      const id = layerVerts + d;
      indices.push(ia, ib, id, ib, ic, id);
    }
  }

  for (let iu = 0; iu < uSegs; iu += 1) {
    const o0 = iu;
    const o1 = iu + 1;
    const i0 = layerVerts + iu;
    const i1 = layerVerts + iu + 1;
    indices.push(o0, i0, o1, o1, i0, i1);

    const to0 = vSegs * stride + iu;
    const to1 = vSegs * stride + iu + 1;
    const ti0 = layerVerts + to0;
    const ti1 = layerVerts + to1;
    indices.push(to0, to1, ti0, to1, ti1, ti0);
  }

  for (let iv = 0; iv < vSegs; iv += 1) {
    const lo0 = iv * stride;
    const lo1 = (iv + 1) * stride;
    const li0 = layerVerts + lo0;
    const li1 = layerVerts + lo1;
    indices.push(lo0, lo1, li0, lo1, li1, li0);

    const ro0 = iv * stride + uSegs;
    const ro1 = (iv + 1) * stride + uSegs;
    const ri0 = layerVerts + ro0;
    const ri1 = layerVerts + ro1;
    indices.push(ro0, ri0, ro1, ro1, ri0, ri1);
  }

  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  raw.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  raw.setIndex(indices);
  return smoothSubdivide(raw, 1);
}

function createPetalGoldTrimGeo(halfArcRad = 0.66): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const evalOuter = (uNorm: number, t: number, offsetR = 0.008): THREE.Vector3 => {
    const edgeFactor = Math.abs(uNorm);
    const archCut =
      Math.pow(edgeFactor, 1.85) * (0.14 * Math.sin(t * Math.PI) + 0.055 * (1 - t));
    const spanMod =
      1.0 -
      0.26 * Math.pow(t, 1.38) -
      0.11 * Math.sin(t * Math.PI) +
      0.08 * Math.pow(1 - t, 2.1);
    const theta = uNorm * halfArcRad * spanMod;
    const baseR = bellRadiusProfile(t);
    const flute = Math.cos(uNorm * Math.PI * 0.5) * 0.024 * Math.sin(t * Math.PI * 0.85);
    const r = baseR + flute + offsetR;
    const scallopDrop =
      -Math.cos(uNorm * Math.PI * 0.5) * 0.062 * Math.pow(1 - t, 2.2) +
      archCut * 0.28;
    const y = bellHeightProfile(t) + scallopDrop;
    return new THREE.Vector3(Math.sin(theta) * r, y, Math.cos(theta) * r);
  };

  for (const side of [-1, 1]) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i += 1) {
      pts.push(evalOuter(side * 0.99, i / 10, 0.004));
    }
    parts.push(createTaperedCurveGeo(pts, [0.011, 0.0095, 0.0085, 0.008], 16, 6, 1.0, true));
  }

  const spinePts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i += 1) {
    spinePts.push(evalOuter(0, i / 10, 0.0095));
  }
  parts.push(createTaperedCurveGeo(spinePts, [0.013, 0.0105, 0.009, 0.010], 16, 6, 1.25, true));

  const rimPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i += 1) {
    rimPts.push(evalOuter((i / 12) * 2 - 1, 0.012, 0.006));
  }
  parts.push(createTaperedCurveGeo(rimPts, [0.010, 0.014, 0.010], 16, 6, 1.0, true));

  for (const tBand of [0.16, 0.40, 0.66, 0.84]) {
    const bandPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i += 1) {
      bandPts.push(evalOuter((i / 10) * 2 - 1, tBand, 0.0065));
    }
    parts.push(createTaperedCurveGeo(bandPts, [0.005, 0.0068, 0.005], 14, 5, 1.0, true));
  }

  const normalized = parts.map((g) => {
    const ng = normalizeGeometryForMerge(g, new THREE.Matrix4());
    g.dispose();
    return ng;
  });
  const merged = mergeGeometries(normalized, false)!;
  for (const n of normalized) n.dispose();
  return merged;
}

function createFacetedClapperCrystalGeo(): THREE.BufferGeometry {
  const sides = 10;
  const rings: [number, number][] = [
    [-0.27, 0.0],
    [-0.14, 0.105],
    [-0.01, 0.152],
    [0.10, 0.118],
    [0.23, 0.0],
  ];
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let rIdx = 0; rIdx < rings.length; rIdx += 1) {
    const [y, rad] = rings[rIdx]!;
    const twist = rIdx === 2 ? Math.PI / sides : 0;
    for (let s = 0; s <= sides; s += 1) {
      const a = (s / sides) * Math.PI * 2 + twist;
      const facetMod = s % 2 === 0 ? 1.0 : 0.93;
      positions.push(Math.cos(a) * rad * facetMod, y, Math.sin(a) * rad * facetMod);
      uvs.push(s / sides, rIdx / (rings.length - 1));
    }
  }

  const stride = sides + 1;
  for (let rIdx = 0; rIdx < rings.length - 1; rIdx += 1) {
    for (let s = 0; s < sides; s += 1) {
      const a = rIdx * stride + s;
      const b = (rIdx + 1) * stride + s;
      const c = (rIdx + 1) * stride + s + 1;
      const d = rIdx * stride + s + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  indexed.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  indexed.setIndex(indices);
  const faceted = indexed.toNonIndexed();
  indexed.dispose();
  faceted.computeVertexNormals();
  return faceted;
}

function createGraduatedAstrolabeRingGeo(
  radius: number,
  bandWidth: number,
  bandHeight: number,
  tickCount: number,
): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const ringSegs = 56;
  const profile: [number, number][] = [
    [-bandWidth * 0.5, -bandHeight * 0.35],
    [-bandWidth * 0.32, -bandHeight * 0.5],
    [bandWidth * 0.32, -bandHeight * 0.5],
    [bandWidth * 0.5, -bandHeight * 0.35],
    [bandWidth * 0.5, bandHeight * 0.35],
    [bandWidth * 0.32, bandHeight * 0.5],
    [-bandWidth * 0.32, bandHeight * 0.5],
    [-bandWidth * 0.5, bandHeight * 0.35],
  ];
  const pLen = profile.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= ringSegs; i += 1) {
    const u = i / ringSegs;
    const ang = u * Math.PI * 2;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let j = 0; j <= pLen; j += 1) {
      const [dr, dy] = profile[j % pLen]!;
      const rr = radius + dr;
      positions.push(ca * rr, dy, sa * rr);
      uvs.push(u * 4, j / pLen);
    }
  }

  const stride = pLen + 1;
  for (let i = 0; i < ringSegs; i += 1) {
    for (let j = 0; j < pLen; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const mainRing = new THREE.BufferGeometry();
  mainRing.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  mainRing.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  mainRing.setIndex(indices);
  mainRing.computeVertexNormals();
  parts.push(mainRing);

  const tickGeo = new THREE.BoxGeometry(bandWidth * 0.72, bandHeight * 1.48, 0.0085);
  const bossGeo = new THREE.OctahedronGeometry(bandWidth * 0.86, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < tickCount; i += 1) {
    const ang = (i / tickCount) * Math.PI * 2;
    const isCardinal = i % Math.max(1, Math.floor(tickCount / 4)) === 0;
    const rr = radius + (isCardinal ? bandWidth * 0.15 : bandWidth * 0.08);
    pos.set(Math.cos(ang) * rr, 0, Math.sin(ang) * rr);
    q.setFromAxisAngle(yAxis, -ang);
    if (isCardinal) {
      scl.set(1.0, 0.75, 1.0);
      m.compose(pos, q, scl);
      parts.push(normalizeGeometryForMerge(bossGeo, m));
    } else {
      scl.set(1, 1, 1);
      m.compose(pos, q, scl);
      parts.push(normalizeGeometryForMerge(tickGeo, m));
    }
  }

  tickGeo.dispose();
  bossGeo.dispose();

  const normalized = parts.map((g) => {
    const ng = normalizeGeometryForMerge(g, new THREE.Matrix4());
    g.dispose();
    return ng;
  });
  const merged = mergeGeometries(normalized, false)!;
  for (const n of normalized) n.dispose();
  return merged;
}

function createSpiralRibbonGeo(
  startAngle: number,
  radiusTop: number,
  radiusBot: number,
  yTop: number,
  yBot: number,
  spiralSweep: number,
  widthTop: number,
  widthBot: number,
  lengthSegs = 24,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= lengthSegs; i += 1) {
    const t = i / lengthSegs;
    const ang = startAngle + t * spiralSweep;
    const waveR = Math.sin(t * Math.PI * 1.7) * 0.075;
    const r = radiusTop + (radiusBot - radiusTop) * Math.pow(t, 0.78) + waveR;
    const y = yTop + (yBot - yTop) * t;
    const halfW = (widthTop + (widthBot - widthTop) * t) * Math.sin(Math.pow(t, 0.38) * Math.PI * 0.90 + 0.18);
    const cx = Math.cos(ang) * r;
    const cz = Math.sin(ang) * r;
    const tx = -Math.sin(ang);
    const tz = Math.cos(ang);
    const rx = Math.cos(ang);
    const rz = Math.sin(ang);

    for (let j = 0; j <= 2; j += 1) {
      const u = j / 2;
      const offset = (u * 2 - 1) * halfW;
      const camber = (1 - (u * 2 - 1) * (u * 2 - 1)) * 0.022;
      positions.push(
        cx + tx * offset + rx * camber,
        y - Math.abs(offset) * 0.16,
        cz + tz * offset + rz * camber,
      );
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < lengthSegs; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      const a = i * 3 + j;
      const b = (i + 1) * 3 + j;
      const c = (i + 1) * 3 + j + 1;
      const d = i * 3 + j + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createBionicStarMantaBodyGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.42, 36, 26);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i += 1) {
    const nx = pos.getX(i) / 0.42;
    const ny = pos.getY(i) / 0.42;
    const nz = pos.getZ(i) / 0.42;

    let z = nz * 0.72;
    let widthScale = 1.0;
    let heightScale = 1.0;
    let archY = 0.0;

    if (nz >= 0) {
      const t = nz;
      const prowTaper = Math.pow(1 - t * 0.78, 0.68);
      widthScale = 0.92 * prowTaper + 0.08 * (1 - t);
      heightScale = 0.56 * Math.pow(1 - t * 0.72, 0.78);
      const cranialCrest =
        Math.exp(-Math.pow((t - 0.30) / 0.34, 2)) * Math.max(0, ny) * 0.055;
      const hydroKeel =
        ny > 0.2 ? Math.pow(ny - 0.2, 1.5) * (1 - Math.abs(nx)) * 0.038 : 0;
      const ventralFlatten = ny < 0 ? 0.64 : 1.0;
      heightScale *= ventralFlatten;
      archY = cranialCrest + hydroKeel + Math.sin(t * Math.PI * 0.85) * 0.032 - Math.pow(t, 2.2) * 0.025;
      z = t * 0.68;
    } else {
      const t = -nz;
      const tailTaper = Math.pow(1 - t * 0.88, 1.42);
      widthScale = 0.10 + 0.82 * tailTaper;
      heightScale = 0.09 + 0.48 * Math.pow(1 - t * 0.84, 1.24);
      archY = -Math.pow(t, 1.55) * 0.13 + Math.sin(t * Math.PI) * 0.048;
      z = -t * 0.80;
    }

    const x = nx * 0.34 * widthScale;
    const y = ny * 0.30 * heightScale + archY;
    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createBionicMantaWingGeo(side: 1 | -1): THREE.BufferGeometry {
  const spanSegs = 14;
  const chordSegs = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= spanSegs; i += 1) {
    const s = i / spanSegs;
    const spanX = side * (0.08 + Math.pow(s, 0.88) * 0.74);
    const sweepZ = 0.18 - Math.pow(s, 1.25) * 0.46 - Math.sin(s * Math.PI) * 0.05;
    const dihedralY = Math.sin(s * Math.PI * 0.75) * 0.095 - Math.pow(s, 2.1) * 0.03;
    const chord = 0.56 * Math.pow(1 - s * 0.86, 0.78) + 0.04 * Math.sin(s * Math.PI);
    const thick = 0.072 * Math.pow(1 - s * 0.86, 1.15);

    for (let j = 0; j <= chordSegs; j += 1) {
      const theta = (j / chordSegs) * Math.PI * 2;
      const c = Math.cos(theta);
      const sn = Math.sin(theta);
      const airfoilU = 0.5 * (1 + c);
      const camber = Math.sin(airfoilU * Math.PI) * 0.026 * (1 - s * 0.35);
      const foilThickness =
        sn * thick * (0.42 + 0.58 * Math.pow(1 - airfoilU, 0.62));
      const localZ = sweepZ + (0.38 - airfoilU) * chord;
      const localY = dihedralY + camber + foilThickness;
      positions.push(spanX, localY, localZ);
      uvs.push(s, j / chordSegs);
    }
  }

  const stride = chordSegs + 1;
  for (let i = 0; i < spanSegs; i += 1) {
    for (let j = 0; j < chordSegs; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + j + 1;
      const d = i * stride + j + 1;
      if (side > 0) {
        indices.push(a, d, b, b, d, c);
      } else {
        indices.push(a, b, d, b, c, d);
      }
    }
  }

  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  raw.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  raw.setIndex(indices);
  return smoothSubdivide(raw, 1);
}

function createBionicTailFlukeGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const spanSegs = 9;
    const chordSegs = 8;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= spanSegs; i += 1) {
      const s = i / spanSegs;
      const x = side * (0.012 + Math.pow(s, 0.9) * 0.34);
      const sweepZ = -Math.pow(s, 1.32) * 0.28;
      const curlY = Math.sin(s * Math.PI * 0.85) * 0.028 + Math.pow(s, 1.8) * 0.048;
      const chord = 0.18 * Math.pow(1 - s * 0.82, 0.82);
      const thick = 0.032 * Math.pow(1 - s * 0.84, 1.18);
      for (let j = 0; j <= chordSegs; j += 1) {
        const ang = (j / chordSegs) * Math.PI * 2;
        const localZ = sweepZ + Math.cos(ang) * chord * 0.5;
        const localY = curlY + Math.sin(ang) * thick * 0.5;
        positions.push(x, localY, localZ);
        uvs.push(s, j / chordSegs);
      }
    }

    const stride = chordSegs + 1;
    for (let i = 0; i < spanSegs; i += 1) {
      for (let j = 0; j < chordSegs; j += 1) {
        const a = i * stride + j;
        const b = (i + 1) * stride + j;
        const c = (i + 1) * stride + j + 1;
        const d = i * stride + j + 1;
        if (side > 0) {
          indices.push(a, b, d, b, c, d);
        } else {
          indices.push(a, d, b, b, d, c);
        }
      }
    }

    const raw = new THREE.BufferGeometry();
    raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    raw.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    raw.setIndex(indices);
    parts.push(smoothSubdivide(raw, 1));
  }
  const normalized = parts.map((g) => {
    const ng = normalizeGeometryForMerge(g, new THREE.Matrix4());
    g.dispose();
    return ng;
  });
  const merged = mergeGeometries(normalized, false)!;
  for (const n of normalized) n.dispose();
  return merged;
}

function createSurveyFinBladeGeo(height: number, chord: number, sweep: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(chord * 0.28, height * 0.56, -sweep, height);
  shape.quadraticCurveTo(-chord * 0.52, height * 0.42, -chord, 0);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.011,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.0055);
  geo.rotateY(Math.PI * 0.5);
  return geo;
}

function createAuroraTailVeilGeo(
  length: number,
  widthBase: number,
  archY: number,
  curveX: number,
  segs = 18,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i += 1) {
    const t = i / segs;
    const z = -t * length;
    const y = Math.sin(t * Math.PI * 1.15) * archY - Math.pow(t, 1.38) * 0.32;
    const x = Math.sin(t * Math.PI * 0.92) * curveX;
    const halfW = widthBase * Math.sin(Math.pow(t, 0.44) * Math.PI * 0.92 + 0.14) * (1 - t * 0.48);
    for (let j = 0; j <= 2; j += 1) {
      const u = j / 2;
      const off = (u * 2 - 1) * halfW;
      const cup = (1 - (u * 2 - 1) * (u * 2 - 1)) * 0.016;
      positions.push(x + off, y + cup, z);
      uvs.push(u, t);
    }
  }

  for (let i = 0; i < segs; i += 1) {
    for (let j = 0; j < 2; j += 1) {
      const a = i * 3 + j;
      const b = (i + 1) * 3 + j;
      const c = (i + 1) * 3 + j + 1;
      const d = i * 3 + j + 1;
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createRealisticLynxHeadGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.16, 28, 22);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i += 1) {
    const nx = pos.getX(i) / 0.16;
    const ny = pos.getY(i) / 0.16;
    const nz = pos.getZ(i) / 0.16;

    let x = nx * 0.138;
    let y = ny * 0.124;
    let z = nz * 0.156;

    if (nz > 0) {
      const fwd = nz;
      const muzzleMask =
        Math.exp(-Math.pow((ny + 0.24) / 0.36, 2)) *
        Math.exp(-Math.pow(nx / 0.46, 2));
      const noseBridgeMask =
        Math.exp(-Math.pow((ny - 0.04) / 0.28, 2)) *
        Math.exp(-Math.pow(nx / 0.30, 2));
      z += Math.pow(fwd, 1.32) * (0.072 * muzzleMask + 0.042 * noseBridgeMask);
      x *= 1.0 - Math.pow(fwd, 1.4) * 0.38;
      y *= 1.0 - Math.pow(fwd, 1.7) * 0.16;

      const cheekRuffMask =
        Math.exp(-Math.pow((Math.abs(nx) - 0.78) / 0.28, 2)) *
        Math.exp(-Math.pow((ny + 0.26) / 0.34, 2)) *
        Math.exp(-Math.pow((nz - 0.20) / 0.46, 2));
      x += Math.sign(nx) * cheekRuffMask * 0.036;
      y -= cheekRuffMask * 0.014;

      const browMask =
        Math.exp(-Math.pow((Math.abs(nx) - 0.38) / 0.22, 2)) *
        Math.exp(-Math.pow((ny - 0.34) / 0.16, 2)) *
        Math.exp(-Math.pow((nz - 0.62) / 0.28, 2));
      z += browMask * 0.014;
      y += browMask * 0.008;

      const orbitMask =
        Math.exp(-Math.pow((Math.abs(nx) - 0.38) / 0.20, 2)) *
        Math.exp(-Math.pow((ny - 0.10) / 0.16, 2)) *
        Math.exp(-Math.pow((nz - 0.76) / 0.24, 2));
      z -= orbitMask * 0.022;

      const chinMask =
        Math.exp(-Math.pow((ny + 0.62) / 0.22, 2)) *
        Math.exp(-Math.pow(nx / 0.32, 2)) *
        Math.max(0, nz);
      z += chinMask * 0.028;
      y -= chinMask * 0.010;
    } else {
      const back = -nz;
      x *= 1.0 - back * 0.14;
      y *= 1.0 - back * 0.08;
    }

    if (ny > 0.38) {
      x *= 1.0 - (ny - 0.38) * 0.20;
      y -= Math.pow(ny - 0.38, 1.6) * 0.012;
    }

    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createUnifiedLynxBodyAndNeckGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.32, 26, 24);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i += 1) {
    const nx = pos.getX(i) / 0.32;
    const ny = pos.getY(i) / 0.32;
    const nz = pos.getZ(i) / 0.32;

    const t = (ny + 1) * 0.5;
    let rx = 0.14;
    let rz = 0.16;
    let centerZ = -0.05;

    if (t < 0.72) {
      const u = t / 0.72;
      rx =
        0.135 +
        0.045 * Math.exp(-Math.pow((u - 0.22) / 0.22, 2)) -
        0.036 * Math.exp(-Math.pow((u - 0.62) / 0.22, 2)) +
        0.014 * Math.exp(-Math.pow((u - 0.88) / 0.18, 2));
      rz =
        0.148 +
        0.068 * Math.exp(-Math.pow((u - 0.22) / 0.25, 2)) -
        0.016 * Math.exp(-Math.pow((u - 0.64) / 0.20, 2)) +
        0.018 * Math.exp(-Math.pow((u - 0.90) / 0.16, 2));
      centerZ = -0.10 + u * 0.18 + Math.sin(u * Math.PI) * 0.038;
      if (nz > 0) {
        centerZ += Math.exp(-Math.pow((u - 0.82) / 0.22, 2)) * nz * 0.036;
      }
    } else {
      const u = (t - 0.72) / 0.28;
      rx = 0.122 * (1 - u * 0.44);
      rz = 0.136 * (1 - u * 0.44);
      centerZ = 0.08 + u * 0.032 - Math.sin(u * Math.PI) * 0.012;
    }

    const endRound = Math.sin(Math.pow(Math.max(0.001, Math.min(0.999, t)), 0.75) * Math.PI);
    const capScale = Math.pow(endRound, 0.28);
    const y = 0.06 + t * 0.94;
    const x = nx * rx * capScale;
    const z = nz * rz * capScale + centerZ;
    pos.setXYZ(i, x, y, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function createSculptedFelinePawGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.048, 12, 10);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = x / 0.048;
    const ny = y / 0.048;
    const nz = z / 0.048;
    const flatBottom = ny < -0.25 ? -0.25 + (ny + 0.25) * 0.25 : ny;
    const toeTaper = nz > 0 ? 1.0 - nz * 0.18 : 1.0;
    const arch = Math.cos(nx * Math.PI * 0.45) * Math.max(0, nz) * 0.008;
    pos.setXYZ(i, x * 0.86 * toeTaper, flatBottom * 0.029 + arch, z * 1.48);
  }
  geo.computeVertexNormals();
  return geo;
}

function createSculptedLynxHaunchGeo(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.14, 16, 14);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const nx = pos.getX(i) / 0.14;
    const ny = pos.getY(i) / 0.14;
    const nz = pos.getZ(i) / 0.14;
    const topTaper = ny > 0 ? 1.0 - ny * 0.28 : 1.0;
    const fwdFold = nz > 0 ? 1.0 + Math.max(0, -ny) * 0.22 : 0.88;
    const x = nx * 0.088 * topTaper;
    const y = ny * 0.168;
    const z = nz * 0.148 * fwdFold - ny * 0.032;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createRealisticLynxEarGeo(
  baseWidth: number,
  height: number,
  cavityDepth: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const hSegs = 9;
  const rSegs = 12;

  for (let ih = 0; ih <= hSegs; ih += 1) {
    const t = ih / hSegs;
    const taper = Math.pow(1 - t, 0.84);
    const rootPinch = t < 0.14 ? 0.82 + (t / 0.14) * 0.18 : 1.0;
    const rx = Math.max(0.004, baseWidth * taper * rootPinch);
    const rz = Math.max(0.004, baseWidth * 0.66 * taper * rootPinch);
    const y = t * height - Math.pow(1 - t, 2.6) * 0.028;
    const sweepBack = -Math.pow(t, 1.55) * 0.026;

    for (let ir = 0; ir <= rSegs; ir += 1) {
      const u = ir / rSegs;
      const theta = u * Math.PI * 2;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      const scoop = s > 0 ? s * cavityDepth * Math.sin(t * Math.PI * 0.88) : 0;
      const x = c * rx;
      const z = s * rz - scoop + sweepBack;
      positions.push(x, y, z);
      uvs.push(u, t);
    }
  }

  const stride = rSegs + 1;
  for (let ih = 0; ih < hSegs; ih += 1) {
    for (let ir = 0; ir < rSegs; ir += 1) {
      const a = ih * stride + ir;
      const b = (ih + 1) * stride + ir;
      const c = (ih + 1) * stride + ir + 1;
      const d = ih * stride + ir + 1;
      indices.push(a, b, d, b, c, d);
    }
  }

  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  raw.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  raw.setIndex(indices);
  return smoothSubdivide(raw, 1, false, true);
}

function createAlmondEyeLensGeo(width: number, height: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(width, height, 10, 6);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const nx = x / (width * 0.5);
    const ny = y / (height * 0.5);
    const almondProfile = Math.max(0.06, Math.cos(nx * Math.PI * 0.48));
    const curvedY = y * almondProfile;
    const domeZ = Math.max(0, 1 - nx * nx * 0.62 - ny * ny * 0.52) * 0.013;
    pos.setXYZ(i, x, curvedY, domeZ);
  }
  geo.computeVertexNormals();
  return geo;
}

function createPrismaticCrystalShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    uniforms: {
      uTime: { value: 0 },
      uPulse: { value: 0 },
    },
    vertexShader: `
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vObjPos;

      void main() {
        vObjPos = position;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPulse;
      varying vec3 vWorldNormal;
      varying vec3 vViewDir;
      varying vec3 vObjPos;

      void main() {
        vec3 N = normalize(vWorldNormal);
        vec3 V = normalize(vViewDir);
        vec3 L1 = normalize(vec3(0.55, 0.78, 0.62));
        vec3 L2 = normalize(vec3(-0.62, 0.35, -0.55));
        float ndotv = max(dot(N, V), 0.0);
        float fresnel = pow(1.0 - ndotv, 2.0);

        vec3 H1 = normalize(L1 + V);
        vec3 H2 = normalize(L2 + V);
        float spec1 = pow(max(dot(N, H1), 0.0), 44.0);
        float spec2 = pow(max(dot(N, H2), 0.0), 24.0);

        float internalWave = 0.5 + 0.5 * sin(vObjPos.y * 34.0 - uTime * 3.2 + vObjPos.x * 18.0);
        float starBand = pow(0.5 + 0.5 * cos(vObjPos.y * 22.0 + uTime * 2.1 - vObjPos.z * 16.0), 3.0);

        vec3 deepGold = vec3(0.90, 0.64, 0.24);
        vec3 warmGold = vec3(1.00, 0.90, 0.58);
        vec3 celestialCyan = vec3(0.45, 0.90, 1.00);

        vec3 baseCol = mix(deepGold, warmGold, 0.42 + internalWave * 0.45);
        baseCol = mix(baseCol, celestialCyan, fresnel * 0.60 + starBand * 0.26);
        float pulseGlow = 1.08 + uPulse * 0.62 + 0.08 * sin(uTime * 3.4);
        vec3 col = baseCol * pulseGlow + vec3(1.0, 0.98, 0.90) * (spec1 * 1.0 + spec2 * 0.48);
        col += mix(warmGold, celestialCyan, 0.45) * fresnel * (0.72 + uPulse * 0.48);

        gl_FragColor = vec4(col, 0.95);
      }
    `,
  });
}

function createGravityRippleShader(hexColor: number): THREE.ShaderMaterial {
  const c = new THREE.Color(hexColor);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: c },
      uProgress: { value: 0 },
      uIntensity: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uProgress;
      uniform float uIntensity;
      varying vec2 vUv;

      void main() {
        vec2 centered = vUv * 2.0 - 1.0;
        float dist = length(centered);
        float ring1 = exp(-pow((dist - (0.28 + uProgress * 0.62)) * 12.0, 2.0));
        float ring2 = exp(-pow((dist - (0.14 + uProgress * 0.46)) * 16.0, 2.0)) * 0.65;
        float outerMask = smoothstep(1.0, 0.86, dist);
        float alpha = (ring1 + ring2) * outerMask * uIntensity;
        if (alpha < 0.01) discard;
        vec3 col = mix(uColor, vec3(1.0, 0.98, 0.92), ring1 * 0.55);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
      }
    `,
  });
}

function createSilkVeilShaderMaterial(
  innerHex: number,
  outerHex: number,
  baseOpacity = 0.72,
): THREE.ShaderMaterial {
  const c1 = new THREE.Color(innerHex);
  const c2 = new THREE.Color(outerHex);
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uInner: { value: c1 },
      uOuter: { value: c2 },
      uBoost: { value: 1.0 },
      uOpacity: { value: baseOpacity },
    },
    vertexShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        vUv = uv;
        vec3 pos = position;
        float wave = sin(uv.y * 6.5 - uTime * 2.9 + pos.x * 4.2 + pos.z * 3.8);
        pos.x += wave * 0.024 * uv.y;
        pos.z += cos(uv.y * 5.2 - uTime * 2.4 + pos.x * 3.5) * 0.020 * uv.y;
        vec4 worldPos = modelMatrix * vec4(pos, 1.0);
        vNormalDir = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uInner;
      uniform vec3 uOuter;
      uniform float uBoost;
      uniform float uOpacity;
      varying vec2 vUv;
      varying vec3 vNormalDir;
      varying vec3 vViewDir;

      void main() {
        float edgeX = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
        float tipFade = smoothstep(1.0, 0.08, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        float filament = 0.78 + 0.22 * sin(vUv.x * 18.0 + vUv.y * 9.0 - uTime * 2.6);
        float pulse = 0.88 + 0.12 * sin(vUv.y * 12.0 - uTime * 3.8);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormalDir), normalize(vViewDir))), 1.50);
        vec3 col = mix(uInner, uOuter, smoothstep(0.06, 0.90, vUv.y)) * filament * pulse * uBoost;
        col += mix(uOuter, vec3(1.0, 0.98, 0.95), 0.50) * fresnel * 0.56;
        float alpha = uOpacity * edgeX * (0.30 + 0.70 * tipFade) * (0.74 + fresnel * 0.34);
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.92));
      }
    `,
  });
}

function createFelineSlitEyeShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uDilate: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vNormal = normalize(mat3(modelMatrix) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDilate;
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vViewDir;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float almond = p.y * p.y / max(0.04, pow(max(0.0, cos(p.x * 1.48)), 1.55)) + p.x * p.x * 0.80;
        if (almond > 1.04) discard;

        float r = length(vec2(p.x * 0.84, p.y * 1.15));
        float angle = atan(p.y, p.x);
        float fibers = 0.5 + 0.5 * sin(angle * 24.0 + sin(r * 14.0) * 1.5);

        float slitHalfW = 0.11 + uDilate * 0.07;
        float slitShape = abs(p.x) / max(0.015, slitHalfW * sqrt(max(0.0, 1.0 - p.y * p.y * 1.08)));
        float pupilMask = 1.0 - smoothstep(0.82, 1.04, slitShape);

        vec3 outerGold = vec3(0.86, 0.66, 0.26);
        vec3 midColdGold = vec3(1.00, 0.92, 0.58);
        vec3 innerGlow = vec3(1.00, 0.98, 0.84);
        vec3 iris = mix(innerGlow, midColdGold, smoothstep(0.14, 0.52, r));
        iris = mix(iris, outerGold, smoothstep(0.50, 0.88, r));
        iris *= 0.90 + 0.20 * fibers;

        float limbal = smoothstep(0.76, 1.02, almond);
        iris = mix(iris, vec3(0.07, 0.05, 0.12), limbal * 0.90);

        float upperShadow = smoothstep(0.24, 0.92, p.y);
        iris *= 1.0 - upperShadow * 0.30;

        vec3 pupilCol = vec3(0.02, 0.015, 0.04);
        vec3 col = mix(iris, pupilCol, pupilMask);

        float spec = exp(-pow(length(p - vec2(0.22, 0.26)) * 7.2, 2.0)) * 0.62;
        col += vec3(1.0, 0.99, 0.94) * spec;

        float shimmer = 1.18 + 0.08 * sin(uTime * 2.4) + uDilate * 0.26;
        gl_FragColor = vec4(col * shimmer, 1.0);
      }
    `,
  });
}

function createAccretionDiskShader(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBoost: { value: 1.0 },
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
      uniform float uBoost;
      varying vec2 vUv;

      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        if (r < 0.30 || r > 1.0) discard;

        float ang = atan(p.y, p.x);
        float spin = ang - uTime * 2.8 + 3.2 / max(0.32, r);
        float spiral1 = 0.5 + 0.5 * sin(spin * 3.0);
        float spiral2 = 0.5 + 0.5 * cos(spin * 5.0 - r * 14.0 + uTime * 1.8);
        float doppler = 0.80 + 0.34 * cos(ang - 0.65);

        float photonRing = exp(-pow((r - 0.36) * 20.0, 2.0));
        float diskBody = smoothstep(0.31, 0.42, r) * smoothstep(1.0, 0.48, r);
        float streaks = 0.55 + 0.45 * (spiral1 * 0.62 + spiral2 * 0.38);

        vec3 hotCore = vec3(1.00, 0.95, 0.80);
        vec3 moltenGold = vec3(0.96, 0.72, 0.30);
        vec3 cosmicViolet = vec3(0.64, 0.36, 0.96);

        vec3 col = mix(moltenGold, cosmicViolet, smoothstep(0.46, 0.92, r));
        col = mix(col, hotCore, photonRing * 0.92);
        col *= streaks * doppler * uBoost;

        float alpha = clamp((diskBody * streaks * 0.86 + photonRing * 0.96), 0.0, 0.98);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createBubbleFresnelMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        mat4 worldMat = modelMatrix;
        #ifdef USE_INSTANCING
          worldMat = modelMatrix * instanceMatrix;
        #endif
        vec4 wp = worldMat * vec4(position, 1.0);
        vNormal = normalize(mat3(worldMat) * normal);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewDir;
      void main() {
        float ndotv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
        float rim = pow(1.0 - ndotv, 2.1);
        vec3 aqua = vec3(0.60, 0.94, 1.0);
        vec3 pearl = vec3(0.95, 0.99, 1.0);
        vec3 col = mix(aqua, pearl, rim);
        float alpha = clamp(0.16 + rim * 0.68, 0.0, 0.88);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createSatinGoldMaterial(materials: PbrMaterialLibrary): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0xedd398),
    map: materials.champagneGoldMaps.albedoMap,
    normalMap: materials.champagneGoldMaps.normalMap,
    normalScale: new THREE.Vector2(0.34, 0.34),
    roughness: 0.33,
    metalness: 0.78,
    envMapIntensity: 0.58,
    clearcoat: 0.08,
    clearcoatRoughness: 0.35,
  });
}

function normalizeGeometryForMerge(
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

function pruneEmptyGroups(root: THREE.Object3D, skipSet: ReadonlySet<THREE.Object3D>): void {
  for (let i = root.children.length - 1; i >= 0; i -= 1) {
    const child = root.children[i]!;
    if (skipSet.has(child)) continue;
    if (child instanceof THREE.Group) {
      pruneEmptyGroups(child, skipSet);
      if (child.children.length === 0) {
        root.remove(child);
      }
    }
  }
}

function removeFromList<T>(list: T[], item: T): void {
  const idx = list.indexOf(item);
  if (idx >= 0) {
    list.splice(idx, 1);
  }
}

function batchStaticChildrenByMaterial(
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

  const flushBuckets = (buckets: Map<THREE.Material, THREE.Mesh[]>, isBloom: boolean): void => {
    for (const [mat, meshes] of buckets.entries()) {
      if (meshes.length < 2) continue;
      const baked: THREE.BufferGeometry[] = [];
      const relMat = new THREE.Matrix4();
      const firstRenderOrder = meshes[0]!.renderOrder;
      for (const mesh of meshes) {
        relMat.multiplyMatrices(invGroupMat, mesh.matrixWorld);
        baked.push(normalizeGeometryForMerge(mesh.geometry, relMat));
      }
      const mergedGeo = mergeGeometries(baked, false);
      for (const b of baked) b.dispose();
      if (!mergedGeo) continue;
      mergedGeo.computeBoundingSphere();
      ownedGeos.push(mergedGeo);
      const mergedMesh = new THREE.Mesh(mergedGeo, mat);
      mergedMesh.renderOrder = firstRenderOrder;
      group.add(mergedMesh);
      for (const mesh of meshes) {
        mesh.parent?.remove(mesh);
        if (isBloom) {
          removeFromList(bloomTargets, mesh);
        }
      }
      if (isBloom) {
        bloomTargets.push(mergedMesh);
      }
    }
  };

  flushBuckets(normalBuckets, false);
  flushBuckets(bloomBuckets, true);
  pruneEmptyGroups(group, skipSet);
}

interface SkinnedBatchEntry {
  readonly mesh: THREE.Mesh;
  readonly boneParent: THREE.Object3D;
  readonly colorHex?: number;
}

function collectSkinnedBatchFromMeshes(
  rootGroup: THREE.Group,
  entries: readonly SkinnedBatchEntry[],
  material: THREE.Material,
  ownedGeos: THREE.BufferGeometry[],
  bloomTargets?: THREE.Object3D[],
): THREE.SkinnedMesh | null {
  if (entries.length === 0) return null;
  rootGroup.updateMatrixWorld(true);
  const invRootMat = rootGroup.matrixWorld.clone().invert();
  const boneByParent = new Map<THREE.Object3D, number>();
  const bones: THREE.Bone[] = [];

  for (const entry of entries) {
    if (!boneByParent.has(entry.boneParent)) {
      const bone = new THREE.Bone();
      entry.boneParent.add(bone);
      boneByParent.set(entry.boneParent, bones.length);
      bones.push(bone);
    }
  }

  const useColors = entries.some((e) => e.colorHex !== undefined);
  const prepared: THREE.BufferGeometry[] = [];
  const relMat = new THREE.Matrix4();
  const tmpColor = new THREE.Color();

  for (const entry of entries) {
    const boneIdx = boneByParent.get(entry.boneParent)!;
    relMat.multiplyMatrices(invRootMat, entry.mesh.matrixWorld);
    const g = normalizeGeometryForMerge(entry.mesh.geometry, relMat);
    const vCount = g.getAttribute('position').count;
    const skinIndices = new Uint16Array(vCount * 4);
    const skinWeights = new Float32Array(vCount * 4);
    for (let i = 0; i < vCount; i += 1) {
      skinIndices[i * 4] = boneIdx;
      skinWeights[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
    if (useColors) {
      tmpColor.setHex(entry.colorHex ?? 0xffffff);
      const colors = new Float32Array(vCount * 3);
      for (let i = 0; i < vCount; i += 1) {
        colors[i * 3] = tmpColor.r;
        colors[i * 3 + 1] = tmpColor.g;
        colors[i * 3 + 2] = tmpColor.b;
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    prepared.push(g);
  }

  const mergedGeo = mergeGeometries(prepared, false);
  for (const p of prepared) p.dispose();
  if (!mergedGeo) return null;
  mergedGeo.computeBoundingSphere();
  ownedGeos.push(mergedGeo);

  for (const entry of entries) {
    entry.mesh.parent?.remove(entry.mesh);
    if (bloomTargets) {
      removeFromList(bloomTargets, entry.mesh);
    }
  }

  const skinned = new THREE.SkinnedMesh(mergedGeo, material);
  skinned.frustumCulled = false;
  rootGroup.add(skinned);
  rootGroup.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  skinned.bind(skeleton);
  if (bloomTargets) {
    bloomTargets.push(skinned);
  }
  return skinned;
}

function disposeUnusedGeos(root: THREE.Object3D, ownedGeos: THREE.BufferGeometry[]): void {
  const used = new Set<THREE.BufferGeometry>();
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
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

interface BatchedFurPartSpec {
  readonly geo: THREE.BufferGeometry;
  readonly localMatrix: THREE.Matrix4;
  readonly partIndex: number;
  readonly baseColor: number;
  readonly tipColor: number;
  readonly rimColor: number;
  readonly layers: number;
  readonly furLength: number;
  readonly densityScale: number;
  readonly rimStrength: number;
  readonly droop: number;
}

interface BatchedShellFurRig {
  readonly meshes: THREE.Mesh[];
  readonly partMatrices: THREE.Matrix4[];
  update(elapsedSec: number): void;
}

function extractAuthenticFurTexture(): THREE.DataTexture {
  const probeGeo = new THREE.BufferGeometry();
  const probe = createShellFurGroup(probeGeo, {
    baseColor: 0x000000,
    tipColor: 0x000000,
    rimColor: 0x000000,
    layers: 4,
  });
  const src = probe.materials[0]?.uniforms['uFurMap']?.value as THREE.DataTexture | undefined;
  let tex: THREE.DataTexture;
  if (src && src.image && src.image.data) {
    const img = src.image as { data: Uint8Array; width: number; height: number };
    tex = new THREE.DataTexture(
      new Uint8Array(img.data),
      img.width,
      img.height,
      THREE.RGBAFormat,
    );
  } else {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  probe.dispose();
  return tex;
}

function createBatchedShellFur(
  parts: readonly BatchedFurPartSpec[],
  furTex: THREE.DataTexture,
  ownedGeos: THREE.BufferGeometry[],
  ownedMats: THREE.Material[],
): BatchedShellFurRig {
  const partMatrices = [
    new THREE.Matrix4(),
    new THREE.Matrix4(),
    new THREE.Matrix4(),
    new THREE.Matrix4(),
  ];

  const baseBucket: THREE.BufferGeometry[] = [];
  const midBuckets = new Map<number, THREE.BufferGeometry[]>();
  const haloBuckets = new Map<number, THREE.BufferGeometry[]>();
  const tmpBase = new THREE.Color();
  const tmpTip = new THREE.Color();
  const tmpRim = new THREE.Color();

  const stampLayerGeo = (
    normGeo: THREE.BufferGeometry,
    spec: BatchedFurPartSpec,
    shellHeight: number,
  ): THREE.BufferGeometry => {
    const g = normGeo.clone();
    const vCount = g.getAttribute('position').count;
    const partIdxArr = new Float32Array(vCount);
    const shellParams = new Float32Array(vCount * 4);
    const baseCol = new Float32Array(vCount * 3);
    const tipCol = new Float32Array(vCount * 3);
    const rimData = new Float32Array(vCount * 4);
    tmpBase.setHex(spec.baseColor);
    tmpTip.setHex(spec.tipColor);
    tmpRim.setHex(spec.rimColor);
    for (let i = 0; i < vCount; i += 1) {
      partIdxArr[i] = spec.partIndex;
      shellParams[i * 4] = shellHeight;
      shellParams[i * 4 + 1] = spec.furLength;
      shellParams[i * 4 + 2] = spec.droop;
      shellParams[i * 4 + 3] = spec.densityScale;
      baseCol[i * 3] = tmpBase.r;
      baseCol[i * 3 + 1] = tmpBase.g;
      baseCol[i * 3 + 2] = tmpBase.b;
      tipCol[i * 3] = tmpTip.r;
      tipCol[i * 3 + 1] = tmpTip.g;
      tipCol[i * 3 + 2] = tmpTip.b;
      rimData[i * 4] = tmpRim.r;
      rimData[i * 4 + 1] = tmpRim.g;
      rimData[i * 4 + 2] = tmpRim.b;
      rimData[i * 4 + 3] = spec.rimStrength;
    }
    g.setAttribute('aPartIndex', new THREE.BufferAttribute(partIdxArr, 1));
    g.setAttribute('aShellParams', new THREE.BufferAttribute(shellParams, 4));
    g.setAttribute('aBaseColor', new THREE.BufferAttribute(baseCol, 3));
    g.setAttribute('aTipColor', new THREE.BufferAttribute(tipCol, 3));
    g.setAttribute('aRimData', new THREE.BufferAttribute(rimData, 4));
    return g;
  };

  for (const spec of parts) {
    const normGeo = normalizeGeometryForMerge(spec.geo, spec.localMatrix);
    spec.geo.dispose();
    const layers = Math.max(4, Math.min(14, spec.layers));
    for (let i = 0; i < layers; i += 1) {
      const h = layers > 1 ? i / (layers - 1) : 0;
      const stamped = stampLayerGeo(normGeo, spec, h);
      if (i === 0) {
        baseBucket.push(stamped);
      } else if (i >= layers - 2) {
        const key = i - (layers - 2);
        let arr = haloBuckets.get(key);
        if (!arr) {
          arr = [];
          haloBuckets.set(key, arr);
        }
        arr.push(stamped);
      } else {
        let arr = midBuckets.get(i);
        if (!arr) {
          arr = [];
          midBuckets.set(i, arr);
        }
        arr.push(stamped);
      }
    }
    normGeo.dispose();
  }

  const orderedMid: THREE.BufferGeometry[] = [];
  for (const key of [...midBuckets.keys()].sort((a, b) => a - b)) {
    orderedMid.push(...midBuckets.get(key)!);
  }
  const orderedHalo: THREE.BufferGeometry[] = [];
  for (const key of [...haloBuckets.keys()].sort((a, b) => a - b)) {
    orderedHalo.push(...haloBuckets.get(key)!);
  }

  const makeShaderMat = (transparent: boolean, depthWrite: boolean, side: THREE.Side): THREE.ShaderMaterial => {
    const mat = new THREE.ShaderMaterial({
      transparent,
      depthWrite,
      side,
      uniforms: {
        uFurMap: { value: furTex },
        uTime: { value: 0 },
        uPartMatrices: { value: partMatrices },
      },
      vertexShader: `
        uniform float uTime;
        uniform mat4 uPartMatrices[4];
        attribute float aPartIndex;
        attribute vec4 aShellParams;
        attribute vec3 aBaseColor;
        attribute vec3 aTipColor;
        attribute vec4 aRimData;

        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        varying float vShellHeight;
        varying float vDensityScale;
        varying vec3 vBaseColor;
        varying vec3 vTipColor;
        varying vec4 vRimData;

        void main() {
          vObjPos = position;
          vObjNormal = normalize(normal);
          float shellH = aShellParams.x;
          float furLen = aShellParams.y;
          float droop = aShellParams.z;
          vShellHeight = shellH;
          vDensityScale = aShellParams.w;
          vBaseColor = aBaseColor;
          vTipColor = aTipColor;
          vRimData = aRimData;

          float h2 = shellH * shellH;
          vec3 displaced = position + vObjNormal * (shellH * furLen);
          displaced.y -= droop * h2;
          displaced.x += sin(uTime * 1.9 + position.y * 5.0 + position.z * 3.0) * 0.0025 * h2;

          mat4 partMat = uPartMatrices[0];
          if (aPartIndex > 2.5) partMat = uPartMatrices[3];
          else if (aPartIndex > 1.5) partMat = uPartMatrices[2];
          else if (aPartIndex > 0.5) partMat = uPartMatrices[1];

          mat4 worldMat = modelMatrix * partMat;
          vec4 worldPos = worldMat * vec4(displaced, 1.0);
          vWorldNormal = normalize(mat3(worldMat) * vObjNormal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uFurMap;
        varying vec3 vObjPos;
        varying vec3 vObjNormal;
        varying vec3 vWorldNormal;
        varying vec3 vViewDir;
        varying float vShellHeight;
        varying float vDensityScale;
        varying vec3 vBaseColor;
        varying vec3 vTipColor;
        varying vec4 vRimData;

        vec3 sampleTriplanar(vec3 p, vec3 n, float scale) {
          vec3 w = pow(abs(normalize(n)), vec3(4.0));
          w /= max(w.x + w.y + w.z, 0.0001);
          vec3 sx = texture2D(uFurMap, p.yz * scale).rgb;
          vec3 sy = texture2D(uFurMap, p.xz * scale).rgb;
          vec3 sz = texture2D(uFurMap, p.xy * scale).rgb;
          return sx * w.x + sy * w.y + sz * w.z;
        }

        void main() {
          vec3 N = normalize(vWorldNormal);
          vec3 V = normalize(vViewDir);
          vec3 furSample = sampleTriplanar(vObjPos, vObjNormal, vDensityScale);

          float strand = furSample.r;
          float clumpAo = furSample.g;
          float warmth = furSample.b;

          float alpha = 1.0;
          if (vShellHeight > 0.001) {
            float cutoff = vShellHeight * 0.84;
            float strandMask = smoothstep(cutoff, cutoff + 0.16, strand);
            if (strandMask < 0.08) discard;
            alpha = clamp(strandMask * mix(0.95, 0.48, vShellHeight), 0.0, 1.0);
          }

          vec3 keyDir = normalize(vec3(0.55, 0.72, 0.62));
          vec3 fillDir = normalize(vec3(-0.68, 0.45, -0.58));

          float wrapKey = clamp((dot(N, keyDir) + 0.62) / 1.62, 0.0, 1.0);
          float wrapFill = clamp((dot(N, fillDir) + 0.56) / 1.56, 0.0, 1.0);
          float hemi = N.y * 0.5 + 0.5;

          float rootAo = mix(0.48, 1.08, pow(vShellHeight, 0.60)) * mix(0.84, 1.06, clumpAo);
          vec3 furTint = mix(vBaseColor, vTipColor, pow(vShellHeight, 0.75));
          furTint *= mix(vec3(0.94, 0.92, 1.04), vec3(1.06, 1.00, 0.96), warmth);

          vec3 lit = furTint * (
            vec3(0.32, 0.30, 0.42) * mix(0.76, 1.18, hemi) +
            vec3(0.92, 0.87, 0.80) * wrapKey * 0.84 +
            vec3(0.54, 0.58, 0.88) * wrapFill * 0.40
          ) * rootAo;

          float ndotv = max(dot(N, V), 0.0);
          float velvetFuzz = pow(1.0 - ndotv, 2.15);
          float rimMask = vRimData.w * velvetFuzz * (0.36 + 0.64 * vShellHeight);
          lit += vRimData.rgb * rimMask * (0.68 + 0.32 * wrapFill);

          gl_FragColor = vec4(lit, alpha);
        }
      `,
    });
    ownedMats.push(mat);
    return mat;
  };

  const meshes: THREE.Mesh[] = [];
  const mats: THREE.ShaderMaterial[] = [];

  const buildPass = (
    geos: THREE.BufferGeometry[],
    transparent: boolean,
    depthWrite: boolean,
    side: THREE.Side,
    renderOrder: number,
  ): void => {
    if (geos.length === 0) return;
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!merged) return;
    merged.computeBoundingSphere();
    ownedGeos.push(merged);
    const mat = makeShaderMat(transparent, depthWrite, side);
    mats.push(mat);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    meshes.push(mesh);
  };

  buildPass(baseBucket, false, true, THREE.FrontSide, 0);
  buildPass(orderedMid, true, true, THREE.DoubleSide, 1);
  buildPass(orderedHalo, true, false, THREE.DoubleSide, 2);

  return {
    meshes,
    partMatrices,
    update(elapsedSec: number): void {
      for (const m of mats) {
        m.uniforms['uTime']!.value = elapsedSec;
      }
    },
  };
}

export function createTacticianRig(
  id: TacticianId,
  materials: PbrMaterialLibrary,
): TacticianRig {
  const root = new THREE.Group();
  root.name = `tactician_${id}`;

  const visualPivot = new THREE.Group();
  root.add(visualPivot);

  const bloomTargets: THREE.Object3D[] = [];
  const ownedGeos: THREE.BufferGeometry[] = [];
  const ownedMats: THREE.Material[] = [];
  const ownedTextures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    ownedGeos.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    ownedMats.push(m);
    return m;
  };

  const satinGoldMat = trackMat(createSatinGoldMaterial(materials));

  const burstGeo = trackGeo(new THREE.OctahedronGeometry(0.028, 0));
  const burstColorHex =
    id === 'tactician_europa_fin'
      ? 0x7dd3fc
      : id === 'tactician_singularity_mew'
        ? 0xe0c3fc
        : 0xfde68a;
  const burstMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: burstColorHex,
      transparent: true,
      opacity: 0.90,
    }),
  );
  const burstInstanced = new THREE.InstancedMesh(burstGeo, burstMat, 20);
  burstInstanced.visible = false;
  burstInstanced.frustumCulled = false;
  root.add(burstInstanced);
  const burstTempMatrix = new THREE.Matrix4();
  const burstTempQuat = new THREE.Quaternion();
  const burstTempScale = new THREE.Vector3(1, 1, 1);
  const burstParticles: BurstParticle[] = [];
  for (let i = 0; i < 20; i += 1) {
    burstParticles.push({
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      scale: 0,
      age: 0,
      life: 0.85,
      active: false,
    });
  }

  let emoteKind: TacticianEmoteKind | null = null;
  let emoteVariant = 0;
  let emoteTimer = 0;
  let emoteDuration = 0.9;
  let tapCycle = 0;

  let customUpdate = (_dt: number, _elapsedSec: number, _emoteRatio: number): void => {};

  if (id === 'tactician_lumina_bell') {
    const whitePorcelainMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0xf7f5f0),
        map: materials.porcelainMaps.albedoMap,
        normalMap: materials.porcelainMaps.normalMap,
        normalScale: new THREE.Vector2(0.24, 0.24),
        roughnessMap: materials.porcelainMaps.roughnessMap,
        roughness: 0.42,
        metalness: 0.06,
        envMapIntensity: 0.44,
        clearcoat: 0.18,
        clearcoatRoughness: 0.36,
      }),
    );

    const celestialInlayMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x1b2c4e),
        map: materials.unitArmorMaps.albedoMap,
        normalMap: materials.unitArmorMaps.normalMap,
        normalScale: new THREE.Vector2(0.26, 0.26),
        roughness: 0.50,
        metalness: 0.36,
        envMapIntensity: 0.42,
      }),
    );

    const starlightPipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xfff4d0),
        emissive: new THREE.Color(0xf6cc78),
        emissiveIntensity: 1.65,
        roughness: 0.22,
        metalness: 0.12,
      }),
    );

    const cyanPipMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xc2f6ff),
        emissive: new THREE.Color(0x4ad8ff),
        emissiveIntensity: 1.55,
        roughness: 0.22,
        metalness: 0.12,
      }),
    );

    const clapperCrystalMat = trackMat(createPrismaticCrystalShader());
    const ribbonMat = trackMat(createSilkVeilShaderMaterial(0xf5cd80, 0x58dcff, 0.78));
    const rippleMat = trackMat(createGravityRippleShader(0xf5cd78));

    const bellAssembly = new THREE.Group();
    visualPivot.add(bellAssembly);

    const petalGeo = trackGeo(createSculptedBellPetalGeo(0.66, 0.030, 12, 14));
    const petalTrimGeo = trackGeo(createPetalGoldTrimGeo(0.66));
    const rivetGeo = trackGeo(new THREE.OctahedronGeometry(0.0135, 0));

    for (let i = 0; i < 3; i += 1) {
      const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const petalHolder = new THREE.Group();
      petalHolder.rotation.y = ang;
      petalHolder.add(new THREE.Mesh(petalGeo, whitePorcelainMat));
      petalHolder.add(new THREE.Mesh(petalTrimGeo, satinGoldMat));

      for (const side of [-0.52, 0, 0.52]) {
        const rivet = new THREE.Mesh(rivetGeo, side === 0 ? cyanPipMat : starlightPipMat);
        const theta = side * 0.62;
        const r = bellRadiusProfile(0.20) + 0.028;
        rivet.position.set(Math.sin(theta) * r, bellHeightProfile(0.20), Math.cos(theta) * r);
        petalHolder.add(rivet);
        bloomTargets.push(rivet);
      }

      bellAssembly.add(petalHolder);
    }

    const innerVaultGeo = trackGeo(new THREE.SphereGeometry(0.196, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.46));
    const innerVault = new THREE.Mesh(innerVaultGeo, celestialInlayMat);
    innerVault.position.y = 1.03;
    bellAssembly.add(innerVault);

    const vaultBezelGeo = trackGeo(new THREE.TorusGeometry(0.194, 0.011, 8, 32));
    vaultBezelGeo.rotateX(Math.PI * 0.5);
    const vaultBezel = new THREE.Mesh(vaultBezelGeo, satinGoldMat);
    vaultBezel.position.y = 1.045;
    bellAssembly.add(vaultBezel);

    const crownCollarGeo = trackGeo(new THREE.CylinderGeometry(0.092, 0.145, 0.072, 24));
    const crownCollar = new THREE.Mesh(crownCollarGeo, satinGoldMat);
    crownCollar.position.y = 1.23;
    bellAssembly.add(crownCollar);

    const upperPorcelainCapGeo = trackGeo(new THREE.SphereGeometry(0.118, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.52));
    const upperPorcelainCap = new THREE.Mesh(upperPorcelainCapGeo, whitePorcelainMat);
    upperPorcelainCap.position.y = 1.19;
    bellAssembly.add(upperPorcelainCap);

    const crownRingGeo = trackGeo(new THREE.TorusGeometry(0.136, 0.014, 10, 32));
    crownRingGeo.rotateX(Math.PI * 0.5);
    const crownRing = new THREE.Mesh(crownRingGeo, satinGoldMat);
    crownRing.position.y = 1.264;
    bellAssembly.add(crownRing);

    const spireBaseGeo = trackGeo(new THREE.CylinderGeometry(0.044, 0.078, 0.068, 16));
    const spireBase = new THREE.Mesh(spireBaseGeo, celestialInlayMat);
    spireBase.position.y = 1.298;
    bellAssembly.add(spireBase);

    const spireNeedleGeo = trackGeo(new THREE.ConeGeometry(0.025, 0.21, 8));
    const spireNeedle = new THREE.Mesh(spireNeedleGeo, satinGoldMat);
    spireNeedle.position.y = 1.43;
    bellAssembly.add(spireNeedle);

    const buttressPts = [
      new THREE.Vector3(0.130, 1.245, 0),
      new THREE.Vector3(0.106, 1.325, 0),
      new THREE.Vector3(0.032, 1.385, 0),
    ];
    const buttressGeo = trackGeo(createTaperedCurveGeo(buttressPts, [0.010, 0.008, 0.006], 10, 6, 1.0, true));
    for (let i = 0; i < 3; i += 1) {
      const buttress = new THREE.Mesh(buttressGeo, satinGoldMat);
      buttress.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 3;
      bellAssembly.add(buttress);
    }

    const zenithStarGeo = trackGeo(new THREE.OctahedronGeometry(0.034, 0));
    zenithStarGeo.scale(0.75, 1.45, 0.75);
    const zenithStar = new THREE.Mesh(zenithStarGeo, starlightPipMat);
    zenithStar.position.y = 1.55;
    bellAssembly.add(zenithStar);
    bloomTargets.push(zenithStar);

    const clapperPivot = new THREE.Group();
    clapperPivot.position.set(0, 1.12, 0);
    bellAssembly.add(clapperPivot);

    const clapperRodGeo = trackGeo(new THREE.CylinderGeometry(0.007, 0.009, 0.24, 8));
    const clapperRod = new THREE.Mesh(clapperRodGeo, satinGoldMat);
    clapperRod.position.y = -0.12;
    clapperPivot.add(clapperRod);

    const crystalGeo = trackGeo(createFacetedClapperCrystalGeo());
    const crystalMesh = new THREE.Mesh(crystalGeo, clapperCrystalMat);
    crystalMesh.position.y = -0.40;
    clapperPivot.add(crystalMesh);
    bloomTargets.push(crystalMesh);

    const clapperEquatorialGeo = trackGeo(new THREE.TorusGeometry(0.172, 0.0095, 8, 28));
    clapperEquatorialGeo.rotateX(Math.PI * 0.5);
    const clapperCage = new THREE.Mesh(clapperEquatorialGeo, satinGoldMat);
    clapperCage.position.y = -0.40;
    clapperCage.rotation.z = 0.22;
    clapperPivot.add(clapperCage);

    const clapperMeridianGeo = trackGeo(new THREE.TorusGeometry(0.172, 0.0075, 8, 28));
    const clapperMeridian = new THREE.Mesh(clapperMeridianGeo, satinGoldMat);
    clapperMeridian.position.y = -0.40;
    clapperMeridian.rotation.y = 0.35;
    clapperPivot.add(clapperMeridian);

    const dropBeadGeo = trackGeo(new THREE.OctahedronGeometry(0.036, 1));
    dropBeadGeo.scale(0.85, 1.35, 0.85);
    const dropBead = new THREE.Mesh(dropBeadGeo, whitePorcelainMat);
    dropBead.position.y = -0.72;
    clapperPivot.add(dropBead);

    const dropCapGeo = trackGeo(new THREE.ConeGeometry(0.028, 0.040, 10));
    const dropCap = new THREE.Mesh(dropCapGeo, satinGoldMat);
    dropCap.position.y = -0.675;
    clapperPivot.add(dropCap);

    const ringsRoot = new THREE.Group();
    ringsRoot.position.set(0, 0.82, 0);
    visualPivot.add(ringsRoot);

    const ringConfigs = [
      { radius: 0.54, width: 0.026, height: 0.014, ticks: 24, tiltX: 0.44, tiltZ: 0.24, speedY: 0.52, satCount: 2 },
      { radius: 0.64, width: 0.022, height: 0.012, ticks: 32, tiltX: -0.58, tiltZ: 0.36, speedY: -0.38, satCount: 3 },
      { radius: 0.73, width: 0.018, height: 0.010, ticks: 36, tiltX: 0.26, tiltZ: -0.52, speedY: 0.27, satCount: 2 },
    ];

    const ringPivots: THREE.Group[] = [];
    const ringGoldEntries: SkinnedBatchEntry[] = [];
    const ringGlowEntries: SkinnedBatchEntry[] = [];
    const satPearlGeo = trackGeo(new THREE.SphereGeometry(0.023, 12, 10));
    const satRingGeo = trackGeo(new THREE.TorusGeometry(0.033, 0.0045, 6, 16));

    ringConfigs.forEach((cfg, idx) => {
      const tiltGroup = new THREE.Group();
      tiltGroup.rotation.set(cfg.tiltX, idx * 0.9, cfg.tiltZ);
      ringsRoot.add(tiltGroup);

      const spinPivot = new THREE.Group();
      tiltGroup.add(spinPivot);
      ringPivots.push(spinPivot);

      const ringGeo = trackGeo(createGraduatedAstrolabeRingGeo(cfg.radius, cfg.width, cfg.height, cfg.ticks));
      const ringMesh = new THREE.Mesh(ringGeo, satinGoldMat);
      spinPivot.add(ringMesh);
      ringGoldEntries.push({ mesh: ringMesh, boneParent: spinPivot });

      for (let s = 0; s < cfg.satCount; s += 1) {
        const satAng = (s / cfg.satCount) * Math.PI * 2 + idx * 0.7;
        const satNode = new THREE.Group();
        satNode.position.set(Math.cos(satAng) * cfg.radius, 0, Math.sin(satAng) * cfg.radius);
        spinPivot.add(satNode);

        const satGlow = new THREE.Mesh(satPearlGeo, s % 2 === 0 ? cyanPipMat : starlightPipMat);
        satNode.add(satGlow);
        ringGlowEntries.push({
          mesh: satGlow,
          boneParent: spinPivot,
          colorHex: s % 2 === 0 ? 0x99ecff : 0xffe49c,
        });

        const satCollar = new THREE.Mesh(satRingGeo, satinGoldMat);
        satCollar.rotation.x = Math.PI * 0.35;
        satNode.add(satCollar);
        ringGoldEntries.push({ mesh: satCollar, boneParent: spinPivot });
      }
    });

    const ringGlowMat = trackMat(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
      }),
    );

    const ribbonParts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i += 1) {
      const a0 = (i / 4) * Math.PI * 2 + 0.35;
      const g = createSpiralRibbonGeo(a0, 0.28, 0.14, 0.58, 0.04, 1.55, 0.095, 0.022, 24);
      ribbonParts.push(normalizeGeometryForMerge(g, new THREE.Matrix4()));
      g.dispose();
    }
    const mergedRibbonsGeo = trackGeo(mergeGeometries(ribbonParts, false)!);
    for (const r of ribbonParts) r.dispose();
    const ribbonsMesh = new THREE.Mesh(mergedRibbonsGeo, ribbonMat);
    ribbonsMesh.renderOrder = 3;
    visualPivot.add(ribbonsMesh);

    const ripplePlaneGeo = trackGeo(new THREE.PlaneGeometry(1.78, 1.78));
    ripplePlaneGeo.rotateX(-Math.PI * 0.5);
    const rippleMesh = new THREE.Mesh(ripplePlaneGeo, rippleMat);
    rippleMesh.position.y = 0.68;
    rippleMesh.renderOrder = 4;
    visualPivot.add(rippleMesh);
    bloomTargets.push(rippleMesh);

    const moteGeo = trackGeo(new THREE.OctahedronGeometry(0.014, 0));
    const moteMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xffe9a8,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const moteCount = 16;
    const moteInstanced = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    moteInstanced.frustumCulled = false;
    visualPivot.add(moteInstanced);
    bloomTargets.push(moteInstanced);

    const skipStatic = new Set<THREE.Object3D>([
      clapperPivot,
      ringsRoot,
      ribbonsMesh,
      rippleMesh,
      moteInstanced,
    ]);
    batchStaticChildrenByMaterial(bellAssembly, skipStatic, bloomTargets, ownedGeos);
    batchStaticChildrenByMaterial(clapperPivot, new Set([crystalMesh]), bloomTargets, ownedGeos);

    collectSkinnedBatchFromMeshes(ringsRoot, ringGoldEntries, satinGoldMat, ownedGeos);
    collectSkinnedBatchFromMeshes(ringsRoot, ringGlowEntries, ringGlowMat, ownedGeos, bloomTargets);
    pruneEmptyGroups(ringsRoot, new Set<THREE.Object3D>(ringPivots));

    const moteMat4 = new THREE.Matrix4();
    const motePos = new THREE.Vector3();
    const moteQuat = new THREE.Quaternion();
    const moteScale = new THREE.Vector3();
    const moteEuler = new THREE.Euler();

    customUpdate = (_dt, elapsedSec, emoteRatio) => {
      const emoteBell = emoteKind ? Math.sin(emoteRatio * Math.PI) : 0;
      clapperCrystalMat.uniforms['uTime']!.value = elapsedSec;
      clapperCrystalMat.uniforms['uPulse']!.value = emoteBell;
      ribbonMat.uniforms['uTime']!.value = elapsedSec;
      ribbonMat.uniforms['uBoost']!.value = 1.0 + emoteBell * 0.48;

      clapperPivot.rotation.z =
        Math.sin(elapsedSec * 2.1) * 0.045 +
        (emoteKind ? Math.sin(emoteRatio * Math.PI * 6) * 0.24 * (1 - emoteRatio * 0.5) : 0);
      clapperPivot.rotation.x = Math.cos(elapsedSec * 1.7) * 0.032;
      crystalMesh.rotation.y = elapsedSec * (0.9 + emoteBell * 2.8);
      crystalMesh.scale.setScalar(1.0 + Math.sin(elapsedSec * 3.1) * 0.035 + emoteBell * 0.16);

      bellAssembly.rotation.y = Math.sin(elapsedSec * 0.65) * 0.07;
      ribbonsMesh.rotation.y = elapsedSec * 0.24;

      for (let i = 0; i < ringPivots.length; i += 1) {
        const cfg = ringConfigs[i]!;
        ringPivots[i]!.rotation.y = elapsedSec * cfg.speedY + emoteBell * (i % 2 === 0 ? 1.4 : -1.4);
      }

      if (emoteKind) {
        rippleMesh.visible = true;
        rippleMat.uniforms['uProgress']!.value = emoteRatio;
        rippleMat.uniforms['uIntensity']!.value = Math.sin(emoteRatio * Math.PI) * 0.92;
      } else {
        const idleCycle = (elapsedSec * 0.38) % 1;
        rippleMesh.visible = true;
        rippleMat.uniforms['uProgress']!.value = idleCycle;
        rippleMat.uniforms['uIntensity']!.value = Math.sin(idleCycle * Math.PI) * 0.22;
      }

      for (let i = 0; i < moteCount; i += 1) {
        const phase = (i / moteCount) * Math.PI * 2;
        const speed = 0.52 + (i % 4) * 0.14 + emoteBell * 1.25;
        const ang = phase + elapsedSec * speed * (i % 2 === 0 ? 1 : -1);
        const rad = 0.44 + (i % 5) * 0.085 + emoteBell * 0.12;
        const y = 0.36 + ((i * 0.19) % 0.96) + Math.sin(elapsedSec * 1.8 + phase) * 0.07;
        motePos.set(Math.cos(ang) * rad, y, Math.sin(ang) * rad);
        moteEuler.set(elapsedSec + i, elapsedSec * 1.3, 0);
        moteQuat.setFromEuler(moteEuler);
        const sc = (0.72 + 0.38 * Math.sin(elapsedSec * 3.4 + i)) * (1 + emoteBell * 0.35);
        moteScale.setScalar(sc);
        moteMat4.compose(motePos, moteQuat, moteScale);
        moteInstanced.setMatrixAt(i, moteMat4);
      }
      moteInstanced.instanceMatrix.needsUpdate = true;
    };
  } else if (id === 'tactician_europa_fin') {
    const iceJadeBodyMat = trackMat(
      createSoftSssMaterial({
        baseColor: 0x56ccf2,
        deepColor: 0x0c305c,
        sssColor: 0x3ae2ff,
        rimColor: 0xdff8ff,
        opacity: 0.36,
        sssStrength: 0.86,
        fresnelPower: 2.25,
        sheenStrength: 0.30,
        emissiveBoost: 0.05,
      }),
    );
    iceJadeBodyMat.depthWrite = false;
    iceJadeBodyMat.side = THREE.FrontSide;

    const iceJadeWingMat = trackMat(
      createSoftSssMaterial({
        baseColor: 0x4cc4ee,
        deepColor: 0x0d3462,
        sssColor: 0x3ef0dc,
        rimColor: 0xdcf8ff,
        opacity: 0.44,
        sssStrength: 0.90,
        fresnelPower: 2.05,
        sheenStrength: 0.32,
        emissiveBoost: 0.07,
      }),
    );
    iceJadeWingMat.depthWrite = false;
    iceJadeWingMat.side = THREE.FrontSide;

    const bioSkeletonMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x9af6ff),
        emissive: new THREE.Color(0x1ed8ff),
        emissiveIntensity: 1.55,
        roughness: 0.24,
        metalness: 0.18,
      }),
    );

    const sonarCoreMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xdcfdff),
        emissive: new THREE.Color(0x38f4da),
        emissiveIntensity: 2.10,
        roughness: 0.16,
        metalness: 0.10,
      }),
    );

    const darkTitaniumMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x1b2d46),
        map: materials.unitArmorMaps.albedoMap,
        normalMap: materials.unitArmorMaps.normalMap,
        normalScale: new THREE.Vector2(0.32, 0.32),
        roughness: 0.42,
        metalness: 0.72,
        envMapIntensity: 0.50,
      }),
    );

    const auroraVeilMat = trackMat(createSilkVeilShaderMaterial(0x4beeff, 0x3bf0b8, 0.72));
    const bubbleMat = trackMat(createBubbleFresnelMaterial());
    const sonarRippleMat = trackMat(createGravityRippleShader(0x44eeff));

    const whaleRoot = new THREE.Group();
    whaleRoot.position.set(-0.02, 0.80, 0.02);
    whaleRoot.rotation.set(-0.10, -0.44, 0.08);
    visualPivot.add(whaleRoot);

    const innerSkeletonGroup = new THREE.Group();
    whaleRoot.add(innerSkeletonGroup);

    const spinePts = [
      new THREE.Vector3(0, 0.032, 0.50),
      new THREE.Vector3(0, 0.052, 0.24),
      new THREE.Vector3(0, 0.042, 0.0),
      new THREE.Vector3(0, 0.008, -0.28),
      new THREE.Vector3(0, -0.058, -0.58),
      new THREE.Vector3(0, -0.115, -0.74),
    ];
    const spineGeo = trackGeo(
      createTaperedCurveGeo(spinePts, [0.012, 0.017, 0.018, 0.015, 0.011, 0.007], 22, 8, 1.0, true),
    );
    const spineMesh = new THREE.Mesh(spineGeo, bioSkeletonMat);
    spineMesh.renderOrder = 1;
    innerSkeletonGroup.add(spineMesh);
    bloomTargets.push(spineMesh);

    const ribSpecs = [
      { z: 0.32, spanX: 0.14, dropY: 0.075, sweepZ: -0.05, r: 0.0068 },
      { z: 0.20, spanX: 0.20, dropY: 0.100, sweepZ: -0.07, r: 0.0076 },
      { z: 0.07, spanX: 0.22, dropY: 0.108, sweepZ: -0.08, r: 0.0078 },
      { z: -0.06, spanX: 0.19, dropY: 0.092, sweepZ: -0.08, r: 0.0072 },
      { z: -0.19, spanX: 0.14, dropY: 0.074, sweepZ: -0.07, r: 0.0064 },
      { z: -0.32, spanX: 0.098, dropY: 0.054, sweepZ: -0.06, r: 0.0056 },
      { z: -0.45, spanX: 0.064, dropY: 0.038, sweepZ: -0.05, r: 0.0048 },
    ];
    const vertebraRingGeo = trackGeo(new THREE.TorusGeometry(0.022, 0.0045, 6, 14));

    for (const rs of ribSpecs) {
      for (const side of [-1, 1]) {
        const pts = [
          new THREE.Vector3(0, 0.044, rs.z),
          new THREE.Vector3(side * rs.spanX * 0.72, 0.016, rs.z + rs.sweepZ * 0.45),
          new THREE.Vector3(side * rs.spanX, -rs.dropY * 0.42, rs.z + rs.sweepZ),
          new THREE.Vector3(side * rs.spanX * 0.42, -rs.dropY, rs.z + rs.sweepZ * 1.15),
        ];
        const rGeo = trackGeo(createTaperedCurveGeo(pts, [rs.r, rs.r * 0.9, rs.r * 0.72, rs.r * 0.45], 12, 6, 1.0, true));
        const rMesh = new THREE.Mesh(rGeo, bioSkeletonMat);
        rMesh.renderOrder = 1;
        innerSkeletonGroup.add(rMesh);
        bloomTargets.push(rMesh);
      }
      const vRing = new THREE.Mesh(vertebraRingGeo, satinGoldMat);
      vRing.position.set(0, 0.042 - Math.max(0, -rs.z) * 0.16, rs.z);
      vRing.renderOrder = 1;
      innerSkeletonGroup.add(vRing);
    }

    for (const side of [-1, 1]) {
      const cranialPts = [
        new THREE.Vector3(0, 0.028, 0.54),
        new THREE.Vector3(side * 0.075, 0.022, 0.42),
        new THREE.Vector3(side * 0.128, 0.008, 0.24),
      ];
      const cranialGeo = trackGeo(createTaperedCurveGeo(cranialPts, [0.005, 0.0068, 0.0045], 10, 5, 1.0, true));
      const cranialMesh = new THREE.Mesh(cranialGeo, bioSkeletonMat);
      cranialMesh.renderOrder = 1;
      innerSkeletonGroup.add(cranialMesh);
      bloomTargets.push(cranialMesh);
    }

    const sonarGroup = new THREE.Group();
    sonarGroup.position.set(0, -0.012, 0.12);
    whaleRoot.add(sonarGroup);

    const sonarOrbGeo = trackGeo(new THREE.OctahedronGeometry(0.056, 1));
    const sonarOrb = new THREE.Mesh(sonarOrbGeo, sonarCoreMat);
    sonarOrb.renderOrder = 1;
    sonarGroup.add(sonarOrb);
    bloomTargets.push(sonarOrb);

    const sonarRing1Geo = trackGeo(new THREE.TorusGeometry(0.088, 0.0065, 8, 28));
    const sonarRing1 = new THREE.Mesh(sonarRing1Geo, satinGoldMat);
    sonarRing1.renderOrder = 1;
    sonarGroup.add(sonarRing1);

    const sonarRing2Geo = trackGeo(new THREE.TorusGeometry(0.112, 0.005, 8, 28));
    const sonarRing2 = new THREE.Mesh(sonarRing2Geo, bioSkeletonMat);
    sonarRing2.rotation.x = Math.PI * 0.42;
    sonarRing2.renderOrder = 1;
    sonarGroup.add(sonarRing2);
    bloomTargets.push(sonarRing2);

    const bodyGeo = trackGeo(createBionicStarMantaBodyGeo());
    const bodyMesh = new THREE.Mesh(bodyGeo, iceJadeBodyMat);
    bodyMesh.renderOrder = 3;
    whaleRoot.add(bodyMesh);

    const leftWingPivot = new THREE.Group();
    leftWingPivot.position.set(-0.02, -0.005, 0.04);
    whaleRoot.add(leftWingPivot);

    const rightWingPivot = new THREE.Group();
    rightWingPivot.position.set(0.02, -0.005, 0.04);
    whaleRoot.add(rightWingPivot);

    const leftWingGeo = trackGeo(createBionicMantaWingGeo(-1));
    const rightWingGeo = trackGeo(createBionicMantaWingGeo(1));
    const leftWingMesh = new THREE.Mesh(leftWingGeo, iceJadeWingMat);
    const rightWingMesh = new THREE.Mesh(rightWingGeo, iceJadeWingMat);
    leftWingMesh.renderOrder = 3;
    rightWingMesh.renderOrder = 3;
    leftWingPivot.add(leftWingMesh);
    rightWingPivot.add(rightWingMesh);

    const wingVeinEntries: SkinnedBatchEntry[] = [];
    for (const side of [-1, 1] as const) {
      const pivot = side < 0 ? leftWingPivot : rightWingPivot;
      for (let v = 0; v < 4; v += 1) {
        const zOff = 0.15 - v * 0.054;
        const reach = 0.58 - v * 0.115;
        const sweepBack = 0.22 - v * 0.025;
        const pts = [
          new THREE.Vector3(side * 0.12, 0.006, zOff),
          new THREE.Vector3(side * (0.12 + reach * 0.52), 0.058, zOff - sweepBack * 0.45),
          new THREE.Vector3(side * (0.12 + reach), 0.052 - v * 0.010, zOff - sweepBack),
        ];
        const vGeo = trackGeo(createTaperedCurveGeo(pts, [0.0058, 0.0044, 0.0020], 12, 5, 1.0, true));
        const vMesh = new THREE.Mesh(vGeo, bioSkeletonMat);
        vMesh.renderOrder = 1;
        pivot.add(vMesh);
        wingVeinEntries.push({ mesh: vMesh, boneParent: pivot });
      }
    }

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0, -0.105, -0.74);
    whaleRoot.add(tailPivot);

    const flukeGeo = trackGeo(createBionicTailFlukeGeo());
    const flukeMesh = new THREE.Mesh(flukeGeo, iceJadeWingMat);
    flukeMesh.renderOrder = 3;
    tailPivot.add(flukeMesh);

    const veilParts: THREE.BufferGeometry[] = [];
    const veilSpecs: [number, number, number, number, number, number, number][] = [
      [0.0, 0.02, -0.02, 0.94, 0.112, 0.06, 0.05],
      [-0.11, 0.01, -0.05, 0.86, 0.084, -0.02, -0.14],
      [0.11, 0.01, -0.05, 0.86, 0.084, -0.02, 0.14],
      [-0.24, 0.04, -0.14, 0.72, 0.066, 0.06, -0.20],
      [0.24, 0.04, -0.14, 0.72, 0.066, 0.06, 0.20],
      [-0.07, -0.04, -0.04, 0.78, 0.058, -0.07, -0.07],
      [0.07, -0.04, -0.04, 0.78, 0.058, -0.07, 0.07],
    ];
    for (const [ox, oy, oz, len, w, ay, cx] of veilSpecs) {
      const g = createAuroraTailVeilGeo(len, w, ay, cx, 18);
      const m = new THREE.Matrix4().makeTranslation(ox, oy, oz);
      veilParts.push(normalizeGeometryForMerge(g, m));
      g.dispose();
    }
    const mergedVeilsGeo = trackGeo(mergeGeometries(veilParts, false)!);
    for (const vp of veilParts) vp.dispose();
    const auroraVeilsMesh = new THREE.Mesh(mergedVeilsGeo, auroraVeilMat);
    auroraVeilsMesh.renderOrder = 4;
    tailPivot.add(auroraVeilsMesh);

    const hardwareGroup = new THREE.Group();
    whaleRoot.add(hardwareGroup);

    const finSpineSpecs = [
      { z: 0.24, y: 0.185, h: 0.105, c: 0.080, s: 0.072 },
      { z: 0.09, y: 0.192, h: 0.148, c: 0.096, s: 0.096 },
      { z: -0.06, y: 0.172, h: 0.132, c: 0.088, s: 0.088 },
      { z: -0.20, y: 0.138, h: 0.110, c: 0.076, s: 0.076 },
      { z: -0.34, y: 0.098, h: 0.088, c: 0.064, s: 0.064 },
      { z: -0.47, y: 0.052, h: 0.068, c: 0.052, s: 0.052 },
      { z: -0.60, y: 0.002, h: 0.052, c: 0.042, s: 0.042 },
    ];
    const finTipGeo = trackGeo(new THREE.OctahedronGeometry(0.011, 0));

    for (const fs of finSpineSpecs) {
      const bladeGeo = trackGeo(createSurveyFinBladeGeo(fs.h, fs.c, fs.s));
      const blade = new THREE.Mesh(bladeGeo, satinGoldMat);
      blade.position.set(0, fs.y, fs.z);
      blade.renderOrder = 4;
      hardwareGroup.add(blade);

      const baseRailGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.011, fs.c * 0.85, 8));
      baseRailGeo.rotateX(Math.PI * 0.5);
      const baseRail = new THREE.Mesh(baseRailGeo, darkTitaniumMat);
      baseRail.position.set(0, fs.y - 0.004, fs.z - fs.c * 0.42);
      baseRail.renderOrder = 4;
      hardwareGroup.add(baseRail);

      const tipPip = new THREE.Mesh(finTipGeo, sonarCoreMat);
      tipPip.position.set(0, fs.y + fs.h * 0.90, fs.z - fs.s * 0.90);
      tipPip.renderOrder = 4;
      hardwareGroup.add(tipPip);
      bloomTargets.push(tipPip);
    }

    const probeCrownGroup = new THREE.Group();
    probeCrownGroup.position.set(0, 0.165, 0.36);
    hardwareGroup.add(probeCrownGroup);

    const fairingPts = [
      new THREE.Vector3(0, -0.006, 0.16),
      new THREE.Vector3(0, 0.020, 0.04),
      new THREE.Vector3(0, 0.018, -0.10),
    ];
    const fairingGeo = trackGeo(createTaperedCurveGeo(fairingPts, [0.008, 0.024, 0.012], 12, 8, 1.35, true));
    const fairingMesh = new THREE.Mesh(fairingGeo, darkTitaniumMat);
    fairingMesh.renderOrder = 4;
    probeCrownGroup.add(fairingMesh);

    for (const side of [-1, 1]) {
      const antennaPts = [
        new THREE.Vector3(side * 0.022, 0.014, 0.05),
        new THREE.Vector3(side * 0.068, 0.078, -0.02),
        new THREE.Vector3(side * 0.088, 0.128, -0.14),
      ];
      const antennaGeo = trackGeo(createTaperedCurveGeo(antennaPts, [0.0075, 0.0055, 0.0025], 12, 6, 1.0, true));
      const antenna = new THREE.Mesh(antennaGeo, satinGoldMat);
      antenna.renderOrder = 4;
      probeCrownGroup.add(antenna);
    }

    const probeNeedleGeo = trackGeo(new THREE.ConeGeometry(0.012, 0.22, 8));
    probeNeedleGeo.rotateX(Math.PI * 0.44);
    const probeNeedle = new THREE.Mesh(probeNeedleGeo, satinGoldMat);
    probeNeedle.position.set(0, 0.072, 0.12);
    probeNeedle.renderOrder = 4;
    probeCrownGroup.add(probeNeedle);

    const probeRingGeo = trackGeo(createGraduatedAstrolabeRingGeo(0.066, 0.009, 0.005, 12));
    const probeRing = new THREE.Mesh(probeRingGeo, satinGoldMat);
    probeRing.position.set(0, 0.084, 0.01);
    probeRing.rotation.set(0.55, 0.2, 0.3);
    probeRing.renderOrder = 4;
    probeCrownGroup.add(probeRing);

    const probeBeaconGeo = trackGeo(new THREE.OctahedronGeometry(0.020, 0));
    const probeBeacon = new THREE.Mesh(probeBeaconGeo, sonarCoreMat);
    probeBeacon.position.set(0, 0.084, 0.01);
    probeBeacon.renderOrder = 4;
    probeCrownGroup.add(probeBeacon);
    bloomTargets.push(probeBeacon);

    const sonarWaveGeo = trackGeo(new THREE.PlaneGeometry(1.65, 1.65));
    const sonarWaveMesh = new THREE.Mesh(sonarWaveGeo, sonarRippleMat);
    sonarWaveMesh.position.set(0, 0.0, 0.36);
    sonarWaveMesh.renderOrder = 5;
    whaleRoot.add(sonarWaveMesh);
    bloomTargets.push(sonarWaveMesh);

    const bubbleGeo = trackGeo(new THREE.SphereGeometry(0.022, 12, 10));
    const bubbleCount = 14;
    const bubbleInstanced = new THREE.InstancedMesh(bubbleGeo, bubbleMat, bubbleCount);
    bubbleInstanced.frustumCulled = false;
    bubbleInstanced.renderOrder = 5;
    visualPivot.add(bubbleInstanced);

    batchStaticChildrenByMaterial(innerSkeletonGroup, new Set(), bloomTargets, ownedGeos);
    batchStaticChildrenByMaterial(hardwareGroup, new Set(), bloomTargets, ownedGeos);
    const wingVeinsSkinned = collectSkinnedBatchFromMeshes(
      whaleRoot,
      wingVeinEntries,
      bioSkeletonMat,
      ownedGeos,
      bloomTargets,
    );
    if (wingVeinsSkinned) {
      wingVeinsSkinned.renderOrder = 1;
    }

    const bMat = new THREE.Matrix4();
    const bPos = new THREE.Vector3();
    const bQuat = new THREE.Quaternion();
    const bScale = new THREE.Vector3();

    customUpdate = (_dt, elapsedSec, emoteRatio) => {
      const emoteBell = emoteKind ? Math.sin(emoteRatio * Math.PI) : 0;
      iceJadeBodyMat.uniforms['uTime']!.value = elapsedSec;
      iceJadeWingMat.uniforms['uTime']!.value = elapsedSec;
      auroraVeilMat.uniforms['uTime']!.value = elapsedSec;
      auroraVeilMat.uniforms['uBoost']!.value = 1.0 + emoteBell * 0.45;
      bubbleMat.uniforms['uTime']!.value = elapsedSec;

      const wingBeat = Math.sin(elapsedSec * 2.1) * (0.14 + emoteBell * 0.24);
      leftWingPivot.rotation.z = -wingBeat;
      leftWingPivot.rotation.x = Math.cos(elapsedSec * 2.1) * 0.06;
      rightWingPivot.rotation.z = wingBeat;
      rightWingPivot.rotation.x = Math.cos(elapsedSec * 2.1) * 0.06;

      tailPivot.rotation.x = Math.sin(elapsedSec * 2.1 - 0.9) * (0.12 + emoteBell * 0.16);
      tailPivot.rotation.y = Math.cos(elapsedSec * 1.45) * 0.08;

      whaleRoot.rotation.x = -0.10 + Math.sin(elapsedSec * 1.6) * 0.04;
      whaleRoot.rotation.y = -0.44 + Math.sin(elapsedSec * 0.85) * 0.06;
      whaleRoot.rotation.z = 0.08 + Math.sin(elapsedSec * 1.1) * 0.035;

      sonarRing1.rotation.y = elapsedSec * 1.35;
      sonarRing1.rotation.x = elapsedSec * 0.72;
      sonarRing2.rotation.z = -elapsedSec * 1.15;
      sonarOrb.scale.setScalar(1.0 + Math.sin(elapsedSec * 3.4) * 0.10 + emoteBell * 0.26);

      if (emoteKind) {
        sonarWaveMesh.visible = true;
        sonarRippleMat.uniforms['uProgress']!.value = emoteRatio;
        sonarRippleMat.uniforms['uIntensity']!.value = Math.sin(emoteRatio * Math.PI) * 0.92;
      } else {
        const pulseCycle = (elapsedSec * 0.42) % 1;
        sonarWaveMesh.visible = true;
        sonarRippleMat.uniforms['uProgress']!.value = pulseCycle;
        sonarRippleMat.uniforms['uIntensity']!.value = Math.sin(pulseCycle * Math.PI) * 0.18;
      }

      for (let i = 0; i < bubbleCount; i += 1) {
        const phase = (i / bubbleCount) * Math.PI * 2;
        const drift = (elapsedSec * (0.28 + (i % 3) * 0.08) + i * 0.23) % 1.0;
        const side = i % 2 === 0 ? 1 : -1;
        const x = side * (0.28 + (i % 4) * 0.14) + Math.sin(elapsedSec * 1.6 + phase) * 0.06;
        const y = 0.24 + drift * 1.12;
        const z = 0.36 - drift * 0.95 + Math.cos(elapsedSec * 1.3 + phase) * 0.08;
        bPos.set(x, y, z);
        const sc = (0.45 + (i % 4) * 0.24) * Math.sin(drift * Math.PI);
        bScale.setScalar(Math.max(0.05, sc));
        bMat.compose(bPos, bQuat, bScale);
        bubbleInstanced.setMatrixAt(i, bMat);
      }
      bubbleInstanced.instanceMatrix.needsUpdate = true;
    };
  } else {
    const obsidianVelvetMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x0c0818),
        roughness: 0.68,
        metalness: 0.14,
        envMapIntensity: 0.28,
        sheen: 0.48,
        sheenRoughness: 0.62,
        sheenColor: new THREE.Color(0x462b70),
      }),
    );

    const earInnerMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0x23163b),
        roughness: 0.82,
        metalness: 0.04,
        envMapIntensity: 0.18,
      }),
    );

    const blackHoleMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x020105,
      }),
    );

    const slitEyeMat = trackMat(createFelineSlitEyeShader());
    const accretionMat = trackMat(createAccretionDiskShader());

    const photonHaloMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf8d994,
        transparent: true,
        opacity: 0.88,
      }),
    );

    const starPipMat = trackMat(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
      }),
    );

    const furTex = extractAuthenticFurTexture();
    ownedTextures.push(furTex);

    const lynxRoot = new THREE.Group();
    visualPivot.add(lynxRoot);

    const bodyPivot = new THREE.Group();
    lynxRoot.add(bodyPivot);

    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.00, 0.11);
    bodyPivot.add(headPivot);

    const earsPivot = new THREE.Group();
    headPivot.add(earsPivot);

    const tailPivot = new THREE.Group();
    tailPivot.position.set(0.02, 0.18, -0.18);
    bodyPivot.add(tailPivot);

    const furParts: BatchedFurPartSpec[] = [];
    const pushFur = (
      geo: THREE.BufferGeometry,
      partIndex: number,
      pos: [number, number, number],
      rot: [number, number, number],
      scl: [number, number, number],
      opts: {
        baseColor: number;
        tipColor: number;
        rimColor: number;
        layers: number;
        furLength: number;
        densityScale: number;
        rimStrength: number;
        droop: number;
      },
    ): void => {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(pos[0], pos[1], pos[2]),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])),
        new THREE.Vector3(scl[0], scl[1], scl[2]),
      );
      furParts.push({
        geo,
        localMatrix: m,
        partIndex,
        ...opts,
      });
    };

    const bodyFurOpts = {
      baseColor: 0x0d091b,
      tipColor: 0x2b1c4a,
      rimColor: 0xf0cc90,
      layers: 7,
      furLength: 0.022,
      densityScale: 9.8,
      rimStrength: 1.12,
      droop: 0.007,
    };

    const flankFurOpts = {
      baseColor: 0x0d091b,
      tipColor: 0x2b1c4a,
      rimColor: 0xdeb8ea,
      layers: 7,
      furLength: 0.022,
      densityScale: 9.8,
      rimStrength: 1.04,
      droop: 0.007,
    };

    const headFurOpts = {
      baseColor: 0x0e0a1d,
      tipColor: 0x2e1f4f,
      rimColor: 0xf4d298,
      layers: 7,
      furLength: 0.015,
      densityScale: 11.4,
      rimStrength: 1.14,
      droop: 0.003,
    };

    const ruffFurOpts = {
      baseColor: 0x100b21,
      tipColor: 0x35235c,
      rimColor: 0xf5d49a,
      layers: 7,
      furLength: 0.028,
      densityScale: 9.0,
      rimStrength: 1.22,
      droop: 0.010,
    };

    const tailFurOpts = {
      baseColor: 0x0c0819,
      tipColor: 0x2c1b4d,
      rimColor: 0xedc88c,
      layers: 6,
      furLength: 0.023,
      densityScale: 9.4,
      rimStrength: 1.15,
      droop: 0.005,
    };

    pushFur(createUnifiedLynxBodyAndNeckGeo(), 0, [0, 0, 0], [0, 0, 0], [1, 1, 1], bodyFurOpts);

    const chestRuffGeo = new THREE.SphereGeometry(0.105, 16, 12);
    pushFur(chestRuffGeo, 0, [0, 0.68, 0.11], [0.22, 0, 0], [1.02, 1.18, 0.72], ruffFurOpts);

    for (const side of [-1, 1]) {
      pushFur(
        createSculptedLynxHaunchGeo(),
        0,
        [side * 0.098, 0.21, -0.078],
        [-0.18, side * 0.14, 0],
        [0.96, 1.04, 1.04],
        flankFurOpts,
      );

      pushFur(
        createSculptedFelinePawGeo(),
        0,
        [side * 0.108, 0.042, -0.010],
        [0, side * 0.22, 0],
        [0.90, 0.90, 0.95],
        bodyFurOpts,
      );

      const forelegPts = [
        new THREE.Vector3(side * 0.056, 0.66, 0.038),
        new THREE.Vector3(side * 0.078, 0.54, 0.098),
        new THREE.Vector3(side * 0.074, 0.34, 0.146),
        new THREE.Vector3(side * 0.064, 0.14, 0.168),
        new THREE.Vector3(side * 0.063, 0.046, 0.180),
      ];
      pushFur(
        createTaperedCurveGeo(forelegPts, [0.058, 0.052, 0.041, 0.034, 0.031], 14, 10, 0.94, true),
        0,
        [0, 0, 0],
        [0, 0, 0],
        [1, 1, 1],
        bodyFurOpts,
      );

      pushFur(
        createSculptedFelinePawGeo(),
        0,
        [side * 0.063, 0.036, 0.208],
        [0, side * 0.05, 0],
        [0.94, 0.94, 0.96],
        bodyFurOpts,
      );
    }

    pushFur(createRealisticLynxHeadGeo(), 1, [0, 0, 0], [0.02, 0, 0], [1, 1, 1], headFurOpts);

    for (const side of [-1, 1]) {
      const earGeo = createRealisticLynxEarGeo(0.056, 0.245, 0.018);
      pushFur(
        earGeo,
        2,
        [side * 0.068, 0.068, -0.012],
        [-0.08, side * 0.20, -side * 0.16],
        [1, 1, 1],
        headFurOpts,
      );
    }

    const tailPts = [
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(0.22, 0.06, -0.14),
      new THREE.Vector3(0.41, 0.34, -0.05),
      new THREE.Vector3(0.44, 0.62, 0.12),
      new THREE.Vector3(0.32, 0.72, 0.20),
    ];
    pushFur(
      createTaperedCurveGeo(tailPts, [0.048, 0.042, 0.036, 0.030, 0.022], 22, 10, 1.0, true),
      3,
      [0, 0, 0],
      [0, 0, 0],
      [1, 1, 1],
      tailFurOpts,
    );

    const lynxFurRig = createBatchedShellFur(furParts, furTex, ownedGeos, ownedMats);
    for (const m of lynxFurRig.meshes) {
      lynxRoot.add(m);
    }

    const eyeLensGeo = trackGeo(createAlmondEyeLensGeo(0.072, 0.036));
    const eyeParts: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(side * 0.055, 0.016, 0.145),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.04, side * 0.36, side * 0.25)),
        new THREE.Vector3(1, 1, 1),
      );
      eyeParts.push(normalizeGeometryForMerge(eyeLensGeo, m));
    }
    const mergedEyesGeo = trackGeo(mergeGeometries(eyeParts, false)!);
    for (const ep of eyeParts) ep.dispose();
    const eyesMesh = new THREE.Mesh(mergedEyesGeo, slitEyeMat);
    eyesMesh.renderOrder = 3;
    headPivot.add(eyesMesh);
    bloomTargets.push(eyesMesh);

    const obsidianDetailEntries: SkinnedBatchEntry[] = [];
    const eyelidPts = [
      new THREE.Vector3(-0.038, -0.002, 0.0),
      new THREE.Vector3(0.0, 0.017, 0.011),
      new THREE.Vector3(0.038, -0.002, 0.0),
    ];
    const eyelidGeo = trackGeo(createTaperedCurveGeo(eyelidPts, [0.0035, 0.0055, 0.004], 10, 5, 1.0, true));
    for (const side of [-1, 1]) {
      const lid = new THREE.Mesh(eyelidGeo, obsidianVelvetMat);
      lid.position.set(side * 0.055, 0.017, 0.146);
      lid.rotation.set(-0.04, side * 0.36, side * 0.25);
      headPivot.add(lid);
      obsidianDetailEntries.push({ mesh: lid, boneParent: headPivot });
    }

    const noseGeo = trackGeo(new THREE.OctahedronGeometry(0.018, 1));
    noseGeo.scale(1.18, 0.72, 0.88);
    const noseMesh = new THREE.Mesh(noseGeo, obsidianVelvetMat);
    noseMesh.position.set(0, -0.025, 0.210);
    headPivot.add(noseMesh);
    obsidianDetailEntries.push({ mesh: noseMesh, boneParent: headPivot });

    const earInnerGeo = trackGeo(new THREE.ConeGeometry(0.028, 0.155, 6));
    for (const side of [-1, 1]) {
      const innerEar = new THREE.Mesh(earInnerGeo, earInnerMat);
      innerEar.position.set(side * 0.070, 0.165, 0.014);
      innerEar.rotation.set(-0.08, side * 0.22, -side * 0.15);
      innerEar.scale.set(1.0, 1.0, 0.28);
      earsPivot.add(innerEar);
      obsidianDetailEntries.push({ mesh: innerEar, boneParent: earsPivot });
    }

    const goldJewelryEntries: SkinnedBatchEntry[] = [];
    const pipEntries: SkinnedBatchEntry[] = [];

    const browSigilGeo = trackGeo(new THREE.OctahedronGeometry(0.011, 0));
    browSigilGeo.scale(0.65, 1.45, 0.55);
    const browSigil = new THREE.Mesh(browSigilGeo, satinGoldMat);
    browSigil.position.set(0, 0.052, 0.162);
    headPivot.add(browSigil);
    goldJewelryEntries.push({ mesh: browSigil, boneParent: headPivot });

    const earTuftPts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.007, 0.042, -0.006),
      new THREE.Vector3(0.016, 0.090, -0.020),
    ];
    const earTuftGeo = trackGeo(createTaperedCurveGeo(earTuftPts, [0.0085, 0.005, 0.002], 8, 5, 1.0, true));
    for (const side of [-1, 1]) {
      const tuft = new THREE.Mesh(earTuftGeo, satinGoldMat);
      tuft.position.set(side * 0.104, 0.304, -0.052);
      tuft.rotation.set(-0.06, side * 0.20, -side * 0.20);
      tuft.scale.x = side;
      earsPivot.add(tuft);
      goldJewelryEntries.push({ mesh: tuft, boneParent: earsPivot });
    }

    const earring1Geo = trackGeo(new THREE.TorusGeometry(0.022, 0.004, 8, 20));
    const earring1 = new THREE.Mesh(earring1Geo, satinGoldMat);
    earring1.position.set(-0.116, 0.192, -0.012);
    earring1.rotation.set(0.32, 0.65, 0.25);
    earsPivot.add(earring1);
    goldJewelryEntries.push({ mesh: earring1, boneParent: earsPivot });

    const earring2Geo = trackGeo(new THREE.TorusGeometry(0.016, 0.0034, 8, 18));
    const earring2 = new THREE.Mesh(earring2Geo, satinGoldMat);
    earring2.position.set(-0.110, 0.222, -0.018);
    earring2.rotation.set(0.45, 0.58, 0.15);
    earsPivot.add(earring2);
    goldJewelryEntries.push({ mesh: earring2, boneParent: earsPivot });

    const earBeadGeo = trackGeo(new THREE.OctahedronGeometry(0.0095, 0));
    const earBead = new THREE.Mesh(earBeadGeo, starPipMat);
    earBead.position.set(-0.132, 0.174, -0.006);
    earsPivot.add(earBead);
    pipEntries.push({ mesh: earBead, boneParent: earsPivot, colorHex: 0xffe49c });

    const collarUpperGeo = trackGeo(new THREE.TorusGeometry(0.112, 0.0085, 10, 32));
    collarUpperGeo.rotateX(Math.PI * 0.5);
    const collarUpper = new THREE.Mesh(collarUpperGeo, satinGoldMat);
    collarUpper.position.set(0, 0.822, 0.092);
    collarUpper.rotation.x = 0.24;
    bodyPivot.add(collarUpper);
    goldJewelryEntries.push({ mesh: collarUpper, boneParent: bodyPivot });

    const collarLowerGeo = trackGeo(new THREE.TorusGeometry(0.130, 0.0072, 10, 32));
    collarLowerGeo.rotateX(Math.PI * 0.5);
    const collarLower = new THREE.Mesh(collarLowerGeo, satinGoldMat);
    collarLower.position.set(0, 0.788, 0.098);
    collarLower.rotation.x = 0.28;
    bodyPivot.add(collarLower);
    goldJewelryEntries.push({ mesh: collarLower, boneParent: bodyPivot });

    const pendantRingGeo = trackGeo(new THREE.TorusGeometry(0.032, 0.0052, 8, 24));
    const pendantRing = new THREE.Mesh(pendantRingGeo, satinGoldMat);
    pendantRing.position.set(0, 0.738, 0.222);
    pendantRing.rotation.x = -0.18;
    bodyPivot.add(pendantRing);
    goldJewelryEntries.push({ mesh: pendantRing, boneParent: bodyPivot });

    const pendantGemGeo = trackGeo(new THREE.OctahedronGeometry(0.018, 0));
    pendantGemGeo.scale(0.85, 1.25, 0.75);
    const pendantGem = new THREE.Mesh(pendantGemGeo, starPipMat);
    pendantGem.position.set(0, 0.738, 0.224);
    bodyPivot.add(pendantGem);
    pipEntries.push({ mesh: pendantGem, boneParent: bodyPivot, colorHex: 0xdcaeff });

    const ankletGeo = trackGeo(new THREE.TorusGeometry(0.041, 0.0048, 8, 20));
    ankletGeo.rotateX(Math.PI * 0.5);
    for (const side of [-1, 1]) {
      const anklet = new THREE.Mesh(ankletGeo, satinGoldMat);
      anklet.position.set(side * 0.063, 0.104, 0.175);
      bodyPivot.add(anklet);
      goldJewelryEntries.push({ mesh: anklet, boneParent: bodyPivot });
    }

    const neckOrbitPivot = new THREE.Group();
    neckOrbitPivot.position.set(0, 0.81, 0.092);
    neckOrbitPivot.rotation.set(0.32, 0, -0.14);
    bodyPivot.add(neckOrbitPivot);

    const neckOrbitGeo = trackGeo(createGraduatedAstrolabeRingGeo(0.225, 0.011, 0.0065, 16));
    const neckOrbitMesh = new THREE.Mesh(neckOrbitGeo, satinGoldMat);
    neckOrbitPivot.add(neckOrbitMesh);
    goldJewelryEntries.push({ mesh: neckOrbitMesh, boneParent: neckOrbitPivot });

    const neckOrbitPip = new THREE.Mesh(earBeadGeo, starPipMat);
    neckOrbitPip.position.set(0.225, 0, 0);
    neckOrbitPivot.add(neckOrbitPip);
    pipEntries.push({ mesh: neckOrbitPip, boneParent: neckOrbitPivot, colorHex: 0xffe49c });

    const singularityGroup = new THREE.Group();
    singularityGroup.position.set(0.30, 0.79, 0.20);
    tailPivot.add(singularityGroup);

    const horizonGeo = trackGeo(new THREE.SphereGeometry(0.062, 24, 18));
    const horizonMesh = new THREE.Mesh(horizonGeo, blackHoleMat);
    horizonMesh.renderOrder = 3;
    singularityGroup.add(horizonMesh);

    const accretionGeo = trackGeo(new THREE.PlaneGeometry(0.38, 0.38));
    accretionGeo.rotateX(-Math.PI * 0.5);
    const accretionDisk = new THREE.Mesh(accretionGeo, accretionMat);
    accretionDisk.rotation.set(0.42, 0.18, -0.28);
    accretionDisk.renderOrder = 4;
    singularityGroup.add(accretionDisk);
    bloomTargets.push(accretionDisk);

    const lensingGeo = trackGeo(new THREE.TorusGeometry(0.086, 0.005, 8, 36));
    const lensingHalo = new THREE.Mesh(lensingGeo, photonHaloMat);
    lensingHalo.rotation.set(0.22, -0.28, 0.15);
    lensingHalo.renderOrder = 4;
    singularityGroup.add(lensingHalo);
    bloomTargets.push(lensingHalo);

    const caliperPivot = new THREE.Group();
    singularityGroup.add(caliperPivot);
    const caliperGeo = trackGeo(createGraduatedAstrolabeRingGeo(0.142, 0.009, 0.0055, 12));
    const caliperMesh = new THREE.Mesh(caliperGeo, satinGoldMat);
    caliperMesh.rotation.set(0.75, 0.2, 0.4);
    caliperPivot.add(caliperMesh);
    goldJewelryEntries.push({ mesh: caliperMesh, boneParent: caliperPivot });

    const moteGeo = trackGeo(new THREE.OctahedronGeometry(0.011, 0));
    const moteMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xe6c8ff,
        transparent: true,
        opacity: 0.78,
      }),
    );
    const moteCount = 12;
    const moteInstanced = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    moteInstanced.frustumCulled = false;
    visualPivot.add(moteInstanced);
    bloomTargets.push(moteInstanced);

    collectSkinnedBatchFromMeshes(lynxRoot, obsidianDetailEntries, obsidianVelvetMat, ownedGeos);
    collectSkinnedBatchFromMeshes(lynxRoot, goldJewelryEntries, satinGoldMat, ownedGeos);
    collectSkinnedBatchFromMeshes(lynxRoot, pipEntries, starPipMat, ownedGeos, bloomTargets);

    const invLynxWorld = new THREE.Matrix4();
    const syncFurMatrices = (): void => {
      lynxRoot.updateMatrixWorld(true);
      invLynxWorld.copy(lynxRoot.matrixWorld).invert();
      lynxFurRig.partMatrices[0]!.multiplyMatrices(invLynxWorld, bodyPivot.matrixWorld);
      lynxFurRig.partMatrices[1]!.multiplyMatrices(invLynxWorld, headPivot.matrixWorld);
      lynxFurRig.partMatrices[2]!.multiplyMatrices(invLynxWorld, earsPivot.matrixWorld);
      lynxFurRig.partMatrices[3]!.multiplyMatrices(invLynxWorld, tailPivot.matrixWorld);
    };
    syncFurMatrices();

    const mMat = new THREE.Matrix4();
    const mPos = new THREE.Vector3();
    const mQuat = new THREE.Quaternion();
    const mScale = new THREE.Vector3();

    customUpdate = (_dt, elapsedSec, emoteRatio) => {
      const emoteBell = emoteKind ? Math.sin(emoteRatio * Math.PI) : 0;
      slitEyeMat.uniforms['uTime']!.value = elapsedSec;
      slitEyeMat.uniforms['uDilate']!.value = emoteBell;
      accretionMat.uniforms['uTime']!.value = elapsedSec;
      accretionMat.uniforms['uBoost']!.value = 1.0 + emoteBell * 0.55;
      lynxFurRig.update(elapsedSec);

      headPivot.rotation.y = Math.sin(elapsedSec * 0.92) * 0.085;
      headPivot.rotation.z = Math.sin(elapsedSec * 1.35) * 0.032;
      headPivot.rotation.x = Math.sin(elapsedSec * 1.1) * 0.022 - emoteBell * 0.08;
      earsPivot.rotation.x = Math.sin(elapsedSec * 2.8) * 0.032 + emoteBell * 0.06;

      tailPivot.rotation.y = Math.sin(elapsedSec * 1.65) * (0.11 + emoteBell * 0.14);
      tailPivot.rotation.z = Math.cos(elapsedSec * 1.25) * 0.04;

      neckOrbitPivot.rotation.y = elapsedSec * 0.68;
      caliperPivot.rotation.y = -elapsedSec * 1.15;
      caliperPivot.rotation.z = Math.sin(elapsedSec * 0.85) * 0.25;
      lensingHalo.rotation.z = elapsedSec * 0.72;
      singularityGroup.scale.setScalar(1.0 + Math.sin(elapsedSec * 2.8) * 0.04 + emoteBell * 0.16);

      for (let i = 0; i < moteCount; i += 1) {
        const phase = (i / moteCount) * Math.PI * 2;
        const ang = phase + elapsedSec * (0.65 + (i % 3) * 0.18);
        const rad = 0.20 + (i % 4) * 0.045;
        mPos.set(
          0.32 + Math.cos(ang) * rad,
          0.98 + Math.sin(ang * 2) * 0.09,
          0.0 + Math.sin(ang) * rad,
        );
        mScale.setScalar((0.6 + 0.4 * Math.sin(elapsedSec * 3.1 + i)) * (1 + emoteBell * 0.3));
        mMat.compose(mPos, mQuat, mScale);
        moteInstanced.setMatrixAt(i, mMat);
      }
      moteInstanced.instanceMatrix.needsUpdate = true;

      syncFurMatrices();
    };
  }

  disposeUnusedGeos(root, ownedGeos);

  const syncBurstInstances = (): void => {
    let anyActive = false;
    for (let i = 0; i < burstParticles.length; i += 1) {
      const p = burstParticles[i]!;
      if (p.active) {
        anyActive = true;
        burstTempScale.setScalar(p.scale);
        burstTempMatrix.compose(p.pos, burstTempQuat, burstTempScale);
      } else {
        burstTempScale.setScalar(0);
        burstTempMatrix.compose(p.pos, burstTempQuat, burstTempScale);
      }
      burstInstanced.setMatrixAt(i, burstTempMatrix);
    }
    burstInstanced.visible = anyActive;
    if (anyActive) {
      burstInstanced.instanceMatrix.needsUpdate = true;
    }
  };

  const spawnBurst = (count: number, speedScale: number) => {
    for (let i = 0; i < Math.min(count, burstParticles.length); i += 1) {
      const p = burstParticles[i]!;
      const ang = (i / count) * Math.PI * 2 + (i % 3) * 0.18;
      const elev = 0.35 + (i % 4) * 0.28;
      p.active = true;
      p.age = 0;
      p.life = 0.65 + (i % 4) * 0.12;
      p.pos.set(0, 0.85, 0);
      p.vel.set(
        Math.cos(ang) * (1.1 + (i % 3) * 0.40) * speedScale,
        (1.5 + elev * 1.3) * speedScale,
        Math.sin(ang) * (1.1 + (i % 3) * 0.40) * speedScale,
      );
      p.scale = 1;
    }
    syncBurstInstances();
  };

  return {
    id,
    root,
    visualPivot,
    bloomTargets,

    triggerEmote(kind: TacticianEmoteKind): number {
      emoteKind = kind;
      emoteTimer = 0;
      if (kind === 'tap') {
        emoteVariant = tapCycle % 3;
        tapCycle += 1;
        emoteDuration = 0.88;
        spawnBurst(20, 1.0);
      } else if (kind === 'cheer') {
        emoteVariant = 1;
        emoteDuration = 0.72;
        spawnBurst(20, 1.15);
      } else {
        emoteVariant = 0;
        emoteDuration = 0.60;
        spawnBurst(12, 0.85);
      }
      return emoteVariant;
    },

    update(dt: number, elapsedSec: number): void {
      let emoteRatio = 0;
      let extraY = 0;
      let extraRotY = 0;
      let extraTiltZ = 0;
      let scaleMod = 1.0;

      if (emoteKind) {
        emoteTimer += dt;
        emoteRatio = Math.min(1, emoteTimer / emoteDuration);
        const bell = Math.sin(emoteRatio * Math.PI);

        if (emoteKind === 'cheer') {
          extraY = bell * 0.20;
          extraRotY = Math.sin(emoteRatio * Math.PI * 2) * 0.16;
          scaleMod = 1 + bell * 0.06;
        } else if (emoteKind === 'tap' && emoteVariant === 1) {
          extraY = bell * 0.28;
          extraRotY = emoteRatio * Math.PI * 2;
          scaleMod = 1 + bell * 0.08;
        } else if (emoteKind === 'tap' && emoteVariant === 0) {
          extraRotY = emoteRatio * Math.PI * 2;
          extraY = bell * 0.18;
          extraTiltZ = Math.sin(emoteRatio * Math.PI * 4) * 0.09;
        } else if (emoteKind === 'tap' && emoteVariant === 2) {
          extraY = bell * 0.22;
          extraTiltZ = Math.sin(emoteRatio * Math.PI * 2) * 0.14;
          scaleMod = 1 + Math.sin(emoteRatio * Math.PI * 3) * 0.06;
        } else {
          extraY = bell * 0.18;
          scaleMod = 1 + bell * 0.08;
        }

        if (emoteRatio >= 1) {
          emoteKind = null;
        }
      }

      const hoverY =
        id === 'tactician_singularity_mew'
          ? Math.sin(elapsedSec * 1.9) * 0.012
          : Math.sin(elapsedSec * 2.2) * 0.042;
      visualPivot.position.set(0, hoverY + extraY, 0);
      visualPivot.rotation.set(0, extraRotY, extraTiltZ);
      visualPivot.scale.setScalar(scaleMod);

      let burstDirty = false;
      for (const p of burstParticles) {
        if (!p.active) continue;
        burstDirty = true;
        p.age += dt;
        const t = p.age / p.life;
        if (t >= 1) {
          p.active = false;
          p.scale = 0;
          continue;
        }
        p.vel.y -= 3.4 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.scale = Math.max(0.05, 1 - t);
      }
      if (burstDirty) {
        syncBurstInstances();
      }

      customUpdate(dt, elapsedSec, emoteRatio);
    },

    dispose(): void {
      for (const t of ownedTextures) t.dispose();
      for (const g of ownedGeos) g.dispose();
      for (const m of ownedMats) m.dispose();
    },
  };
}
