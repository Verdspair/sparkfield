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
  const sampleCount = 24;
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
    createFlowingRibbonMesh(
      pts,
      widthProfile,
      0.011,
      3.0,
      segsLength,
      segsWidth,
      thickness,
      colorA,
      colorB,
      true,
    ),
  );
}

function buildWarpedFilament(
  out: UnitBlueprintParts,
  radius: number,
  warpAmpY: number,
  warpFreqY: number,
  warpPhaseY: number,
  radialWarpAmp: number,
  tubeRadius: number,
  segs: number,
): THREE.BufferGeometry {
  const pts: Vec3Tuple[] = [];
  const sampleCount = 18;
  for (let i = 0; i < sampleCount; i += 1) {
    const theta = (i / sampleCount) * Math.PI * 2;
    const r = radius + Math.sin(theta * 3 + warpPhaseY) * radialWarpAmp;
    const y = Math.sin(theta * warpFreqY + warpPhaseY) * warpAmpY;
    pts.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return trackGeo(out, createTubePart(pts, tubeRadius, segs, 6, true));
}

function makeLookAtBasis(
  origin: THREE.Vector3,
  tangent: THREE.Vector3,
  upHint = new THREE.Vector3(0, 1, 0),
): THREE.Matrix4 {
  const zAxis = tangent.clone().normalize();
  const xAxis = new THREE.Vector3().crossVectors(upHint, zAxis);
  if (xAxis.lengthSq() < 0.0001) {
    xAxis.set(1, 0, 0);
  } else {
    xAxis.normalize();
  }
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  m.setPosition(origin);
  return m;
}

function buildS29Leviathan(out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.16, 0.25, 0.42];
  const titaniumTeal: RgbTriple = [0.27, 0.45, 0.58];
  const paleAlloy: RgbTriple = [0.56, 0.70, 0.78];
  const deepSlate: RgbTriple = [0.10, 0.14, 0.22];
  const warmBronze: RgbTriple = [0.78, 0.60, 0.34];
  const antiqueBronze: RgbTriple = [0.58, 0.42, 0.22];
  const cherenkovCyan: RgbTriple = [0.46, 0.86, 0.98];
  const iceFoam: RgbTriple = [0.78, 0.95, 1.0];

  const whaleFrame = makeTransform(0, 1.08, 0.22, -0.24, 0.04, 0.06);

  const wakeRing = trackGeo(out, new THREE.TorusGeometry(0.46, 0.013, 8, 32));
  out.trim.push({
    geo: wakeRing,
    matrix: makeTransform(0, 0.20, -0.02, Math.PI * 0.5, 0, 0, 1.04, 1.24, 1.0),
    colorRgb: antiqueBronze,
  });
  const wakeInner = trackGeo(out, new THREE.TorusGeometry(0.32, 0.009, 6, 26));
  out.energy.push({
    geo: wakeInner,
    matrix: makeTransform(0, 0.21, -0.02, Math.PI * 0.5, 0, 0, 1.02, 1.22, 1.0),
    colorRgb: cherenkovCyan,
  });
  const wakeDisc = trackGeo(out, new THREE.CylinderGeometry(0.40, 0.44, 0.012, 24));
  out.crystal.push({
    geo: wakeDisc,
    matrix: makeTransform(0, 0.19, -0.02, 0, 0, 0, 1.0, 1.0, 1.18),
    colorRgb: cherenkovCyan,
  });

  const mainHull = trackGeo(
    out,
    createTeardropPart(1.36, 0.235, 1.45, 22, 16, 0.024, starIndigo, titaniumTeal),
  );
  out.armor.push({
    geo: mainHull,
    matrix: whaleFrame
      .clone()
      .multiply(makeTransform(0, 0.01, 0.06, -Math.PI * 0.5, 0, 0, 0.98, 1.0, 0.84)),
  });

  const cranialCap = trackGeo(
    out,
    createTeardropPart(0.84, 0.195, 1.15, 18, 12, 0.016, titaniumTeal, paleAlloy),
  );
  out.armor.push({
    geo: cranialCap,
    matrix: whaleFrame
      .clone()
      .multiply(makeTransform(0, 0.072, 0.26, -Math.PI * 0.5 + 0.08, 0, 0, 0.92, 1.0, 0.52)),
  });

  const browRidge = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.145, 0.62],
        [0, 0.186, 0.34],
        [0, 0.168, 0.02],
        [0, 0.112, -0.34],
      ],
      0.024,
      0.042,
      0.022,
      14,
      10,
      paleAlloy,
      starIndigo,
    ),
  );
  out.armor.push({ geo: browRidge, matrix: whaleFrame });

  const lowerJaw = trackGeo(
    out,
    createTeardropPart(0.82, 0.165, 1.25, 16, 12, -0.014, deepSlate, starIndigo),
  );
  out.matte.push({
    geo: lowerJaw,
    matrix: whaleFrame
      .clone()
      .multiply(makeTransform(0, -0.076, 0.25, -Math.PI * 0.5 - 0.07, 0, 0, 0.88, 1.0, 0.46)),
  });

  for (let i = -2; i <= 2; i += 1) {
    const xOff = i * 0.044;
    const yDip = -0.145 + Math.abs(i) * 0.014;
    const pleatGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [xOff * 0.65, yDip + 0.032, 0.56],
          [xOff, yDip, 0.24],
          [xOff * 0.82, yDip + 0.024, -0.14],
        ],
        0.008,
        0.014,
        0.008,
        10,
        6,
        deepSlate,
        warmBronze,
      ),
    );
    out.matte.push({ geo: pleatGeo, matrix: whaleFrame });
  }

  const tailStock = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, -0.01, -0.26],
        [0, -0.03, -0.50],
        [0, 0.05, -0.68],
        [0, 0.16, -0.82],
      ],
      0.132,
      0.086,
      0.038,
      14,
      12,
      starIndigo,
      titaniumTeal,
    ),
  );
  out.armor.push({ geo: tailStock, matrix: whaleFrame });

  const keelBand = trackGeo(out, new THREE.TorusGeometry(0.215, 0.014, 8, 24));
  const ribZOffsets: readonly [number, number, number][] = [
    [0.34, 0.90, 0.78],
    [0.06, 1.03, 0.86],
    [-0.24, 0.80, 0.72],
  ];
  for (const [rz, sx, sy] of ribZOffsets) {
    out.trim.push({
      geo: keelBand,
      matrix: whaleFrame.clone().multiply(makeTransform(0, 0.01, rz, 0, 0, 0, sx, sy, 1.0)),
      colorRgb: warmBronze,
    });
  }

  const gearDisc = trackGeo(out, new THREE.CylinderGeometry(0.088, 0.088, 0.022, 14));
  const gearRim = trackGeo(out, createChamferedHexPart(0.102, 0.018, 0.006, 0.062));
  const gearHub = trackGeo(out, new THREE.CylinderGeometry(0.030, 0.034, 0.036, 10));
  for (const side of [-1, 1] as const) {
    const flankMat = whaleFrame
      .clone()
      .multiply(makeTransform(side * 0.212, 0.015, 0.04, 0, 0, Math.PI * 0.5));
    out.trim.push(
      { geo: gearDisc, matrix: flankMat, colorRgb: antiqueBronze },
      { geo: gearHub, matrix: flankMat, colorRgb: warmBronze },
    );
    out.trim.push({
      geo: gearRim,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(side * 0.222, 0.015, 0.04, 0, Math.PI * 0.5, 0.26)),
      colorRgb: warmBronze,
    });
  }

  const bridgeShape = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.08, 0],
        [0.08, 0],
        [0.055, 0.14],
        [-0.055, 0.14],
      ],
      0.18,
      0.012,
      0.012,
      2,
    ),
  );
  out.armor.push({
    geo: bridgeShape,
    matrix: whaleFrame.clone().multiply(makeTransform(0, 0.175, 0.34, 0.14, 0, 0)),
    colorRgb: starIndigo,
  });
  const bridgeVisor = trackGeo(out, createCurvedVisorPart(0.064, 0.042, 0.056, 1.4, 1.05, 0.56));
  out.energy.push({
    geo: bridgeVisor,
    matrix: whaleFrame.clone().multiply(makeTransform(0, 0.245, 0.40, 0.06, 0, 0)),
    colorRgb: iceFoam,
  });

  const eyeOrb = trackGeo(out, new THREE.SphereGeometry(0.026, 10, 8));
  const eyeBezel = trackGeo(out, new THREE.TorusGeometry(0.032, 0.007, 6, 14));
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: eyeOrb,
      matrix: whaleFrame.clone().multiply(makeTransform(side * 0.158, 0.024, 0.44)),
      colorRgb: iceFoam,
    });
    out.trim.push({
      geo: eyeBezel,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(side * 0.162, 0.024, 0.44, 0, side * 1.18, 0)),
      colorRgb: warmBronze,
    });
  }

  const gillSlit = trackGeo(out, createCurvedBladePart(0.145, 0.026, 0.012, 0.018, 0.012, 6));
  const gillCowl = trackGeo(out, createCurvedBladePart(0.162, 0.038, 0.018, 0.016, 0.010, 6));
  for (const side of [-1, 1] as const) {
    for (let g = 0; g < 4; g += 1) {
      const gz = 0.28 - g * 0.088;
      const gx = side * (0.205 - g * 0.006);
      const gy = -0.024 + g * 0.006;
      const gMat = whaleFrame
        .clone()
        .multiply(makeTransform(gx, gy, gz, 0.34, side * 0.24, side * 0.18));
      out.matte.push({ geo: gillCowl, matrix: gMat, colorRgb: deepSlate });
      out.energy.push({
        geo: gillSlit,
        matrix: whaleFrame
          .clone()
          .multiply(makeTransform(gx + side * 0.012, gy + 0.006, gz + 0.004, 0.34, side * 0.24, side * 0.18)),
        colorRgb: cherenkovCyan,
      });
    }
  }

  const turretSaddle = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.14, 0],
        [0.14, 0],
        [0.11, 0.16],
        [0.06, 0.23],
        [-0.06, 0.23],
        [-0.11, 0.16],
      ],
      0.34,
      0.014,
      0.014,
      2,
    ),
  );
  out.armor.push({
    geo: turretSaddle,
    matrix: whaleFrame.clone().multiply(makeTransform(0, 0.155, -0.02, -0.10, 0, 0)),
    colorRgb: starIndigo,
  });

  const dorsalFinSpine = trackGeo(
    out,
    createCurvedBladePart(0.32, 0.12, 0.032, 0.08, 0.02, 8),
  );
  out.trim.push({
    geo: dorsalFinSpine,
    matrix: whaleFrame.clone().multiply(makeTransform(0, 0.28, -0.14, -0.52, Math.PI * 0.5, 0)),
    colorRgb: warmBronze,
  });

  const barrelGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.026, -0.28],
        [0.032, -0.22],
        [0.028, -0.06],
        [0.022, 0.02],
        [0.025, 0.16],
        [0.018, 0.26],
        [0.022, 0.34],
        [0.014, 0.38],
      ],
      12,
    ),
  );
  const muzzleRing = trackGeo(out, new THREE.TorusGeometry(0.026, 0.0055, 6, 12));
  const plasmaRail = trackGeo(out, new THREE.CylinderGeometry(0.0085, 0.0085, 0.56, 8));
  const barrelOffsets: readonly [number, number, number][] = [
    [-0.082, 0.30, 0.16],
    [0.082, 0.30, 0.16],
    [-0.042, 0.365, 0.06],
    [0.042, 0.365, 0.06],
  ];
  for (const [bx, by, bz] of barrelOffsets) {
    out.trim.push({
      geo: barrelGeo,
      matrix: whaleFrame.clone().multiply(makeTransform(bx, by, bz, Math.PI * 0.5 - 0.06, 0, 0)),
      colorRgb: paleAlloy,
    });
    out.trim.push({
      geo: muzzleRing,
      matrix: whaleFrame.clone().multiply(makeTransform(bx, by + 0.022, bz + 0.33, 0, 0, 0)),
      colorRgb: warmBronze,
    });
    out.energy.push({
      geo: plasmaRail,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(bx, by + 0.014, bz + 0.05, Math.PI * 0.5 - 0.06, 0, 0)),
      colorRgb: cherenkovCyan,
    });
  }

  const pecArmor = trackGeo(
    out,
    createCreatureFin(0.28, 0.58, 0.32, 0.048, 0.034, 16, 8, starIndigo, titaniumTeal),
  );
  const pecFoil = trackGeo(
    out,
    createCreatureFin(0.20, 0.64, 0.42, 0.032, 0.012, 14, 6, cherenkovCyan, iceFoam),
  );
  const tubercleOrb = trackGeo(out, new THREE.SphereGeometry(0.018, 8, 6));
  for (const side of [-1, 1] as const) {
    const finMat = whaleFrame
      .clone()
      .multiply(makeTransform(side * 0.175, -0.055, 0.16, 0.10, side * 0.16, -side * 0.24, side, 1, 1));
    out.armor.push({ geo: pecArmor, matrix: finMat });
    out.crystal.push({
      geo: pecFoil,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(side * 0.18, -0.062, 0.05, 0.12, side * 0.20, -side * 0.28, side, 1, 1)),
    });
    for (let k = 0; k < 3; k += 1) {
      const f = (k + 1) / 4;
      out.trim.push({
        geo: tubercleOrb,
        matrix: finMat.clone().multiply(makeTransform(0.14 + f * 0.34, 0.022, 0.10 - f * 0.20)),
        colorRgb: warmBronze,
      });
    }
  }

  const flukeArmor = trackGeo(
    out,
    createCreatureFin(0.24, 0.44, 0.26, 0.038, 0.024, 14, 8, titaniumTeal, paleAlloy),
  );
  const flukeLight = trackGeo(
    out,
    createCreatureFin(0.18, 0.50, 0.34, 0.024, 0.010, 12, 6, cherenkovCyan, iceFoam),
  );
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: flukeArmor,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(side * 0.02, 0.165, -0.80, -0.22, side * 0.12, side * 0.14, side, 1, 1)),
    });
    out.crystal.push({
      geo: flukeLight,
      matrix: whaleFrame
        .clone()
        .multiply(makeTransform(side * 0.02, 0.165, -0.85, -0.26, side * 0.16, side * 0.18, side, 1, 1)),
    });
  }

  const wingArc = trackGeo(out, new THREE.TorusGeometry(0.64, 0.016, 8, 28, Math.PI * 0.85));
  out.wingParts.push(
    { geo: wingArc, matrix: makeTransform(-0.08, 1.04, -0.20, 0.22, 0.48, 0.62), colorRgb: warmBronze },
    { geo: wingArc, matrix: makeTransform(0.08, 1.04, -0.20, 0.22, -0.48, -0.62), colorRgb: warmBronze },
  );

  out.weaponGlowHex = 0x38bdf8;
  out.crystalHex = 0x67e8f9;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.62;
  out.headTopLocalY = 1.76;
}

