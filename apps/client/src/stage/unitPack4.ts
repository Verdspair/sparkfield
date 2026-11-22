import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createCreatureFin,
  createCurvedVisorPart,
  createFacetedCrystalPart,
  createFlowingRibbonMesh,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createPetalPart,
  createSculptedClothLathe,
  createTaperedTubePart,
  createTeardropPart,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type UnitBlueprintParts,
  type Vec3Tuple,
} from './unitBuilderCore.js';

function buildWarpedAccretionRing(
  out: UnitBlueprintParts,
  radius: number,
  widthProfile: readonly [number, number, number],
  warpAmpY: number,
  warpFreqY: number,
  warpPhaseY: number,
  radialWarpAmp: number,
  radialWarpFreq: number,
  segsLength: number,
  segsWidth: number,
  thickness: number,
  colorA: RgbTriple,
  colorB: RgbTriple,
): THREE.BufferGeometry {
  const pts: Vec3Tuple[] = [];
  const sampleCount = 20;
  for (let i = 0; i < sampleCount; i += 1) {
    const theta = (i / sampleCount) * Math.PI * 2;
    const r = radius + Math.sin(theta * radialWarpFreq + warpPhaseY * 0.7) * radialWarpAmp;
    const y =
      Math.sin(theta * warpFreqY + warpPhaseY) * warpAmpY +
      Math.cos(theta * (warpFreqY + 1) - warpPhaseY) * (warpAmpY * 0.34);
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return trackGeo(
    out,
    createFlowingRibbonMesh(pts, widthProfile, 0.012, 3.0, segsLength, segsWidth, thickness, colorA, colorB, true),
  );
}

function buildWarpedFilament(
  out: UnitBlueprintParts,
  radius: number,
  warpAmpY: number,
  warpFreqY: number,
  warpPhaseY: number,
  radialWarpAmp: number,
  radialWarpFreq: number,
  tubeRadius: number,
  tubularSegs: number,
  radialSegs: number,
): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const sampleCount = 20;
  for (let i = 0; i < sampleCount; i += 1) {
    const theta = (i / sampleCount) * Math.PI * 2;
    const r = radius + Math.sin(theta * radialWarpFreq + warpPhaseY * 0.7) * radialWarpAmp;
    const y =
      Math.sin(theta * warpFreqY + warpPhaseY) * warpAmpY +
      Math.cos(theta * (warpFreqY + 1) - warpPhaseY) * (warpAmpY * 0.34);
    pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true);
  return trackGeo(out, new THREE.TubeGeometry(curve, tubularSegs, tubeRadius, radialSegs, true));
}

function createSplitPleatedCoatSkirt(
  profile: readonly (readonly [number, number])[],
  openHemRad: number,
  openWaistRad: number,
  pleatCount: number,
  pleatAmp: number,
  windX: number,
  windZ: number,
  thickness: number,
  rSegs: number,
  colorBot: RgbTriple,
  colorTop: RgbTriple,
  colorInner: RgbTriple,
): THREE.BufferGeometry {
  const vCount = profile.length - 1;
  const cols = rSegs + 1;
  const rows = vCount + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const minY = profile[0]![1];
  const maxY = profile[vCount]![1];
  const spanY = Math.max(0.0001, maxY - minY);

  const evalPoint = (iv: number, ir: number, radOffset: number): readonly [number, number, number, number] => {
    const [baseR, y] = profile[iv]!;
    const hFrac = Math.max(0, Math.min(1, (y - minY) / spanY));
    const drop = 1 - hFrac;
    const dropSq = drop * drop;
    const halfOpen = openWaistRad + (openHemRad - openWaistRad) * Math.pow(drop, 0.72);
    const phiSpan = Math.PI * 2 - halfOpen * 2;
    const uFrac = ir / rSegs;
    const phi = halfOpen + uFrac * phiSpan;
    const edgeDamp = Math.sin(uFrac * Math.PI);
    const pleat =
      (Math.sin(phi * pleatCount) * 0.72 + Math.cos(phi * (pleatCount + 3) + 0.7) * 0.28) *
      pleatAmp *
      dropSq *
      (0.35 + 0.65 * edgeDamp);
    const r = Math.max(0.01, baseR * (1 + pleat) + radOffset);
    const x = Math.sin(phi) * r + windX * dropSq;
    const z = Math.cos(phi) * r + windZ * dropSq;
    return [x, y, z, hFrac];
  };

  for (let side = 0; side < 2; side += 1) {
    const isOuter = side === 0;
    const radOff = isOuter ? thickness * 0.5 : -thickness * 0.5;
    const baseIdx = side * rows * cols;
    for (let iv = 0; iv < rows; iv += 1) {
      for (let ir = 0; ir < cols; ir += 1) {
        const [x, y, z, hFrac] = evalPoint(iv, ir, radOff);
        positions.push(x, y, z);
        uvs.push((ir / rSegs) * 2, hFrac * 2);
        if (isOuter) {
          colors.push(
            colorBot[0] + (colorTop[0] - colorBot[0]) * hFrac,
            colorBot[1] + (colorTop[1] - colorBot[1]) * hFrac,
            colorBot[2] + (colorTop[2] - colorBot[2]) * hFrac,
          );
        } else {
          colors.push(colorInner[0], colorInner[1], colorInner[2]);
        }
      }
    }
    for (let iv = 0; iv < vCount; iv += 1) {
      for (let ir = 0; ir < rSegs; ir += 1) {
        const a = baseIdx + iv * cols + ir;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (isOuter) {
          indices.push(a, b, d, a, d, c);
        } else {
          indices.push(a, d, b, a, c, d);
        }
      }
    }
  }

  const innerBase = rows * cols;
  for (let ir = 0; ir < rSegs; ir += 1) {
    const o0 = ir;
    const o1 = ir + 1;
    const i0 = innerBase + ir;
    const i1 = innerBase + ir + 1;
    indices.push(o0, i0, i1, o0, i1, o1);
  }
  for (let iv = 0; iv < vCount; iv += 1) {
    const oL0 = iv * cols;
    const oL1 = (iv + 1) * cols;
    const iL0 = innerBase + oL0;
    const iL1 = innerBase + oL1;
    indices.push(oL0, oL1, iL1, oL0, iL1, iL0);

    const oR0 = iv * cols + rSegs;
    const oR1 = (iv + 1) * cols + rSegs;
    const iR0 = innerBase + oR0;
    const iR1 = innerBase + oR1;
    indices.push(oR0, iR1, oR1, oR0, iR0, iR1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildS29RelativisticCruiser(out: UnitBlueprintParts): void {
  const mirrorSilver: RgbTriple = [0.92, 0.96, 1.0];
  const deepSilver: RgbTriple = [0.68, 0.78, 0.90];
  const pearlWhite: RgbTriple = [0.94, 0.97, 1.0];
  const carbonNavy: RgbTriple = [0.14, 0.20, 0.30];
  const trimGold: RgbTriple = [0.94, 0.84, 0.56];
  const blueshiftWhite: RgbTriple = [0.88, 0.98, 1.0];
  const cherenkovCyan: RgbTriple = [0.28, 0.88, 1.0];
  const cherenkovViolet: RgbTriple = [0.18, 0.44, 1.0];

  const craft = makeTransform(0.02, 0.96, 0.04, -0.14, -0.44, 0.12);

  const needleHull = trackGeo(
    out,
    createTeardropPart(1.38, 0.114, 2.35, 18, 14, 0.008, deepSilver, mirrorSilver),
  );
  out.trim.push({
    geo: needleHull,
    matrix: craft.clone().multiply(makeTransform(0, 0, 0.06, Math.PI * 0.5, 0, 0, 1.04, 1.0, 0.78)),
  });

  const dorsalCowling = trackGeo(
    out,
    createTeardropPart(0.96, 0.084, 1.75, 14, 10, 0.012, pearlWhite, mirrorSilver),
  );
  out.armor.push(
    {
      geo: dorsalCowling,
      matrix: craft.clone().multiply(makeTransform(0, 0.042, -0.04, Math.PI * 0.5, 0, 0, 0.88, 1.0, 0.56)),
    },
    {
      geo: dorsalCowling,
      matrix: craft.clone().multiply(makeTransform(0, -0.040, -0.06, Math.PI * 0.5, 0, Math.PI, 0.82, 0.92, 0.50)),
      colorRgb: deepSilver,
    },
  );

  const keelSpine = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.082, 0.38],
        [0, 0.106, 0.02],
        [0, 0.068, -0.40],
      ],
      0.014,
      0.022,
      0.012,
      10,
      8,
      carbonNavy,
      carbonNavy,
    ),
  );
  out.matte.push({ geo: keelSpine, matrix: craft });

  const bulkheadRing = trackGeo(out, new THREE.TorusGeometry(0.112, 0.009, 6, 18));
  out.matte.push(
    { geo: bulkheadRing, matrix: craft.clone().multiply(makeTransform(0, 0, -0.10, 0, 0, 0, 1.05, 0.82, 1.0)), colorRgb: carbonNavy },
    { geo: bulkheadRing, matrix: craft.clone().multiply(makeTransform(0, 0, -0.32, 0, 0, 0, 0.92, 0.74, 1.0)), colorRgb: carbonNavy },
  );
  const goldCollar = trackGeo(out, new THREE.TorusGeometry(0.104, 0.008, 6, 18));
  out.trim.push({
    geo: goldCollar,
    matrix: craft.clone().multiply(makeTransform(0, 0, 0.16, 0, 0, 0, 0.96, 0.78, 1.0)),
    colorRgb: trimGold,
  });

  const bowSpear = trackGeo(
    out,
    createTeardropPart(0.30, 0.026, 2.4, 12, 10, 0, cherenkovCyan, blueshiftWhite),
  );
  out.energy.push({
    geo: bowSpear,
    matrix: craft.clone().multiply(makeTransform(0, 0, 0.77, Math.PI * 0.5, 0, 0)),
  });

  const shockSpecs: readonly { readonly z: number; readonly r0: number; readonly r1: number; readonly len: number }[] = [
    { z: 0.71, r0: 0.014, r1: 0.192, len: 0.25 },
    { z: 0.56, r0: 0.072, r1: 0.298, len: 0.32 },
    { z: 0.39, r0: 0.118, r1: 0.402, len: 0.38 },
  ];
  for (let i = 0; i < shockSpecs.length; i += 1) {
    const sp = shockSpecs[i]!;
    const coneProfile: readonly (readonly [number, number])[] = [
      [sp.r1, -sp.len],
      [sp.r0 + (sp.r1 - sp.r0) * 0.68, -sp.len * 0.58],
      [sp.r0 + (sp.r1 - sp.r0) * 0.28, -sp.len * 0.20],
      [sp.r0, 0.0],
    ];
    const coneGeo = trackGeo(out, createLathePart(coneProfile, 22));
    out.crystal.push({
      geo: coneGeo,
      matrix: craft.clone().multiply(makeTransform(0, 0, sp.z, Math.PI * 0.5, 0, 0)),
      colorRgb: i === 0 ? blueshiftWhite : i === 1 ? cherenkovCyan : cherenkovViolet,
    });

    const machRing = trackGeo(out, new THREE.TorusGeometry(sp.r1 * 0.985, 0.0068 - i * 0.001, 5, 22));
    out.energy.push({
      geo: machRing,
      matrix: craft.clone().multiply(makeTransform(0, 0, sp.z - sp.len)),
      colorRgb: i === 0 ? blueshiftWhite : cherenkovCyan,
    });
  }

  const cannonOffsets: readonly (readonly [number, number])[] = [
    [-0.120, 0.054],
    [0.120, 0.054],
    [-0.120, -0.054],
    [0.120, -0.054],
  ];
  const barrelGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.017, 0.50, 8));
  const railStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.0045, 0.006, 0.46, 5));
  const barrelRing = trackGeo(out, new THREE.TorusGeometry(0.018, 0.0045, 5, 10));
  for (const [cx, cy] of cannonOffsets) {
    out.matte.push({
      geo: barrelGeo,
      matrix: craft.clone().multiply(makeTransform(cx, cy, 0.12, Math.PI * 0.5, 0, 0)),
      colorRgb: carbonNavy,
    });
    out.energy.push({
      geo: railStripGeo,
      matrix: craft.clone().multiply(makeTransform(cx * 1.12, cy * 1.12, 0.14, Math.PI * 0.5, 0, 0)),
      colorRgb: cherenkovCyan,
    });
    out.trim.push(
      { geo: barrelRing, matrix: craft.clone().multiply(makeTransform(cx, cy, 0.30)), colorRgb: mirrorSilver },
      { geo: barrelRing, matrix: craft.clone().multiply(makeTransform(cx, cy, 0.14)), colorRgb: trimGold },
    );
    const pylon = trackGeo(
      out,
      createOrganicLimb(
        [
          [cx * 0.45, cy * 0.45, 0.04],
          [cx * 0.96, cy * 0.96, 0.08],
        ],
        0.013,
        0.011,
        0.009,
        4,
        6,
        pearlWhite,
        carbonNavy,
      ),
    );
    out.armor.push({ geo: pylon, matrix: craft });
  }

  const mainWing = trackGeo(out, createCreatureFin(0.28, 0.66, 0.48, 0.044, 0.018, 8, 4, pearlWhite, deepSilver));
  const wingEdgeCrystal = trackGeo(out, createCreatureFin(0.18, 0.70, 0.52, 0.048, 0.006, 8, 4, cherenkovCyan, cherenkovViolet));
  const dorsalFin = trackGeo(out, createCreatureFin(0.22, 0.28, 0.24, 0.018, 0.012, 6, 4, mirrorSilver, deepSilver));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: mainWing,
      matrix: craft.clone().multiply(makeTransform(side * 0.080, 0.0, -0.06, 0, 0, side * 0.08, side, 1, 1)),
    });
    out.crystal.push({
      geo: wingEdgeCrystal,
      matrix: craft.clone().multiply(makeTransform(side * 0.088, -0.004, -0.14, 0, 0, side * 0.08, side, 1, 1)),
    });
    const wingTrim = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.09, 0.0, 0.02],
          [side * 0.40, 0.042, -0.18],
          [side * 0.72, 0.032, -0.50],
        ],
        0.011,
        0.008,
        0.004,
        8,
        6,
      ),
    );
    out.trim.push({ geo: wingTrim, matrix: craft, colorRgb: mirrorSilver });
    out.armor.push({
      geo: dorsalFin,
      matrix: craft.clone().multiply(makeTransform(side * 0.034, 0.040, -0.38, 0, 0, side * 1.08, side, 1, 1)),
    });
  }

  const nozzleProfile: readonly (readonly [number, number])[] = [
    [0.080, 0.0],
    [0.062, -0.05],
    [0.076, -0.11],
    [0.090, -0.16],
  ];
  const nozzleGeo = trackGeo(out, createLathePart(nozzleProfile, 16));
  out.matte.push({
    geo: nozzleGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0, -0.50, Math.PI * 0.5, 0, 0)),
    colorRgb: carbonNavy,
  });

  const thrustNeedle = trackGeo(
    out,
    createTeardropPart(0.56, 0.056, 2.0, 12, 10, 0, blueshiftWhite, cherenkovCyan),
  );
  out.energy.push({
    geo: thrustNeedle,
    matrix: craft.clone().multiply(makeTransform(0, 0, -0.78, -Math.PI * 0.5, 0, 0)),
  });

  for (let s = 0; s < 3; s += 1) {
    const phase = (s / 3) * Math.PI * 2;
    const pts: Vec3Tuple[] = [];
    for (let k = 0; k <= 7; k += 1) {
      const f = k / 7;
      const r = 0.050 * (1 - f * 0.55) + Math.sin(f * Math.PI) * 0.026;
      const a = phase + f * Math.PI * 1.85;
      pts.push([Math.cos(a) * r, Math.sin(a) * r, -0.60 - f * 0.56]);
    }
    const streamRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(pts, [0.042, 0.026, 0.005], 0.008, 2.0, 14, 2, 0, blueshiftWhite, cherenkovViolet),
    );
    out.crystal.push({ geo: streamRibbon, matrix: craft });
  }

  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: mainWing,
      matrix: craft.clone().multiply(makeTransform(side * 0.14, 0.08, -0.14, 0, 0, side * 0.42, side * 1.15, 1.15, 1.15)),
      colorRgb: trimGold,
    });
  }

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.44;
  out.crystalIntensity = 0.72;
  out.weaponGlowHex = 0x67e8f9;
  out.headTopLocalY = 1.56;
}

