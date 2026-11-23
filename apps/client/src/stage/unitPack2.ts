import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createChamferedHexPart,
  createCreatureFin,
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
  type Vec3Tuple,
} from './unitBuilderCore.js';

function createChamferPlate(
  width: number,
  height: number,
  depth: number,
  cutX = 0.22,
  cutY = 0.22,
  bevel = 0.012,
): THREE.BufferGeometry {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const cx = hw * Math.max(0.05, Math.min(0.45, cutX));
  const cy = hh * Math.max(0.05, Math.min(0.45, cutY));
  return createBevelExtrudePart(
    [
      [-hw + cx, -hh],
      [hw - cx, -hh],
      [hw, -hh + cy],
      [hw, hh - cy],
      [hw - cx, hh],
      [-hw + cx, hh],
      [-hw, hh - cy],
      [-hw, -hh + cy],
    ],
    depth,
    bevel,
    bevel,
    2,
    4,
  );
}

function createTrapezoidPlate(
  topW: number,
  botW: number,
  height: number,
  depth: number,
  bevel = 0.012,
): THREE.BufferGeometry {
  const tw = topW * 0.5;
  const bw = botW * 0.5;
  const hh = height * 0.5;
  return createBevelExtrudePart(
    [
      [-bw, -hh],
      [bw, -hh],
      [tw, hh],
      [-tw, hh],
    ],
    depth,
    bevel,
    bevel,
    2,
    4,
  );
}

function addThrusterPod(
  out: UnitBlueprintParts,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
  radius: number,
  length: number,
  housingColor: RgbTriple,
  trimColor: RgbTriple,
  glowColor: RgbTriple,
): void {
  const nozzleGeo = trackGeo(
    out,
    createLathePart(
      [
        [radius * 0.78, -length * 0.5],
        [radius * 1.06, -length * 0.20],
        [radius * 0.96, length * 0.26],
        [radius * 0.68, length * 0.5],
      ],
      14,
    ),
  );
  nozzleGeo.rotateX(Math.PI * 0.5);

  const lipGeo = trackGeo(out, new THREE.TorusGeometry(radius * 0.88, radius * 0.14, 8, 16));
  const flameGeo = trackGeo(out, new THREE.ConeGeometry(radius * 0.62, length * 0.86, 12));
  flameGeo.rotateX(-Math.PI * 0.5);

  const baseMat = makeTransform(x, y, z, rx, ry, rz);
  const lipOffset = new THREE.Matrix4().makeTranslation(0, 0, -length * 0.42);
  const flameOffset = new THREE.Matrix4().makeTranslation(0, 0, -length * 0.74);

  out.matte.push({ geo: nozzleGeo, matrix: baseMat, colorRgb: housingColor });
  out.trim.push({ geo: lipGeo, matrix: baseMat.clone().multiply(lipOffset), colorRgb: trimColor });
  out.energy.push({ geo: flameGeo, matrix: baseMat.clone().multiply(flameOffset), colorRgb: glowColor });
}

function addTrussStrut(
  out: UnitBlueprintParts,
  start: Vec3Tuple,
  end: Vec3Tuple,
  radius: number,
  bucket: 'armor' | 'matte' | 'trim' | 'energy',
  colorRgb: RgbTriple,
  segs = 8,
): void {
  const cyl = trackGeo(out, new THREE.CylinderGeometry(radius, radius, 1.0, segs));
  const m = makeSegmentTransform(
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
    1,
    1,
  );
  out[bucket].push({ geo: cyl, matrix: m, colorRgb });
}

