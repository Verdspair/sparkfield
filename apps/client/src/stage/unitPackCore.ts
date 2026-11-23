import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createCurvedBladePart,
  createCurvedVisorPart,
  createFacetedCrystalPart,
  createHexMirrorTilePart,
  createLathePart,
  createTaperedTubePart,
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type UnitBlueprintParts,
  type UnitBuilderContext,
} from './unitBuilderCore.js';

function pushDriveBell(
  out: UnitBlueprintParts,
  pos: readonly [number, number, number],
  outerRadius: number,
  length: number,
  shroudColor: RgbTriple,
  glowColor: RgbTriple,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const bellGeo = trackGeo(
    out,
    createLathePart(
      [
        [outerRadius * 0.54, length * 0.5],
        [outerRadius * 0.72, length * 0.2],
        [outerRadius * 0.96, -length * 0.3],
        [outerRadius, -length * 0.5],
        [outerRadius * 0.80, -length * 0.46],
        [outerRadius * 0.56, length * 0.2],
      ],
      14,
    ),
  );
  bellGeo.rotateX(Math.PI * 0.5);

  const plumeGeo = trackGeo(
    out,
    new THREE.ConeGeometry(outerRadius * 0.62, length * 1.10, 12),
  );
  plumeGeo.rotateX(-Math.PI * 0.5);

  const base = makeTransform(pos[0], pos[1], pos[2], rx, ry, rz);
  out.trim.push({ geo: bellGeo, matrix: base, colorRgb: shroudColor });
  out.energy.push({
    geo: plumeGeo,
    matrix: base.clone().multiply(makeTransform(0, 0, -length * 0.54)),
    colorRgb: glowColor,
  });
}

