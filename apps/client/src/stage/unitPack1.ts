import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
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

function pushFusionBell(
  out: UnitBlueprintParts,
  pos: readonly [number, number, number],
  outerRadius: number,
  length: number,
  shroudColor: RgbTriple,
  plumeColor: RgbTriple,
  rx = 0,
  ry = 0,
  rz = 0,
): void {
  const bellGeo = trackGeo(
    out,
    createLathePart(
      [
        [outerRadius * 0.52, length * 0.5],
        [outerRadius * 0.70, length * 0.2],
        [outerRadius * 0.96, -length * 0.3],
        [outerRadius, -length * 0.5],
        [outerRadius * 0.78, -length * 0.45],
        [outerRadius * 0.54, length * 0.22],
      ],
      14,
    ),
  );
  bellGeo.rotateX(Math.PI * 0.5);

  const plumeGeo = trackGeo(out, new THREE.ConeGeometry(outerRadius * 0.62, length * 1.12, 12));
  plumeGeo.rotateX(-Math.PI * 0.5);

  const base = makeTransform(pos[0], pos[1], pos[2], rx, ry, rz);
  out.trim.push({ geo: bellGeo, matrix: base, colorRgb: shroudColor });
  out.energy.push({
    geo: plumeGeo,
    matrix: base.clone().multiply(makeTransform(0, 0, -length * 0.54)),
    colorRgb: plumeColor,
  });
}

function pushOrbitalWingVanes(
  out: UnitBlueprintParts,
  y: number,
  z: number,
  spanX: number,
  length: number,
  color: RgbTriple,
): void {
  const vaneGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.08],
        [length, -0.15],
        [length * 1.06, 0.08],
        [0.04, 0.12],
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
      geo: vaneGeo,
      matrix: makeTransform(side * spanX, y, z, -0.16, -side * 0.22, side * 0.28, side, 1, 1),
      colorRgb: color,
    });
  }
}

function buildS01(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const solarGold: RgbTriple = [0.83, 0.66, 0.35];
  const deepCopper: RgbTriple = [0.64, 0.39, 0.21];
  const forgeIron: RgbTriple = [0.19, 0.18, 0.19];
  const machinedBrass: RgbTriple = [0.90, 0.76, 0.45];
  const fusionAmber: RgbTriple = [0.98, 0.64, 0.22];
  const shieldGlass: RgbTriple = [0.96, 0.80, 0.44];

  const mainHullGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.30, -0.44],
        [0.30, -0.44],
        [0.38, -0.10],
        [0.34, 0.30],
        [-0.34, 0.30],
        [-0.38, -0.10],
      ],
      0.42,
      0.036,
      0.036,
      2,
      6,
    ),
  );
  mainHullGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: mainHullGeo,
    matrix: makeTransform(0, 0.78, -0.06),
    colorRgb: deepCopper,
  });

  const shieldCenterGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.26, -0.34],
        [0.26, -0.34],
        [0.34, -0.16],
        [0.34, 0.18],
        [0.22, 0.36],
        [-0.22, 0.36],
        [-0.34, 0.18],
        [-0.34, -0.16],
      ],
      0.13,
      0.032,
      0.030,
      2,
      6,
    ),
  );
  out.armor.push({
    geo: shieldCenterGeo,
    matrix: makeTransform(0, 0.78, 0.44, -0.14, 0, 0),
    colorRgb: solarGold,
  });

  const shieldCheekGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.30],
        [0.22, -0.24],
        [0.26, 0.16],
        [0.14, 0.32],
        [0.0, 0.34],
      ],
      0.11,
      0.024,
      0.024,
      2,
      6,
    ),
  );

  const ramRibGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.035, -0.26],
        [0.035, -0.26],
        [0.042, 0.24],
        [-0.042, 0.24],
      ],
      0.06,
      0.012,
      0.012,
      2,
      4,
    ),
  );

  const shieldBoltGeo = trackGeo(out, new THREE.CylinderGeometry(0.034, 0.038, 0.06, 6));
  shieldBoltGeo.rotateX(Math.PI * 0.5);

  const shieldBraceGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.042, 0.32, 8));
  shieldBraceGeo.rotateX(Math.PI * 0.5);

  const upperStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.030, 0.26, 8));
  upperStrutGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: shieldCheekGeo,
      matrix: makeTransform(side * 0.29, 0.78, 0.39, -0.12, -side * 0.44, 0, side, 1, 1),
      colorRgb: solarGold,
    });
    out.trim.push({
      geo: ramRibGeo,
      matrix: makeTransform(side * 0.16, 0.78, 0.51, -0.14, 0, 0),
      colorRgb: machinedBrass,
    });
    out.trim.push(
      {
        geo: shieldBoltGeo,
        matrix: makeTransform(side * 0.24, 0.98, 0.48, -0.14, 0, 0),
        colorRgb: machinedBrass,
      },
      {
        geo: shieldBoltGeo,
        matrix: makeTransform(side * 0.24, 0.58, 0.52, -0.14, 0, 0),
        colorRgb: machinedBrass,
      },
    );
    out.matte.push(
      {
        geo: shieldBraceGeo,
        matrix: makeTransform(side * 0.26, 0.68, 0.26),
        colorRgb: forgeIron,
      },
      {
        geo: upperStrutGeo,
        matrix: makeTransform(side * 0.22, 0.96, 0.24, 0.22, 0, 0),
        colorRgb: forgeIron,
      },
    );
  }

  const shieldCoreGeo = trackGeo(out, createChamferedHexPart(0.14, 0.04, 0.012));
  out.crystal.push({
    geo: shieldCoreGeo,
    matrix: makeTransform(0, 0.78, 0.53, -0.14, 0, 0),
    colorRgb: shieldGlass,
  });

  const shieldSlotGeo = trackGeo(out, new THREE.CylinderGeometry(0.068, 0.068, 0.03, 6));
  shieldSlotGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: shieldSlotGeo,
    matrix: makeTransform(0, 0.78, 0.52, -0.14, 0, 0),
    colorRgb: fusionAmber,
  });

  const bridgeDeckGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.24],
        [0.22, -0.24],
        [0.18, 0.22],
        [-0.18, 0.22],
      ],
      0.16,
      0.022,
      0.022,
      2,
      6,
    ),
  );
  bridgeDeckGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: bridgeDeckGeo,
    matrix: makeTransform(0, 1.08, -0.02),
    colorRgb: solarGold,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.16, 0.060, 0.12, 1.48, 0.96, 0.56, 12, 6),
  );
  out.crystal.push({
    geo: bridgeVisorGeo,
    matrix: makeTransform(0, 1.11, 0.16),
    colorRgb: shieldGlass,
  });

  const bridgeGlowGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.11, 0.036, 10));
  out.energy.push({
    geo: bridgeGlowGeo,
    matrix: makeTransform(0, 1.11, 0.14),
    colorRgb: fusionAmber,
  });

  const dockingCollarGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.13, 0.09, 12));
  out.trim.push({
    geo: dockingCollarGeo,
    matrix: makeTransform(0, 1.21, -0.12),
    colorRgb: machinedBrass,
  });

  const sensorMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.020, 0.18, 8));
  out.trim.push({
    geo: sensorMastGeo,
    matrix: makeTransform(0.12, 1.24, -0.14),
    colorRgb: machinedBrass,
  });

  const craneBoomGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8));
  craneBoomGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: craneBoomGeo,
    matrix: makeTransform(-0.14, 1.20, -0.10, -0.26, 0, 0),
    colorRgb: forgeIron,
  });

  const ventralTrussGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.26, -0.36],
        [0.26, -0.36],
        [0.24, 0.28],
        [-0.24, 0.28],
      ],
      0.12,
      0.018,
      0.018,
      2,
      4,
    ),
  );
  ventralTrussGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: ventralTrussGeo,
    matrix: makeTransform(0, 0.49, -0.04),
    colorRgb: forgeIron,
  });

  const ventralAirlockGeo = trackGeo(out, new THREE.CylinderGeometry(0.12, 0.14, 0.07, 12));
  out.trim.push({
    geo: ventralAirlockGeo,
    matrix: makeTransform(0, 0.40, -0.04),
    colorRgb: machinedBrass,
  });

  const radFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.18],
        [0.24, -0.24],
        [0.26, 0.18],
        [0.0, 0.22],
      ],
      0.028,
      0.007,
      0.007,
      2,
      4,
    ),
  );

  const manifoldPipeGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.022, 0.48, 8));
  manifoldPipeGeo.rotateX(Math.PI * 0.5);

  const thermalGlowBarGeo = trackGeo(out, new THREE.CylinderGeometry(0.013, 0.013, 0.42, 6));
  thermalGlowBarGeo.rotateX(Math.PI * 0.5);

  const rcsBlockGeo = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.052, 0.10, 8));
  rcsBlockGeo.rotateX(Math.PI * 0.5);
  const rcsGlowGeo = trackGeo(out, new THREE.SphereGeometry(0.028, 8, 6));

  for (const side of [-1, 1] as const) {
    for (const fy of [0.60, 0.78, 0.96]) {
      out.armor.push({
        geo: radFinGeo,
        matrix: makeTransform(side * 0.36, fy, -0.14, 0, Math.PI * 0.5, -side * 0.18, side, 1, 1),
        colorRgb: deepCopper,
      });
    }
    out.trim.push({
      geo: manifoldPipeGeo,
      matrix: makeTransform(side * 0.39, 0.84, -0.12),
      colorRgb: machinedBrass,
    });
    out.energy.push({
      geo: thermalGlowBarGeo,
      matrix: makeTransform(side * 0.39, 0.70, -0.12),
      colorRgb: fusionAmber,
    });
    for (const ry of [0.56, 1.00]) {
      out.matte.push({
        geo: rcsBlockGeo,
        matrix: makeTransform(side * 0.34, ry, -0.44),
        colorRgb: forgeIron,
      });
      out.energy.push({
        geo: rcsGlowGeo,
        matrix: makeTransform(side * 0.34, ry, -0.50),
        colorRgb: fusionAmber,
      });
    }
    out.matte.push({
      geo: rcsBlockGeo,
      matrix: makeTransform(side * 0.36, 0.78, 0.14, 0, side * Math.PI * 0.5, 0),
      colorRgb: forgeIron,
    });
  }

  pushFusionBell(out, [0, 0.94, -0.54], 0.115, 0.20, machinedBrass, fusionAmber);
  pushFusionBell(out, [-0.17, 0.66, -0.54], 0.115, 0.20, machinedBrass, fusionAmber);
  pushFusionBell(out, [0.17, 0.66, -0.54], 0.115, 0.20, machinedBrass, fusionAmber);

  pushOrbitalWingVanes(out, 1.08, -0.26, 0.42, 0.46, machinedBrass);

  out.headTopLocalY = 1.48;
  out.weaponGlowHex = 0xf59e2d;
  out.crystalHex = 0xf8c864;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.46;
}

