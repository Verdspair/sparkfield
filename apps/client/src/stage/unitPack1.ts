import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
  createCreatureFin,
  createCurvedBladePart,
  createFacetedCrystalPart,
  createFlowingRibbonMesh,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createPetalPart,
  createSculptedClothLathe,
  createTaperedTubePart,
  createTeardropPart,
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type RgbTriple,
  type UnitBlueprintParts,
  type UnitBuilderContext,
  type Vec3Tuple,
} from './unitBuilderCore.js';

function pushStar3ArcWings(
  out: UnitBlueprintParts,
  y: number,
  z: number,
  spanX: number,
  length: number,
  color: RgbTriple,
): void {
  const geo = trackGeo(out, createCurvedBladePart(length, 0.10, 0.024, 0.14, 0.04, 10));
  for (const side of [-1, 1] as const) {
    out.wingParts.push({
      geo,
      matrix: makeTransform(side * spanX, y, z, -0.22, side * 0.28, -side * 0.52, side, 1, 1),
      colorRgb: color,
    });
  }
}

function buildS01(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const solarGold: RgbTriple = [0.84, 0.67, 0.36];
  const deepCopper: RgbTriple = [0.64, 0.40, 0.22];
  const forgeIron: RgbTriple = [0.20, 0.18, 0.17];
  const brightBrass: RgbTriple = [0.91, 0.78, 0.48];
  const furnaceAmber: RgbTriple = [0.95, 0.66, 0.26];
  const shieldGlass: RgbTriple = [0.96, 0.78, 0.42];

  const carapaceGeo = trackGeo(out, createChamferedHexPart(0.38, 0.19, 0.032));
  carapaceGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: carapaceGeo,
    matrix: makeTransform(0, 0.54, -0.04, 0.14, 0, 0, 1.14, 0.96, 1.04),
    colorRgb: solarGold,
  });

  const browShieldGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.32, -0.10],
        [0.32, -0.10],
        [0.24, 0.14],
        [0.0, 0.20],
        [-0.24, 0.14],
      ],
      0.11,
      0.022,
      0.020,
      2,
      4,
    ),
  );
  browShieldGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: browShieldGeo,
    matrix: makeTransform(0, 0.62, 0.16, 0.24, 0, 0),
    colorRgb: deepCopper,
  });

  const bellyGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.14, -0.14],
        [0.30, -0.06],
        [0.34, 0.06],
        [0.26, 0.12],
      ],
      14,
    ),
  );
  out.matte.push({
    geo: bellyGeo,
    matrix: makeTransform(0, 0.40, -0.02, 0, 0, 0, 1.08, 1.0, 0.96),
    colorRgb: forgeIron,
  });

  const eyeVisorGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.026, 0.12, 8));
  eyeVisorGeo.rotateZ(Math.PI * 0.5);
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: eyeVisorGeo,
      matrix: makeTransform(side * 0.14, 0.56, 0.28, 0, -side * 0.22, 0),
      colorRgb: furnaceAmber,
    });
  }

  const treadGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.085, -0.036],
        [0.085, -0.036],
        [0.115, 0.0],
        [0.085, 0.044],
        [-0.085, 0.044],
        [-0.115, 0.0],
      ],
      0.072,
      0.010,
      0.010,
      1,
      4,
    ),
  );
  const hipSocketGeo = trackGeo(out, new THREE.SphereGeometry(0.056, 8, 8));
  const kneeCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.042, 0.062, 8));
  kneeCapGeo.rotateZ(Math.PI * 0.5);

  const legOffsetsZ = [0.16, -0.06, -0.28];
  const legSpreadX = [0.56, 0.62, 0.54];
  for (let i = 0; i < 3; i += 1) {
    const lz = legOffsetsZ[i]!;
    const lx = legSpreadX[i]!;
    for (const side of [-1, 1] as const) {
      const hx = side * 0.30;
      const kx = side * (lx - 0.06);
      const fx = side * lx;
      out.matte.push({
        geo: hipSocketGeo,
        matrix: makeTransform(hx, 0.42, lz),
        colorRgb: forgeIron,
      });
      const limbGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [hx, 0.42, lz],
            [kx, 0.52, lz],
            [fx, 0.14, lz * 1.12],
          ],
          0.046,
          0.052,
          0.034,
          12,
          8,
        ),
      );
      out.armor.push({
        geo: limbGeo,
        matrix: makeTransform(0, 0, 0),
        colorRgb: i === 1 ? solarGold : deepCopper,
      });
      out.trim.push({
        geo: kneeCapGeo,
        matrix: makeTransform(kx, 0.52, lz),
        colorRgb: brightBrass,
      });
      out.matte.push({
        geo: treadGeo,
        matrix: makeTransform(fx, 0.10, lz * 1.12, 0, Math.PI * 0.5 - side * 0.18, 0),
        colorRgb: forgeIron,
      });
    }
  }

  const clawUpperGeo = trackGeo(out, createCurvedBladePart(0.32, 0.13, 0.054, 0.12, 0.04, 8));
  const clawLowerGeo = trackGeo(out, createCurvedBladePart(0.24, 0.095, 0.042, 0.09, -0.02, 8));
  for (const side of [-1, 1] as const) {
    const armGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.34, 0.50, 0.18],
          [side * 0.52, 0.48, 0.36],
          [side * 0.38, 0.50, 0.54],
        ],
        0.064,
        0.074,
        0.058,
        12,
        10,
      ),
    );
    out.armor.push({ geo: armGeo, matrix: makeTransform(0, 0, 0), colorRgb: solarGold });
    out.trim.push({
      geo: clawUpperGeo,
      matrix: makeTransform(side * 0.38, 0.54, 0.54, Math.PI * 0.48, -side * 0.54, -side * 0.14, side, 1, 1),
      colorRgb: brightBrass,
    });
    out.matte.push({
      geo: clawLowerGeo,
      matrix: makeTransform(side * 0.36, 0.42, 0.52, Math.PI * 0.52, -side * 0.46, side * 0.18, side, 1, 1),
      colorRgb: forgeIron,
    });
  }

  const shieldCenter = makeTransform(0, 0.56, 0.62, -0.14, 0, 0);
  const shieldFrameGeo = trackGeo(out, createChamferedHexPart(0.36, 0.052, 0.014, 0.27));
  out.trim.push({ geo: shieldFrameGeo, matrix: shieldCenter, colorRgb: solarGold });

  const shieldPaneGeo = trackGeo(out, createHexMirrorTilePart(0.285, 0.022, 0.012, 0.018));
  out.crystal.push({ geo: shieldPaneGeo, matrix: shieldCenter, colorRgb: shieldGlass });

  const shieldInnerRimGeo = trackGeo(out, new THREE.TorusGeometry(0.23, 0.014, 6, 6));
  out.energy.push({ geo: shieldInnerRimGeo, matrix: shieldCenter, colorRgb: furnaceAmber });

  const prongGeo = trackGeo(out, new THREE.ConeGeometry(0.026, 0.09, 6));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    out.trim.push({
      geo: prongGeo,
      matrix: shieldCenter.clone().multiply(makeTransform(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0.01, 0, 0, a - Math.PI * 0.5)),
      colorRgb: brightBrass,
    });
  }

  const louverGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.028],
        [0.22, -0.028],
        [0.18, 0.032],
        [-0.18, 0.032],
      ],
      0.044,
      0.008,
      0.008,
      1,
      4,
    ),
  );
  for (let i = 0; i < 4; i += 1) {
    out.matte.push({
      geo: louverGeo,
      matrix: makeTransform(0, 0.72 + i * 0.048, -0.06 - i * 0.075, -0.52, 0, 0, 1 - i * 0.08, 1, 1),
      colorRgb: forgeIron,
    });
  }
  const furnaceVentGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.14, 0.14, 6));
  out.energy.push({
    geo: furnaceVentGeo,
    matrix: makeTransform(0, 0.72, -0.14, -0.24, 0, 0),
    colorRgb: furnaceAmber,
  });

  const winchDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.078, 0.078, 0.18, 12));
  winchDrumGeo.rotateZ(Math.PI * 0.5);
  out.matte.push({
    geo: winchDrumGeo,
    matrix: makeTransform(0, 0.80, -0.34),
    colorRgb: forgeIron,
  });

  const anchorShankGeo = trackGeo(
    out,
    createOrganicLimb(
      [
        [0, 0.78, -0.34],
        [0, 1.06, -0.42],
        [0, 1.24, -0.24],
      ],
      0.036,
      0.032,
      0.026,
      12,
      8,
    ),
  );
  out.trim.push({ geo: anchorShankGeo, matrix: makeTransform(0, 0, 0), colorRgb: brightBrass });

  const anchorFlukeGeo = trackGeo(out, createCurvedBladePart(0.28, 0.09, 0.036, 0.12, 0.03, 8));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: anchorFlukeGeo,
      matrix: makeTransform(side * 0.02, 1.18, -0.26, -0.35, 0, -side * 0.95, side, 1, 1),
      colorRgb: solarGold,
    });
  }

  pushStar3ArcWings(out, 0.86, -0.28, 0.44, 0.52, brightBrass);

  out.headTopLocalY = 1.48;
  out.weaponGlowHex = 0xf2a63a;
  out.crystalHex = 0xf6c05a;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.44;
}

