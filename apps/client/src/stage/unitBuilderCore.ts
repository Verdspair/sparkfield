import * as THREE from 'three';
import type { UnitDef } from '@pkg/contracts';
import { FACTION_PALETTES, type FactionVisualPalette } from './pbrMaterials.js';

export type RgbTriple = readonly [number, number, number];
export type Vec3Tuple = readonly [number, number, number];

export interface GeometryPartSpec {
  readonly geo: THREE.BufferGeometry;
  readonly matrix?: THREE.Matrix4;
  readonly colorRgb?: RgbTriple;
}

export interface UnitBlueprintParts {
  readonly armor: GeometryPartSpec[];
  readonly matte: GeometryPartSpec[];
  readonly trim: GeometryPartSpec[];
  readonly energy: GeometryPartSpec[];
  readonly crystal: GeometryPartSpec[];
  readonly bodyParts: GeometryPartSpec[];
  readonly weaponParts: GeometryPartSpec[];
  readonly wingParts: GeometryPartSpec[];
  readonly disposables: THREE.BufferGeometry[];
  headTopLocalY: number;
  weaponGlowHex: number;
  crystalHex: number;
  crystalOpacity: number;
  crystalIntensity: number;
}

export interface UnitBuilderContext {
  readonly pool: SharedUnitGeometryPool;
  readonly unitDef: UnitDef;
  readonly palette: FactionVisualPalette;
  readonly primary: RgbTriple;
  readonly secondary: RgbTriple;
  readonly accent: RgbTriple;
  readonly darkSteel: RgbTriple;
  readonly porcelain: RgbTriple;
  readonly gold: RgbTriple;
  readonly sapphire: RgbTriple;
  readonly emerald: RgbTriple;
}

export interface HumanoidFrameOptions {
  readonly heavy?: boolean;
  readonly cape?: boolean;
  readonly hover?: boolean;
  readonly helmetStyle?: 'tactical' | 'astro' | 'scholar' | 'cyber';
  readonly armorPrimary?: RgbTriple;
  readonly armorSecondary?: RgbTriple;
  readonly armorTrim?: RgbTriple;
  readonly undersuit?: RgbTriple;
  readonly showChestCore?: boolean;
  readonly showVisorGlow?: boolean;
  readonly leftArmPose?: Vec3Tuple;
  readonly rightArmPose?: Vec3Tuple;
}

export type HeroStance =
  | 'shield_brace'
  | 'aim_rifle'
  | 'cape_command'
  | 'cradle_protect'
  | 'seraph_hover';

export type HeroProportion = 'vanguard' | 'athletic' | 'slender' | 'seraph';
export type HeroHelmetStyle = 'vanguard' | 'seraph' | 'scholar' | 'commander' | 'cyber';

export interface SculptedHeroOptions {
  readonly stance?: HeroStance;
  readonly proportion?: HeroProportion;
  readonly helmetStyle?: HeroHelmetStyle;
  readonly armorColor?: RgbTriple;
  readonly secondaryArmorColor?: RgbTriple;
  readonly matteColor?: RgbTriple;
  readonly trimColor?: RgbTriple;
  readonly visorMode?: 'energy' | 'trim' | 'none';
  readonly visorColor?: RgbTriple;
  readonly chestCore?: boolean;
  readonly cape?: boolean;
  readonly coatTails?: boolean;
  readonly scholarCoat?: boolean;
  readonly asymmetricPauldron?: 'left' | 'right' | 'none';
  readonly hairColor?: RgbTriple;
  readonly skinColor?: RgbTriple;
}

export interface HeroAnchorPoint {
  readonly pos: THREE.Vector3;
  readonly dir: THREE.Vector3;
  readonly right: THREE.Vector3;
}

export interface HeroAnchors {
  readonly leftHand: HeroAnchorPoint;
  readonly rightHand: HeroAnchorPoint;
  readonly leftForearm: HeroAnchorPoint;
  readonly rightForearm: HeroAnchorPoint;
  readonly leftShoulder: THREE.Vector3;
  readonly rightShoulder: THREE.Vector3;
  readonly backMount: THREE.Vector3;
  readonly chestCenter: THREE.Vector3;
  readonly headCenter: THREE.Vector3;
  readonly neckBase: THREE.Vector3;
  readonly pelvisCenter: THREE.Vector3;
  readonly torsoYaw: number;
}

export type BespokeUnitBuilder = (ctx: UnitBuilderContext, out: UnitBlueprintParts) => void;

export function trackGeo(out: UnitBlueprintParts, geo: THREE.BufferGeometry): THREE.BufferGeometry {
  out.disposables.push(geo);
  return geo;
}

export function makeTransform(
  px: number,
  py: number,
  pz: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

export function makeSegmentTransform(
  start: THREE.Vector3,
  end: THREE.Vector3,
  scaleX = 1,
  scaleZ = 1,
  roll = 0,
): THREE.Matrix4 {
  const dir = new THREE.Vector3().subVectors(end, start);
  const len = Math.max(0.0001, dir.length());
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const unitDir = dir.clone().divideScalar(len);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);
  if (roll !== 0) {
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), roll));
  }
  const m = new THREE.Matrix4();
  m.compose(mid, q, new THREE.Vector3(scaleX, len, scaleZ));
  return m;
}

export function normalizeBoxUvs(geo: THREE.BufferGeometry, uvScale = 2.6): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  if (!pos) return geo;
  if (!geo.getAttribute('normal')) {
    geo.computeVertexNormals();
  }
  const norm = geo.getAttribute('normal');
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const nx = Math.abs(norm.getX(i));
    const ny = Math.abs(norm.getY(i));
    const nz = Math.abs(norm.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      u = px * uvScale;
      v = pz * uvScale;
    } else if (nx >= nz) {
      u = pz * uvScale;
      v = py * uvScale;
    } else {
      u = px * uvScale;
      v = py * uvScale;
    }
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

export function applySmoothUvs(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = geo.getAttribute('position');
  if (!pos) return geo;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i += 1) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    uvs[i * 2] = 0.24 + Math.max(-0.07, Math.min(0.07, px * 0.25));
    uvs[i * 2 + 1] = 0.36 + Math.max(-0.06, Math.min(0.06, py * 0.22));
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

export function createLathePart(
  points: readonly (readonly [number, number])[],
  segments = 18,
  phiStart = 0,
  phiLength = Math.PI * 2,
): THREE.BufferGeometry {
  const vecs = points.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
  const geo = new THREE.LatheGeometry(vecs, Math.max(6, segments), phiStart, phiLength);
  geo.computeVertexNormals();
  return normalizeBoxUvs(geo, 2.4);
}

export function createBevelShapePart(
  shape: THREE.Shape,
  depth: number,
  bevelSize = 0.012,
  bevelThickness = 0.012,
  bevelSegments = 2,
  curveSegments = 8,
): THREE.BufferGeometry {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevelSize > 0 && bevelThickness > 0,
    bevelSize,
    bevelThickness,
    bevelSegments,
    curveSegments,
  });
  geo.translate(0, 0, -depth * 0.5);
  geo.computeVertexNormals();
  return normalizeBoxUvs(geo, 2.5);
}

export function createBevelExtrudePart(
  shapePoints: readonly (readonly [number, number])[],
  depth: number,
  bevelSize = 0.012,
  bevelThickness = 0.012,
  bevelSegments = 2,
  curveSegments = 8,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shapePoints.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return createBevelShapePart(shape, depth, bevelSize, bevelThickness, bevelSegments, curveSegments);
}

export function createTubePart(
  curvePoints: readonly Vec3Tuple[],
  radius: number,
  tubularSegments = 16,
  radialSegments = 8,
  closed = false,
): THREE.BufferGeometry {
  const pts = curvePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, closed);
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  geo.computeVertexNormals();
  return geo;
}

export function createTaperedTubePart(
  curvePoints: readonly Vec3Tuple[],
  radiusStart: number,
  radiusEnd: number,
  tubularSegments = 16,
  radialSegments = 8,
): THREE.BufferGeometry {
  const pts = curvePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, false);
  const frames = curve.computeFrenetFrames(tubularSegments, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const center = new THREE.Vector3();
  const nVec = new THREE.Vector3();
  const vPos = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i += 1) {
    const t = i / tubularSegments;
    curve.getPointAt(t, center);
    const radius = Math.max(0.001, radiusStart + (radiusEnd - radiusStart) * t);
    const N = frames.normals[i]!;
    const B = frames.binormals[i]!;

    for (let j = 0; j <= radialSegments; j += 1) {
      const v = j / radialSegments;
      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      nVec.set(
        cosT * N.x + sinT * B.x,
        cosT * N.y + sinT * B.y,
        cosT * N.z + sinT * B.z,
      ).normalize();

      vPos.copy(center).addScaledVector(nVec, radius);
      positions.push(vPos.x, vPos.y, vPos.z);
      normals.push(nVec.x, nVec.y, nVec.z);
      uvs.push(t * 2.2, v);
    }
  }

  const ringStride = radialSegments + 1;
  for (let i = 0; i < tubularSegments; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function createCurvedBladePart(
  length: number,
  width: number,
  thickness: number,
  sweep = 0.14,
  arch = 0.06,
  segments = 9,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const y = t * length;
    const profile = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92 + 0.12);
    const tipTaper = t > 0.72 ? 1 - ((t - 0.72) / 0.28) * 0.92 : 1.0;
    const halfW = width * 0.5 * Math.max(0.04, profile * tipTaper);
    const halfT = thickness * 0.5 * (1 - t * 0.68);
    const sweepX = Math.pow(t, 1.65) * sweep;
    const archZ = Math.sin(t * Math.PI) * arch;

    const ring: readonly Vec3Tuple[] = [
      [sweepX - halfW, y, archZ],
      [sweepX, y, archZ + halfT],
      [sweepX + halfW, y, archZ],
      [sweepX, y, archZ - halfT],
    ];
    for (let k = 0; k < 4; k += 1) {
      const p = ring[k]!;
      positions.push(p[0], p[1], p[2]);
      uvs.push(k / 4, t * 2.0);
    }
  }

  for (let i = 0; i < segments; i += 1) {
    const r0 = i * 4;
    const r1 = (i + 1) * 4;
    for (let k = 0; k < 4; k += 1) {
      const kn = (k + 1) % 4;
      indices.push(r0 + k, r0 + kn, r1 + kn, r0 + k, r1 + kn, r1 + k);
    }
  }

  const tipIdx = positions.length / 3;
  positions.push(sweep * 1.04, length * 1.03, arch * 0.12);
  uvs.push(0.5, 2.1);
  const lastRing = segments * 4;
  for (let k = 0; k < 4; k += 1) {
    const kn = (k + 1) % 4;
    indices.push(lastRing + k, lastRing + kn, tipIdx);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return normalizeBoxUvs(geo, 2.4);
}

export function createChamferedHexPart(
  outerRadius: number,
  depth: number,
  bevel = 0.012,
  innerHoleRadius = 0,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(ang) * outerRadius;
    const y = Math.sin(ang) * outerRadius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  if (innerHoleRadius > 0 && innerHoleRadius < outerRadius * 0.94) {
    const hole = new THREE.Path();
    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(ang) * innerHoleRadius;
      const y = Math.sin(ang) * innerHoleRadius;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  return createBevelShapePart(shape, depth, bevel, bevel, 1, 2);
}

export function createCurvedVisorPart(
  radiusX: number,
  radiusY: number,
  radiusZ: number,
  phiSpan = 1.48,
  thetaStart = 1.02,
  thetaLength = 0.68,
  segsU = 14,
  segsV = 6,
): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(
    1,
    segsU,
    segsV,
    Math.PI * 0.5 - phiSpan * 0.5,
    phiSpan,
    thetaStart,
    thetaLength,
  );
  geo.scale(radiusX, radiusY, radiusZ);
  geo.computeVertexNormals();
  return geo;
}