function buildS30WhiteDwarfBeacon(out: UnitBlueprintParts): void {
  const starWhite: RgbTriple = [0.92, 0.98, 1.0];
  const starCyan: RgbTriple = [0.52, 0.86, 1.0];
  const dwarfViolet: RgbTriple = [0.58, 0.66, 1.0];
  const ceramicWhite: RgbTriple = [0.92, 0.95, 1.0];
  const armillaryGold: RgbTriple = [0.98, 0.82, 0.40];
  const deepGold: RgbTriple = [0.86, 0.64, 0.24];
  const carbonSlate: RgbTriple = [0.16, 0.20, 0.29];

  const centerY = 1.04;
  const centerMat = makeTransform(0, centerY, 0);

  const coreSphere = trackGeo(out, new THREE.SphereGeometry(0.148, 16, 12));
  out.energy.push({ geo: coreSphere, matrix: centerMat, colorRgb: starWhite });

  const diamondShell = trackGeo(out, createFacetedCrystalPart(0.35, 0.175, 8, 0.5, 0.5, starCyan, starWhite));
  out.crystal.push({
    geo: diamondShell,
    matrix: makeTransform(0, centerY, 0, 0.22, 0.4, 0.18),
  });

  const degeneracyHalo = trackGeo(out, new THREE.SphereGeometry(0.228, 16, 12));
  out.crystal.push({
    geo: degeneracyHalo,
    matrix: centerMat,
    colorRgb: dwarfViolet,
  });

  const einsteinRing = trackGeo(out, new THREE.TorusGeometry(0.268, 0.0085, 6, 24));
  out.energy.push({
    geo: einsteinRing,
    matrix: makeTransform(0, centerY, 0, 0.12, 0.24, 0),
    colorRgb: starCyan,
  });

  const ringA = trackGeo(out, new THREE.TorusGeometry(0.335, 0.015, 6, 24));
  const ringAMat = makeTransform(0, centerY, 0, 0.92, 0.36, -0.44);
  out.trim.push({ geo: ringA, matrix: ringAMat, colorRgb: armillaryGold });

  const vernierTick = trackGeo(out, createFacetedCrystalPart(0.062, 0.012, 4, 0.65, 0.35, deepGold, armillaryGold));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const vx = Math.cos(a) * 0.305;
    const vy = Math.sin(a) * 0.305;
    out.trim.push({
      geo: vernierTick,
      matrix: ringAMat.clone().multiply(makeTransform(vx, vy, 0, 0, 0, a + Math.PI * 0.5)),
    });
  }

  const ringBMat = makeTransform(0, centerY, 0, -0.46, 0.58, 0.54);
  const ringBMain = trackGeo(out, new THREE.TorusGeometry(0.465, 0.018, 6, 26));
  const ringBRail = trackGeo(out, new THREE.TorusGeometry(0.492, 0.008, 5, 24));
  out.armor.push({ geo: ringBMain, matrix: ringBMat, colorRgb: ceramicWhite });
  out.trim.push(
    { geo: ringBRail, matrix: ringBMat.clone().multiply(makeTransform(0, 0, 0.014)), colorRgb: armillaryGold },
    { geo: ringBRail, matrix: ringBMat.clone().multiply(makeTransform(0, 0, -0.014)), colorRgb: armillaryGold },
  );

  const hexMirror = trackGeo(out, createHexMirrorTilePart(0.068, 0.016, 0.007, 0.008, armillaryGold, deepGold));
  const hexBack = trackGeo(out, createHexMirrorTilePart(0.062, 0.012, 0.005, 0));
  const zAxis = new THREE.Vector3(0, 0, 1);
  const qMirror = new THREE.Quaternion();
  const dirMirror = new THREE.Vector3();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const mx = Math.cos(a) * 0.465;
    const my = Math.sin(a) * 0.465;
    dirMirror.set(-mx, -my, 0).normalize();
    qMirror.setFromUnitVectors(zAxis, dirMirror);
    const mLocal = new THREE.Matrix4().compose(new THREE.Vector3(mx, my, 0), qMirror, new THREE.Vector3(1, 1, 1));
    const mWorld = ringBMat.clone().multiply(mLocal);
    out.trim.push({ geo: hexMirror, matrix: mWorld });
    out.matte.push({
      geo: hexBack,
      matrix: mWorld.clone().multiply(makeTransform(0, 0, -0.016)),
      colorRgb: carbonSlate,
    });
  }

  const ringCMat = makeTransform(0, centerY, 0, 1.32, -0.18, 0.14);
  const ringCOuter = trackGeo(out, new THREE.TorusGeometry(0.595, 0.020, 6, 28));
  const ringCInner = trackGeo(out, new THREE.TorusGeometry(0.548, 0.010, 5, 24));
  out.trim.push(
    { geo: ringCOuter, matrix: ringCMat, colorRgb: armillaryGold },
    { geo: ringCInner, matrix: ringCMat, colorRgb: deepGold },
  );

  const podHousing = trackGeo(out, createTeardropPart(0.155, 0.044, 1.35, 12, 10, 0, ceramicWhite, armillaryGold));
  const podLamp = trackGeo(out, new THREE.SphereGeometry(0.022, 8, 6));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const px = Math.cos(a) * 0.595;
    const py = Math.sin(a) * 0.595;
    const pMat = ringCMat.clone().multiply(makeTransform(px, py, 0, 0, 0, a - Math.PI * 0.5));
    out.armor.push({ geo: podHousing, matrix: pMat });
    out.energy.push({ geo: podLamp, matrix: pMat.clone().multiply(makeTransform(0, -0.068, 0)), colorRgb: starCyan });

    const truss = trackGeo(
      out,
      createOrganicLimb(
        [
          [Math.cos(a) * 0.548, Math.sin(a) * 0.548, 0],
          [Math.cos(a) * 0.595, Math.sin(a) * 0.595, 0],
        ],
        0.010,
        0.010,
        0.010,
        3,
        6,
      ),
    );
    out.matte.push({ geo: truss, matrix: ringCMat, colorRgb: carbonSlate });
  }

  const axisTilt = makeTransform(0, centerY, 0, 0.16, 0.12, -0.18);
  const spireProfile: readonly (readonly [number, number])[] = [
    [0.062, 0.34],
    [0.044, 0.46],
    [0.022, 0.62],
    [0.004, 0.74],
  ];
  const spireGeo = trackGeo(out, createLathePart(spireProfile, 14));
  const focusConeProfile: readonly (readonly [number, number])[] = [
    [0.145, 0.24],
    [0.068, 0.44],
    [0.016, 0.68],
  ];
  const focusCone = trackGeo(out, createLathePart(focusConeProfile, 16));
  const collarFocus = trackGeo(out, new THREE.TorusGeometry(0.088, 0.010, 5, 16));
  collarFocus.rotateX(Math.PI * 0.5);
  const focalBead = trackGeo(out, new THREE.SphereGeometry(0.028, 10, 8));

  for (const dir of [1, -1] as const) {
    const sMat = axisTilt.clone().multiply(makeTransform(0, 0, 0, dir === 1 ? 0 : Math.PI, 0, 0));
    out.armor.push({ geo: spireGeo, matrix: sMat, colorRgb: ceramicWhite });
    out.crystal.push({ geo: focusCone, matrix: sMat, colorRgb: starCyan });
    out.trim.push({ geo: collarFocus, matrix: sMat.clone().multiply(makeTransform(0, 0.42, 0)), colorRgb: armillaryGold });
    out.energy.push({ geo: focalBead, matrix: sMat.clone().multiply(makeTransform(0, 0.74, 0)), colorRgb: starWhite });

    for (let k = 0; k < 3; k += 1) {
      const a = (k / 3) * Math.PI * 2;
      const strut = trackGeo(
        out,
        createOrganicLimb(
          [
            [Math.cos(a) * 0.088, 0.42, Math.sin(a) * 0.088],
            [Math.cos(a) * 0.028, 0.66, Math.sin(a) * 0.028],
          ],
          0.006,
          0.005,
          0.004,
          4,
          6,
        ),
      );
      out.matte.push({ geo: strut, matrix: sMat, colorRgb: carbonSlate });
    }
  }

  const baseGyro = trackGeo(out, new THREE.TorusGeometry(0.24, 0.014, 6, 22));
  baseGyro.rotateX(Math.PI * 0.5);
  out.matte.push({ geo: baseGyro, matrix: makeTransform(0, 0.22, 0), colorRgb: carbonSlate });
  const baseGyroGold = trackGeo(out, new THREE.TorusGeometry(0.262, 0.007, 5, 22));
  baseGyroGold.rotateX(Math.PI * 0.5);
  out.trim.push({ geo: baseGyroGold, matrix: makeTransform(0, 0.22, 0), colorRgb: armillaryGold });

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.68, 0.012, 5, 24));
  out.wingParts.push(
    { geo: wingRing, matrix: makeTransform(0, centerY, 0, 0.42, 0.68, 0), colorRgb: armillaryGold },
    { geo: wingRing, matrix: makeTransform(0, centerY, 0, -0.42, -0.68, 0), colorRgb: armillaryGold },
  );

  out.crystalHex = 0x7dd3fc;
  out.crystalOpacity = 0.36;
  out.crystalIntensity = 0.68;
  out.weaponGlowHex = 0xbae6fd;
  out.headTopLocalY = 1.82;
}