function buildS02(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const solarGold: RgbTriple = [0.86, 0.70, 0.36];
  const burnishedCopper: RgbTriple = [0.68, 0.44, 0.24];
  const forgeDark: RgbTriple = [0.22, 0.19, 0.17];
  const foilBright: RgbTriple = [0.94, 0.82, 0.48];
  const repairGold: RgbTriple = [0.96, 0.84, 0.46];
  const softRepairMint: RgbTriple = [0.54, 0.90, 0.78];

  const thoraxGeo = trackGeo(
    out,
    createTeardropPart(0.42, 0.125, 1.25, 18, 14, 0.02, burnishedCopper, solarGold),
  );
  out.armor.push({
    geo: thoraxGeo,
    matrix: makeTransform(0, 0.88, 0.08, 0.46, 0, 0),
  });

  const headGeo = trackGeo(out, new THREE.SphereGeometry(0.105, 14, 12));
  out.armor.push({
    geo: headGeo,
    matrix: makeTransform(0, 1.04, 0.22, 0, 0, 0, 1.08, 0.92, 0.96),
    colorRgb: solarGold,
  });

  const compEyeGeo = trackGeo(out, new THREE.IcosahedronGeometry(0.056, 1));
  for (const side of [-1, 1] as const) {
    out.crystal.push({
      geo: compEyeGeo,
      matrix: makeTransform(side * 0.074, 1.05, 0.27),
      colorRgb: foilBright,
    });
  }

  const antennaGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.04, 1.12, 0.24],
        [0.12, 1.26, 0.34],
        [0.18, 1.32, 0.42],
      ],
      0.012,
      0.005,
      10,
      6,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: antennaGeo,
      matrix: makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1),
      colorRgb: foilBright,
    });
  }

  const collarGeo = trackGeo(out, new THREE.TorusGeometry(0.11, 0.018, 8, 18));
  collarGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: collarGeo,
    matrix: makeTransform(0, 0.96, 0.16, 0.36, 0, 0),
    colorRgb: foilBright,
  });

  const abdSegments: readonly (readonly [number, number, number, number, number])[] = [
    [0.74, -0.02, 0.105, 0.62, 0],
    [0.62, -0.08, 0.118, 0.44, 1],
    [0.50, -0.10, 0.106, 0.18, 0],
    [0.39, -0.07, 0.084, -0.10, 1],
    [0.30, -0.02, 0.058, -0.34, 0],
  ];
  const abdRingGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.78, -0.048],
        [1.0, 0.0],
        [0.86, 0.048],
      ],
      14,
    ),
  );
  const abdRibGeo = trackGeo(out, new THREE.TorusGeometry(1.0, 0.11, 6, 16));
  abdRibGeo.rotateX(Math.PI * 0.5);

  for (const [ay, az, rad, rx, alt] of abdSegments) {
    const m = makeTransform(0, ay, az, rx, 0, 0, rad, 1.0, rad);
    out.armor.push({
      geo: abdRingGeo,
      matrix: m,
      colorRgb: alt === 0 ? solarGold : burnishedCopper,
    });
    out.matte.push({
      geo: abdRibGeo,
      matrix: makeTransform(0, ay - 0.02, az, rx, 0, 0, rad * 0.96, rad * 0.96, rad * 0.96),
      colorRgb: forgeDark,
    });
  }

  const ampouleGeo = trackGeo(out, createTeardropPart(0.18, 0.048, 1.35, 14, 10));
  out.crystal.push({
    geo: ampouleGeo,
    matrix: makeTransform(0, 0.28, 0.04, -0.46, 0, 0),
    colorRgb: softRepairMint,
  });

  const stingerGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.032, 0.0],
        [0.018, 0.12],
        [0.004, 0.22],
      ],
      10,
    ),
  );
  out.energy.push({
    geo: stingerGeo,
    matrix: makeTransform(0, 0.25, 0.04, 2.58, 0, 0),
    colorRgb: softRepairMint,
  });

  const hexCellGeo = trackGeo(
    out,
    createHexMirrorTilePart(0.125, 0.014, 0.008, 0.006, foilBright, solarGold),
  );
  const wingPairSpecs: readonly {
    readonly y: number;
    readonly z: number;
    readonly span: number;
    readonly chord: number;
    readonly sweep: number;
    readonly pitchX: number;
    readonly rollZ: number;
    readonly hexOffsets: readonly (readonly [number, number, number])[];
  }[] = [
    {
      y: 0.96,
      z: 0.04,
      span: 0.72,
      chord: 0.34,
      sweep: 0.16,
      pitchX: -0.18,
      rollZ: 0.44,
      hexOffsets: [
        [0.24, 0.04, 0.92],
        [0.44, 0.02, 1.04],
        [0.58, -0.08, 0.76],
      ],
    },
    {
      y: 0.86,
      z: -0.02,
      span: 0.62,
      chord: 0.26,
      sweep: 0.24,
      pitchX: -0.04,
      rollZ: 0.06,
      hexOffsets: [
        [0.22, -0.04, 0.84],
        [0.42, -0.10, 0.88],
      ],
    },
    {
      y: 0.76,
      z: -0.08,
      span: 0.46,
      chord: 0.22,
      sweep: 0.28,
      pitchX: 0.12,
      rollZ: -0.40,
      hexOffsets: [
        [0.18, -0.08, 0.72],
        [0.33, -0.16, 0.64],
      ],
    },
  ];

  for (const wp of wingPairSpecs) {
    const foilGeo = trackGeo(
      out,
      createCreatureFin(wp.chord, wp.span, wp.sweep, 0.036, 0.010, 14, 8, foilBright, repairGold),
    );
    const sparGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.02, 0.01, 0.08],
          [wp.span * 0.52, 0.03, 0.04 - wp.sweep * 0.32],
          [wp.span * 0.98, 0.0, -wp.sweep * 0.86],
        ],
        0.016,
        0.006,
        12,
        6,
      ),
    );
    const veinGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [wp.span * 0.14, 0.01, 0.02],
          [wp.span * 0.48, 0.02, -wp.sweep * 0.45 - wp.chord * 0.22],
          [wp.span * 0.78, -0.01, -wp.sweep * 0.72 - wp.chord * 0.28],
        ],
        0.009,
        0.004,
        10,
        6,
      ),
    );

    for (const side of [-1, 1] as const) {
      const wm = makeTransform(side * 0.08, wp.y, wp.z, wp.pitchX, -side * 0.22, side * wp.rollZ, side, 1, 1);
      out.crystal.push({ geo: foilGeo, matrix: wm, colorRgb: foilBright });
      out.trim.push({ geo: sparGeo, matrix: wm, colorRgb: solarGold });
      out.trim.push({ geo: veinGeo, matrix: wm, colorRgb: burnishedCopper });
      for (const [hx, hz, hs] of wp.hexOffsets) {
        out.trim.push({
          geo: hexCellGeo,
          matrix: wm.clone().multiply(makeTransform(hx, 0.018, hz, -Math.PI * 0.5, 0, 0, hs, hs, 1)),
          colorRgb: foilBright,
        });
      }
    }
  }

  pushStar3ArcWings(out, 1.06, -0.18, 0.42, 0.56, foilBright);

  out.headTopLocalY = 1.56;
  out.weaponGlowHex = 0xf2c864;
  out.crystalHex = 0xf7d884;
  out.crystalOpacity = 0.58;
  out.crystalIntensity = 0.42;
}

