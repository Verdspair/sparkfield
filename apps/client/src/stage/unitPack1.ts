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
  createPetalPart,
  createSculptedClothLathe,
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
type AeroSuitStance = 'zero_g_guard' | 'weld_aim' | 'cradle_box';
type AeroHelmetKind = 'eva_gold' | 'engineer_weld' | 'star_bubble';

interface AeroSuitOptions {
  readonly stance: AeroSuitStance;
  readonly helmet: AeroHelmetKind;
  readonly armorPrimary: RgbTriple;
  readonly armorSecondary: RgbTriple;
  readonly matteFabric: RgbTriple;
  readonly trimMetal: RgbTriple;
  readonly glowColor: RgbTriple;
  readonly visorCrystalColor: RgbTriple;
  readonly hoverY: number;
  readonly slimScale?: number;
}

interface AeroSuitAnchors {
  readonly leftHand: THREE.Vector3;
  readonly rightHand: THREE.Vector3;
  readonly leftForearm: THREE.Vector3;
  readonly rightForearm: THREE.Vector3;
  readonly leftShoulder: THREE.Vector3;
  readonly rightShoulder: THREE.Vector3;
  readonly leftHip: THREE.Vector3;
  readonly rightHip: THREE.Vector3;
  readonly chestCenter: THREE.Vector3;
  readonly backMount: THREE.Vector3;
  readonly headCenter: THREE.Vector3;
  readonly headTopY: number;
}

function makeAlignTransform(
  pos: THREE.Vector3,
  dir: THREE.Vector3,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Matrix4 {
  const unitDir = dir.clone().normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unitDir);
  return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(sx, sy, sz));
}