function buildS02(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const solarGold: RgbTriple = [0.90, 0.74, 0.36];
  const goldEdge: RgbTriple = [0.74, 0.56, 0.24];
  const copperBus: RgbTriple = [0.68, 0.44, 0.24];
  const titaniumFrame: RgbTriple = [0.68, 0.72, 0.78];
  const darkCarbon: RgbTriple = [0.17, 0.19, 0.22];
  const repairCyan: RgbTriple = [0.30, 0.86, 0.96];
  const lensTint: RgbTriple = [0.72, 0.94, 1.0];

  const mainBusGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.32],
        [0.16, -0.30],
        [0.21, -0.18],
        [0.22, 0.16],
        [0.17, 0.28],
        [0.11, 0.32],
        [0.001, 0.32],
      ],
      16,
    ),
  );
  out.armor.push({
    geo: mainBusGeo,
    matrix: makeTransform(0, 0.84, -0.02),
    colorRgb: copperBus,
  });

  const busRingGeo = trackGeo(out, new THREE.TorusGeometry(0.224, 0.018, 8, 20));
  busRingGeo.rotateX(Math.PI * 0.5);
  for (const by of [0.68, 0.84, 1.00]) {
    out.trim.push({
      geo: busRingGeo,
      matrix: makeTransform(0, by, -0.02),
      colorRgb: titaniumFrame,
    });
  }

  const topDockGeo = trackGeo(out, new THREE.CylinderGeometry(0.115, 0.135, 0.08, 12));
  out.trim.push({
    geo: topDockGeo,
    matrix: makeTransform(0, 1.18, -0.02),
    colorRgb: solarGold,
  });

  const topDishMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.018, 0.14, 8));
  out.matte.push({
    geo: topDishMastGeo,
    matrix: makeTransform(0, 1.26, -0.08),
    colorRgb: darkCarbon,
  });

  const topDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, 0.0],
        [0.055, 0.012],
        [0.11, 0.045],
        [0.10, 0.050],
        [0.001, 0.018],
      ],
      14,
    ),
  );
  topDishGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: topDishGeo,
    matrix: makeTransform(0, 1.32, -0.06, -0.30, 0, 0),
    colorRgb: titaniumFrame,
  });

  const sensorBezelGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.13, 0.12, 14));
  sensorBezelGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: sensorBezelGeo,
    matrix: makeTransform(0, 0.86, 0.20),
    colorRgb: titaniumFrame,
  });

  const sensorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.014, 8, 18));
  out.trim.push({
    geo: sensorRingGeo,
    matrix: makeTransform(0, 0.86, 0.26),
    colorRgb: solarGold,
  });

  const sensorLensGeo = trackGeo(
    out,
    createCurvedVisorPart(0.10, 0.10, 0.09, 1.85, 0.65, 1.25, 14, 8),
  );
  out.crystal.push({
    geo: sensorLensGeo,
    matrix: makeTransform(0, 0.86, 0.22),
    colorRgb: lensTint,
  });

  const sensorCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.056, 10, 8));
  out.energy.push({
    geo: sensorCoreGeo,
    matrix: makeTransform(0, 0.86, 0.24),
    colorRgb: repairCyan,
  });

  const cryoTankGeo = trackGeo(out, new THREE.CylinderGeometry(0.054, 0.054, 0.30, 10));
  const cryoCapGeo = trackGeo(out, new THREE.SphereGeometry(0.054, 8, 6));
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: cryoTankGeo,
      matrix: makeTransform(side * 0.18, 0.84, -0.17),
      colorRgb: titaniumFrame,
    });
    out.trim.push(
      {
        geo: cryoCapGeo,
        matrix: makeTransform(side * 0.18, 0.99, -0.17),
        colorRgb: solarGold,
      },
      {
        geo: cryoCapGeo,
        matrix: makeTransform(side * 0.18, 0.69, -0.17),
        colorRgb: solarGold,
      },
    );
  }

  const sunshieldGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.26],
        [0.24, 0.10],
        [0.22, -0.22],
        [0.0, -0.28],
        [-0.22, -0.22],
        [-0.24, 0.10],
      ],
      0.020,
      0.006,
      0.006,
      2,
      6,
    ),
  );
  sunshieldGeo.rotateX(Math.PI * 0.5);
  out.armor.push(
    {
      geo: sunshieldGeo,
      matrix: makeTransform(0, 0.50, -0.02),
      colorRgb: solarGold,
    },
    {
      geo: sunshieldGeo,
      matrix: makeTransform(0, 0.45, -0.02, 0, 0, 0, 0.86, 1, 0.86),
      colorRgb: titaniumFrame,
    },
  );

  const ionNozzleGeo = trackGeo(out, new THREE.CylinderGeometry(0.065, 0.092, 0.10, 12));
  out.matte.push({
    geo: ionNozzleGeo,
    matrix: makeTransform(0, 0.38, -0.02),
    colorRgb: darkCarbon,
  });
  const ionGlowGeo = trackGeo(out, new THREE.ConeGeometry(0.052, 0.11, 10));
  ionGlowGeo.rotateX(Math.PI);
  out.energy.push({
    geo: ionGlowGeo,
    matrix: makeTransform(0, 0.28, -0.02),
    colorRgb: repairCyan,
  });

  const wingBoomGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.024, 0.24, 8));
  wingBoomGeo.rotateZ(Math.PI * 0.5);

  const hexPanelGeo = trackGeo(
    out,
    createHexMirrorTilePart(0.122, 0.024, 0.010, 0.006, solarGold, goldEdge),
  );
  const hexBackGeo = trackGeo(out, createChamferedHexPart(0.128, 0.020, 0.007));

  const armSegGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.024, 1.0, 8));
  const armJointGeo = trackGeo(out, new THREE.SphereGeometry(0.032, 8, 6));
  const repairCollarGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.038, 0.06, 8));
  repairCollarGeo.rotateX(Math.PI * 0.5);
  const repairTipGeo = trackGeo(out, new THREE.ConeGeometry(0.032, 0.10, 10));
  repairTipGeo.rotateX(Math.PI * 0.5);
  const wingBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.022, 8, 6));

  for (const side of [-1, 1] as const) {
    out.matte.push(
      {
        geo: wingBoomGeo,
        matrix: makeTransform(side * 0.26, 0.94, -0.04),
        colorRgb: darkCarbon,
      },
      {
        geo: wingBoomGeo,
        matrix: makeTransform(side * 0.26, 0.78, -0.04),
        colorRgb: darkCarbon,
      },
    );

    const wingAnchor = makeTransform(side * 0.36, 0.86, -0.04, 0.06, -side * 0.24, 0);
    const tileOffsets: readonly (readonly [number, number])[] = [
      [0, 0.122],
      [0, -0.122],
      [side * 0.195, 0.0],
    ];
    for (const [ox, oy] of tileOffsets) {
      out.trim.push({
        geo: hexPanelGeo,
        matrix: wingAnchor.clone().multiply(makeTransform(ox, oy, 0.01)),
        colorRgb: solarGold,
      });
      out.matte.push({
        geo: hexBackGeo,
        matrix: wingAnchor.clone().multiply(makeTransform(ox, oy, -0.014)),
        colorRgb: darkCarbon,
      });
    }
    out.energy.push({
      geo: wingBeaconGeo,
      matrix: wingAnchor.clone().multiply(makeTransform(side * 0.30, 0.0, 0.01)),
      colorRgb: repairCyan,
    });

    const p0 = new THREE.Vector3(side * 0.16, 0.62, 0.12);
    const p1 = new THREE.Vector3(side * 0.27, 0.52, 0.29);
    const p2 = new THREE.Vector3(side * 0.19, 0.56, 0.46);
    out.trim.push(
      { geo: armSegGeo, matrix: makeSegmentTransform(p0, p1, 1, 1), colorRgb: titaniumFrame },
      { geo: armSegGeo, matrix: makeSegmentTransform(p1, p2, 0.9, 0.9), colorRgb: titaniumFrame },
      { geo: armJointGeo, matrix: makeTransform(p1.x, p1.y, p1.z), colorRgb: solarGold },
      { geo: repairCollarGeo, matrix: makeTransform(p2.x, p2.y, p2.z), colorRgb: titaniumFrame },
    );
    out.energy.push({
      geo: repairTipGeo,
      matrix: makeTransform(p2.x, p2.y, p2.z + 0.05),
      colorRgb: repairCyan,
    });
  }

  pushOrbitalWingVanes(out, 1.12, -0.18, 0.36, 0.42, solarGold);

  out.headTopLocalY = 1.58;
  out.weaponGlowHex = 0x42dcf5;
  out.crystalHex = 0x8aeaff;
  out.crystalOpacity = 0.56;
  out.crystalIntensity = 0.46;
}

