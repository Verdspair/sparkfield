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
  makeSegmentTransform,
  makeTransform,
  trackGeo,
  type BespokeUnitBuilder,
  type GeometryPartSpec,
  type RgbTriple,
  type UnitBlueprintParts,
  type Vec3Tuple,
} from './unitBuilderCore.js';

function pushGeo(
  bucket: GeometryPartSpec[],
  out: UnitBlueprintParts,
  geo: THREE.BufferGeometry,
  matrix?: THREE.Matrix4,
  colorRgb?: RgbTriple,
): void {
  trackGeo(out, geo);
  bucket.push(matrix ? { geo, matrix, colorRgb } : { geo, colorRgb });
}

function pushStrut(
  bucket: GeometryPartSpec[],
  out: UnitBlueprintParts,
  start: Vec3Tuple,
  end: Vec3Tuple,
  radiusTop: number,
  radiusBot: number,
  colorRgb: RgbTriple,
  radialSegs = 8,
): void {
  const geo = trackGeo(out, new THREE.CylinderGeometry(radiusTop, radiusBot, 1, radialSegs));
  const mat = makeSegmentTransform(
    new THREE.Vector3(start[0], start[1], start[2]),
    new THREE.Vector3(end[0], end[1], end[2]),
    1,
    1,
  );
  bucket.push({ geo, matrix: mat, colorRgb });
}

function createBillowingSailGeometry(
  widthBottom: number,
  widthTop: number,
  height: number,
  bellyDepth: number,
  rakeX: number,
  colorBot: RgbTriple,
  colorTop: RgbTriple,
): THREE.BufferGeometry {
  const segU = 12;
  const segV = 14;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const halfThick = 0.006;

  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? 1 : -1;
    const base = side * (segU + 1) * (segV + 1);
    for (let iv = 0; iv <= segV; iv += 1) {
      const v = iv / segV;
      const y = v * height;
      const w = widthBottom + (widthTop - widthBottom) * Math.pow(v, 0.85);
      const centerShiftX = rakeX * Math.pow(v, 1.25);
      const r = colorBot[0] + (colorTop[0] - colorBot[0]) * v;
      const g = colorBot[1] + (colorTop[1] - colorBot[1]) * v;
      const b = colorBot[2] + (colorTop[2] - colorBot[2]) * v;

      for (let iu = 0; iu <= segU; iu += 1) {
        const u = iu / segU;
        const s = u * 2 - 1;
        const x = centerShiftX + s * w * 0.5;
        const windBell = Math.sin(u * Math.PI) * Math.sin(v * Math.PI * 0.92 + 0.08);
        const z = windBell * bellyDepth + sign * halfThick;
        positions.push(x, y, z);
        uvs.push(u, v);
        colors.push(r, g, b);
      }
    }

    const stride = segU + 1;
    for (let iv = 0; iv < segV; iv += 1) {
      for (let iu = 0; iu < segU; iu += 1) {
        const a = base + iv * stride + iu;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        if (side === 0) {
          indices.push(a, b, d, a, d, c);
        } else {
          indices.push(a, d, b, a, c, d);
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const buildS20Michael: BespokeUnitBuilder = (_ctx, out) => {
  const ceramicWhite: RgbTriple = [0.87, 0.91, 0.96];
  const ceramicShade: RgbTriple = [0.71, 0.78, 0.88];
  const slateMatte: RgbTriple = [0.22, 0.30, 0.43];
  const deepSlate: RgbTriple = [0.15, 0.21, 0.32];
  const silverTrim: RgbTriple = [0.79, 0.85, 0.92];
  const champGold: RgbTriple = [0.82, 0.76, 0.62];
  const cyanGlow: RgbTriple = [0.46, 0.85, 0.96];
  const crystalCyan: RgbTriple = [0.68, 0.90, 0.98];

  out.headTopLocalY = 1.96;
  out.weaponGlowHex = 0x52c8ec;
  out.crystalHex = 0x62d2f2;
  out.crystalOpacity = 0.64;
  out.crystalIntensity = 0.56;

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.32, 0.011, 8, 36),
    makeTransform(0, 0.08, 0, Math.PI * 0.5, 0, 0),
    cyanGlow,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.20, 0.012, 8, 28),
    makeTransform(0, 0.11, 0, Math.PI * 0.5, 0, 0),
    silverTrim,
  );

  const shaftGeo = createLathePart(
    [
      [0.008, 0.14],
      [0.044, 0.34],
      [0.030, 0.66],
      [0.056, 0.94],
      [0.072, 1.18],
      [0.048, 1.38],
      [0.026, 1.62],
      [0.006, 1.92],
    ],
    14,
  );
  pushGeo(out.armor, out, shaftGeo, undefined, ceramicWhite);

  pushGeo(
    out.matte,
    out,
    new THREE.CylinderGeometry(0.038, 0.048, 0.52, 8),
    makeTransform(0, 0.96, 0),
    slateMatte,
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.115, 0.056, 0.010, 0.055),
    makeTransform(0, 1.24, 0, Math.PI * 0.5, 0, 0),
    champGold,
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.095, 0.042, 0.008, 0.046),
    makeTransform(0, 0.86, 0, Math.PI * 0.5, 0, 0),
    silverTrim,
  );
  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.34, 0.072, 6, 0.58, 0.42, cyanGlow, crystalCyan),
    makeTransform(0, 1.06, 0.03),
  );

  const spearBlade = trackGeo(out, createCurvedBladePart(0.68, 0.135, 0.032, 0.075, 0.024, 10));
  out.armor.push({ geo: spearBlade, matrix: makeTransform(-0.048, 1.24, 0.01, 0, 0, 0.07), colorRgb: ceramicWhite });
  out.armor.push({ geo: spearBlade, matrix: makeTransform(0.048, 1.24, 0.01, 0, Math.PI, -0.07), colorRgb: ceramicWhite });

  const innerEdge = trackGeo(out, createCurvedBladePart(0.58, 0.052, 0.018, 0.042, 0.014, 8));
  out.energy.push({ geo: innerEdge, matrix: makeTransform(-0.026, 1.28, 0.024, 0, 0, 0.04), colorRgb: cyanGlow });
  out.energy.push({ geo: innerEdge, matrix: makeTransform(0.026, 1.28, 0.024, 0, Math.PI, -0.04), colorRgb: cyanGlow });

  const lowerFin = trackGeo(out, createCurvedBladePart(0.42, 0.085, 0.024, 0.06, 0.02, 8));
  out.armor.push({ geo: lowerFin, matrix: makeTransform(-0.028, 0.62, 0, Math.PI, 0, -0.08), colorRgb: ceramicShade });
  out.armor.push({ geo: lowerFin, matrix: makeTransform(0.028, 0.62, 0, Math.PI, Math.PI, 0.08), colorRgb: ceramicShade });
  pushGeo(
    out.trim,
    out,
    new THREE.ConeGeometry(0.042, 0.22, 6),
    makeTransform(0, 0.19, 0, Math.PI, 0, 0),
    silverTrim,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [-0.68, 0.018],
        [-0.36, 0.052],
        [0, 0.072],
        [0.36, 0.052],
        [0.68, 0.018],
        [0.64, -0.028],
        [0.24, -0.012],
        [0, -0.036],
        [-0.24, -0.012],
        [-0.64, -0.028],
      ],
      0.046,
      0.010,
      0.010,
      2,
      6,
    ),
    makeTransform(0, 1.24, 0, 0, 0, -0.055),
    ceramicWhite,
  );
  pushGeo(
    out.trim,
    out,
    createBevelExtrudePart(
      [
        [-0.72, 0.008],
        [-0.30, 0.028],
        [0, 0.038],
        [0.30, 0.028],
        [0.72, 0.008],
        [0.72, -0.008],
        [0, 0.012],
        [-0.72, -0.008],
      ],
      0.058,
      0.006,
      0.006,
      1,
      4,
    ),
    makeTransform(0, 1.26, 0.01, 0, 0, -0.055),
    champGold,
  );
  pushGeo(
    out.matte,
    out,
    new THREE.OctahedronGeometry(0.105, 0),
    makeTransform(0, 1.24, 0, 0, Math.PI * 0.25, 0, 1.15, 0.85, 0.92),
    deepSlate,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.145, 0.012, 8, 28),
    makeTransform(0, 1.24, 0.03, 0, 0, 0),
    cyanGlow,
  );

  pushStrut(out.trim, out, [-0.54, 1.27, 0], [-0.14, 1.48, 0], 0.011, 0.011, silverTrim, 6);
  pushStrut(out.trim, out, [0.54, 1.21, 0], [0.14, 1.48, 0], 0.011, 0.011, silverTrim, 6);
  pushStrut(out.matte, out, [-0.46, 1.23, -0.02], [-0.08, 0.98, -0.02], 0.012, 0.012, slateMatte, 6);
  pushStrut(out.matte, out, [0.46, 1.17, -0.02], [0.08, 0.98, -0.02], 0.012, 0.012, slateMatte, 6);

  const wingOffsets: readonly (readonly [number, number, number, number, number])[] = [
    [0.14, 1.38, -0.09, 0.44, 0.34],
    [0.18, 1.22, -0.12, 0.54, 0.06],
    [0.15, 1.06, -0.10, 0.42, -0.24],
  ];
  for (const [wx, wy, wz, span, tilt] of wingOffsets) {
    const finR = trackGeo(
      out,
      createCreatureFin(0.15, span, 0.22, 0.028, 0.018, 12, 6, ceramicWhite, ceramicShade),
    );
    out.armor.push({ geo: finR, matrix: makeTransform(wx, wy, wz, 0.14, -0.28, tilt) });
    out.armor.push({
      geo: finR,
      matrix: makeTransform(-wx, wy, wz, 0.14, 0.28, -tilt, -1, 1, 1),
    });
  }

  const panConfigs: readonly (readonly [number, number, number, number])[] = [
    [-0.60, 1.27, 0.78, 0.18],
    [0.60, 1.20, 0.68, -0.22],
  ];
  for (const [px, anchorY, panY, ringTilt] of panConfigs) {
    pushGeo(
      out.trim,
      out,
      new THREE.OctahedronGeometry(0.044, 0),
      makeTransform(px, anchorY, 0),
      champGold,
    );

    const cableCount = 3;
    for (let c = 0; c < cableCount; c += 1) {
      const ang = (c / cableCount) * Math.PI * 2 + Math.PI * 0.16;
      const cx = px + Math.cos(ang) * 0.185;
      const cz = Math.sin(ang) * 0.185;
      pushStrut(out.trim, out, [px, anchorY - 0.02, 0], [cx, panY + 0.02, cz], 0.007, 0.007, silverTrim, 6);
    }

    const dishGeo = createLathePart(
      [
        [0.004, -0.055],
        [0.11, -0.042],
        [0.21, 0.008],
        [0.23, 0.028],
        [0.19, 0.028],
        [0.12, -0.012],
        [0.004, -0.022],
      ],
      18,
    );
    pushGeo(out.armor, out, dishGeo, makeTransform(px, panY, 0), ceramicWhite);

    pushGeo(
      out.trim,
      out,
      new THREE.TorusGeometry(0.24, 0.014, 8, 28),
      makeTransform(px, panY + 0.01, 0, Math.PI * 0.5 + ringTilt, 0.12, 0),
      champGold,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.18, 0.010, 8, 24),
      makeTransform(px, panY + 0.055, 0, Math.PI * 0.5 - ringTilt * 0.7, 0, 0),
      cyanGlow,
    );
    pushGeo(
      out.crystal,
      out,
      createFacetedCrystalPart(0.21, 0.068, 6, 0.62, 0.38, cyanGlow, crystalCyan),
      makeTransform(px, panY + 0.14, 0, 0, ringTilt, 0),
    );
    pushGeo(
      out.matte,
      out,
      new THREE.ConeGeometry(0.056, 0.12, 6),
      makeTransform(px, panY - 0.09, 0, Math.PI, 0, 0),
      deepSlate,
    );
  }

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.38, 0.016, 10, 36),
    makeTransform(0, 1.38, -0.16, 0.24, 0.10, 0),
    silverTrim,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.32, 0.010, 8, 32),
    makeTransform(0, 1.38, -0.16, -0.16, -0.14, 0),
    cyanGlow,
  );

  for (let i = 0; i < 6; i += 1) {
    const ang = (i / 6) * Math.PI * 2;
    const rx = Math.cos(ang) * 0.38;
    const ry = 1.38 + Math.sin(ang) * 0.37;
    pushGeo(
      out.trim,
      out,
      new THREE.OctahedronGeometry(0.028, 0),
      makeTransform(rx, ry, -0.16),
      champGold,
    );
  }

  const s3Wing = trackGeo(out, createCreatureFin(0.22, 0.64, 0.28, 0.04, 0.022, 12, 6));
  out.wingParts.push({ geo: s3Wing, matrix: makeTransform(0.18, 1.46, -0.22, 0.15, -0.25, 0.42) });
  out.wingParts.push({ geo: s3Wing, matrix: makeTransform(-0.18, 1.46, -0.22, 0.15, 0.25, -0.42, -1, 1, 1) });
  pushGeo(
    out.wingParts,
    out,
    new THREE.TorusGeometry(0.48, 0.018, 8, 32),
    makeTransform(0, 1.36, -0.22, 0.2, 0, 0),
  );
};

