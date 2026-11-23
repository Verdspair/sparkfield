import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
  createCreatureFin,
  createCurvedBladePart,
  createCurvedVisorPart,
  createFacetedCrystalPart,
  createLathePart,
  createTaperedTubePart,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type UnitBlueprintParts,
  type Vec3Tuple,
} from './unitBuilderCore.js';

function createHorizontalPlate(
  out: UnitBlueprintParts,
  ptsXZ: readonly (readonly [number, number])[],
  thickness: number,
  bevelSize = 0.014,
  bevelThickness = 0.014,
  bevelSegments = 2,
): THREE.BufferGeometry {
  const geo = trackGeo(
    out,
    createBevelExtrudePart(ptsXZ, thickness, bevelSize, bevelThickness, bevelSegments, 6),
  );
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

function createSideProfilePlate(
  out: UnitBlueprintParts,
  ptsZY: readonly (readonly [number, number])[],
  thickness: number,
  bevelSize = 0.012,
  bevelThickness = 0.012,
  bevelSegments = 2,
): THREE.BufferGeometry {
  const geo = trackGeo(
    out,
    createBevelExtrudePart(ptsZY, thickness, bevelSize, bevelThickness, bevelSegments, 6),
  );
  geo.rotateY(-Math.PI * 0.5);
  return geo;
}

function createThrusterBellGeo(
  out: UnitBlueprintParts,
  outerRadius: number,
  length: number,
  segs = 16,
): THREE.BufferGeometry {
  const geo = trackGeo(
    out,
    createLathePart(
      [
        [outerRadius * 0.60, -length * 0.5],
        [outerRadius * 0.96, -length * 0.34],
        [outerRadius, -length * 0.06],
        [outerRadius * 0.84, length * 0.30],
        [outerRadius * 0.92, length * 0.5],
        [outerRadius * 0.64, length * 0.48],
      ],
      segs,
    ),
  );
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

function createExhaustPlumeGeo(
  out: UnitBlueprintParts,
  radius: number,
  length: number,
  segs = 12,
): THREE.BufferGeometry {
  const geo = trackGeo(
    out,
    createLathePart(
      [
        [radius * 0.82, 0],
        [radius * 0.92, -length * 0.18],
        [radius * 0.52, -length * 0.62],
        [radius * 0.14, -length * 0.92],
        [0.004, -length],
      ],
      segs,
    ),
  );
  geo.rotateX(Math.PI * 0.5);
  return geo;
}

function buildS29Leviathan(out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.17, 0.27, 0.45];
  const titaniumTeal: RgbTriple = [0.26, 0.43, 0.58];
  const paleSteel: RgbTriple = [0.58, 0.70, 0.80];
  const deepSlate: RgbTriple = [0.14, 0.17, 0.24];
  const warmBronze: RgbTriple = [0.80, 0.62, 0.34];
  const agedBrass: RgbTriple = [0.90, 0.76, 0.48];
  const fusionCyan: RgbTriple = [0.38, 0.88, 1.0];
  const fusionWhite: RgbTriple = [0.88, 0.98, 1.0];

  const shipRoot = makeTransform(0, 1.02, 0.0, 0.16, 0, 0);

  const mainSpindleGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.008, 0.74],
        [0.078, 0.62],
        [0.148, 0.40],
        [0.188, 0.14],
        [0.205, -0.18],
        [0.192, -0.48],
        [0.148, -0.60],
      ],
      8,
    ),
  );
  mainSpindleGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: mainSpindleGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, Math.PI / 8, 1.08, 0.90, 1.0)),
    colorRgb: starIndigo,
  });

  const dorsalArmorDeckGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.64],
      [0.10, 0.44],
      [0.16, 0.10],
      [0.17, -0.30],
      [0.12, -0.52],
      [-0.12, -0.52],
      [-0.17, -0.30],
      [-0.16, 0.10],
      [-0.10, 0.44],
    ],
    0.085,
    0.016,
    0.016,
  );
  out.armor.push({
    geo: dorsalArmorDeckGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.135, -0.02)),
    colorRgb: titaniumTeal,
  });

  const ventralKeelGeo = createSideProfilePlate(
    out,
    [
      [0.60, -0.02],
      [0.32, -0.18],
      [-0.34, -0.20],
      [-0.56, -0.10],
      [-0.50, 0.04],
      [0.44, 0.04],
    ],
    0.13,
    0.014,
    0.014,
  );
  out.matte.push({
    geo: ventralKeelGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, -0.09, 0.0)),
    colorRgb: deepSlate,
  });

  const bowSensorNeedleGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.032, 0.24, 10));
  bowSensorNeedleGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: bowSensorNeedleGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.01, 0.76)),
    colorRgb: agedBrass,
  });

  const bowCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.148, 0.018, 8, 20));
  out.trim.push({
    geo: bowCollarGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.0, 0.36)),
    colorRgb: warmBronze,
  });

  const midBulkheadCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.202, 0.018, 8, 22));
  out.trim.push({
    geo: midBulkheadCollarGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.0, 0.04, 0, 0, 0, 1.05, 0.90, 1.0)),
    colorRgb: warmBronze,
  });

  const bridgeModuleGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.20],
      [0.10, 0.10],
      [0.12, -0.15],
      [-0.12, -0.15],
      [-0.10, 0.10],
    ],
    0.11,
    0.014,
    0.014,
  );
  out.armor.push({
    geo: bridgeModuleGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.22, 0.14)),
    colorRgb: paleSteel,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.098, 0.044, 0.10, 1.64, 0.96, 0.58, 12, 5),
  );
  out.energy.push({
    geo: bridgeVisorGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.225, 0.23)),
    colorRgb: fusionWhite,
  });

  const dorsalCommsFinGeo = createSideProfilePlate(
    out,
    [
      [0.08, 0.0],
      [-0.04, 0.18],
      [-0.16, 0.15],
      [-0.10, 0.0],
    ],
    0.026,
    0.005,
    0.005,
  );
  out.trim.push({
    geo: dorsalCommsFinGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.28, 0.05)),
    colorRgb: agedBrass,
  });

  const radiatorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.42, 0.024, 8, 28));
  out.trim.push({
    geo: radiatorRingGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.0, -0.24)),
    colorRgb: warmBronze,
  });

  const radiatorGlowRingGeo = trackGeo(out, new THREE.TorusGeometry(0.388, 0.011, 6, 28));
  out.energy.push({
    geo: radiatorGlowRingGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.0, -0.24)),
    colorRgb: fusionCyan,
  });

  const radiatorFinGeo = createSideProfilePlate(
    out,
    [
      [0.14, 0.0],
      [0.08, 0.26],
      [-0.12, 0.24],
      [-0.16, 0.0],
    ],
    0.022,
    0.005,
    0.005,
  );
  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.armor.push({
      geo: radiatorFinGeo,
      matrix: shipRoot
        .clone()
        .multiply(makeTransform(0, 0, -0.24, 0, 0, ang))
        .multiply(makeTransform(0, 0.17, 0)),
      colorRgb: i % 2 === 0 ? titaniumTeal : starIndigo,
    });
  }

  const outriggerStrutGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.16],
      [0.42, 0.06],
      [0.40, -0.14],
      [0.0, -0.18],
    ],
    0.058,
    0.012,
    0.012,
  );
  const gunPodGeo = trackGeo(out, createChamferedHexPart(0.11, 0.38, 0.014));
  const podSidePlateGeo = createSideProfilePlate(
    out,
    [
      [0.18, 0.08],
      [-0.18, 0.08],
      [-0.22, -0.08],
      [0.16, -0.08],
    ],
    0.036,
    0.008,
    0.008,
  );
  const hullNavStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.42, 8));
  hullNavStripGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: outriggerStrutGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.14, 0.0, 0.10, 0, 0, 0, side, 1, 1)),
      colorRgb: deepSlate,
    });
    out.armor.push({
      geo: gunPodGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.46, 0.0, 0.08, 0, 0, 0, 1.0, 1.32, 1.0)),
      colorRgb: starIndigo,
    });
    out.trim.push({
      geo: podSidePlateGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.56, 0.0, 0.08)),
      colorRgb: warmBronze,
    });
    out.energy.push({
      geo: hullNavStripGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.19, 0.08, 0.18)),
      colorRgb: fusionCyan,
    });
  }

  const particleBarrelGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.028, 0.64, 10));
  particleBarrelGeo.rotateX(Math.PI * 0.5);
  const barrelCoilGeo = trackGeo(out, new THREE.TorusGeometry(0.036, 0.009, 6, 14));
  const barrelCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.014, 0.60, 8));
  barrelCoreGeo.rotateX(Math.PI * 0.5);

  const cannonMounts: readonly (readonly [number, number, number])[] = [
    [-0.46, 0.09, 0.10],
    [0.46, 0.09, 0.10],
    [-0.46, -0.09, 0.10],
    [0.46, -0.09, 0.10],
  ];

  for (const [cx, cy, cz] of cannonMounts) {
    const cm = shipRoot.clone().multiply(makeTransform(cx, cy, cz + 0.30));
    out.trim.push({ geo: particleBarrelGeo, matrix: cm, colorRgb: agedBrass });
    out.energy.push({
      geo: barrelCoreGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, 0.02)),
      colorRgb: fusionCyan,
    });
    out.matte.push({
      geo: barrelCoilGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, 0.20)),
      colorRgb: deepSlate,
    });
    out.trim.push({
      geo: barrelCoilGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, -0.02)),
      colorRgb: warmBronze,
    });
  }

  const engineBellGeo = createThrusterBellGeo(out, 0.105, 0.24, 14);
  const engineCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.108, 0.016, 6, 16));
  const engineCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.062, 0.072, 0.08, 12));
  engineCoreGeo.rotateX(Math.PI * 0.5);
  const enginePlumeGeo = createExhaustPlumeGeo(out, 0.066, 0.22, 10);

  const sternEngines: readonly (readonly [number, number, number])[] = [
    [-0.18, 0.10, -0.60],
    [0.18, 0.10, -0.60],
    [-0.18, -0.10, -0.60],
    [0.18, -0.10, -0.60],
  ];
  for (const [ex, ey, ez] of sternEngines) {
    const em = shipRoot.clone().multiply(makeTransform(ex, ey, ez));
    out.matte.push({ geo: engineBellGeo, matrix: em, colorRgb: deepSlate });
    out.trim.push({
      geo: engineCollarGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.05)),
      colorRgb: warmBronze,
    });
    out.energy.push({
      geo: engineCoreGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.10)),
      colorRgb: fusionWhite,
    });
    out.crystal.push({
      geo: enginePlumeGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.11)),
      colorRgb: fusionCyan,
    });
  }

  const star3RadiatorGeo = trackGeo(out, createCurvedBladePart(0.60, 0.10, 0.022, 0.14, 0.04, 8));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3RadiatorGeo,
        matrix: shipRoot.clone().multiply(makeTransform(side * 0.36, 0.28, -0.26, -0.22, side * 0.20, -side * 0.56, side, 1, 1)),
        colorRgb: agedBrass,
      },
      {
        geo: star3RadiatorGeo,
        matrix: shipRoot.clone().multiply(makeTransform(side * 0.44, -0.12, -0.30, -0.14, side * 0.26, -side * 1.18, side * 0.86, 0.86, 0.86)),
        colorRgb: warmBronze,
      },
    );
  }

  out.headTopLocalY = 1.66;
  out.weaponGlowHex = 0x48dcff;
  out.crystalHex = 0x6ae6ff;
  out.crystalOpacity = 0.46;
  out.crystalIntensity = 0.54;
}