function buildS03(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const ceramicWhite: RgbTriple = [0.92, 0.94, 0.98];
  const coolGrey: RgbTriple = [0.76, 0.82, 0.90];
  const thermalSlate: RgbTriple = [0.18, 0.22, 0.29];
  const titaniumTrim: RgbTriple = [0.70, 0.76, 0.84];
  const warpCyan: RgbTriple = [0.28, 0.88, 1.0];
  const canopyTint: RgbTriple = [0.56, 0.90, 1.0];

  const mainWedgeGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.64],
        [0.15, 0.28],
        [0.48, -0.30],
        [0.42, -0.46],
        [0.16, -0.48],
        [-0.16, -0.48],
        [-0.42, -0.46],
        [-0.48, -0.30],
        [-0.15, 0.28],
      ],
      0.13,
      0.024,
      0.024,
      2,
      6,
    ),
  );
  mainWedgeGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: mainWedgeGeo,
    matrix: makeTransform(0, 0.78, 0.02, -0.10, 0, 0),
    colorRgb: ceramicWhite,
  });

  const dorsalSpineGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.54],
        [0.15, 0.14],
        [0.19, -0.42],
        [-0.19, -0.42],
        [-0.15, 0.14],
      ],
      0.14,
      0.024,
      0.022,
      2,
      6,
    ),
  );
  dorsalSpineGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: dorsalSpineGeo,
    matrix: makeTransform(0, 0.88, 0.0, -0.10, 0, 0),
    colorRgb: coolGrey,
  });

  const bellyTileGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.50],
        [0.24, -0.06],
        [0.34, -0.40],
        [-0.34, -0.40],
        [-0.24, -0.06],
      ],
      0.07,
      0.014,
      0.014,
      2,
      4,
    ),
  );
  bellyTileGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: bellyTileGeo,
    matrix: makeTransform(0, 0.68, 0.0, -0.10, 0, 0),
    colorRgb: thermalSlate,
  });

  const dorsalLouverGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.08, -0.04],
        [0.08, -0.04],
        [0.07, 0.04],
        [-0.07, 0.04],
      ],
      0.026,
      0.005,
      0.005,
      1,
      4,
    ),
  );
  dorsalLouverGeo.rotateX(Math.PI * 0.5);
  for (const lz of [-0.08, -0.20, -0.32]) {
    out.matte.push({
      geo: dorsalLouverGeo,
      matrix: makeTransform(0, 0.98 - lz * 0.10, lz, -0.10, 0, 0),
      colorRgb: thermalSlate,
    });
  }

  const canopyGeo = trackGeo(
    out,
    createCurvedVisorPart(0.11, 0.08, 0.21, 1.52, 0.68, 0.84, 14, 8),
  );
  out.crystal.push({
    geo: canopyGeo,
    matrix: makeTransform(0, 0.95, 0.15, 0.06, 0, 0),
    colorRgb: canopyTint,
  });

  const canopyFrameGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [-0.10, 0.93, 0.08],
        [0.0, 0.99, 0.32],
        [0.10, 0.93, 0.08],
      ],
      0.015,
      0.015,
      12,
      6,
    ),
  );
  out.trim.push({
    geo: canopyFrameGeo,
    matrix: makeTransform(0, 0, 0),
    colorRgb: titaniumTrim,
  });

  const cockpitHudGeo = trackGeo(out, new THREE.SphereGeometry(0.055, 10, 8));
  out.energy.push({
    geo: cockpitHudGeo,
    matrix: makeTransform(0, 0.93, 0.16, 0, 0, 0, 1.2, 0.5, 1.4),
    colorRgb: warpCyan,
  });

  const noseSensorGeo = trackGeo(out, new THREE.ConeGeometry(0.038, 0.18, 8));
  noseSensorGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: noseSensorGeo,
    matrix: makeTransform(0, 0.73, 0.68, -0.10, 0, 0),
    colorRgb: titaniumTrim,
  });

  const noseLidarGeo = trackGeo(out, new THREE.SphereGeometry(0.034, 8, 6));
  out.crystal.push({
    geo: noseLidarGeo,
    matrix: makeTransform(0, 0.72, 0.54),
    colorRgb: canopyTint,
  });

  const dorsalAntennaGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.0],
        [0.12, -0.02],
        [0.16, 0.14],
        [0.05, 0.14],
      ],
      0.016,
      0.004,
      0.004,
      1,
      4,
    ),
  );
  dorsalAntennaGeo.rotateY(Math.PI * 0.5);
  out.trim.push({
    geo: dorsalAntennaGeo,
    matrix: makeTransform(0, 1.02, -0.24),
    colorRgb: titaniumTrim,
  });

  const wingRadGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.22],
        [0.20, -0.30],
        [0.17, 0.08],
        [0.0, 0.22],
      ],
      0.022,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  wingRadGeo.rotateX(Math.PI * 0.5);

  const wingTipPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.26, 8));
  wingTipPodGeo.rotateX(Math.PI * 0.5);

  const tailFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.0],
        [0.20, -0.05],
        [0.32, 0.22],
        [0.15, 0.28],
        [0.0, 0.12],
      ],
      0.024,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  tailFinGeo.rotateY(Math.PI * 0.5);

  const slitCowlGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.115, -0.042],
        [0.115, -0.042],
        [0.095, 0.042],
        [-0.095, 0.042],
      ],
      0.12,
      0.010,
      0.010,
      2,
      4,
    ),
  );

  const warpSlitGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.092, -0.020],
        [0.092, -0.020],
        [0.082, 0.020],
        [-0.082, 0.020],
      ],
      0.14,
      0.005,
      0.005,
      1,
      4,
    ),
  );

  const edgeConduitGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.56, 6));
  edgeConduitGeo.rotateX(Math.PI * 0.5);

  const intakePodGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.045, -0.18],
        [0.045, -0.18],
        [0.055, 0.14],
        [0.02, 0.22],
        [-0.02, 0.22],
        [-0.055, 0.14],
      ],
      0.08,
      0.012,
      0.012,
      2,
      4,
    ),
  );
  intakePodGeo.rotateX(Math.PI * 0.5);

  const wingFlapGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.09, -0.04],
        [0.09, -0.04],
        [0.08, 0.04],
        [-0.08, 0.04],
      ],
      0.018,
      0.004,
      0.004,
      1,
      4,
    ),
  );
  wingFlapGeo.rotateX(Math.PI * 0.5);

  const rcsNozzleGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.024, 0.06, 8));
  rcsNozzleGeo.rotateX(Math.PI * 0.5);
  const navLightGeo = trackGeo(out, new THREE.SphereGeometry(0.018, 6, 6));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: wingRadGeo,
      matrix: makeTransform(side * 0.40, 0.82, -0.22, -0.10, 0, -side * 0.08, side, 1, 1),
      colorRgb: ceramicWhite,
    });
    out.trim.push({
      geo: wingTipPodGeo,
      matrix: makeTransform(side * 0.57, 0.80, -0.32, -0.10, 0, 0),
      colorRgb: titaniumTrim,
    });
    out.energy.push({
      geo: navLightGeo,
      matrix: makeTransform(side * 0.57, 0.81, -0.18),
      colorRgb: warpCyan,
    });
    out.matte.push({
      geo: intakePodGeo,
      matrix: makeTransform(side * 0.21, 0.80, 0.04, -0.10, -side * 0.14, 0),
      colorRgb: thermalSlate,
    });
    out.matte.push({
      geo: wingFlapGeo,
      matrix: makeTransform(side * 0.34, 0.85, -0.36, -0.10, 0, 0),
      colorRgb: thermalSlate,
    });
    out.trim.push({
      geo: rcsNozzleGeo,
      matrix: makeTransform(side * 0.24, 0.74, 0.26, -0.10, 0, 0),
      colorRgb: titaniumTrim,
    });
    out.energy.push({
      geo: edgeConduitGeo,
      matrix: makeTransform(side * 0.31, 0.81, -0.02, -0.10, -side * 0.52, 0),
      colorRgb: warpCyan,
    });
    out.armor.push({
      geo: tailFinGeo,
      matrix: makeTransform(side * 0.22, 0.92, -0.32, 0, side * 0.08, -side * 0.46, side, 1, 1),
      colorRgb: ceramicWhite,
    });
    out.trim.push({
      geo: slitCowlGeo,
      matrix: makeTransform(side * 0.16, 0.82, -0.47, -0.10, 0, 0),
      colorRgb: titaniumTrim,
    });
    out.energy.push({
      geo: warpSlitGeo,
      matrix: makeTransform(side * 0.16, 0.82, -0.53, -0.10, 0, 0),
      colorRgb: warpCyan,
    });
    out.crystal.push({
      geo: warpSlitGeo,
      matrix: makeTransform(side * 0.16, 0.82, -0.61, -0.10, 0, 0, 0.82, 0.68, 1.25),
      colorRgb: canopyTint,
    });
    out.matte.push({
      geo: rcsNozzleGeo,
      matrix: makeTransform(side * 0.14, 0.64, -0.18, 0, 0, 0),
      colorRgb: thermalSlate,
    });
  }

  const ventralKeelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.0],
        [0.24, -0.04],
        [0.32, -0.18],
        [0.04, -0.14],
      ],
      0.022,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  ventralKeelGeo.rotateY(Math.PI * 0.5);
  out.matte.push({
    geo: ventralKeelGeo,
    matrix: makeTransform(0, 0.66, -0.24),
    colorRgb: thermalSlate,
  });

  const rearSpineFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.03, -0.14],
        [0.03, -0.14],
        [0.02, 0.14],
        [-0.02, 0.14],
      ],
      0.045,
      0.006,
      0.006,
      1,
      4,
    ),
  );
  rearSpineFinGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: rearSpineFinGeo,
    matrix: makeTransform(0, 0.96, -0.34, -0.10, 0, 0),
    colorRgb: coolGrey,
  });

  const wingStrakeGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.018, -0.18],
        [0.018, -0.18],
        [0.014, 0.16],
        [-0.014, 0.16],
      ],
      0.024,
      0.004,
      0.004,
      1,
      4,
    ),
  );
  wingStrakeGeo.rotateX(Math.PI * 0.5);
  const tailAntGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.012, 0.16, 6));
  const underPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.028, 0.24, 8));
  underPodGeo.rotateX(Math.PI * 0.5);
  const statorFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.012, -0.04],
        [0.012, -0.04],
        [0.010, 0.04],
        [-0.010, 0.04],
      ],
      0.10,
      0.003,
      0.003,
      1,
      4,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.trim.push(
      {
        geo: wingStrakeGeo,
        matrix: makeTransform(side * 0.28, 0.87, -0.18, -0.10, 0, 0),
        colorRgb: titaniumTrim,
      },
      {
        geo: wingStrakeGeo,
        matrix: makeTransform(side * 0.39, 0.86, -0.26, -0.10, 0, 0),
        colorRgb: titaniumTrim,
      },
      {
        geo: tailAntGeo,
        matrix: makeTransform(side * 0.32, 1.12, -0.44, -0.28, 0, -side * 0.22),
        colorRgb: titaniumTrim,
      },
      {
        geo: statorFinGeo,
        matrix: makeTransform(side * 0.16, 0.82, -0.52, -0.10, 0, 0),
        colorRgb: titaniumTrim,
      },
    );
    out.matte.push({
      geo: underPodGeo,
      matrix: makeTransform(side * 0.24, 0.69, -0.06, -0.10, 0, 0),
      colorRgb: thermalSlate,
    });
    out.energy.push({
      geo: navLightGeo,
      matrix: makeTransform(side * 0.24, 0.68, 0.07),
      colorRgb: warpCyan,
    });
  }

  pushOrbitalWingVanes(out, 0.98, -0.28, 0.44, 0.42, titaniumTrim);

  out.headTopLocalY = 1.34;
  out.weaponGlowHex = 0x3ce0ff;
  out.crystalHex = 0x8cecff;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.46;
}