function buildSleekAeroSuit(
  out: UnitBlueprintParts,
  opts: AeroSuitOptions,
): AeroSuitAnchors {
  const s = opts.slimScale ?? 1.0;
  const hy = opts.hoverY;
  const isGuard = opts.stance === 'zero_g_guard';
  const isWeld = opts.stance === 'weld_aim';
  const leanX = isGuard ? 0.06 : isWeld ? 0.07 : 0.03;
  const torsoYaw = isGuard ? -0.15 : isWeld ? -0.12 : 0.08;
  const headYaw = isGuard ? 0.17 : isWeld ? 0.14 : -0.07;
  const headPitch = isGuard ? 0.03 : isWeld ? 0.06 : 0.09;
  const hipShiftX = isGuard ? 0.018 : isWeld ? -0.014 : 0.012;

  const pelvisY = 0.68 + hy;
  const waistY = 0.82 + hy;
  const chestY = 1.04 + hy;
  const collarY = 1.20 + hy;
  const headY = 1.36 + hy;

  const rotTorso = (x: number, y: number, z: number): THREE.Vector3 => {
    const c = Math.cos(torsoYaw);
    const sn = Math.sin(torsoYaw);
    return new THREE.Vector3(hipShiftX + x * c + z * sn, y, -x * sn + z * c);
  };

  const undersuitCoreGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.012, 0.0],
        [0.092 * s, 0.05],
        [0.084 * s, 0.15],
        [0.080 * s, 0.26],
        [0.104 * s, 0.39],
        [0.108 * s, 0.48],
        [0.074 * s, 0.56],
        [0.056 * s, 0.62],
      ],
      10,
    ),
  );
  out.matte.push({
    geo: undersuitCoreGeo,
    matrix: makeTransform(hipShiftX, pelvisY - 0.05, 0, leanX, torsoYaw, 0, 1.0, 1.0, 0.68),
    colorRgb: opts.matteFabric,
  });

  const bellowsWaistGeo = trackGeo(out, new THREE.TorusGeometry(0.086 * s, 0.0085, 4, 10));
  bellowsWaistGeo.rotateX(Math.PI * 0.5);
  for (let b = 0; b < 3; b += 1) {
    out.matte.push({
      geo: bellowsWaistGeo,
      matrix: makeTransform(
        hipShiftX,
        waistY - 0.024 + b * 0.026,
        0.004,
        leanX,
        torsoYaw,
        0,
        1.04 + b * 0.03,
        1.0,
        0.74,
      ),
      colorRgb: opts.matteFabric,
    });
  }

  const cuirassGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.096 * s, 0.0],
        [0.118 * s, 0.07],
        [0.156 * s, 0.18],
        [0.178 * s, 0.27],
        [0.160 * s, 0.33],
        [0.114 * s, 0.37],
        [0.088 * s, 0.40],
      ],
      12,
    ),
  );
  out.armor.push({
    geo: cuirassGeo,
    matrix: makeTransform(hipShiftX, waistY + 0.025, 0.006, leanX, torsoYaw, 0, 1.05, 1.0, 0.66),
    colorRgb: opts.armorPrimary,
  });

  const yokeGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.164 * s, 0.0],
        [0.150 * s, 0.04],
        [0.116 * s, 0.075],
        [0.092 * s, 0.095],
      ],
      12,
    ),
  );
  out.armor.push({
    geo: yokeGeo,
    matrix: makeTransform(hipShiftX, collarY - 0.072, 0.006, leanX + 0.06, torsoYaw, 0, 1.08, 1.0, 0.76),
    colorRgb: opts.armorSecondary,
  });

  const sternumBase = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.066 * s, -0.092],
        [0.066 * s, -0.092],
        [0.096 * s, 0.032],
        [0.062 * s, 0.104],
        [-0.062 * s, 0.104],
        [-0.096 * s, 0.032],
      ],
      0.030,
      0.008,
      0.008,
      1,
      2,
    ),
  );
  const chestBoxCenter = rotTorso(0, chestY + 0.012, 0.112 * s);
  const chestBoxMat = makeTransform(chestBoxCenter.x, chestBoxCenter.y, chestBoxCenter.z, leanX - 0.08, torsoYaw, 0);
  out.armor.push({
    geo: sternumBase,
    matrix: chestBoxMat,
    colorRgb: opts.armorSecondary,
  });

  const chestPanelRecess = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.048 * s, -0.044],
        [0.048 * s, -0.044],
        [0.056 * s, 0.042],
        [-0.056 * s, 0.042],
      ],
      0.012,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  out.matte.push({
    geo: chestPanelRecess,
    matrix: chestBoxMat.clone().multiply(makeTransform(0, 0.008, 0.022)),
    colorRgb: opts.matteFabric,
  });

  const chestGauge = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.016, 0.010, 8));
  chestGauge.rotateX(Math.PI * 0.5);
  const chestStatusBar = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.036 * s, -0.007],
        [0.036 * s, -0.007],
        [0.036 * s, 0.007],
        [-0.036 * s, 0.007],
      ],
      0.008,
      0.002,
      0.002,
      1,
      1,
    ),
  );
  const chestVentRib = trackGeo(out, new THREE.CylinderGeometry(0.0032, 0.0032, 0.038 * s, 4));
  chestVentRib.rotateZ(Math.PI * 0.5);
  out.energy.push({
    geo: chestStatusBar,
    matrix: chestBoxMat.clone().multiply(makeTransform(0, 0.026, 0.028)),
    colorRgb: opts.glowColor,
  });
  out.trim.push({
    geo: chestGauge,
    matrix: chestBoxMat.clone().multiply(makeTransform(0.024 * s, -0.012, 0.030)),
    colorRgb: opts.trimMetal,
  });
  for (let vr = 0; vr < 3; vr += 1) {
    out.armor.push({
      geo: chestVentRib,
      matrix: chestBoxMat.clone().multiply(makeTransform(-0.018 * s, -0.004 - vr * 0.011, 0.032)),
      colorRgb: opts.armorPrimary,
    });
  }

  const claspBuckleGeo = trackGeo(out, createChamferedHexSmall(0.016, 0.010));
  for (const side of [-1, 1] as const) {
    const pTop = rotTorso(side * 0.095 * s, collarY - 0.015, 0.055 * s);
    const pMid = rotTorso(side * 0.105 * s, chestY + 0.02, 0.118 * s);
    const pBot = rotTorso(side * 0.088 * s, waistY + 0.01, 0.092 * s);
    const harnessStrap = trackGeo(
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
        5,
      ),
    );
    out.matte.push({ geo: harnessStrap, colorRgb: opts.matteFabric });
    out.trim.push({
      geo: claspBuckleGeo,
      matrix: makeTransform(pMid.x, pMid.y - 0.02, pMid.z + 0.006, leanX, torsoYaw, 0),
      colorRgb: opts.trimMetal,
    });
  }

  const pelvisShell = trackGeo(
    out,
    createLathePart(
      [
        [0.052 * s, -0.095],
        [0.124 * s, -0.038],
        [0.136 * s, 0.038],
        [0.116 * s, 0.102],
        [0.096 * s, 0.132],
      ],
      10,
    ),
  );
  out.armor.push({
    geo: pelvisShell,
    matrix: makeTransform(hipShiftX, pelvisY, 0, leanX * 0.4, torsoYaw * 0.45, 0, 1.04, 1.0, 0.74),
    colorRgb: opts.armorPrimary,
  });

  const beltStrap = trackGeo(out, new THREE.TorusGeometry(0.114 * s, 0.015, 4, 12));
  beltStrap.rotateX(Math.PI * 0.5);
  out.matte.push({
    geo: beltStrap,
    matrix: makeTransform(hipShiftX, waistY - 0.01, 0.004, leanX * 0.6, torsoYaw * 0.6, 0, 1.06, 1.0, 0.78),
    colorRgb: opts.matteFabric,
  });

  const waistTrim = trackGeo(out, new THREE.TorusGeometry(0.116 * s, 0.007, 3, 12));
  waistTrim.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: waistTrim,
    matrix: makeTransform(hipShiftX, waistY + 0.004, 0.004, leanX * 0.6, torsoYaw * 0.6, 0, 1.06, 1.0, 0.78),
    colorRgb: opts.trimMetal,
  });

  const beltBucklePos = rotTorso(0, waistY - 0.008, 0.098 * s);
  const beltBuckle = trackGeo(out, createHexMirrorTilePart(0.028 * s, 0.014, 0.005, 0, opts.trimMetal, opts.armorSecondary));
  out.trim.push({
    geo: beltBuckle,
    matrix: makeTransform(beltBucklePos.x, beltBucklePos.y, beltBucklePos.z, 0, torsoYaw * 0.6, 0),
  });

  const hipCanisterGeo = trackGeo(out, new THREE.CylinderGeometry(0.022 * s, 0.024 * s, 0.095, 7));
  const hipCapGeo = trackGeo(out, new THREE.TorusGeometry(0.022 * s, 0.005, 4, 8));
  hipCapGeo.rotateX(Math.PI * 0.5);
  const dRingGeo = trackGeo(out, new THREE.TorusGeometry(0.016 * s, 0.004, 4, 8));
  for (const side of [-1, 1] as const) {
    const podPos = rotTorso(side * 0.130 * s, pelvisY + 0.05, 0.012);
    out.armor.push({
      geo: hipCanisterGeo,
      matrix: makeTransform(podPos.x, podPos.y, podPos.z, 0.12, torsoYaw * 0.5, side * -0.16),
      colorRgb: opts.armorSecondary,
    });
    out.trim.push(
      {
        geo: hipCapGeo,
        matrix: makeTransform(podPos.x, podPos.y + 0.042, podPos.z, 0.12, torsoYaw * 0.5, side * -0.16),
        colorRgb: opts.trimMetal,
      },
      {
        geo: dRingGeo,
        matrix: makeTransform(podPos.x + side * 0.010, podPos.y - 0.048, podPos.z + 0.016, 0.2, torsoYaw * 0.5, 0),
        colorRgb: opts.trimMetal,
      },
    );
  }

  const collarRing = trackGeo(out, new THREE.TorusGeometry(0.102 * s, 0.014, 6, 16));
  collarRing.rotateX(Math.PI * 0.5);
  const collarPos = rotTorso(0, collarY + 0.022, 0.010);
  out.trim.push({
    geo: collarRing,
    matrix: makeTransform(collarPos.x, collarPos.y, collarPos.z, 0.10 + leanX, torsoYaw, 0),
    colorRgb: opts.trimMetal,
  });

  const collarLatchGeo = trackGeo(out, new THREE.CylinderGeometry(0.009, 0.010, 0.024, 6));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.armor.push({
      geo: collarLatchGeo,
      matrix: makeTransform(
        collarPos.x + Math.cos(a) * 0.106 * s,
        collarPos.y + 0.004,
        collarPos.z + Math.sin(a) * 0.106 * s,
        0,
        -a,
        0,
      ),
      colorRgb: opts.armorSecondary,
    });
  }

  const thighShellGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.048 * s, -0.44],
        [0.062 * s, -0.18],
        [0.072 * s, 0.16],
        [0.068 * s, 0.36],
        [0.056 * s, 0.46],
      ],
      9,
    ),
  );
  const shinShellGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.042 * s, -0.45],
        [0.050 * s, -0.16],
        [0.062 * s, 0.14],
        [0.056 * s, 0.36],
        [0.046 * s, 0.45],
      ],
      9,
    ),
  );
  const kneeBellowsGeo = trackGeo(out, new THREE.TorusGeometry(0.045 * s, 0.007, 3, 8));
  kneeBellowsGeo.rotateX(Math.PI * 0.5);
  const kneeGuardGeo = trackGeo(
    out,
    createCurvedVisorPart(0.046 * s, 0.052, 0.046 * s, 1.55, 0.92, 1.15, 8, 5),
  );
  const kneeStudGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.008, 0.092 * s, 6));
  kneeStudGeo.rotateZ(Math.PI * 0.5);
  const ankleRingGeo = trackGeo(out, new THREE.TorusGeometry(0.044 * s, 0.008, 4, 9));
  ankleRingGeo.rotateX(Math.PI * 0.5);
  const bootUpperGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.012, -0.082],
        [0.045 * s, -0.058],
        [0.050 * s, 0.004],
        [0.042 * s, 0.072],
        [0.024 * s, 0.112],
        [0.006, 0.126],
      ],
      9,
    ),
  );
  const bootToeCapGeo = trackGeo(out, new THREE.SphereGeometry(0.038 * s, 8, 6));

  const legSpecs: readonly (readonly [number, Vec3Tuple, Vec3Tuple, Vec3Tuple, number])[] =
    isGuard
      ? [
          [-1, [hipShiftX - 0.088 * s, pelvisY - 0.02, 0.015], [hipShiftX - 0.132 * s, 0.39 + hy, 0.115], [hipShiftX - 0.116 * s, 0.07 + hy, 0.045], 0.14],
          [1, [hipShiftX + 0.088 * s, pelvisY - 0.02, -0.012], [hipShiftX + 0.124 * s, 0.35 + hy, -0.015], [hipShiftX + 0.136 * s, 0.04 + hy, -0.105], -0.22],
        ]
      : isWeld
        ? [
            [-1, [hipShiftX - 0.086 * s, pelvisY - 0.02, 0.012], [hipShiftX - 0.128 * s, 0.37 + hy, 0.085], [hipShiftX - 0.138 * s, 0.05 + hy, 0.062], 0.18],
            [1, [hipShiftX + 0.086 * s, pelvisY - 0.02, -0.010], [hipShiftX + 0.116 * s, 0.35 + hy, -0.022], [hipShiftX + 0.128 * s, 0.04 + hy, -0.095], -0.20],
          ]
        : [
            [-1, [hipShiftX - 0.082 * s, pelvisY - 0.02, 0.012], [hipShiftX - 0.106 * s, 0.36 + hy, 0.068], [hipShiftX - 0.108 * s, 0.05 + hy, 0.048], 0.12],
            [1, [hipShiftX + 0.082 * s, pelvisY - 0.02, -0.010], [hipShiftX + 0.098 * s, 0.35 + hy, -0.018], [hipShiftX + 0.110 * s, 0.04 + hy, -0.068], -0.16],
          ];

  for (const [, hipP, kneeP, ankleP, footYaw] of legSpecs) {
    const hipV = new THREE.Vector3(...hipP);
    const kneeV = new THREE.Vector3(...kneeP);
    const ankleV = new THREE.Vector3(...ankleP);

    const innerLeg = trackGeo(
      out,
      createOrganicLimb([hipP, kneeP, ankleP], 0.038 * s, 0.034 * s, 0.028 * s, 8, 6),
    );
    out.matte.push({ geo: innerLeg, colorRgb: opts.matteFabric });

    const thighStart = hipV.clone().lerp(kneeV, 0.08);
    const thighEnd = hipV.clone().lerp(kneeV, 0.84);
    const shinStart = kneeV.clone().lerp(ankleV, 0.14);
    const shinEnd = kneeV.clone().lerp(ankleV, 0.92);

    out.armor.push({
      geo: thighShellGeo,
      matrix: makeSegmentTransform(thighStart, thighEnd, 1.0, 1.08),
      colorRgb: opts.armorSecondary,
    });
    out.armor.push({
      geo: shinShellGeo,
      matrix: makeSegmentTransform(shinStart, shinEnd, 0.98, 1.12),
      colorRgb: opts.armorPrimary,
    });

    for (const dy of [-0.018, 0.0, 0.018]) {
      out.matte.push({
        geo: kneeBellowsGeo,
        matrix: makeTransform(kneeV.x, kneeV.y + dy, kneeV.z + 0.004, -0.12, footYaw, 0),
        colorRgb: opts.matteFabric,
      });
    }
    out.armor.push({
      geo: kneeGuardGeo,
      matrix: makeTransform(kneeV.x, kneeV.y + 0.004, kneeV.z + 0.016 * s, -0.14, footYaw, 0),
      colorRgb: opts.armorSecondary,
    });
    out.trim.push({
      geo: kneeStudGeo,
      matrix: makeTransform(kneeV.x, kneeV.y, kneeV.z + 0.008, 0, footYaw, 0),
      colorRgb: opts.trimMetal,
    });
    out.trim.push({
      geo: ankleRingGeo,
      matrix: makeTransform(ankleV.x, ankleV.y + 0.024, ankleV.z, 0, footYaw, 0),
      colorRgb: opts.trimMetal,
    });
    const footMat = makeTransform(ankleV.x, ankleV.y - 0.010, ankleV.z + 0.032, 0, footYaw, 0);
    out.armor.push({
      geo: bootUpperGeo,
      matrix: footMat.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0, 0.96, 1.0, 0.74)),
      colorRgb: opts.armorPrimary,
    });
    out.armor.push({
      geo: bootToeCapGeo,
      matrix: footMat.clone().multiply(makeTransform(0, -0.004, 0.072, 0, 0, 0, 0.94, 0.64, 1.05)),
      colorRgb: opts.armorSecondary,
    });
    out.matte.push({
      geo: bootUpperGeo,
      matrix: footMat.clone().multiply(makeTransform(0, -0.026, -0.004, Math.PI * 0.5, 0, 0, 1.02, 1.02, 0.34)),
      colorRgb: opts.matteFabric,
    });
  }

  const leftShoulder = rotTorso(-0.196 * s, chestY + 0.116, 0.008);
  const rightShoulder = rotTorso(0.196 * s, chestY + 0.104, 0.008);

  const armTargets: {
    readonly lElbow: THREE.Vector3;
    readonly lHand: THREE.Vector3;
    readonly rElbow: THREE.Vector3;
    readonly rHand: THREE.Vector3;
  } =
    isGuard
      ? {
          lElbow: rotTorso(-0.290 * s, chestY - 0.02, 0.11),
          lHand: rotTorso(-0.255 * s, chestY + 0.01, 0.30),
          rElbow: rotTorso(0.280 * s, chestY - 0.05, 0.07),
          rHand: rotTorso(0.285 * s, chestY - 0.03, 0.29),
        }
      : isWeld
        ? {
            lElbow: rotTorso(-0.285 * s, chestY - 0.02, 0.09),
            lHand: rotTorso(-0.285 * s, chestY + 0.05, 0.25),
            rElbow: rotTorso(0.270 * s, chestY - 0.04, 0.10),
            rHand: rotTorso(0.265 * s, chestY - 0.01, 0.32),
          }
        : {
            lElbow: rotTorso(-0.248 * s, chestY - 0.07, 0.11),
            lHand: rotTorso(-0.140 * s, chestY - 0.08, 0.32),
            rElbow: rotTorso(0.248 * s, chestY - 0.07, 0.11),
            rHand: rotTorso(0.140 * s, chestY - 0.08, 0.32),
          };

  const pauldronShellGeo = trackGeo(out, createCurvedVisorPart(0.104 * s, 0.098, 0.096, 2.25, 0.40, 1.32, 8, 5));
  const shoulderRingGeo = trackGeo(out, new THREE.TorusGeometry(0.056 * s, 0.009, 4, 9));
  const bicepShellGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.038 * s, -0.40],
        [0.050 * s, -0.08],
        [0.054 * s, 0.22],
        [0.046 * s, 0.42],
      ],
      8,
    ),
  );
  const forearmBracerGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.034 * s, -0.44],
        [0.046 * s, -0.14],
        [0.050 * s, 0.20],
        [0.042 * s, 0.44],
      ],
      8,
    ),
  );
  const elbowBellowsGeo = trackGeo(out, new THREE.TorusGeometry(0.036 * s, 0.0065, 3, 8));
  elbowBellowsGeo.rotateX(Math.PI * 0.5);
  const wristRingGeo = trackGeo(out, new THREE.TorusGeometry(0.038 * s, 0.007, 4, 9));
  wristRingGeo.rotateX(Math.PI * 0.5);
  const gloveGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.022 * s, -0.022],
        [0.034 * s, 0.0],
        [0.029 * s, 0.032],
        [0.015 * s, 0.056],
        [0.005, 0.064],
      ],
      8,
    ),
  );

  for (const [side, sh, el, ha] of [
    [-1, leftShoulder, armTargets.lElbow, armTargets.lHand],
    [1, rightShoulder, armTargets.rElbow, armTargets.rHand],
  ] as const) {
    const sleeve = trackGeo(
      out,
      createOrganicLimb(
        [
          [sh.x, sh.y, sh.z],
          [el.x, el.y, el.z],
          [ha.x, ha.y, ha.z],
        ],
        0.034 * s,
        0.030 * s,
        0.024 * s,
        8,
        6,
      ),
    );
    out.matte.push({ geo: sleeve, colorRgb: opts.matteFabric });

    out.matte.push({
      geo: shoulderRingGeo,
      matrix: makeTransform(sh.x - side * 0.008, sh.y, sh.z, 0, torsoYaw + Math.PI * 0.5, 0),
      colorRgb: opts.matteFabric,
    });
    out.armor.push({
      geo: pauldronShellGeo,
      matrix: makeTransform(sh.x + side * 0.014, sh.y + 0.014, sh.z, 0.06, torsoYaw + side * -Math.PI * 0.45, side * -0.22),
      colorRgb: opts.armorPrimary,
    });

    const biStart = sh.clone().lerp(el, 0.14);
    const biEnd = sh.clone().lerp(el, 0.82);
    const faStart = el.clone().lerp(ha, 0.16);
    const faEnd = el.clone().lerp(ha, 0.88);
    out.armor.push({
      geo: bicepShellGeo,
      matrix: makeSegmentTransform(biStart, biEnd, 0.98, 1.04),
      colorRgb: opts.armorSecondary,
    });
    out.armor.push({
      geo: forearmBracerGeo,
      matrix: makeSegmentTransform(faStart, faEnd, 0.98, 1.06),
      colorRgb: opts.armorPrimary,
    });

    const elDir = new THREE.Vector3().subVectors(ha, sh).normalize();
    for (const off of [-0.016, 0, 0.016]) {
      out.matte.push({
        geo: elbowBellowsGeo,
        matrix: makeAlignTransform(el.clone().addScaledVector(elDir, off), elDir),
        colorRgb: opts.matteFabric,
      });
    }

    const wristDir = new THREE.Vector3().subVectors(ha, el).normalize();
    const wristPos = ha.clone().addScaledVector(wristDir, -0.026);
    out.trim.push({
      geo: wristRingGeo,
      matrix: makeAlignTransform(wristPos, wristDir),
      colorRgb: opts.trimMetal,
    });
    out.matte.push({
      geo: gloveGeo,
      matrix: makeAlignTransform(ha, wristDir, 1.0, 1.0, 0.86),
      colorRgb: opts.matteFabric,
    });
  }

  const headCenter = rotTorso(0, headY, 0.014);
  const headMat = makeTransform(headCenter.x, headCenter.y, headCenter.z, headPitch, torsoYaw + headYaw, 0);
  let headTopY = headY + 0.175;

  if (opts.helmet === 'eva_gold') {
    const helmetShell = trackGeo(out, new THREE.SphereGeometry(0.130, 12, 9));
    out.armor.push({
      geo: helmetShell,
      matrix: headMat.clone().multiply(makeTransform(0, 0, -0.008, 0.05, 0, 0, 0.94, 1.05, 1.06)),
      colorRgb: opts.armorPrimary,
    });
    const goldVisor = trackGeo(out, createCurvedVisorPart(0.125, 0.126, 0.138, 1.88, 0.86, 0.94, 12, 7));
    out.trim.push({
      geo: goldVisor,
      matrix: headMat.clone().multiply(makeTransform(0, 0.004, 0.006, 0.04, 0, 0)),
      colorRgb: [1.0, 0.85, 0.36],
    });
    const sunShadeOuter = trackGeo(out, createCurvedVisorPart(0.135, 0.134, 0.146, 1.96, 0.62, 0.36, 12, 4));
    out.matte.push({
      geo: sunShadeOuter,
      matrix: headMat.clone().multiply(makeTransform(0, 0.014, 0.008, -0.06, 0, 0)),
      colorRgb: opts.matteFabric,
    });
    const sunShadeTrim = trackGeo(out, new THREE.TorusGeometry(0.124, 0.007, 5, 16, Math.PI * 1.04));
    out.armor.push({
      geo: sunShadeTrim,
      matrix: headMat.clone().multiply(makeTransform(0, 0.062, 0.018, Math.PI * 0.44, 0, -0.08)),
      colorRgb: opts.armorSecondary,
    });
    const chinVent = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.044, -0.022],
          [0.044, -0.022],
          [0.052, 0.016],
          [-0.052, 0.016],
        ],
        0.026,
        0.006,
        0.006,
        1,
        2,
      ),
    );
    out.matte.push({
      geo: chinVent,
      matrix: headMat.clone().multiply(makeTransform(0, -0.082, 0.092, 0.24, 0, 0)),
      colorRgb: opts.matteFabric,
    });
    const earPod = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.036, 0.034, 8));
    earPod.rotateZ(Math.PI * 0.5);
    for (const side of [-1, 1] as const) {
      out.matte.push({
        geo: earPod,
        matrix: headMat.clone().multiply(makeTransform(side * 0.120, -0.006, -0.010)),
        colorRgb: opts.matteFabric,
      });
    }
    const rangePodBody = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.022, 0.088, 8));
    rangePodBody.rotateX(Math.PI * 0.5);
    const rangeLensRing = trackGeo(out, new THREE.TorusGeometry(0.019, 0.0045, 4, 10));
    const rangeLensGlow = trackGeo(out, new THREE.SphereGeometry(0.014, 6, 5));
    out.armor.push({
      geo: rangePodBody,
      matrix: headMat.clone().multiply(makeTransform(0.128, 0.036, 0.036)),
      colorRgb: opts.armorSecondary,
    });
    out.trim.push({
      geo: rangeLensRing,
      matrix: headMat.clone().multiply(makeTransform(0.128, 0.036, 0.080)),
      colorRgb: opts.trimMetal,
    });
    out.energy.push({
      geo: rangeLensGlow,
      matrix: headMat.clone().multiply(makeTransform(0.128, 0.036, 0.084, 0, 0, 0, 1.0, 1.0, 0.45)),
      colorRgb: opts.glowColor,
    });
    const stubAnt = trackGeo(out, new THREE.CylinderGeometry(0.0035, 0.0055, 0.115, 5));
    out.trim.push({
      geo: stubAnt,
      matrix: headMat.clone().multiply(makeTransform(-0.126, 0.062, -0.018, -0.18, 0, 0.12)),
      colorRgb: opts.trimMetal,
    });
    const helmetCrest = trackGeo(out, createCurvedBladePart(0.16, 0.024, 0.016, -0.02, 0.014, 4));
    out.armor.push({
      geo: helmetCrest,
      matrix: headMat.clone().multiply(makeTransform(0, 0.042, -0.088, 0.52, Math.PI, 0)),
      colorRgb: opts.armorSecondary,
    });
    headTopY = headY + 0.17;
  } else if (opts.helmet === 'engineer_weld') {
    const helmetShell = trackGeo(out, new THREE.SphereGeometry(0.124, 12, 9));
    out.armor.push({
      geo: helmetShell,
      matrix: headMat.clone().multiply(makeTransform(0, 0, -0.010, 0.08, 0, 0, 0.94, 1.04, 1.08)),
      colorRgb: opts.armorPrimary,
    });
    const weldVisorBase = trackGeo(out, createCurvedVisorPart(0.118, 0.114, 0.130, 1.82, 0.96, 0.72, 12, 5));
    out.trim.push({
      geo: weldVisorBase,
      matrix: headMat.clone().multiply(makeTransform(0, 0, 0.008, 0.05, 0, 0)),
      colorRgb: [0.98, 0.80, 0.34],
    });
    const weldVisorGlass = trackGeo(out, createCurvedVisorPart(0.124, 0.120, 0.138, 1.88, 0.94, 0.78, 10, 5));
    out.crystal.push({
      geo: weldVisorGlass,
      matrix: headMat.clone().multiply(makeTransform(0, 0, 0.012, 0.05, 0, 0)),
      colorRgb: opts.visorCrystalColor,
    });
    const browFrame = trackGeo(out, new THREE.TorusGeometry(0.116, 0.010, 5, 16, Math.PI * 1.02));
    out.matte.push({
      geo: browFrame,
      matrix: headMat.clone().multiply(makeTransform(0, 0.056, 0.018, Math.PI * 0.46, 0, -0.04)),
      colorRgb: opts.matteFabric,
    });
    const lampHousing = trackGeo(out, new THREE.CylinderGeometry(0.016, 0.018, 0.036, 7));
    lampHousing.rotateX(Math.PI * 0.5);
    const lampLens = trackGeo(out, new THREE.SphereGeometry(0.013, 6, 4));
    for (const side of [-1, 1] as const) {
      out.trim.push({
        geo: lampHousing,
        matrix: headMat.clone().multiply(makeTransform(side * 0.038, 0.078, 0.104)),
        colorRgb: opts.trimMetal,
      });
      out.energy.push({
        geo: lampLens,
        matrix: headMat.clone().multiply(makeTransform(side * 0.038, 0.078, 0.122, 0, 0, 0, 1, 1, 0.5)),
        colorRgb: opts.glowColor,
      });
    }
    const earMuff = trackGeo(out, new THREE.CylinderGeometry(0.034, 0.036, 0.032, 8));
    earMuff.rotateZ(Math.PI * 0.5);
    const hingePin = trackGeo(out, new THREE.SphereGeometry(0.014, 6, 4));
    for (const side of [-1, 1] as const) {
      out.matte.push({
        geo: earMuff,
        matrix: headMat.clone().multiply(makeTransform(side * 0.118, 0.0, -0.012)),
        colorRgb: opts.matteFabric,
      });
      out.trim.push({
        geo: hingePin,
        matrix: headMat.clone().multiply(makeTransform(side * 0.132, 0.018, 0.008)),
        colorRgb: opts.trimMetal,
      });
    }
    headTopY = headY + 0.165;
  } else {
    const innerHead = trackGeo(out, new THREE.SphereGeometry(0.084, 12, 9));
    out.armor.push({
      geo: innerHead,
      matrix: headMat.clone().multiply(makeTransform(0, -0.004, -0.008, 0, 0, 0, 0.90, 1.08, 0.96)),
      colorRgb: opts.armorPrimary,
    });
    const innerVisorBand = trackGeo(out, createCurvedVisorPart(0.082, 0.084, 0.090, 1.72, 1.04, 0.42, 10, 4));
    out.matte.push({
      geo: innerVisorBand,
      matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.002)),
      colorRgb: opts.matteFabric,
    });
    const visorFilament = trackGeo(out, createCurvedVisorPart(0.084, 0.086, 0.093, 1.54, 1.18, 0.14, 10, 3));
    out.energy.push({
      geo: visorFilament,
      matrix: headMat.clone().multiply(makeTransform(0, 0.006, 0.004)),
      colorRgb: opts.glowColor,
    });
    const bubbleHelmet = trackGeo(out, new THREE.SphereGeometry(0.150, 16, 12));
    out.crystal.push({
      geo: bubbleHelmet,
      matrix: headMat.clone().multiply(makeTransform(0, 0.012, 0)),
      colorRgb: opts.visorCrystalColor,
    });
    const meridianArc = trackGeo(out, new THREE.TorusGeometry(0.156, 0.0075, 5, 18, Math.PI * 1.18));
    out.trim.push({
      geo: meridianArc,
      matrix: headMat.clone().multiply(makeTransform(0, 0.012, 0, 0.12, Math.PI * 0.5, -0.08)),
      colorRgb: opts.trimMetal,
    });
    const hudRingA = trackGeo(out, new THREE.TorusGeometry(0.128, 0.0042, 4, 18, Math.PI * 1.35));
    const hudRingB = trackGeo(out, new THREE.TorusGeometry(0.114, 0.0036, 4, 16, Math.PI * 0.95));
    const hudStarPip = trackGeo(out, new THREE.OctahedronGeometry(0.0085, 0));
    out.energy.push(
      { geo: hudRingA, matrix: headMat.clone().multiply(makeTransform(0, 0.014, 0.008, Math.PI * 0.44, 0.22, -Math.PI * 0.65)), colorRgb: opts.glowColor },
      { geo: hudRingB, matrix: headMat.clone().multiply(makeTransform(0, 0.032, 0.012, Math.PI * 0.62, -0.28, -Math.PI * 0.45)), colorRgb: [0.85, 0.99, 1.0] },
      { geo: hudStarPip, matrix: headMat.clone().multiply(makeTransform(0.082, 0.044, 0.086)), colorRgb: [0.95, 1.0, 1.0] },
      { geo: hudStarPip, matrix: headMat.clone().multiply(makeTransform(-0.074, 0.022, 0.094)), colorRgb: opts.glowColor },
    );
    headTopY = headY + 0.19;
  }

  return {
    leftHand: armTargets.lHand,
    rightHand: armTargets.rHand,
    leftForearm: new THREE.Vector3().lerpVectors(armTargets.lElbow, armTargets.lHand, 0.58),
    rightForearm: new THREE.Vector3().lerpVectors(armTargets.rElbow, armTargets.rHand, 0.58),
    leftShoulder,
    rightShoulder,
    leftHip: rotTorso(-0.132 * s, pelvisY + 0.02, 0.01),
    rightHip: rotTorso(0.132 * s, pelvisY + 0.02, 0.01),
    chestCenter: rotTorso(0, chestY + 0.01, 0.116 * s),
    backMount: rotTorso(0, chestY + 0.02, -0.106 * s),
    headCenter,
    headTopY,
  };
}