function buildS31UnuploadedHuman(out: UnitBlueprintParts): void {
  const iceWhite: RgbTriple = [0.94, 0.97, 1.0];
  const glacierBlue: RgbTriple = [0.76, 0.89, 0.96];
  const coatShadow: RgbTriple = [0.64, 0.78, 0.88];
  const deepSlate: RgbTriple = [0.19, 0.26, 0.36];
  const warmGold: RgbTriple = [0.96, 0.82, 0.44];
  const skinWarm: RgbTriple = [0.95, 0.85, 0.78];
  const skinShadow: RgbTriple = [0.80, 0.68, 0.61];
  const silverHair: RgbTriple = [0.90, 0.93, 0.98];
  const soilUmber: RgbTriple = [0.34, 0.22, 0.13];
  const soilDark: RgbTriple = [0.22, 0.14, 0.08];
  const sproutGreen: RgbTriple = [0.30, 0.94, 0.44];
  const sproutTip: RgbTriple = [0.78, 1.0, 0.68];
  const glassTint: RgbTriple = [0.86, 0.96, 1.0];
  const dialIvory: RgbTriple = [0.98, 0.96, 0.90];

  const torsoYaw = 0.09;
  const headYaw = -0.10;
  const rotT = (x: number, y: number, z: number): THREE.Vector3 => {
    const c = Math.cos(torsoYaw);
    const sn = Math.sin(torsoYaw);
    return new THREE.Vector3(x * c + z * sn, y, -x * sn + z * c);
  };

  const innerTunic = trackGeo(
    out,
    createLathePart(
      [
        [0.012, 0.0],
        [0.096, 0.06],
        [0.090, 0.18],
        [0.118, 0.36],
        [0.126, 0.45],
        [0.068, 0.56],
      ],
      12,
    ),
  );
  out.matte.push({
    geo: innerTunic,
    matrix: makeTransform(0, 0.74, 0, 0.02, torsoYaw, 0, 1.0, 1.0, 0.76),
    colorRgb: deepSlate,
  });

  const coatBodice = trackGeo(
    out,
    createSculptedClothLathe(
      [
        [0.102, 0.0],
        [0.098, 0.10],
        [0.136, 0.28],
        [0.142, 0.38],
        [0.088, 0.46],
        [0.068, 0.50],
      ],
      14,
      4,
      0.04,
      0.32,
      glacierBlue,
      iceWhite,
    ),
  );
  out.armor.push({
    geo: coatBodice,
    matrix: makeTransform(0, 0.84, -0.004, 0.02, torsoYaw, 0, 1.0, 1.0, 0.80),
  });

  const lapelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.095],
        [0.052, -0.032],
        [0.070, 0.065],
        [0.024, 0.098],
      ],
      0.014,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  const claspStud = trackGeo(out, new THREE.SphereGeometry(0.009, 5, 4));
  for (const side of [-1, 1] as const) {
    const lp = rotT(side * 0.018, 1.15, 0.098);
    out.armor.push({
      geo: lapelGeo,
      matrix: makeTransform(lp.x, lp.y, lp.z, -0.06, torsoYaw + side * 0.16, side * 0.05, side, 1, 1),
      colorRgb: iceWhite,
    });
    const cp = rotT(side * 0.042, 1.24, 0.092);
    out.trim.push({ geo: claspStud, matrix: makeTransform(cp.x, cp.y, cp.z), colorRgb: warmGold });
  }

  const splitExpeditionSkirt = trackGeo(
    out,
    createSplitPleatedCoatSkirt(
      [
        [0.218, 0.0],
        [0.190, 0.16],
        [0.152, 0.34],
        [0.116, 0.50],
        [0.104, 0.59],
      ],
      0.50,
      0.14,
      8,
      0.105,
      -0.018,
      -0.042,
      0.013,
      22,
      glacierBlue,
      iceWhite,
      coatShadow,
    ),
  );
  out.armor.push({
    geo: splitExpeditionSkirt,
    matrix: makeTransform(0, 0.31, -0.004, 0.02, torsoYaw, 0, 1.0, 1.0, 0.84),
  });

  for (const side of [-1, 1] as const) {
    const seamLine = trackGeo(
      out,
      createTaperedTubePart(
        [
          rotT(side * 0.024, 0.89, 0.084),
          rotT(side * 0.072, 0.62, 0.108),
          rotT(side * 0.108, 0.32, 0.104),
        ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.0048,
        0.0042,
        7,
        4,
      ),
    );
    out.trim.push({ geo: seamLine, colorRgb: warmGold });
  }

  const waistBelt = trackGeo(out, new THREE.TorusGeometry(0.106, 0.012, 4, 14));
  waistBelt.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: waistBelt,
    matrix: makeTransform(0, 0.90, 0.004, 0, torsoYaw, 0, 1.0, 1.0, 0.84),
    colorRgb: deepSlate,
  });
  const waistGold = trackGeo(out, new THREE.TorusGeometry(0.108, 0.0055, 3, 14));
  waistGold.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: waistGold,
    matrix: makeTransform(0, 0.908, 0.004, 0, torsoYaw, 0, 1.0, 1.0, 0.84),
    colorRgb: warmGold,
  });
  const sashTailPts: Vec3Tuple[] = [
    rotT(-0.074, 0.89, 0.088),
    rotT(-0.095, 0.76, 0.118),
    rotT(-0.112, 0.62, 0.125),
  ].map((v) => [v.x, v.y, v.z]);
  const sashTail = trackGeo(out, createFlowingRibbonMesh(sashTailPts, [0.024, 0.026, 0.018], 0.008, 1.4, 7, 2, 0.005, warmGold, glacierBlue));
  out.trim.push({ geo: sashTail });

  const collarRing = trackGeo(out, new THREE.TorusGeometry(0.108, 0.013, 4, 14));
  collarRing.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: collarRing,
    matrix: makeTransform(0, 1.31, 0.006, 0.08, torsoYaw, 0),
    colorRgb: iceWhite,
  });
  const collarGold = trackGeo(out, new THREE.TorusGeometry(0.116, 0.006, 4, 14));
  collarGold.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: collarGold,
    matrix: makeTransform(0, 1.32, 0.006, 0.08, torsoYaw, 0),
    colorRgb: warmGold,
  });

  const backPos = rotT(0, 1.10, -0.14);
  const backPod = trackGeo(out, createTeardropPart(0.30, 0.078, 1.15, 10, 8, 0, glacierBlue, iceWhite));
  out.armor.push({
    geo: backPod,
    matrix: makeTransform(backPos.x, backPos.y, backPos.z, 0.06, torsoYaw, 0, 1.10, 1.0, 0.60),
  });
  const backVent = trackGeo(out, new THREE.TorusGeometry(0.040, 0.006, 4, 10));
  const bvPos = rotT(0, 1.12, -0.188);
  out.matte.push({
    geo: backVent,
    matrix: makeTransform(bvPos.x, bvPos.y, bvPos.z, 0.06, torsoYaw, 0),
    colorRgb: deepSlate,
  });

  const legSpecs: readonly { readonly pts: readonly Vec3Tuple[]; readonly footYaw: number }[] = [
    {
      pts: [
        [-0.068, 0.74, 0.006],
        [-0.082, 0.41, 0.064],
        [-0.086, 0.082, 0.056],
      ],
      footYaw: 0.14,
    },
    {
      pts: [
        [0.068, 0.74, -0.010],
        [0.078, 0.40, -0.024],
        [0.086, 0.082, -0.054],
      ],
      footYaw: -0.18,
    },
  ];
  const bootGeo = trackGeo(out, createTeardropPart(0.172, 0.040, 1.18, 10, 8, 0, iceWhite, glacierBlue));
  const ankleRing = trackGeo(out, new THREE.TorusGeometry(0.038, 0.0055, 3, 10));
  ankleRing.rotateX(Math.PI * 0.5);
  const kneeSeam = trackGeo(out, new THREE.TorusGeometry(0.044, 0.005, 3, 9));
  kneeSeam.rotateX(Math.PI * 0.5);

  for (const lg of legSpecs) {
    const legGeo = trackGeo(out, createOrganicLimb(lg.pts, 0.052, 0.042, 0.034, 7, 7, deepSlate, deepSlate));
    out.matte.push({ geo: legGeo });
    const k = lg.pts[1]!;
    const a = lg.pts[2]!;
    const greaveGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [k[0], k[1] - 0.01, k[2] + 0.006],
          [(k[0] + a[0]) * 0.5, (k[1] + a[1]) * 0.5, (k[2] + a[2]) * 0.5 + 0.008],
          [a[0], a[1] + 0.01, a[2] + 0.006],
        ],
        0.044,
        0.040,
        0.035,
        5,
        7,
        iceWhite,
        glacierBlue,
      ),
    );
    out.armor.push({ geo: greaveGeo });
    out.trim.push({ geo: kneeSeam, matrix: makeTransform(k[0], k[1], k[2], 0, lg.footYaw, 0), colorRgb: warmGold });
    out.armor.push({
      geo: bootGeo,
      matrix: makeTransform(a[0], 0.042, a[2] + 0.042, Math.PI * 0.5, lg.footYaw, 0, 0.88, 1.0, 0.70),
    });
    out.trim.push({
      geo: ankleRing,
      matrix: makeTransform(a[0], 0.088, a[2], 0, lg.footYaw, 0),
      colorRgb: warmGold,
    });
  }

  for (const side of [-1, 1] as const) {
    const sh = rotT(side * 0.132, 1.24, 0.0);
    const el = rotT(side * 0.198, 1.04, 0.13);
    const ha = rotT(side * 0.145, 0.93, 0.305);
    const armGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [sh.x, sh.y, sh.z],
          [el.x, el.y, el.z],
          [ha.x, ha.y, ha.z],
        ],
        0.043,
        0.035,
        0.028,
        7,
        7,
        iceWhite,
        glacierBlue,
      ),
    );
    out.armor.push({ geo: armGeo });

    const shoulderEp = trackGeo(out, createCurvedVisorPart(0.056, 0.050, 0.054, 2.0, 0.4, 1.1, 7, 4));
    out.armor.push({
      geo: shoulderEp,
      matrix: makeTransform(sh.x + side * 0.006, sh.y + 0.010, sh.z, 0.05, torsoYaw + side * -Math.PI * 0.45, side * -0.18),
      colorRgb: iceWhite,
    });

    const cuffRing = trackGeo(out, new THREE.TorusGeometry(0.031, 0.005, 3, 10));
    out.trim.push({
      geo: cuffRing,
      matrix: makeTransform(ha.x, ha.y, ha.z, 0.25, torsoYaw + side * -0.42, 0),
      colorRgb: warmGold,
    });

    const glove = trackGeo(out, new THREE.SphereGeometry(0.029, 7, 5));
    out.matte.push({
      geo: glove,
      matrix: makeTransform(ha.x - side * 0.006, ha.y - 0.004, ha.z + 0.026, 0, torsoYaw, 0, 0.92, 0.82, 1.15),
      colorRgb: deepSlate,
    });
  }

  const headMat = makeTransform(0, 1.468, 0.012, 0.08, torsoYaw + headYaw, 0);
  const neckGeo = trackGeo(out, new THREE.CylinderGeometry(0.033, 0.038, 0.095, 8));
  out.armor.push({
    geo: neckGeo,
    matrix: makeTransform(0, 1.35, 0.008),
    colorRgb: skinWarm,
  });

  const headCranium = trackGeo(out, new THREE.SphereGeometry(0.084, 12, 9));
  out.armor.push({
    geo: headCranium,
    matrix: headMat.clone().multiply(makeTransform(0, 0.004, -0.004, 0, 0, 0, 0.88, 1.08, 0.95)),
    colorRgb: skinWarm,
  });

  const noseRidge = trackGeo(out, createTeardropPart(0.034, 0.009, 1.4, 6, 4, 0, skinWarm, skinWarm));
  out.armor.push({
    geo: noseRidge,
    matrix: headMat.clone().multiply(makeTransform(0, -0.004, 0.076, -0.22, 0, 0)),
  });

  const browVisorArc = trackGeo(out, createCurvedVisorPart(0.080, 0.026, 0.086, 1.54, 1.24, 0.22, 10, 3));
  out.crystal.push({
    geo: browVisorArc,
    matrix: headMat.clone().multiply(makeTransform(0, 0.008, 0.006)),
    colorRgb: glassTint,
  });
  const bioReaderLine = trackGeo(out, new THREE.TorusGeometry(0.082, 0.0028, 3, 14, Math.PI * 0.72));
  out.energy.push({
    geo: bioReaderLine,
    matrix: headMat.clone().multiply(makeTransform(0, 0.010, 0.008, Math.PI * 0.5, 0, -Math.PI * 0.36)),
    colorRgb: sproutTip,
  });

  const jawContour = trackGeo(out, new THREE.SphereGeometry(0.056, 9, 6));
  out.armor.push({
    geo: jawContour,
    matrix: headMat.clone().multiply(makeTransform(0, -0.044, 0.012, 0, 0, 0, 0.86, 0.85, 0.96)),
    colorRgb: skinShadow,
  });

  const hairCrown = trackGeo(
    out,
    new THREE.SphereGeometry(0.094, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.60),
  );
  out.armor.push({
    geo: hairCrown,
    matrix: headMat.clone().multiply(makeTransform(0, 0.012, -0.012, -0.34, 0, 0, 0.96, 1.02, 1.04)),
    colorRgb: silverHair,
  });

  for (const side of [-1, 1] as const) {
    const hairWave = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [side * 0.026, 0.082, 0.044],
          [side * 0.076, 0.042, 0.040],
          [side * 0.084, -0.015, 0.008],
          [side * 0.052, -0.036, -0.068],
        ],
        [0.024, 0.034, 0.026],
        0.005,
        1.2,
        8,
        3,
        0.008,
        silverHair,
        glacierBlue,
      ),
    );
    out.armor.push({ geo: hairWave, matrix: headMat });
  }

  const chignonCore = trackGeo(out, new THREE.SphereGeometry(0.048, 9, 7));
  const chignonCoil = trackGeo(out, new THREE.TorusGeometry(0.046, 0.012, 4, 12));
  const hairpinShaft = trackGeo(out, new THREE.CylinderGeometry(0.0032, 0.0022, 0.155, 5));
  const hairpinBud = trackGeo(out, new THREE.OctahedronGeometry(0.011, 0));
  out.armor.push(
    { geo: chignonCore, matrix: headMat.clone().multiply(makeTransform(0, -0.002, -0.098, 0, 0, 0, 1.08, 0.92, 0.88)), colorRgb: silverHair },
    { geo: chignonCoil, matrix: headMat.clone().multiply(makeTransform(0, -0.002, -0.096, 0.35, 0.2, 0)), colorRgb: silverHair },
  );
  out.trim.push(
    { geo: hairpinShaft, matrix: headMat.clone().multiply(makeTransform(0.008, 0.006, -0.104, 0.15, 0, 1.18)), colorRgb: warmGold },
    { geo: hairpinBud, matrix: headMat.clone().multiply(makeTransform(0.078, 0.036, -0.098)), colorRgb: warmGold },
  );

  const helmetGlass = trackGeo(out, new THREE.SphereGeometry(0.152, 16, 12));
  out.crystal.push({
    geo: helmetGlass,
    matrix: headMat.clone().multiply(makeTransform(0, 0.012, 0, 0, 0, 0, 0.98, 1.04, 1.0)),
    colorRgb: glassTint,
  });

  const helmetSpine = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, -0.135, -0.105],
        [0, 0.028, -0.146],
        [0, 0.156, -0.040],
        [0, 0.150, 0.040],
      ],
      0.013,
      0.011,
      0.008,
      6,
      5,
      iceWhite,
      iceWhite,
    ),
  );
  out.armor.push({ geo: helmetSpine, matrix: headMat });

  const helmetSideArch = trackGeo(
    out,
    createOrganicLimb(
      [
        [-0.144, -0.010, -0.004],
        [-0.120, 0.118, -0.022],
        [0, 0.158, -0.028],
        [0.120, 0.118, -0.022],
        [0.144, -0.010, -0.004],
      ],
      0.006,
      0.0055,
      0.006,
      8,
      4,
    ),
  );
  out.trim.push({ geo: helmetSideArch, matrix: headMat, colorRgb: warmGold });

  const podPos = rotT(0, 0.94, 0.358);
  const podMat = makeTransform(podPos.x, podPos.y, podPos.z, 0, torsoYaw, 0);
  const podBaseProfile: readonly (readonly [number, number])[] = [
    [0.004, -0.165],
    [0.096, -0.158],
    [0.142, -0.130],
    [0.148, -0.095],
    [0.132, -0.082],
  ];
  const podBaseGeo = trackGeo(out, createLathePart(podBaseProfile, 14));
  const podCapProfile: readonly (readonly [number, number])[] = [
    [0.132, 0.165],
    [0.144, 0.182],
    [0.112, 0.214],
    [0.048, 0.236],
    [0.004, 0.246],
  ];
  const podCapGeo = trackGeo(out, createLathePart(podCapProfile, 14));
  out.armor.push(
    { geo: podBaseGeo, matrix: podMat, colorRgb: glacierBlue },
    { geo: podCapGeo, matrix: podMat, colorRgb: iceWhite },
  );

  const glassShellProfile: readonly (readonly [number, number])[] = [
    [0.136, -0.088],
    [0.158, -0.015],
    [0.162, 0.062],
    [0.150, 0.132],
    [0.134, 0.172],
  ];
  const podGlassGeo = trackGeo(out, createLathePart(glassShellProfile, 16));
  out.crystal.push({
    geo: podGlassGeo,
    matrix: podMat,
    colorRgb: glassTint,
  });

  const thermoRing = trackGeo(out, new THREE.TorusGeometry(0.148, 0.0085, 4, 16));
  thermoRing.rotateX(Math.PI * 0.5);
  out.trim.push(
    { geo: thermoRing, matrix: podMat.clone().multiply(makeTransform(0, -0.094, 0)), colorRgb: warmGold },
    { geo: thermoRing, matrix: podMat.clone().multiply(makeTransform(0, 0.174, 0)), colorRgb: warmGold },
  );

  const dialBezel = trackGeo(out, new THREE.TorusGeometry(0.022, 0.0045, 3, 10));
  const dialFace = trackGeo(out, new THREE.CylinderGeometry(0.019, 0.019, 0.006, 8));
  dialFace.rotateX(Math.PI * 0.5);
  const dialNeedle = trackGeo(out, new THREE.CylinderGeometry(0.0018, 0.0022, 0.015, 4));
  for (const dx of [-0.042, 0.042]) {
    const dm = podMat.clone().multiply(makeTransform(dx, -0.118, 0.144, 0.18, dx * 3.0, 0));
    out.trim.push({ geo: dialBezel, matrix: dm, colorRgb: warmGold });
    out.armor.push({ geo: dialFace, matrix: dm.clone().multiply(makeTransform(0, 0, -0.002)), colorRgb: dialIvory });
    out.matte.push({ geo: dialNeedle, matrix: dm.clone().multiply(makeTransform(0.003, 0.004, 0.004, 0, 0, -0.6)), colorRgb: deepSlate });
  }

  const sensorNode = trackGeo(out, new THREE.SphereGeometry(0.012, 5, 4));
  const sensorLed = trackGeo(out, new THREE.SphereGeometry(0.0075, 5, 4));
  for (let i = 0; i < 3; i += 1) {
    const ang = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const rib = trackGeo(
      out,
      createOrganicLimb(
        [
          [ca * 0.146, -0.094, sa * 0.146],
          [ca * 0.168, 0.042, sa * 0.168],
          [ca * 0.146, 0.174, sa * 0.146],
        ],
        0.005,
        0.005,
        0.005,
        5,
        4,
      ),
    );
    const dripTube = trackGeo(
      out,
      createTaperedTubePart(
        [
          [ca * 0.122, 0.158, sa * 0.122],
          [ca * 0.126, 0.052, sa * 0.126],
          [ca * 0.072, -0.036, sa * 0.072],
        ],
        0.0032,
        0.0025,
        6,
        4,
      ),
    );
    out.trim.push({ geo: rib, matrix: podMat, colorRgb: warmGold });
    out.matte.push({ geo: dripTube, matrix: podMat, colorRgb: deepSlate });
    out.matte.push({
      geo: sensorNode,
      matrix: podMat.clone().multiply(makeTransform(ca * 0.154, -0.094, sa * 0.154)),
      colorRgb: deepSlate,
    });
    out.energy.push({
      geo: sensorLed,
      matrix: podMat.clone().multiply(makeTransform(ca * 0.164, -0.094, sa * 0.164)),
      colorRgb: sproutGreen,
    });
  }

  const soilProfile: readonly (readonly [number, number])[] = [
    [0.124, -0.088],
    [0.118, -0.056],
    [0.088, -0.034],
    [0.042, -0.022],
    [0.003, -0.018],
  ];
  const soilGeo = trackGeo(out, createLathePart(soilProfile, 12));
  out.matte.push({ geo: soilGeo, matrix: podMat, colorRgb: soilUmber });

  const soilClod = trackGeo(out, new THREE.DodecahedronGeometry(0.014, 0));
  const clodCoords: readonly Vec3Tuple[] = [
    [-0.068, -0.048, 0.042],
    [0.058, -0.046, 0.052],
    [-0.028, -0.032, 0.072],
    [0.074, -0.052, -0.026],
    [-0.076, -0.052, -0.034],
    [0.022, -0.028, -0.058],
    [-0.042, -0.036, -0.048],
    [0.036, -0.034, 0.028],
    [-0.014, -0.026, 0.034],
  ];
  for (let c = 0; c < clodCoords.length; c += 1) {
    const [cx, cy, cz] = clodCoords[c]!;
    out.matte.push({
      geo: soilClod,
      matrix: podMat.clone().multiply(makeTransform(cx, cy, cz, c * 0.7, c * 1.1, 0, 0.8 + (c % 3) * 0.24, 0.65, 0.9)),
      colorRgb: c % 2 === 0 ? soilDark : soilUmber,
    });
  }

  const stemGeo = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, -0.028, 0],
        [-0.008, 0.028, 0.004],
        [0.006, 0.082, -0.002],
        [0, 0.118, 0.003],
      ],
      0.010,
      0.0075,
      0.004,
      6,
      5,
      sproutGreen,
      sproutTip,
    ),
  );
  out.energy.push({ geo: stemGeo, matrix: podMat });

  const leafLarge = trackGeo(out, createPetalPart(0.118, 0.066, 0.018, 0.022, 1.18, 6, 4, sproutGreen, sproutTip));
  const leafMid = trackGeo(out, createPetalPart(0.092, 0.052, 0.015, 0.018, 1.20, 6, 3, sproutGreen, sproutTip));
  const leafBud = trackGeo(out, createPetalPart(0.064, 0.036, 0.012, 0.014, 1.25, 5, 3, sproutTip, dialIvory));
  const leafMidrib = trackGeo(out, new THREE.CylinderGeometry(0.0018, 0.0032, 0.086, 4));

  const leafTransforms: readonly { readonly geo: THREE.BufferGeometry; readonly m: THREE.Matrix4; readonly hasVein: boolean }[] = [
    { geo: leafLarge, m: podMat.clone().multiply(makeTransform(-0.004, 0.048, 0.006, 0.18, 0.25, 0.92)), hasVein: true },
    { geo: leafLarge, m: podMat.clone().multiply(makeTransform(0.004, 0.056, 0.002, 0.16, -0.28, -0.88)), hasVein: true },
    { geo: leafMid, m: podMat.clone().multiply(makeTransform(0.002, 0.078, -0.006, -0.34, 1.25, 0.72)), hasVein: true },
    { geo: leafMid, m: podMat.clone().multiply(makeTransform(-0.003, 0.086, 0.008, 0.36, -1.15, -0.68)), hasVein: true },
    { geo: leafBud, m: podMat.clone().multiply(makeTransform(0.0, 0.106, 0.004, 0.14, 0.18, 0.24)), hasVein: false },
  ];
  for (const lf of leafTransforms) {
    out.energy.push({ geo: lf.geo, matrix: lf.m });
    if (lf.hasVein) {
      out.trim.push({
        geo: leafMidrib,
        matrix: lf.m.clone().multiply(makeTransform(0, 0.048, 0.004)),
        colorRgb: sproutTip,
      });
    }
  }

  const growRing = trackGeo(out, new THREE.TorusGeometry(0.118, 0.0045, 3, 14));
  growRing.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: growRing,
    matrix: podMat.clone().multiply(makeTransform(0, 0.158, 0)),
    colorRgb: sproutTip,
  });

  const bioHalo = trackGeo(out, new THREE.TorusGeometry(0.46, 0.010, 4, 20));
  out.wingParts.push({
    geo: bioHalo,
    matrix: makeTransform(0, 1.18, -0.18, 0.08, 0, 0),
    colorRgb: warmGold,
  });

  out.crystalHex = 0xbae6fd;
  out.crystalOpacity = 0.26;
  out.crystalIntensity = 0.30;
  out.weaponGlowHex = 0x4ade80;
  out.headTopLocalY = 1.71;
}

