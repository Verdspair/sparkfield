import * as THREE from 'three';
import {
  createBevelExtrudePart,
  createCreatureFin,
  createCurvedBladePart,
  createFlowingRibbonMesh,
  createHexMirrorTilePart,
  createLathePart,
  createOrganicLimb,
  createSculptedClothLathe,
  createTaperedTubePart,
  createTeardropPart,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type Vec3Tuple,
  type RgbTriple,
} from './unitBuilderCore.js';

export const UNIT_PACK_CORE_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S04: (ctx, out) => {
    const liquidSilver: RgbTriple = [0.92, 0.96, 1.00];
    const hullIce: RgbTriple = [0.74, 0.84, 0.94];
    const carbonDark: RgbTriple = [0.16, 0.22, 0.30];
    const goldFoil: RgbTriple = [0.98, 0.82, 0.42];
    const ionCyan: RgbTriple = [0.34, 0.92, 1.00];
    const deepIon: RgbTriple = [0.14, 0.46, 0.98];

    const craft = makeTransform(0.02, 0.92, 0.04, -0.10, -0.44, 0.14);

    const fuselage = trackGeo(
      out,
      createTeardropPart(1.14, 0.142, 1.48, 36, 28, 0.012, hullIce, liquidSilver),
    );
    out.armor.push({
      geo: fuselage,
      matrix: craft.clone().multiply(makeTransform(0, 0, 0.02, -Math.PI * 0.5, 0, 0, 1.04, 1.0, 0.84)),
    });

    const mliBand = trackGeo(out, new THREE.CylinderGeometry(0.138, 0.146, 0.18, 32));
    out.trim.push({
      geo: mliBand,
      matrix: craft.clone().multiply(makeTransform(0, 0, 0.08, Math.PI * 0.5, 0, 0, 1.04, 1.0, 0.84)),
      colorRgb: goldFoil,
    });

    const sensorSpine = trackGeo(
      out,
      createOrganicLimb(
        [
          [0, 0.098, 0.34],
          [0, 0.118, 0.04],
          [0, 0.072, -0.34],
        ],
        0.024,
        0.032,
        0.016,
        18,
        12,
        carbonDark,
        carbonDark,
      ),
    );
    out.matte.push({ geo: sensorSpine, matrix: craft });

    const dishProfile: readonly (readonly [number, number])[] = [
      [0.005, 0.0],
      [0.055, 0.012],
      [0.118, 0.036],
      [0.172, 0.074],
      [0.192, 0.098],
    ];
    const dishGeo = trackGeo(out, createSculptedClothLathe(dishProfile, 36, 0, 0, 0.5, [0.96, 0.78, 0.36], [1.0, 0.90, 0.56]));
    const dishMat = craft.clone().multiply(makeTransform(0, 0.02, 0.44, Math.PI * 0.5, 0, 0));
    out.trim.push({ geo: dishGeo, matrix: dishMat });

    const dishRim = trackGeo(out, new THREE.TorusGeometry(0.192, 0.008, 10, 36));
    out.armor.push({
      geo: dishRim,
      matrix: dishMat.clone().multiply(makeTransform(0, 0.098, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: liquidSilver,
    });

    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const strut = trackGeo(
        out,
        createOrganicLimb(
          [
            [Math.cos(a) * 0.18, 0.09, Math.sin(a) * 0.18],
            [Math.cos(a) * 0.07, 0.16, Math.sin(a) * 0.07],
            [0, 0.22, 0],
          ],
          0.006,
          0.005,
          0.004,
          10,
          8,
        ),
      );
      out.matte.push({ geo: strut, matrix: dishMat, colorRgb: carbonDark });
    }
    const feedTip = trackGeo(out, new THREE.SphereGeometry(0.024, 14, 12));
    out.energy.push({
      geo: feedTip,
      matrix: dishMat.clone().multiply(makeTransform(0, 0.23, 0)),
      colorRgb: ionCyan,
    });

    const wingCore = trackGeo(out, createCreatureFin(0.28, 0.68, 0.42, 0.045, 0.022, 20, 10, liquidSilver, hullIce));
    const wingSail = trackGeo(out, createCreatureFin(0.22, 0.74, 0.48, 0.048, 0.008, 20, 10, ionCyan, deepIon));
    const tailFin = trackGeo(out, createCreatureFin(0.16, 0.24, 0.16, 0.022, 0.014, 14, 8, hullIce, liquidSilver));

    for (const side of [-1, 1] as const) {
      const mirrorMat = craft.clone().multiply(makeTransform(side * 0.09, 0.0, 0.06, 0, 0, side * 0.08, side, 1, 1));
      out.armor.push({ geo: wingCore, matrix: mirrorMat });
      out.crystal.push({
        geo: wingSail,
        matrix: craft.clone().multiply(makeTransform(side * 0.10, -0.004, -0.03, 0, 0, side * 0.08, side, 1, 1)),
      });

      const leadingEdge = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.11, 0.0, 0.14],
            [side * 0.44, 0.045, -0.08],
            [side * 0.76, 0.040, -0.34],
          ],
          0.014,
          0.010,
          0.005,
          16,
          10,
        ),
      );
      out.trim.push({ geo: leadingEdge, matrix: craft, colorRgb: goldFoil });

      const radStrip = trackGeo(
        out,
        createOrganicLimb(
          [
            [side * 0.14, 0.006, 0.04],
            [side * 0.44, 0.046, -0.17],
            [side * 0.70, 0.038, -0.40],
          ],
          0.010,
          0.008,
          0.004,
          14,
          8,
        ),
      );
      out.energy.push({ geo: radStrip, matrix: craft, colorRgb: ionCyan });

      out.armor.push({
        geo: tailFin,
        matrix: craft.clone().multiply(makeTransform(side * 0.04, 0.04, -0.36, 0, 0, side * 0.92, side, 1, 1)),
      });
    }

    const nozzleProfile: readonly (readonly [number, number])[] = [
      [0.082, 0.0],
      [0.062, -0.05],
      [0.078, -0.12],
      [0.096, -0.17],
    ];
    const nozzleGeo = trackGeo(out, createSculptedClothLathe(nozzleProfile, 28, 0, 0, 0.5, carbonDark, goldFoil));
    out.trim.push({
      geo: nozzleGeo,
      matrix: craft.clone().multiply(makeTransform(0, 0, -0.44, -Math.PI * 0.5, 0, 0)),
    });

    const hallCore = trackGeo(out, createTeardropPart(0.46, 0.068, 1.6, 24, 18, 0, [0.86, 0.98, 1.0], ionCyan));
    out.energy.push({
      geo: hallCore,
      matrix: craft.clone().multiply(makeTransform(0, 0, -0.68, -Math.PI * 0.5, 0, 0)),
    });

    for (const phase of [0, Math.PI]) {
      const wakePts: Vec3Tuple[] = [];
      for (let k = 0; k <= 8; k += 1) {
        const f = k / 8;
        const r = 0.045 + f * 0.055;
        const a = phase + f * Math.PI * 1.4;
        wakePts.push([Math.cos(a) * r, Math.sin(a) * r, -0.54 - f * 0.58]);
      }
      const wakeRibbon = trackGeo(
        out,
        createFlowingRibbonMesh(wakePts, [0.052, 0.042, 0.008], 0.010, 1.8, 28, 4, 0, [0.76, 0.98, 1.0], deepIon),
      );
      out.crystal.push({ geo: wakeRibbon, matrix: craft });
    }

    out.crystalHex = 0x38bdf8;
    out.crystalOpacity = 0.54;
    out.crystalIntensity = 0.62;
    out.weaponGlowHex = 0x38bdf8;
    out.headTopLocalY = 1.44;
  },
  S16: (ctx, out) => {
    const mirrorGoldCore: RgbTriple = [1.00, 0.88, 0.48];
    const mirrorGoldRim: RgbTriple = [0.92, 0.68, 0.24];
    const ceramicWhite: RgbTriple = [0.93, 0.96, 1.00];
    const carbonDark: RgbTriple = [0.16, 0.20, 0.28];
    const solarCore: RgbTriple = [1.00, 0.94, 0.72];
    const cyanThruster: RgbTriple = [0.36, 0.90, 1.00];

    const arrayCenter = new THREE.Vector3(0, 0.96, -0.04);
    const arrayRoot = makeTransform(arrayCenter.x, arrayCenter.y, arrayCenter.z, -0.14, 0.14, 0);

    const tileRadius = 0.114;
    const tileStep = tileRadius * Math.sqrt(3) * 1.035;
    const focalRadius = 2.05;
    const hexTile = trackGeo(out, createHexMirrorTilePart(tileRadius, 0.024, 0.011, 0.010, mirrorGoldCore, mirrorGoldRim));
    const backTile = trackGeo(out, createHexMirrorTilePart(tileRadius * 0.92, 0.016, 0.008, 0));

    const axialCoords: readonly (readonly [number, number])[] = [
      [0, 0],
      [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
      [2, 0], [2, -1], [2, -2], [1, -2], [0, -2], [-1, -1],
      [-2, 0], [-2, 1], [-2, 2], [-1, 2], [0, 2], [1, 1],
    ];

    const upVec = new THREE.Vector3(0, 0, 1);
    const lookDir = new THREE.Vector3();
    const focalPointLocal = new THREE.Vector3(0, 0, 0.64);
    const qAlign = new THREE.Quaternion();

    for (const [q, r] of axialCoords) {
      const lx = tileStep * (q + r * 0.5);
      const ly = tileStep * (r * Math.sqrt(3) * 0.5);
      const r2 = lx * lx + ly * ly;
      const lz = (r2) / (2 * focalRadius);

      lookDir.set(focalPointLocal.x - lx, focalPointLocal.y - ly, focalPointLocal.z - lz).normalize();
      qAlign.setFromUnitVectors(upVec, lookDir);
      const localM = new THREE.Matrix4().compose(new THREE.Vector3(lx, ly, lz), qAlign, new THREE.Vector3(1, 1, 1));
      const worldM = arrayRoot.clone().multiply(localM);

      out.trim.push({ geo: hexTile, matrix: worldM });
      out.matte.push({
        geo: backTile,
        matrix: worldM.clone().multiply(makeTransform(0, 0, -0.022)),
        colorRgb: carbonDark,
      });
    }

    const backRing = trackGeo(out, new THREE.TorusGeometry(0.42, 0.016, 12, 36));
    out.matte.push({
      geo: backRing,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, -0.045)),
      colorRgb: carbonDark,
    });
    const backRingInner = trackGeo(out, new THREE.TorusGeometry(0.22, 0.014, 10, 24));
    out.armor.push({
      geo: backRingInner,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, -0.065)),
      colorRgb: ceramicWhite,
    });

    const strutAngles = [Math.PI * 0.5, Math.PI * 0.5 + (Math.PI * 2) / 3, Math.PI * 0.5 + (Math.PI * 4) / 3];
    for (const a of strutAngles) {
      const rx = Math.cos(a) * 0.44;
      const ry = Math.sin(a) * 0.44;
      const strut = trackGeo(
        out,
        createOrganicLimb(
          [
            [rx, ry, 0.05],
            [rx * 0.56, ry * 0.56, 0.36],
            [rx * 0.14, ry * 0.14, 0.62],
          ],
          0.014,
          0.011,
          0.008,
          16,
          10,
        ),
      );
      out.matte.push({ geo: strut, matrix: arrayRoot, colorRgb: carbonDark });
    }

    const secHousing = trackGeo(out, createTeardropPart(0.14, 0.072, 1.15, 24, 16, 0, ceramicWhite, mirrorGoldCore));
    out.armor.push({
      geo: secHousing,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, 0.65, -Math.PI * 0.5, 0, 0)),
    });
    const secRing = trackGeo(out, new THREE.TorusGeometry(0.088, 0.012, 12, 30));
    out.trim.push({
      geo: secRing,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, 0.62)),
      colorRgb: mirrorGoldCore,
    });

    const focalStar = trackGeo(out, new THREE.SphereGeometry(0.062, 22, 18));
    out.energy.push({
      geo: focalStar,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, 0.57)),
      colorRgb: solarCore,
    });

    const beamConeProfile: readonly (readonly [number, number])[] = [
      [0.39, 0.06],
      [0.24, 0.30],
      [0.052, 0.57],
    ];
    const beamCone = trackGeo(out, createSculptedClothLathe(beamConeProfile, 32, 0, 0, 0.5, [1.0, 0.78, 0.30], [1.0, 0.96, 0.80]));
    out.crystal.push({
      geo: beamCone,
      matrix: arrayRoot.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
    });

    const busProfile: readonly (readonly [number, number])[] = [
      [0.012, 0.0],
      [0.145, 0.04],
      [0.165, 0.14],
      [0.118, 0.28],
      [0.086, 0.42],
      [0.132, 0.52],
    ];
    const busGeo = trackGeo(out, createSculptedClothLathe(busProfile, 32, 0, 0, 0.5, [0.76, 0.82, 0.90], ceramicWhite));
    out.armor.push({
      geo: busGeo,
      matrix: makeTransform(0, 0.18, -0.18, 0.22, 0.14, 0),
    });

    const gyroRing = trackGeo(out, new THREE.TorusGeometry(0.28, 0.014, 12, 40));
    out.trim.push({
      geo: gyroRing,
      matrix: makeTransform(0, 0.28, -0.06, Math.PI * 0.5, 0, 0),
      colorRgb: mirrorGoldCore,
    });

    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      const px = Math.cos(a) * 0.28;
      const pz = -0.06 + Math.sin(a) * 0.28;
      const pod = trackGeo(out, new THREE.SphereGeometry(0.024, 12, 10));
      out.armor.push({
        geo: pod,
        matrix: makeTransform(px, 0.28, pz),
        colorRgb: ceramicWhite,
      });
      const jet = trackGeo(out, new THREE.SphereGeometry(0.014, 10, 8));
      out.energy.push({
        geo: jet,
        matrix: makeTransform(px, 0.255, pz),
        colorRgb: cyanThruster,
      });
    }

    out.crystalHex = 0xffd166;
    out.crystalOpacity = 0.26;
    out.crystalIntensity = 0.55;
    out.weaponGlowHex = 0xfde047;
    out.headTopLocalY = 1.56;
  },
  S33: (ctx, out) => {
    const porcelain: RgbTriple = [0.94, 0.96, 1.0];
    const voidObsidian: RgbTriple = [0.012, 0.015, 0.028];
    const darkCarbon: RgbTriple = [0.14, 0.18, 0.26];
    const penroseGold: RgbTriple = [0.99, 0.83, 0.40];
    const amberGlow: RgbTriple = [1.0, 0.78, 0.30];
    const whiteGoldGlow: RgbTriple = [1.0, 0.95, 0.72];

    const centerY = 0.98;
    const diskTilt = makeTransform(0, centerY, 0, 0.28, 0.18, -0.14);

    const singularity = trackGeo(out, new THREE.SphereGeometry(0.245, 16, 12));
    out.matte.push({
      geo: singularity,
      matrix: makeTransform(0, centerY, 0),
      colorRgb: voidObsidian,
    });

    const photonSphereRing = trackGeo(out, new THREE.TorusGeometry(0.272, 0.011, 6, 24));
    const accretionDiscRing = trackGeo(out, new THREE.TorusGeometry(0.365, 0.018, 5, 24));
    accretionDiscRing.rotateX(Math.PI * 0.5);
    out.energy.push(
      { geo: photonSphereRing, matrix: makeTransform(0, centerY, 0, 0.08, 0.38, 0), colorRgb: whiteGoldGlow },
      { geo: accretionDiscRing, matrix: diskTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 0.28, 1.0)), colorRgb: amberGlow },
    );

    const outerCollectorRing = trackGeo(out, new THREE.TorusGeometry(0.62, 0.042, 6, 26));
    outerCollectorRing.rotateX(Math.PI * 0.5);
    const outerGoldRail = trackGeo(out, new THREE.TorusGeometry(0.665, 0.014, 5, 24));
    outerGoldRail.rotateX(Math.PI * 0.5);
    const innerGoldRail = trackGeo(out, new THREE.TorusGeometry(0.568, 0.012, 5, 24));
    innerGoldRail.rotateX(Math.PI * 0.5);
    const secondaryGyroRing = trackGeo(out, new THREE.TorusGeometry(0.54, 0.015, 5, 22));

    out.armor.push({
      geo: outerCollectorRing,
      matrix: diskTilt.clone().multiply(makeTransform(0, 0, 0, 0, 0, 0, 1.0, 0.56, 1.0)),
      colorRgb: porcelain,
    });
    out.trim.push(
      { geo: outerGoldRail, matrix: diskTilt.clone().multiply(makeTransform(0, 0.022, 0)), colorRgb: penroseGold },
      { geo: outerGoldRail, matrix: diskTilt.clone().multiply(makeTransform(0, -0.022, 0)), colorRgb: penroseGold },
      { geo: innerGoldRail, matrix: diskTilt, colorRgb: penroseGold },
      { geo: secondaryGyroRing, matrix: makeTransform(0, centerY, 0, -0.52, -0.44, 0.36), colorRgb: penroseGold },
    );

    const einsteinArch = trackGeo(out, new THREE.TorusGeometry(0.415, 0.011, 5, 24));
    out.energy.push({
      geo: einsteinArch,
      matrix: makeTransform(0, centerY, 0, 0.10, 0.32, 0),
      colorRgb: amberGlow,
    });

    const towerBody = trackGeo(out, createBevelExtrudePart(
      [
        [-0.046, -0.10],
        [0.046, -0.10],
        [0.034, 0.06],
        [0.012, 0.15],
        [-0.012, 0.15],
        [-0.034, 0.06],
      ],
      0.068,
      0.007,
      0.007,
      1,
      2,
    ));
    const towerSpire = trackGeo(out, createCurvedBladePart(0.18, 0.042, 0.014, -0.055, 0.015, 5));
    const towerNode = trackGeo(out, new THREE.OctahedronGeometry(0.028, 0));

    for (let i = 0; i < 6; i += 1) {
      const ang = (i / 6) * Math.PI * 2;
      const tx = Math.cos(ang) * 0.62;
      const tz = Math.sin(ang) * 0.62;
      const tMat = diskTilt.clone().multiply(makeTransform(tx, 0.03, tz, 0, -ang + Math.PI * 0.5, 0));
      out.armor.push({ geo: towerBody, matrix: tMat, colorRgb: porcelain });
      out.matte.push({
        geo: towerBody,
        matrix: tMat.clone().multiply(makeTransform(0, -0.05, 0, 0, 0, 0, 1.15, 0.52, 1.12)),
        colorRgb: darkCarbon,
      });
      out.trim.push({
        geo: towerSpire,
        matrix: tMat.clone().multiply(makeTransform(0, 0.08, -0.025, -0.45, Math.PI * 0.5, 0)),
        colorRgb: penroseGold,
      });
      out.energy.push({
        geo: towerNode,
        matrix: tMat.clone().multiply(makeTransform(0, 0.02, -0.068)),
        colorRgb: whiteGoldGlow,
      });
    }

    for (let s = 0; s < 3; s += 1) {
      const phase = (s / 3) * Math.PI * 2;
      const pts: [number, number, number][] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const a = phase + t * Math.PI * 1.65;
        const r = 0.53 - t * 0.23;
        const y = Math.sin(t * Math.PI * 2 + phase) * 0.030;
        pts.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      const ribbon = trackGeo(out, createTaperedTubePart(pts, 0.015, 0.0045, 14, 5));
      out.energy.push({ geo: ribbon, matrix: diskTilt, colorRgb: s === 0 ? whiteGoldGlow : amberGlow });
    }

    const jetCoreGeo = trackGeo(out, createLathePart(
      [
        [0.022, 0.24],
        [0.052, 0.36],
        [0.034, 0.62],
        [0.014, 0.84],
        [0.002, 0.94],
      ],
      10,
    ));
    const magRingA = trackGeo(out, new THREE.TorusGeometry(0.145, 0.012, 5, 14));
    magRingA.rotateX(Math.PI * 0.5);
    const magRingB = trackGeo(out, new THREE.TorusGeometry(0.095, 0.009, 5, 12));
    magRingB.rotateX(Math.PI * 0.5);

    for (const dir of [1, -1] as const) {
      const jetMat = diskTilt.clone().multiply(makeTransform(0, 0, 0, dir === 1 ? 0 : Math.PI, 0, 0));
      out.energy.push({ geo: jetCoreGeo, matrix: jetMat, colorRgb: whiteGoldGlow });
      out.trim.push(
        { geo: magRingA, matrix: jetMat.clone().multiply(makeTransform(0, 0.42, 0)), colorRgb: penroseGold },
        { geo: magRingB, matrix: jetMat.clone().multiply(makeTransform(0, 0.64, 0)), colorRgb: penroseGold },
      );
      out.armor.push({
        geo: magRingA,
        matrix: jetMat.clone().multiply(makeTransform(0, 0.42, 0, 0, 0, 0, 1.18, 0.72, 1.18)),
        colorRgb: porcelain,
      });

      const helixPts: [number, number, number][] = [];
      for (let k = 0; k <= 10; k += 1) {
        const t = k / 10;
        const a = t * Math.PI * 2.5;
        const r = 0.095 * (1 - t * 0.55);
        helixPts.push([Math.cos(a) * r, 0.28 + t * 0.56, Math.sin(a) * r]);
      }
      const helix = trackGeo(out, createTaperedTubePart(helixPts, 0.009, 0.003, 12, 5));
      out.energy.push({ geo: helix, matrix: jetMat, colorRgb: amberGlow });
    }

    out.headTopLocalY = 1.98;
    out.weaponGlowHex = 0xf5c451;
  },
};