function createChamferedHexSmall(radius: number, depth: number): THREE.BufferGeometry {
  const pts: (readonly [number, number])[] = [];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    pts.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  return createBevelExtrudePart(pts, depth, 0.003, 0.003, 1, 1);
}

function addOrbitalWingFin(out: UnitBlueprintParts, x: number, y: number, z: number, side: 1 | -1): void {
  const blade = trackGeo(out, createCreatureFin(0.24, 0.44, 0.24, 0.032, 0.012, 8, 4));
  out.wingParts.push({
    geo: blade,
    matrix: makeTransform(x, y, z, 0.12, side * 0.26, side * 0.34, side, 1, 1),
  });
}

const buildS01: BespokeUnitBuilder = (_ctx, out) => {
  const ceramicWhite: RgbTriple = [0.95, 0.97, 1.0];
  const silverIce: RgbTriple = [0.76, 0.84, 0.94];
  const darkTitanium: RgbTriple = [0.16, 0.21, 0.30];
  const mirrorGold: RgbTriple = [0.99, 0.83, 0.38];
  const plasmaCyan: RgbTriple = [0.34, 0.92, 1.0];
  const crystalCyan: RgbTriple = [0.64, 0.96, 1.0];

  const anchors = buildSleekAeroSuit(out, {
    stance: 'zero_g_guard',
    helmet: 'eva_gold',
    armorPrimary: ceramicWhite,
    armorSecondary: silverIce,
    matteFabric: darkTitanium,
    trimMetal: mirrorGold,
    glowColor: plasmaCyan,
    visorCrystalColor: crystalCyan,
    hoverY: 0.10,
    slimScale: 0.98,
  });

  const packPos = new THREE.Vector3(anchors.backMount.x, anchors.backMount.y - 0.02, anchors.backMount.z - 0.048);
  const packMat = makeTransform(packPos.x, packPos.y, packPos.z, 0.06, -0.15, 0);
  const packGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.022, -0.18],
        [0.076, -0.14],
        [0.100, -0.02],
        [0.098, 0.12],
        [0.072, 0.18],
        [0.018, 0.21],
      ],
      10,
    ),
  );
  out.armor.push({
    geo: packGeo,
    matrix: packMat.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.24, 1.0, 0.68)),
    colorRgb: ceramicWhite,
  });

  const ventLouverGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6));
  ventLouverGeo.rotateZ(Math.PI * 0.5);
  for (let lv = 0; lv < 3; lv += 1) {
    out.matte.push({
      geo: ventLouverGeo,
      matrix: packMat.clone().multiply(makeTransform(0, 0.06 - lv * 0.044, -0.066)),
      colorRgb: darkTitanium,
    });
  }

  const microNozzle = trackGeo(out, createLathePart([[0.008, 0], [0.006, -0.012], [0.013, -0.028]], 6));
  const rcsPodHub = trackGeo(out, new THREE.SphereGeometry(0.022, 7, 5));
  for (const side of [-1, 1] as const) {
    const podCenter = packMat.clone().multiply(makeTransform(side * 0.145, 0.155, -0.012, 0, 0, side * -0.24));
    const strut = trackGeo(
      out,
      createTaperedTubePart(
        [
          [packPos.x + side * 0.07, packPos.y + 0.12, packPos.z],
          [packPos.x + side * 0.14, packPos.y + 0.16, packPos.z - 0.01],
        ],
        0.010,
        0.008,
        4,
        5,
      ),
    );
    out.matte.push({ geo: strut, colorRgb: darkTitanium });
    out.armor.push({ geo: rcsPodHub, matrix: podCenter, colorRgb: silverIce });
    out.trim.push(
      { geo: microNozzle, matrix: podCenter.clone().multiply(makeTransform(0, 0.016, 0, Math.PI, 0, 0)), colorRgb: mirrorGold },
      { geo: microNozzle, matrix: podCenter.clone().multiply(makeTransform(side * 0.016, 0, 0, 0, 0, side * Math.PI * 0.5)), colorRgb: mirrorGold },
      { geo: microNozzle, matrix: podCenter.clone().multiply(makeTransform(0, 0, -0.016, Math.PI * 0.5, 0, 0)), colorRgb: mirrorGold },
    );
  }

  const thrusterBell = trackGeo(out, createLathePart([[0.022, 0], [0.016, -0.026], [0.028, -0.062]], 8));
  const rcsPlume = trackGeo(
    out,
    createLathePart(
      [
        [0.016, 0.0],
        [0.019, -0.032],
        [0.010, -0.078],
        [0.002, -0.115],
      ],
      8,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: thrusterBell,
      matrix: packMat.clone().multiply(makeTransform(side * 0.072, -0.15, -0.008, 0.14, 0, side * 0.12)),
      colorRgb: mirrorGold,
    });
    out.energy.push({
      geo: rcsPlume,
      matrix: packMat.clone().multiply(makeTransform(side * 0.078, -0.20, -0.016, 0.14, 0, side * 0.12)),
      colorRgb: plasmaCyan,
    });
  }

  const umbLeft = trackGeo(
    out,
    createTubePart(
      [
        [packPos.x - 0.08, packPos.y - 0.04, packPos.z + 0.01],
        [anchors.leftShoulder.x - 0.03, anchors.leftShoulder.y - 0.18, -0.01],
        [anchors.leftForearm.x, anchors.leftForearm.y - 0.02, anchors.leftForearm.z - 0.02],
      ],
      0.010,
      8,
      5,
    ),
  );
  const umbRight = trackGeo(
    out,
    createTubePart(
      [
        [packPos.x + 0.08, packPos.y - 0.05, packPos.z + 0.01],
        [anchors.rightHip.x + 0.04, anchors.chestCenter.y - 0.14, 0.01],
        [anchors.chestCenter.x + 0.05, anchors.chestCenter.y - 0.05, anchors.chestCenter.z],
      ],
      0.009,
      8,
      5,
    ),
  );
  out.matte.push({ geo: umbLeft, colorRgb: darkTitanium }, { geo: umbRight, colorRgb: darkTitanium });

  const hoverHalo = trackGeo(out, new THREE.TorusGeometry(0.25, 0.007, 4, 20));
  hoverHalo.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: hoverHalo,
    matrix: makeTransform(0.01, 0.09, -0.01),
    colorRgb: plasmaCyan,
  });

  const shieldCenter = new THREE.Vector3(anchors.leftHand.x - 0.13, anchors.leftHand.y + 0.03, anchors.leftHand.z + 0.13);
  const shieldRot = makeTransform(shieldCenter.x, shieldCenter.y, shieldCenter.z, -0.06, 0.30, 0.04);

  const braceArmA = trackGeo(
    out,
    createTaperedTubePart(
      [
        [anchors.leftForearm.x, anchors.leftForearm.y, anchors.leftForearm.z],
        [anchors.leftHand.x - 0.04, anchors.leftHand.y + 0.02, anchors.leftHand.z + 0.04],
        [shieldCenter.x + 0.01, shieldCenter.y, shieldCenter.z - 0.04],
      ],
      0.016,
      0.014,
      6,
      6,
    ),
  );
  const braceCuff = trackGeo(out, new THREE.TorusGeometry(0.044, 0.007, 4, 10));
  out.armor.push({ geo: braceArmA, colorRgb: silverIce });
  out.trim.push({
    geo: braceCuff,
    matrix: makeTransform(anchors.leftForearm.x, anchors.leftForearm.y, anchors.leftForearm.z, 0.4, 0.4, 0),
    colorRgb: mirrorGold,
  });

  const tileR = 0.110;
  const hexTile = trackGeo(out, createHexMirrorTilePart(tileR, 0.016, 0.010, -0.008, [0.76, 0.98, 1.0], [0.22, 0.80, 1.0]));
  const step = tileR * Math.sqrt(3) * 1.04;
  const honeycombOffsets: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [0.5, 0.866],
    [-0.5, 0.866],
    [-1, 0],
    [-0.5, -0.866],
    [0.5, -0.866],
  ];
  for (const [ox, oy] of honeycombOffsets) {
    const lx = ox * step;
    const ly = oy * step;
    const lz = -(lx * lx + ly * ly) * 0.18;
    out.crystal.push({
      geo: hexTile,
      matrix: shieldRot.clone().multiply(makeTransform(lx, ly, lz)),
    });
  }

  const hexOuterFrame = trackGeo(out, new THREE.TorusGeometry(0.328, 0.010, 5, 6));
  const hexMidFrame = trackGeo(out, new THREE.TorusGeometry(0.312, 0.006, 4, 6));
  const hexInnerRing = trackGeo(out, new THREE.TorusGeometry(0.120, 0.007, 5, 6));
  out.armor.push({
    geo: hexOuterFrame,
    matrix: shieldRot.clone().multiply(makeTransform(0, 0, -0.004, 0, 0, Math.PI / 6)),
    colorRgb: darkTitanium,
  });
  out.energy.push(
    { geo: hexMidFrame, matrix: shieldRot.clone().multiply(makeTransform(0, 0, 0.008, 0, 0, Math.PI / 6)), colorRgb: plasmaCyan },
    { geo: hexInnerRing, matrix: shieldRot.clone().multiply(makeTransform(0, 0, 0.015, 0, 0, Math.PI / 6)), colorRgb: [0.80, 0.99, 1.0] },
  );

  const emitterHub = trackGeo(
    out,
    createLathePart(
      [
        [0.014, -0.040],
        [0.048, -0.014],
        [0.040, 0.020],
        [0.016, 0.038],
      ],
      10,
    ),
  );
  const hubCore = trackGeo(out, new THREE.SphereGeometry(0.032, 8, 6));
  out.trim.push({
    geo: emitterHub,
    matrix: shieldRot.clone().multiply(makeTransform(0, 0, -0.016, Math.PI * 0.5, 0, 0)),
    colorRgb: mirrorGold,
  });
  out.energy.push({
    geo: hubCore,
    matrix: shieldRot.clone().multiply(makeTransform(0, 0, 0.018, 0, 0, 0, 1, 1, 0.52)),
    colorRgb: [0.86, 0.99, 1.0],
  });

  const prongGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.006, -0.044],
        [0.022, -0.016],
        [0.016, 0.024],
        [0.003, 0.056],
      ],
      7,
    ),
  );
  const nodeCap = trackGeo(out, new THREE.SphereGeometry(0.015, 6, 4));
  const nodeGlow = trackGeo(out, new THREE.OctahedronGeometry(0.011, 0));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const rx = Math.cos(a) * 0.336;
    const ry = Math.sin(a) * 0.336;
    if (i % 2 === 0) {
      out.armor.push({
        geo: prongGeo,
        matrix: shieldRot.clone().multiply(makeTransform(rx, ry, -0.004, 0, 0, a - Math.PI * 0.5)),
        colorRgb: ceramicWhite,
      });
    }
    out.trim.push({
      geo: nodeCap,
      matrix: shieldRot.clone().multiply(makeTransform(rx * 0.95, ry * 0.95, 0.008)),
      colorRgb: mirrorGold,
    });
    out.energy.push({
      geo: nodeGlow,
      matrix: shieldRot.clone().multiply(makeTransform(rx * 0.95, ry * 0.95, 0.020)),
      colorRgb: plasmaCyan,
    });
  }

  const gunMat = makeTransform(anchors.rightHand.x + 0.03, anchors.rightHand.y + 0.02, anchors.rightHand.z + 0.14, -0.06, 0.24, 0);
  const gunBody = trackGeo(out, createTeardropPart(0.44, 0.044, 1.24, 10, 8, 0, silverIce, ceramicWhite));
  out.armor.push({
    geo: gunBody,
    matrix: gunMat.clone().multiply(makeTransform(0, 0, 0.02, Math.PI * 0.5, 0, 0, 0.72, 1.0, 1.18)),
  });
  const gunStock = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.018, -0.046],
        [0.018, -0.046],
        [0.022, 0.022],
        [-0.022, 0.022],
      ],
      0.13,
      0.005,
      0.005,
      1,
      2,
    ),
  );
  out.matte.push({
    geo: gunStock,
    matrix: gunMat.clone().multiply(makeTransform(0, -0.012, -0.18)),
    colorRgb: darkTitanium,
  });
  const railGeo = trackGeo(out, createOrganicLimb([[0, 0, 0.04], [0, 0, 0.42]], 0.010, 0.0085, 0.007, 5, 5));
  for (const dy of [-0.022, 0.022]) {
    out.trim.push({ geo: railGeo, matrix: gunMat.clone().multiply(makeTransform(0, dy, 0)), colorRgb: mirrorGold });
  }
  const coilRing = trackGeo(out, new THREE.TorusGeometry(0.026, 0.0045, 3, 6));
  for (const zc of [0.12, 0.22, 0.32]) {
    out.matte.push({
      geo: coilRing,
      matrix: gunMat.clone().multiply(makeTransform(0, 0, zc)),
      colorRgb: darkTitanium,
    });
  }
  const sightBracket = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.020, 0.0],
        [0.020, 0.0],
        [0.024, 0.044],
        [-0.024, 0.044],
      ],
      0.056,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  out.matte.push({
    geo: sightBracket,
    matrix: gunMat.clone().multiply(makeTransform(0, 0.036, 0.02)),
    colorRgb: darkTitanium,
  });
  const sightOptic = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.010, 8));
  sightOptic.rotateX(Math.PI * 0.5);
  out.crystal.push({
    geo: sightOptic,
    matrix: gunMat.clone().multiply(makeTransform(0, 0.068, 0.048)),
    colorRgb: crystalCyan,
  });
  const sightDot = trackGeo(out, new THREE.SphereGeometry(0.007, 5, 4));
  out.energy.push({
    geo: sightDot,
    matrix: gunMat.clone().multiply(makeTransform(0, 0.068, 0.052)),
    colorRgb: plasmaCyan,
  });
  const muzzleArc = trackGeo(
    out,
    createLathePart(
      [
        [0.005, -0.04],
        [0.015, 0.0],
        [0.010, 0.09],
        [0.002, 0.16],
      ],
      7,
    ),
  );
  out.energy.push({
    geo: muzzleArc,
    matrix: gunMat.clone().multiply(makeTransform(0, 0, 0.34, Math.PI * 0.5, 0, 0)),
    colorRgb: plasmaCyan,
  });

  addOrbitalWingFin(out, -0.26, 1.12, -0.18, -1);
  addOrbitalWingFin(out, 0.26, 1.12, -0.18, 1);

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.58;
  out.weaponGlowHex = 0x38bdf8;
  out.headTopLocalY = anchors.headTopY;
};