function buildS30Sirius(out: UnitBlueprintParts): void {
  const deepNavy: RgbTriple = [0.16, 0.27, 0.46];
  const slateNavy: RgbTriple = [0.25, 0.39, 0.59];
  const titaniumSilver: RgbTriple = [0.76, 0.82, 0.89];
  const darkGraphite: RgbTriple = [0.14, 0.18, 0.24];
  const opticalGold: RgbTriple = [0.88, 0.72, 0.38];
  const starWhite: RgbTriple = [0.94, 0.99, 1.0];
  const starAzure: RgbTriple = [0.42, 0.82, 1.0];

  const shipRoot = makeTransform(0, 1.04, -0.02, 0.10, 0, 0);

  const reactorCoreGeo = trackGeo(out, createChamferedHexPart(0.25, 0.42, 0.020));
  out.armor.push({
    geo: reactorCoreGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, -0.34)),
    colorRgb: deepNavy,
  });

  const rearSpineCylinderGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.06, -0.64],
        [0.16, -0.52],
        [0.21, -0.24],
        [0.16, -0.05],
        [0.08, 0.04],
      ],
      16,
    ),
  );
  rearSpineCylinderGeo.rotateX(Math.PI * 0.5);
  out.matte.push({ geo: rearSpineCylinderGeo, matrix: shipRoot, colorRgb: darkGraphite });

  const surveyDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.01, 0.0],
        [0.09, 0.02],
        [0.16, 0.07],
        [0.17, 0.09],
      ],
      18,
    ),
  );
  out.trim.push({
    geo: surveyDishGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.28, -0.34, 0.58, 0, 0)),
    colorRgb: opticalGold,
  });

  const dishFeedHornGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.018, 0.14, 8));
  out.trim.push({
    geo: dishFeedHornGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.33, -0.30, 0.58, 0, 0)),
    colorRgb: titaniumSilver,
  });

  const commandBridgeGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.16],
      [0.09, 0.08],
      [0.10, -0.14],
      [-0.10, -0.14],
      [-0.09, 0.08],
    ],
    0.075,
    0.012,
    0.012,
  );
  out.armor.push({
    geo: commandBridgeGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.22, -0.14)),
    colorRgb: slateNavy,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.084, 0.036, 0.085, 1.54, 0.96, 0.58, 12, 5),
  );
  out.energy.push({
    geo: bridgeVisorGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.225, -0.05)),
    colorRgb: starWhite,
  });

  const trussBeamGeo = createSideProfilePlate(
    out,
    [
      [0.68, 0.03],
      [0.50, 0.12],
      [-0.46, 0.14],
      [-0.56, 0.04],
      [-0.48, -0.03],
      [0.60, -0.03],
    ],
    0.082,
    0.012,
    0.012,
  );
  const trussSilverFrameGeo = createSideProfilePlate(
    out,
    [
      [0.60, 0.05],
      [0.34, 0.11],
      [-0.34, 0.11],
      [-0.44, 0.04],
      [0.50, 0.02],
    ],
    0.096,
    0.008,
    0.008,
  );
  const goldRailGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.018, 1.06, 8));
  goldRailGeo.rotateX(Math.PI * 0.5);
  const radiatorPanelGeo = createSideProfilePlate(
    out,
    [
      [0.08, 0.0],
      [-0.14, 0.26],
      [-0.42, 0.24],
      [-0.40, 0.0],
    ],
    0.028,
    0.006,
    0.006,
  );
  const conduitBeamGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0, 0.24, -0.10],
        [0, 0.22, 0.34],
        [0, 0.02, 0.68],
      ],
      0.012,
      0.008,
      10,
      6,
    ),
  );
  const lensSupportStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.16, 8));
  const ringClampGeo = trackGeo(out, createChamferedHexPart(0.044, 0.056, 0.008));
  const emitterTipGeo = trackGeo(
    out,
    createFacetedCrystalPart(0.18, 0.034, 4, 0.72, 0.28),
  );
  emitterTipGeo.rotateX(Math.PI * 0.5);
  const crossBraceGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 0.38, 8));
  const sideCapacitorGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.34, 8));
  sideCapacitorGeo.rotateX(Math.PI * 0.5);
  const nozzleGeo = createThrusterBellGeo(out, 0.074, 0.19, 12);
  const nozzleCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.050, 0.07, 10));
  nozzleCoreGeo.rotateX(Math.PI * 0.5);
  const nozzlePlumeGeo = createExhaustPlumeGeo(out, 0.048, 0.20, 10);

  const radialAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  for (const ang of radialAngles) {
    const armMat = shipRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, ang));
    out.armor.push({
      geo: trussBeamGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.28, 0.04)),
      colorRgb: deepNavy,
    });
    out.trim.push({
      geo: trussSilverFrameGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.29, 0.04)),
      colorRgb: titaniumSilver,
    });
    out.trim.push({
      geo: goldRailGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.23, 0.12)),
      colorRgb: opticalGold,
    });
    out.armor.push({
      geo: radiatorPanelGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.38, -0.06)),
      colorRgb: slateNavy,
    });
    out.energy.push({
      geo: conduitBeamGeo,
      matrix: armMat,
      colorRgb: starAzure,
    });
    out.matte.push({
      geo: lensSupportStrutGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.29, 0.40)),
      colorRgb: darkGraphite,
    });
    out.trim.push({
      geo: ringClampGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.33, 0.22)),
      colorRgb: titaniumSilver,
    });
    out.trim.push({
      geo: ringClampGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.23, 0.58)),
      colorRgb: opticalGold,
    });
    out.trim.push({
      geo: emitterTipGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.29, 0.72)),
      colorRgb: titaniumSilver,
    });
    out.matte.push({
      geo: crossBraceGeo,
      matrix: armMat.clone().multiply(makeTransform(0.14, 0.14, -0.24, 0, 0, -Math.PI / 3)),
      colorRgb: darkGraphite,
    });
    out.energy.push({
      geo: sideCapacitorGeo,
      matrix: armMat.clone().multiply(makeTransform(0, 0.35, -0.24)),
      colorRgb: starAzure,
    });

    const engMat = armMat.clone().multiply(makeTransform(0, 0.24, -0.56));
    out.matte.push({ geo: nozzleGeo, matrix: engMat, colorRgb: darkGraphite });
    out.energy.push({
      geo: nozzleCoreGeo,
      matrix: engMat.clone().multiply(makeTransform(0, 0, -0.085)),
      colorRgb: starWhite,
    });
    out.crystal.push({
      geo: nozzlePlumeGeo,
      matrix: engMat.clone().multiply(makeTransform(0, 0, -0.095)),
      colorRgb: starAzure,
    });
  }

  const dwarfCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.155, 18, 14));
  out.energy.push({
    geo: dwarfCoreGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0.18)),
    colorRgb: starWhite,
  });

  const dwarfLensBubbleGeo = trackGeo(out, new THREE.SphereGeometry(0.215, 16, 12));
  out.crystal.push({
    geo: dwarfLensBubbleGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0.18)),
    colorRgb: starAzure,
  });

  const lensRingSpecs: readonly (readonly [number, number, number, RgbTriple])[] = [
    [0.34, 0.020, 0.22, opticalGold],
    [0.29, 0.018, 0.40, titaniumSilver],
    [0.23, 0.015, 0.58, opticalGold],
  ];
  for (const [rad, tube, pz, col] of lensRingSpecs) {
    const ringGeo = trackGeo(out, new THREE.TorusGeometry(rad, tube, 8, 28));
    out.trim.push({
      geo: ringGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, pz)),
      colorRgb: col,
    });
  }

  const gravLensDiscGeo = trackGeo(out, new THREE.CylinderGeometry(0.21, 0.21, 0.016, 22));
  gravLensDiscGeo.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: gravLensDiscGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0.58)),
    colorRgb: starWhite,
  });

  const focalPointGeo = trackGeo(
    out,
    createFacetedCrystalPart(0.20, 0.048, 6, 0.68, 0.32, starAzure, starWhite),
  );
  focalPointGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: focalPointGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0.70)),
    colorRgb: starWhite,
  });

  const star3LensFinGeo = trackGeo(out, createCurvedBladePart(0.56, 0.095, 0.022, 0.10, 0.03, 8));
  for (const ang of radialAngles) {
    out.wingParts.push({
      geo: star3LensFinGeo,
      matrix: shipRoot
        .clone()
        .multiply(makeTransform(0, 0, 0, 0, 0, ang))
        .multiply(makeTransform(0, 0.48, -0.22, -0.32, 0, 0)),
      colorRgb: opticalGold,
    });
  }

  out.headTopLocalY = 1.88;
  out.weaponGlowHex = 0x70d8ff;
  out.crystalHex = 0x9ce6ff;
  out.crystalOpacity = 0.46;
  out.crystalIntensity = 0.54;
}