function buildS05(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.18, 0.29, 0.48];
  const deepIndigo: RgbTriple = [0.12, 0.20, 0.35];
  const warmBronze: RgbTriple = [0.80, 0.60, 0.30];
  const polishedBrass: RgbTriple = [0.90, 0.76, 0.44];
  const darkIron: RgbTriple = [0.16, 0.19, 0.25];
  const medGold: RgbTriple = [0.98, 0.80, 0.36];
  const bayCyan: RgbTriple = [0.34, 0.86, 0.94];
  const domeGlass: RgbTriple = [0.78, 0.92, 0.98];

  const stationPivot = makeTransform(0, 0.86, 0.0, -0.18, 0, 0);

  const axialSpineGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.54],
        [0.10, -0.52],
        [0.14, -0.38],
        [0.15, 0.32],
        [0.12, 0.46],
        [0.001, 0.50],
      ],
      16,
    ),
  );
  axialSpineGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: axialSpineGeo,
    matrix: stationPivot,
    colorRgb: starIndigo,
  });

  const hubBearingGeo = trackGeo(out, new THREE.CylinderGeometry(0.185, 0.185, 0.20, 16));
  hubBearingGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: hubBearingGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.02)),
    colorRgb: warmBronze,
  });

  const spineCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.155, 0.016, 8, 18));
  for (const sz of [-0.28, 0.22]) {
    out.trim.push({
      geo: spineCollarGeo,
      matrix: stationPivot.clone().multiply(makeTransform(0, 0, sz)),
      colorRgb: polishedBrass,
    });
  }

  const prowDomeGeo = trackGeo(
    out,
    createCurvedVisorPart(0.13, 0.13, 0.12, 2.20, 0.52, 1.35, 14, 8),
  );
  out.crystal.push({
    geo: prowDomeGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.42)),
    colorRgb: domeGlass,
  });

  const prowBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.064, 10, 8));
  out.energy.push({
    geo: prowBeaconGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.44)),
    colorRgb: bayCyan,
  });

  const airlockCollarGeo = trackGeo(out, new THREE.CylinderGeometry(0.072, 0.082, 0.12, 10));
  const airlockLightGeo = trackGeo(out, new THREE.SphereGeometry(0.022, 8, 6));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: airlockCollarGeo,
      matrix: stationPivot.clone().multiply(makeTransform(side * 0.16, 0, 0.28, 0, 0, Math.PI * 0.5)),
      colorRgb: polishedBrass,
    });
    out.energy.push({
      geo: airlockLightGeo,
      matrix: stationPivot.clone().multiply(makeTransform(side * 0.22, 0, 0.28)),
      colorRgb: bayCyan,
    });
  }

  const gravityRingGeo = trackGeo(out, new THREE.TorusGeometry(0.45, 0.056, 12, 32));
  out.armor.push({
    geo: gravityRingGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.02)),
    colorRgb: starIndigo,
  });

  const outerRimGeo = trackGeo(out, new THREE.TorusGeometry(0.505, 0.016, 8, 32));
  out.trim.push({
    geo: outerRimGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.02)),
    colorRgb: warmBronze,
  });

  const innerRimGeo = trackGeo(out, new THREE.TorusGeometry(0.395, 0.014, 8, 32));
  out.trim.push({
    geo: innerRimGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, 0.02)),
    colorRgb: polishedBrass,
  });

  const secondRingGeo = trackGeo(out, new THREE.TorusGeometry(0.34, 0.024, 8, 28));
  out.trim.push({
    geo: secondRingGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0, -0.18)),
    colorRgb: warmBronze,
  });

  const spokeGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.032, 0.42, 8));
  const spokeCuffGeo = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.044, 0.07, 10));
  const braceRodGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.016, 0.24, 6));

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.trim.push({
      geo: spokeGeo,
      matrix: stationPivot.clone().multiply(
        makeTransform(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0.02, 0, 0, a - Math.PI * 0.5),
      ),
      colorRgb: warmBronze,
    });
    out.matte.push({
      geo: spokeCuffGeo,
      matrix: stationPivot.clone().multiply(
        makeTransform(Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.02, 0, 0, a - Math.PI * 0.5),
      ),
      colorRgb: darkIron,
    });
    out.matte.push({
      geo: braceRodGeo,
      matrix: stationPivot.clone().multiply(
        makeTransform(Math.cos(a) * 0.26, Math.sin(a) * 0.26, -0.10, 0, 0, a - Math.PI * 0.5),
      ),
      colorRgb: darkIron,
    });
  }

  const wardPodGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.072, -0.052],
        [0.072, -0.052],
        [0.082, 0.052],
        [-0.082, 0.052],
      ],
      0.13,
      0.012,
      0.012,
      2,
      4,
    ),
  );
  const wardWindowGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 0.08, 8));
  wardWindowGeo.rotateZ(Math.PI * 0.5);
  const wardRibGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.14, 6));
  wardRibGeo.rotateX(Math.PI * 0.5);

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rx = Math.cos(a) * 0.45;
    const ry = Math.sin(a) * 0.45;
    out.armor.push({
      geo: wardPodGeo,
      matrix: stationPivot.clone().multiply(makeTransform(rx, ry, 0.02, 0, 0, a + Math.PI * 0.5)),
      colorRgb: i % 2 === 0 ? deepIndigo : starIndigo,
    });
    out.energy.push({
      geo: wardWindowGeo,
      matrix: stationPivot.clone().multiply(makeTransform(rx, ry, 0.085, 0, 0, a + Math.PI * 0.5)),
      colorRgb: medGold,
    });
    out.trim.push({
      geo: wardRibGeo,
      matrix: stationPivot.clone().multiply(
        makeTransform(Math.cos(a) * 0.52, Math.sin(a) * 0.52, 0.02),
      ),
      colorRgb: polishedBrass,
    });
  }

  const commDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, 0.0],
        [0.06, 0.01],
        [0.12, 0.05],
        [0.12, 0.065],
        [0.001, 0.02],
      ],
      14,
    ),
  );
  commDishGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: commDishGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0.24, 0.26, -0.25, 0, 0)),
    colorRgb: polishedBrass,
  });

  const commMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.020, 0.22, 8));
  out.matte.push({
    geo: commMastGeo,
    matrix: stationPivot.clone().multiply(makeTransform(0, 0.16, 0.26)),
    colorRgb: darkIron,
  });

  const radPanelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.10],
        [0.28, -0.14],
        [0.28, 0.10],
        [0.0, 0.08],
      ],
      0.020,
      0.005,
      0.005,
      2,
      4,
    ),
  );
  const radFrameGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.30, 6));
  radFrameGeo.rotateZ(Math.PI * 0.5);
  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: radPanelGeo,
      matrix: stationPivot.clone().multiply(
        makeTransform(side * 0.14, 0, -0.34, 0, 0, 0, side, 1, 1),
      ),
      colorRgb: darkIron,
    });
    out.trim.push({
      geo: radFrameGeo,
      matrix: stationPivot.clone().multiply(makeTransform(side * 0.28, 0.10, -0.34)),
      colorRgb: warmBronze,
    });
    pushFusionBell(out, [side * 0.14, 0.78, -0.50], 0.055, 0.12, polishedBrass, bayCyan, -0.18, 0, 0);
  }

  pushFusionBell(out, [0, 0.77, -0.56], 0.105, 0.18, warmBronze, medGold, -0.18, 0, 0);

  pushOrbitalWingVanes(out, 1.12, -0.24, 0.42, 0.44, polishedBrass);

  out.headTopLocalY = 1.54;
  out.weaponGlowHex = 0xf6c252;
  out.crystalHex = 0x8ee4f8;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.44;
}