const buildS02: BespokeUnitBuilder = (_ctx, out) => {
  const thermalSilver: RgbTriple = [0.94, 0.96, 1.0];
  const warmAlloy: RgbTriple = [0.85, 0.82, 0.76];
  const carbonSlate: RgbTriple = [0.18, 0.22, 0.29];
  const rhodiumGold: RgbTriple = [0.99, 0.84, 0.40];
  const weldAmber: RgbTriple = [1.0, 0.84, 0.36];
  const holoCyan: RgbTriple = [0.40, 0.94, 1.0];
  const dialIvory: RgbTriple = [0.98, 0.96, 0.90];

  const anchors = buildSleekAeroSuit(out, {
    stance: 'weld_aim',
    helmet: 'engineer_weld',
    armorPrimary: thermalSilver,
    armorSecondary: warmAlloy,
    matteFabric: carbonSlate,
    trimMetal: rhodiumGold,
    glowColor: weldAmber,
    visorCrystalColor: [1.0, 0.86, 0.44],
    hoverY: 0.07,
    slimScale: 0.95,
  });

  const tankGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.008, -0.22],
        [0.058, -0.18],
        [0.070, -0.11],
        [0.070, 0.12],
        [0.056, 0.19],
        [0.028, 0.22],
        [0.008, 0.24],
      ],
      10,
    ),
  );
  const tankBand = trackGeo(out, new THREE.TorusGeometry(0.072, 0.008, 3, 10));
  tankBand.rotateX(Math.PI * 0.5);
  const valveWheel = trackGeo(out, new THREE.TorusGeometry(0.024, 0.005, 3, 8));
  valveWheel.rotateX(Math.PI * 0.5);
  const valveStem = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.010, 0.042, 6));
  const gaugeBezel = trackGeo(out, new THREE.TorusGeometry(0.020, 0.0045, 3, 8));
  const gaugeFace = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.006, 8));
  gaugeFace.rotateX(Math.PI * 0.5);
  const sightGlass = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.17, 6));

  for (const side of [-1, 1] as const) {
    const tx = anchors.backMount.x + side * 0.110;
    const ty = anchors.backMount.y + 0.05;
    const tz = anchors.backMount.z - 0.068;
    const tMat = makeTransform(tx, ty, tz, 0.08, -0.12, side * -0.11);
    out.trim.push({
      geo: tankGeo,
      matrix: tMat,
      colorRgb: rhodiumGold,
    });
    for (const dy of [-0.09, 0.0, 0.09]) {
      out.matte.push({
        geo: tankBand,
        matrix: tMat.clone().multiply(makeTransform(0, dy, 0)),
        colorRgb: carbonSlate,
      });
    }
    out.matte.push({
      geo: valveStem,
      matrix: tMat.clone().multiply(makeTransform(0, 0.25, 0)),
      colorRgb: carbonSlate,
    });
    out.trim.push({
      geo: valveWheel,
      matrix: tMat.clone().multiply(makeTransform(0, 0.275, 0)),
      colorRgb: rhodiumGold,
    });
    out.trim.push({
      geo: gaugeBezel,
      matrix: tMat.clone().multiply(makeTransform(side * 0.026, 0.215, 0.044, 0, side * 0.35, 0)),
      colorRgb: rhodiumGold,
    });
    out.armor.push({
      geo: gaugeFace,
      matrix: tMat.clone().multiply(makeTransform(side * 0.026, 0.215, 0.043, 0, side * 0.35, 0)),
      colorRgb: dialIvory,
    });
    out.energy.push({
      geo: sightGlass,
      matrix: tMat.clone().multiply(makeTransform(side * 0.050, 0, -0.036)),
      colorRgb: weldAmber,
    });
  }

  const yokeArch = trackGeo(
    out,
    createTubePart(
      [
        [anchors.backMount.x - 0.11, anchors.backMount.y + 0.24, anchors.backMount.z - 0.05],
        [anchors.backMount.x, anchors.backMount.y + 0.27, anchors.backMount.z - 0.04],
        [anchors.backMount.x + 0.11, anchors.backMount.y + 0.24, anchors.backMount.z - 0.05],
      ],
      0.012,
      8,
      5,
    ),
  );
  out.armor.push({ geo: yokeArch, colorRgb: thermalSilver });

  const hosePts: readonly Vec3Tuple[] = [
    [anchors.backMount.x + 0.11, anchors.backMount.y + 0.25, anchors.backMount.z - 0.05],
    [anchors.rightShoulder.x + 0.06, anchors.rightShoulder.y + 0.10, -0.01],
    [anchors.rightForearm.x + 0.04, anchors.rightForearm.y + 0.04, anchors.rightForearm.z - 0.02],
    [anchors.rightHand.x + 0.02, anchors.rightHand.y, anchors.rightHand.z + 0.04],
  ];
  const feedHose = trackGeo(out, createTubePart(hosePts, 0.010, 9, 4));
  out.matte.push({ geo: feedHose, colorRgb: carbonSlate });

  const hoseCurve = new THREE.CatmullRomCurve3(hosePts.map((p) => new THREE.Vector3(...p)));
  const ferruleRing = trackGeo(out, new THREE.TorusGeometry(0.013, 0.0038, 3, 6));
  ferruleRing.rotateX(Math.PI * 0.5);
  for (let f = 1; f <= 6; f += 1) {
    const t = f / 7;
    const pt = hoseCurve.getPoint(t);
    const tan = hoseCurve.getTangent(t);
    out.trim.push({
      geo: ferruleRing,
      matrix: makeAlignTransform(pt, tan),
      colorRgb: rhodiumGold,
    });
  }

  const toolBeltStrap = trackGeo(
    out,
    createTaperedTubePart(
      [
        [anchors.leftShoulder.x + 0.04, anchors.leftShoulder.y + 0.02, 0.06],
        [anchors.chestCenter.x, anchors.chestCenter.y - 0.01, anchors.chestCenter.z + 0.028],
        [anchors.rightHip.x - 0.02, anchors.rightHip.y + 0.06, 0.08],
      ],
      0.012,
      0.011,
      8,
      5,
    ),
  );
  out.matte.push({ geo: toolBeltStrap, colorRgb: carbonSlate });

  const plierMat = makeTransform(anchors.chestCenter.x - 0.055, anchors.chestCenter.y + 0.01, anchors.chestCenter.z + 0.036, 0.08, -0.12, -0.46);
  const plierJaw = trackGeo(out, createCurvedBladePart(0.065, 0.014, 0.007, 0.018, 0.008, 4));
  const plierHandle = trackGeo(out, new THREE.CylinderGeometry(0.006, 0.007, 0.072, 5));
  const plierPivot = trackGeo(out, new THREE.SphereGeometry(0.010, 5, 4));
  for (const sgn of [-1, 1] as const) {
    out.armor.push({
      geo: plierJaw,
      matrix: plierMat.clone().multiply(makeTransform(sgn * 0.008, 0.010, 0, 0, sgn === 1 ? Math.PI : 0, sgn * -0.18)),
      colorRgb: thermalSilver,
    });
    out.trim.push({
      geo: plierHandle,
      matrix: plierMat.clone().multiply(makeTransform(sgn * 0.012, -0.034, 0, 0, 0, sgn * 0.22)),
      colorRgb: rhodiumGold,
    });
  }
  out.matte.push({ geo: plierPivot, matrix: plierMat, colorRgb: carbonSlate });

  const solderRod = trackGeo(out, new THREE.CylinderGeometry(0.004, 0.004, 0.11, 5));
  for (const idx of [-1, 0, 1]) {
    out.trim.push({
      geo: solderRod,
      matrix: makeTransform(anchors.chestCenter.x + 0.065 + idx * 0.012, anchors.chestCenter.y - 0.01, anchors.chestCenter.z + 0.022, 0.08, -0.12, 0.24),
      colorRgb: rhodiumGold,
    });
  }

  const anchorPodPos = new THREE.Vector3(-0.36, 0.30, -0.13);
  const tetherCable = trackGeo(
    out,
    createTubePart(
      [
        [anchors.leftHip.x - 0.02, anchors.leftHip.y, anchors.leftHip.z - 0.02],
        [-0.29, 0.62, -0.08],
        [-0.38, 0.46, 0.02],
        [-0.30, 0.34, -0.08],
        [anchorPodPos.x, anchorPodPos.y, anchorPodPos.z],
      ],
      0.008,
      10,
      4,
    ),
  );
  out.trim.push({ geo: tetherCable, colorRgb: rhodiumGold });

  const anchorClamp = trackGeo(
    out,
    createLathePart(
      [
        [0.008, -0.065],
        [0.045, -0.02],
        [0.038, 0.032],
        [0.006, 0.074],
      ],
      9,
    ),
  );
  const anchorMagRing = trackGeo(out, new THREE.TorusGeometry(0.060, 0.008, 4, 14));
  out.armor.push({
    geo: anchorClamp,
    matrix: makeTransform(anchorPodPos.x, anchorPodPos.y, anchorPodPos.z, 0.4, 0.6, -0.3),
    colorRgb: thermalSilver,
  });
  out.energy.push({
    geo: anchorMagRing,
    matrix: makeTransform(anchorPodPos.x, anchorPodPos.y - 0.02, anchorPodPos.z, Math.PI * 0.5, 0, 0),
    colorRgb: holoCyan,
  });

  const lanceOrigin = new THREE.Vector3(anchors.rightHand.x + 0.02, anchors.rightHand.y + 0.01, anchors.rightHand.z + 0.08);
  const lanceMat = makeTransform(lanceOrigin.x, lanceOrigin.y, lanceOrigin.z, -0.05, 0.24, 0);

  const gunChassis = trackGeo(out, createTeardropPart(0.36, 0.042, 1.25, 10, 8, 0, warmAlloy, thermalSilver));
  out.armor.push({
    geo: gunChassis,
    matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.04, Math.PI * 0.5, 0, 0)),
  });

  const heatFin = trackGeo(out, new THREE.TorusGeometry(0.046, 0.0065, 3, 9));
  for (let h = 0; h < 4; h += 1) {
    out.trim.push({
      geo: heatFin,
      matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.08 + h * 0.032, 0, 0, 0, 1.0 + h * 0.08, 1.0 + h * 0.08, 0.6)),
      colorRgb: rhodiumGold,
    });
  }

  const parabolaDish = trackGeo(
    out,
    createLathePart(
      [
        [0.012, 0.0],
        [0.056, 0.012],
        [0.102, 0.038],
        [0.128, 0.072],
      ],
      14,
    ),
  );
  out.trim.push({
    geo: parabolaDish,
    matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.22, Math.PI * 0.5, 0, 0)),
    colorRgb: rhodiumGold,
  });

  const dishRim = trackGeo(out, new THREE.TorusGeometry(0.128, 0.007, 4, 14));
  out.armor.push({
    geo: dishRim,
    matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.292)),
    colorRgb: thermalSilver,
  });

  const dishStrut = trackGeo(out, new THREE.CylinderGeometry(0.004, 0.005, 0.13, 5));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2;
    out.matte.push({
      geo: dishStrut,
      matrix: lanceMat.clone().multiply(makeTransform(Math.cos(a) * 0.068, Math.sin(a) * 0.068, 0.31, Math.PI * 0.36, 0, a + Math.PI * 0.5)),
      colorRgb: carbonSlate,
    });
  }

  const emitterTip = trackGeo(
    out,
    createLathePart(
      [
        [0.006, -0.05],
        [0.018, 0.0],
        [0.012, 0.08],
        [0.002, 0.16],
      ],
      7,
    ),
  );
  out.energy.push({
    geo: emitterTip,
    matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.36, Math.PI * 0.5, 0, 0)),
    colorRgb: [1.0, 0.94, 0.72],
  });

  const plasmaCone = trackGeo(
    out,
    createLathePart(
      [
        [0.112, 0.0],
        [0.068, 0.10],
        [0.024, 0.21],
        [0.005, 0.28],
      ],
      10,
    ),
  );
  out.crystal.push({
    geo: plasmaCone,
    matrix: lanceMat.clone().multiply(makeTransform(0, 0, 0.29, Math.PI * 0.5, 0, 0)),
    colorRgb: [1.0, 0.88, 0.44],
  });

  const holoMat = makeTransform(anchors.leftHand.x - 0.05, anchors.leftHand.y + 0.095, anchors.leftHand.z + 0.05, -0.22, 0.34, 0.08);
  const holoBezel = trackGeo(out, createBevelExtrudePart([[-0.098, -0.064], [0.098, -0.064], [0.106, 0.064], [-0.106, 0.064]], 0.008, 0.003, 0.003, 1, 2));
  out.crystal.push({
    geo: holoBezel,
    matrix: holoMat,
    colorRgb: holoCyan,
  });
  const holoFrameBar = trackGeo(out, new THREE.CylinderGeometry(0.005, 0.005, 0.21, 5));
  holoFrameBar.rotateZ(Math.PI * 0.5);
  out.trim.push(
    { geo: holoFrameBar, matrix: holoMat.clone().multiply(makeTransform(0, -0.066, 0.004)), colorRgb: rhodiumGold },
    { geo: holoFrameBar, matrix: holoMat.clone().multiply(makeTransform(0, 0.066, 0.004)), colorRgb: rhodiumGold },
  );
  const holoBar = trackGeo(out, createOrganicLimb([[-0.076, 0, 0.007], [0.076, 0, 0.007]], 0.0045, 0.0045, 0.0045, 4, 4));
  for (const dy of [-0.030, 0.0, 0.030]) {
    out.energy.push({
      geo: holoBar,
      matrix: holoMat.clone().multiply(makeTransform(0, dy, 0)),
      colorRgb: holoCyan,
    });
  }

  addOrbitalWingFin(out, -0.25, 1.10, -0.18, -1);
  addOrbitalWingFin(out, 0.25, 1.10, -0.18, 1);

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.58;
  out.weaponGlowHex = 0xf59e0b;
  out.headTopLocalY = anchors.headTopY;
};