const buildS21Sigma: BespokeUnitBuilder = (_ctx, out) => {
  const ceramicWhite: RgbTriple = [0.88, 0.92, 0.97];
  const ceramicIce: RgbTriple = [0.73, 0.81, 0.91];
  const slateCore: RgbTriple = [0.20, 0.29, 0.42];
  const silverTrim: RgbTriple = [0.78, 0.84, 0.92];
  const goldVernier: RgbTriple = [0.80, 0.74, 0.60];
  const cyanEnergy: RgbTriple = [0.44, 0.86, 0.98];
  const crystalBlue: RgbTriple = [0.62, 0.88, 0.98];

  out.headTopLocalY = 2.04;
  out.weaponGlowHex = 0x4cccf0;
  out.crystalHex = 0x60d4f4;
  out.crystalOpacity = 0.58;
  out.crystalIntensity = 0.58;

  const coreColGeo = createLathePart(
    [
      [0.012, 0.14],
      [0.14, 0.22],
      [0.068, 0.46],
      [0.096, 0.96],
      [0.064, 1.48],
      [0.12, 1.66],
      [0.010, 1.80],
    ],
    14,
  );
  pushGeo(out.crystal, out, coreColGeo, undefined, crystalBlue);

  pushGeo(
    out.energy,
    out,
    new THREE.CylinderGeometry(0.036, 0.036, 1.46, 10),
    makeTransform(0, 0.96, 0),
    cyanEnergy,
  );
  pushGeo(
    out.armor,
    out,
    createChamferedHexPart(0.20, 0.052, 0.012, 0.08),
    makeTransform(0, 0.16, 0, Math.PI * 0.5, 0, 0),
    ceramicWhite,
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.14, 0.044, 0.010, 0.05),
    makeTransform(0, 1.72, 0, Math.PI * 0.5, 0, 0),
    silverTrim,
  );

  for (let h = 0; h < 3; h += 1) {
    const phase = (h / 3) * Math.PI * 2;
    const helixPts: Vec3Tuple[] = [];
    for (let s = 0; s <= 10; s += 1) {
      const t = s / 10;
      const a = phase + t * Math.PI * 2.4;
      const rad = 0.13 + Math.sin(t * Math.PI) * 0.06;
      helixPts.push([Math.cos(a) * rad, 0.24 + t * 1.42, Math.sin(a) * rad]);
    }
    pushGeo(
      out.energy,
      out,
      createTaperedTubePart(helixPts, 0.013, 0.010, 22, 6),
      undefined,
      cyanEnergy,
    );
  }

  const ringSpecs: readonly (readonly [number, number, number, number])[] = [
    [0.44, 0.48, 0.16, -0.10],
    [0.98, 0.58, -0.14, 0.18],
    [1.48, 0.42, 0.20, 0.14],
  ];
  for (const [ry, rad, rx, rz] of ringSpecs) {
    pushGeo(
      out.trim,
      out,
      new THREE.TorusGeometry(rad, 0.015, 8, 40),
      makeTransform(0, ry, 0, Math.PI * 0.5 + rx, 0, rz),
      silverTrim,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(rad - 0.036, 0.008, 6, 32),
      makeTransform(0, ry, 0, Math.PI * 0.5 + rx, 0, rz),
      cyanEnergy,
    );
    const ringMat = makeTransform(0, ry, 0, Math.PI * 0.5 + rx, 0, rz);
    for (let tick = 0; tick < 6; tick += 1) {
      const ta = (tick / 6) * Math.PI * 2;
      const local = new THREE.Vector3(Math.cos(ta) * (rad + 0.025), Math.sin(ta) * (rad + 0.025), 0);
      local.applyMatrix4(ringMat);
      pushGeo(
        out.trim,
        out,
        new THREE.OctahedronGeometry(0.024, 0),
        makeTransform(local.x, local.y, local.z),
        goldVernier,
      );
    }
  }

  const towers: readonly (readonly [number, number, number, number, number, number])[] = [
    [0.0, 1.06, 0.34, 1.08, 0.10, 0.0],
    [-0.42, 1.18, -0.22, 1.14, -0.08, 0.10],
    [0.42, 0.92, -0.20, 0.98, -0.06, -0.11],
  ];

  for (const [tx, ty, tz, scaleY, tiltX, tiltZ] of towers) {
    const yaw = Math.atan2(-tx, -tz);
    const towerBase = makeTransform(tx, ty, tz, 0, yaw, 0).multiply(
      makeTransform(0, 0, 0, tiltX, 0, tiltZ, 1, scaleY, 1),
    );

    const upperShell = createFacetedCrystalPart(0.56, 0.175, 4, 0.72, 0.28, ceramicIce, ceramicWhite);
    pushGeo(
      out.armor,
      out,
      upperShell,
      towerBase.clone().multiply(makeTransform(0, 0.24, 0, 0, Math.PI * 0.25, 0)),
    );

    const lowerShell = createFacetedCrystalPart(0.52, 0.165, 4, 0.28, 0.72, ceramicWhite, ceramicIce);
    pushGeo(
      out.armor,
      out,
      lowerShell,
      towerBase.clone().multiply(makeTransform(0, -0.24, 0, 0, Math.PI * 0.25, 0)),
    );

    pushGeo(
      out.matte,
      out,
      new THREE.OctahedronGeometry(0.125, 0),
      towerBase.clone().multiply(makeTransform(0, 0, 0, 0, Math.PI * 0.25, 0, 1, 1.55, 1)),
      slateCore,
    );

    pushGeo(
      out.crystal,
      out,
      createFacetedCrystalPart(0.32, 0.12, 6, 0.5, 0.5, cyanEnergy, crystalBlue),
      towerBase.clone().multiply(makeTransform(0, 0, 0)),
    );

    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.18, 0.036, 0.008, 0.12),
      towerBase.clone().multiply(makeTransform(0, 0.08, 0, Math.PI * 0.5, 0, 0)),
      silverTrim,
    );
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.18, 0.036, 0.008, 0.12),
      towerBase.clone().multiply(makeTransform(0, -0.08, 0, Math.PI * 0.5, 0, 0)),
      goldVernier,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.ConeGeometry(0.032, 0.18, 4),
      towerBase.clone().multiply(makeTransform(0, 0.62, 0)),
      silverTrim,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.ConeGeometry(0.032, 0.18, 4),
      towerBase.clone().multiply(makeTransform(0, -0.60, 0, Math.PI, 0, 0)),
      silverTrim,
    );

    const sidePetal = trackGeo(
      out,
      createPetalPart(0.34, 0.11, 0.022, 0.03, 1.35, 10, 6, ceramicWhite, ceramicIce),
    );
    out.armor.push({
      geo: sidePetal,
      matrix: towerBase.clone().multiply(makeTransform(0.16, -0.02, 0, 0, Math.PI * 0.5, -0.28)),
    });
    out.armor.push({
      geo: sidePetal,
      matrix: towerBase.clone().multiply(makeTransform(-0.16, -0.02, 0, 0, -Math.PI * 0.5, 0.28)),
    });

    pushStrut(out.energy, out, [tx, ty, tz], [0, ty, 0], 0.011, 0.011, cyanEnergy, 6);
  }

  pushStrut(out.energy, out, [0, 1.06, 0.34], [-0.42, 1.18, -0.22], 0.009, 0.009, cyanEnergy, 6);
  pushStrut(out.energy, out, [0, 1.06, 0.34], [0.42, 0.92, -0.20], 0.009, 0.009, cyanEnergy, 6);
  pushStrut(out.energy, out, [-0.42, 1.18, -0.22], [0.42, 0.92, -0.20], 0.009, 0.009, cyanEnergy, 6);

  for (let w = 0; w < 3; w += 1) {
    const ang = (w / 3) * Math.PI * 2 + Math.PI * 0.5;
    pushGeo(
      out.wingParts,
      out,
      createFacetedCrystalPart(0.46, 0.11, 4, 0.65, 0.35),
      makeTransform(Math.cos(ang) * 0.64, 1.32, Math.sin(ang) * 0.54 - 0.1, 0.12, -ang, 0.24),
    );
  }
};