function buildS06(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const glacierWhite: RgbTriple = [0.80, 0.91, 0.97];
  const abyssBlue: RgbTriple = [0.20, 0.48, 0.67];
  const deepSlate: RgbTriple = [0.14, 0.23, 0.34];
  const brushedTi: RgbTriple = [0.72, 0.80, 0.86];
  const sonarTeal: RgbTriple = [0.28, 0.88, 0.84];
  const domeCrystal: RgbTriple = [0.64, 0.92, 0.98];

  const pressureHullGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.52],
        [0.10, -0.46],
        [0.20, -0.28],
        [0.28, -0.04],
        [0.29, 0.18],
        [0.24, 0.32],
        [0.001, 0.34],
      ],
      20,
    ),
  );
  pressureHullGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: pressureHullGeo,
    matrix: makeTransform(0, 0.80, -0.02),
    colorRgb: glacierWhite,
  });

  const hullCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.255, 0.028, 10, 22));
  out.trim.push({
    geo: hullCollarGeo,
    matrix: makeTransform(0, 0.80, 0.25),
    colorRgb: brushedTi,
  });

  const sternBandGeo = trackGeo(out, new THREE.TorusGeometry(0.278, 0.018, 8, 22));
  out.armor.push({
    geo: sternBandGeo,
    matrix: makeTransform(0, 0.80, -0.08),
    colorRgb: abyssBlue,
  });

  const midBandGeo = trackGeo(out, new THREE.TorusGeometry(0.242, 0.016, 8, 20));
  out.trim.push({
    geo: midBandGeo,
    matrix: makeTransform(0, 0.80, -0.26),
    colorRgb: brushedTi,
  });

  const obsDomeGeo = trackGeo(
    out,
    createCurvedVisorPart(0.24, 0.24, 0.24, 2.55, 0.42, 1.55, 18, 12),
  );
  out.crystal.push({
    geo: obsDomeGeo,
    matrix: makeTransform(0, 0.80, 0.27),
    colorRgb: domeCrystal,
  });

  const domeRibGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0, 0.24, 0.0],
        [0, 0.18, 0.16],
        [0, 0.0, 0.24],
        [0, -0.18, 0.16],
        [0, -0.24, 0.0],
      ],
      0.012,
      0.012,
      12,
      6,
    ),
  );
  for (const rz of [-0.62, 0.62]) {
    out.trim.push({
      geo: domeRibGeo,
      matrix: makeTransform(0, 0.80, 0.27, 0, 0, rz),
      colorRgb: brushedTi,
    });
  }

  const cockpitConsoleGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.14, 0.12, 12));
  out.matte.push({
    geo: cockpitConsoleGeo,
    matrix: makeTransform(0, 0.72, 0.30),
    colorRgb: deepSlate,
  });

  const sonarCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.068, 12, 10));
  out.energy.push({
    geo: sonarCoreGeo,
    matrix: makeTransform(0, 0.82, 0.34),
    colorRgb: sonarTeal,
  });

  const lampHousingGeo = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.052, 0.10, 10));
  lampHousingGeo.rotateX(Math.PI * 0.5);
  const lampLensGeo = trackGeo(out, new THREE.SphereGeometry(0.036, 10, 8));
  const lampOffsets: readonly (readonly [number, number, number])[] = [
    [0, 1.04, 0.26],
    [-0.22, 0.76, 0.30],
    [0.22, 0.76, 0.30],
  ];
  for (const [lx, ly, lz] of lampOffsets) {
    out.trim.push({
      geo: lampHousingGeo,
      matrix: makeTransform(lx, ly, lz),
      colorRgb: brushedTi,
    });
    out.energy.push({
      geo: lampLensGeo,
      matrix: makeTransform(lx, ly, lz + 0.05),
      colorRgb: sonarTeal,
    });
  }

  const conningSailGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.075, -0.22],
        [0.075, -0.22],
        [0.065, 0.16],
        [0.0, 0.24],
        [-0.065, 0.16],
      ],
      0.16,
      0.018,
      0.018,
      2,
      6,
    ),
  );
  conningSailGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: conningSailGeo,
    matrix: makeTransform(0, 1.11, -0.06),
    colorRgb: abyssBlue,
  });

  const hatchCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.064, 0.072, 0.04, 12));
  out.trim.push({
    geo: hatchCapGeo,
    matrix: makeTransform(0, 1.20, -0.02),
    colorRgb: brushedTi,
  });

  const sonarMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.024, 0.20, 8));
  out.trim.push({
    geo: sonarMastGeo,
    matrix: makeTransform(0, 1.26, -0.14),
    colorRgb: brushedTi,
  });

  const mastBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.028, 8, 6));
  out.energy.push({
    geo: mastBeaconGeo,
    matrix: makeTransform(0, 1.36, -0.14),
    colorRgb: sonarTeal,
  });

  const skidBarGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.022, 0.54, 8));
  skidBarGeo.rotateX(Math.PI * 0.5);
  const skidStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.020, 0.16, 8));
  const ballastTankGeo = trackGeo(out, new THREE.CylinderGeometry(0.056, 0.056, 0.36, 10));
  ballastTankGeo.rotateX(Math.PI * 0.5);

  const sampleArmGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.020, 1.0, 8));
  const sampleTipGeo = trackGeo(out, new THREE.SphereGeometry(0.024, 8, 6));

  const midDiveFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.14],
        [0.32, -0.22],
        [0.30, 0.08],
        [0.0, 0.16],
      ],
      0.032,
      0.008,
      0.008,
      2,
      4,
    ),
  );
  midDiveFinGeo.rotateX(Math.PI * 0.5);

  const sonarStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6));
  sonarStripGeo.rotateZ(Math.PI * 0.5);

  const lowerSonarFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.10],
        [0.26, -0.16],
        [0.22, 0.08],
        [0.0, 0.12],
      ],
      0.026,
      0.007,
      0.007,
      2,
      4,
    ),
  );
  lowerSonarFinGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.matte.push(
      {
        geo: skidBarGeo,
        matrix: makeTransform(side * 0.20, 0.48, 0.0),
        colorRgb: deepSlate,
      },
      {
        geo: skidStrutGeo,
        matrix: makeTransform(side * 0.18, 0.56, 0.14, 0, 0, -side * 0.24),
        colorRgb: deepSlate,
      },
      {
        geo: skidStrutGeo,
        matrix: makeTransform(side * 0.18, 0.56, -0.16, 0, 0, -side * 0.24),
        colorRgb: deepSlate,
      },
    );
    out.armor.push({
      geo: ballastTankGeo,
      matrix: makeTransform(side * 0.28, 0.68, 0.02),
      colorRgb: abyssBlue,
    });
    const a0 = new THREE.Vector3(side * 0.18, 0.56, 0.24);
    const a1 = new THREE.Vector3(side * 0.22, 0.50, 0.42);
    out.trim.push(
      { geo: sampleArmGeo, matrix: makeSegmentTransform(a0, a1, 1, 1), colorRgb: brushedTi },
      { geo: sampleTipGeo, matrix: makeTransform(a1.x, a1.y, a1.z), colorRgb: brushedTi },
    );
    out.armor.push({
      geo: midDiveFinGeo,
      matrix: makeTransform(side * 0.26, 0.82, -0.04, 0, 0, -side * 0.08, side, 1, 1),
      colorRgb: abyssBlue,
    });
    out.energy.push({
      geo: sonarStripGeo,
      matrix: makeTransform(side * 0.42, 0.82, 0.08, 0, -side * 0.24, -side * 0.08),
      colorRgb: sonarTeal,
    });
    out.armor.push({
      geo: lowerSonarFinGeo,
      matrix: makeTransform(side * 0.22, 0.62, -0.18, 0, 0, -side * 0.58, side, 1, 1),
      colorRgb: glacierWhite,
    });
  }

  const depthDomeGeo = trackGeo(out, new THREE.SphereGeometry(0.064, 10, 8));
  out.crystal.push({
    geo: depthDomeGeo,
    matrix: makeTransform(0, 0.54, 0.02, 0, 0, 0, 1.0, 0.55, 1.0),
    colorRgb: domeCrystal,
  });

  const sternRudderGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.12],
        [0.20, -0.16],
        [0.18, 0.08],
        [0.0, 0.12],
      ],
      0.024,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  sternRudderGeo.rotateY(Math.PI * 0.5);
  out.armor.push(
    {
      geo: sternRudderGeo,
      matrix: makeTransform(0, 0.96, -0.44),
      colorRgb: abyssBlue,
    },
    {
      geo: sternRudderGeo,
      matrix: makeTransform(0, 0.64, -0.44, Math.PI, 0, 0),
      colorRgb: abyssBlue,
    },
  );

  const pumpShroudGeo = trackGeo(out, new THREE.TorusGeometry(0.145, 0.028, 10, 22));
  out.trim.push({
    geo: pumpShroudGeo,
    matrix: makeTransform(0, 0.80, -0.54),
    colorRgb: brushedTi,
  });

  const statorVaneGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.014, 0.26, 6));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI;
    out.matte.push({
      geo: statorVaneGeo,
      matrix: makeTransform(0, 0.80, -0.54, 0, 0, a),
      colorRgb: deepSlate,
    });
  }

  const rotorHubGeo = trackGeo(out, new THREE.CylinderGeometry(0.048, 0.068, 0.12, 10));
  rotorHubGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: rotorHubGeo,
    matrix: makeTransform(0, 0.80, -0.54),
    colorRgb: deepSlate,
  });

  const jetCoreGeo = trackGeo(out, new THREE.ConeGeometry(0.085, 0.18, 12));
  jetCoreGeo.rotateX(-Math.PI * 0.5);
  out.energy.push({
    geo: jetCoreGeo,
    matrix: makeTransform(0, 0.80, -0.64),
    colorRgb: sonarTeal,
  });

  pushOrbitalWingVanes(out, 1.04, -0.22, 0.36, 0.40, brushedTi);

  out.headTopLocalY = 1.52;
  out.weaponGlowHex = 0x38e2d8;
  out.crystalHex = 0x86e8f6;
  out.crystalOpacity = 0.58;
  out.crystalIntensity = 0.44;
}