function buildS03(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const ceramicWhite: RgbTriple = [0.92, 0.95, 0.99];
  const porcelainBlue: RgbTriple = [0.74, 0.83, 0.93];
  const titaniumTrim: RgbTriple = [0.76, 0.82, 0.90];
  const slateCore: RgbTriple = [0.20, 0.26, 0.36];
  const plasmaCyan: RgbTriple = [0.32, 0.84, 0.98];
  const icePlasma: RgbTriple = [0.64, 0.92, 1.00];

  const craft = makeTransform(0, 0.96, 0.04, -0.18, 0, 0.09);

  const fuselageGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.56],
        [0.13, 0.12],
        [0.10, -0.30],
        [0.0, -0.38],
        [-0.10, -0.30],
        [-0.13, 0.12],
      ],
      0.088,
      0.020,
      0.020,
      2,
      4,
    ),
  );
  fuselageGeo.rotateX(Math.PI * 0.5);
  out.armor.push({ geo: fuselageGeo, matrix: craft, colorRgb: ceramicWhite });

  const dorsalKeelGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.32, -0.02],
        [0.38, 0.0],
        [0.10, 0.13],
        [-0.20, 0.09],
      ],
      0.034,
      0.011,
      0.011,
      2,
      4,
    ),
  );
  dorsalKeelGeo.rotateY(-Math.PI * 0.5);
  out.armor.push({
    geo: dorsalKeelGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.068, 0.03)),
    colorRgb: ceramicWhite,
  });

  const ventralScoopGeo = trackGeo(
    out,
    createFacetedCrystalPart(0.48, 0.078, 4, 0.68, 0.32),
  );
  ventralScoopGeo.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: ventralScoopGeo,
    matrix: craft.clone().multiply(makeTransform(0, -0.056, 0.03, 0, Math.PI * 0.25, 0)),
    colorRgb: slateCore,
  });

  const beakProwGeo = trackGeo(out, createFacetedCrystalPart(0.28, 0.068, 4, 0.78, 0.22));
  beakProwGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: beakProwGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.018, 0.50, 0.08, Math.PI * 0.25, 0)),
    colorRgb: ceramicWhite,
  });

  const visorSlitGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.076, -0.015],
        [0.076, -0.015],
        [0.048, 0.018],
        [-0.048, 0.018],
      ],
      0.028,
      0.005,
      0.005,
      1,
      2,
    ),
  );
  out.energy.push({
    geo: visorSlitGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.070, 0.36, -0.35, 0, 0)),
    colorRgb: plasmaCyan,
  });

  const innerWingGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.32],
        [0.36, -0.03],
        [0.30, -0.28],
        [0.0, -0.19],
      ],
      0.034,
      0.011,
      0.010,
      2,
      4,
    ),
  );
  innerWingGeo.rotateX(Math.PI * 0.5);

  const outerWingGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.15],
        [0.38, -0.24],
        [0.24, -0.32],
        [0.0, -0.12],
      ],
      0.024,
      0.009,
      0.008,
      2,
      4,
    ),
  );
  outerWingGeo.rotateX(Math.PI * 0.5);

  const cheekFairingGeo = trackGeo(out, createCurvedBladePart(0.24, 0.058, 0.018, 0.05, 0.015, 6));
  const intakeCowlingGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.036, 0.20, 8));
  intakeCowlingGeo.rotateX(Math.PI * 0.5);
  const wingletTipGeo = trackGeo(out, createCurvedBladePart(0.26, 0.068, 0.016, 0.05, 0.02, 8));
  const plasmaEdgeGeo = trackGeo(out, createCurvedBladePart(0.64, 0.048, 0.015, 0.04, 0.016, 10));
  const slatRibGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.013, 0.22, 6));
  slatRibGeo.rotateZ(Math.PI * 0.5);
  const wingNodeGeo = trackGeo(out, createFacetedCrystalPart(0.095, 0.022, 4, 0.65, 0.35));
  const forkTailGeo = trackGeo(out, createCurvedBladePart(0.46, 0.084, 0.018, 0.08, 0.02, 8));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: cheekFairingGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.11, 0.02, 0.28, Math.PI * 0.52, -side * 0.18, side * 0.32, side, 1, 1)),
      colorRgb: porcelainBlue,
    });
    out.matte.push({
      geo: intakeCowlingGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.11, -0.03, 0.06)),
      colorRgb: slateCore,
    });

    const innerMat = craft.clone().multiply(makeTransform(side * 0.08, 0.02, 0.02, 0, 0, side * 0.18, side, 1, 1));
    out.armor.push({ geo: innerWingGeo, matrix: innerMat, colorRgb: ceramicWhite });
    out.armor.push({
      geo: innerWingGeo,
      matrix: innerMat.clone().multiply(makeTransform(0.02, -0.024, -0.02, 0, 0, 0, 0.88, 0.72, 0.88)),
      colorRgb: porcelainBlue,
    });

    const outerMat = craft.clone().multiply(makeTransform(side * 0.38, 0.08, -0.12, 0, 0, -side * 0.18, side, 1, 1));
    out.armor.push({ geo: outerWingGeo, matrix: outerMat, colorRgb: ceramicWhite });

    out.trim.push({
      geo: wingletTipGeo,
      matrix: outerMat.clone().multiply(makeTransform(0.35, 0.01, -0.22, -0.32, 0.18, -0.46)),
      colorRgb: titaniumTrim,
    });
    out.energy.push({
      geo: wingNodeGeo,
      matrix: outerMat.clone().multiply(makeTransform(0.24, 0.04, -0.12, 0, 0, -0.35)),
      colorRgb: plasmaCyan,
    });

    out.energy.push({
      geo: plasmaEdgeGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.09, 0.03, 0.32, Math.PI * 0.5, 0, side * 0.82, side, 1, 1)),
      colorRgb: plasmaCyan,
    });
    out.crystal.push({
      geo: plasmaEdgeGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.10, 0.03, 0.34, Math.PI * 0.5, 0, side * 0.82, side * 1.05, 1.02, 1.32)),
      colorRgb: icePlasma,
    });

    for (let r = 0; r < 3; r += 1) {
      out.trim.push({
        geo: slatRibGeo,
        matrix: innerMat.clone().multiply(makeTransform(0.16 + r * 0.04, 0.024, 0.08 - r * 0.11, 0, -0.46, 0)),
        colorRgb: titaniumTrim,
      });
    }

    const tailMat = craft.clone().multiply(
      makeTransform(side * 0.075, 0.02, -0.28, -Math.PI * 0.52, side * 0.32, -side * 0.14, side, 1, 1),
    );
    out.armor.push({ geo: forkTailGeo, matrix: tailMat, colorRgb: ceramicWhite });
    out.energy.push({
      geo: forkTailGeo,
      matrix: tailMat.clone().multiply(makeTransform(0.016, 0.04, 0, 0, 0, 0, 0.40, 0.92, 0.65)),
      colorRgb: plasmaCyan,
    });
  }

  const dorsalRingGeo = trackGeo(out, new THREE.TorusGeometry(0.18, 0.011, 6, 22));
  out.trim.push({
    geo: dorsalRingGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.14, -0.18, 0.32, 0, 0)),
    colorRgb: titaniumTrim,
  });

  const dorsalVeinGeo = trackGeo(out, new THREE.CylinderGeometry(0.009, 0.009, 0.36, 6));
  dorsalVeinGeo.rotateX(Math.PI * 0.5);
  const escortShardGeo = trackGeo(out, createFacetedCrystalPart(0.14, 0.026, 4, 0.72, 0.28));
  escortShardGeo.rotateX(Math.PI * 0.5);
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: dorsalVeinGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.032, 0.088, 0.02)),
      colorRgb: plasmaCyan,
    });
    out.armor.push({
      geo: escortShardGeo,
      matrix: craft.clone().multiply(makeTransform(side * 0.66, 0.14, -0.22, -0.06, -side * 0.18, 0)),
      colorRgb: ceramicWhite,
    });
  }

  const thrustRingGeo = trackGeo(out, new THREE.TorusGeometry(0.096, 0.015, 8, 18));
  out.trim.push({
    geo: thrustRingGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.01, -0.36)),
    colorRgb: titaniumTrim,
  });

  const thrustCoreGeo = trackGeo(out, createTeardropPart(0.28, 0.052, 1.5, 12, 10));
  out.crystal.push({
    geo: thrustCoreGeo,
    matrix: craft.clone().multiply(makeTransform(0, 0.01, -0.48, -Math.PI * 0.5, 0, 0)),
    colorRgb: icePlasma,
  });

  const hoverRingGeo = trackGeo(out, new THREE.TorusGeometry(0.22, 0.010, 6, 22));
  hoverRingGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: hoverRingGeo,
    matrix: makeTransform(0, 0.24, 0.0),
    colorRgb: plasmaCyan,
  });

  pushStar3ArcWings(out, 1.08, -0.22, 0.48, 0.56, titaniumTrim);

  out.headTopLocalY = 1.48;
  out.weaponGlowHex = 0x4ad8f8;
  out.crystalHex = 0x7ce8ff;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.46;
}