const buildS03: BespokeUnitBuilder = (_ctx, out) => {
  const platinumWhite: RgbTriple = [0.94, 0.97, 1.0];
  const opticalSlate: RgbTriple = [0.15, 0.20, 0.30];
  const gimbalGold: RgbTriple = [0.98, 0.82, 0.40];
  const laserCyan: RgbTriple = [0.46, 0.96, 1.0];
  const sapphireBot: RgbTriple = [0.22, 0.54, 1.0];
  const sapphireTop: RgbTriple = [0.78, 0.98, 1.0];

  const centerY = 0.98;
  const prismTilt = makeTransform(0, centerY, 0, 0.16, 0.36, -0.14);

  const outerOcta = trackGeo(out, createFacetedCrystalPart(0.84, 0.34, 4, 0.50, 0.50, sapphireBot, sapphireTop));
  out.crystal.push({ geo: outerOcta, matrix: prismTilt });

  const innerCrystal = trackGeo(out, createFacetedCrystalPart(0.62, 0.24, 8, 0.50, 0.50, [0.38, 0.84, 1.0], [0.90, 1.0, 1.0]));
  out.crystal.push({
    geo: innerCrystal,
    matrix: prismTilt.clone().multiply(makeTransform(0, 0, 0, 0, Math.PI * 0.25, 0)),
  });

  const waistCrown = trackGeo(out, new THREE.TorusGeometry(0.354, 0.012, 6, 4));
  waistCrown.rotateX(Math.PI * 0.5);
  out.trim.push({
    geo: waistCrown,
    matrix: prismTilt.clone().multiply(makeTransform(0, 0, 0, 0, Math.PI * 0.25, 0)),
    colorRgb: gimbalGold,
  });

  const apexCap = trackGeo(out, createLathePart([[0.004, 0.0], [0.056, -0.055], [0.044, -0.08]], 8));
  out.trim.push(
    { geo: apexCap, matrix: prismTilt.clone().multiply(makeTransform(0, 0.44, 0)), colorRgb: gimbalGold },
    { geo: apexCap, matrix: prismTilt.clone().multiply(makeTransform(0, -0.44, 0, Math.PI, 0, 0)), colorRgb: gimbalGold },
  );

  const coreOcta = trackGeo(out, new THREE.OctahedronGeometry(0.132, 0));
  out.energy.push({
    geo: coreOcta,
    matrix: prismTilt,
    colorRgb: [0.92, 1.0, 1.0],
  });

  const axisBeam = trackGeo(out, createOrganicLimb([[0, -0.35, 0], [0, 0.35, 0]], 0.012, 0.016, 0.012, 8, 6));
  const nodeOrb = trackGeo(out, new THREE.SphereGeometry(0.024, 8, 6));
  out.energy.push(
    { geo: axisBeam, matrix: prismTilt, colorRgb: laserCyan },
    { geo: axisBeam, matrix: prismTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, Math.PI * 0.5, 1, 0.76, 1)), colorRgb: laserCyan },
    { geo: axisBeam, matrix: prismTilt.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0, 1, 0.76, 1)), colorRgb: laserCyan },
  );
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    out.energy.push({
      geo: nodeOrb,
      matrix: prismTilt.clone().multiply(makeTransform(Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24)),
      colorRgb: laserCyan,
    });
  }

  const innerGyroMat = makeTransform(0, centerY, 0, 0.46, 0.32, -0.26);
  const innerGyroRing = trackGeo(out, new THREE.TorusGeometry(0.45, 0.016, 7, 30));
  const innerGyroRail = trackGeo(out, new THREE.TorusGeometry(0.472, 0.007, 5, 28));
  out.trim.push({ geo: innerGyroRing, matrix: innerGyroMat, colorRgb: gimbalGold });
  out.armor.push({ geo: innerGyroRail, matrix: innerGyroMat, colorRgb: platinumWhite });

  const collimatorBody = trackGeo(out, createTeardropPart(0.11, 0.030, 1.3, 12, 10, 0));
  const collimatorLens = trackGeo(out, new THREE.SphereGeometry(0.017, 8, 6));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2;
    const cx = Math.cos(a) * 0.45;
    const cy = Math.sin(a) * 0.45;
    const cm = innerGyroMat.clone().multiply(makeTransform(cx, cy, 0, 0, 0, a + Math.PI * 0.5));
    out.matte.push({ geo: collimatorBody, matrix: cm, colorRgb: opticalSlate });
    out.energy.push({
      geo: collimatorLens,
      matrix: innerGyroMat.clone().multiply(makeTransform(Math.cos(a) * 0.39, Math.sin(a) * 0.39, 0)),
      colorRgb: laserCyan,
    });
  }

  const outerGyroMat = makeTransform(0, centerY, 0, -0.34, -0.48, 0.32);
  const outerGyroRing = trackGeo(out, new THREE.TorusGeometry(0.57, 0.020, 7, 34));
  const outerTrimWire = trackGeo(out, new THREE.TorusGeometry(0.595, 0.007, 5, 30));
  out.armor.push({ geo: outerGyroRing, matrix: outerGyroMat, colorRgb: platinumWhite });
  out.trim.push({ geo: outerTrimWire, matrix: outerGyroMat, colorRgb: gimbalGold });

  const vernierLug = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.036, -0.026],
        [0.036, -0.026],
        [0.024, 0.038],
        [-0.024, 0.038],
      ],
      0.036,
      0.006,
      0.006,
      1,
      2,
    ),
  );
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const lm = outerGyroMat.clone().multiply(makeTransform(Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0, 0, 0, a - Math.PI * 0.5));
    out.matte.push({ geo: vernierLug, matrix: lm, colorRgb: opticalSlate });
    out.trim.push({
      geo: nodeOrb,
      matrix: outerGyroMat.clone().multiply(makeTransform(Math.cos(a) * 0.615, Math.sin(a) * 0.615, 0)),
      colorRgb: gimbalGold,
    });
  }

  const baseRing = trackGeo(out, new THREE.TorusGeometry(0.24, 0.018, 7, 24));
  baseRing.rotateX(Math.PI * 0.5);
  const baseGold = trackGeo(out, new THREE.TorusGeometry(0.27, 0.008, 6, 22));
  baseGold.rotateX(Math.PI * 0.5);
  out.armor.push({ geo: baseRing, matrix: makeTransform(0, 0.22, 0), colorRgb: platinumWhite });
  out.trim.push({ geo: baseGold, matrix: makeTransform(0, 0.22, 0), colorRgb: gimbalGold });

  const trapCone = trackGeo(out, createLathePart([[0.21, 0.0], [0.11, 0.16], [0.025, 0.30]], 16));
  out.crystal.push({
    geo: trapCone,
    matrix: makeTransform(0, 0.22, 0),
    colorRgb: [0.46, 0.90, 1.0],
  });

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.68, 0.012, 6, 26));
  out.wingParts.push({ geo: wingRing, matrix: makeTransform(0, centerY, 0, 0.22, 0.42, 0) });

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.64;
  out.weaponGlowHex = 0x38bdf8;
  out.headTopLocalY = 1.60;
};