function buildS31Siren(out: UnitBlueprintParts): void {
  const glacierWhite: RgbTriple = [0.85, 0.92, 0.97];
  const europaIce: RgbTriple = [0.36, 0.68, 0.84];
  const deepOcean: RgbTriple = [0.17, 0.37, 0.54];
  const cryoSlate: RgbTriple = [0.16, 0.24, 0.34];
  const platinumTrim: RgbTriple = [0.80, 0.87, 0.93];
  const lifeEmerald: RgbTriple = [0.30, 0.94, 0.76];
  const canopyAqua: RgbTriple = [0.64, 0.98, 0.92];
  const domeIce: RgbTriple = [0.68, 0.92, 1.0];

  const arkRoot = makeTransform(0, 0.96, 0.02, 0.24, 0, 0);

  const outerHabRingGeo = trackGeo(out, new THREE.TorusGeometry(0.48, 0.064, 10, 32));
  outerHabRingGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: outerHabRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 0.84, 1.08)),
    colorRgb: glacierWhite,
  });

  const outerTrimRingGeo = trackGeo(out, new THREE.TorusGeometry(0.535, 0.018, 6, 32));
  outerTrimRingGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: outerTrimRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.01, 0, 0, 0, 0, 1.0, 1.0, 1.08)),
    colorRgb: platinumTrim,
  });

  const innerStructRingGeo = trackGeo(out, new THREE.TorusGeometry(0.35, 0.042, 8, 28));
  innerStructRingGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: innerStructRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, -0.02, 0)),
    colorRgb: deepOcean,
  });

  const ventralHullPodGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.01, -0.32],
        [0.14, -0.26],
        [0.28, -0.12],
        [0.35, 0.02],
        [0.33, 0.10],
      ],
      18,
    ),
  );
  out.armor.push({
    geo: ventralHullPodGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, -0.04, 0)),
    colorRgb: europaIce,
  });

  const ventralCryoRingGeo = trackGeo(out, new THREE.TorusGeometry(0.22, 0.016, 6, 22));
  ventralCryoRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: ventralCryoRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, -0.20, 0)),
    colorRgb: canopyAqua,
  });

  const spokeGeo = createHorizontalPlate(
    out,
    [
      [-0.046, 0.52],
      [0.046, 0.52],
      [0.046, -0.52],
      [-0.046, -0.52],
    ],
    0.068,
    0.010,
    0.010,
  );
  out.matte.push(
    { geo: spokeGeo, matrix: arkRoot.clone().multiply(makeTransform(0, -0.02, 0)), colorRgb: cryoSlate },
    {
      geo: spokeGeo,
      matrix: arkRoot.clone().multiply(makeTransform(0, -0.02, 0, 0, Math.PI * 0.5, 0)),
      colorRgb: cryoSlate,
    },
  );

  const airlockPodGeo = trackGeo(out, createChamferedHexPart(0.088, 0.092, 0.012));
  airlockPodGeo.rotateX(Math.PI * 0.5);
  const spokeCapGeo = createHorizontalPlate(
    out,
    [
      [-0.065, 0.065],
      [0.065, 0.065],
      [0.065, -0.065],
      [-0.065, -0.065],
    ],
    0.036,
    0.008,
    0.008,
  );
  for (const [ax, az] of [
    [-0.49, 0.0],
    [0.49, 0.0],
    [0.0, -0.52],
  ] as const) {
    out.armor.push({
      geo: airlockPodGeo,
      matrix: arkRoot.clone().multiply(makeTransform(ax, 0.02, az)),
      colorRgb: glacierWhite,
    });
    out.trim.push({
      geo: spokeCapGeo,
      matrix: arkRoot.clone().multiply(makeTransform(ax * 0.84, 0.055, az * 0.84)),
      colorRgb: platinumTrim,
    });
  }

  const forwardProwGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.28],
      [0.14, 0.15],
      [0.18, -0.08],
      [-0.18, -0.08],
      [-0.14, 0.15],
    ],
    0.11,
    0.016,
    0.016,
  );
  out.armor.push({
    geo: forwardProwGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.02, 0.50)),
    colorRgb: glacierWhite,
  });

  const prowVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.112, 0.044, 0.095, 1.62, 0.96, 0.58, 12, 5),
  );
  out.energy.push({
    geo: prowVisorGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.045, 0.65)),
    colorRgb: canopyAqua,
  });

  const domeBaseRingGeo = trackGeo(out, new THREE.CylinderGeometry(0.32, 0.35, 0.09, 22));
  out.trim.push({
    geo: domeBaseRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.10, 0)),
    colorRgb: platinumTrim,
  });

  const domeSealGeo = trackGeo(out, new THREE.TorusGeometry(0.33, 0.018, 8, 26));
  domeSealGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: domeSealGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.14, 0)),
    colorRgb: cryoSlate,
  });

  const domeGlowRingGeo = trackGeo(out, new THREE.TorusGeometry(0.31, 0.010, 6, 26));
  domeGlowRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: domeGlowRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.155, 0)),
    colorRgb: lifeEmerald,
  });

  const bioDomeGeo = trackGeo(
    out,
    new THREE.SphereGeometry(0.325, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.54),
  );
  out.crystal.push({
    geo: bioDomeGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.14, 0)),
    colorRgb: domeIce,
  });

  const domeArchGeo = trackGeo(out, new THREE.TorusGeometry(0.332, 0.011, 6, 20, Math.PI));
  for (let i = 0; i < 4; i += 1) {
    out.trim.push({
      geo: domeArchGeo,
      matrix: arkRoot.clone().multiply(makeTransform(0, 0.14, 0, 0, (i / 4) * Math.PI, 0)),
      colorRgb: platinumTrim,
    });
  }

  const domeApexGeo = trackGeo(out, new THREE.TorusGeometry(0.068, 0.012, 6, 16));
  domeApexGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: domeApexGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.46, 0)),
    colorRgb: platinumTrim,
  });

  const planterDeckGeo = trackGeo(out, new THREE.CylinderGeometry(0.15, 0.19, 0.055, 16));
  out.matte.push({
    geo: planterDeckGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.16, 0)),
    colorRgb: cryoSlate,
  });

  for (let strand = 0; strand < 2; strand += 1) {
    const phase = strand * Math.PI;
    const helixPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 10; k += 1) {
      const t = k / 10;
      const a = phase + t * Math.PI * 2.6;
      const r = 0.056 * (1 - t * 0.24);
      helixPts.push([Math.cos(a) * r, 0.18 + t * 0.24, Math.sin(a) * r]);
    }
    const helixGeo = trackGeo(out, createTaperedTubePart(helixPts, 0.014, 0.009, 12, 6));
    out.energy.push({
      geo: helixGeo,
      matrix: arkRoot,
      colorRgb: strand === 0 ? lifeEmerald : canopyAqua,
    });
  }

  const bioCanopyGeo = trackGeo(out, new THREE.OctahedronGeometry(0.056, 1));
  const bioOffsets: readonly (readonly [number, number, number, number])[] = [
    [0.0, 0.41, 0.0, 1.25],
    [0.11, 0.29, 0.08, 0.92],
    [-0.11, 0.29, 0.08, 0.92],
    [0.10, 0.28, -0.09, 0.88],
    [-0.10, 0.28, -0.09, 0.88],
  ];
  for (const [bx, by, bz, sc] of bioOffsets) {
    out.energy.push({
      geo: bioCanopyGeo,
      matrix: arkRoot.clone().multiply(makeTransform(bx, by, bz, 0, 0, 0, sc, sc * 0.84, sc)),
      colorRgb: sc > 1.0 ? canopyAqua : lifeEmerald,
    });
  }

  const sailBoomGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.024, 0.36, 8));
  sailBoomGeo.rotateZ(Math.PI * 0.5);
  const lightSailGeo = trackGeo(
    out,
    createCreatureFin(0.32, 0.34, 0.14, 0.04, 0.016, 12, 6, europaIce, domeIce),
  );
  const sailFrameRibGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.0, 0.01, 0.10],
        [0.18, 0.03, 0.02],
        [0.32, 0.02, -0.10],
      ],
      0.013,
      0.006,
      8,
      6,
    ),
  );
  const sailMountGeo = trackGeo(out, createChamferedHexPart(0.050, 0.048, 0.008));

  const sailSpecs: readonly (readonly [number, number, number, number])[] = [
    [1, 0.26, 0.30, 0.24],
    [-1, 0.26, 0.30, 0.24],
    [1, -0.28, -0.28, 0.32],
    [-1, -0.28, -0.28, 0.32],
  ];
  for (const [side, sz, yawOff, dihedral] of sailSpecs) {
    const sm = arkRoot
      .clone()
      .multiply(makeTransform(side * 0.40, 0.04, sz, 0, side * yawOff, side * dihedral, side, 1, 1));
    out.matte.push({ geo: sailMountGeo, matrix: sm, colorRgb: cryoSlate });
    out.trim.push({
      geo: sailBoomGeo,
      matrix: sm.clone().multiply(makeTransform(0.16, 0, 0)),
      colorRgb: platinumTrim,
    });
    out.crystal.push({
      geo: lightSailGeo,
      matrix: sm.clone().multiply(makeTransform(0.03, 0, 0)),
      colorRgb: domeIce,
    });
    out.energy.push({
      geo: sailFrameRibGeo,
      matrix: sm,
      colorRgb: lifeEmerald,
    });
  }

  const engineBellGeo = createThrusterBellGeo(out, 0.084, 0.20, 14);
  const engineCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.050, 0.058, 0.07, 12));
  engineCoreGeo.rotateX(Math.PI * 0.5);
  const enginePlumeGeo = createExhaustPlumeGeo(out, 0.056, 0.22, 10);

  for (const side of [-1, 1] as const) {
    const em = arkRoot.clone().multiply(makeTransform(side * 0.24, -0.02, -0.54));
    out.matte.push({ geo: engineBellGeo, matrix: em, colorRgb: cryoSlate });
    out.energy.push({
      geo: engineCoreGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.085)),
      colorRgb: canopyAqua,
    });
    out.crystal.push({
      geo: enginePlumeGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.095)),
      colorRgb: domeIce,
    });
  }

  const habWindowRingGeo = trackGeo(out, new THREE.TorusGeometry(0.485, 0.013, 6, 30));
  habWindowRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: habWindowRingGeo,
    matrix: arkRoot.clone().multiply(makeTransform(0, 0.048, 0, 0, 0, 0, 1.0, 1.0, 1.08)),
    colorRgb: canopyAqua,
  });

  const star3SailArcGeo = trackGeo(out, createCurvedBladePart(0.58, 0.095, 0.022, 0.16, 0.05, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3SailArcGeo,
        matrix: arkRoot.clone().multiply(makeTransform(side * 0.46, 0.34, -0.10, -0.16, side * 0.20, -side * 0.46, side, 1, 1)),
        colorRgb: platinumTrim,
      },
      {
        geo: star3SailArcGeo,
        matrix: arkRoot.clone().multiply(makeTransform(side * 0.54, 0.14, -0.20, -0.10, side * 0.28, -side * 0.84, side * 0.82, 0.82, 0.82)),
        colorRgb: platinumTrim,
      },
    );
  }

  out.headTopLocalY = 1.62;
  out.weaponGlowHex = 0x3ef0c6;
  out.crystalHex = 0x7ce6ff;
  out.crystalOpacity = 0.42;
  out.crystalIntensity = 0.48;
}