function buildS32EntropySingularity(out: UnitBlueprintParts): void {
  const mirrorSilver: RgbTriple = [0.93, 0.96, 1.0];
  const chromeSteel: RgbTriple = [0.72, 0.78, 0.88];
  const charredCore: RgbTriple = [0.10, 0.08, 0.12];
  const crimsonHot: RgbTriple = [1.0, 0.18, 0.32];
  const crimsonCore: RgbTriple = [1.0, 0.72, 0.76];
  const moltenRedGold: RgbTriple = [1.0, 0.64, 0.24];
  const deepCrimson: RgbTriple = [0.86, 0.12, 0.24];

  const centerY = 1.00;
  const centerMat = makeTransform(0, centerY, 0);

  const innerCore = trackGeo(out, new THREE.IcosahedronGeometry(0.172, 1));
  out.matte.push({ geo: innerCore, matrix: centerMat, colorRgb: charredCore });

  const unstableHeart = trackGeo(out, new THREE.SphereGeometry(0.182, 18, 14));
  out.energy.push({
    geo: unstableHeart,
    matrix: makeTransform(0, centerY, 0, 0, 0, 0, 1.02, 0.96, 1.04),
    colorRgb: crimsonHot,
  });

  const fractureHalo = trackGeo(out, new THREE.TorusGeometry(0.245, 0.011, 6, 22));
  out.energy.push(
    { geo: fractureHalo, matrix: makeTransform(0, centerY, 0, 0.62, 0.34, 0.22), colorRgb: crimsonCore },
    { geo: fractureHalo, matrix: makeTransform(0, centerY, 0, -0.48, 1.12, -0.54), colorRgb: crimsonHot },
  );

  const fissureSpike = trackGeo(out, createFacetedCrystalPart(0.48, 0.048, 5, 0.65, 0.35, crimsonHot, crimsonCore));
  const fissureAxes: readonly (readonly [number, number, number])[] = [
    [0.35, 0.25, 0.62],
    [-0.58, 0.42, 0.22],
    [0.24, -0.52, -0.46],
    [-0.36, -0.32, 0.54],
    [0.64, 0.14, -0.38],
    [-0.18, 0.72, -0.28],
    [0.12, -0.68, 0.34],
    [-0.54, -0.14, -0.48],
  ];
  const upVec = new THREE.Vector3(0, 1, 0);
  const qFissure = new THREE.Quaternion();
  const dirVec = new THREE.Vector3();
  for (const [fx, fy, fz] of fissureAxes) {
    dirVec.set(fx, fy, fz).normalize();
    qFissure.setFromUnitVectors(upVec, dirVec);
    const fMat = new THREE.Matrix4().compose(
      new THREE.Vector3(dirVec.x * 0.14, centerY + dirVec.y * 0.14, dirVec.z * 0.14),
      qFissure,
      new THREE.Vector3(1, 1, 1),
    );
    out.energy.push({ geo: fissureSpike, matrix: fMat });
  }

  const shellPlateA = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.148],
        [0.126, -0.058],
        [-0.018, -0.116],
        [-0.122, -0.046],
      ],
      0.026,
      0.009,
      0.009,
      2,
      2,
    ),
  );
  const shellPlateB = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.016, 0.134],
        [0.112, 0.018],
        [0.054, -0.110],
        [-0.102, -0.074],
        [-0.096, 0.058],
      ],
      0.024,
      0.008,
      0.008,
      2,
      2,
    ),
  );

  const zAxis = new THREE.Vector3(0, 0, 1);
  const goldenRatio = (1 + Math.sqrt(5)) * 0.5;
  const icoDirs: readonly Vec3Tuple[] = [
    [0, 1, goldenRatio],
    [0, -1, goldenRatio],
    [0, 1, -goldenRatio],
    [0, -1, -goldenRatio],
    [1, goldenRatio, 0],
    [-1, goldenRatio, 0],
    [1, -goldenRatio, 0],
    [-1, -goldenRatio, 0],
    [goldenRatio, 0, 1],
    [-goldenRatio, 0, 1],
    [goldenRatio, 0, -1],
    [-goldenRatio, 0, -1],
  ];

  icoDirs.forEach((rawDir, idx) => {
    dirVec.set(rawDir[0], rawDir[1], rawDir[2]).normalize();
    const dist = 0.245 + (idx % 4) * 0.038;
    qFissure.setFromUnitVectors(zAxis, dirVec);
    const tumble = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(((idx % 3) - 1) * 0.22, (((idx * 5) % 4) - 1.5) * 0.18, idx * 0.55),
    );
    qFissure.multiply(tumble);
    const scale = 0.90 + (idx % 3) * 0.12;
    const plateMat = new THREE.Matrix4().compose(
      new THREE.Vector3(dirVec.x * dist, centerY + dirVec.y * dist, dirVec.z * dist),
      qFissure,
      new THREE.Vector3(scale, scale, 1.0),
    );
    const geoUse = idx % 2 === 0 ? shellPlateA : shellPlateB;
    out.trim.push({ geo: geoUse, matrix: plateMat, colorRgb: idx % 2 === 0 ? mirrorSilver : chromeSteel });
    out.matte.push({
      geo: geoUse,
      matrix: plateMat.clone().multiply(makeTransform(0, 0, -0.020, 0, 0, 0, 0.90, 0.90, 0.70)),
      colorRgb: charredCore,
    });
  });

  const hunterSpear = trackGeo(out, createTeardropPart(0.48, 0.038, 2.35, 14, 10, 0, chromeSteel, mirrorSilver));
  const spearAngles = [0.25, 1.82, 3.48, 5.05];
  for (let i = 0; i < spearAngles.length; i += 1) {
    const a = spearAngles[i]!;
    const r = 0.42 + (i % 2) * 0.07;
    const sy = centerY + (i % 2 === 0 ? 0.16 : -0.16);
    out.armor.push({
      geo: hunterSpear,
      matrix: makeTransform(Math.cos(a) * r, sy, Math.sin(a) * r, 0.55 * (i % 2 === 0 ? 1 : -1), a, 0.35),
    });
  }

  for (let rIdx = 0; rIdx < 4; rIdx += 1) {
    const pts: Vec3Tuple[] = [];
    const phase = rIdx * 1.57;
    const radBase = 0.39 + rIdx * 0.056;
    for (let k = 0; k <= 14; k += 1) {
      const t = k / 14;
      const theta = phase + t * Math.PI * 2.35;
      const r = radBase + Math.sin(t * Math.PI * 3 + phase) * 0.098;
      const y = centerY + Math.cos(theta * 1.5 + phase) * 0.36 + Math.sin(t * Math.PI * 2) * 0.12;
      pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
    }
    const ribbon = trackGeo(
      out,
      createFlowingRibbonMesh(
        pts,
        [0.016, 0.054, 0.008],
        0.020,
        2.5,
        28,
        3,
        0,
        rIdx % 2 === 0 ? moltenRedGold : crimsonCore,
        deepCrimson,
      ),
    );
    if (rIdx % 2 === 0) {
      out.trim.push({ geo: ribbon });
    } else {
      out.crystal.push({ geo: ribbon });
    }
  }

  for (let aIdx = 0; aIdx < 4; aIdx += 1) {
    const a0 = aIdx * 1.57;
    const arcPts: Vec3Tuple[] = [
      [Math.cos(a0) * 0.15, centerY + 0.06, Math.sin(a0) * 0.15],
      [Math.cos(a0 + 0.5) * 0.33, centerY + ((aIdx % 2) * 2 - 1) * 0.20, Math.sin(a0 + 0.5) * 0.33],
      [Math.cos(a0 + 1.1) * 0.46, centerY + ((aIdx % 2) * -2 + 1) * 0.16, Math.sin(a0 + 1.1) * 0.46],
    ];
    const arc = trackGeo(out, createTaperedTubePart(arcPts, 0.011, 0.003, 14, 6));
    out.energy.push({ geo: arc, colorRgb: aIdx % 2 === 0 ? crimsonCore : crimsonHot });
  }

  const nanoShard = trackGeo(out, createFacetedCrystalPart(0.12, 0.030, 5, 0.62, 0.38, chromeSteel, mirrorSilver));
  for (let i = 0; i < 10; i += 1) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 0.50 + (i % 3) * 0.07;
    const y = 0.34 + (i / 9) * 1.24;
    out.trim.push({
      geo: nanoShard,
      matrix: makeTransform(Math.cos(a) * r, y, Math.sin(a) * r, i * 0.6, a, i * 0.4),
    });
  }

  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: hunterSpear,
      matrix: makeTransform(side * 0.54, centerY + 0.16, -0.14, 0.24, side * 0.3, side * -0.45, 1.35, 1.35, 1.35),
      colorRgb: moltenRedGold,
    });
  }

  out.crystalHex = 0xf43f5e;
  out.crystalOpacity = 0.44;
  out.crystalIntensity = 0.68;
  out.weaponGlowHex = 0xfb2c50;
  out.headTopLocalY = 1.68;
}