function buildS30Sirius(out: UnitBlueprintParts): void {
  const deepNavy: RgbTriple = [0.13, 0.21, 0.38];
  const steelBlue: RgbTriple = [0.24, 0.36, 0.56];
  const matteTitanium: RgbTriple = [0.72, 0.78, 0.86];
  const brightSilver: RgbTriple = [0.88, 0.92, 0.97];
  const surveyBrass: RgbTriple = [0.80, 0.66, 0.40];
  const carbonFrame: RgbTriple = [0.10, 0.14, 0.22];
  const dwarfWhite: RgbTriple = [0.95, 0.98, 1.0];
  const lensIce: RgbTriple = [0.64, 0.84, 1.0];

  const centerY = 1.08;

  const baseHex = trackGeo(out, createChamferedHexPart(0.42, 0.048, 0.014, 0.24));
  out.armor.push({
    geo: baseHex,
    matrix: makeTransform(0, 0.15, 0, Math.PI * 0.5, 0, 0),
    colorRgb: deepNavy,
  });
  const baseVernier = trackGeo(out, new THREE.TorusGeometry(0.36, 0.014, 8, 32));
  out.trim.push({
    geo: baseVernier,
    matrix: makeTransform(0, 0.18, 0, Math.PI * 0.5, 0, 0),
    colorRgb: surveyBrass,
  });
  const baseCoreRing = trackGeo(out, new THREE.TorusGeometry(0.18, 0.011, 6, 24));
  out.energy.push({
    geo: baseCoreRing,
    matrix: makeTransform(0, 0.17, 0, Math.PI * 0.5, 0, 0),
    colorRgb: lensIce,
  });

  const anchorLeg = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.15, 0.35],
        [0, 0.11, 0.45],
        [0, 0.06, 0.52],
      ],
      0.032,
      0.026,
      0.020,
      10,
      8,
      deepNavy,
      matteTitanium,
    ),
  );
  const footPad = trackGeo(out, new THREE.CylinderGeometry(0.034, 0.046, 0.036, 8));
  for (let i = 0; i < 4; i += 1) {
    const yaw = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.armor.push({ geo: anchorLeg, matrix: makeTransform(0, 0, 0, 0, yaw, 0) });
    out.matte.push({
      geo: footPad,
      matrix: makeTransform(Math.sin(yaw) * 0.52, 0.056, Math.cos(yaw) * 0.52),
      colorRgb: carbonFrame,
    });
  }

  const dwarfCore = trackGeo(out, new THREE.IcosahedronGeometry(0.178, 2));
  out.energy.push({
    geo: dwarfCore,
    matrix: makeTransform(0, centerY, 0),
    colorRgb: dwarfWhite,
  });
  const coronaShell = trackGeo(out, new THREE.SphereGeometry(0.228, 20, 16));
  out.crystal.push({
    geo: coronaShell,
    matrix: makeTransform(0, centerY, 0),
    colorRgb: lensIce,
  });

  const flareLoop = trackGeo(out, new THREE.TorusGeometry(0.242, 0.008, 6, 28));
  out.energy.push(
    { geo: flareLoop, matrix: makeTransform(0, centerY, 0, 0.58, 0.34, 0.22), colorRgb: dwarfWhite },
    { geo: flareLoop, matrix: makeTransform(0, centerY, 0, -0.72, 0.88, -0.44), colorRgb: lensIce },
  );

  const polarJet = trackGeo(out, createTeardropPart(0.32, 0.038, 2.2, 12, 10, 0, dwarfWhite, lensIce));
  out.energy.push(
    { geo: polarJet, matrix: makeTransform(0, centerY + 0.24, 0, 0.14, 0, -0.12) },
    { geo: polarJet, matrix: makeTransform(0, centerY - 0.24, 0, Math.PI + 0.14, 0, -0.12) },
  );

  const cagePylon = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.17, 0.36],
        [0, 0.54, 0.54],
        [0, 1.08, 0.56],
        [0, 1.56, 0.42],
        [0, 1.80, 0.12],
      ],
      0.036,
      0.044,
      0.026,
      18,
      10,
      deepNavy,
      steelBlue,
    ),
  );
  const cageInnerCoil = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.28, 0.35],
        [0, 0.68, 0.48],
        [0, 1.08, 0.49],
        [0, 1.48, 0.38],
        [0, 1.72, 0.14],
      ],
      0.015,
      0.018,
      0.012,
      14,
      8,
      carbonFrame,
      matteTitanium,
    ),
  );
  const pinchEmitter = trackGeo(
    out,
    createLathePart(
      [
        [0.042, -0.05],
        [0.036, 0.0],
        [0.024, 0.06],
        [0.014, 0.11],
      ],
      10,
    ),
  );
  const emitterTip = trackGeo(out, new THREE.SphereGeometry(0.019, 8, 6));
  const shroudPlate = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.045, -0.16],
        [0.045, -0.16],
        [0.062, 0.04],
        [0.030, 0.18],
        [-0.030, 0.18],
        [-0.062, 0.04],
      ],
      0.036,
      0.009,
      0.009,
      1,
    ),
  );

  for (let i = 0; i < 4; i += 1) {
    const yaw = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const rot = makeTransform(0, 0, 0, 0, yaw, 0);
    out.armor.push({ geo: cagePylon, matrix: rot });
    out.matte.push({ geo: cageInnerCoil, matrix: rot });
    out.trim.push({
      geo: shroudPlate,
      matrix: rot.clone().multiply(makeTransform(0, 1.06, 0.59, 0, 0, 0)),
      colorRgb: matteTitanium,
    });
    out.trim.push({
      geo: pinchEmitter,
      matrix: rot.clone().multiply(makeTransform(0, centerY, 0.48, -Math.PI * 0.5, 0, 0)),
      colorRgb: brightSilver,
    });
    out.energy.push({
      geo: emitterTip,
      matrix: rot.clone().multiply(makeTransform(0, centerY, 0.365)),
      colorRgb: dwarfWhite,
    });
  }

  const crownSpire = trackGeo(
    out,
    createLathePart(
      [
        [0.14, 0.0],
        [0.11, 0.05],
        [0.065, 0.10],
        [0.042, 0.18],
        [0.018, 0.28],
        [0.004, 0.34],
      ],
      14,
    ),
  );
  out.trim.push({
    geo: crownSpire,
    matrix: makeTransform(0, 1.76, 0),
    colorRgb: brightSilver,
  });
  const crownHalo = trackGeo(out, new THREE.TorusGeometry(0.15, 0.012, 6, 20));
  out.trim.push({
    geo: crownHalo,
    matrix: makeTransform(0, 1.82, 0, Math.PI * 0.5, 0, 0),
    colorRgb: surveyBrass,
  });

  const innerLensRing = trackGeo(out, new THREE.TorusGeometry(0.45, 0.022, 10, 36));
  const innerMetalHoop = trackGeo(out, new THREE.TorusGeometry(0.48, 0.009, 6, 36));
  const innerTilt = makeTransform(0, centerY, 0, 0.62, 0.24, 0.34);
  out.crystal.push({ geo: innerLensRing, matrix: innerTilt, colorRgb: lensIce });
  out.trim.push({ geo: innerMetalHoop, matrix: innerTilt, colorRgb: brightSilver });

  const outerSurveyRing = trackGeo(out, new THREE.TorusGeometry(0.66, 0.020, 10, 40));
  const outerBrassTrack = trackGeo(out, new THREE.TorusGeometry(0.695, 0.009, 6, 40));
  const outerTilt = makeTransform(0, centerY, 0, -0.52, -0.30, -0.26);
  out.armor.push({ geo: outerSurveyRing, matrix: outerTilt, colorRgb: deepNavy });
  out.trim.push({ geo: outerBrassTrack, matrix: outerTilt, colorRgb: surveyBrass });

  const vernierPip = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.011, 0.056, 6));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    out.trim.push({
      geo: vernierPip,
      matrix: outerTilt
        .clone()
        .multiply(makeTransform(Math.cos(a) * 0.68, Math.sin(a) * 0.68, 0, 0, 0, a - Math.PI * 0.5)),
      colorRgb: surveyBrass,
    });
  }

  const lensMeniscus = trackGeo(out, createCurvedVisorPart(0.38, 0.38, 0.22, 2.2, 0.65, 1.85));
  out.crystal.push({
    geo: lensMeniscus,
    matrix: makeTransform(0, centerY, -0.06, 0, Math.PI, 0),
    colorRgb: lensIce,
  });

  const prismCrystal = trackGeo(
    out,
    createFacetedCrystalPart(0.24, 0.058, 6, 0.58, 0.42, lensIce, dwarfWhite),
  );
  const prismClamp = trackGeo(out, new THREE.TorusGeometry(0.066, 0.010, 6, 12));
  const prismAngles = [0.46, -0.46, Math.PI - 0.58, -Math.PI + 0.58];
  for (let i = 0; i < 4; i += 1) {
    const ang = prismAngles[i]!;
    const py = centerY + (i < 2 ? 0.14 : -0.10);
    const pr = 0.68;
    const px = Math.sin(ang) * pr;
    const pz = Math.cos(ang) * pr;
    const pMat = makeTransform(px, py, pz, i < 2 ? 0.28 : -0.22, ang, i % 2 === 0 ? 0.18 : -0.18);
    out.crystal.push({ geo: prismCrystal, matrix: pMat });
    out.trim.push({
      geo: prismClamp,
      matrix: pMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: matteTitanium,
    });
  }

  const forwardApertureOuter = trackGeo(out, new THREE.TorusGeometry(0.22, 0.018, 8, 24));
  const forwardApertureInner = trackGeo(out, new THREE.TorusGeometry(0.15, 0.010, 6, 20));
  out.trim.push({
    geo: forwardApertureOuter,
    matrix: makeTransform(0, centerY, 0.54, 0, 0, 0),
    colorRgb: surveyBrass,
  });
  out.energy.push({
    geo: forwardApertureInner,
    matrix: makeTransform(0, centerY, 0.56, 0, 0, 0),
    colorRgb: dwarfWhite,
  });

  const dishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.016, 0.0],
        [0.075, 0.018],
        [0.145, 0.056],
        [0.195, 0.112],
        [0.182, 0.116],
        [0.068, 0.028],
        [0.012, 0.010],
      ],
      18,
    ),
  );
  const feedHorn = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.018, 0.14, 8));
  out.armor.push({
    geo: dishGeo,
    matrix: makeTransform(0, centerY, -0.58, Math.PI * 0.5, 0, 0, 1.15, 1.0, 1.15),
    colorRgb: steelBlue,
  });
  for (const side of [-1, 1] as const) {
    const dMat = makeTransform(side * 0.62, centerY + 0.24, -0.12, Math.PI * 0.5 - 0.20, side * 0.44, 0, 0.72, 0.72, 0.72);
    out.trim.push({ geo: dishGeo, matrix: dMat, colorRgb: matteTitanium });
    out.trim.push({
      geo: feedHorn,
      matrix: dMat.clone().multiply(makeTransform(0, 0.09, 0)),
      colorRgb: surveyBrass,
    });
  }

  const wingSurveyArc = trackGeo(out, new THREE.TorusGeometry(0.78, 0.016, 8, 30, Math.PI * 0.75));
  out.wingParts.push(
    { geo: wingSurveyArc, matrix: makeTransform(-0.06, centerY, -0.18, 0.18, 0.42, 0.85), colorRgb: surveyBrass },
    { geo: wingSurveyArc, matrix: makeTransform(0.06, centerY, -0.18, 0.18, -0.42, -0.85), colorRgb: surveyBrass },
  );

  out.weaponGlowHex = 0xdbeafe;
  out.crystalHex = 0x7dd3fc;
  out.crystalOpacity = 0.46;
  out.crystalIntensity = 0.72;
  out.headTopLocalY = 2.18;
}