function buildS07(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const navyBlue: RgbTriple = [0.18, 0.30, 0.49];
  const deepNavy: RgbTriple = [0.12, 0.21, 0.36];
  const titaniumSilver: RgbTriple = [0.72, 0.77, 0.84];
  const darkFrame: RgbTriple = [0.16, 0.19, 0.25];
  const foilGold: RgbTriple = [0.88, 0.72, 0.38];
  const solarCellBlue: RgbTriple = [0.14, 0.28, 0.52];
  const opticCyan: RgbTriple = [0.36, 0.84, 1.0];
  const sapphireLens: RgbTriple = [0.68, 0.90, 1.0];

  const satBusGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.28],
        [0.22, -0.28],
        [0.26, -0.06],
        [0.26, 0.18],
        [0.16, 0.28],
        [-0.16, 0.28],
        [-0.26, 0.18],
        [-0.26, -0.06],
      ],
      0.34,
      0.026,
      0.026,
      2,
      6,
    ),
  );
  satBusGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: satBusGeo,
    matrix: makeTransform(0, 0.84, -0.06),
    colorRgb: navyBlue,
  });

  const busBandGeo = trackGeo(out, new THREE.CylinderGeometry(0.24, 0.24, 0.04, 8));
  out.trim.push(
    {
      geo: busBandGeo,
      matrix: makeTransform(0, 1.02, -0.06),
      colorRgb: titaniumSilver,
    },
    {
      geo: busBandGeo,
      matrix: makeTransform(0, 0.66, -0.06),
      colorRgb: titaniumSilver,
    },
  );

  const thermalBlanketGeo = trackGeo(out, new THREE.CylinderGeometry(0.18, 0.20, 0.14, 8));
  out.trim.push({
    geo: thermalBlanketGeo,
    matrix: makeTransform(0, 0.58, -0.06),
    colorRgb: foilGold,
  });

  const wheelDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12));
  out.matte.push({
    geo: wheelDrumGeo,
    matrix: makeTransform(0, 0.49, -0.06),
    colorRgb: darkFrame,
  });

  const telescopeTubeGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.112, 0.0],
        [0.122, 0.08],
        [0.118, 0.34],
        [0.130, 0.42],
        [0.110, 0.44],
        [0.094, 0.42],
        [0.094, 0.12],
      ],
      16,
    ),
  );
  telescopeTubeGeo.rotateX(Math.PI * 0.5);

  const tubeClampGeo = trackGeo(out, new THREE.TorusGeometry(0.125, 0.014, 8, 18));
  const apertureRingGeo = trackGeo(out, new THREE.TorusGeometry(0.122, 0.015, 8, 18));
  const baffleDoorGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.08, 0.0],
        [0.08, 0.0],
        [0.07, 0.14],
        [-0.07, 0.14],
      ],
      0.016,
      0.004,
      0.004,
      1,
      4,
    ),
  );
  const primaryLensGeo = trackGeo(
    out,
    createCurvedVisorPart(0.096, 0.096, 0.075, 1.95, 0.62, 1.25, 14, 8),
  );
  const focalSensorGeo = trackGeo(out, new THREE.SphereGeometry(0.052, 10, 8));

  const yokeBoomGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.024, 0.20, 8));
  yokeBoomGeo.rotateZ(Math.PI * 0.5);

  const hingeDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.036, 0.10, 10));

  const solarSubPanelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.20],
        [0.145, -0.20],
        [0.145, 0.20],
        [0.0, 0.20],
      ],
      0.022,
      0.005,
      0.005,
      2,
      4,
    ),
  );

  const solarRailGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.34, 6));
  solarRailGeo.rotateZ(Math.PI * 0.5);

  const starTrackerGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.040, 0.10, 8));
  starTrackerGeo.rotateX(Math.PI * 0.5);
  const wingBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.020, 8, 6));
  const dipoleGeo = trackGeo(out, new THREE.CylinderGeometry(0.009, 0.012, 0.22, 6));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: telescopeTubeGeo,
      matrix: makeTransform(side * 0.155, 0.86, 0.12),
      colorRgb: titaniumSilver,
    });
    out.trim.push(
      {
        geo: tubeClampGeo,
        matrix: makeTransform(side * 0.155, 0.86, 0.30),
        colorRgb: navyBlue,
      },
      {
        geo: apertureRingGeo,
        matrix: makeTransform(side * 0.155, 0.86, 0.54),
        colorRgb: foilGold,
      },
    );
    out.armor.push({
      geo: baffleDoorGeo,
      matrix: makeTransform(side * 0.155, 0.98, 0.54, 0.42, 0, 0),
      colorRgb: deepNavy,
    });
    out.crystal.push({
      geo: primaryLensGeo,
      matrix: makeTransform(side * 0.155, 0.86, 0.48),
      colorRgb: sapphireLens,
    });
    out.energy.push({
      geo: focalSensorGeo,
      matrix: makeTransform(side * 0.155, 0.86, 0.49),
      colorRgb: opticCyan,
    });

    out.matte.push(
      {
        geo: yokeBoomGeo,
        matrix: makeTransform(side * 0.28, 0.84, -0.08),
        colorRgb: darkFrame,
      },
      {
        geo: hingeDrumGeo,
        matrix: makeTransform(side * 0.32, 0.84, -0.08),
        colorRgb: darkFrame,
      },
    );
    const wingBase = makeTransform(side * 0.33, 0.84, -0.08, 0.22, -side * 0.12, 0, side, 1, 1);
    out.armor.push(
      {
        geo: solarSubPanelGeo,
        matrix: wingBase.clone().multiply(makeTransform(0.0, 0, 0)),
        colorRgb: solarCellBlue,
      },
      {
        geo: solarSubPanelGeo,
        matrix: wingBase.clone().multiply(makeTransform(0.165, 0, 0)),
        colorRgb: solarCellBlue,
      },
    );
    out.trim.push(
      {
        geo: solarRailGeo,
        matrix: makeTransform(side * 0.49, 1.03, -0.04, 0, -side * 0.12, 0),
        colorRgb: titaniumSilver,
      },
      {
        geo: solarRailGeo,
        matrix: makeTransform(side * 0.49, 0.65, -0.12, 0, -side * 0.12, 0),
        colorRgb: titaniumSilver,
      },
      {
        geo: starTrackerGeo,
        matrix: makeTransform(side * 0.24, 1.04, 0.04, -0.24, side * 0.18, 0),
        colorRgb: foilGold,
      },
      {
        geo: dipoleGeo,
        matrix: makeTransform(side * 0.18, 1.12, -0.26, -0.30, 0, -side * 0.26),
        colorRgb: titaniumSilver,
      },
    );
    out.energy.push({
      geo: wingBeaconGeo,
      matrix: makeTransform(side * 0.65, 0.84, -0.12),
      colorRgb: opticCyan,
    });
  }

  const bridgeStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.30, 8));
  bridgeStrutGeo.rotateZ(Math.PI * 0.5);
  out.matte.push({
    geo: bridgeStrutGeo,
    matrix: makeTransform(0, 0.86, 0.36),
    colorRgb: darkFrame,
  });

  const dishMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.028, 0.22, 8));
  out.matte.push({
    geo: dishMastGeo,
    matrix: makeTransform(0, 1.12, -0.16, -0.18, 0, 0),
    colorRgb: darkFrame,
  });

  const highGainDishGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, 0.0],
        [0.08, 0.015],
        [0.17, 0.06],
        [0.20, 0.09],
        [0.185, 0.095],
        [0.001, 0.025],
      ],
      16,
    ),
  );
  highGainDishGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: highGainDishGeo,
    matrix: makeTransform(0, 1.24, -0.16, -0.34, 0, 0),
    colorRgb: titaniumSilver,
  });

  const dishFeedGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.024, 0.14, 8));
  dishFeedGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: dishFeedGeo,
    matrix: makeTransform(0, 1.26, -0.06, -0.34, 0, 0),
    colorRgb: foilGold,
  });

  const dishBeaconGeo = trackGeo(out, new THREE.SphereGeometry(0.026, 8, 6));
  out.energy.push({
    geo: dishBeaconGeo,
    matrix: makeTransform(0, 1.29, 0.01),
    colorRgb: opticCyan,
  });

  const rearPackGeo = trackGeo(out, new THREE.CylinderGeometry(0.14, 0.16, 0.18, 10));
  rearPackGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: rearPackGeo,
    matrix: makeTransform(0, 0.84, -0.36),
    colorRgb: deepNavy,
  });

  const solarJointGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 0.42, 6));
  const rcsQuadGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.032, 0.07, 8));
  rcsQuadGeo.rotateX(Math.PI * 0.5);
  const calibLensGeo = trackGeo(out, new THREE.SphereGeometry(0.024, 8, 6));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: solarJointGeo,
      matrix: makeTransform(side * 0.49, 0.84, -0.08, 0.22, -side * 0.12, 0),
      colorRgb: foilGold,
    });
    out.matte.push({
      geo: rcsQuadGeo,
      matrix: makeTransform(side * 0.24, 0.66, -0.22),
      colorRgb: darkFrame,
    });
    out.energy.push({
      geo: calibLensGeo,
      matrix: makeTransform(side * 0.24, 1.04, 0.10),
      colorRgb: opticCyan,
    });
  }
  const ventralDockGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.016, 8, 16));
  ventralDockGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: ventralDockGeo,
    matrix: makeTransform(0, 0.46, -0.06),
    colorRgb: titaniumSilver,
  });
  const rearLouverRingGeo = trackGeo(out, new THREE.TorusGeometry(0.155, 0.014, 8, 16));
  out.matte.push({
    geo: rearLouverRingGeo,
    matrix: makeTransform(0, 0.84, -0.36),
    colorRgb: darkFrame,
  });

  pushFusionBell(out, [0, 0.84, -0.48], 0.082, 0.16, titaniumSilver, opticCyan);

  pushOrbitalWingVanes(out, 1.12, -0.20, 0.36, 0.44, foilGold);

  out.headTopLocalY = 1.60;
  out.weaponGlowHex = 0x48ccff;
  out.crystalHex = 0x8cd8ff;
  out.crystalOpacity = 0.56;
  out.crystalIntensity = 0.46;
}

function buildS08(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const obsidianMirror: RgbTriple = [0.16, 0.12, 0.25];
  const deepObsidian: RgbTriple = [0.10, 0.08, 0.16];
  const mirrorSheen: RgbTriple = [0.46, 0.38, 0.62];
  const darkChrome: RgbTriple = [0.56, 0.50, 0.70];
  const antimatterGlow: RgbTriple = [0.94, 0.28, 0.86];
  const hotViolet: RgbTriple = [0.98, 0.62, 0.96];
  const crystalViolet: RgbTriple = [0.68, 0.36, 0.92];

  const dropletHullGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.001, -0.68],
        [0.020, -0.58],
        [0.048, -0.44],
        [0.095, -0.26],
        [0.158, -0.06],
        [0.215, 0.14],
        [0.244, 0.30],
        [0.238, 0.42],
        [0.202, 0.51],
        [0.136, 0.57],
        [0.058, 0.60],
        [0.001, 0.61],
      ],
      32,
    ),
  );
  dropletHullGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: dropletHullGeo,
    matrix: makeTransform(0, 0.86, 0.02, 0, 0, 0, 1.0, 0.94, 1.0),
    colorRgb: obsidianMirror,
  });

  const mirrorShellGeo = trackGeo(
    out,
    createCurvedVisorPart(0.250, 0.234, 0.250, 2.40, 0.48, 1.48, 20, 12),
  );
  out.crystal.push({
    geo: mirrorShellGeo,
    matrix: makeTransform(0, 0.86, 0.34),
    colorRgb: crystalViolet,
  });

  const equatorialCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.236, 0.010, 8, 28));
  const midSeamGeo = trackGeo(out, new THREE.TorusGeometry(0.194, 0.008, 8, 24));
  const aftSeamGeo = trackGeo(out, new THREE.TorusGeometry(0.118, 0.008, 8, 20));
  out.trim.push(
    {
      geo: equatorialCollarGeo,
      matrix: makeTransform(0, 0.86, 0.24, 0, 0, 0, 1.0, 0.94, 1.0),
      colorRgb: darkChrome,
    },
    {
      geo: midSeamGeo,
      matrix: makeTransform(0, 0.86, 0.06, 0, 0, 0, 1.0, 0.94, 1.0),
      colorRgb: mirrorSheen,
    },
    {
      geo: aftSeamGeo,
      matrix: makeTransform(0, 0.86, -0.18, 0, 0, 0, 1.0, 0.94, 1.0),
      colorRgb: darkChrome,
    },
  );

  const fieldGrooveGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.0, 0.0, 0.46],
        [0.215, 0.0, 0.24],
        [0.165, 0.0, -0.04],
        [0.082, 0.0, -0.34],
        [0.020, 0.0, -0.58],
      ],
      0.011,
      0.005,
      16,
      6,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: fieldGrooveGeo,
      matrix: makeTransform(0, 0.86, 0.02, 0, 0, 0, side, 1, 1),
      colorRgb: antimatterGlow,
    });
  }

  const prowEyeRingGeo = trackGeo(out, new THREE.TorusGeometry(0.082, 0.011, 8, 18));
  out.energy.push({
    geo: prowEyeRingGeo,
    matrix: makeTransform(0, 0.86, 0.56),
    colorRgb: hotViolet,
  });

  const curvatureRingOuterGeo = trackGeo(out, new THREE.TorusGeometry(0.25, 0.018, 10, 28));
  out.trim.push({
    geo: curvatureRingOuterGeo,
    matrix: makeTransform(0, 0.86, -0.44),
    colorRgb: darkChrome,
  });

  const curvatureRingMidGeo = trackGeo(out, new THREE.TorusGeometry(0.21, 0.012, 8, 28));
  out.matte.push({
    geo: curvatureRingMidGeo,
    matrix: makeTransform(0, 0.86, -0.49),
    colorRgb: deepObsidian,
  });

  const curvatureRingGlowGeo = trackGeo(out, new THREE.TorusGeometry(0.215, 0.014, 8, 28));
  out.energy.push({
    geo: curvatureRingGlowGeo,
    matrix: makeTransform(0, 0.86, -0.44),
    colorRgb: antimatterGlow,
  });

  const curvatureDiscGeo = trackGeo(out, new THREE.TorusGeometry(0.155, 0.024, 8, 24));
  out.crystal.push({
    geo: curvatureDiscGeo,
    matrix: makeTransform(0, 0.86, -0.51),
    colorRgb: crystalViolet,
  });

  const tailTipGeo = trackGeo(out, new THREE.ConeGeometry(0.036, 0.22, 12));
  tailTipGeo.rotateX(-Math.PI * 0.5);
  out.energy.push({
    geo: tailTipGeo,
    matrix: makeTransform(0, 0.86, -0.68),
    colorRgb: hotViolet,
  });

  const ringNodeGeo = trackGeo(out, new THREE.OctahedronGeometry(0.026, 0));
  const ringPinGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.012, 0.07, 6));
  ringPinGeo.rotateX(Math.PI * 0.5);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    out.trim.push({
      geo: ringPinGeo,
      matrix: makeTransform(Math.cos(a) * 0.25, 0.86 + Math.sin(a) * 0.25, -0.44),
      colorRgb: darkChrome,
    });
    out.energy.push({
      geo: ringNodeGeo,
      matrix: makeTransform(Math.cos(a) * 0.25, 0.86 + Math.sin(a) * 0.25, -0.48),
      colorRgb: hotViolet,
    });
  }

  const magFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.22],
        [0.48, -0.44],
        [0.52, -0.34],
        [0.18, 0.16],
        [0.0, 0.22],
      ],
      0.018,
      0.005,
      0.005,
      2,
      4,
    ),
  );
  magFinGeo.rotateX(Math.PI * 0.5);

  const finRibGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.04, -0.14],
        [0.34, -0.30],
        [0.36, -0.24],
        [0.06, -0.06],
      ],
      0.026,
      0.004,
      0.004,
      1,
      4,
    ),
  );
  finRibGeo.rotateX(Math.PI * 0.5);

  const finEdgeGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.08, 0, 0.18],
        [0.28, 0, -0.10],
        [0.51, 0, -0.38],
      ],
      0.010,
      0.005,
      10,
      6,
    ),
  );

  const finRootClampGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.024, 0.22, 6));
  finRootClampGeo.rotateX(Math.PI * 0.5);

  const ringPylonGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.016, 0.22, 6));

  const finAngles: readonly number[] = [Math.PI * 0.5, -Math.PI / 6, (-5 * Math.PI) / 6];
  for (const ang of finAngles) {
    const finMat = makeTransform(0, 0.86, -0.22, 0, 0, ang);
    out.armor.push({
      geo: magFinGeo,
      matrix: finMat,
      colorRgb: deepObsidian,
    });
    out.trim.push({
      geo: finRibGeo,
      matrix: finMat,
      colorRgb: mirrorSheen,
    });
    out.matte.push({
      geo: finRootClampGeo,
      matrix: makeTransform(
        Math.cos(ang) * 0.11,
        0.86 + Math.sin(ang) * 0.11,
        -0.16,
        0,
        0,
        ang,
      ),
      colorRgb: deepObsidian,
    });
    out.energy.push({
      geo: finEdgeGeo,
      matrix: finMat,
      colorRgb: antimatterGlow,
    });
    out.matte.push({
      geo: ringPylonGeo,
      matrix: makeTransform(
        Math.cos(ang) * 0.13,
        0.86 + Math.sin(ang) * 0.13,
        -0.44,
        0,
        0,
        ang - Math.PI * 0.5,
      ),
      colorRgb: deepObsidian,
    });
  }

  const dorsalSpineTrimGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0, 1.02, 0.36],
        [0, 1.08, 0.08],
        [0, 0.98, -0.24],
      ],
      0.012,
      0.008,
      10,
      6,
    ),
  );
  out.trim.push(
    {
      geo: dorsalSpineTrimGeo,
      matrix: makeTransform(0, 0, 0),
      colorRgb: mirrorSheen,
    },
    {
      geo: dorsalSpineTrimGeo,
      matrix: makeTransform(0, 1.72, 0, 0, 0, Math.PI),
      colorRgb: mirrorSheen,
    },
  );

  const fluxRailGeo = trackGeo(out, new THREE.CylinderGeometry(0.009, 0.011, 0.32, 6));
  fluxRailGeo.rotateX(Math.PI * 0.5);
  const trailEmitterGeo = trackGeo(out, new THREE.ConeGeometry(0.016, 0.10, 8));
  trailEmitterGeo.rotateX(-Math.PI * 0.5);
  for (const ang of finAngles) {
    const midAng = ang + Math.PI / 3;
    out.trim.push({
      geo: fluxRailGeo,
      matrix: makeTransform(
        Math.cos(midAng) * 0.145,
        0.86 + Math.sin(midAng) * 0.145,
        -0.30,
        Math.sin(midAng) * 0.24,
        -Math.cos(midAng) * 0.24,
        0,
      ),
      colorRgb: darkChrome,
    });
    out.energy.push({
      geo: trailEmitterGeo,
      matrix: makeTransform(
        Math.cos(midAng) * 0.215,
        0.86 + Math.sin(midAng) * 0.215,
        -0.52,
      ),
      colorRgb: antimatterGlow,
    });
  }
  const innerCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.11, 14, 10));
  out.energy.push({
    geo: innerCoreGeo,
    matrix: makeTransform(0, 0.86, 0.42),
    colorRgb: antimatterGlow,
  });
  const tailCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.056, 0.010, 8, 16));
  out.trim.push({
    geo: tailCollarGeo,
    matrix: makeTransform(0, 0.86, -0.56),
    colorRgb: darkChrome,
  });

  const star3BladeGeo = trackGeo(out, createCurvedBladePart(0.56, 0.085, 0.018, 0.18, 0.04, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo: star3BladeGeo,
      matrix: makeTransform(side * 0.36, 0.96, -0.28, -0.20, side * 0.28, -side * 0.54, side, 1, 1),
      colorRgb: darkChrome,
    });
  }

  out.headTopLocalY = 1.52;
  out.weaponGlowHex = 0xe848dc;
  out.crystalHex = 0xb462f5;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.52;
}