function buildS05(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const starIndigo: RgbTriple = [0.20, 0.30, 0.48];
  const warmBronze: RgbTriple = [0.80, 0.61, 0.32];
  const agedBrass: RgbTriple = [0.90, 0.76, 0.44];
  const darkIron: RgbTriple = [0.18, 0.20, 0.26];
  const stardustGold: RgbTriple = [0.95, 0.80, 0.42];
  const lanternGlass: RgbTriple = [0.96, 0.88, 0.68];

  const topCapGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.010, 0.22],
        [0.066, 0.15],
        [0.140, 0.08],
        [0.235, 0.02],
        [0.265, -0.02],
        [0.210, -0.05],
      ],
      18,
    ),
  );
  out.trim.push({
    geo: topCapGeo,
    matrix: makeTransform(0, 1.18, 0),
    colorRgb: warmBronze,
  });

  const topEnamelGeo = trackGeo(out, new THREE.CylinderGeometry(0.135, 0.21, 0.072, 16));
  out.armor.push({
    geo: topEnamelGeo,
    matrix: makeTransform(0, 1.25, 0),
    colorRgb: starIndigo,
  });

  const hangRingGeo = trackGeo(out, new THREE.TorusGeometry(0.074, 0.015, 8, 18));
  out.trim.push({
    geo: hangRingGeo,
    matrix: makeTransform(0, 1.44, 0),
    colorRgb: agedBrass,
  });

  const botCapGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.210, 0.05],
        [0.258, 0.01],
        [0.220, -0.04],
        [0.115, -0.10],
        [0.044, -0.17],
        [0.008, -0.22],
      ],
      18,
    ),
  );
  out.trim.push({
    geo: botCapGeo,
    matrix: makeTransform(0, 0.44, 0),
    colorRgb: warmBronze,
  });

  const botEnamelGeo = trackGeo(out, new THREE.CylinderGeometry(0.19, 0.125, 0.064, 16));
  out.armor.push({
    geo: botEnamelGeo,
    matrix: makeTransform(0, 0.37, 0),
    colorRgb: starIndigo,
  });

  const plumbGeo = trackGeo(out, createFacetedCrystalPart(0.16, 0.040, 6, 0.35, 0.65));
  out.energy.push({
    geo: plumbGeo,
    matrix: makeTransform(0, 0.22, 0),
    colorRgb: stardustGold,
  });

  const glassProfile: readonly (readonly [number, number])[] = [
    [0.155, -0.33],
    [0.195, -0.24],
    [0.155, -0.13],
    [0.046, -0.03],
    [0.035, 0.0],
    [0.046, 0.03],
    [0.155, 0.13],
    [0.195, 0.24],
    [0.155, 0.33],
  ];
  const hourglassGlassGeo = trackGeo(out, createLathePart(glassProfile, 22));
  out.crystal.push({
    geo: hourglassGlassGeo,
    matrix: makeTransform(0, 0.81, 0),
    colorRgb: lanternGlass,
  });

  const waistCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.064, 0.015, 8, 18));
  waistCollarGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: waistCollarGeo,
    matrix: makeTransform(0, 0.81, 0),
    colorRgb: agedBrass,
  });

  const upperSandGeo = trackGeo(out, new THREE.ConeGeometry(0.140, 0.20, 16));
  upperSandGeo.rotateX(Math.PI);
  out.energy.push({
    geo: upperSandGeo,
    matrix: makeTransform(0, 0.96, 0),
    colorRgb: stardustGold,
  });

  const lowerSandGeo = trackGeo(out, new THREE.ConeGeometry(0.150, 0.19, 16));
  out.energy.push({
    geo: lowerSandGeo,
    matrix: makeTransform(0, 0.59, 0),
    colorRgb: stardustGold,
  });

  const trickleGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.014, 0.32, 8));
  out.energy.push({
    geo: trickleGeo,
    matrix: makeTransform(0, 0.78, 0),
    colorRgb: stardustGold,
  });

  const ribCurve: readonly Vec3Tuple[] = [
    [0.22, 1.16, 0],
    [0.30, 0.99, 0],
    [0.24, 0.81, 0],
    [0.30, 0.63, 0],
    [0.22, 0.46, 0],
  ];
  const cageRibGeo = trackGeo(out, createOrganicLimb(ribCurve, 0.018, 0.022, 0.018, 14, 8));
  const rivetGeo = trackGeo(out, new THREE.SphereGeometry(0.026, 8, 8));

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const rm = makeTransform(0, 0, 0, 0, a, 0);
    out.trim.push({ geo: cageRibGeo, matrix: rm, colorRgb: warmBronze });
    out.armor.push({
      geo: rivetGeo,
      matrix: rm.clone().multiply(makeTransform(0.24, 0.81, 0)),
      colorRgb: starIndigo,
    });
  }

  const dialTilt = makeTransform(0, 0.81, 0, 0.36, 0.22, -0.26);
  const dialRingGeo = trackGeo(out, new THREE.TorusGeometry(0.44, 0.017, 8, 28));
  dialRingGeo.rotateX(Math.PI * 0.5);
  out.trim.push({ geo: dialRingGeo, matrix: dialTilt, colorRgb: agedBrass });

  const dialInnerGeo = trackGeo(out, new THREE.TorusGeometry(0.39, 0.008, 6, 26));
  dialInnerGeo.rotateX(Math.PI * 0.5);
  out.armor.push({ geo: dialInnerGeo, matrix: dialTilt, colorRgb: starIndigo });

  const notchGeo = trackGeo(out, createFacetedCrystalPart(0.050, 0.012, 4, 0.5, 0.5));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    out.trim.push({
      geo: notchGeo,
      matrix: dialTilt.clone().multiply(makeTransform(Math.cos(a) * 0.44, 0, Math.sin(a) * 0.44, Math.PI * 0.5, 0, a)),
      colorRgb: agedBrass,
    });
  }

  const handSpecs: readonly (readonly [number, number, number, number, number, number, number])[] = [
    [0.46, 0.052, 0.36, 0.92, 0.18, 0.22, -0.58],
    [0.36, 0.060, -0.38, 0.82, 0.15, -0.18, 0.68],
    [0.42, 0.040, 0.14, 0.68, -0.36, 0.42, 0.32],
  ];
  const counterRingGeo = trackGeo(out, new THREE.TorusGeometry(0.040, 0.010, 6, 14));
  for (let i = 0; i < handSpecs.length; i += 1) {
    const [len, wid, px, py, pz, rx, rz] = handSpecs[i]!;
    const handGeo = trackGeo(out, createCurvedBladePart(len, wid, 0.015, 0.03, 0.01, 8));
    const hm = makeTransform(px, py, pz, rx, i * 0.65, rz);
    out.trim.push({
      geo: handGeo,
      matrix: hm,
      colorRgb: i === 0 ? agedBrass : warmBronze,
    });
    out.matte.push({
      geo: counterRingGeo,
      matrix: hm.clone().multiply(makeTransform(0, -0.04, 0)),
      colorRgb: darkIron,
    });
  }

  const moteGeo = trackGeo(out, new THREE.OctahedronGeometry(0.023, 0));
  const moteCoords: readonly Vec3Tuple[] = [
    [0.30, 1.04, 0.22],
    [-0.32, 0.94, 0.18],
    [0.24, 0.62, -0.24],
    [-0.26, 0.70, -0.22],
  ];
  for (const [mx, my, mz] of moteCoords) {
    out.energy.push({
      geo: moteGeo,
      matrix: makeTransform(mx, my, mz, 0.4, 0.6, 0.2),
      colorRgb: stardustGold,
    });
  }

  pushStar3ArcWings(out, 0.92, -0.22, 0.42, 0.54, agedBrass);

  out.headTopLocalY = 1.62;
  out.weaponGlowHex = 0xf2c254;
  out.crystalHex = 0xfae09e;
  out.crystalOpacity = 0.44;
  out.crystalIntensity = 0.36;
}

function buildS06(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const glacialWhite: RgbTriple = [0.80, 0.91, 0.97];
  const abyssalBlue: RgbTriple = [0.24, 0.48, 0.66];
  const cryoTitanium: RgbTriple = [0.68, 0.80, 0.88];
  const deepTrench: RgbTriple = [0.16, 0.28, 0.40];
  const iceCrystal: RgbTriple = [0.58, 0.88, 0.98];
  const bioSeafoam: RgbTriple = [0.38, 0.88, 0.82];

  const bellY = 1.00;

  const outerBellProfile: readonly (readonly [number, number])[] = [
    [0.012, 0.34],
    [0.17, 0.31],
    [0.34, 0.20],
    [0.45, 0.05],
    [0.50, -0.08],
    [0.45, -0.13],
  ];
  const outerBellGeo = trackGeo(
    out,
    createSculptedClothLathe(outerBellProfile, 22, 0.020, 6, 0.62, glacialWhite, iceCrystal),
  );
  out.crystal.push({
    geo: outerBellGeo,
    matrix: makeTransform(0, bellY, 0),
  });

  const innerCapProfile: readonly (readonly [number, number])[] = [
    [0.008, 0.28],
    [0.15, 0.25],
    [0.29, 0.15],
    [0.36, 0.02],
    [0.32, -0.04],
  ];
  const innerCapGeo = trackGeo(out, createLathePart(innerCapProfile, 18));
  out.armor.push({
    geo: innerCapGeo,
    matrix: makeTransform(0, bellY + 0.02, 0),
    colorRgb: glacialWhite,
  });

  const subVeilProfile: readonly (readonly [number, number])[] = [
    [0.22, 0.04],
    [0.32, -0.04],
    [0.38, -0.15],
    [0.33, -0.20],
  ];
  const subVeilGeo = trackGeo(
    out,
    createSculptedClothLathe(subVeilProfile, 18, 0.016, 6, 0.55, iceCrystal, bioSeafoam),
  );
  out.crystal.push({
    geo: subVeilGeo,
    matrix: makeTransform(0, bellY - 0.02, 0),
  });

  const crownCupolaGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.13, 0.0],
        [0.10, 0.06],
        [0.065, 0.10],
        [0.01, 0.13],
      ],
      14,
    ),
  );
  out.trim.push({
    geo: crownCupolaGeo,
    matrix: makeTransform(0, bellY + 0.30, 0),
    colorRgb: cryoTitanium,
  });

  const beaconLensGeo = trackGeo(out, new THREE.SphereGeometry(0.048, 12, 10));
  out.energy.push({
    geo: beaconLensGeo,
    matrix: makeTransform(0, bellY + 0.40, 0),
    colorRgb: bioSeafoam,
  });

  const ribGeo = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.065, 0.33, 0],
        [0.27, 0.23, 0],
        [0.44, 0.04, 0],
        [0.49, -0.09, 0],
      ],
      0.020,
      0.024,
      0.013,
      10,
      8,
    ),
  );
  const lappetGeo = trackGeo(out, createPetalPart(0.22, 0.15, 0.024, 0.024, 1.3, 8, 6));

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rm = makeTransform(0, bellY, 0, 0, a, 0);
    out.armor.push({ geo: ribGeo, matrix: rm, colorRgb: abyssalBlue });
    out.armor.push({
      geo: lappetGeo,
      matrix: rm.clone().multiply(makeTransform(0.46, -0.05, 0, 0.22, Math.PI * 0.5, -0.45)),
      colorRgb: glacialWhite,
    });
  }

  const corePrismGeo = trackGeo(out, createFacetedCrystalPart(0.34, 0.13, 6, 0.56, 0.44));
  out.crystal.push({
    geo: corePrismGeo,
    matrix: makeTransform(0, 0.74, 0),
    colorRgb: iceCrystal,
  });

  const innerHeartGeo = trackGeo(out, new THREE.OctahedronGeometry(0.084, 0));
  out.energy.push({
    geo: innerHeartGeo,
    matrix: makeTransform(0, 0.74, 0, 0.2, 0.5, 0.1),
    colorRgb: bioSeafoam,
  });

  const coreHaloGeo = trackGeo(out, new THREE.TorusGeometry(0.21, 0.013, 8, 20));
  coreHaloGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: coreHaloGeo,
    matrix: makeTransform(0, 0.74, 0, 0.18, 0, -0.14),
    colorRgb: cryoTitanium,
  });

  const caliperGeo = trackGeo(
    out,
    createTaperedTubePart(
      [
        [0.11, 0.92, 0],
        [0.20, 0.74, 0],
        [0.09, 0.54, 0],
      ],
      0.013,
      0.008,
      10,
      6,
    ),
  );
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    out.matte.push({
      geo: caliperGeo,
      matrix: makeTransform(0, 0, 0, 0, a, 0),
      colorRgb: deepTrench,
    });
  }

  const damperRingGeo = trackGeo(out, new THREE.TorusGeometry(0.042, 0.010, 6, 12));
  damperRingGeo.rotateX(Math.PI * 0.5);

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const lenDrop = i % 2 === 0 ? 0.16 : 0.24;
    const swayZ = -0.07 - (i % 2) * 0.04;
    const pts: Vec3Tuple[] = [
      [ca * 0.28, 0.86, sa * 0.28],
      [ca * 0.35, 0.62, sa * 0.35 + swayZ * 0.35],
      [ca * 0.24, 0.40, sa * 0.24 + swayZ * 0.75],
      [ca * 0.31, lenDrop, sa * 0.31 + swayZ],
    ];
    const tendrilGeo = trackGeo(out, createOrganicLimb(pts, 0.025, 0.017, 0.007, 12, 8));
    out.armor.push({
      geo: tendrilGeo,
      matrix: makeTransform(0, 0, 0),
      colorRgb: i % 2 === 0 ? glacialWhite : abyssalBlue,
    });

    const glowPts: Vec3Tuple[] = [
      [ca * 0.24, 0.84, sa * 0.24],
      [ca * 0.31, 0.60, sa * 0.31 + swayZ * 0.35],
      [ca * 0.20, 0.38, sa * 0.20 + swayZ * 0.75],
      [ca * 0.27, lenDrop + 0.04, sa * 0.27 + swayZ],
    ];
    const glowFilGeo = trackGeo(out, createTaperedTubePart(glowPts, 0.009, 0.004, 10, 6));
    out.energy.push({ geo: glowFilGeo, matrix: makeTransform(0, 0, 0), colorRgb: bioSeafoam });

    out.trim.push({
      geo: damperRingGeo,
      matrix: makeTransform(ca * 0.30, 0.54, sa * 0.30 + swayZ * 0.5, 0.2, 0, 0),
      colorRgb: cryoTitanium,
    });
  }

  pushStar3ArcWings(out, 1.06, -0.20, 0.44, 0.52, cryoTitanium);

  out.headTopLocalY = 1.58;
  out.weaponGlowHex = 0x52dce0;
  out.crystalHex = 0x8ce4f8;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.44;
}