function buildS31Siren(out: UnitBlueprintParts): void {
  const glacierWhite: RgbTriple = [0.84, 0.93, 0.98];
  const frostBlue: RgbTriple = [0.54, 0.78, 0.92];
  const abyssalBlue: RgbTriple = [0.22, 0.46, 0.66];
  const deepSeaSlate: RgbTriple = [0.14, 0.28, 0.42];
  const frostSilver: RgbTriple = [0.76, 0.86, 0.94];
  const bioMint: RgbTriple = [0.42, 0.88, 0.76];
  const bioPearl: RgbTriple = [0.80, 0.98, 0.92];

  const calyxY = 0.58;

  const calyxCup = trackGeo(
    out,
    createLathePart(
      [
        [0.04, -0.22],
        [0.10, -0.15],
        [0.19, -0.06],
        [0.26, 0.02],
        [0.24, 0.08],
        [0.16, 0.05],
        [0.06, 0.02],
      ],
      18,
    ),
  );
  out.armor.push({
    geo: calyxCup,
    matrix: makeTransform(0, calyxY, 0),
    colorRgb: glacierWhite,
  });

  const calyxCore = trackGeo(
    out,
    createLathePart(
      [
        [0.06, -0.25],
        [0.14, -0.18],
        [0.18, -0.09],
        [0.11, -0.05],
      ],
      14,
    ),
  );
  out.matte.push({
    geo: calyxCore,
    matrix: makeTransform(0, calyxY, 0),
    colorRgb: deepSeaSlate,
  });
  const stabilizerRing = trackGeo(out, new THREE.TorusGeometry(0.28, 0.014, 8, 28));
  out.trim.push({
    geo: stabilizerRing,
    matrix: makeTransform(0, calyxY - 0.04, 0, Math.PI * 0.5, 0, 0),
    colorRgb: frostSilver,
  });

  const cryoTile = trackGeo(out, createHexMirrorTilePart(0.085, 0.022, 0.008, 0.008, frostBlue, abyssalBlue));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    out.armor.push({
      geo: cryoTile,
      matrix: makeTransform(
        Math.sin(a) * 0.22,
        calyxY - 0.10,
        Math.cos(a) * 0.22,
        Math.PI * 0.34,
        a,
        0,
      ),
    });
  }

  const dropTip = trackGeo(out, new THREE.SphereGeometry(0.020, 8, 6));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const sa = Math.sin(a);
    const ca = Math.cos(a);
    const sway = i % 2 === 0 ? 0.05 : -0.05;
    const tendrilGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [sa * 0.14, calyxY - 0.14, ca * 0.14],
          [sa * 0.24 + ca * sway, calyxY - 0.28, ca * 0.24 - sa * sway],
          [sa * 0.28, 0.14, ca * 0.28],
        ],
        0.013,
        0.004,
        12,
        6,
      ),
    );
    out.crystal.push({ geo: tendrilGeo, matrix: makeTransform(0, 0, 0), colorRgb: frostBlue });
    out.energy.push({
      geo: dropTip,
      matrix: makeTransform(sa * 0.28, 0.13, ca * 0.28),
      colorRgb: bioMint,
    });
  }

  const outerPetalCrystal = trackGeo(
    out,
    createPetalPart(0.74, 0.34, 0.078, 0.082, 1.32, 14, 8, glacierWhite, frostBlue),
  );
  const outerSepalArmor = trackGeo(
    out,
    createPetalPart(0.46, 0.22, 0.048, 0.052, 1.40, 10, 6, abyssalBlue, frostBlue),
  );
  const outerVein = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.02, -0.012],
        [0, 0.36, 0.024],
        [0, 0.68, 0.006],
      ],
      0.013,
      0.009,
      0.004,
      10,
      6,
      frostSilver,
      glacierWhite,
    ),
  );

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const pMat = makeTransform(
      Math.sin(a) * 0.16,
      calyxY + 0.02,
      Math.cos(a) * 0.16,
      0,
      a,
      0,
    ).multiply(makeTransform(0, 0, 0, 1.02, 0, 0));
    out.crystal.push({ geo: outerPetalCrystal, matrix: pMat });
    out.armor.push({
      geo: outerSepalArmor,
      matrix: pMat.clone().multiply(makeTransform(0, -0.01, -0.022, 0.06, 0, 0)),
    });
    out.trim.push({ geo: outerVein, matrix: pMat });
  }

  const innerPetalCrystal = trackGeo(
    out,
    createPetalPart(0.84, 0.27, 0.064, 0.064, 1.52, 14, 8, bioPearl, frostBlue),
  );
  const innerSpine = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0, 0.04, -0.008],
        [0, 0.42, 0.018],
        [0, 0.80, 0.004],
      ],
      0.009,
      0.003,
      10,
      6,
    ),
  );
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const pMat = makeTransform(
      Math.sin(a) * 0.12,
      calyxY + 0.08,
      Math.cos(a) * 0.12,
      0,
      a,
      0,
    ).multiply(makeTransform(0, 0, 0, 0.54, 0, 0));
    out.crystal.push({ geo: innerPetalCrystal, matrix: pMat });
    out.trim.push({ geo: innerSpine, matrix: pMat, colorRgb: frostSilver });
  }

  const seedPod = trackGeo(
    out,
    createTeardropPart(0.28, 0.115, 1.25, 16, 12, 0, deepSeaSlate, glacierWhite),
  );
  out.armor.push({ geo: seedPod, matrix: makeTransform(0, calyxY + 0.16, 0) });
  const seedHeart = trackGeo(out, new THREE.SphereGeometry(0.082, 14, 12));
  out.energy.push({
    geo: seedHeart,
    matrix: makeTransform(0, calyxY + 0.18, 0),
    colorRgb: bioPearl,
  });

  const helixPtsA: Vec3Tuple[] = [];
  const helixPtsB: Vec3Tuple[] = [];
  const helixSteps = 18;
  const helixBaseY = calyxY + 0.16;
  const helixHeight = 0.88;
  for (let i = 0; i <= helixSteps; i += 1) {
    const t = i / helixSteps;
    const angle = t * Math.PI * 2.75;
    const r = 0.115 * (1 - t * 0.52) + Math.sin(t * Math.PI) * 0.024;
    const y = helixBaseY + t * helixHeight;
    helixPtsA.push([Math.cos(angle) * r, y, Math.sin(angle) * r]);
    helixPtsB.push([Math.cos(angle + Math.PI) * r, y, Math.sin(angle + Math.PI) * r]);
  }
  const strandA = trackGeo(
    out,
    createOrganicLimb(helixPtsA, 0.022, 0.017, 0.011, 24, 10, bioMint, bioPearl),
  );
  const strandB = trackGeo(
    out,
    createOrganicLimb(helixPtsB, 0.022, 0.017, 0.011, 24, 10, frostSilver, bioMint),
  );
  out.energy.push({ geo: strandA, matrix: makeTransform(0, 0, 0) });
  out.trim.push({ geo: strandB, matrix: makeTransform(0, 0, 0) });

  const rungCyl = trackGeo(out, new THREE.CylinderGeometry(0.0075, 0.0075, 1.0, 6));
  for (let rIdx = 1; rIdx <= 7; rIdx += 1) {
    const t = rIdx / 8;
    const angle = t * Math.PI * 2.75;
    const rad = 0.115 * (1 - t * 0.52) + Math.sin(t * Math.PI) * 0.024;
    const y = helixBaseY + t * helixHeight;
    const pA = new THREE.Vector3(Math.cos(angle) * rad, y, Math.sin(angle) * rad);
    const pB = new THREE.Vector3(Math.cos(angle + Math.PI) * rad, y, Math.sin(angle + Math.PI) * rad);
    out.energy.push({
      geo: rungCyl,
      matrix: makeSegmentTransform(pA, pB, 1.0, 1.0),
      colorRgb: rIdx % 2 === 0 ? bioPearl : bioMint,
    });
  }

  const canopyLeaf = trackGeo(
    out,
    createPetalPart(0.28, 0.13, 0.028, 0.032, 1.45, 10, 6, bioMint, bioPearl),
  );
  const canopyY = helixBaseY + helixHeight - 0.04;
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const lMat = makeTransform(0, canopyY, 0, 0, a, 0).multiply(makeTransform(0, 0, 0, 0.62, 0, 0));
    out.crystal.push({ geo: canopyLeaf, matrix: lMat });
  }

  const sporeCrystal = trackGeo(out, createFacetedCrystalPart(0.11, 0.034, 6, 0.60, 0.40, bioMint, bioPearl));
  const sporePositions: readonly Vec3Tuple[] = [
    [0, canopyY + 0.24, 0],
    [-0.14, canopyY + 0.16, 0.10],
    [0.14, canopyY + 0.14, -0.08],
  ];
  for (const [sx, sy, sz] of sporePositions) {
    out.energy.push({ geo: sporeCrystal, matrix: makeTransform(sx, sy, sz) });
  }

  const frostHalo = trackGeo(out, new THREE.TorusGeometry(0.46, 0.009, 6, 32));
  out.trim.push({
    geo: frostHalo,
    matrix: makeTransform(0, 1.42, -0.04, Math.PI * 0.42, 0.08, 0.12),
    colorRgb: frostSilver,
  });

  const starPetal = trackGeo(out, createPetalPart(0.68, 0.22, 0.04, 0.05, 1.5, 10, 6));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.wingParts.push({
      geo: starPetal,
      matrix: makeTransform(0, 0.92, -0.14, 0, a, 0).multiply(makeTransform(0, 0, 0, 0.86, 0, 0)),
      colorRgb: frostSilver,
    });
  }

  out.weaponGlowHex = 0x5eead4;
  out.crystalHex = 0x7dd3fc;
  out.crystalOpacity = 0.56;
  out.crystalIntensity = 0.64;
  out.headTopLocalY = 1.98;
}