function buildS32Entropy(out: UnitBlueprintParts): void {
  const obsidianRed: RgbTriple = [0.24, 0.06, 0.10];
  const liquidCrimson: RgbTriple = [0.60, 0.11, 0.18];
  const scorchedGraphite: RgbTriple = [0.10, 0.11, 0.15];
  const darkChrome: RgbTriple = [0.76, 0.78, 0.84];
  const crimsonChrome: RgbTriple = [0.84, 0.22, 0.28];
  const scarletEnergy: RgbTriple = [1.0, 0.24, 0.32];
  const whiteScarlet: RgbTriple = [1.0, 0.72, 0.70];

  const craftRoot = makeTransform(0, 1.06, 0.02, 0.20, 0, 0);

  const spindleCoreGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.004, 0.74],
        [0.068, 0.56],
        [0.142, 0.26],
        [0.180, -0.04],
        [0.162, -0.34],
        [0.102, -0.54],
        [0.036, -0.66],
      ],
      18,
    ),
  );
  spindleCoreGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: spindleCoreGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.04, 0.80, 1.0)),
    colorRgb: obsidianRed,
  });

  const dorsalCarapaceGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.66],
      [0.10, 0.36],
      [0.15, -0.02],
      [0.12, -0.42],
      [0.0, -0.56],
      [-0.12, -0.42],
      [-0.15, -0.02],
      [-0.10, 0.36],
    ],
    0.075,
    0.016,
    0.016,
  );
  out.armor.push({
    geo: dorsalCarapaceGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0.08, -0.02)),
    colorRgb: liquidCrimson,
  });

  const cheekCowlingGeo = createSideProfilePlate(
    out,
    [
      [0.52, 0.04],
      [0.14, 0.10],
      [-0.36, 0.09],
      [-0.44, -0.06],
      [0.34, -0.06],
    ],
    0.042,
    0.010,
    0.010,
  );
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: cheekCowlingGeo,
      matrix: craftRoot.clone().multiply(makeTransform(side * 0.165, 0.0, -0.02, 0, -side * 0.08, 0)),
      colorRgb: obsidianRed,
    });
  }

  const keelBladeGeo = createSideProfilePlate(
    out,
    [
      [0.62, 0.0],
      [0.24, -0.16],
      [-0.40, -0.18],
      [-0.58, -0.04],
      [-0.44, 0.04],
      [0.46, 0.04],
    ],
    0.056,
    0.010,
    0.010,
  );
  out.matte.push({
    geo: keelBladeGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, -0.05, 0.0)),
    colorRgb: scorchedGraphite,
  });

  const bowOpticalSlitGeo = trackGeo(
    out,
    createCurvedVisorPart(0.115, 0.036, 0.14, 1.56, 1.00, 0.54, 12, 5),
  );
  out.energy.push({
    geo: bowOpticalSlitGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0.055, 0.35)),
    colorRgb: whiteScarlet,
  });

  const meridianSlitGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.88, 8));
  meridianSlitGeo.rotateX(Math.PI * 0.5);
  out.energy.push(
    {
      geo: meridianSlitGeo,
      matrix: craftRoot.clone().multiply(makeTransform(0, 0.14, -0.04)),
      colorRgb: scarletEnergy,
    },
    {
      geo: meridianSlitGeo,
      matrix: craftRoot.clone().multiply(makeTransform(0, -0.14, -0.04)),
      colorRgb: scarletEnergy,
    },
  );

  const dorsalCrestSpineGeo = createSideProfilePlate(
    out,
    [
      [0.52, 0.02],
      [0.12, 0.12],
      [-0.44, 0.16],
      [-0.54, 0.04],
      [-0.42, 0.0],
      [0.44, 0.0],
    ],
    0.026,
    0.006,
    0.006,
  );
  out.trim.push({
    geo: dorsalCrestSpineGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0.11, 0.0)),
    colorRgb: darkChrome,
  });

  const warpRingForeGeo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.018, 8, 24));
  out.trim.push({
    geo: warpRingForeGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, 0.08, 0, 0, 0, 1.08, 0.86, 1.0)),
    colorRgb: darkChrome,
  });

  const warpRingAftGeo = trackGeo(out, new THREE.TorusGeometry(0.26, 0.016, 8, 24));
  out.trim.push({
    geo: warpRingAftGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.22, 0, 0, 0, 1.08, 0.86, 1.0)),
    colorRgb: crimsonChrome,
  });

  const warpFieldRingGeo = trackGeo(out, new THREE.TorusGeometry(0.215, 0.010, 6, 24));
  out.energy.push({
    geo: warpFieldRingGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.07, 0, 0, 0, 1.08, 0.86, 1.0)),
    colorRgb: scarletEnergy,
  });

  const aftEmitterConeGeo = createThrusterBellGeo(out, 0.092, 0.22, 16);
  out.matte.push({
    geo: aftEmitterConeGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.62)),
    colorRgb: scorchedGraphite,
  });

  const aftSingularityOrbGeo = trackGeo(out, new THREE.SphereGeometry(0.068, 12, 10));
  out.energy.push({
    geo: aftSingularityOrbGeo,
    matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.72)),
    colorRgb: whiteScarlet,
  });

  const aftWakeRippleGeo = trackGeo(out, new THREE.TorusGeometry(0.15, 0.012, 6, 20));
  const aftWakeRippleOuterGeo = trackGeo(out, new THREE.TorusGeometry(0.22, 0.010, 6, 22));
  out.crystal.push(
    {
      geo: aftWakeRippleGeo,
      matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.72)),
      colorRgb: scarletEnergy,
    },
    {
      geo: aftWakeRippleOuterGeo,
      matrix: craftRoot.clone().multiply(makeTransform(0, 0, -0.80)),
      colorRgb: scarletEnergy,
    },
  );

  const wingBladeArmorGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.14],
      [0.42, -0.05],
      [0.48, -0.15],
      [0.26, -0.18],
      [0.0, -0.06],
    ],
    0.032,
    0.008,
    0.008,
  );
  const wingLeadingTrimGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.02, 0.0, 0.12],
        [0.25, 0.01, 0.02],
        [0.46, 0.0, -0.14],
      ],
      0.015,
      0.006,
      10,
      6,
    ),
  );
  const wingEdgeLaserGeo = createHorizontalPlate(
    out,
    [
      [0.05, 0.16],
      [0.50, -0.14],
      [0.44, -0.19],
      [0.04, 0.06],
    ],
    0.014,
    0.004,
    0.004,
  );
  const wingFieldMembraneGeo = trackGeo(
    out,
    createCreatureFin(0.20, 0.34, 0.14, 0.02, 0.010, 10, 6, liquidCrimson, scarletEnergy),
  );
  const wingRootNodeGeo = trackGeo(out, createChamferedHexPart(0.046, 0.042, 0.006));
  const wingTetherBeamGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.14, 0.0, -0.04],
        [0.24, 0.0, -0.02],
      ],
      0.010,
      0.007,
      6,
      6,
    ),
  );

  const formationTiers: readonly (readonly [number, number, number, number, number, number])[] = [
    [0.23, 0.24, 0.04, 0.12, -0.12, 0.62],
    [0.26, 0.0, -0.08, 0.0, -0.06, 0.10],
    [0.23, -0.22, -0.18, -0.10, -0.14, -0.54],
  ];

  for (const side of [-1, 1] as const) {
    for (let t = 0; t < formationTiers.length; t += 1) {
      const [wx, wy, wz, rx, ry, rz] = formationTiers[t]!;
      const sc = t === 1 ? 1.06 : t === 0 ? 0.96 : 0.88;
      const wm = craftRoot.clone().multiply(
        makeTransform(side * wx, wy, wz, rx, side * ry, side * rz, side * sc, sc, sc),
      );
      out.armor.push({
        geo: wingBladeArmorGeo,
        matrix: wm,
        colorRgb: t === 1 ? liquidCrimson : obsidianRed,
      });
      out.trim.push({
        geo: wingLeadingTrimGeo,
        matrix: wm,
        colorRgb: t === 1 ? darkChrome : crimsonChrome,
      });
      out.matte.push({
        geo: wingRootNodeGeo,
        matrix: wm.clone().multiply(makeTransform(0.04, 0, 0.02)),
        colorRgb: scorchedGraphite,
      });
      out.energy.push({
        geo: wingEdgeLaserGeo,
        matrix: wm.clone().multiply(makeTransform(0.02, 0.008, 0.02)),
        colorRgb: scarletEnergy,
      });
      out.crystal.push({
        geo: wingFieldMembraneGeo,
        matrix: wm.clone().multiply(makeTransform(0.06, 0.0, -0.04)),
        colorRgb: scarletEnergy,
      });
      out.energy.push({
        geo: wingTetherBeamGeo,
        matrix: craftRoot.clone().multiply(makeTransform(0, wy * 0.48, wz * 0.48, 0, 0, side * rz * 0.5, side, 1, 1)),
        colorRgb: whiteScarlet,
      });
    }
  }

  const star3WarpBladeGeo = trackGeo(out, createCurvedBladePart(0.64, 0.095, 0.020, 0.18, 0.04, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3WarpBladeGeo,
        matrix: craftRoot.clone().multiply(makeTransform(side * 0.40, 0.34, -0.14, -0.18, -side * 0.20, -side * 0.62, side, 1, 1)),
        colorRgb: crimsonChrome,
      },
      {
        geo: star3WarpBladeGeo,
        matrix: craftRoot.clone().multiply(makeTransform(side * 0.44, -0.18, -0.24, -0.12, -side * 0.26, -side * 1.24, side * 0.86, 0.86, 0.86)),
        colorRgb: darkChrome,
      },
    );
  }

  out.headTopLocalY = 1.78;
  out.weaponGlowHex = 0xff2842;
  out.crystalHex = 0xff445e;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.58;
}