function buildS04(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.16, 0.27, 0.46];
  const deepIndigo: RgbTriple = [0.11, 0.19, 0.34];
  const warmBronze: RgbTriple = [0.78, 0.58, 0.30];
  const agedBrass: RgbTriple = [0.89, 0.74, 0.44];
  const darkIron: RgbTriple = [0.16, 0.19, 0.25];
  const empCyan: RgbTriple = [0.24, 0.86, 0.96];
  const arcCore: RgbTriple = [0.70, 0.96, 1.0];
  const warmAmber: RgbTriple = [0.96, 0.78, 0.38];

  const pressureHullGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.48],
        [0.16, -0.46],
        [0.24, -0.34],
        [0.26, -0.10],
        [0.27, 0.16],
        [0.23, 0.36],
        [0.15, 0.44],
        [0.001, 0.46],
      ],
      16,
    ),
  );
  pressureHullGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: pressureHullGeo,
    matrix: makeTransform(0, 0.78, 0.0),
    colorRgb: starIndigo,
  });

  const bulkheadRingGeo = trackGeo(out, new THREE.TorusGeometry(0.268, 0.022, 8, 20));
  for (const bz of [-0.28, -0.05, 0.18]) {
    out.trim.push({
      geo: bulkheadRingGeo,
      matrix: makeTransform(0, 0.78, bz),
      colorRgb: warmBronze,
    });
  }

  const dorsalBridgeGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.12, -0.32],
        [0.12, -0.32],
        [0.14, 0.15],
        [0.08, 0.28],
        [-0.08, 0.28],
        [-0.14, 0.15],
      ],
      0.16,
      0.022,
      0.022,
      2,
      6,
    ),
  );
  dorsalBridgeGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: dorsalBridgeGeo,
    matrix: makeTransform(0, 1.04, -0.02),
    colorRgb: deepIndigo,
  });

  const bridgeSpineGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.036, -0.26],
        [0.036, -0.26],
        [0.028, 0.20],
        [-0.028, 0.20],
      ],
      0.055,
      0.009,
      0.009,
      2,
      4,
    ),
  );
  bridgeSpineGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: bridgeSpineGeo,
    matrix: makeTransform(0, 1.14, -0.04),
    colorRgb: agedBrass,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.11, 0.055, 0.12, 1.44, 0.96, 0.60, 12, 6),
  );
  out.crystal.push({
    geo: bridgeVisorGeo,
    matrix: makeTransform(0, 1.08, 0.16),
    colorRgb: arcCore,
  });

  const bridgeHudGeo = trackGeo(out, new THREE.CylinderGeometry(0.075, 0.075, 0.030, 10));
  out.energy.push({
    geo: bridgeHudGeo,
    matrix: makeTransform(0, 1.08, 0.14),
    colorRgb: empCyan,
  });

  const commMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.015, 0.024, 0.20, 8));
  out.trim.push({
    geo: commMastGeo,
    matrix: makeTransform(0, 1.24, -0.18),
    colorRgb: agedBrass,
  });

  const commDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, 0.0],
        [0.05, 0.012],
        [0.095, 0.044],
        [0.088, 0.048],
        [0.001, 0.016],
      ],
      12,
    ),
  );
  commDishGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: commDishGeo,
    matrix: makeTransform(0, 1.32, -0.16, -0.26, 0, 0),
    colorRgb: warmBronze,
  });

  const ventralKeelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.12, -0.32],
        [0.12, -0.32],
        [0.15, 0.24],
        [-0.15, 0.24],
      ],
      0.11,
      0.016,
      0.016,
      2,
      4,
    ),
  );
  ventralKeelGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: ventralKeelGeo,
    matrix: makeTransform(0, 0.52, -0.02),
    colorRgb: darkIron,
  });

  const airlockGeo = trackGeo(out, new THREE.CylinderGeometry(0.10, 0.11, 0.08, 12));
  out.trim.push({
    geo: airlockGeo,
    matrix: makeTransform(0, 0.44, 0.04),
    colorRgb: warmBronze,
  });

  const ventralSensorGeo = trackGeo(out, new THREE.SphereGeometry(0.062, 10, 8));
  out.crystal.push({
    geo: ventralSensorGeo,
    matrix: makeTransform(0, 0.48, 0.24),
    colorRgb: arcCore,
  });

  const prowCollarGeo = trackGeo(out, new THREE.CylinderGeometry(0.145, 0.175, 0.14, 14));
  prowCollarGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: prowCollarGeo,
    matrix: makeTransform(0, 0.78, 0.44),
    colorRgb: darkIron,
  });

  const coaxialSleeveGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.115, 0.0],
        [0.115, 0.10],
        [0.088, 0.24],
        [0.095, 0.30],
        [0.072, 0.32],
        [0.054, 0.32],
        [0.054, 0.04],
      ],
      14,
    ),
  );
  coaxialSleeveGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: coaxialSleeveGeo,
    matrix: makeTransform(0, 0.78, 0.46),
    colorRgb: warmBronze,
  });

  const focusRingGeo = trackGeo(out, new THREE.TorusGeometry(0.108, 0.015, 8, 18));
  for (const fz of [0.54, 0.65, 0.75]) {
    out.trim.push({
      geo: focusRingGeo,
      matrix: makeTransform(0, 0.78, fz),
      colorRgb: agedBrass,
    });
  }

  const emitterRodGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.048, 0.36, 12));
  emitterRodGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: emitterRodGeo,
    matrix: makeTransform(0, 0.78, 0.64),
    colorRgb: arcCore,
  });

  const boomStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.028, 0.032, 0.24, 8));
  boomStrutGeo.rotateZ(Math.PI * 0.5);

  const capHousingGeo = trackGeo(out, new THREE.CylinderGeometry(0.105, 0.105, 0.14, 12));
  capHousingGeo.rotateX(Math.PI * 0.5);

  const capGlassGeo = trackGeo(out, new THREE.CylinderGeometry(0.092, 0.092, 0.42, 14));
  capGlassGeo.rotateX(Math.PI * 0.5);

  const capCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.046, 0.046, 0.40, 12));
  capCoreGeo.rotateX(Math.PI * 0.5);

  const capCoilGeo = trackGeo(out, new THREE.TorusGeometry(0.106, 0.016, 8, 16));

  const busbarGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.48, 8));
  busbarGeo.rotateX(Math.PI * 0.5);

  const radiatorFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.16],
        [0.24, -0.22],
        [0.26, 0.14],
        [0.0, 0.18],
      ],
      0.026,
      0.007,
      0.007,
      2,
      4,
    ),
  );

  const rcsPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.030, 0.036, 0.08, 8));
  rcsPodGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.matte.push(
      {
        geo: boomStrutGeo,
        matrix: makeTransform(side * 0.30, 0.78, 0.16),
        colorRgb: darkIron,
      },
      {
        geo: boomStrutGeo,
        matrix: makeTransform(side * 0.30, 0.78, -0.14),
        colorRgb: darkIron,
      },
    );
    out.crystal.push({
      geo: capGlassGeo,
      matrix: makeTransform(side * 0.43, 0.78, 0.02),
      colorRgb: arcCore,
    });
    out.energy.push({
      geo: capCoreGeo,
      matrix: makeTransform(side * 0.43, 0.78, 0.02),
      colorRgb: empCyan,
    });
    out.armor.push(
      {
        geo: capHousingGeo,
        matrix: makeTransform(side * 0.43, 0.78, 0.27),
        colorRgb: starIndigo,
      },
      {
        geo: capHousingGeo,
        matrix: makeTransform(side * 0.43, 0.78, -0.23),
        colorRgb: starIndigo,
      },
    );
    for (const cz of [-0.11, 0.02, 0.15]) {
      out.trim.push({
        geo: capCoilGeo,
        matrix: makeTransform(side * 0.43, 0.78, cz),
        colorRgb: warmBronze,
      });
    }
    out.trim.push({
      geo: busbarGeo,
      matrix: makeTransform(side * 0.43, 0.90, 0.02),
      colorRgb: agedBrass,
    });
    out.matte.push({
      geo: rcsPodGeo,
      matrix: makeTransform(side * 0.26, 0.92, 0.24),
      colorRgb: darkIron,
    });
    out.armor.push(
      {
        geo: radiatorFinGeo,
        matrix: makeTransform(side * 0.22, 0.94, -0.32, 0, Math.PI * 0.5, -side * 0.62, side, 1, 1),
        colorRgb: deepIndigo,
      },
      {
        geo: radiatorFinGeo,
        matrix: makeTransform(side * 0.22, 0.62, -0.32, 0, Math.PI * 0.5, side * 0.62, side, 1, 1),
        colorRgb: deepIndigo,
      },
    );
    pushDriveBell(out, [side * 0.16, 0.78, -0.50], 0.068, 0.14, agedBrass, warmAmber);
  }

  pushDriveBell(out, [0, 0.78, -0.52], 0.125, 0.20, warmBronze, empCyan);

  const star3RadiatorGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.06],
        [0.44, -0.14],
        [0.50, 0.08],
        [0.06, 0.12],
      ],
      0.022,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: star3RadiatorGeo,
      matrix: makeTransform(side * 0.34, 1.02, -0.24, -0.18, -side * 0.24, side * 0.34, side, 1, 1),
      colorRgb: agedBrass,
    });
  }

  out.headTopLocalY = 1.56;
  out.weaponGlowHex = 0x38d8f5;
  out.crystalHex = 0x7ce8ff;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.46;
}

