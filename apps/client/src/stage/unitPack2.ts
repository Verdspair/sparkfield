import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
  createCreatureFin,
  createCurvedBladePart,
  createCurvedVisorPart,
  createFacetedCrystalPart,
  createFlowingRibbonMesh,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createPetalPart,
  createTaperedTubePart,
  createTeardropPart,
  createTubePart,
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type Vec3Tuple,
} from './unitBuilderCore.js';

export const UNIT_PACK_2_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S11: (_ctx, out) => {
    const porcelain: RgbTriple = [0.95, 0.98, 1.00];
    const mistBlue: RgbTriple = [0.74, 0.86, 0.98];
    const darkTitanium: RgbTriple = [0.14, 0.19, 0.29];
    const cloudGold: RgbTriple = [0.98, 0.82, 0.42];
    const cipherCyan: RgbTriple = [0.34, 0.86, 1.00];
    const sapphireEdge: RgbTriple = [0.22, 0.56, 0.98];

    const baseLower = trackGeo(out, createLathePart([[0.014, 0.0], [0.25, 0.025], [0.295, 0.095], [0.245, 0.145]], 22));
    const baseMid = trackGeo(out, createLathePart([[0.245, 0.145], [0.185, 0.215], [0.155, 0.265]], 20));
    const baseCap = trackGeo(out, createLathePart([[0.155, 0.265], [0.205, 0.315], [0.165, 0.355], [0.02, 0.365]], 20));
    out.armor.push(
      { geo: baseLower, matrix: makeTransform(0, 0.14, -0.02), colorRgb: porcelain },
      { geo: baseCap, matrix: makeTransform(0, 0.14, -0.02), colorRgb: mistBlue },
    );
    out.matte.push({ geo: baseMid, matrix: makeTransform(0, 0.14, -0.02), colorRgb: darkTitanium });

    const baseTrimRing = trackGeo(out, new THREE.TorusGeometry(0.285, 0.013, 6, 24));
    baseTrimRing.rotateX(Math.PI * 0.5);
    const upperTrimRing = trackGeo(out, new THREE.TorusGeometry(0.198, 0.010, 6, 20));
    upperTrimRing.rotateX(Math.PI * 0.5);
    const hoverGlowRing = trackGeo(out, new THREE.TorusGeometry(0.23, 0.011, 6, 22));
    hoverGlowRing.rotateX(Math.PI * 0.5);
    out.trim.push(
      { geo: baseTrimRing, matrix: makeTransform(0, 0.24, -0.02), colorRgb: cloudGold },
      { geo: upperTrimRing, matrix: makeTransform(0, 0.45, -0.02), colorRgb: cloudGold },
    );
    out.energy.push({ geo: hoverGlowRing, matrix: makeTransform(0, 0.16, -0.02), colorRgb: cipherCyan });

    const coreY = 0.92;
    const coreZ = -0.04;

    const coreInner = trackGeo(out, createFacetedCrystalPart(0.46, 0.135, 8, 0.54, 0.46, sapphireEdge, cipherCyan));
    const coreShell = trackGeo(out, createFacetedCrystalPart(0.58, 0.19, 6, 0.54, 0.46, [0.56, 0.90, 1.0], [0.90, 0.98, 1.0]));
    out.energy.push({ geo: coreInner, matrix: makeTransform(0, coreY, coreZ) });
    out.crystal.push({ geo: coreShell, matrix: makeTransform(0, coreY, coreZ) });

    const gimbalOuter = trackGeo(out, new THREE.TorusGeometry(0.275, 0.015, 6, 24));
    const gimbalInner = trackGeo(out, new THREE.TorusGeometry(0.22, 0.011, 6, 22));
    const gimbalArc = trackGeo(out, new THREE.TorusGeometry(0.325, 0.010, 6, 22));
    out.trim.push(
      { geo: gimbalOuter, matrix: makeTransform(0, coreY, coreZ, 0.46, 0.32, 0.18), colorRgb: cloudGold },
      { geo: gimbalInner, matrix: makeTransform(0, coreY, coreZ, -0.62, 0.88, -0.24), colorRgb: cloudGold },
    );
    out.armor.push({
      geo: gimbalArc,
      matrix: makeTransform(0, coreY, coreZ, Math.PI * 0.5 + 0.14, 0, 0.18),
      colorRgb: porcelain,
    });

    const poleCap = trackGeo(out, createTeardropPart(0.20, 0.046, 1.55, 14, 10, 0, mistBlue, porcelain));
    const crownHalo = trackGeo(out, new THREE.TorusGeometry(0.14, 0.010, 6, 20));
    crownHalo.rotateX(Math.PI * 0.5);
    out.armor.push(
      { geo: poleCap, matrix: makeTransform(0, coreY + 0.36, coreZ) },
      { geo: poleCap, matrix: makeTransform(0, coreY - 0.34, coreZ, Math.PI, 0, 0) },
    );
    out.trim.push({ geo: crownHalo, matrix: makeTransform(0, coreY + 0.34, coreZ), colorRgb: cloudGold });

    const spireTip = trackGeo(out, createFacetedCrystalPart(0.16, 0.032, 6, 0.72, 0.28, cipherCyan, [0.86, 0.98, 1.0]));
    out.energy.push(
      { geo: spireTip, matrix: makeTransform(0, coreY + 0.48, coreZ) },
      { geo: spireTip, matrix: makeTransform(0, coreY - 0.44, coreZ, Math.PI, 0, 0, 0.7, 0.7, 0.7) },
    );

    const tileRadius = 0.106;
    const hexCrystal = trackGeo(out, createHexMirrorTilePart(tileRadius, 0.020, 0.009, 0.008, [0.58, 0.92, 1.0], [0.18, 0.58, 0.98]));
    const hexFrame = trackGeo(out, createChamferedHexPart(tileRadius * 1.03, 0.018, 0.006, tileRadius * 0.78));
    const hexBackPlate = trackGeo(out, createHexMirrorTilePart(tileRadius * 0.84, 0.014, 0.006, 0));
    const nodePin = trackGeo(out, new THREE.OctahedronGeometry(0.020, 0));

    const clusterOffsets: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0.5, 1],
      [-0.5, 1],
      [0.5, -1],
      [-0.5, -1],
    ];
    const stepX = tileRadius * Math.sqrt(3) * 1.05;
    const stepY = tileRadius * 1.56;

    const wallSpecs: readonly {
      readonly yaw: number;
      readonly dist: number;
      readonly yCenter: number;
      readonly pitch: number;
      readonly scale: number;
    }[] = [
      { yaw: 0.0, dist: 0.44, yCenter: 0.90, pitch: -0.06, scale: 1.06 },
      { yaw: -1.08, dist: 0.46, yCenter: 0.94, pitch: -0.08, scale: 0.93 },
      { yaw: 1.08, dist: 0.46, yCenter: 0.94, pitch: -0.08, scale: 0.93 },
    ];

    for (let wIdx = 0; wIdx < wallSpecs.length; wIdx += 1) {
      const w = wallSpecs[wIdx]!;
      const wx = Math.sin(w.yaw) * w.dist;
      const wz = Math.cos(w.yaw) * w.dist + coreZ;
      const wallRoot = makeTransform(wx, w.yCenter, wz, w.pitch, w.yaw, 0, w.scale, w.scale, w.scale);

      for (let i = 0; i < clusterOffsets.length; i += 1) {
        const [ox, oy] = clusterOffsets[i]!;
        const lx = ox * stepX;
        const ly = oy * stepY;
        const curveZ = -(lx * lx * 0.34 + ly * ly * 0.14);
        const tileMat = wallRoot.clone().multiply(makeTransform(lx, ly, curveZ, ly * 0.18, -lx * 0.36, 0));

        out.crystal.push({ geo: hexCrystal, matrix: tileMat });
        if (i === 0) {
          out.trim.push({
            geo: hexFrame,
            matrix: tileMat.clone().multiply(makeTransform(0, 0, 0.006, 0, 0, 0, 1.04, 1.04, 0.72)),
            colorRgb: cloudGold,
          });
          out.energy.push({
            geo: nodePin,
            matrix: tileMat.clone().multiply(makeTransform(0, 0, 0.022, 0, 0, 0, 1.25, 1.25, 0.75)),
            colorRgb: cipherCyan,
          });
        } else if (i === 1 || i === 2) {
          out.armor.push({
            geo: hexFrame,
            matrix: tileMat.clone().multiply(makeTransform(0, 0, -0.008)),
            colorRgb: porcelain,
          });
        } else {
          out.matte.push({
            geo: hexBackPlate,
            matrix: tileMat.clone().multiply(makeTransform(0, 0, -0.015)),
            colorRgb: darkTitanium,
          });
        }
      }

      const topArch = trackGeo(
        out,
        createOrganicLimb(
          [
            [-0.26, 0.25, -0.04],
            [0.0, 0.33, 0.02],
            [0.26, 0.25, -0.04],
          ],
          0.015,
          0.020,
          0.015,
          10,
          6,
          mistBlue,
          porcelain,
        ),
      );
      const botArch = trackGeo(
        out,
        createOrganicLimb(
          [
            [-0.24, -0.25, -0.04],
            [0.0, -0.32, 0.02],
            [0.24, -0.25, -0.04],
          ],
          0.014,
          0.018,
          0.014,
          10,
          6,
          darkTitanium,
          darkTitanium,
        ),
      );
      out.armor.push({ geo: topArch, matrix: wallRoot });
      out.matte.push({ geo: botArch, matrix: wallRoot });

      const armToCore = trackGeo(
        out,
        createOrganicLimb(
          [
            [Math.sin(w.yaw) * 0.14, 0.30, Math.cos(w.yaw) * 0.14 + coreZ],
            [Math.sin(w.yaw) * 0.32, 0.48, Math.cos(w.yaw) * 0.32 + coreZ],
            [wx * 0.88, w.yCenter - 0.24, wz * 0.88 + coreZ * 0.12],
          ],
          0.022,
          0.018,
          0.014,
          10,
          6,
          darkTitanium,
          cloudGold,
        ),
      );
      out.trim.push({ geo: armToCore });
    }

    const conduitPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 12; k += 1) {
      const a = -1.25 + (k / 12) * 2.50;
      conduitPts.push([Math.sin(a) * 0.40, 0.56 + Math.cos(a * 2) * 0.03, Math.cos(a) * 0.40 + coreZ]);
    }
    const conduitRing = trackGeo(out, createTubePart(conduitPts, 0.012, 16, 6, false));
    out.energy.push({ geo: conduitRing, colorRgb: cipherCyan });

    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.58;
    out.weaponGlowHex = 0x38bdf8;
    out.headTopLocalY = 1.56;
  },

  S12: (_ctx, out) => {
    const porcelain: RgbTriple = [0.96, 0.98, 1.00];
    const frostBlue: RgbTriple = [0.76, 0.88, 0.99];
    const darkTitanium: RgbTriple = [0.15, 0.20, 0.30];
    const memoryGold: RgbTriple = [0.99, 0.83, 0.42];
    const warmCore: RgbTriple = [1.00, 0.90, 0.52];
    const holoBlue: RgbTriple = [0.46, 0.84, 1.00];

    const pedLower = trackGeo(out, createLathePart([[0.012, 0.0], [0.245, 0.03], [0.285, 0.105], [0.245, 0.145]], 22));
    const pedBand = trackGeo(out, createLathePart([[0.245, 0.145], [0.185, 0.225], [0.135, 0.305]], 20));
    const pedUpper = trackGeo(out, createLathePart([[0.135, 0.305], [0.165, 0.375], [0.150, 0.410], [0.02, 0.415]], 20));
    out.armor.push(
      { geo: pedLower, matrix: makeTransform(0, 0.12, 0), colorRgb: porcelain },
      { geo: pedUpper, matrix: makeTransform(0, 0.12, 0), colorRgb: porcelain },
    );
    out.matte.push({ geo: pedBand, matrix: makeTransform(0, 0.12, 0), colorRgb: darkTitanium });

    const pedCollar = trackGeo(out, new THREE.TorusGeometry(0.248, 0.013, 6, 24));
    pedCollar.rotateX(Math.PI * 0.5);
    const pedUpperRing = trackGeo(out, new THREE.TorusGeometry(0.148, 0.009, 6, 20));
    pedUpperRing.rotateX(Math.PI * 0.5);
    const pedEmit = trackGeo(out, new THREE.TorusGeometry(0.165, 0.010, 6, 20));
    pedEmit.rotateX(Math.PI * 0.5);
    out.trim.push(
      { geo: pedCollar, matrix: makeTransform(0, 0.265, 0), colorRgb: memoryGold },
      { geo: pedUpperRing, matrix: makeTransform(0, 0.425, 0), colorRgb: memoryGold },
    );
    out.energy.push({ geo: pedEmit, matrix: makeTransform(0, 0.525, 0), colorRgb: warmCore });

    const coreY = 0.94;
    const coreSphere = trackGeo(out, new THREE.IcosahedronGeometry(0.128, 1));
    out.energy.push({ geo: coreSphere, matrix: makeTransform(0, coreY, 0), colorRgb: warmCore });

    const glassEnclosure = trackGeo(out, new THREE.SphereGeometry(0.205, 18, 14));
    out.crystal.push({
      geo: glassEnclosure,
      matrix: makeTransform(0, coreY, 0),
      colorRgb: [0.84, 0.95, 1.0],
    });

    for (let s = 0; s < 3; s += 1) {
      const phase = (s / 3) * Math.PI * 2;
      const strandPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const f = k / 10;
        const a = phase + f * Math.PI * 2.2;
        const r = 0.14 + Math.sin(f * Math.PI) * 0.055;
        const y = coreY - 0.13 + f * 0.26;
        strandPts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      const neuralStrand = trackGeo(out, createTaperedTubePart(strandPts, 0.010, 0.0045, 12, 6));
      out.energy.push({ geo: neuralStrand, colorRgb: s === 0 ? warmCore : holoBlue });
    }

    const discSpecs: readonly {
      readonly y: number;
      readonly innerR: number;
      readonly outerR: number;
      readonly rx: number;
      readonly rz: number;
      readonly col: RgbTriple;
    }[] = [
      { y: 0.68, innerR: 0.19, outerR: 0.42, rx: 0.16, rz: -0.10, col: [0.64, 0.90, 1.0] },
      { y: 0.86, innerR: 0.23, outerR: 0.50, rx: -0.14, rz: 0.12, col: [1.0, 0.90, 0.62] },
      { y: 1.04, innerR: 0.22, outerR: 0.46, rx: 0.18, rz: 0.08, col: [0.68, 0.92, 1.0] },
      { y: 1.21, innerR: 0.16, outerR: 0.34, rx: -0.12, rz: -0.14, col: [1.0, 0.88, 0.56] },
    ];

    const tabGeo = trackGeo(out, createFacetedCrystalPart(0.068, 0.020, 6, 0.55, 0.45, frostBlue, porcelain));

    for (let dIdx = 0; dIdx < discSpecs.length; dIdx += 1) {
      const d = discSpecs[dIdx]!;
      const discMat = makeTransform(0, d.y, 0, d.rx, dIdx * 0.7, d.rz);
      const discProfile: readonly (readonly [number, number])[] = [
        [d.innerR, -0.005],
        [d.outerR, -0.003],
        [d.outerR, 0.003],
        [d.innerR, 0.005],
      ];
      const discGeo = trackGeo(out, createLathePart(discProfile, 24));
      out.crystal.push({ geo: discGeo, matrix: discMat, colorRgb: d.col });

      const rimGeo = trackGeo(out, new THREE.TorusGeometry(d.outerR, 0.009, 6, 24));
      rimGeo.rotateX(Math.PI * 0.5);
      const innerRimGeo = trackGeo(out, new THREE.TorusGeometry(d.innerR, 0.007, 5, 20));
      innerRimGeo.rotateX(Math.PI * 0.5);
      out.trim.push(
        { geo: rimGeo, matrix: discMat, colorRgb: memoryGold },
        { geo: innerRimGeo, matrix: discMat, colorRgb: dIdx % 2 === 0 ? memoryGold : frostBlue },
      );

      for (let k = 0; k < 3; k += 1) {
        const a = (k / 3) * Math.PI * 2 + dIdx * 0.6;
        out.armor.push({
          geo: tabGeo,
          matrix: discMat.clone().multiply(makeTransform(Math.cos(a) * d.outerR, 0, Math.sin(a) * d.outerR, 0, -a, Math.PI * 0.5)),
        });
      }
    }

    const cradleRing = trackGeo(out, new THREE.TorusGeometry(0.55, 0.016, 6, 28));
    out.armor.push({
      geo: cradleRing,
      matrix: makeTransform(0, coreY, -0.04, 0.24, 0.36, 0.14),
      colorRgb: porcelain,
    });
    const cradleInner = trackGeo(out, new THREE.TorusGeometry(0.525, 0.009, 6, 24));
    out.trim.push({
      geo: cradleInner,
      matrix: makeTransform(0, coreY, -0.04, 0.24, 0.36, 0.14),
      colorRgb: memoryGold,
    });

    const armConfigs: readonly {
      readonly side: -1 | 1;
      readonly elbowY: number;
      readonly tipY: number;
      readonly tipR: number;
      readonly zOff: number;
    }[] = [
      { side: -1, elbowY: 0.78, tipY: 1.06, tipR: 0.29, zOff: 0.14 },
      { side: 1, elbowY: 0.92, tipY: 0.80, tipR: 0.31, zOff: 0.08 },
    ];

    for (const arm of armConfigs) {
      const s = arm.side;
      const limbGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [s * 0.22, 0.28, arm.zOff * 0.4],
            [s * 0.56, arm.elbowY, arm.zOff],
            [s * 0.44, arm.tipY + 0.08, arm.zOff * 1.1],
            [s * arm.tipR, arm.tipY, arm.zOff * 0.7],
          ],
          0.024,
          0.018,
          0.012,
          14,
          8,
          darkTitanium,
          memoryGold,
        ),
      );
      out.matte.push({ geo: limbGeo });

      const cuff = trackGeo(out, new THREE.TorusGeometry(0.028, 0.008, 6, 14));
      out.trim.push({
        geo: cuff,
        matrix: makeTransform(s * 0.56, arm.elbowY, arm.zOff, 0.3, s * 0.5, 0),
        colorRgb: memoryGold,
      });

      const headHousing = trackGeo(out, createTeardropPart(0.12, 0.030, 1.4, 12, 8, 0, porcelain, memoryGold));
      const headStart = new THREE.Vector3(s * arm.tipR, arm.tipY, arm.zOff * 0.7);
      const targetPt = new THREE.Vector3(0, coreY, 0);
      out.trim.push({
        geo: headHousing,
        matrix: makeSegmentTransform(headStart.clone().add(new THREE.Vector3(s * 0.05, 0.02, 0)), headStart, 1.0, 1.0),
      });

      const laserBeam = trackGeo(
        out,
        createTaperedTubePart(
          [
            [headStart.x, headStart.y, headStart.z],
            [(headStart.x + targetPt.x) * 0.5, (headStart.y + targetPt.y) * 0.5, (headStart.z + targetPt.z) * 0.5],
            [targetPt.x, targetPt.y, targetPt.z],
          ],
          0.011,
          0.004,
          8,
          6,
        ),
      );
      out.energy.push({ geo: laserBeam, colorRgb: warmCore });
    }

    const crownFin = trackGeo(out, createFacetedCrystalPart(0.22, 0.044, 6, 0.65, 0.35, memoryGold, warmCore));
    out.trim.push({ geo: crownFin, matrix: makeTransform(0, 1.44, 0) });

    const dataRibbonPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 10; k += 1) {
      const f = k / 10;
      const a = f * Math.PI * 2.1;
      const r = 0.38 + Math.sin(f * Math.PI) * 0.08;
      dataRibbonPts.push([Math.cos(a) * r, 0.56 + f * 0.72, Math.sin(a) * r]);
    }
    const dataRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(dataRibbonPts, [0.026, 0.046, 0.014], 0.008, 2.0, 20, 4, 0, holoBlue, warmCore),
    );
    out.crystal.push({ geo: dataRibbon });

    out.crystalHex = 0x7dd3fc;
    out.crystalOpacity = 0.42;
    out.crystalIntensity = 0.54;
    out.weaponGlowHex = 0xfde047;
    out.headTopLocalY = 1.60;
  },

  S13: (_ctx, out) => {
    const ceramicWhite: RgbTriple = [0.95, 0.97, 1.00];
    const warmSilver: RgbTriple = [0.84, 0.88, 0.94];
    const tungstenCarbon: RgbTriple = [0.16, 0.19, 0.25];
    const brightGold: RgbTriple = [1.00, 0.88, 0.46];
    const solarGold: RgbTriple = [0.98, 0.78, 0.32];
    const coronaOrange: RgbTriple = [1.00, 0.68, 0.22];
    const whiteFlame: RgbTriple = [1.00, 0.94, 0.68];

    const craft = makeTransform(0.0, 0.82, 0.02, -0.14, -0.26, 0.08);

    const hullGeo = trackGeo(out, createTeardropPart(0.96, 0.095, 1.55, 18, 12, 0.014, warmSilver, ceramicWhite));
    const keelGeo = trackGeo(out, createTeardropPart(0.84, 0.068, 1.4, 12, 8, 0, tungstenCarbon, tungstenCarbon));
    const nozzleProfile: readonly (readonly [number, number])[] = [
      [0.056, 0.0],
      [0.042, -0.045],
      [0.058, -0.105],
      [0.070, -0.145],
    ];
    const nozzleGeo = trackGeo(out, createLathePart(nozzleProfile, 16));
    const flameGeo = trackGeo(out, createTeardropPart(0.38, 0.050, 1.65, 12, 8, 0, whiteFlame, coronaOrange));

    for (const side of [-1, 1] as const) {
      const hx = side * 0.245;
      out.armor.push({
        geo: hullGeo,
        matrix: craft.clone().multiply(makeTransform(hx, -0.04, 0.02, Math.PI * 0.5, 0, 0, 0.86, 1.0, 0.72)),
      });
      out.matte.push({
        geo: keelGeo,
        matrix: craft.clone().multiply(makeTransform(hx, -0.088, -0.02, Math.PI * 0.5, 0, 0, 0.78, 1.0, 0.54)),
      });

      const railTrim = trackGeo(
        out,
        createOrganicLimb(
          [
            [hx + side * 0.045, -0.02, 0.36],
            [hx + side * 0.072, -0.02, 0.02],
            [hx + side * 0.036, -0.02, -0.36],
          ],
          0.010,
          0.014,
          0.008,
          10,
          6,
        ),
      );
      out.trim.push({ geo: railTrim, matrix: craft, colorRgb: brightGold });

      out.trim.push({
        geo: nozzleGeo,
        matrix: craft.clone().multiply(makeTransform(hx, -0.04, -0.39, -Math.PI * 0.5, 0, 0)),
        colorRgb: solarGold,
      });
      out.energy.push({
        geo: flameGeo,
        matrix: craft.clone().multiply(makeTransform(hx, -0.04, -0.60, -Math.PI * 0.5, 0, 0)),
      });
    }

    const crossBridgeFront = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.24, -0.02, 0.14],
          [0.0, 0.06, 0.16],
          [0.24, -0.02, 0.14],
        ],
        0.022,
        0.028,
        0.022,
        10,
        8,
        ceramicWhite,
        ceramicWhite,
      ),
    );
    const crossBridgeRear = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.24, -0.02, -0.22],
          [0.0, 0.04, -0.24],
          [0.24, -0.02, -0.22],
        ],
        0.020,
        0.024,
        0.020,
        10,
        8,
        tungstenCarbon,
        tungstenCarbon,
      ),
    );
    out.armor.push({ geo: crossBridgeFront, matrix: craft });
    out.matte.push({ geo: crossBridgeRear, matrix: craft });

    const podGeo = trackGeo(out, createTeardropPart(0.56, 0.095, 1.35, 16, 10, 0.01, warmSilver, ceramicWhite));
    out.armor.push({
      geo: podGeo,
      matrix: craft.clone().multiply(makeTransform(0, 0.055, -0.02, Math.PI * 0.5, 0, 0, 1.05, 1.0, 0.82)),
    });
    const canopyVisor = trackGeo(out, createCurvedVisorPart(0.082, 0.056, 0.155, 1.65, 0.72, 0.82, 10, 5));
    out.trim.push({
      geo: canopyVisor,
      matrix: craft.clone().multiply(makeTransform(0, 0.082, 0.10, -0.18, 0, 0)),
      colorRgb: brightGold,
    });

    const mastGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0, 0.08, -0.06],
          [0, 0.34, -0.10],
          [0, 0.68, -0.02],
        ],
        0.024,
        0.019,
        0.011,
        10,
        6,
        tungstenCarbon,
        brightGold,
      ),
    );
    out.matte.push({ geo: mastGeo, matrix: craft });

    const centerSail = trackGeo(out, createPetalPart(0.74, 0.46, 0.08, 0.08, 1.15, 12, 8, solarGold, brightGold));
    const sideSail = trackGeo(out, createPetalPart(0.68, 0.36, 0.06, 0.07, 1.25, 10, 6, brightGold, solarGold));
    const sideSailFilm = trackGeo(out, createPetalPart(0.62, 0.30, 0.05, 0.06, 1.25, 8, 5, whiteFlame, coronaOrange));

    out.trim.push({
      geo: centerSail,
      matrix: craft.clone().multiply(makeTransform(0, 0.10, -0.04, -0.12, 0, 0)),
    });

    const centerSailEdge = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.21, 0.36, -0.01],
          [0.0, 0.80, -0.03],
          [0.21, 0.36, -0.01],
        ],
        0.008,
        0.011,
        0.008,
        10,
        6,
      ),
    );
    out.energy.push({ geo: centerSailEdge, matrix: craft, colorRgb: whiteFlame });

    for (const side of [-1, 1] as const) {
      out.trim.push({
        geo: sideSail,
        matrix: craft.clone().multiply(makeTransform(side * 0.12, 0.14, -0.06, -0.14, side * 0.26, -side * 0.62)),
      });
      out.crystal.push({
        geo: sideSailFilm,
        matrix: craft.clone().multiply(makeTransform(side * 0.14, 0.17, -0.03, -0.14, side * 0.26, -side * 0.62)),
      });

      const boom = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.20, 0.0, 0.04],
            [side * 0.44, 0.28, -0.08],
            [side * 0.64, 0.56, -0.24],
          ],
          0.014,
          0.011,
          0.006,
          10,
          6,
        ),
      );
      out.armor.push({ geo: boom, matrix: craft, colorRgb: ceramicWhite });

      const carbonStrut = trackGeo(
        out,
        createOrganicLimb(
          [
            [0.0, 0.28, -0.10],
            [side * 0.34, 0.42, -0.14],
            [side * 0.62, 0.54, -0.25],
          ],
          0.010,
          0.008,
          0.005,
          8,
          6,
        ),
      );
      out.matte.push({ geo: carbonStrut, matrix: craft, colorRgb: tungstenCarbon });
    }

    const bowArcPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 12; k += 1) {
      const f = k / 12;
      const ang = -Math.PI * 0.44 + f * Math.PI * 0.88;
      bowArcPts.push([Math.sin(ang) * 0.44, -0.02 + Math.cos(ang) * 0.10, 0.36 + Math.cos(ang) * 0.24]);
    }
    const deflectorRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(bowArcPts, [0.024, 0.145, 0.024], 0.006, 1.0, 20, 4, 0.008, coronaOrange, whiteFlame),
    );
    const deflectorEdge = trackGeo(out, createTubePart(bowArcPts, 0.013, 18, 6, false));
    out.crystal.push({ geo: deflectorRibbon, matrix: craft });
    out.energy.push({ geo: deflectorEdge, matrix: craft, colorRgb: whiteFlame });

    for (const side of [-1, 1] as const) {
      const wakePts: Vec3Tuple[] = [];
      for (let k = 0; k <= 8; k += 1) {
        const f = k / 8;
        wakePts.push([
          side * (0.24 + f * 0.10),
          -0.04 + Math.sin(f * Math.PI * 1.6) * 0.05,
          -0.48 - f * 0.44,
        ]);
      }
      const wake = trackGeo(
        out,
        createFlowingRibbonMesh(wakePts, [0.042, 0.028, 0.006], 0.008, 1.5, 16, 4, 0, whiteFlame, coronaOrange),
      );
      out.crystal.push({ geo: wake, matrix: craft });
    }

    out.crystalHex = 0xffb703;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.68;
    out.weaponGlowHex = 0xffa62b;
    out.headTopLocalY = 1.64;
  },

  S14: (_ctx, out) => {
    const suitObsidian: RgbTriple = [0.10, 0.15, 0.24];
    const suitSteelCyan: RgbTriple = [0.22, 0.40, 0.56];
    const aeroSilver: RgbTriple = [0.76, 0.86, 0.94];
    const porcelainLight: RgbTriple = [0.90, 0.96, 1.00];
    const chronoGold: RgbTriple = [0.96, 0.80, 0.42];
    const electroCyan: RgbTriple = [0.18, 0.94, 1.00];
    const phaseIce: RgbTriple = [0.74, 0.99, 1.00];

    const liftY = 0.13;
    const torsoYaw = -0.24;
    const headYaw = 0.08;
    const torsoBaseY = 0.66 + liftY;

    const rotT = (x: number, y: number, z: number): THREE.Vector3 => {
      const c = Math.cos(torsoYaw);
      const sn = Math.sin(torsoYaw);
      return new THREE.Vector3(x * c + z * sn, y, -x * sn + z * c);
    };

    const torsoProfile: readonly (readonly [number, number])[] = [
      [0.014, 0.0],
      [0.098, 0.04],
      [0.108, 0.11],
      [0.084, 0.20],
      [0.096, 0.30],
      [0.146, 0.42],
      [0.164, 0.50],
      [0.122, 0.57],
      [0.064, 0.61],
    ];
    const torsoGeo = trackGeo(out, createLathePart(torsoProfile, 14));
    out.matte.push({
      geo: torsoGeo,
      matrix: makeTransform(0, torsoBaseY, 0, 0.11, torsoYaw, 0, 1.06, 1.0, 0.74),
      colorRgb: suitObsidian,
    });

    const torsoRib = trackGeo(out, new THREE.TorusGeometry(0.088, 0.008, 3, 12));
    torsoRib.rotateX(Math.PI * 0.5);
    for (let r = 0; r < 3; r += 1) {
      out.matte.push({
        geo: torsoRib,
        matrix: makeTransform(0, torsoBaseY + 0.18 + r * 0.032, 0.006, 0.10, torsoYaw, 0, 1.04 + r * 0.04, 1.0, 0.74),
        colorRgb: suitSteelCyan,
      });
    }

    const chestPlate = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, -0.115],
          [0.092, -0.045],
          [0.152, 0.058],
          [0.094, 0.118],
          [0, 0.084],
          [-0.094, 0.118],
          [-0.152, 0.058],
          [-0.092, -0.045],
        ],
        0.036,
        0.009,
        0.009,
        1,
        2,
      ),
    );
    const chestCollarYoke = trackGeo(
      out,
      createLathePart(
        [
          [0.154, 0.0],
          [0.136, 0.045],
          [0.096, 0.082],
        ],
        12,
      ),
    );
    const abPlate = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, -0.072],
          [0.068, -0.026],
          [0.076, 0.052],
          [-0.076, 0.052],
          [-0.068, -0.026],
        ],
        0.026,
        0.007,
        0.007,
        1,
        2,
      ),
    );
    const chestPos = rotT(0, torsoBaseY + 0.415, 0.116);
    const abPos = rotT(0, torsoBaseY + 0.25, 0.098);
    out.armor.push(
      {
        geo: chestPlate,
        matrix: makeTransform(chestPos.x, chestPos.y, chestPos.z, -0.06, torsoYaw, 0),
        colorRgb: porcelainLight,
      },
      {
        geo: chestCollarYoke,
        matrix: makeTransform(0, torsoBaseY + 0.51, 0.016, 0.10, torsoYaw, 0, 1.08, 1.0, 0.80),
        colorRgb: aeroSilver,
      },
      {
        geo: abPlate,
        matrix: makeTransform(abPos.x, abPos.y, abPos.z, 0.04, torsoYaw, 0),
        colorRgb: aeroSilver,
      },
    );

    const chestCorePos = rotT(0, torsoBaseY + 0.422, 0.152);
    const chestCore = trackGeo(out, createFacetedCrystalPart(0.112, 0.034, 6, 0.52, 0.48, electroCyan, phaseIce));
    out.energy.push({
      geo: chestCore,
      matrix: makeTransform(chestCorePos.x, chestCorePos.y, chestCorePos.z, 0, torsoYaw, 0, 1.0, 1.0, 0.55),
    });

    for (const s of [-1, 1] as const) {
      const p0 = rotT(s * 0.046, torsoBaseY + 0.46, 0.125);
      const p1 = rotT(s * 0.118, torsoBaseY + 0.42, 0.104);
      const p2 = rotT(s * 0.148, torsoBaseY + 0.34, 0.055);
      const ribLight = trackGeo(
        out,
        createTaperedTubePart(
          [
            [p0.x, p0.y, p0.z],
            [p1.x, p1.y, p1.z],
            [p2.x, p2.y, p2.z],
          ],
          0.0065,
          0.0038,
          6,
          4,
        ),
      );
      out.energy.push({ geo: ribLight, colorRgb: electroCyan });
    }

    const beltRing = trackGeo(out, new THREE.TorusGeometry(0.114, 0.013, 4, 14));
    beltRing.rotateX(Math.PI * 0.5);
    const collarRing = trackGeo(out, new THREE.TorusGeometry(0.090, 0.012, 4, 14));
    collarRing.rotateX(Math.PI * 0.5);
    const beltBuckle = trackGeo(out, createChamferedHexPart(0.026, 0.012, 0.004));
    const bucklePos = rotT(0, torsoBaseY + 0.145, 0.100);
    out.trim.push(
      { geo: beltRing, matrix: makeTransform(0, torsoBaseY + 0.145, 0.01, 0.06, torsoYaw, 0, 1.06, 1.0, 0.78), colorRgb: chronoGold },
      { geo: collarRing, matrix: makeTransform(0, torsoBaseY + 0.58, 0.02, 0.08, torsoYaw, 0), colorRgb: chronoGold },
      { geo: beltBuckle, matrix: makeTransform(bucklePos.x, bucklePos.y, bucklePos.z, 0, torsoYaw, 0), colorRgb: chronoGold },
    );

    const hipPlate = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.044, -0.095],
          [0.036, -0.072],
          [0.050, 0.048],
          [-0.038, 0.056],
        ],
        0.018,
        0.006,
        0.006,
        1,
        2,
      ),
    );
    const hipCell = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.074, 6));
    for (const s of [-1, 1] as const) {
      const hp = rotT(s * 0.122, torsoBaseY + 0.08, 0.008);
      out.armor.push({
        geo: hipPlate,
        matrix: makeTransform(hp.x, hp.y, hp.z, 0.08, torsoYaw + s * Math.PI * 0.5, s * -0.18),
        colorRgb: aeroSilver,
      });
      out.trim.push({
        geo: hipCell,
        matrix: makeTransform(hp.x + s * 0.012, hp.y + 0.03, hp.z + 0.024, 0.12, torsoYaw, s * -0.18),
        colorRgb: chronoGold,
      });
    }

    const legs: readonly {
      readonly pts: readonly Vec3Tuple[];
      readonly side: -1 | 1;
      readonly bootPitch: number;
      readonly footYaw: number;
    }[] = [
      {
        pts: [
          [-0.088, torsoBaseY + 0.03, 0.02],
          [-0.148, torsoBaseY - 0.25, 0.155],
          [-0.126, torsoBaseY - 0.58, 0.052],
        ],
        side: -1,
        bootPitch: 0.26,
        footYaw: 0.16,
      },
      {
        pts: [
          [0.088, torsoBaseY + 0.03, -0.02],
          [0.152, torsoBaseY - 0.29, -0.055],
          [0.178, torsoBaseY - 0.63, -0.165],
        ],
        side: 1,
        bootPitch: 0.42,
        footYaw: -0.28,
      },
    ];

    const thighShell = trackGeo(
      out,
      createLathePart(
        [
          [0.044, -0.44],
          [0.062, -0.16],
          [0.072, 0.16],
          [0.064, 0.42],
        ],
        9,
      ),
    );
    const shinGreave = trackGeo(
      out,
      createLathePart(
        [
          [0.038, -0.46],
          [0.050, -0.16],
          [0.062, 0.14],
          [0.052, 0.42],
        ],
        9,
      ),
    );
    const kneeBellows = trackGeo(out, new THREE.TorusGeometry(0.044, 0.0065, 3, 8));
    kneeBellows.rotateX(Math.PI * 0.5);
    const kneeCap = trackGeo(out, createFacetedCrystalPart(0.088, 0.034, 6, 0.58, 0.42, aeroSilver, porcelainLight));
    const heelSpur = trackGeo(out, createCurvedBladePart(0.11, 0.022, 0.010, -0.02, 0.010, 4));
    const ankleRing = trackGeo(out, new THREE.TorusGeometry(0.040, 0.007, 4, 10));
    ankleRing.rotateX(Math.PI * 0.5);

    for (const leg of legs) {
      const hipV = new THREE.Vector3(...leg.pts[0]!);
      const kneeV = new THREE.Vector3(...leg.pts[1]!);
      const ankleV = new THREE.Vector3(...leg.pts[2]!);

      const legMesh = trackGeo(out, createOrganicLimb(leg.pts, 0.046, 0.038, 0.030, 8, 6, suitObsidian, suitSteelCyan));
      out.matte.push({ geo: legMesh });

      out.armor.push({
        geo: thighShell,
        matrix: makeSegmentTransform(hipV.clone().lerp(kneeV, 0.08), hipV.clone().lerp(kneeV, 0.84), 0.96, 1.12),
        colorRgb: aeroSilver,
      });
      out.armor.push({
        geo: shinGreave,
        matrix: makeSegmentTransform(kneeV.clone().lerp(ankleV, 0.14), kneeV.clone().lerp(ankleV, 0.92), 0.94, 1.16),
        colorRgb: porcelainLight,
      });

      for (const dy of [-0.016, 0.016]) {
        out.matte.push({
          geo: kneeBellows,
          matrix: makeTransform(kneeV.x, kneeV.y + dy, kneeV.z, -0.20, leg.footYaw, 0),
          colorRgb: suitObsidian,
        });
      }
      out.trim.push({
        geo: kneeCap,
        matrix: makeTransform(kneeV.x, kneeV.y, kneeV.z + 0.050, -0.22, leg.footYaw, 0),
        colorRgb: chronoGold,
      });

      const boot = trackGeo(out, createTeardropPart(0.21, 0.042, 1.45, 10, 7, 0, aeroSilver, porcelainLight));
      out.armor.push({
        geo: boot,
        matrix: makeTransform(ankleV.x, ankleV.y - 0.026, ankleV.z + 0.050, Math.PI * 0.5 + leg.bootPitch, leg.footYaw, 0, 0.88, 1.0, 0.72),
      });
      out.trim.push(
        { geo: ankleRing, matrix: makeTransform(ankleV.x, ankleV.y, ankleV.z, 0, leg.footYaw, 0), colorRgb: chronoGold },
        { geo: heelSpur, matrix: makeTransform(ankleV.x, ankleV.y - 0.02, ankleV.z - 0.052, -0.65, leg.footYaw + Math.PI, 0), colorRgb: chronoGold },
      );
    }

    const headY = torsoBaseY + 0.73;
    const headZ = 0.042;
    const headMat = makeTransform(0, headY, headZ, 0.06, headYaw, 0);
    const neckGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.044, 0.095, 8));
    out.matte.push({ geo: neckGeo, matrix: makeTransform(0, torsoBaseY + 0.63, 0.026), colorRgb: suitObsidian });

    const helmetShell = trackGeo(out, createTeardropPart(0.31, 0.098, 1.56, 12, 9, 0.022, suitSteelCyan, porcelainLight));
    out.armor.push({
      geo: helmetShell,
      matrix: headMat.clone().multiply(makeTransform(0, 0.008, -0.024, -Math.PI * 0.5 - 0.24, 0, 0, 0.90, 1.06, 1.06)),
    });

    const cheekJaw = trackGeo(out, createCurvedVisorPart(0.088, 0.052, 0.106, 2.05, 1.56, 0.64, 10, 4));
    out.armor.push({
      geo: cheekJaw,
      matrix: headMat.clone().multiply(makeTransform(0, -0.010, 0.008, 0.12, 0, 0)),
      colorRgb: aeroSilver,
    });
    const gillFin = trackGeo(out, createCurvedBladePart(0.062, 0.012, 0.005, -0.012, 0.005, 3));
    for (const side of [-1, 1] as const) {
      for (let g = 0; g < 3; g += 1) {
        out.matte.push({
          geo: gillFin,
          matrix: headMat.clone().multiply(makeTransform(side * 0.082, -0.012 + g * 0.018, -0.018 - g * 0.012, 0.18, side * 0.22, side * -0.34, side, 1, 1)),
          colorRgb: suitObsidian,
        });
      }
    }

    const chinKeel = trackGeo(out, createTeardropPart(0.11, 0.038, 1.45, 8, 6, 0, suitObsidian, suitSteelCyan));
    out.matte.push({
      geo: chinKeel,
      matrix: headMat.clone().multiply(makeTransform(0, -0.056, 0.068, Math.PI * 0.58, 0, 0, 0.95, 1.0, 0.68)),
    });

    const visorGlass = trackGeo(out, createCurvedVisorPart(0.096, 0.070, 0.118, 1.88, 0.92, 0.64, 12, 5));
    out.crystal.push({
      geo: visorGlass,
      matrix: headMat.clone().multiply(makeTransform(0, 0.004, 0.015, 0.08, 0, 0)),
      colorRgb: electroCyan,
    });
    const hudBand = trackGeo(out, createCurvedVisorPart(0.092, 0.032, 0.114, 1.72, 1.12, 0.28, 10, 3));
    out.energy.push({
      geo: hudBand,
      matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.018, 0.08, 0, 0)),
      colorRgb: electroCyan,
    });

    const helmKeelRidge = trackGeo(out, createCurvedBladePart(0.24, 0.034, 0.014, -0.06, 0.016, 5));
    const helmCrestGold = trackGeo(out, createCurvedBladePart(0.22, 0.022, 0.008, -0.08, 0.018, 5));
    out.armor.push({
      geo: helmKeelRidge,
      matrix: headMat.clone().multiply(makeTransform(0, 0.072, -0.016, -0.96, Math.PI * 0.5, 0)),
      colorRgb: porcelainLight,
    });
    out.trim.push({
      geo: helmCrestGold,
      matrix: headMat.clone().multiply(makeTransform(0, 0.084, -0.026, -0.92, Math.PI * 0.5, 0)),
      colorRgb: chronoGold,
    });

    const lSh = rotT(-0.194, torsoBaseY + 0.50, 0.008);
    const rSh = rotT(0.194, torsoBaseY + 0.50, 0.008);
    const lEl = rotT(-0.315, torsoBaseY + 0.36, 0.095);
    const rEl = rotT(0.325, torsoBaseY + 0.44, 0.085);
    const lHand = rotT(-0.355, torsoBaseY + 0.25, 0.255);
    const rHand = rotT(0.375, torsoBaseY + 0.37, 0.275);

    const arms: readonly {
      readonly sh: THREE.Vector3;
      readonly el: THREE.Vector3;
      readonly hand: THREE.Vector3;
      readonly side: -1 | 1;
    }[] = [
      { sh: lSh, el: lEl, hand: lHand, side: -1 },
      { sh: rSh, el: rEl, hand: rHand, side: 1 },
    ];

    const bicepShell = trackGeo(out, createLathePart([[0.036, -0.40], [0.048, -0.05], [0.050, 0.24], [0.042, 0.42]], 8));
    const forearmBracer = trackGeo(out, createLathePart([[0.034, -0.44], [0.046, -0.10], [0.048, 0.22], [0.038, 0.44]], 8));
    const pauldronOuter = trackGeo(out, createCurvedVisorPart(0.112, 0.096, 0.102, 2.20, 0.36, 1.24, 8, 4));
    const pauldronFin = trackGeo(out, createCreatureFin(0.15, 0.16, 0.08, 0.026, 0.014, 6, 3, porcelainLight, aeroSilver));
    const bladeSpine = trackGeo(out, createCurvedBladePart(0.70, 0.046, 0.015, 0.16, 0.034, 8));
    const bladeFuller = trackGeo(out, createCurvedBladePart(0.62, 0.014, 0.018, 0.15, 0.036, 6));
    const bladeCrystal = trackGeo(out, createCurvedBladePart(0.78, 0.088, 0.008, 0.19, 0.040, 8));
    const bladeEdge = trackGeo(out, createCurvedBladePart(0.76, 0.026, 0.008, 0.185, 0.042, 7));
    const knuckleGuard = trackGeo(out, new THREE.TorusGeometry(0.068, 0.007, 4, 12, Math.PI * 1.15));
    const guardWing = trackGeo(out, createCurvedBladePart(0.11, 0.022, 0.010, 0.025, 0.010, 4));
    const hilt = trackGeo(out, new THREE.CylinderGeometry(0.015, 0.013, 0.19, 7));
    const pommelCrystal = trackGeo(out, new THREE.OctahedronGeometry(0.018, 0));
    const cuff = trackGeo(out, new THREE.TorusGeometry(0.038, 0.007, 4, 10));

    for (const arm of arms) {
      const s = arm.side;
      const armGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [arm.sh.x, arm.sh.y, arm.sh.z],
            [arm.el.x, arm.el.y, arm.el.z],
            [arm.hand.x, arm.hand.y, arm.hand.z],
          ],
          0.036,
          0.032,
          0.026,
          8,
          6,
          suitObsidian,
          suitSteelCyan,
        ),
      );
      out.matte.push({ geo: armGeo });

      out.armor.push(
        {
          geo: bicepShell,
          matrix: makeSegmentTransform(arm.sh.clone().lerp(arm.el, 0.12), arm.sh.clone().lerp(arm.el, 0.84), 0.96, 1.06),
          colorRgb: aeroSilver,
        },
        {
          geo: forearmBracer,
          matrix: makeSegmentTransform(arm.el.clone().lerp(arm.hand, 0.14), arm.el.clone().lerp(arm.hand, 0.90), 0.96, 1.08),
          colorRgb: porcelainLight,
        },
        {
          geo: pauldronOuter,
          matrix: makeTransform(arm.sh.x + s * 0.012, arm.sh.y + 0.016, arm.sh.z, 0.08, torsoYaw + s * -Math.PI * 0.45, s * -0.22),
          colorRgb: porcelainLight,
        },
        {
          geo: pauldronFin,
          matrix: makeTransform(arm.sh.x + s * 0.026, arm.sh.y + 0.044, arm.sh.z - 0.01, 0.14, torsoYaw, -s * 0.36, s, 1, 1),
        },
      );

      out.trim.push({
        geo: cuff,
        matrix: makeTransform(arm.hand.x, arm.hand.y, arm.hand.z, Math.PI * 0.4, s * 0.3, 0),
        colorRgb: chronoGold,
      });

      const bladeRot = s === -1
        ? makeTransform(arm.hand.x, arm.hand.y, arm.hand.z, 2.08, -0.45, -0.72)
        : makeTransform(arm.hand.x, arm.hand.y, arm.hand.z, 0.92, 0.38, -0.58);

      out.matte.push({ geo: hilt, matrix: bladeRot, colorRgb: suitObsidian });
      out.energy.push({
        geo: pommelCrystal,
        matrix: bladeRot.clone().multiply(makeTransform(0, -0.105, 0)),
        colorRgb: electroCyan,
      });
      out.trim.push(
        {
          geo: cuff,
          matrix: bladeRot.clone().multiply(makeTransform(0, 0.088, 0, Math.PI * 0.5, 0, 0, 0.88, 0.88, 0.88)),
          colorRgb: chronoGold,
        },
        {
          geo: knuckleGuard,
          matrix: bladeRot.clone().multiply(makeTransform(0, 0.015, 0.016, 0, Math.PI * 0.5, -Math.PI * 0.55)),
          colorRgb: chronoGold,
        },
        {
          geo: guardWing,
          matrix: bladeRot.clone().multiply(makeTransform(s * 0.018, 0.088, 0.012, 0.22, s === -1 ? Math.PI : 0, s * -0.35)),
          colorRgb: chronoGold,
        },
      );
      out.armor.push({
        geo: bladeSpine,
        matrix: bladeRot.clone().multiply(makeTransform(0, 0.088, 0, 0, s === -1 ? Math.PI : 0, 0)),
        colorRgb: aeroSilver,
      });
      out.energy.push({
        geo: bladeFuller,
        matrix: bladeRot.clone().multiply(makeTransform(0, 0.115, 0, 0, s === -1 ? Math.PI : 0, 0)),
        colorRgb: electroCyan,
      });
      out.crystal.push({
        geo: bladeCrystal,
        matrix: bladeRot.clone().multiply(makeTransform(0, 0.088, 0.004, 0, s === -1 ? Math.PI : 0, 0)),
        colorRgb: phaseIce,
      });
      out.energy.push({
        geo: bladeEdge,
        matrix: bladeRot.clone().multiply(makeTransform(s * 0.014, 0.098, 0.006, 0, s === -1 ? Math.PI : 0, 0)),
        colorRgb: electroCyan,
      });
    }

    const backPos = rotT(0, torsoBaseY + 0.42, -0.16);
    const chronoPack = trackGeo(out, createTeardropPart(0.36, 0.082, 1.35, 10, 8, 0.015, suitObsidian, aeroSilver));
    out.armor.push({
      geo: chronoPack,
      matrix: makeTransform(backPos.x, backPos.y, backPos.z, 0.14, torsoYaw, 0, 1.12, 1.0, 0.68),
    });

    const gyroOrigin = rotT(0, torsoBaseY + 0.46, -0.24);
    const matGyroA = makeTransform(gyroOrigin.x, gyroOrigin.y, gyroOrigin.z, 0.44, torsoYaw + 0.56, 0.28);
    const matGyroB = makeTransform(gyroOrigin.x, gyroOrigin.y, gyroOrigin.z, -0.52, torsoYaw - 0.62, -0.34);

    const linkageBar = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.013, 0.12, 6));
    const bearingHub = trackGeo(out, new THREE.TorusGeometry(0.036, 0.008, 4, 10));
    out.matte.push({
      geo: linkageBar,
      matrix: makeTransform(
        (backPos.x + gyroOrigin.x) * 0.5,
        (backPos.y + gyroOrigin.y) * 0.5,
        (backPos.z + gyroOrigin.z) * 0.5,
        Math.PI * 0.5,
        torsoYaw,
        0,
      ),
      colorRgb: suitObsidian,
    });
    out.trim.push({
      geo: bearingHub,
      matrix: makeTransform(gyroOrigin.x, gyroOrigin.y, gyroOrigin.z, 0, torsoYaw, 0),
      colorRgb: chronoGold,
    });

    const strutRod = trackGeo(out, new THREE.CylinderGeometry(0.006, 0.007, 0.44, 5));
    for (let st = 0; st < 2; st += 1) {
      const a = st * Math.PI * 0.5;
      out.armor.push({
        geo: strutRod,
        matrix: matGyroA.clone().multiply(makeTransform(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0, 0, 0, a - Math.PI * 0.5)),
        colorRgb: aeroSilver,
      });
    }

    const gyroOuterA = trackGeo(out, new THREE.TorusGeometry(0.46, 0.013, 5, 22));
    const gyroEnergyA = trackGeo(out, new THREE.TorusGeometry(0.432, 0.008, 4, 22));
    const gyroOuterB = trackGeo(out, new THREE.TorusGeometry(0.36, 0.011, 5, 18));
    const gyroEnergyB = trackGeo(out, new THREE.TorusGeometry(0.335, 0.007, 4, 18));
    const dilationHalo = trackGeo(out, new THREE.TorusGeometry(0.40, 0.020, 5, 22));

    out.trim.push(
      { geo: gyroOuterA, matrix: matGyroA, colorRgb: chronoGold },
      { geo: gyroOuterB, matrix: matGyroB, colorRgb: aeroSilver },
    );
    out.energy.push(
      { geo: gyroEnergyA, matrix: matGyroA, colorRgb: electroCyan },
      { geo: gyroEnergyB, matrix: matGyroB, colorRgb: phaseIce },
    );
    out.crystal.push({
      geo: dilationHalo,
      matrix: matGyroA.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 1.0, 0.25)),
      colorRgb: electroCyan,
    });

    for (const sgn of [-1, 1] as const) {
      const energyArc = trackGeo(
        out,
        createTaperedTubePart(
          [
            [sgn * 0.34, 0.08, 0.02],
            [sgn * 0.41, 0.16, 0.09],
            [sgn * 0.43, -0.02, 0.06],
            [sgn * 0.35, -0.14, -0.04],
          ],
          0.006,
          0.004,
          8,
          4,
        ),
      );
      out.energy.push({ geo: energyArc, matrix: matGyroA, colorRgb: electroCyan });
    }

    const tickPin = trackGeo(out, new THREE.OctahedronGeometry(0.018, 0));
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2;
      out.trim.push({
        geo: tickPin,
        matrix: matGyroA.clone().multiply(makeTransform(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0, 0, 0, a, 0.85, 1.45, 0.65)),
        colorRgb: chronoGold,
      });
    }

    out.crystalHex = 0x22d3ee;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.64;
    out.weaponGlowHex = 0x22d3ee;
    out.headTopLocalY = headY + 0.24;
  },

  S15: (_ctx, out) => {
    const iceCeramic: RgbTriple = [0.80, 0.93, 0.99];
    const glacierWhite: RgbTriple = [0.94, 0.98, 1.00];
    const abyssTitanium: RgbTriple = [0.16, 0.25, 0.36];
    const pressureGold: RgbTriple = [0.94, 0.80, 0.44];
    const sonarCyan: RgbTriple = [0.28, 0.88, 1.00];
    const hydroEmerald: RgbTriple = [0.18, 0.90, 0.72];

    const subMat = makeTransform(0, 0.84, -0.02, 0.08, -0.26, 0.06);

    const hullBody = trackGeo(out, createTeardropPart(1.06, 0.225, 1.38, 22, 14, 0.020, abyssTitanium, iceCeramic));
    out.armor.push({
      geo: hullBody,
      matrix: subMat.clone().multiply(makeTransform(0, 0.02, -0.04, -Math.PI * 0.5, 0, 0, 1.18, 1.0, 0.78)),
    });

    const dorsalCap = trackGeo(out, createTeardropPart(0.76, 0.145, 1.30, 16, 10, 0.015, iceCeramic, glacierWhite));
    out.armor.push({
      geo: dorsalCap,
      matrix: subMat.clone().multiply(makeTransform(0, 0.115, 0.02, -Math.PI * 0.5, 0, 0, 1.05, 1.0, 0.56)),
    });

    const ventralKeel = trackGeo(out, createTeardropPart(0.84, 0.135, 1.35, 14, 10, 0, abyssTitanium, abyssTitanium));
    out.matte.push({
      geo: ventralKeel,
      matrix: subMat.clone().multiply(makeTransform(0, -0.095, -0.06, -Math.PI * 0.5, 0, 0, 1.12, 1.0, 0.52)),
    });

    for (const rz of [-0.18, 0.04, 0.22]) {
      const rScale = rz > 0.15 ? 0.94 : rz < -0.1 ? 0.84 : 1.02;
      const ribRing = trackGeo(out, new THREE.TorusGeometry(0.205 * rScale, 0.011, 6, 20));
      out.trim.push({
        geo: ribRing,
        matrix: subMat.clone().multiply(makeTransform(0, 0.015, rz, 0, 0, 0, 1.20, 0.78, 1.0)),
        colorRgb: pressureGold,
      });
    }

    const mantaWing = trackGeo(out, createCreatureFin(0.48, 0.56, 0.28, 0.048, 0.042, 12, 6, iceCeramic, glacierWhite));
    const wingUnder = trackGeo(out, createCreatureFin(0.42, 0.50, 0.26, 0.036, 0.024, 10, 5, abyssTitanium, abyssTitanium));
    const dorsalFin = trackGeo(out, createCreatureFin(0.32, 0.26, 0.19, 0.012, 0.022, 10, 5, iceCeramic, glacierWhite));

    out.armor.push({
      geo: dorsalFin,
      matrix: subMat.clone().multiply(makeTransform(0, 0.14, -0.12, 0, 0, Math.PI * 0.5)),
    });

    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: mantaWing,
        matrix: subMat.clone().multiply(makeTransform(side * 0.14, -0.01, 0.08, 0.04, 0, -side * 0.10, side, 1, 1)),
      });
      out.matte.push({
        geo: wingUnder,
        matrix: subMat.clone().multiply(makeTransform(side * 0.14, -0.038, 0.06, 0.04, 0, -side * 0.10, side, 1, 1)),
      });

      const leadEdge = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.22, -0.01, 0.24],
            [side * 0.46, 0.01, 0.12],
            [side * 0.66, -0.03, -0.14],
          ],
          0.015,
          0.012,
          0.008,
          10,
          6,
        ),
      );
      out.trim.push({ geo: leadEdge, matrix: subMat, colorRgb: pressureGold });

      const tipPod = trackGeo(out, createTeardropPart(0.20, 0.028, 1.3, 10, 6, 0, abyssTitanium, iceCeramic));
      out.matte.push({
        geo: tipPod,
        matrix: subMat.clone().multiply(makeTransform(side * 0.66, -0.03, -0.14, Math.PI * 0.5, 0, 0)),
      });
      const tipLight = trackGeo(out, new THREE.SphereGeometry(0.016, 10, 8));
      out.energy.push({
        geo: tipLight,
        matrix: subMat.clone().multiply(makeTransform(side * 0.66, -0.03, -0.03)),
        colorRgb: hydroEmerald,
      });
    }

    const domeFlange = trackGeo(out, new THREE.TorusGeometry(0.188, 0.018, 6, 22));
    out.trim.push({
      geo: domeFlange,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, 0.34, 0, 0, 0, 1.12, 0.86, 1.0)),
      colorRgb: pressureGold,
    });

    const sonarDome = trackGeo(out, new THREE.SphereGeometry(0.186, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56));
    out.crystal.push({
      geo: sonarDome,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, 0.34, Math.PI * 0.5, 0, 0, 1.12, 1.0, 0.86)),
      colorRgb: [0.64, 0.94, 1.0],
    });

    const transducerCore = trackGeo(out, new THREE.SphereGeometry(0.064, 14, 10));
    const transducerRing = trackGeo(out, new THREE.TorusGeometry(0.112, 0.010, 6, 18));
    out.energy.push({
      geo: transducerCore,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, 0.40)),
      colorRgb: sonarCyan,
    });
    out.trim.push({
      geo: transducerRing,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, 0.39)),
      colorRgb: pressureGold,
    });

    const pumpShroud = trackGeo(out, new THREE.TorusGeometry(0.118, 0.024, 6, 20));
    const pumpGlow = trackGeo(out, new THREE.TorusGeometry(0.094, 0.012, 6, 18));
    out.matte.push({
      geo: pumpShroud,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, -0.50)),
      colorRgb: abyssTitanium,
    });
    out.energy.push({
      geo: pumpGlow,
      matrix: subMat.clone().multiply(makeTransform(0, 0.01, -0.51)),
      colorRgb: hydroEmerald,
    });

    const tailFluke = trackGeo(out, createCreatureFin(0.28, 0.42, 0.22, 0.036, 0.018, 10, 5, iceCeramic, glacierWhite));
    const tailMembrane = trackGeo(out, createCreatureFin(0.22, 0.44, 0.24, 0.036, 0.007, 8, 4, sonarCyan, hydroEmerald));
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: tailFluke,
        matrix: subMat.clone().multiply(makeTransform(side * 0.05, 0.02, -0.52, 0.16, 0, side * 0.34, side, 1, 1)),
      });
      out.crystal.push({
        geo: tailMembrane,
        matrix: subMat.clone().multiply(makeTransform(side * 0.06, 0.02, -0.58, 0.16, 0, side * 0.34, side, 1, 1)),
      });
    }

    const sonarRings: readonly (readonly [number, number, number])[] = [
      [0.24, 0.60, 0.010],
      [0.34, 0.72, 0.008],
      [0.44, 0.84, 0.006],
    ];
    for (let i = 0; i < sonarRings.length; i += 1) {
      const [rad, zPos, tube] = sonarRings[i]!;
      const waveRing = trackGeo(out, new THREE.TorusGeometry(rad, tube, 6, 24));
      out.crystal.push({
        geo: waveRing,
        matrix: subMat.clone().multiply(makeTransform(0, 0.01, zPos, 0, 0, 0, 1.05, 0.88, 1.0)),
        colorRgb: i === 0 ? sonarCyan : hydroEmerald,
      });
      if (i === 0) {
        const pulseHighlight = trackGeo(out, new THREE.TorusGeometry(rad * 0.96, 0.006, 5, 22));
        out.energy.push({
          geo: pulseHighlight,
          matrix: subMat.clone().multiply(makeTransform(0, 0.01, zPos, 0, 0, 0, 1.05, 0.88, 1.0)),
          colorRgb: sonarCyan,
        });
      }
    }

    const hexPatch = trackGeo(out, createHexMirrorTilePart(0.088, 0.012, 0.005, 0.006, [0.54, 0.94, 1.0], [0.22, 0.82, 0.88]));
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * Math.PI * 2;
      out.crystal.push({
        geo: hexPatch,
        matrix: subMat.clone().multiply(makeTransform(Math.cos(a) * 0.19, 0.01 + Math.sin(a) * 0.15, 0.64, -Math.sin(a) * 0.28, Math.cos(a) * 0.28, 0)),
      });
    }

    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.45;
    out.crystalIntensity = 0.58;
    out.weaponGlowHex = 0x34d399;
    out.headTopLocalY = 1.44;
  },

  S17: (_ctx, out) => {
    const voidCarbon: RgbTriple = [0.16, 0.13, 0.26];
    const obsidianDark: RgbTriple = [0.10, 0.11, 0.19];
    const violetCeramic: RgbTriple = [0.76, 0.72, 0.90];
    const coilGold: RgbTriple = [0.96, 0.78, 0.40];
    const antimatterMagenta: RgbTriple = [0.94, 0.32, 1.00];
    const pureWhiteCore: RgbTriple = [1.00, 0.92, 1.00];

    const centerY = 0.96;

    const cryoBaseProfile: readonly (readonly [number, number])[] = [
      [0.014, 0.0],
      [0.24, 0.03],
      [0.28, 0.09],
      [0.21, 0.17],
      [0.14, 0.24],
    ];
    const cryoBase = trackGeo(out, createLathePart(cryoBaseProfile, 20));
    out.matte.push({ geo: cryoBase, matrix: makeTransform(0, 0.14, 0), colorRgb: voidCarbon });

    const cryoTrim = trackGeo(out, new THREE.TorusGeometry(0.275, 0.013, 6, 24));
    cryoTrim.rotateX(Math.PI * 0.5);
    out.trim.push({ geo: cryoTrim, matrix: makeTransform(0, 0.23, 0), colorRgb: coilGold });

    const singularityCore = trackGeo(out, new THREE.SphereGeometry(0.152, 18, 14));
    out.energy.push({
      geo: singularityCore,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: pureWhiteCore,
    });

    const vacuumSphere = trackGeo(out, new THREE.SphereGeometry(0.288, 20, 14));
    out.crystal.push({
      geo: vacuumSphere,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: [0.92, 0.58, 1.0],
    });

    for (let s = 0; s < 5; s += 1) {
      const phase = (s / 5) * Math.PI * 2;
      const arcPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const f = k / 10;
        const a = phase + f * Math.PI * 2.1;
        const elev = (f - 0.5) * Math.PI * 0.88;
        const r = 0.20 + Math.sin(f * Math.PI * 3) * 0.030;
        arcPts.push([
          Math.cos(a) * Math.cos(elev) * r,
          centerY + Math.sin(elev) * r,
          Math.sin(a) * Math.cos(elev) * r,
        ]);
      }
      const plasmaArc = trackGeo(out, createTaperedTubePart(arcPts, 0.014, 0.005, 12, 6));
      out.energy.push({ geo: plasmaArc, colorRgb: s % 2 === 0 ? antimatterMagenta : pureWhiteCore });
    }

    const electrodeProfile: readonly (readonly [number, number])[] = [
      [0.014, 0.0],
      [0.055, 0.04],
      [0.145, 0.09],
      [0.185, 0.14],
      [0.148, 0.18],
    ];
    const electrodeGeo = trackGeo(out, createLathePart(electrodeProfile, 20));
    const electrodeRing = trackGeo(out, new THREE.TorusGeometry(0.172, 0.012, 6, 20));
    electrodeRing.rotateX(Math.PI * 0.5);

    for (const dir of [-1, 1] as const) {
      out.armor.push({
        geo: electrodeGeo,
        matrix: makeTransform(0, centerY + dir * 0.44, 0, dir === 1 ? Math.PI : 0, 0, 0),
        colorRgb: violetCeramic,
      });
      out.trim.push({
        geo: electrodeRing,
        matrix: makeTransform(0, centerY + dir * 0.30, 0),
        colorRgb: coilGold,
      });
    }

    const ringAxes: readonly Vec3Tuple[] = [
      [Math.PI * 0.5, 0.0, 0.0],
      [0.24, 0.52, 0.18],
      [-0.24, -0.52, -0.18],
    ];
    const cageMainRing = trackGeo(out, new THREE.TorusGeometry(0.455, 0.026, 6, 26));
    const cageGoldCoilA = trackGeo(out, new THREE.TorusGeometry(0.482, 0.009, 5, 24));
    const cageGoldCoilB = trackGeo(out, new THREE.TorusGeometry(0.426, 0.009, 5, 24));
    const poleShoe = trackGeo(out, createFacetedCrystalPart(0.12, 0.034, 6, 0.58, 0.42, voidCarbon, violetCeramic));

    for (let rIdx = 0; rIdx < ringAxes.length; rIdx += 1) {
      const [rx, ry, rz] = ringAxes[rIdx]!;
      const rMat = makeTransform(0, centerY, 0, rx, ry, rz);
      out.matte.push({ geo: cageMainRing, matrix: rMat, colorRgb: voidCarbon });
      out.trim.push(
        { geo: cageGoldCoilA, matrix: rMat, colorRgb: coilGold },
        { geo: cageGoldCoilB, matrix: rMat, colorRgb: coilGold },
      );
      for (let k = 0; k < 4; k += 1) {
        const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
        out.armor.push({
          geo: poleShoe,
          matrix: rMat.clone().multiply(makeTransform(Math.cos(a) * 0.41, Math.sin(a) * 0.41, 0, 0, 0, a + Math.PI * 0.5)),
        });
      }
    }

    for (let c = 0; c < 4; c += 1) {
      const a = (c / 4) * Math.PI * 2 + Math.PI * 0.25;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const conduit = trackGeo(
        out,
        createOrganicLimb(
          [
            [ca * 0.23, 0.24, sa * 0.23],
            [ca * 0.46, 0.48, sa * 0.46],
            [ca * 0.52, 0.78, sa * 0.52],
            [ca * 0.45, centerY, sa * 0.45],
          ],
          0.020,
          0.016,
          0.014,
          10,
          6,
          obsidianDark,
          violetCeramic,
        ),
      );
      out.armor.push({ geo: conduit });

      const clamp = trackGeo(out, new THREE.TorusGeometry(0.024, 0.007, 5, 12));
      out.trim.push({
        geo: clamp,
        matrix: makeTransform(ca * 0.49, 0.62, sa * 0.49, Math.PI * 0.42, -a, 0),
        colorRgb: coilGold,
      });
    }

    const emitterRingA = trackGeo(out, new THREE.TorusGeometry(0.14, 0.012, 6, 18));
    const emitterRingB = trackGeo(out, new THREE.TorusGeometry(0.095, 0.009, 5, 16));
    out.trim.push(
      { geo: emitterRingA, matrix: makeTransform(0, centerY, 0.46), colorRgb: coilGold },
      { geo: emitterRingB, matrix: makeTransform(0, centerY, 0.56), colorRgb: violetCeramic },
    );
    const emitterSpark = trackGeo(out, new THREE.OctahedronGeometry(0.034, 0));
    out.energy.push({
      geo: emitterSpark,
      matrix: makeTransform(0, centerY, 0.56, 0, 0, 0, 0.9, 0.9, 1.5),
      colorRgb: pureWhiteCore,
    });

    for (const tilt of [0.55, -0.55]) {
      const fluxPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 12; k += 1) {
        const a = (k / 12) * Math.PI * 2;
        fluxPts.push([Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0]);
      }
      const fluxBand = trackGeo(
        out,
        createFlowingRibbonMesh(fluxPts, [0.036, 0.042, 0.036], 0.006, 2.0, 20, 4, 0, antimatterMagenta, pureWhiteCore, true),
      );
      out.crystal.push({
        geo: fluxBand,
        matrix: makeTransform(0, centerY, 0, tilt, tilt * 0.8, 0),
      });
    }

    out.crystalHex = 0xd946ef;
    out.crystalOpacity = 0.42;
    out.crystalIntensity = 0.68;
    out.weaponGlowHex = 0xe879f9;
    out.headTopLocalY = 1.58;
  },

  S18: (_ctx, out) => {
    const sailGold: RgbTriple = [0.98, 0.82, 0.42];
    const warmChampagne: RgbTriple = [1.00, 0.90, 0.58];
    const hullPorcelain: RgbTriple = [0.94, 0.96, 0.99];
    const deepTealCarbon: RgbTriple = [0.13, 0.21, 0.25];
    const emeraldBeacon: RgbTriple = [0.16, 0.94, 0.64];
    const emeraldSoft: RgbTriple = [0.62, 1.00, 0.84];

    const craft = makeTransform(0, 0.94, -0.02, -0.18, -0.24, 0.08);

    const noseConeProfile: readonly (readonly [number, number])[] = [
      [0.004, 0.54],
      [0.038, 0.38],
      [0.082, 0.18],
      [0.125, 0.04],
      [0.110, 0.00],
    ];
    const noseGeo = trackGeo(out, createLathePart(noseConeProfile, 22));
    const tailBusProfile: readonly (readonly [number, number])[] = [
      [0.095, -0.26],
      [0.072, -0.34],
      [0.036, -0.44],
      [0.008, -0.49],
    ];
    const tailBusGeo = trackGeo(out, createLathePart(tailBusProfile, 18));
    out.armor.push(
      { geo: noseGeo, matrix: craft.clone().multiply(makeTransform(0, 0, 0.04, Math.PI * 0.5, 0, 0)), colorRgb: hullPorcelain },
      { geo: tailBusGeo, matrix: craft.clone().multiply(makeTransform(0, 0, 0.04, Math.PI * 0.5, 0, 0)), colorRgb: hullPorcelain },
    );

    for (const [zPos, rCol] of [[0.40, 0.046], [0.24, 0.082], [0.06, 0.126], [-0.24, 0.098]] as const) {
      const collar = trackGeo(out, new THREE.TorusGeometry(rCol, 0.011, 6, 22));
      out.trim.push({
        geo: collar,
        matrix: craft.clone().multiply(makeTransform(0, 0, zPos)),
        colorRgb: sailGold,
      });
    }

    const coreZ = -0.09;
    for (let p = 0; p < 4; p += 1) {
      const a = (p / 4) * Math.PI * 2;
      const strut = trackGeo(
        out,
        createOrganicLimb(
          [
            [Math.cos(a) * 0.115, Math.sin(a) * 0.115, 0.06],
            [Math.cos(a) * 0.165, Math.sin(a) * 0.165, coreZ],
            [Math.cos(a) * 0.095, Math.sin(a) * 0.095, -0.24],
          ],
          0.012,
          0.014,
          0.012,
          8,
          6,
          deepTealCarbon,
          sailGold,
        ),
      );
      out.matte.push({ geo: strut, matrix: craft });
    }

    const laserNeedle = trackGeo(out, createTaperedTubePart([[0, 0, 0.56], [0, 0, 0.76], [0, 0, 0.96]], 0.013, 0.003, 10, 8));
    out.energy.push({ geo: laserNeedle, matrix: craft, colorRgb: emeraldBeacon });

    const lightConeProfile: readonly (readonly [number, number])[] = [
      [0.022, 0.56],
      [0.11, 0.76],
      [0.20, 0.94],
    ];
    const lightCone = trackGeo(out, createLathePart(lightConeProfile, 22));
    out.crystal.push({
      geo: lightCone,
      matrix: craft.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: emeraldSoft,
    });
    const conePulseRing = trackGeo(out, new THREE.TorusGeometry(0.14, 0.007, 5, 20));
    out.energy.push({
      geo: conePulseRing,
      matrix: craft.clone().multiply(makeTransform(0, 0, 0.80)),
      colorRgb: emeraldBeacon,
    });

    const beaconCore = trackGeo(out, new THREE.IcosahedronGeometry(0.105, 1));
    out.energy.push({
      geo: beaconCore,
      matrix: craft.clone().multiply(makeTransform(0, 0, coreZ)),
      colorRgb: emeraldBeacon,
    });

    const storageShell = trackGeo(out, new THREE.SphereGeometry(0.148, 18, 12));
    out.crystal.push({
      geo: storageShell,
      matrix: craft.clone().multiply(makeTransform(0, 0, coreZ)),
      colorRgb: emeraldSoft,
    });

    const cageRingA = trackGeo(out, new THREE.TorusGeometry(0.182, 0.011, 6, 22));
    const cageRingB = trackGeo(out, new THREE.TorusGeometry(0.165, 0.009, 6, 20));
    out.trim.push(
      { geo: cageRingA, matrix: craft.clone().multiply(makeTransform(0, 0, coreZ, 0.52, 0.42, 0)), colorRgb: sailGold },
      { geo: cageRingB, matrix: craft.clone().multiply(makeTransform(0, 0, coreZ, -0.58, 0.94, 0)), colorRgb: sailGold },
    );

    const sailLeaf = trackGeo(out, createCreatureFin(0.34, 0.68, 0.30, 0.055, 0.008, 12, 6, warmChampagne, sailGold));
    const sailRibGold = trackGeo(out, createCreatureFin(0.09, 0.64, 0.28, 0.052, 0.010, 10, 4, sailGold, warmChampagne));
    const sailAngles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

    for (let i = 0; i < sailAngles.length; i += 1) {
      const ang = sailAngles[i]!;
      const sailPivot = craft.clone().multiply(makeTransform(0, 0, -0.06, 0, 0, ang));

      out.crystal.push({
        geo: sailLeaf,
        matrix: sailPivot.clone().multiply(makeTransform(0.12, 0, 0, 0.14, 0, 0)),
      });
      out.trim.push({
        geo: sailRibGold,
        matrix: sailPivot.clone().multiply(makeTransform(0.12, 0.008, 0.04, 0.14, 0, 0)),
      });

      const spar = trackGeo(
        out,
        createOrganicLimb(
          [
            [0.11, 0.0, 0.02],
            [0.44, 0.04, -0.10],
            [0.78, 0.02, -0.28],
          ],
          0.014,
          0.010,
          0.005,
          12,
          8,
          deepTealCarbon,
          sailGold,
        ),
      );
      out.matte.push({ geo: spar, matrix: sailPivot });

      const tipNode = trackGeo(out, new THREE.OctahedronGeometry(0.024, 0));
      out.energy.push({
        geo: tipNode,
        matrix: sailPivot.clone().multiply(makeTransform(0.78, 0.02, -0.28)),
        colorRgb: emeraldBeacon,
      });
    }

    const tailNozzle = trackGeo(out, new THREE.CylinderGeometry(0.028, 0.048, 0.11, 14));
    out.matte.push({
      geo: tailNozzle,
      matrix: craft.clone().multiply(makeTransform(0, 0, -0.42, Math.PI * 0.5, 0, 0)),
      colorRgb: deepTealCarbon,
    });
    const ionTail = trackGeo(out, createTeardropPart(0.32, 0.036, 1.6, 14, 10, 0, emeraldSoft, emeraldBeacon));
    out.energy.push({
      geo: ionTail,
      matrix: craft.clone().multiply(makeTransform(0, 0, -0.58, -Math.PI * 0.5, 0, 0)),
    });

    out.crystalHex = 0xfde68a;
    out.crystalOpacity = 0.44;
    out.crystalIntensity = 0.58;
    out.weaponGlowHex = 0x10b981;
    out.headTopLocalY = 1.56;
  },

  S19: (_ctx, out) => {
    const heatCeramic: RgbTriple = [0.94, 0.96, 0.99];
    const slatePorcelain: RgbTriple = [0.80, 0.85, 0.92];
    const tungstenDark: RgbTriple = [0.15, 0.18, 0.24];
    const dysonGold: RgbTriple = [0.98, 0.78, 0.34];
    const amberFlare: RgbTriple = [1.00, 0.62, 0.16];
    const solarWhite: RgbTriple = [1.00, 0.95, 0.70];

    const ship = makeTransform(0, 0.88, -0.06, -0.14, -0.24, 0.06, 1.08, 1.08, 1.08);

    const bridgeHull = trackGeo(out, createTeardropPart(0.80, 0.195, 1.32, 18, 12, 0.018, slatePorcelain, heatCeramic));
    out.armor.push({
      geo: bridgeHull,
      matrix: ship.clone().multiply(makeTransform(0, 0.08, -0.24, -Math.PI * 0.5, 0, 0, 1.16, 1.0, 0.88)),
    });

    const bridgeTower = trackGeo(out, createTeardropPart(0.42, 0.125, 1.25, 14, 10, 0.012, heatCeramic, heatCeramic));
    out.armor.push({
      geo: bridgeTower,
      matrix: ship.clone().multiply(makeTransform(0, 0.24, -0.22, -Math.PI * 0.5 + 0.18, 0, 0, 0.94, 1.0, 0.78)),
    });

    const bridgeVisor = trackGeo(out, createCurvedVisorPart(0.112, 0.050, 0.142, 1.56, 0.96, 0.52, 12, 4));
    out.trim.push({
      geo: bridgeVisor,
      matrix: ship.clone().multiply(makeTransform(0, 0.25, -0.09, 0.08, 0, 0)),
      colorRgb: dysonGold,
    });

    const heatBelly = trackGeo(out, createTeardropPart(0.74, 0.165, 1.3, 14, 10, 0, tungstenDark, tungstenDark));
    out.matte.push({
      geo: heatBelly,
      matrix: ship.clone().multiply(makeTransform(0, -0.05, -0.24, -Math.PI * 0.5, 0, 0, 1.22, 1.0, 0.62)),
    });

    const ventralFin = trackGeo(out, createCreatureFin(0.28, 0.26, 0.18, 0.01, 0.018, 8, 4, tungstenDark, slatePorcelain));
    out.matte.push({
      geo: ventralFin,
      matrix: ship.clone().multiply(makeTransform(0, -0.14, -0.26, 0, 0, -Math.PI * 0.5)),
    });

    const radFin = trackGeo(out, createCreatureFin(0.34, 0.44, 0.24, 0.04, 0.020, 10, 5, heatCeramic, slatePorcelain));
    const engineProfile: readonly (readonly [number, number])[] = [
      [0.070, 0.0],
      [0.054, -0.05],
      [0.072, -0.12],
      [0.086, -0.16],
    ];
    const engineGeo = trackGeo(out, createLathePart(engineProfile, 16));
    const engineFlame = trackGeo(out, createTeardropPart(0.32, 0.052, 1.55, 10, 8, 0, solarWhite, amberFlare));

    for (const side of [-1, 1] as const) {
      const podHull = trackGeo(out, createTeardropPart(0.70, 0.118, 1.38, 14, 10, 0, slatePorcelain, heatCeramic));
      out.armor.push({
        geo: podHull,
        matrix: ship.clone().multiply(makeTransform(side * 0.29, 0.02, -0.24, -Math.PI * 0.5, 0, 0, 0.96, 1.0, 0.88)),
      });
      out.armor.push({
        geo: radFin,
        matrix: ship.clone().multiply(makeTransform(side * 0.26, 0.08, -0.32, 0.06, 0, side * 0.34, side, 1, 1)),
      });

      out.trim.push({
        geo: engineGeo,
        matrix: ship.clone().multiply(makeTransform(side * 0.27, 0.01, -0.55, -Math.PI * 0.5, 0, 0)),
        colorRgb: dysonGold,
      });
      out.energy.push({
        geo: engineFlame,
        matrix: ship.clone().multiply(makeTransform(side * 0.27, 0.01, -0.72, -Math.PI * 0.5, 0, 0)),
      });

      const outerClaw = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.29, 0.02, -0.06],
            [side * 0.50, 0.04, 0.16],
            [side * 0.45, 0.03, 0.48],
            [side * 0.24, 0.03, 0.70],
          ],
          0.058,
          0.046,
          0.024,
          14,
          8,
          heatCeramic,
          slatePorcelain,
        ),
      );
      const innerBone = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.23, -0.02, -0.02],
            [side * 0.40, -0.01, 0.18],
            [side * 0.37, -0.01, 0.46],
            [side * 0.21, 0.00, 0.65],
          ],
          0.034,
          0.028,
          0.015,
          10,
          6,
          tungstenDark,
          tungstenDark,
        ),
      );
      const magRail = trackGeo(
        out,
        createTaperedTubePart(
          [
            [side * 0.24, 0.03, 0.04],
            [side * 0.38, 0.03, 0.22],
            [side * 0.35, 0.03, 0.46],
            [side * 0.22, 0.03, 0.64],
          ],
          0.015,
          0.010,
          12,
          6,
        ),
      );
      out.armor.push({ geo: outerClaw, matrix: ship });
      out.matte.push({ geo: innerBone, matrix: ship });
      out.energy.push({ geo: magRail, matrix: ship, colorRgb: amberFlare });

      const coilPts: readonly (readonly [number, number, number, number])[] = [
        [side * 0.43, 0.03, 0.08, -side * 0.45],
        [side * 0.49, 0.04, 0.26, -side * 0.05],
        [side * 0.42, 0.03, 0.48, side * 0.38],
        [side * 0.32, 0.03, 0.62, side * 0.65],
      ];
      for (const [cx, cy, cz, yaw] of coilPts) {
        const coil = trackGeo(out, new THREE.TorusGeometry(0.060, 0.012, 5, 14));
        out.trim.push({
          geo: coil,
          matrix: ship.clone().multiply(makeTransform(cx, cy, cz, 0, yaw, 0)),
          colorRgb: dysonGold,
        });
      }
    }

    const flareZ = 0.36;
    const flareY = 0.04;

    const sunCore = trackGeo(out, new THREE.SphereGeometry(0.168, 18, 12));
    out.energy.push({
      geo: sunCore,
      matrix: ship.clone().multiply(makeTransform(0, flareY, flareZ)),
      colorRgb: solarWhite,
    });

    const coronaShell = trackGeo(out, new THREE.SphereGeometry(0.245, 18, 12));
    out.crystal.push({
      geo: coronaShell,
      matrix: ship.clone().multiply(makeTransform(0, flareY, flareZ)),
      colorRgb: amberFlare,
    });

    for (let f = 0; f < 4; f += 1) {
      const phase = (f / 4) * Math.PI * 2;
      const promPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const a = phase + t * Math.PI * 1.85;
        const r = 0.20 + Math.sin(t * Math.PI) * 0.105;
        const y = flareY + Math.sin(t * Math.PI * 2 + phase) * 0.15;
        promPts.push([Math.cos(a) * r, y, flareZ + Math.sin(a) * r]);
      }
      const promArc = trackGeo(out, createTaperedTubePart(promPts, 0.016, 0.005, 12, 6));
      out.energy.push({ geo: promArc, matrix: ship, colorRgb: f % 2 === 0 ? solarWhite : amberFlare });

      if (f < 2) {
        const promRibbon = trackGeo(
          out,
          createFlowingRibbonMesh(promPts, [0.024, 0.064, 0.018], 0.010, 2.0, 16, 4, 0, amberFlare, solarWhite),
        );
        out.crystal.push({ geo: promRibbon, matrix: ship });
      }
    }

    const containRingTop = trackGeo(out, new THREE.TorusGeometry(0.30, 0.011, 6, 22));
    containRingTop.rotateX(Math.PI * 0.5);
    const containArchVert = trackGeo(out, new THREE.TorusGeometry(0.31, 0.010, 6, 22, Math.PI * 1.15));
    out.trim.push(
      { geo: containRingTop, matrix: ship.clone().multiply(makeTransform(0, flareY + 0.19, flareZ)), colorRgb: dysonGold },
      { geo: containRingTop, matrix: ship.clone().multiply(makeTransform(0, flareY - 0.18, flareZ)), colorRgb: dysonGold },
      { geo: containArchVert, matrix: ship.clone().multiply(makeTransform(0, flareY, flareZ, 0, Math.PI * 0.5, -Math.PI * 0.08)), colorRgb: dysonGold },
    );

    const bridgeArch = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.24, 0.14, -0.12],
          [0, 0.39, -0.18],
          [0.24, 0.14, -0.12],
        ],
        0.016,
        0.020,
        0.016,
        10,
        6,
      ),
    );
    out.trim.push({ geo: bridgeArch, matrix: ship, colorRgb: dysonGold });

    out.crystalHex = 0xffa62b;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.72;
    out.weaponGlowHex = 0xffb703;
    out.headTopLocalY = 1.56;
  },
};