const buildS22Vick: BespokeUnitBuilder = (_ctx, out) => {
  const hiveCrimson: RgbTriple = [0.36, 0.12, 0.16];
  const hiveDark: RgbTriple = [0.20, 0.08, 0.11];
  const hiveBlood: RgbTriple = [0.56, 0.18, 0.23];
  const chitinMatte: RgbTriple = [0.13, 0.09, 0.12];
  const gunmetalRed: RgbTriple = [0.46, 0.24, 0.26];
  const thornMetal: RgbTriple = [0.64, 0.25, 0.29];
  const eyeEmber: RgbTriple = [0.90, 0.32, 0.36];
  const broodCrystal: RgbTriple = [0.80, 0.28, 0.38];

  out.headTopLocalY = 1.80;
  out.weaponGlowHex = 0xd94652;
  out.crystalHex = 0xc83e54;
  out.crystalOpacity = 0.62;
  out.crystalIntensity = 0.58;

  pushGeo(
    out.matte,
    out,
    new THREE.IcosahedronGeometry(0.28, 0),
    makeTransform(0, 0.96, -0.04, 0.22, 0.38, 0.14, 1.05, 1.24, 0.96),
    chitinMatte,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.24, 0),
    makeTransform(0, 0.96, -0.02, 0.12, 0.24, 0.08, 1.02, 1.18, 0.92),
    eyeEmber,
  );

  const shellPlates: readonly (readonly [number, number, number, number, number, number, number, RgbTriple])[] = [
    [0.0, 1.18, 0.14, -0.42, 0.0, 0.06, 0.24, hiveCrimson],
    [-0.22, 1.04, 0.12, -0.14, -0.58, 0.32, 0.22, hiveDark],
    [0.23, 1.02, 0.10, -0.10, 0.62, -0.28, 0.22, hiveDark],
    [-0.18, 0.80, 0.14, 0.36, -0.44, 0.24, 0.20, hiveCrimson],
    [0.19, 0.78, 0.12, 0.38, 0.48, -0.22, 0.20, hiveCrimson],
    [0.0, 1.14, -0.24, 0.32, Math.PI, -0.08, 0.25, hiveDark],
    [-0.24, 0.94, -0.18, 0.12, -2.2, 0.18, 0.21, hiveCrimson],
    [0.24, 0.96, -0.16, 0.10, 2.2, -0.18, 0.21, hiveCrimson],
  ];
  for (const [px, py, pz, rx, ry, rz, rad, col] of shellPlates) {
    pushGeo(
      out.armor,
      out,
      createHexMirrorTilePart(rad, 0.064, 0.018, -0.032, hiveBlood, col),
      makeTransform(px, py, pz, rx, ry, rz),
    );
  }

  pushGeo(
    out.armor,
    out,
    createFacetedCrystalPart(0.46, 0.22, 5, 0.66, 0.34, hiveDark, hiveCrimson),
    makeTransform(0.02, 1.32, -0.04, -0.12, 0.28, -0.08),
  );
  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.44, 0.16, 5, 0.26, 0.74, eyeEmber, broodCrystal),
    makeTransform(0, 0.56, -0.04, 0.06, 0.4, 0),
  );

  const browRidge = createBevelExtrudePart(
    [
      [-0.24, 0.02],
      [-0.12, 0.10],
      [0, 0.05],
      [0.12, 0.10],
      [0.24, 0.02],
      [0.16, -0.05],
      [0, 0.0],
      [-0.16, -0.05],
    ],
    0.09,
    0.012,
    0.012,
    2,
    4,
  );
  pushGeo(out.armor, out, browRidge, makeTransform(0, 1.07, 0.24, 0.24, 0, 0), hiveDark);

  const eyeCoords: readonly (readonly [number, number, number, number])[] = [
    [0.0, 0.99, 0.28, 0.046],
    [-0.088, 1.01, 0.26, 0.038],
    [0.088, 1.01, 0.26, 0.038],
    [-0.145, 0.96, 0.22, 0.028],
    [0.145, 0.96, 0.22, 0.028],
    [-0.052, 0.92, 0.26, 0.026],
    [0.052, 0.92, 0.26, 0.026],
  ];
  for (const [ex, ey, ez, er] of eyeCoords) {
    pushGeo(
      out.energy,
      out,
      new THREE.OctahedronGeometry(er, 1),
      makeTransform(ex, ey, ez, 0, 0, 0, 1.15, 0.85, 0.72),
      eyeEmber,
    );
  }

  for (let m = 0; m < 4; m += 1) {
    const side = m % 2 === 0 ? -1 : 1;
    const rear = m >= 2 ? -0.14 : 0.10;
    const limb = createOrganicLimb(
      [
        [side * 0.16, 0.72, rear],
        [side * 0.30, 0.50, rear + 0.06],
        [side * 0.22, 0.26, rear + 0.12],
        [side * 0.10, 0.16, rear + 0.06],
      ],
      0.046,
      0.030,
      0.010,
      14,
      8,
      hiveDark,
      thornMetal,
    );
    pushGeo(out.trim, out, limb);
  }

  const spineOffsets: readonly (readonly [number, number, number, number, number])[] = [
    [0, 1.38, -0.14, -0.34, 0],
    [-0.14, 1.32, -0.16, -0.26, 0.34],
    [0.14, 1.32, -0.16, -0.26, -0.34],
    [-0.22, 1.16, -0.20, -0.42, 0.62],
    [0.22, 1.16, -0.20, -0.42, -0.62],
  ];
  const hiveSpine = trackGeo(out, createCurvedBladePart(0.36, 0.072, 0.026, 0.08, 0.04, 8));
  for (const [sx, sy, sz, rx, rz] of spineOffsets) {
    out.trim.push({ geo: hiveSpine, matrix: makeTransform(sx, sy, sz, rx, 0, rz), colorRgb: thornMetal });
  }

  const droneDeltaGeo = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0, 0.16],
        [-0.125, -0.09],
        [-0.036, -0.04],
        [0, -0.11],
        [0.036, -0.04],
        [0.125, -0.09],
      ],
      0.028,
      0.007,
      0.007,
      1,
      4,
    ),
  );
  const droneStingerGeo = trackGeo(out, new THREE.ConeGeometry(0.024, 0.16, 4));
  const droneBladeGeo = trackGeo(out, createCurvedBladePart(0.18, 0.038, 0.014, 0.055, 0.02, 6));
  const droneEyeGeo = trackGeo(out, new THREE.OctahedronGeometry(0.030, 0));

  const dronePoses: readonly (readonly [number, number, number, number, number, number, number])[] = [
    [-0.54, 1.18, 0.36, 0.42, 0.34, -0.46, 1.06],
    [0.56, 1.06, 0.38, 0.34, -0.38, 0.52, 1.04],
    [-0.62, 0.72, 0.04, 0.14, 0.62, -0.78, 0.96],
    [0.64, 0.76, -0.04, -0.12, -0.56, 0.74, 0.98],
    [-0.38, 1.54, -0.16, -0.28, 0.24, -0.36, 0.94],
    [0.42, 1.52, -0.18, -0.24, -0.28, 0.40, 0.96],
    [0.04, 0.46, 0.42, 0.56, 0.08, 0.22, 0.92],
  ];

  for (let d = 0; d < dronePoses.length; d += 1) {
    const [dx, dy, dz, rx, ry, rz, sc] = dronePoses[d]!;
    const dm = makeTransform(dx, dy, dz, rx, ry, rz, sc, sc, sc);

    out.armor.push({
      geo: droneDeltaGeo,
      matrix: dm.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: d % 2 === 0 ? hiveCrimson : hiveBlood,
    });
    out.trim.push({
      geo: droneStingerGeo,
      matrix: dm.clone().multiply(makeTransform(0, 0, 0.19, Math.PI * 0.5, 0, 0)),
      colorRgb: gunmetalRed,
    });
    out.trim.push({
      geo: droneBladeGeo,
      matrix: dm.clone().multiply(makeTransform(-0.075, 0.02, -0.02, -0.52, 0, 0.58)),
      colorRgb: thornMetal,
    });
    out.trim.push({
      geo: droneBladeGeo,
      matrix: dm.clone().multiply(makeTransform(0.075, 0.02, -0.02, -0.52, Math.PI, -0.58)),
      colorRgb: thornMetal,
    });
    out.energy.push({
      geo: droneEyeGeo,
      matrix: dm.clone().multiply(makeTransform(0, 0.022, 0.06)),
      colorRgb: eyeEmber,
    });

    if (d < 4) {
      pushGeo(
        out.crystal,
        out,
        createTaperedTubePart(
          [
            [dx * 0.42, 0.94 + (dy - 0.94) * 0.35, dz * 0.35],
            [dx * 0.78, (dy + 0.94) * 0.5 + 0.06, dz * 0.72],
            [dx, dy, dz],
          ],
          0.012,
          0.005,
          12,
          6,
        ),
        undefined,
        broodCrystal,
      );
    }
  }

  for (let w = 0; w < 4; w += 1) {
    const side = w % 2 === 0 ? -1 : 1;
    const hi = w >= 2 ? 0.24 : -0.04;
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.56, 0.10, 0.024, 0.16, 0.05, 8),
      makeTransform(side * 0.26, 1.18 + hi, -0.24, -0.24, side * 0.28, -side * (0.48 + hi)),
    );
  }
};