function buildS34AzureDragon(out: UnitBlueprintParts): void {
  const imperialEmerald: RgbTriple = [0.14, 0.56, 0.44];
  const deepCeladon: RgbTriple = [0.10, 0.37, 0.32];
  const jadeIron: RgbTriple = [0.12, 0.19, 0.22];
  const antiqueBronze: RgbTriple = [0.80, 0.62, 0.32];
  const burnishedGold: RgbTriple = [0.92, 0.78, 0.46];
  const jadeEnergy: RgbTriple = [0.30, 0.96, 0.78];
  const whiteJade: RgbTriple = [0.80, 1.0, 0.94];

  const gateCenterY = 1.08;
  const gateZ = -0.34;
  const gateRadius = 0.66;

  const gatePlinthGeo = createHorizontalPlate(
    out,
    [
      [-0.44, 0.16],
      [0.44, 0.16],
      [0.52, -0.02],
      [0.40, -0.16],
      [-0.40, -0.16],
      [-0.52, -0.02],
    ],
    0.15,
    0.018,
    0.018,
  );
  out.matte.push({
    geo: gatePlinthGeo,
    matrix: makeTransform(0, 0.24, gateZ),
    colorRgb: jadeIron,
  });

  const buttressGeo = createSideProfilePlate(
    out,
    [
      [0.14, 0.0],
      [0.08, 0.34],
      [-0.12, 0.30],
      [-0.14, 0.0],
    ],
    0.062,
    0.010,
    0.010,
  );
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: buttressGeo,
      matrix: makeTransform(side * 0.38, 0.30, gateZ, 0, 0, -side * 0.26),
      colorRgb: antiqueBronze,
    });
  }

  const gateOuterRingGeo = trackGeo(out, new THREE.TorusGeometry(gateRadius, 0.062, 10, 32));
  out.trim.push({
    geo: gateOuterRingGeo,
    matrix: makeTransform(0, gateCenterY, gateZ),
    colorRgb: antiqueBronze,
  });

  const gateInnerTrackGeo = trackGeo(out, new THREE.TorusGeometry(gateRadius - 0.065, 0.032, 8, 30));
  out.matte.push({
    geo: gateInnerTrackGeo,
    matrix: makeTransform(0, gateCenterY, gateZ),
    colorRgb: jadeIron,
  });

  const gateGlowRingGeo = trackGeo(out, new THREE.TorusGeometry(gateRadius - 0.105, 0.016, 6, 30));
  out.energy.push({
    geo: gateGlowRingGeo,
    matrix: makeTransform(0, gateCenterY, gateZ + 0.014),
    colorRgb: jadeEnergy,
  });

  const gateHorizonDiscGeo = trackGeo(out, new THREE.CylinderGeometry(gateRadius - 0.12, gateRadius - 0.12, 0.020, 26));
  gateHorizonDiscGeo.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: gateHorizonDiscGeo,
    matrix: makeTransform(0, gateCenterY, gateZ),
    colorRgb: jadeEnergy,
  });

  const portalVortexRingGeo = trackGeo(out, new THREE.TorusGeometry(0.36, 0.011, 6, 24));
  out.energy.push({
    geo: portalVortexRingGeo,
    matrix: makeTransform(0, gateCenterY, gateZ + 0.024),
    colorRgb: whiteJade,
  });

  const chevronGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.058, -0.052],
        [0.058, -0.052],
        [0.076, 0.036],
        [0.0, 0.088],
        [-0.076, 0.036],
      ],
      0.12,
      0.011,
      0.011,
      1,
      2,
    ),
  );
  const chevronLockGeo = trackGeo(out, new THREE.OctahedronGeometry(0.030, 0));
  for (let i = 0; i < 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2 + Math.PI * 0.5;
    const cx = Math.cos(ang) * gateRadius;
    const cy = gateCenterY + Math.sin(ang) * gateRadius;
    const cm = makeTransform(cx, cy, gateZ + 0.01, 0, 0, ang - Math.PI * 0.5);
    out.trim.push({ geo: chevronGeo, matrix: cm, colorRgb: i % 2 === 0 ? burnishedGold : antiqueBronze });
    if (i === 0 || i === 1 || i === 7) {
      out.energy.push({
        geo: chevronLockGeo,
        matrix: cm.clone().multiply(makeTransform(0, 0.026, 0.068)),
        colorRgb: whiteJade,
      });
    }
  }

  const shipRoot = makeTransform(0, gateCenterY, 0.14, 0.06, 0, 0);

  const shipCoreSpindleGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.006, 0.72],
        [0.064, 0.58],
        [0.126, 0.34],
        [0.158, 0.04],
        [0.152, -0.30],
        [0.128, -0.56],
        [0.078, -0.68],
      ],
      12,
    ),
  );
  shipCoreSpindleGeo.rotateX(Math.PI * 0.5);
  out.matte.push({ geo: shipCoreSpindleGeo, matrix: shipRoot, colorRgb: jadeIron });

  const hullSegmentGeo = trackGeo(out, createChamferedHexPart(0.18, 0.17, 0.016));
  const jointRingGeo = trackGeo(out, new THREE.TorusGeometry(0.184, 0.015, 6, 18));
  const segSpecs: readonly (readonly [number, number, RgbTriple])[] = [
    [-0.40, 0.88, deepCeladon],
    [-0.20, 0.96, imperialEmerald],
    [0.02, 1.04, deepCeladon],
    [0.22, 0.96, imperialEmerald],
    [0.42, 0.80, imperialEmerald],
  ];
  for (const [sz, sc, col] of segSpecs) {
    out.armor.push({
      geo: hullSegmentGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, sz, 0, 0, 0, sc * 1.08, sc * 0.86, 1.0)),
      colorRgb: col,
    });
    out.trim.push({
      geo: jointRingGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, sz + 0.09, 0, 0, 0, sc * 1.05, sc * 0.86, 1.0)),
      colorRgb: antiqueBronze,
    });
  }

  const prowSensorSpireGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.032, 0.24, 10));
  prowSensorSpireGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: prowSensorSpireGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0, 0.78)),
    colorRgb: burnishedGold,
  });

  const dorsalBridgeGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.24],
      [0.09, 0.14],
      [0.11, -0.14],
      [-0.11, -0.14],
      [-0.09, 0.14],
    ],
    0.095,
    0.014,
    0.014,
  );
  out.armor.push({
    geo: dorsalBridgeGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.165, 0.22)),
    colorRgb: imperialEmerald,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.090, 0.042, 0.098, 1.60, 0.96, 0.56, 12, 5),
  );
  out.energy.push({
    geo: bridgeVisorGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.172, 0.34)),
    colorRgb: whiteJade,
  });

  const warpRingGeo = trackGeo(out, new THREE.TorusGeometry(0.35, 0.019, 8, 28));
  const warpGlowRingGeo = trackGeo(out, new THREE.TorusGeometry(0.326, 0.010, 6, 26));
  const warpStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.015, 0.015, 0.68, 8));

  for (const [wz, sc] of [
    [-0.14, 1.04],
    [0.10, 0.98],
    [0.34, 0.84],
  ] as const) {
    out.trim.push({
      geo: warpRingGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, wz, 0, 0, 0, sc, sc, 1.0)),
      colorRgb: burnishedGold,
    });
    out.energy.push({
      geo: warpGlowRingGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, wz, 0, 0, 0, sc, sc, 1.0)),
      colorRgb: jadeEnergy,
    });
    out.matte.push({
      geo: warpStrutGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0, wz, 0, 0, Math.PI * 0.5, 1.0, sc, 1.0)),
      colorRgb: jadeIron,
    });
  }

  const dorsalFinGeo = createSideProfilePlate(
    out,
    [
      [0.16, 0.0],
      [-0.12, 0.22],
      [-0.40, 0.16],
      [-0.32, 0.0],
    ],
    0.032,
    0.008,
    0.008,
  );
  out.armor.push({
    geo: dorsalFinGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.175, -0.06)),
    colorRgb: deepCeladon,
  });

  const sideWingSailGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.20],
      [0.42, -0.02],
      [0.44, -0.20],
      [0.22, -0.28],
      [0.0, -0.16],
    ],
    0.038,
    0.010,
    0.010,
  );
  const sideWingVaneGeo = trackGeo(
    out,
    createCreatureFin(0.30, 0.40, 0.16, 0.03, 0.014, 12, 6, jadeEnergy, whiteJade),
  );
  const warpNacelleGeo = trackGeo(out, createChamferedHexPart(0.068, 0.34, 0.010));
  const nacelleGlowGeo = trackGeo(out, new THREE.SphereGeometry(0.038, 8, 6));
  const hullSensorMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.018, 0.18, 8));
  hullSensorMastGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: sideWingSailGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.15, 0.0, -0.04, 0, 0, -side * 0.12, side, 1, 1)),
      colorRgb: imperialEmerald,
    });
    out.crystal.push({
      geo: sideWingVaneGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.20, 0.02, -0.08, 0, 0, -side * 0.12, side, 1, 1)),
      colorRgb: jadeEnergy,
    });
    out.armor.push({
      geo: warpNacelleGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.34, -0.04, -0.16)),
      colorRgb: deepCeladon,
    });
    out.energy.push({
      geo: nacelleGlowGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.34, -0.04, 0.02)),
      colorRgb: whiteJade,
    });
    out.trim.push({
      geo: hullSensorMastGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.11, 0.15, 0.44)),
      colorRgb: burnishedGold,
    });
  }

  const star3GateArcGeo = trackGeo(out, createCurvedBladePart(0.68, 0.11, 0.024, 0.20, 0.05, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3GateArcGeo,
        matrix: makeTransform(side * 0.58, 1.44, gateZ - 0.04, -0.12, -side * 0.18, -side * 0.42, side, 1, 1),
        colorRgb: burnishedGold,
      },
      {
        geo: star3GateArcGeo,
        matrix: makeTransform(side * 0.64, 1.04, gateZ - 0.06, -0.08, -side * 0.24, -side * 0.92, side * 0.86, 0.86, 0.86),
        colorRgb: antiqueBronze,
      },
    );
  }

  out.headTopLocalY = 2.00;
  out.weaponGlowHex = 0x38f2c4;
  out.crystalHex = 0x56f6cf;
  out.crystalOpacity = 0.40;
  out.crystalIntensity = 0.52;
}