function buildS07(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const deepNavy: RgbTriple = [0.19, 0.30, 0.48];
  const slateNavy: RgbTriple = [0.28, 0.41, 0.60];
  const titaniumSilver: RgbTriple = [0.76, 0.81, 0.87];
  const darkGraphite: RgbTriple = [0.18, 0.21, 0.27];
  const opticalBrass: RgbTriple = [0.84, 0.69, 0.38];
  const starAzure: RgbTriple = [0.42, 0.78, 0.96];
  const lensGlass: RgbTriple = [0.70, 0.90, 1.00];

  const perchBaseGeo = trackGeo(out, new THREE.TorusGeometry(0.28, 0.022, 8, 22));
  perchBaseGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: perchBaseGeo,
    matrix: makeTransform(0, 0.09, 0),
    colorRgb: opticalBrass,
  });

  const perchArcGeo = trackGeo(
    out,
    createOrganicLimb(
      [
        [-0.26, 0.10, 0.0],
        [-0.18, 0.24, 0.04],
        [0.0, 0.28, 0.06],
        [0.18, 0.24, 0.04],
        [0.26, 0.10, 0.0],
      ],
      0.022,
      0.026,
      0.022,
      14,
      8,
    ),
  );
  out.trim.push({ geo: perchArcGeo, matrix: makeTransform(0, 0, 0), colorRgb: opticalBrass });

  const talonGeo = trackGeo(out, createCurvedBladePart(0.12, 0.030, 0.016, 0.05, 0.02, 6));
  for (const side of [-1, 1] as const) {
    const legGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.11, 0.48, 0.0],
          [side * 0.13, 0.38, -0.02],
          [side * 0.12, 0.28, 0.04],
        ],
        0.032,
        0.026,
        0.022,
        10,
        8,
      ),
    );
    out.matte.push({ geo: legGeo, matrix: makeTransform(0, 0, 0), colorRgb: darkGraphite });
    for (let t = -1; t <= 1; t += 1) {
      out.trim.push({
        geo: talonGeo,
        matrix: makeTransform(side * 0.12 + t * 0.035, 0.29, 0.06, Math.PI * 0.62, t * 0.34, 0),
        colorRgb: titaniumSilver,
      });
    }
  }

  const torsoGeo = trackGeo(
    out,
    createTeardropPart(0.68, 0.235, 1.22, 18, 14, 0.03, slateNavy, deepNavy),
  );
  out.armor.push({
    geo: torsoGeo,
    matrix: makeTransform(0, 0.74, -0.02, 0.12, 0, 0, 1.0, 1.0, 0.92),
  });

  const chestShieldGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.22],
        [0.16, 0.10],
        [0.12, -0.16],
        [0.0, -0.24],
        [-0.12, -0.16],
        [-0.16, 0.10],
      ],
      0.064,
      0.018,
      0.016,
      2,
      4,
    ),
  );
  out.armor.push({
    geo: chestShieldGeo,
    matrix: makeTransform(0, 0.74, 0.18, -0.14, 0, 0),
    colorRgb: titaniumSilver,
  });

  const sternumRingGeo = trackGeo(out, new THREE.TorusGeometry(0.088, 0.015, 8, 18));
  out.trim.push({
    geo: sternumRingGeo,
    matrix: makeTransform(0, 0.76, 0.22, -0.14, 0, 0),
    colorRgb: opticalBrass,
  });
  const sternumCoreGeo = trackGeo(out, new THREE.OctahedronGeometry(0.044, 0));
  out.energy.push({
    geo: sternumCoreGeo,
    matrix: makeTransform(0, 0.76, 0.22),
    colorRgb: starAzure,
  });

  const tailFeatherGeo = trackGeo(out, createPetalPart(0.36, 0.11, 0.018, 0.022, 1.35, 8, 6));
  for (let i = -1; i <= 1; i += 1) {
    out.armor.push({
      geo: tailFeatherGeo,
      matrix: makeTransform(i * 0.08, 0.44, -0.22, -2.55, i * 0.26, i * 0.14),
      colorRgb: i === 0 ? titaniumSilver : deepNavy,
    });
  }

  const headGeo = trackGeo(out, new THREE.SphereGeometry(0.205, 16, 12));
  out.armor.push({
    geo: headGeo,
    matrix: makeTransform(0, 1.18, 0.04, 0, 0, 0, 1.12, 0.94, 0.96),
    colorRgb: deepNavy,
  });

  const ruffPlateGeo = trackGeo(out, createPetalPart(0.22, 0.18, 0.024, 0.020, 1.15, 8, 6));
  const lensBarrelGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.082, 0.0],
        [0.092, 0.04],
        [0.084, 0.09],
        [0.076, 0.13],
      ],
      16,
    ),
  );
  lensBarrelGeo.rotateX(Math.PI * 0.5);
  const lensIrisGeo = trackGeo(out, new THREE.CylinderGeometry(0.060, 0.060, 0.024, 14));
  lensIrisGeo.rotateX(Math.PI * 0.5);
  const lensDomeGeo = trackGeo(out, new THREE.SphereGeometry(0.068, 12, 10));
  const earTuftGeo = trackGeo(out, createCurvedBladePart(0.24, 0.064, 0.022, 0.07, 0.02, 8));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: ruffPlateGeo,
      matrix: makeTransform(side * 0.11, 1.16, 0.18, 0.12, side * 0.28, -side * 0.36, side, 1, 1),
      colorRgb: titaniumSilver,
    });
    const eyeMat = makeTransform(side * 0.105, 1.19, 0.16, 0.04, side * 0.14, 0);
    out.trim.push({ geo: lensBarrelGeo, matrix: eyeMat, colorRgb: opticalBrass });
    out.energy.push({
      geo: lensIrisGeo,
      matrix: eyeMat.clone().multiply(makeTransform(0, 0, 0.11)),
      colorRgb: starAzure,
    });
    out.crystal.push({
      geo: lensDomeGeo,
      matrix: eyeMat.clone().multiply(makeTransform(0, 0, 0.115, 0, 0, 0, 1.0, 1.0, 0.45)),
      colorRgb: lensGlass,
    });
    out.trim.push({
      geo: earTuftGeo,
      matrix: makeTransform(side * 0.14, 1.28, 0.04, -0.22, -side * 0.18, -side * 0.56, side, 1, 1),
      colorRgb: titaniumSilver,
    });
  }

  const beakGeo = trackGeo(out, createFacetedCrystalPart(0.14, 0.046, 4, 0.28, 0.72));
  out.trim.push({
    geo: beakGeo,
    matrix: makeTransform(0, 1.10, 0.25, 0.36, 0, 0),
    colorRgb: opticalBrass,
  });

  const covertGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0.0, 0.13],
        [0.38, 0.21],
        [0.44, 0.04],
        [0.21, -0.09],
        [0.0, -0.07],
      ],
      0.040,
      0.013,
      0.012,
      2,
      4,
    ),
  );
  const featherBladeGeo = trackGeo(out, createCurvedBladePart(0.38, 0.080, 0.018, 0.07, 0.02, 8));
  const dialRingGeo = trackGeo(out, new THREE.TorusGeometry(0.185, 0.015, 8, 20));
  const dialCrossGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.008, 0.35, 6));
  const dialNodeGeo = trackGeo(out, new THREE.OctahedronGeometry(0.034, 0));

  for (const side of [-1, 1] as const) {
    const wm = makeTransform(side * 0.20, 0.88, -0.04, 0.08, -side * 0.42, side * 0.12, side, 1, 1);
    out.armor.push({ geo: covertGeo, matrix: wm, colorRgb: deepNavy });

    for (let f = 0; f < 3; f += 1) {
      out.armor.push({
        geo: featherBladeGeo,
        matrix: wm.clone().multiply(makeTransform(0.18 + f * 0.095, 0.08 - f * 0.055, -0.02, 0.12, 0, -1.78 - f * 0.24, 1, 1 - f * 0.12, 1)),
        colorRgb: f === 1 ? titaniumSilver : slateNavy,
      });
    }

    const dialMat = wm.clone().multiply(makeTransform(0.28, -0.04, 0.06, 0, 0.18, 0));
    out.trim.push({ geo: dialRingGeo, matrix: dialMat, colorRgb: opticalBrass });
    out.trim.push(
      { geo: dialCrossGeo, matrix: dialMat, colorRgb: opticalBrass },
      { geo: dialCrossGeo, matrix: dialMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, Math.PI * 0.5)), colorRgb: opticalBrass },
    );
    out.energy.push({ geo: dialNodeGeo, matrix: dialMat, colorRgb: starAzure });
  }

  pushStar3ArcWings(out, 1.08, -0.22, 0.46, 0.52, opticalBrass);

  out.headTopLocalY = 1.58;
  out.weaponGlowHex = 0x58b8f4;
  out.crystalHex = 0x8ad8ff;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.42;
}

