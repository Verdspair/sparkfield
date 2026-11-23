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

function createClockGearPart(
  outerR: number,
  innerR: number,
  toothCount: number,
  toothDepth: number,
  thickness: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / toothCount;
  const rootR = outerR - toothDepth;
  for (let i = 0; i < toothCount; i += 1) {
    const a0 = i * step;
    const a1 = a0 + step * 0.20;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.80;
    const pts: readonly (readonly [number, number])[] = [
      [Math.cos(a0) * rootR, Math.sin(a0) * rootR],
      [Math.cos(a1) * rootR, Math.sin(a1) * rootR],
      [Math.cos(a2) * outerR, Math.sin(a2) * outerR],
      [Math.cos(a3) * outerR, Math.sin(a3) * outerR],
      [Math.cos(a4) * rootR, Math.sin(a4) * rootR],
    ];
    pts.forEach(([x, y], idx) => {
      if (i === 0 && idx === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();

  if (innerR > 0.008 && innerR < rootR * 0.85) {
    const hole = new THREE.Path();
    const segs = 16;
    for (let i = 0; i < segs; i += 1) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * innerR;
      const y = Math.sin(a) * innerR;
      if (i === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    }
    hole.closePath();
    shape.holes.push(hole);
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: Math.min(0.004, thickness * 0.25),
    bevelThickness: Math.min(0.004, thickness * 0.25),
    bevelSegments: 1,
    curveSegments: 4,
  });
  geo.translate(0, 0, -thickness * 0.5);
  geo.computeVertexNormals();
  return geo;
}

export const UNIT_PACK_2_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S11: (_ctx, out) => {
    const porcelain: RgbTriple = [0.89, 0.92, 0.96];
    const mistCeramic: RgbTriple = [0.75, 0.82, 0.90];
    const slateFrame: RgbTriple = [0.18, 0.23, 0.32];
    const paleGold: RgbTriple = [0.82, 0.76, 0.60];
    const logicCyan: RgbTriple = [0.34, 0.78, 0.92];
    const deepSapphire: RgbTriple = [0.22, 0.52, 0.82];
    const iceSheen: RgbTriple = [0.72, 0.90, 0.97];

    const arkY = 0.88;
    const arkZ = -0.05;

    const diamondDeck = (rx: number, rz: number): readonly (readonly [number, number])[] => [
      [0, rz],
      [rx * 0.56, rz * 0.52],
      [rx, 0],
      [rx * 0.56, -rz * 0.52],
      [0, -rz],
      [-rx * 0.56, -rz * 0.52],
      [-rx, 0],
      [-rx * 0.56, rz * 0.52],
    ];

    const lowerDeckGeo = trackGeo(out, createBevelExtrudePart(diamondDeck(0.32, 0.42), 0.095, 0.014, 0.014, 2));
    lowerDeckGeo.rotateX(Math.PI * 0.5);
    const midCoreDeckGeo = trackGeo(out, createBevelExtrudePart(diamondDeck(0.28, 0.36), 0.10, 0.010, 0.010, 1));
    midCoreDeckGeo.rotateX(Math.PI * 0.5);
    const upperDeckGeo = trackGeo(out, createBevelExtrudePart(diamondDeck(0.37, 0.48), 0.11, 0.016, 0.016, 2));
    upperDeckGeo.rotateX(Math.PI * 0.5);
    const crownDeckGeo = trackGeo(out, createBevelExtrudePart(diamondDeck(0.24, 0.32), 0.085, 0.012, 0.012, 2));
    crownDeckGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: lowerDeckGeo, matrix: makeTransform(0, arkY - 0.16, arkZ), colorRgb: mistCeramic },
      { geo: upperDeckGeo, matrix: makeTransform(0, arkY + 0.06, arkZ), colorRgb: porcelain },
      { geo: crownDeckGeo, matrix: makeTransform(0, arkY + 0.24, arkZ - 0.02), colorRgb: porcelain },
    );
    out.matte.push(
      { geo: midCoreDeckGeo, matrix: makeTransform(0, arkY - 0.05, arkZ), colorRgb: slateFrame },
    );

    const keelAnchorGeo = trackGeo(
      out,
      createFacetedCrystalPart(0.46, 0.16, 4, 0.26, 0.74, slateFrame, mistCeramic),
    );
    out.armor.push({
      geo: keelAnchorGeo,
      matrix: makeTransform(0, arkY - 0.34, arkZ, 0, Math.PI * 0.25, 0),
    });

    const spireCrystalGeo = trackGeo(
      out,
      createFacetedCrystalPart(0.56, 0.095, 6, 0.66, 0.34, deepSapphire, logicCyan),
    );
    out.energy.push({
      geo: spireCrystalGeo,
      matrix: makeTransform(0, arkY + 0.30, arkZ - 0.02),
    });

    const spireCageGeo = trackGeo(out, new THREE.OctahedronGeometry(0.145, 0));
    out.crystal.push({
      geo: spireCageGeo,
      matrix: makeTransform(0, arkY + 0.38, arkZ - 0.02, 0, Math.PI * 0.25, 0, 0.85, 1.45, 0.85),
      colorRgb: iceSheen,
    });

    const gravRingLow = trackGeo(out, new THREE.TorusGeometry(0.165, 0.011, 8, 24));
    gravRingLow.rotateX(Math.PI * 0.5);
    const eqHaloOuter = trackGeo(out, new THREE.TorusGeometry(0.46, 0.013, 8, 32));
    eqHaloOuter.rotateX(Math.PI * 0.5);
    const eqHaloEnergy = trackGeo(out, new THREE.TorusGeometry(0.415, 0.008, 6, 28));
    eqHaloEnergy.rotateX(Math.PI * 0.5);
    const topHaloTrim = trackGeo(out, new THREE.TorusGeometry(0.24, 0.009, 6, 24));
    topHaloTrim.rotateX(Math.PI * 0.5);

    out.energy.push(
      { geo: gravRingLow, matrix: makeTransform(0, 0.26, arkZ), colorRgb: logicCyan },
      { geo: eqHaloEnergy, matrix: makeTransform(0, arkY - 0.04, arkZ), colorRgb: logicCyan },
    );
    out.trim.push(
      { geo: eqHaloOuter, matrix: makeTransform(0, arkY - 0.04, arkZ), colorRgb: paleGold },
      { geo: topHaloTrim, matrix: makeTransform(0, arkY + 0.33, arkZ - 0.02), colorRgb: paleGold },
    );

    const keelFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.14],
          [0.14, 0.06],
          [0.08, -0.14],
          [0, -0.18],
        ],
        0.022,
        0.004,
        0.004,
        1,
      ),
    );
    for (let i = 0; i < 3; i += 1) {
      const ang = (i / 3) * Math.PI * 2 + Math.PI / 3;
      out.armor.push({
        geo: keelFinGeo,
        matrix: makeTransform(
          Math.sin(ang) * 0.11,
          0.44,
          arkZ + Math.cos(ang) * 0.11,
          0,
          ang - Math.PI * 0.5,
          0,
        ),
        colorRgb: porcelain,
      });
    }

    const rearWingGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0],
          [0.24, 0.22],
          [0.16, 0.36],
          [-0.04, 0.14],
        ],
        0.026,
        0.005,
        0.005,
        1,
      ),
    );
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: rearWingGeo,
        matrix: makeTransform(side * 0.15, arkY + 0.22, arkZ - 0.20, -0.22, side * -0.42, side * -0.18, side, 1, 1),
        colorRgb: porcelain,
      });
      const louverGeo = trackGeo(out, createChamferedHexPart(0.068, 0.026, 0.005, 0.032));
      out.matte.push({
        geo: louverGeo,
        matrix: makeTransform(side * 0.20, arkY + 0.04, arkZ - 0.26, 0.14, side * -0.58, 0),
        colorRgb: slateFrame,
      });
    }

    const cardinalNodeGeo = trackGeo(out, new THREE.OctahedronGeometry(0.034, 0));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      out.trim.push({
        geo: cardinalNodeGeo,
        matrix: makeTransform(Math.cos(a) * 0.46, arkY - 0.04, arkZ + Math.sin(a) * 0.46, 0, a, 0),
        colorRgb: paleGold,
      });
    }

    const hexTileGeo = trackGeo(out, createHexMirrorTilePart(0.118, 0.018, 0.008, 0.008, iceSheen, deepSapphire));
    const hexFrameGeo = trackGeo(out, createChamferedHexPart(0.128, 0.024, 0.005, 0.098));
    const strutGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 1, 8));
    const emitterCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.042, 0.045, 6));
    emitterCapGeo.rotateX(Math.PI * 0.5);
    const shieldRailGeo = trackGeo(
      out,
      createTubePart(
        [
          [-0.22, 0.16, 0.018],
          [0, 0.24, 0.024],
          [0.22, 0.16, 0.018],
        ],
        0.009,
        12,
        6,
        false,
      ),
    );

    const shieldConfigs: readonly {
      readonly yaw: number;
      readonly dist: number;
      readonly y: number;
      readonly pitch: number;
      readonly tileOffsets: readonly (readonly [number, number])[];
    }[] = [
      {
        yaw: 0,
        dist: 0.49,
        y: 0.72,
        pitch: -0.10,
        tileOffsets: [
          [0, 0.10],
          [-0.175, 0.0],
          [0.175, 0.0],
          [0, -0.105],
        ],
      },
      {
        yaw: -1.04,
        dist: 0.52,
        y: 0.84,
        pitch: -0.06,
        tileOffsets: [
          [0, 0.105],
          [-0.17, 0.0],
          [0.17, 0.0],
          [0, -0.105],
        ],
      },
      {
        yaw: 1.04,
        dist: 0.52,
        y: 0.84,
        pitch: -0.06,
        tileOffsets: [
          [0, 0.105],
          [-0.17, 0.0],
          [0.17, 0.0],
          [0, -0.105],
        ],
      },
    ];

    for (const cfg of shieldConfigs) {
      const sx = Math.sin(cfg.yaw) * cfg.dist;
      const sz = arkZ + Math.cos(cfg.yaw) * cfg.dist;
      const shieldMat = makeTransform(sx, cfg.y, sz, cfg.pitch, cfg.yaw, 0);

      const armStart = new THREE.Vector3(Math.sin(cfg.yaw) * 0.24, arkY - 0.04, arkZ + Math.cos(cfg.yaw) * 0.24);
      const armEnd = new THREE.Vector3(sx - Math.sin(cfg.yaw) * 0.04, cfg.y, sz - Math.cos(cfg.yaw) * 0.04);
      out.matte.push({
        geo: strutGeo,
        matrix: makeSegmentTransform(armStart, armEnd),
        colorRgb: slateFrame,
      });
      out.trim.push({
        geo: emitterCapGeo,
        matrix: shieldMat.clone().multiply(makeTransform(0, 0, -0.025)),
        colorRgb: paleGold,
      });
      out.energy.push({
        geo: shieldRailGeo,
        matrix: shieldMat,
        colorRgb: logicCyan,
      });

      for (const [ox, oy] of cfg.tileOffsets) {
        const tileMat = shieldMat.clone().multiply(makeTransform(ox, oy, 0));
        out.crystal.push({ geo: hexTileGeo, matrix: tileMat });
        out.armor.push({ geo: hexFrameGeo, matrix: tileMat, colorRgb: porcelain });
      }
    }

    const dataVeinGeo = trackGeo(
      out,
      createTubePart(
        [
          [-0.29, arkY + 0.06, arkZ + 0.08],
          [0, arkY + 0.06, arkZ + 0.44],
          [0.29, arkY + 0.06, arkZ + 0.08],
        ],
        0.011,
        14,
        6,
        false,
      ),
    );
    out.energy.push({ geo: dataVeinGeo, colorRgb: logicCyan });

    out.crystalHex = 0x5cccf0;
    out.crystalOpacity = 0.46;
    out.crystalIntensity = 0.52;
    out.weaponGlowHex = 0x46c4eb;
    out.headTopLocalY = 1.64;
  },

  S12: (_ctx, out) => {
    const porcelain: RgbTriple = [0.90, 0.93, 0.97];
    const mistBlue: RgbTriple = [0.74, 0.83, 0.92];
    const slateCore: RgbTriple = [0.19, 0.24, 0.34];
    const champagneGold: RgbTriple = [0.85, 0.78, 0.60];
    const stringCyan: RgbTriple = [0.42, 0.84, 0.96];
    const stringWhite: RgbTriple = [0.86, 0.96, 1.00];
    const acousticBlue: RgbTriple = [0.28, 0.64, 0.90];

    const harpMat = makeTransform(-0.05, 0.10, 0.0, 0.04, -0.26, 0.0);

    const spineCurve: readonly Vec3Tuple[] = [
      [-0.28, 0.36, 0.0],
      [-0.02, 0.28, 0.0],
      [0.24, 0.42, 0.0],
      [0.34, 0.78, 0.0],
      [0.28, 1.18, 0.0],
      [0.08, 1.44, 0.0],
      [-0.22, 1.48, 0.0],
      [-0.38, 1.32, 0.0],
    ];
    const mainArchGeo = trackGeo(out, createOrganicLimb(spineCurve, 0.032, 0.054, 0.026, 26, 12, mistBlue, porcelain));
    out.armor.push({ geo: mainArchGeo, matrix: harpMat });

    const soundboxCurve: readonly Vec3Tuple[] = [
      [0.18, 0.40, 0.0],
      [0.32, 0.76, 0.0],
      [0.26, 1.14, 0.0],
    ];
    const soundboxShellGeo = trackGeo(out, createOrganicLimb(soundboxCurve, 0.060, 0.082, 0.048, 16, 12));
    out.armor.push({
      geo: soundboxShellGeo,
      matrix: harpMat.clone().multiply(makeTransform(0.03, 0, 0, 0, 0, 0, 1.1, 1.0, 0.72)),
      colorRgb: porcelain,
    });

    const soundSlotGeo = trackGeo(out, createTaperedTubePart(soundboxCurve, 0.032, 0.024, 14, 8));
    out.matte.push({
      geo: soundSlotGeo,
      matrix: harpMat.clone().multiply(makeTransform(-0.02, 0, 0, 0, 0, 0, 0.9, 1.0, 1.05)),
      colorRgb: slateCore,
    });

    const frontBowCurve: readonly Vec3Tuple[] = [
      [-0.30, 0.38, 0.0],
      [-0.40, 0.72, 0.0],
      [-0.42, 1.08, 0.0],
      [-0.38, 1.32, 0.0],
    ];
    const frontBowGeo = trackGeo(out, createTaperedTubePart(frontBowCurve, 0.015, 0.012, 16, 8));
    out.trim.push({ geo: frontBowGeo, matrix: harpMat, colorRgb: champagneGold });

    const innerGlowArch = trackGeo(
      out,
      createTubePart(
        [
          [-0.26, 0.41, 0.0],
          [0.02, 0.34, 0.0],
          [0.22, 0.48, 0.0],
          [0.29, 0.80, 0.0],
          [0.23, 1.16, 0.0],
          [0.04, 1.38, 0.0],
          [-0.24, 1.42, 0.0],
        ],
        0.009,
        24,
        6,
        false,
      ),
    );
    out.energy.push({ geo: innerGlowArch, matrix: harpMat, colorRgb: stringCyan });

    const lowerBridgeCurve: readonly Vec3Tuple[] = [
      [-0.26, 0.39, 0.0],
      [-0.02, 0.33, 0.0],
      [0.22, 0.45, 0.0],
    ];
    const lowerBridgeGeo = trackGeo(out, createOrganicLimb(lowerBridgeCurve, 0.024, 0.038, 0.028, 14, 10));
    out.matte.push({ geo: lowerBridgeGeo, matrix: harpMat, colorRgb: slateCore });

    const stringGeo = trackGeo(out, new THREE.CylinderGeometry(0.0055, 0.0055, 1, 6));
    const pegGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.009, 0.046, 8));
    const beadGeo = trackGeo(out, new THREE.OctahedronGeometry(0.020, 0));

    for (let i = 0; i < 7; i += 1) {
      const f = i / 6;
      const x = -0.32 + f * 0.50;
      const yBot = 0.39 - Math.sin(f * Math.PI) * 0.05 + f * 0.06;
      const yTop = 1.34 + Math.sin(f * Math.PI * 0.85) * 0.11 - Math.pow(f, 2.2) * 0.14;
      const sStart = new THREE.Vector3(x, yBot, 0);
      const sEnd = new THREE.Vector3(x, yTop, 0);
      const tone: RgbTriple = [
        stringCyan[0] + (stringWhite[0] - stringCyan[0]) * (i % 2 === 0 ? 0.2 : 0.7),
        stringCyan[1] + (stringWhite[1] - stringCyan[1]) * (i % 2 === 0 ? 0.2 : 0.7),
        stringCyan[2] + (stringWhite[2] - stringCyan[2]) * (i % 2 === 0 ? 0.2 : 0.7),
      ];
      out.energy.push({
        geo: stringGeo,
        matrix: harpMat.clone().multiply(makeSegmentTransform(sStart, sEnd)),
        colorRgb: tone,
      });
      out.trim.push(
        {
          geo: pegGeo,
          matrix: harpMat.clone().multiply(makeTransform(x, yTop + 0.02, 0, 0, 0, -0.12)),
          colorRgb: champagneGold,
        },
        {
          geo: pegGeo,
          matrix: harpMat.clone().multiply(makeTransform(x, yBot - 0.015, 0, 0, 0, 0.08, 0.85, 0.8, 0.85)),
          colorRgb: champagneGold,
        },
      );
      const beadY = yBot + (yTop - yBot) * (0.28 + 0.44 * f);
      out.crystal.push({
        geo: beadGeo,
        matrix: harpMat.clone().multiply(makeTransform(x, beadY, 0, 0.3, f * 1.4, 0)),
        colorRgb: stringWhite,
      });
    }

    const upperPetalGeo = trackGeo(out, createPetalPart(0.56, 0.22, 0.042, 0.055, 1.35, 14, 8, mistBlue, porcelain));
    const upperInnerPetalGeo = trackGeo(out, createPetalPart(0.42, 0.14, 0.025, 0.04, 1.45, 12, 6, acousticBlue, stringWhite));
    const lowerPetalGeo = trackGeo(out, createPetalPart(0.44, 0.18, 0.036, 0.044, 1.30, 12, 8, porcelain, mistBlue));
    const lowerInnerPetalGeo = trackGeo(out, createPetalPart(0.32, 0.11, 0.022, 0.03, 1.40, 10, 6, stringCyan, stringWhite));

    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: upperPetalGeo,
        matrix: harpMat.clone().multiply(
          makeTransform(0.24, 1.12, side * 0.05, side * -0.44, side * 0.36, -0.58, 1, 1, side),
        ),
      });
      out.crystal.push({
        geo: upperInnerPetalGeo,
        matrix: harpMat.clone().multiply(
          makeTransform(0.22, 1.10, side * 0.08, side * -0.34, side * 0.32, -0.44, 1, 1, side),
        ),
      });
      out.armor.push({
        geo: lowerPetalGeo,
        matrix: harpMat.clone().multiply(
          makeTransform(0.18, 0.46, side * 0.05, side * -0.40, side * 0.28, -2.28, 1, 1, side),
        ),
      });
      out.crystal.push({
        geo: lowerInnerPetalGeo,
        matrix: harpMat.clone().multiply(
          makeTransform(0.16, 0.48, side * 0.08, side * -0.32, side * 0.24, -2.14, 1, 1, side),
        ),
      });
    }

    const crownFinialGeo = trackGeo(out, createFacetedCrystalPart(0.20, 0.048, 6, 0.62, 0.38, acousticBlue, stringWhite));
    out.crystal.push({
      geo: crownFinialGeo,
      matrix: harpMat.clone().multiply(makeTransform(-0.36, 1.44, 0, 0, 0, 0.32)),
    });

    const chimeCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.22, 0.055, 6, 0.38, 0.62, acousticBlue, stringCyan));
    out.energy.push({
      geo: chimeCrystalGeo,
      matrix: harpMat.clone().multiply(makeTransform(-0.02, 0.20, 0)),
    });

    const chimeCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.068, 0.008, 6, 18));
    chimeCollarGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: chimeCollarGeo,
      matrix: harpMat.clone().multiply(makeTransform(-0.02, 0.28, 0)),
      colorRgb: champagneGold,
    });

    const haloArcOuter = trackGeo(out, new THREE.TorusGeometry(0.46, 0.009, 6, 26, Math.PI * 1.15));
    const haloArcInner = trackGeo(out, new THREE.TorusGeometry(0.36, 0.007, 6, 22, Math.PI * 0.92));
    out.trim.push({
      geo: haloArcOuter,
      matrix: harpMat.clone().multiply(makeTransform(0.06, 0.92, -0.14, 0.14, 0.12, -0.52)),
      colorRgb: champagneGold,
    });
    out.energy.push({
      geo: haloArcInner,
      matrix: harpMat.clone().multiply(makeTransform(0.06, 0.92, -0.10, -0.12, -0.14, 0.95)),
      colorRgb: stringCyan,
    });

    const soundWaveRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [-0.36, 0.58, 0.10],
          [-0.08, 0.72, 0.16],
          [0.24, 0.96, 0.12],
          [0.42, 1.24, -0.04],
        ],
        [0.018, 0.042, 0.012],
        0.010,
        2.0,
        22,
        4,
        0.005,
        acousticBlue,
        stringWhite,
      ),
    );
    out.crystal.push({ geo: soundWaveRibbon, matrix: harpMat });

    out.crystalHex = 0x76d6f6;
    out.crystalOpacity = 0.42;
    out.crystalIntensity = 0.50;
    out.weaponGlowHex = 0x4cccf0;
    out.headTopLocalY = 1.74;
  },

  S13: (_ctx, out) => {
    const forgedGold: RgbTriple = [0.84, 0.67, 0.35];
    const brightSolarGold: RgbTriple = [0.90, 0.76, 0.44];
    const deepCopper: RgbTriple = [0.58, 0.34, 0.20];
    const sootIron: RgbTriple = [0.19, 0.18, 0.20];
    const gunmetal: RgbTriple = [0.30, 0.28, 0.29];
    const moltenAmber: RgbTriple = [0.94, 0.62, 0.22];
    const solarWhite: RgbTriple = [0.97, 0.85, 0.54];

    const craft = makeTransform(0.0, 0.86, 0.02, -0.22, -0.14, 0.34);

    const pontoonProfile: readonly (readonly [number, number])[] = [
      [0.0, 0.52],
      [0.078, 0.24],
      [0.095, -0.10],
      [0.068, -0.44],
      [0.0, -0.50],
      [-0.068, -0.44],
      [-0.095, -0.10],
      [-0.078, 0.24],
    ];
    const pontoonGeo = trackGeo(out, createBevelExtrudePart(pontoonProfile, 0.125, 0.014, 0.014, 2));
    pontoonGeo.rotateX(Math.PI * 0.5);

    const noseCowlGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.008, 0.22],
          [0.048, 0.12],
          [0.082, 0.0],
          [0.074, -0.05],
        ],
        12,
      ),
    );
    noseCowlGeo.rotateX(Math.PI * 0.5);

    const troughWallGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.026, 0.28],
          [0.026, 0.24],
          [0.032, -0.32],
          [-0.026, -0.34],
        ],
        0.052,
        0.006,
        0.006,
        1,
      ),
    );
    troughWallGeo.rotateX(Math.PI * 0.5);

    const troughCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.028, 0.024, 0.48, 8));
    troughCoreGeo.rotateX(Math.PI * 0.5);

    const nozzleGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.046, 0.0],
          [0.036, -0.06],
          [0.058, -0.14],
          [0.050, -0.15],
        ],
        12,
      ),
    );
    nozzleGeo.rotateX(Math.PI * 0.5);

    const nozzleGlowGeo = trackGeo(out, new THREE.ConeGeometry(0.042, 0.22, 10));
    nozzleGlowGeo.rotateX(-Math.PI * 0.5);

    const tailFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0],
          [0.02, 0.22],
          [-0.22, 0.28],
          [-0.26, 0.04],
        ],
        0.020,
        0.004,
        0.004,
        1,
      ),
    );
    tailFinGeo.rotateY(Math.PI * 0.5);

    const wingMainGeo = trackGeo(out, createCreatureFin(0.54, 0.62, 0.30, 0.055, 0.032, 14, 8, deepCopper, forgedGold));
    const scimitarBladeGeo = trackGeo(out, createCurvedBladePart(0.58, 0.130, 0.024, 0.18, 0.042, 10));
    const bladeEdgeGeo = trackGeo(out, createCurvedBladePart(0.56, 0.050, 0.014, 0.19, 0.046, 10));
    const canardFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.04],
          [0.14, -0.04],
          [0.10, -0.10],
          [0, -0.06],
        ],
        0.018,
        0.004,
        0.004,
        1,
      ),
    );
    canardFinGeo.rotateX(Math.PI * 0.5);
    const wingSparGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.008, 0.58, 6));
    wingSparGeo.rotateZ(Math.PI * 0.5);
    const wingtipCapGeo = trackGeo(out, createFacetedCrystalPart(0.14, 0.026, 6, 0.65, 0.35, moltenAmber, solarWhite));
    wingtipCapGeo.rotateX(Math.PI * 0.5);
    const louverFinGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 0.09, 6));
    louverFinGeo.rotateZ(Math.PI * 0.5);
    const hexFoilGeo = trackGeo(out, createHexMirrorTilePart(0.088, 0.014, 0.006, 0.006, brightSolarGold, deepCopper));
    const hexCrystalFoilGeo = trackGeo(out, createHexMirrorTilePart(0.072, 0.012, 0.005, 0.006, solarWhite, moltenAmber));
    const opticSlitGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.010, 0.14, 6));
    opticSlitGeo.rotateX(Math.PI * 0.5);

    for (const side of [-1, 1] as const) {
      const px = side * 0.23;
      out.armor.push(
        { geo: pontoonGeo, matrix: craft.clone().multiply(makeTransform(px, 0, 0)), colorRgb: deepCopper },
        { geo: noseCowlGeo, matrix: craft.clone().multiply(makeTransform(px, 0.01, 0.44)), colorRgb: forgedGold },
        {
          geo: tailFinGeo,
          matrix: craft.clone().multiply(makeTransform(px + side * 0.05, 0.06, -0.34, 0, 0, side * -0.34)),
          colorRgb: deepCopper,
        },
        {
          geo: wingMainGeo,
          matrix: craft.clone().multiply(makeTransform(px + side * 0.06, 0.02, -0.02, 0.06, 0, side * 0.10, side, 1, 1)),
        },
      );

      out.matte.push(
        { geo: troughWallGeo, matrix: craft.clone().multiply(makeTransform(px - side * 0.045, 0.082, -0.06)), colorRgb: sootIron },
        { geo: troughWallGeo, matrix: craft.clone().multiply(makeTransform(px + side * 0.045, 0.082, -0.06)), colorRgb: sootIron },
        { geo: nozzleGeo, matrix: craft.clone().multiply(makeTransform(px, 0.0, -0.48)), colorRgb: sootIron },
      );

      out.energy.push(
        { geo: troughCoreGeo, matrix: craft.clone().multiply(makeTransform(px, 0.078, -0.06)), colorRgb: moltenAmber },
        { geo: nozzleGlowGeo, matrix: craft.clone().multiply(makeTransform(px, 0.0, -0.66)), colorRgb: solarWhite },
        { geo: opticSlitGeo, matrix: craft.clone().multiply(makeTransform(px, 0.052, 0.34)), colorRgb: moltenAmber },
      );

      out.trim.push({
        geo: scimitarBladeGeo,
        matrix: craft.clone().multiply(
          makeTransform(px + side * 0.14, 0.01, 0.12, Math.PI * 0.5 - 0.12, side * 0.34, side * -0.18, side, 1, 1),
        ),
        colorRgb: brightSolarGold,
      });
      out.energy.push({
        geo: bladeEdgeGeo,
        matrix: craft.clone().multiply(
          makeTransform(px + side * 0.17, 0.015, 0.16, Math.PI * 0.5 - 0.12, side * 0.34, side * -0.18, side, 1, 1),
        ),
        colorRgb: moltenAmber,
      });

      for (let t = 0; t < 3; t += 1) {
        const wx = px + side * (0.22 + t * 0.16);
        const wz = -0.04 - t * 0.10;
        const wy = 0.06 + t * 0.016;
        const tileM = craft.clone().multiply(makeTransform(wx, wy, wz, -Math.PI * 0.5 + 0.06, 0, side * 0.10));
        out.trim.push({ geo: hexFoilGeo, matrix: tileM });
        if (t === 1) {
          out.crystal.push({
            geo: hexCrystalFoilGeo,
            matrix: craft.clone().multiply(makeTransform(wx, wy + 0.014, wz, -Math.PI * 0.5 + 0.06, 0, side * 0.10)),
          });
        }
      }

      out.armor.push({
        geo: canardFinGeo,
        matrix: craft.clone().multiply(makeTransform(px + side * 0.07, -0.01, 0.34, 0, 0, side * -0.14, side, 1, 1)),
        colorRgb: forgedGold,
      });
      out.matte.push(
        {
          geo: wingSparGeo,
          matrix: craft.clone().multiply(makeTransform(px + side * 0.36, 0.03, -0.08, 0, side * -0.36, side * 0.08)),
          colorRgb: sootIron,
        },
        {
          geo: louverFinGeo,
          matrix: craft.clone().multiply(makeTransform(px - side * 0.08, 0.03, 0.14)),
          colorRgb: gunmetal,
        },
      );
      out.trim.push({
        geo: louverFinGeo,
        matrix: craft.clone().multiply(makeTransform(px + side * 0.09, 0.02, -0.22)),
        colorRgb: forgedGold,
      });
      out.energy.push({
        geo: wingtipCapGeo,
        matrix: craft.clone().multiply(makeTransform(px + side * 0.64, 0.08, -0.26)),
      });

      const wakeRibbon = trackGeo(
        out,
        createFlowingRibbonMesh(
          [
            [px + side * 0.62, 0.08, -0.30],
            [px + side * 0.56, 0.05, -0.54],
            [px + side * 0.44, 0.0, -0.76],
          ],
          [0.055, 0.042, 0.010],
          0.012,
          1.8,
          16,
          4,
          0.005,
          moltenAmber,
          solarWhite,
        ),
      );
      out.crystal.push({ geo: wakeRibbon, matrix: craft });
    }

    const crossBridgeGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.24, 0.14],
          [0.24, 0.14],
          [0.20, -0.18],
          [-0.20, -0.18],
        ],
        0.085,
        0.010,
        0.010,
        1,
      ),
    );
    crossBridgeGeo.rotateX(Math.PI * 0.5);
    out.matte.push({ geo: crossBridgeGeo, matrix: craft.clone().multiply(makeTransform(0, 0.0, -0.02)), colorRgb: gunmetal });

    const furnaceDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.115, 0.115, 0.16, 12));
    furnaceDrumGeo.rotateZ(Math.PI * 0.5);
    const furnaceCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.118, 0.014, 6, 18));
    furnaceCollarGeo.rotateY(Math.PI * 0.5);
    const furnaceCoreGeo = trackGeo(out, new THREE.OctahedronGeometry(0.085, 0));

    out.armor.push({ geo: furnaceDrumGeo, matrix: craft.clone().multiply(makeTransform(0, 0.02, 0.0)), colorRgb: forgedGold });
    out.trim.push(
      { geo: furnaceCollarGeo, matrix: craft.clone().multiply(makeTransform(-0.075, 0.02, 0.0)), colorRgb: brightSolarGold },
      { geo: furnaceCollarGeo, matrix: craft.clone().multiply(makeTransform(0.075, 0.02, 0.0)), colorRgb: brightSolarGold },
    );
    out.energy.push({ geo: furnaceCoreGeo, matrix: craft.clone().multiply(makeTransform(0, 0.085, 0.04)), colorRgb: solarWhite });

    const centralThrusterTrough = trackGeo(out, new THREE.CylinderGeometry(0.042, 0.032, 0.34, 8));
    centralThrusterTrough.rotateX(Math.PI * 0.5);
    out.energy.push({
      geo: centralThrusterTrough,
      matrix: craft.clone().multiply(makeTransform(0, 0.075, -0.18)),
      colorRgb: moltenAmber,
    });

    out.crystalHex = 0xe5a944;
    out.crystalOpacity = 0.46;
    out.crystalIntensity = 0.60;
    out.weaponGlowHex = 0xe89432;
    out.headTopLocalY = 1.54;
  },

  S14: (_ctx, out) => {
    const starIndigo: RgbTriple = [0.16, 0.25, 0.42];
    const deepIndigo: RgbTriple = [0.11, 0.17, 0.30];
    const bronzeWarm: RgbTriple = [0.76, 0.57, 0.31];
    const brightBrass: RgbTriple = [0.87, 0.72, 0.42];
    const clockIron: RgbTriple = [0.15, 0.17, 0.23];
    const chronoTeal: RgbTriple = [0.34, 0.78, 0.86];
    const phaseIce: RgbTriple = [0.72, 0.92, 0.96];
    const warmSpark: RgbTriple = [0.92, 0.78, 0.44];

    const pelvisY = 0.64;
    const pelvisZ = -0.06;

    const pelvisGeo = trackGeo(out, new THREE.OctahedronGeometry(0.125, 1));
    out.armor.push({
      geo: pelvisGeo,
      matrix: makeTransform(0, pelvisY, pelvisZ, 0.2, 0, 0, 1.05, 0.82, 1.35),
      colorRgb: starIndigo,
    });

    const legSegGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.016, 1, 8));
    const tibiaSegGeo = trackGeo(out, new THREE.CylinderGeometry(0.017, 0.008, 1, 8));
    const kneeGearGeo = trackGeo(out, createClockGearPart(0.044, 0.014, 8, 0.011, 0.018));
    kneeGearGeo.rotateY(Math.PI * 0.5);
    const footClawGeo = trackGeo(out, new THREE.ConeGeometry(0.020, 0.075, 5));
    footClawGeo.rotateX(Math.PI);

    const walkingLegs: readonly {
      readonly hip: Vec3Tuple;
      readonly knee: Vec3Tuple;
      readonly foot: Vec3Tuple;
    }[] = [
      { hip: [-0.11, pelvisY - 0.02, pelvisZ + 0.06], knee: [-0.36, 0.70, 0.16], foot: [-0.46, 0.10, 0.24] },
      { hip: [0.11, pelvisY - 0.02, pelvisZ + 0.06], knee: [0.36, 0.70, 0.16], foot: [0.46, 0.10, 0.24] },
      { hip: [-0.10, pelvisY - 0.02, pelvisZ - 0.10], knee: [-0.40, 0.74, -0.34], foot: [-0.48, 0.10, -0.46] },
      { hip: [0.10, pelvisY - 0.02, pelvisZ - 0.10], knee: [0.40, 0.74, -0.34], foot: [0.48, 0.10, -0.46] },
    ];

    for (const leg of walkingLegs) {
      const h = new THREE.Vector3(...leg.hip);
      const k = new THREE.Vector3(...leg.knee);
      const f = new THREE.Vector3(...leg.foot);
      out.armor.push({ geo: legSegGeo, matrix: makeSegmentTransform(h, k), colorRgb: starIndigo });
      out.matte.push({ geo: tibiaSegGeo, matrix: makeSegmentTransform(k, f), colorRgb: clockIron });
      out.trim.push(
        { geo: kneeGearGeo, matrix: makeTransform(k.x, k.y, k.z), colorRgb: bronzeWarm },
        { geo: footClawGeo, matrix: makeTransform(f.x, f.y + 0.02, f.z), colorRgb: bronzeWarm },
      );
    }

    const abdSegGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.10, 0.06],
          [0.10, 0.06],
          [0.14, -0.02],
          [0.08, -0.08],
          [-0.08, -0.08],
          [-0.14, -0.02],
        ],
        0.13,
        0.012,
        0.012,
        1,
      ),
    );
    const abdRingGeo = trackGeo(out, new THREE.TorusGeometry(0.085, 0.011, 6, 16));
    for (let i = 0; i < 5; i += 1) {
      const f = i / 4;
      const ay = pelvisY + 0.04 + Math.pow(f, 1.35) * 0.34;
      const az = pelvisZ - 0.14 - i * 0.115;
      const scale = 1.0 - f * 0.56;
      const pitch = -0.34 - f * 0.42;
      out.armor.push({
        geo: abdSegGeo,
        matrix: makeTransform(0, ay, az, pitch, 0, 0, scale, scale * 0.88, scale),
        colorRgb: i % 2 === 0 ? starIndigo : deepIndigo,
      });
      out.trim.push({
        geo: abdRingGeo,
        matrix: makeTransform(0, ay - 0.015, az + 0.045, pitch, 0, 0, scale, scale * 0.78, scale),
        colorRgb: bronzeWarm,
      });
    }
    const stingerTipGeo = trackGeo(out, new THREE.ConeGeometry(0.036, 0.16, 6));
    stingerTipGeo.rotateX(-Math.PI * 0.5);
    out.trim.push({
      geo: stingerTipGeo,
      matrix: makeTransform(0, pelvisY + 0.42, pelvisZ - 0.68, 0.68, 0, 0),
      colorRgb: brightBrass,
    });

    const thoraxSpineGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0, pelvisY + 0.02, pelvisZ + 0.02],
          [0, pelvisY + 0.24, pelvisZ + 0.14],
          [0, pelvisY + 0.48, pelvisZ + 0.22],
          [0, pelvisY + 0.64, pelvisZ + 0.28],
        ],
        0.045,
        0.036,
        0.040,
        16,
        10,
      ),
    );
    out.matte.push({ geo: thoraxSpineGeo, colorRgb: clockIron });

    const ribCurveL: readonly Vec3Tuple[] = [
      [-0.04, pelvisY + 0.06, pelvisZ + 0.06],
      [-0.14, pelvisY + 0.28, pelvisZ + 0.16],
      [-0.12, pelvisY + 0.48, pelvisZ + 0.24],
      [-0.04, pelvisY + 0.60, pelvisZ + 0.26],
    ];
    const thoraxRibGeo = trackGeo(out, createOrganicLimb(ribCurveL, 0.022, 0.032, 0.020, 14, 8));
    const dorsalShieldGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.24],
          [0.095, 0.08],
          [0.075, -0.18],
          [0, -0.24],
          [-0.075, -0.18],
          [-0.095, 0.08],
        ],
        0.036,
        0.008,
        0.008,
        1,
      ),
    );
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: thoraxRibGeo,
        matrix: makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1),
        colorRgb: starIndigo,
      });
    }
    out.armor.push({
      geo: dorsalShieldGeo,
      matrix: makeTransform(0, pelvisY + 0.36, pelvisZ + 0.08, 0.46, 0, 0),
      colorRgb: starIndigo,
    });

    const gearMainGeo = trackGeo(out, createClockGearPart(0.115, 0.048, 12, 0.020, 0.020));
    const gearSmallGeo = trackGeo(out, createClockGearPart(0.074, 0.026, 9, 0.016, 0.018));
    const gearSideGeo = trackGeo(out, createClockGearPart(0.088, 0.032, 10, 0.018, 0.018));
    gearSideGeo.rotateY(Math.PI * 0.5);
    const balanceWheelGeo = trackGeo(out, new THREE.TorusGeometry(0.128, 0.009, 6, 24));
    const escapementForkGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.015, -0.07],
          [0.015, -0.07],
          [0.015, 0.02],
          [0.065, 0.065],
          [0.045, 0.085],
          [0.0, 0.04],
          [-0.045, 0.085],
          [-0.065, 0.065],
          [-0.015, 0.02],
        ],
        0.014,
        0.002,
        0.002,
        1,
      ),
    );
    const mainspringCoreGeo = trackGeo(out, new THREE.OctahedronGeometry(0.046, 0));

    const chestY = pelvisY + 0.34;
    const chestZ = pelvisZ + 0.21;
    out.trim.push(
      { geo: gearMainGeo, matrix: makeTransform(0, chestY, chestZ, 0.32, 0, 0.2), colorRgb: brightBrass },
      { geo: gearSmallGeo, matrix: makeTransform(0.055, chestY + 0.11, chestZ + 0.04, 0.32, 0, -0.35), colorRgb: bronzeWarm },
      { geo: gearSideGeo, matrix: makeTransform(-0.078, chestY - 0.04, chestZ + 0.01, 0, 0, 0.15), colorRgb: brightBrass },
      { geo: balanceWheelGeo, matrix: makeTransform(0, chestY, chestZ + 0.028, 0.32, 0, 0), colorRgb: brightBrass },
      { geo: escapementForkGeo, matrix: makeTransform(-0.045, chestY + 0.12, chestZ + 0.05, 0.32, 0, 0.42), colorRgb: brightBrass },
    );
    out.energy.push({
      geo: mainspringCoreGeo,
      matrix: makeTransform(0, chestY, chestZ + 0.015),
      colorRgb: warmSpark,
    });

    const headY = pelvisY + 0.72;
    const headZ = pelvisZ + 0.34;
    const headTriGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.12, 0.09],
          [0.12, 0.09],
          [0.07, -0.04],
          [0.0, -0.12],
          [-0.07, -0.04],
        ],
        0.10,
        0.012,
        0.012,
        2,
      ),
    );
    const eyeOrbGeo = trackGeo(out, new THREE.SphereGeometry(0.052, 12, 10));
    const eyeRimGeo = trackGeo(out, new THREE.TorusGeometry(0.054, 0.008, 6, 16));
    const antennaGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.04, 0.07, 0.01],
          [0.13, 0.17, -0.08],
          [0.22, 0.22, -0.22],
        ],
        0.009,
        0.003,
        12,
        6,
      ),
    );

    out.armor.push({
      geo: headTriGeo,
      matrix: makeTransform(0, headY, headZ, 0.28, 0, 0),
      colorRgb: starIndigo,
    });
    for (const side of [-1, 1] as const) {
      out.energy.push({
        geo: eyeOrbGeo,
        matrix: makeTransform(side * 0.095, headY + 0.045, headZ + 0.035),
        colorRgb: chronoTeal,
      });
      out.trim.push(
        {
          geo: eyeRimGeo,
          matrix: makeTransform(side * 0.095, headY + 0.045, headZ + 0.048, 0.15, side * 0.42, 0),
          colorRgb: brightBrass,
        },
        {
          geo: antennaGeo,
          matrix: makeTransform(0, headY, headZ, 0, 0, 0, side, 1, 1),
          colorRgb: bronzeWarm,
        },
      );
    }

    const coxaGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.022, 1, 8));
    const femurBladeGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.034, 0.18],
          [0.034, 0.18],
          [0.048, -0.14],
          [0.0, -0.22],
          [-0.040, -0.14],
        ],
        0.042,
        0.008,
        0.008,
        1,
      ),
    );
    const crescentMainGeo = trackGeo(out, createCurvedBladePart(0.50, 0.105, 0.022, 0.22, 0.035, 10));
    const crescentPhaseGeo = trackGeo(out, createCurvedBladePart(0.48, 0.090, 0.016, 0.24, 0.040, 10));
    const crescentEdgeGeo = trackGeo(out, createCurvedBladePart(0.46, 0.032, 0.010, 0.23, 0.044, 10));

    for (const side of [-1, 1] as const) {
      const sh = new THREE.Vector3(side * 0.12, pelvisY + 0.56, pelvisZ + 0.22);
      const el = new THREE.Vector3(side * 0.26, pelvisY + 0.36, pelvisZ + 0.36);
      const wr = new THREE.Vector3(side * 0.32, pelvisY + 0.55, pelvisZ + 0.46);

      out.armor.push({ geo: coxaGeo, matrix: makeSegmentTransform(sh, el), colorRgb: starIndigo });
      out.trim.push({
        geo: femurBladeGeo,
        matrix: makeSegmentTransform(el, wr, 1.0, 1.0, side * 0.25),
        colorRgb: bronzeWarm,
      });
      out.trim.push({
        geo: kneeGearGeo,
        matrix: makeTransform(wr.x, wr.y, wr.z, 0, side * 0.3, 0, 1.15, 1.15, 1.15),
        colorRgb: brightBrass,
      });

      const bladePose = makeTransform(
        wr.x,
        wr.y,
        wr.z,
        2.15 + side * 0.08,
        side * -0.26,
        side * -0.30,
        side,
        1,
        1,
      );
      out.trim.push({ geo: crescentMainGeo, matrix: bladePose, colorRgb: brightBrass });

      const phasePose = makeTransform(
        wr.x + side * 0.075,
        wr.y + 0.055,
        wr.z + 0.045,
        1.88 + side * 0.08,
        side * -0.18,
        side * -0.18,
        side,
        1,
        1,
      );
      out.crystal.push({ geo: crescentPhaseGeo, matrix: phasePose, colorRgb: phaseIce });
      out.energy.push({ geo: crescentEdgeGeo, matrix: phasePose, colorRgb: chronoTeal });
    }

    out.crystalHex = 0x58c4d6;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.56;
    out.weaponGlowHex = 0x46b8c8;
    out.headTopLocalY = 1.68;
  },

  S15: (_ctx, out) => {
    const glacierWhite: RgbTriple = [0.84, 0.91, 0.95];
    const iceBlue: RgbTriple = [0.58, 0.78, 0.89];
    const abyssSlate: RgbTriple = [0.16, 0.26, 0.36];
    const deepHull: RgbTriple = [0.24, 0.40, 0.52];
    const frostTitanium: RgbTriple = [0.72, 0.80, 0.86];
    const aquaGlow: RgbTriple = [0.34, 0.82, 0.80];
    const iceCrystal: RgbTriple = [0.68, 0.90, 0.96];

    const rayMat = makeTransform(0.0, 0.88, 0.06, -0.22, 0.0, 0.0);

    const centralHullGeo = trackGeo(out, createTeardropPart(1.06, 0.22, 1.32, 20, 14, 0.020, deepHull, glacierWhite));
    out.armor.push({
      geo: centralHullGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, 0.02, -0.02, -Math.PI * 0.5, 0, 0, 1.24, 1.0, 0.58)),
    });

    const ventralKeelGeo = trackGeo(out, createTeardropPart(0.92, 0.16, 1.28, 16, 10, -0.015, abyssSlate, deepHull));
    out.matte.push({
      geo: ventralKeelGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, -0.055, -0.02, -Math.PI * 0.5, 0, 0, 1.08, 1.0, 0.45)),
    });

    const iceProwGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.28],
          [0.26, 0.14],
          [0.34, -0.04],
          [0.18, -0.12],
          [-0.18, -0.12],
          [-0.34, -0.04],
          [-0.26, 0.14],
        ],
        0.095,
        0.016,
        0.016,
        2,
      ),
    );
    iceProwGeo.rotateX(Math.PI * 0.5);
    out.armor.push({
      geo: iceProwGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, 0.015, 0.34)),
      colorRgb: glacierWhite,
    });

    const ramEdgeGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.22],
          [0.24, 0.06],
          [0.18, -0.02],
          [0.0, 0.08],
          [-0.18, -0.02],
          [-0.24, 0.06],
        ],
        0.048,
        0.008,
        0.008,
        1,
      ),
    );
    ramEdgeGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: ramEdgeGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, -0.015, 0.44)),
      colorRgb: frostTitanium,
    });

    const intakeGlowGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.032, 0.22, 8));
    intakeGlowGeo.rotateZ(Math.PI * 0.5);
    out.energy.push({
      geo: intakeGlowGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, -0.035, 0.44)),
      colorRgb: aquaGlow,
    });

    const canopyVisorGeo = trackGeo(out, createCurvedVisorPart(0.14, 0.072, 0.22, 1.75, 0.86, 0.72, 14, 6));
    out.crystal.push({
      geo: canopyVisorGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, 0.085, 0.22)),
      colorRgb: iceCrystal,
    });

    const mantaWingGeo = trackGeo(out, createCreatureFin(0.72, 0.70, 0.26, 0.068, 0.058, 16, 10, iceBlue, glacierWhite));
    const leadingArmorGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.06],
          [0.58, -0.13],
          [0.66, -0.20],
          [0.48, -0.20],
          [0.0, -0.05],
        ],
        0.046,
        0.010,
        0.010,
        2,
      ),
    );
    leadingArmorGeo.rotateX(Math.PI * 0.5);

    const hornRamGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0.14, -0.01, 0.40],
          [0.24, 0.0, 0.56],
          [0.18, 0.03, 0.68],
        ],
        0.044,
        0.034,
        0.014,
        12,
        8,
      ),
    );

    const wingIceTileGeo = trackGeo(out, createHexMirrorTilePart(0.095, 0.020, 0.007, 0.008, iceCrystal, iceBlue));
    const nacelleGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.012, 0.16],
          [0.062, 0.08],
          [0.066, -0.10],
          [0.048, -0.18],
        ],
        12,
      ),
    );
    nacelleGeo.rotateX(Math.PI * 0.5);
    const gillSlitGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.010, 0.12, 6));
    gillSlitGeo.rotateZ(Math.PI * 0.5);

    const tailWhipGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.10, -0.01, -0.40],
          [0.18, 0.06, -0.58],
          [0.15, 0.18, -0.74],
          [0.22, 0.30, -0.86],
        ],
        0.026,
        0.006,
        18,
        8,
      ),
    );
    const tailRingGeo = trackGeo(out, new THREE.TorusGeometry(0.022, 0.006, 6, 12));
    const tailBeaconGeo = trackGeo(out, createFacetedCrystalPart(0.11, 0.028, 6, 0.58, 0.42, aquaGlow, iceCrystal));
    const wingRibGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.010, 0.48, 6));
    wingRibGeo.rotateZ(Math.PI * 0.5);
    const spotEyeGeo = trackGeo(out, new THREE.SphereGeometry(0.028, 10, 8));
    const dorsalMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.013, 0.26, 6));
    const wingtipSpikeGeo = trackGeo(out, new THREE.ConeGeometry(0.026, 0.14, 5));
    wingtipSpikeGeo.rotateZ(-Math.PI * 0.5);

    for (const side of [-1, 1] as const) {
      out.armor.push(
        {
          geo: mantaWingGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.12, 0.01, 0.06, 0, 0, side * 0.06, side, 1, 1)),
        },
        {
          geo: leadingArmorGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.14, 0.028, 0.30, 0, 0, side * 0.06, side, 1, 1)),
          colorRgb: glacierWhite,
        },
        {
          geo: hornRamGeo,
          matrix: rayMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
          colorRgb: glacierWhite,
        },
      );

      out.crystal.push({
        geo: wingIceTileGeo,
        matrix: rayMat.clone().multiply(makeTransform(side * 0.42, 0.072, 0.04, -Math.PI * 0.5, 0, side * 0.08)),
      });
      out.crystal.push({
        geo: wingIceTileGeo,
        matrix: rayMat.clone().multiply(makeTransform(side * 0.58, 0.056, -0.06, -Math.PI * 0.5, 0, side * 0.10, 0.82, 0.82, 0.82)),
      });

      out.matte.push({
        geo: nacelleGeo,
        matrix: rayMat.clone().multiply(makeTransform(side * 0.24, 0.075, -0.22)),
        colorRgb: abyssSlate,
      });
      const jetGlow = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.022, 0.06, 8));
      jetGlow.rotateX(Math.PI * 0.5);
      out.energy.push({
        geo: jetGlow,
        matrix: rayMat.clone().multiply(makeTransform(side * 0.24, 0.075, -0.40)),
        colorRgb: aquaGlow,
      });

      for (let g = 0; g < 3; g += 1) {
        out.energy.push({
          geo: gillSlitGeo,
          matrix: rayMat.clone().multiply(
            makeTransform(side * (0.28 + g * 0.06), 0.048, 0.18 - g * 0.09, 0, side * 0.34, 0),
          ),
          colorRgb: aquaGlow,
        });
      }

      out.matte.push({
        geo: tailWhipGeo,
        matrix: rayMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
        colorRgb: abyssSlate,
      });
      out.trim.push(
        {
          geo: tailRingGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.16, 0.05, -0.56, 0.2, side * 0.2, 0)),
          colorRgb: frostTitanium,
        },
        {
          geo: tailRingGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.16, 0.17, -0.72, 0.4, side * 0.1, 0, 0.78, 0.78, 0.78)),
          colorRgb: frostTitanium,
        },
        {
          geo: wingRibGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.42, 0.055, -0.02, 0, side * -0.32, side * 0.06)),
          colorRgb: frostTitanium,
        },
        {
          geo: wingtipSpikeGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.78, 0.05, -0.14, 0, side * -0.24, 0, side, 1, 1)),
          colorRgb: frostTitanium,
        },
      );
      out.energy.push(
        {
          geo: tailBeaconGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.22, 0.31, -0.88, -0.9, 0, side * -0.2)),
        },
        {
          geo: spotEyeGeo,
          matrix: rayMat.clone().multiply(makeTransform(side * 0.16, 0.035, 0.40)),
          colorRgb: aquaGlow,
        },
      );
      out.matte.push({
        geo: dorsalMastGeo,
        matrix: rayMat.clone().multiply(makeTransform(side * 0.08, 0.24, -0.18, -0.36, 0, side * -0.18)),
        colorRgb: abyssSlate,
      });
    }

    const dorsalFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.0],
          [0.14, 0.0],
          [0.06, 0.24],
          [-0.22, 0.26],
          [-0.30, 0.04],
        ],
        0.044,
        0.008,
        0.008,
        1,
      ),
    );
    dorsalFinGeo.rotateY(Math.PI * 0.5);
    out.armor.push({
      geo: dorsalFinGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, 0.10, -0.06)),
      colorRgb: iceBlue,
    });

    const louverSlatGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.12, 0.025],
          [0.12, 0.025],
          [0.10, -0.025],
          [-0.10, -0.025],
        ],
        0.024,
        0.004,
        0.004,
        1,
      ),
    );
    for (let s = 0; s < 5; s += 1) {
      out.trim.push({
        geo: louverSlatGeo,
        matrix: rayMat.clone().multiply(makeTransform(0, 0.145 - s * 0.006, 0.06 - s * 0.075, -0.45, 0, 0)),
        colorRgb: frostTitanium,
      });
    }
    const ventCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.034, 0.026, 0.34, 8));
    ventCoreGeo.rotateX(Math.PI * 0.5);
    out.energy.push({
      geo: ventCoreGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, 0.12, -0.10)),
      colorRgb: aquaGlow,
    });

    out.crystalHex = 0x68c4e0;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.50;
    const sonarDomeGeo = trackGeo(out, new THREE.SphereGeometry(0.088, 12, 8));
    const sonarRingGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.011, 6, 18));
    sonarRingGeo.rotateX(Math.PI * 0.5);
    out.crystal.push({
      geo: sonarDomeGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, -0.11, 0.08, 0, 0, 0, 1.15, 0.65, 1.35)),
      colorRgb: iceCrystal,
    });
    out.trim.push({
      geo: sonarRingGeo,
      matrix: rayMat.clone().multiply(makeTransform(0, -0.10, 0.08)),
      colorRgb: frostTitanium,
    });

    out.weaponGlowHex = 0x44c4c8;
    out.headTopLocalY = 1.46;
  },

  S17: (_ctx, out) => {
    const obsidian: RgbTriple = [0.15, 0.13, 0.22];
    const darkVioletArmor: RgbTriple = [0.25, 0.20, 0.36];
    const voidCarbon: RgbTriple = [0.11, 0.11, 0.16];
    const magPewter: RgbTriple = [0.56, 0.46, 0.66];
    const coilCopper: RgbTriple = [0.72, 0.56, 0.38];
    const plasmaMagenta: RgbTriple = [0.84, 0.36, 0.78];
    const plasmaCore: RgbTriple = [0.94, 0.72, 0.92];
    const bottleSheen: RgbTriple = [0.74, 0.56, 0.88];

    const centerY = 0.92;

    const bottleCylGeo = trackGeo(out, new THREE.CylinderGeometry(0.185, 0.185, 0.72, 12, 1, true));
    out.crystal.push({
      geo: bottleCylGeo,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: bottleSheen,
    });

    const bottleFlangeGeo = trackGeo(out, createChamferedHexPart(0.22, 0.044, 0.008, 0.145));
    bottleFlangeGeo.rotateX(Math.PI * 0.5);
    out.matte.push(
      { geo: bottleFlangeGeo, matrix: makeTransform(0, centerY + 0.36, 0), colorRgb: voidCarbon },
      { geo: bottleFlangeGeo, matrix: makeTransform(0, centerY - 0.36, 0), colorRgb: voidCarbon },
    );

    const upperPoleGeo = trackGeo(out, new THREE.ConeGeometry(0.155, 0.34, 4));
    upperPoleGeo.rotateX(Math.PI);
    const lowerPoleGeo = trackGeo(out, new THREE.ConeGeometry(0.155, 0.34, 4));
    const poleCollarGeo = trackGeo(out, createChamferedHexPart(0.175, 0.036, 0.006, 0.095));
    poleCollarGeo.rotateX(Math.PI * 0.5);
    const poleTipRingGeo = trackGeo(out, new THREE.TorusGeometry(0.056, 0.009, 6, 16));
    poleTipRingGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: upperPoleGeo, matrix: makeTransform(0, centerY + 0.25, 0, 0, Math.PI * 0.25, 0), colorRgb: obsidian },
      { geo: lowerPoleGeo, matrix: makeTransform(0, centerY - 0.25, 0, 0, Math.PI * 0.25, 0), colorRgb: obsidian },
    );
    out.trim.push(
      { geo: poleCollarGeo, matrix: makeTransform(0, centerY + 0.42, 0), colorRgb: coilCopper },
      { geo: poleCollarGeo, matrix: makeTransform(0, centerY - 0.42, 0), colorRgb: coilCopper },
    );
    out.energy.push(
      { geo: poleTipRingGeo, matrix: makeTransform(0, centerY + 0.11, 0), colorRgb: plasmaMagenta },
      { geo: poleTipRingGeo, matrix: makeTransform(0, centerY - 0.11, 0), colorRgb: plasmaMagenta },
    );

    const upperCapPyramid = trackGeo(out, new THREE.ConeGeometry(0.125, 0.22, 4));
    const lowerSpikePyramid = trackGeo(out, new THREE.ConeGeometry(0.115, 0.24, 4));
    lowerSpikePyramid.rotateX(Math.PI);
    out.armor.push(
      { geo: upperCapPyramid, matrix: makeTransform(0, centerY + 0.54, 0, 0, Math.PI * 0.25, 0), colorRgb: darkVioletArmor },
      { geo: lowerSpikePyramid, matrix: makeTransform(0, centerY - 0.55, 0, 0, Math.PI * 0.25, 0), colorRgb: obsidian },
    );

    const yokeRingGeo = trackGeo(out, new THREE.TorusGeometry(0.35, 0.022, 6, 8));
    yokeRingGeo.rotateX(Math.PI * 0.5);
    const yokeInnerGeo = trackGeo(out, new THREE.TorusGeometry(0.285, 0.010, 6, 20));
    yokeInnerGeo.rotateX(Math.PI * 0.5);
    out.armor.push(
      { geo: yokeRingGeo, matrix: makeTransform(0, centerY + 0.42, 0, 0, Math.PI / 8, 0), colorRgb: darkVioletArmor },
      { geo: yokeRingGeo, matrix: makeTransform(0, centerY - 0.42, 0, 0, Math.PI / 8, 0), colorRgb: darkVioletArmor },
    );
    out.trim.push(
      { geo: yokeInnerGeo, matrix: makeTransform(0, centerY + 0.42, 0), colorRgb: magPewter },
      { geo: yokeInnerGeo, matrix: makeTransform(0, centerY - 0.42, 0), colorRgb: magPewter },
    );

    const pillarButtressGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.032, 0.54],
          [0.036, 0.48],
          [0.056, 0.18],
          [0.044, -0.18],
          [0.032, -0.52],
          [-0.028, -0.58],
          [-0.048, -0.14],
          [-0.048, 0.16],
        ],
        0.056,
        0.008,
        0.008,
        1,
      ),
    );
    const pillarRailGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.94, 6));
    const coilWrapGeo = trackGeo(out, new THREE.TorusGeometry(0.048, 0.010, 6, 12));
    coilWrapGeo.rotateX(Math.PI * 0.5);
    const pinchNeedleGeo = trackGeo(out, new THREE.ConeGeometry(0.022, 0.14, 4));
    pinchNeedleGeo.rotateZ(Math.PI * 0.5);
    const floatChevronGeo = trackGeo(out, createFacetedCrystalPart(0.14, 0.030, 4, 0.55, 0.45, obsidian, darkVioletArmor));

    for (let i = 0; i < 4; i += 1) {
      const ang = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const px = Math.cos(ang) * 0.35;
      const pz = Math.sin(ang) * 0.35;
      const rotY = -ang;

      out.armor.push({
        geo: pillarButtressGeo,
        matrix: makeTransform(px, centerY, pz, 0, rotY, 0),
        colorRgb: obsidian,
      });
      out.matte.push({
        geo: pillarRailGeo,
        matrix: makeTransform(Math.cos(ang) * 0.295, centerY, Math.sin(ang) * 0.295),
        colorRgb: voidCarbon,
      });
      out.trim.push(
        {
          geo: coilWrapGeo,
          matrix: makeTransform(px, centerY + 0.24, pz),
          colorRgb: coilCopper,
        },
        {
          geo: coilWrapGeo,
          matrix: makeTransform(px, centerY - 0.24, pz),
          colorRgb: coilCopper,
        },
        {
          geo: pinchNeedleGeo,
          matrix: makeTransform(Math.cos(ang) * 0.22, centerY, Math.sin(ang) * 0.22, 0, rotY, 0),
          colorRgb: magPewter,
        },
      );
      out.armor.push({
        geo: floatChevronGeo,
        matrix: makeTransform(Math.cos(ang) * 0.50, centerY + (i % 2 === 0 ? 0.12 : -0.12), Math.sin(ang) * 0.50, 0, rotY, 0),
      });
      const outerReturnGeo = trackGeo(
        out,
        createTubePart(
          [
            [Math.cos(ang) * 0.35, centerY + 0.42, Math.sin(ang) * 0.35],
            [Math.cos(ang) * 0.45, centerY + 0.16, Math.sin(ang) * 0.45],
            [Math.cos(ang) * 0.45, centerY - 0.16, Math.sin(ang) * 0.45],
            [Math.cos(ang) * 0.35, centerY - 0.42, Math.sin(ang) * 0.35],
          ],
          0.011,
          12,
          6,
          false,
        ),
      );
      out.trim.push({ geo: outerReturnGeo, colorRgb: magPewter });
      const capFinGeo = trackGeo(out, new THREE.ConeGeometry(0.022, 0.16, 4));
      out.armor.push({
        geo: capFinGeo,
        matrix: makeTransform(Math.cos(ang) * 0.32, centerY + 0.58, Math.sin(ang) * 0.32, 0, rotY, 0),
        colorRgb: darkVioletArmor,
      });

      const arcPts: readonly Vec3Tuple[] = [
        [0, centerY + 0.10, 0],
        [Math.cos(ang + 0.22) * 0.12, centerY + 0.03, Math.sin(ang + 0.22) * 0.12],
        [Math.cos(ang) * 0.18, centerY, Math.sin(ang) * 0.18],
        [Math.cos(ang - 0.22) * 0.12, centerY - 0.04, Math.sin(ang - 0.22) * 0.12],
        [0, centerY - 0.10, 0],
      ];
      const arcGeo = trackGeo(out, createTubePart(arcPts, 0.009, 14, 6, false));
      out.energy.push({ geo: arcGeo, colorRgb: plasmaMagenta });
    }

    const coreInnerGeo = trackGeo(out, new THREE.OctahedronGeometry(0.072, 0));
    const coreOuterGeo = trackGeo(out, createFacetedCrystalPart(0.22, 0.095, 6, 0.5, 0.5, plasmaMagenta, plasmaCore));
    const shearRingA = trackGeo(out, new THREE.TorusGeometry(0.135, 0.008, 6, 22));
    const shearRingB = trackGeo(out, new THREE.TorusGeometry(0.115, 0.007, 6, 20));

    out.energy.push(
      { geo: coreInnerGeo, matrix: makeTransform(0, centerY, 0, 0.4, 0.6, 0.2), colorRgb: plasmaCore },
      { geo: shearRingA, matrix: makeTransform(0, centerY, 0, 0.72, 0.44, 0.26), colorRgb: plasmaMagenta },
      { geo: shearRingB, matrix: makeTransform(0, centerY, 0, -0.64, 0.82, -0.35), colorRgb: plasmaCore },
    );
    out.crystal.push({
      geo: coreOuterGeo,
      matrix: makeTransform(0, centerY, 0, 0.12, 0.3, -0.10),
    });

    out.crystalHex = 0xa45cc8;
    out.crystalOpacity = 0.40;
    out.crystalIntensity = 0.62;
    out.weaponGlowHex = 0xc952be;
    out.headTopLocalY = 1.68;
  },

  S18: (_ctx, out) => {
    const jadeHull: RgbTriple = [0.24, 0.58, 0.49];
    const lightJade: RgbTriple = [0.38, 0.72, 0.60];
    const pineCarbon: RgbTriple = [0.13, 0.20, 0.22];
    const antiqueBronze: RgbTriple = [0.76, 0.60, 0.36];
    const warmBronze: RgbTriple = [0.84, 0.70, 0.44];
    const mintBeacon: RgbTriple = [0.42, 0.86, 0.68];
    const softJadeMist: RgbTriple = [0.74, 0.92, 0.84];

    const skiff = makeTransform(0.0, 0.90, 0.04, -0.14, 0.0, 0.0);

    const fuselageGeo = trackGeo(out, createTeardropPart(1.04, 0.115, 1.62, 18, 14, 0.012, jadeHull, lightJade));
    out.armor.push({
      geo: fuselageGeo,
      matrix: skiff.clone().multiply(makeTransform(0, 0, 0.04, Math.PI * 0.5, 0, 0, 1.05, 1.0, 0.72)),
    });

    const ventralKeelGeo = trackGeo(out, createTeardropPart(0.84, 0.072, 1.45, 14, 10, 0, pineCarbon, pineCarbon));
    out.matte.push({
      geo: ventralKeelGeo,
      matrix: skiff.clone().multiply(makeTransform(0, -0.045, 0.02, Math.PI * 0.5, 0, 0, 0.92, 1.0, 0.60)),
    });

    const dorsalSpineGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.018, 0.34],
          [0.018, 0.34],
          [0.026, -0.34],
          [-0.026, -0.34],
        ],
        0.036,
        0.005,
        0.005,
        1,
      ),
    );
    dorsalSpineGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: dorsalSpineGeo,
      matrix: skiff.clone().multiply(makeTransform(0, 0.068, -0.02)),
      colorRgb: antiqueBronze,
    });

    const canopyGeo = trackGeo(out, createCurvedVisorPart(0.082, 0.056, 0.24, 1.55, 0.88, 0.72, 12, 6));
    out.crystal.push({
      geo: canopyGeo,
      matrix: skiff.clone().multiply(makeTransform(0, 0.056, 0.14)),
      colorRgb: softJadeMist,
    });

    const bowBeaconGeo = trackGeo(out, createFacetedCrystalPart(0.14, 0.028, 6, 0.7, 0.3, mintBeacon, softJadeMist));
    bowBeaconGeo.rotateX(Math.PI * 0.5);
    out.energy.push({
      geo: bowBeaconGeo,
      matrix: skiff.clone().multiply(makeTransform(0, 0.0, 0.56)),
    });

    const swallowWingGeo = trackGeo(out, createCreatureFin(0.42, 0.72, 0.38, 0.072, 0.024, 16, 8, jadeHull, lightJade));
    const innerWingletGeo = trackGeo(out, createPetalPart(0.32, 0.11, 0.024, 0.028, 1.4, 10, 6, lightJade, softJadeMist));
    const bronzeSparGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.08, 0.02, 0.16],
          [0.36, 0.08, 0.0],
          [0.74, 0.05, -0.24],
        ],
        0.014,
        0.005,
        14,
        6,
      ),
    );
    const wingLaserRibGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.10, 0.03, 0.06],
          [0.38, 0.075, -0.08],
          [0.66, 0.04, -0.28],
        ],
        0.007,
        0.003,
        12,
        6,
      ),
    );

    const whiskerGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.045, -0.01, 0.34],
          [0.095, -0.01, 0.52],
          [0.070, 0.01, 0.66],
        ],
        0.008,
        0.003,
        10,
        6,
      ),
    );

    const beaconPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.016, 0.18, 8));
    beaconPodGeo.rotateX(Math.PI * 0.5);
    const podLensGeo = trackGeo(out, new THREE.SphereGeometry(0.022, 8, 6));

    const tailFeatherGeo = trackGeo(out, createCurvedBladePart(0.66, 0.078, 0.016, 0.14, 0.036, 12));
    const tailLaserGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.04, 0.0, -0.26],
          [0.17, 0.08, -0.52],
          [0.32, 0.20, -0.82],
        ],
        0.009,
        0.004,
        14,
        6,
      ),
    );
    const tailTipDiamond = trackGeo(out, new THREE.OctahedronGeometry(0.026, 0));
    const wingtipNodeGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.012, 0.09, 6));
    wingtipNodeGeo.rotateX(Math.PI * 0.5);
    const tailBeadGeo = trackGeo(out, new THREE.TorusGeometry(0.020, 0.006, 6, 12));
    const rootFairingGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.14],
          [0.08, 0.02],
          [0.05, -0.14],
          [0, -0.16],
        ],
        0.028,
        0.005,
        0.005,
        1,
      ),
    );
    rootFairingGeo.rotateX(Math.PI * 0.5);

    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: swallowWingGeo,
        matrix: skiff.clone().multiply(makeTransform(side * 0.07, 0.01, 0.06, 0.04, 0, side * 0.10, side, 1, 1)),
      });
      out.trim.push(
        {
          geo: bronzeSparGeo,
          matrix: skiff.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
          colorRgb: warmBronze,
        },
        {
          geo: whiskerGeo,
          matrix: skiff.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
          colorRgb: antiqueBronze,
        },
      );
      out.energy.push({
        geo: wingLaserRibGeo,
        matrix: skiff.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
        colorRgb: mintBeacon,
      });
      out.crystal.push({
        geo: innerWingletGeo,
        matrix: skiff.clone().multiply(
          makeTransform(side * 0.14, 0.03, -0.10, -1.28, side * 0.42, side * -0.58, side, 1, 1),
        ),
      });

      out.matte.push({
        geo: beaconPodGeo,
        matrix: skiff.clone().multiply(makeTransform(side * 0.18, -0.055, 0.04)),
        colorRgb: pineCarbon,
      });
      out.energy.push({
        geo: podLensGeo,
        matrix: skiff.clone().multiply(makeTransform(side * 0.18, -0.055, 0.135)),
        colorRgb: mintBeacon,
      });

      out.armor.push({
        geo: tailFeatherGeo,
        matrix: skiff.clone().multiply(
          makeTransform(side * 0.05, 0.01, -0.26, -Math.PI * 0.5 + 0.30, side * -0.24, side * 0.20, side, 1, 1),
        ),
        colorRgb: jadeHull,
      });
      out.energy.push(
        {
          geo: tailLaserGeo,
          matrix: skiff.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
          colorRgb: mintBeacon,
        },
        {
          geo: tailTipDiamond,
          matrix: skiff.clone().multiply(makeTransform(side * 0.32, 0.20, -0.82)),
          colorRgb: softJadeMist,
        },
        {
          geo: podLensGeo,
          matrix: skiff.clone().multiply(makeTransform(side * 0.74, 0.05, -0.22, 0, 0, 0, 0.85, 0.85, 0.85)),
          colorRgb: mintBeacon,
        },
      );
      out.trim.push(
        {
          geo: wingtipNodeGeo,
          matrix: skiff.clone().multiply(makeTransform(side * 0.72, 0.05, -0.25)),
          colorRgb: warmBronze,
        },
        {
          geo: tailBeadGeo,
          matrix: skiff.clone().multiply(makeTransform(side * 0.17, 0.08, -0.52, 0.25, side * -0.22, 0)),
          colorRgb: antiqueBronze,
        },
      );
      out.armor.push({
        geo: rootFairingGeo,
        matrix: skiff.clone().multiply(makeTransform(side * 0.06, 0.02, -0.18, 0, 0, 0, side, 1, 1)),
        colorRgb: lightJade,
      });

      const tailRibbon = trackGeo(
        out,
        createFlowingRibbonMesh(
          [
            [side * 0.14, 0.06, -0.40],
            [side * 0.23, 0.14, -0.64],
            [side * 0.35, 0.23, -0.86],
          ],
          [0.022, 0.034, 0.008],
          0.010,
          1.8,
          16,
          4,
          0.004,
          mintBeacon,
          softJadeMist,
        ),
      );
      out.crystal.push({ geo: tailRibbon, matrix: skiff });
    }

    const gateY = 1.12;
    const gateZ = -0.22;
    const gateTilt = makeTransform(0, gateY, gateZ, 0.22, 0, 0);

    const gateOuterRing = trackGeo(out, new THREE.TorusGeometry(0.32, 0.024, 8, 30));
    const gateInnerRing = trackGeo(out, new THREE.TorusGeometry(0.275, 0.011, 6, 26));
    const gateWarpVeil = trackGeo(out, new THREE.TorusGeometry(0.22, 0.052, 6, 26));
    const chevronGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.026, 0.042],
          [0.026, 0.042],
          [0.018, -0.030],
          [0, -0.046],
          [-0.018, -0.030],
        ],
        0.032,
        0.004,
        0.004,
        1,
      ),
    );

    out.trim.push({ geo: gateOuterRing, matrix: gateTilt, colorRgb: antiqueBronze });
    out.energy.push({ geo: gateInnerRing, matrix: gateTilt, colorRgb: mintBeacon });
    out.crystal.push({
      geo: gateWarpVeil,
      matrix: gateTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1, 1, 0.14)),
      colorRgb: softJadeMist,
    });

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      out.trim.push({
        geo: chevronGeo,
        matrix: gateTilt.clone().multiply(makeTransform(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0, 0, 0, a - Math.PI * 0.5)),
        colorRgb: warmBronze,
      });
    }

    const hullCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.095, 0.011, 6, 18));
    const ventralFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0],
          [0.24, 0],
          [0.10, -0.14],
          [-0.18, -0.12],
        ],
        0.022,
        0.004,
        0.004,
        1,
      ),
    );
    ventralFinGeo.rotateY(Math.PI * 0.5);
    const gateStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.014, 1, 6));
    const auxGateRing = trackGeo(out, new THREE.TorusGeometry(0.18, 0.010, 6, 22));

    out.trim.push(
      { geo: hullCollarGeo, matrix: skiff.clone().multiply(makeTransform(0, 0, 0.22)), colorRgb: antiqueBronze },
      { geo: hullCollarGeo, matrix: skiff.clone().multiply(makeTransform(0, 0, -0.14, 0, 0, 0, 0.92, 0.92, 1)), colorRgb: antiqueBronze },
      {
        geo: gateStrutGeo,
        matrix: makeSegmentTransform(new THREE.Vector3(-0.08, 0.92, -0.14), new THREE.Vector3(-0.26, 0.96, -0.22)),
        colorRgb: antiqueBronze,
      },
      {
        geo: gateStrutGeo,
        matrix: makeSegmentTransform(new THREE.Vector3(0.08, 0.92, -0.14), new THREE.Vector3(0.26, 0.96, -0.22)),
        colorRgb: antiqueBronze,
      },
      {
        geo: auxGateRing,
        matrix: gateTilt.clone().multiply(makeTransform(0, 0, -0.14)),
        colorRgb: warmBronze,
      },
    );
    out.armor.push({
      geo: ventralFinGeo,
      matrix: skiff.clone().multiply(makeTransform(0, -0.06, -0.08)),
      colorRgb: jadeHull,
    });

    out.crystalHex = 0x66c8a4;
    out.crystalOpacity = 0.42;
    out.crystalIntensity = 0.54;
    out.weaponGlowHex = 0x4ec898;
    out.headTopLocalY = 1.60;
  },

  S19: (_ctx, out) => {
    const forgedGold: RgbTriple = [0.83, 0.66, 0.34];
    const brightGold: RgbTriple = [0.90, 0.76, 0.44];
    const deepCopper: RgbTriple = [0.56, 0.33, 0.19];
    const darkCopper: RgbTriple = [0.42, 0.24, 0.15];
    const sootIron: RgbTriple = [0.18, 0.17, 0.19];
    const steelMatte: RgbTriple = [0.28, 0.26, 0.27];
    const furnaceAmber: RgbTriple = [0.94, 0.62, 0.20];
    const solarCoreWhite: RgbTriple = [0.98, 0.88, 0.58];

    const turntableY = 0.48;

    const footPadGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.085, 0.08],
          [0.085, 0.08],
          [0.11, -0.07],
          [-0.11, -0.07],
        ],
        0.055,
        0.008,
        0.008,
        1,
      ),
    );
    footPadGeo.rotateX(Math.PI * 0.5);

    const anchorClawGeo = trackGeo(out, new THREE.ConeGeometry(0.026, 0.095, 5));
    anchorClawGeo.rotateX(Math.PI);

    const legArmorGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.056, 0.22],
          [0.056, 0.22],
          [0.072, -0.22],
          [-0.072, -0.22],
        ],
        0.052,
        0.008,
        0.008,
        1,
      ),
    );
    const pistonGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.022, 1, 8));
    const kneeDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.048, 0.048, 0.085, 10));
    kneeDrumGeo.rotateZ(Math.PI * 0.5);

    const legAngles: readonly number[] = [Math.PI / 3, -Math.PI / 3, Math.PI];
    for (const ang of legAngles) {
      const sinA = Math.sin(ang);
      const cosA = Math.cos(ang);
      const hip = new THREE.Vector3(sinA * 0.20, turntableY - 0.02, cosA * 0.20);
      const knee = new THREE.Vector3(sinA * 0.36, 0.34, cosA * 0.36);
      const foot = new THREE.Vector3(sinA * 0.48, 0.11, cosA * 0.48);

      out.matte.push({
        geo: footPadGeo,
        matrix: makeTransform(foot.x, 0.11, foot.z, 0, ang, 0),
        colorRgb: sootIron,
      });
      out.trim.push({
        geo: anchorClawGeo,
        matrix: makeTransform(sinA * 0.55, 0.11, cosA * 0.55, 0, ang, 0),
        colorRgb: forgedGold,
      });

      out.armor.push({
        geo: legArmorGeo,
        matrix: makeSegmentTransform(knee, foot, 1.0, 1.0, ang),
        colorRgb: deepCopper,
      });
      out.matte.push(
        {
          geo: pistonGeo,
          matrix: makeSegmentTransform(hip, knee),
          colorRgb: steelMatte,
        },
        {
          geo: pistonGeo,
          matrix: makeSegmentTransform(
            new THREE.Vector3(sinA * 0.14, turntableY - 0.10, cosA * 0.14),
            new THREE.Vector3(sinA * 0.42, 0.14, cosA * 0.42),
            0.85,
            0.85,
          ),
          colorRgb: sootIron,
        },
      );
      out.trim.push({
        geo: kneeDrumGeo,
        matrix: makeTransform(knee.x, knee.y, knee.z, 0, ang, 0),
        colorRgb: forgedGold,
      });
    }

    const turntableBaseGeo = trackGeo(out, new THREE.CylinderGeometry(0.28, 0.32, 0.11, 12));
    const turntableGearGeo = trackGeo(out, createClockGearPart(0.31, 0.22, 16, 0.026, 0.044));
    turntableGearGeo.rotateX(Math.PI * 0.5);
    out.matte.push({ geo: turntableBaseGeo, matrix: makeTransform(0, turntableY, 0), colorRgb: sootIron });
    out.trim.push({ geo: turntableGearGeo, matrix: makeTransform(0, turntableY + 0.06, 0), colorRgb: forgedGold });

    const triShape = (r: number): readonly (readonly [number, number])[] => {
      const pts: [number, number][] = [];
      for (let i = 0; i < 3; i += 1) {
        const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
        const aL = a - 0.16;
        const aR = a + 0.16;
        pts.push([Math.cos(aL) * r, Math.sin(aL) * r]);
        pts.push([Math.cos(aR) * r, Math.sin(aR) * r]);
      }
      return pts;
    };

    const towerLowGeo = trackGeo(out, createBevelExtrudePart(triShape(0.245), 0.26, 0.014, 0.014, 2));
    towerLowGeo.rotateX(Math.PI * 0.5);
    const towerMidGeo = trackGeo(out, createBevelExtrudePart(triShape(0.205), 0.28, 0.012, 0.012, 2));
    towerMidGeo.rotateX(Math.PI * 0.5);
    const towerTopGeo = trackGeo(out, createBevelExtrudePart(triShape(0.235), 0.16, 0.014, 0.014, 2));
    towerTopGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: towerLowGeo, matrix: makeTransform(0, 0.66, 0), colorRgb: deepCopper },
      { geo: towerMidGeo, matrix: makeTransform(0, 0.94, 0), colorRgb: forgedGold },
      { geo: towerTopGeo, matrix: makeTransform(0, 1.18, 0), colorRgb: deepCopper },
    );

    const towerCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.235, 0.018, 6, 18));
    towerCollarGeo.rotateX(Math.PI * 0.5);
    out.trim.push(
      { geo: towerCollarGeo, matrix: makeTransform(0, 0.80, 0), colorRgb: brightGold },
      { geo: towerCollarGeo, matrix: makeTransform(0, 1.10, 0, 0, 0, 0, 0.96, 1, 0.96), colorRgb: brightGold },
    );

    const furnaceSlotGeo = trackGeo(out, new THREE.CylinderGeometry(0.038, 0.038, 0.56, 6));
    const ribButtressGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.022, 0.34],
          [0.042, 0.28],
          [0.056, -0.28],
          [-0.022, -0.34],
        ],
        0.044,
        0.006,
        0.006,
        1,
      ),
    );

    for (let i = 0; i < 3; i += 1) {
      const cornerAng = (i / 3) * Math.PI * 2 + Math.PI / 3;
      const faceAng = cornerAng + Math.PI / 3;

      out.matte.push({
        geo: ribButtressGeo,
        matrix: makeTransform(Math.sin(cornerAng) * 0.22, 0.88, Math.cos(cornerAng) * 0.22, 0, cornerAng - Math.PI * 0.5, 0),
        colorRgb: sootIron,
      });
      out.energy.push({
        geo: furnaceSlotGeo,
        matrix: makeTransform(Math.sin(faceAng) * 0.145, 0.88, Math.cos(faceAng) * 0.145),
        colorRgb: furnaceAmber,
      });
    }

    const mirrorFrameGeo = trackGeo(out, createChamferedHexPart(0.245, 0.036, 0.008, 0.195));
    const mirrorBackGeo = trackGeo(out, createChamferedHexPart(0.215, 0.022, 0.006, 0));
    const mirrorHexGoldGeo = trackGeo(out, createHexMirrorTilePart(0.095, 0.022, 0.007, 0.012, brightGold, deepCopper));
    const mirrorHexAmberGeo = trackGeo(out, createHexMirrorTilePart(0.105, 0.022, 0.008, 0.014, solarCoreWhite, furnaceAmber));
    const tiltArmGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.026, 1, 8));

    const mirrorAzimuths: readonly number[] = [Math.PI, Math.PI * 0.36, -Math.PI * 0.36];
    for (const az of mirrorAzimuths) {
      const sinA = Math.sin(az);
      const cosA = Math.cos(az);
      const mountBase = new THREE.Vector3(sinA * 0.18, 1.22, cosA * 0.18);
      const mirrorPos = new THREE.Vector3(sinA * 0.36, 1.50, cosA * 0.36);

      out.matte.push({
        geo: tiltArmGeo,
        matrix: makeSegmentTransform(mountBase, mirrorPos),
        colorRgb: sootIron,
      });

      const mirrorMat = makeTransform(mirrorPos.x, mirrorPos.y, mirrorPos.z, 0, az + Math.PI, 0).multiply(
        makeTransform(0, 0, 0, -0.44, 0, 0),
      );

      out.armor.push(
        { geo: mirrorFrameGeo, matrix: mirrorMat, colorRgb: darkCopper },
        { geo: mirrorBackGeo, matrix: mirrorMat.clone().multiply(makeTransform(0, 0, -0.022)), colorRgb: sootIron },
      );

      out.crystal.push({
        geo: mirrorHexAmberGeo,
        matrix: mirrorMat.clone().multiply(makeTransform(0, 0.01, 0.012)),
      });

      const subOffsets: readonly (readonly [number, number])[] = [
        [0, 0.125],
        [-0.11, -0.065],
        [0.11, -0.065],
      ];
      for (const [ox, oy] of subOffsets) {
        out.trim.push({
          geo: mirrorHexGoldGeo,
          matrix: mirrorMat.clone().multiply(makeTransform(ox, oy, 0.010, 0, 0, 0, 0.88, 0.88, 0.88)),
        });
      }
    }

    const sunCoreY = 1.44;
    const sunCoreZ = 0.04;
    const sunCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.32, 0.12, 8, 0.5, 0.5, furnaceAmber, solarCoreWhite));
    const sunLensHalo = trackGeo(out, new THREE.TorusGeometry(0.165, 0.014, 8, 24));
    const emitterBarrelGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.065, 0.0],
          [0.088, 0.08],
          [0.072, 0.18],
          [0.095, 0.22],
        ],
        12,
      ),
    );
    emitterBarrelGeo.rotateX(Math.PI * 0.5);
    const lensDomeGeo = trackGeo(out, new THREE.SphereGeometry(0.082, 12, 10));

    out.energy.push({
      geo: sunCrystalGeo,
      matrix: makeTransform(0, sunCoreY, sunCoreZ),
    });
    out.trim.push(
      {
        geo: sunLensHalo,
        matrix: makeTransform(0, sunCoreY, sunCoreZ + 0.06, 0.08, 0, 0),
        colorRgb: brightGold,
      },
      {
        geo: emitterBarrelGeo,
        matrix: makeTransform(0, sunCoreY - 0.02, sunCoreZ + 0.10),
        colorRgb: forgedGold,
      },
    );
    out.crystal.push({
      geo: lensDomeGeo,
      matrix: makeTransform(0, sunCoreY - 0.02, sunCoreZ + 0.30, 0, 0, 0, 1.0, 1.0, 0.55),
      colorRgb: solarCoreWhite,
    });

    const prongGeo = trackGeo(out, new THREE.ConeGeometry(0.018, 0.16, 4));
    prongGeo.rotateX(Math.PI * 0.5);
    for (let p = 0; p < 3; p += 1) {
      const pa = (p / 3) * Math.PI * 2 + Math.PI / 6;
      out.trim.push({
        geo: prongGeo,
        matrix: makeTransform(
          Math.cos(pa) * 0.115,
          sunCoreY - 0.02 + Math.sin(pa) * 0.115,
          sunCoreZ + 0.30,
          0,
          0,
          pa,
        ),
        colorRgb: brightGold,
      });
    }

    out.crystalHex = 0xe8a846;
    out.crystalOpacity = 0.48;
    out.crystalIntensity = 0.64;
    out.weaponGlowHex = 0xeb922e;
    out.headTopLocalY = 1.84;
  },
};