function createTaperedBoxGeometry(
  topW: number,
  botW: number,
  height: number,
  topD: number,
  botD: number,
): THREE.BufferGeometry {
  const tw = topW * 0.5;
  const bw = botW * 0.5;
  const hh = height * 0.5;
  const td = topD * 0.5;
  const bd = botD * 0.5;

  const corners: readonly [number, number, number][] = [
    [-tw, hh, td],
    [tw, hh, td],
    [tw, hh, -td],
    [-tw, hh, -td],
    [-bw, -hh, bd],
    [bw, -hh, bd],
    [bw, -hh, -bd],
    [-bw, -hh, -bd],
  ];

  const quads: readonly [number, number, number, number][] = [
    [4, 5, 1, 0],
    [6, 7, 3, 2],
    [5, 6, 2, 1],
    [7, 4, 0, 3],
    [0, 1, 2, 3],
    [7, 6, 5, 4],
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const norm = new THREE.Vector3();

  for (let qIdx = 0; qIdx < quads.length; qIdx += 1) {
    const [i0, i1, i2, i3] = quads[qIdx]!;
    const p0 = corners[i0]!;
    const p1 = corners[i1]!;
    const p2 = corners[i2]!;
    const p3 = corners[i3]!;
    a.set(p0[0], p0[1], p0[2]);
    b.set(p1[0], p1[1], p1[2]);
    c.set(p2[0], p2[1], p2[2]);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    norm.crossVectors(ab, ac).normalize();

    const base = qIdx * 4;
    positions.push(...p0, ...p1, ...p2, ...p3);
    for (let k = 0; k < 4; k += 1) {
      normals.push(norm.x, norm.y, norm.z);
    }
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

function lerpRgbTriple(a: RgbTriple, b: RgbTriple, t: number): RgbTriple {
  const k = Math.max(0, Math.min(1, t));
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function computeParallelTransportFrames(
  curve: THREE.CatmullRomCurve3,
  segments: number,
  closed: boolean,
): {
  readonly points: THREE.Vector3[];
  readonly tangents: THREE.Vector3[];
  readonly normals: THREE.Vector3[];
  readonly binormals: THREE.Vector3[];
} {
  const points: THREE.Vector3[] = [];
  const tangents: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];
  const binormals: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    points.push(curve.getPointAt(t));
    tangents.push(curve.getTangentAt(t).normalize());
  }

  const t0 = tangents[0]!;
  const refUp = Math.abs(t0.y) < 0.92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const n0 = new THREE.Vector3().crossVectors(refUp, t0).normalize();
  const b0 = new THREE.Vector3().crossVectors(t0, n0).normalize();
  normals.push(n0);
  binormals.push(b0);

  const axis = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 1; i <= segments; i += 1) {
    const prevT = tangents[i - 1]!;
    const currT = tangents[i]!;
    const prevN = normals[i - 1]!.clone();
    axis.crossVectors(prevT, currT);
    const axisLen = axis.length();
    if (axisLen > 1e-6) {
      axis.divideScalar(axisLen);
      const angle = Math.acos(Math.max(-1, Math.min(1, prevT.dot(currT))));
      q.setFromAxisAngle(axis, angle);
      prevN.applyQuaternion(q);
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize();
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize();
    normals.push(prevN);
    binormals.push(currB);
  }

  if (closed && segments > 2) {
    const firstN = normals[0]!;
    const lastN = normals[segments]!;
    let theta = Math.acos(Math.max(-1, Math.min(1, firstN.dot(lastN))));
    if (tangents[0]!.dot(new THREE.Vector3().crossVectors(lastN, firstN)) < 0) {
      theta = -theta;
    }
    for (let i = 1; i <= segments; i += 1) {
      const f = i / segments;
      q.setFromAxisAngle(tangents[i]!, theta * f);
      normals[i]!.applyQuaternion(q).normalize();
      binormals[i]!.crossVectors(tangents[i]!, normals[i]!).normalize();
    }
  }

  return { points, tangents, normals, binormals };
}

export function createSculptedClothLathe(
  profilePoints: readonly (readonly [number, number])[],
  radialSegs = 36,
  pleatCount = 0,
  pleatAmp = 0,
  pleatStartRatio = 0.35,
  colorBot?: RgbTriple,
  colorTop?: RgbTriple,
): THREE.BufferGeometry {
  const vecs = profilePoints.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y));
  const spline = new THREE.SplineCurve(vecs);
  const vSegs = Math.max(20, profilePoints.length * 4);
  const sampled = spline.getPoints(vSegs);
  const rSegs = Math.max(12, radialSegs);

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const minY = sampled[0]!.y;
  const maxY = sampled[sampled.length - 1]!.y;
  const spanY = Math.max(0.0001, Math.abs(maxY - minY));
  const useGrad = colorBot !== undefined && colorTop !== undefined;

  for (let iv = 0; iv <= vSegs; iv += 1) {
    const pt = sampled[iv]!;
    const vFrac = iv / vSegs;
    const heightFrac = Math.max(0, Math.min(1, (pt.y - Math.min(minY, maxY)) / spanY));
    const pleatEnv =
      pleatCount > 0 && pleatAmp > 0
        ? Math.max(0, (1 - heightFrac - (1 - pleatStartRatio)) / Math.max(0.05, pleatStartRatio))
        : 0;
    const smoothPleat = pleatEnv * pleatEnv * (3 - 2 * pleatEnv);
    const col = useGrad ? lerpRgbTriple(colorBot!, colorTop!, heightFrac) : null;

    for (let ir = 0; ir <= rSegs; ir += 1) {
      const uFrac = ir / rSegs;
      const phi = uFrac * Math.PI * 2;
      const rMod = pt.x * (1 + smoothPleat * pleatAmp * Math.sin(phi * pleatCount));
      const radius = Math.max(0.0004, rMod);
      positions.push(Math.sin(phi) * radius, pt.y, Math.cos(phi) * radius);
      uvs.push(uFrac * 2.0, vFrac * 2.0);
      if (col) {
        colors.push(col[0], col[1], col[2]);
      }
    }
  }

  const stride = rSegs + 1;
  for (let iv = 0; iv < vSegs; iv += 1) {
    for (let ir = 0; ir < rSegs; ir += 1) {
      const a = iv * stride + ir;
      const b = (iv + 1) * stride + ir;
      const c = (iv + 1) * stride + (ir + 1);
      const d = iv * stride + (ir + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createTeardropPart(
  length: number,
  maxRadius: number,
  tipSharpness = 1.35,
  radialSegs = 32,
  lengthSegs = 24,
  bendZ = 0,
  colorBase?: RgbTriple,
  colorTip?: RgbTriple,
): THREE.BufferGeometry {
  const rSegs = Math.max(12, radialSegs);
  const lSegs = Math.max(10, lengthSegs);
  const rawRadii: number[] = [];
  let peak = 0.0001;
  for (let i = 0; i <= lSegs; i += 1) {
    const t = i / lSegs;
    const profile = Math.sin(t * Math.PI) * Math.pow(Math.max(0.0001, 1 - t), tipSharpness * 0.48);
    rawRadii.push(profile);
    if (profile > peak) peak = profile;
  }

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const useGrad = colorBase !== undefined && colorTip !== undefined;

  for (let i = 0; i <= lSegs; i += 1) {
    const t = i / lSegs;
    const y = (t - 0.5) * length;
    const zOff = Math.sin(t * Math.PI) * bendZ;
    const r = Math.max(0.0004, (rawRadii[i]! / peak) * maxRadius);
    const col = useGrad ? lerpRgbTriple(colorBase!, colorTip!, t) : null;

    for (let j = 0; j <= rSegs; j += 1) {
      const u = j / rSegs;
      const phi = u * Math.PI * 2;
      positions.push(Math.sin(phi) * r, y, Math.cos(phi) * r + zOff);
      uvs.push(u * 2.0, t * 2.0);
      if (col) {
        colors.push(col[0], col[1], col[2]);
      }
    }
  }

  const stride = rSegs + 1;
  for (let i = 0; i < lSegs; i += 1) {
    for (let j = 0; j < rSegs; j += 1) {
      const a = i * stride + j;
      const b = (i + 1) * stride + j;
      const c = (i + 1) * stride + (j + 1);
      const d = i * stride + (j + 1);
      indices.push(a, d, b, b, d, c);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createPetalPart(
  length: number,
  width: number,
  cupDepth = 0.055,
  archHeight = 0.05,
  tipPoint = 1.25,
  segsU = 16,
  segsV = 10,
  colorBase?: RgbTriple,
  colorTip?: RgbTriple,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const useGrad = colorBase !== undefined && colorTip !== undefined;
  const halfThickness = Math.max(0.004, Math.min(0.014, width * 0.045));

  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? 1 : -1;
    const baseOffset = side * (segsU + 1) * (segsV + 1);

    for (let iu = 0; iu <= segsU; iu += 1) {
      const u = iu / segsU;
      const y = u * length;
      const env = Math.sin(Math.pow(u, 0.72) * Math.PI) * Math.pow(Math.max(0.02, 1 - u * 0.88), tipPoint * 0.25);
      const halfW = width * 0.5 * Math.max(0.015, env);
      const archZ = Math.sin(u * Math.PI) * archHeight;
      const col = useGrad ? lerpRgbTriple(colorBase!, colorTip!, u) : null;

      for (let iv = 0; iv <= segsV; iv += 1) {
        const v = iv / segsV;
        const s = v * 2 - 1;
        const x = s * halfW;
        const cupZ = -(1 - s * s) * cupDepth * Math.sin(u * Math.PI);
        const edgePinch = Math.sqrt(Math.max(0, 1 - s * s)) * Math.sin(u * Math.PI);
        const z = archZ + cupZ + sign * halfThickness * edgePinch;

        positions.push(x, y, z);
        uvs.push(v, u);
        if (col) {
          colors.push(col[0], col[1], col[2]);
        }
      }
    }

    const stride = segsV + 1;
    for (let iu = 0; iu < segsU; iu += 1) {
      for (let iv = 0; iv < segsV; iv += 1) {
        const a = baseOffset + iu * stride + iv;
        const b = baseOffset + (iu + 1) * stride + iv;
        const c = baseOffset + (iu + 1) * stride + (iv + 1);
        const d = baseOffset + iu * stride + (iv + 1);
        if (side === 0) {
          indices.push(a, d, b, b, d, c);
        } else {
          indices.push(a, b, d, b, c, d);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export type RibbonWidthProfile =
  | readonly [number, number, number]
  | ((t: number) => number);

export function createFlowingRibbonMesh(
  spinePoints: readonly Vec3Tuple[],
  widthProfile: RibbonWidthProfile,
  waveAmp = 0.018,
  waveFreq = 2.0,
  segsLength = 36,
  segsWidth = 6,
  thickness = 0.008,
  colorStart?: RgbTriple,
  colorEnd?: RgbTriple,
  closed = false,
): THREE.BufferGeometry {
  const pts = spinePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, closed);
  const frames = computeParallelTransportFrames(curve, segsLength, closed);

  const evalWidth = (t: number): number => {
    if (typeof widthProfile === 'function') {
      return Math.max(0.002, widthProfile(t));
    }
    const [w0, w1, w2] = widthProfile;
    const omt = 1 - t;
    return Math.max(0.002, omt * omt * w0 + 2 * omt * t * w1 + t * t * w2);
  };

  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const useGrad = colorStart !== undefined && colorEnd !== undefined;
  const vPos = new THREE.Vector3();
  const sides = thickness > 0.0005 ? 2 : 1;

  for (let side = 0; side < sides; side += 1) {
    const sign = side === 0 ? 1 : -1;
    const baseOffset = side * (segsLength + 1) * (segsWidth + 1);

    for (let i = 0; i <= segsLength; i += 1) {
      const t = i / segsLength;
      const center = frames.points[i]!;
      const N = frames.normals[i]!;
      const B = frames.binormals[i]!;
      const halfW = evalWidth(t) * 0.5;
      const wave = Math.sin(t * Math.PI * 2 * waveFreq) * waveAmp;
      const col = useGrad ? lerpRgbTriple(colorStart!, colorEnd!, t) : null;

      for (let j = 0; j <= segsWidth; j += 1) {
        const v = j / segsWidth;
        const s = v * 2 - 1;
        const camber = (1 - s * s) * Math.min(halfW * 0.14, 0.025);
        const edgeFlutter = s * s * wave * (0.35 + 0.65 * Math.sin(t * Math.PI));
        const thickOff =
          sides === 2 ? sign * thickness * 0.5 * Math.sqrt(Math.max(0, 1 - s * s * 0.92)) : 0;

        vPos
          .copy(center)
          .addScaledVector(N, s * halfW)
          .addScaledVector(B, camber + edgeFlutter + thickOff);

        positions.push(vPos.x, vPos.y, vPos.z);
        uvs.push(t * 2.4, v);
        if (col) {
          colors.push(col[0], col[1], col[2]);
        }
      }
    }

    const stride = segsWidth + 1;
    for (let i = 0; i < segsLength; i += 1) {
      for (let j = 0; j < segsWidth; j += 1) {
        const a = baseOffset + i * stride + j;
        const b = baseOffset + (i + 1) * stride + j;
        const c = baseOffset + (i + 1) * stride + (j + 1);
        const d = baseOffset + i * stride + (j + 1);
        if (side === 0) {
          indices.push(a, b, d, b, c, d);
        } else {
          indices.push(a, d, b, b, d, c);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createCreatureFin(
  length: number,
  span: number,
  sweepBack = 0.34,
  camber = 0.055,
  thickness = 0.024,
  segsU = 18,
  segsV = 10,
  colorRoot?: RgbTriple,
  colorTip?: RgbTriple,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const useGrad = colorRoot !== undefined && colorTip !== undefined;

  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? 1 : -1;
    const baseOffset = side * (segsU + 1) * (segsV + 1);

    for (let iu = 0; iu <= segsU; iu += 1) {
      const u = iu / segsU;
      const x = u * span;
      const chordScale = Math.pow(Math.max(0.03, 1 - u * 0.86), 0.78) * (0.28 + 0.72 * Math.sin((1 - u * 0.82) * Math.PI * 0.5));
      const chord = length * Math.max(0.04, chordScale);
      const zSweep = -Math.pow(u, 1.35) * sweepBack;
      const yArch = Math.sin(u * Math.PI * 0.88) * camber;
      const localThick = thickness * (1 - u * 0.76);
      const col = useGrad ? lerpRgbTriple(colorRoot!, colorTip!, u) : null;

      for (let iv = 0; iv <= segsV; iv += 1) {
        const v = iv / segsV;
        const z = zSweep + (0.42 - v) * chord;
        const airfoil = Math.sqrt(Math.max(0, v)) * (1 - v) * 2.55;
        const y = yArch + sign * localThick * 0.5 * airfoil;
        positions.push(x, y, z);
        uvs.push(u * 2.0, v);
        if (col) {
          colors.push(col[0], col[1], col[2]);
        }
      }
    }

    const stride = segsV + 1;
    for (let iu = 0; iu < segsU; iu += 1) {
      for (let iv = 0; iv < segsV; iv += 1) {
        const a = baseOffset + iu * stride + iv;
        const b = baseOffset + (iu + 1) * stride + iv;
        const c = baseOffset + (iu + 1) * stride + (iv + 1);
        const d = baseOffset + iu * stride + (iv + 1);
        if (side === 0) {
          indices.push(a, b, d, b, c, d);
        } else {
          indices.push(a, d, b, b, d, c);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function createFacetedCrystalPart(
  height: number,
  radius: number,
  facets = 6,
  topTipRatio = 0.62,
  botTipRatio = 0.38,
  colorBot?: RgbTriple,
  colorTop?: RgbTriple,
): THREE.BufferGeometry {
  const n = Math.max(3, Math.round(facets));
  const yTop = height * topTipRatio;
  const yBot = -height * botTipRatio;
  const yMidTop = height * topTipRatio * 0.28;
  const yMidBot = -height * botTipRatio * 0.24;

  const topTip = new THREE.Vector3(0, yTop, 0);
  const botTip = new THREE.Vector3(0, yBot, 0);
  const upperRing: THREE.Vector3[] = [];
  const lowerRing: THREE.Vector3[] = [];

  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    upperRing.push(new THREE.Vector3(Math.cos(a) * radius, yMidTop, Math.sin(a) * radius));
    lowerRing.push(new THREE.Vector3(Math.cos(a) * radius * 0.94, yMidBot, Math.sin(a) * radius * 0.94));
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const useGrad = colorBot !== undefined && colorTop !== undefined;
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  const pushTri = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, c0: number, c1: number, c2: number) => {
    e1.subVectors(p1, p0);
    e2.subVectors(p2, p0);
    fn.crossVectors(e1, e2).normalize();
    const pts = [p0, p1, p2];
    const cs = [c0, c1, c2];
    for (let k = 0; k < 3; k += 1) {
      const p = pts[k]!;
      positions.push(p.x, p.y, p.z);
      normals.push(fn.x, fn.y, fn.z);
      uvs.push(0.5 + p.x * 2, (p.y - yBot) / Math.max(0.001, height));
      if (useGrad) {
        const col = lerpRgbTriple(colorBot!, colorTop!, cs[k]!);
        colors.push(col[0], col[1], col[2]);
      }
    }
  };

  for (let i = 0; i < n; i += 1) {
    const next = (i + 1) % n;
    const u0 = upperRing[i]!;
    const u1 = upperRing[next]!;
    const l0 = lowerRing[i]!;
    const l1 = lowerRing[next]!;
    pushTri(topTip, u1, u0, 1.0, 0.65, 0.65);
    pushTri(u0, u1, l1, 0.65, 0.65, 0.35);
    pushTri(u0, l1, l0, 0.65, 0.35, 0.35);
    pushTri(l0, l1, botTip, 0.35, 0.35, 0.0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.computeBoundingSphere();
  return geo;
}

export function createHexMirrorTilePart(
  radius: number,
  depth = 0.024,
  bevel = 0.011,
  dishCurvature = 0.012,
  colorCenter?: RgbTriple,
  colorEdge?: RgbTriple,
): THREE.BufferGeometry {
  const rInner = Math.max(0.005, radius - bevel);
  const zFront = depth * 0.5;
  const zBack = -depth * 0.5;
  const zRim = zFront - bevel * 0.55;

  const frontInner: THREE.Vector3[] = [];
  const frontOuter: THREE.Vector3[] = [];
  const backOuter: THREE.Vector3[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    frontInner.push(new THREE.Vector3(ca * rInner, sa * rInner, zFront));
    frontOuter.push(new THREE.Vector3(ca * radius, sa * radius, zRim));
    backOuter.push(new THREE.Vector3(ca * radius, sa * radius, zBack));
  }
  const centerFront = new THREE.Vector3(0, 0, zFront - dishCurvature);
  const centerBack = new THREE.Vector3(0, 0, zBack);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const useGrad = colorCenter !== undefined && colorEdge !== undefined;
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const fn = new THREE.Vector3();

  const pushTri = (p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, c0: number, c1: number, c2: number) => {
    e1.subVectors(p1, p0);
    e2.subVectors(p2, p0);
    fn.crossVectors(e1, e2).normalize();
    const pts = [p0, p1, p2];
    const cs = [c0, c1, c2];
    for (let k = 0; k < 3; k += 1) {
      const p = pts[k]!;
      positions.push(p.x, p.y, p.z);
      normals.push(fn.x, fn.y, fn.z);
      uvs.push(0.5 + p.x / (radius * 2), 0.5 + p.y / (radius * 2));
      if (useGrad) {
        const col = lerpRgbTriple(colorCenter!, colorEdge!, cs[k]!);
        colors.push(col[0], col[1], col[2]);
      }
    }
  };

  for (let i = 0; i < 6; i += 1) {
    const next = (i + 1) % 6;
    const fi0 = frontInner[i]!;
    const fi1 = frontInner[next]!;
    const fo0 = frontOuter[i]!;
    const fo1 = frontOuter[next]!;
    const bo0 = backOuter[i]!;
    const bo1 = backOuter[next]!;

    pushTri(centerFront, fi0, fi1, 0.0, 0.72, 0.72);
    pushTri(fi0, fo0, fo1, 0.72, 1.0, 1.0);
    pushTri(fi0, fo1, fi1, 0.72, 1.0, 0.72);
    pushTri(fo0, bo0, bo1, 1.0, 1.0, 1.0);
    pushTri(fo0, bo1, fo1, 1.0, 1.0, 1.0);
    pushTri(centerBack, bo1, bo0, 0.6, 1.0, 1.0);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.computeBoundingSphere();
  return geo;
}

export function createOrganicLimb(
  curvePoints: readonly Vec3Tuple[],
  radiusStart: number,
  radiusMid: number,
  radiusEnd: number,
  segsTubular = 20,
  segsRadial = 14,
  colorStart?: RgbTriple,
  colorEnd?: RgbTriple,
): THREE.BufferGeometry {
  const pts = curvePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(pts, false);
  const frames = computeParallelTransportFrames(curve, segsTubular, false);

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const useGrad = colorStart !== undefined && colorEnd !== undefined;

  const nVec = new THREE.Vector3();
  const vPos = new THREE.Vector3();
  const capRings = 2;
  const totalRings = segsTubular + 1 + capRings * 2;
  const ringStride = segsRadial + 1;

  const pushRing = (
    center: THREE.Vector3,
    N: THREE.Vector3,
    B: THREE.Vector3,
    T: THREE.Vector3,
    radius: number,
    axialOffset: number,
    axialNormalWeight: number,
    tFrac: number,
  ) => {
    const col = useGrad ? lerpRgbTriple(colorStart!, colorEnd!, tFrac) : null;
    for (let j = 0; j <= segsRadial; j += 1) {
      const v = j / segsRadial;
      const theta = v * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      nVec
        .set(cosT * N.x + sinT * B.x, cosT * N.y + sinT * B.y, cosT * N.z + sinT * B.z)
        .normalize();

      vPos.copy(center).addScaledVector(nVec, Math.max(0.0004, radius)).addScaledVector(T, axialOffset);
      positions.push(vPos.x, vPos.y, vPos.z);

      const finalN = nVec.clone().multiplyScalar(1 - Math.abs(axialNormalWeight)).addScaledVector(T, axialNormalWeight).normalize();
      normals.push(finalN.x, finalN.y, finalN.z);
      uvs.push(tFrac * 2.0, v);
      if (col) {
        colors.push(col[0], col[1], col[2]);
      }
    }
  };

  const p0 = frames.points[0]!;
  const N0 = frames.normals[0]!;
  const B0 = frames.binormals[0]!;
  const T0 = frames.tangents[0]!;
  pushRing(p0, N0, B0, T0, radiusStart * 0.08, -radiusStart * 0.92, -0.95, 0);
  pushRing(p0, N0, B0, T0, radiusStart * 0.72, -radiusStart * 0.52, -0.55, 0);

  for (let i = 0; i <= segsTubular; i += 1) {
    const t = i / segsTubular;
    const omt = 1 - t;
    const radius = Math.max(0.001, omt * omt * radiusStart + 2 * omt * t * radiusMid + t * t * radiusEnd);
    pushRing(frames.points[i]!, frames.normals[i]!, frames.binormals[i]!, frames.tangents[i]!, radius, 0, 0, t);
  }

  const pEnd = frames.points[segsTubular]!;
  const NEnd = frames.normals[segsTubular]!;
  const BEnd = frames.binormals[segsTubular]!;
  const TEnd = frames.tangents[segsTubular]!;
  pushRing(pEnd, NEnd, BEnd, TEnd, radiusEnd * 0.72, radiusEnd * 0.52, 0.55, 1);
  pushRing(pEnd, NEnd, BEnd, TEnd, radiusEnd * 0.08, radiusEnd * 0.92, 0.95, 1);

  for (let i = 0; i < totalRings - 1; i += 1) {
    for (let j = 0; j < segsRadial; j += 1) {
      const a = i * ringStride + j;
      const b = (i + 1) * ringStride + j;
      const c = (i + 1) * ringStride + (j + 1);
      const d = i * ringStride + (j + 1);
      indices.push(a, b, d, b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  if (useGrad) {
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }
  geo.setIndex(indices);
  geo.computeBoundingSphere();
  return geo;
}

export function mergePartsWithVertexColor(parts: readonly GeometryPartSpec[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexOffset = 0;
  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  for (const part of parts) {
    const srcPos = part.geo.getAttribute('position');
    if (!srcPos) continue;
    const srcNorm = part.geo.getAttribute('normal');
    const srcUv = part.geo.getAttribute('uv');
    const srcCol = part.geo.getAttribute('color');
    const srcIdx = part.geo.getIndex();
    const mat = part.matrix;
    const isMirrored = mat !== undefined && mat.determinant() < 0;
    if (mat) normalMat.getNormalMatrix(mat);
    const [cr, cg, cb] = part.colorRgb ?? [1, 1, 1];

    for (let i = 0; i < srcPos.count; i += 1) {
      vPos.fromBufferAttribute(srcPos, i);
      if (mat) vPos.applyMatrix4(mat);
      positions.push(vPos.x, vPos.y, vPos.z);

      if (srcNorm) {
        vNorm.fromBufferAttribute(srcNorm, i);
        if (mat) vNorm.applyMatrix3(normalMat).normalize();
        normals.push(vNorm.x, vNorm.y, vNorm.z);
      } else {
        normals.push(0, 1, 0);
      }

      if (srcUv) {
        uvs.push(srcUv.getX(i), srcUv.getY(i));
      } else {
        uvs.push(0.5, 0.5);
      }

      if (srcCol) {
        colors.push(srcCol.getX(i) * cr, srcCol.getY(i) * cg, srcCol.getZ(i) * cb);
      } else {
        colors.push(cr, cg, cb);
      }
    }

    if (srcIdx) {
      for (let i = 0; i < srcIdx.count; i += 3) {
        const i0 = vertexOffset + srcIdx.getX(i);
        const i1 = vertexOffset + srcIdx.getX(i + 1);
        const i2 = vertexOffset + srcIdx.getX(i + 2);
        if (isMirrored) {
          indices.push(i0, i2, i1);
        } else {
          indices.push(i0, i1, i2);
        }
      }
    } else {
      for (let i = 0; i < srcPos.count; i += 3) {
        const i0 = vertexOffset + i;
        const i1 = vertexOffset + i + 1;
        const i2 = vertexOffset + i + 2;
        if (isMirrored) {
          indices.push(i0, i2, i1);
        } else {
          indices.push(i0, i1, i2);
        }
      }
    }

    vertexOffset += srcPos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

export class SharedUnitGeometryPool {
  public readonly shadowPlane = new THREE.PlaneGeometry(1.48, 1.48);
  public readonly allegianceRing = new THREE.RingGeometry(0.52, 0.60, 28);
  public readonly costGlowRing = new THREE.TorusGeometry(0.47, 0.022, 8, 28);

  public readonly pedestal1Geo: THREE.BufferGeometry;
  public readonly pedestal2Geo: THREE.BufferGeometry;
  public readonly pedestal3Geo: THREE.BufferGeometry;
  public readonly star3CrownGeo: THREE.BufferGeometry;

  public readonly sculptedUnitLimb: THREE.BufferGeometry;
  public readonly sculptedUnitThigh: THREE.BufferGeometry;
  public readonly sculptedUnitShin: THREE.BufferGeometry;
  public readonly sculptedUnitArm: THREE.BufferGeometry;
  public readonly sculptedUnitForearm: THREE.BufferGeometry;
  public readonly sculptedJointBall = new THREE.SphereGeometry(0.054, 6, 5);
  public readonly sculptedTorsoCore: THREE.BufferGeometry;
  public readonly sculptedWaistCore: THREE.BufferGeometry;
  public readonly sculptedPelvisCore: THREE.BufferGeometry;
  public readonly sculptedBootShell: THREE.BufferGeometry;
  public readonly sculptedPauldronShell: THREE.BufferGeometry;
  public readonly sculptedKneeShield: THREE.BufferGeometry;
  public readonly sculptedChestPlate: THREE.BufferGeometry;
  public readonly sculptedTassetPlate: THREE.BufferGeometry;
  public readonly sculptedHelmetShell: THREE.BufferGeometry;
  public readonly sculptedSeraphHead: THREE.BufferGeometry;
  public readonly sculptedScholarHead: THREE.BufferGeometry;
  public readonly sculptedHandFist = new THREE.OctahedronGeometry(0.042, 1);

  public readonly headSphere = new THREE.SphereGeometry(0.19, 14, 12);
  public readonly headOcta = new THREE.OctahedronGeometry(0.21, 1);
  public readonly visorBox = new THREE.BoxGeometry(0.28, 0.09, 0.14);
  public readonly torsoChest = new THREE.CylinderGeometry(0.24, 0.18, 0.44, 6);
  public readonly heavyChest = new THREE.CylinderGeometry(0.32, 0.24, 0.50, 8);
  public readonly pelvis = new THREE.CylinderGeometry(0.18, 0.16, 0.16, 6);
  public readonly shoulderPad = new THREE.BoxGeometry(0.18, 0.14, 0.20);
  public readonly limb = new THREE.CylinderGeometry(0.062, 0.052, 0.34, 6);
  public readonly capePanel = new THREE.BoxGeometry(0.42, 0.58, 0.05);
  public readonly backpackTank = new THREE.CylinderGeometry(0.09, 0.09, 0.34, 10);
  public readonly hexShield = new THREE.CylinderGeometry(0.38, 0.38, 0.06, 6);
  public readonly blade = new THREE.BoxGeometry(0.05, 0.62, 0.11);
  public readonly staff = new THREE.CylinderGeometry(0.032, 0.032, 0.78, 6);
  public readonly wingFin = new THREE.BoxGeometry(0.055, 0.58, 0.18);
  public readonly sailPlane = new THREE.BoxGeometry(0.58, 0.44, 0.025);

  public readonly armorCuirass = createTaperedBoxGeometry(0.46, 0.29, 0.31, 0.28, 0.21);
  public readonly armorChestPlate = createTaperedBoxGeometry(0.35, 0.20, 0.23, 0.085, 0.05);
  public readonly armorAbdomen = createTaperedBoxGeometry(0.25, 0.21, 0.17, 0.19, 0.17);
  public readonly armorPelvis = createTaperedBoxGeometry(0.33, 0.21, 0.14, 0.23, 0.17);
  public readonly armorPauldron = createTaperedBoxGeometry(0.15, 0.25, 0.17, 0.24, 0.21);
  public readonly armorCollar = createTaperedBoxGeometry(0.28, 0.35, 0.085, 0.22, 0.25);
  public readonly armorThigh = createTaperedBoxGeometry(0.118, 0.096, 0.19, 0.128, 0.106);
  public readonly armorGreave = createTaperedBoxGeometry(0.104, 0.138, 0.23, 0.118, 0.192);
  public readonly armorKneeGuard = createTaperedBoxGeometry(0.092, 0.068, 0.095, 0.072, 0.042);
  public readonly armorGauntlet = createTaperedBoxGeometry(0.088, 0.108, 0.20, 0.094, 0.114);
  public readonly helmetDome = new THREE.SphereGeometry(0.182, 10, 8);
  public readonly helmetVisorArc = createTaperedBoxGeometry(0.275, 0.235, 0.082, 0.135, 0.112);
  public readonly helmetJaw = createTaperedBoxGeometry(0.21, 0.145, 0.09, 0.165, 0.12);
  public readonly helmetCrest = createTaperedBoxGeometry(0.255, 0.29, 0.055, 0.18, 0.225);
  public readonly armorCape = createTaperedBoxGeometry(0.34, 0.52, 0.62, 0.04, 0.04);
  public readonly miniRing = new THREE.TorusGeometry(0.46, 0.032, 6, 20);
  public readonly microRing = new THREE.TorusGeometry(0.175, 0.022, 6, 16);
  public readonly hexRim = new THREE.TorusGeometry(0.38, 0.036, 6, 6);
  public readonly strutBar = new THREE.BoxGeometry(0.026, 0.34, 0.026);
  public readonly sproutLeaf = createTaperedBoxGeometry(0.022, 0.095, 0.145, 0.016, 0.024);
  public readonly clockFace = new THREE.CylinderGeometry(0.14, 0.14, 0.032, 12);

  public readonly octaPrism = new THREE.OctahedronGeometry(0.40, 0);
  public readonly icosaCore = new THREE.IcosahedronGeometry(0.30, 1);
  public readonly dodecaCore = new THREE.DodecahedronGeometry(0.28, 0);
  public readonly sphereCore = new THREE.SphereGeometry(0.28, 18, 14);
  public readonly hullCruiser = new THREE.ConeGeometry(0.30, 1.02, 6);
  public readonly railBarrel = new THREE.BoxGeometry(0.075, 0.075, 0.94);
  public readonly finBlade = new THREE.BoxGeometry(0.34, 0.04, 0.24);
  public readonly radarDish = new THREE.ConeGeometry(0.26, 0.14, 12, 1, true);
  public readonly torusMajor = new THREE.TorusGeometry(0.44, 0.072, 10, 28);
  public readonly torusSlim = new THREE.TorusGeometry(0.48, 0.034, 8, 32);
  public readonly torusEinstein = new THREE.TorusGeometry(0.54, 0.032, 10, 36);
  public readonly whaleBody = new THREE.CapsuleGeometry(0.25, 0.52, 6, 12);
  public readonly bioPod = new THREE.CylinderGeometry(0.16, 0.16, 0.32, 12);
  public readonly hexPanel = new THREE.CylinderGeometry(0.28, 0.28, 0.04, 6);
  public readonly funnelBit = new THREE.OctahedronGeometry(0.11, 0);
  public readonly cylinderPillar = new THREE.CylinderGeometry(0.12, 0.16, 0.46, 8);
  public readonly boxBlock = new THREE.BoxGeometry(0.30, 0.22, 0.36);

  private readonly rawTempGeos: THREE.BufferGeometry[] = [];

  constructor() {
    this.shadowPlane.rotateX(-Math.PI * 0.5);
    this.allegianceRing.rotateX(-Math.PI * 0.5);
    this.costGlowRing.rotateX(Math.PI * 0.5);
    this.hexShield.rotateX(Math.PI * 0.5);
    this.hullCruiser.rotateX(Math.PI * 0.5);
    this.whaleBody.rotateX(Math.PI * 0.5);
    this.hexPanel.rotateX(Math.PI * 0.5);
    this.clockFace.rotateX(Math.PI * 0.5);

    this.sculptedUnitLimb = createLathePart(
      [
        [0.036, -0.5],
        [0.056, -0.32],
        [0.066, 0.06],
        [0.058, 0.38],
        [0.040, 0.5],
      ],
      10,
    );

    this.sculptedUnitThigh = createLathePart(
      [
        [0.042, -0.5],
        [0.062, -0.22],
        [0.080, 0.18],
        [0.074, 0.42],
        [0.050, 0.5],
      ],
      8,
    );

    this.sculptedUnitShin = createLathePart(
      [
        [0.040, -0.5],
        [0.050, -0.20],
        [0.072, 0.15],
        [0.064, 0.40],
        [0.044, 0.5],
      ],
      8,
    );

    this.sculptedUnitArm = createLathePart(
      [
        [0.034, -0.5],
        [0.050, -0.16],
        [0.058, 0.22],
        [0.044, 0.5],
      ],
      8,
    );

    this.sculptedUnitForearm = createLathePart(
      [
        [0.034, -0.5],
        [0.046, -0.15],
        [0.058, 0.20],
        [0.046, 0.44],
        [0.034, 0.5],
      ],
      8,
    );

    this.sculptedTorsoCore = createLathePart(
      [
        [0.094, -0.14],
        [0.128, -0.05],
        [0.170, 0.06],
        [0.182, 0.13],
        [0.142, 0.18],
        [0.070, 0.20],
      ],
      10,
    );

    this.sculptedWaistCore = createLathePart(
      [
        [0.104, -0.09],
        [0.090, -0.02],
        [0.096, 0.05],
        [0.112, 0.09],
      ],
      12,
    );

    this.sculptedPelvisCore = createLathePart(
      [
        [0.066, -0.08],
        [0.126, -0.02],
        [0.134, 0.04],
        [0.110, 0.08],
      ],
      12,
    );

    this.sculptedBootShell = createBevelExtrudePart(
      [
        [-0.046, -0.040],
        [0.046, -0.040],
        [0.054, 0.004],
        [0.032, 0.040],
        [-0.032, 0.040],
        [-0.054, 0.004],
      ],
      0.16,
      0.011,
      0.012,
      1,
      2,
    );

    this.sculptedPauldronShell = createBevelExtrudePart(
      [
        [-0.084, -0.060],
        [0.084, -0.060],
        [0.102, 0.018],
        [0.054, 0.074],
        [-0.054, 0.074],
        [-0.102, 0.018],
      ],
      0.112,
      0.012,
      0.012,
      1,
      2,
    );

    this.sculptedKneeShield = createBevelExtrudePart(
      [
        [0, -0.052],
        [0.040, -0.012],
        [0.032, 0.044],
        [0, 0.058],
        [-0.032, 0.044],
        [-0.040, -0.012],
      ],
      0.026,
      0.008,
      0.008,
      1,
      2,
    );

    this.sculptedChestPlate = createBevelExtrudePart(
      [
        [0, -0.108],
        [0.106, -0.052],
        [0.148, 0.048],
        [0.094, 0.104],
        [0, 0.088],
        [-0.094, 0.104],
        [-0.148, 0.048],
        [-0.106, -0.052],
      ],
      0.036,
      0.011,
      0.011,
      1,
      2,
    );

    this.sculptedTassetPlate = createBevelExtrudePart(
      [
        [-0.042, 0.092],
        [0.042, 0.092],
        [0.058, -0.045],
        [0.016, -0.112],
        [-0.034, -0.080],
      ],
      0.016,
      0.006,
      0.006,
      1,
      2,
    );

    this.sculptedHelmetShell = createLathePart(
      [
        [0.056, -0.096],
        [0.086, -0.060],
        [0.104, -0.006],
        [0.102, 0.048],
        [0.080, 0.092],
        [0.040, 0.112],
        [0.002, 0.118],
      ],
      14,
    );

    this.sculptedSeraphHead = applySmoothUvs(
      createLathePart(
        [
          [0.036, -0.104],
          [0.066, -0.058],
          [0.084, 0.006],
          [0.082, 0.066],
          [0.056, 0.110],
          [0.002, 0.128],
        ],
        14,
      ),
    );

    this.sculptedScholarHead = applySmoothUvs(
      createLathePart(
        [
          [0.042, -0.096],
          [0.066, -0.054],
          [0.082, 0.004],
          [0.084, 0.054],
          [0.068, 0.094],
          [0.034, 0.110],
          [0.002, 0.114],
        ],
        16,
      ),
    );

    const r1 = new THREE.TorusGeometry(0.42, 0.034, 6, 24);
    r1.rotateX(Math.PI * 0.5);
    const r2 = new THREE.TorusGeometry(0.53, 0.026, 6, 28);
    r2.rotateX(Math.PI * 0.5);
    const r3 = new THREE.TorusGeometry(0.64, 0.030, 6, 6);
    r3.rotateX(Math.PI * 0.5);
    const starGem = new THREE.OctahedronGeometry(0.068, 0);
    const crownBand = new THREE.TorusGeometry(0.24, 0.018, 6, 20);
    crownBand.rotateX(Math.PI * 0.5);
    this.rawTempGeos.push(r1, r2, r3, starGem, crownBand);

    this.pedestal1Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.036, 0) },
    ]);
    this.pedestal2Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.036, 0) },
      { geo: r2, matrix: makeTransform(0, 0.032, 0) },
    ]);
    this.pedestal3Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.036, 0) },
      { geo: r2, matrix: makeTransform(0, 0.032, 0) },
      { geo: r3, matrix: makeTransform(0, 0.030, 0) },
    ]);

    const goldRgb: RgbTriple = [0.98, 0.84, 0.44];
    this.star3CrownGeo = mergePartsWithVertexColor([
      { geo: crownBand, matrix: makeTransform(0, 0, 0), colorRgb: goldRgb },
      { geo: starGem, matrix: makeTransform(-0.18, 0.07, 0.14, 0, 0, 0.25, 0.85, 1.1, 0.85), colorRgb: goldRgb },
      { geo: starGem, matrix: makeTransform(0, 0.12, 0.20, 0, 0, 0, 1.1, 1.35, 1.1), colorRgb: [1.0, 0.94, 0.65] },
      { geo: starGem, matrix: makeTransform(0.18, 0.07, 0.14, 0, 0, -0.25, 0.85, 1.1, 0.85), colorRgb: goldRgb },
    ]);
  }

  public dispose(): void {
    const all: THREE.BufferGeometry[] = [
      this.shadowPlane,
      this.allegianceRing,
      this.costGlowRing,
      this.pedestal1Geo,
      this.pedestal2Geo,
      this.pedestal3Geo,
      this.star3CrownGeo,
      this.sculptedUnitLimb,
      this.sculptedUnitThigh,
      this.sculptedUnitShin,
      this.sculptedUnitArm,
      this.sculptedUnitForearm,
      this.sculptedJointBall,
      this.sculptedTorsoCore,
      this.sculptedWaistCore,
      this.sculptedPelvisCore,
      this.sculptedBootShell,
      this.sculptedPauldronShell,
      this.sculptedKneeShield,
      this.sculptedChestPlate,
      this.sculptedTassetPlate,
      this.sculptedHelmetShell,
      this.sculptedSeraphHead,
      this.sculptedScholarHead,
      this.sculptedHandFist,
      this.headSphere,
      this.headOcta,
      this.visorBox,
      this.torsoChest,
      this.heavyChest,
      this.pelvis,
      this.shoulderPad,
      this.limb,
      this.capePanel,
      this.backpackTank,
      this.hexShield,
      this.blade,
      this.staff,
      this.wingFin,
      this.sailPlane,
      this.armorCuirass,
      this.armorChestPlate,
      this.armorAbdomen,
      this.armorPelvis,
      this.armorPauldron,
      this.armorCollar,
      this.armorThigh,
      this.armorGreave,
      this.armorKneeGuard,
      this.armorGauntlet,
      this.helmetDome,
      this.helmetVisorArc,
      this.helmetJaw,
      this.helmetCrest,
      this.armorCape,
      this.miniRing,
      this.microRing,
      this.hexRim,
      this.strutBar,
      this.sproutLeaf,
      this.clockFace,
      this.octaPrism,
      this.icosaCore,
      this.dodecaCore,
      this.sphereCore,
      this.hullCruiser,
      this.railBarrel,
      this.finBlade,
      this.radarDish,
      this.torusMajor,
      this.torusSlim,
      this.torusEinstein,
      this.whaleBody,
      this.bioPod,
      this.hexPanel,
      this.funnelBit,
      this.cylinderPillar,
      this.boxBlock,
      ...this.rawTempGeos,
    ];
    for (const g of all) g.dispose();
  }
}

export function createBuilderContext(
  pool: SharedUnitGeometryPool,
  unitDef: UnitDef,
): UnitBuilderContext {
  const palette = FACTION_PALETTES[unitDef.faction] ?? FACTION_PALETTES['戴森工团']!;
  return {
    pool,
    unitDef,
    palette,
    primary: palette.primaryRgb,
    secondary: palette.secondaryRgb,
    accent: palette.accentRgb,
    darkSteel: [0.22, 0.28, 0.38],
    porcelain: [0.95, 0.97, 1.0],
    gold: [0.96, 0.78, 0.38],
    sapphire: [0.24, 0.62, 0.98],
    emerald: [0.20, 0.84, 0.56],
  };
}

interface StancePoseSpec {
  readonly liftY: number;
  readonly pelvisYaw: number;
  readonly torsoYaw: number;
  readonly torsoPitch: number;
  readonly headYaw: number;
  readonly headPitch: number;
  readonly lKnee: Vec3Tuple;
  readonly lAnkle: Vec3Tuple;
  readonly rKnee: Vec3Tuple;
  readonly rAnkle: Vec3Tuple;
  readonly lElbow: Vec3Tuple;
  readonly lHand: Vec3Tuple;
  readonly rElbow: Vec3Tuple;
  readonly rHand: Vec3Tuple;
  readonly bootPitchL: number;
  readonly bootPitchR: number;
}

function getStancePose(stance: HeroStance): StancePoseSpec {
  if (stance === 'shield_brace') {
    return {
      liftY: 0,
      pelvisYaw: -0.22,
      torsoYaw: -0.34,
      torsoPitch: 0.07,
      headYaw: 0.24,
      headPitch: 0.04,
      lKnee: [-0.145, 0.455, 0.145],
      lAnkle: [-0.175, 0.092, 0.115],
      rKnee: [0.155, 0.465, -0.055],
      rAnkle: [0.195, 0.092, -0.145],
      lElbow: [-0.30, 0.98, 0.15],
      lHand: [-0.21, 0.93, 0.34],
      rElbow: [0.33, 0.96, -0.06],
      rHand: [0.35, 0.78, 0.16],
      bootPitchL: 0,
      bootPitchR: 0,
    };
  }
  if (stance === 'aim_rifle') {
    return {
      liftY: 0,
      pelvisYaw: 0.34,
      torsoYaw: 0.48,
      torsoPitch: 0.08,
      headYaw: -0.34,
      headPitch: 0.04,
      lKnee: [-0.14, 0.46, 0.14],
      lAnkle: [-0.16, 0.092, 0.13],
      rKnee: [0.15, 0.47, -0.07],
      rAnkle: [0.19, 0.092, -0.14],
      lElbow: [-0.20, 1.00, 0.20],
      lHand: [-0.04, 1.05, 0.38],
      rElbow: [0.30, 1.02, -0.02],
      rHand: [0.14, 1.04, 0.22],
      bootPitchL: 0,
      bootPitchR: 0,
    };
  }
  if (stance === 'cape_command') {
    return {
      liftY: 0,
      pelvisYaw: -0.16,
      torsoYaw: -0.18,
      torsoPitch: -0.02,
      headYaw: 0.14,
      headPitch: -0.02,
      lKnee: [-0.12, 0.47, 0.09],
      lAnkle: [-0.14, 0.092, 0.08],
      rKnee: [0.13, 0.47, -0.03],
      rAnkle: [0.15, 0.092, -0.08],
      lElbow: [-0.28, 0.95, -0.02],
      lHand: [-0.26, 0.76, 0.12],
      rElbow: [0.30, 1.06, 0.10],
      rHand: [0.32, 1.14, 0.32],
      bootPitchL: 0,
      bootPitchR: 0,
    };
  }
  if (stance === 'cradle_protect') {
    return {
      liftY: 0,
      pelvisYaw: -0.08,
      torsoYaw: -0.04,
      torsoPitch: 0.06,
      headYaw: 0.03,
      headPitch: 0.22,
      lKnee: [-0.105, 0.465, 0.055],
      lAnkle: [-0.115, 0.088, 0.048],
      rKnee: [0.105, 0.470, -0.022],
      rAnkle: [0.125, 0.088, -0.055],
      lElbow: [-0.245, 0.96, 0.11],
      lHand: [-0.135, 0.89, 0.31],
      rElbow: [0.245, 0.96, 0.11],
      rHand: [0.135, 0.89, 0.31],
      bootPitchL: 0,
      bootPitchR: 0,
    };
  }
  return {
    liftY: 0.19,
    pelvisYaw: -0.10,
    torsoYaw: -0.08,
    torsoPitch: -0.04,
    headYaw: 0.06,
    headPitch: 0.06,
    lKnee: [-0.105, 0.50, 0.115],
    lAnkle: [-0.085, 0.12, 0.035],
    rKnee: [0.115, 0.45, -0.025],
    rAnkle: [0.125, 0.07, -0.115],
    lElbow: [-0.31, 1.04, 0.04],
    lHand: [-0.39, 0.92, 0.22],
    rElbow: [0.32, 1.08, 0.08],
    rHand: [0.40, 1.00, 0.26],
    bootPitchL: 0.46,
    bootPitchR: 0.56,
  };
}

function rotateYPoint(p: Vec3Tuple, yaw: number): THREE.Vector3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return new THREE.Vector3(p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c);
}

export function buildSculptedHero(
  ctx: UnitBuilderContext,
  out: UnitBlueprintParts,
  options?: SculptedHeroOptions,
): HeroAnchors {
  const { pool, primary, secondary, gold } = ctx;
  const stance: HeroStance = options?.stance ?? 'cape_command';
  const proportion: HeroProportion = options?.proportion ?? 'athletic';
  const helmetStyle: HeroHelmetStyle = options?.helmetStyle ?? 'vanguard';
  const pose = getStancePose(stance);

  const armorCol: RgbTriple = options?.armorColor ?? primary;
  const subCol: RgbTriple = options?.secondaryArmorColor ?? secondary;
  const matteCol: RgbTriple = options?.matteColor ?? [0.15, 0.19, 0.27];
  const trimCol: RgbTriple = options?.trimColor ?? gold;
  const visorMode = options?.visorMode ?? 'energy';
  const visorCol: RgbTriple = options?.visorColor ?? trimCol;

  const widthMul =
    proportion === 'vanguard' ? 1.16 : proportion === 'seraph' ? 0.88 : proportion === 'slender' ? 0.84 : 1.0;
  const limbMul =
    proportion === 'vanguard' ? 1.14 : proportion === 'seraph' ? 0.82 : proportion === 'slender' ? 0.78 : 0.96;
  const chestDepthMul =
    proportion === 'vanguard' ? 1.14 : proportion === 'slender' ? 0.84 : 0.94;
  const liftY = pose.liftY;

  const pelvisCenter = new THREE.Vector3(0, 0.835 + liftY, 0);
  const waistCenter = new THREE.Vector3(0, 0.965 + liftY, 0.008);
  const chestCenter = new THREE.Vector3(0, 1.145 + liftY, 0.014);
  const neckBase = new THREE.Vector3(0, 1.325 + liftY, 0.006);
  const headCenter = new THREE.Vector3(0, 1.448 + liftY, 0.016);

  const hipOffsetX = 0.095 * widthMul;
  const lHip = rotateYPoint([-hipOffsetX, 0, 0], pose.pelvisYaw).add(pelvisCenter);
  const rHip = rotateYPoint([hipOffsetX, 0, 0], pose.pelvisYaw).add(pelvisCenter);

  const lKnee = new THREE.Vector3(pose.lKnee[0] * widthMul, pose.lKnee[1] + liftY, pose.lKnee[2]);
  const rKnee = new THREE.Vector3(pose.rKnee[0] * widthMul, pose.rKnee[1] + liftY, pose.rKnee[2]);
  const lAnkle = new THREE.Vector3(pose.lAnkle[0] * widthMul, pose.lAnkle[1] + liftY, pose.lAnkle[2]);
  const rAnkle = new THREE.Vector3(pose.rAnkle[0] * widthMul, pose.rAnkle[1] + liftY, pose.rAnkle[2]);

  const shoulderOffX = 0.215 * widthMul;
  const lShoulder = rotateYPoint([-shoulderOffX, 0.075, -0.005], pose.torsoYaw).add(chestCenter);
  const rShoulder = rotateYPoint([shoulderOffX, 0.075, -0.005], pose.torsoYaw).add(chestCenter);
  const backMount = rotateYPoint([0, 0.02, -0.145 * chestDepthMul], pose.torsoYaw).add(chestCenter);

  const lElbow = new THREE.Vector3(pose.lElbow[0] * widthMul, pose.lElbow[1] + liftY, pose.lElbow[2]);
  const rElbow = new THREE.Vector3(pose.rElbow[0] * widthMul, pose.rElbow[1] + liftY, pose.rElbow[2]);
  const lHand = new THREE.Vector3(pose.lHand[0] * widthMul, pose.lHand[1] + liftY, pose.lHand[2]);
  const rHand = new THREE.Vector3(pose.rHand[0] * widthMul, pose.rHand[1] + liftY, pose.rHand[2]);

  out.matte.push(
    { geo: pool.sculptedPelvisCore, matrix: makeTransform(pelvisCenter.x, pelvisCenter.y, pelvisCenter.z, 0, pose.pelvisYaw, 0, widthMul, 1.0, chestDepthMul), colorRgb: matteCol },
    { geo: pool.sculptedWaistCore, matrix: makeTransform(waistCenter.x, waistCenter.y, waistCenter.z, pose.torsoPitch * 0.5, pose.torsoYaw * 0.6, 0, widthMul * 0.94, 1.05, chestDepthMul * 0.92), colorRgb: matteCol },
  );

  const scholarCoat = Boolean(options?.scholarCoat);

  const beltRing = trackGeo(out, new THREE.TorusGeometry(0.124 * widthMul, 0.014, 6, 16));
  beltRing.rotateX(Math.PI * 0.5);
  out.trim.push(
    { geo: beltRing, matrix: makeTransform(pelvisCenter.x, pelvisCenter.y + 0.052, pelvisCenter.z, 0, pose.pelvisYaw, 0, 1.0, 1.0, 0.82), colorRgb: trimCol },
  );
  const buckle = rotateYPoint([0, 0.052, 0.112 * chestDepthMul], pose.pelvisYaw).add(pelvisCenter);
  out.trim.push(
    { geo: pool.sculptedKneeShield, matrix: makeTransform(buckle.x, buckle.y, buckle.z, 0, pose.pelvisYaw, 0, 0.68, 0.62, 0.65), colorRgb: trimCol },
  );

  if (scholarCoat) {
    const tunicSkirt = trackGeo(
      out,
      applySmoothUvs(
        createLathePart(
          [
            [0.185 * widthMul, -0.34],
            [0.162 * widthMul, -0.18],
            [0.132 * widthMul, -0.02],
            [0.112 * widthMul, 0.06],
          ],
          14,
          Math.PI * 0.22,
          Math.PI * 1.56,
        ),
      ),
    );
    out.armor.push({
      geo: tunicSkirt,
      matrix: makeTransform(pelvisCenter.x, pelvisCenter.y + 0.02, pelvisCenter.z, 0, pose.pelvisYaw + Math.PI, 0, 1.0, 1.0, 0.94),
      colorRgb: armorCol,
    });
    const hemBorder = trackGeo(out, new THREE.TorusGeometry(0.184 * widthMul, 0.009, 5, 16, Math.PI * 1.56));
    hemBorder.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: hemBorder,
      matrix: makeTransform(pelvisCenter.x, pelvisCenter.y - 0.315, pelvisCenter.z, 0, pose.pelvisYaw + Math.PI * 0.78, 0, 1.0, 1.0, 0.94),
      colorRgb: trimCol,
    });
  } else {
    const tassetOffsets: readonly (readonly [number, number, number, number])[] = [
      [-0.140 * widthMul, -0.025, 0.022, 0.22],
      [0.140 * widthMul, -0.025, 0.022, -0.22],
    ];
    for (const [tx, ty, tz, tiltZ] of tassetOffsets) {
      const tp = rotateYPoint([tx, ty, tz], pose.pelvisYaw).add(pelvisCenter);
      out.armor.push({
        geo: pool.sculptedTassetPlate,
        matrix: makeTransform(tp.x, tp.y, tp.z, 0.06, pose.pelvisYaw + (tx < 0 ? -0.32 : 0.32), tiltZ, 1.0, 1.05, 1.0),
        colorRgb: subCol,
      });
    }
  }

  const addLeg = (
    hip: THREE.Vector3,
    knee: THREE.Vector3,
    ankle: THREE.Vector3,
    side: -1 | 1,
    bootPitch: number,
  ) => {
    out.matte.push(
      { geo: pool.sculptedUnitThigh, matrix: makeSegmentTransform(hip, knee, limbMul * 1.04, limbMul * 1.08), colorRgb: matteCol },
      { geo: pool.sculptedJointBall, matrix: makeTransform(knee.x, knee.y, knee.z, 0, 0, 0, limbMul * 0.96, limbMul * 0.96, limbMul * 0.96), colorRgb: matteCol },
      { geo: pool.sculptedUnitShin, matrix: makeSegmentTransform(ankle, knee, limbMul * 0.88, limbMul * 0.92), colorRgb: matteCol },
      { geo: pool.sculptedJointBall, matrix: makeTransform(ankle.x, ankle.y, ankle.z, 0, 0, 0, limbMul * 0.76, limbMul * 0.76, limbMul * 0.76), colorRgb: matteCol },
    );

    const thighArmorStart = hip.clone().lerp(knee, 0.16);
    const thighArmorEnd = hip.clone().lerp(knee, 0.86);
    const thighOut = new THREE.Vector3(side * 0.018 * limbMul, 0, 0.014 * limbMul);
    out.armor.push(
      { geo: pool.sculptedUnitThigh, matrix: makeSegmentTransform(thighArmorStart.add(thighOut), thighArmorEnd.add(thighOut), limbMul * 1.06, limbMul * 1.04), colorRgb: armorCol },
    );

    const shinArmorStart = ankle.clone().lerp(knee, 0.06);
    const shinArmorEnd = ankle.clone().lerp(knee, 0.88);
    const shinFront = new THREE.Vector3(0, 0, 0.016 * limbMul);
    out.armor.push(
      { geo: pool.sculptedUnitShin, matrix: makeSegmentTransform(shinArmorStart.add(shinFront), shinArmorEnd.add(shinFront), limbMul * 1.12, limbMul * 1.18), colorRgb: armorCol },
    );

    const kneeDirYaw = Math.atan2(knee.x - hip.x, Math.max(0.08, knee.z - hip.z + 0.25)) * 0.4 + pose.pelvisYaw * 0.5;
    out.armor.push(
      { geo: pool.sculptedKneeShield, matrix: makeTransform(knee.x, knee.y + 0.01, knee.z + 0.058 * limbMul, -0.14, kneeDirYaw, 0, limbMul * 1.08, limbMul * 1.12, limbMul), colorRgb: subCol },
    );
    out.trim.push(
      { geo: pool.sculptedKneeShield, matrix: makeTransform(knee.x, knee.y + 0.016, knee.z + 0.070 * limbMul, -0.14, kneeDirYaw, 0, limbMul * 0.52, limbMul * 0.62, limbMul * 0.7), colorRgb: trimCol },
    );

    const bootPos = ankle.clone().add(new THREE.Vector3(0, -0.042, 0.042));
    const bootYaw = pose.pelvisYaw * 0.6 + side * 0.14;
    out.armor.push(
      { geo: pool.sculptedBootShell, matrix: makeTransform(bootPos.x, bootPos.y, bootPos.z, bootPitch, bootYaw, 0, limbMul * 1.04, limbMul * 0.92, limbMul * 1.06), colorRgb: armorCol },
    );
    out.matte.push(
      { geo: pool.sculptedBootShell, matrix: makeTransform(bootPos.x, bootPos.y - 0.022, bootPos.z, bootPitch, bootYaw, 0, limbMul * 1.08, limbMul * 0.35, limbMul * 1.08), colorRgb: matteCol },
    );
    out.trim.push(
      { geo: pool.sculptedKneeShield, matrix: makeTransform(bootPos.x, bootPos.y + 0.014, bootPos.z + 0.056 * limbMul, Math.PI * 0.36 + bootPitch, bootYaw, 0, limbMul * 0.75, limbMul * 0.82, limbMul * 0.55), colorRgb: trimCol },
    );
  };

  addLeg(lHip, lKnee, lAnkle, -1, pose.bootPitchL);
  addLeg(rHip, rKnee, rAnkle, 1, pose.bootPitchR);

  out.armor.push(
    { geo: pool.sculptedTorsoCore, matrix: makeTransform(chestCenter.x, chestCenter.y, chestCenter.z, pose.torsoPitch, pose.torsoYaw, 0, widthMul, 1.02, chestDepthMul * 0.78), colorRgb: armorCol },
  );

  if (scholarCoat) {
    const lapel = trackGeo(out, applySmoothUvs(createBevelExtrudePart(
      [
        [0, -0.11],
        [0.092, 0.08],
        [0.048, 0.105],
        [0, 0.02],
        [-0.048, 0.105],
        [-0.092, 0.08],
      ],
      0.024,
      0.006,
      0.006,
      1,
      2,
    )));
    const chestFront = rotateYPoint([0, 0.024, 0.102 * chestDepthMul], pose.torsoYaw).add(chestCenter);
    out.armor.push({
      geo: lapel,
      matrix: makeTransform(chestFront.x, chestFront.y, chestFront.z, pose.torsoPitch - 0.12, pose.torsoYaw, 0, widthMul, 1.0, 1.0),
      colorRgb: subCol,
    });
    const claspPos = rotateYPoint([0, 0.072, 0.126 * chestDepthMul], pose.torsoYaw).add(chestCenter);
    out.trim.push({
      geo: pool.sculptedHandFist,
      matrix: makeTransform(claspPos.x, claspPos.y, claspPos.z, 0, pose.torsoYaw, 0, 0.55, 0.75, 0.35),
      colorRgb: trimCol,
    });
  } else {
    const chestFront = rotateYPoint([0, 0.022, 0.106 * chestDepthMul], pose.torsoYaw).add(chestCenter);
    out.armor.push(
      { geo: pool.sculptedChestPlate, matrix: makeTransform(chestFront.x, chestFront.y, chestFront.z, pose.torsoPitch - 0.14, pose.torsoYaw, 0, widthMul * 0.92, 0.94, 0.85), colorRgb: subCol },
    );

    const chestTrimPos = rotateYPoint([0, 0.046, 0.128 * chestDepthMul], pose.torsoYaw).add(chestCenter);
    out.trim.push(
      { geo: pool.sculptedKneeShield, matrix: makeTransform(chestTrimPos.x, chestTrimPos.y, chestTrimPos.z, pose.torsoPitch - 0.14, pose.torsoYaw, 0, widthMul * 0.72, 0.86, 0.55), colorRgb: trimCol },
    );

    if (options?.chestCore !== false) {
      const corePos = rotateYPoint([0, 0.026, 0.136 * chestDepthMul], pose.torsoYaw).add(chestCenter);
      out.energy.push(
        { geo: pool.octaPrism, matrix: makeTransform(corePos.x, corePos.y, corePos.z, 0, pose.torsoYaw, 0, 0.084, 0.135, 0.048) },
      );
    }
  }

  const collarGeo = trackGeo(out, createLathePart(
    [
      [0.118 * widthMul, -0.02],
      [0.100 * widthMul, 0.025],
      [0.090 * widthMul, 0.055],
    ],
    14,
  ));
  out.trim.push(
    { geo: collarGeo, matrix: makeTransform(neckBase.x, neckBase.y - 0.02, neckBase.z, pose.torsoPitch * 0.5, pose.torsoYaw, 0, 1.0, 1.0, 0.92), colorRgb: trimCol },
  );
  out.matte.push(
    { geo: pool.sculptedUnitArm, matrix: makeSegmentTransform(neckBase.clone().add(new THREE.Vector3(0, -0.02, 0)), headCenter.clone().add(new THREE.Vector3(0, -0.04, 0)), 0.78, 0.78), colorRgb: scholarCoat ? (options?.skinColor ?? [0.95, 0.86, 0.80]) : matteCol },
  );

  const addArm = (
    shoulder: THREE.Vector3,
    elbow: THREE.Vector3,
    hand: THREE.Vector3,
    side: -1 | 1,
  ) => {
    const asym = options?.asymmetricPauldron;
    const pauldronBoost = (asym === 'left' && side === -1) || (asym === 'right' && side === 1) ? 1.28 : 1.0;

    out.matte.push(
      { geo: pool.sculptedJointBall, matrix: makeTransform(shoulder.x, shoulder.y, shoulder.z, 0, 0, 0, limbMul * 0.92, limbMul * 0.92, limbMul * 0.92), colorRgb: matteCol },
      { geo: pool.sculptedUnitArm, matrix: makeSegmentTransform(shoulder, elbow, limbMul * 0.90, limbMul * 0.90), colorRgb: matteCol },
      { geo: pool.sculptedJointBall, matrix: makeTransform(elbow.x, elbow.y, elbow.z, 0, 0, 0, limbMul * 0.74, limbMul * 0.74, limbMul * 0.74), colorRgb: matteCol },
      { geo: pool.sculptedUnitForearm, matrix: makeSegmentTransform(elbow, hand, limbMul * 0.78, limbMul * 0.82), colorRgb: matteCol },
      { geo: pool.sculptedHandFist, matrix: makeTransform(hand.x, hand.y, hand.z, 0, 0, 0, limbMul * 0.92, limbMul * 0.92, limbMul * 0.92), colorRgb: matteCol },
    );

    const bicepStart = shoulder.clone().lerp(elbow, 0.16);
    const bicepEnd = shoulder.clone().lerp(elbow, 0.82);
    out.armor.push(
      { geo: pool.sculptedUnitArm, matrix: makeSegmentTransform(bicepStart, bicepEnd, limbMul * 1.08, limbMul * 1.08), colorRgb: scholarCoat ? armorCol : subCol },
    );

    if (scholarCoat) {
      const mantleCap = trackGeo(out, applySmoothUvs(new THREE.SphereGeometry(0.068 * limbMul, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.58)));
      out.armor.push({
        geo: mantleCap,
        matrix: makeTransform(shoulder.x + side * 0.015, shoulder.y + 0.015, shoulder.z, 0.08, pose.torsoYaw, -side * 0.45, 1.15, 0.92, 1.08),
        colorRgb: armorCol,
      });
    } else {
      const pCenter = shoulder.clone().add(new THREE.Vector3(side * 0.032 * pauldronBoost, 0.034 * pauldronBoost, 0));
      out.armor.push(
        { geo: pool.sculptedPauldronShell, matrix: makeTransform(pCenter.x, pCenter.y, pCenter.z, 0.08, pose.torsoYaw, -side * 0.42, limbMul * 0.90 * pauldronBoost, limbMul * 0.84 * pauldronBoost, limbMul * 0.98 * pauldronBoost), colorRgb: armorCol },
      );
      out.trim.push(
        { geo: pool.sculptedPauldronShell, matrix: makeTransform(pCenter.x + side * 0.014, pCenter.y + 0.022 * pauldronBoost, pCenter.z, 0.08, pose.torsoYaw, -side * 0.42, limbMul * 0.58 * pauldronBoost, limbMul * 0.36 * pauldronBoost, limbMul * 1.04 * pauldronBoost), colorRgb: trimCol },
      );
    }

    const gauntStart = elbow.clone().lerp(hand, 0.15);
    const gauntEnd = elbow.clone().lerp(hand, 0.92);
    out.armor.push(
      { geo: pool.sculptedUnitForearm, matrix: makeSegmentTransform(gauntStart, gauntEnd, limbMul * 1.06, limbMul * 1.08), colorRgb: armorCol },
    );
    const cuffPos = elbow.clone().lerp(hand, 0.82);
    const cuffDir = hand.clone().sub(elbow).normalize();
    const cuffQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    const cuffM = new THREE.Matrix4().compose(cuffPos, cuffQ, new THREE.Vector3(limbMul * 1.08, 0.024, limbMul * 1.08));
    out.trim.push({ geo: pool.sculptedUnitArm, matrix: cuffM, colorRgb: trimCol });
  };

  addArm(lShoulder, lElbow, lHand, -1);
  addArm(rShoulder, rElbow, rHand, 1);

  const headYaw = pose.torsoYaw + pose.headYaw;
  const headPitch = pose.headPitch;

  if (helmetStyle === 'seraph') {
    out.armor.push(
      { geo: pool.sculptedSeraphHead, matrix: makeTransform(headCenter.x, headCenter.y, headCenter.z, headPitch, headYaw, 0, 1.02, 1.08, 1.12), colorRgb: armorCol },
    );
    const crownBlade = trackGeo(out, createCurvedBladePart(0.24, 0.056, 0.018, -0.05, 0.02, 6));
    out.trim.push(
      { geo: crownBlade, matrix: makeTransform(headCenter.x, headCenter.y + 0.04, headCenter.z + 0.055, headPitch - 0.14, headYaw + Math.PI * 0.5, 0), colorRgb: trimCol },
    );
    const cheekFin = trackGeo(out, createCurvedBladePart(0.18, 0.048, 0.016, 0.04, 0.02, 5));
    for (const s of [-1, 1] as const) {
      const cp = rotateYPoint([s * 0.088, 0.01, -0.01], headYaw).add(headCenter);
      out.armor.push({
        geo: cheekFin,
        matrix: makeTransform(cp.x, cp.y, cp.z, headPitch - 0.35, headYaw + s * 0.35, -s * 0.42),
        colorRgb: armorCol,
      });
    }
    if (visorMode !== 'none') {
      const visorGeo = trackGeo(out, createCurvedVisorPart(0.088, 0.045, 0.104, 1.35, 1.24, 0.34, 12, 3));
      const target = visorMode === 'energy' ? out.energy : out.trim;
      target.push({
        geo: visorGeo,
        matrix: makeTransform(headCenter.x, headCenter.y + 0.008, headCenter.z + 0.006, headPitch, headYaw, 0),
        colorRgb: visorCol,
      });
    }
  } else if (helmetStyle === 'scholar') {
    const skin: RgbTriple = options?.skinColor ?? [0.96, 0.87, 0.81];
    const hair: RgbTriple = options?.hairColor ?? [0.95, 0.97, 1.0];
    const hairShadow: RgbTriple = [0.84, 0.90, 0.98];
    out.armor.push(
      { geo: pool.sculptedScholarHead, matrix: makeTransform(headCenter.x, headCenter.y, headCenter.z, headPitch, headYaw, 0, 0.96, 1.04, 1.02), colorRgb: skin },
    );
    const hairCrown = trackGeo(out, applySmoothUvs(createCurvedVisorPart(0.104, 0.118, 0.114, Math.PI * 1.56, 0.06, 1.78, 16, 8)));
    out.armor.push(
      { geo: hairCrown, matrix: makeTransform(headCenter.x, headCenter.y + 0.018, headCenter.z - 0.014, headPitch, headYaw + Math.PI, 0), colorRgb: hair },
    );
    const bangsL = trackGeo(out, applySmoothUvs(createCurvedBladePart(0.115, 0.056, 0.020, 0.042, 0.032, 6)));
    const bangsR = trackGeo(out, applySmoothUvs(createCurvedBladePart(0.105, 0.052, 0.020, -0.036, 0.030, 6)));
    out.armor.push(
      { geo: bangsL, matrix: makeTransform(headCenter.x - 0.012, headCenter.y + 0.118, headCenter.z + 0.072, Math.PI - 0.28 + headPitch, headYaw - 0.25, 0.22), colorRgb: hair },
      { geo: bangsR, matrix: makeTransform(headCenter.x + 0.022, headCenter.y + 0.116, headCenter.z + 0.072, Math.PI - 0.26 + headPitch, headYaw + 0.28, -0.26), colorRgb: hair },
    );

    const bunGeo = trackGeo(out, applySmoothUvs(createLathePart(
      [
        [0.026, -0.050],
        [0.062, -0.020],
        [0.068, 0.014],
        [0.048, 0.046],
        [0.002, 0.056],
      ],
      12,
    )));
    const bunPos = rotateYPoint([0, 0.022, -0.116], headYaw).add(headCenter);
    out.armor.push(
      { geo: bunGeo, matrix: makeTransform(bunPos.x, bunPos.y, bunPos.z, headPitch + 0.25, headYaw, 0), colorRgb: hair },
    );
    const bunPinRing = trackGeo(out, new THREE.TorusGeometry(0.060, 0.0085, 6, 14));
    out.trim.push(
      { geo: bunPinRing, matrix: makeTransform(bunPos.x, bunPos.y, bunPos.z + 0.012, headPitch + 0.18, headYaw, 0), colorRgb: trimCol },
    );

    for (const s of [-1, 1] as const) {
      const lockGeo = trackGeo(out, applySmoothUvs(createTaperedTubePart(
        [
          [s * 0.068, 0.072, 0.036],
          [s * 0.094, 0.004, 0.056],
          [s * 0.082, -0.082, 0.050],
          [s * 0.058, -0.145, 0.026],
        ],
        0.025,
        0.006,
        10,
        6,
      )));
      out.armor.push({
        geo: lockGeo,
        matrix: makeTransform(headCenter.x, headCenter.y, headCenter.z, headPitch, headYaw, 0),
        colorRgb: hairShadow,
      });
    }
    const browBand = trackGeo(out, createCurvedVisorPart(0.104, 0.104, 0.108, 1.85, 0.72, 0.12, 12, 2));
    out.trim.push({
      geo: browBand,
      matrix: makeTransform(headCenter.x, headCenter.y + 0.044, headCenter.z + 0.002, headPitch, headYaw, 0),
      colorRgb: trimCol,
    });
  } else {
    out.armor.push(
      { geo: pool.sculptedHelmetShell, matrix: makeTransform(headCenter.x, headCenter.y, headCenter.z, headPitch, headYaw, 0, 1.0, 1.02, 1.12), colorRgb: armorCol },
    );
    const browRidge = trackGeo(out, createBevelExtrudePart(
      [
        [-0.080, 0.0],
        [0, 0.026],
        [0.080, 0.0],
        [0.066, 0.038],
        [0, 0.054],
        [-0.066, 0.038],
      ],
      0.056,
      0.007,
      0.007,
      1,
      2,
    ));
    const browPos = rotateYPoint([0, 0.050, 0.082], headYaw).add(headCenter);
    out.armor.push(
      { geo: browRidge, matrix: makeTransform(browPos.x, browPos.y, browPos.z, headPitch + 0.16, headYaw, 0), colorRgb: subCol },
    );
    const crestBlade = trackGeo(out, createCurvedBladePart(0.15, 0.040, 0.015, -0.050, 0.015, 5));
    const crestPos = rotateYPoint([0, 0.082, -0.012], headYaw).add(headCenter);
    out.trim.push(
      { geo: crestBlade, matrix: makeTransform(crestPos.x, crestPos.y, crestPos.z, headPitch - 0.62, headYaw + Math.PI * 0.5, 0), colorRgb: trimCol },
    );

    const chinGuard = trackGeo(out, createBevelExtrudePart(
      [
        [-0.066, 0.024],
        [0.066, 0.024],
        [0.042, -0.036],
        [-0.042, -0.036],
      ],
      0.050,
      0.007,
      0.007,
      1,
      2,
    ));
    const chinPos = rotateYPoint([0, -0.054, 0.072], headYaw).add(headCenter);
    out.matte.push(
      { geo: chinGuard, matrix: makeTransform(chinPos.x, chinPos.y, chinPos.z, headPitch + 0.22, headYaw, 0), colorRgb: matteCol },
    );

    for (const s of [-1, 1] as const) {
      const earPod = rotateYPoint([s * 0.104, -0.006, 0.004], headYaw).add(headCenter);
      out.trim.push({
        geo: pool.sculptedJointBall,
        matrix: makeTransform(earPod.x, earPod.y, earPod.z, 0, headYaw, 0, 0.48, 0.72, 0.68),
        colorRgb: trimCol,
      });
    }

    if (visorMode !== 'none') {
      const visorGeo = trackGeo(out, createCurvedVisorPart(0.098, 0.088, 0.118, 1.52, 1.06, 0.56, 12, 4));
      if (visorMode === 'trim') {
        out.trim.push({
          geo: visorGeo,
          matrix: makeTransform(headCenter.x, headCenter.y + 0.008, headCenter.z + 0.008, headPitch, headYaw, 0),
          colorRgb: visorCol,
        });
      } else {
        out.energy.push({
          geo: visorGeo,
          matrix: makeTransform(headCenter.x, headCenter.y + 0.008, headCenter.z + 0.008, headPitch, headYaw, 0),
          colorRgb: visorCol,
        });
      }
    }
  }

  if (options?.cape) {
    const capeMain = trackGeo(out, createCurvedBladePart(0.82, 0.44 * widthMul, 0.016, 0.0, 0.14, 7));
    const capePos = rotateYPoint([0, 0.08, -0.14 * chestDepthMul], pose.torsoYaw).add(chestCenter);
    out.armor.push({
      geo: capeMain,
      matrix: makeTransform(capePos.x, capePos.y, capePos.z, Math.PI - 0.18, pose.torsoYaw, 0),
      colorRgb: subCol,
    });
  }

  if (options?.coatTails) {
    for (const s of [-1, 1] as const) {
      const tailRibbon = trackGeo(out, applySmoothUvs(createBevelExtrudePart(
        [
          [-0.055 * widthMul, 0.0],
          [0.055 * widthMul, 0.0],
          [0.105 * widthMul, -0.52],
          [0.025 * widthMul, -0.62],
          [-0.068 * widthMul, -0.48],
        ],
        0.014,
        0.004,
        0.004,
        1,
        2,
      )));
      const tailPos = rotateYPoint([s * 0.088 * widthMul, -0.02, -0.108 * chestDepthMul], pose.pelvisYaw).add(pelvisCenter);
      out.armor.push({
        geo: tailRibbon,
        matrix: makeTransform(tailPos.x, tailPos.y, tailPos.z, 0.22, pose.pelvisYaw + s * 0.28, -s * 0.14),
        colorRgb: armorCol,
      });
    }
  }

  out.headTopLocalY = headCenter.y + 0.24;

  const mkAnchor = (origin: THREE.Vector3, target: THREE.Vector3): HeroAnchorPoint => {
    const dir = target.clone().sub(origin).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    return { pos: target.clone(), dir, right };
  };

  return {
    leftHand: mkAnchor(lElbow, lHand),
    rightHand: mkAnchor(rElbow, rHand),
    leftForearm: mkAnchor(lElbow, lElbow.clone().lerp(lHand, 0.62)),
    rightForearm: mkAnchor(rElbow, rElbow.clone().lerp(rHand, 0.62)),
    leftShoulder: lShoulder,
    rightShoulder: rShoulder,
    backMount,
    chestCenter,
    headCenter,
    neckBase,
    pelvisCenter,
    torsoYaw: pose.torsoYaw,
  };
}

export function buildHumanoidFrame(
  ctx: UnitBuilderContext,
  out: UnitBlueprintParts,
  options?: HumanoidFrameOptions,
): void {
  const { pool, primary, secondary, accent } = ctx;
  const heavy = Boolean(options?.heavy);
  const yShift = options?.hover ? 0.15 : 0;
  const helmetStyle = options?.helmetStyle ?? 'tactical';

  const armorMain = options?.armorPrimary ?? primary;
  const armorSub = options?.armorSecondary ?? secondary;
  const armorTrim = options?.armorTrim ?? accent;
  const undersuit: RgbTriple = options?.undersuit ?? [0.16, 0.21, 0.30];

  const wScale = heavy ? 1.24 : 1.0;
  const legX = heavy ? 0.145 : 0.112;
  const shoulderX = heavy ? 0.345 : 0.275;
  const armX = heavy ? 0.365 : 0.295;

  out.bodyParts.push(
    { geo: pool.armorPelvis, matrix: makeTransform(0, 0.44 + yShift, 0, 0, 0, 0, wScale, 1.0, heavy ? 1.15 : 1.0), colorRgb: undersuit },
    { geo: pool.armorChestPlate, matrix: makeTransform(0, 0.45 + yShift, 0.115, 0.08, 0, 0, 0.42 * wScale, 0.46, 0.8), colorRgb: armorSub },
    { geo: pool.armorKneeGuard, matrix: makeTransform(-0.18 * wScale, 0.43 + yShift, 0.01, 0, 0, 0.18, 0.68, 1.25, 1.45), colorRgb: armorSub },
    { geo: pool.armorKneeGuard, matrix: makeTransform(0.18 * wScale, 0.43 + yShift, 0.01, 0, 0, -0.18, 0.68, 1.25, 1.45), colorRgb: armorSub },

    { geo: pool.armorThigh, matrix: makeTransform(-legX, 0.31 + yShift, 0, 0.04, 0, 0.03, heavy ? 1.2 : 1.0, 1.0, heavy ? 1.18 : 1.0), colorRgb: undersuit },
    { geo: pool.armorThigh, matrix: makeTransform(legX, 0.31 + yShift, 0, 0.04, 0, -0.03, heavy ? 1.2 : 1.0, 1.0, heavy ? 1.18 : 1.0), colorRgb: undersuit },
    { geo: pool.armorKneeGuard, matrix: makeTransform(-legX, 0.255 + yShift, 0.072, -0.14, 0, 0, heavy ? 1.22 : 1.0, 1.05, 1.0), colorRgb: armorSub },
    { geo: pool.armorKneeGuard, matrix: makeTransform(legX, 0.255 + yShift, 0.072, -0.14, 0, 0, heavy ? 1.22 : 1.0, 1.05, 1.0), colorRgb: armorSub },
    { geo: pool.armorGreave, matrix: makeTransform(-legX, 0.13 + yShift, 0.015, 0, 0, 0, heavy ? 1.22 : 1.0, 1.0, heavy ? 1.16 : 1.0), colorRgb: armorMain },
    { geo: pool.armorGreave, matrix: makeTransform(legX, 0.13 + yShift, 0.015, 0, 0, 0, heavy ? 1.22 : 1.0, 1.0, heavy ? 1.16 : 1.0), colorRgb: armorMain },

    { geo: pool.armorAbdomen, matrix: makeTransform(0, 0.56 + yShift, 0, 0, 0, 0, wScale * 0.96, 1.0, heavy ? 1.12 : 1.0), colorRgb: undersuit },
    { geo: pool.armorCuirass, matrix: makeTransform(0, 0.77 + yShift, 0, 0, 0, 0, wScale, heavy ? 1.08 : 1.0, heavy ? 1.18 : 1.0), colorRgb: armorMain },
    { geo: pool.armorChestPlate, matrix: makeTransform(0, 0.785 + yShift, 0.135 * (heavy ? 1.15 : 1.0), -0.12, 0, 0, wScale * 0.96, 1.0, 1.0), colorRgb: armorSub },
    { geo: pool.armorCollar, matrix: makeTransform(0, 0.945 + yShift, -0.01, 0.08, 0, 0, heavy ? 1.14 : 1.0, 1.0, 1.0), colorRgb: armorTrim },

    { geo: pool.armorPauldron, matrix: makeTransform(-shoulderX, 0.885 + yShift, 0, 0, 0, 0.34, heavy ? 1.32 : 1.08, heavy ? 1.18 : 1.0, heavy ? 1.24 : 1.04), colorRgb: armorSub },
    { geo: pool.armorPauldron, matrix: makeTransform(shoulderX, 0.885 + yShift, 0, 0, 0, -0.34, heavy ? 1.32 : 1.08, heavy ? 1.18 : 1.0, heavy ? 1.24 : 1.04), colorRgb: armorSub },
    { geo: pool.helmetCrest, matrix: makeTransform(-shoulderX - 0.02, 0.955 + yShift, 0, 0, 0, 0.34, 0.58 * (heavy ? 1.2 : 1.0), 0.72, 0.88), colorRgb: armorTrim },
    { geo: pool.helmetCrest, matrix: makeTransform(shoulderX + 0.02, 0.955 + yShift, 0, 0, 0, -0.34, 0.58 * (heavy ? 1.2 : 1.0), 0.72, 0.88), colorRgb: armorTrim },
  );

  const lArm = options?.leftArmPose ?? [0.22, 0, 0.14];
  const rArm = options?.rightArmPose ?? [0.34, 0, -0.14];
  out.bodyParts.push(
    { geo: pool.armorThigh, matrix: makeTransform(-armX, 0.735 + yShift, 0.02, lArm[0], lArm[1], lArm[2], 0.82, 0.92, 0.82), colorRgb: undersuit },
    { geo: pool.armorGauntlet, matrix: makeTransform(-armX - 0.015, 0.575 + yShift, 0.075, lArm[0] + 0.26, lArm[1], lArm[2] * 0.6, heavy ? 1.16 : 0.98, 1.0, heavy ? 1.16 : 0.98), colorRgb: armorMain },
    { geo: pool.armorThigh, matrix: makeTransform(armX, 0.735 + yShift, 0.03, rArm[0], rArm[1], rArm[2], 0.82, 0.92, 0.82), colorRgb: undersuit },
    { geo: pool.armorGauntlet, matrix: makeTransform(armX + 0.015, 0.575 + yShift, 0.095, rArm[0] + 0.28, rArm[1], rArm[2] * 0.6, heavy ? 1.16 : 0.98, 1.0, heavy ? 1.16 : 0.98), colorRgb: armorMain },
  );

  if (options?.showChestCore !== false) {
    const coreZ = 0.175 * (heavy ? 1.12 : 1.0);
    out.bodyParts.push({
      geo: pool.armorKneeGuard,
      matrix: makeTransform(0, 0.79 + yShift, coreZ - 0.015, 0, 0, 0, 1.12, 1.12, 0.65),
      colorRgb: undersuit,
    });
    out.weaponParts.push({
      geo: pool.octaPrism,
      matrix: makeTransform(0, 0.79 + yShift, coreZ + 0.012, 0, 0, 0, 0.15, 0.19, 0.09),
    });
  }

  const headY = 1.13 + yShift;
  if (helmetStyle === 'astro') {
    out.bodyParts.push(
      { geo: pool.helmetDome, matrix: makeTransform(0, headY + 0.01, -0.01, 0, 0, 0, 1.12, 1.08, 1.12), colorRgb: armorMain },
      { geo: pool.armorCollar, matrix: makeTransform(0, headY - 0.145, 0, 0, 0, 0, 0.92, 0.85, 0.92), colorRgb: armorTrim },
      { geo: pool.helmetCrest, matrix: makeTransform(0, headY + 0.14, 0.05, 0.18, 0, 0, 0.82, 0.78, 0.78), colorRgb: armorSub },
      { geo: pool.armorKneeGuard, matrix: makeTransform(-0.195, headY, 0.0, 0, 0, Math.PI * 0.5, 0.72, 0.72, 0.85), colorRgb: armorTrim },
      { geo: pool.armorKneeGuard, matrix: makeTransform(0.195, headY, 0.0, 0, 0, -Math.PI * 0.5, 0.72, 0.72, 0.85), colorRgb: armorTrim },
    );
    if (options?.showVisorGlow !== false) {
      out.weaponParts.push({
        geo: pool.helmetVisorArc,
        matrix: makeTransform(0, headY + 0.015, 0.135, 0.04, 0, 0, 0.98, 1.48, 0.96),
      });
    }
  } else if (helmetStyle === 'cyber') {
    out.bodyParts.push(
      { geo: pool.headOcta, matrix: makeTransform(0, headY + 0.015, 0, 0, Math.PI * 0.25, 0, 0.88, 1.06, 0.92), colorRgb: armorMain },
      { geo: pool.helmetJaw, matrix: makeTransform(0, headY - 0.095, 0.05, 0.15, 0, 0, 0.88, 0.95, 0.92), colorRgb: armorSub },
      { geo: pool.wingFin, matrix: makeTransform(0, headY + 0.16, -0.02, -0.32, 0, 0, 0.65, 0.34, 0.75), colorRgb: armorTrim },
    );
    if (options?.showVisorGlow !== false) {
      out.weaponParts.push({
        geo: pool.helmetVisorArc,
        matrix: makeTransform(0, headY + 0.02, 0.125, 0, 0, 0, 0.86, 0.76, 0.78),
      });
    }
  } else if (helmetStyle === 'scholar') {
    out.bodyParts.push(
      { geo: pool.helmetDome, matrix: makeTransform(0, headY, 0, 0, 0, 0, 0.94, 0.98, 0.95), colorRgb: [0.88, 0.79, 0.72] },
      { geo: pool.helmetCrest, matrix: makeTransform(0, headY + 0.125, 0.03, -0.08, 0, 0, 1.02, 1.05, 1.06), colorRgb: armorSub },
      { geo: pool.helmetJaw, matrix: makeTransform(0, headY - 0.115, -0.01, 0, 0, 0, 0.92, 0.75, 0.95), colorRgb: armorTrim },
    );
    if (options?.showVisorGlow !== false) {
      out.weaponParts.push({
        geo: pool.helmetVisorArc,
        matrix: makeTransform(0, headY + 0.03, 0.135, 0, 0, 0, 0.84, 0.56, 0.62),
      });
    }
  } else {
    out.bodyParts.push(
      { geo: pool.helmetDome, matrix: makeTransform(0, headY + 0.01, -0.01, 0, 0, 0, 1.0, 0.96, 1.04), colorRgb: armorMain },
      { geo: pool.helmetJaw, matrix: makeTransform(0, headY - 0.085, 0.045, 0.1, 0, 0, 1.0, 1.0, 1.0), colorRgb: undersuit },
      { geo: pool.helmetCrest, matrix: makeTransform(0, headY + 0.11, 0.045, 0.12, 0, 0, 0.96, 0.95, 0.96), colorRgb: armorSub },
      { geo: pool.armorKneeGuard, matrix: makeTransform(-0.18, headY, 0.01, 0, 0, Math.PI * 0.5, 0.65, 0.65, 0.78), colorRgb: armorTrim },
      { geo: pool.armorKneeGuard, matrix: makeTransform(0.18, headY, 0.01, 0, 0, -Math.PI * 0.5, 0.65, 0.65, 0.78), colorRgb: armorTrim },
    );
    if (options?.showVisorGlow !== false) {
      out.weaponParts.push({
        geo: pool.helmetVisorArc,
        matrix: makeTransform(0, headY + 0.02, 0.135, 0, 0, 0, 0.96, 0.92, 0.86),
      });
    }
  }

  if (options?.cape) {
    out.bodyParts.push(
      { geo: pool.armorCape, matrix: makeTransform(0, 0.62 + yShift, -0.225, 0.22, 0, 0, heavy ? 1.18 : 1.0, 1.0, 1.0), colorRgb: armorSub },
      { geo: pool.helmetCrest, matrix: makeTransform(0, 0.92 + yShift, -0.15, 0.35, 0, 0, 1.15, 0.72, 0.72), colorRgb: armorTrim },
    );
  }

  out.headTopLocalY = 1.62 + yShift;
}

export const appendHumanoidBase = buildHumanoidFrame;

export function appendRoleFallbackChassis(ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const { pool, unitDef, primary, secondary, darkSteel, accent } = ctx;
  const role = unitDef.role;

  if (role === '重装') {
    out.bodyParts.push(
      { geo: pool.boxBlock, matrix: makeTransform(0, 0.22, 0, 0, 0, 0, 1.8, 0.9, 1.5), colorRgb: darkSteel },
      { geo: pool.heavyChest, matrix: makeTransform(0, 0.68, 0, 0, 0, 0, 1.2, 1.1, 1.15), colorRgb: primary },
      { geo: pool.shoulderPad, matrix: makeTransform(-0.42, 0.84, 0, 0, 0, 0.2, 1.4, 1.3, 1.3), colorRgb: secondary },
      { geo: pool.shoulderPad, matrix: makeTransform(0.42, 0.84, 0, 0, 0, -0.2, 1.4, 1.3, 1.3), colorRgb: secondary },
    );
    out.weaponParts.push({
      geo: pool.hexShield,
      matrix: makeTransform(0, 0.68, 0.38, 0, 0, 0, 1.18, 1.18, 1.18),
    });
    out.headTopLocalY = 1.56;
  } else if (role === '磁轨') {
    out.bodyParts.push(
      { geo: pool.cylinderPillar, matrix: makeTransform(0, 0.24, -0.10, 0, 0, 0, 1.4, 0.8, 1.4), colorRgb: darkSteel },
      { geo: pool.boxBlock, matrix: makeTransform(0, 0.56, -0.14, 0, 0, 0, 1.4, 1.0, 1.6), colorRgb: primary },
      { geo: pool.finBlade, matrix: makeTransform(-0.32, 0.58, -0.24, 0, 0, 0.45), colorRgb: secondary },
      { geo: pool.finBlade, matrix: makeTransform(0.32, 0.58, -0.24, 0, 0, -0.45), colorRgb: secondary },
    );
    out.weaponParts.push(
      { geo: pool.railBarrel, matrix: makeTransform(-0.13, 0.64, 0.28) },
      { geo: pool.railBarrel, matrix: makeTransform(0.13, 0.64, 0.28) },
      { geo: pool.torusSlim, matrix: makeTransform(0, 0.64, 0.45, 0, 0, 0, 0.45, 0.45, 0.45) },
    );
    out.headTopLocalY = 1.46;
  } else if (role === '光子') {
    out.bodyParts.push(
      { geo: pool.octaPrism, matrix: makeTransform(0, 0.80, 0, 0, 0, 0, 0.9, 1.1, 0.9), colorRgb: primary },
      { geo: pool.wingFin, matrix: makeTransform(-0.42, 0.84, -0.05, 0, 0.2, 0.28), colorRgb: secondary },
      { geo: pool.wingFin, matrix: makeTransform(0.42, 0.84, -0.05, 0, -0.2, -0.28), colorRgb: secondary },
    );
    out.weaponParts.push(
      { geo: pool.icosaCore, matrix: makeTransform(0, 0.82, 0.20, 0, 0, 0, 0.55, 0.55, 0.55) },
      { geo: pool.funnelBit, matrix: makeTransform(0, 1.32, 0) },
    );
    out.headTopLocalY = 1.62;
  } else if (role === '矩阵') {
    out.bodyParts.push(
      { geo: pool.hexPanel, matrix: makeTransform(0, 0.26, 0, Math.PI * 0.5, 0, 0, 1.5, 1.5, 1.4), colorRgb: darkSteel },
      { geo: pool.dodecaCore, matrix: makeTransform(0, 0.66, 0), colorRgb: primary },
      { geo: pool.radarDish, matrix: makeTransform(0, 1.02, 0, Math.PI, 0, 0), colorRgb: secondary },
    );
    out.weaponParts.push({
      geo: pool.torusSlim,
      matrix: makeTransform(0, 0.84, 0, Math.PI * 0.5, 0, 0, 0.85, 0.85, 0.85),
    });
    out.headTopLocalY = 1.54;
  } else if (role === '维生') {
    out.bodyParts.push(
      { geo: pool.bioPod, matrix: makeTransform(0, 0.56, 0, 0, 0, 0, 1.3, 1.2, 1.3), colorRgb: primary },
      { geo: pool.torusSlim, matrix: makeTransform(0, 0.56, 0, Math.PI * 0.5, 0, 0, 0.72, 0.72, 0.72), colorRgb: secondary },
    );
    out.weaponParts.push({
      geo: pool.sphereCore,
      matrix: makeTransform(0, 0.96, 0.16, 0, 0, 0, 0.65, 0.65, 0.65),
    });
    out.headTopLocalY = 1.52;
  } else {
    out.bodyParts.push(
      { geo: pool.hullCruiser, matrix: makeTransform(0, 0.66, 0.04, 0.16, 0, 0, 0.95, 1.15, 0.95), colorRgb: primary },
      { geo: pool.blade, matrix: makeTransform(-0.36, 0.68, 0.0, 0.35, 0, 0.72), colorRgb: secondary },
      { geo: pool.blade, matrix: makeTransform(0.36, 0.68, 0.0, 0.35, 0, -0.72), colorRgb: secondary },
    );
    out.weaponParts.push(
      { geo: pool.funnelBit, matrix: makeTransform(0, 0.72, 0.42, 0, 0, 0, 1.1, 1.1, 1.6) },
      { geo: pool.visorBox, matrix: makeTransform(0, 0.66, -0.34, 0, 0, 0, 0.9, 0.8, 1.2), colorRgb: accent },
    );
    out.headTopLocalY = 1.48;
  }
}

export type OrganicHeroStance = 'zero_g_guard' | 'cradle_specimen' | 'standing_sleek';
export type OrganicHeroHelmetMode = 'gold_eva' | 'clear_dome' | 'visor_sleek';
export type OrganicHeroSuitStyle = 'eva_ceramic' | 'astro_coat';

export interface OrganicHeroOptions {
  readonly stance?: OrganicHeroStance;
  readonly helmetMode?: OrganicHeroHelmetMode;
  readonly suitStyle?: OrganicHeroSuitStyle;
  readonly primaryColor?: RgbTriple;
  readonly secondaryColor?: RgbTriple;
  readonly trimColor?: RgbTriple;
  readonly fabricColor?: RgbTriple;
  readonly skinColor?: RgbTriple;
  readonly hairColor?: RgbTriple;
  readonly eyeColor?: RgbTriple;
  readonly hoverHeight?: number;
  readonly backpack?: boolean;
  readonly umbilicals?: boolean;
}

export interface OrganicHeroAnchors {
  readonly leftHand: THREE.Vector3;
  readonly rightHand: THREE.Vector3;
  readonly leftForearm: THREE.Vector3;
  readonly rightForearm: THREE.Vector3;
  readonly chestCenter: THREE.Vector3;
  readonly headCenter: THREE.Vector3;
  readonly backMount: THREE.Vector3;
  readonly headTopY: number;
}

export function buildOrganicHero(
  ctx: UnitBuilderContext,
  out: UnitBlueprintParts,
  opts: OrganicHeroOptions = {},
): OrganicHeroAnchors {
  const stance = opts.stance ?? 'standing_sleek';
  const helmetMode = opts.helmetMode ?? 'visor_sleek';
  const suitStyle = opts.suitStyle ?? 'eva_ceramic';
  const hoverY = opts.hoverHeight ?? (stance === 'zero_g_guard' ? 0.16 : 0.02);

  const primaryCol = opts.primaryColor ?? ctx.porcelain;
  const secondaryCol = opts.secondaryColor ?? ctx.secondary;
  const trimCol = opts.trimColor ?? ctx.gold;
  const fabricCol = opts.fabricColor ?? [0.24, 0.30, 0.38];
  const skinCol = opts.skinColor ?? [0.96, 0.87, 0.81];
  const hairCol = opts.hairColor ?? [0.89, 0.92, 0.97];
  const eyeCol = opts.eyeColor ?? [0.35, 0.84, 0.98];

  const isZeroG = stance === 'zero_g_guard';
  const isCradle = stance === 'cradle_specimen';
  const bodyLeanX = isZeroG ? 0.09 : 0.0;

  const torsoProfile: readonly (readonly [number, number])[] =
    suitStyle === 'astro_coat'
      ? [
          [0.015, 0.0],
          [0.245, 0.02],
          [0.228, 0.12],
          [0.186, 0.25],
          [0.148, 0.38],
          [0.126, 0.48],
          [0.142, 0.58],
          [0.168, 0.69],
          [0.156, 0.77],
          [0.095, 0.81],
          [0.068, 0.84],
        ]
      : [
          [0.015, 0.0],
          [0.155, 0.04],
          [0.168, 0.12],
          [0.146, 0.22],
          [0.132, 0.31],
          [0.162, 0.42],
          [0.194, 0.52],
          [0.184, 0.60],
          [0.118, 0.65],
          [0.078, 0.68],
        ];

  const torsoBaseY = suitStyle === 'astro_coat' ? 0.28 + hoverY : 0.58 + hoverY;
  const torsoGeo = trackGeo(
    out,
    createSculptedClothLathe(
      torsoProfile,
      36,
      suitStyle === 'astro_coat' ? 8 : 0,
      suitStyle === 'astro_coat' ? 0.028 : 0,
      0.42,
      suitStyle === 'astro_coat' ? secondaryCol : primaryCol,
      primaryCol,
    ),
  );
  out.armor.push({
    geo: torsoGeo,
    matrix: makeTransform(0, torsoBaseY, 0, bodyLeanX, 0, 0, 1.0, 1.0, suitStyle === 'astro_coat' ? 0.90 : 0.84),
  });

  const waistY = suitStyle === 'astro_coat' ? torsoBaseY + 0.47 : torsoBaseY + 0.28;
  const collarY = suitStyle === 'astro_coat' ? torsoBaseY + 0.80 : torsoBaseY + 0.64;
  const chestY = suitStyle === 'astro_coat' ? torsoBaseY + 0.63 : torsoBaseY + 0.48;
  const neckY = collarY + 0.03;
  const headY = neckY + 0.165;

  const waistRing = trackGeo(out, new THREE.TorusGeometry(suitStyle === 'astro_coat' ? 0.132 : 0.140, 0.014, 12, 32));
  out.trim.push({
    geo: waistRing,
    matrix: makeTransform(0, waistY, 0.008, Math.PI * 0.5 + bodyLeanX, 0, 0, 1.0, 0.88, 1.0),
    colorRgb: trimCol,
  });

  const collarRing = trackGeo(out, new THREE.TorusGeometry(0.112, 0.017, 14, 32));
  out.trim.push({
    geo: collarRing,
    matrix: makeTransform(0, collarY, 0.012, Math.PI * 0.5 + bodyLeanX * 0.6, 0, 0),
    colorRgb: trimCol,
  });

  const chestBadge = trackGeo(out, createTeardropPart(0.11, 0.052, 1.15, 20, 14, 0.012));
  out.matte.push({
    geo: chestBadge,
    matrix: makeTransform(0, chestY + 0.01, suitStyle === 'astro_coat' ? 0.145 : 0.164, Math.PI * 0.5, 0, 0, 1.0, 0.45, 0.88),
    colorRgb: fabricCol,
  });
  const chestNode = trackGeo(out, new THREE.SphereGeometry(0.024, 16, 12));
  out.energy.push({
    geo: chestNode,
    matrix: makeTransform(0, chestY + 0.015, suitStyle === 'astro_coat' ? 0.168 : 0.186, 0, 0, 0, 1.15, 0.72, 0.55),
    colorRgb: eyeCol,
  });

  if (suitStyle === 'astro_coat') {
    const hemRing = trackGeo(out, new THREE.TorusGeometry(0.240, 0.009, 10, 36));
    out.trim.push({
      geo: hemRing,
      matrix: makeTransform(0, torsoBaseY + 0.022, 0, Math.PI * 0.5, 0, 0, 1.0, 0.90, 1.0),
      colorRgb: trimCol,
    });

    for (const side of [-1, 1] as const) {
      const legGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.075, torsoBaseY + 0.08, 0.0],
            [side * 0.080, 0.16 + hoverY, 0.012],
            [side * 0.084, 0.06 + hoverY, 0.022],
          ],
          0.056,
          0.048,
          0.042,
          14,
          14,
          primaryCol,
          fabricCol,
        ),
      );
      out.armor.push({ geo: legGeo });

      const bootGeo = trackGeo(out, createTeardropPart(0.16, 0.052, 1.1, 20, 14, 0));
      out.armor.push({
        geo: bootGeo,
        matrix: makeTransform(side * 0.084, 0.048 + hoverY, 0.052, -Math.PI * 0.5, 0, 0, 0.88, 1.0, 0.74),
        colorRgb: primaryCol,
      });
      const bootTrim = trackGeo(out, new THREE.TorusGeometry(0.044, 0.008, 8, 20));
      out.trim.push({
        geo: bootTrim,
        matrix: makeTransform(side * 0.084, 0.072 + hoverY, 0.025, Math.PI * 0.5, 0, 0),
        colorRgb: trimCol,
      });
    }
  } else {
    const legCurves: readonly (readonly Vec3Tuple[])[] = isZeroG
      ? [
          [
            [-0.095, torsoBaseY + 0.06, -0.01],
            [-0.125, torsoBaseY - 0.16, 0.06],
            [-0.135, torsoBaseY - 0.36, -0.04],
          ],
          [
            [0.095, torsoBaseY + 0.06, -0.01],
            [0.115, torsoBaseY - 0.18, -0.02],
            [0.125, torsoBaseY - 0.42, -0.08],
          ],
        ]
      : [
          [
            [-0.095, torsoBaseY + 0.06, 0.0],
            [-0.108, torsoBaseY - 0.22, 0.02],
            [-0.112, 0.08 + hoverY, 0.01],
          ],
          [
            [0.095, torsoBaseY + 0.06, 0.0],
            [0.108, torsoBaseY - 0.22, 0.02],
            [0.112, 0.08 + hoverY, 0.01],
          ],
        ];

    legCurves.forEach((pts, idx) => {
      const legGeo = trackGeo(
        out,
        createOrganicLimb(pts, 0.076, 0.064, 0.054, 18, 16, primaryCol, secondaryCol),
      );
      out.armor.push({ geo: legGeo });

      const ankle = pts[2]!;
      const kneeRing = trackGeo(out, new THREE.TorusGeometry(0.066, 0.010, 10, 22));
      out.matte.push({
        geo: kneeRing,
        matrix: makeTransform(pts[1]![0], pts[1]![1], pts[1]![2], Math.PI * 0.52, 0, 0),
        colorRgb: fabricCol,
      });

      const bootGeo = trackGeo(out, createTeardropPart(0.19, 0.060, 1.15, 22, 16, 0));
      const bootPitch = isZeroG ? (idx === 0 ? -Math.PI * 0.36 : -Math.PI * 0.30) : -Math.PI * 0.5;
      out.armor.push({
        geo: bootGeo,
        matrix: makeTransform(ankle[0], ankle[1] - 0.02, ankle[2] + 0.042, bootPitch, 0, 0, 0.92, 1.0, 0.78),
        colorRgb: primaryCol,
      });

      const soleTrim = trackGeo(out, new THREE.TorusGeometry(0.050, 0.009, 10, 20));
      out.trim.push({
        geo: soleTrim,
        matrix: makeTransform(ankle[0], ankle[1] + 0.02, ankle[2], Math.PI * 0.5, 0, 0),
        colorRgb: trimCol,
      });
    });
  }

  const shoulderY = collarY - 0.075;
  const shoulderX = suitStyle === 'astro_coat' ? 0.165 : 0.188;

  const leftArmPts: readonly Vec3Tuple[] = isCradle
    ? [
        [-shoulderX, shoulderY, 0.0],
        [-0.22, shoulderY - 0.18, 0.10],
        [-0.125, chestY - 0.06, 0.255],
      ]
    : isZeroG
      ? [
          [-shoulderX, shoulderY, 0.01],
          [-0.27, shoulderY - 0.11, 0.14],
          [-0.22, chestY - 0.01, 0.28],
        ]
      : [
          [-shoulderX, shoulderY, 0.0],
          [-0.24, shoulderY - 0.18, 0.06],
          [-0.19, waistY - 0.04, 0.14],
        ];

  const rightArmPts: readonly Vec3Tuple[] = isCradle
    ? [
        [shoulderX, shoulderY, 0.0],
        [0.22, shoulderY - 0.18, 0.10],
        [0.125, chestY - 0.06, 0.255],
      ]
    : isZeroG
      ? [
          [shoulderX, shoulderY, 0.0],
          [0.26, shoulderY - 0.14, 0.10],
          [0.24, chestY - 0.06, 0.25],
        ]
      : [
          [shoulderX, shoulderY, 0.0],
          [0.24, shoulderY - 0.18, 0.06],
          [0.19, waistY - 0.04, 0.14],
        ];

  for (const armPts of [leftArmPts, rightArmPts]) {
    const armGeo = trackGeo(
      out,
      createOrganicLimb(
        armPts,
        suitStyle === 'astro_coat' ? 0.056 : 0.064,
        suitStyle === 'astro_coat' ? 0.046 : 0.052,
        suitStyle === 'astro_coat' ? 0.036 : 0.042,
        18,
        14,
        primaryCol,
        secondaryCol,
      ),
    );
    out.armor.push({ geo: armGeo });

    const wrist = armPts[2]!;
    const cuff = trackGeo(out, new THREE.TorusGeometry(suitStyle === 'astro_coat' ? 0.040 : 0.046, 0.008, 10, 20));
    out.trim.push({
      geo: cuff,
      matrix: makeTransform(wrist[0], wrist[1], wrist[2], Math.PI * 0.45, 0, 0),
      colorRgb: trimCol,
    });
    const glove = trackGeo(out, new THREE.SphereGeometry(suitStyle === 'astro_coat' ? 0.036 : 0.042, 14, 12));
    out.matte.push({
      geo: glove,
      matrix: makeTransform(wrist[0], wrist[1] - 0.008, wrist[2] + 0.022, 0, 0, 0, 0.92, 0.84, 1.12),
      colorRgb: fabricCol,
    });
  }

  let headTopY = headY + 0.22;

  if (helmetMode === 'gold_eva') {
    const shell = trackGeo(out, new THREE.SphereGeometry(0.168, 28, 22));
    out.armor.push({
      geo: shell,
      matrix: makeTransform(0, headY, 0.005, 0, 0, 0, 0.98, 1.03, 1.06),
      colorRgb: primaryCol,
    });

    const goldVisor = trackGeo(
      out,
      new THREE.SphereGeometry(0.156, 28, 22, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.22, Math.PI * 0.56),
    );
    out.trim.push({
      geo: goldVisor,
      matrix: makeTransform(0, headY + 0.008, 0.036, 0, Math.PI * 0.5, 0, 1.0, 0.98, 0.98),
      colorRgb: [1.0, 0.84, 0.42],
    });

    const visorFrame = trackGeo(out, new THREE.TorusGeometry(0.132, 0.010, 12, 28));
    out.matte.push({
      geo: visorFrame,
      matrix: makeTransform(0, headY + 0.006, 0.115, 0.08, 0, 0, 0.95, 0.82, 0.65),
      colorRgb: fabricCol,
    });

    for (const side of [-1, 1] as const) {
      const earPod = trackGeo(out, createTeardropPart(0.085, 0.032, 1.2, 16, 12, 0));
      out.armor.push({
        geo: earPod,
        matrix: makeTransform(side * 0.162, headY, 0.0, 0, 0, side * 0.18, 0.75, 1.0, 0.95),
        colorRgb: secondaryCol,
      });
      const lamp = trackGeo(out, new THREE.SphereGeometry(0.015, 12, 10));
      out.energy.push({
        geo: lamp,
        matrix: makeTransform(side * 0.164, headY + 0.035, 0.048),
        colorRgb: eyeCol,
      });
    }
    headTopY = headY + 0.20;
  } else if (helmetMode === 'clear_dome') {
    const neckGeo = trackGeo(out, new THREE.CylinderGeometry(0.042, 0.050, 0.09, 16));
    out.armor.push({
      geo: neckGeo,
      matrix: makeTransform(0, neckY + 0.025, 0.01),
      colorRgb: skinCol,
    });

    const innerHead = trackGeo(out, new THREE.SphereGeometry(0.106, 26, 20));
    out.armor.push({
      geo: innerHead,
      matrix: makeTransform(0, headY, 0.014, 0, 0, 0, 0.94, 1.04, 0.98),
      colorRgb: skinCol,
    });

    for (const side of [-1, 1] as const) {
      const eye = trackGeo(out, new THREE.SphereGeometry(0.014, 12, 10));
      out.energy.push({
        geo: eye,
        matrix: makeTransform(side * 0.036, headY + 0.004, 0.105, 0, 0, 0, 1.15, 0.78, 0.45),
        colorRgb: eyeCol,
      });
    }

    const hairCrown = trackGeo(
      out,
      new THREE.SphereGeometry(0.114, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.62),
    );
    out.armor.push({
      geo: hairCrown,
      matrix: makeTransform(0, headY + 0.012, 0.002, -0.22, 0, 0, 1.02, 1.04, 1.06),
      colorRgb: hairCol,
    });

    const hairBun = trackGeo(out, createTeardropPart(0.11, 0.056, 1.05, 20, 14, 0, hairCol, primaryCol));
    out.armor.push({
      geo: hairBun,
      matrix: makeTransform(0, headY + 0.025, -0.102, -0.45, 0, 0),
    });

    for (const side of [-1, 1] as const) {
      const lock = trackGeo(
        out,
        createFlowingRibbonMesh(
          [
            [side * 0.035, headY + 0.095, 0.068],
            [side * 0.092, headY + 0.035, 0.072],
            [side * 0.102, headY - 0.052, 0.042],
            [side * 0.078, headY - 0.115, 0.015],
          ],
          [0.038, 0.044, 0.016],
          0.006,
          1.2,
          18,
          4,
          0.014,
          hairCol,
          [0.80, 0.85, 0.93],
        ),
      );
      out.armor.push({ geo: lock });
    }

    const clearDome = trackGeo(out, new THREE.SphereGeometry(0.178, 32, 24));
    out.crystal.push({
      geo: clearDome,
      matrix: makeTransform(0, headY + 0.006, 0.006, 0, 0, 0, 1.0, 1.02, 1.04),
      colorRgb: [0.84, 0.96, 1.0],
    });

    const domeRim = trackGeo(out, new THREE.TorusGeometry(0.132, 0.012, 12, 32));
    out.trim.push({
      geo: domeRim,
      matrix: makeTransform(0, collarY + 0.022, 0.01, Math.PI * 0.5, 0, 0),
      colorRgb: trimCol,
    });
    headTopY = headY + 0.21;
  } else {
    const shell = trackGeo(out, new THREE.SphereGeometry(0.152, 26, 20));
    out.armor.push({
      geo: shell,
      matrix: makeTransform(0, headY, 0.008, 0, 0, 0, 0.95, 1.04, 1.08),
      colorRgb: primaryCol,
    });
    const visorBand = trackGeo(out, new THREE.TorusGeometry(0.132, 0.018, 12, 26, Math.PI * 0.72));
    out.energy.push({
      geo: visorBand,
      matrix: makeTransform(0, headY + 0.005, 0.042, Math.PI * 0.5, 0, Math.PI * 0.14),
      colorRgb: eyeCol,
    });
    headTopY = headY + 0.19;
  }

  const backMount = new THREE.Vector3(0, chestY + 0.02, -0.17);
  if (opts.backpack) {
    const packBody = trackGeo(out, createTeardropPart(0.38, 0.135, 1.15, 24, 18, 0.02, secondaryCol, primaryCol));
    out.armor.push({
      geo: packBody,
      matrix: makeTransform(0, chestY + 0.01, -0.185, bodyLeanX, 0, 0, 1.12, 1.0, 0.68),
    });
    for (const side of [-1, 1] as const) {
      const nozzle = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.032, 0.06, 16));
      out.trim.push({
        geo: nozzle,
        matrix: makeTransform(side * 0.085, chestY - 0.15, -0.21, 0.28, 0, side * 0.12),
        colorRgb: trimCol,
      });
      const glow = trackGeo(out, createTeardropPart(0.10, 0.024, 1.5, 14, 10, 0));
      out.energy.push({
        geo: glow,
        matrix: makeTransform(side * 0.09, chestY - 0.21, -0.23, Math.PI + 0.28, 0, side * 0.12),
        colorRgb: eyeCol,
      });
    }
  }

  if (opts.umbilicals) {
    for (const side of [-1, 1] as const) {
      const hose = trackGeo(
        out,
        createTubePart(
          [
            [side * 0.12, chestY + 0.09, -0.17],
            [side * 0.21, chestY + 0.04, -0.06],
            [side * 0.19, waistY + 0.03, 0.08],
            [side * 0.095, waistY + 0.04, 0.145],
          ],
          0.013,
          20,
          10,
          false,
        ),
      );
      out.matte.push({ geo: hose, colorRgb: fabricCol });
    }
  }

  out.headTopLocalY = headTopY;

  return {
    leftHand: new THREE.Vector3(leftArmPts[2]![0], leftArmPts[2]![1], leftArmPts[2]![2] + 0.02),
    rightHand: new THREE.Vector3(rightArmPts[2]![0], rightArmPts[2]![1], rightArmPts[2]![2] + 0.02),
    leftForearm: new THREE.Vector3(
      (leftArmPts[1]![0] + leftArmPts[2]![0]) * 0.5,
      (leftArmPts[1]![1] + leftArmPts[2]![1]) * 0.5,
      (leftArmPts[1]![2] + leftArmPts[2]![2]) * 0.5,
    ),
    rightForearm: new THREE.Vector3(
      (rightArmPts[1]![0] + rightArmPts[2]![0]) * 0.5,
      (rightArmPts[1]![1] + rightArmPts[2]![1]) * 0.5,
      (rightArmPts[1]![2] + rightArmPts[2]![2]) * 0.5,
    ),
    chestCenter: new THREE.Vector3(0, chestY, 0.16),
    headCenter: new THREE.Vector3(0, headY, 0.01),
    backMount,
    headTopY,
  };
}