function buildS32Entropy(out: UnitBlueprintParts): void {
  const obsidianVoid: RgbTriple = [0.06, 0.05, 0.09];
  const darkObsidianViolet: RgbTriple = [0.16, 0.10, 0.19];
  const emberObsidian: RgbTriple = [0.27, 0.10, 0.16];
  const liquidCrimson: RgbTriple = [0.58, 0.12, 0.21];
  const bloodChrome: RgbTriple = [0.78, 0.21, 0.30];
  const scarletEnergy: RgbTriple = [0.96, 0.27, 0.37];
  const incandescentHeart: RgbTriple = [1.0, 0.64, 0.58];

  const coreY = 1.06;
  const coreZ = 0.02;
  const bodyFrame = makeTransform(0, coreY, coreZ, 0.12, 0.04, -0.025);

  const upperCowl = trackGeo(
    out,
    createTeardropPart(0.56, 0.124, 1.85, 20, 14, 0.036, darkObsidianViolet, emberObsidian),
  );
  out.armor.push({
    geo: upperCowl,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.46, 0.01, -0.78, 0, 0, 0.78, 1.06, 1.22)),
  });

  const cowlCollar = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.14],
        [-0.13, 0.03],
        [-0.085, -0.10],
        [0.0, -0.15],
        [0.085, -0.10],
        [0.13, 0.03],
      ],
      0.064,
      0.014,
      0.014,
      2,
    ),
  );
  out.matte.push({
    geo: cowlCollar,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.32, 0.01, Math.PI * 0.5 - 0.18, 0, 0)),
    colorRgb: obsidianVoid,
  });

  const crownCrest = trackGeo(out, createCurvedBladePart(0.46, 0.095, 0.026, 0.0, 0.082, 10));
  out.trim.push({
    geo: crownCrest,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.47, -0.03, -0.58, 0, 0)),
    colorRgb: bloodChrome,
  });

  const visorSlit = trackGeo(out, createCurvedVisorPart(0.118, 0.034, 0.118, 1.56, 1.18, 0.30, 16, 6));
  out.energy.push({
    geo: visorSlit,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.42, 0.115, 0.24, 0, 0)),
    colorRgb: scarletEnergy,
  });

  const prowNeedle = trackGeo(
    out,
    createFacetedCrystalPart(0.28, 0.036, 4, 0.76, 0.24, obsidianVoid, bloodChrome),
  );
  out.trim.push({
    geo: prowNeedle,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.33, 0.19, 1.24, 0, 0)),
  });

  const lowerKeel = trackGeo(
    out,
    createTeardropPart(0.50, 0.110, 2.05, 18, 14, -0.030, emberObsidian, obsidianVoid),
  );
  out.armor.push({
    geo: lowerKeel,
    matrix: bodyFrame.clone().multiply(makeTransform(0, -0.44, -0.04, Math.PI + 0.24, 0, 0, 0.84, 1.0, 1.12)),
  });

  const lowerKeelFin = trackGeo(out, createCurvedBladePart(0.34, 0.068, 0.020, 0.0, -0.046, 8));
  out.trim.push({
    geo: lowerKeelFin,
    matrix: bodyFrame.clone().multiply(makeTransform(0, -0.27, -0.10, Math.PI + 0.20, 0, 0)),
    colorRgb: liquidCrimson,
  });

  for (const side of [-1, 1] as const) {
    const ribArch = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [side * 0.09, 0.35, -0.02],
          [side * 0.22, 0.18, -0.10],
          [side * 0.24, -0.02, -0.12],
          [side * 0.18, -0.21, -0.09],
          [side * 0.08, -0.35, -0.04],
        ],
        [0.050, 0.074, 0.038],
        0.006,
        1.0,
        22,
        5,
        0.018,
        darkObsidianViolet,
        emberObsidian,
      ),
    );
    out.armor.push({ geo: ribArch, matrix: bodyFrame.clone() });

    const innerConduit = trackGeo(
      out,
      createTaperedTubePart(
        [
          [side * 0.07, 0.31, -0.01],
          [side * 0.17, 0.14, -0.07],
          [side * 0.19, -0.02, -0.08],
          [side * 0.14, -0.19, -0.06],
          [side * 0.06, -0.32, -0.02],
        ],
        0.018,
        0.012,
        14,
        7,
      ),
    );
    out.matte.push({
      geo: innerConduit,
      matrix: bodyFrame.clone(),
      colorRgb: obsidianVoid,
    });
  }

  const innerHeartCore = trackGeo(
    out,
    createFacetedCrystalPart(0.28, 0.074, 6, 0.56, 0.44, scarletEnergy, incandescentHeart),
  );
  out.energy.push({
    geo: innerHeartCore,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.01, 0.02, 0.10, 0.35, -0.12)),
  });

  const outerCrystalHeart = trackGeo(
    out,
    createFacetedCrystalPart(0.45, 0.132, 6, 0.58, 0.42, liquidCrimson, scarletEnergy),
  );
  out.crystal.push({
    geo: outerCrystalHeart,
    matrix: bodyFrame.clone().multiply(makeTransform(0, 0.01, 0.02, 0.10, 0.88, -0.12)),
  });

  const innerFoldRing = trackGeo(out, createChamferedHexPart(0.30, 0.020, 0.007, 0.252));
  const innerEnergyArc = trackGeo(out, new THREE.TorusGeometry(0.240, 0.006, 6, 24));
  const innerRingMat = bodyFrame.clone().multiply(makeTransform(0, 0.01, 0.02, 0.62, 0.48, -0.42));
  out.trim.push({ geo: innerFoldRing, matrix: innerRingMat, colorRgb: bloodChrome });
  out.energy.push({ geo: innerEnergyArc, matrix: innerRingMat, colorRgb: scarletEnergy });

  const outerFoldRing = trackGeo(out, createChamferedHexPart(0.37, 0.018, 0.006, 0.324));
  const outerEnergyArc = trackGeo(out, new THREE.TorusGeometry(0.312, 0.006, 6, 24));
  const outerRingMat = bodyFrame.clone().multiply(makeTransform(0, 0.01, 0.02, -0.68, -0.44, 0.54));
  out.trim.push({ geo: outerFoldRing, matrix: outerRingMat, colorRgb: liquidCrimson });
  out.energy.push({ geo: outerEnergyArc, matrix: outerRingMat, colorRgb: scarletEnergy });

  const lockNode = trackGeo(out, createFacetedCrystalPart(0.11, 0.036, 4, 0.5, 0.5));
  for (const sign of [-1, 1] as const) {
    out.matte.push({
      geo: lockNode,
      matrix: outerRingMat.clone().multiply(makeTransform(sign * 0.348, 0, 0, 0, 0, sign * 0.35)),
      colorRgb: obsidianVoid,
    });
  }

  const scytheArmorGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.036, 0.0],
        [0.036, 0.06],
        [0.125, 0.21],
        [0.088, 0.32],
        [0.185, 0.50],
        [0.258, 0.70],
        [0.310, 0.90],
        [0.155, 0.74],
        [0.044, 0.52],
        [-0.038, 0.31],
        [-0.076, 0.14],
      ],
      0.016,
      0.006,
      0.006,
      2,
    ),
  );
  const scytheRidgeGeo = trackGeo(out, createCurvedBladePart(0.84, 0.042, 0.042, 0.335, 0.016, 10));
  const scytheEdgeGeo = trackGeo(out, createCurvedBladePart(0.86, 0.032, 0.016, 0.228, 0.014, 10));
  const scytheVeilGeo = trackGeo(out, createCurvedBladePart(0.94, 0.128, 0.009, 0.340, -0.026, 10));
  const star3HaloScytheGeo = trackGeo(out, createCurvedBladePart(0.98, 0.104, 0.018, 0.340, 0.022, 9));

  const wingConfigs: readonly {
    readonly side: -1 | 1;
    readonly root: Vec3Tuple;
    readonly anchor: Vec3Tuple;
    readonly midOffset: Vec3Tuple;
    readonly rx: number;
    readonly ry: number;
    readonly rz: number;
    readonly scale: number;
    readonly hasVeil: boolean;
    readonly darkTone: RgbTriple;
    readonly ridgeTone: RgbTriple;
  }[] = [
    {
      side: 1,
      root: [0.24, 1.32, -0.08],
      anchor: [0.13, 1.24, -0.04],
      midOffset: [0.02, 0.07, -0.06],
      rx: 0.12,
      ry: -0.06,
      rz: -0.52,
      scale: 0.79,
      hasVeil: true,
      darkTone: darkObsidianViolet,
      ridgeTone: bloodChrome,
    },
    {
      side: -1,
      root: [-0.26, 1.24, -0.16],
      anchor: [-0.14, 1.19, -0.06],
      midOffset: [-0.03, 0.06, -0.07],
      rx: -0.14,
      ry: -0.34,
      rz: 0.68,
      scale: 0.75,
      hasVeil: true,
      darkTone: obsidianVoid,
      ridgeTone: liquidCrimson,
    },
    {
      side: -1,
      root: [-0.30, 1.04, 0.05],
      anchor: [-0.16, 1.05, -0.02],
      midOffset: [-0.04, 0.05, 0.07],
      rx: 0.22,
      ry: 0.48,
      rz: 1.16,
      scale: 0.84,
      hasVeil: true,
      darkTone: emberObsidian,
      ridgeTone: bloodChrome,
    },
    {
      side: 1,
      root: [0.31, 0.94, 0.02],
      anchor: [0.16, 0.99, -0.02],
      midOffset: [0.04, -0.05, 0.06],
      rx: 0.14,
      ry: -0.44,
      rz: -1.32,
      scale: 0.81,
      hasVeil: true,
      darkTone: darkObsidianViolet,
      ridgeTone: bloodChrome,
    },
    {
      side: -1,
      root: [-0.23, 0.78, -0.18],
      anchor: [-0.12, 0.86, -0.07],
      midOffset: [-0.03, -0.05, -0.07],
      rx: -0.28,
      ry: -0.48,
      rz: 1.84,
      scale: 0.62,
      hasVeil: false,
      darkTone: obsidianVoid,
      ridgeTone: liquidCrimson,
    },
    {
      side: 1,
      root: [0.24, 0.72, -0.20],
      anchor: [0.12, 0.82, -0.07],
      midOffset: [0.03, -0.06, -0.07],
      rx: -0.22,
      ry: 0.52,
      rz: -1.94,
      scale: 0.58,
      hasVeil: false,
      darkTone: emberObsidian,
      ridgeTone: liquidCrimson,
    },
  ];

  for (const w of wingConfigs) {
    const wMat = makeTransform(
      w.root[0],
      w.root[1],
      w.root[2],
      w.rx,
      w.ry,
      w.rz,
      -w.side * w.scale,
      w.scale,
      w.scale,
    );
    out.armor.push({ geo: scytheArmorGeo, matrix: wMat, colorRgb: w.darkTone });
    out.trim.push({
      geo: scytheRidgeGeo,
      matrix: wMat.clone().multiply(makeTransform(-0.056, 0.02, 0)),
      colorRgb: w.ridgeTone,
    });
    out.energy.push({
      geo: scytheEdgeGeo,
      matrix: wMat.clone().multiply(makeTransform(0.095, 0.02, 0)),
      colorRgb: scarletEnergy,
    });
    if (w.hasVeil) {
      out.crystal.push({
        geo: scytheVeilGeo,
        matrix: wMat.clone().multiply(makeTransform(-0.028, 0.01, -0.036)),
        colorRgb: scarletEnergy,
      });
    }

    const midPt: Vec3Tuple = [
      (w.anchor[0] + w.root[0]) * 0.5 + w.midOffset[0],
      (w.anchor[1] + w.root[1]) * 0.5 + w.midOffset[1],
      (w.anchor[2] + w.root[2]) * 0.5 + w.midOffset[2],
    ];
    const tetherRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(
        [w.anchor, midPt, w.root],
        [0.034, 0.056, 0.024],
        0.012,
        1.5,
        16,
        4,
        0.008,
        obsidianVoid,
        w.ridgeTone,
      ),
    );
    out.trim.push({ geo: tetherRibbon, matrix: makeTransform(0, 0, 0) });

    out.wingParts.push({
      geo: star3HaloScytheGeo,
      matrix: wMat.clone().multiply(makeTransform(-0.04, 0.06, -0.038, 0, 0, 0, 1.08, 1.08, 1.0)),
      colorRgb: bloodChrome,
    });
  }

  const hoverHexFrame = trackGeo(out, createChamferedHexPart(0.31, 0.022, 0.008, 0.242));
  out.matte.push({
    geo: hoverHexFrame,
    matrix: makeTransform(0, 0.23, -0.02, Math.PI * 0.5 - 0.12, 0.12, 0),
    colorRgb: obsidianVoid,
  });

  const hoverEnergyRing = trackGeo(out, new THREE.TorusGeometry(0.222, 0.009, 8, 28));
  out.energy.push({
    geo: hoverEnergyRing,
    matrix: makeTransform(0, 0.248, -0.02, Math.PI * 0.5 - 0.12, 0.12, 0),
    colorRgb: scarletEnergy,
  });

  const shieldPrismGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.145],
        [-0.088, 0.034],
        [-0.058, -0.072],
        [0.0, -0.138],
        [0.058, -0.072],
        [0.088, 0.034],
      ],
      0.012,
      0.005,
      0.005,
      1,
    ),
  );
  const shieldBracketGeo = trackGeo(out, createCurvedBladePart(0.25, 0.032, 0.016, 0.0, 0.024, 7));
  const shieldSpecs: readonly [number, number, number, number][] = [
    [0.58, 0.40, 0.42, 0.26],
    [-0.72, 0.42, 0.36, 0.28],
    [Math.PI + 0.16, 0.36, 0.46, 0.22],
  ];
  for (const [ang, radius, sy, tilt] of shieldSpecs) {
    const sx = Math.sin(ang) * radius;
    const sz = Math.cos(ang) * radius;
    const sMat = makeTransform(sx, sy, sz, tilt, ang, 0);
    out.crystal.push({
      geo: shieldPrismGeo,
      matrix: sMat,
      colorRgb: scarletEnergy,
    });
    out.trim.push({
      geo: shieldBracketGeo,
      matrix: sMat.clone().multiply(makeTransform(0, -0.12, 0.016)),
      colorRgb: bloodChrome,
    });
  }

  const zigzagFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.0],
        [-0.034, -0.090],
        [-0.004, -0.135],
        [-0.048, -0.245],
        [-0.012, -0.340],
        [0.022, -0.215],
        [-0.006, -0.165],
        [0.036, -0.075],
      ],
      0.012,
      0.004,
      0.004,
      1,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: zigzagFinGeo,
      matrix: makeTransform(side * 0.052, 0.56, -0.06, -0.34, side * 0.38, side * 0.16, side, 1, 1),
      colorRgb: scarletEnergy,
    });

    const wakeRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [side * 0.08, 0.54, -0.08],
          [side * 0.20, 0.39, -0.17],
          [side * 0.15, 0.26, -0.28],
          [side * 0.04, 0.18, -0.36],
        ],
        [0.032, 0.048, 0.009],
        0.012,
        1.8,
        18,
        4,
        0.006,
        scarletEnergy,
        liquidCrimson,
      ),
    );
    out.crystal.push({ geo: wakeRibbon, matrix: makeTransform(0, 0, 0) });
  }

  out.weaponGlowHex = 0xe11d48;
  out.crystalHex = 0xbe123c;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.62;
  out.headTopLocalY = 2.10;
}