function buildS35Cassini(out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.17, 0.26, 0.44];
  const steelIndigo: RgbTriple = [0.26, 0.39, 0.58];
  const warmBronze: RgbTriple = [0.80, 0.62, 0.34];
  const agedBrass: RgbTriple = [0.90, 0.76, 0.48];
  const hullGunmetal: RgbTriple = [0.15, 0.18, 0.24];
  const hexCyan: RgbTriple = [0.38, 0.86, 0.98];
  const coreWhite: RgbTriple = [0.88, 0.97, 1.0];

  const shipRoot = makeTransform(0, 0.94, 0.0, 0.14, 0, 0);

  const hammerheadGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.62],
      [0.44, 0.54],
      [0.58, 0.34],
      [0.50, 0.14],
      [0.24, 0.08],
      [-0.24, 0.08],
      [-0.50, 0.14],
      [-0.58, 0.34],
      [-0.44, 0.54],
    ],
    0.25,
    0.026,
    0.024,
  );
  out.armor.push({ geo: hammerheadGeo, matrix: shipRoot, colorRgb: starIndigo });

  const hammerGlacisGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.54],
      [0.36, 0.46],
      [0.46, 0.30],
      [0.38, 0.16],
      [-0.38, 0.16],
      [-0.46, 0.30],
      [-0.36, 0.46],
    ],
    0.085,
    0.016,
    0.016,
  );
  out.trim.push({
    geo: hammerGlacisGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.155, 0.0)),
    colorRgb: warmBronze,
  });

  const centralSpineGeo = createHorizontalPlate(
    out,
    [
      [0.22, 0.22],
      [0.24, -0.32],
      [0.18, -0.52],
      [-0.18, -0.52],
      [-0.24, -0.32],
      [-0.22, 0.22],
    ],
    0.22,
    0.022,
    0.020,
  );
  out.armor.push({ geo: centralSpineGeo, matrix: shipRoot, colorRgb: steelIndigo });

  const ventralArmorKeelGeo = createSideProfilePlate(
    out,
    [
      [0.52, -0.04],
      [0.26, -0.22],
      [-0.42, -0.22],
      [-0.54, -0.06],
      [-0.46, 0.06],
      [0.44, 0.06],
    ],
    0.24,
    0.016,
    0.016,
  );
  out.matte.push({
    geo: ventralArmorKeelGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, -0.09, 0.0)),
    colorRgb: hullGunmetal,
  });

  const sternBlockGeo = createHorizontalPlate(
    out,
    [
      [0.28, -0.20],
      [0.56, -0.28],
      [0.58, -0.52],
      [0.42, -0.60],
      [-0.42, -0.60],
      [-0.58, -0.52],
      [-0.56, -0.28],
      [-0.28, -0.20],
    ],
    0.24,
    0.022,
    0.022,
  );
  out.armor.push({ geo: sternBlockGeo, matrix: shipRoot, colorRgb: starIndigo });

  const sternTrimDeckGeo = createHorizontalPlate(
    out,
    [
      [0.24, -0.26],
      [0.46, -0.32],
      [0.46, -0.50],
      [-0.46, -0.50],
      [-0.46, -0.32],
      [-0.24, -0.26],
    ],
    0.075,
    0.012,
    0.012,
  );
  out.trim.push({
    geo: sternTrimDeckGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.14, 0.0)),
    colorRgb: warmBronze,
  });

  const centrifugeRingGeo = trackGeo(out, new THREE.TorusGeometry(0.46, 0.052, 10, 30));
  out.armor.push({
    geo: centrifugeRingGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.08)),
    colorRgb: steelIndigo,
  });

  const centrifugeTrimGeo = trackGeo(out, new THREE.TorusGeometry(0.505, 0.015, 6, 30));
  out.trim.push({
    geo: centrifugeTrimGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.08)),
    colorRgb: agedBrass,
  });

  const centrifugeWindowGeo = trackGeo(out, new THREE.TorusGeometry(0.465, 0.012, 6, 30));
  out.energy.push({
    geo: centrifugeWindowGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.045)),
    colorRgb: coreWhite,
  });

  const centrifugeHubCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.020, 8, 22));
  out.trim.push({
    geo: centrifugeHubCollarGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.08)),
    colorRgb: warmBronze,
  });

  const centrifugeSpokeGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 0.88, 8));
  out.matte.push(
    {
      geo: centrifugeSpokeGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.08, 0, 0, Math.PI * 0.25)),
      colorRgb: hullGunmetal,
    },
    {
      geo: centrifugeSpokeGeo,
      matrix: shipRoot.clone().multiply(makeTransform(0, 0.02, -0.08, 0, 0, -Math.PI * 0.25)),
      colorRgb: hullGunmetal,
    },
  );

  const prowBumperGeo = createSideProfilePlate(
    out,
    [
      [0.50, 0.11],
      [0.54, -0.08],
      [0.14, -0.11],
      [0.14, 0.11],
    ],
    0.075,
    0.012,
    0.012,
  );
  const sideTurretBaseGeo = trackGeo(out, createChamferedHexPart(0.082, 0.072, 0.010));
  sideTurretBaseGeo.rotateX(Math.PI * 0.5);
  const sideBarrelGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.28, 8));
  sideBarrelGeo.rotateX(Math.PI * 0.5);
  const sternSensorPodGeo = trackGeo(out, createChamferedHexPart(0.072, 0.11, 0.010));
  const hangarStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.28, 8));
  hangarStripGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: prowBumperGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.57, 0.0, 0.0)),
      colorRgb: agedBrass,
    });
    const stMat = shipRoot.clone().multiply(makeTransform(side * 0.38, 0.21, 0.34));
    out.armor.push({ geo: sideTurretBaseGeo, matrix: stMat, colorRgb: steelIndigo });
    out.matte.push({
      geo: sideBarrelGeo,
      matrix: stMat.clone().multiply(makeTransform(0, 0.01, 0.16)),
      colorRgb: hullGunmetal,
    });
    out.armor.push({
      geo: sternSensorPodGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.48, 0.16, -0.38)),
      colorRgb: steelIndigo,
    });
    out.energy.push({
      geo: hangarStripGeo,
      matrix: shipRoot.clone().multiply(makeTransform(side * 0.58, 0.0, -0.40)),
      colorRgb: hexCyan,
    });
  }

  const bowSiegeRingGeo = trackGeo(out, new THREE.TorusGeometry(0.112, 0.022, 8, 20));
  out.trim.push({
    geo: bowSiegeRingGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, -0.01, 0.62)),
    colorRgb: agedBrass,
  });
  const bowSiegeCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.082, 14, 12));
  out.energy.push({
    geo: bowSiegeCoreGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, -0.01, 0.59)),
    colorRgb: coreWhite,
  });

  const mainTurretHouseGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.19],
      [0.18, 0.13],
      [0.20, -0.14],
      [-0.20, -0.14],
      [-0.18, 0.13],
    ],
    0.14,
    0.016,
    0.016,
  );
  const turretRoot = shipRoot.clone().multiply(makeTransform(0, 0.25, 0.34));
  out.armor.push({ geo: mainTurretHouseGeo, matrix: turretRoot, colorRgb: starIndigo });

  const turretCapGeo = trackGeo(out, createChamferedHexPart(0.135, 0.055, 0.010));
  turretCapGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: turretCapGeo,
    matrix: turretRoot.clone().multiply(makeTransform(0, 0.085, -0.02)),
    colorRgb: warmBronze,
  });

  const mainBarrelGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.044, 0.0],
        [0.042, 0.16],
        [0.032, 0.20],
        [0.029, 0.44],
        [0.038, 0.48],
        [0.022, 0.51],
      ],
      12,
    ),
  );
  mainBarrelGeo.rotateX(Math.PI * 0.5);
  const muzzleGlowGeo = trackGeo(out, new THREE.TorusGeometry(0.032, 0.008, 6, 14));

  for (const bx of [-0.095, 0.0, 0.095] as const) {
    const bm = turretRoot.clone().multiply(makeTransform(bx, 0.015, 0.10, -0.06, 0, 0));
    out.matte.push({ geo: mainBarrelGeo, matrix: bm, colorRgb: hullGunmetal });
    out.energy.push({
      geo: muzzleGlowGeo,
      matrix: bm.clone().multiply(makeTransform(0, 0, 0.44)),
      colorRgb: hexCyan,
    });
  }

  const citadelTowerGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.19],
      [0.18, 0.12],
      [0.20, -0.19],
      [-0.20, -0.19],
      [-0.18, 0.12],
    ],
    0.26,
    0.018,
    0.018,
  );
  out.armor.push({
    geo: citadelTowerGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.28, -0.32)),
    colorRgb: starIndigo,
  });

  const bridgeHeadGeo = createHorizontalPlate(
    out,
    [
      [0.0, 0.18],
      [0.28, 0.11],
      [0.30, -0.08],
      [0.18, -0.16],
      [-0.18, -0.16],
      [-0.30, -0.08],
      [-0.28, 0.11],
    ],
    0.15,
    0.016,
    0.016,
  );
  out.armor.push({
    geo: bridgeHeadGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.50, -0.32)),
    colorRgb: steelIndigo,
  });

  const bridgeWindowGeo = trackGeo(
    out,
    createCurvedVisorPart(0.24, 0.052, 0.11, 1.56, 1.02, 0.54, 14, 5),
  );
  out.energy.push({
    geo: bridgeWindowGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.51, -0.20)),
    colorRgb: coreWhite,
  });

  const radarMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.044, 0.28, 10));
  out.matte.push({
    geo: radarMastGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.70, -0.32)),
    colorRgb: hullGunmetal,
  });

  const astrolabeRingA = trackGeo(out, new THREE.TorusGeometry(0.195, 0.016, 8, 26));
  out.trim.push({
    geo: astrolabeRingA,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.82, -0.32, 0.34, 0.22, 0.18)),
    colorRgb: agedBrass,
  });

  const astrolabeDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.01, 0.0],
        [0.08, 0.02],
        [0.13, 0.06],
        [0.14, 0.08],
      ],
      16,
    ),
  );
  out.trim.push({
    geo: astrolabeDishGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.82, -0.28, 1.02, 0, 0)),
    colorRgb: warmBronze,
  });

  const radarBeaconGeo = trackGeo(out, new THREE.OctahedronGeometry(0.050, 1));
  out.energy.push({
    geo: radarBeaconGeo,
    matrix: shipRoot.clone().multiply(makeTransform(0, 0.82, -0.32)),
    colorRgb: hexCyan,
  });

  const engineBellGeo = createThrusterBellGeo(out, 0.110, 0.24, 14);
  const engineRingGeo = trackGeo(out, new THREE.TorusGeometry(0.114, 0.018, 6, 18));
  const engineCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.064, 0.074, 0.08, 12));
  engineCoreGeo.rotateX(Math.PI * 0.5);
  const enginePlumeGeo = createExhaustPlumeGeo(out, 0.070, 0.24, 10);

  const enginePositions: readonly (readonly [number, number, number])[] = [
    [-0.18, 0.06, -0.62],
    [0.18, 0.06, -0.62],
    [-0.44, -0.02, -0.58],
    [0.44, -0.02, -0.58],
  ];
  for (const [ex, ey, ez] of enginePositions) {
    const em = shipRoot.clone().multiply(makeTransform(ex, ey, ez));
    out.matte.push({ geo: engineBellGeo, matrix: em, colorRgb: hullGunmetal });
    out.trim.push({
      geo: engineRingGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.05)),
      colorRgb: warmBronze,
    });
    out.energy.push({
      geo: engineCoreGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.10)),
      colorRgb: coreWhite,
    });
    out.crystal.push({
      geo: enginePlumeGeo,
      matrix: em.clone().multiply(makeTransform(0, 0, -0.11)),
      colorRgb: hexCyan,
    });
  }

  const star3DreadFinGeo = trackGeo(out, createCurvedBladePart(0.66, 0.11, 0.026, 0.18, 0.05, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3DreadFinGeo,
        matrix: shipRoot.clone().multiply(makeTransform(side * 0.48, 0.44, -0.36, -0.22, side * 0.24, -side * 0.52, side, 1, 1)),
        colorRgb: agedBrass,
      },
      {
        geo: star3DreadFinGeo,
        matrix: shipRoot.clone().multiply(makeTransform(side * 0.60, 0.16, -0.44, -0.14, side * 0.32, -side * 0.88, side * 0.84, 0.84, 0.84)),
        colorRgb: warmBronze,
      },
    );
  }

  out.headTopLocalY = 2.12;
  out.weaponGlowHex = 0x46d8fc;
  out.crystalHex = 0x62dcff;
  out.crystalOpacity = 0.44;
  out.crystalIntensity = 0.48;
}