const buildS23Ark: BespokeUnitBuilder = (_ctx, out) => {
  const indigoHull: RgbTriple = [0.18, 0.26, 0.41];
  const midnightDeck: RgbTriple = [0.12, 0.18, 0.30];
  const slateBlue: RgbTriple = [0.27, 0.37, 0.52];
  const warmBronze: RgbTriple = [0.75, 0.57, 0.31];
  const darkBronze: RgbTriple = [0.50, 0.37, 0.20];
  const brightBrass: RgbTriple = [0.85, 0.69, 0.38];
  const carbonNavy: RgbTriple = [0.14, 0.17, 0.24];
  const chronoCyan: RgbTriple = [0.38, 0.82, 0.88];
  const amberGlass: RgbTriple = [0.88, 0.70, 0.36];

  out.headTopLocalY = 1.78;
  out.weaponGlowHex = 0x4cc4d4;
  out.crystalHex = 0xdfad56;
  out.crystalOpacity = 0.62;
  out.crystalIntensity = 0.50;

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.32, 0.018, 8, 32),
    makeTransform(0, 0.22, -0.04, Math.PI * 0.5, 0, 0),
    warmBronze,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.24, 0.010, 8, 28),
    makeTransform(0, 0.22, -0.04, Math.PI * 0.5, 0, 0),
    chronoCyan,
  );
  for (let g = 0; g < 8; g += 1) {
    const a = (g / 8) * Math.PI * 2;
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.036, 0.022, 0.005),
      makeTransform(Math.cos(a) * 0.34, 0.22, -0.04 + Math.sin(a) * 0.34, Math.PI * 0.5, 0, a),
      brightBrass,
    );
  }

  const keelProfile = createBevelExtrudePart(
    [
      [-0.64, 0.02],
      [-0.50, 0.12],
      [0.34, 0.14],
      [0.64, 0.08],
      [0.80, -0.02],
      [0.54, -0.14],
      [-0.28, -0.16],
      [-0.62, -0.08],
    ],
    0.15,
    0.018,
    0.018,
    2,
    6,
  );
  pushGeo(
    out.trim,
    out,
    keelProfile,
    makeTransform(0, 0.68, 0.04, 0, Math.PI * 0.5, 0),
    warmBronze,
  );

  const lowerDeck = createBevelExtrudePart(
    [
      [0, 0.74],
      [-0.22, 0.44],
      [-0.36, 0.08],
      [-0.32, -0.44],
      [-0.18, -0.64],
      [0.18, -0.64],
      [0.32, -0.44],
      [0.36, 0.08],
      [0.22, 0.44],
    ],
    0.11,
    0.016,
    0.016,
    2,
    6,
  );
  pushGeo(
    out.armor,
    out,
    lowerDeck,
    makeTransform(0, 0.78, 0.04, Math.PI * 0.5, 0, 0),
    indigoHull,
  );

  const midDeck = createBevelExtrudePart(
    [
      [0, 0.52],
      [-0.18, 0.28],
      [-0.26, -0.06],
      [-0.22, -0.46],
      [0.22, -0.46],
      [0.26, -0.06],
      [0.18, 0.28],
    ],
    0.12,
    0.014,
    0.014,
    2,
    6,
  );
  pushGeo(
    out.armor,
    out,
    midDeck,
    makeTransform(0, 0.94, 0.0, Math.PI * 0.5, 0, 0),
    slateBlue,
  );

  const upperDeck = createBevelExtrudePart(
    [
      [0, 0.30],
      [-0.13, 0.08],
      [-0.16, -0.34],
      [0.16, -0.34],
      [0.13, 0.08],
    ],
    0.11,
    0.012,
    0.012,
    2,
    4,
  );
  pushGeo(
    out.armor,
    out,
    upperDeck,
    makeTransform(0, 1.08, -0.08, Math.PI * 0.5, 0, 0),
    midnightDeck,
  );

  const runwayGeo = createBevelExtrudePart(
    [
      [-0.036, 0.52],
      [0.036, 0.52],
      [0.044, -0.36],
      [-0.044, -0.36],
    ],
    0.018,
    0.004,
    0.004,
    1,
    2,
  );
  pushGeo(
    out.energy,
    out,
    runwayGeo,
    makeTransform(0, 0.85, 0.14, Math.PI * 0.5, 0, 0),
    chronoCyan,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.matte,
      out,
      createBevelExtrudePart(
        [
          [-0.06, 0.34],
          [0.06, 0.26],
          [0.08, -0.32],
          [-0.06, -0.38],
        ],
        0.09,
        0.010,
        0.010,
        1,
        4,
      ),
      makeTransform(side * 0.31, 0.84, 0.0, Math.PI * 0.5, 0, 0),
      carbonNavy,
    );

    const ribArc = createOrganicLimb(
      [
        [side * 0.20, 0.62, 0.36],
        [side * 0.38, 0.78, 0.06],
        [side * 0.34, 0.86, -0.38],
      ],
      0.026,
      0.032,
      0.024,
      14,
      8,
      warmBronze,
      darkBronze,
    );
    pushGeo(out.trim, out, ribArc);

    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6),
      makeTransform(side * 0.35, 0.84, 0.06, Math.PI * 0.5, 0, 0),
      chronoCyan,
    );
  }

  pushGeo(
    out.trim,
    out,
    createTeardropPart(0.36, 0.075, 1.5, 14, 12, 0, warmBronze, brightBrass),
    makeTransform(0, 0.72, 0.76, Math.PI * 0.5, 0, 0),
  );
  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.18, 0.056, 6, 0.65, 0.35, amberGlass, chronoCyan),
    makeTransform(0, 0.86, 0.68, Math.PI * 0.32, 0, 0),
  );

  const bridgeTower = createLathePart(
    [
      [0.13, 0.0],
      [0.10, 0.16],
      [0.13, 0.28],
      [0.09, 0.36],
      [0.03, 0.46],
      [0.008, 0.56],
    ],
    8,
  );
  pushGeo(out.armor, out, bridgeTower, makeTransform(0, 1.12, -0.18), indigoHull);
  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.125, 0.065, 0.11, 1.7, 1.05, 0.55, 12, 6),
    makeTransform(0, 1.38, -0.14),
    amberGlass,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.16, 0.014, 8, 28),
    makeTransform(0, 1.54, -0.18, 0.32, 0.22, 0),
    brightBrass,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.11, 0.010, 8, 24),
    makeTransform(0, 1.54, -0.18, -0.45, 0.14, 0.4),
    warmBronze,
  );

  const thrusterBell = trackGeo(
    out,
    createLathePart(
      [
        [0.055, 0.0],
        [0.092, 0.05],
        [0.072, 0.14],
        [0.048, 0.18],
      ],
      14,
    ),
  );
  const thrusterPos: readonly (readonly [number, number, number])[] = [
    [0, 0.76, -0.66],
    [-0.18, 0.74, -0.60],
    [0.18, 0.74, -0.60],
  ];
  for (const [ex, ey, ez] of thrusterPos) {
    out.trim.push({
      geo: thrusterBell,
      matrix: makeTransform(ex, ey, ez, Math.PI * 0.5, 0, 0),
      colorRgb: darkBronze,
    });
    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.054, 0.22, 10),
      makeTransform(ex, ey, ez - 0.09, -Math.PI * 0.5, 0, 0),
      chronoCyan,
    );
  }

  const rudderFin = trackGeo(
    out,
    createCreatureFin(0.26, 0.24, 0.14, 0.016, 0.022, 10, 6, warmBronze, darkBronze),
  );
  out.trim.push({ geo: rudderFin, matrix: makeTransform(0, 0.58, -0.42, 0, 0, -Math.PI * 0.5) });
  out.trim.push({ geo: rudderFin, matrix: makeTransform(0.24, 0.78, -0.44, 0, 0, -0.35) });
  out.trim.push({ geo: rudderFin, matrix: makeTransform(-0.24, 0.78, -0.44, 0, 0, 0.35, -1, 1, 1) });

  const escortHull = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0, 0.17],
        [-0.12, -0.10],
        [0, -0.05],
        [0.12, -0.10],
      ],
      0.032,
      0.007,
      0.007,
      1,
      4,
    ),
  );
  const escortStrake = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.014, 0.12],
        [0.014, 0.12],
        [0.024, -0.09],
        [-0.024, -0.09],
      ],
      0.016,
      0.004,
      0.004,
      1,
      2,
    ),
  );
  const escortCanopy = trackGeo(out, new THREE.OctahedronGeometry(0.028, 0));
  const escortJet = trackGeo(out, new THREE.ConeGeometry(0.022, 0.095, 6));

  const escorts: readonly (readonly [number, number, number, number, number, number, number])[] = [
    [-0.56, 1.06, 0.40, 0.18, 0.12, -0.42, 1.05],
    [0.58, 1.24, 0.22, -0.14, -0.10, 0.32, 1.0],
    [-0.64, 0.62, -0.06, 0.08, 0.24, -0.62, 0.96],
    [0.56, 0.74, -0.34, -0.22, -0.20, 0.48, 0.94],
  ];
  for (const [fx, fy, fz, rx, ry, rz, sc] of escorts) {
    const fm = makeTransform(fx, fy, fz, rx, ry, rz, sc, sc, sc);
    out.armor.push({
      geo: escortHull,
      matrix: fm.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: slateBlue,
    });
    out.trim.push({
      geo: escortStrake,
      matrix: fm.clone().multiply(makeTransform(0, 0.02, -0.01, Math.PI * 0.5, 0, 0)),
      colorRgb: brightBrass,
    });
    out.crystal.push({
      geo: escortCanopy,
      matrix: fm.clone().multiply(makeTransform(0, 0.028, 0.04, 0, 0, 0, 0.85, 0.65, 1.45)),
      colorRgb: amberGlass,
    });
    out.energy.push({
      geo: escortJet,
      matrix: fm.clone().multiply(makeTransform(0, 0, -0.12, -Math.PI * 0.5, 0, 0)),
      colorRgb: chronoCyan,
    });
  }

  const s3Sail = trackGeo(out, createCreatureFin(0.28, 0.56, 0.24, 0.036, 0.022, 10, 6));
  out.wingParts.push({ geo: s3Sail, matrix: makeTransform(0.28, 1.18, -0.24, 0.1, -0.2, 0.38) });
  out.wingParts.push({ geo: s3Sail, matrix: makeTransform(-0.28, 1.18, -0.24, 0.1, 0.2, -0.38, -1, 1, 1) });
};

