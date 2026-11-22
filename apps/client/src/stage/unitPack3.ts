import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createCreatureFin,
  createCurvedBladePart,
  createCurvedVisorPart,
  createFacetedCrystalPart,
  createFlowingRibbonMesh,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createSculptedClothLathe,
  createTaperedTubePart,
  createTeardropPart,
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type Vec3Tuple,
} from './unitBuilderCore.js';

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

export const UNIT_PACK_3_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S20: (_ctx, out) => {
    const porcelain: RgbTriple = [0.95, 0.97, 1.0];
    const pearlIce: RgbTriple = [0.80, 0.89, 0.99];
    const carbonDark: RgbTriple = [0.13, 0.17, 0.25];
    const laserGold: RgbTriple = [0.99, 0.84, 0.44];
    const sapphireBright: RgbTriple = [0.42, 0.88, 1.0];
    const sapphireDeep: RgbTriple = [0.16, 0.52, 0.98];

    const centerY = 0.98;

    const lowerSpindle = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.008, 0.0],
          [0.048, 0.09],
          [0.098, 0.22],
          [0.142, 0.36],
          [0.118, 0.46],
          [0.056, 0.50],
        ],
        20,
        0,
        0,
        0.5,
        pearlIce,
        porcelain,
      ),
    );
    out.armor.push({
      geo: lowerSpindle,
      matrix: makeTransform(0, 0.30, 0, 0, 0, 0, 1.0, 1.0, 0.88),
    });

    const upperCrown = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.062, 0.0],
          [0.138, 0.07],
          [0.156, 0.18],
          [0.122, 0.31],
          [0.064, 0.42],
          [0.012, 0.49],
        ],
        20,
        0,
        0,
        0.5,
        porcelain,
        pearlIce,
      ),
    );
    out.armor.push({
      geo: upperCrown,
      matrix: makeTransform(0, 1.08, 0, 0, 0, 0, 1.0, 1.0, 0.88),
    });

    const cryostatCore = trackGeo(out, new THREE.CylinderGeometry(0.058, 0.058, 0.34, 14));
    out.matte.push({
      geo: cryostatCore,
      matrix: makeTransform(0, 0.96, 0),
      colorRgb: carbonDark,
    });

    const collarRing = trackGeo(out, new THREE.TorusGeometry(0.112, 0.012, 8, 22));
    out.trim.push(
      { geo: collarRing, matrix: makeTransform(0, 0.80, 0, Math.PI * 0.5, 0, 0), colorRgb: laserGold },
      { geo: collarRing, matrix: makeTransform(0, 1.13, 0, Math.PI * 0.5, 0, 0), colorRgb: laserGold },
    );

    const centralProcessor = trackGeo(out, new THREE.OctahedronGeometry(0.088, 1));
    out.energy.push({
      geo: centralProcessor,
      matrix: makeTransform(0, 0.96, 0, 0, Math.PI * 0.25, 0, 1.0, 1.35, 1.0),
      colorRgb: sapphireBright,
    });

    const dataSpineBeam = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 1.32, 10));
    out.energy.push({
      geo: dataSpineBeam,
      matrix: makeTransform(0, 0.98, 0),
      colorRgb: sapphireBright,
    });

    const coreShieldShell = trackGeo(out, createFacetedCrystalPart(0.46, 0.145, 6, 0.52, 0.48, sapphireDeep, sapphireBright));
    out.crystal.push({
      geo: coreShieldShell,
      matrix: makeTransform(0, 0.96, 0),
    });

    const outerGoldRing = trackGeo(out, new THREE.TorusGeometry(0.42, 0.014, 8, 30));
    const innerGoldRing = trackGeo(out, new THREE.TorusGeometry(0.31, 0.011, 8, 26));
    const ringMatA = makeTransform(0, centerY, -0.02, 0.24, 0.18, -0.16);
    const ringMatB = makeTransform(0, centerY, -0.02, -0.34, -0.22, 0.28);
    out.trim.push(
      { geo: outerGoldRing, matrix: ringMatA, colorRgb: laserGold },
      { geo: innerGoldRing, matrix: ringMatB, colorRgb: laserGold },
    );

    const relayPrism = trackGeo(out, createFacetedCrystalPart(0.075, 0.024, 4, 0.5, 0.5, sapphireDeep, sapphireBright));
    const relayClamp = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 0.036, 8));
    const laserRayGeo = trackGeo(out, new THREE.CylinderGeometry(0.004, 0.004, 0.82, 6));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const rx = Math.cos(a) * 0.42;
      const ry = Math.sin(a) * 0.42;
      out.matte.push({
        geo: relayClamp,
        matrix: ringMatA.clone().multiply(makeTransform(rx, ry, 0, 0, 0, a)),
        colorRgb: carbonDark,
      });
      out.crystal.push({
        geo: relayPrism,
        matrix: ringMatA.clone().multiply(makeTransform(rx * 0.92, ry * 0.92, 0, 0, 0, a + Math.PI * 0.5)),
      });
    }
    out.energy.push(
      { geo: laserRayGeo, matrix: ringMatA.clone().multiply(makeTransform(0, 0, 0, 0, 0, Math.PI * 0.25)), colorRgb: sapphireBright },
      { geo: laserRayGeo, matrix: ringMatA.clone().multiply(makeTransform(0, 0, 0, 0, 0, -Math.PI * 0.25)), colorRgb: sapphireBright },
    );

    const chipBladeCrystal = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.026],
          [0.36, -0.040],
          [0.54, 0.0],
          [0.36, 0.040],
          [0.0, 0.026],
        ],
        0.016,
        0.005,
        0.005,
        1,
        4,
      ),
    );
    const chipSparArmor = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.03, -0.028],
          [0.24, -0.018],
          [0.32, 0.0],
          [0.24, 0.018],
          [-0.03, 0.028],
        ],
        0.024,
        0.005,
        0.005,
        1,
        4,
      ),
    );
    const chipGoldBus = trackGeo(out, createTaperedTubePart([[0.02, 0, 0.014], [0.24, 0, 0.016], [0.48, 0, 0.008]], 0.009, 0.003, 10, 6));
    const chipTipNode = trackGeo(out, new THREE.OctahedronGeometry(0.018, 0));

    const wingTiers: readonly (readonly [number, number, number, number, number])[] = [
      [0.22, 1.30, -0.14, 0.44, 1.04],
      [0.26, 1.00, -0.18, 0.06, 1.12],
      [0.20, 0.70, -0.14, -0.34, 0.92],
    ];

    for (const side of [-1, 1] as const) {
      for (const [ox, oy, oz, pitchZ, scaleLen] of wingTiers) {
        const wMat = makeTransform(
          side * ox,
          oy,
          oz,
          0.08,
          side * 0.24,
          side * pitchZ,
          side * scaleLen,
          1.0,
          1.0,
        );
        out.armor.push({ geo: chipSparArmor, matrix: wMat, colorRgb: porcelain });
        out.crystal.push({
          geo: chipBladeCrystal,
          matrix: wMat.clone().multiply(makeTransform(0.04, 0, 0)),
          colorRgb: sapphireBright,
        });
        out.trim.push({ geo: chipGoldBus, matrix: wMat, colorRgb: laserGold });
        out.matte.push({
          geo: relayClamp,
          matrix: wMat.clone().multiply(makeTransform(0.02, 0, 0, 0, 0, Math.PI * 0.5)),
          colorRgb: carbonDark,
        });
        out.energy.push({
          geo: chipTipNode,
          matrix: wMat.clone().multiply(makeTransform(0.51, 0, 0)),
          colorRgb: sapphireBright,
        });
      }
    }

    const verdictCrystal = trackGeo(out, createFacetedCrystalPart(0.32, 0.072, 6, 0.58, 0.42, sapphireDeep, sapphireBright));
    const verdictFrame = trackGeo(out, new THREE.TorusGeometry(0.095, 0.010, 8, 22));
    out.crystal.push({ geo: verdictCrystal, matrix: makeTransform(0, 1.66, 0.04) });
    out.energy.push({
      geo: trackGeo(out, createFacetedCrystalPart(0.18, 0.032, 4, 0.55, 0.45)),
      matrix: makeTransform(0, 1.66, 0.04),
      colorRgb: sapphireBright,
    });
    out.trim.push({
      geo: verdictFrame,
      matrix: makeTransform(0, 1.64, 0.04, Math.PI * 0.5, 0.22, 0),
      colorRgb: laserGold,
    });

    const aimNeedle = trackGeo(out, createFacetedCrystalPart(0.28, 0.026, 4, 0.72, 0.28, sapphireDeep, sapphireBright));
    for (const side of [-1, 1] as const) {
      out.crystal.push({
        geo: aimNeedle,
        matrix: makeTransform(side * 0.16, 0.96, 0.24, Math.PI * 0.5, 0, side * 0.14),
      });
      out.trim.push({
        geo: relayClamp,
        matrix: makeTransform(side * 0.16, 0.96, 0.14, Math.PI * 0.5, 0, 0),
        colorRgb: laserGold,
      });
    }

    const haloCrownWing = trackGeo(out, new THREE.TorusGeometry(0.56, 0.014, 8, 26));
    out.wingParts.push(
      { geo: haloCrownWing, matrix: makeTransform(0, 1.00, -0.22, 0.12, 0, 0) },
      { geo: chipSparArmor, matrix: makeTransform(-0.34, 1.44, -0.20, 0, -0.24, -0.68, -1.1, 1.0, 1.0) },
      { geo: chipSparArmor, matrix: makeTransform(0.34, 1.44, -0.20, 0, 0.24, 0.68, 1.1, 1.0, 1.0) },
    );

    out.headTopLocalY = 1.86;
    out.weaponGlowHex = 0x38bdf8;
    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.56;
    out.crystalIntensity = 0.54;
  },

  S21: (_ctx, out) => {
    const porcelain: RgbTriple = [0.95, 0.98, 1.0];
    const glacierBlue: RgbTriple = [0.76, 0.90, 1.0];
    const carbonDark: RgbTriple = [0.14, 0.19, 0.28];
    const platinumGold: RgbTriple = [0.96, 0.88, 0.64];
    const photonCyan: RgbTriple = [0.46, 0.88, 1.0];
    const sapphireHeart: RgbTriple = [0.18, 0.54, 1.0];

    const centerY = 0.96;

    const baseEmitter = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.015, 0.0],
          [0.14, 0.02],
          [0.21, 0.06],
          [0.16, 0.10],
          [0.07, 0.13],
        ],
        18,
        0,
        0,
        0.5,
        glacierBlue,
        porcelain,
      ),
    );
    out.armor.push({ geo: baseEmitter, matrix: makeTransform(0, 0.22, 0) });
    out.trim.push({
      geo: trackGeo(out, new THREE.TorusGeometry(0.205, 0.010, 7, 22)),
      matrix: makeTransform(0, 0.28, 0, Math.PI * 0.5, 0, 0),
      colorRgb: platinumGold,
    });
    out.energy.push({
      geo: trackGeo(out, new THREE.TorusGeometry(0.115, 0.009, 6, 20)),
      matrix: makeTransform(0, 0.35, 0, Math.PI * 0.5, 0, 0),
      colorRgb: photonCyan,
    });

    const heartInnerCore = trackGeo(out, new THREE.OctahedronGeometry(0.115, 1));
    out.energy.push({
      geo: heartInnerCore,
      matrix: makeTransform(0, centerY, 0, 0, Math.PI * 0.25, 0, 1.0, 1.42, 1.0),
      colorRgb: photonCyan,
    });

    const heartSapphire = trackGeo(out, createFacetedCrystalPart(0.50, 0.185, 8, 0.54, 0.46, sapphireHeart, photonCyan));
    out.crystal.push({
      geo: heartSapphire,
      matrix: makeTransform(0, centerY, 0),
    });

    const heartInnerCage = trackGeo(out, createFacetedCrystalPart(0.36, 0.140, 6, 0.5, 0.5, photonCyan, porcelain));
    out.crystal.push({
      geo: heartInnerCage,
      matrix: makeTransform(0, centerY, 0, 0, Math.PI / 6, 0),
    });

    const gimbalRingA = trackGeo(out, new THREE.TorusGeometry(0.25, 0.010, 6, 22));
    const gimbalRingB = trackGeo(out, new THREE.TorusGeometry(0.30, 0.008, 6, 22));
    out.trim.push(
      { geo: gimbalRingA, matrix: makeTransform(0, centerY, 0, 0.42, 0.30, 0), colorRgb: platinumGold },
      { geo: gimbalRingB, matrix: makeTransform(0, centerY, 0, -0.58, -0.42, 0.24), colorRgb: platinumGold },
    );

    const poleCap = trackGeo(out, createTeardropPart(0.16, 0.042, 1.45, 12, 8, 0, carbonDark, platinumGold));
    out.matte.push(
      { geo: poleCap, matrix: makeTransform(0, centerY + 0.32, 0) },
      { geo: poleCap, matrix: makeTransform(0, centerY - 0.32, 0, Math.PI, 0, 0) },
    );

    const maskOuter = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.175],
          [0.072, -0.115],
          [0.108, 0.010],
          [0.102, 0.115],
          [0.056, 0.165],
          [0.0, 0.178],
          [-0.056, 0.165],
          [-0.102, 0.115],
          [-0.108, 0.010],
          [-0.072, -0.115],
        ],
        0.022,
        0.008,
        0.008,
        1,
        4,
      ),
    );
    const maskHoloVisor = trackGeo(out, createCurvedVisorPart(0.118, 0.175, 0.095, 1.55, 0.85, 1.38, 12, 6));
    const maskBrowArch = trackGeo(
      out,
      createTaperedTubePart(
        [
          [-0.095, 0.075, 0.032],
          [0.0, 0.115, 0.068],
          [0.095, 0.075, 0.032],
        ],
        0.008,
        0.008,
        10,
        5,
      ),
    );
    const maskJawTrace = trackGeo(
      out,
      createTaperedTubePart(
        [
          [-0.088, -0.055, 0.024],
          [0.0, -0.168, 0.048],
          [0.088, -0.055, 0.024],
        ],
        0.007,
        0.007,
        10,
        5,
      ),
    );
    const maskEyeSlit = trackGeo(out, createCurvedVisorPart(0.114, 0.020, 0.102, 1.15, 1.36, 0.22, 10, 3));
    const maskBackNode = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.022, 0.042, 10));

    const maskConfigs: readonly (readonly [number, number, number, number, number, number])[] = [
      [-0.44, 1.18, 0.16, 0.06, -0.46, 0.08],
      [0.44, 1.06, 0.18, -0.04, 0.56, -0.06],
      [0.04, 1.44, -0.20, 0.12, 0.14, 0.03],
    ];

    for (let i = 0; i < maskConfigs.length; i += 1) {
      const [mx, my, mz, rx, ry, rz] = maskConfigs[i]!;
      const mMat = makeTransform(mx, my, mz, rx, ry, rz);

      out.armor.push({
        geo: maskOuter,
        matrix: mMat,
        colorRgb: i === 1 ? glacierBlue : porcelain,
      });
      out.crystal.push({
        geo: maskHoloVisor,
        matrix: mMat.clone().multiply(makeTransform(0, 0.0, -0.012)),
        colorRgb: photonCyan,
      });
      out.trim.push(
        { geo: maskBrowArch, matrix: mMat, colorRgb: platinumGold },
        { geo: maskJawTrace, matrix: mMat, colorRgb: platinumGold },
      );
      out.energy.push({
        geo: maskEyeSlit,
        matrix: mMat.clone().multiply(makeTransform(0, 0.025, 0.002)),
        colorRgb: photonCyan,
      });
      out.matte.push({
        geo: maskBackNode,
        matrix: mMat.clone().multiply(makeTransform(0, 0.0, -0.026, Math.PI * 0.5, 0, 0)),
        colorRgb: carbonDark,
      });
    }

    for (let h = 0; h < 3; h += 1) {
      const phase = (h / 3) * Math.PI * 2;
      const pts: Vec3Tuple[] = [];
      for (let k = 0; k <= 12; k += 1) {
        const t = k / 12;
        const a = phase + t * Math.PI * 2.4;
        const r = 0.22 + Math.sin(t * Math.PI) * 0.30;
        const y = 0.28 + t * 1.36;
        pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      const wire = trackGeo(out, createTaperedTubePart(pts, 0.010, 0.006, 18, 5));
      if (h === 0) {
        out.trim.push({ geo: wire, colorRgb: platinumGold });
      } else {
        out.energy.push({ geo: wire, colorRgb: photonCyan });
      }
      if (h < 2) {
        const ribbon = trackGeo(
          out,
          createFlowingRibbonMesh(pts, [0.012, 0.048, 0.010], 0.012, 2.0, 18, 2, 0.0, glacierBlue, photonCyan),
        );
        out.crystal.push({ geo: ribbon });
      }
    }

    const zenithHalo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.010, 6, 22));
    out.trim.push({
      geo: zenithHalo,
      matrix: makeTransform(0, 1.68, 0, Math.PI * 0.5, 0, 0),
      colorRgb: platinumGold,
    });
    out.wingParts.push(
      { geo: zenithHalo, matrix: makeTransform(0, 1.02, -0.22, 0.14, 0, 0, 2.1, 2.1, 1.0) },
      { geo: heartSapphire, matrix: makeTransform(-0.48, 1.24, -0.18, 0, 0, 0.42, 0.55, 0.85, 0.55) },
      { geo: heartSapphire, matrix: makeTransform(0.48, 1.24, -0.18, 0, 0, -0.42, 0.55, 0.85, 0.55) },
    );

    out.headTopLocalY = 1.76;
    out.weaponGlowHex = 0x60a5fa;
    out.crystalHex = 0x3b82f6;
    out.crystalOpacity = 0.56;
    out.crystalIntensity = 0.58;
  },

  S22: (_ctx, out) => {
    const mirrorSilver: RgbTriple = [0.92, 0.95, 0.99];
    const gunmetal: RgbTriple = [0.46, 0.51, 0.59];
    const carbonVoid: RgbTriple = [0.11, 0.13, 0.18];
    const crimsonCore: RgbTriple = [1.0, 0.24, 0.28];
    const crimsonDeep: RgbTriple = [0.85, 0.10, 0.22];

    const centerY = 0.96;

    const motherCore = trackGeo(out, new THREE.IcosahedronGeometry(0.155, 1));
    out.energy.push({
      geo: motherCore,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: crimsonCore,
    });

    const coreCageRing = trackGeo(out, new THREE.TorusGeometry(0.21, 0.015, 7, 22));
    out.matte.push(
      { geo: coreCageRing, matrix: makeTransform(0, centerY, 0, 0.45, 0.30, 0), colorRgb: carbonVoid },
      { geo: coreCageRing, matrix: makeTransform(0, centerY, 0, -0.62, 0.54, 0.38), colorRgb: carbonVoid },
      { geo: coreCageRing, matrix: makeTransform(0, centerY, 0, 1.15, -0.40, 0.22), colorRgb: carbonVoid },
    );

    const coreArmorShell = trackGeo(out, createCurvedVisorPart(0.225, 0.225, 0.225, 1.05, 0.95, 0.95, 10, 6));
    for (let s = 0; s < 4; s += 1) {
      const a = (s / 4) * Math.PI * 2 + 0.35;
      out.armor.push({
        geo: coreArmorShell,
        matrix: makeTransform(0, centerY, 0, s % 2 === 0 ? 0.35 : -0.35, a, 0),
        colorRgb: gunmetal,
      });
    }

    const fieldBubble = trackGeo(out, new THREE.IcosahedronGeometry(0.265, 1));
    out.crystal.push({
      geo: fieldBubble,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: crimsonDeep,
    });

    const nanoHex = trackGeo(out, createHexMirrorTilePart(0.105, 0.020, 0.010, 0.010, mirrorSilver, gunmetal));
    const nanoChevron = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.085, -0.028],
          [0.0, 0.082],
          [0.085, -0.028],
          [0.044, -0.056],
          [0.0, 0.018],
          [-0.044, -0.056],
        ],
        0.016,
        0.004,
        0.004,
        1,
        3,
      ),
    );
    const nanoSpine = trackGeo(out, createFacetedCrystalPart(0.15, 0.024, 5, 0.62, 0.38, carbonVoid, gunmetal));
    const nanoEye = trackGeo(out, new THREE.OctahedronGeometry(0.018, 0));

    const nodePositions: THREE.Vector3[] = [];
    const upRef = new THREE.Vector3(0, 0, 1);
    const tangent = new THREE.Vector3();
    const qAlign = new THREE.Quaternion();

    for (let i = 0; i < 16; i += 1) {
      const t = i / 15;
      const arm = i % 2;
      const theta = t * Math.PI * 3.15 + arm * Math.PI + 0.25;
      const r = 0.34 + Math.sin(t * Math.PI) * 0.30 + (arm === 0 ? 0.03 : -0.02);
      const y = 0.38 + t * 1.18 + Math.sin(theta * 1.5) * 0.05;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      const pos = new THREE.Vector3(x, y, z);
      nodePositions.push(pos);

      tangent.set(-Math.sin(theta), 0.38, Math.cos(theta)).normalize();
      qAlign.setFromUnitVectors(upRef, tangent);
      const scale = 0.78 + Math.sin(t * Math.PI) * 0.34;
      const nMat = new THREE.Matrix4().compose(pos, qAlign, new THREE.Vector3(scale, scale, scale));

      out.trim.push({ geo: nanoHex, matrix: nMat });
      out.armor.push({
        geo: nanoChevron,
        matrix: nMat.clone().multiply(makeTransform(0, 0.01, -0.014, 0, 0, 0)),
        colorRgb: mirrorSilver,
      });
      out.matte.push({
        geo: nanoSpine,
        matrix: nMat.clone().multiply(makeTransform(0, -0.01, -0.022, 0, 0, 0)),
        colorRgb: carbonVoid,
      });
      out.energy.push({
        geo: nanoEye,
        matrix: nMat.clone().multiply(makeTransform(0, 0, 0.024)),
        colorRgb: crimsonCore,
      });
    }

    const unitBeam = trackGeo(out, new THREE.CylinderGeometry(0.0055, 0.0055, 1.0, 6));
    const coreOrigin = new THREE.Vector3(0, centerY, 0);

    for (let i = 0; i < nodePositions.length; i += 1) {
      const p = nodePositions[i]!;
      if (i + 2 < nodePositions.length) {
        out.energy.push({
          geo: unitBeam,
          matrix: makeSegmentTransform(p, nodePositions[i + 2]!, 1.0),
          colorRgb: crimsonCore,
        });
      }
      if (i % 3 === 0) {
        out.energy.push({
          geo: unitBeam,
          matrix: makeSegmentTransform(coreOrigin, p, 0.82),
          colorRgb: crimsonDeep,
        });
      }
    }

    for (let arm = 0; arm < 2; arm += 1) {
      const ribbonPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 14; k += 1) {
        const t = k / 14;
        const theta = t * Math.PI * 3.15 + arm * Math.PI + 0.25;
        const r = 0.33 + Math.sin(t * Math.PI) * 0.30;
        const y = 0.38 + t * 1.18;
        ribbonPts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
      }
      const vortexRibbon = trackGeo(
        out,
        createFlowingRibbonMesh(ribbonPts, [0.014, 0.044, 0.012], 0.010, 2.0, 22, 3, 0.0, crimsonDeep, crimsonCore),
      );
      out.crystal.push({ geo: vortexRibbon });
    }

    const swarmCrown = trackGeo(out, new THREE.TorusGeometry(0.58, 0.014, 8, 26));
    out.wingParts.push(
      { geo: swarmCrown, matrix: makeTransform(0, 0.98, -0.12, 0.24, 0.18, 0) },
      { geo: nanoHex, matrix: makeTransform(-0.56, 1.34, -0.14, 0, 0.4, 0.2, 1.4, 1.4, 1.4) },
      { geo: nanoHex, matrix: makeTransform(0.56, 1.34, -0.14, 0, -0.4, -0.2, 1.4, 1.4, 1.4) },
    );

    out.headTopLocalY = 1.70;
    out.weaponGlowHex = 0xef4444;
    out.crystalHex = 0xf43f5e;
    out.crystalOpacity = 0.44;
    out.crystalIntensity = 0.56;
  },

  S23: (_ctx, out) => {
    const hullSilver: RgbTriple = [0.90, 0.94, 0.99];
    const hullSteel: RgbTriple = [0.64, 0.74, 0.86];
    const carbonDark: RgbTriple = [0.14, 0.19, 0.28];
    const expeditionGold: RgbTriple = [0.97, 0.81, 0.42];
    const ionBlue: RgbTriple = [0.34, 0.88, 1.0];
    const deepIon: RgbTriple = [0.14, 0.48, 0.98];

    const ship = makeTransform(0.0, 0.96, 0.02, -0.09, -0.34, 0.11);

    const primaryHull = trackGeo(
      out,
      createTeardropPart(1.38, 0.165, 1.52, 20, 14, 0.015, hullSteel, hullSilver),
    );
    out.armor.push({
      geo: primaryHull,
      matrix: ship.clone().multiply(makeTransform(0, 0, 0.04, Math.PI * 0.5, 0, 0, 1.18, 1.0, 0.72)),
    });

    const prowRam = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.012, 0.0],
          [0.064, 0.08],
          [0.118, 0.18],
          [0.144, 0.28],
        ],
        14,
        0,
        0,
        0.5,
        expeditionGold,
        hullSilver,
      ),
    );
    out.trim.push({
      geo: prowRam,
      matrix: ship.clone().multiply(makeTransform(0, 0, 0.72, -Math.PI * 0.5, 0, 0, 1.14, 1.0, 0.72)),
    });

    const hullCollar = trackGeo(out, new THREE.CylinderGeometry(0.158, 0.164, 0.14, 20));
    out.trim.push({
      geo: hullCollar,
      matrix: ship.clone().multiply(makeTransform(0, 0, 0.12, Math.PI * 0.5, 0, 0, 1.18, 1.0, 0.72)),
      colorRgb: expeditionGold,
    });

    const keelSpine = trackGeo(
      out,
      createOrganicLimb(
        [
          [0, -0.105, 0.46],
          [0, -0.125, -0.02],
          [0, -0.085, -0.52],
        ],
        0.026,
        0.036,
        0.022,
        12,
        8,
        carbonDark,
        carbonDark,
      ),
    );
    out.matte.push({ geo: keelSpine, matrix: ship });

    const bridgeFin = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.22, 0.0],
          [0.14, 0.0],
          [0.04, 0.13],
          [-0.18, 0.11],
        ],
        0.052,
        0.008,
        0.008,
        1,
        3,
      ),
    );
    out.armor.push({
      geo: bridgeFin,
      matrix: ship.clone().multiply(makeTransform(0, 0.095, -0.16, 0, Math.PI * 0.5, 0)),
      colorRgb: hullSilver,
    });
    const bridgeSlit = trackGeo(out, createCurvedVisorPart(0.034, 0.016, 0.056, 1.2, 1.2, 0.4, 8, 3));
    out.energy.push({
      geo: bridgeSlit,
      matrix: ship.clone().multiply(makeTransform(0, 0.16, -0.08)),
      colorRgb: ionBlue,
    });

    const railDeck = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.085, -0.44],
          [0.085, -0.44],
          [0.056, 0.46],
          [0.0, 0.56],
          [-0.056, 0.46],
        ],
        0.020,
        0.006,
        0.006,
        1,
        3,
      ),
    );
    const railCoilLine = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0, 0, -0.38],
          [0, 0, 0.08],
          [0, 0, 0.54],
        ],
        0.011,
        0.007,
        10,
        5,
      ),
    );
    const deckPylon = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.018, 0.11, 8));

    for (const vSign of [-1, 1] as const) {
      const dy = vSign * 0.155;
      out.armor.push({
        geo: railDeck,
        matrix: ship.clone().multiply(makeTransform(0, dy, 0.24, Math.PI * 0.5, 0, 0)),
        colorRgb: hullSilver,
      });
      for (const side of [-1, 1] as const) {
        out.trim.push({
          geo: railCoilLine,
          matrix: ship.clone().multiply(makeTransform(side * 0.068, dy - vSign * 0.014, 0.24)),
          colorRgb: expeditionGold,
        });
        out.energy.push({
          geo: railCoilLine,
          matrix: ship.clone().multiply(makeTransform(side * 0.036, dy - vSign * 0.018, 0.24, 0, 0, 0, 0.72, 0.72, 1.0)),
          colorRgb: ionBlue,
        });
      }
      for (const pz of [-0.08, 0.28]) {
        out.matte.push({
          geo: deckPylon,
          matrix: ship.clone().multiply(makeTransform(0, vSign * 0.105, pz)),
          colorRgb: carbonDark,
        });
      }
    }

    const railTunnel = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.072, 0.84, 14, 1, true));
    out.crystal.push({
      geo: railTunnel,
      matrix: ship.clone().multiply(makeTransform(0, 0, 0.28, Math.PI * 0.5, 0, 0, 1.35, 1.0, 0.95)),
      colorRgb: ionBlue,
    });

    const broadWing = trackGeo(out, createCreatureFin(0.32, 0.36, 0.24, 0.032, 0.018, 10, 5, hullSilver, hullSteel));
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: broadWing,
        matrix: ship.clone().multiply(makeTransform(side * 0.14, -0.01, -0.14, 0, 0, side * -0.06, side, 1, 1)),
      });
    }

    const nozzleBell = trackGeo(out, new THREE.CylinderGeometry(0.038, 0.062, 0.15, 14, 1, true));
    const nozzleRim = trackGeo(out, new THREE.TorusGeometry(0.056, 0.007, 6, 14));
    const ionPlume = trackGeo(out, createTeardropPart(0.38, 0.046, 1.6, 12, 8, 0, ionBlue, deepIon));
    const shockCone = trackGeo(out, new THREE.ConeGeometry(0.056, 0.34, 12, 1, true));

    const engineOffsets: readonly (readonly [number, number, number, number])[] = [
      [0, 0.015, -0.62, 1.15],
      [-0.125, -0.02, -0.58, 0.88],
      [0.125, -0.02, -0.58, 0.88],
    ];
    for (const [ex, ey, ez, esc] of engineOffsets) {
      out.matte.push({
        geo: nozzleBell,
        matrix: ship.clone().multiply(makeTransform(ex, ey, ez + 0.04 * esc, Math.PI * 0.5, 0, 0, esc, esc, esc)),
        colorRgb: carbonDark,
      });
      out.trim.push({
        geo: nozzleRim,
        matrix: ship.clone().multiply(makeTransform(ex, ey, ez - 0.02 * esc, 0, 0, 0, esc, esc, esc)),
        colorRgb: expeditionGold,
      });
      out.energy.push({
        geo: ionPlume,
        matrix: ship.clone().multiply(makeTransform(ex, ey, ez - 0.18 * esc, -Math.PI * 0.5, 0, 0, esc, esc, esc)),
        colorRgb: ionBlue,
      });
      out.crystal.push({
        geo: shockCone,
        matrix: ship.clone().multiply(makeTransform(ex, ey, ez - 0.21 * esc, -Math.PI * 0.5, 0, 0, esc, esc, esc)),
        colorRgb: ionBlue,
      });
    }

    const droneBody = trackGeo(out, createTeardropPart(0.32, 0.042, 1.45, 12, 8, 0, hullSteel, hullSilver));
    const droneWing = trackGeo(out, createCreatureFin(0.11, 0.14, 0.09, 0.014, 0.008, 8, 4, hullSilver, expeditionGold));
    const droneOptic = trackGeo(out, new THREE.SphereGeometry(0.018, 8, 6));
    const dronePlume = trackGeo(out, createTeardropPart(0.14, 0.018, 1.5, 10, 6, 0, ionBlue, deepIon));

    for (const side of [-1, 1] as const) {
      const dMat = ship.clone().multiply(
        makeTransform(side * 0.52, side > 0 ? 0.26 : -0.22, side > 0 ? 0.22 : 0.14, 0.04, side * -0.08, side * -0.16, 1.22, 1.22, 1.22),
      );
      out.armor.push({
        geo: droneBody,
        matrix: dMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
      });
      out.trim.push(
        { geo: droneWing, matrix: dMat.clone().multiply(makeTransform(0.02, 0, -0.02)) },
        { geo: droneWing, matrix: dMat.clone().multiply(makeTransform(-0.02, 0, -0.02, 0, 0, 0, -1, 1, 1)) },
      );
      out.crystal.push({
        geo: droneWing,
        matrix: dMat.clone().multiply(makeTransform(0, 0.012, -0.03, 0, 0, Math.PI * 0.5, 0.85, 0.85, 0.85)),
        colorRgb: ionBlue,
      });
      out.energy.push(
        { geo: droneOptic, matrix: dMat.clone().multiply(makeTransform(0, 0, 0.15)), colorRgb: ionBlue },
        { geo: dronePlume, matrix: dMat.clone().multiply(makeTransform(0, 0, -0.20, -Math.PI * 0.5, 0, 0)), colorRgb: ionBlue },
      );
    }

    out.wingParts.push(
      { geo: droneBody, matrix: ship.clone().multiply(makeTransform(-0.56, 0.28, -0.12, Math.PI * 0.5, 0, 0, 1.1, 1.1, 1.1)) },
      { geo: droneBody, matrix: ship.clone().multiply(makeTransform(0.56, 0.28, -0.12, Math.PI * 0.5, 0, 0, 1.1, 1.1, 1.1)) },
      { geo: trackGeo(out, new THREE.TorusGeometry(0.42, 0.012, 8, 24)), matrix: ship.clone().multiply(makeTransform(0, 0.04, -0.44)) },
    );

    out.headTopLocalY = 1.62;
    out.weaponGlowHex = 0x38bdf8;
    out.crystalHex = 0x0ea5e9;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.58;
  },

  S24: (_ctx, out) => {
    const polarWhite: RgbTriple = [0.94, 0.98, 1.0];
    const frostBlue: RgbTriple = [0.70, 0.88, 0.99];
    const glacierDeep: RgbTriple = [0.36, 0.66, 0.92];
    const cryoDark: RgbTriple = [0.15, 0.21, 0.30];
    const frostGold: RgbTriple = [0.88, 0.92, 0.98];
    const electricCyan: RgbTriple = [0.22, 0.96, 1.0];

    const iceCoreRock = trackGeo(out, new THREE.DodecahedronGeometry(0.42, 0));
    out.armor.push({
      geo: iceCoreRock,
      matrix: makeTransform(0, 0.40, -0.02, 0.26, 0.42, 0.14, 1.18, 0.72, 1.08),
      colorRgb: frostBlue,
    });
    const iceSubRock = trackGeo(out, new THREE.DodecahedronGeometry(0.28, 0));
    out.matte.push(
      { geo: iceSubRock, matrix: makeTransform(-0.26, 0.32, 0.14, 0.5, 0.9, 0.2, 1.05, 0.66, 0.92), colorRgb: cryoDark },
      { geo: iceSubRock, matrix: makeTransform(0.24, 0.28, -0.18, 0.8, 0.2, 0.4, 1.12, 0.60, 0.98), colorRgb: cryoDark },
    );

    const iceShardTall = trackGeo(out, createFacetedCrystalPart(0.42, 0.115, 5, 0.68, 0.32, glacierDeep, polarWhite));
    const iceShardMid = trackGeo(out, createFacetedCrystalPart(0.30, 0.088, 5, 0.64, 0.36, glacierDeep, electricCyan));
    const shardPlacements: readonly (readonly [number, number, number, number, number, number, number])[] = [
      [-0.36, 0.44, 0.16, 0.28, 0.40, 0.46, 1.0],
      [0.38, 0.42, 0.12, 0.22, -0.30, -0.52, 0.95],
      [-0.22, 0.36, -0.32, -0.44, 0.60, 0.28, 0.90],
      [0.24, 0.40, -0.30, -0.38, -0.50, -0.34, 1.05],
      [0.02, 0.32, 0.38, 0.56, 0.10, -0.08, 0.88],
      [-0.44, 0.26, -0.08, 0.08, 0.22, 0.78, 0.82],
      [0.44, 0.26, -0.04, -0.10, -0.25, -0.74, 0.82],
    ];
    shardPlacements.forEach(([sx, sy, sz, rx, ry, rz, sc], idx) => {
      out.crystal.push({
        geo: idx % 2 === 0 ? iceShardTall : iceShardMid,
        matrix: makeTransform(sx, sy, sz, rx, ry, rz, sc, sc, sc),
      });
    });

    const towerShell = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.24, 0.0],
          [0.26, 0.12],
          [0.21, 0.28],
          [0.18, 0.46],
          [0.21, 0.58],
          [0.16, 0.68],
          [0.05, 0.74],
        ],
        18,
        0,
        0,
        0.5,
        frostBlue,
        polarWhite,
      ),
    );
    out.armor.push({ geo: towerShell, matrix: makeTransform(0, 0.58, -0.02) });

    const towerCollar = trackGeo(out, new THREE.TorusGeometry(0.22, 0.016, 7, 22));
    out.trim.push(
      { geo: towerCollar, matrix: makeTransform(0, 0.72, -0.02, Math.PI * 0.5, 0, 0), colorRgb: frostGold },
      { geo: towerCollar, matrix: makeTransform(0, 1.15, -0.02, Math.PI * 0.5, 0, 0, 0.92, 0.92, 0.92), colorRgb: frostGold },
    );

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const claw = trackGeo(
        out,
        createOrganicLimb(
          [
            [ca * 0.22, 0.74, sa * 0.22 - 0.02],
            [ca * 0.34, 0.56, sa * 0.34 - 0.02],
            [ca * 0.30, 0.34, sa * 0.30 - 0.02],
          ],
          0.026,
          0.032,
          0.018,
          10,
          7,
          cryoDark,
          cryoDark,
        ),
      );
      out.matte.push({ geo: claw });
    }

    const bunkerVisor = trackGeo(out, createCurvedVisorPart(0.205, 0.072, 0.205, 1.85, 1.18, 0.52, 14, 5));
    out.crystal.push({
      geo: bunkerVisor,
      matrix: makeTransform(0, 1.02, 0.01),
      colorRgb: electricCyan,
    });
    out.energy.push({
      geo: trackGeo(out, createCurvedVisorPart(0.196, 0.022, 0.196, 1.55, 1.40, 0.20, 12, 3)),
      matrix: makeTransform(0, 1.02, 0.01),
      colorRgb: electricCyan,
    });

    const gunYoke = makeTransform(0, 1.10, 0.04, -0.14, -0.16, 0);
    const turretPod = trackGeo(out, createTeardropPart(0.32, 0.095, 1.2, 12, 8, 0, cryoDark, polarWhite));
    const barrelOuter = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.034, 0.72, 10));
    const barrelShroud = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.034, -0.16],
          [0.034, -0.16],
          [0.024, 0.28],
          [-0.024, 0.28],
        ],
        0.046,
        0.006,
        0.006,
        1,
        3,
      ),
    );
    const coilRing = trackGeo(out, new THREE.TorusGeometry(0.036, 0.007, 6, 12));
    const plasmaRailCore = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.012, 0.74, 8));
    const muzzleRing = trackGeo(out, new THREE.TorusGeometry(0.048, 0.006, 6, 14));

    for (const side of [-1, 1] as const) {
      const gx = side * 0.24;
      out.matte.push({
        geo: turretPod,
        matrix: gunYoke.clone().multiply(makeTransform(gx, 0, -0.02, Math.PI * 0.5, 0, 0)),
      });
      out.armor.push({
        geo: barrelShroud,
        matrix: gunYoke.clone().multiply(makeTransform(gx, 0.02, 0.22, Math.PI * 0.5, 0, 0)),
        colorRgb: polarWhite,
      });
      for (const vy of [-0.028, 0.028]) {
        out.matte.push({
          geo: barrelOuter,
          matrix: gunYoke.clone().multiply(makeTransform(gx, vy, 0.34, Math.PI * 0.5, 0, 0)),
          colorRgb: cryoDark,
        });
      }
      out.energy.push({
        geo: plasmaRailCore,
        matrix: gunYoke.clone().multiply(makeTransform(gx, 0, 0.38, Math.PI * 0.5, 0, 0)),
        colorRgb: electricCyan,
      });
      for (const rz of [0.16, 0.34, 0.52]) {
        out.trim.push({
          geo: coilRing,
          matrix: gunYoke.clone().multiply(makeTransform(gx, 0, rz, 0, 0, 0, 1.0, 1.4, 1.0)),
          colorRgb: frostGold,
        });
      }
      out.crystal.push({
        geo: muzzleRing,
        matrix: gunYoke.clone().multiply(makeTransform(gx, 0, 0.72)),
        colorRgb: electricCyan,
      });
    }

    const mastPost = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.028, 0.24, 10));
    out.matte.push({ geo: mastPost, matrix: makeTransform(0, 1.38, -0.04), colorRgb: cryoDark });

    const dishMat = makeTransform(0.02, 1.54, -0.06, -0.44, 0.34, 0.12);
    const radarDish = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.010, 0.0],
          [0.085, 0.016],
          [0.165, 0.048],
          [0.215, 0.095],
        ],
        18,
        0,
        0,
        0.5,
        frostGold,
        polarWhite,
      ),
    );
    out.trim.push({ geo: radarDish, matrix: dishMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)) });
    out.armor.push({
      geo: trackGeo(out, new THREE.TorusGeometry(0.215, 0.010, 7, 20)),
      matrix: dishMat.clone().multiply(makeTransform(0, 0, 0.095)),
      colorRgb: polarWhite,
    });
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2;
      const strut = trackGeo(
        out,
        createTaperedTubePart(
          [
            [Math.cos(a) * 0.19, Math.sin(a) * 0.19, 0.08],
            [0, 0, 0.24],
          ],
          0.008,
          0.005,
          6,
          5,
        ),
      );
      out.matte.push({ geo: strut, matrix: dishMat, colorRgb: cryoDark });
    }
    out.energy.push({
      geo: trackGeo(out, new THREE.SphereGeometry(0.026, 10, 8)),
      matrix: dishMat.clone().multiply(makeTransform(0, 0, 0.25)),
      colorRgb: electricCyan,
    });
    out.crystal.push({
      geo: trackGeo(out, new THREE.TorusGeometry(0.14, 0.008, 6, 18)),
      matrix: dishMat.clone().multiply(makeTransform(0, 0, 0.20)),
      colorRgb: electricCyan,
    });

    out.wingParts.push(
      { geo: iceShardTall, matrix: makeTransform(-0.46, 1.18, -0.18, 0.1, 0, 0.56, 0.85, 1.15, 0.85) },
      { geo: iceShardTall, matrix: makeTransform(0.46, 1.18, -0.18, 0.1, 0, -0.56, 0.85, 1.15, 0.85) },
      { geo: towerCollar, matrix: makeTransform(0, 1.54, -0.06, Math.PI * 0.5, 0, 0, 1.5, 1.5, 1.0) },
    );

    out.headTopLocalY = 1.78;
    out.weaponGlowHex = 0x22d3ee;
    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.56;
    out.crystalIntensity = 0.50;
  },

  S25: (_ctx, out) => {
    const superfluidWhite: RgbTriple = [0.97, 0.99, 1.0];
    const frostSilver: RgbTriple = [0.82, 0.91, 0.99];
    const deepSlate: RgbTriple = [0.15, 0.20, 0.29];
    const mirrorPlatinum: RgbTriple = [0.94, 0.97, 1.0];
    const dwarfIceBlue: RgbTriple = [0.52, 0.90, 1.0];
    const pureStarWhite: RgbTriple = [0.92, 0.98, 1.0];

    const centerY = 0.98;
    const outerTilt = makeTransform(0, centerY, 0, 0.32, 0.22, -0.20);
    const innerTilt = makeTransform(0, centerY, 0, -0.48, -0.34, 0.28);

    const whiteMonolithRing = trackGeo(out, new THREE.TorusGeometry(0.62, 0.044, 12, 32));
    out.armor.push({
      geo: whiteMonolithRing,
      matrix: outerTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.56)),
      colorRgb: superfluidWhite,
    });

    const stardustHalo = trackGeo(out, new THREE.TorusGeometry(0.71, 0.068, 8, 28));
    out.crystal.push({
      geo: stardustHalo,
      matrix: outerTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.24)),
      colorRgb: pureStarWhite,
    });

    const outerRippleRing = trackGeo(out, new THREE.TorusGeometry(0.54, 0.018, 6, 26));
    out.crystal.push({
      geo: outerRippleRing,
      matrix: outerTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.36)),
      colorRgb: dwarfIceBlue,
    });

    const nodeFin = trackGeo(out, createFacetedCrystalPart(0.18, 0.046, 4, 0.55, 0.45, frostSilver, superfluidWhite));
    const nodeCollar = trackGeo(out, new THREE.TorusGeometry(0.052, 0.008, 6, 14));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const nx = Math.cos(a) * 0.62;
      const ny = Math.sin(a) * 0.62;
      const nMat = outerTilt.clone().multiply(makeTransform(nx, ny, 0, 0, 0, a - Math.PI * 0.5));
      out.armor.push({ geo: nodeFin, matrix: nMat, colorRgb: superfluidWhite });
      out.trim.push({ geo: nodeCollar, matrix: nMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)), colorRgb: mirrorPlatinum });
      out.energy.push({
        geo: trackGeo(out, new THREE.OctahedronGeometry(0.020, 0)),
        matrix: nMat.clone().multiply(makeTransform(0, -0.09, 0)),
        colorRgb: dwarfIceBlue,
      });
    }

    const surveyRingMain = trackGeo(out, new THREE.TorusGeometry(0.43, 0.018, 8, 28));
    const surveyRingSub = trackGeo(out, new THREE.TorusGeometry(0.39, 0.009, 6, 26));
    out.trim.push(
      { geo: surveyRingMain, matrix: innerTilt, colorRgb: mirrorPlatinum },
      { geo: surveyRingSub, matrix: innerTilt.clone().multiply(makeTransform(0, 0, 0.016)), colorRgb: mirrorPlatinum },
    );

    const vernierArc = trackGeo(out, new THREE.TorusGeometry(0.33, 0.010, 6, 20, Math.PI * 1.15));
    out.trim.push({
      geo: vernierArc,
      matrix: makeTransform(0, centerY, 0, 0.14, 0.52, -0.36),
      colorRgb: mirrorPlatinum,
    });

    const tickPod = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.018, 0.064, 8));
    const tickLens = trackGeo(out, new THREE.SphereGeometry(0.015, 8, 6));
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const tx = Math.cos(a) * 0.43;
      const ty = Math.sin(a) * 0.43;
      const tMat = innerTilt.clone().multiply(makeTransform(tx, ty, 0, 0, 0, a + Math.PI * 0.5));
      out.matte.push({ geo: tickPod, matrix: tMat, colorRgb: deepSlate });
      out.energy.push({ geo: tickLens, matrix: tMat.clone().multiply(makeTransform(0, -0.04, 0)), colorRgb: dwarfIceBlue });
    }

    const dwarfCore = trackGeo(out, new THREE.SphereGeometry(0.115, 16, 12));
    out.energy.push({
      geo: dwarfCore,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: dwarfIceBlue,
    });

    const lensBubble = trackGeo(out, new THREE.SphereGeometry(0.172, 14, 10));
    out.crystal.push({
      geo: lensBubble,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: pureStarWhite,
    });

    const standingWaveA = trackGeo(out, new THREE.TorusGeometry(0.225, 0.008, 6, 24));
    const standingWaveB = trackGeo(out, new THREE.TorusGeometry(0.265, 0.006, 6, 24));
    out.energy.push(
      { geo: standingWaveA, matrix: makeTransform(0, centerY, 0, 0.85, 0.20, 0), colorRgb: pureStarWhite },
      { geo: standingWaveB, matrix: makeTransform(0, centerY, 0, -0.65, 0.45, 0.30), colorRgb: dwarfIceBlue },
    );

    const cometCoreTail = trackGeo(
      out,
      createTeardropPart(0.92, 0.064, 1.85, 12, 10, 0.05, dwarfIceBlue, pureStarWhite),
    );
    out.crystal.push({
      geo: cometCoreTail,
      matrix: makeTransform(0.32, centerY + 0.14, -0.12, 0.12, 0.24, -1.18),
    });

    const tailSpineA: Vec3Tuple[] = [
      [0.0, centerY, 0.02],
      [0.24, centerY + 0.12, -0.06],
      [0.54, centerY + 0.24, -0.16],
      [0.84, centerY + 0.30, -0.28],
    ];
    const tailSpineB: Vec3Tuple[] = [
      [0.0, centerY - 0.02, 0.01],
      [0.22, centerY + 0.04, -0.10],
      [0.50, centerY + 0.12, -0.22],
      [0.78, centerY + 0.16, -0.34],
    ];
    const tailRibbonA = trackGeo(
      out,
      createFlowingRibbonMesh(tailSpineA, [0.11, 0.16, 0.016], 0.022, 1.5, 18, 3, 0.0, pureStarWhite, dwarfIceBlue),
    );
    const tailRibbonB = trackGeo(
      out,
      createFlowingRibbonMesh(tailSpineB, [0.06, 0.09, 0.010], 0.016, 2.0, 16, 2, 0.0, dwarfIceBlue, frostSilver),
    );
    out.crystal.push({ geo: tailRibbonA });
    out.energy.push({ geo: tailRibbonB });

    out.wingParts.push(
      { geo: whiteMonolithRing, matrix: makeTransform(0, centerY, -0.16, 0.10, 0, 0, 1.18, 1.18, 0.42) },
      { geo: nodeFin, matrix: makeTransform(-0.62, 1.38, -0.12, 0, 0, 0.45, 1.3, 1.4, 1.3) },
      { geo: nodeFin, matrix: makeTransform(0.62, 1.38, -0.12, 0, 0, -0.45, 1.3, 1.4, 1.3) },
    );

    out.headTopLocalY = 1.72;
    out.weaponGlowHex = 0x7dd3fc;
    out.crystalHex = 0xe0f2fe;
    out.crystalOpacity = 0.52;
    out.crystalIntensity = 0.54;
  },

  S26: (_ctx, out) => {
    const navalDeep: RgbTriple = [0.16, 0.24, 0.42];
    const coatIvory: RgbTriple = [0.92, 0.95, 0.99];
    const coatLining: RgbTriple = [0.22, 0.34, 0.54];
    const darkCarbon: RgbTriple = [0.12, 0.15, 0.22];
    const brassGold: RgbTriple = [0.98, 0.80, 0.36];
    const emeraldGlow: RgbTriple = [0.20, 0.96, 0.66];
    const sailChampagne: RgbTriple = [0.98, 0.94, 0.78];
    const sailEmerald: RgbTriple = [0.46, 0.96, 0.80];

    const torsoYaw = 0.14;
    const headYaw = -0.18;
    const rotT = (x: number, y: number, z: number): THREE.Vector3 => {
      const c = Math.cos(torsoYaw);
      const sn = Math.sin(torsoYaw);
      return new THREE.Vector3(x * c + z * sn, y, -x * sn + z * c);
    };

    const deckArc = trackGeo(out, new THREE.TorusGeometry(0.33, 0.013, 5, 18, Math.PI * 0.88));
    out.trim.push({
      geo: deckArc,
      matrix: makeTransform(0, 0.055, 0.02, Math.PI * 0.5, 0, -Math.PI * 0.94),
      colorRgb: brassGold,
    });

    const legConfigs: readonly {
      readonly pts: readonly Vec3Tuple[];
      readonly footYaw: number;
      readonly side: -1 | 1;
    }[] = [
      {
        pts: [
          [-0.074, 0.82, 0.01],
          [-0.106, 0.44, 0.088],
          [-0.114, 0.085, 0.102],
        ],
        footYaw: 0.18,
        side: -1,
      },
      {
        pts: [
          [0.074, 0.82, -0.01],
          [0.092, 0.43, -0.028],
          [0.106, 0.085, -0.074],
        ],
        footYaw: -0.24,
        side: 1,
      },
    ];

    const bootVamp = trackGeo(out, createTeardropPart(0.18, 0.044, 1.25, 10, 7, 0, darkCarbon, darkCarbon));
    const bootCuff = trackGeo(out, new THREE.TorusGeometry(0.045, 0.0065, 4, 10));
    bootCuff.rotateX(Math.PI * 0.5);
    const bootBuckle = trackGeo(out, new THREE.TorusGeometry(0.042, 0.0055, 3, 10));
    bootBuckle.rotateX(Math.PI * 0.5);

    for (const lg of legConfigs) {
      const trouser = trackGeo(out, createOrganicLimb(lg.pts, 0.058, 0.046, 0.036, 9, 7, navalDeep, darkCarbon));
      out.matte.push({ geo: trouser });
      const knee = lg.pts[1]!;
      const ankle = lg.pts[2]!;
      const bootShaft = trackGeo(
        out,
        createOrganicLimb(
          [
            [knee[0], knee[1] - 0.02, knee[2]],
            [(knee[0] + ankle[0]) * 0.5, (knee[1] + ankle[1]) * 0.5, (knee[2] + ankle[2]) * 0.5],
            ankle,
          ],
          0.046,
          0.043,
          0.038,
          6,
          7,
          darkCarbon,
          darkCarbon,
        ),
      );
      out.matte.push({ geo: bootShaft });
      out.matte.push({
        geo: bootVamp,
        matrix: makeTransform(ankle[0], 0.060, ankle[2] + 0.034, Math.PI * 0.5, lg.footYaw, 0, 0.90, 1.0, 0.68),
      });
      out.trim.push(
        { geo: bootCuff, matrix: makeTransform(knee[0], knee[1] - 0.03, knee[2], 0, lg.footYaw, 0), colorRgb: brassGold },
        { geo: bootBuckle, matrix: makeTransform(ankle[0], 0.11, ankle[2], 0, lg.footYaw, 0), colorRgb: brassGold },
      );
    }

    const pelvisWrap = trackGeo(
      out,
      createLathePart(
        [
          [0.056, -0.06],
          [0.106, 0.02],
          [0.102, 0.14],
          [0.138, 0.34],
          [0.158, 0.46],
          [0.088, 0.56],
        ],
        12,
      ),
    );
    out.matte.push({
      geo: pelvisWrap,
      matrix: makeTransform(0, 0.76, 0, 0.03, torsoYaw, 0, 1.04, 1.0, 0.76),
      colorRgb: navalDeep,
    });

    const jacketTorso = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.114, 0.0],
          [0.112, 0.10],
          [0.168, 0.30],
          [0.178, 0.39],
          [0.116, 0.47],
          [0.074, 0.51],
        ],
        14,
        4,
        0.04,
        0.35,
        coatLining,
        coatIvory,
      ),
    );
    out.armor.push({
      geo: jacketTorso,
      matrix: makeTransform(0, 0.84, -0.008, 0.03, torsoYaw, 0, 1.04, 1.0, 0.78),
    });

    const splitCoatSkirt = trackGeo(
      out,
      createSplitPleatedCoatSkirt(
        [
          [0.242, 0.0],
          [0.214, 0.16],
          [0.174, 0.34],
          [0.132, 0.50],
          [0.116, 0.60],
        ],
        0.58,
        0.16,
        7,
        0.115,
        -0.032,
        -0.068,
        0.014,
        22,
        navalDeep,
        coatIvory,
        coatLining,
      ),
    );
    out.armor.push({
      geo: splitCoatSkirt,
      matrix: makeTransform(0, 0.29, -0.006, 0.02, torsoYaw, 0, 1.04, 1.0, 0.84),
    });

    const skirtTrimL = trackGeo(
      out,
      createTaperedTubePart(
        [
          rotT(-0.028, 0.88, 0.094),
          rotT(-0.088, 0.62, 0.120),
          rotT(-0.145, 0.30, 0.112),
        ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.006,
        0.0055,
        8,
        4,
      ),
    );
    const skirtTrimR = trackGeo(
      out,
      createTaperedTubePart(
        [
          rotT(0.028, 0.88, 0.094),
          rotT(0.082, 0.62, 0.116),
          rotT(0.118, 0.30, 0.104),
        ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.006,
        0.0055,
        8,
        4,
      ),
    );
    out.trim.push({ geo: skirtTrimL, colorRgb: brassGold }, { geo: skirtTrimR, colorRgb: brassGold });

    const lapelGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.105],
          [0.064, -0.036],
          [0.088, 0.072],
          [0.030, 0.108],
        ],
        0.015,
        0.004,
        0.004,
        1,
        2,
      ),
    );
    for (const side of [-1, 1] as const) {
      const lp = rotT(side * 0.024, 1.15, 0.126);
      out.armor.push({
        geo: lapelGeo,
        matrix: makeTransform(lp.x, lp.y, lp.z, -0.08, torsoYaw + side * 0.18, side * 0.06, side, 1, 1),
        colorRgb: coatIvory,
      });
    }

    const collarGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.082, 0.0],
          [0.096, 0.048],
          [0.104, 0.095],
        ],
        12,
        0.38,
        Math.PI * 2 - 0.76,
      ),
    );
    out.armor.push({
      geo: collarGeo,
      matrix: makeTransform(0, 1.30, -0.005, 0.04, torsoYaw, 0, 1.0, 1.0, 0.88),
      colorRgb: navalDeep,
    });
    const collarTrim = trackGeo(out, new THREE.TorusGeometry(0.100, 0.006, 4, 14));
    collarTrim.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: collarTrim,
      matrix: makeTransform(0, 1.39, -0.002, 0.04, torsoYaw, 0, 1.0, 1.0, 0.88),
      colorRgb: brassGold,
    });

    const sashPts: Vec3Tuple[] = [
      [0.135, 1.29, 0.055],
      [0.055, 1.16, 0.138],
      [-0.035, 1.03, 0.125],
      [-0.102, 0.90, 0.082],
    ].map(([x, y, z]) => {
      const v = rotT(x!, y!, z!);
      return [v.x, v.y, v.z];
    });
    const goldSash = trackGeo(
      out,
      createFlowingRibbonMesh(sashPts, [0.032, 0.036, 0.030], 0.004, 1.0, 10, 3, 0.007, brassGold, sailChampagne),
    );
    out.trim.push({ geo: goldSash });

    const aiguillette = trackGeo(
      out,
      createTaperedTubePart(
        [
          rotT(0.145, 1.27, 0.045),
          rotT(0.120, 1.15, 0.115),
          rotT(0.055, 1.17, 0.138),
        ].map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.006,
        0.0055,
        8,
        4,
      ),
    );
    out.trim.push({ geo: aiguillette, colorRgb: brassGold });

    const beltStrap = trackGeo(out, new THREE.TorusGeometry(0.116, 0.014, 4, 14));
    beltStrap.rotateX(Math.PI * 0.5);
    out.matte.push({
      geo: beltStrap,
      matrix: makeTransform(0, 0.90, 0.0, 0.02, torsoYaw, 0, 1.04, 1.0, 0.84),
      colorRgb: darkCarbon,
    });
    const beltBuckle = trackGeo(out, createHexMirrorTilePart(0.028, 0.012, 0.004, 0, brassGold, brassGold));
    const bPos = rotT(0, 0.90, 0.104);
    out.trim.push({
      geo: beltBuckle,
      matrix: makeTransform(bPos.x, bPos.y, bPos.z, 0, torsoYaw, 0),
    });

    const btnGeo = trackGeo(out, new THREE.SphereGeometry(0.009, 5, 4));
    for (let r = 0; r < 3; r += 1) {
      for (const side of [-1, 1] as const) {
        const bp = rotT(side * 0.044, 0.99 + r * 0.068, 0.118 + r * 0.008);
        out.trim.push({ geo: btnGeo, matrix: makeTransform(bp.x, bp.y, bp.z), colorRgb: brassGold });
      }
    }

    const epBoard = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.055, -0.024],
          [0.055, -0.024],
          [0.062, 0.024],
          [-0.055, 0.024],
        ],
        0.014,
        0.004,
        0.004,
        1,
        2,
      ),
    );
    const fringeTassel = trackGeo(out, new THREE.CylinderGeometry(0.0045, 0.0055, 0.052, 5));
    for (const side of [-1, 1] as const) {
      const ep = rotT(side * 0.168, 1.29, 0.0);
      out.trim.push({
        geo: epBoard,
        matrix: makeTransform(ep.x, ep.y, ep.z, Math.PI * 0.5, torsoYaw, side * -0.18),
        colorRgb: brassGold,
      });
      for (let f = -2; f <= 2; f += 1) {
        const fp = rotT(side * 0.214, 1.258, f * 0.012);
        out.trim.push({
          geo: fringeTassel,
          matrix: makeTransform(fp.x, fp.y, fp.z, 0, torsoYaw, side * -0.16),
          colorRgb: brassGold,
        });
      }
    }

    const chestCompassPos = rotT(0, 1.14, 0.136);
    const chestCompass = trackGeo(out, new THREE.OctahedronGeometry(0.020, 0));
    out.energy.push({
      geo: chestCompass,
      matrix: makeTransform(chestCompassPos.x, chestCompassPos.y, chestCompassPos.z, 0, torsoYaw, 0, 1.0, 1.0, 0.5),
      colorRgb: emeraldGlow,
    });

    const lArmPts = [
      rotT(-0.175, 1.25, 0.0),
      rotT(-0.238, 1.03, 0.02),
      rotT(-0.182, 0.85, 0.09),
    ];
    const rArmPts = [
      rotT(0.175, 1.25, 0.0),
      rotT(0.252, 1.06, 0.11),
      rotT(0.206, 1.14, 0.28),
    ];
    const leftArm = trackGeo(
      out,
      createOrganicLimb(
        lArmPts.map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.048,
        0.040,
        0.032,
        9,
        7,
        coatIvory,
        navalDeep,
      ),
    );
    const rightArm = trackGeo(
      out,
      createOrganicLimb(
        rArmPts.map((v) => [v.x, v.y, v.z] as Vec3Tuple),
        0.048,
        0.040,
        0.032,
        9,
        7,
        coatIvory,
        navalDeep,
      ),
    );
    out.armor.push({ geo: leftArm }, { geo: rightArm });

    const gloveGeo = trackGeo(out, new THREE.SphereGeometry(0.030, 7, 6));
    const cuffRing = trackGeo(out, new THREE.TorusGeometry(0.035, 0.0065, 4, 10));
    const lHand = lArmPts[2]!;
    const rHand = rArmPts[2]!;
    out.matte.push(
      { geo: gloveGeo, matrix: makeTransform(lHand.x, lHand.y - 0.02, lHand.z + 0.01), colorRgb: darkCarbon },
      { geo: gloveGeo, matrix: makeTransform(rHand.x, rHand.y, rHand.z + 0.02), colorRgb: darkCarbon },
    );
    out.trim.push(
      { geo: cuffRing, matrix: makeTransform(lHand.x - 0.008, lHand.y + 0.02, lHand.z - 0.01, Math.PI * 0.42, torsoYaw, 0.25), colorRgb: brassGold },
      { geo: cuffRing, matrix: makeTransform(rHand.x + 0.008, rHand.y - 0.01, rHand.z - 0.02, Math.PI * 0.30, torsoYaw - 0.3, 0), colorRgb: brassGold },
    );

    const headY = 1.475;
    const headMat = makeTransform(0, headY, 0.008, 0.02, torsoYaw + headYaw, 0);
    const headGeo = trackGeo(out, new THREE.SphereGeometry(0.094, 12, 9));
    out.armor.push({
      geo: headGeo,
      matrix: headMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 0.88, 1.12, 0.96)),
      colorRgb: coatIvory,
    });
    const visorFace = trackGeo(out, createCurvedVisorPart(0.088, 0.066, 0.098, 1.72, 1.10, 0.60, 12, 5));
    out.trim.push({
      geo: visorFace,
      matrix: headMat.clone().multiply(makeTransform(0, 0, 0.006)),
      colorRgb: brassGold,
    });
    const visorEyeLine = trackGeo(out, createCurvedVisorPart(0.090, 0.014, 0.100, 1.24, 1.42, 0.14, 10, 3));
    out.energy.push({
      geo: visorEyeLine,
      matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.010)),
      colorRgb: emeraldGlow,
    });

    const capCrown = trackGeo(
      out,
      createSculptedClothLathe(
        [
          [0.090, 0.0],
          [0.114, 0.048],
          [0.134, 0.088],
          [0.096, 0.112],
          [0.012, 0.122],
        ],
        14,
        0,
        0,
        0.5,
        navalDeep,
        coatIvory,
      ),
    );
    out.armor.push({
      geo: capCrown,
      matrix: headMat.clone().multiply(makeTransform(0, 0.056, -0.004, -0.10, 0, 0, 0.96, 1.0, 1.12)),
    });
    const capBand = trackGeo(out, new THREE.TorusGeometry(0.098, 0.0085, 4, 16));
    out.trim.push({
      geo: capBand,
      matrix: headMat.clone().multiply(makeTransform(0, 0.068, 0.0, Math.PI * 0.5 - 0.10, 0, 0, 0.96, 1.10, 1.0)),
      colorRgb: brassGold,
    });
    const capBrim = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.086, 0.0],
          [0.086, 0.0],
          [0.068, 0.095],
          [0.0, 0.124],
          [-0.068, 0.095],
        ],
        0.012,
        0.004,
        0.004,
        1,
        2,
      ),
    );
    out.matte.push({
      geo: capBrim,
      matrix: headMat.clone().multiply(makeTransform(0, 0.060, 0.068, Math.PI * 0.56, 0, 0)),
      colorRgb: darkCarbon,
    });
    out.energy.push({
      geo: trackGeo(out, new THREE.OctahedronGeometry(0.016, 0)),
      matrix: headMat.clone().multiply(makeTransform(0, 0.104, 0.110, 0, 0, 0, 0.9, 1.1, 0.6)),
      colorRgb: emeraldGlow,
    });

    const sexRoot = makeTransform(rHand.x + 0.01, rHand.y + 0.04, rHand.z + 0.07, 0.16, torsoYaw - 0.52, 0.12);
    const sexArc = trackGeo(out, new THREE.TorusGeometry(0.152, 0.009, 5, 16, Math.PI * 0.56));
    const sexVernierTick = trackGeo(out, new THREE.CylinderGeometry(0.0028, 0.0028, 0.020, 4));
    const sexArm = trackGeo(out, new THREE.CylinderGeometry(0.0055, 0.0065, 0.155, 6));
    const sexScope = trackGeo(out, new THREE.CylinderGeometry(0.013, 0.017, 0.175, 8));
    const sexEyepiece = trackGeo(out, new THREE.TorusGeometry(0.017, 0.004, 4, 8));
    const sexPrismMain = trackGeo(out, createFacetedCrystalPart(0.060, 0.022, 4, 0.5, 0.5, emeraldGlow, sailEmerald));
    const sexPrismHorizon = trackGeo(out, createFacetedCrystalPart(0.038, 0.014, 4, 0.5, 0.5, sailChampagne, emeraldGlow));
    const sexLaserBeam = trackGeo(out, new THREE.CylinderGeometry(0.0032, 0.0032, 0.28, 5));

    out.trim.push(
      { geo: sexArc, matrix: sexRoot.clone().multiply(makeTransform(0, -0.02, 0, 0, 0, -Math.PI * 0.78)), colorRgb: brassGold },
      { geo: sexArm, matrix: sexRoot.clone().multiply(makeTransform(-0.054, -0.074, 0, 0, 0, -0.64)), colorRgb: brassGold },
      { geo: sexArm, matrix: sexRoot.clone().multiply(makeTransform(0.054, -0.074, 0, 0, 0, 0.64)), colorRgb: brassGold },
      { geo: sexArm, matrix: sexRoot.clone().multiply(makeTransform(0.0, -0.074, 0, 0, 0, 0.10)), colorRgb: brassGold },
      { geo: sexScope, matrix: sexRoot.clone().multiply(makeTransform(0.0, 0.020, 0.02, Math.PI * 0.5, 0, 0)), colorRgb: brassGold },
      { geo: sexEyepiece, matrix: sexRoot.clone().multiply(makeTransform(0.0, 0.020, -0.068)), colorRgb: brassGold },
    );
    for (let tk = 0; tk < 7; tk += 1) {
      const ang = -Math.PI * 0.74 + (tk / 6) * Math.PI * 0.48;
      out.trim.push({
        geo: sexVernierTick,
        matrix: sexRoot.clone().multiply(makeTransform(Math.cos(ang) * 0.146, -0.02 + Math.sin(ang) * 0.146, 0.008, 0, 0, ang - Math.PI * 0.5)),
        colorRgb: brassGold,
      });
    }
    out.crystal.push(
      { geo: sexPrismMain, matrix: sexRoot.clone().multiply(makeTransform(0, -0.02, 0.012)) },
      { geo: sexPrismHorizon, matrix: sexRoot.clone().multiply(makeTransform(-0.058, -0.045, 0.018)) },
    );
    out.energy.push(
      { geo: trackGeo(out, new THREE.SphereGeometry(0.017, 7, 5)), matrix: sexRoot.clone().multiply(makeTransform(0, 0.020, 0.112)), colorRgb: emeraldGlow },
      { geo: sexLaserBeam, matrix: sexRoot.clone().multiply(makeTransform(0, 0.020, 0.245, Math.PI * 0.5, 0, 0)), colorRgb: emeraldGlow },
    );

    const winchPos = rotT(0, 1.16, -0.15);
    const winchMat = makeTransform(winchPos.x, winchPos.y, winchPos.z, 0, torsoYaw, 0);
    const rigPack = trackGeo(out, createTeardropPart(0.32, 0.082, 1.15, 10, 8, 0, darkCarbon, coatIvory));
    const winchDrum = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.044, 0.145, 10));
    winchDrum.rotateZ(Math.PI * 0.5);
    const winchFlange = trackGeo(out, new THREE.TorusGeometry(0.056, 0.008, 4, 12));
    winchFlange.rotateY(Math.PI * 0.5);
    out.matte.push({
      geo: rigPack,
      matrix: winchMat.clone().multiply(makeTransform(0, -0.02, 0, 0, 0, 0, 1.05, 1.0, 0.62)),
    });
    out.trim.push(
      { geo: winchDrum, matrix: winchMat.clone().multiply(makeTransform(0, 0.03, -0.042)), colorRgb: brassGold },
      { geo: winchFlange, matrix: winchMat.clone().multiply(makeTransform(-0.072, 0.03, -0.042)), colorRgb: brassGold },
      { geo: winchFlange, matrix: winchMat.clone().multiply(makeTransform(0.072, 0.03, -0.042)), colorRgb: brassGold },
    );

    const upperSailPanel = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.0],
          [0.60, 0.35],
          [0.66, 0.16],
          [0.56, -0.14],
          [0.0, -0.11],
        ],
        0.007,
        0.003,
        0.003,
        1,
        2,
      ),
    );
    const lowerSailPanel = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.0],
          [0.54, -0.02],
          [0.46, -0.26],
          [0.24, -0.35],
          [0.0, -0.14],
        ],
        0.007,
        0.003,
        0.003,
        1,
        2,
      ),
    );
    const sailRibLine = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.04, 0.0, 0.008],
          [0.32, 0.08, 0.012],
          [0.59, 0.12, 0.006],
        ],
        0.0055,
        0.003,
        7,
        4,
      ),
    );
    const crossSpar = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.26, 0.18, -0.03],
          [0.36, -0.04, -0.02],
          [0.30, -0.28, -0.02],
        ],
        0.0075,
        0.0045,
        6,
        4,
      ),
    );
    const stayCable = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.0, 0.04, -0.04],
          [0.30, 0.22, -0.06],
          [0.62, 0.36, -0.08],
        ],
        0.0038,
        0.003,
        6,
        4,
      ),
    );

    for (const side of [-1, 1] as const) {
      const sailOrigin = rotT(side * 0.08, 1.24, -0.16);
      const sailRoot = makeTransform(sailOrigin.x, sailOrigin.y, sailOrigin.z, 0.06, torsoYaw + side * 0.28, 0, side, 1.0, 1.0);
      const upperMast = trackGeo(
        out,
        createTaperedTubePart(
          [
            [0.0, 0.0, 0.0],
            [0.30, 0.20, -0.04],
            [0.64, 0.37, -0.08],
          ],
          0.014,
          0.006,
          7,
          5,
        ),
      );
      const midMast = trackGeo(
        out,
        createTaperedTubePart(
          [
            [0.0, -0.11, 0.0],
            [0.30, -0.12, -0.03],
            [0.57, -0.14, -0.05],
          ],
          0.012,
          0.005,
          6,
          4,
        ),
      );
      const lowerMast = trackGeo(
        out,
        createTaperedTubePart(
          [
            [0.0, -0.22, 0.0],
            [0.22, -0.34, -0.03],
            [0.45, -0.42, -0.04],
          ],
          0.010,
          0.004,
          6,
          4,
        ),
      );
      out.trim.push(
        { geo: upperMast, matrix: sailRoot, colorRgb: brassGold },
        { geo: midMast, matrix: sailRoot, colorRgb: brassGold },
        { geo: lowerMast, matrix: sailRoot, colorRgb: brassGold },
        { geo: crossSpar, matrix: sailRoot, colorRgb: brassGold },
        { geo: sailRibLine, matrix: sailRoot, colorRgb: brassGold },
        { geo: stayCable, matrix: sailRoot, colorRgb: sailChampagne },
      );

      out.crystal.push(
        {
          geo: upperSailPanel,
          matrix: sailRoot,
          colorRgb: sailChampagne,
        },
        {
          geo: lowerSailPanel,
          matrix: sailRoot.clone().multiply(makeTransform(0, -0.12, 0)),
          colorRgb: sailEmerald,
        },
      );
      out.energy.push({
        geo: trackGeo(out, new THREE.OctahedronGeometry(0.016, 0)),
        matrix: sailRoot.clone().multiply(makeTransform(0.64, 0.37, -0.08)),
        colorRgb: emeraldGlow,
      });
    }

    out.wingParts.push(
      { geo: upperSailPanel, matrix: makeTransform(-0.10, 1.32, -0.22, 0.08, -0.34, 0.16, -1.18, 1.18, 1.0) },
      { geo: upperSailPanel, matrix: makeTransform(0.10, 1.32, -0.22, 0.08, 0.34, -0.16, 1.18, 1.18, 1.0) },
    );

    out.headTopLocalY = 1.75;
    out.weaponGlowHex = 0x10b981;
    out.crystalHex = 0x6ee7b7;
    out.crystalOpacity = 0.50;
    out.crystalIntensity = 0.48;
  },

  S27: (_ctx, out) => {
    const obsidianArmor: RgbTriple = [0.16, 0.18, 0.27];
    const obsidianEdge: RgbTriple = [0.28, 0.32, 0.46];
    const vacuumCarbon: RgbTriple = [0.08, 0.10, 0.15];
    const cryoSilver: RgbTriple = [0.82, 0.86, 0.98];
    const violetGold: RgbTriple = [0.84, 0.72, 0.98];
    const antimatterViolet: RgbTriple = [0.68, 0.46, 1.0];
    const plasmaBlue: RgbTriple = [0.36, 0.78, 1.0];

    const centerY = 0.98;
    const ringRoot = makeTransform(0, centerY, 0, 0.22, 0.24, -0.12);

    const outerTorus = trackGeo(out, new THREE.TorusGeometry(0.62, 0.082, 12, 28));
    out.armor.push({
      geo: outerTorus,
      matrix: ringRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.74)),
      colorRgb: obsidianArmor,
    });

    const outerFinRing = trackGeo(out, new THREE.TorusGeometry(0.71, 0.022, 8, 28));
    out.armor.push({
      geo: outerFinRing,
      matrix: ringRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.45)),
      colorRgb: obsidianEdge,
    });

    const conduitRing = trackGeo(out, new THREE.TorusGeometry(0.65, 0.015, 6, 26));
    const innerRail = trackGeo(out, new THREE.TorusGeometry(0.54, 0.012, 6, 26));
    out.trim.push(
      { geo: conduitRing, matrix: ringRoot.clone().multiply(makeTransform(0, 0, 0.060)), colorRgb: cryoSilver },
      { geo: conduitRing, matrix: ringRoot.clone().multiply(makeTransform(0, 0, -0.060)), colorRgb: cryoSilver },
      { geo: innerRail, matrix: ringRoot.clone().multiply(makeTransform(0, 0, 0.044)), colorRgb: violetGold },
      { geo: innerRail, matrix: ringRoot.clone().multiply(makeTransform(0, 0, -0.044)), colorRgb: violetGold },
    );

    const vacuumLiner = trackGeo(out, new THREE.TorusGeometry(0.56, 0.036, 8, 26));
    out.matte.push({
      geo: vacuumLiner,
      matrix: ringRoot,
      colorRgb: vacuumCarbon,
    });

    const beamTorusMain = trackGeo(out, new THREE.TorusGeometry(0.46, 0.030, 8, 28));
    out.energy.push({
      geo: beamTorusMain,
      matrix: ringRoot,
      colorRgb: antimatterViolet,
    });

    for (let s = 0; s < 3; s += 1) {
      const phase = (s / 3) * Math.PI * 2;
      const pts: Vec3Tuple[] = [];
      for (let k = 0; k <= 20; k += 1) {
        const t = k / 20;
        const a = t * Math.PI * 2;
        const twist = a * 3 + phase;
        const r = 0.46 + Math.cos(twist) * 0.048;
        const z = Math.sin(twist) * 0.046;
        pts.push([Math.cos(a) * r, Math.sin(a) * r, z]);
      }
      const streamTube = trackGeo(out, createTaperedTubePart(pts, 0.012, 0.012, 22, 5));
      out.energy.push({
        geo: streamTube,
        matrix: ringRoot,
        colorRgb: s === 0 ? plasmaBlue : antimatterViolet,
      });
    }

    const magneticShieldCurtain = trackGeo(out, new THREE.TorusGeometry(0.46, 0.088, 10, 26));
    out.crystal.push({
      geo: magneticShieldCurtain,
      matrix: ringRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.62)),
      colorRgb: plasmaBlue,
    });

    const centerPinchCore = trackGeo(out, new THREE.OctahedronGeometry(0.095, 1));
    const centerPinchShell = trackGeo(out, new THREE.IcosahedronGeometry(0.155, 1));
    out.energy.push({
      geo: centerPinchCore,
      matrix: ringRoot,
      colorRgb: plasmaBlue,
    });
    out.crystal.push({
      geo: centerPinchShell,
      matrix: ringRoot,
      colorRgb: antimatterViolet,
    });

    const dCoilOuter = trackGeo(out, new THREE.TorusGeometry(0.145, 0.034, 8, 14));
    const magnetArmorBlock = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.088, -0.14],
          [0.088, -0.14],
          [0.105, 0.04],
          [0.062, 0.16],
          [-0.062, 0.16],
          [-0.105, 0.04],
        ],
        0.135,
        0.012,
        0.012,
        1,
        3,
      ),
    );
    const magnetInjector = trackGeo(out, createTeardropPart(0.22, 0.038, 1.5, 10, 8, 0, cryoSilver, plasmaBlue));
    const magnetTrimLoop = trackGeo(out, new THREE.TorusGeometry(0.152, 0.011, 6, 14));

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const mx = Math.cos(a) * 0.62;
      const my = Math.sin(a) * 0.62;
      const nMat = ringRoot.clone().multiply(makeTransform(mx, my, 0, 0, 0, a - Math.PI * 0.5));

      out.armor.push({
        geo: magnetArmorBlock,
        matrix: nMat.clone().multiply(makeTransform(0, 0.02, 0)),
        colorRgb: obsidianArmor,
      });
      out.matte.push({
        geo: dCoilOuter,
        matrix: nMat.clone().multiply(makeTransform(0, 0, 0, 0, Math.PI * 0.5, 0)),
        colorRgb: vacuumCarbon,
      });
      out.trim.push({
        geo: magnetTrimLoop,
        matrix: nMat.clone().multiply(makeTransform(0, 0.02, 0, 0, Math.PI * 0.5, 0)),
        colorRgb: cryoSilver,
      });
      out.energy.push({
        geo: magnetInjector,
        matrix: nMat.clone().multiply(makeTransform(0, -0.16, 0, Math.PI, 0, 0)),
        colorRgb: plasmaBlue,
      });
    }



    out.wingParts.push(
      { geo: outerFinRing, matrix: ringRoot.clone().multiply(makeTransform(0, 0, -0.08, 0, 0, 0, 1.18, 1.18, 0.5)) },
      { geo: dCoilOuter, matrix: ringRoot.clone().multiply(makeTransform(-0.74, 0, 0, 0, Math.PI * 0.5, 0, 1.2, 1.2, 1.2)) },
      { geo: dCoilOuter, matrix: ringRoot.clone().multiply(makeTransform(0.74, 0, 0, 0, Math.PI * 0.5, 0, 1.2, 1.2, 1.2)) },
    );

    out.headTopLocalY = 1.76;
    out.weaponGlowHex = 0x8b5cf6;
    out.crystalHex = 0x6366f1;
    out.crystalOpacity = 0.46;
    out.crystalIntensity = 0.64;
  },

  S28: (_ctx, out) => {
    const dysonIvory: RgbTriple = [0.95, 0.90, 0.78];
    const burnishedCeramic: RgbTriple = [0.76, 0.62, 0.40];
    const darkTitanium: RgbTriple = [0.15, 0.17, 0.22];
    const dysonGold: RgbTriple = [0.99, 0.82, 0.36];
    const moltenOrange: RgbTriple = [1.0, 0.52, 0.14];
    const solarAmber: RgbTriple = [1.0, 0.80, 0.32];

    const ship = makeTransform(0.0, 0.96, -0.04, 0.08, -0.28, 0.08);

    const centralHull = trackGeo(
      out,
      createTeardropPart(0.92, 0.205, 1.25, 18, 12, 0.015, burnishedCeramic, dysonIvory),
    );
    out.armor.push({
      geo: centralHull,
      matrix: ship.clone().multiply(makeTransform(0, 0.02, -0.14, Math.PI * 0.5, 0, 0, 1.28, 1.0, 0.76)),
    });

    const goldBelt = trackGeo(out, new THREE.CylinderGeometry(0.202, 0.212, 0.16, 18));
    out.trim.push({
      geo: goldBelt,
      matrix: ship.clone().multiply(makeTransform(0, 0.02, -0.10, Math.PI * 0.5, 0, 0, 1.28, 1.0, 0.76)),
      colorRgb: dysonGold,
    });

    const sidePod = trackGeo(
      out,
      createTeardropPart(0.70, 0.118, 1.15, 14, 10, 0, burnishedCeramic, dysonIvory),
    );
    const podRing = trackGeo(out, new THREE.TorusGeometry(0.116, 0.012, 6, 16));
    const podRadiator = trackGeo(out, createCreatureFin(0.28, 0.20, 0.14, 0.022, 0.014, 8, 4, darkTitanium, burnishedCeramic));

    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: sidePod,
        matrix: ship.clone().multiply(makeTransform(side * 0.25, -0.02, -0.10, Math.PI * 0.5, 0, 0, 0.94, 1.0, 0.88)),
      });
      out.trim.push({
        geo: podRing,
        matrix: ship.clone().multiply(makeTransform(side * 0.25, -0.02, -0.06)),
        colorRgb: dysonGold,
      });
      out.matte.push({
        geo: podRadiator,
        matrix: ship.clone().multiply(makeTransform(side * 0.30, -0.02, -0.22, 0, 0, side * -0.14, side, 1, 1)),
      });
    }

    const bridgeArch = trackGeo(out, new THREE.TorusGeometry(0.18, 0.022, 7, 16, Math.PI));
    out.trim.push({
      geo: bridgeArch,
      matrix: ship.clone().multiply(makeTransform(0, 0.14, -0.16)),
      colorRgb: dysonGold,
    });
    const bridgeCore = trackGeo(out, createCurvedVisorPart(0.11, 0.048, 0.12, 1.5, 1.1, 0.55, 10, 4));
    out.energy.push({
      geo: bridgeCore,
      matrix: ship.clone().multiply(makeTransform(0, 0.18, -0.04)),
      colorRgb: solarAmber,
    });

    const dorsalSpire = trackGeo(
      out,
      createOrganicLimb(
        [
          [0, 0.16, -0.16],
          [0, 0.24, 0.14],
          [0, 0.14, 0.44],
        ],
        0.042,
        0.032,
        0.016,
        10,
        8,
        dysonIvory,
        dysonGold,
      ),
    );
    out.armor.push({ geo: dorsalSpire, matrix: ship });

    const armFairing = trackGeo(out, createCurvedBladePart(0.68, 0.12, 0.036, 0.16, 0.08, 8));
    const emitterCollar = trackGeo(out, new THREE.TorusGeometry(0.056, 0.011, 6, 14));
    const emitterLens = trackGeo(out, new THREE.SphereGeometry(0.036, 10, 8));

    for (const side of [-1, 1] as const) {
      const armCurve: Vec3Tuple[] = [
        [side * 0.26, 0.02, 0.02],
        [side * 0.48, 0.06, 0.34],
        [side * 0.42, 0.02, 0.66],
        [side * 0.22, -0.02, 0.86],
      ];
      const cuttingArm = trackGeo(
        out,
        createOrganicLimb(armCurve, 0.080, 0.068, 0.042, 12, 8, dysonIvory, burnishedCeramic),
      );
      const innerRail = trackGeo(
        out,
        createTaperedTubePart(
          [
            [side * 0.19, -0.01, 0.08],
            [side * 0.34, 0.02, 0.34],
            [side * 0.29, 0.0, 0.60],
            [side * 0.16, -0.02, 0.78],
          ],
          0.022,
          0.014,
          10,
          6,
        ),
      );
      out.armor.push({ geo: cuttingArm, matrix: ship });
      out.matte.push({ geo: innerRail, matrix: ship, colorRgb: darkTitanium });
      out.trim.push(
        {
          geo: armFairing,
          matrix: ship.clone().multiply(makeTransform(side * 0.35, 0.04, 0.38, Math.PI * 0.5, side * -0.18, side * 0.32, side, 1, 1)),
          colorRgb: dysonGold,
        },
        {
          geo: emitterCollar,
          matrix: ship.clone().multiply(makeTransform(side * 0.22, -0.02, 0.78, 0, side * -0.58, 0)),
          colorRgb: dysonGold,
        },
      );
      out.energy.push({
        geo: emitterLens,
        matrix: ship.clone().multiply(makeTransform(side * 0.19, -0.02, 0.82)),
        colorRgb: moltenOrange,
      });
    }

    const tractorCone = trackGeo(out, new THREE.CylinderGeometry(0.285, 0.052, 0.64, 20, 1, true));
    out.crystal.push({
      geo: tractorCone,
      matrix: ship.clone().multiply(makeTransform(0, -0.01, 0.48, Math.PI * 0.5, 0, 0)),
      colorRgb: solarAmber,
    });

    for (let w = 0; w < 3; w += 1) {
      const r = 0.11 + w * 0.072;
      const wz = 0.34 + w * 0.18;
      out.crystal.push({
        geo: trackGeo(out, new THREE.TorusGeometry(r, 0.008, 6, 18)),
        matrix: ship.clone().multiply(makeTransform(0, -0.01, wz)),
        colorRgb: solarAmber,
      });
    }

    const beamGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.007, 1.0, 6));
    const oreCenter = new THREE.Vector3(0, -0.02, 0.56);
    const beamSources = [
      new THREE.Vector3(-0.19, -0.02, 0.82),
      new THREE.Vector3(0.19, -0.02, 0.82),
      new THREE.Vector3(0.0, 0.14, 0.44),
    ];
    for (const src of beamSources) {
      out.energy.push({
        geo: beamGeo,
        matrix: ship.clone().multiply(makeSegmentTransform(src, oreCenter, 1.0)),
        colorRgb: moltenOrange,
      });
    }

    const oreCore = trackGeo(out, new THREE.IcosahedronGeometry(0.088, 0));
    const oreCrust = trackGeo(out, createFacetedCrystalPart(0.16, 0.072, 5, 0.5, 0.5, darkTitanium, burnishedCeramic));
    out.energy.push({
      geo: oreCore,
      matrix: ship.clone().multiply(makeTransform(0, -0.02, 0.56, 0.3, 0.5, 0.2)),
      colorRgb: solarAmber,
    });
    out.matte.push({
      geo: oreCrust,
      matrix: ship.clone().multiply(makeTransform(0.02, -0.01, 0.57, 0.4, 0.8, 0.3, 0.92, 0.78, 0.92)),
      colorRgb: darkTitanium,
    });

    const sternNozzle = trackGeo(out, new THREE.CylinderGeometry(0.052, 0.076, 0.14, 14, 1, true));
    const sternPlume = trackGeo(out, createTeardropPart(0.28, 0.052, 1.5, 10, 6, 0, solarAmber, moltenOrange));
    for (const side of [-1, 1] as const) {
      out.matte.push({
        geo: sternNozzle,
        matrix: ship.clone().multiply(makeTransform(side * 0.24, -0.02, -0.46, Math.PI * 0.5, 0, 0)),
        colorRgb: darkTitanium,
      });
      out.energy.push({
        geo: sternPlume,
        matrix: ship.clone().multiply(makeTransform(side * 0.24, -0.02, -0.66, -Math.PI * 0.5, 0, 0)),
        colorRgb: moltenOrange,
      });
    }

    out.wingParts.push(
      { geo: armFairing, matrix: ship.clone().multiply(makeTransform(-0.44, 0.24, -0.14, Math.PI * 0.4, 0.25, 0.45, -1.1, 1.1, 1.1)) },
      { geo: armFairing, matrix: ship.clone().multiply(makeTransform(0.44, 0.24, -0.14, Math.PI * 0.4, -0.25, -0.45, 1.1, 1.1, 1.1)) },
      { geo: bridgeArch, matrix: ship.clone().multiply(makeTransform(0, 0.22, -0.16, 0, 0, 0, 1.65, 1.65, 1.2)) },
    );

    out.headTopLocalY = 1.66;
    out.weaponGlowHex = 0xf97316;
    out.crystalHex = 0xf59e0b;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.58;
  },
};