function buildS34CenturyDelayedPioneer(out: UnitBlueprintParts): void {
  const champagnePearl: RgbTriple = [0.92, 0.86, 0.74];
  const suitCanvas: RgbTriple = [0.78, 0.70, 0.56];
  const antiqueBronze: RgbTriple = [0.64, 0.46, 0.26];
  const warmGold: RgbTriple = [1.0, 0.84, 0.38];
  const darkBronzeSteel: RgbTriple = [0.22, 0.20, 0.20];
  const dialIvory: RgbTriple = [0.98, 0.96, 0.90];
  const starlightGold: RgbTriple = [1.0, 0.93, 0.60];
  const chronoEmerald: RgbTriple = [0.34, 0.92, 0.74];

  const torsoYaw = -0.14;
  const headYaw = 0.16;
  const rotT = (x: number, y: number, z: number): THREE.Vector3 => {
    const c = Math.cos(torsoYaw);
    const sn = Math.sin(torsoYaw);
    return new THREE.Vector3(x * c + z * sn, y, -x * sn + z * c);
  };

  const torsoProfile: readonly (readonly [number, number])[] = [
    [0.014, 0.0],
    [0.128, 0.06],
    [0.108, 0.22],
    [0.152, 0.45],
    [0.136, 0.55],
    [0.088, 0.61],
  ];
  const torsoGeo = trackGeo(
    out,
    createSculptedClothLathe(torsoProfile, 12, 4, 0.025, 0.4, suitCanvas, champagnePearl),
  );
  out.armor.push({
    geo: torsoGeo,
    matrix: makeTransform(0, 0.74, 0, 0.04, torsoYaw, 0, 1.02, 1.0, 0.78),
  });

  const waistBellow = trackGeo(out, new THREE.TorusGeometry(0.112, 0.010, 4, 14));
  waistBellow.rotateX(Math.PI * 0.5);
  for (let w = 0; w < 3; w += 1) {
    out.matte.push({
      geo: waistBellow,
      matrix: makeTransform(0, 0.94 + w * 0.026, 0.004, 0.03, torsoYaw, 0, 1.02 + w * 0.02, 1.0, 0.80),
      colorRgb: darkBronzeSteel,
    });
  }

  const waistBelt = trackGeo(out, new THREE.TorusGeometry(0.120, 0.011, 4, 14));
  waistBelt.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: waistBelt,
    matrix: makeTransform(0, 0.915, 0.005, 0.02, torsoYaw, 0, 1.02, 1.0, 0.82),
    colorRgb: warmGold,
  });

  const dcmPos = rotT(0, 1.155, 0.128);
  const dcmMat = makeTransform(dcmPos.x, dcmPos.y, dcmPos.z, -0.06, torsoYaw, 0);
  const dcmBox = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.072, -0.064],
        [0.072, -0.064],
        [0.080, 0.056],
        [-0.080, 0.056],
      ],
      0.040,
      0.008,
      0.008,
      1,
      2,
    ),
  );
  out.armor.push({ geo: dcmBox, matrix: dcmMat, colorRgb: antiqueBronze });

  const dcmDialBezel = trackGeo(out, new THREE.TorusGeometry(0.027, 0.005, 3, 12));
  const dcmDialFace = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 0.006, 10));
  dcmDialFace.rotateX(Math.PI * 0.5);
  const dcmNeedle = trackGeo(out, new THREE.CylinderGeometry(0.002, 0.0025, 0.019, 4));
  const togglePin = trackGeo(out, new THREE.CylinderGeometry(0.0032, 0.0038, 0.018, 4));
  togglePin.rotateX(Math.PI * 0.5);
  const dcmVentBar = trackGeo(out, new THREE.CylinderGeometry(0.0035, 0.0035, 0.048, 4));
  dcmVentBar.rotateZ(Math.PI * 0.5);

  out.trim.push({ geo: dcmDialBezel, matrix: dcmMat.clone().multiply(makeTransform(-0.028, 0.014, 0.044)), colorRgb: warmGold });
  out.armor.push({ geo: dcmDialFace, matrix: dcmMat.clone().multiply(makeTransform(-0.028, 0.014, 0.042)), colorRgb: dialIvory });
  out.matte.push({ geo: dcmNeedle, matrix: dcmMat.clone().multiply(makeTransform(-0.024, 0.018, 0.047, 0, 0, -0.58)), colorRgb: darkBronzeSteel });

  for (let tv = 0; tv < 3; tv += 1) {
    out.trim.push({ geo: togglePin, matrix: dcmMat.clone().multiply(makeTransform(0.036, 0.030 - tv * 0.022, 0.046)), colorRgb: warmGold });
  }
  for (let vb = 0; vb < 2; vb += 1) {
    out.matte.push({ geo: dcmVentBar, matrix: dcmMat.clone().multiply(makeTransform(-0.014, -0.026 - vb * 0.014, 0.044)), colorRgb: darkBronzeSteel });
  }
  const chestCore = trackGeo(out, new THREE.SphereGeometry(0.010, 6, 4));
  out.energy.push({
    geo: chestCore,
    matrix: dcmMat.clone().multiply(makeTransform(0.036, -0.034, 0.046, 0, 0, 0, 1, 1, 0.5)),
    colorRgb: starlightGold,
  });

  for (const side of [-1, 1] as const) {
    const pTop = rotT(side * 0.088, 1.32, 0.048);
    const pMid = rotT(side * 0.094, 1.15, 0.132);
    const pBot = rotT(side * 0.086, 0.92, 0.096);
    const strap = trackGeo(
      out,
      createTaperedTubePart(
        [
          [pTop.x, pTop.y, pTop.z],
          [pMid.x, pMid.y, pMid.z],
          [pBot.x, pBot.y, pBot.z],
        ],
        0.010,
        0.009,
        6,
        4,
      ),
    );
    out.matte.push({ geo: strap, colorRgb: darkBronzeSteel });
  }

  const neckSeal = trackGeo(out, new THREE.TorusGeometry(0.110, 0.015, 5, 16));
  neckSeal.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: neckSeal,
    matrix: makeTransform(0, 1.35, 0.008, 0.05, torsoYaw, 0),
    colorRgb: warmGold,
  });

  const tankCap = trackGeo(out, new THREE.TorusGeometry(0.040, 0.006, 3, 10));
  tankCap.rotateX(Math.PI * 0.5);
  for (const side of [-1, 1] as const) {
    const tp = rotT(side * 0.068, 1.11, -0.156);
    const tankGeo = trackGeo(out, createTeardropPart(0.32, 0.054, 1.1, 10, 8, 0, antiqueBronze, champagnePearl));
    out.armor.push({
      geo: tankGeo,
      matrix: makeTransform(tp.x, tp.y, tp.z, 0.05, torsoYaw, 0),
    });
    out.trim.push({
      geo: tankCap,
      matrix: makeTransform(tp.x, tp.y + 0.10, tp.z + 0.004, 0, torsoYaw, 0),
      colorRgb: warmGold,
    });
    const h0 = rotT(side * 0.072, 1.24, -0.145);
    const h1 = rotT(side * 0.142, 1.18, -0.045);
    const h2 = rotT(side * 0.088, 1.14, 0.118);
    const hose = trackGeo(
      out,
      createOrganicLimb(
        [
          [h0.x, h0.y, h0.z],
          [h1.x, h1.y, h1.z],
          [h2.x, h2.y, h2.z],
        ],
        0.009,
        0.009,
        0.008,
        5,
        4,
      ),
    );
    out.matte.push({ geo: hose, colorRgb: darkBronzeSteel });
  }

  const legSpecs: readonly { readonly pts: readonly Vec3Tuple[]; readonly footYaw: number }[] = [
    {
      pts: [
        [-0.082, 0.79, 0.012],
        [-0.122, 0.44, 0.086],
        [-0.128, 0.09, 0.068],
      ],
      footYaw: 0.18,
    },
    {
      pts: [
        [0.082, 0.79, -0.012],
        [0.106, 0.43, -0.024],
        [0.118, 0.09, -0.074],
      ],
      footYaw: -0.22,
    },
  ];
  const thighSuitShell = trackGeo(
    out,
    createLathePart(
      [
        [0.048, -0.44],
        [0.064, -0.14],
        [0.072, 0.18],
        [0.062, 0.44],
      ],
      9,
    ),
  );
  const shinSuitShell = trackGeo(
    out,
    createLathePart(
      [
        [0.042, -0.45],
        [0.052, -0.14],
        [0.060, 0.16],
        [0.052, 0.44],
      ],
      9,
    ),
  );
  const kneeBellow = trackGeo(out, new THREE.TorusGeometry(0.052, 0.008, 3, 10));
  kneeBellow.rotateX(Math.PI * 0.5);
  const bootGeo = trackGeo(out, createTeardropPart(0.186, 0.046, 1.18, 10, 8, 0, antiqueBronze, champagnePearl));
  const clampRing = trackGeo(out, new THREE.TorusGeometry(0.044, 0.0065, 3, 10));
  clampRing.rotateX(Math.PI * 0.5);

  for (const lg of legSpecs) {
    const hipV = new THREE.Vector3(...lg.pts[0]!);
    const kneeV = new THREE.Vector3(...lg.pts[1]!);
    const ankleV = new THREE.Vector3(...lg.pts[2]!);
    const legGeo = trackGeo(out, createOrganicLimb(lg.pts, 0.046, 0.040, 0.034, 7, 6, darkBronzeSteel, suitCanvas));
    out.matte.push({ geo: legGeo });

    const thighLen = hipV.distanceTo(kneeV) * 0.78;
    const thighMid = hipV.clone().lerp(kneeV, 0.44);
    const thighDir = new THREE.Vector3().subVectors(kneeV, hipV).normalize();
    const thighQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), thighDir);
    out.armor.push({
      geo: thighSuitShell,
      matrix: new THREE.Matrix4().compose(thighMid, thighQ, new THREE.Vector3(1.0, thighLen, 1.06)),
      colorRgb: champagnePearl,
    });

    const shinLen = kneeV.distanceTo(ankleV) * 0.80;
    const shinMid = kneeV.clone().lerp(ankleV, 0.54);
    const shinDir = new THREE.Vector3().subVectors(ankleV, kneeV).normalize();
    const shinQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), shinDir);
    out.armor.push({
      geo: shinSuitShell,
      matrix: new THREE.Matrix4().compose(shinMid, shinQ, new THREE.Vector3(1.0, shinLen, 1.08)),
      colorRgb: suitCanvas,
    });

    const k = lg.pts[1]!;
    for (let r = 0; r < 4; r += 1) {
      out.matte.push({
        geo: kneeBellow,
        matrix: makeTransform(k[0], k[1] - 0.030 + r * 0.020, k[2], -0.10, lg.footYaw, 0),
        colorRgb: r % 2 === 0 ? darkBronzeSteel : antiqueBronze,
      });
    }

    const ankle = lg.pts[2]!;
    out.armor.push({
      geo: bootGeo,
      matrix: makeTransform(ankle[0], 0.046, ankle[2] + 0.044, Math.PI * 0.5, lg.footYaw, 0, 0.90, 1.0, 0.72),
    });
    out.matte.push({
      geo: bootGeo,
      matrix: makeTransform(ankle[0], 0.024, ankle[2] + 0.040, Math.PI * 0.5, lg.footYaw, 0, 0.96, 1.02, 0.34),
      colorRgb: darkBronzeSteel,
    });
    out.trim.push({
      geo: clampRing,
      matrix: makeTransform(ankle[0], 0.092, ankle[2], 0, lg.footYaw, 0),
      colorRgb: warmGold,
    });
  }

  const leftArmPts = [rotT(0.154, 1.26, 0.0), rotT(0.242, 1.08, 0.09), rotT(0.214, 1.03, 0.242)];
  const rightArmPts = [rotT(-0.154, 1.26, 0.0), rotT(-0.248, 1.08, 0.07), rotT(-0.228, 0.99, 0.222)];
  const elbowBellow = trackGeo(out, new THREE.TorusGeometry(0.040, 0.007, 3, 9));
  elbowBellow.rotateX(Math.PI * 0.5);
  const shBellow = trackGeo(out, new THREE.TorusGeometry(0.052, 0.008, 3, 10));
  const cuff = trackGeo(out, new THREE.TorusGeometry(0.035, 0.0055, 3, 10));
  const glove = trackGeo(out, new THREE.SphereGeometry(0.031, 6, 5));

  for (const armPts of [leftArmPts, rightArmPts]) {
    const sh = armPts[0]!;
    const el = armPts[1]!;
    const wr = armPts[2]!;
    const armGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [sh.x, sh.y, sh.z],
          [el.x, el.y, el.z],
          [wr.x, wr.y, wr.z],
        ],
        0.045,
        0.038,
        0.030,
        7,
        7,
        champagnePearl,
        suitCanvas,
      ),
    );
    out.armor.push({ geo: armGeo });
    out.matte.push({
      geo: shBellow,
      matrix: makeTransform(sh.x, sh.y, sh.z, 0, torsoYaw + Math.PI * 0.5, 0),
      colorRgb: darkBronzeSteel,
    });
    for (const dy of [-0.016, 0, 0.016]) {
      out.matte.push({
        geo: elbowBellow,
        matrix: makeTransform(el.x, el.y + dy, el.z, 0.35, torsoYaw, 0),
        colorRgb: darkBronzeSteel,
      });
    }
    out.trim.push({ geo: cuff, matrix: makeTransform(wr.x, wr.y, wr.z, Math.PI * 0.45, torsoYaw, 0), colorRgb: warmGold });
    out.matte.push({ geo: glove, matrix: makeTransform(wr.x, wr.y - 0.004, wr.z + 0.018), colorRgb: darkBronzeSteel });
  }

  const headMat = makeTransform(0, 1.505, 0.010, 0.05, torsoYaw + headYaw, 0);
  const helmetShell = trackGeo(out, new THREE.SphereGeometry(0.144, 14, 10));
  out.armor.push({
    geo: helmetShell,
    matrix: headMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 0.98, 1.02, 1.04)),
    colorRgb: champagnePearl,
  });

  const goldVisor = trackGeo(
    out,
    new THREE.SphereGeometry(0.136, 12, 9, -Math.PI * 0.36, Math.PI * 0.72, Math.PI * 0.22, Math.PI * 0.54),
  );
  out.trim.push({
    geo: goldVisor,
    matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.028, 0, Math.PI * 0.5, 0)),
    colorRgb: warmGold,
  });

  const visorGlaze = trackGeo(
    out,
    new THREE.SphereGeometry(0.144, 10, 8, -Math.PI * 0.34, Math.PI * 0.68, Math.PI * 0.24, Math.PI * 0.50),
  );
  out.crystal.push({
    geo: visorGlaze,
    matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.032, 0, Math.PI * 0.5, 0)),
    colorRgb: starlightGold,
  });

  const visorBezel = trackGeo(out, new THREE.TorusGeometry(0.116, 0.009, 4, 16));
  out.matte.push({
    geo: visorBezel,
    matrix: headMat.clone().multiply(makeTransform(0, 0.005, 0.102, 0.06, 0, 0, 0.94, 0.84, 0.62)),
    colorRgb: darkBronzeSteel,
  });
  const earComm = trackGeo(out, new THREE.CylinderGeometry(0.034, 0.036, 0.030, 8));
  earComm.rotateZ(Math.PI * 0.5);
  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: earComm,
      matrix: headMat.clone().multiply(makeTransform(side * 0.138, 0.0, -0.010)),
      colorRgb: darkBronzeSteel,
    });
  }

  const whipAntenna = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.140, 0.015, -0.015],
        [0.155, 0.155, -0.028],
        [0.160, 0.275, -0.042],
      ],
      0.007,
      0.005,
      0.003,
      5,
      4,
    ),
  );
  out.trim.push({ geo: whipAntenna, matrix: headMat, colorRgb: warmGold });
  const antennaTip = trackGeo(out, new THREE.SphereGeometry(0.011, 5, 4));
  out.energy.push({ geo: antennaTip, matrix: headMat.clone().multiply(makeTransform(0.160, 0.280, -0.042)), colorRgb: starlightGold });

  const lHand = leftArmPts[2]!;
  const watchMat = makeTransform(lHand.x + 0.012, lHand.y + 0.048, lHand.z + 0.056, -0.18, torsoYaw - 0.34, 0.12);
  const watchCase = trackGeo(out, new THREE.CylinderGeometry(0.086, 0.086, 0.022, 16));
  watchCase.rotateX(Math.PI * 0.5);
  out.trim.push({ geo: watchCase, matrix: watchMat, colorRgb: warmGold });

  const watchBezel = trackGeo(out, new THREE.TorusGeometry(0.088, 0.010, 4, 16));
  out.trim.push({
    geo: watchBezel,
    matrix: watchMat.clone().multiply(makeTransform(0, 0, 0.008)),
    colorRgb: warmGold,
  });

  const lidPivotMat = watchMat.clone().multiply(makeTransform(0, 0.088, 0.012, -1.08, 0, 0));
  const lidRim = trackGeo(out, new THREE.TorusGeometry(0.080, 0.0065, 4, 14));
  const lidInner = trackGeo(out, new THREE.TorusGeometry(0.040, 0.0045, 3, 10));
  const lidSpoke = trackGeo(out, new THREE.CylinderGeometry(0.003, 0.003, 0.156, 4));
  out.trim.push(
    { geo: lidRim, matrix: lidPivotMat.clone().multiply(makeTransform(0, 0.080, 0)), colorRgb: warmGold },
    { geo: lidInner, matrix: lidPivotMat.clone().multiply(makeTransform(0, 0.080, 0)), colorRgb: antiqueBronze },
    { geo: lidSpoke, matrix: lidPivotMat.clone().multiply(makeTransform(0, 0.080, 0)), colorRgb: warmGold },
    { geo: lidSpoke, matrix: lidPivotMat.clone().multiply(makeTransform(0, 0.080, 0, 0, 0, Math.PI * 0.5)), colorRgb: warmGold },
  );

  const watchBow = trackGeo(out, new THREE.TorusGeometry(0.022, 0.0045, 3, 9));
  out.trim.push({
    geo: watchBow,
    matrix: watchMat.clone().multiply(makeTransform(0, 0.104, -0.004)),
    colorRgb: warmGold,
  });

  const watchDial = trackGeo(out, new THREE.CylinderGeometry(0.074, 0.074, 0.006, 14));
  watchDial.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: watchDial,
    matrix: watchMat.clone().multiply(makeTransform(0, 0, 0.012)),
    colorRgb: dialIvory,
  });

  const hourHand = trackGeo(out, createOrganicLimb([[0, 0, 0.017], [-0.028, 0.034, 0.017]], 0.005, 0.004, 0.002, 2, 4));
  const minuteHand = trackGeo(out, createOrganicLimb([[0, 0, 0.019], [0.044, 0.046, 0.019]], 0.004, 0.0035, 0.0018, 2, 4));
  out.matte.push(
    { geo: hourHand, matrix: watchMat, colorRgb: darkBronzeSteel },
    { geo: minuteHand, matrix: watchMat, colorRgb: darkBronzeSteel },
  );

  const watchTick = trackGeo(out, new THREE.SphereGeometry(0.005, 4, 4));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    out.trim.push({
      geo: watchTick,
      matrix: watchMat.clone().multiply(makeTransform(Math.cos(a) * 0.062, Math.sin(a) * 0.062, 0.016)),
      colorRgb: antiqueBronze,
    });
  }
  const watchPin = trackGeo(out, new THREE.SphereGeometry(0.0085, 5, 4));
  out.energy.push({
    geo: watchPin,
    matrix: watchMat.clone().multiply(makeTransform(0, 0, 0.021)),
    colorRgb: starlightGold,
  });
  const watchCrystal = trackGeo(out, new THREE.SphereGeometry(0.076, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.36));
  out.crystal.push({
    geo: watchCrystal,
    matrix: watchMat.clone().multiply(makeTransform(0, 0, -0.022, Math.PI * 0.5, 0, 0)),
    colorRgb: starlightGold,
  });

  const chainPts: Vec3Tuple[] = [
    [lHand.x + 0.005, lHand.y + 0.145, lHand.z + 0.052],
    [lHand.x - 0.025, lHand.y + 0.025, lHand.z - 0.005],
    [dcmPos.x + 0.072, dcmPos.y - 0.055, dcmPos.z + 0.032],
    [dcmPos.x + 0.062, dcmPos.y + 0.022, dcmPos.z + 0.028],
  ];
  const watchChain = trackGeo(out, createTaperedTubePart(chainPts, 0.0045, 0.0045, 8, 4));
  out.trim.push({ geo: watchChain, colorRgb: warmGold });
  const chainCurve = new THREE.CatmullRomCurve3(chainPts.map((p) => new THREE.Vector3(...p)));
  const chainGear = trackGeo(out, new THREE.TorusGeometry(0.011, 0.0032, 3, 7));
  for (let g = 1; g <= 5; g += 1) {
    const pt = chainCurve.getPoint(g / 6);
    out.trim.push({
      geo: chainGear,
      matrix: makeTransform(pt.x, pt.y, pt.z, g * 0.6, g * 0.8, 0),
      colorRgb: warmGold,
    });
  }

  const rHand = rightArmPts[2]!;
  const rifleMat = makeTransform(rHand.x - 0.035, rHand.y + 0.03, rHand.z + 0.03, -0.50, torsoYaw - 0.18, 0.10);
  const rifleStock = trackGeo(out, createTeardropPart(0.42, 0.034, 1.25, 10, 8, 0, antiqueBronze, champagnePearl));
  out.armor.push({
    geo: rifleStock,
    matrix: rifleMat.clone().multiply(makeTransform(0, 0, -0.10, Math.PI * 0.5, 0, 0, 0.72, 1.0, 1.20)),
  });

  const rifleBarrel = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.018, 0.64, 7));
  out.matte.push({
    geo: rifleBarrel,
    matrix: rifleMat.clone().multiply(makeTransform(0, 0.012, 0.26, Math.PI * 0.5, 0, 0)),
    colorRgb: darkBronzeSteel,
  });

  const rifleRail = trackGeo(out, new THREE.CylinderGeometry(0.0055, 0.008, 0.58, 5));
  out.energy.push({
    geo: rifleRail,
    matrix: rifleMat.clone().multiply(makeTransform(0, -0.008, 0.26, Math.PI * 0.5, 0, 0)),
    colorRgb: starlightGold,
  });

  const rifleCollar = trackGeo(out, new THREE.TorusGeometry(0.022, 0.005, 3, 9));
  for (const zOff of [0.06, 0.16, 0.26, 0.36, 0.46]) {
    out.trim.push({
      geo: rifleCollar,
      matrix: rifleMat.clone().multiply(makeTransform(0, 0.004, zOff)),
      colorRgb: warmGold,
    });
  }

  const scopeBody = trackGeo(out, new THREE.CylinderGeometry(0.017, 0.013, 0.23, 7));
  out.trim.push({
    geo: scopeBody,
    matrix: rifleMat.clone().multiply(makeTransform(0, 0.054, 0.06, Math.PI * 0.5, 0, 0)),
    colorRgb: warmGold,
  });
  const scopeLens = trackGeo(out, new THREE.SphereGeometry(0.015, 6, 4));
  out.crystal.push({
    geo: scopeLens,
    matrix: rifleMat.clone().multiply(makeTransform(0, 0.054, 0.175)),
    colorRgb: chronoEmerald,
  });
  const muzzleStar = trackGeo(out, createFacetedCrystalPart(0.088, 0.020, 4, 0.6, 0.4, starlightGold, dialIvory));
  out.energy.push({
    geo: muzzleStar,
    matrix: rifleMat.clone().multiply(makeTransform(0, 0.008, 0.58, Math.PI * 0.5, 0, 0)),
  });

  const timeRingA = buildWarpedAccretionRing(
    out,
    0.42,
    [0.036, 0.046, 0.036],
    0.055,
    2,
    0.2,
    0.022,
    2,
    20,
    2,
    0,
    starlightGold,
    chronoEmerald,
  );
  out.crystal.push({
    geo: timeRingA,
    matrix: makeTransform(0, 0.12, 0.0, 0.14, 0, -0.08),
  });

  const timeRingB = buildWarpedFilament(out, 0.51, 0.072, 2, 1.4, 0.028, 3, 0.008, 20, 4);
  out.energy.push({
    geo: timeRingB,
    matrix: makeTransform(0, 0.18, 0.0, -0.16, 0.4, 0.12),
    colorRgb: starlightGold,
  });

  const timeTrim = buildWarpedFilament(out, 0.465, 0.048, 2, 0.7, 0.015, 2, 0.0055, 18, 4);
  out.trim.push({
    geo: timeTrim,
    matrix: makeTransform(0, 0.14, 0.0, 0.08, -0.3, 0.06),
    colorRgb: warmGold,
  });

  const starWing = trackGeo(out, createCreatureFin(0.18, 0.42, 0.32, 0.03, 0.012, 6, 3, warmGold, starlightGold));
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: starWing,
      matrix: makeTransform(side * 0.18, 1.14, -0.18, 0, side * -0.25, side * 0.25, side, 1, 1),
      colorRgb: warmGold,
    });
  }

  out.crystalHex = 0xfde68a;
  out.crystalOpacity = 0.42;
  out.crystalIntensity = 0.62;
  out.weaponGlowHex = 0xfde047;
  out.headTopLocalY = 1.76;
}

