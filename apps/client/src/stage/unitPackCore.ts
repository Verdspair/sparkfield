import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
  createCurvedBladePart,
  createFacetedCrystalPart,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createPetalPart,
  createSculptedClothLathe,
  createTaperedTubePart,
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type GeometryPartSpec,
  type RgbTriple,
  type UnitBlueprintParts,
  type Vec3Tuple,
} from './unitBuilderCore.js';

function createToothedGearPart(
  innerRadius: number,
  outerRadius: number,
  teethCount: number,
  thickness: number,
): THREE.BufferGeometry {
  const pts: (readonly [number, number])[] = [];
  const step = (Math.PI * 2) / teethCount;
  for (let i = 0; i < teethCount; i += 1) {
    const a0 = i * step;
    const a1 = a0 + step * 0.22;
    const a2 = a0 + step * 0.34;
    const a3 = a0 + step * 0.66;
    const a4 = a0 + step * 0.78;
    pts.push(
      [Math.cos(a0) * innerRadius, Math.sin(a0) * innerRadius],
      [Math.cos(a1) * innerRadius, Math.sin(a1) * innerRadius],
      [Math.cos(a2) * outerRadius, Math.sin(a2) * outerRadius],
      [Math.cos(a3) * outerRadius, Math.sin(a3) * outerRadius],
      [Math.cos(a4) * innerRadius, Math.sin(a4) * innerRadius],
    );
  }
  const geo = createBevelExtrudePart(pts, thickness, 0.005, 0.005, 1, 2);
  geo.rotateY(Math.PI * 0.5);
  return geo;
}