function buildS09(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const obsidianHull: RgbTriple = [0.18, 0.14, 0.28];
  const darkSlate: RgbTriple = [0.12, 0.11, 0.18];
  const amethystSteel: RgbTriple = [0.54, 0.46, 0.68];
  const railMagenta: RgbTriple = [0.96, 0.28, 0.74];
  const hotCore: RgbTriple = [1.0, 0.66, 0.90];
  const magCrystal: RgbTriple = [0.76, 0.38, 0.96];

  const railBarGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.048, -0.50],
        [0.048, -0.50],
        [0.042, 0.52],
        [0.012, 0.62],
        [-0.012, 0.62],
        [-0.042, 0.52],
      ],
      0.14,
      0.014,
      0.014,
      2,
      4,
    ),
  );
  railBarGeo.rotateX(Math.PI * 0.5);

  const railEnergyStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.015, 0.015, 0.96, 8));
  railEnergyStripGeo.rotateX(Math.PI * 0.5);

  const railBridgeGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.055],
        [0.22, -0.055],
        [0.19, 0.055],
        [-0.19, 0.055],
      ],
      0.09,
      0.010,
      0.010,
      2,
      4,
    ),
  );

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: railBarGeo,
      matrix: makeTransform(side * 0.14, 0.84, 0.14),
      colorRgb: obsidianHull,
    });
    out.energy.push({
      geo: railEnergyStripGeo,
      matrix: makeTransform(side * 0.088, 0.84, 0.18),
      colorRgb: railMagenta,
    });
  }

  for (const bz of [-0.14, 0.18, 0.48]) {
    out.trim.push(
      {
        geo: railBridgeGeo,
        matrix: makeTransform(0, 0.95, bz),
        colorRgb: amethystSteel,
      },
      {
        geo: railBridgeGeo,
        matrix: makeTransform(0, 0.73, bz),
        colorRgb: amethystSteel,
      },
    );
  }

  const slugCoreGeo = trackGeo(out, createFacetedCrystalPart(0.88, 0.036, 6, 0.66, 0.34));
  slugCoreGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: slugCoreGeo,
    matrix: makeTransform(0, 0.84, 0.26),
    colorRgb: hotCore,
  });

  const coilTorusGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.022, 8, 18));
  coilTorusGeo.rotateY(Math.PI * 0.5);
  const coilGlowGeo = trackGeo(out, new THREE.TorusGeometry(0.085, 0.014, 8, 16));
  coilGlowGeo.rotateY(Math.PI * 0.5);
  const coilStrutGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.028, 0.18, 8));
  coilStrutGeo.rotateZ(Math.PI * 0.5);

  const magFieldPlateGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.08, -0.05],
        [0.08, -0.05],
        [0.08, 0.05],
        [-0.08, 0.05],
      ],
      0.018,
      0.005,
      0.005,
      1,
      4,
    ),
  );

  const sideRadiatorGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.22],
        [0.24, -0.26],
        [0.22, 0.16],
        [0.0, 0.20],
      ],
      0.022,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  sideRadiatorGeo.rotateX(Math.PI * 0.5);

  const muzzleFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.08],
        [0.14, -0.10],
        [0.10, 0.10],
        [0.0, 0.08],
      ],
      0.020,
      0.005,
      0.005,
      1,
      4,
    ),
  );
  muzzleFinGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    for (const cz of [-0.08, 0.16, 0.40]) {
      out.trim.push({
        geo: coilTorusGeo,
        matrix: makeTransform(side * 0.30, 0.84, cz),
        colorRgb: amethystSteel,
      });
      out.energy.push({
        geo: coilGlowGeo,
        matrix: makeTransform(side * 0.30, 0.84, cz),
        colorRgb: railMagenta,
      });
      out.matte.push({
        geo: coilStrutGeo,
        matrix: makeTransform(side * 0.22, 0.84, cz),
        colorRgb: darkSlate,
      });
    }
    out.crystal.push({
      geo: magFieldPlateGeo,
      matrix: makeTransform(side * 0.24, 0.84, 0.16, 0, Math.PI * 0.5, 0, 3.2, 1.0, 1.0),
      colorRgb: magCrystal,
    });
    out.armor.push({
      geo: sideRadiatorGeo,
      matrix: makeTransform(side * 0.26, 0.82, -0.34, 0, 0, -side * 0.16, side, 1, 1),
      colorRgb: obsidianHull,
    });
    out.trim.push({
      geo: muzzleFinGeo,
      matrix: makeTransform(side * 0.18, 0.84, 0.62, 0, 0, 0, side, 1, 1),
      colorRgb: amethystSteel,
    });
  }

  const reactorBlockGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.24, -0.26],
        [0.24, -0.26],
        [0.28, 0.06],
        [0.20, 0.24],
        [-0.20, 0.24],
        [-0.28, 0.06],
      ],
      0.34,
      0.026,
      0.026,
      2,
      6,
    ),
  );
  reactorBlockGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: reactorBlockGeo,
    matrix: makeTransform(0, 0.82, -0.36),
    colorRgb: obsidianHull,
  });

  const reactorBottleGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.11, 0.22, 14));
  out.crystal.push({
    geo: reactorBottleGeo,
    matrix: makeTransform(0, 1.06, -0.36),
    colorRgb: magCrystal,
  });

  const reactorCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.072, 12, 10));
  out.energy.push({
    geo: reactorCoreGeo,
    matrix: makeTransform(0, 1.06, -0.36),
    colorRgb: hotCore,
  });

  const reactorCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.12, 0.13, 0.045, 12));
  out.trim.push({
    geo: reactorCapGeo,
    matrix: makeTransform(0, 1.18, -0.36),
    colorRgb: amethystSteel,
  });

  const radarMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.020, 0.16, 8));
  out.matte.push({
    geo: radarMastGeo,
    matrix: makeTransform(0, 1.24, -0.36),
    colorRgb: darkSlate,
  });

  const fireControlGeo = trackGeo(
    out,
    createCurvedVisorPart(0.10, 0.052, 0.10, 1.44, 0.96, 0.56, 12, 6),
  );
  out.crystal.push({
    geo: fireControlGeo,
    matrix: makeTransform(0, 1.04, -0.14),
    colorRgb: magCrystal,
  });

  const ventralFinGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.20],
        [0.22, -0.26],
        [0.18, 0.12],
        [0.0, 0.16],
      ],
      0.022,
      0.006,
      0.006,
      2,
      4,
    ),
  );
  ventralFinGeo.rotateY(Math.PI * 0.5);
  out.matte.push({
    geo: ventralFinGeo,
    matrix: makeTransform(0, 0.54, -0.34),
    colorRgb: darkSlate,
  });

  pushFusionBell(out, [-0.15, 0.82, -0.60], 0.088, 0.16, amethystSteel, railMagenta);
  pushFusionBell(out, [0.15, 0.82, -0.60], 0.088, 0.16, amethystSteel, railMagenta);

  pushOrbitalWingVanes(out, 1.06, -0.36, 0.34, 0.44, amethystSteel);

  out.headTopLocalY = 1.46;
  out.weaponGlowHex = 0xf244ba;
  out.crystalHex = 0xbe64f8;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.50;
}