function buildS36AbyssCrown(out: UnitBlueprintParts): void {
  const eventHorizonBlack: RgbTriple = [0.015, 0.015, 0.03];
  const obsidianCharcoal: RgbTriple = [0.14, 0.11, 0.16];
  const deepCrimsonAlloy: RgbTriple = [0.48, 0.09, 0.15];
  const scorchedIron: RgbTriple = [0.10, 0.09, 0.13];
  const bloodBronze: RgbTriple = [0.78, 0.34, 0.24];
  const crimsonTrim: RgbTriple = [0.86, 0.20, 0.24];
  const blazingScarlet: RgbTriple = [1.0, 0.24, 0.18];
  const moltenGoldRed: RgbTriple = [1.0, 0.62, 0.32];

  const coreY = 1.06;
  const coreZ = 0.0;
  const discTilt = makeTransform(0, coreY, coreZ, 0.34, 0.12, -0.24);

  const blackHoleGeo = trackGeo(out, new THREE.SphereGeometry(0.215, 22, 18));
  out.matte.push({
    geo: blackHoleGeo,
    matrix: makeTransform(0, coreY, coreZ),
    colorRgb: eventHorizonBlack,
  });

  const lensingShellGeo = trackGeo(out, new THREE.SphereGeometry(0.262, 18, 14));
  out.crystal.push({
    geo: lensingShellGeo,
    matrix: makeTransform(0, coreY, coreZ),
    colorRgb: blazingScarlet,
  });

  const photonRingGeo = trackGeo(out, new THREE.TorusGeometry(0.242, 0.016, 8, 30));
  photonRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: photonRingGeo,
    matrix: discTilt,
    colorRgb: moltenGoldRed,
  });

  const einsteinArcGeo = trackGeo(out, new THREE.TorusGeometry(0.285, 0.015, 8, 30));
  out.energy.push({
    geo: einsteinArcGeo,
    matrix: makeTransform(0, coreY, coreZ - 0.02, 0.08, 0, 0),
    colorRgb: blazingScarlet,
  });

  const accretionDiscGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.255, 0.0],
        [0.36, 0.018],
        [0.48, 0.024],
        [0.56, 0.008],
        [0.48, -0.014],
        [0.34, -0.010],
      ],
      30,
    ),
  );
  out.crystal.push({
    geo: accretionDiscGeo,
    matrix: discTilt,
    colorRgb: blazingScarlet,
  });

  const outerAccretionRingGeo = trackGeo(out, new THREE.TorusGeometry(0.50, 0.016, 8, 32));
  outerAccretionRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: outerAccretionRingGeo,
    matrix: discTilt,
    colorRgb: blazingScarlet,
  });

  for (let s = 0; s < 3; s += 1) {
    const phase = (s / 3) * Math.PI * 2;
    const spiralPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 10; k += 1) {
      const t = k / 10;
      const a = phase + t * Math.PI * 1.48;
      const r = 0.53 - t * 0.25;
      const y = Math.sin(t * Math.PI * 2 + phase) * 0.022;
      spiralPts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    const spiralGeo = trackGeo(out, createTaperedTubePart(spiralPts, 0.013, 0.005, 12, 6));
    out.energy.push({
      geo: spiralGeo,
      matrix: discTilt,
      colorRgb: s === 0 ? moltenGoldRed : blazingScarlet,
    });
  }

  const ringSpecs: readonly (readonly [number, number, number, number, number, RgbTriple])[] = [
    [0.58, 0.032, 0.16, 0.10, 0.08, obsidianCharcoal],
    [0.49, 0.027, -0.58, 0.44, 0.28, deepCrimsonAlloy],
    [0.40, 0.023, 0.86, -0.52, -0.34, obsidianCharcoal],
  ];

  for (let idx = 0; idx < ringSpecs.length; idx += 1) {
    const [rad, tube, rx, ry, rz, col] = ringSpecs[idx]!;
    const rm = makeTransform(0, coreY, coreZ, rx, ry, rz);
    const mainRingGeo = trackGeo(out, new THREE.TorusGeometry(rad, tube, 8, 32));
    out.armor.push({ geo: mainRingGeo, matrix: rm, colorRgb: col });

    const trimRingGeo = trackGeo(out, new THREE.TorusGeometry(rad + tube * 0.82, tube * 0.36, 6, 30));
    out.trim.push({
      geo: trimRingGeo,
      matrix: rm,
      colorRgb: idx === 1 ? bloodBronze : crimsonTrim,
    });

    const lockCoilGeo = trackGeo(out, new THREE.TorusGeometry(rad - tube * 0.72, tube * 0.24, 6, 28));
    out.energy.push({
      geo: lockCoilGeo,
      matrix: rm,
      colorRgb: blazingScarlet,
    });
  }

  const outerRingMat = makeTransform(0, coreY, coreZ, 0.16, 0.10, 0.08);
  const clampBlockGeo = trackGeo(out, createChamferedHexPart(0.056, 0.082, 0.009));
  const emitterNeedleGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.028, -0.05],
        [0.024, 0.03],
        [0.014, 0.14],
        [0.004, 0.22],
      ],
      8,
    ),
  );
  const needleTipGeo = trackGeo(out, new THREE.OctahedronGeometry(0.019, 0));

  for (let i = 0; i < 12; i += 1) {
    const ang = (i / 12) * Math.PI * 2;
    const isMajor = i % 3 === 0;
    const bx = Math.cos(ang) * 0.58;
    const by = Math.sin(ang) * 0.58;
    const nm = outerRingMat
      .clone()
      .multiply(makeTransform(bx, by, 0, 0, 0, ang - Math.PI * 0.5));
    out.trim.push({
      geo: emitterNeedleGeo,
      matrix: nm.clone().multiply(makeTransform(0, 0.03, 0, 0, 0, 0, isMajor ? 1.15 : 0.88, isMajor ? 1.18 : 0.88, isMajor ? 1.15 : 0.88)),
      colorRgb: isMajor ? bloodBronze : crimsonTrim,
    });
    if (isMajor) {
      out.armor.push({
        geo: clampBlockGeo,
        matrix: nm,
        colorRgb: deepCrimsonAlloy,
      });
      out.energy.push({
        geo: needleTipGeo,
        matrix: nm.clone().multiply(makeTransform(0, 0.28, 0)),
        colorRgb: moltenGoldRed,
      });
    } else {
      out.energy.push({
        geo: needleTipGeo,
        matrix: nm.clone().multiply(makeTransform(0, 0.22, 0, 0, 0, 0, 0.78, 0.78, 0.78)),
        colorRgb: blazingScarlet,
      });
    }
  }

  const polarAnchorGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.012, -0.10],
        [0.088, -0.05],
        [0.145, 0.02],
        [0.105, 0.09],
        [0.036, 0.12],
      ],
      12,
    ),
  );
  out.matte.push(
    {
      geo: polarAnchorGeo,
      matrix: outerRingMat.clone().multiply(makeTransform(0, -0.60, 0)),
      colorRgb: scorchedIron,
    },
    {
      geo: polarAnchorGeo,
      matrix: outerRingMat.clone().multiply(makeTransform(0, 0.60, 0, Math.PI, 0, 0)),
      colorRgb: scorchedIron,
    },
  );

  const forwardCollimatorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.16, 0.020, 8, 22));
  out.trim.push({
    geo: forwardCollimatorRingGeo,
    matrix: makeTransform(0, coreY, 0.48),
    colorRgb: bloodBronze,
  });

  const forwardCollimatorLensGeo = trackGeo(out, new THREE.OctahedronGeometry(0.058, 1));
  out.energy.push({
    geo: forwardCollimatorLensGeo,
    matrix: makeTransform(0, coreY, 0.51),
    colorRgb: moltenGoldRed,
  });

  const star3HorizonArcGeo = trackGeo(out, createCurvedBladePart(0.68, 0.11, 0.024, 0.20, 0.05, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push(
      {
        geo: star3HorizonArcGeo,
        matrix: makeTransform(side * 0.52, 1.46, -0.20, -0.16, -side * 0.20, -side * 0.44, side, 1, 1),
        colorRgb: bloodBronze,
      },
      {
        geo: star3HorizonArcGeo,
        matrix: makeTransform(side * 0.60, 1.06, -0.24, -0.10, -side * 0.26, -side * 0.96, side * 0.86, 0.86, 0.86),
        colorRgb: crimsonTrim,
      },
    );
  }

  out.headTopLocalY = 2.08;
  out.weaponGlowHex = 0xff2c24;
  out.crystalHex = 0xff3c2e;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.62;
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