const buildS05: BespokeUnitBuilder = (_ctx, out) => {
  const starSilver: RgbTriple = [0.89, 0.94, 1.0];
  const deepSpaceBlue: RgbTriple = [0.24, 0.45, 0.74];
  const suitSlate: RgbTriple = [0.15, 0.21, 0.32];
  const chronoGold: RgbTriple = [0.99, 0.84, 0.42];
  const icePulse: RgbTriple = [0.44, 0.95, 1.0];
  const bubbleTint: RgbTriple = [0.74, 0.92, 1.0];

  const anchors = buildSleekAeroSuit(out, {
    stance: 'cradle_box',
    helmet: 'star_bubble',
    armorPrimary: starSilver,
    armorSecondary: deepSpaceBlue,
    matteFabric: suitSlate,
    trimMetal: chronoGold,
    glowColor: icePulse,
    visorCrystalColor: bubbleTint,
    hoverY: 0.07,
    slimScale: 0.94,
  });

  const shoulderCape = trackGeo(
    out,
    createFlowingRibbonMesh(
      [
        [anchors.leftShoulder.x + 0.04, anchors.leftShoulder.y + 0.06, anchors.leftShoulder.z + 0.04],
        [anchors.leftShoulder.x - 0.05, anchors.leftShoulder.y + 0.02, -0.08],
        [anchors.leftHip.x - 0.10, anchors.leftHip.y + 0.14, -0.19],
        [-0.24, 0.54, -0.24],
        [-0.29, 0.32, -0.26],
      ],
      [0.14, 0.24, 0.29],
      0.018,
      1.6,
      14,
      4,
      0.008,
      deepSpaceBlue,
      starSilver,
    ),
  );
  out.armor.push({ geo: shoulderCape });

  const capeTrimEdge = trackGeo(
    out,
    createTaperedTubePart(
      [
        [anchors.leftShoulder.x + 0.05, anchors.leftShoulder.y + 0.06, anchors.leftShoulder.z + 0.05],
        [anchors.leftShoulder.x - 0.04, anchors.leftShoulder.y + 0.02, -0.07],
        [-0.20, 0.72, -0.18],
        [-0.26, 0.34, -0.25],
      ],
      0.007,
      0.005,
      10,
      4,
    ),
  );
  out.trim.push({ geo: capeTrimEdge, colorRgb: chronoGold });

  const broochClasp = trackGeo(out, createHexMirrorTilePart(0.026, 0.010, 0.004, 0, chronoGold, starSilver));
  out.trim.push({
    geo: broochClasp,
    matrix: makeTransform(anchors.leftShoulder.x + 0.06, anchors.leftShoulder.y + 0.04, anchors.leftShoulder.z + 0.07, 0.15, 0.28, 0),
  });

  for (const side of [-1, 1] as const) {
    const tail = trackGeo(
      out,
      createFlowingRibbonMesh(
        [
          [side * 0.10, 0.86, -0.07],
          [side * 0.15, 0.66, -0.13],
          [side * 0.19, 0.44, -0.17],
          [side * 0.22, 0.26, -0.19],
        ],
        [0.09, 0.13, 0.10],
        0.014,
        1.5,
        10,
        3,
        0.007,
        deepSpaceBlue,
        starSilver,
      ),
    );
    out.armor.push({ geo: tail });
  }

  const backFinPack = trackGeo(out, createTeardropPart(0.32, 0.068, 1.32, 10, 8, 0.012, deepSpaceBlue, starSilver));
  out.armor.push({
    geo: backFinPack,
    matrix: makeTransform(anchors.backMount.x, anchors.backMount.y - 0.01, anchors.backMount.z - 0.042, 0.06, 0.08, 0, 1.12, 1.0, 0.62),
  });

  const antRod = trackGeo(out, createOrganicLimb([[0, 0, 0], [0, 0.28, -0.04]], 0.007, 0.005, 0.003, 5, 4));
  const antTip = trackGeo(out, new THREE.SphereGeometry(0.012, 6, 4));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: antRod,
      matrix: makeTransform(anchors.backMount.x + side * 0.058, anchors.backMount.y + 0.12, anchors.backMount.z - 0.045, 0, 0.08, side * -0.18),
      colorRgb: chronoGold,
    });
    out.energy.push({
      geo: antTip,
      matrix: makeTransform(anchors.backMount.x + side * 0.106, anchors.backMount.y + 0.39, anchors.backMount.z - 0.085),
      colorRgb: icePulse,
    });
  }

  const boxCenter = new THREE.Vector3(0.02, anchors.chestCenter.y - 0.08, 0.34);
  const boxTilt = makeTransform(boxCenter.x, boxCenter.y, boxCenter.z, 0.18, 0.12, 0);

  const casketBase = trackGeo(
    out,
    createLathePart(
      [
        [0.014, -0.075],
        [0.102, -0.068],
        [0.132, -0.034],
        [0.136, 0.008],
        [0.112, 0.014],
      ],
      6,
    ),
  );
  out.trim.push({ geo: casketBase, matrix: boxTilt, colorRgb: chronoGold });

  const casketInnerRim = trackGeo(out, new THREE.TorusGeometry(0.122, 0.010, 5, 6));
  casketInnerRim.rotateX(Math.PI * 0.5);
  out.armor.push({
    geo: casketInnerRim,
    matrix: boxTilt.clone().multiply(makeTransform(0, 0.014, 0)),
    colorRgb: deepSpaceBlue,
  });

  const lidPanel = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.062, 0.0],
        [0.062, 0.0],
        [0.046, 0.125],
        [-0.046, 0.125],
      ],
      0.014,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const lx = Math.cos(a) * 0.108;
    const lz = Math.sin(a) * 0.108;
    const lm = boxTilt
      .clone()
      .multiply(makeTransform(lx, 0.014, lz, 0, -a + Math.PI * 0.5, 0))
      .multiply(makeTransform(0, 0, 0, -0.78, 0, 0));
    out.trim.push({ geo: lidPanel, matrix: lm, colorRgb: chronoGold });
    out.armor.push({
      geo: lidPanel,
      matrix: lm.clone().multiply(makeTransform(0, 0.004, 0.009, 0, 0, 0, 0.78, 0.82, 0.55)),
      colorRgb: starSilver,
    });
  }

  const crystalCoreOuter = trackGeo(
    out,
    createFacetedCrystalPart(0.225, 0.082, 6, 0.58, 0.42, [0.22, 0.76, 1.0], [0.88, 1.0, 1.0]),
  );
  const crystalPulseInner = trackGeo(out, new THREE.OctahedronGeometry(0.052, 0));
  out.crystal.push({
    geo: crystalCoreOuter,
    matrix: boxTilt.clone().multiply(makeTransform(0, 0.124, 0)),
  });
  out.energy.push({
    geo: crystalPulseInner,
    matrix: boxTilt.clone().multiply(makeTransform(0, 0.124, 0)),
    colorRgb: [0.90, 1.0, 1.0],
  });

  const chronoRingA = trackGeo(out, new THREE.TorusGeometry(0.124, 0.0065, 5, 16));
  const chronoRingB = trackGeo(out, new THREE.TorusGeometry(0.150, 0.0055, 5, 16));
  const chronoRingC = trackGeo(out, new THREE.TorusGeometry(0.172, 0.0045, 4, 18));
  const tickStud = trackGeo(out, new THREE.OctahedronGeometry(0.009, 0));
  const rMatA = boxTilt.clone().multiply(makeTransform(0, 0.124, 0, 0.65, 0.42, 0.25));
  const rMatB = boxTilt.clone().multiply(makeTransform(0, 0.124, 0, -0.52, -0.34, 0.48));
  const rMatC = boxTilt.clone().multiply(makeTransform(0, 0.124, 0, 1.24, 0.16, -0.36));
  out.trim.push(
    { geo: chronoRingA, matrix: rMatA, colorRgb: chronoGold },
    { geo: chronoRingB, matrix: rMatB, colorRgb: chronoGold },
    { geo: chronoRingC, matrix: rMatC, colorRgb: starSilver },
  );
  for (let t = 0; t < 4; t += 1) {
    const a = (t / 4) * Math.PI * 2;
    out.trim.push({
      geo: tickStud,
      matrix: rMatB.clone().multiply(makeTransform(Math.cos(a) * 0.150, Math.sin(a) * 0.150, 0)),
      colorRgb: chronoGold,
    });
  }

  const timeRipple = trackGeo(out, new THREE.TorusGeometry(0.24, 0.007, 4, 20));
  timeRipple.rotateX(Math.PI * 0.5);
  out.energy.push({
    geo: timeRipple,
    matrix: makeTransform(0.01, 0.08, 0),
    colorRgb: icePulse,
  });

  addOrbitalWingFin(out, -0.24, 1.12, -0.18, -1);
  addOrbitalWingFin(out, 0.24, 1.12, -0.18, 1);

  out.crystalHex = 0x38bdf8;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.58;
  out.weaponGlowHex = 0x60a5fa;
  out.headTopLocalY = anchors.headTopY;
};

const buildS06: BespokeUnitBuilder = (_ctx, out) => {
  const hullPorcelain: RgbTriple = [0.92, 0.96, 1.0];
  const abyssTitanium: RgbTriple = [0.14, 0.22, 0.30];
  const cryoGold: RgbTriple = [0.95, 0.80, 0.42];
  const tidalTeal: RgbTriple = [0.22, 0.94, 0.88];
  const glacialBlue: RgbTriple = [0.20, 0.72, 0.98];

  const centerY = 0.88;
  const buoyTilt = makeTransform(0, centerY, 0, 0.24, 0.18, -0.12);

  const mainTorus = trackGeo(out, new THREE.TorusGeometry(0.50, 0.056, 8, 26));
  mainTorus.rotateX(Math.PI * 0.5);
  const grooveTorus = trackGeo(out, new THREE.TorusGeometry(0.538, 0.016, 5, 24));
  grooveTorus.rotateX(Math.PI * 0.5);
  const innerRimGold = trackGeo(out, new THREE.TorusGeometry(0.436, 0.012, 5, 24));
  innerRimGold.rotateX(Math.PI * 0.5);

  out.armor.push({
    geo: mainTorus,
    matrix: buoyTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 0.74, 1.0)),
    colorRgb: hullPorcelain,
  });
  out.matte.push({
    geo: grooveTorus,
    matrix: buoyTilt,
    colorRgb: abyssTitanium,
  });
  out.trim.push({
    geo: innerRimGold,
    matrix: buoyTilt,
    colorRgb: cryoGold,
  });

  const secRing = trackGeo(out, new THREE.TorusGeometry(0.39, 0.022, 6, 22));
  secRing.rotateX(Math.PI * 0.5);
  const secRingTrim = trackGeo(out, new THREE.TorusGeometry(0.414, 0.008, 5, 20));
  secRingTrim.rotateX(Math.PI * 0.5);
  for (const dy of [-0.17, 0.17]) {
    out.armor.push({
      geo: secRing,
      matrix: buoyTilt.clone().multiply(makeTransform(0, dy, 0)),
      colorRgb: hullPorcelain,
    });
    out.trim.push({
      geo: secRingTrim,
      matrix: buoyTilt.clone().multiply(makeTransform(0, dy, 0)),
      colorRgb: cryoGold,
    });
  }

  const nacelleGeo = trackGeo(
    out,
    createLathePart(
      [
        [0.010, -0.075],
        [0.042, -0.035],
        [0.044, 0.020],
        [0.022, 0.068],
        [0.004, 0.090],
      ],
      9,
    ),
  );
  const strutGeo = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.39, -0.17, 0],
        [0.51, 0, 0],
        [0.39, 0.17, 0],
      ],
      0.013,
      0.018,
      0.013,
      8,
      6,
    ),
  );
  const sensorLed = trackGeo(out, new THREE.SphereGeometry(0.016, 7, 5));

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rotM = buoyTilt.clone().multiply(makeTransform(0, 0, 0, 0, a, 0));
    out.matte.push({ geo: strutGeo, matrix: rotM, colorRgb: abyssTitanium });
    out.armor.push({
      geo: nacelleGeo,
      matrix: rotM.clone().multiply(makeTransform(0.555, 0, 0, 0, 0, -Math.PI * 0.5)),
      colorRgb: hullPorcelain,
    });
    out.energy.push({
      geo: sensorLed,
      matrix: rotM.clone().multiply(makeTransform(0.59, 0, 0)),
      colorRgb: tidalTeal,
    });
  }

  const tidalSphere = trackGeo(out, new THREE.SphereGeometry(0.21, 16, 12));
  out.crystal.push({
    geo: tidalSphere,
    matrix: buoyTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 0.86, 1.0)),
    colorRgb: [0.32, 0.92, 0.94],
  });

  const waveLensGeo = trackGeo(
    out,
    createSculptedClothLathe(
      [
        [0.05, 0.0],
        [0.14, 0.025],
        [0.24, -0.018],
        [0.33, 0.020],
        [0.40, 0.0],
      ],
      18,
      6,
      0.014,
      0.2,
      glacialBlue,
      tidalTeal,
    ),
  );
  out.crystal.push({
    geo: waveLensGeo,
    matrix: buoyTilt.clone().multiply(makeTransform(0, 0.015, 0)),
  });

  const coreHeart = trackGeo(out, new THREE.OctahedronGeometry(0.088, 1));
  const phaseRingA = trackGeo(out, new THREE.TorusGeometry(0.26, 0.009, 5, 20));
  const phaseRingB = trackGeo(out, new THREE.TorusGeometry(0.32, 0.008, 5, 20));
  phaseRingB.rotateX(Math.PI * 0.5);
  out.energy.push(
    { geo: coreHeart, matrix: buoyTilt, colorRgb: [0.80, 1.0, 0.98] },
    { geo: phaseRingA, matrix: buoyTilt.clone().multiply(makeTransform(0, 0, 0, 0.45, 0.3, 0)), colorRgb: tidalTeal },
    { geo: phaseRingB, matrix: buoyTilt, colorRgb: glacialBlue },
  );

  const mastSpire = trackGeo(
    out,
    createLathePart(
      [
        [0.026, -0.14],
        [0.022, -0.02],
        [0.012, 0.09],
        [0.003, 0.16],
      ],
      9,
    ),
  );
  const beaconTip = trackGeo(out, new THREE.SphereGeometry(0.020, 7, 5));
  out.armor.push(
    { geo: mastSpire, matrix: buoyTilt.clone().multiply(makeTransform(0, 0.32, 0)), colorRgb: hullPorcelain },
    { geo: mastSpire, matrix: buoyTilt.clone().multiply(makeTransform(0, -0.32, 0, Math.PI, 0, 0)), colorRgb: abyssTitanium },
  );
  out.energy.push(
    { geo: beaconTip, matrix: buoyTilt.clone().multiply(makeTransform(0, 0.50, 0)), colorRgb: tidalTeal },
    { geo: beaconTip, matrix: buoyTilt.clone().multiply(makeTransform(0, -0.50, 0)), colorRgb: glacialBlue },
  );

  const anchorDisc = trackGeo(out, new THREE.TorusGeometry(0.32, 0.018, 6, 20));
  anchorDisc.rotateX(Math.PI * 0.5);
  const dampingWave = trackGeo(out, new THREE.TorusGeometry(0.42, 0.008, 5, 22));
  dampingWave.rotateX(Math.PI * 0.5);
  out.matte.push({ geo: anchorDisc, matrix: makeTransform(0, 0.28, 0), colorRgb: abyssTitanium });
  out.energy.push({ geo: dampingWave, matrix: makeTransform(0, 0.24, 0), colorRgb: tidalTeal });

  const gravCone = trackGeo(out, createLathePart([[0.30, 0.0], [0.22, 0.18], [0.16, 0.38]], 14));
  out.crystal.push({
    geo: gravCone,
    matrix: makeTransform(0, 0.28, 0),
    colorRgb: [0.24, 0.86, 0.94],
  });

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.64, 0.012, 6, 24));
  wingRing.rotateX(Math.PI * 0.5);
  out.wingParts.push({ geo: wingRing, matrix: buoyTilt });

  out.crystalHex = 0x2dd4bf;
  out.crystalOpacity = 0.50;
  out.crystalIntensity = 0.56;
  out.weaponGlowHex = 0x22d3ee;
  out.headTopLocalY = 1.54;
};