function buildS16(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const navyBlue: RgbTriple = [0.18, 0.30, 0.49];
  const deepNavy: RgbTriple = [0.12, 0.21, 0.36];
  const titanium: RgbTriple = [0.70, 0.75, 0.82];
  const carbonFrame: RgbTriple = [0.16, 0.19, 0.25];
  const mirrorGold: RgbTriple = [0.92, 0.75, 0.36];
  const mirrorGoldEdge: RgbTriple = [0.76, 0.58, 0.24];
  const foilSilver: RgbTriple = [0.64, 0.70, 0.78];
  const laserCyan: RgbTriple = [0.44, 0.86, 1.0];
  const prismTint: RgbTriple = [0.74, 0.94, 1.0];

  const busCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.24, 0.28, 0.30, 8));
  out.armor.push({
    geo: busCoreGeo,
    matrix: makeTransform(0, 0.44, -0.06),
    colorRgb: navyBlue,
  });

  const busRingGeo = trackGeo(out, new THREE.TorusGeometry(0.275, 0.018, 8, 20));
  busRingGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: busRingGeo,
    matrix: makeTransform(0, 0.46, -0.06),
    colorRgb: titanium,
  });

  const sunshieldLayerGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.46],
        [0.44, 0.16],
        [0.38, -0.34],
        [0.0, -0.46],
        [-0.38, -0.34],
        [-0.44, 0.16],
      ],
      0.022,
      0.008,
      0.008,
      2,
      6,
    ),
  );
  sunshieldLayerGeo.rotateX(Math.PI * 0.5);
  out.armor.push(
    {
      geo: sunshieldLayerGeo,
      matrix: makeTransform(0, 0.26, -0.04, 0.06, 0, 0, 1.0, 1, 1.0),
      colorRgb: foilSilver,
    },
    {
      geo: sunshieldLayerGeo,
      matrix: makeTransform(0, 0.32, -0.04, 0.06, 0, 0, 0.88, 1, 0.88),
      colorRgb: deepNavy,
    },
  );

  const busSolarGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.10],
        [0.24, -0.12],
        [0.24, 0.10],
        [0.0, 0.08],
      ],
      0.018,
      0.005,
      0.005,
      2,
      4,
    ),
  );
  const whipAntGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.014, 0.26, 6));
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: busSolarGeo,
      matrix: makeTransform(side * 0.26, 0.46, -0.16, 0.28, -side * 0.22, 0, side, 1, 1),
      colorRgb: deepNavy,
    });
    out.trim.push({
      geo: whipAntGeo,
      matrix: makeTransform(side * 0.22, 0.62, -0.26, -0.32, 0, -side * 0.24),
      colorRgb: titanium,
    });
  }

  const trussLegGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.032, 1.0, 8));
  const thrusterPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.064, 0.078, 0.14, 10));
  const rcsGlowGeo = trackGeo(out, new THREE.ConeGeometry(0.044, 0.10, 8));
  rcsGlowGeo.rotateX(Math.PI);

  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const tipX = Math.cos(a) * 0.50;
    const tipZ = Math.sin(a) * 0.50 - 0.04;
    out.matte.push({
      geo: trussLegGeo,
      matrix: makeSegmentTransform(
        new THREE.Vector3(Math.cos(a) * 0.20, 0.50, Math.sin(a) * 0.20 - 0.06),
        new THREE.Vector3(tipX, 0.26, tipZ),
        1,
        1,
      ),
      colorRgb: carbonFrame,
    });
    out.trim.push({
      geo: trussLegGeo,
      matrix: makeSegmentTransform(
        new THREE.Vector3(Math.cos(a) * 0.18, 0.32, Math.sin(a) * 0.18 - 0.06),
        new THREE.Vector3(tipX, 0.26, tipZ),
        0.75,
        0.75,
      ),
      colorRgb: titanium,
    });
    out.armor.push({
      geo: thrusterPodGeo,
      matrix: makeTransform(tipX, 0.24, tipZ),
      colorRgb: navyBlue,
    });
    out.energy.push({
      geo: rcsGlowGeo,
      matrix: makeTransform(tipX, 0.14, tipZ),
      colorRgb: laserCyan,
    });
  }

  const gimbalNeckGeo = trackGeo(out, new THREE.CylinderGeometry(0.14, 0.19, 0.34, 12));
  out.matte.push({
    geo: gimbalNeckGeo,
    matrix: makeTransform(0, 0.70, -0.10, 0.22, 0, 0),
    colorRgb: carbonFrame,
  });

  const gimbalRingGeo = trackGeo(out, new THREE.TorusGeometry(0.18, 0.024, 8, 18));
  gimbalRingGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: gimbalRingGeo,
    matrix: makeTransform(0, 0.62, -0.08),
    colorRgb: titanium,
  });

  const dishPivot = makeTransform(0, 1.12, -0.06, 0.92, 0, 0);

  const dishBackplateGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.14],
        [0.20, -0.12],
        [0.42, -0.02],
        [0.56, 0.12],
        [0.58, 0.16],
        [0.52, 0.17],
        [0.36, 0.03],
        [0.16, -0.06],
        [0.001, -0.08],
      ],
      18,
    ),
  );
  out.armor.push({
    geo: dishBackplateGeo,
    matrix: dishPivot,
    colorRgb: deepNavy,
  });

  const dishRimGeo = trackGeo(out, new THREE.TorusGeometry(0.57, 0.022, 8, 24));
  dishRimGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: dishRimGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, 0.16, 0)),
    colorRgb: titanium,
  });

  const hexMirrorGeo = trackGeo(
    out,
    createHexMirrorTilePart(0.112, 0.024, 0.010, 0.010, mirrorGold, mirrorGoldEdge),
  );
  hexMirrorGeo.rotateX(-Math.PI * 0.5);

  out.trim.push({
    geo: hexMirrorGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, -0.04, 0)),
    colorRgb: mirrorGold,
  });

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rx = Math.cos(a) * 0.215;
    const rz = Math.sin(a) * 0.215;
    out.trim.push({
      geo: hexMirrorGeo,
      matrix: dishPivot.clone().multiply(
        makeTransform(rx, 0.005, rz, -Math.sin(a) * 0.24, 0, Math.cos(a) * 0.24),
      ),
      colorRgb: mirrorGold,
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
    const r = i % 2 === 0 ? 0.415 : 0.435;
    const rx = Math.cos(a) * r;
    const rz = Math.sin(a) * r;
    out.trim.push({
      geo: hexMirrorGeo,
      matrix: dishPivot.clone().multiply(
        makeTransform(rx, 0.095, rz, -Math.sin(a) * 0.42, 0, Math.cos(a) * 0.42),
      ),
      colorRgb: mirrorGold,
    });
  }

  const tripodStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.020, 1.0, 8));
  const feedApex = new THREE.Vector3(0, 0.54, 0);
  const strutMidPts: THREE.Vector3[] = [];
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    const foot = new THREE.Vector3(Math.cos(a) * 0.52, 0.14, Math.sin(a) * 0.52);
    out.matte.push({
      geo: tripodStrutGeo,
      matrix: dishPivot.clone().multiply(makeSegmentTransform(foot, feedApex, 1, 1)),
      colorRgb: carbonFrame,
    });
    strutMidPts.push(foot.clone().lerp(feedApex, 0.52));
  }

  for (let i = 0; i < 3; i += 1) {
    const pA = strutMidPts[i]!;
    const pB = strutMidPts[(i + 1) % 3]!;
    out.trim.push({
      geo: tripodStrutGeo,
      matrix: dishPivot.clone().multiply(makeSegmentTransform(pA, pB, 0.65, 0.65)),
      colorRgb: titanium,
    });
  }

  const feedHornGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.055, -0.06],
        [0.105, 0.02],
        [0.092, 0.12],
        [0.048, 0.16],
        [0.001, 0.16],
      ],
      14,
    ),
  );
  out.armor.push({
    geo: feedHornGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, 0.50, 0)),
    colorRgb: navyBlue,
  });

  const laserCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.18, 0.062, 6, 0.62, 0.38));
  out.crystal.push({
    geo: laserCrystalGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, 0.46, 0)),
    colorRgb: prismTint,
  });

  const laserEmitterGeo = trackGeo(out, new THREE.SphereGeometry(0.050, 12, 10));
  out.energy.push({
    geo: laserEmitterGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, 0.58, 0)),
    colorRgb: laserCyan,
  });

  const laserRingGeo = trackGeo(out, new THREE.TorusGeometry(0.088, 0.013, 8, 16));
  laserRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: laserRingGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, 0.64, 0)),
    colorRgb: laserCyan,
  });

  const rearCounterGeo = trackGeo(out, new THREE.CylinderGeometry(0.16, 0.18, 0.14, 12));
  out.matte.push({
    geo: rearCounterGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, -0.18, 0)),
    colorRgb: carbonFrame,
  });

  const rearCoolerGeo = trackGeo(out, new THREE.TorusGeometry(0.20, 0.016, 8, 18));
  rearCoolerGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: rearCoolerGeo,
    matrix: dishPivot.clone().multiply(makeTransform(0, -0.20, 0)),
    colorRgb: titanium,
  });

  const star3SolarGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.12],
        [0.42, -0.18],
        [0.46, 0.14],
        [0.0, 0.10],
      ],
      0.020,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: star3SolarGeo,
      matrix: makeTransform(side * 0.38, 0.54, -0.18, -0.14, -side * 0.24, side * 0.16, side, 1, 1),
      colorRgb: mirrorGold,
    });
  }

  out.headTopLocalY = 1.84;
  out.weaponGlowHex = 0x52d6ff;
  out.crystalHex = 0x9ceaff;
  out.crystalOpacity = 0.56;
  out.crystalIntensity = 0.50;
}