function buildS08(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const obsidianBlack: RgbTriple = [0.16, 0.14, 0.23];
  const darkPlum: RgbTriple = [0.30, 0.22, 0.42];
  const gunmetalTrim: RgbTriple = [0.48, 0.44, 0.56];
  const matteVoid: RgbTriple = [0.12, 0.11, 0.17];
  const magMagenta: RgbTriple = [0.78, 0.36, 0.84];
  const shearViolet: RgbTriple = [0.88, 0.52, 0.82];

  const shuttle = makeTransform(0, 0.94, 0.06, -0.20, 0, 0.07);

  const bladeHullGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.48, 0.0],
        [-0.12, 0.105],
        [0.30, 0.088],
        [0.64, 0.015],
        [0.32, -0.072],
        [-0.18, -0.086],
      ],
      0.058,
      0.015,
      0.015,
      2,
      4,
    ),
  );
  bladeHullGeo.rotateY(-Math.PI * 0.5);

  const canardGeo = trackGeo(out, createCurvedBladePart(0.24, 0.062, 0.016, 0.05, 0.015, 8));
  const aftFinGeo = trackGeo(out, createCurvedBladePart(0.38, 0.088, 0.020, 0.09, 0.02, 8));
  const dorsalProngGeo = trackGeo(out, createCurvedBladePart(0.28, 0.052, 0.016, 0.06, 0.02, 6));
  const ventFinGeo = trackGeo(out, createCurvedBladePart(0.22, 0.048, 0.015, 0.04, 0.01, 6));
  const podGeo = trackGeo(out, createTeardropPart(0.42, 0.052, 1.4, 14, 10));
  const podCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.056, 0.011, 6, 14));
  const magFinGeo = trackGeo(out, createFacetedCrystalPart(0.11, 0.022, 4, 0.65, 0.35));
  const railStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.82, 8));
  railStripGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: bladeHullGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.112, 0, 0, 0, -side * 0.04, -side * 0.08)),
      colorRgb: obsidianBlack,
    });
    out.armor.push({
      geo: podGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.188, -0.01, -0.06, -Math.PI * 0.5, 0, 0)),
      colorRgb: darkPlum,
    });
    out.trim.push(
      {
        geo: podCollarGeo,
        matrix: shuttle.clone().multiply(makeTransform(side * 0.188, -0.01, 0.05)),
        colorRgb: gunmetalTrim,
      },
      {
        geo: podCollarGeo,
        matrix: shuttle.clone().multiply(makeTransform(side * 0.188, -0.01, -0.14)),
        colorRgb: gunmetalTrim,
      },
    );
    out.trim.push({
      geo: canardGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.13, 0.02, 0.30, Math.PI * 0.5, 0, side * 1.18, side, 1, 1)),
      colorRgb: gunmetalTrim,
    });
    out.armor.push({
      geo: aftFinGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.14, 0.04, -0.24, -0.24, side * 0.14, -side * 0.68, side, 1, 1)),
      colorRgb: darkPlum,
    });
    out.armor.push({
      geo: dorsalProngGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.11, 0.08, -0.10, -0.42, 0, -side * 0.24, side, 1, 1)),
      colorRgb: obsidianBlack,
    });
    out.matte.push({
      geo: ventFinGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.11, -0.08, -0.12, Math.PI + 0.38, 0, -side * 0.20, side, 1, 1)),
      colorRgb: matteVoid,
    });
    out.energy.push({
      geo: railStripGeo,
      matrix: shuttle.clone().multiply(makeTransform(side * 0.056, 0.0, 0.06)),
      colorRgb: magMagenta,
    });
    for (let k = 0; k < 2; k += 1) {
      out.trim.push({
        geo: magFinGeo,
        matrix: shuttle.clone().multiply(makeTransform(side * 0.14, 0.075, 0.22 - k * 0.24, -0.35, 0, -side * 0.45)),
        colorRgb: gunmetalTrim,
      });
    }
  }

  const yokeArchGeo = trackGeo(out, new THREE.TorusGeometry(0.112, 0.015, 6, 14, Math.PI));
  const yokeCoordsZ = [-0.28, -0.08, 0.12, 0.32];
  for (let i = 0; i < yokeCoordsZ.length; i += 1) {
    const yz = yokeCoordsZ[i]!;
    out.trim.push({
      geo: yokeArchGeo,
      matrix: shuttle.clone().multiply(makeTransform(0, 0.02, yz)),
      colorRgb: gunmetalTrim,
    });
    out.matte.push({
      geo: yokeArchGeo,
      matrix: shuttle.clone().multiply(makeTransform(0, -0.02, yz, Math.PI, 0, 0)),
      colorRgb: matteVoid,
    });
  }

  const sparkBridgeGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6));
  sparkBridgeGeo.rotateZ(Math.PI * 0.5);
  for (const sz of [-0.18, 0.02, 0.22]) {
    out.energy.push({
      geo: sparkBridgeGeo,
      matrix: shuttle.clone().multiply(makeTransform(0, 0, sz, 0, 0.25, 0)),
      colorRgb: shearViolet,
    });
  }

  const coreNeedleGeo = trackGeo(out, createFacetedCrystalPart(0.60, 0.046, 6, 0.58, 0.42));
  coreNeedleGeo.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: coreNeedleGeo,
    matrix: shuttle.clone().multiply(makeTransform(0, 0, 0.08)),
    colorRgb: shearViolet,
  });

  const innerFilamentGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.70, 8));
  innerFilamentGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: innerFilamentGeo,
    matrix: shuttle.clone().multiply(makeTransform(0, 0, 0.12)),
    colorRgb: shearViolet,
  });

  const shearPlumeGeo = trackGeo(out, createCurvedBladePart(0.50, 0.11, 0.018, 0.09, 0.02, 10));
  for (const side of [-1, 1] as const) {
    const pm = shuttle.clone().multiply(
      makeTransform(side * 0.048, 0.0, -0.38, -Math.PI * 0.5, side * 0.24, side * 0.12, side, 1, 1),
    );
    out.energy.push({ geo: shearPlumeGeo, matrix: pm, colorRgb: magMagenta });
    out.crystal.push({
      geo: shearPlumeGeo,
      matrix: pm.clone().multiply(makeTransform(0.02, 0.03, 0, 0, 0, 0, 1.14, 1.16, 1.38)),
      colorRgb: shearViolet,
    });
  }

  const centerExhaustGeo = trackGeo(out, createFacetedCrystalPart(0.44, 0.048, 4, 0.22, 0.78));
  centerExhaustGeo.rotateX(-Math.PI * 0.5);
  out.energy.push({
    geo: centerExhaustGeo,
    matrix: shuttle.clone().multiply(makeTransform(0, 0, -0.54)),
    colorRgb: shearViolet,
  });

  const hoverArcGeo = trackGeo(out, new THREE.TorusGeometry(0.22, 0.011, 6, 20));
  hoverArcGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: hoverArcGeo,
    matrix: makeTransform(0, 0.24, 0.0),
    colorRgb: magMagenta,
  });

  pushStar3ArcWings(out, 1.08, -0.24, 0.36, 0.56, gunmetalTrim);

  out.headTopLocalY = 1.46;
  out.weaponGlowHex = 0xc85ad8;
  out.crystalHex = 0xdf7cf0;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.48;
}