export const UNIT_PACK_CORE_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S04: (_ctx, out) => {
    const starIndigo: RgbTriple = [0.20, 0.30, 0.48];
    const deepIndigo: RgbTriple = [0.14, 0.22, 0.36];
    const warmBronze: RgbTriple = [0.80, 0.62, 0.34];
    const agedBrass: RgbTriple = [0.88, 0.74, 0.46];
    const chassisIron: RgbTriple = [0.18, 0.21, 0.27];
    const plasmaCyan: RgbTriple = [0.36, 0.84, 0.92];
    const vacuumTint: RgbTriple = [0.68, 0.90, 0.96];
    const warmFilament: RgbTriple = [0.94, 0.80, 0.44];

    const lowerTubGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.24, -0.34],
          [0.24, -0.34],
          [0.32, 0.04],
          [0.22, 0.38],
          [0.0, 0.48],
          [-0.22, 0.38],
          [-0.32, 0.04],
        ],
        0.16,
        0.022,
        0.020,
        2,
        6,
      ),
    );
    lowerTubGeo.rotateX(Math.PI * 0.5);
    out.matte.push({
      geo: lowerTubGeo,
      matrix: makeTransform(0, 0.33, 0.02),
      colorRgb: chassisIron,
    });

    const bumperGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.28, 0.28, 0.38],
          [-0.14, 0.26, 0.52],
          [0.0, 0.27, 0.56],
          [0.14, 0.26, 0.52],
          [0.28, 0.28, 0.38],
        ],
        0.028,
        0.036,
        0.028,
        14,
        10,
      ),
    );
    out.trim.push({ geo: bumperGeo, matrix: makeTransform(0, 0, 0), colorRgb: warmBronze });

    const wheelPositions: readonly (readonly [number, number, number])[] = [
      [-0.38, 0.25, 0.24],
      [0.38, 0.25, 0.24],
      [-0.40, 0.27, -0.22],
      [0.40, 0.27, -0.22],
    ];
    const tireGeo = trackGeo(out, new THREE.TorusGeometry(0.145, 0.046, 8, 18));
    tireGeo.rotateY(Math.PI * 0.5);
    const wheelHubGeo = trackGeo(out, new THREE.CylinderGeometry(0.088, 0.096, 0.09, 12));
    wheelHubGeo.rotateZ(Math.PI * 0.5);
    const wheelCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.044, 0.056, 0.115, 8));
    wheelCapGeo.rotateZ(Math.PI * 0.5);
    const axleGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.032, 0.74, 10));
    axleGeo.rotateZ(Math.PI * 0.5);

    out.matte.push(
      { geo: axleGeo, matrix: makeTransform(0, 0.25, 0.24), colorRgb: chassisIron },
      { geo: axleGeo, matrix: makeTransform(0, 0.27, -0.22), colorRgb: chassisIron },
    );

    for (const [wx, wy, wz] of wheelPositions) {
      const m = makeTransform(wx, wy, wz);
      out.matte.push({ geo: tireGeo, matrix: m, colorRgb: chassisIron });
      out.trim.push({ geo: wheelHubGeo, matrix: m, colorRgb: warmBronze });
      out.trim.push({ geo: wheelCapGeo, matrix: m, colorRgb: agedBrass });
    }

    const elytraGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.02, -0.34],
          [0.24, -0.26],
          [0.32, 0.02],
          [0.24, 0.26],
          [0.04, 0.30],
        ],
        0.072,
        0.024,
        0.024,
        2,
        6,
      ),
    );
    elytraGeo.rotateX(Math.PI * 0.5);

    const elytraTrimGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.05, 0.03, 0.28],
          [0.24, 0.01, 0.22],
          [0.32, -0.02, 0.0],
          [0.22, -0.04, -0.28],
        ],
        0.014,
        0.018,
        12,
        8,
      ),
    );

    for (const side of [-1, 1] as const) {
      const shellMat = makeTransform(
        side * 0.06,
        0.54,
        -0.02,
        -0.14,
        side * 0.14,
        -side * 0.34,
        side,
        1,
        1,
      );
      out.armor.push({ geo: elytraGeo, matrix: shellMat, colorRgb: starIndigo });
      out.trim.push({ geo: elytraTrimGeo, matrix: shellMat, colorRgb: warmBronze });
    }

    const pronotumGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.005, 0.16],
          [0.16, 0.14],
          [0.25, 0.06],
          [0.27, -0.04],
          [0.20, -0.10],
        ],
        16,
      ),
    );
    out.armor.push({
      geo: pronotumGeo,
      matrix: makeTransform(0, 0.50, 0.28, 0.22, 0, 0, 1.05, 0.78, 0.94),
      colorRgb: deepIndigo,
    });

    const collarRingGeo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.022, 8, 22));
    collarRingGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: collarRingGeo,
      matrix: makeTransform(0, 0.50, 0.26, 0.20, 0, 0),
      colorRgb: warmBronze,
    });

    const mainGearGeo = trackGeo(out, createToothedGearPart(0.115, 0.148, 8, 0.036));
    const smallGearGeo = trackGeo(out, createToothedGearPart(0.064, 0.088, 6, 0.032));
    const gearHubGeo = trackGeo(out, new THREE.CylinderGeometry(0.052, 0.056, 0.052, 10));
    gearHubGeo.rotateZ(Math.PI * 0.5);

    for (const side of [-1, 1] as const) {
      const mainMat = makeTransform(side * 0.34, 0.50, 0.02, 0, 0, -side * 0.10);
      out.trim.push({ geo: mainGearGeo, matrix: mainMat, colorRgb: warmBronze });
      out.matte.push({ geo: gearHubGeo, matrix: mainMat, colorRgb: chassisIron });
      out.trim.push({
        geo: smallGearGeo,
        matrix: makeTransform(side * 0.36, 0.42, -0.15, 0.3, 0, -side * 0.08),
        colorRgb: agedBrass,
      });
    }

    const tubeGlassGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.038, 0.0],
          [0.058, 0.08],
          [0.066, 0.30],
          [0.060, 0.52],
          [0.038, 0.62],
          [0.008, 0.66],
        ],
        14,
      ),
    );
    const tubeSocketGeo = trackGeo(out, new THREE.CylinderGeometry(0.056, 0.066, 0.08, 12));
    const tubeCapGeo = trackGeo(out, new THREE.CylinderGeometry(0.026, 0.048, 0.06, 12));
    const tubeCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.017, 0.019, 0.52, 8));

    const arcPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 10; k += 1) {
      const t = k / 10;
      const a = t * Math.PI * 3.0;
      const r = 0.028 * (0.7 + 0.3 * Math.sin(t * Math.PI));
      arcPts.push([Math.cos(a) * r, 0.07 + t * 0.48, Math.sin(a) * r]);
    }
    const tubeHelixGeo = trackGeo(out, createTaperedTubePart(arcPts, 0.008, 0.005, 14, 6));

    const tubeMounts: readonly (readonly [number, number, number, number, number, number])[] = [
      [-0.14, 0.62, 0.02, -0.30, 0, 0.20],
      [0.14, 0.62, 0.02, -0.30, 0, -0.20],
      [-0.18, 0.60, -0.22, -0.46, 0, 0.28],
      [0.18, 0.60, -0.22, -0.46, 0, -0.28],
    ];

    for (let i = 0; i < tubeMounts.length; i += 1) {
      const [tx, ty, tz, rx, ry, rz] = tubeMounts[i]!;
      const tm = makeTransform(tx, ty, tz, rx, ry, rz);
      out.trim.push({ geo: tubeSocketGeo, matrix: tm, colorRgb: warmBronze });
      out.crystal.push({ geo: tubeGlassGeo, matrix: tm, colorRgb: vacuumTint });
      out.trim.push({
        geo: tubeCapGeo,
        matrix: tm.clone().multiply(makeTransform(0, 0.62, 0)),
        colorRgb: agedBrass,
      });
      out.energy.push(
        {
          geo: tubeCoreGeo,
          matrix: tm.clone().multiply(makeTransform(0, 0.32, 0)),
          colorRgb: i < 2 ? plasmaCyan : warmFilament,
        },
        {
          geo: tubeHelixGeo,
          matrix: tm,
          colorRgb: plasmaCyan,
        },
      );
    }

    const manifoldPipeGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [-0.16, 0.62, 0.02],
          [0.0, 0.70, -0.06],
          [0.16, 0.62, 0.02],
        ],
        0.022,
        0.026,
        0.022,
        12,
        8,
      ),
    );
    out.trim.push({ geo: manifoldPipeGeo, matrix: makeTransform(0, 0, 0), colorRgb: warmBronze });

    const barrelGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.064, 0.0],
          [0.072, 0.08],
          [0.056, 0.24],
          [0.048, 0.42],
          [0.066, 0.48],
          [0.036, 0.52],
        ],
        14,
      ),
    );
    barrelGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: barrelGeo,
      matrix: makeTransform(0, 0.52, 0.34, -0.08, 0, 0),
      colorRgb: warmBronze,
    });

    const coilGeo = trackGeo(out, new THREE.TorusGeometry(0.074, 0.015, 8, 16));
    for (let k = 0; k < 3; k += 1) {
      out.trim.push({
        geo: coilGeo,
        matrix: makeTransform(0, 0.53 + k * 0.008, 0.46 + k * 0.11, -0.08, 0, 0),
        colorRgb: agedBrass,
      });
    }

    const muzzleOrbGeo = trackGeo(out, new THREE.SphereGeometry(0.048, 12, 10));
    out.energy.push({
      geo: muzzleOrbGeo,
      matrix: makeTransform(0, 0.56, 0.84),
      colorRgb: plasmaCyan,
    });

    const mandibleGeo = trackGeo(out, createCurvedBladePart(0.36, 0.075, 0.036, 0.10, 0.03, 8));
    for (const side of [-1, 1] as const) {
      out.trim.push({
        geo: mandibleGeo,
        matrix: makeTransform(side * 0.18, 0.42, 0.40, Math.PI * 0.46, -side * 0.22, side * 0.18, side, 1, 1),
        colorRgb: agedBrass,
      });
    }

    const eyeLensGeo = trackGeo(out, new THREE.SphereGeometry(0.036, 10, 8));
    for (const side of [-1, 1] as const) {
      out.energy.push({
        geo: eyeLensGeo,
        matrix: makeTransform(side * 0.11, 0.57, 0.44),
        colorRgb: warmFilament,
      });
    }

    const wingArcGeo = trackGeo(out, createCurvedBladePart(0.54, 0.11, 0.028, 0.16, 0.05, 10));
    for (const side of [-1, 1] as const) {
      out.wingParts.push({
        geo: wingArcGeo,
        matrix: makeTransform(side * 0.34, 0.74, -0.18, -0.24, side * 0.32, -side * 0.58, side, 1, 1),
        colorRgb: agedBrass,
      });
    }

    out.headTopLocalY = 1.46;
    out.weaponGlowHex = 0x52c8e0;
    out.crystalHex = 0x72d8ea;
    out.crystalOpacity = 0.46;
    out.crystalIntensity = 0.38;
  },

  S16: (_ctx, out) => {
    const deepNavy: RgbTriple = [0.19, 0.30, 0.48];
    const slateNavy: RgbTriple = [0.27, 0.40, 0.60];
    const titaniumSilver: RgbTriple = [0.74, 0.79, 0.85];
    const darkGraphite: RgbTriple = [0.18, 0.21, 0.27];
    const opticalGold: RgbTriple = [0.86, 0.71, 0.38];
    const warmGoldEdge: RgbTriple = [0.70, 0.54, 0.26];
    const starAzure: RgbTriple = [0.46, 0.80, 0.96];
    const lensGlass: RgbTriple = [0.68, 0.88, 0.98];

    const hubCoreGeo = trackGeo(out, createChamferedHexPart(0.24, 0.20, 0.018));
    hubCoreGeo.rotateX(Math.PI * 0.5);
    out.armor.push({
      geo: hubCoreGeo,
      matrix: makeTransform(0, 0.64, -0.02),
      colorRgb: deepNavy,
    });

    const hubCollarGeo = trackGeo(out, new THREE.CylinderGeometry(0.18, 0.21, 0.12, 14));
    out.trim.push({
      geo: hubCollarGeo,
      matrix: makeTransform(0, 0.77, -0.02),
      colorRgb: titaniumSilver,
    });

    const underReactorGeo = trackGeo(out, new THREE.OctahedronGeometry(0.11, 1));
    out.energy.push({
      geo: underReactorGeo,
      matrix: makeTransform(0, 0.48, -0.02, 0, 0, 0, 1.0, 0.78, 1.0),
      colorRgb: starAzure,
    });

    const footPadGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.085, -0.06],
          [0.085, -0.06],
          [0.11, 0.05],
          [0.0, 0.14],
          [-0.11, 0.05],
        ],
        0.048,
        0.010,
        0.010,
        1,
        4,
      ),
    );
    footPadGeo.rotateX(Math.PI * 0.5);
    const kneeDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.058, 0.058, 0.09, 12));
    kneeDrumGeo.rotateZ(Math.PI * 0.5);
    const hipBallGeo = trackGeo(out, new THREE.SphereGeometry(0.066, 10, 8));
    const pistonGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 1.0, 8));

    const legAngles = [Math.PI * 0.22, -Math.PI * 0.22, Math.PI];
    for (const ang of legAngles) {
      const sx = Math.sin(ang);
      const cz = Math.cos(ang);
      const hip = new THREE.Vector3(sx * 0.20, 0.62, cz * 0.20 - 0.02);
      const knee = new THREE.Vector3(sx * 0.46, 0.52, cz * 0.46 - 0.02);
      const foot = new THREE.Vector3(sx * 0.52, 0.09, cz * 0.52 - 0.02);

      out.matte.push({
        geo: hipBallGeo,
        matrix: makeTransform(hip.x, hip.y, hip.z),
        colorRgb: darkGraphite,
      });

      const femurGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [hip.x, hip.y, hip.z],
            [(hip.x + knee.x) * 0.5, (hip.y + knee.y) * 0.5 + 0.05, (hip.z + knee.z) * 0.5],
            [knee.x, knee.y, knee.z],
          ],
          0.052,
          0.060,
          0.044,
          10,
          8,
        ),
      );
      out.armor.push({ geo: femurGeo, matrix: makeTransform(0, 0, 0), colorRgb: deepNavy });

      out.trim.push({
        geo: kneeDrumGeo,
        matrix: makeTransform(knee.x, knee.y, knee.z, 0, ang, 0),
        colorRgb: titaniumSilver,
      });

      const tibiaGeo = trackGeo(
        out,
        createOrganicLimb(
          [
            [knee.x, knee.y, knee.z],
            [knee.x * 0.98, 0.30, knee.z * 0.98],
            [foot.x, foot.y, foot.z],
          ],
          0.044,
          0.036,
          0.026,
          10,
          8,
        ),
      );
      out.matte.push({ geo: tibiaGeo, matrix: makeTransform(0, 0, 0), colorRgb: darkGraphite });

      const pistonTop = new THREE.Vector3(sx * 0.30, 0.56, cz * 0.30 - 0.02);
      const pistonBot = new THREE.Vector3(sx * 0.48, 0.26, cz * 0.48 - 0.02);
      out.trim.push({
        geo: pistonGeo,
        matrix: makeSegmentTransform(pistonTop, pistonBot, 1, 1),
        colorRgb: titaniumSilver,
      });

      out.armor.push({
        geo: footPadGeo,
        matrix: makeTransform(foot.x, 0.08, foot.z, 0, ang, 0),
        colorRgb: slateNavy,
      });
    }

    const yokeArmGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0.0, 0.78, -0.02],
          [0.24, 0.86, -0.04],
          [0.32, 1.04, -0.06],
        ],
        0.042,
        0.048,
        0.036,
        10,
        8,
      ),
    );
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: yokeArmGeo,
        matrix: makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1),
        colorRgb: deepNavy,
      });
    }

    const dishPivot = makeTransform(0, 1.04, -0.02, 0.78, 0, 0);

    const dishOuterProfile: readonly (readonly [number, number])[] = [
      [0.008, -0.04],
      [0.14, -0.02],
      [0.30, 0.04],
      [0.45, 0.13],
      [0.56, 0.24],
      [0.58, 0.27],
    ];
    const dishBackShellGeo = trackGeo(
      out,
      createSculptedClothLathe(dishOuterProfile, 24, 0, 0, 0.5, deepNavy, slateNavy),
    );
    out.armor.push({ geo: dishBackShellGeo, matrix: dishPivot });

    const dishRimGeo = trackGeo(out, new THREE.TorusGeometry(0.575, 0.026, 8, 26));
    dishRimGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: dishRimGeo,
      matrix: dishPivot.clone().multiply(makeTransform(0, 0.268, 0)),
      colorRgb: titaniumSilver,
    });

    const outerVernierGeo = trackGeo(out, new THREE.TorusGeometry(0.615, 0.011, 6, 26));
    outerVernierGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: outerVernierGeo,
      matrix: dishPivot.clone().multiply(makeTransform(0, 0.268, 0)),
      colorRgb: opticalGold,
    });

    const hexTileGeo = trackGeo(
      out,
      createHexMirrorTilePart(0.118, 0.022, 0.010, 0.008, opticalGold, warmGoldEdge),
    );
    hexTileGeo.rotateX(-Math.PI * 0.5);
    out.trim.push({
      geo: hexTileGeo,
      matrix: dishPivot.clone().multiply(makeTransform(0, 0.012, 0)),
    });

    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      const r = 0.215;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      const tileMat = dishPivot
        .clone()
        .multiply(makeTransform(px, 0.056, pz, 0, -a, 0))
        .multiply(makeTransform(0, 0, 0, 0, 0, 0.24));
      out.trim.push({ geo: hexTileGeo, matrix: tileMat });
    }

    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2 + Math.PI / 12;
      const r = 0.425;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      const tileMat = dishPivot
        .clone()
        .multiply(makeTransform(px, 0.165, pz, 0, -a, 0))
        .multiply(makeTransform(0, 0, 0, 0, 0, 0.48, 0.94, 1, 0.94));
      out.trim.push({ geo: hexTileGeo, matrix: tileMat });
    }

    const backRibGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0.06, -0.05, 0],
          [0.32, 0.02, 0],
          [0.56, 0.24, 0],
        ],
        0.022,
        0.018,
        0.014,
        10,
        8,
      ),
    );
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      out.matte.push({
        geo: backRibGeo,
        matrix: dishPivot.clone().multiply(makeTransform(0, 0, 0, 0, a, 0)),
        colorRgb: darkGraphite,
      });
    }

    const feedApexY = 0.72;
    const feedStrutGeo = trackGeo(
      out,
      createOrganicLimb(
        [
          [0.54, 0.26, 0],
          [0.24, 0.54, 0],
          [0.055, feedApexY, 0],
        ],
        0.020,
        0.015,
        0.011,
        10,
        8,
      ),
    );
    const beamLineGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.44, 0.20, 0],
          [0.18, 0.46, 0],
          [0.02, feedApexY - 0.04, 0],
        ],
        0.006,
        0.004,
        10,
        6,
      ),
    );

    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const rot = dishPivot.clone().multiply(makeTransform(0, 0, 0, 0, a, 0));
      out.trim.push({ geo: feedStrutGeo, matrix: rot, colorRgb: titaniumSilver });
      out.energy.push({ geo: beamLineGeo, matrix: rot, colorRgb: starAzure });
    }

    const feedHornGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.012, -0.10],
          [0.082, -0.02],
          [0.064, 0.06],
          [0.074, 0.14],
          [0.036, 0.19],
          [0.008, 0.22],
        ],
        14,
      ),
    );
    const feedMat = dishPivot.clone().multiply(makeTransform(0, feedApexY, 0));
    out.armor.push({ geo: feedHornGeo, matrix: feedMat, colorRgb: deepNavy });

    const feedRingGeo = trackGeo(out, new THREE.TorusGeometry(0.115, 0.014, 8, 18));
    feedRingGeo.rotateX(Math.PI * 0.5);
    out.trim.push({
      geo: feedRingGeo,
      matrix: feedMat.clone().multiply(makeTransform(0, 0.04, 0)),
      colorRgb: opticalGold,
    });

    const lensRingGeo = trackGeo(out, new THREE.TorusGeometry(0.16, 0.012, 8, 20));
    lensRingGeo.rotateX(Math.PI * 0.5);
    out.crystal.push({
      geo: lensRingGeo,
      matrix: feedMat.clone().multiply(makeTransform(0, -0.05, 0)),
      colorRgb: lensGlass,
    });

    const focalCoreGeo = trackGeo(out, new THREE.SphereGeometry(0.062, 12, 10));
    out.energy.push({
      geo: focalCoreGeo,
      matrix: feedMat.clone().multiply(makeTransform(0, -0.07, 0)),
      colorRgb: starAzure,
    });

    const wingFinGeo = trackGeo(out, createCurvedBladePart(0.56, 0.10, 0.024, 0.14, 0.04, 10));
    for (const side of [-1, 1] as const) {
      out.wingParts.push({
        geo: wingFinGeo,
        matrix: makeTransform(side * 0.48, 1.12, -0.22, -0.22, side * 0.28, -side * 0.44, side, 1, 1),
        colorRgb: opticalGold,
      });
    }

    out.headTopLocalY = 1.84;
    out.weaponGlowHex = 0x62b6f0;
    out.crystalHex = 0x8ad0ff;
    out.crystalOpacity = 0.54;
    out.crystalIntensity = 0.44;
  },

  S33: (_ctx, out) => {
    const ceramicWhite: RgbTriple = [0.92, 0.95, 0.99];
    const porcelainCool: RgbTriple = [0.76, 0.84, 0.93];
    const platinumTrim: RgbTriple = [0.82, 0.87, 0.94];
    const paleGoldTrim: RgbTriple = [0.88, 0.80, 0.58];
    const eventHorizon: RgbTriple = [0.04, 0.05, 0.09];
    const dataCyan: RgbTriple = [0.36, 0.84, 0.98];
    const gammaWhite: RgbTriple = [0.88, 0.96, 1.00];
    const ergoGlass: RgbTriple = [0.58, 0.88, 1.00];

    const plinthGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.010, -0.14],
          [0.072, -0.06],
          [0.145, 0.04],
          [0.215, 0.12],
          [0.165, 0.16],
          [0.088, 0.10],
        ],
        16,
      ),
    );
    out.armor.push({
      geo: plinthGeo,
      matrix: makeTransform(0, 0.28, 0),
      colorRgb: ceramicWhite,
    });

    const baseHaloGeo = trackGeo(out, new THREE.TorusGeometry(0.27, 0.015, 6, 22));
    baseHaloGeo.rotateX(Math.PI * 0.5);
    out.energy.push({
      geo: baseHaloGeo,
      matrix: makeTransform(0, 0.20, 0),
      colorRgb: dataCyan,
    });

    const plinthFinGeo = trackGeo(out, createPetalPart(0.26, 0.11, 0.022, 0.030, 1.4, 8, 6));
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      out.armor.push({
        geo: plinthFinGeo,
        matrix: makeTransform(Math.cos(a) * 0.19, 0.34, Math.sin(a) * 0.19, 0.42, -a + Math.PI * 0.5, 0),
        colorRgb: porcelainCool,
      });
    }

    const coreCenterY = 1.08;
    const axisTilt = makeTransform(0, coreCenterY, 0, 0.24, 0.18, -0.26);

    const blackHoleGeo = trackGeo(out, new THREE.SphereGeometry(0.17, 18, 14));
    out.matte.push({
      geo: blackHoleGeo,
      matrix: axisTilt,
      colorRgb: eventHorizon,
    });

    const ergoShellGeo = trackGeo(out, new THREE.SphereGeometry(0.235, 16, 12));
    out.crystal.push({
      geo: ergoShellGeo,
      matrix: axisTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.24, 0.84, 1.24)),
      colorRgb: ergoGlass,
    });

    const photonRingGeo = trackGeo(out, new THREE.TorusGeometry(0.23, 0.015, 6, 24));
    photonRingGeo.rotateX(Math.PI * 0.5);
    out.energy.push({
      geo: photonRingGeo,
      matrix: axisTilt,
      colorRgb: gammaWhite,
    });

    const diskProfile: readonly (readonly [number, number])[] = [
      [0.23, 0.0],
      [0.33, 0.008],
      [0.46, 0.016],
      [0.55, 0.006],
      [0.46, -0.011],
      [0.31, -0.006],
    ];
    const accretionDiskGeo = trackGeo(out, createLathePart(diskProfile, 24));
    out.crystal.push({
      geo: accretionDiskGeo,
      matrix: axisTilt,
      colorRgb: dataCyan,
    });

    for (let s = 0; s < 3; s += 1) {
      const phase = (s / 3) * Math.PI * 2;
      const spiralPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const a = phase + t * Math.PI * 1.55;
        const r = 0.54 - t * 0.27;
        const y = Math.sin(t * Math.PI * 2 + phase) * 0.024;
        spiralPts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      const spiralGeo = trackGeo(out, createTaperedTubePart(spiralPts, 0.012, 0.004, 12, 6));
      out.energy.push({
        geo: spiralGeo,
        matrix: axisTilt,
        colorRgb: s === 0 ? gammaWhite : dataCyan,
      });
    }

    const ringSpecs: readonly (readonly [number, number, number, number, number])[] = [
      [0.62, 0.024, 0.24, 0.14, 0.10],
      [0.49, 0.020, -0.58, 0.42, 0.28],
      [0.38, 0.017, 0.84, -0.54, -0.32],
    ];

    for (let idx = 0; idx < ringSpecs.length; idx += 1) {
      const [radius, tubeR, rx, ry, rz] = ringSpecs[idx]!;
      const rm = makeTransform(0, coreCenterY, 0, rx, ry, rz);
      const ceramicBandGeo = trackGeo(out, new THREE.TorusGeometry(radius, tubeR, 8, 28));
      out.armor.push({
        geo: ceramicBandGeo,
        matrix: rm,
        colorRgb: idx === 0 ? ceramicWhite : porcelainCool,
      });

      const trimBandGeo = trackGeo(out, new THREE.TorusGeometry(radius + tubeR * 0.72, tubeR * 0.34, 6, 26));
      out.trim.push({
        geo: trimBandGeo,
        matrix: rm,
        colorRgb: idx === 1 ? paleGoldTrim : platinumTrim,
      });

      const veinBandGeo = trackGeo(out, new THREE.TorusGeometry(radius - tubeR * 0.64, tubeR * 0.24, 6, 24));
      out.energy.push({
        geo: veinBandGeo,
        matrix: rm,
        colorRgb: dataCyan,
      });
    }

    const outerRingMat = makeTransform(0, coreCenterY, 0, 0.24, 0.14, 0.10);
    const tickGeo = trackGeo(out, createFacetedCrystalPart(0.084, 0.016, 4, 0.65, 0.35));
    const pointerGeo = trackGeo(out, createFacetedCrystalPart(0.15, 0.028, 4, 0.72, 0.28));
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2;
      const isCardinal = i % 3 === 0;
      const rad = isCardinal ? 0.69 : 0.66;
      const tm = outerRingMat
        .clone()
        .multiply(makeTransform(Math.cos(a) * rad, Math.sin(a) * rad, 0, 0, 0, a - Math.PI * 0.5));
      if (isCardinal) {
        out.armor.push({ geo: pointerGeo, matrix: tm, colorRgb: ceramicWhite });
        out.energy.push({
          geo: tickGeo,
          matrix: tm.clone().multiply(makeTransform(0, 0.065, 0, 0, 0, 0, 0.85, 0.85, 0.85)),
          colorRgb: dataCyan,
        });
      } else {
        out.trim.push({ geo: tickGeo, matrix: tm, colorRgb: paleGoldTrim });
      }
    }

    const crownTilt = makeTransform(0, coreCenterY + 0.08, -0.14, -0.30, 0, -0.20);
    const crownBandGeo = trackGeo(
      out,
      new THREE.TorusGeometry(0.44, 0.022, 8, 24, Math.PI * 1.15),
    );
    out.armor.push({
      geo: crownBandGeo,
      matrix: crownTilt.clone().multiply(makeTransform(0, 0.05, 0, 0, 0, -Math.PI * 0.075)),
      colorRgb: ceramicWhite,
    });
    const crownTrimArcGeo = trackGeo(
      out,
      new THREE.TorusGeometry(0.475, 0.011, 6, 24, Math.PI * 1.15),
    );
    out.trim.push({
      geo: crownTrimArcGeo,
      matrix: crownTilt.clone().multiply(makeTransform(0, 0.05, 0, 0, 0, -Math.PI * 0.075)),
      colorRgb: paleGoldTrim,
    });

    const spireSpecs: readonly (readonly [number, number, number])[] = [
      [-1.08, 0.28, 0.062],
      [-0.74, 0.38, 0.074],
      [-0.38, 0.48, 0.084],
      [0.0, 0.58, 0.098],
      [0.38, 0.48, 0.084],
      [0.74, 0.38, 0.074],
      [1.08, 0.28, 0.062],
    ];
    for (const [ang, len, wid] of spireSpecs) {
      const spireGeo = trackGeo(out, createCurvedBladePart(len, wid, 0.026, 0.02, 0.028, 8));
      const sm = crownTilt
        .clone()
        .multiply(makeTransform(Math.sin(ang) * 0.42, Math.cos(ang) * 0.42 + 0.04, 0, 0, 0, -ang));
      out.armor.push({ geo: spireGeo, matrix: sm, colorRgb: ceramicWhite });
      out.trim.push({
        geo: spireGeo,
        matrix: sm.clone().multiply(makeTransform(0, 0.02, 0.012, 0, 0, 0, 0.52, 0.90, 0.65)),
        colorRgb: platinumTrim,
      });
    }

    const jetBeamGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.022, 0.20],
          [0.054, 0.34],
          [0.038, 0.64],
          [0.018, 0.86],
          [0.004, 0.96],
        ],
        10,
      ),
    );
    const jetCollimatorA = trackGeo(out, new THREE.TorusGeometry(0.135, 0.015, 6, 18));
    jetCollimatorA.rotateX(Math.PI * 0.5);
    const jetCollimatorB = trackGeo(out, new THREE.TorusGeometry(0.090, 0.011, 6, 16));
    jetCollimatorB.rotateX(Math.PI * 0.5);

    for (const dir of [1, -1] as const) {
      const jm = axisTilt.clone().multiply(makeTransform(0, 0, 0, dir === 1 ? 0 : Math.PI, 0, 0));
      out.energy.push({ geo: jetBeamGeo, matrix: jm, colorRgb: gammaWhite });
      out.armor.push({
        geo: jetCollimatorA,
        matrix: jm.clone().multiply(makeTransform(0, 0.42, 0)),
        colorRgb: ceramicWhite,
      });
      out.trim.push({
        geo: jetCollimatorB,
        matrix: jm.clone().multiply(makeTransform(0, 0.64, 0)),
        colorRgb: paleGoldTrim,
      });

      const helixPts: Vec3Tuple[] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const a = t * Math.PI * 2.8;
        const r = 0.098 * (1 - t * 0.58);
        helixPts.push([Math.cos(a) * r, 0.24 + t * 0.64, Math.sin(a) * r]);
      }
      const helixGeo = trackGeo(out, createTaperedTubePart(helixPts, 0.009, 0.003, 10, 5));
      out.energy.push({ geo: helixGeo, matrix: jm, colorRgb: dataCyan });
    }

    const star3ArcGeo = trackGeo(out, createCurvedBladePart(0.62, 0.11, 0.024, 0.18, 0.06, 10));
    const star3Specs: GeometryPartSpec[] = [
      {
        geo: star3ArcGeo,
        matrix: makeTransform(-0.58, 1.18, -0.22, -0.18, 0.34, 0.48, -1, 1, 1),
        colorRgb: paleGoldTrim,
      },
      {
        geo: star3ArcGeo,
        matrix: makeTransform(0.58, 1.18, -0.22, -0.18, -0.34, -0.48, 1, 1, 1),
        colorRgb: paleGoldTrim,
      },
    ];
    out.wingParts.push(...star3Specs);

    out.headTopLocalY = 2.24;
    out.weaponGlowHex = 0x6ce0ff;
    out.crystalHex = 0x9cecff;
    out.crystalOpacity = 0.50;
    out.crystalIntensity = 0.48;
  },
};