function buildS35RetiredAdmiral(out: UnitBlueprintParts): void {
  const navalNavy: RgbTriple = [0.11, 0.19, 0.35];
  const navalHighlight: RgbTriple = [0.19, 0.30, 0.50];
  const capeLining: RgbTriple = [0.36, 0.12, 0.18];
  const darkCharcoal: RgbTriple = [0.12, 0.15, 0.22];
  const brassGold: RgbTriple = [0.98, 0.80, 0.36];
  const agedBronze: RgbTriple = [0.76, 0.56, 0.26];
  const skinWeathered: RgbTriple = [0.87, 0.73, 0.63];
  const skinShadow: RgbTriple = [0.68, 0.54, 0.46];
  const silverBeard: RgbTriple = [0.84, 0.88, 0.94];
  const capWhite: RgbTriple = [0.92, 0.95, 0.99];
  const amberGlow: RgbTriple = [1.0, 0.74, 0.20];
  const holoCyan: RgbTriple = [0.34, 0.88, 1.0];

  const torsoYaw = -0.12;
  const headYaw = 0.12;
  const rotT = (x: number, y: number, z: number): THREE.Vector3 => {
    const c = Math.cos(torsoYaw);
    const sn = Math.sin(torsoYaw);
    return new THREE.Vector3(x * c + z * sn, y, -x * sn + z * c);
  };

  const innerUniform = trackGeo(
    out,
    createLathePart(
      [
        [0.068, -0.12],
        [0.126, -0.02],
        [0.120, 0.08],
        [0.114, 0.20],
        [0.150, 0.42],
        [0.164, 0.52],
        [0.088, 0.62],
      ],
      12,
    ),
  );
  out.matte.push({
    geo: innerUniform,
    matrix: makeTransform(0, 0.74, 0, 0.02, torsoYaw, 0, 1.04, 1.0, 0.78),
    colorRgb: darkCharcoal,
  });

  const coatBodice = trackGeo(
    out,
    createSculptedClothLathe(
      [
        [0.124, 0.0],
        [0.122, 0.11],
        [0.176, 0.32],
        [0.186, 0.42],
        [0.116, 0.50],
        [0.088, 0.55],
      ],
      14,
      4,
      0.035,
      0.34,
      navalNavy,
      navalHighlight,
    ),
  );
  out.armor.push({
    geo: coatBodice,
    matrix: makeTransform(0, 0.86, -0.004, 0.02, torsoYaw, 0, 1.02, 1.0, 0.78),
  });

  const admiralCoatSkirt = trackGeo(
    out,
    createSplitPleatedCoatSkirt(
      [
        [0.244, 0.0],
        [0.214, 0.18],
        [0.174, 0.38],
        [0.136, 0.56],
        [0.124, 0.68],
      ],
      0.56,
      0.16,
      8,
      0.115,
      0.022,
      -0.056,
      0.015,
      22,
      navalNavy,
      navalHighlight,
      capeLining,
    ),
  );
  out.armor.push({
    geo: admiralCoatSkirt,
    matrix: makeTransform(0, 0.28, -0.004, 0.02, torsoYaw, 0, 1.04, 1.0, 0.84),
  });

  for (const side of [-1, 1] as const) {
    const hemTrim = trackGeo(
      out,
      createTaperedTubePart(
        [
          rotT(side * 0.030, 0.96, 0.100),
          rotT(side * 0.086, 0.64, 0.122),
          rotT(side * 0.136, 0.29, 0.112),
        ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.0055,
        0.005,
        7,
        4,
      ),
    );
    out.trim.push({ geo: hemTrim, colorRgb: brassGold });
  }

  const shoulderCapePts: Vec3Tuple[] = [
    [-0.142, 1.37, 0.055],
    [-0.228, 1.24, -0.062],
    [-0.278, 0.94, -0.184],
    [-0.312, 0.60, -0.252],
    [-0.338, 0.34, -0.285],
  ].map(([x, y, z]) => {
    const v = rotT(x!, y!, z!);
    return [v.x, v.y, v.z];
  });
  const shoulderCape = trackGeo(
    out,
    createFlowingRibbonMesh(shoulderCapePts, [0.17, 0.29, 0.36], 0.024, 1.6, 12, 4, 0.009, navalNavy, capeLining),
  );
  out.armor.push({ geo: shoulderCape });

  const capeChain = trackGeo(
    out,
    createTaperedTubePart(
      [
        rotT(-0.115, 1.36, 0.072),
        rotT(0.0, 1.32, 0.118),
        rotT(0.115, 1.36, 0.072),
      ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
      0.006,
      0.006,
      7,
      4,
    ),
  );
  out.trim.push({ geo: capeChain, colorRgb: brassGold });

  const wideLapel = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.115],
        [0.074, -0.042],
        [0.102, 0.082],
        [0.036, 0.120],
      ],
      0.016,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  for (const side of [-1, 1] as const) {
    const lp = rotT(side * 0.022, 1.20, 0.122);
    out.armor.push({
      geo: wideLapel,
      matrix: makeTransform(lp.x, lp.y, lp.z, -0.06, torsoYaw + side * 0.15, side * 0.06, side, 1, 1),
      colorRgb: navalHighlight,
    });
  }

  const medalBar = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.036, -0.012],
        [0.036, -0.012],
        [0.036, 0.012],
        [-0.036, 0.012],
      ],
      0.008,
      0.002,
      0.002,
      1,
      1,
    ),
  );
  const medalPos = rotT(0.076, 1.24, 0.132);
  out.trim.push({
    geo: medalBar,
    matrix: makeTransform(medalPos.x, medalPos.y, medalPos.z, -0.06, torsoYaw + 0.18, 0),
    colorRgb: brassGold,
  });
  const medalStar = trackGeo(out, new THREE.OctahedronGeometry(0.012, 0));
  out.energy.push({
    geo: medalStar,
    matrix: makeTransform(medalPos.x - 0.01, medalPos.y - 0.022, medalPos.z + 0.008),
    colorRgb: amberGlow,
  });

  const waistBelt = trackGeo(out, new THREE.TorusGeometry(0.126, 0.014, 4, 14));
  waistBelt.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: waistBelt,
    matrix: makeTransform(0, 0.97, 0.004, 0, torsoYaw, 0, 1.02, 1.0, 0.80),
    colorRgb: darkCharcoal,
  });
  const beltBuckle = trackGeo(out, createHexMirrorTilePart(0.032, 0.014, 0.005, 0, brassGold, agedBronze));
  const bPos = rotT(0, 0.97, 0.108);
  out.trim.push({
    geo: beltBuckle,
    matrix: makeTransform(bPos.x, bPos.y, bPos.z, 0, torsoYaw, 0),
  });

  const collarStanding = trackGeo(out, new THREE.CylinderGeometry(0.088, 0.100, 0.090, 12, 1, true));
  out.armor.push({
    geo: collarStanding,
    matrix: makeTransform(0, 1.38, 0.006, 0.04, torsoYaw, 0, 1.0, 1.0, 0.88),
    colorRgb: navalNavy,
  });
  const collarTrim = trackGeo(out, new THREE.TorusGeometry(0.088, 0.0065, 4, 14));
  collarTrim.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: collarTrim,
    matrix: makeTransform(0, 1.424, 0.008, 0.04, torsoYaw, 0, 1.0, 1.0, 0.88),
    colorRgb: brassGold,
  });

  const buttonGeo = trackGeo(out, new THREE.SphereGeometry(0.0095, 5, 4));
  for (let row = 0; row < 4; row += 1) {
    for (const side of [-1, 1] as const) {
      const bp = rotT(side * 0.048, 1.04 + row * 0.070, 0.112 + row * 0.009);
      out.trim.push({
        geo: buttonGeo,
        matrix: makeTransform(bp.x, bp.y, bp.z),
        colorRgb: brassGold,
      });
    }
  }

  const epBoard = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.058, -0.025],
        [0.058, -0.025],
        [0.066, 0.025],
        [-0.058, 0.025],
      ],
      0.015,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  const epFringe = trackGeo(out, new THREE.CylinderGeometry(0.0045, 0.0055, 0.054, 5));
  for (const side of [-1, 1] as const) {
    const ep = rotT(side * 0.168, 1.345, 0.004);
    out.trim.push({
      geo: epBoard,
      matrix: makeTransform(ep.x, ep.y, ep.z, Math.PI * 0.5, torsoYaw, side * -0.18),
      colorRgb: brassGold,
    });
    for (let f = -2; f <= 2; f += 1) {
      const fp = rotT(side * 0.216, 1.312, f * 0.012);
      out.trim.push({
        geo: epFringe,
        matrix: makeTransform(fp.x, fp.y, fp.z, 0, torsoYaw, side * -0.16),
        colorRgb: brassGold,
      });
    }
  }

  const legSpecs: readonly { readonly pts: readonly Vec3Tuple[]; readonly footYaw: number }[] = [
    {
      pts: [
        [-0.084, 0.72, 0.014],
        [-0.106, 0.39, 0.076],
        [-0.114, 0.082, 0.068],
      ],
      footYaw: 0.16,
    },
    {
      pts: [
        [0.084, 0.72, -0.012],
        [0.098, 0.38, -0.028],
        [0.108, 0.082, -0.072],
      ],
      footYaw: -0.22,
    },
  ];
  const bootGeo = trackGeo(out, createTeardropPart(0.188, 0.047, 1.18, 10, 8, 0, darkCharcoal, navalNavy));
  const bootTrim = trackGeo(out, new THREE.TorusGeometry(0.044, 0.006, 3, 10));
  bootTrim.rotateX(Math.PI * 0.5);
  for (const lg of legSpecs) {
    const legGeo = trackGeo(out, createOrganicLimb(lg.pts, 0.062, 0.050, 0.040, 7, 7, darkCharcoal, darkCharcoal));
    out.matte.push({ geo: legGeo });
    const a = lg.pts[2]!;
    out.matte.push({
      geo: bootGeo,
      matrix: makeTransform(a[0], 0.044, a[2] + 0.044, Math.PI * 0.5, lg.footYaw, 0, 0.88, 1.0, 0.72),
    });
    out.trim.push({
      geo: bootTrim,
      matrix: makeTransform(a[0], 0.096, a[2], 0, lg.footYaw, 0),
      colorRgb: brassGold,
    });
  }

  for (const side of [-1, 1] as const) {
    const sh = rotT(side * 0.182, 1.29, 0.0);
    const el = rotT(side * 0.248, 1.08, 0.11);
    const ha = rotT(side * 0.194, 0.96, 0.285);
    const armGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [sh.x, sh.y, sh.z],
          [el.x, el.y, el.z],
          [ha.x, ha.y, ha.z],
        ],
        0.050,
        0.042,
        0.034,
        7,
        7,
        navalHighlight,
        navalNavy,
      ),
    );
    out.armor.push({ geo: armGeo });

    for (let b = 0; b < 2; b += 1) {
      const braid = trackGeo(out, new THREE.TorusGeometry(0.036, 0.0045, 3, 9));
      const bp = rotT(side * (0.204 - b * 0.006), 0.974 - b * 0.012, 0.264 + b * 0.016);
      out.trim.push({
        geo: braid,
        matrix: makeTransform(bp.x, bp.y, bp.z, 0.42, torsoYaw + side * -0.35, 0),
        colorRgb: brassGold,
      });
    }

    const glove = trackGeo(out, new THREE.SphereGeometry(0.031, 6, 5));
    const gp = rotT(side * 0.188, 0.956, 0.306);
    out.matte.push({
      geo: glove,
      matrix: makeTransform(gp.x, gp.y, gp.z, 0, torsoYaw, 0, 0.92, 0.85, 1.12),
      colorRgb: darkCharcoal,
    });
  }

  const headMat = makeTransform(0, 1.528, 0.014, 0.04, torsoYaw + headYaw, 0);
  const headGeo = trackGeo(out, new THREE.SphereGeometry(0.095, 12, 9));
  out.armor.push({
    geo: headGeo,
    matrix: headMat.clone().multiply(makeTransform(0, 0.004, 0, 0, 0, 0, 0.90, 1.06, 0.98)),
    colorRgb: skinWeathered,
  });

  const browRidge = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.068, -0.010],
        [0.068, -0.010],
        [0.060, 0.014],
        [-0.060, 0.014],
      ],
      0.022,
      0.005,
      0.005,
      1,
      2,
    ),
  );
  out.armor.push({
    geo: browRidge,
    matrix: headMat.clone().multiply(makeTransform(0, 0.024, 0.074, 0.12, 0, 0)),
    colorRgb: skinWeathered,
  });
  const noseBridge = trackGeo(out, createTeardropPart(0.040, 0.012, 1.35, 6, 4, 0, skinWeathered, skinShadow));
  out.armor.push({
    geo: noseBridge,
    matrix: headMat.clone().multiply(makeTransform(0, -0.002, 0.088, -0.18, 0, 0)),
  });
  const eyeSocketShadow = trackGeo(out, new THREE.SphereGeometry(0.018, 6, 5));
  out.matte.push({
    geo: eyeSocketShadow,
    matrix: headMat.clone().multiply(makeTransform(0.032, 0.008, 0.082, 0, 0, 0, 1.25, 0.55, 0.55)),
    colorRgb: skinShadow,
  });

  const beardChin = trackGeo(out, createTeardropPart(0.118, 0.058, 1.32, 10, 7, 0.014, silverBeard, silverBeard));
  out.armor.push({
    geo: beardChin,
    matrix: headMat.clone().multiply(makeTransform(0, -0.058, 0.048, Math.PI + 0.18, 0, 0, 1.04, 1.0, 0.78)),
  });
  const beardJawCurve = trackGeo(
    out,
    createOrganicLimb(
      [
        [-0.072, -0.008, 0.046],
        [-0.056, -0.056, 0.072],
        [0.0, -0.086, 0.084],
        [0.056, -0.056, 0.072],
        [0.072, -0.008, 0.046],
      ],
      0.018,
      0.028,
      0.018,
      8,
      6,
      silverBeard,
      silverBeard,
    ),
  );
  out.armor.push({ geo: beardJawCurve, matrix: headMat });
  const mustache = trackGeo(
    out,
    createOrganicLimb(
      [
        [-0.048, -0.040, 0.082],
        [-0.016, -0.028, 0.098],
        [0.016, -0.028, 0.098],
        [0.048, -0.040, 0.082],
      ],
      0.008,
      0.013,
      0.008,
      6,
      4,
      silverBeard,
      silverBeard,
    ),
  );
  out.armor.push({ geo: mustache, matrix: headMat });

  const ocMat = headMat.clone().multiply(makeTransform(-0.036, 0.010, 0.092, 0, -0.16, 0));
  const ocBarrelA = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.027, 0.030, 10));
  ocBarrelA.rotateX(Math.PI * 0.5);
  const ocBarrelB = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.028, 10));
  ocBarrelB.rotateX(Math.PI * 0.5);
  const ocFocusRing = trackGeo(out, new THREE.TorusGeometry(0.023, 0.0045, 3, 10));
  const ocSidePrism = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.010, 0.024, 6));
  ocSidePrism.rotateX(Math.PI * 0.5);
  const amberLens = trackGeo(out, new THREE.SphereGeometry(0.017, 7, 5));

  out.trim.push(
    { geo: ocBarrelA, matrix: ocMat, colorRgb: brassGold },
    { geo: ocBarrelB, matrix: ocMat.clone().multiply(makeTransform(0, 0, 0.022)), colorRgb: agedBronze },
    { geo: ocSidePrism, matrix: ocMat.clone().multiply(makeTransform(-0.028, 0.010, 0.006)), colorRgb: brassGold },
  );
  out.matte.push({
    geo: ocFocusRing,
    matrix: ocMat.clone().multiply(makeTransform(0, 0, 0.014)),
    colorRgb: darkCharcoal,
  });
  out.energy.push(
    { geo: amberLens, matrix: ocMat.clone().multiply(makeTransform(0, 0, 0.036, 0, 0, 0, 1.0, 1.0, 0.45)), colorRgb: amberGlow },
    { geo: amberLens, matrix: ocMat.clone().multiply(makeTransform(-0.028, 0.010, 0.018, 0, 0, 0, 0.48, 0.48, 0.35)), colorRgb: holoCyan },
  );

  const monocleStrap = trackGeo(
    out,
    createOrganicLimb(
      [
        [-0.056, 0.012, 0.084],
        [-0.096, 0.020, 0.014],
        [-0.072, 0.020, -0.084],
      ],
      0.0055,
      0.0055,
      0.0055,
      5,
      4,
    ),
  );
  out.trim.push({ geo: monocleStrap, matrix: headMat, colorRgb: brassGold });

  const capProfile: readonly (readonly [number, number])[] = [
    [0.098, 0.0],
    [0.102, 0.044],
    [0.138, 0.096],
    [0.128, 0.118],
    [0.064, 0.128],
    [0.004, 0.132],
  ];
  const capCrown = trackGeo(out, createLathePart(capProfile, 14));
  const capRoot = headMat.clone().multiply(makeTransform(0, 0.066, -0.002, 0.12, 0, 0));
  out.armor.push({ geo: capCrown, matrix: capRoot, colorRgb: capWhite });

  const capBand = trackGeo(out, new THREE.TorusGeometry(0.101, 0.007, 4, 14));
  capBand.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: capBand,
    matrix: capRoot.clone().multiply(makeTransform(0, 0.018, 0)),
    colorRgb: brassGold,
  });

  const capVisor = trackGeo(out, createPetalPart(0.112, 0.168, 0.016, 0.014, 0.9, 5, 4, darkCharcoal, darkCharcoal));
  out.matte.push({
    geo: capVisor,
    matrix: capRoot.clone().multiply(makeTransform(0, 0.010, 0.056, Math.PI * 0.58, 0, 0)),
  });

  const capBadge = trackGeo(out, createFacetedCrystalPart(0.048, 0.024, 4, 0.5, 0.5, agedBronze, brassGold));
  out.trim.push({
    geo: capBadge,
    matrix: capRoot.clone().multiply(makeTransform(0, 0.068, 0.116, -0.18, 0, 0, 1.0, 1.0, 0.45)),
  });

  const helmCenter = rotT(0, 0.93, 0.405);
  const helmMat = makeTransform(helmCenter.x, helmCenter.y, helmCenter.z, -0.64, torsoYaw, 0);
  const helmOuterHolo = trackGeo(out, new THREE.TorusGeometry(0.242, 0.012, 4, 18));
  out.crystal.push({ geo: helmOuterHolo, matrix: helmMat, colorRgb: holoCyan });

  const helmBrassRim = trackGeo(out, new THREE.TorusGeometry(0.192, 0.010, 4, 18));
  const helmInnerGear = trackGeo(out, new THREE.TorusGeometry(0.086, 0.0085, 4, 12));
  out.trim.push(
    { geo: helmBrassRim, matrix: helmMat, colorRgb: brassGold },
    { geo: helmInnerGear, matrix: helmMat.clone().multiply(makeTransform(0, 0, -0.014)), colorRgb: agedBronze },
  );

  const spokeGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.0055, 0.276, 5));
  const handleKnob = trackGeo(out, new THREE.SphereGeometry(0.012, 5, 4));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const sMat = helmMat.clone().multiply(makeTransform(Math.cos(a) * 0.138, Math.sin(a) * 0.138, 0, 0, 0, a - Math.PI * 0.5));
    out.trim.push({ geo: spokeGeo, matrix: sMat, colorRgb: brassGold });
    out.trim.push({
      geo: handleKnob,
      matrix: helmMat.clone().multiply(makeTransform(Math.cos(a) * 0.275, Math.sin(a) * 0.275, 0)),
      colorRgb: agedBronze,
    });
  }

  const helmHub = trackGeo(out, new THREE.SphereGeometry(0.034, 7, 5));
  out.energy.push({ geo: helmHub, matrix: helmMat, colorRgb: amberGlow });

  const chartCenter = rotT(0, 1.16, 0.44);
  const chartMat = makeTransform(chartCenter.x, chartCenter.y, chartCenter.z, -0.34, torsoYaw, 0);
  const holoArcProfile: readonly (readonly [number, number])[] = [
    [0.34, -0.05],
    [0.36, 0.04],
    [0.31, 0.12],
  ];
  const holoChartPlate = trackGeo(out, createLathePart(holoArcProfile, 16));
  out.crystal.push({
    geo: holoChartPlate,
    matrix: chartMat.clone().multiply(makeTransform(0, -0.04, -0.04, Math.PI * 0.48, 0, 0, 1.0, 0.36, 0.60)),
    colorRgb: holoCyan,
  });

  const orbitA = trackGeo(out, new THREE.TorusGeometry(0.28, 0.0055, 4, 18));
  const orbitB = trackGeo(out, new THREE.TorusGeometry(0.20, 0.005, 4, 16));
  const orbitC = trackGeo(out, new THREE.TorusGeometry(0.35, 0.0045, 3, 20));
  const orbitMatA = chartMat.clone().multiply(makeTransform(0, 0.04, 0, 0.88, 0.32, 0.18));
  out.trim.push(
    { geo: orbitA, matrix: orbitMatA, colorRgb: brassGold },
    { geo: orbitB, matrix: chartMat.clone().multiply(makeTransform(0, 0.04, 0, -0.76, -0.45, 0.24)), colorRgb: brassGold },
    { geo: orbitC, matrix: chartMat.clone().multiply(makeTransform(0, 0.02, 0, 1.28, 0.12, -0.22)), colorRgb: agedBronze },
  );

  const tickGeo = trackGeo(out, new THREE.CylinderGeometry(0.0025, 0.0025, 0.026, 4));
  for (let tk = 0; tk < 8; tk += 1) {
    const a = (tk / 8) * Math.PI * 2;
    out.trim.push({
      geo: tickGeo,
      matrix: orbitMatA.clone().multiply(makeTransform(Math.cos(a) * 0.28, Math.sin(a) * 0.28, 0, 0, 0, a - Math.PI * 0.5)),
      colorRgb: brassGold,
    });
  }

  const miniHull = trackGeo(out, createTeardropPart(0.18, 0.026, 1.5, 8, 6, 0, holoCyan, capWhite));
  const miniWing = trackGeo(out, createCreatureFin(0.06, 0.11, 0.05, 0.008, 0.005, 5, 2, holoCyan, capWhite));
  const shipMat = chartMat.clone().multiply(makeTransform(0, 0.05, 0.02, 0.22, -0.58, 0.12));
  out.crystal.push({
    geo: miniHull,
    matrix: shipMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
    colorRgb: holoCyan,
  });
  for (const sgn of [-1, 1] as const) {
    out.energy.push({
      geo: miniWing,
      matrix: shipMat.clone().multiply(makeTransform(sgn * 0.018, 0, -0.02, 0, 0, 0, sgn, 1, 1)),
      colorRgb: holoCyan,
    });
  }

  const blip = trackGeo(out, new THREE.OctahedronGeometry(0.012, 0));
  const blips: readonly Vec3Tuple[] = [
    [-0.18, 0.11, 0.04],
    [0.21, 0.08, 0.06],
    [0.07, 0.16, 0.02],
    [-0.11, -0.02, 0.08],
  ];
  for (const [bx, by, bz] of blips) {
    out.energy.push({
      geo: blip,
      matrix: chartMat.clone().multiply(makeTransform(bx, by, bz, 0, 0.4, 0, 0.8, 1.4, 0.8)),
      colorRgb: amberGlow,
    });
  }

  const admiralArc = trackGeo(out, new THREE.TorusGeometry(0.52, 0.014, 4, 20));
  out.wingParts.push({
    geo: admiralArc,
    matrix: makeTransform(0, 1.22, -0.18, 0.06, 0, 0),
    colorRgb: brassGold,
  });

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.36;
  out.crystalIntensity = 0.56;
  out.weaponGlowHex = 0xf59e0b;
  out.headTopLocalY = 1.76;
}