const buildS24Europa: BespokeUnitBuilder = (_ctx, out) => {
  const glacierWhite: RgbTriple = [0.76, 0.88, 0.95];
  const cryoTeal: RgbTriple = [0.28, 0.52, 0.68];
  const frostBlue: RgbTriple = [0.44, 0.68, 0.82];
  const abyssalMatte: RgbTriple = [0.14, 0.24, 0.35];
  const frostSilver: RgbTriple = [0.71, 0.81, 0.89];
  const seaSteel: RgbTriple = [0.44, 0.60, 0.72];
  const cryoGlow: RgbTriple = [0.48, 0.86, 0.94];
  const iceCrystal: RgbTriple = [0.72, 0.92, 0.98];

  out.headTopLocalY = 1.90;
  out.weaponGlowHex = 0x56cbe0;
  out.crystalHex = 0x76cde6;
  out.crystalOpacity = 0.66;
  out.crystalIntensity = 0.52;

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.68, 0.165, 6, 0.22, 0.78, iceCrystal, frostBlue),
    makeTransform(0, 0.54, 0),
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.048, 0.44, 6),
    makeTransform(0, 0.36, 0, Math.PI, 0, 0),
    cryoGlow,
  );

  const sonarRings: readonly (readonly [number, number])[] = [
    [0.50, 0.24],
    [0.34, 0.18],
    [0.19, 0.11],
  ];
  for (const [sy, sr] of sonarRings) {
    pushGeo(
      out.trim,
      out,
      new THREE.TorusGeometry(sr, 0.013, 8, 28),
      makeTransform(0, sy, 0, Math.PI * 0.5, 0, 0),
      frostSilver,
    );
  }
  for (let p = 0; p < 4; p += 1) {
    const a = (p / 4) * Math.PI * 2 + Math.PI * 0.25;
    pushStrut(
      out.trim,
      out,
      [Math.cos(a) * 0.22, 0.62, Math.sin(a) * 0.22],
      [Math.cos(a) * 0.09, 0.22, Math.sin(a) * 0.09],
      0.011,
      0.006,
      seaSteel,
      6,
    );
  }

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.62, 0.135, 8, 0.52, 0.48, cryoGlow, iceCrystal),
    makeTransform(0, 1.08, 0),
  );
  pushGeo(
    out.matte,
    out,
    new THREE.CylinderGeometry(0.11, 0.13, 0.48, 8),
    makeTransform(0, 1.06, -0.02),
    abyssalMatte,
  );
  pushStrut(out.trim, out, [-0.26, 1.24, 0], [0.26, 1.24, 0], 0.028, 0.028, frostSilver, 8);
  pushStrut(out.trim, out, [-0.26, 0.88, 0], [0.26, 0.88, 0], 0.028, 0.028, frostSilver, 8);
  pushStrut(out.matte, out, [-0.24, 1.06, -0.10], [0.24, 1.06, -0.10], 0.022, 0.022, abyssalMatte, 8);

  const hullDiamond = trackGeo(
    out,
    createFacetedCrystalPart(0.92, 0.195, 4, 0.54, 0.46, cryoTeal, glacierWhite),
  );
  const hullCap = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [0, 0.36],
        [0.14, 0.10],
        [0.12, -0.16],
        [0, -0.34],
        [-0.12, -0.16],
        [-0.14, 0.10],
      ],
      0.06,
      0.012,
      0.012,
      2,
      4,
    ),
  );
  const prowFin = trackGeo(
    out,
    createCreatureFin(0.24, 0.22, 0.16, 0.024, 0.020, 10, 6, glacierWhite, frostBlue),
  );

  for (const side of [-1, 1] as const) {
    const hx = side * 0.25;
    out.armor.push({
      geo: hullDiamond,
      matrix: makeTransform(hx, 1.08, 0, 0, Math.PI * 0.25, -side * 0.06, 0.84, 1.0, 1.22),
    });
    out.armor.push({
      geo: hullCap,
      matrix: makeTransform(hx + side * 0.12, 1.08, 0.04, 0, side * Math.PI * 0.5, 0),
      colorRgb: glacierWhite,
    });
    out.armor.push({
      geo: prowFin,
      matrix: makeTransform(hx + side * 0.14, 1.12, -0.02, 0.18, 0, -side * 0.14, side, 1, 1),
    });
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.11, 0.036, 0.008, 0.06),
      makeTransform(hx, 1.44, 0, Math.PI * 0.5, 0, 0),
      frostSilver,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6),
      makeTransform(hx, 1.08, 0.18),
      cryoGlow,
    );
  }

  pushGeo(
    out.armor,
    out,
    createLathePart(
      [
        [0.14, 0.0],
        [0.15, 0.06],
        [0.09, 0.16],
        [0.04, 0.24],
        [0.015, 0.34],
      ],
      12,
    ),
    makeTransform(0, 1.48, -0.02),
    glacierWhite,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.056, 1),
    makeTransform(0, 1.78, -0.02),
    cryoGlow,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.14, 0.012, 8, 24),
    makeTransform(0, 1.64, -0.02, Math.PI * 0.5, 0, 0),
    frostSilver,
  );
  pushStrut(out.trim, out, [0, 1.64, -0.02], [-0.22, 1.84, -0.10], 0.008, 0.012, seaSteel, 6);
  pushStrut(out.trim, out, [0, 1.64, -0.02], [0.22, 1.84, -0.10], 0.008, 0.012, seaSteel, 6);

  const railUpperGeo = trackGeo(out, new THREE.CylinderGeometry(0.018, 0.022, 0.62, 6));
  const breechGeo = trackGeo(out, new THREE.CylinderGeometry(0.058, 0.052, 0.18, 8));
  const coilRingGeo = trackGeo(out, new THREE.TorusGeometry(0.044, 0.011, 6, 14));

  const cannons: readonly (readonly [number, number, number, number])[] = [
    [-0.44, 1.24, 0.26, 0.05],
    [0.44, 1.24, 0.18, -0.05],
    [-0.48, 0.90, 0.20, 0.04],
    [0.48, 0.90, 0.28, -0.04],
  ];
  for (const [cx, cy, cz, yaw] of cannons) {
    const cm = makeTransform(cx, cy, cz, 0, yaw, 0);
    pushStrut(
      out.matte,
      out,
      [cx * 0.52, cy, -0.02],
      [cx, cy, cz - 0.14],
      0.024,
      0.024,
      abyssalMatte,
      6,
    );
    out.matte.push({
      geo: breechGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, -0.14, Math.PI * 0.5, 0, 0)),
      colorRgb: abyssalMatte,
    });
    out.trim.push({
      geo: railUpperGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0.028, 0.16, Math.PI * 0.5, 0, 0)),
      colorRgb: frostSilver,
    });
    out.trim.push({
      geo: railUpperGeo,
      matrix: cm.clone().multiply(makeTransform(0, -0.028, 0.16, Math.PI * 0.5, 0, 0)),
      colorRgb: seaSteel,
    });
    out.energy.push({
      geo: coilRingGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, 0.08)),
      colorRgb: cryoGlow,
    });
    out.energy.push({
      geo: coilRingGeo,
      matrix: cm.clone().multiply(makeTransform(0, 0, 0.28)),
      colorRgb: cryoGlow,
    });
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createFacetedCrystalPart(0.58, 0.12, 6, 0.68, 0.32),
      makeTransform(side * 0.54, 1.42, -0.18, 0.18, 0, -side * 0.44),
    );
  }
};

const buildS25WhiteRing: BespokeUnitBuilder = (_ctx, out) => {
  const deepNavy: RgbTriple = [0.20, 0.30, 0.46];
  const slateNavy: RgbTriple = [0.29, 0.41, 0.59];
  const darkNavy: RgbTriple = [0.13, 0.20, 0.32];
  const graphiteMatte: RgbTriple = [0.16, 0.20, 0.27];
  const titaniumSilver: RgbTriple = [0.73, 0.78, 0.85];
  const brassVernier: RgbTriple = [0.77, 0.65, 0.40];
  const waveBlue: RgbTriple = [0.58, 0.78, 0.96];
  const waveCrystal: RgbTriple = [0.76, 0.88, 0.98];

  out.headTopLocalY = 1.88;
  out.weaponGlowHex = 0x6ea8e8;
  out.crystalHex = 0x7ea2e6;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.54;

  const baseHub = createLathePart(
    [
      [0.32, 0.04],
      [0.30, 0.12],
      [0.24, 0.22],
      [0.18, 0.30],
      [0.12, 0.34],
    ],
    12,
  );
  pushGeo(out.matte, out, baseHub, undefined, graphiteMatte);
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.28, 0.056, 0.012, 0.14),
    makeTransform(0, 0.14, 0, Math.PI * 0.5, 0, 0),
    titaniumSilver,
  );

  for (let leg = 0; leg < 3; leg += 1) {
    const a = (leg / 3) * Math.PI * 2 + Math.PI * 0.5;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const legGeo = createOrganicLimb(
      [
        [ca * 0.18, 0.28, sa * 0.18],
        [ca * 0.38, 0.22, sa * 0.38],
        [ca * 0.50, 0.07, sa * 0.50],
      ],
      0.068,
      0.056,
      0.048,
      12,
      8,
      deepNavy,
      darkNavy,
    );
    pushGeo(out.armor, out, legGeo);
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.075, 0.092, 0.055, 8),
      makeTransform(ca * 0.50, 0.05, sa * 0.50),
      titaniumSilver,
    );
  }

  for (const side of [-1, 1] as const) {
    const trunnion = createBevelExtrudePart(
      [
        [-0.08, 0.0],
        [0.08, 0.0],
        [0.06, 0.66],
        [-0.04, 0.72],
        [-0.10, 0.54],
      ],
      0.11,
      0.014,
      0.014,
      2,
      4,
    );
    pushGeo(
      out.armor,
      out,
      trunnion,
      makeTransform(side * 0.68, 0.24, 0, 0, side < 0 ? 0 : Math.PI, 0),
      darkNavy,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.068, 0.068, 0.16, 12),
      makeTransform(side * 0.64, 1.00, 0, 0, 0, Math.PI * 0.5),
      brassVernier,
    );
    pushStrut(
      out.matte,
      out,
      [side * 0.22, 0.22, 0],
      [side * 0.64, 0.34, 0],
      0.042,
      0.048,
      graphiteMatte,
      8,
    );
  }

  const outerMatrix = makeTransform(0, 1.02, 0, 0.14, 0.12, 0);
  pushGeo(
    out.matte,
    out,
    new THREE.TorusGeometry(0.62, 0.068, 12, 42),
    outerMatrix,
    graphiteMatte,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.69, 0.022, 8, 42),
    outerMatrix,
    titaniumSilver,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.55, 0.018, 8, 36),
    outerMatrix,
    brassVernier,
  );

  const segArc = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.16, 0.055],
        [0.16, 0.055],
        [0.12, -0.055],
        [-0.12, -0.055],
      ],
      0.155,
      0.014,
      0.014,
      2,
      4,
    ),
  );
  for (let s = 0; s < 8; s += 1) {
    const a = (s / 8) * Math.PI * 2 + Math.PI * 0.125;
    const localM = makeTransform(
      Math.cos(a) * 0.62,
      Math.sin(a) * 0.62,
      0,
      0,
      0,
      a - Math.PI * 0.5,
    );
    out.armor.push({
      geo: segArc,
      matrix: outerMatrix.clone().multiply(localM),
      colorRgb: s % 2 === 0 ? deepNavy : slateNavy,
    });
  }

  for (let q = 0; q < 4; q += 1) {
    const a = (q / 4) * Math.PI * 2;
    const clampM = makeTransform(Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0.075, 0, 0, a);
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.052, 0.04, 0.008),
      outerMatrix.clone().multiply(clampM),
      brassVernier,
    );
  }

  const innerMatrix = makeTransform(0, 1.02, 0, -0.18, -0.34, 0.16);
  pushGeo(
    out.armor,
    out,
    new THREE.TorusGeometry(0.44, 0.044, 10, 36),
    innerMatrix,
    slateNavy,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.48, 0.014, 8, 32),
    innerMatrix,
    titaniumSilver,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.39, 0.012, 8, 32),
    innerMatrix,
    waveBlue,
  );

  const emitterCone = trackGeo(out, new THREE.ConeGeometry(0.032, 0.12, 6));
  const emitterTip = trackGeo(out, new THREE.OctahedronGeometry(0.024, 0));
  for (let e = 0; e < 6; e += 1) {
    const a = (e / 6) * Math.PI * 2;
    const em = makeTransform(Math.cos(a) * 0.37, Math.sin(a) * 0.37, 0, 0, 0, a + Math.PI * 0.5);
    out.trim.push({ geo: emitterCone, matrix: innerMatrix.clone().multiply(em), colorRgb: titaniumSilver });
    const tm = makeTransform(Math.cos(a) * 0.30, Math.sin(a) * 0.30, 0);
    out.energy.push({ geo: emitterTip, matrix: innerMatrix.clone().multiply(tm), colorRgb: waveBlue });
  }

  const waveDisc = createLathePart(
    [
      [0.005, 0.035],
      [0.09, 0.016],
      [0.18, 0.034],
      [0.27, 0.014],
      [0.37, 0.024],
      [0.37, -0.024],
      [0.27, -0.014],
      [0.18, -0.034],
      [0.09, -0.016],
      [0.005, -0.035],
    ],
    28,
  );
  pushGeo(
    out.crystal,
    out,
    waveDisc,
    innerMatrix.clone().multiply(makeTransform(0, 0, 0, Math.PI * 0.5, 0, 0)),
    waveCrystal,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.24, 0.011, 8, 28),
    innerMatrix,
    waveBlue,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.13, 0.010, 8, 24),
    innerMatrix,
    waveBlue,
  );
  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.22, 0.095, 8, 0.5, 0.5, waveBlue, waveCrystal),
    makeTransform(0, 1.02, 0),
  );

  pushGeo(
    out.trim,
    out,
    new THREE.ConeGeometry(0.032, 0.22, 6),
    makeTransform(0, 1.76, 0),
    brassVernier,
  );

  pushGeo(
    out.wingParts,
    out,
    new THREE.TorusGeometry(0.78, 0.022, 8, 36),
    makeTransform(0, 1.02, -0.14, 0.14, 0.12, 0),
  );
};