const buildS07: BespokeUnitBuilder = (_ctx, out) => {
  const platinumSilver: RgbTriple = [0.93, 0.96, 1.0];
  const obsSlate: RgbTriple = [0.15, 0.20, 0.30];
  const equatorialGold: RgbTriple = [0.98, 0.82, 0.42];
  const starIndigo: RgbTriple = [0.48, 0.62, 1.0];
  const holoViolet: RgbTriple = [0.68, 0.52, 1.0];

  const centerY = 0.96;
  const scopeRoot = makeTransform(0, centerY, -0.02, -0.22, 0.16, 0.04);

  const mirrorProfile: readonly (readonly [number, number])[] = [
    [0.012, 0.0],
    [0.10, 0.012],
    [0.21, 0.044],
    [0.31, 0.092],
    [0.37, 0.145],
  ];
  const primaryMirror = trackGeo(out, createLathePart(mirrorProfile, 26));
  out.armor.push({
    geo: primaryMirror,
    matrix: scopeRoot.clone().multiply(makeTransform(0, 0, -0.04, Math.PI * 0.5, 0, 0)),
    colorRgb: platinumSilver,
  });

  const mirrorRim = trackGeo(out, new THREE.TorusGeometry(0.372, 0.014, 7, 28));
  const mirrorInnerRing = trackGeo(out, new THREE.TorusGeometry(0.21, 0.007, 5, 22));
  out.trim.push(
    { geo: mirrorRim, matrix: scopeRoot.clone().multiply(makeTransform(0, 0, 0.105)), colorRgb: equatorialGold },
    { geo: mirrorInnerRing, matrix: scopeRoot.clone().multiply(makeTransform(0, 0, 0.018)), colorRgb: equatorialGold },
  );

  const backBaffle = trackGeo(
    out,
    createLathePart(
      [
        [0.015, -0.26],
        [0.095, -0.22],
        [0.185, -0.12],
        [0.29, -0.02],
        [0.34, 0.02],
      ],
      20,
    ),
  );
  out.matte.push({
    geo: backBaffle,
    matrix: scopeRoot.clone().multiply(makeTransform(0, 0, -0.05, Math.PI * 0.5, 0, 0)),
    colorRgb: obsSlate,
  });

  const radFin = trackGeo(out, createCreatureFin(0.14, 0.22, 0.10, 0.014, 0.012, 8, 4, platinumSilver, obsSlate));
  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    out.armor.push({
      geo: radFin,
      matrix: scopeRoot.clone().multiply(makeTransform(Math.cos(a) * 0.16, Math.sin(a) * 0.16, -0.18, Math.PI * 0.5, 0, a)),
    });
  }

  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI * 0.5;
    const strut = trackGeo(
      out,
      createOrganicLimb(
        [
          [Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0.09],
          [Math.cos(a) * 0.18, Math.sin(a) * 0.18, 0.28],
          [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.42],
        ],
        0.010,
        0.008,
        0.006,
        10,
        6,
      ),
    );
    out.matte.push({ geo: strut, matrix: scopeRoot, colorRgb: obsSlate });
  }

  const secPod = trackGeo(out, createTeardropPart(0.12, 0.052, 1.2, 12, 10, 0));
  const focalStar = trackGeo(out, new THREE.OctahedronGeometry(0.042, 1));
  out.trim.push({
    geo: secPod,
    matrix: scopeRoot.clone().multiply(makeTransform(0, 0, 0.43, -Math.PI * 0.5, 0, 0)),
    colorRgb: equatorialGold,
  });
  out.energy.push({
    geo: focalStar,
    matrix: scopeRoot.clone().multiply(makeTransform(0, 0, 0.36)),
    colorRgb: [0.84, 0.92, 1.0],
  });

  const focusCone = trackGeo(out, createLathePart([[0.28, 0.0], [0.14, 0.18], [0.03, 0.35]], 16));
  out.crystal.push({
    geo: focusCone,
    matrix: scopeRoot.clone().multiply(makeTransform(0, 0, 0.01, Math.PI * 0.5, 0, 0)),
    colorRgb: starIndigo,
  });

  const eqRingA = trackGeo(out, new THREE.TorusGeometry(0.54, 0.015, 7, 30));
  const eqRingB = trackGeo(out, new THREE.TorusGeometry(0.60, 0.011, 6, 30));
  const eqMatA = makeTransform(0, centerY, -0.02, 0.54, 0.32, -0.18);
  const eqMatB = makeTransform(0, centerY, -0.02, -0.44, -0.58, 0.36);
  out.trim.push(
    { geo: eqRingA, matrix: eqMatA, colorRgb: equatorialGold },
    { geo: eqRingB, matrix: eqMatB, colorRgb: equatorialGold },
  );

  const gradTick = trackGeo(out, new THREE.SphereGeometry(0.016, 7, 5));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    out.armor.push({
      geo: gradTick,
      matrix: eqMatA.clone().multiply(makeTransform(Math.cos(a) * 0.54, Math.sin(a) * 0.54, 0)),
      colorRgb: platinumSilver,
    });
  }

  const orbGlass = trackGeo(out, new THREE.SphereGeometry(0.118, 14, 10));
  const orbCore = trackGeo(out, new THREE.OctahedronGeometry(0.048, 0));
  const orbInnerGrid = trackGeo(out, new THREE.TorusGeometry(0.088, 0.005, 5, 16));
  const orbRing = trackGeo(out, new THREE.TorusGeometry(0.142, 0.006, 5, 18));

  const keplerOrbs: readonly {
    readonly pos: Vec3Tuple;
    readonly rot: Vec3Tuple;
    readonly scale: number;
    readonly tint: RgbTriple;
  }[] = [
    { pos: [-0.46, centerY + 0.24, 0.24], rot: [0.6, 0.4, 0.2], scale: 1.0, tint: [0.46, 0.68, 1.0] },
    { pos: [0.48, centerY + 0.08, 0.28], rot: [-0.5, 0.7, -0.3], scale: 0.94, tint: [0.70, 0.50, 1.0] },
    { pos: [-0.08, centerY - 0.34, 0.42], rot: [0.8, -0.3, 0.5], scale: 0.88, tint: [0.54, 0.78, 1.0] },
  ];

  for (const orb of keplerOrbs) {
    const om = makeTransform(orb.pos[0], orb.pos[1], orb.pos[2], orb.rot[0], orb.rot[1], orb.rot[2], orb.scale, orb.scale, orb.scale);
    out.crystal.push({ geo: orbGlass, matrix: om, colorRgb: orb.tint });
    out.energy.push(
      { geo: orbCore, matrix: om, colorRgb: [0.88, 0.94, 1.0] },
      { geo: orbInnerGrid, matrix: om.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)), colorRgb: orb.tint },
    );
    out.trim.push({ geo: orbRing, matrix: om, colorRgb: equatorialGold });
  }

  const keplerTrack = trackGeo(
    out,
    createTubePart(
      [
        [-0.46, centerY + 0.24, 0.24],
        [0.08, centerY + 0.38, -0.26],
        [0.48, centerY + 0.08, 0.28],
        [-0.08, centerY - 0.34, 0.42],
      ],
      0.0045,
      26,
      5,
      true,
    ),
  );
  out.energy.push({ geo: keplerTrack, colorRgb: holoViolet });

  const gyroPod = trackGeo(out, createTeardropPart(0.24, 0.086, 1.25, 14, 10, 0, obsSlate, platinumSilver));
  const baseHalo = trackGeo(out, new THREE.TorusGeometry(0.22, 0.008, 6, 22));
  baseHalo.rotateX(Math.PI * 0.5);
  out.armor.push({ geo: gyroPod, matrix: makeTransform(0, 0.34, -0.02, Math.PI, 0, 0) });
  out.energy.push({ geo: baseHalo, matrix: makeTransform(0, 0.22, -0.02), colorRgb: starIndigo });

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.70, 0.010, 6, 26));
  out.wingParts.push({ geo: wingRing, matrix: makeTransform(0, centerY, -0.02, 0.36, -0.24, 0) });

  out.crystalHex = 0x6366f1;
  out.crystalOpacity = 0.52;
  out.crystalIntensity = 0.62;
  out.weaponGlowHex = 0x818cf8;
  out.headTopLocalY = 1.62;
};

const buildS08: BespokeUnitBuilder = (_ctx, out) => {
  const stealthTitanium: RgbTriple = [0.24, 0.29, 0.40];
  const carbonObsidian: RgbTriple = [0.12, 0.15, 0.22];
  const edgeSilver: RgbTriple = [0.78, 0.84, 0.94];
  const roseChrome: RgbTriple = [0.92, 0.72, 0.58];
  const warpMagenta: RgbTriple = [0.98, 0.34, 0.88];
  const warpViolet: RgbTriple = [0.64, 0.24, 1.0];

  const dart = makeTransform(0.0, 0.90, 0.04, -0.20, -0.34, 0.46);

  const hullMain = trackGeo(out, createTeardropPart(1.18, 0.155, 1.58, 12, 14, 0.008, carbonObsidian, stealthTitanium));
  out.armor.push({
    geo: hullMain,
    matrix: dart.clone().multiply(makeTransform(0, 0, 0.02, Math.PI * 0.5, 0, 0, 1.24, 1.0, 0.46)),
  });

  const dorsalChine = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0, -0.44],
        [0.095, -0.14],
        [0.056, 0.28],
        [0, 0.50],
        [-0.056, 0.28],
        [-0.095, -0.14],
      ],
      0.036,
      0.010,
      0.010,
      1,
      2,
    ),
  );
  out.matte.push({
    geo: dorsalChine,
    matrix: dart.clone().multiply(makeTransform(0, 0.048, -0.02, Math.PI * 0.5, 0, 0)),
    colorRgb: carbonObsidian,
  });

  const engineNacelle = trackGeo(out, createTeardropPart(0.56, 0.058, 1.38, 12, 10, 0, carbonObsidian, stealthTitanium));
  const ventralKeel = trackGeo(out, createCreatureFin(0.28, 0.18, 0.14, 0.012, 0.014, 8, 4, carbonObsidian, stealthTitanium));
  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: engineNacelle,
      matrix: dart.clone().multiply(makeTransform(side * 0.086, 0.016, -0.18, Math.PI * 0.5, 0, 0, 1.0, 1.0, 0.72)),
    });
  }
  out.matte.push({
    geo: ventralKeel,
    matrix: dart.clone().multiply(makeTransform(0, -0.055, -0.10, 0, 0, -Math.PI * 0.5)),
  });

  const dorsalFin = trackGeo(out, createCreatureFin(0.22, 0.28, 0.18, 0.018, 0.012, 10, 5, stealthTitanium, edgeSilver));
  out.armor.push({
    geo: dorsalFin,
    matrix: dart.clone().multiply(makeTransform(0, 0.06, -0.22, 0, 0, Math.PI * 0.5)),
  });

  const wingStealth = trackGeo(out, createCreatureFin(0.36, 0.64, 0.40, 0.034, 0.018, 12, 6, carbonObsidian, stealthTitanium));
  const plasmaBladeCrystal = trackGeo(out, createCreatureFin(0.30, 0.74, 0.48, 0.036, 0.008, 12, 6, warpMagenta, warpViolet));
  const bladeEdgeGlow = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.10, 0.0, 0.20],
        [0.44, 0.022, -0.04],
        [0.76, 0.016, -0.32],
      ],
      0.013,
      0.011,
      0.006,
      12,
      6,
    ),
  );
  const wingTrimSpar = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.10, 0.014, 0.06],
        [0.36, 0.028, -0.12],
        [0.62, 0.018, -0.30],
      ],
      0.011,
      0.008,
      0.004,
      10,
      6,
    ),
  );

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: wingStealth,
      matrix: dart.clone().multiply(makeTransform(side * 0.08, 0.0, 0.04, 0, 0, side * -0.06, side, 1, 1)),
    });
    out.crystal.push({
      geo: plasmaBladeCrystal,
      matrix: dart.clone().multiply(makeTransform(side * 0.12, 0.002, 0.08, 0, 0, side * -0.06, side, 1, 1)),
    });
    out.energy.push({
      geo: bladeEdgeGlow,
      matrix: dart.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
      colorRgb: warpMagenta,
    });
    out.trim.push({
      geo: wingTrimSpar,
      matrix: dart.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
      colorRgb: roseChrome,
    });
  }

  const prongGeo = trackGeo(out, createCurvedBladePart(0.28, 0.028, 0.011, -0.022, 0.010, 6));
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI * 0.5;
    out.trim.push({
      geo: prongGeo,
      matrix: dart
        .clone()
        .multiply(makeTransform(Math.cos(a) * 0.048, Math.sin(a) * 0.048, 0.44, Math.PI * 0.5, 0, a - Math.PI * 0.5)),
      colorRgb: roseChrome,
    });
  }

  const antimatterCore = trackGeo(out, new THREE.OctahedronGeometry(0.040, 1));
  const pinchRing = trackGeo(out, new THREE.TorusGeometry(0.056, 0.007, 6, 16));
  out.energy.push(
    { geo: antimatterCore, matrix: dart.clone().multiply(makeTransform(0, 0, 0.62)), colorRgb: [1.0, 0.82, 1.0] },
    { geo: pinchRing, matrix: dart.clone().multiply(makeTransform(0, 0, 0.56)), colorRgb: warpMagenta },
  );

  const pinchCone = trackGeo(
    out,
    createLathePart(
      [
        [0.068, 0.0],
        [0.048, 0.14],
        [0.020, 0.28],
        [0.003, 0.40],
      ],
      14,
    ),
  );
  out.crystal.push({
    geo: pinchCone,
    matrix: dart.clone().multiply(makeTransform(0, 0, 0.44, Math.PI * 0.5, 0, 0)),
    colorRgb: warpViolet,
  });

  const nozzleRing = trackGeo(out, new THREE.TorusGeometry(0.046, 0.010, 6, 16));
  const jetCore = trackGeo(out, createTeardropPart(0.32, 0.034, 1.55, 12, 10, 0));
  for (const side of [-1, 1] as const) {
    out.trim.push({
      geo: nozzleRing,
      matrix: dart.clone().multiply(makeTransform(side * 0.072, 0.01, -0.46)),
      colorRgb: roseChrome,
    });
    out.energy.push({
      geo: jetCore,
      matrix: dart.clone().multiply(makeTransform(side * 0.072, 0.01, -0.60, -Math.PI * 0.5, 0, 0)),
      colorRgb: warpMagenta,
    });

    const wakePts: Vec3Tuple[] = [];
    for (let k = 0; k <= 6; k += 1) {
      const f = k / 6;
      wakePts.push([side * (0.072 + Math.sin(f * Math.PI * 1.4) * 0.032), Math.cos(f * Math.PI * 1.4) * 0.028 * side, -0.48 - f * 0.44]);
    }
    const wakeRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(wakePts, [0.040, 0.026, 0.006], 0.006, 1.5, 14, 3, 0, warpMagenta, warpViolet),
    );
    out.crystal.push({ geo: wakeRibbon, matrix: dart });
  }

  const hoverTrace = trackGeo(out, new THREE.TorusGeometry(0.28, 0.008, 6, 22));
  hoverTrace.rotateX(Math.PI * 0.5);
  out.energy.push({ geo: hoverTrace, matrix: makeTransform(0, 0.14, 0), colorRgb: warpViolet });

  addOrbitalWingFin(out, -0.42, 0.96, -0.18, -1);
  addOrbitalWingFin(out, 0.42, 0.96, -0.18, 1);

  out.crystalHex = 0xc026d3;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.66;
  out.weaponGlowHex = 0xe879f9;
  out.headTopLocalY = 1.48;
};