function buildS34AzureDragon(out: UnitBlueprintParts): void {
  const jadePrimary: RgbTriple = [0.18, 0.62, 0.50];
  const jadeBright: RgbTriple = [0.34, 0.78, 0.64];
  const deepPine: RgbTriple = [0.09, 0.28, 0.26];
  const antiqueBronze: RgbTriple = [0.74, 0.56, 0.34];
  const agedBronze: RgbTriple = [0.52, 0.38, 0.21];
  const warpEmerald: RgbTriple = [0.36, 0.92, 0.72];
  const pearlJade: RgbTriple = [0.76, 0.98, 0.90];

  const gateCenter = new THREE.Vector3(-0.04, 0.96, -0.10);
  const gateFrame = makeTransform(gateCenter.x, gateCenter.y, gateCenter.z, -0.10, 0.24, 0.05);

  const gateOuter = trackGeo(out, new THREE.TorusGeometry(0.54, 0.044, 12, 36));
  const gateInnerTrack = trackGeo(out, new THREE.TorusGeometry(0.47, 0.022, 8, 32));
  const gateRunes = trackGeo(out, new THREE.TorusGeometry(0.44, 0.009, 6, 32));
  out.trim.push({ geo: gateOuter, matrix: gateFrame, colorRgb: antiqueBronze });
  out.matte.push({ geo: gateInnerTrack, matrix: gateFrame, colorRgb: deepPine });
  out.energy.push({ geo: gateRunes, matrix: gateFrame, colorRgb: warpEmerald });

  const portalDisc = trackGeo(out, new THREE.CylinderGeometry(0.45, 0.45, 0.012, 28));
  out.crystal.push({
    geo: portalDisc,
    matrix: gateFrame.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
    colorRgb: warpEmerald,
  });

  const chevronClamp = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.056, -0.036],
        [0.056, -0.036],
        [0.040, 0.048],
        [-0.040, 0.048],
      ],
      0.095,
      0.008,
      0.008,
      1,
    ),
  );
  const chevronGem = trackGeo(out, createFacetedCrystalPart(0.068, 0.022, 4, 0.55, 0.45, warpEmerald, pearlJade));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const cMat = gateFrame
      .clone()
      .multiply(makeTransform(Math.cos(a) * 0.54, Math.sin(a) * 0.54, 0, 0, 0, a - Math.PI * 0.5));
    out.trim.push({ geo: chevronClamp, matrix: cMat, colorRgb: agedBronze });
    out.energy.push({
      geo: chevronGem,
      matrix: cMat.clone().multiply(makeTransform(0, -0.01, 0.052, Math.PI * 0.5, 0, 0)),
    });
  }

  const cradleBase = trackGeo(out, createChamferedHexPart(0.38, 0.056, 0.014, 0.16));
  out.armor.push({
    geo: cradleBase,
    matrix: makeTransform(-0.04, 0.10, -0.10, Math.PI * 0.5, 0, 0.24),
    colorRgb: deepPine,
  });
  for (const side of [-1, 1] as const) {
    const strut = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.28, 0.12, -0.10],
          [side * 0.42, 0.34, -0.12],
          [side * 0.46, 0.62, -0.10],
        ],
        0.034,
        0.028,
        0.022,
        10,
        8,
        agedBronze,
        antiqueBronze,
      ),
    );
    out.trim.push({ geo: strut, matrix: makeTransform(-0.04, 0, 0) });
  }

  const dragonCtrlPts: readonly Vec3Tuple[] = [
    [-0.44, 0.42, -0.58],
    [-0.36, 0.66, -0.44],
    [-0.18, 0.94, -0.22],
    [0.14, 1.12, 0.02],
    [0.40, 0.96, 0.14],
    [0.44, 1.24, 0.02],
    [0.24, 1.54, 0.16],
    [0.06, 1.56, 0.36],
  ];
  const spineCore = trackGeo(
    out,
    createOrganicLimb(dragonCtrlPts, 0.032, 0.072, 0.068, 34, 12, deepPine, jadePrimary),
  );
  out.matte.push({ geo: spineCore, matrix: makeTransform(0, 0, 0) });

  const dragonCurve = new THREE.CatmullRomCurve3(
    dragonCtrlPts.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  );

  const scaleCollar = trackGeo(
    out,
    createLathePart(
      [
        [0.068, -0.055],
        [0.092, -0.015],
        [0.098, 0.025],
        [0.076, 0.055],
      ],
      10,
    ),
  );
  const dorsalBlade = trackGeo(out, createCurvedBladePart(0.16, 0.046, 0.016, 0.048, 0.012, 6));
  const segCount = 11;
  for (let i = 1; i <= segCount; i += 1) {
    const t = i / (segCount + 1);
    const pos = dragonCurve.getPointAt(t);
    const tan = dragonCurve.getTangentAt(t);
    const basis = makeLookAtBasis(pos, tan);
    const radiusScale = 0.56 + Math.sin(t * Math.PI * 0.85 + 0.18) * 0.58;
    out.armor.push({
      geo: scaleCollar,
      matrix: basis
        .clone()
        .multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0, radiusScale, 1.0, radiusScale * 0.88)),
      colorRgb: i % 2 === 0 ? jadeBright : jadePrimary,
    });
    out.trim.push({
      geo: dorsalBlade,
      matrix: basis
        .clone()
        .multiply(makeTransform(0, 0.078 * radiusScale, -0.02, -0.56, Math.PI * 0.5, 0, radiusScale, radiusScale, 1.0)),
      colorRgb: i % 3 === 0 ? warpEmerald : antiqueBronze,
    });
  }

  const clawFin = trackGeo(out, createCreatureFin(0.16, 0.24, 0.18, 0.026, 0.016, 10, 6, jadeBright, warpEmerald));
  const clawAnchors: readonly [number, number][] = [
    [0.36, 1],
    [0.36, -1],
    [0.74, 1],
    [0.74, -1],
  ];
  for (const [t, side] of clawAnchors) {
    const pos = dragonCurve.getPointAt(t);
    const tan = dragonCurve.getTangentAt(t);
    const basis = makeLookAtBasis(pos, tan);
    out.crystal.push({
      geo: clawFin,
      matrix: basis.clone().multiply(makeTransform(side * 0.06, -0.02, 0, 0.12, side * 0.28, -side * 0.34, side, 1, 1)),
    });
  }

  const tailTipPos = dragonCurve.getPointAt(0);
  const tailTipTan = dragonCurve.getTangentAt(0).negate();
  const tailBasis = makeLookAtBasis(tailTipPos, tailTipTan);
  const tailPlume = trackGeo(out, createCreatureFin(0.18, 0.32, 0.22, 0.032, 0.014, 12, 6, warpEmerald, pearlJade));
  for (const side of [-1, 1] as const) {
    out.crystal.push({
      geo: tailPlume,
      matrix: tailBasis.clone().multiply(makeTransform(0, 0, 0, 0.18, side * 0.36, side * 0.22, side, 1, 1)),
    });
  }

  const headOrigin = new THREE.Vector3(0.04, 1.56, 0.42);
  const headFrame = makeTransform(headOrigin.x, headOrigin.y, headOrigin.z, 0.14, 0.04, 0);

  const upperSkull = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0, 0.12],
        [0.105, 0.05],
        [0.088, -0.08],
        [0, -0.14],
        [-0.088, -0.08],
        [-0.105, 0.05],
      ],
      0.28,
      0.016,
      0.016,
      2,
    ),
  );
  out.armor.push({
    geo: upperSkull,
    matrix: headFrame.clone().multiply(makeTransform(0, 0.045, 0.08, 0, 0, 0)),
    colorRgb: jadePrimary,
  });

  const snoutCrest = trackGeo(
    out,
    createTeardropPart(0.30, 0.072, 1.45, 14, 10, 0.014, jadeBright, antiqueBronze),
  );
  out.armor.push({
    geo: snoutCrest,
    matrix: headFrame.clone().multiply(makeTransform(0, 0.076, 0.19, Math.PI * 0.5, 0, 0, 1.0, 1.0, 0.68)),
  });

  const lowerJaw = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.074, 0],
        [0.074, 0],
        [0.052, 0.20],
        [-0.052, 0.20],
      ],
      0.044,
      0.010,
      0.010,
      1,
    ),
  );
  out.armor.push({
    geo: lowerJaw,
    matrix: headFrame.clone().multiply(makeTransform(0, -0.072, 0.16, Math.PI * 0.5 + 0.34, 0, 0)),
    colorRgb: deepPine,
  });

  const mawCore = trackGeo(out, new THREE.SphereGeometry(0.056, 12, 10));
  const mawRing = trackGeo(out, new THREE.TorusGeometry(0.082, 0.010, 6, 18));
  out.energy.push(
    { geo: mawCore, matrix: headFrame.clone().multiply(makeTransform(0, -0.008, 0.24)), colorRgb: pearlJade },
    { geo: mawRing, matrix: headFrame.clone().multiply(makeTransform(0, -0.008, 0.30)), colorRgb: warpEmerald },
  );

  const mawRail = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.015, 0.24, 8));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: mawRail,
      matrix: headFrame.clone().multiply(makeTransform(side * 0.058, 0.014, 0.22, Math.PI * 0.5, 0, 0)),
      colorRgb: antiqueBronze,
    });
  }

  const eyeOrb = trackGeo(out, new THREE.SphereGeometry(0.024, 10, 8));
  const browHorn = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.08, 0.04],
        [0.08, 0.22, -0.10],
        [0.14, 0.36, -0.28],
      ],
      0.022,
      0.015,
      0.006,
      12,
      8,
      antiqueBronze,
      jadeBright,
    ),
  );
  const hornTine = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.08, 0.20, -0.08],
        [0.16, 0.28, -0.08],
      ],
      0.012,
      0.009,
      0.004,
      8,
      6,
      antiqueBronze,
      antiqueBronze,
    ),
  );

  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: eyeOrb,
      matrix: headFrame.clone().multiply(makeTransform(side * 0.086, 0.052, 0.14)),
      colorRgb: pearlJade,
    });
    out.trim.push(
      { geo: browHorn, matrix: headFrame.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)) },
      { geo: hornTine, matrix: headFrame.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)) },
    );

    const whisker = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [side * 0.08, 0.01, 0.24],
          [side * 0.26, 0.06, 0.18],
          [side * 0.44, -0.04, -0.02],
          [side * 0.52, -0.18, -0.26],
        ],
        [0.016, 0.022, 0.005],
        0.018,
        2.2,
        22,
        4,
        0.006,
        pearlJade,
        warpEmerald,
      ),
    );
    out.energy.push({ geo: whisker, matrix: headFrame });
  }

  const starGateHalo = trackGeo(out, new THREE.TorusGeometry(0.76, 0.018, 8, 36));
  out.wingParts.push({
    geo: starGateHalo,
    matrix: gateFrame.clone().multiply(makeTransform(0, 0.04, -0.08)),
    colorRgb: antiqueBronze,
  });

  out.weaponGlowHex = 0x34d399;
  out.crystalHex = 0x5eead4;
  out.crystalOpacity = 0.44;
  out.crystalIntensity = 0.68;
  out.headTopLocalY = 2.08;
}