const buildS26Magellan: BespokeUnitBuilder = (_ctx, out) => {
  const jadeHull: RgbTriple = [0.24, 0.56, 0.48];
  const deepJade: RgbTriple = [0.15, 0.39, 0.35];
  const celadon: RgbTriple = [0.44, 0.72, 0.62];
  const antiqueBronze: RgbTriple = [0.74, 0.57, 0.32];
  const darkPatina: RgbTriple = [0.48, 0.38, 0.23];
  const rigMatte: RgbTriple = [0.14, 0.22, 0.22];
  const emeraldGlow: RgbTriple = [0.42, 0.86, 0.68];
  const sailGoldJade: RgbTriple = [0.80, 0.86, 0.66];
  const sailJadeBase: RgbTriple = [0.46, 0.80, 0.68];

  out.headTopLocalY = 2.02;
  out.weaponGlowHex = 0x4cc89b;
  out.crystalHex = 0x72d4b0;
  out.crystalOpacity = 0.68;
  out.crystalIntensity = 0.48;

  const hullGeo = createTeardropPart(1.26, 0.185, 1.45, 20, 18, 0.06, deepJade, jadeHull);
  pushGeo(
    out.armor,
    out,
    hullGeo,
    makeTransform(0, 0.54, 0.06, Math.PI * 0.5, 0, 0, 0.94, 1.0, 0.78),
  );

  const deckPlate = createBevelExtrudePart(
    [
      [0, 0.60],
      [-0.15, 0.24],
      [-0.17, -0.26],
      [-0.10, -0.52],
      [0.10, -0.52],
      [0.17, -0.26],
      [0.15, 0.24],
    ],
    0.048,
    0.010,
    0.010,
    2,
    6,
  );
  pushGeo(
    out.armor,
    out,
    deckPlate,
    makeTransform(0, 0.63, 0.04, Math.PI * 0.5, 0, 0),
    celadon,
  );

  const keelBlade = createCreatureFin(0.46, 0.28, 0.18, 0.016, 0.024, 12, 6, antiqueBronze, darkPatina);
  pushGeo(out.trim, out, keelBlade, makeTransform(0, 0.44, 0.02, 0, 0, -Math.PI * 0.5));

  pushStrut(out.trim, out, [0, 0.58, 0.52], [0, 0.72, 0.92], 0.014, 0.032, antiqueBronze, 8);
  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.036, 0),
    makeTransform(0, 0.72, 0.94),
    emeraldGlow,
  );
  const prowScroll = trackGeo(
    out,
    createCreatureFin(0.24, 0.20, 0.16, 0.022, 0.018, 10, 6, antiqueBronze, darkPatina),
  );
  out.trim.push({ geo: prowScroll, matrix: makeTransform(0.08, 0.62, 0.56, 0.16, 0.24, 0.22) });
  out.trim.push({
    geo: prowScroll,
    matrix: makeTransform(-0.08, 0.62, 0.56, 0.16, -0.24, -0.22, -1, 1, 1),
  });
  for (const side of [-1, 1] as const) {
    pushGeo(
      out.trim,
      out,
      createOrganicLimb(
        [
          [side * 0.11, 0.56, 0.44],
          [side * 0.20, 0.58, 0.02],
          [side * 0.14, 0.64, -0.44],
        ],
        0.016,
        0.020,
        0.016,
        12,
        6,
        antiqueBronze,
        darkPatina,
      ),
    );
  }
  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.034, 1),
    makeTransform(0, 0.78, -0.44),
    emeraldGlow,
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.085, 0.032, 0.008, 0.042),
    makeTransform(0.06, 1.24, -0.06, Math.PI * 0.5, 0, 0),
    antiqueBronze,
  );
  pushStrut(out.trim, out, [0.04, 1.56, -0.06], [-0.18, 1.48, 0.42], 0.008, 0.008, antiqueBronze, 6);
  pushStrut(out.trim, out, [0.06, 1.48, -0.08], [0.44, 1.44, -0.44], 0.008, 0.008, antiqueBronze, 6);

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.18, 0.016, 8, 28),
    makeTransform(0, 0.66, -0.54, 0.14, 0, 0),
    antiqueBronze,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.135, 0.009, 6, 24),
    makeTransform(0, 0.66, -0.54, 0.14, 0, 0),
    emeraldGlow,
  );
  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [-0.14, 0.06],
        [0.14, 0.06],
        [0.18, -0.06],
        [-0.18, -0.06],
      ],
      0.16,
      0.010,
      0.010,
      1,
      4,
    ),
    makeTransform(0, 0.68, -0.38, 0.12, 0, 0),
    deepJade,
  );

  pushGeo(
    out.energy,
    out,
    createFlowingRibbonMesh(
      [
        [0, 0.34, 0.34],
        [0.02, 0.24, -0.04],
        [-0.02, 0.22, -0.46],
        [0, 0.18, -0.74],
      ],
      [0.05, 0.11, 0.02],
      0.018,
      1.6,
      20,
      4,
      0.008,
      emeraldGlow,
      sailJadeBase,
    ),
  );

  pushStrut(out.trim, out, [0.02, 0.62, -0.02], [0.12, 1.88, -0.10], 0.016, 0.032, antiqueBronze, 10);
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.082, 0.012, 8, 20),
    makeTransform(0.12, 1.88, -0.10, 0.12, 0.24, 0),
    antiqueBronze,
  );

  pushStrut(out.trim, out, [-0.42, 1.56, 0.08], [0.46, 1.66, -0.18], 0.013, 0.013, antiqueBronze, 8);
  pushStrut(out.trim, out, [-0.48, 0.84, 0.14], [0.48, 0.92, -0.14], 0.014, 0.014, darkPatina, 8);

  const mainSail = createBillowingSailGeometry(
    0.88,
    0.72,
    0.84,
    0.20,
    0.08,
    sailJadeBase,
    sailGoldJade,
  );
  pushGeo(
    out.crystal,
    out,
    mainSail,
    makeTransform(0.02, 0.84, 0.02, -0.06, 0.28, -0.08),
  );

  pushStrut(out.trim, out, [0.06, 1.24, -0.06], [0.48, 1.30, -0.18], 0.009, 0.009, antiqueBronze, 6);
  pushStrut(out.trim, out, [0.06, 1.24, -0.06], [-0.44, 1.18, 0.12], 0.009, 0.009, antiqueBronze, 6);

  pushStrut(out.trim, out, [0.0, 0.64, 0.34], [-0.18, 1.48, 0.42], 0.012, 0.022, antiqueBronze, 8);
  pushStrut(out.trim, out, [-0.18, 1.48, 0.42], [0.0, 0.72, 0.90], 0.008, 0.008, darkPatina, 6);
  const foreJib = createBillowingSailGeometry(
    0.56,
    0.10,
    0.78,
    0.15,
    -0.12,
    celadon,
    sailGoldJade,
  );
  pushGeo(
    out.crystal,
    out,
    foreJib,
    makeTransform(-0.14, 0.74, 0.50, 0.12, -0.58, 0.12),
  );

  pushStrut(out.trim, out, [0.16, 0.66, -0.34], [0.44, 1.44, -0.44], 0.011, 0.020, darkPatina, 8);
  const aftSail = createBillowingSailGeometry(
    0.44,
    0.22,
    0.66,
    0.13,
    0.14,
    sailJadeBase,
    celadon,
  );
  pushGeo(
    out.crystal,
    out,
    aftSail,
    makeTransform(0.28, 0.78, -0.38, -0.08, 0.62, -0.22),
  );

  pushStrut(out.matte, out, [-0.12, 0.64, 0.14], [0.12, 1.82, -0.10], 0.006, 0.006, rigMatte, 5);
  pushStrut(out.matte, out, [0.14, 0.64, -0.36], [0.12, 1.82, -0.10], 0.006, 0.006, rigMatte, 5);

  const torpedoBody = trackGeo(
    out,
    createTeardropPart(0.36, 0.042, 1.3, 12, 10, 0, deepJade, antiqueBronze),
  );
  const torpedoHead = trackGeo(out, new THREE.ConeGeometry(0.036, 0.11, 8));
  const torpedoRing = trackGeo(out, new THREE.TorusGeometry(0.048, 0.009, 6, 14));

  for (const side of [-1, 1] as const) {
    const sx = side * 0.34;
    pushStrut(out.trim, out, [side * 0.14, 0.56, 0.16], [sx, 0.42, 0.16], 0.018, 0.022, antiqueBronze, 6);
    pushStrut(out.trim, out, [side * 0.12, 0.56, -0.08], [sx, 0.42, -0.06], 0.016, 0.020, darkPatina, 6);
    pushGeo(
      out.matte,
      out,
      createBevelExtrudePart(
        [
          [-0.085, 0.18],
          [0.085, 0.18],
          [0.075, -0.18],
          [-0.075, -0.18],
        ],
        0.044,
        0.008,
        0.008,
        1,
        4,
      ),
      makeTransform(sx, 0.44, 0.08, Math.PI * 0.5, 0, 0),
      rigMatte,
    );

    for (const offset of [-0.056, 0.056] as const) {
      const tx = sx + offset;
      out.armor.push({
        geo: torpedoBody,
        matrix: makeTransform(tx, 0.38, 0.12, Math.PI * 0.5, 0, 0),
      });
      out.energy.push({
        geo: torpedoHead,
        matrix: makeTransform(tx, 0.38, 0.32, Math.PI * 0.5, 0, 0),
        colorRgb: emeraldGlow,
      });
      out.trim.push({
        geo: torpedoRing,
        matrix: makeTransform(tx, 0.38, 0.16),
        colorRgb: antiqueBronze,
      });
    }
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createPetalPart(0.68, 0.24, 0.06, 0.06, 1.3, 12, 8),
      makeTransform(side * 0.34, 1.06, -0.26, -0.12, side * 0.42, -side * 0.56),
    );
  }
};