const buildS09: BespokeUnitBuilder = (_ctx, out) => {
  const railSilver: RgbTriple = [0.84, 0.89, 0.97];
  const cryoSlate: RgbTriple = [0.15, 0.19, 0.28];
  const busbarGold: RgbTriple = [0.96, 0.78, 0.40];
  const arcCyan: RgbTriple = [0.38, 0.94, 1.0];
  const coilViolet: RgbTriple = [0.64, 0.44, 1.0];

  const turret = makeTransform(0.0, 0.86, 0.02, -0.22, -0.34, 0.0);

  const railBeam = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.028, -0.042],
        [0.028, -0.042],
        [0.020, 0.042],
        [-0.020, 0.042],
      ],
      1.18,
      0.008,
      0.008,
      1,
      2,
    ),
  );
  const railTip = trackGeo(out, createCurvedBladePart(0.22, 0.072, 0.024, 0.0, 0.008, 5));
  const railShroud = trackGeo(out, createTeardropPart(1.18, 0.042, 1.35, 12, 10, 0, cryoSlate, railSilver));
  const busbarStrip = trackGeo(out, createOrganicLimb([[0, 0, -0.52], [0, 0, 0.66]], 0.011, 0.010, 0.008, 8, 5));

  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: railBeam,
      matrix: turret.clone().multiply(makeTransform(side * 0.095, 0.0, 0.06)),
      colorRgb: railSilver,
    });
    out.armor.push({
      geo: railTip,
      matrix: turret.clone().multiply(makeTransform(side * 0.095, 0.0, 0.64, Math.PI * 0.5, 0, Math.PI * 0.5)),
      colorRgb: railSilver,
    });
    out.matte.push({
      geo: railShroud,
      matrix: turret.clone().multiply(makeTransform(side * 0.118, 0.0, 0.04, Math.PI * 0.5, 0, 0, 0.72, 1.0, 1.15)),
    });
    out.trim.push({
      geo: busbarStrip,
      matrix: turret.clone().multiply(makeTransform(side * 0.064, 0.0, 0.06)),
      colorRgb: busbarGold,
    });
  }

  const breechCore = trackGeo(out, createTeardropPart(0.42, 0.125, 1.22, 12, 10, 0, cryoSlate, railSilver));
  out.armor.push({
    geo: breechCore,
    matrix: turret.clone().multiply(makeTransform(0, 0, -0.34, -Math.PI * 0.5, 0, 0, 1.15, 1.0, 0.85)),
  });

  const capPod = trackGeo(out, createTeardropPart(0.36, 0.062, 1.28, 12, 10, 0));
  const capHose = trackGeo(
    out,
    createTubePart(
      [
        [0.14, -0.02, -0.44],
        [0.20, -0.06, -0.30],
        [0.15, -0.02, -0.14],
      ],
      0.010,
      8,
      5,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.matte.push({
      geo: capPod,
      matrix: turret.clone().multiply(makeTransform(side * 0.16, -0.02, -0.36, Math.PI * 0.5, 0, 0)),
      colorRgb: cryoSlate,
    });
    out.trim.push({
      geo: capHose,
      matrix: turret.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
      colorRgb: busbarGold,
    });
  }

  const coilOuter = trackGeo(out, new THREE.TorusGeometry(0.165, 0.018, 6, 16));
  const coilTrim = trackGeo(out, new THREE.TorusGeometry(0.184, 0.007, 5, 14));
  const coilGlow = trackGeo(out, new THREE.TorusGeometry(0.136, 0.011, 5, 14));
  const coilGlass = trackGeo(out, new THREE.TorusGeometry(0.152, 0.009, 5, 14));

  const coilZs = [-0.22, -0.02, 0.18, 0.38, 0.56];
  for (let i = 0; i < coilZs.length; i += 1) {
    const z = coilZs[i]!;
    const sc = 1.04 - i * 0.055;
    const cm = turret.clone().multiply(makeTransform(0, 0, z, 0, 0, 0, sc, sc, 1.0));
    out.armor.push({ geo: coilOuter, matrix: cm, colorRgb: railSilver });
    out.trim.push({ geo: coilTrim, matrix: cm, colorRgb: busbarGold });
    out.energy.push({
      geo: coilGlow,
      matrix: cm,
      colorRgb: i % 2 === 0 ? arcCyan : coilViolet,
    });
    out.crystal.push({
      geo: coilGlass,
      matrix: cm.clone().multiply(makeTransform(0, 0, 0.018)),
      colorRgb: i % 2 === 0 ? coilViolet : arcCyan,
    });
  }

  const centerArc = trackGeo(out, createOrganicLimb([[0, 0, -0.26], [0, 0, 0.88]], 0.015, 0.019, 0.008, 10, 5));
  const muzzleCharge = trackGeo(out, new THREE.OctahedronGeometry(0.044, 1));
  out.energy.push(
    { geo: centerArc, matrix: turret, colorRgb: [0.84, 0.98, 1.0] },
    { geo: muzzleCharge, matrix: turret.clone().multiply(makeTransform(0, 0, 0.72)), colorRgb: arcCyan },
  );

  const helixPts: Vec3Tuple[] = [];
  for (let k = 0; k <= 10; k += 1) {
    const f = k / 10;
    const a = f * Math.PI * 3.0;
    helixPts.push([Math.cos(a) * 0.044, Math.sin(a) * 0.044, -0.18 + f * 0.96]);
  }
  const arcHelix = trackGeo(out, createFlowingRibbonMesh(helixPts, [0.024, 0.020, 0.006], 0.005, 1.6, 16, 3, 0, coilViolet, arcCyan));
  out.crystal.push({ geo: arcHelix, matrix: turret });

  const ionSheath = trackGeo(
    out,
    createLathePart(
      [
        [0.056, -0.24],
        [0.062, 0.24],
        [0.048, 0.68],
        [0.010, 0.92],
      ],
      12,
    ),
  );
  out.crystal.push({
    geo: ionSheath,
    matrix: turret.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
    colorRgb: [0.54, 0.72, 1.0],
  });

  const gyroOuter = trackGeo(out, new THREE.TorusGeometry(0.38, 0.026, 6, 22));
  gyroOuter.rotateX(Math.PI * 0.5);
  const gyroInner = trackGeo(out, new THREE.TorusGeometry(0.24, 0.018, 6, 18));
  gyroInner.rotateX(Math.PI * 0.5);
  const gyroGold = trackGeo(out, new THREE.TorusGeometry(0.41, 0.009, 5, 20));
  gyroGold.rotateX(Math.PI * 0.5);
  const hoverRing = trackGeo(out, new THREE.TorusGeometry(0.32, 0.009, 5, 20));
  hoverRing.rotateX(Math.PI * 0.5);

  out.armor.push({ geo: gyroOuter, matrix: makeTransform(0, 0.34, 0), colorRgb: railSilver });
  out.matte.push({ geo: gyroInner, matrix: makeTransform(0, 0.42, 0), colorRgb: cryoSlate });
  out.trim.push({ geo: gyroGold, matrix: makeTransform(0, 0.34, 0), colorRgb: busbarGold });
  out.energy.push({ geo: hoverRing, matrix: makeTransform(0, 0.22, 0), colorRgb: arcCyan });

  const cradleArm = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.24, 0.42, 0],
        [0.20, 0.62, 0],
        [0.12, 0.80, 0],
      ],
      0.022,
      0.018,
      0.015,
      8,
      6,
    ),
  );
  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    out.matte.push({ geo: cradleArm, matrix: makeTransform(0, 0, 0, 0, a, 0), colorRgb: cryoSlate });
  }

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.54, 0.012, 6, 24));
  wingRing.rotateX(Math.PI * 0.5);
  out.wingParts.push({ geo: wingRing, matrix: makeTransform(0, 0.36, 0) });

  out.crystalHex = 0x818cf8;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.60;
  out.weaponGlowHex = 0x38bdf8;
  out.headTopLocalY = 1.44;
};

const buildS10: BespokeUnitBuilder = (_ctx, out) => {
  const ceramicWhite: RgbTriple = [0.94, 0.96, 1.0];
  const basaltSlate: RgbTriple = [0.16, 0.20, 0.28];
  const dysonGold: RgbTriple = [0.99, 0.82, 0.38];
  const moltenCore: RgbTriple = [1.0, 0.95, 0.72];
  const moltenAmber: RgbTriple = [1.0, 0.68, 0.18];

  const centerY = 0.94;
  const ringTilt = makeTransform(0, centerY, 0, -0.46, 0.20, -0.14);

  const trackRailFront = trackGeo(out, new THREE.TorusGeometry(0.50, 0.026, 8, 30));
  const trackRailBack = trackGeo(out, new THREE.TorusGeometry(0.50, 0.026, 8, 30));
  const outerCasing = trackGeo(out, new THREE.TorusGeometry(0.545, 0.022, 7, 30));
  const plasmaTrack = trackGeo(out, new THREE.TorusGeometry(0.465, 0.013, 6, 28));

  out.trim.push(
    { geo: trackRailFront, matrix: ringTilt.clone().multiply(makeTransform(0, 0, 0.044)), colorRgb: dysonGold },
    { geo: trackRailBack, matrix: ringTilt.clone().multiply(makeTransform(0, 0, -0.044)), colorRgb: dysonGold },
  );
  out.armor.push({ geo: outerCasing, matrix: ringTilt, colorRgb: ceramicWhite });
  out.energy.push({ geo: plasmaTrack, matrix: ringTilt, colorRgb: moltenAmber });

  const statorClamp = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.042, -0.050],
        [0.042, -0.050],
        [0.034, 0.056],
        [-0.034, 0.056],
      ],
      0.130,
      0.008,
      0.008,
      1,
      2,
    ),
  );
  const statorNode = trackGeo(out, new THREE.SphereGeometry(0.018, 8, 6));
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const sm = ringTilt.clone().multiply(makeTransform(Math.cos(a) * 0.525, Math.sin(a) * 0.525, 0, 0, 0, a - Math.PI * 0.5));
    out.matte.push({ geo: statorClamp, matrix: sm, colorRgb: basaltSlate });
    out.energy.push({
      geo: statorNode,
      matrix: ringTilt.clone().multiply(makeTransform(Math.cos(a) * 0.46, Math.sin(a) * 0.46, 0)),
      colorRgb: moltenCore,
    });
  }

  const chuteRail = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.12, 0.50, 0.0],
        [0.36, 0.54, 0.10],
        [0.62, 0.58, 0.24],
      ],
      0.018,
      0.015,
      0.011,
      10,
      6,
    ),
  );
  for (const dz of [-0.044, 0.044]) {
    out.trim.push({
      geo: chuteRail,
      matrix: ringTilt.clone().multiply(makeTransform(0, 0, dz)),
      colorRgb: dysonGold,
    });
  }
  const chuteGlow = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.14, 0.49, 0.0],
        [0.38, 0.53, 0.10],
        [0.64, 0.57, 0.24],
      ],
      0.011,
      0.013,
      0.007,
      8,
      6,
    ),
  );
  out.energy.push({ geo: chuteGlow, matrix: ringTilt, colorRgb: moltenCore });

  const projSphere = trackGeo(out, new THREE.SphereGeometry(0.165, 16, 12));
  const projAura = trackGeo(out, new THREE.SphereGeometry(0.245, 16, 12));
  const containmentRing = trackGeo(out, new THREE.TorusGeometry(0.275, 0.011, 6, 24));
  out.energy.push({ geo: projSphere, matrix: ringTilt, colorRgb: moltenCore });
  out.crystal.push({
    geo: projAura,
    matrix: ringTilt,
    colorRgb: [1.0, 0.80, 0.30],
  });
  out.trim.push({
    geo: containmentRing,
    matrix: ringTilt.clone().multiply(makeTransform(0, 0, 0, 0.42, 0.36, 0)),
    colorRgb: dysonGold,
  });

  for (const phase of [0, Math.PI]) {
    const fluxPts: Vec3Tuple[] = [];
    for (let k = 0; k <= 8; k += 1) {
      const f = k / 8;
      const a = phase + f * Math.PI * 1.8;
      const r = 0.20 + Math.sin(f * Math.PI) * 0.13;
      fluxPts.push([Math.cos(a) * r, Math.sin(a) * r, (f - 0.5) * 0.22]);
    }
    const fluxRibbon = trackGeo(
      out,
      createFlowingRibbonMesh(fluxPts, [0.036, 0.028, 0.008], 0.006, 1.5, 16, 3, 0, moltenCore, moltenAmber),
    );
    out.crystal.push({ geo: fluxRibbon, matrix: ringTilt });
  }

  const radWing = trackGeo(out, createCreatureFin(0.26, 0.38, 0.18, 0.026, 0.018, 10, 5, ceramicWhite, basaltSlate));
  const heatVane = trackGeo(out, createCreatureFin(0.20, 0.42, 0.22, 0.028, 0.008, 10, 5, moltenAmber, moltenCore));
  const heatPipe = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.52, 0.0, 0.0],
        [0.72, 0.04, 0.02],
        [0.90, 0.06, -0.06],
      ],
      0.014,
      0.011,
      0.006,
      10,
      6,
    ),
  );
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: radWing,
      matrix: ringTilt.clone().multiply(makeTransform(side * 0.52, 0, 0, 0.88, 0, side * 0.08, side, 1, 1)),
    });
    out.crystal.push({
      geo: heatVane,
      matrix: ringTilt.clone().multiply(makeTransform(side * 0.54, -0.02, 0.02, 0.88, 0, side * 0.08, side, 1, 1)),
    });
    out.trim.push({
      geo: heatPipe,
      matrix: ringTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1)),
      colorRgb: dysonGold,
    });
  }

  const baseRing = trackGeo(out, new THREE.TorusGeometry(0.35, 0.024, 7, 24));
  baseRing.rotateX(Math.PI * 0.5);
  const baseGold = trackGeo(out, new THREE.TorusGeometry(0.38, 0.009, 5, 22));
  baseGold.rotateX(Math.PI * 0.5);
  const supportArm = trackGeo(
    out,
    createOrganicLimb(
      [
        [0.33, 0.24, 0],
        [0.42, 0.52, 0.02],
        [0.48, 0.80, 0.06],
      ],
      0.022,
      0.018,
      0.016,
      10,
      6,
    ),
  );
  out.matte.push({ geo: baseRing, matrix: makeTransform(0, 0.22, 0), colorRgb: basaltSlate });
  out.trim.push({ geo: baseGold, matrix: makeTransform(0, 0.22, 0), colorRgb: dysonGold });
  for (const side of [-1, 1] as const) {
    out.armor.push({
      geo: supportArm,
      matrix: makeTransform(0, 0, 0, 0, 0, 0, side, 1, 1),
      colorRgb: ceramicWhite,
    });
  }

  const wingRing = trackGeo(out, new THREE.TorusGeometry(0.66, 0.012, 6, 26));
  out.wingParts.push({ geo: wingRing, matrix: ringTilt });

  out.crystalHex = 0xfbbf24;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.62;
  out.weaponGlowHex = 0xf59e0b;
  out.headTopLocalY = 1.62;
};

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