function buildS35Cassini(out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.15, 0.23, 0.38];
  const navySteel: RgbTriple = [0.24, 0.34, 0.50];
  const heavyIron: RgbTriple = [0.16, 0.18, 0.24];
  const warmBronze: RgbTriple = [0.80, 0.62, 0.34];
  const darkBronze: RgbTriple = [0.56, 0.40, 0.20];
  const brassGold: RgbTriple = [0.90, 0.74, 0.42];
  const navAmber: RgbTriple = [0.98, 0.78, 0.36];
  const chronoCyan: RgbTriple = [0.46, 0.84, 0.98];

  const underHull = trackGeo(
    out,
    createLathePart(
      [
        [0.34, 0.0],
        [0.54, 0.08],
        [0.56, 0.22],
        [0.48, 0.32],
        [0.10, 0.34],
      ],
      10,
    ),
  );
  out.matte.push({
    geo: underHull,
    matrix: makeTransform(0, 0.36, -0.02, 0, Math.PI * 0.1, 0, 1.0, 1.0, 1.14),
    colorRgb: heavyIron,
  });

  const bumperRail = trackGeo(out, new THREE.TorusGeometry(0.56, 0.026, 8, 28));
  out.trim.push({
    geo: bumperRail,
    matrix: makeTransform(0, 0.56, -0.02, Math.PI * 0.5, 0, 0, 1.02, 1.15, 1.0),
    colorRgb: darkBronze,
  });

  const shoulderDrum = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.11, 0.14, 12));
  const kneeHex = trackGeo(out, createHexMirrorTilePart(0.115, 0.036, 0.012, 0.010, navySteel, starIndigo));
  const footBell = trackGeo(
    out,
    createLathePart(
      [
        [0.135, 0.0],
        [0.125, 0.05],
        [0.088, 0.12],
        [0.068, 0.18],
      ],
      8,
    ),
  );
  const legCorners: readonly [number, number][] = [
    [-1, 1],
    [1, 1],
    [-1, -1],
    [1, -1],
  ];
  for (const [sx, sz] of legCorners) {
    const hip = new THREE.Vector3(sx * 0.38, 0.48, sz * 0.34);
    const knee = new THREE.Vector3(sx * 0.54, 0.38, sz * 0.44);
    const foot = new THREE.Vector3(sx * 0.58, 0.06, sz * 0.48);

    out.trim.push({
      geo: shoulderDrum,
      matrix: makeTransform(hip.x, hip.y, hip.z, 0, 0, Math.PI * 0.5),
      colorRgb: darkBronze,
    });
    const upperLeg = trackGeo(
      out,
      createOrganicLimb(
        [
          [hip.x, hip.y, hip.z],
          [knee.x, knee.y + 0.04, knee.z],
        ],
        0.072,
        0.068,
        0.062,
        8,
        8,
        heavyIron,
        starIndigo,
      ),
    );
    const lowerLeg = trackGeo(
      out,
      createOrganicLimb(
        [
          [knee.x, knee.y, knee.z],
          [foot.x, foot.y + 0.10, foot.z],
        ],
        0.066,
        0.060,
        0.056,
        8,
        8,
        starIndigo,
        heavyIron,
      ),
    );
    const pistonRod = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 1.0, 8));
    out.matte.push({ geo: upperLeg, matrix: makeTransform(0, 0, 0) });
    out.armor.push({ geo: lowerLeg, matrix: makeTransform(0, 0, 0) });
    out.trim.push({
      geo: pistonRod,
      matrix: makeSegmentTransform(
        new THREE.Vector3(hip.x, hip.y - 0.04, hip.z),
        new THREE.Vector3(foot.x * 0.92, foot.y + 0.16, foot.z * 0.92),
        1,
        1,
      ),
      colorRgb: warmBronze,
    });
    out.armor.push({
      geo: kneeHex,
      matrix: makeTransform(
        knee.x + sx * 0.05,
        knee.y + 0.02,
        knee.z + sz * 0.05,
        0,
        Math.atan2(sx, sz),
        0,
      ),
    });
    out.matte.push({
      geo: footBell,
      matrix: makeTransform(foot.x, foot.y, foot.z),
      colorRgb: heavyIron,
    });
  }

  const carapaceDome = trackGeo(
    out,
    createLathePart(
      [
        [0.56, 0.0],
        [0.54, 0.12],
        [0.48, 0.24],
        [0.38, 0.36],
        [0.26, 0.42],
        [0.10, 0.44],
      ],
      12,
    ),
  );
  out.armor.push({
    geo: carapaceDome,
    matrix: makeTransform(0, 0.56, -0.02, 0, 0, 0, 1.02, 1.0, 1.14),
    colorRgb: starIndigo,
  });

  const scutePlate = trackGeo(out, createHexMirrorTilePart(0.18, 0.036, 0.014, 0.014, navySteel, starIndigo));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.armor.push({
      geo: scutePlate,
      matrix: makeTransform(
        Math.sin(a) * 0.42,
        0.74,
        Math.cos(a) * 0.46 - 0.02,
        -Math.PI * 0.24,
        a,
        0,
      ),
    });
  }

  const exhaustVent = trackGeo(
    out,
    createLathePart(
      [
        [0.068, 0],
        [0.060, 0.08],
        [0.076, 0.16],
      ],
      10,
    ),
  );
  const exhaustGlow = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.044, 0.024, 10));
  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: exhaustVent,
      matrix: makeTransform(side * 0.22, 0.64, -0.58, -Math.PI * 0.5 + 0.16, 0, 0),
      colorRgb: heavyIron,
    });
    out.energy.push({
      geo: exhaustGlow,
      matrix: makeTransform(side * 0.22, 0.62, -0.70, Math.PI * 0.5, 0, 0),
      colorRgb: navAmber,
    });
  }

  const prowHood = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.08],
        [0.22, -0.08],
        [0.16, 0.16],
        [-0.16, 0.16],
      ],
      0.28,
      0.018,
      0.018,
      2,
    ),
  );
  out.armor.push({
    geo: prowHood,
    matrix: makeTransform(0, 0.64, 0.58, 0.10, 0, 0),
    colorRgb: navySteel,
  });
  const prowJaw = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.18, 0],
        [0.18, 0],
        [0.12, 0.12],
        [-0.12, 0.12],
      ],
      0.16,
      0.012,
      0.012,
      1,
    ),
  );
  out.trim.push({
    geo: prowJaw,
    matrix: makeTransform(0, 0.48, 0.64, Math.PI * 0.5, 0, 0),
    colorRgb: warmBronze,
  });
  const bridgeVisor = trackGeo(out, createCurvedVisorPart(0.148, 0.062, 0.095, 1.55, 1.0, 0.56));
  out.energy.push({
    geo: bridgeVisor,
    matrix: makeTransform(0, 0.66, 0.69),
    colorRgb: navAmber,
  });

  const mantletHousing = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.25, 0],
        [0.25, 0],
        [0.20, 0.20],
        [-0.20, 0.20],
      ],
      0.34,
      0.018,
      0.018,
      2,
    ),
  );
  out.armor.push({
    geo: mantletHousing,
    matrix: makeTransform(0, 0.94, 0.22, -0.10, 0, 0),
    colorRgb: starIndigo,
  });
  const turretGear = trackGeo(out, new THREE.CylinderGeometry(0.105, 0.105, 0.044, 12));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: turretGear,
      matrix: makeTransform(side * 0.255, 1.02, 0.22, 0, 0, Math.PI * 0.5),
      colorRgb: warmBronze,
    });
  }

  const siegeBarrel = trackGeo(
    out,
    createLathePart(
      [
        [0.048, -0.16],
        [0.052, -0.02],
        [0.040, 0.02],
        [0.040, 0.34],
        [0.052, 0.38],
        [0.052, 0.46],
        [0.036, 0.49],
      ],
      12,
    ),
  );
  const muzzleCollar = trackGeo(out, new THREE.TorusGeometry(0.052, 0.010, 6, 12));
  const breechGlow = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.18, 8));
  for (const bx of [-0.14, 0, 0.14]) {
    const by = bx === 0 ? 1.09 : 1.04;
    out.matte.push({
      geo: siegeBarrel,
      matrix: makeTransform(bx, by, 0.42, Math.PI * 0.5 - 0.14, 0, 0),
      colorRgb: heavyIron,
    });
    out.trim.push({
      geo: muzzleCollar,
      matrix: makeTransform(bx, by + 0.06, 0.84, -0.14, 0, 0),
      colorRgb: warmBronze,
    });
    out.energy.push({
      geo: breechGlow,
      matrix: makeTransform(bx, by + 0.042, 0.40, Math.PI * 0.5 - 0.14, 0, 0),
      colorRgb: navAmber,
    });
  }

  const armCenterY = 1.54;
  const armCenterZ = -0.16;
  const armPedestal = trackGeo(
    out,
    createLathePart(
      [
        [0.24, 0.0],
        [0.20, 0.08],
        [0.13, 0.18],
        [0.16, 0.24],
        [0.10, 0.30],
      ],
      14,
    ),
  );
  out.trim.push({
    geo: armPedestal,
    matrix: makeTransform(0, 0.94, armCenterZ),
    colorRgb: darkBronze,
  });

  const ringOuter = trackGeo(out, new THREE.TorusGeometry(0.39, 0.022, 8, 36));
  const ringMid = trackGeo(out, new THREE.TorusGeometry(0.32, 0.018, 8, 32));
  const ringInner = trackGeo(out, new THREE.TorusGeometry(0.24, 0.014, 8, 28));
  out.trim.push(
    { geo: ringOuter, matrix: makeTransform(0, armCenterY, armCenterZ, 0.28, 0.34, 0.12), colorRgb: warmBronze },
    { geo: ringOuter, matrix: makeTransform(0, armCenterY, armCenterZ, 0.28, -1.24, -0.18), colorRgb: brassGold },
    { geo: ringMid, matrix: makeTransform(0, armCenterY, armCenterZ, Math.PI * 0.46, 0.14, 0.38), colorRgb: warmBronze },
    { geo: ringInner, matrix: makeTransform(0, armCenterY, armCenterZ, -0.64, 0.56, -0.26), colorRgb: brassGold },
  );

  const axisNeedle = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.020, 0.92, 8));
  out.trim.push({
    geo: axisNeedle,
    matrix: makeTransform(0, armCenterY + 0.02, armCenterZ, 0.22, 0, -0.24),
    colorRgb: brassGold,
  });

  const radarCore = trackGeo(out, new THREE.OctahedronGeometry(0.115, 0));
  out.energy.push({
    geo: radarCore,
    matrix: makeTransform(0, armCenterY, armCenterZ, 0.24, 0.42, 0),
    colorRgb: navAmber,
  });
  const radarLens = trackGeo(out, new THREE.SphereGeometry(0.175, 16, 12));
  out.crystal.push({
    geo: radarLens,
    matrix: makeTransform(0, armCenterY, armCenterZ),
    colorRgb: chronoCyan,
  });

  const starArmillary = trackGeo(out, new THREE.TorusGeometry(0.68, 0.022, 8, 36));
  out.wingParts.push(
    { geo: starArmillary, matrix: makeTransform(0, armCenterY - 0.10, armCenterZ - 0.08, 0.22, 0.18, 0.26), colorRgb: brassGold },
    { geo: starArmillary, matrix: makeTransform(0, armCenterY - 0.10, armCenterZ - 0.08, -0.22, -0.18, -0.26), colorRgb: warmBronze },
  );

  out.weaponGlowHex = 0xf5b942;
  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.42;
  out.crystalIntensity = 0.58;
  out.headTopLocalY = 2.10;
}