function buildS10(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const forgeCopper: RgbTriple = [0.74, 0.38, 0.20];
  const solarGold: RgbTriple = [0.85, 0.67, 0.35];
  const darkIron: RgbTriple = [0.18, 0.17, 0.19];
  const brushedBrass: RgbTriple = [0.90, 0.76, 0.44];
  const railAmber: RgbTriple = [1.0, 0.58, 0.18];
  const thermalGlow: RgbTriple = [1.0, 0.78, 0.34];
  const visorTint: RgbTriple = [0.98, 0.74, 0.36];

  const spineHullGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.52],
        [0.22, -0.52],
        [0.26, 0.26],
        [0.16, 0.52],
        [-0.16, 0.52],
        [-0.26, 0.26],
      ],
      0.26,
      0.026,
      0.026,
      2,
      6,
    ),
  );
  spineHullGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: spineHullGeo,
    matrix: makeTransform(0, 0.66, 0.0),
    colorRgb: forgeCopper,
  });

  const trussBarGeo = trackGeo(out, new THREE.CylinderGeometry(0.024, 0.024, 0.94, 8));
  trussBarGeo.rotateX(Math.PI * 0.5);
  const crossBraceGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 0.32, 6));
  for (const side of [-1, 1] as const) {
    out.matte.push(
      {
        geo: trussBarGeo,
        matrix: makeTransform(side * 0.25, 0.78, -0.02),
        colorRgb: darkIron,
      },
      {
        geo: trussBarGeo,
        matrix: makeTransform(side * 0.25, 0.54, -0.02),
        colorRgb: darkIron,
      },
      {
        geo: crossBraceGeo,
        matrix: makeTransform(side * 0.25, 0.66, 0.18, 0.68, 0, 0),
        colorRgb: darkIron,
      },
      {
        geo: crossBraceGeo,
        matrix: makeTransform(side * 0.25, 0.66, -0.20, -0.68, 0, 0),
        colorRgb: darkIron,
      },
    );
  }

  const bulkheadCollarGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.28, -0.16],
        [0.28, -0.16],
        [0.28, 0.16],
        [-0.28, 0.16],
      ],
      0.06,
      0.012,
      0.012,
      2,
      4,
    ),
  );
  for (const bz of [-0.34, 0.02, 0.30]) {
    out.trim.push({
      geo: bulkheadCollarGeo,
      matrix: makeTransform(0, 0.66, bz),
      colorRgb: brushedBrass,
    });
  }

  const prowRamGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.18, -0.14],
        [0.18, -0.14],
        [0.14, 0.14],
        [-0.14, 0.14],
      ],
      0.14,
      0.020,
      0.020,
      2,
      4,
    ),
  );
  out.armor.push({
    geo: prowRamGeo,
    matrix: makeTransform(0, 0.66, 0.56),
    colorRgb: solarGold,
  });

  const bridgeBlockGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.15, -0.14],
        [0.15, -0.14],
        [0.13, 0.16],
        [-0.13, 0.16],
      ],
      0.14,
      0.018,
      0.018,
      2,
      4,
    ),
  );
  bridgeBlockGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: bridgeBlockGeo,
    matrix: makeTransform(0, 0.86, 0.34),
    colorRgb: solarGold,
  });

  const bridgeVisorGeo = trackGeo(
    out,
    createCurvedVisorPart(0.12, 0.050, 0.09, 1.46, 0.96, 0.56, 12, 6),
  );
  out.crystal.push({
    geo: bridgeVisorGeo,
    matrix: makeTransform(0, 0.88, 0.46),
    colorRgb: visorTint,
  });

  const turretPedestalGeo = trackGeo(out, new THREE.CylinderGeometry(0.24, 0.28, 0.22, 16));
  out.trim.push({
    geo: turretPedestalGeo,
    matrix: makeTransform(0, 0.92, -0.06),
    colorRgb: brushedBrass,
  });

  const turretCabGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.24, -0.28],
        [0.24, -0.28],
        [0.26, 0.16],
        [0.18, 0.28],
        [-0.18, 0.28],
        [-0.26, 0.16],
      ],
      0.34,
      0.028,
      0.028,
      2,
      6,
    ),
  );
  turretCabGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: turretCabGeo,
    matrix: makeTransform(0, 1.18, -0.06),
    colorRgb: solarGold,
  });

  const commandCupolaGeo = trackGeo(out, new THREE.CylinderGeometry(0.12, 0.15, 0.14, 10));
  out.armor.push({
    geo: commandCupolaGeo,
    matrix: makeTransform(0, 1.41, -0.14),
    colorRgb: forgeCopper,
  });

  const fireControlMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.022, 0.18, 8));
  out.trim.push({
    geo: fireControlMastGeo,
    matrix: makeTransform(0, 1.54, -0.18),
    colorRgb: brushedBrass,
  });

  const turretOpticGeo = trackGeo(
    out,
    createCurvedVisorPart(0.14, 0.060, 0.10, 1.42, 0.96, 0.54, 12, 6),
  );
  out.crystal.push({
    geo: turretOpticGeo,
    matrix: makeTransform(0, 1.38, -0.04),
    colorRgb: visorTint,
  });

  const ammoDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.092, 0.092, 0.14, 12));
  ammoDrumGeo.rotateZ(Math.PI * 0.5);
  const recoilCylGeo = trackGeo(out, new THREE.CylinderGeometry(0.028, 0.032, 0.34, 8));
  recoilCylGeo.rotateX(Math.PI * 0.5);

  const railBarrelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.042, -0.10],
        [0.042, -0.10],
        [0.036, 0.68],
        [-0.036, 0.68],
      ],
      0.095,
      0.012,
      0.012,
      2,
      4,
    ),
  );
  railBarrelGeo.rotateX(Math.PI * 0.5);

  const barrelClampGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.068, -0.065],
        [0.068, -0.065],
        [0.068, 0.065],
        [-0.068, 0.065],
      ],
      0.05,
      0.008,
      0.008,
      2,
      4,
    ),
  );

  const railCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.70, 8));
  railCoreGeo.rotateX(Math.PI * 0.5);

  const turretPivot = makeTransform(0, 1.22, 0.14, -0.14, 0, 0);
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: ammoDrumGeo,
      matrix: makeTransform(side * 0.28, 1.18, -0.14),
      colorRgb: brushedBrass,
    });
    out.matte.push({
      geo: recoilCylGeo,
      matrix: turretPivot.clone().multiply(makeTransform(side * 0.12, -0.07, 0.18)),
      colorRgb: darkIron,
    });
    out.armor.push({
      geo: railBarrelGeo,
      matrix: turretPivot.clone().multiply(makeTransform(side * 0.12, 0, 0.04)),
      colorRgb: forgeCopper,
    });
    out.energy.push({
      geo: railCoreGeo,
      matrix: turretPivot.clone().multiply(makeTransform(side * 0.12, 0.02, 0.36)),
      colorRgb: railAmber,
    });
    for (const cz of [0.18, 0.42, 0.62]) {
      out.trim.push({
        geo: barrelClampGeo,
        matrix: turretPivot.clone().multiply(makeTransform(side * 0.12, 0, cz)),
        colorRgb: brushedBrass,
      });
    }
  }

  const radBoomGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.030, 0.22, 8));
  radBoomGeo.rotateZ(Math.PI * 0.5);

  const radPanelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, -0.26],
        [0.36, -0.20],
        [0.33, 0.20],
        [0.0, 0.26],
      ],
      0.028,
      0.007,
      0.007,
      2,
      4,
    ),
  );
  radPanelGeo.rotateX(Math.PI * 0.5);

  const radRibGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.34, 6));
  radRibGeo.rotateZ(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: radBoomGeo,
      matrix: makeTransform(side * 0.29, 0.66, -0.16),
      colorRgb: darkIron,
    });
    out.matte.push({
      geo: radPanelGeo,
      matrix: makeTransform(side * 0.31, 0.66, -0.16, 0, 0, -side * 0.24, side, 1, 1),
      colorRgb: darkIron,
    });
    for (const rz of [-0.28, -0.16, -0.04]) {
      out.energy.push({
        geo: radRibGeo,
        matrix: makeTransform(side * 0.48, 0.62, rz, 0, 0, -side * 0.24),
        colorRgb: thermalGlow,
      });
    }
  }

  const reactorCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.16, 0.18, 0.20, 10));
  reactorCapGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: reactorCapGeo,
    matrix: makeTransform(0, 1.18, -0.40),
    colorRgb: darkIron,
  });

  pushFusionBell(out, [0, 0.76, -0.58], 0.105, 0.18, brushedBrass, railAmber);
  pushFusionBell(out, [-0.15, 0.56, -0.58], 0.095, 0.16, brushedBrass, railAmber);
  pushFusionBell(out, [0.15, 0.56, -0.58], 0.095, 0.16, brushedBrass, railAmber);

  pushOrbitalWingVanes(out, 1.18, -0.32, 0.38, 0.48, brushedBrass);

  out.headTopLocalY = 1.76;
  out.weaponGlowHex = 0xff8c24;
  out.crystalHex = 0xf8c256;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.48;
}

export const UNIT_PACK_1_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S01: buildS01,
  S02: buildS02,
  S03: buildS03,
  S05: buildS05,
  S06: buildS06,
  S07: buildS07,
  S08: buildS08,
  S09: buildS09,
  S10: buildS10,
};