function buildS36AbyssalSingularity(out: UnitBlueprintParts): void {
  const absoluteVoid: RgbTriple = [0.005, 0.005, 0.010];
  const obsidianDark: RgbTriple = [0.05, 0.05, 0.09];
  const obsidianEdge: RgbTriple = [0.18, 0.12, 0.18];
  const moltenGold: RgbTriple = [1.0, 0.80, 0.30];
  const whiteGold: RgbTriple = [1.0, 0.94, 0.68];
  const darkCrimson: RgbTriple = [0.84, 0.10, 0.22];
  const abyssalCrimson: RgbTriple = [0.56, 0.06, 0.16];

  const centerY = 1.04;
  const centerMat = makeTransform(0, centerY, 0);

  const voidCore = trackGeo(out, new THREE.SphereGeometry(0.258, 22, 16));
  out.matte.push({ geo: voidCore, matrix: centerMat, colorRgb: absoluteVoid });

  const photonRim = trackGeo(out, new THREE.TorusGeometry(0.276, 0.010, 6, 30));
  out.energy.push({
    geo: photonRim,
    matrix: makeTransform(0, centerY, 0, 0.14, 0.30, 0),
    colorRgb: whiteGold,
  });

  const lensingHaloRing = trackGeo(out, new THREE.TorusGeometry(0.320, 0.022, 6, 28));
  out.crystal.push({
    geo: lensingHaloRing,
    matrix: makeTransform(0, centerY, 0, 0.14, 0.30, 0),
    colorRgb: darkCrimson,
  });

  const ring1Mat = makeTransform(0, centerY, 0, 0.34, 0.22, -0.20);
  const ring1Ribbon = buildWarpedAccretionRing(
    out,
    0.465,
    [0.092, 0.114, 0.092],
    0.108,
    2,
    0.25,
    0.044,
    3,
    30,
    3,
    0,
    moltenGold,
    darkCrimson,
  );
  out.energy.push({ geo: ring1Ribbon, matrix: ring1Mat });

  const ring1Crystal = buildWarpedAccretionRing(
    out,
    0.508,
    [0.096, 0.124, 0.096],
    0.132,
    2,
    0.55,
    0.054,
    3,
    28,
    3,
    0,
    whiteGold,
    abyssalCrimson,
  );
  out.crystal.push({ geo: ring1Crystal, matrix: ring1Mat });

  const ring2Mat = makeTransform(0, centerY, 0, 1.14, -0.48, 0.62);
  const ring2Ribbon = buildWarpedAccretionRing(
    out,
    0.542,
    [0.058, 0.078, 0.058],
    0.140,
    3,
    1.10,
    0.050,
    2,
    30,
    3,
    0,
    darkCrimson,
    moltenGold,
  );
  out.trim.push({ geo: ring2Ribbon, matrix: ring2Mat });

  const ring2Fil = buildWarpedFilament(out, 0.560, 0.142, 3, 1.10, 0.050, 2, 0.0085, 30, 6);
  out.energy.push({ geo: ring2Fil, matrix: ring2Mat, colorRgb: moltenGold });

  const ring3Mat = makeTransform(0, centerY, 0, -0.86, 0.72, -1.08);
  const ring3Ribbon = buildWarpedAccretionRing(
    out,
    0.492,
    [0.054, 0.074, 0.054],
    0.128,
    2,
    2.15,
    0.040,
    3,
    28,
    3,
    0,
    abyssalCrimson,
    moltenGold,
  );
  out.crystal.push({ geo: ring3Ribbon, matrix: ring3Mat });

  const ring3Fil = buildWarpedFilament(out, 0.484, 0.120, 2, 2.15, 0.038, 3, 0.008, 28, 6);
  out.energy.push({ geo: ring3Fil, matrix: ring3Mat, colorRgb: darkCrimson });

  for (let s = 0; s < 3; s += 1) {
    const phase = (s / 3) * Math.PI * 2;
    const pts: Vec3Tuple[] = [];
    for (let k = 0; k <= 10; k += 1) {
      const t = k / 10;
      const a = phase + t * Math.PI * 1.65;
      const r = 0.57 - t * 0.29;
      const y = centerY + Math.sin(t * Math.PI * 2 + phase) * 0.28;
      pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const infall = trackGeo(out, createTaperedTubePart(pts, 0.012, 0.0035, 14, 6));
    out.energy.push({ geo: infall, colorRgb: s === 0 ? whiteGold : moltenGold });
  }

  const upVec = new THREE.Vector3(0, 1, 0);
  const qShard = new THREE.Quaternion();
  const dirShard = new THREE.Vector3();
  const shardBand = trackGeo(out, new THREE.TorusGeometry(0.054, 0.007, 6, 14));
  shardBand.rotateX(Math.PI * 0.5);
  const shardTip = trackGeo(out, new THREE.SphereGeometry(0.016, 8, 6));

  for (let i = 0; i < 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2 + 0.22;
    const radius = 0.61 + (i % 3) * 0.055;
    const yOff = Math.sin(ang * 2 + 0.5) * 0.52 + ((i % 2) * 2 - 1) * 0.18;
    const sx = Math.cos(ang) * radius;
    const sy = centerY + yOff;
    const sz = Math.sin(ang) * radius;

    const shardLen = 0.28 + (i % 3) * 0.055;
    const shardRad = 0.054 + (i % 2) * 0.014;
    const shardGeo = trackGeo(
      out,
      createFacetedCrystalPart(shardLen, shardRad, 5 + (i % 2), 0.64, 0.36, obsidianDark, obsidianEdge),
    );

    dirShard.set(-sx, centerY - sy, -sz).normalize();
    qShard.setFromUnitVectors(upVec, dirShard);
    const spin = new THREE.Quaternion().setFromAxisAngle(upVec, i * 0.9);
    qShard.multiply(spin);

    const shardMat = new THREE.Matrix4().compose(
      new THREE.Vector3(sx, sy, sz),
      qShard,
      new THREE.Vector3(1.0, 1.0, 0.84),
    );

    out.armor.push({ geo: shardGeo, matrix: shardMat });
    out.trim.push({
      geo: shardBand,
      matrix: shardMat.clone().multiply(makeTransform(0, 0.01, 0, 0, 0, 0, shardRad / 0.054, 1.0, shardRad / 0.054)),
      colorRgb: i % 2 === 0 ? moltenGold : darkCrimson,
    });
    out.energy.push({
      geo: shardTip,
      matrix: shardMat.clone().multiply(makeTransform(0, shardLen * 0.62, 0)),
      colorRgb: i % 2 === 0 ? whiteGold : darkCrimson,
    });
  }

  const abyssCrown = trackGeo(out, new THREE.TorusGeometry(0.70, 0.014, 6, 28));
  out.wingParts.push(
    { geo: abyssCrown, matrix: makeTransform(0, centerY, 0, 0.55, 0.32, 0.44), colorRgb: moltenGold },
    { geo: abyssCrown, matrix: makeTransform(0, centerY, 0, -0.55, -0.32, -0.44), colorRgb: darkCrimson },
  );

  out.crystalHex = 0xe11d48;
  out.crystalOpacity = 0.38;
  out.crystalIntensity = 0.72;
  out.weaponGlowHex = 0xf59e0b;
  out.headTopLocalY = 1.92;
}

export const UNIT_PACK_4_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S29: (_ctx, out) => buildS29RelativisticCruiser(out),
  S30: (_ctx, out) => buildS30WhiteDwarfBeacon(out),
  S31: (_ctx, out) => buildS31UnuploadedHuman(out),
  S32: (_ctx, out) => buildS32EntropySingularity(out),
  S34: (_ctx, out) => buildS34CenturyDelayedPioneer(out),
  S35: (_ctx, out) => buildS35RetiredAdmiral(out),
  S36: (_ctx, out) => buildS36AbyssalSingularity(out),
};