const buildS27Ring: BespokeUnitBuilder = (_ctx, out) => {
  const obsidianViolet: RgbTriple = [0.22, 0.17, 0.32];
  const obsidianDark: RgbTriple = [0.13, 0.10, 0.21];
  const amethystArmor: RgbTriple = [0.35, 0.25, 0.49];
  const basaltMatte: RgbTriple = [0.11, 0.09, 0.16];
  const tungstenTrim: RgbTriple = [0.58, 0.50, 0.69];
  const darkTitanium: RgbTriple = [0.36, 0.32, 0.45];
  const plasmaMagenta: RgbTriple = [0.80, 0.40, 0.88];
  const curtainViolet: RgbTriple = [0.68, 0.42, 0.86];

  out.headTopLocalY = 2.14;
  out.weaponGlowHex = 0xc25cd6;
  out.crystalHex = 0xa658d8;
  out.crystalOpacity = 0.48;
  out.crystalIntensity = 0.62;

  pushGeo(
    out.matte,
    out,
    createChamferedHexPart(0.36, 0.072, 0.016, 0.12),
    makeTransform(0, 0.07, 0, Math.PI * 0.5, 0, 0),
    basaltMatte,
  );

  pushGeo(
    out.armor,
    out,
    createFacetedCrystalPart(0.80, 0.24, 4, 0.72, 0.28, obsidianDark, obsidianViolet),
    makeTransform(0, 0.44, 0, 0, Math.PI * 0.25, 0),
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.24, 0.056, 0.010, 0.14),
    makeTransform(0, 0.26, 0, Math.PI * 0.5, 0, 0),
    tungstenTrim,
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.18, 0.044, 0.008, 0.10),
    makeTransform(0, 0.56, 0, Math.PI * 0.5, 0, 0),
    darkTitanium,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.058, 0.18, 4),
    makeTransform(0, 0.84, 0, 0, Math.PI * 0.25, 0),
    plasmaMagenta,
  );

  pushGeo(
    out.armor,
    out,
    createFacetedCrystalPart(0.92, 0.27, 4, 0.28, 0.72, amethystArmor, obsidianDark),
    makeTransform(0, 1.66, 0, 0, Math.PI * 0.25, 0),
  );
  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.29, 0.062, 0.012, 0.16),
    makeTransform(0, 1.82, 0, Math.PI * 0.5, 0, 0),
    tungstenTrim,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.064, 0.20, 4),
    makeTransform(0, 1.18, 0, Math.PI, Math.PI * 0.25, 0),
    plasmaMagenta,
  );

  const crownHorn = trackGeo(out, createCurvedBladePart(0.32, 0.088, 0.032, 0.08, 0.04, 8));
  for (let h = 0; h < 4; h += 1) {
    const a = (h / 4) * Math.PI * 2 + Math.PI * 0.25;
    const yaw = -a + Math.PI * 0.5;
    out.armor.push({
      geo: crownHorn,
      matrix: makeTransform(Math.cos(a) * 0.20, 1.76, Math.sin(a) * 0.20, 0, yaw, 0).multiply(
        makeTransform(0, 0, 0, -0.24, 0, 0),
      ),
      colorRgb: obsidianViolet,
    });
    const dCoil = createOrganicLimb(
      [
        [Math.cos(a) * 0.16, 0.62, Math.sin(a) * 0.16],
        [Math.cos(a) * 0.38, 1.02, Math.sin(a) * 0.38],
        [Math.cos(a) * 0.18, 1.44, Math.sin(a) * 0.18],
      ],
      0.022,
      0.028,
      0.022,
      12,
      8,
      tungstenTrim,
      darkTitanium,
    );
    pushGeo(out.trim, out, dCoil);
  }

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.26, 0.042, 12, 32),
    makeTransform(0, 1.02, 0, Math.PI * 0.5, 0, 0),
    plasmaMagenta,
  );
  pushGeo(
    out.crystal,
    out,
    new THREE.TorusGeometry(0.32, 0.068, 12, 32),
    makeTransform(0, 1.02, 0, Math.PI * 0.5, 0, 0),
    curtainViolet,
  );

  const pylonSlab = trackGeo(
    out,
    createBevelExtrudePart(
      [
        [-0.085, 0.0],
        [0.085, 0.0],
        [0.115, 0.72],
        [0.068, 1.46],
        [0.0, 1.76],
        [-0.068, 1.46],
        [-0.105, 0.72],
      ],
      0.11,
      0.016,
      0.016,
      2,
      4,
    ),
  );
  const coilCollar = trackGeo(out, new THREE.TorusGeometry(0.11, 0.022, 8, 16));
  const anchorClaw = trackGeo(out, createCurvedBladePart(0.28, 0.095, 0.042, 0.06, 0.03, 6));

  const pylonAngles: readonly number[] = [
    Math.PI * 0.25,
    Math.PI * 0.75,
    Math.PI * 1.25,
    Math.PI * 1.75,
  ];
  const pylonTips: Vec3Tuple[] = [];
  const pylonMids: Vec3Tuple[] = [];
  const pylonLows: Vec3Tuple[] = [];

  for (let i = 0; i < 4; i += 1) {
    const a = pylonAngles[i]!;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const bx = ca * 0.56;
    const bz = sa * 0.56;
    const yaw = -a + Math.PI * 0.5;
    const pm = makeTransform(bx, 0.08, bz, 0, yaw, 0).multiply(makeTransform(0, 0, 0, -0.14, 0, 0));

    out.armor.push({ geo: pylonSlab, matrix: pm, colorRgb: i % 2 === 0 ? obsidianViolet : obsidianDark });
    out.matte.push({
      geo: anchorClaw,
      matrix: makeTransform(ca * 0.62, 0.28, sa * 0.62, 0, yaw, 0).multiply(
        makeTransform(0, 0, 0, Math.PI * 0.78, 0, 0),
      ),
      colorRgb: basaltMatte,
    });
    pushStrut(
      out.matte,
      out,
      [ca * 0.24, 0.10, sa * 0.24],
      [ca * 0.56, 0.14, sa * 0.56],
      0.026,
      0.032,
      basaltMatte,
      6,
    );
    out.trim.push({
      geo: coilCollar,
      matrix: pm.clone().multiply(makeTransform(0, 0.54, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: tungstenTrim,
    });
    out.trim.push({
      geo: coilCollar,
      matrix: pm.clone().multiply(makeTransform(0, 1.04, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: tungstenTrim,
    });
    out.trim.push({
      geo: coilCollar,
      matrix: pm.clone().multiply(makeTransform(0, 1.46, 0, Math.PI * 0.5, 0, 0)),
      colorRgb: darkTitanium,
    });

    const lowPt: Vec3Tuple = [ca * 0.46, 0.58, sa * 0.46];
    const midPt: Vec3Tuple = [ca * 0.49, 1.02, sa * 0.49];
    const tipPt: Vec3Tuple = [ca * 0.42, 1.48, sa * 0.42];
    pylonLows.push(lowPt);
    pylonMids.push(midPt);
    pylonTips.push(tipPt);

    pushGeo(
      out.energy,
      out,
      new THREE.OctahedronGeometry(0.044, 0),
      makeTransform(midPt[0], midPt[1], midPt[2]),
      plasmaMagenta,
    );
  }

  const arcLevels: readonly (readonly [readonly Vec3Tuple[], number, number])[] = [
    [pylonLows, 0.048, 0.56],
    [pylonMids, 0.062, 1.02],
    [pylonTips, 0.046, 1.48],
  ];
  for (let lv = 0; lv < arcLevels.length; lv += 1) {
    const [pts, w, baseY] = arcLevels[lv]!;
    const loopPts: Vec3Tuple[] = [];
    for (let i = 0; i < 4; i += 1) {
      const p0 = pts[i]!;
      const p1 = pts[(i + 1) % 4]!;
      const midX = (p0[0] + p1[0]) * 0.58;
      const midZ = (p0[2] + p1[2]) * 0.58;
      const zigY = baseY + (i % 2 === 0 ? 0.07 : -0.07) * (lv === 1 ? 1.2 : 0.8);
      loopPts.push(p0, [midX, zigY, midZ]);
    }
    pushGeo(
      out.energy,
      out,
      createFlowingRibbonMesh(
        loopPts,
        [w, w * 1.1, w],
        0.022,
        4.0,
        36,
        4,
        0.012,
        plasmaMagenta,
        curtainViolet,
        true,
      ),
    );
  }

  const shieldWall = trackGeo(
    out,
    createPetalPart(1.18, 0.62, 0.11, 0.07, 0.72, 12, 8, curtainViolet, plasmaMagenta),
  );
  for (let i = 0; i < 4; i += 1) {
    const wallAng = (i / 4) * Math.PI * 2;
    out.crystal.push({
      geo: shieldWall,
      matrix: makeTransform(
        Math.cos(wallAng) * 0.48,
        0.44,
        Math.sin(wallAng) * 0.48,
        0,
        -wallAng + Math.PI * 0.5,
        0,
      ),
    });
  }

  for (let i = 0; i < 4; i += 1) {
    const a = pylonAngles[i]!;
    pushGeo(
      out.wingParts,
      out,
      createFacetedCrystalPart(0.56, 0.095, 4, 0.68, 0.32),
      makeTransform(Math.cos(a) * 0.68, 1.56, Math.sin(a) * 0.68, 0, -a + Math.PI * 0.5, 0).multiply(
        makeTransform(0, 0, 0, -0.22, 0, 0),
      ),
    );
  }
};

const buildS28Vulcan: BespokeUnitBuilder = (_ctx, out) => {
  const forgedGold: RgbTriple = [0.79, 0.62, 0.32];
  const solarBrass: RgbTriple = [0.87, 0.71, 0.40];
  const basaltCopper: RgbTriple = [0.56, 0.34, 0.20];
  const darkIron: RgbTriple = [0.18, 0.16, 0.17];
  const castIron: RgbTriple = [0.25, 0.21, 0.20];
  const furnaceAmber: RgbTriple = [0.92, 0.62, 0.26];
  const diamondCrystal: RgbTriple = [0.88, 0.80, 0.62];

  out.headTopLocalY = 2.04;
  out.weaponGlowHex = 0xe8983c;
  out.crystalHex = 0xefb254;
  out.crystalOpacity = 0.72;
  out.crystalIntensity = 0.58;

  const drillSpindle = createLathePart(
    [
      [0.010, 0.05],
      [0.10, 0.18],
      [0.18, 0.38],
      [0.26, 0.60],
      [0.32, 0.74],
      [0.24, 0.82],
    ],
    14,
  );
  pushGeo(out.matte, out, drillSpindle, undefined, darkIron);

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.28, 0.125, 6, 0.24, 0.76, furnaceAmber, diamondCrystal),
    makeTransform(0, 0.22, 0),
  );

  const drillBlade = trackGeo(
    out,
    createCurvedBladePart(0.68, 0.21, 0.056, 0.20, 0.09, 10),
  );
  const cutterTooth = trackGeo(out, new THREE.OctahedronGeometry(0.044, 0));
  for (let b = 0; b < 3; b += 1) {
    const a = (b / 3) * Math.PI * 2;
    const bm = makeTransform(Math.cos(a) * 0.06, 0.78, Math.sin(a) * 0.06, 0, -a, 0).multiply(
      makeTransform(0, 0, 0, Math.PI, 0, 0.22),
    );
    out.trim.push({ geo: drillBlade, matrix: bm, colorRgb: b % 2 === 0 ? forgedGold : basaltCopper });

    for (let t = 0; t < 3; t += 1) {
      const f = 0.25 + t * 0.26;
      const rad = 0.09 + f * 0.22;
      const ta = a + f * 0.75;
      out.crystal.push({
        geo: cutterTooth,
        matrix: makeTransform(Math.cos(ta) * rad, 0.20 + f * 0.54, Math.sin(ta) * rad),
        colorRgb: diamondCrystal,
      });
    }
  }

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.34, 0.048, 10, 28),
    makeTransform(0, 0.78, 0, Math.PI * 0.5, 0, 0),
    basaltCopper,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.30, 0.018, 8, 24),
    makeTransform(0, 0.83, 0, Math.PI * 0.5, 0, 0),
    furnaceAmber,
  );

  for (let f = 0; f < 3; f += 1) {
    const a = (f / 3) * Math.PI * 2 + Math.PI * 0.33;
    pushGeo(
      out.armor,
      out,
      createHexMirrorTilePart(0.18, 0.056, 0.016, -0.02, solarBrass, forgedGold),
      makeTransform(Math.cos(a) * 0.35, 0.72, Math.sin(a) * 0.35, 0, -a + Math.PI * 0.5, 0).multiply(
        makeTransform(0, 0, 0, 0.42, 0, 0),
      ),
    );
  }

  const torsoHull = createBevelExtrudePart(
    [
      [-0.30, 0.0],
      [0.30, 0.0],
      [0.44, 0.34],
      [0.38, 0.64],
      [-0.38, 0.64],
      [-0.44, 0.34],
    ],
    0.42,
    0.026,
    0.026,
    2,
    6,
  );
  pushGeo(out.armor, out, torsoHull, makeTransform(0, 0.86, 0.02), forgedGold);

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [-0.26, 0.0],
        [0.26, 0.0],
        [0.32, 0.36],
        [-0.32, 0.36],
      ],
      0.16,
      0.014,
      0.014,
      1,
      4,
    ),
    makeTransform(0, 0.98, 0.22),
    darkIron,
  );

  for (let l = 0; l < 4; l += 1) {
    const ly = 1.03 + l * 0.082;
    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.018, 0.018, 0.42 - l * 0.03, 6),
      makeTransform(0, ly, 0.29, 0, 0, Math.PI * 0.5),
      furnaceAmber,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.014, 0.014, 0.46 - l * 0.03, 6),
      makeTransform(0, ly + 0.038, 0.31, 0, 0, Math.PI * 0.5),
      basaltCopper,
    );
  }

  const cowlGeo = createBevelExtrudePart(
    [
      [-0.22, 0.0],
      [0.22, 0.0],
      [0.16, 0.20],
      [-0.16, 0.20],
    ],
    0.26,
    0.018,
    0.018,
    2,
    4,
  );
  pushGeo(out.armor, out, cowlGeo, makeTransform(0, 1.48, 0.08), basaltCopper);
  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.15, 0.052, 0.14, 1.5, 1.2, 0.42, 10, 4),
    makeTransform(0, 1.56, 0.14),
    furnaceAmber,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createHexMirrorTilePart(0.21, 0.072, 0.018, -0.024, solarBrass, forgedGold),
      makeTransform(side * 0.44, 1.38, 0.04, 0.18, side * 0.92, -side * 0.24),
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.062, 0.068, 0.18, 10),
      makeTransform(side * 0.48, 1.24, 0.02, 0, 0, Math.PI * 0.5),
      basaltCopper,
    );

    const upperArm = createOrganicLimb(
      [
        [side * 0.48, 1.24, 0.02],
        [side * 0.68, 1.06, 0.12],
        [side * 0.72, 0.84, 0.26],
      ],
      0.076,
      0.068,
      0.064,
      12,
      8,
      castIron,
      darkIron,
    );
    pushGeo(out.matte, out, upperArm);

    pushStrut(
      out.trim,
      out,
      [side * 0.44, 1.38, 0.12],
      [side * 0.68, 1.04, 0.24],
      0.024,
      0.028,
      solarBrass,
      8,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.078, 0.078, 0.14, 10),
      makeTransform(side * 0.72, 0.84, 0.26, 0, 0, Math.PI * 0.5),
      basaltCopper,
    );

    const foreArm = createOrganicLimb(
      [
        [side * 0.72, 0.84, 0.26],
        [side * 0.64, 0.66, 0.44],
        [side * 0.56, 0.56, 0.58],
      ],
      0.066,
      0.060,
      0.056,
      10,
      8,
      forgedGold,
      basaltCopper,
    );
    pushGeo(out.armor, out, foreArm);

    pushStrut(
      out.trim,
      out,
      [side * 0.74, 0.92, 0.24],
      [side * 0.62, 0.66, 0.54],
      0.018,
      0.022,
      solarBrass,
      8,
    );

    const hm = makeTransform(side * 0.54, 0.54, 0.64, 0.34, -side * 0.28, side * 0.18);
    pushGeo(
      out.armor,
      out,
      createChamferedHexPart(0.185, 0.28, 0.024),
      hm,
      forgedGold,
    );
    pushGeo(
      out.matte,
      out,
      createChamferedHexPart(0.16, 0.072, 0.016),
      hm.clone().multiply(makeTransform(0, 0, 0.17)),
      darkIron,
    );
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.15, 0.064, 0.014),
      hm.clone().multiply(makeTransform(0, 0, -0.16)),
      basaltCopper,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.18, 0.022, 8, 20),
      hm.clone().multiply(makeTransform(0, 0, 0.09)),
      furnaceAmber,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.155, 0.018, 8, 18),
      hm.clone().multiply(makeTransform(0, 0, -0.06)),
      furnaceAmber,
    );
  }

  const wheelCenter: Vec3Tuple = [0, 1.38, -0.34];
  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.56, 0.068, 12, 36),
    makeTransform(wheelCenter[0], wheelCenter[1], wheelCenter[2], 0.08, 0, 0),
    forgedGold,
  );
  pushGeo(
    out.matte,
    out,
    new THREE.TorusGeometry(0.47, 0.032, 8, 32),
    makeTransform(wheelCenter[0], wheelCenter[1], wheelCenter[2], 0.08, 0, 0),
    darkIron,
  );
  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.14, 0.14, 0.22, 12),
    makeTransform(wheelCenter[0], wheelCenter[1], wheelCenter[2], Math.PI * 0.5 + 0.08, 0, 0),
    basaltCopper,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.15, 0.022, 8, 20),
    makeTransform(wheelCenter[0], wheelCenter[1], wheelCenter[2] - 0.10, 0.08, 0, 0),
    furnaceAmber,
  );

  for (let sp = 0; sp < 6; sp += 1) {
    const a = (sp / 6) * Math.PI * 2;
    const ex = Math.cos(a) * 0.52;
    const ey = wheelCenter[1] + Math.sin(a) * 0.52;
    pushStrut(
      out.matte,
      out,
      wheelCenter,
      [ex, ey, wheelCenter[2] - Math.sin(a) * 0.04],
      0.028,
      0.036,
      castIron,
      6,
    );
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.068, 0.12, 0.012),
      makeTransform(
        Math.cos(a) * 0.62,
        wheelCenter[1] + Math.sin(a) * 0.62,
        wheelCenter[2] - Math.sin(a) * 0.05,
        0.08,
        0,
        a,
      ),
      solarBrass,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.matte,
      out,
      new THREE.CylinderGeometry(0.056, 0.072, 0.34, 8),
      makeTransform(side * 0.32, 1.68, -0.14, -0.22, 0, -side * 0.24),
      darkIron,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.052, 0.014, 6, 14),
      makeTransform(side * 0.36, 1.84, -0.18, Math.PI * 0.5 - 0.22, 0, -side * 0.24),
      furnaceAmber,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createHexMirrorTilePart(0.32, 0.048, 0.016, -0.02),
      makeTransform(side * 0.66, 1.56, -0.38, 0.14, side * 0.32, -side * 0.26),
    );
  }
};

export const UNIT_PACK_3_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  S20: buildS20Michael,
  S21: buildS21Sigma,
  S22: buildS22Vick,
  S23: buildS23Ark,
  S24: buildS24Europa,
  S25: buildS25WhiteRing,
  S26: buildS26Magellan,
  S27: buildS27Ring,
  S28: buildS28Vulcan,
};