function buildS33(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const ceramicWhite: RgbTriple = [0.92, 0.94, 0.98];
  const coolPorcelain: RgbTriple = [0.78, 0.84, 0.93];
  const cobaltSlate: RgbTriple = [0.22, 0.42, 0.72];
  const titaniumTrim: RgbTriple = [0.76, 0.80, 0.86];
  const paleGold: RgbTriple = [0.88, 0.76, 0.48];
  const darkCarbon: RgbTriple = [0.14, 0.18, 0.25];
  const horizonBlack: RgbTriple = [0.04, 0.05, 0.09];
  const dataCyan: RgbTriple = [0.30, 0.88, 1.0];
  const gammaWhite: RgbTriple = [0.86, 0.98, 1.0];

  const outerRingGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.52, -0.055],
        [0.64, -0.045],
        [0.68, 0.0],
        [0.64, 0.055],
        [0.52, 0.065],
        [0.50, 0.02],
        [0.52, -0.055],
      ],
      32,
    ),
  );
  out.armor.push({
    geo: outerRingGeo,
    matrix: makeTransform(0, 1.04, 0),
    colorRgb: ceramicWhite,
  });

  const outerTrackGeo = trackGeo(out, new THREE.TorusGeometry(0.678, 0.016, 8, 36));
  outerTrackGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: outerTrackGeo,
    matrix: makeTransform(0, 1.04, 0),
    colorRgb: titaniumTrim,
  });

  const outerRingLightGeo = trackGeo(out, new THREE.TorusGeometry(0.585, 0.012, 8, 36));
  outerRingLightGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: outerRingLightGeo,
    matrix: makeTransform(0, 1.11, 0),
    colorRgb: dataCyan,
  });

  const midRingGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.36, -0.048],
        [0.45, -0.036],
        [0.48, 0.008],
        [0.44, 0.052],
        [0.36, 0.058],
        [0.36, -0.048],
      ],
      28,
    ),
  );
  out.armor.push({
    geo: midRingGeo,
    matrix: makeTransform(0, 1.16, 0, 0.14, 0, -0.08),
    colorRgb: coolPorcelain,
  });

  const midTrackGeo = trackGeo(out, new THREE.TorusGeometry(0.478, 0.014, 8, 30));
  midTrackGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: midTrackGeo,
    matrix: makeTransform(0, 1.16, 0, 0.14, 0, -0.08),
    colorRgb: paleGold,
  });

  const innerRingGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.21, -0.044],
        [0.28, -0.034],
        [0.31, 0.012],
        [0.28, 0.054],
        [0.21, 0.058],
        [0.21, -0.044],
      ],
      24,
    ),
  );
  out.armor.push({
    geo: innerRingGeo,
    matrix: makeTransform(0, 1.28, 0, -0.10, 0, 0.08),
    colorRgb: ceramicWhite,
  });

  const innerLightGeo = trackGeo(out, new THREE.TorusGeometry(0.295, 0.012, 8, 24));
  innerLightGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: innerLightGeo,
    matrix: makeTransform(0, 1.33, 0, -0.10, 0, 0.08),
    colorRgb: dataCyan,
  });

  const stationPodGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.065, -0.10],
        [0.065, -0.10],
        [0.075, 0.10],
        [-0.075, 0.10],
      ],
      0.13,
      0.014,
      0.014,
      2,
      4,
    ),
  );
  stationPodGeo.rotateX(Math.PI * 0.5);

  const radialTrussGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.026, 0.34, 8));
  radialTrussGeo.rotateX(Math.PI * 0.5);

  const radiatorBladeGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.045, 0.0],
        [0.045, 0.0],
        [0.032, 0.20],
        [-0.032, 0.20],
      ],
      0.016,
      0.005,
      0.005,
      2,
      4,
    ),
  );

  const podBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.026, 8, 6));

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const sx = Math.sin(a);
    const cz = Math.cos(a);
    out.armor.push({
      geo: stationPodGeo,
      matrix: makeTransform(sx * 0.60, 1.04, cz * 0.60, 0, a, 0),
      colorRgb: i % 2 === 0 ? cobaltSlate : ceramicWhite,
    });
    out.matte.push({
      geo: radialTrussGeo,
      matrix: makeTransform(sx * 0.44, 1.10, cz * 0.44, 0.28, a, 0),
      colorRgb: darkCarbon,
    });
    out.trim.push({
      geo: radiatorBladeGeo,
      matrix: makeTransform(sx * 0.66, 1.04, cz * 0.66, Math.PI * 0.5, a, 0),
      colorRgb: titaniumTrim,
    });
    out.energy.push({
      geo: podBeaconGeo,
      matrix: makeTransform(sx * 0.60, 1.13, cz * 0.60),
      colorRgb: dataCyan,
    });
  }

  const prowDockGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.12, -0.14],
        [0.12, -0.14],
        [0.14, 0.10],
        [0.06, 0.24],
        [-0.06, 0.24],
        [-0.14, 0.10],
      ],
      0.10,
      0.016,
      0.016,
      2,
      6,
    ),
  );
  prowDockGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: prowDockGeo,
    matrix: makeTransform(0, 1.06, 0.62),
    colorRgb: ceramicWhite,
  });

  const prowVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.095, 0.044, 0.08, 1.48, 0.96, 0.56, 12, 6),
  );
  out.crystal.push({
    geo: prowVisorGeo,
    matrix: makeTransform(0, 1.09, 0.72),
    colorRgb: gammaWhite,
  });

  const commandHubGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.14, 0.0],
        [0.16, 0.12],
        [0.13, 0.28],
        [0.095, 0.40],
        [0.075, 0.44],
      ],
      16,
    ),
  );
  out.armor.push({
    geo: commandHubGeo,
    matrix: makeTransform(0, 1.34, 0),
    colorRgb: ceramicWhite,
  });

  const obsVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.145, 0.060, 0.145, 2.20, 0.98, 0.54, 16, 6),
  );
  out.crystal.push({
    geo: obsVisorGeo,
    matrix: makeTransform(0, 1.54, 0.01),
    colorRgb: gammaWhite,
  });

  const innerBridgeStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8));
  const collectorPylonGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.34, 1.06, 0],
        [0.30, 0.88, 0],
        [0.20, 0.70, 0],
      ],
      0.028,
      0.016,
      10,
      8,
    ),
  );
  const polarFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.0],
        [0.12, -0.04],
        [0.10, 0.20],
        [0.0, 0.24],
      ],
      0.016,
      0.005,
      0.005,
      2,
      4,
    ),
  );

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.armor.push({
      geo: collectorPylonGeo,
      matrix: makeTransform(0, 0, 0, 0, a, 0),
      colorRgb: ceramicWhite,
    });
    out.matte.push({
      geo: innerBridgeStrutGeo,
      matrix: makeTransform(Math.cos(a) * 0.22, 1.34, Math.sin(a) * 0.22, 0, -a, 0.82),
      colorRgb: darkCarbon,
    });
    out.trim.push({
      geo: polarFinGeo,
      matrix: makeTransform(Math.cos(a) * 0.08, 1.72, Math.sin(a) * 0.08, 0, -a, 0),
      colorRgb: titaniumTrim,
    });
  }

  const singularityGeo = trackGeo(out, new THREE.SphereGeometry(0.145, 20, 16));
  out.matte.push({
    geo: singularityGeo,
    matrix: makeTransform(0, 0.86, 0),
    colorRgb: horizonBlack,
  });

  const photonRingGeo = trackGeo(out, new THREE.TorusGeometry(0.185, 0.018, 10, 30));
  photonRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: photonRingGeo,
    matrix: makeTransform(0, 0.86, 0, 0.24, 0, 0.14),
    colorRgb: gammaWhite,
  });

  const ergosphereDiscGeo = trackGeo(out, new THREE.TorusGeometry(0.285, 0.042, 10, 32));
  ergosphereDiscGeo.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: ergosphereDiscGeo,
    matrix: makeTransform(0, 0.86, 0, 0.24, 0, 0.14, 1, 0.30, 1),
    colorRgb: dataCyan,
  });

  const jetSheathGeo = trackGeo(out, new THREE.CylinderGeometry(0.052, 0.052, 1.88, 14));
  out.crystal.push({
    geo: jetSheathGeo,
    matrix: makeTransform(0, 1.10, 0),
    colorRgb: dataCyan,
  });

  const jetCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 1.96, 12));
  out.energy.push({
    geo: jetCoreGeo,
    matrix: makeTransform(0, 1.10, 0),
    colorRgb: gammaWhite,
  });

  const collimatorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.108, 0.016, 8, 20));
  collimatorRingGeo.rotateX(Math.PI * 0.5);
  for (const cy of [0.30, 0.52, 1.76, 1.96]) {
    out.trim.push({
      geo: collimatorRingGeo,
      matrix: makeTransform(0, cy, 0),
      colorRgb: paleGold,
    });
  }

  const emitterTipGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.072, 0.12, 12));
  out.trim.push(
    {
      geo: emitterTipGeo,
      matrix: makeTransform(0, 2.02, 0),
      colorRgb: titaniumTrim,
    },
    {
      geo: emitterTipGeo,
      matrix: makeTransform(0, 0.22, 0, Math.PI, 0, 0),
      colorRgb: titaniumTrim,
    },
  );

  const star3CollectorGeo = trackGeo(out, createCurvedBladePart(0.72, 0.10, 0.022, 0.20, 0.05, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: star3CollectorGeo,
      matrix: makeTransform(side * 0.62, 1.18, -0.22, -0.16, side * 0.28, -side * 0.44, side, 1, 1),
      colorRgb: paleGold,
    });
  }

  out.headTopLocalY = 2.24;
  out.weaponGlowHex = 0x52e2ff;
  out.crystalHex = 0x94ecff;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.50;
}

export const UNIT_PACK_CORE_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S04: buildS04,
  S16: buildS16,
  S33: buildS33,
};