function buildS09(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const obsidianBlack: RgbTriple = [0.17, 0.14, 0.24];
  const darkPlum: RgbTriple = [0.31, 0.23, 0.44];
  const gunmetalTrim: RgbTriple = [0.50, 0.46, 0.58];
  const matteVoid: RgbTriple = [0.13, 0.12, 0.18];
  const tungstenSteel: RgbTriple = [0.74, 0.72, 0.80];
  const magMagenta: RgbTriple = [0.76, 0.36, 0.84];
  const warheadGlow: RgbTriple = [0.90, 0.56, 0.88];

  const breechGeo = trackGeo(out, createChamferedHexPart(0.21, 0.24, 0.020));
  breechGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: breechGeo,
    matrix: makeTransform(0, 0.70, -0.06),
    colorRgb: obsidianBlack,
  });

  const cradleStemGeo = trackGeo(out, new THREE.CylinderGeometry(0.11, 0.14, 0.24, 10));
  out.matte.push({
    geo: cradleStemGeo,
    matrix: makeTransform(0, 0.54, -0.06),
    colorRgb: matteVoid,
  });

  const capDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.072, 0.072, 0.18, 12));
  capDrumGeo.rotateZ(Math.PI * 0.5);
  const coilFinGeo = trackGeo(out, createCurvedBladePart(0.24, 0.056, 0.018, 0.04, 0.01, 6));
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: capDrumGeo,
      matrix: makeTransform(side * 0.19, 0.68, -0.08),
      colorRgb: darkPlum,
    });
    out.matte.push({
      geo: coilFinGeo,
      matrix: makeTransform(side * 0.24, 0.78, -0.14, -0.26, 0, -side * 0.36, side, 1, 1),
      colorRgb: matteVoid,
    });
  }

  const clawFootGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.065, -0.04],
        [0.065, -0.04],
        [0.085, 0.05],
        [0.0, 0.14],
        [-0.085, 0.05],
      ],
      0.042,
      0.009,
      0.009,
      1,
      4,
    ),
  );
  clawFootGeo.rotateX(Math.PI * 0.5);
  const clawSpikeGeo = trackGeo(out, new THREE.ConeGeometry(0.026, 0.10, 6));
  const pistonGeo = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 1.0, 8));
  const anchorAngles = [Math.PI * 0.28, -Math.PI * 0.28, Math.PI];

  for (const ang of anchorAngles) {
    const sx = Math.sin(ang);
    const cz = Math.cos(ang);
    const top = new THREE.Vector3(sx * 0.15, 0.62, cz * 0.15 - 0.06);
    const mid = new THREE.Vector3(sx * 0.36, 0.42, cz * 0.36 - 0.06);
    const bot = new THREE.Vector3(sx * 0.46, 0.10, cz * 0.46 - 0.06);

    const legGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [top.x, top.y, top.z],
          [mid.x, mid.y, mid.z],
          [bot.x, bot.y, bot.z],
        ],
        0.048,
        0.042,
        0.030,
        12,
        8,
      ),
    );
    out.armor.push({ geo: legGeo, matrix: makeTransform(0, 0, 0), colorRgb: obsidianBlack });

    out.trim.push({
      geo: pistonGeo,
      matrix: makeSegmentTransform(
        new THREE.Vector3(sx * 0.12, 0.52, cz * 0.12 - 0.06),
        new THREE.Vector3(sx * 0.35, 0.18, cz * 0.35 - 0.06),
        1,
        1,
      ),
      colorRgb: gunmetalTrim,
    });

    out.matte.push({
      geo: clawFootGeo,
      matrix: makeTransform(bot.x, 0.085, bot.z, 0, ang, 0),
      colorRgb: matteVoid,
    });
    out.trim.push({
      geo: clawSpikeGeo,
      matrix: makeTransform(bot.x + sx * 0.07, 0.11, bot.z + cz * 0.07, 0.65, ang, 0),
      colorRgb: gunmetalTrim,
    });
  }

  const bowPivot = makeTransform(0, 0.84, 0.02, -0.08, 0, 0);

  const railBeamGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.38, -0.036],
        [0.60, -0.024],
        [0.64, 0.020],
        [-0.34, 0.044],
      ],
      0.040,
      0.010,
      0.010,
      1,
      4,
    ),
  );
  railBeamGeo.rotateY(-Math.PI * 0.5);

  const railGlowGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.90, 8));
  railGlowGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: railBeamGeo,
      matrix: bowPivot.clone().multiply(makeTransform(side * 0.088, 0.0, 0.10)),
      colorRgb: obsidianBlack,
    });
    out.energy.push({
      geo: railGlowGeo,
      matrix: bowPivot.clone().multiply(makeTransform(side * 0.056, 0.01, 0.16)),
      colorRgb: magMagenta,
    });
  }

  const railClampGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.015, 6, 14, Math.PI));
  for (let i = 0; i < 4; i += 1) {
    out.trim.push({
      geo: railClampGeo,
      matrix: bowPivot.clone().multiply(makeTransform(0, -0.01, -0.10 + i * 0.22, Math.PI, 0, 0)),
      colorRgb: gunmetalTrim,
    });
  }

  const sightArchGeo = trackGeo(out, new THREE.TorusGeometry(0.16, 0.016, 8, 18, Math.PI));
  out.armor.push({
    geo: sightArchGeo,
    matrix: bowPivot.clone().multiply(makeTransform(0, 0.10, -0.14)),
    colorRgb: darkPlum,
  });

  const sightRingGeo = trackGeo(out, new THREE.TorusGeometry(0.125, 0.012, 8, 18));
  out.crystal.push({
    geo: sightRingGeo,
    matrix: bowPivot.clone().multiply(makeTransform(0, 0.26, -0.14)),
    colorRgb: warheadGlow,
  });

  const prodCamGeo = trackGeo(out, new THREE.CylinderGeometry(0.046, 0.046, 0.24, 12));
  const prodRingGeo = trackGeo(out, new THREE.TorusGeometry(0.068, 0.014, 6, 16));
  prodRingGeo.rotateX(Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    for (const vert of [-1, 1] as const) {
      const limbGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.10, vert * 0.05, 0.42],
            [side * 0.40, vert * 0.12, 0.34],
            [side * 0.64, vert * 0.11, 0.12],
          ],
          0.040,
          0.036,
          0.024,
          12,
          8,
        ),
      );
      out.armor.push({
        geo: limbGeo,
        matrix: bowPivot,
        colorRgb: vert === 1 ? darkPlum : obsidianBlack,
      });
    }

    const tipMat = bowPivot.clone().multiply(makeTransform(side * 0.64, 0.0, 0.12));
    out.trim.push({ geo: prodCamGeo, matrix: tipMat, colorRgb: gunmetalTrim });
    out.energy.push({ geo: prodRingGeo, matrix: tipMat, colorRgb: magMagenta });

    const stringGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [side * 0.64, 0.0, 0.12],
          [side * 0.32, 0.01, -0.09],
          [0.0, 0.02, -0.24],
        ],
        0.011,
        0.009,
        10,
        6,
      ),
    );
    out.energy.push({ geo: stringGeo, matrix: bowPivot, colorRgb: warheadGlow });
  }

  const drawFieldGeo = trackGeo(
    out,
    createFlowingRibbonMesh(
      [
        [-0.62, 0.0, 0.12],
        [0.0, 0.02, -0.20],
        [0.62, 0.0, 0.12],
      ],
      [0.04, 0.09, 0.04],
      0.005,
      1.0,
      16,
      4,
      0.006,
    ),
  );
  out.crystal.push({ geo: drawFieldGeo, matrix: bowPivot, colorRgb: magMagenta });

  const boltShaftGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.024, 0.90, 10));
  boltShaftGeo.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: boltShaftGeo,
    matrix: bowPivot.clone().multiply(makeTransform(0, 0.02, 0.24)),
    colorRgb: tungstenSteel,
  });

  const warheadGeo = trackGeo(out, createFacetedCrystalPart(0.30, 0.066, 4, 0.72, 0.28));
  warheadGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: warheadGeo,
    matrix: bowPivot.clone().multiply(makeTransform(0, 0.02, 0.74, 0, Math.PI * 0.25, 0)),
    colorRgb: warheadGlow,
  });
  out.crystal.push({
    geo: warheadGeo,
    matrix: bowPivot.clone().multiply(makeTransform(0, 0.02, 0.74, 0, 0, 0, 1.24, 1.12, 1.24)),
    colorRgb: magMagenta,
  });

  const fletchGeo = trackGeo(out, createCurvedBladePart(0.18, 0.056, 0.012, 0.03, 0.01, 6));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    out.armor.push({
      geo: fletchGeo,
      matrix: bowPivot.clone().multiply(makeTransform(0, 0.02, -0.16, -Math.PI * 0.42, 0, a)),
      colorRgb: darkPlum,
    });
  }

  pushStar3ArcWings(out, 1.06, -0.22, 0.52, 0.56, gunmetalTrim);

  out.headTopLocalY = 1.48;
  out.weaponGlowHex = 0xc454d6;
  out.crystalHex = 0xe082ee;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.46;
}