export const UNIT_PACK_2_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S11: (_ctx, out) => {
    const whiteCeramic: RgbTriple = [0.92, 0.95, 0.99];
    const mistCeramic: RgbTriple = [0.78, 0.85, 0.93];
    const darkSlate: RgbTriple = [0.18, 0.23, 0.32];
    const paleGold: RgbTriple = [0.85, 0.78, 0.58];
    const cyanGlow: RgbTriple = [0.74, 0.96, 1.0];
    const shieldCrystal: RgbTriple = [0.44, 0.88, 0.99];

    const yCore = 0.88;
    const zCore = -0.10;

    const octHullGeo = trackGeo(out, createChamferPlate(0.56, 0.56, 0.46, 0.30, 0.30, 0.022));
    octHullGeo.rotateX(Math.PI * 0.5);
    const upperCapGeo = trackGeo(out, createChamferPlate(0.46, 0.46, 0.16, 0.30, 0.30, 0.016));
    upperCapGeo.rotateX(Math.PI * 0.5);
    const lowerCapGeo = trackGeo(out, createChamferPlate(0.44, 0.44, 0.16, 0.30, 0.30, 0.016));
    lowerCapGeo.rotateX(Math.PI * 0.5);
    const collarBandGeo = trackGeo(out, new THREE.TorusGeometry(0.31, 0.024, 8, 8));
    collarBandGeo.rotateX(Math.PI * 0.5);
    const dockingRingGeo = trackGeo(out, new THREE.CylinderGeometry(0.14, 0.18, 0.16, 12));
    const ventralGyroGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.04, -0.24],
          [0.14, -0.16],
          [0.20, -0.04],
          [0.16, 0.04],
        ],
        14,
      ),
    );
    const ventralRingGeo = trackGeo(out, new THREE.TorusGeometry(0.17, 0.020, 8, 20));
    ventralRingGeo.rotateX(Math.PI * 0.5);

    const commsDomeGeo = trackGeo(out, new THREE.SphereGeometry(0.125, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56));
    const antennaMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.024, 0.24, 8));
    const whipAntennaGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.012, 0.22, 6));
    const antennaDishGeo = trackGeo(out, new THREE.ConeGeometry(0.11, 0.06, 14, 1, true));
    antennaDishGeo.rotateX(-Math.PI * 0.35);

    out.armor.push(
      { geo: octHullGeo, matrix: makeTransform(0, yCore, zCore), colorRgb: whiteCeramic },
      { geo: upperCapGeo, matrix: makeTransform(0, yCore + 0.28, zCore), colorRgb: mistCeramic },
      { geo: lowerCapGeo, matrix: makeTransform(0, yCore - 0.28, zCore), colorRgb: mistCeramic },
    );
    out.matte.push(
      { geo: dockingRingGeo, matrix: makeTransform(0, yCore + 0.38, zCore), colorRgb: darkSlate },
      { geo: ventralGyroGeo, matrix: makeTransform(0, yCore - 0.38, zCore), colorRgb: darkSlate },
      { geo: commsDomeGeo, matrix: makeTransform(0, yCore + 0.42, zCore), colorRgb: darkSlate },
    );
    out.trim.push(
      { geo: collarBandGeo, matrix: makeTransform(0, yCore + 0.14, zCore, 0, Math.PI * 0.125, 0), colorRgb: paleGold },
      { geo: collarBandGeo, matrix: makeTransform(0, yCore - 0.14, zCore, 0, Math.PI * 0.125, 0), colorRgb: paleGold },
      { geo: antennaMastGeo, matrix: makeTransform(0, yCore + 0.56, zCore - 0.02), colorRgb: paleGold },
      { geo: antennaDishGeo, matrix: makeTransform(0, yCore + 0.56, zCore + 0.08), colorRgb: paleGold },
      { geo: whipAntennaGeo, matrix: makeTransform(-0.14, yCore + 0.46, zCore - 0.10, -0.15, 0, 0.18), colorRgb: paleGold },
      { geo: whipAntennaGeo, matrix: makeTransform(0.14, yCore + 0.46, zCore - 0.10, -0.15, 0, -0.18), colorRgb: paleGold },
    );
    out.energy.push({ geo: ventralRingGeo, matrix: makeTransform(0, yCore - 0.48, zCore), colorRgb: cyanGlow });

    const rcsPodGeo = trackGeo(out, createChamferPlate(0.08, 0.08, 0.09, 0.25, 0.25, 0.008));
    for (const ang of [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25]) {
      out.matte.push({
        geo: rcsPodGeo,
        matrix: makeTransform(Math.sin(ang) * 0.27, yCore + 0.26, zCore + Math.cos(ang) * 0.27, 0, ang, 0),
        colorRgb: darkSlate,
      });
    }

    const sideHatchGeo = trackGeo(out, createChamferedHexPart(0.13, 0.06, 0.012, 0.06));
    const sideCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.055, 0.055, 0.05, 12));
    sideCoreGeo.rotateZ(Math.PI * 0.5);
    for (const side of [-1, 1] as const) {
      out.trim.push({
        geo: sideHatchGeo,
        matrix: makeTransform(side * 0.30, yCore, zCore, 0, Math.PI * 0.5, 0),
        colorRgb: paleGold,
      });
      out.energy.push({
        geo: sideCoreGeo,
        matrix: makeTransform(side * 0.31, yCore, zCore),
        colorRgb: cyanGlow,
      });
    }

    const hexFrameGeo = trackGeo(out, createChamferedHexPart(0.28, 0.058, 0.012, 0.215));
    const hexPaneGeo = trackGeo(out, createChamferedHexPart(0.225, 0.024, 0.006));
    const hexHubGeo = trackGeo(out, createChamferedHexPart(0.072, 0.068, 0.010));
    const emitterBarGeo = trackGeo(out, new THREE.CylinderGeometry(0.013, 0.013, 0.40, 8));
    const emitterCrossGeo = trackGeo(out, new THREE.CylinderGeometry(0.011, 0.011, 0.38, 8));
    emitterCrossGeo.rotateZ(Math.PI * 0.5);

    const shieldConfigs: readonly (readonly [number, number, number, number, number])[] = [
      [0, yCore + 0.03, 0.39, 0, -0.06],
      [-0.43, yCore - 0.02, 0.23, -0.58, -0.04],
      [0.43, yCore - 0.02, 0.23, 0.58, -0.04],
    ];
    for (const [sx, sy, sz, syaw, spitch] of shieldConfigs) {
      const sm = makeTransform(sx, sy, sz, spitch, syaw, 0);
      out.armor.push({ geo: hexFrameGeo, matrix: sm, colorRgb: whiteCeramic });
      out.crystal.push({
        geo: hexPaneGeo,
        matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.014)),
        colorRgb: shieldCrystal,
      });
      out.trim.push({
        geo: hexHubGeo,
        matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.024)),
        colorRgb: paleGold,
      });
      out.energy.push(
        {
          geo: emitterBarGeo,
          matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.032)),
          colorRgb: cyanGlow,
        },
        {
          geo: emitterCrossGeo,
          matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.030)),
          colorRgb: cyanGlow,
        },
      );
      addTrussStrut(out, [sx * 0.45, yCore + 0.11, zCore + 0.16], [sx * 0.92, sy + 0.07, sz - 0.03], 0.022, 'matte', darkSlate);
      addTrussStrut(out, [sx * 0.45, yCore - 0.11, zCore + 0.16], [sx * 0.92, sy - 0.07, sz - 0.03], 0.022, 'matte', darkSlate);
    }

    const radFrameGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.26],
          [0.42, -0.18],
          [0.46, 0.22],
          [0.06, 0.28],
          [0.0, 0.18],
        ],
        0.042,
        0.009,
        0.009,
        2,
      ),
    );
    const radCoolantGeo = trackGeo(out, createChamferPlate(0.32, 0.052, 0.052, 0.2, 0.2, 0.006));
    const radRibGeo = trackGeo(out, createChamferPlate(0.36, 0.036, 0.058, 0.2, 0.2, 0.006));
    const radSubFinGeo = trackGeo(out, createTrapezoidPlate(0.24, 0.18, 0.14, 0.032, 0.006));

    for (const side of [-1, 1] as const) {
      const rm = makeTransform(side * 0.22, yCore + 0.04, -0.34, 0, side * 0.48, side * 0.10, side, 1, 1);
      out.armor.push(
        { geo: radFrameGeo, matrix: rm, colorRgb: mistCeramic },
        {
          geo: radSubFinGeo,
          matrix: makeTransform(side * 0.24, yCore - 0.24, -0.34, 0.14, side * 0.48, -side * 0.34),
          colorRgb: whiteCeramic,
        },
      );
      out.trim.push({
        geo: radRibGeo,
        matrix: rm.clone().multiply(new THREE.Matrix4().makeTranslation(0.22, 0.11, 0)),
        colorRgb: paleGold,
      });
      out.energy.push({
        geo: radCoolantGeo,
        matrix: rm.clone().multiply(new THREE.Matrix4().makeTranslation(0.22, -0.06, 0)),
        colorRgb: cyanGlow,
      });
      addThrusterPod(out, side * 0.16, yCore - 0.10, -0.38, 0, 0, 0, 0.068, 0.18, darkSlate, paleGold, cyanGlow);
    }

    const starVaneGeo = trackGeo(out, createCurvedBladePart(0.64, 0.16, 0.030, 0.18, 0.06, 9));
    out.wingParts.push(
      { geo: starVaneGeo, matrix: makeTransform(-0.28, yCore + 0.24, -0.38, -0.18, 0.36, 0.68) },
      { geo: starVaneGeo, matrix: makeTransform(0.28, yCore + 0.24, -0.38, -0.18, -0.36, -0.68, -1, 1, 1) },
      { geo: starVaneGeo, matrix: makeTransform(-0.26, yCore - 0.04, -0.40, -0.14, 0.30, 1.18, 0.78, 0.78, 0.78) },
      { geo: starVaneGeo, matrix: makeTransform(0.26, yCore - 0.04, -0.40, -0.14, -0.30, -1.18, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.68;
    out.weaponGlowHex = 0x38bdf8;
    out.crystalHex = 0x67e8f9;
    out.crystalOpacity = 0.62;
    out.crystalIntensity = 0.56;
  },

  S12: (_ctx, out) => {
    const whiteCeramic: RgbTriple = [0.94, 0.96, 1.0];
    const pearlMist: RgbTriple = [0.79, 0.86, 0.94];
    const darkSlate: RgbTriple = [0.18, 0.23, 0.33];
    const champagneGold: RgbTriple = [0.87, 0.79, 0.57];
    const dataCyan: RgbTriple = [0.72, 0.96, 1.0];
    const opticalCrystal: RgbTriple = [0.46, 0.90, 0.99];

    const yAxis = 0.86;

    const bowHullGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.036, 0.0],
          [0.095, 0.10],
          [0.145, 0.26],
          [0.155, 0.40],
          [0.125, 0.48],
        ],
        14,
      ),
    );
    bowHullGeo.rotateX(-Math.PI * 0.5);

    const aftHullGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.135, -0.26],
          [0.168, -0.06],
          [0.150, 0.14],
          [0.105, 0.24],
        ],
        14,
      ),
    );
    aftHullGeo.rotateX(Math.PI * 0.5);

    const laserLensRingGeo = trackGeo(out, new THREE.TorusGeometry(0.066, 0.015, 8, 18));
    const bowCollarGeo = trackGeo(out, new THREE.TorusGeometry(0.148, 0.016, 8, 18));
    const laserEmitterGeo = trackGeo(out, new THREE.SphereGeometry(0.048, 12, 8));

    const dorsalArchGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.32, 0.04],
          [0.28, 0.04],
          [0.22, 0.18],
          [0.08, 0.24],
          [-0.10, 0.24],
          [-0.24, 0.16],
        ],
        0.075,
        0.010,
        0.010,
        2,
      ),
    );
    dorsalArchGeo.rotateY(-Math.PI * 0.5);

    const ventralArchGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.30, -0.04],
          [0.26, -0.04],
          [0.18, -0.22],
          [-0.18, -0.22],
        ],
        0.075,
        0.010,
        0.010,
        2,
      ),
    );
    ventralArchGeo.rotateY(-Math.PI * 0.5);

    const relayDishGeo = trackGeo(out, new THREE.ConeGeometry(0.14, 0.075, 16, 1, true));
    relayDishGeo.rotateX(-Math.PI * 0.40);
    const dishMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.026, 0.24, 10));
    const dishFeedGeo = trackGeo(out, new THREE.SphereGeometry(0.028, 10, 8));
    const aftFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.22, 0.0],
          [0.08, 0.0],
          [-0.08, 0.24],
          [-0.22, 0.18],
        ],
        0.032,
        0.007,
        0.007,
        2,
      ),
    );
    aftFinGeo.rotateY(-Math.PI * 0.5);

    out.armor.push(
      { geo: bowHullGeo, matrix: makeTransform(0, yAxis, 0.66), colorRgb: whiteCeramic },
      { geo: aftHullGeo, matrix: makeTransform(0, yAxis, -0.36), colorRgb: whiteCeramic },
      { geo: dorsalArchGeo, matrix: makeTransform(0, yAxis + 0.13, 0.04), colorRgb: pearlMist },
      { geo: ventralArchGeo, matrix: makeTransform(0, yAxis - 0.13, 0.04), colorRgb: pearlMist },
      { geo: aftFinGeo, matrix: makeTransform(0, yAxis + 0.14, -0.34), colorRgb: whiteCeramic },
      { geo: aftFinGeo, matrix: makeTransform(0, yAxis - 0.14, -0.34, Math.PI, 0, 0), colorRgb: pearlMist },
    );
    out.trim.push(
      { geo: laserLensRingGeo, matrix: makeTransform(0, yAxis, 0.66), colorRgb: champagneGold },
      { geo: bowCollarGeo, matrix: makeTransform(0, yAxis, 0.34), colorRgb: champagneGold },
      { geo: bowCollarGeo, matrix: makeTransform(0, yAxis, -0.26), colorRgb: champagneGold },
      { geo: dishMastGeo, matrix: makeTransform(0, yAxis + 0.44, -0.04), colorRgb: champagneGold },
      { geo: relayDishGeo, matrix: makeTransform(0, yAxis + 0.54, 0.02), colorRgb: champagneGold },
    );
    out.energy.push(
      { geo: laserEmitterGeo, matrix: makeTransform(0, yAxis, 0.65), colorRgb: dataCyan },
      { geo: dishFeedGeo, matrix: makeTransform(0, yAxis + 0.56, 0.07), colorRgb: dataCyan },
    );

    const cavityCylinderGeo = trackGeo(out, new THREE.CylinderGeometry(0.082, 0.082, 0.30, 16));
    cavityCylinderGeo.rotateX(Math.PI * 0.5);
    const cavityCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.36, 0.132, 8, 0.5, 0.5));
    cavityCrystalGeo.rotateX(Math.PI * 0.5);
    const mirrorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.142, 0.018, 8, 22));

    out.energy.push({ geo: cavityCylinderGeo, matrix: makeTransform(0, yAxis, 0.04), colorRgb: dataCyan });
    out.crystal.push({ geo: cavityCrystalGeo, matrix: makeTransform(0, yAxis, 0.04), colorRgb: opticalCrystal });
    out.trim.push(
      { geo: mirrorRingGeo, matrix: makeTransform(0, yAxis, 0.21), colorRgb: champagneGold },
      { geo: mirrorRingGeo, matrix: makeTransform(0, yAxis, 0.04), colorRgb: champagneGold },
      { geo: mirrorRingGeo, matrix: makeTransform(0, yAxis, -0.13), colorRgb: champagneGold },
    );

    const railBeamGeo = trackGeo(out, new THREE.CylinderGeometry(0.020, 0.020, 0.56, 8));
    railBeamGeo.rotateX(Math.PI * 0.5);
    for (const side of [-1, 1] as const) {
      out.matte.push(
        { geo: railBeamGeo, matrix: makeTransform(side * 0.16, yAxis + 0.13, 0.04), colorRgb: darkSlate },
        { geo: railBeamGeo, matrix: makeTransform(side * 0.16, yAxis - 0.13, 0.04), colorRgb: darkSlate },
      );
    }

    const sailFrameGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.14],
          [0.46, -0.10],
          [0.50, 0.12],
          [0.04, 0.16],
        ],
        0.028,
        0.007,
        0.007,
        2,
      ),
    );
    const sailPaneGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.04, -0.10],
          [0.42, -0.07],
          [0.45, 0.09],
          [0.07, 0.12],
        ],
        0.014,
        0.004,
        0.004,
        1,
      ),
    );
    const gridBarGeo = trackGeo(out, new THREE.CylinderGeometry(0.009, 0.009, 0.42, 6));
    gridBarGeo.rotateZ(Math.PI * 0.5);
    const crossRibGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6));
    const phaseNodeGeo = trackGeo(out, new THREE.OctahedronGeometry(0.032, 0));

    const sailRows: readonly (readonly [number, number, number])[] = [
      [0.14, -0.06, 0.46],
      [-0.14, -0.06, -0.46],
    ];
    for (const side of [-1, 1] as const) {
      for (const [yOff, zOff, rollTilt] of sailRows) {
        const sm = makeTransform(
          side * 0.18,
          yAxis + yOff,
          zOff,
          0.14,
          side * 0.16,
          side * rollTilt,
          side,
          1,
          1,
        );
        out.armor.push({ geo: sailFrameGeo, matrix: sm, colorRgb: whiteCeramic });
        out.crystal.push({
          geo: sailPaneGeo,
          matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.012)),
          colorRgb: opticalCrystal,
        });
        out.trim.push(
          {
            geo: gridBarGeo,
            matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0.25, 0.01, 0.018)),
            colorRgb: champagneGold,
          },
          {
            geo: crossRibGeo,
            matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0.24, 0.01, 0.018)),
            colorRgb: champagneGold,
          },
        );
        out.energy.push({
          geo: phaseNodeGeo,
          matrix: sm.clone().multiply(new THREE.Matrix4().makeTranslation(0.48, 0.01, 0.018)),
          colorRgb: dataCyan,
        });
        addTrussStrut(
          out,
          [side * 0.14, yAxis + yOff * 0.65, zOff - 0.06],
          [side * 0.34, yAxis + yOff * 1.45, zOff - 0.02],
          0.018,
          'matte',
          darkSlate,
        );
      }
      addThrusterPod(out, side * 0.12, yAxis, -0.54, 0, 0, 0, 0.056, 0.15, darkSlate, champagneGold, dataCyan);
    }

    const starSparGeo = trackGeo(out, createCurvedBladePart(0.64, 0.14, 0.026, 0.16, 0.05, 9));
    out.wingParts.push(
      { geo: starSparGeo, matrix: makeTransform(-0.22, yAxis + 0.24, -0.28, -0.18, 0.28, 0.72) },
      { geo: starSparGeo, matrix: makeTransform(0.22, yAxis + 0.24, -0.28, -0.18, -0.28, -0.72, -1, 1, 1) },
      { geo: starSparGeo, matrix: makeTransform(-0.22, yAxis - 0.10, -0.32, -0.14, 0.24, 1.24, 0.78, 0.78, 0.78) },
      { geo: starSparGeo, matrix: makeTransform(0.22, yAxis - 0.10, -0.32, -0.14, -0.24, -1.24, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.62;
    out.weaponGlowHex = 0x56d4fc;
    out.crystalHex = 0x7dd3fc;
    out.crystalOpacity = 0.66;
    out.crystalIntensity = 0.60;
  },

  S13: (_ctx, out) => {
    const forgedGold: RgbTriple = [0.85, 0.67, 0.35];
    const deepBronze: RgbTriple = [0.54, 0.35, 0.19];
    const darkIron: RgbTriple = [0.20, 0.21, 0.26];
    const brightBrass: RgbTriple = [0.93, 0.79, 0.48];
    const solarFlame: RgbTriple = [1.0, 0.86, 0.48];
    const quartzGlass: RgbTriple = [0.34, 0.52, 0.66];

    const yBase = 0.84;

    const heatShieldBowGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.72],
          [0.18, 0.36],
          [0.26, -0.06],
          [0.22, -0.46],
          [-0.22, -0.46],
          [-0.26, -0.06],
          [-0.18, 0.36],
        ],
        0.19,
        0.022,
        0.022,
        2,
      ),
    );
    heatShieldBowGeo.rotateX(Math.PI * 0.5);

    const bowTileUpperGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.56],
          [0.13, 0.22],
          [0.17, -0.20],
          [0.11, -0.42],
          [-0.11, -0.42],
          [-0.17, -0.20],
          [-0.13, 0.22],
        ],
        0.11,
        0.014,
        0.014,
        2,
      ),
    );
    bowTileUpperGeo.rotateX(Math.PI * 0.5);

    const ventralHullGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.42, 0.0],
          [0.54, 0.0],
          [0.26, -0.18],
          [-0.34, -0.18],
        ],
        0.19,
        0.016,
        0.016,
        2,
      ),
    );
    ventralHullGeo.rotateY(-Math.PI * 0.5);

    const ventralKeelGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.30, 0.0],
          [0.24, 0.0],
          [0.06, -0.18],
          [-0.24, -0.18],
        ],
        0.056,
        0.008,
        0.008,
        2,
      ),
    );
    ventralKeelGeo.rotateY(-Math.PI * 0.5);

    const bowSensorSlitGeo = trackGeo(out, createCurvedVisorPart(0.11, 0.055, 0.16, 1.8, 0.85, 0.58, 14, 6));
    const quartzViewportGeo = trackGeo(out, createCurvedVisorPart(0.105, 0.092, 0.22, 2.2, 0.44, 0.94, 16, 8));
    const cryoTankGeo = trackGeo(out, new THREE.CylinderGeometry(0.066, 0.066, 0.34, 12));
    cryoTankGeo.rotateX(Math.PI * 0.5);
    const tankStrapGeo = trackGeo(out, new THREE.TorusGeometry(0.072, 0.011, 6, 16));
    const probeTipGeo = trackGeo(out, new THREE.ConeGeometry(0.068, 0.20, 8));
    probeTipGeo.rotateX(Math.PI * 0.5);
    const dorsalMastGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.018, 0.22, 8));
    const dorsalSensorOrbGeo = trackGeo(out, new THREE.OctahedronGeometry(0.032, 0));

    out.armor.push(
      { geo: heatShieldBowGeo, matrix: makeTransform(0, yBase, 0.02), colorRgb: forgedGold },
      { geo: bowTileUpperGeo, matrix: makeTransform(0, yBase + 0.12, -0.02), colorRgb: deepBronze },
    );
    out.matte.push(
      { geo: ventralHullGeo, matrix: makeTransform(0, yBase - 0.09, 0.02), colorRgb: darkIron },
      { geo: ventralKeelGeo, matrix: makeTransform(0, yBase - 0.19, -0.02), colorRgb: darkIron },
      { geo: cryoTankGeo, matrix: makeTransform(0, yBase + 0.21, -0.22), colorRgb: darkIron },
    );
    out.trim.push(
      { geo: probeTipGeo, matrix: makeTransform(0, yBase, 0.78), colorRgb: brightBrass },
      { geo: tankStrapGeo, matrix: makeTransform(0, yBase + 0.21, -0.14), colorRgb: brightBrass },
      { geo: tankStrapGeo, matrix: makeTransform(0, yBase + 0.21, -0.30), colorRgb: brightBrass },
      { geo: dorsalMastGeo, matrix: makeTransform(0, yBase + 0.32, -0.16, -0.24, 0, 0), colorRgb: brightBrass },
    );
    out.crystal.push({
      geo: quartzViewportGeo,
      matrix: makeTransform(0, yBase + 0.15, 0.16, -0.14, 0, 0),
      colorRgb: quartzGlass,
    });
    out.energy.push(
      { geo: bowSensorSlitGeo, matrix: makeTransform(0, yBase + 0.13, 0.24, -0.12, 0, 0), colorRgb: solarFlame },
      { geo: dorsalSensorOrbGeo, matrix: makeTransform(0, yBase + 0.43, -0.19), colorRgb: solarFlame },
    );

    const shieldWingGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.26],
          [0.46, -0.18],
          [0.40, -0.44],
          [0.0, -0.26],
        ],
        0.052,
        0.011,
        0.011,
        2,
      ),
    );
    shieldWingGeo.rotateX(Math.PI * 0.5);

    const wingSubPlateGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.12],
          [0.32, -0.14],
          [0.28, -0.32],
          [0.0, -0.18],
        ],
        0.068,
        0.008,
        0.008,
        1,
      ),
    );
    wingSubPlateGeo.rotateX(Math.PI * 0.5);

    const wingEdgeRibGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.28],
          [0.48, -0.17],
          [0.44, -0.23],
          [0.0, 0.19],
        ],
        0.066,
        0.008,
        0.008,
        1,
      ),
    );
    wingEdgeRibGeo.rotateX(Math.PI * 0.5);

    const radiatorSlotGeo = trackGeo(out, createChamferPlate(0.20, 0.036, 0.10, 0.2, 0.2, 0.006));
    const dorsalStabGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.26, 0.0],
          [0.14, 0.0],
          [-0.08, 0.36],
          [-0.28, 0.28],
        ],
        0.036,
        0.008,
        0.008,
        2,
      ),
    );
    dorsalStabGeo.rotateY(-Math.PI * 0.5);

    const intakeBoxGeo = trackGeo(out, createChamferPlate(0.13, 0.14, 0.44, 0.24, 0.24, 0.012));
    const wingTipPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.032, 0.038, 0.26, 10));
    wingTipPodGeo.rotateX(Math.PI * 0.5);
    const magnetometerGeo = trackGeo(out, new THREE.CylinderGeometry(0.013, 0.020, 0.34, 8));
    magnetometerGeo.rotateX(Math.PI * 0.5);
    const engineCoilGeo = trackGeo(out, new THREE.TorusGeometry(0.112, 0.014, 6, 16));

    for (const side of [-1, 1] as const) {
      out.armor.push(
        {
          geo: shieldWingGeo,
          matrix: makeTransform(side * 0.19, yBase + 0.01, 0.04, 0, 0, -side * 0.20, side, 1, 1),
          colorRgb: forgedGold,
        },
        {
          geo: wingSubPlateGeo,
          matrix: makeTransform(side * 0.19, yBase + 0.03, 0.02, 0, 0, -side * 0.20, side, 1, 1),
          colorRgb: deepBronze,
        },
        {
          geo: dorsalStabGeo,
          matrix: makeTransform(side * 0.18, yBase + 0.15, -0.22, 0, 0, -side * 0.34),
          colorRgb: deepBronze,
        },
      );
      out.trim.push(
        {
          geo: wingEdgeRibGeo,
          matrix: makeTransform(side * 0.19, yBase + 0.02, 0.04, 0, 0, -side * 0.20, side, 1, 1),
          colorRgb: brightBrass,
        },
        {
          geo: magnetometerGeo,
          matrix: makeTransform(side * 0.17, yBase - 0.05, 0.46),
          colorRgb: brightBrass,
        },
        {
          geo: engineCoilGeo,
          matrix: makeTransform(side * 0.16, yBase, -0.40),
          colorRgb: brightBrass,
        },
        {
          geo: engineCoilGeo,
          matrix: makeTransform(side * 0.16, yBase, -0.48),
          colorRgb: brightBrass,
        },
      );
      out.matte.push(
        {
          geo: intakeBoxGeo,
          matrix: makeTransform(side * 0.23, yBase - 0.02, -0.06),
          colorRgb: darkIron,
        },
        {
          geo: wingTipPodGeo,
          matrix: makeTransform(side * 0.60, yBase - 0.09, -0.24),
          colorRgb: darkIron,
        },
      );
      out.energy.push(
        {
          geo: radiatorSlotGeo,
          matrix: makeTransform(side * 0.40, yBase - 0.01, -0.14, 0, -side * 0.44, -side * 0.20),
          colorRgb: solarFlame,
        },
        {
          geo: dorsalSensorOrbGeo,
          matrix: makeTransform(side * 0.60, yBase - 0.09, -0.10),
          colorRgb: solarFlame,
        },
      );
      addTrussStrut(
        out,
        [side * 0.18, yBase + 0.12, -0.08],
        [side * 0.40, yBase - 0.02, -0.12],
        0.016,
        'trim',
        brightBrass,
      );
    }

    const cheekBumperGeo = trackGeo(out, createChamferPlate(0.08, 0.08, 0.28, 0.24, 0.24, 0.009));
    const heatPipeGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.32, 8));
    heatPipeGeo.rotateX(Math.PI * 0.5);
    const aftRcsGeo = trackGeo(out, createChamferPlate(0.07, 0.07, 0.12, 0.24, 0.24, 0.007));
    for (const side of [-1, 1] as const) {
      out.armor.push({
        geo: cheekBumperGeo,
        matrix: makeTransform(side * 0.16, yBase + 0.02, 0.34, 0, -side * 0.34, 0),
        colorRgb: forgedGold,
      });
      out.trim.push({
        geo: heatPipeGeo,
        matrix: makeTransform(side * 0.14, yBase + 0.16, -0.18),
        colorRgb: brightBrass,
      });
      out.matte.push({
        geo: aftRcsGeo,
        matrix: makeTransform(side * 0.26, yBase + 0.04, -0.36),
        colorRgb: darkIron,
      });
    }

    const dorsalRadiatorGeo = trackGeo(out, createChamferPlate(0.14, 0.036, 0.28, 0.22, 0.22, 0.006));
    out.energy.push({ geo: dorsalRadiatorGeo, matrix: makeTransform(0, yBase + 0.26, -0.22), colorRgb: solarFlame });

    addThrusterPod(out, -0.16, yBase, -0.46, 0, 0, 0, 0.102, 0.24, darkIron, brightBrass, solarFlame);
    addThrusterPod(out, 0.16, yBase, -0.46, 0, 0, 0, 0.102, 0.24, darkIron, brightBrass, solarFlame);

    const starVaneGeo = trackGeo(out, createCurvedBladePart(0.58, 0.16, 0.028, 0.18, 0.05, 9));
    out.wingParts.push(
      { geo: starVaneGeo, matrix: makeTransform(-0.24, yBase + 0.20, -0.32, -0.24, 0.34, 0.82) },
      { geo: starVaneGeo, matrix: makeTransform(0.24, yBase + 0.20, -0.32, -0.24, -0.34, -0.82, -1, 1, 1) },
      { geo: starVaneGeo, matrix: makeTransform(-0.24, yBase + 0.06, -0.36, -0.18, 0.28, 1.32, 0.78, 0.78, 0.78) },
      { geo: starVaneGeo, matrix: makeTransform(0.24, yBase + 0.06, -0.36, -0.18, -0.28, -1.32, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.48;
    out.weaponGlowHex = 0xf59e0b;
    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.60;
    out.crystalIntensity = 0.38;
  },

  S14: (_ctx, out) => {
    const starIndigo: RgbTriple = [0.24, 0.32, 0.50];
    const warmBronze: RgbTriple = [0.78, 0.59, 0.33];
    const gunmetal: RgbTriple = [0.16, 0.20, 0.28];
    const clockGold: RgbTriple = [0.91, 0.76, 0.45];
    const hexCyan: RgbTriple = [0.68, 0.94, 1.0];
    const plasmaCrystal: RgbTriple = [0.42, 0.86, 0.98];

    const yBase = 0.84;

    const coreHullGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.38],
          [0.16, 0.16],
          [0.20, -0.20],
          [0.14, -0.44],
          [-0.14, -0.44],
          [-0.20, -0.20],
          [-0.16, 0.16],
        ],
        0.22,
        0.018,
        0.018,
        2,
      ),
    );
    coreHullGeo.rotateX(Math.PI * 0.5);

    const bridgeTowerGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.24, 0.0],
          [0.22, 0.0],
          [0.12, 0.24],
          [-0.18, 0.22],
        ],
        0.16,
        0.014,
        0.014,
        2,
      ),
    );
    bridgeTowerGeo.rotateY(-Math.PI * 0.5);

    const bridgeCapGeo = trackGeo(out, createChamferPlate(0.18, 0.06, 0.24, 0.24, 0.24, 0.008));
    const bridgeVisorGeo = trackGeo(out, createCurvedVisorPart(0.095, 0.048, 0.12, 1.85, 1.05, 0.48, 14, 6));
    const dorsalMastGeo = trackGeo(out, createTrapezoidPlate(0.032, 0.072, 0.22, 0.09, 0.008));
    const sensorWhipGeo = trackGeo(out, new THREE.CylinderGeometry(0.008, 0.012, 0.20, 6));

    const ventralKeelGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.36, 0.0],
          [0.28, 0.0],
          [0.08, -0.24],
          [-0.30, -0.22],
        ],
        0.12,
        0.012,
        0.012,
        2,
      ),
    );
    ventralKeelGeo.rotateY(-Math.PI * 0.5);

    const gyroHousingRingGeo = trackGeo(out, new THREE.TorusGeometry(0.15, 0.022, 8, 22));
    gyroHousingRingGeo.rotateX(Math.PI * 0.5);
    const gyroCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.085, 0.085, 0.14, 14));

    out.armor.push(
      { geo: coreHullGeo, matrix: makeTransform(0, yBase, -0.06), colorRgb: starIndigo },
      { geo: bridgeTowerGeo, matrix: makeTransform(0, yBase + 0.12, -0.06), colorRgb: starIndigo },
      { geo: bridgeCapGeo, matrix: makeTransform(0, yBase + 0.34, -0.08), colorRgb: warmBronze },
    );
    out.matte.push({ geo: ventralKeelGeo, matrix: makeTransform(0, yBase - 0.12, -0.06), colorRgb: gunmetal });
    out.trim.push(
      { geo: dorsalMastGeo, matrix: makeTransform(0, yBase + 0.44, -0.14), colorRgb: clockGold },
      { geo: sensorWhipGeo, matrix: makeTransform(-0.07, yBase + 0.45, -0.12, -0.16, 0, 0.14), colorRgb: clockGold },
      { geo: sensorWhipGeo, matrix: makeTransform(0.07, yBase + 0.45, -0.12, -0.16, 0, -0.14), colorRgb: clockGold },
      { geo: gyroHousingRingGeo, matrix: makeTransform(0, yBase - 0.12, 0.06), colorRgb: clockGold },
    );
    out.energy.push(
      { geo: bridgeVisorGeo, matrix: makeTransform(0, yBase + 0.23, 0.04), colorRgb: hexCyan },
      { geo: gyroCoreGeo, matrix: makeTransform(0, yBase - 0.12, 0.06), colorRgb: hexCyan },
    );

    const outriggerHullGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.08, -0.46],
          [0.09, -0.44],
          [0.12, 0.06],
          [0.08, 0.44],
          [0.01, 0.66],
          [-0.08, 0.42],
          [-0.11, 0.04],
        ],
        0.18,
        0.016,
        0.016,
        2,
      ),
    );
    outriggerHullGeo.rotateX(Math.PI * 0.5);

    const outriggerPlateGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.05, -0.34],
          [0.06, -0.34],
          [0.08, 0.28],
          [0.0, 0.48],
          [-0.06, 0.28],
        ],
        0.10,
        0.010,
        0.010,
        2,
      ),
    );
    outriggerPlateGeo.rotateX(Math.PI * 0.5);

    const ramRailGeo = trackGeo(out, createCurvedBladePart(0.60, 0.074, 0.026, 0.03, 0.02, 8));
    ramRailGeo.rotateX(Math.PI * 0.5);
    const plasmaEdgeGeo = trackGeo(out, createCurvedBladePart(0.64, 0.048, 0.016, 0.03, 0.02, 8));
    plasmaEdgeGeo.rotateX(Math.PI * 0.5);

    const outboardFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, -0.36],
          [0.0, 0.06],
          [0.24, 0.28],
          [0.26, 0.16],
          [0.14, -0.32],
        ],
        0.040,
        0.008,
        0.008,
        2,
      ),
    );
    outboardFinGeo.rotateX(Math.PI * 0.5);

    const pdTurretGeo = trackGeo(out, new THREE.CylinderGeometry(0.042, 0.052, 0.06, 10));
    const railCoilGeo = trackGeo(out, new THREE.TorusGeometry(0.058, 0.012, 6, 12));
    const hullRibGeo = trackGeo(out, createChamferPlate(0.16, 0.038, 0.08, 0.2, 0.2, 0.006));
    const crossBridgeGeo = trackGeo(out, createChamferPlate(0.66, 0.09, 0.16, 0.2, 0.22, 0.010));
    out.armor.push({ geo: crossBridgeGeo, matrix: makeTransform(0, yBase + 0.02, -0.14), colorRgb: warmBronze });

    for (const side of [-1, 1] as const) {
      out.armor.push(
        {
          geo: outriggerHullGeo,
          matrix: makeTransform(side * 0.34, yBase, 0.04, 0, -side * 0.04, 0, side, 1, 1),
          colorRgb: starIndigo,
        },
        {
          geo: outriggerPlateGeo,
          matrix: makeTransform(side * 0.34, yBase + 0.10, 0.02, 0, -side * 0.04, 0, side, 1, 1),
          colorRgb: warmBronze,
        },
        {
          geo: outboardFinGeo,
          matrix: makeTransform(side * 0.42, yBase + 0.02, -0.06, 0, 0, side * 0.26, side, 1, 1),
          colorRgb: starIndigo,
        },
      );
      out.matte.push({
        geo: pdTurretGeo,
        matrix: makeTransform(side * 0.34, yBase + 0.17, -0.18),
        colorRgb: gunmetal,
      });
      out.trim.push(
        {
          geo: ramRailGeo,
          matrix: makeTransform(side * 0.28, yBase, 0.18, 0, 0, 0, side, 1, 1),
          colorRgb: clockGold,
        },
        {
          geo: railCoilGeo,
          matrix: makeTransform(side * 0.29, yBase, 0.42),
          colorRgb: clockGold,
        },
        {
          geo: railCoilGeo,
          matrix: makeTransform(side * 0.28, yBase, 0.56),
          colorRgb: clockGold,
        },
        {
          geo: hullRibGeo,
          matrix: makeTransform(side * 0.46, yBase + 0.03, -0.14, 0, 0, side * 0.26),
          colorRgb: clockGold,
        },
      );
      out.energy.push({
        geo: plasmaEdgeGeo,
        matrix: makeTransform(side * 0.24, yBase, 0.22, 0, 0, 0, side, 1, 1),
        colorRgb: hexCyan,
      });
      out.crystal.push({
        geo: plasmaEdgeGeo,
        matrix: makeTransform(side * 0.24, yBase + 0.02, 0.22, 0, 0, 0, side * 1.15, 1.05, 1.05),
        colorRgb: plasmaCrystal,
      });

      addTrussStrut(out, [side * 0.14, yBase + 0.08, 0.14], [side * 0.28, yBase + 0.04, 0.20], 0.022, 'trim', warmBronze);
      addTrussStrut(out, [side * 0.14, yBase - 0.06, 0.10], [side * 0.28, yBase - 0.04, 0.18], 0.020, 'matte', gunmetal);
      addTrussStrut(out, [side * 0.14, yBase + 0.06, -0.26], [side * 0.30, yBase + 0.04, -0.28], 0.022, 'trim', warmBronze);
      addTrussStrut(out, [side * 0.14, yBase - 0.06, -0.26], [side * 0.30, yBase - 0.04, -0.28], 0.024, 'matte', gunmetal);

      addThrusterPod(out, side * 0.34, yBase, -0.44, 0, 0, 0, 0.088, 0.22, gunmetal, clockGold, hexCyan);
    }

    addThrusterPod(out, 0, yBase - 0.02, -0.50, 0, 0, 0, 0.118, 0.26, gunmetal, clockGold, hexCyan);

    const starFinGeo = trackGeo(out, createCurvedBladePart(0.62, 0.15, 0.028, 0.18, 0.05, 9));
    out.wingParts.push(
      { geo: starFinGeo, matrix: makeTransform(-0.34, yBase + 0.18, -0.32, -0.22, 0.34, 0.72) },
      { geo: starFinGeo, matrix: makeTransform(0.34, yBase + 0.18, -0.32, -0.22, -0.34, -0.72, -1, 1, 1) },
      { geo: starFinGeo, matrix: makeTransform(-0.32, yBase - 0.04, -0.36, -0.16, 0.28, 1.24, 0.78, 0.78, 0.78) },
      { geo: starFinGeo, matrix: makeTransform(0.32, yBase - 0.04, -0.36, -0.16, -0.28, -1.24, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.54;
    out.weaponGlowHex = 0x38bdf8;
    out.crystalHex = 0x7dd3fc;
    out.crystalOpacity = 0.58;
    out.crystalIntensity = 0.56;
  },

  S15: (_ctx, out) => {
    const glacierWhite: RgbTriple = [0.78, 0.90, 0.96];
    const iceHullBlue: RgbTriple = [0.32, 0.57, 0.74];
    const abyssalSteel: RgbTriple = [0.15, 0.24, 0.35];
    const frostSilver: RgbTriple = [0.76, 0.86, 0.92];
    const aquaGlow: RgbTriple = [0.68, 0.96, 1.0];
    const iceDomeCrystal: RgbTriple = [0.54, 0.88, 0.98];

    const yHull = 0.78;

    const mainHullGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.60],
          [0.24, 0.42],
          [0.36, 0.10],
          [0.28, -0.32],
          [0.14, -0.48],
          [-0.14, -0.48],
          [-0.28, -0.32],
          [-0.36, 0.10],
          [-0.24, 0.42],
        ],
        0.26,
        0.028,
        0.028,
        2,
      ),
    );
    mainHullGeo.rotateX(Math.PI * 0.5);

    const dorsalCarapaceGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.48],
          [0.22, 0.26],
          [0.26, -0.14],
          [0.14, -0.38],
          [-0.14, -0.38],
          [-0.26, -0.14],
          [-0.22, 0.26],
        ],
        0.14,
        0.020,
        0.020,
        2,
      ),
    );
    dorsalCarapaceGeo.rotateX(Math.PI * 0.5);

    const ventralKeelGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.38, 0.0],
          [0.46, 0.0],
          [0.28, -0.24],
          [-0.26, -0.22],
        ],
        0.24,
        0.020,
        0.020,
        2,
      ),
    );
    ventralKeelGeo.rotateY(-Math.PI * 0.5);

    const bowCenterCutterGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.08, -0.08],
          [0.18, -0.06],
          [0.24, 0.04],
          [-0.04, 0.10],
        ],
        0.075,
        0.010,
        0.010,
        2,
      ),
    );
    bowCenterCutterGeo.rotateY(-Math.PI * 0.5);

    out.armor.push(
      { geo: mainHullGeo, matrix: makeTransform(0, yHull, 0), colorRgb: iceHullBlue },
      { geo: dorsalCarapaceGeo, matrix: makeTransform(0, yHull + 0.14, -0.02), colorRgb: glacierWhite },
    );
    out.matte.push({ geo: ventralKeelGeo, matrix: makeTransform(0, yHull - 0.12, 0.02), colorRgb: abyssalSteel });
    out.trim.push({ geo: bowCenterCutterGeo, matrix: makeTransform(0, yHull - 0.04, 0.52), colorRgb: frostSilver });

    const prowRamGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.08, -0.14],
          [0.12, -0.12],
          [0.16, 0.18],
          [0.02, 0.28],
          [-0.10, 0.10],
        ],
        0.16,
        0.016,
        0.016,
        2,
      ),
    );
    prowRamGeo.rotateX(Math.PI * 0.5);

    const bowOpticGeo = trackGeo(out, new THREE.CylinderGeometry(0.042, 0.042, 0.06, 12));
    bowOpticGeo.rotateX(Math.PI * 0.5);

    const mantaWingGeo = trackGeo(out, createCreatureFin(0.76, 0.46, 0.26, 0.042, 0.095, 14, 8));
    const leadingArmorGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.30],
          [0.42, 0.04],
          [0.44, -0.06],
          [0.0, 0.14],
        ],
        0.078,
        0.012,
        0.012,
        2,
      ),
    );
    leadingArmorGeo.rotateX(Math.PI * 0.5);

    const wingHatchGeo = trackGeo(out, createChamferPlate(0.14, 0.036, 0.18, 0.24, 0.24, 0.006));
    const ballastPodGeo = trackGeo(out, new THREE.CapsuleGeometry(0.085, 0.34, 6, 12));
    ballastPodGeo.rotateX(Math.PI * 0.5);
    const dorsalVentGeo = trackGeo(out, createChamferPlate(0.18, 0.040, 0.09, 0.24, 0.24, 0.008));
    const thermalStripGeo = trackGeo(out, new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8));
    thermalStripGeo.rotateZ(Math.PI * 0.5);

    const sternRudderGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.24, -0.04],
          [0.10, -0.05],
          [0.06, 0.26],
          [-0.18, 0.20],
        ],
        0.044,
        0.008,
        0.008,
        2,
      ),
    );
    sternRudderGeo.rotateY(-Math.PI * 0.5);

    const divePlaneGeo = trackGeo(out, createChamferPlate(0.18, 0.032, 0.09, 0.22, 0.22, 0.006));

    for (const side of [-1, 1] as const) {
      out.armor.push(
        {
          geo: prowRamGeo,
          matrix: makeTransform(side * 0.16, yHull - 0.02, 0.42, 0, -side * 0.24, 0, side, 1, 1),
          colorRgb: glacierWhite,
        },
        {
          geo: mantaWingGeo,
          matrix: makeTransform(side * 0.22, yHull - 0.01, 0.04, 0, 0, -side * 0.08, side, 1, 1),
          colorRgb: iceHullBlue,
        },
        {
          geo: sternRudderGeo,
          matrix: makeTransform(side * 0.22, yHull + 0.08, -0.44, 0, 0, -side * 0.24),
          colorRgb: glacierWhite,
        },
        {
          geo: divePlaneGeo,
          matrix: makeTransform(side * 0.18, yHull + 0.24, 0.06),
          colorRgb: frostSilver,
        },
      );
      out.trim.push(
        {
          geo: leadingArmorGeo,
          matrix: makeTransform(side * 0.22, yHull + 0.01, 0.04, 0, 0, -side * 0.08, side, 1, 1),
          colorRgb: frostSilver,
        },
        {
          geo: wingHatchGeo,
          matrix: makeTransform(side * 0.36, yHull + 0.05, 0.06, 0, -side * 0.26, -side * 0.08),
          colorRgb: glacierWhite,
        },
      );
      out.matte.push({
        geo: ballastPodGeo,
        matrix: makeTransform(side * 0.32, yHull - 0.16, 0.02),
        colorRgb: abyssalSteel,
      });
      out.energy.push(
        { geo: bowOpticGeo, matrix: makeTransform(side * 0.11, yHull + 0.02, 0.56), colorRgb: aquaGlow },
        {
          geo: dorsalVentGeo,
          matrix: makeTransform(side * 0.32, yHull + 0.08, -0.10, 0, -side * 0.34, -side * 0.08),
          colorRgb: aquaGlow,
        },
        {
          geo: thermalStripGeo,
          matrix: makeTransform(side * 0.20, yHull + 0.04, 0.44, 0, -side * 0.56, 0),
          colorRgb: aquaGlow,
        },
      );
    }

    const conningSailGeo = trackGeo(out, createChamferPlate(0.24, 0.20, 0.38, 0.26, 0.22, 0.016));
    const bridgeDomeGeo = trackGeo(out, createCurvedVisorPart(0.145, 0.135, 0.22, 2.55, 0.35, 1.05, 18, 8));
    const bridgeDeckGeo = trackGeo(out, new THREE.SphereGeometry(0.082, 12, 8));
    const mastGeo = trackGeo(out, createTrapezoidPlate(0.036, 0.072, 0.22, 0.10, 0.008));
    const periscopeGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.016, 0.20, 8));
    const sensorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.052, 0.012, 6, 16));
    sensorRingGeo.rotateX(Math.PI * 0.5);
    const dorsalSonarHatchGeo = trackGeo(out, createChamferedHexPart(0.10, 0.04, 0.008));
    dorsalSonarHatchGeo.rotateX(Math.PI * 0.5);

    out.armor.push({ geo: conningSailGeo, matrix: makeTransform(0, yHull + 0.25, 0.04), colorRgb: glacierWhite });
    out.crystal.push({
      geo: bridgeDomeGeo,
      matrix: makeTransform(0, yHull + 0.29, 0.10, -0.08, 0, 0),
      colorRgb: iceDomeCrystal,
    });
    out.energy.push({
      geo: bridgeDeckGeo,
      matrix: makeTransform(0, yHull + 0.29, 0.12, 0, 0, 0, 1.2, 0.65, 1.3),
      colorRgb: aquaGlow,
    });
    out.trim.push(
      { geo: mastGeo, matrix: makeTransform(0, yHull + 0.43, -0.08), colorRgb: frostSilver },
      { geo: periscopeGeo, matrix: makeTransform(0.06, yHull + 0.40, -0.02), colorRgb: frostSilver },
      { geo: sensorRingGeo, matrix: makeTransform(0, yHull + 0.53, -0.08), colorRgb: frostSilver },
      { geo: dorsalSonarHatchGeo, matrix: makeTransform(0, yHull + 0.21, -0.26), colorRgb: frostSilver },
    );

    const bowSonarPodGeo = trackGeo(out, new THREE.SphereGeometry(0.052, 10, 8));
    const flankRibGeo = trackGeo(out, createChamferPlate(0.06, 0.08, 0.42, 0.22, 0.22, 0.008));
    const pylonStrutGeo = trackGeo(out, createTrapezoidPlate(0.06, 0.10, 0.14, 0.16, 0.008));
    for (const side of [-1, 1] as const) {
      out.matte.push({
        geo: bowSonarPodGeo,
        matrix: makeTransform(side * 0.22, yHull - 0.10, 0.38),
        colorRgb: abyssalSteel,
      });
      out.armor.push({
        geo: flankRibGeo,
        matrix: makeTransform(side * 0.30, yHull + 0.08, 0.02),
        colorRgb: glacierWhite,
      });
      out.matte.push({
        geo: pylonStrutGeo,
        matrix: makeTransform(side * 0.18, yHull - 0.02, -0.38, 0, 0, side * 0.42),
        colorRgb: abyssalSteel,
      });
    }

    const shroudGeo = trackGeo(out, new THREE.CylinderGeometry(0.115, 0.125, 0.24, 14, 1, true));
    shroudGeo.rotateX(Math.PI * 0.5);
    const statorCrossGeo = trackGeo(out, new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6));
    for (const side of [-1, 1] as const) {
      out.trim.push(
        { geo: shroudGeo, matrix: makeTransform(side * 0.24, yHull - 0.02, -0.44), colorRgb: frostSilver },
        { geo: statorCrossGeo, matrix: makeTransform(side * 0.24, yHull - 0.02, -0.44), colorRgb: frostSilver },
        { geo: statorCrossGeo, matrix: makeTransform(side * 0.24, yHull - 0.02, -0.44, 0, 0, Math.PI * 0.5), colorRgb: frostSilver },
      );
      addThrusterPod(out, side * 0.24, yHull - 0.02, -0.44, 0, 0, 0, 0.095, 0.22, abyssalSteel, frostSilver, aquaGlow);
    }

    const starFinGeo = trackGeo(out, createCurvedBladePart(0.56, 0.16, 0.030, 0.16, 0.05, 9));
    out.wingParts.push(
      { geo: starFinGeo, matrix: makeTransform(-0.42, yHull + 0.08, -0.22, -0.14, 0.34, 1.02) },
      { geo: starFinGeo, matrix: makeTransform(0.42, yHull + 0.08, -0.22, -0.14, -0.34, -1.02, -1, 1, 1) },
      { geo: starFinGeo, matrix: makeTransform(-0.24, yHull + 0.28, -0.32, -0.24, 0.24, 0.52, 0.75, 0.75, 0.75) },
      { geo: starFinGeo, matrix: makeTransform(0.24, yHull + 0.28, -0.32, -0.24, -0.24, -0.52, -0.75, 0.75, 0.75) },
    );

    out.headTopLocalY = 1.48;
    out.weaponGlowHex = 0x38d9e8;
    out.crystalHex = 0x7dd3fc;
    out.crystalOpacity = 0.62;
    out.crystalIntensity = 0.54;
  },

  S17: (_ctx, out) => {
    const obsidian: RgbTriple = [0.22, 0.18, 0.31];
    const plumArmor: RgbTriple = [0.37, 0.27, 0.49];
    const charcoal: RgbTriple = [0.14, 0.13, 0.19];
    const violetSilver: RgbTriple = [0.68, 0.58, 0.80];
    const magentaPlasma: RgbTriple = [1.0, 0.62, 0.96];
    const fieldCrystal: RgbTriple = [0.84, 0.44, 0.96];

    const coreY = 0.94;

    const topCollarGeo = trackGeo(out, createChamferedHexPart(0.38, 0.12, 0.016, 0.20));
    topCollarGeo.rotateX(Math.PI * 0.5);
    const botCollarGeo = trackGeo(out, createChamferedHexPart(0.36, 0.11, 0.015, 0.18));
    botCollarGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: topCollarGeo, matrix: makeTransform(0, coreY + 0.38, 0), colorRgb: obsidian },
      { geo: botCollarGeo, matrix: makeTransform(0, coreY - 0.38, 0), colorRgb: obsidian },
    );

    const upperPoleGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.045, 0.0],
          [0.14, 0.16],
          [0.25, 0.32],
          [0.20, 0.42],
          [0.11, 0.52],
          [0.06, 0.58],
        ],
        12,
      ),
    );
    const lowerPoleGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.05, -0.52],
          [0.13, -0.36],
          [0.23, -0.18],
          [0.12, -0.06],
          [0.045, 0.0],
        ],
        12,
      ),
    );
    const superCoilPlateGeo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.024, 8, 22));
    superCoilPlateGeo.rotateX(Math.PI * 0.5);
    const upperSolenoidGeo = trackGeo(out, new THREE.TorusGeometry(0.16, 0.018, 6, 18));
    upperSolenoidGeo.rotateX(Math.PI * 0.5);
    const electrodeTipGeo = trackGeo(out, new THREE.ConeGeometry(0.064, 0.12, 10));
    const hoverRingGeo = trackGeo(out, new THREE.TorusGeometry(0.19, 0.022, 8, 20));
    hoverRingGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: upperPoleGeo, matrix: makeTransform(0, coreY + 0.16, 0), colorRgb: plumArmor },
      { geo: lowerPoleGeo, matrix: makeTransform(0, coreY - 0.16, 0), colorRgb: plumArmor },
    );
    out.trim.push(
      { geo: superCoilPlateGeo, matrix: makeTransform(0, coreY + 0.48, 0), colorRgb: violetSilver },
      { geo: superCoilPlateGeo, matrix: makeTransform(0, coreY - 0.46, 0), colorRgb: violetSilver },
      { geo: upperSolenoidGeo, matrix: makeTransform(0, coreY + 0.60, 0), colorRgb: violetSilver },
      { geo: upperSolenoidGeo, matrix: makeTransform(0, coreY - 0.56, 0), colorRgb: violetSilver },
    );
    out.energy.push(
      { geo: electrodeTipGeo, matrix: makeTransform(0, coreY + 0.18, 0, Math.PI, 0, 0), colorRgb: magentaPlasma },
      { geo: electrodeTipGeo, matrix: makeTransform(0, coreY - 0.18, 0), colorRgb: magentaPlasma },
      { geo: hoverRingGeo, matrix: makeTransform(0, 0.36, 0), colorRgb: magentaPlasma },
    );

    const plasmaCoreGeo = trackGeo(out, new THREE.IcosahedronGeometry(0.165, 2));
    const plasmaShellGeo = trackGeo(out, createFacetedCrystalPart(0.42, 0.215, 8, 0.5, 0.5));
    const fluxRingGeo = trackGeo(out, new THREE.TorusGeometry(0.255, 0.018, 8, 28));

    out.energy.push({ geo: plasmaCoreGeo, matrix: makeTransform(0, coreY, 0), colorRgb: magentaPlasma });
    out.crystal.push({ geo: plasmaShellGeo, matrix: makeTransform(0, coreY, 0), colorRgb: fieldCrystal });
    out.trim.push(
      { geo: fluxRingGeo, matrix: makeTransform(0, coreY, 0, 0.62, 0.42, 0), colorRgb: violetSilver },
      { geo: fluxRingGeo, matrix: makeTransform(0, coreY, 0, -0.62, -0.42, 0), colorRgb: violetSilver },
    );

    const pillarGeo = trackGeo(out, createChamferPlate(0.10, 0.78, 0.11, 0.25, 0.14, 0.012));
    const coilRingGeo = trackGeo(out, new THREE.TorusGeometry(0.072, 0.016, 6, 12));
    coilRingGeo.rotateX(Math.PI * 0.5);
    const innerRailGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8));
    const baffleCapGeo = trackGeo(out, createTrapezoidPlate(0.16, 0.20, 0.24, 0.054, 0.011));
    const rcsNozzleGeo = trackGeo(out, new THREE.ConeGeometry(0.036, 0.075, 8));

    const pillarAngles = [Math.PI * 0.25, Math.PI * 0.75, -Math.PI * 0.75, -Math.PI * 0.25];
    for (const ang of pillarAngles) {
      const px = Math.sin(ang) * 0.36;
      const pz = Math.cos(ang) * 0.36;
      const bx = Math.sin(ang) * 0.47;
      const bz = Math.cos(ang) * 0.47;
      const rx = Math.sin(ang) * 0.26;
      const rz = Math.cos(ang) * 0.26;

      out.matte.push({ geo: pillarGeo, matrix: makeTransform(px, coreY, pz, 0, ang, 0), colorRgb: charcoal });
      out.trim.push(
        { geo: coilRingGeo, matrix: makeTransform(px, coreY + 0.16, pz), colorRgb: violetSilver },
        { geo: coilRingGeo, matrix: makeTransform(px, coreY - 0.16, pz), colorRgb: violetSilver },
      );
      out.energy.push({ geo: innerRailGeo, matrix: makeTransform(rx, coreY, rz), colorRgb: magentaPlasma });
      out.armor.push(
        { geo: baffleCapGeo, matrix: makeTransform(bx, coreY + 0.22, bz, 0, ang, 0), colorRgb: obsidian },
        { geo: baffleCapGeo, matrix: makeTransform(bx, coreY - 0.22, bz, Math.PI, ang, 0), colorRgb: obsidian },
      );
      addTrussStrut(
        out,
        [Math.sin(ang) * 0.22, coreY + 0.48, Math.cos(ang) * 0.22],
        [px, coreY + 0.38, pz],
        0.020,
        'trim',
        violetSilver,
      );
      out.matte.push({
        geo: rcsNozzleGeo,
        matrix: makeTransform(px * 1.16, coreY - 0.42, pz * 1.16, Math.PI, 0, 0),
        colorRgb: charcoal,
      });
    }

    const muzzleJawGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.08, -0.05],
          [0.20, -0.04],
          [0.26, 0.06],
          [-0.06, 0.09],
        ],
        0.16,
        0.012,
        0.012,
        2,
      ),
    );
    muzzleJawGeo.rotateY(-Math.PI * 0.5);
    const focusLensRingGeo = trackGeo(out, new THREE.TorusGeometry(0.118, 0.022, 8, 20));
    const midCollimatorRingGeo = trackGeo(out, new THREE.TorusGeometry(0.132, 0.016, 6, 18));
    const focusLensCoreGeo = trackGeo(out, new THREE.CylinderGeometry(0.082, 0.082, 0.04, 16));
    focusLensCoreGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: muzzleJawGeo, matrix: makeTransform(0, coreY + 0.14, 0.37, 0.08, 0, 0), colorRgb: plumArmor },
      { geo: muzzleJawGeo, matrix: makeTransform(0, coreY - 0.14, 0.37, -0.08, 0, Math.PI), colorRgb: plumArmor },
    );
    out.trim.push(
      { geo: focusLensRingGeo, matrix: makeTransform(0, coreY, 0.46), colorRgb: violetSilver },
      { geo: midCollimatorRingGeo, matrix: makeTransform(0, coreY, 0.34), colorRgb: violetSilver },
    );
    out.energy.push({ geo: focusLensCoreGeo, matrix: makeTransform(0, coreY, 0.45), colorRgb: magentaPlasma });

    const starVaneGeo = trackGeo(out, createCurvedBladePart(0.56, 0.14, 0.028, 0.14, 0.05, 8));
    out.wingParts.push(
      { geo: starVaneGeo, matrix: makeTransform(-0.32, coreY + 0.24, -0.18, -0.18, 0.36, 0.54) },
      { geo: starVaneGeo, matrix: makeTransform(0.32, coreY + 0.24, -0.18, -0.18, -0.36, -0.54, -1, 1, 1) },
      { geo: starVaneGeo, matrix: makeTransform(-0.36, coreY - 0.08, -0.18, -0.12, 0.30, 1.12, 0.78, 0.78, 0.78) },
      { geo: starVaneGeo, matrix: makeTransform(0.36, coreY - 0.08, -0.18, -0.12, -0.30, -1.12, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.82;
    out.weaponGlowHex = 0xd946ef;
    out.crystalHex = 0xe879f9;
    out.crystalOpacity = 0.56;
    out.crystalIntensity = 0.64;
  },

  S18: (_ctx, out) => {
    const jadeTeal: RgbTriple = [0.24, 0.58, 0.48];
    const celadon: RgbTriple = [0.70, 0.85, 0.79];
    const deepPine: RgbTriple = [0.13, 0.24, 0.22];
    const antiqueBronze: RgbTriple = [0.81, 0.66, 0.39];
    const warpEmerald: RgbTriple = [0.64, 1.0, 0.84];
    const bridgeCrystal: RgbTriple = [0.46, 0.90, 0.76];

    const yBase = 0.78;

    const mainHullGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.64],
          [0.14, 0.34],
          [0.22, 0.0],
          [0.20, -0.32],
          [0.11, -0.46],
          [-0.11, -0.46],
          [-0.20, -0.32],
          [-0.22, 0.0],
          [-0.14, 0.34],
        ],
        0.19,
        0.020,
        0.020,
        2,
      ),
    );
    mainHullGeo.rotateX(Math.PI * 0.5);

    const upperDeckGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0, 0.50],
          [0.11, 0.20],
          [0.15, -0.18],
          [0.09, -0.38],
          [-0.09, -0.38],
          [-0.15, -0.18],
          [-0.11, 0.20],
        ],
        0.11,
        0.014,
        0.014,
        2,
      ),
    );
    upperDeckGeo.rotateX(Math.PI * 0.5);

    const ventralKeelGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.34, 0.0],
          [0.44, 0.0],
          [0.18, -0.22],
          [-0.26, -0.22],
        ],
        0.10,
        0.012,
        0.012,
        2,
      ),
    );
    ventralKeelGeo.rotateY(-Math.PI * 0.5);

    const noseProbeGeo = trackGeo(out, new THREE.CylinderGeometry(0.010, 0.022, 0.20, 8));
    noseProbeGeo.rotateX(Math.PI * 0.5);
    const ventralSensorGeo = trackGeo(out, new THREE.SphereGeometry(0.048, 10, 8));

    out.armor.push(
      { geo: mainHullGeo, matrix: makeTransform(0, yBase, 0), colorRgb: jadeTeal },
      { geo: upperDeckGeo, matrix: makeTransform(0, yBase + 0.11, -0.02), colorRgb: celadon },
    );
    out.matte.push({ geo: ventralKeelGeo, matrix: makeTransform(0, yBase - 0.12, 0.02), colorRgb: deepPine });
    out.trim.push(
      { geo: noseProbeGeo, matrix: makeTransform(0, yBase, 0.72), colorRgb: antiqueBronze },
      { geo: ventralSensorGeo, matrix: makeTransform(0, yBase - 0.22, 0.14), colorRgb: antiqueBronze },
    );

    const bridgeCanopyGeo = trackGeo(out, createCurvedVisorPart(0.11, 0.092, 0.22, 2.3, 0.42, 0.96, 16, 8));
    const bridgeGlowGeo = trackGeo(out, new THREE.SphereGeometry(0.056, 10, 8));
    const bridgeArcGeo = trackGeo(out, new THREE.TorusGeometry(0.112, 0.012, 6, 16, Math.PI));

    out.crystal.push({
      geo: bridgeCanopyGeo,
      matrix: makeTransform(0, yBase + 0.14, 0.16, -0.12, 0, 0),
      colorRgb: bridgeCrystal,
    });
    out.energy.push({
      geo: bridgeGlowGeo,
      matrix: makeTransform(0, yBase + 0.15, 0.18, 0, 0, 0, 1.15, 0.55, 1.45),
      colorRgb: warpEmerald,
    });
    out.trim.push(
      { geo: bridgeArcGeo, matrix: makeTransform(0, yBase + 0.14, 0.22, -0.20, 0, 0), colorRgb: antiqueBronze },
      { geo: bridgeArcGeo, matrix: makeTransform(0, yBase + 0.15, 0.10, -0.14, 0, 0), colorRgb: antiqueBronze },
    );

    const sweptWingGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.16],
          [0.48, -0.18],
          [0.44, -0.34],
          [0.0, -0.16],
        ],
        0.048,
        0.010,
        0.010,
        2,
      ),
    );
    sweptWingGeo.rotateX(Math.PI * 0.5);

    const leadingTrimGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [0.0, 0.18],
          [0.50, -0.17],
          [0.48, -0.22],
          [0.0, 0.11],
        ],
        0.058,
        0.008,
        0.008,
        1,
      ),
    );
    leadingTrimGeo.rotateX(Math.PI * 0.5);

    const wingPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.036, 0.042, 0.24, 10));
    wingPodGeo.rotateX(Math.PI * 0.5);

    const swallowTailGeo = trackGeo(
      out,
      createTaperedTubePart(
        [
          [0.0, 0.0, 0.0],
          [0.02, 0.03, -0.22],
          [0.04, 0.08, -0.44],
        ],
        0.034,
        0.012,
        12,
        8,
      ),
    );
    const wingTipBeaconGeo = trackGeo(out, new THREE.OctahedronGeometry(0.034, 0));

    const engineNacelleGeo = trackGeo(out, new THREE.CylinderGeometry(0.074, 0.086, 0.34, 12));
    engineNacelleGeo.rotateX(Math.PI * 0.5);
    const engineBandGeo = trackGeo(out, new THREE.TorusGeometry(0.084, 0.014, 6, 16));
    const hullStrakeGeo = trackGeo(out, createChamferPlate(0.045, 0.042, 0.44, 0.2, 0.2, 0.006));

    for (const side of [-1, 1] as const) {
      out.armor.push(
        {
          geo: sweptWingGeo,
          matrix: makeTransform(side * 0.16, yBase + 0.01, -0.02, 0, 0, side * 0.08, side, 1, 1),
          colorRgb: jadeTeal,
        },
        {
          geo: swallowTailGeo,
          matrix: makeTransform(side * 0.58, yBase + 0.05, -0.26, 0, 0, 0, side, 1, 1),
          colorRgb: celadon,
        },
      );
      out.trim.push(
        {
          geo: leadingTrimGeo,
          matrix: makeTransform(side * 0.16, yBase + 0.02, -0.02, 0, 0, side * 0.08, side, 1, 1),
          colorRgb: antiqueBronze,
        },
        {
          geo: engineBandGeo,
          matrix: makeTransform(side * 0.22, yBase - 0.04, -0.20),
          colorRgb: antiqueBronze,
        },
        {
          geo: engineBandGeo,
          matrix: makeTransform(side * 0.22, yBase - 0.04, -0.34),
          colorRgb: antiqueBronze,
        },
        {
          geo: hullStrakeGeo,
          matrix: makeTransform(side * 0.14, yBase + 0.08, 0.04),
          colorRgb: antiqueBronze,
        },
      );
      out.matte.push(
        {
          geo: engineNacelleGeo,
          matrix: makeTransform(side * 0.22, yBase - 0.04, -0.28),
          colorRgb: deepPine,
        },
        {
          geo: wingPodGeo,
          matrix: makeTransform(side * 0.58, yBase + 0.05, -0.24),
          colorRgb: deepPine,
        },
      );
      out.energy.push({
        geo: wingTipBeaconGeo,
        matrix: makeTransform(side * 0.62, yBase + 0.13, -0.70),
        colorRgb: warpEmerald,
      });
      addThrusterPod(out, side * 0.22, yBase - 0.04, -0.44, 0, 0, 0, 0.070, 0.16, deepPine, antiqueBronze, warpEmerald);
    }

    const dorsalSpineFinGeo = trackGeo(
      out,
      createBevelExtrudePart(
        [
          [-0.28, 0.0],
          [0.14, 0.0],
          [0.04, 0.24],
          [-0.26, 0.22],
        ],
        0.044,
        0.008,
        0.008,
        2,
      ),
    );
    dorsalSpineFinGeo.rotateY(-Math.PI * 0.5);

    const laserEmitterNodeGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.024, 0.10, 8));
    const beaconCrossVaneGeo = trackGeo(out, createChamferPlate(0.14, 0.022, 0.042, 0.2, 0.2, 0.004));
    const aftWarpRingGeo = trackGeo(out, new THREE.TorusGeometry(0.24, 0.024, 8, 28));
    const aftWarpGlowGeo = trackGeo(out, new THREE.TorusGeometry(0.205, 0.013, 6, 24));

    out.armor.push({ geo: dorsalSpineFinGeo, matrix: makeTransform(0, yBase + 0.15, -0.14), colorRgb: jadeTeal });
    out.trim.push(
      { geo: laserEmitterNodeGeo, matrix: makeTransform(0, yBase + 0.41, -0.02), colorRgb: antiqueBronze },
      { geo: laserEmitterNodeGeo, matrix: makeTransform(0, yBase + 0.40, -0.14), colorRgb: antiqueBronze },
      { geo: laserEmitterNodeGeo, matrix: makeTransform(0, yBase + 0.39, -0.26), colorRgb: antiqueBronze },
      { geo: beaconCrossVaneGeo, matrix: makeTransform(0, yBase + 0.32, -0.14), colorRgb: antiqueBronze },
      { geo: aftWarpRingGeo, matrix: makeTransform(0, yBase + 0.12, -0.44), colorRgb: antiqueBronze },
    );
    out.energy.push(
      { geo: wingTipBeaconGeo, matrix: makeTransform(0, yBase + 0.47, -0.02), colorRgb: warpEmerald },
      { geo: wingTipBeaconGeo, matrix: makeTransform(0, yBase + 0.46, -0.14), colorRgb: warpEmerald },
      { geo: wingTipBeaconGeo, matrix: makeTransform(0, yBase + 0.45, -0.26), colorRgb: warpEmerald },
      { geo: aftWarpGlowGeo, matrix: makeTransform(0, yBase + 0.12, -0.44), colorRgb: warpEmerald },
    );
    addTrussStrut(out, [0, yBase + 0.24, -0.34], [0, yBase + 0.35, -0.44], 0.018, 'trim', antiqueBronze);
    addTrussStrut(out, [0, yBase - 0.10, -0.36], [0, yBase - 0.11, -0.44], 0.018, 'trim', antiqueBronze);
    addTrussStrut(out, [-0.20, yBase - 0.02, -0.38], [-0.22, yBase + 0.06, -0.44], 0.018, 'trim', antiqueBronze);
    addTrussStrut(out, [0.20, yBase - 0.02, -0.38], [0.22, yBase + 0.06, -0.44], 0.018, 'trim', antiqueBronze);

    const starSailGeo = trackGeo(out, createCurvedBladePart(0.58, 0.15, 0.026, 0.18, 0.05, 9));
    out.wingParts.push(
      { geo: starSailGeo, matrix: makeTransform(-0.22, yBase + 0.28, -0.34, -0.22, 0.32, 0.72) },
      { geo: starSailGeo, matrix: makeTransform(0.22, yBase + 0.28, -0.34, -0.22, -0.32, -0.72, -1, 1, 1) },
      { geo: starSailGeo, matrix: makeTransform(-0.28, yBase + 0.06, -0.38, -0.14, 0.28, 1.24, 0.78, 0.78, 0.78) },
      { geo: starSailGeo, matrix: makeTransform(0.28, yBase + 0.06, -0.38, -0.14, -0.28, -1.24, -0.78, 0.78, 0.78) },
    );

    out.headTopLocalY = 1.42;
    out.weaponGlowHex = 0x34d399;
    out.crystalHex = 0x6ee7b7;
    out.crystalOpacity = 0.64;
    out.crystalIntensity = 0.58;
  },

  S19: (_ctx, out) => {
    const solarGold: RgbTriple = [0.86, 0.68, 0.34];
    const deepCopper: RgbTriple = [0.54, 0.34, 0.19];
    const darkForge: RgbTriple = [0.19, 0.20, 0.25];
    const brightBrass: RgbTriple = [0.94, 0.80, 0.48];
    const prismGlow: RgbTriple = [1.0, 0.90, 0.56];
    const lensCrystal: RgbTriple = [1.0, 0.84, 0.42];

    const yBase = 0.54;

    const hubCoreGeo = trackGeo(out, createChamferedHexPart(0.36, 0.26, 0.020));
    hubCoreGeo.rotateX(Math.PI * 0.5);
    const hubRingGeo = trackGeo(out, new THREE.TorusGeometry(0.34, 0.026, 8, 24));
    hubRingGeo.rotateX(Math.PI * 0.5);
    const ventralReactorGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.06, -0.30],
          [0.16, -0.20],
          [0.24, -0.06],
          [0.20, 0.04],
        ],
        12,
      ),
    );
    const ventralCoreGlowGeo = trackGeo(out, new THREE.ConeGeometry(0.11, 0.14, 12));
    ventralCoreGlowGeo.rotateX(Math.PI);

    out.matte.push(
      { geo: hubCoreGeo, matrix: makeTransform(0, yBase, 0), colorRgb: darkForge },
      { geo: ventralReactorGeo, matrix: makeTransform(0, yBase - 0.12, 0), colorRgb: darkForge },
    );
    out.trim.push({ geo: hubRingGeo, matrix: makeTransform(0, yBase + 0.12, 0), colorRgb: brightBrass });
    out.energy.push({ geo: ventralCoreGlowGeo, matrix: makeTransform(0, yBase - 0.40, 0), colorRgb: prismGlow });

    const outriggerPodGeo = trackGeo(out, createChamferedHexPart(0.16, 0.18, 0.014));
    outriggerPodGeo.rotateX(Math.PI * 0.5);
    const podCapGeo = trackGeo(out, createChamferedHexPart(0.11, 0.06, 0.008));
    podCapGeo.rotateX(Math.PI * 0.5);
    const rcsBellGeo = trackGeo(out, new THREE.ConeGeometry(0.065, 0.10, 10));
    rcsBellGeo.rotateX(Math.PI);

    const armAngles = [Math.PI * 0.34, -Math.PI * 0.34, Math.PI];
    const podCoords: Vec3Tuple[] = [];
    for (const ang of armAngles) {
      const px = Math.sin(ang) * 0.48;
      const pz = Math.cos(ang) * 0.48;
      podCoords.push([px, yBase - 0.02, pz]);
      addTrussStrut(out, [Math.sin(ang) * 0.24, yBase + 0.08, Math.cos(ang) * 0.24], [px, yBase + 0.02, pz], 0.032, 'trim', brightBrass);
      addTrussStrut(out, [Math.sin(ang) * 0.22, yBase - 0.08, Math.cos(ang) * 0.22], [px, yBase - 0.06, pz], 0.028, 'matte', darkForge);
      out.armor.push({
        geo: outriggerPodGeo,
        matrix: makeTransform(px, yBase - 0.02, pz, 0, ang, 0),
        colorRgb: solarGold,
      });
      out.trim.push({
        geo: podCapGeo,
        matrix: makeTransform(px, yBase + 0.09, pz, 0, ang, 0),
        colorRgb: brightBrass,
      });
      out.energy.push({
        geo: rcsBellGeo,
        matrix: makeTransform(px, yBase - 0.16, pz),
        colorRgb: prismGlow,
      });
    }
    for (let i = 0; i < 3; i += 1) {
      const pA = podCoords[i]!;
      const pB = podCoords[(i + 1) % 3]!;
      addTrussStrut(out, [pA[0] * 0.84, yBase - 0.02, pA[2] * 0.84], [pB[0] * 0.84, yBase - 0.02, pB[2] * 0.84], 0.018, 'matte', darkForge);
    }

    const gimbalDeckGeo = trackGeo(out, new THREE.CylinderGeometry(0.28, 0.32, 0.16, 14));
    const emitterHousingGeo = trackGeo(out, createChamferedHexPart(0.26, 0.34, 0.018));
    emitterHousingGeo.rotateX(Math.PI * 0.5);
    const capDrumGeo = trackGeo(out, new THREE.CylinderGeometry(0.075, 0.075, 0.24, 12));
    const capGlowRingGeo = trackGeo(out, new THREE.TorusGeometry(0.078, 0.013, 6, 14));
    capGlowRingGeo.rotateX(Math.PI * 0.5);

    out.armor.push(
      { geo: gimbalDeckGeo, matrix: makeTransform(0, yBase + 0.22, 0), colorRgb: deepCopper },
      { geo: emitterHousingGeo, matrix: makeTransform(0, yBase + 0.44, -0.02), colorRgb: solarGold },
    );
    for (const side of [-1, 1] as const) {
      out.matte.push({
        geo: capDrumGeo,
        matrix: makeTransform(side * 0.20, yBase + 0.44, -0.24, 0.18, 0, 0),
        colorRgb: deepCopper,
      });
      out.energy.push({
        geo: capGlowRingGeo,
        matrix: makeTransform(side * 0.20, yBase + 0.48, -0.23, 0.18, 0, 0),
        colorRgb: prismGlow,
      });
    }

    const laserPitch = -0.34;
    const cannonFrame = makeTransform(0, 1.06, 0.02, laserPitch, 0, 0);

    const railGeo = trackGeo(out, createChamferPlate(0.088, 0.11, 0.78, 0.24, 0.24, 0.011));
    const coreBarrelGeo = trackGeo(out, new THREE.CylinderGeometry(0.076, 0.104, 0.78, 12));
    coreBarrelGeo.rotateX(Math.PI * 0.5);
    const apertureRingGeo = trackGeo(out, new THREE.TorusGeometry(0.145, 0.022, 8, 20));
    const prismCrystalGeo = trackGeo(out, createFacetedCrystalPart(0.42, 0.125, 6, 0.52, 0.48));
    prismCrystalGeo.rotateX(Math.PI * 0.5);
    const beamConduitGeo = trackGeo(out, new THREE.CylinderGeometry(0.052, 0.058, 0.74, 12));
    beamConduitGeo.rotateX(Math.PI * 0.5);
    const collimatorCrownGeo = trackGeo(
      out,
      createLathePart(
        [
          [0.095, -0.08],
          [0.145, 0.02],
          [0.185, 0.11],
          [0.140, 0.13],
        ],
        8,
      ),
    );
    collimatorCrownGeo.rotateX(Math.PI * 0.5);
    const muzzlePetalGeo = trackGeo(out, createTrapezoidPlate(0.042, 0.068, 0.14, 0.032, 0.006));
    const emitterCoreOrbGeo = trackGeo(out, new THREE.SphereGeometry(0.088, 12, 10));

    out.matte.push({
      geo: coreBarrelGeo,
      matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, -0.05, 0.30)),
      colorRgb: darkForge,
    });
    out.armor.push(
      {
        geo: railGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(-0.135, 0.02, 0.32)),
        colorRgb: solarGold,
      },
      {
        geo: railGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0.135, 0.02, 0.32)),
        colorRgb: solarGold,
      },
      {
        geo: railGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.145, 0.28)),
        colorRgb: deepCopper,
      },
    );
    out.trim.push(
      {
        geo: apertureRingGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.20)),
        colorRgb: brightBrass,
      },
      {
        geo: apertureRingGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.46)),
        colorRgb: brightBrass,
      },
      {
        geo: collimatorCrownGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.70)),
        colorRgb: brightBrass,
      },
    );
    for (const pang of [0, Math.PI * 0.5, Math.PI, -Math.PI * 0.5]) {
      const pm = cannonFrame
        .clone()
        .multiply(new THREE.Matrix4().makeTranslation(Math.cos(pang) * 0.15, 0.02 + Math.sin(pang) * 0.15, 0.74))
        .multiply(new THREE.Matrix4().makeRotationZ(pang - Math.PI * 0.5))
        .multiply(new THREE.Matrix4().makeRotationX(0.32));
      out.trim.push({ geo: muzzlePetalGeo, matrix: pm, colorRgb: brightBrass });
    }
    out.crystal.push({
      geo: prismCrystalGeo,
      matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.03, 0.36)),
      colorRgb: lensCrystal,
    });
    out.energy.push(
      {
        geo: beamConduitGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.03, 0.34)),
        colorRgb: prismGlow,
      },
      {
        geo: emitterCoreOrbGeo,
        matrix: cannonFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.02, 0.74)),
        colorRgb: prismGlow,
      },
    );

    const heliostatFrameGeo = trackGeo(out, createChamferedHexPart(0.28, 0.044, 0.012));
    const heliostatMirrorGeo = trackGeo(out, createHexMirrorTilePart(0.24, 0.026, 0.014, 0.022));
    const heliostatGlowRimGeo = trackGeo(out, new THREE.TorusGeometry(0.19, 0.012, 6, 6));
    const mirrorBackPodGeo = trackGeo(out, new THREE.CylinderGeometry(0.068, 0.082, 0.08, 10));
    mirrorBackPodGeo.rotateX(Math.PI * 0.5);

    const mirrorConfigs: readonly (readonly [number, number, number, number, number, number, Vec3Tuple])[] = [
      [-0.44, 1.18, -0.08, -0.18, 0.56, 0.14, [-0.20, 1.00, -0.04]],
      [0.44, 1.18, -0.08, -0.18, -0.56, -0.14, [0.20, 1.00, -0.04]],
      [0.0, 1.48, -0.32, 0.36, 0.0, 0.0, [0.0, 1.12, -0.14]],
    ];
    for (const [mx, my, mz, mrx, mry, mrz, anchor] of mirrorConfigs) {
      const mm = makeTransform(mx, my, mz, mrx, mry, mrz);
      out.armor.push({ geo: heliostatFrameGeo, matrix: mm, colorRgb: deepCopper });
      out.matte.push({
        geo: mirrorBackPodGeo,
        matrix: mm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.042)),
        colorRgb: darkForge,
      });
      out.trim.push({
        geo: heliostatMirrorGeo,
        matrix: mm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.028)),
        colorRgb: brightBrass,
      });
      out.energy.push({
        geo: heliostatGlowRimGeo,
        matrix: mm.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.036)),
        colorRgb: prismGlow,
      });
      addTrussStrut(out, anchor, [mx * 0.90, my - 0.04, mz - 0.03], 0.028, 'trim', brightBrass);
      addTrussStrut(out, [anchor[0], anchor[1] - 0.12, anchor[2]], [mx * 0.88, my - 0.10, mz - 0.04], 0.022, 'matte', darkForge);
    }

    const starCoronaGeo = trackGeo(out, createCurvedBladePart(0.68, 0.18, 0.032, 0.20, 0.06, 9));
    out.wingParts.push(
      { geo: starCoronaGeo, matrix: makeTransform(-0.34, 1.36, -0.26, -0.22, 0.34, 0.62) },
      { geo: starCoronaGeo, matrix: makeTransform(0.34, 1.36, -0.26, -0.22, -0.34, -0.62, -1, 1, 1) },
      { geo: starCoronaGeo, matrix: makeTransform(-0.38, 1.08, -0.28, -0.18, 0.30, 1.12, 0.80, 0.80, 0.80) },
      { geo: starCoronaGeo, matrix: makeTransform(0.38, 1.08, -0.28, -0.18, -0.30, -1.12, -0.80, 0.80, 0.80) },
    );

    out.headTopLocalY = 1.88;
    out.weaponGlowHex = 0xfbbf24;
    out.crystalHex = 0xfde047;
    out.crystalOpacity = 0.66;
    out.crystalIntensity = 0.68;
  },
};