function buildS36AbyssCrown(out: UnitBlueprintParts): void {
  const voidBlack: RgbTriple = [0.012, 0.010, 0.018];
  const abyssObsidian: RgbTriple = [0.14, 0.06, 0.09];
  const tearCrimson: RgbTriple = [0.46, 0.10, 0.16];
  const bloodSteel: RgbTriple = [0.66, 0.14, 0.22];
  const accretionRed: RgbTriple = [0.88, 0.18, 0.26];
  const moltenScarlet: RgbTriple = [0.98, 0.42, 0.36];
  const eclipseWhiteGold: RgbTriple = [1.0, 0.80, 0.68];

  const centerY = 1.08;

  const sinkBase = trackGeo(
    out,
    createLathePart(
      [
        [0.42, 0.0],
        [0.34, 0.04],
        [0.20, 0.09],
        [0.10, 0.16],
      ],
      20,
    ),
  );
  out.matte.push({
    geo: sinkBase,
    matrix: makeTransform(0, 0.09, 0),
    colorRgb: voidBlack,
  });
  const sinkRing = trackGeo(out, new THREE.TorusGeometry(0.36, 0.010, 6, 30));
  out.energy.push({
    geo: sinkRing,
    matrix: makeTransform(0, 0.13, 0, Math.PI * 0.5, 0, 0),
    colorRgb: accretionRed,
  });

  const eventHorizon = trackGeo(out, new THREE.SphereGeometry(0.245, 24, 18));
  out.matte.push({
    geo: eventHorizon,
    matrix: makeTransform(0, centerY, 0),
    colorRgb: voidBlack,
  });

  const photonRimMain = trackGeo(out, new THREE.TorusGeometry(0.262, 0.012, 8, 36));
  const photonRimCross = trackGeo(out, new THREE.TorusGeometry(0.282, 0.008, 6, 34));
  out.energy.push(
    { geo: photonRimMain, matrix: makeTransform(0, centerY, 0, 0.16, 0.06, 0), colorRgb: eclipseWhiteGold },
    { geo: photonRimCross, matrix: makeTransform(0, centerY, 0, 1.18, 0.44, -0.32), colorRgb: moltenScarlet },
  );

  const shearJet = trackGeo(out, createTeardropPart(0.46, 0.028, 2.6, 12, 10, 0, tearCrimson, moltenScarlet));
  out.energy.push(
    { geo: shearJet, matrix: makeTransform(0, centerY + 0.36, 0, 0.16, 0, -0.18) },
    { geo: shearJet, matrix: makeTransform(0, centerY - 0.36, 0, Math.PI + 0.16, 0, -0.18) },
  );

  const diskTilt = makeTransform(0, centerY, 0, 0.34, 0.12, -0.22);

  const innerAccretion = buildWarpedAccretionRing(
    out,
    0.37,
    [0.095, 0.135, 0.095],
    0.042,
    2,
    0.4,
    0.026,
    3,
    40,
    5,
    0.008,
    eclipseWhiteGold,
    moltenScarlet,
  );
  const midAccretion = buildWarpedAccretionRing(
    out,
    0.52,
    [0.115, 0.165, 0.110],
    0.072,
    3,
    1.1,
    0.044,
    2,
    42,
    5,
    0.008,
    accretionRed,
    tearCrimson,
  );
  const outerAccretion = buildWarpedAccretionRing(
    out,
    0.66,
    [0.075, 0.110, 0.068],
    0.095,
    2,
    2.2,
    0.058,
    3,
    40,
    4,
    0.007,
    tearCrimson,
    abyssObsidian,
  );

  out.energy.push({ geo: innerAccretion, matrix: diskTilt });
  out.crystal.push({ geo: midAccretion, matrix: diskTilt });
  out.crystal.push({
    geo: outerAccretion,
    matrix: diskTilt.clone().multiply(makeTransform(0, 0.02, 0, 0.10, 0.4, 0)),
  });

  const lensArchTop = trackGeo(
    out,
    createFlowingRibbonMesh(
      [
        [-0.44, centerY + 0.02, -0.12],
        [-0.28, centerY + 0.32, -0.18],
        [0.0, centerY + 0.44, -0.20],
        [0.28, centerY + 0.32, -0.18],
        [0.44, centerY + 0.02, -0.12],
      ],
      [0.036, 0.092, 0.036],
      0.012,
      2.0,
      24,
      4,
      0.007,
      moltenScarlet,
      accretionRed,
    ),
  );
  const lensArchBot = trackGeo(
    out,
    createFlowingRibbonMesh(
      [
        [-0.40, centerY - 0.02, -0.10],
        [-0.24, centerY - 0.30, -0.16],
        [0.0, centerY - 0.40, -0.18],
        [0.24, centerY - 0.30, -0.16],
        [0.40, centerY - 0.02, -0.10],
      ],
      [0.032, 0.078, 0.032],
      0.010,
      2.0,
      22,
      4,
      0.007,
      accretionRed,
      tearCrimson,
    ),
  );
  out.crystal.push(
    { geo: lensArchTop, matrix: makeTransform(0, 0, 0) },
    { geo: lensArchBot, matrix: makeTransform(0, 0, 0) },
  );

  const tornShard = trackGeo(
    out,
    createFacetedCrystalPart(0.24, 0.046, 5, 0.66, 0.34, tearCrimson, moltenScarlet),
  );
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.22;
    const r = 0.46 + (i % 3) * 0.11;
    const sy = Math.sin(a * 2 + 0.6) * 0.11;
    const shardMat = diskTilt
      .clone()
      .multiply(
        makeTransform(
          Math.cos(a) * r,
          sy,
          Math.sin(a) * r,
          0.35 + (i % 2) * 0.4,
          a + 0.6,
          Math.PI * 0.44,
          1.0,
          0.92 + (i % 3) * 0.24,
          0.42,
        ),
      );
    if (i % 2 === 0) {
      out.crystal.push({ geo: tornShard, matrix: shardMat });
    } else {
      out.energy.push({ geo: tornShard, matrix: shardMat, colorRgb: accretionRed });
    }
  }

  const spineArmor = trackGeo(out, createCurvedBladePart(0.62, 0.092, 0.038, -0.12, 0.052, 9));
  const spineEdge = trackGeo(out, createCurvedBladePart(0.56, 0.036, 0.018, -0.11, 0.048, 8));
  const spineCoreTip = trackGeo(
    out,
    createFacetedCrystalPart(0.18, 0.024, 4, 0.68, 0.32, accretionRed, eclipseWhiteGold),
  );

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const backWeight = (1 - Math.cos(angle)) * 0.5;
    const alt = i % 2 === 0 ? 1.0 : 0.78;
    const heightScale = (0.64 + backWeight * 0.62) * alt;
    const orbitR = 0.50 + backWeight * 0.12 + (i % 2) * 0.04;
    const baseY = centerY - 0.12 + backWeight * 0.28 + (i % 2 === 0 ? 0.04 : -0.05);
    const leanOut = 0.26 - backWeight * 0.12;

    const px = Math.sin(angle) * orbitR;
    const pz = Math.cos(angle) * orbitR;

    const spineMat = makeTransform(px, baseY, pz, 0, angle, 0).multiply(
      makeTransform(0, 0, 0, leanOut, 0, 0, 0.92, heightScale, 0.92),
    );
    out.armor.push({
      geo: spineArmor,
      matrix: spineMat,
      colorRgb: i % 2 === 0 ? abyssObsidian : tearCrimson,
    });
    out.trim.push({
      geo: spineEdge,
      matrix: spineMat.clone().multiply(makeTransform(0, 0.04, -0.022)),
      colorRgb: bloodSteel,
    });
    out.energy.push({
      geo: spineCoreTip,
      matrix: spineMat.clone().multiply(makeTransform(-0.07, 0.44, 0.02)),
      colorRgb: i % 3 === 0 ? eclipseWhiteGold : moltenScarlet,
    });
  }

  const tearFilA = buildWarpedFilament(out, 0.58, 0.16, 3, 0.5, 0.05, 0.0085, 32);
  const tearFilB = buildWarpedFilament(out, 0.46, 0.20, 2, 1.9, 0.04, 0.0075, 28);
  out.energy.push(
    { geo: tearFilA, matrix: makeTransform(0, centerY + 0.08, 0, 0.42, 0.22, -0.34), colorRgb: accretionRed },
    { geo: tearFilB, matrix: makeTransform(0, centerY - 0.06, 0, -0.52, -0.28, 0.36), colorRgb: moltenScarlet },
  );

  const crownHalo = trackGeo(out, new THREE.TorusGeometry(0.76, 0.018, 8, 34));
  out.wingParts.push(
    { geo: crownHalo, matrix: makeTransform(0, centerY + 0.04, 0, 0.48, 0.26, 0.38), colorRgb: eclipseWhiteGold },
    { geo: crownHalo, matrix: makeTransform(0, centerY + 0.04, 0, -0.48, -0.26, -0.38), colorRgb: bloodSteel },
  );

  out.weaponGlowHex = 0xf43f5e;
  out.crystalHex = 0xdc2626;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.78;
  out.headTopLocalY = 2.18;
}

export const UNIT_PACK_4_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S29: (_ctx, out) => buildS29Leviathan(out),
  S30: (_ctx, out) => buildS30Sirius(out),
  S31: (_ctx, out) => buildS31Siren(out),
  S32: (_ctx, out) => buildS32Entropy(out),
  S34: (_ctx, out) => buildS34AzureDragon(out),
  S35: (_ctx, out) => buildS35Cassini(out),
  S36: (_ctx, out) => buildS36AbyssCrown(out),
};