function buildS10(_ctx: UnitBuilderContext, out: UnitBlueprintParts): void {
  const forgedCopper: RgbTriple = [0.68, 0.41, 0.22];
  const solarGold: RgbTriple = [0.85, 0.68, 0.36];
  const brightBrass: RgbTriple = [0.92, 0.80, 0.48];
  const forgeIron: RgbTriple = [0.20, 0.18, 0.17];
  const railAmber: RgbTriple = [0.96, 0.64, 0.24];
  const focusGold: RgbTriple = [0.98, 0.82, 0.46];

  const thoraxGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.22, -0.34],
        [0.22, -0.34],
        [0.28, 0.04],
        [0.18, 0.36],
        [0.0, 0.44],
        [-0.18, 0.36],
        [-0.28, 0.04],
      ],
      0.16,
      0.024,
      0.022,
      2,
      6,
    ),
  );
  thoraxGeo.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: thoraxGeo,
    matrix: makeTransform(0, 0.40, 0.04),
    colorRgb: forgedCopper,
  });

  const dorsalPlateGeo = trackGeo(out, createChamferedHexPart(0.18, 0.06, 0.014));
  dorsalPlateGeo.rotateX(Math.PI * 0.5);
  out.armor.push(
    { geo: dorsalPlateGeo, matrix: makeTransform(0, 0.50, 0.14, 0.16, 0, 0, 1.0, 1.0, 0.86), colorRgb: solarGold },
    { geo: dorsalPlateGeo, matrix: makeTransform(0, 0.51, -0.06, -0.08, 0, 0, 1.12, 1.0, 0.92), colorRgb: forgedCopper },
  );

  const eyeClusterGeo = trackGeo(out, new THREE.SphereGeometry(0.032, 8, 8));
  for (const side of [-1, 1] as const) {
    out.energy.push({
      geo: eyeClusterGeo,
      matrix: makeTransform(side * 0.09, 0.44, 0.42),
      colorRgb: railAmber,
    });
  }

  const pincerBladeGeo = trackGeo(out, createCurvedBladePart(0.28, 0.084, 0.032, 0.09, 0.02, 8));
  for (const side of [-1, 1] as const) {
    const pedipalpGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.22, 0.38, 0.32],
          [side * 0.36, 0.32, 0.48],
          [side * 0.28, 0.26, 0.62],
        ],
        0.044,
        0.048,
        0.036,
        10,
        8,
      ),
    );
    out.armor.push({ geo: pedipalpGeo, matrix: makeTransform(0, 0, 0), colorRgb: forgedCopper });
    out.trim.push({
      geo: pincerBladeGeo,
      matrix: makeTransform(side * 0.28, 0.26, 0.60, Math.PI * 0.52, -side * 0.42, 0, side, 1, 1),
      colorRgb: solarGold,
    });
  }

  const kneeGuardGeo = trackGeo(out, createChamferedHexPart(0.068, 0.042, 0.010));
  const footPodGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.055, -0.036],
        [0.055, -0.036],
        [0.072, 0.04],
        [0.0, 0.11],
        [-0.072, 0.04],
      ],
      0.040,
      0.008,
      0.008,
      1,
      4,
    ),
  );
  footPodGeo.rotateX(Math.PI * 0.5);
  const legZSpecs = [0.14, -0.18];

  for (let i = 0; i < legZSpecs.length; i += 1) {
    const lz = legZSpecs[i]!;
    for (const side of [-1, 1] as const) {
      const hx = side * 0.24;
      const kx = side * 0.50;
      const fx = side * 0.58;
      const fullLegGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [hx, 0.38, lz],
            [(hx + kx) * 0.5, 0.54, lz],
            [kx, 0.46, lz * 1.1],
            [side * 0.56, 0.28, lz * 1.15],
            [fx, 0.11, lz * 1.2],
          ],
          0.044,
          0.042,
          0.022,
          14,
          8,
        ),
      );
      out.armor.push({ geo: fullLegGeo, matrix: makeTransform(0, 0, 0), colorRgb: forgedCopper });
      out.trim.push({
        geo: kneeGuardGeo,
        matrix: makeTransform(kx, 0.48, lz * 1.1, 0, side * 0.3, 0),
        colorRgb: solarGold,
      });
      out.matte.push({
        geo: footPodGeo,
        matrix: makeTransform(fx, 0.085, lz * 1.2, 0, side * 0.5, 0),
        colorRgb: forgeIron,
      });
    }
  }

  const wingMirrorGeo = trackGeo(
    out,
    createHexMirrorTilePart(0.145, 0.020, 0.010, 0.010, brightBrass, solarGold),
  );
  for (const side of [-1, 1] as const) {
    const wingBase = makeTransform(side * 0.24, 0.52, -0.06, -0.22, -side * 0.36, side * 0.52, side, 1, 1);
    const wingStrutGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0.0, 0.0, 0.0],
          [0.24, 0.06, -0.04],
          [0.48, 0.02, -0.10],
        ],
        0.024,
        0.020,
        0.014,
        10,
        8,
      ),
    );
    out.matte.push({ geo: wingStrutGeo, matrix: wingBase, colorRgb: forgeIron });
    const tileCoords: readonly (readonly [number, number, number])[] = [
      [0.16, 0.04, 0.92],
      [0.34, 0.06, 1.00],
      [0.50, 0.01, 0.84],
    ];
    for (const [tx, ty, ts] of tileCoords) {
      out.trim.push({
        geo: wingMirrorGeo,
        matrix: wingBase.clone().multiply(makeTransform(tx, ty, 0.02, -0.22, 0, 0, ts, ts, 1)),
      });
    }
    const wingConduitGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.010, 0.44, 6));
    wingConduitGeo.rotateZ(Math.PI * 0.5);
    out.energy.push({
      geo: wingConduitGeo,
      matrix: wingBase.clone().multiply(makeTransform(0.28, 0.02, 0.04)),
      colorRgb: railAmber,
    });
  }

  const tailSegSpecs: readonly (readonly [number, number, number, number])[] = [
    [0.56, -0.34, -0.42, 0.112],
    [0.84, -0.44, -0.08, 0.104],
    [1.14, -0.42, 0.44, 0.096],
    [1.38, -0.26, 1.06, 0.088],
    [1.50, -0.02, 1.48, 0.082],
  ];

  const tailShellGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-1.0, -0.68],
        [1.0, -0.68],
        [0.84, 0.72],
        [-0.84, 0.72],
      ],
      1.35,
      0.16,
      0.16,
      2,
      4,
    ),
  );
  const tailJointGeo = trackGeo(out, new THREE.SphereGeometry(0.072, 10, 8));
  const tailNodeGeo = trackGeo(out, new THREE.CylinderGeometry(0.022, 0.022, 0.14, 8));

  for (let i = 0; i < tailSegSpecs.length; i += 1) {
    const [ty, tz, rx, sc] = tailSegSpecs[i]!;
    const tm = makeTransform(0, ty, tz, rx, 0, 0);
    out.armor.push({
      geo: tailShellGeo,
      matrix: tm.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, sc, sc * 1.15, sc)),
      colorRgb: i % 2 === 0 ? forgedCopper : solarGold,
    });
    out.matte.push({
      geo: tailJointGeo,
      matrix: makeTransform(0, ty - 0.04, tz),
      colorRgb: forgeIron,
    });
    out.energy.push({
      geo: tailNodeGeo,
      matrix: tm.clone().multiply(makeTransform(0, 0, -sc * 0.85)),
      colorRgb: railAmber,
    });
  }

  for (const side of [-1, 1] as const) {
    const tailHydraulicGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [side * 0.11, 0.54, -0.32],
          [side * 0.10, 0.86, -0.46],
          [side * 0.09, 1.18, -0.44],
          [side * 0.08, 1.42, -0.24],
          [side * 0.08, 1.50, 0.04],
        ],
        0.018,
        0.016,
        0.014,
        16,
        8,
      ),
    );
    out.trim.push({ geo: tailHydraulicGeo, matrix: makeTransform(0, 0, 0), colorRgb: brightBrass });
  }

  const cannonPivot = makeTransform(0, 1.50, 0.16, 0.24, 0, 0);
  const railProngGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.14, -0.036],
        [0.44, -0.020],
        [0.48, 0.018],
        [-0.12, 0.042],
      ],
      0.038,
      0.009,
      0.009,
      1,
      4,
    ),
  );
  railProngGeo.rotateY(-Math.PI * 0.5);

  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: railProngGeo,
      matrix: cannonPivot.clone().multiply(makeTransform(side * 0.072, 0, 0.12)),
      colorRgb: solarGold,
    });
  }

  const coilRingGeo = trackGeo(out, new THREE.TorusGeometry(0.088, 0.015, 8, 16));
  for (let k = 0; k < 3; k += 1) {
    out.trim.push({
      geo: coilRingGeo,
      matrix: cannonPivot.clone().multiply(makeTransform(0, 0, 0.08 + k * 0.14)),
      colorRgb: brightBrass,
    });
  }

  const stingerCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.38, 0.056, 6, 0.70, 0.30));
  stingerCrystalGeo.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: stingerCrystalGeo,
    matrix: cannonPivot.clone().multiply(makeTransform(0, 0, 0.34)),
    colorRgb: focusGold,
  });

  const stingerCoreGeo = trackGeo(out, new THREE.ConeGeometry(0.036, 0.34, 8));
  stingerCoreGeo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: stingerCoreGeo,
    matrix: cannonPivot.clone().multiply(makeTransform(0, 0, 0.44)),
    colorRgb: railAmber,
  });

  pushStar3ArcWings(out, 1.08, -0.24, 0.52, 0.58, brightBrass);

  out.headTopLocalY = 1.72;
  out.weaponGlowHex = 0xf49830;
  out.crystalHex = 0xf8c058;
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
