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

function createThrusterBellGeo(
  throatRadius: number,
  exitRadius: number,
  length: number,
  segs = 14,
): THREE.BufferGeometry {
  return createLathePart(
    [
      [exitRadius, 0],
      [exitRadius * 0.94, length * 0.16],
      [throatRadius * 1.18, length * 0.56],
      [throatRadius, length * 0.86],
      [throatRadius * 1.08, length],
    ],
    segs,
  );
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
  const segU = 10;
  const segV = 12;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const halfThick = 0.005;

  for (let side = 0; side < 2; side += 1) {
    const sign = side === 0 ? 1 : -1;
    const base = side * (segU + 1) * (segV + 1);
    for (let iv = 0; iv <= segV; iv += 1) {
      const v = iv / segV;
      const y = v * height;
      const w = widthBottom + (widthTop - widthBottom) * Math.pow(v, 0.85);
      const centerShiftX = rakeX * Math.pow(v, 1.2);
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
  const ceramicWhite: RgbTriple = [0.89, 0.93, 0.98];
  const iceSilver: RgbTriple = [0.72, 0.80, 0.90];
  const cobaltPlate: RgbTriple = [0.22, 0.44, 0.78];
  const darkTitanium: RgbTriple = [0.20, 0.25, 0.34];
  const brightAlloy: RgbTriple = [0.82, 0.88, 0.95];
  const cyanGlow: RgbTriple = [0.92, 0.98, 1.0];
  const crystalCyan: RgbTriple = [0.56, 0.92, 1.0];

  out.weaponGlowHex = 0x3ee2ff;
  out.crystalHex = 0x52dcff;
  out.crystalOpacity = 0.64;
  out.crystalIntensity = 0.58;
  out.headTopLocalY = 1.69;

  const yMid = 1.02;

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.46],
        [0.18, 0.26],
        [0.25, -0.14],
        [0.24, -0.46],
        [0.16, -0.60],
        [-0.16, -0.60],
        [-0.24, -0.46],
        [-0.25, -0.14],
        [-0.18, 0.26],
      ],
      0.16,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid, -0.02, Math.PI * 0.5, 0, 0),
    ceramicWhite,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.36],
        [0.16, 0.14],
        [0.19, -0.34],
        [0.11, -0.54],
        [-0.11, -0.54],
        [-0.19, -0.34],
        [-0.16, 0.14],
      ],
      0.095,
      0.013,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.11, -0.06, Math.PI * 0.5, 0, 0),
    iceSilver,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0, 0.42],
        [0.15, 0.16],
        [0.20, -0.34],
        [0.14, -0.56],
        [-0.14, -0.56],
        [-0.20, -0.34],
        [-0.15, 0.16],
      ],
      0.10,
      0.012,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.11, -0.04, Math.PI * 0.5, 0, 0),
    darkTitanium,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.94],
          [0.056, 0.80],
          [0.070, 0.12],
          [0.052, -0.18],
          [-0.018, -0.18],
          [-0.026, 0.14],
          [-0.020, 0.90],
        ],
        0.092,
        0.010,
        0.010,
        2,
        4,
      ),
      makeTransform(side * 0.088, yMid + 0.02, 0.02, Math.PI * 0.5, 0, 0),
      ceramicWhite,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.017, 0.022, 1.02, 10),
      makeTransform(side * 0.046, yMid + 0.02, 0.46, Math.PI * 0.5, 0, 0),
      brightAlloy,
    );

    pushGeo(
      out.matte,
      out,
      createBevelExtrudePart(
        [
          [0.01, 0.18],
          [0.045, 0.06],
          [0.045, -0.18],
          [-0.01, -0.18],
        ],
        0.036,
        0.004,
        0.004,
        1,
        2,
      ),
      makeTransform(side * 0.068, yMid + 0.02, 0.80, Math.PI * 0.5, 0, 0),
      darkTitanium,
    );

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0.02, 0.28],
          [0.12, 0.12],
          [0.14, -0.24],
          [0.04, -0.36],
          [-0.04, -0.28],
          [-0.04, 0.20],
        ],
        0.076,
        0.009,
        0.009,
        2,
        4,
      ),
      makeTransform(side * 0.22, yMid + 0.02, -0.18, Math.PI * 0.5, 0, 0),
      cobaltPlate,
    );
  }

  pushGeo(
    out.matte,
    out,
    new THREE.CylinderGeometry(0.022, 0.030, 0.96, 8),
    makeTransform(0, yMid + 0.02, 0.38, Math.PI * 0.5, 0, 0),
    darkTitanium,
  );

  for (let i = 0; i < 6; i += 1) {
    const zCoil = 0.14 + i * 0.145;
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.048 - i * 0.0025, 0.011, 8, 16),
      makeTransform(0, yMid + 0.02, zCoil, 0, 0, 0),
      cyanGlow,
    );
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.066 - i * 0.0035, 0.020, 0.004, 0.042 - i * 0.0025),
      makeTransform(0, yMid + 0.02, zCoil - 0.020, 0, 0, 0),
      brightAlloy,
    );
  }

  pushGeo(
    out.energy,
    out,
    new THREE.CylinderGeometry(0.014, 0.018, 0.92, 8),
    makeTransform(0, yMid + 0.02, 0.46, Math.PI * 0.5, 0, 0),
    cyanGlow,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.24],
        [0.10, 0.10],
        [0.12, -0.22],
        [-0.12, -0.22],
        [-0.10, 0.10],
      ],
      0.14,
      0.012,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.22, -0.14, Math.PI * 0.5, 0, 0),
    ceramicWhite,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.095, 0.056, 0.115, 1.55, 0.90, 0.72, 12, 6),
    makeTransform(0, yMid + 0.24, -0.01, -0.10, 0, 0),
    crystalCyan,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.080, 0.040, 0.092, 1.38, 0.98, 0.56, 10, 5),
    makeTransform(0, yMid + 0.24, -0.01, -0.10, 0, 0),
    cyanGlow,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.056, 0],
        [0.046, 0.06],
        [0.032, 0.14],
        [0.016, 0.22],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.28, -0.20, 0, 0, 0),
    brightAlloy,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.036, 0.042, 0.18, 10),
    makeTransform(0, yMid + 0.30, 0.06, Math.PI * 0.5, 0, 0),
    darkTitanium,
  );

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.14, 0.040, 6, 0.58, 0.42),
    makeTransform(0, yMid + 0.30, 0.18, Math.PI * 0.5, 0, 0),
    crystalCyan,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.14, 0],
        [0.05, 0.28],
        [-0.08, 0.28],
        [-0.22, 0],
      ],
      0.030,
      0.006,
      0.006,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.24, -0.34, 0, -Math.PI * 0.5, 0),
    ceramicWhite,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.18, 0],
        [0.08, -0.24],
        [-0.12, -0.20],
        [-0.26, 0],
      ],
      0.036,
      0.006,
      0.006,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.16, -0.20, 0, -Math.PI * 0.5, 0),
    cobaltPlate,
  );

  for (const side of [-1, 1] as const) {
    for (const tier of [0, 1] as const) {
      const yOff = tier === 0 ? 0.15 : -0.15;
      const xPos = side * (tier === 0 ? 0.44 : 0.40);
      const zPos = tier === 0 ? -0.20 : -0.24;
      const roll = side * (tier === 0 ? 0.36 : -0.36);

      pushStrut(
        out.trim,
        out,
        [side * 0.22, yMid + yOff * 0.38, zPos + 0.04],
        [xPos - side * 0.06, yMid + yOff, zPos],
        0.014,
        0.016,
        brightAlloy,
        6,
      );

      pushGeo(
        out.armor,
        out,
        createBevelExtrudePart(
          [
            [-0.15, -0.26],
            [0.15, -0.20],
            [0.19, 0.22],
            [-0.08, 0.30],
            [-0.17, 0.04],
          ],
          0.026,
          0.005,
          0.005,
          2,
          4,
        ),
        makeTransform(xPos, yMid + yOff, zPos, Math.PI * 0.5, 0, roll),
        tier === 0 ? ceramicWhite : iceSilver,
      );

      pushGeo(
        out.trim,
        out,
        createBevelExtrudePart(
          [
            [-0.07, -0.22],
            [0.07, -0.18],
            [0.09, 0.18],
            [-0.05, 0.24],
          ],
          0.030,
          0.003,
          0.003,
          1,
          2,
        ),
        makeTransform(xPos, yMid + yOff, zPos, Math.PI * 0.5, 0, roll),
        cobaltPlate,
      );

      pushGeo(
        out.energy,
        out,
        createBevelExtrudePart(
          [
            [-0.026, -0.20],
            [0.026, -0.18],
            [0.034, 0.20],
            [-0.020, 0.22],
          ],
          0.036,
          0.003,
          0.003,
          1,
          2,
        ),
        makeTransform(xPos, yMid + yOff, zPos, Math.PI * 0.5, 0, roll),
        cyanGlow,
      );
    }
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.050, 0.072, 0.18, 12),
      makeTransform(side * 0.12, yMid, -0.68, Math.PI * 0.5, 0, 0),
      brightAlloy,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.056, 0.16, 12),
      makeTransform(side * 0.12, yMid, -0.74, -Math.PI * 0.5, 0, 0),
      cyanGlow,
    );
  }

  pushGeo(
    out.trim,
    out,
    createThrusterBellGeo(0.062, 0.088, 0.22, 14),
    makeTransform(0, yMid - 0.02, -0.70, Math.PI * 0.5, 0, 0),
    darkTitanium,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.068, 0.20, 12),
    makeTransform(0, yMid - 0.02, -0.78, -Math.PI * 0.5, 0, 0),
    cyanGlow,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.68, 0.16, 0.026, side * 0.12, 0.04, 8),
      makeTransform(side * 0.34, yMid + 0.16, -0.34, -0.22, side * 0.20, -side * 0.88),
    );
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.56, 0.14, 0.024, side * 0.10, 0.03, 8),
      makeTransform(side * 0.30, yMid - 0.10, -0.36, 0.18, side * 0.22, -side * 1.18),
    );
  }
};

const buildS21Sigma: BespokeUnitBuilder = (_ctx, out) => {
  const pearlWhite: RgbTriple = [0.90, 0.94, 0.99];
  const platinumGrey: RgbTriple = [0.74, 0.81, 0.91];
  const deepCobalt: RgbTriple = [0.22, 0.34, 0.54];
  const paleAlloy: RgbTriple = [0.84, 0.85, 0.88];
  const warmSilver: RgbTriple = [0.86, 0.82, 0.72];
  const cyanBeam: RgbTriple = [0.90, 0.98, 1.0];
  const crystalAzure: RgbTriple = [0.46, 0.92, 1.0];

  out.weaponGlowHex = 0x36e6ff;
  out.crystalHex = 0x4ee8ff;
  out.crystalOpacity = 0.68;
  out.crystalIntensity = 0.64;
  out.headTopLocalY = 1.80;

  const yMid = 1.06;

  const makeRhombicHollow = (outerX: number, outerZ: number, holeX: number, holeZ: number, depth: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(0, outerZ);
    shape.lineTo(outerX, 0.02);
    shape.lineTo(0, -outerZ * 0.86);
    shape.lineTo(-outerX, 0.02);
    shape.closePath();

    const hole = new THREE.Path();
    hole.moveTo(0, holeZ);
    hole.lineTo(holeX, 0.02);
    hole.lineTo(0, -holeZ * 0.86);
    hole.lineTo(-holeX, 0.02);
    hole.closePath();
    shape.holes.push(hole);

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.014,
      bevelThickness: 0.014,
      bevelSegments: 2,
      curveSegments: 4,
    });
    geo.translate(0, 0, -depth * 0.5);
    geo.computeVertexNormals();
    return geo;
  };

  pushGeo(
    out.armor,
    out,
    makeRhombicHollow(0.49, 0.72, 0.25, 0.36, 0.082),
    makeTransform(0, yMid + 0.14, 0, Math.PI * 0.5, 0, 0),
    pearlWhite,
  );

  pushGeo(
    out.armor,
    out,
    makeRhombicHollow(0.44, 0.66, 0.23, 0.33, 0.078),
    makeTransform(0, yMid - 0.14, 0, Math.PI * 0.5, 0, 0),
    platinumGrey,
  );

  pushGeo(
    out.matte,
    out,
    makeRhombicHollow(0.40, 0.60, 0.26, 0.38, 0.16),
    makeTransform(0, yMid, 0, Math.PI * 0.5, 0, 0),
    deepCobalt,
  );

  const pillarCoords: readonly Vec3Tuple[] = [
    [0.34, yMid, 0.02],
    [-0.34, yMid, 0.02],
    [0, yMid, -0.44],
    [0.18, yMid, 0.34],
    [-0.18, yMid, 0.34],
    [0.18, yMid, -0.26],
    [-0.18, yMid, -0.26],
  ];
  for (const [px, py, pz] of pillarCoords) {
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.026, 0.026, 0.34, 8),
      makeTransform(px, py, pz, 0, 0, 0),
      warmSilver,
    );
  }

  for (const side of [-1, 1] as const) {
    pushStrut(
      out.trim,
      out,
      [0, yMid + 0.19, 0.66],
      [side * 0.46, yMid + 0.19, 0.02],
      0.011,
      0.011,
      warmSilver,
      6,
    );
    pushStrut(
      out.trim,
      out,
      [side * 0.46, yMid + 0.19, 0.02],
      [0, yMid + 0.19, -0.58],
      0.011,
      0.011,
      warmSilver,
      6,
    );
    pushStrut(
      out.energy,
      out,
      [0, yMid + 0.19, 0.36],
      [side * 0.25, yMid + 0.19, 0.02],
      0.008,
      0.008,
      cyanBeam,
      6,
    );
    pushStrut(
      out.energy,
      out,
      [side * 0.25, yMid + 0.19, 0.02],
      [0, yMid + 0.19, -0.32],
      0.008,
      0.008,
      cyanBeam,
      6,
    );
  }

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.68, 0.19, 6, 0.52, 0.48),
    makeTransform(0, yMid, 0.02, 0, Math.PI / 6, 0),
    crystalAzure,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.115, 0),
    makeTransform(0, yMid, 0.02, 0, 0, 0, 1, 1.65, 1),
    cyanBeam,
  );

  for (const dirY of [-1, 1] as const) {
    pushGeo(
      out.trim,
      out,
      createLathePart(
        [
          [0.125, 0],
          [0.080, 0.08],
          [0.036, 0.20],
          [0.010, 0.28],
        ],
        12,
      ),
      makeTransform(0, yMid + dirY * 0.32, 0.02, dirY === 1 ? 0 : Math.PI, 0, 0),
      warmSilver,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.12, 0.013, 8, 20),
      makeTransform(0, yMid + dirY * 0.27, 0.02, Math.PI * 0.5, 0, 0),
      cyanBeam,
    );
  }

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.46, 0.017, 8, 36),
    makeTransform(0, yMid, 0.02, Math.PI * 0.5, 0, 0),
    paleAlloy,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.38, 0.015, 8, 32),
    makeTransform(0, yMid, 0.02, Math.PI * 0.5 + 0.48, 0, 0.34),
    warmSilver,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.30, 0.010, 8, 28),
    makeTransform(0, yMid, 0.02, Math.PI * 0.5 - 0.44, 0, -0.30),
    cyanBeam,
  );

  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const rx = Math.cos(a) * 0.46;
    const rz = 0.02 + Math.sin(a) * 0.46;
    pushGeo(
      out.trim,
      out,
      new THREE.OctahedronGeometry(i % 3 === 0 ? 0.030 : 0.020, 0),
      makeTransform(rx, yMid, rz, 0, -a, 0),
      i % 3 === 0 ? warmSilver : paleAlloy,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.40],
          [0.095, 0.14],
          [0.088, -0.18],
          [-0.036, -0.10],
          [-0.036, 0.28],
        ],
        0.10,
        0.010,
        0.010,
        2,
        4,
      ),
      makeTransform(side * 0.11, yMid, 0.50, Math.PI * 0.5, 0, 0),
      pearlWhite,
    );

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.28],
          [0.24, -0.02],
          [0.20, -0.28],
          [0.02, -0.20],
        ],
        0.042,
        0.008,
        0.008,
        2,
        4,
      ),
      makeTransform(side * 0.40, yMid + 0.04, -0.04, Math.PI * 0.5, 0, -side * 0.18),
      pearlWhite,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.012, 0.012, 0.38, 8),
      makeTransform(side * 0.075, yMid, 0.62, Math.PI * 0.5, 0, 0),
      cyanBeam,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.016, 0.024, 0.42, 8),
      makeTransform(side * 0.135, yMid + 0.09, 0.56, Math.PI * 0.5, 0, 0),
      paleAlloy,
    );
  }

  pushGeo(
    out.energy,
    out,
    createFacetedCrystalPart(0.24, 0.056, 6, 0.64, 0.36),
    makeTransform(0, yMid, 0.70, Math.PI * 0.5, 0, 0),
    cyanBeam,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.14, 0.054, 0.16, 1.44, 0.90, 0.66, 12, 6),
    makeTransform(0, yMid + 0.23, 0.34, 0.04, 0, 0),
    crystalAzure,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.20, 0.032, 10, 24),
    makeTransform(0, yMid, -0.60, 0, 0, 0),
    paleAlloy,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.16, 0.018, 8, 24),
    makeTransform(0, yMid, -0.63, 0, 0, 0),
    cyanBeam,
  );

  pushGeo(
    out.matte,
    out,
    createChamferedHexPart(0.15, 0.10, 0.010, 0.08),
    makeTransform(0, yMid, -0.56, 0, 0, 0),
    deepCobalt,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.44],
          [0.14, 0.04],
          [0, -0.32],
          [-0.08, 0.04],
        ],
        0.024,
        0.005,
        0.005,
        2,
        4,
      ),
      makeTransform(side * 0.54, yMid + 0.22, -0.18, 0.18, side * 0.28, -side * 0.46),
    );
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.34],
          [0.10, 0.02],
          [0, -0.24],
          [-0.06, 0.02],
        ],
        0.020,
        0.004,
        0.004,
        2,
        4,
      ),
      makeTransform(side * 0.50, yMid - 0.18, -0.22, -0.18, side * 0.26, -side * 1.08),
    );
  }
};

const buildS22Vick: BespokeUnitBuilder = (_ctx, out) => {
  const battleCrimson: RgbTriple = [0.66, 0.17, 0.24];
  const obsidianHull: RgbTriple = [0.20, 0.14, 0.18];
  const gunmetalFrame: RgbTriple = [0.16, 0.17, 0.22];
  const darkCopperTrim: RgbTriple = [0.58, 0.28, 0.30];
  const crimsonGlow: RgbTriple = [1.0, 0.84, 0.86];
  const rubyCrystal: RgbTriple = [0.96, 0.22, 0.34];

  out.weaponGlowHex = 0xff2644;
  out.crystalHex = 0xe81e3c;
  out.crystalOpacity = 0.66;
  out.crystalIntensity = 0.58;
  out.headTopLocalY = 1.72;

  const yMid = 1.02;

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.68],
        [0.24, 0.32],
        [0.42, -0.14],
        [0.36, -0.50],
        [0.14, -0.58],
        [-0.14, -0.58],
        [-0.36, -0.50],
        [-0.42, -0.14],
        [-0.24, 0.32],
      ],
      0.17,
      0.018,
      0.016,
      2,
      4,
    ),
    makeTransform(0, yMid, 0, Math.PI * 0.5, 0, 0),
    obsidianHull,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.56],
        [0.22, 0.14],
        [0.32, -0.24],
        [0.22, -0.48],
        [-0.22, -0.48],
        [-0.32, -0.24],
        [-0.22, 0.14],
      ],
      0.12,
      0.014,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.12, -0.04, Math.PI * 0.5, 0, 0),
    battleCrimson,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0, 0.48],
        [0.20, 0.10],
        [0.34, -0.28],
        [0.18, -0.52],
        [-0.18, -0.52],
        [-0.34, -0.28],
        [-0.20, 0.10],
      ],
      0.14,
      0.012,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.12, -0.02, Math.PI * 0.5, 0, 0),
    gunmetalFrame,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.24],
        [0.14, 0.04],
        [0.16, -0.28],
        [-0.16, -0.28],
        [-0.14, 0.04],
      ],
      0.16,
      0.012,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.25, -0.14, Math.PI * 0.5, 0, 0),
    obsidianHull,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.18, 0.048, 0.14, 1.56, 1.04, 0.48, 12, 5),
    makeTransform(0, yMid + 0.14, 0.35, 0.10, 0, 0),
    rubyCrystal,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.15, 0.028, 0.11, 1.44, 1.08, 0.36, 10, 4),
    makeTransform(0, yMid + 0.14, 0.36, 0.10, 0, 0),
    crimsonGlow,
  );

  pushGeo(
    out.trim,
    out,
    createBevelExtrudePart(
      [
        [0.12, 0],
        [0.02, 0.24],
        [-0.10, 0.22],
        [-0.20, 0],
      ],
      0.034,
      0.006,
      0.006,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.32, -0.20, 0, -Math.PI * 0.5, 0),
    darkCopperTrim,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.010, 0.016, 0.22, 8),
    makeTransform(0, yMid + 0.44, -0.14, 0, 0, 0),
    darkCopperTrim,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.010, 0],
        [0.062, 0.024],
        [0.068, 0.042],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.42, -0.06, Math.PI * 0.44, 0, 0),
    darkCopperTrim,
  );

  pushGeo(
    out.energy,
    out,
    createChamferedHexPart(0.13, 0.036, 0.006, 0.05),
    makeTransform(0, yMid - 0.19, 0.06, Math.PI * 0.5, 0, 0),
    crimsonGlow,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.trim,
      out,
      createBevelExtrudePart(
        [
          [0, 0.38],
          [0.06, 0.24],
          [0.08, -0.30],
          [-0.04, -0.34],
          [-0.05, 0.28],
        ],
        0.044,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.16, yMid + 0.20, 0.02, Math.PI * 0.5, 0, -side * 0.18),
      darkCopperTrim,
    );

    pushGeo(
      out.matte,
      out,
      createBevelExtrudePart(
        [
          [-0.05, -0.22],
          [0.05, -0.22],
          [0.06, 0.20],
          [-0.05, 0.20],
        ],
        0.068,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.32, yMid + 0.02, -0.18, Math.PI * 0.5, 0, 0),
      gunmetalFrame,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.013, 0.013, 0.40, 8),
      makeTransform(side * 0.26, yMid + 0.04, -0.04, Math.PI * 0.5, side * 0.24, 0),
      crimsonGlow,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.016, 0.022, 0.26, 8),
      makeTransform(side * 0.16, yMid + 0.10, 0.42, Math.PI * 0.5, 0, 0),
      darkCopperTrim,
    );

    for (const row of [0, 1] as const) {
      const ex = side * (row === 0 ? 0.14 : 0.28);
      const ey = yMid + (row === 0 ? 0.03 : -0.02);
      const ez = row === 0 ? -0.60 : -0.56;
      pushGeo(
        out.matte,
        out,
        createThrusterBellGeo(0.044, 0.060, 0.15, 10),
        makeTransform(ex, ey, ez, Math.PI * 0.5, 0, 0),
        gunmetalFrame,
      );
      pushGeo(
        out.energy,
        out,
        new THREE.ConeGeometry(0.046, 0.13, 10),
        makeTransform(ex, ey, ez - 0.06, -Math.PI * 0.5, 0, 0),
        crimsonGlow,
      );
    }
  }

  const droneSlots: readonly { readonly x: number; readonly y: number; readonly z: number; readonly roll: number }[] = [
    { x: 0.45, y: 1.24, z: 0.30, roll: -0.22 },
    { x: 0.54, y: 1.04, z: 0.06, roll: -0.14 },
    { x: 0.60, y: 0.84, z: -0.20, roll: -0.24 },
  ];

  for (const side of [-1, 1] as const) {
    for (const slot of droneSlots) {
      const dx = side * slot.x;
      const dy = slot.y;
      const dz = slot.z;
      const dRoll = side * slot.roll;

      pushGeo(
        out.armor,
        out,
        createBevelExtrudePart(
          [
            [0, 0.18],
            [0.10, -0.07],
            [0.045, -0.10],
            [-0.045, -0.10],
            [-0.10, -0.07],
          ],
          0.038,
          0.006,
          0.006,
          2,
          4,
        ),
        makeTransform(dx, dy, dz, Math.PI * 0.5, 0, dRoll),
        battleCrimson,
      );

      pushGeo(
        out.trim,
        out,
        createBevelExtrudePart(
          [
            [0, 0.12],
            [0.038, -0.06],
            [-0.038, -0.06],
          ],
          0.046,
          0.005,
          0.005,
          1,
          2,
        ),
        makeTransform(dx, dy + 0.020, dz - 0.01, Math.PI * 0.5, 0, dRoll),
        darkCopperTrim,
      );

      pushGeo(
        out.trim,
        out,
        new THREE.ConeGeometry(0.016, 0.075, 6),
        makeTransform(dx, dy + 0.008, dz + 0.14, Math.PI * 0.5, 0, 0),
        darkCopperTrim,
      );

      pushGeo(
        out.energy,
        out,
        new THREE.ConeGeometry(0.020, 0.075, 8),
        makeTransform(dx, dy, dz - 0.11, -Math.PI * 0.5, 0, 0),
        crimsonGlow,
      );
    }
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.64, 0.16, 0.026, side * 0.14, 0.04, 8),
      makeTransform(side * 0.36, yMid + 0.16, -0.24, -0.14, side * 0.24, -side * 0.86),
    );
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.52, 0.13, 0.022, side * 0.10, 0.03, 8),
      makeTransform(side * 0.34, yMid - 0.10, -0.28, 0.14, side * 0.26, -side * 1.14),
    );
  }
};

const buildS23Ark: BespokeUnitBuilder = (_ctx, out) => {
  const astralIndigo: RgbTriple = [0.20, 0.30, 0.48];
  const deckSlate: RgbTriple = [0.30, 0.42, 0.60];
  const antiqueBronze: RgbTriple = [0.78, 0.58, 0.30];
  const darkBulkhead: RgbTriple = [0.16, 0.20, 0.28];
  const hexCyanGlow: RgbTriple = [0.88, 0.98, 1.0];
  const bridgeCrystal: RgbTriple = [0.42, 0.84, 0.98];

  out.weaponGlowHex = 0x2ed8f2;
  out.crystalHex = 0x46ccf8;
  out.crystalOpacity = 0.64;
  out.crystalIntensity = 0.56;
  out.headTopLocalY = 1.79;

  const yMid = 1.00;

  pushGeo(
    out.armor,
    out,
    createLathePart(
      [
        [0.04, 0],
        [0.14, 0.08],
        [0.20, 0.26],
        [0.22, 0.64],
        [0.20, 1.08],
        [0.17, 1.26],
        [0.12, 1.34],
      ],
      14,
    ),
    makeTransform(0, yMid, -0.62, Math.PI * 0.5, 0, 0),
    astralIndigo,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.14, 0.60],
        [0.24, 0.46],
        [0.26, -0.44],
        [0.16, -0.58],
        [-0.16, -0.58],
        [-0.26, -0.44],
        [-0.24, 0.46],
        [-0.14, 0.60],
      ],
      0.16,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.10, 0.04, Math.PI * 0.5, 0, 0),
    deckSlate,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0.14, 0.56],
        [0.22, 0.38],
        [0.24, -0.42],
        [0.14, -0.54],
        [-0.14, -0.54],
        [-0.24, -0.42],
        [-0.22, 0.38],
        [-0.14, 0.56],
      ],
      0.16,
      0.014,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.11, 0.02, Math.PI * 0.5, 0, 0),
    darkBulkhead,
  );

  for (const zBand of [-0.42, -0.18, 0.16, 0.42] as const) {
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.255, 0.046, 0.008, 0.18),
      makeTransform(0, yMid, zBand, 0, 0, 0),
      antiqueBronze,
    );
  }

  for (const side of [-1, 1] as const) {
    pushStrut(
      out.trim,
      out,
      [side * 0.19, yMid + 0.19, -0.46],
      [side * 0.19, yMid + 0.19, 0.50],
      0.016,
      0.016,
      antiqueBronze,
      6,
    );
    pushStrut(
      out.matte,
      out,
      [side * 0.18, yMid - 0.19, -0.44],
      [side * 0.18, yMid - 0.19, 0.48],
      0.016,
      0.016,
      darkBulkhead,
      6,
    );
  }

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.13, 0.020, 8, 20),
    makeTransform(0, yMid, 0.70, 0, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.CylinderGeometry(0.085, 0.085, 0.04, 12),
    makeTransform(0, yMid, 0.69, Math.PI * 0.5, 0, 0),
    hexCyanGlow,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.10, 0.18],
        [0.13, -0.16],
        [-0.13, -0.16],
        [-0.10, 0.18],
      ],
      0.22,
      0.014,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.30, 0.22, Math.PI * 0.5, 0, 0),
    astralIndigo,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.115, 0.056, 0.10, 1.62, 0.94, 0.62, 12, 6),
    makeTransform(0, yMid + 0.34, 0.33, -0.06, 0, 0),
    bridgeCrystal,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.095, 0.036, 0.08, 1.46, 1.00, 0.46, 10, 4),
    makeTransform(0, yMid + 0.34, 0.34, -0.06, 0, 0),
    hexCyanGlow,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.010, 0.018, 0.26, 8),
    makeTransform(0, yMid + 0.52, 0.16, 0, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.012, 0],
        [0.068, 0.03],
        [0.074, 0.05],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.48, 0.24, Math.PI * 0.42, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.armor,
    out,
    new THREE.TorusGeometry(0.47, 0.058, 10, 32),
    makeTransform(0, yMid, -0.06, 0, 0, 0),
    astralIndigo,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.518, 0.019, 8, 32),
    makeTransform(0, yMid, -0.06, 0, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.424, 0.015, 8, 32),
    makeTransform(0, yMid, -0.06, 0, 0, 0),
    hexCyanGlow,
  );

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const xEnd = Math.cos(a) * 0.44;
    const yEnd = yMid + Math.sin(a) * 0.44;
    pushStrut(
      out.trim,
      out,
      [Math.cos(a) * 0.18, yMid + Math.sin(a) * 0.18, -0.06],
      [xEnd, yEnd, -0.06],
      0.022,
      0.024,
      antiqueBronze,
      8,
    );
    pushGeo(
      out.armor,
      out,
      createChamferedHexPart(0.054, 0.078, 0.008, 0),
      makeTransform(Math.cos(a) * 0.49, yMid + Math.sin(a) * 0.49, -0.06, 0, 0, a),
      deckSlate,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.energy,
      out,
      createBevelExtrudePart(
        [
          [-0.018, -0.34],
          [0.018, -0.34],
          [0.018, 0.34],
          [-0.018, 0.34],
        ],
        0.04,
        0.003,
        0.003,
        1,
        2,
      ),
      makeTransform(side * 0.255, yMid + 0.06, 0.14, Math.PI * 0.5, 0, 0),
      hexCyanGlow,
    );
  }

  pushGeo(
    out.matte,
    out,
    createChamferedHexPart(0.24, 0.08, 0.010, 0),
    makeTransform(0, yMid, -0.58, 0, 0, 0),
    darkBulkhead,
  );

  const engineOffsets: readonly [number, number][] = [
    [-0.10, 0.09],
    [0.10, 0.09],
    [-0.10, -0.09],
    [0.10, -0.09],
  ];
  for (const [ex, ey] of engineOffsets) {
    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.044, 0.066, 0.16, 12),
      makeTransform(ex, yMid + ey, -0.66, Math.PI * 0.5, 0, 0),
      antiqueBronze,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.050, 0.15, 10),
      makeTransform(ex, yMid + ey, -0.74, -Math.PI * 0.5, 0, 0),
      hexCyanGlow,
    );
  }

  const shuttleSlots: readonly { readonly x: number; readonly y: number; readonly z: number }[] = [
    { x: 0.48, y: 1.24, z: 0.36 },
    { x: 0.54, y: 0.84, z: 0.24 },
  ];
  for (const side of [-1, 1] as const) {
    for (const s of shuttleSlots) {
      const sx = side * s.x;
      pushGeo(
        out.armor,
        out,
        createBevelExtrudePart(
          [
            [0, 0.16],
            [0.092, -0.07],
            [0.048, -0.11],
            [-0.048, -0.11],
            [-0.092, -0.07],
          ],
          0.042,
          0.005,
          0.005,
          2,
          4,
        ),
        makeTransform(sx, s.y, s.z, Math.PI * 0.5, 0, -side * 0.16),
        deckSlate,
      );
      pushGeo(
        out.trim,
        out,
        new THREE.ConeGeometry(0.028, 0.10, 6),
        makeTransform(sx, s.y + 0.018, s.z + 0.05, Math.PI * 0.5, 0, 0),
        antiqueBronze,
      );
      pushGeo(
        out.energy,
        out,
        new THREE.ConeGeometry(0.020, 0.065, 8),
        makeTransform(sx, s.y, s.z - 0.12, -Math.PI * 0.5, 0, 0),
        hexCyanGlow,
      );
    }
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.44],
          [0.16, 0.18],
          [0.14, -0.30],
          [-0.04, -0.22],
        ],
        0.028,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.42, yMid + 0.20, -0.34, 0.12, side * 0.28, -side * 0.42),
    );
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.36],
          [0.12, 0.12],
          [0.10, -0.24],
          [-0.04, -0.18],
        ],
        0.024,
        0.005,
        0.005,
        2,
        4,
      ),
      makeTransform(side * 0.40, yMid - 0.20, -0.34, -0.12, side * 0.28, -side * 1.12),
    );
  }
};

const buildS24Europa: BespokeUnitBuilder = (_ctx, out) => {
  const glacierWhite: RgbTriple = [0.84, 0.92, 0.97];
  const arcticBlue: RgbTriple = [0.22, 0.48, 0.70];
  const abyssNavy: RgbTriple = [0.15, 0.26, 0.40];
  const frostedAlloy: RgbTriple = [0.76, 0.86, 0.94];
  const cryoGlow: RgbTriple = [0.88, 0.98, 1.0];
  const iceDomeCrystal: RgbTriple = [0.58, 0.92, 1.0];

  out.weaponGlowHex = 0x3ad8ff;
  out.crystalHex = 0x6ce4ff;
  out.crystalOpacity = 0.66;
  out.crystalIntensity = 0.56;
  out.headTopLocalY = 1.66;

  const yMid = 0.96;

  for (const side of [-1, 1] as const) {
    const hx = side * 0.35;

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.68],
          [0.11, 0.36],
          [0.145, -0.22],
          [0.115, -0.56],
          [-0.115, -0.56],
          [-0.145, -0.22],
          [-0.11, 0.36],
        ],
        0.18,
        0.016,
        0.014,
        2,
        4,
      ),
      makeTransform(hx, yMid, 0.02, Math.PI * 0.5, 0, 0),
      glacierWhite,
    );

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.52],
          [0.085, 0.22],
          [0.105, -0.34],
          [0.06, -0.52],
          [-0.06, -0.52],
          [-0.105, -0.34],
          [-0.085, 0.22],
        ],
        0.09,
        0.012,
        0.010,
        2,
        4,
      ),
      makeTransform(hx, yMid + 0.11, -0.02, Math.PI * 0.5, 0, 0),
      arcticBlue,
    );

    pushGeo(
      out.matte,
      out,
      createBevelExtrudePart(
        [
          [0, 0.58],
          [0.09, 0.20],
          [0.11, -0.44],
          [-0.11, -0.44],
          [-0.09, 0.20],
        ],
        0.10,
        0.010,
        0.010,
        2,
        4,
      ),
      makeTransform(hx, yMid - 0.11, 0, Math.PI * 0.5, 0, 0),
      abyssNavy,
    );

    pushGeo(
      out.trim,
      out,
      createBevelExtrudePart(
        [
          [0.34, 0],
          [0.10, -0.08],
          [-0.22, -0.06],
          [-0.28, 0.04],
          [0.16, 0.06],
        ],
        0.028,
        0.004,
        0.004,
        1,
        2,
      ),
      makeTransform(hx, yMid - 0.12, 0.34, 0, -Math.PI * 0.5, 0),
      frostedAlloy,
    );

    for (const zHatch of [-0.18, 0.04, 0.22] as const) {
      pushGeo(
        out.trim,
        out,
        createChamferedHexPart(0.056, 0.032, 0.005, 0),
        makeTransform(hx, yMid + 0.165, zHatch, Math.PI * 0.5, 0, 0),
        frostedAlloy,
      );
    }

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.24],
          [0.18, -0.10],
          [0.14, -0.28],
          [0, -0.20],
        ],
        0.036,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(hx + side * 0.11, yMid + 0.02, -0.24, Math.PI * 0.5, 0, -side * 0.20),
      glacierWhite,
    );

    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.064, 0.096, 0.22, 14),
      makeTransform(hx, yMid, -0.66, Math.PI * 0.5, 0, 0),
      frostedAlloy,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.088, 0.011, 8, 18),
      makeTransform(hx, yMid, -0.66, 0, 0, 0),
      cryoGlow,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.074, 0.22, 12),
      makeTransform(hx, yMid, -0.76, -Math.PI * 0.5, 0, 0),
      cryoGlow,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.012, 0.012, 0.58, 8),
      makeTransform(hx + side * 0.13, yMid + 0.02, 0.04, Math.PI * 0.5, 0, 0),
      cryoGlow,
    );

    pushStrut(
      out.matte,
      out,
      [hx - side * 0.10, yMid - 0.12, 0.20],
      [0, yMid - 0.12, 0.18],
      0.020,
      0.020,
      abyssNavy,
      6,
    );
  }

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.34, 0.28],
        [0.34, -0.34],
        [-0.34, -0.34],
        [-0.34, 0.28],
      ],
      0.16,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.04, -0.04, Math.PI * 0.5, 0, 0),
    arcticBlue,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0.30, 0.22],
        [0.30, -0.26],
        [-0.30, -0.26],
        [-0.30, 0.22],
      ],
      0.09,
      0.010,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.08, -0.04, Math.PI * 0.5, 0, 0),
    abyssNavy,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.28],
        [0.16, 0.10],
        [0.18, -0.24],
        [-0.18, -0.24],
        [-0.16, 0.10],
      ],
      0.18,
      0.014,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.21, -0.14, Math.PI * 0.5, 0, 0),
    glacierWhite,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.14, 0.072, 0.16, 1.72, 0.78, 0.78, 14, 6),
    makeTransform(0, yMid + 0.29, -0.02, -0.08, 0, 0),
    iceDomeCrystal,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.11, 0.048, 0.12, 1.50, 0.88, 0.58, 10, 4),
    makeTransform(0, yMid + 0.29, -0.02, -0.08, 0, 0),
    cryoGlow,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.14, 0],
        [0.04, 0.24],
        [-0.10, 0.22],
        [-0.22, 0],
      ],
      0.032,
      0.006,
      0.006,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.30, -0.30, 0, -Math.PI * 0.5, 0),
    arcticBlue,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.010, 0.016, 0.20, 8),
    makeTransform(0, yMid + 0.44, -0.22, 0, 0, 0),
    frostedAlloy,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.010, 0],
        [0.064, 0.026],
        [0.070, 0.044],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.44, -0.14, Math.PI * 0.42, 0, 0),
    frostedAlloy,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.15, 0.24],
        [0.17, -0.16],
        [-0.17, -0.16],
        [-0.15, 0.24],
      ],
      0.16,
      0.014,
      0.012,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.12, 0.22, Math.PI * 0.5, 0, 0),
    glacierWhite,
  );

  const quadCoords: readonly [number, number][] = [
    [-0.075, 0.048],
    [0.075, 0.048],
    [-0.075, -0.048],
    [0.075, -0.048],
  ];
  for (const [bx, by] of quadCoords) {
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.020, 0.026, 0.60, 10),
      makeTransform(bx, yMid + 0.12 + by, 0.58, Math.PI * 0.5, 0, 0),
      frostedAlloy,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.027, 0.008, 6, 14),
      makeTransform(bx, yMid + 0.12 + by, 0.54, 0, 0, 0),
      cryoGlow,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.026, 0.007, 6, 14),
      makeTransform(bx, yMid + 0.12 + by, 0.70, 0, 0, 0),
      cryoGlow,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.028, 0.028, 0.056, 8),
      makeTransform(bx, yMid + 0.12 + by, 0.82, Math.PI * 0.5, 0, 0),
      abyssNavy,
    );
  }

  pushGeo(
    out.trim,
    out,
    createThrusterBellGeo(0.052, 0.076, 0.18, 12),
    makeTransform(0, yMid + 0.02, -0.46, Math.PI * 0.5, 0, 0),
    frostedAlloy,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.058, 0.16, 10),
    makeTransform(0, yMid + 0.02, -0.55, -Math.PI * 0.5, 0, 0),
    cryoGlow,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.60, 0.15, 0.026, side * 0.12, 0.04, 8),
      makeTransform(side * 0.46, yMid + 0.16, -0.26, -0.14, side * 0.22, -side * 0.82),
    );
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.30],
          [0.12, 0.04],
          [0.08, -0.22],
          [-0.04, -0.16],
        ],
        0.024,
        0.005,
        0.005,
        2,
        4,
      ),
      makeTransform(side * 0.44, yMid - 0.12, -0.28, 0.16, side * 0.22, -side * 1.10),
    );
  }
};

const buildS25WhiteRing: BespokeUnitBuilder = (_ctx, out) => {
  const navalBlue: RgbTriple = [0.18, 0.30, 0.50];
  const slateArmor: RgbTriple = [0.28, 0.44, 0.66];
  const charcoalCore: RgbTriple = [0.15, 0.19, 0.27];
  const titaniumSilver: RgbTriple = [0.74, 0.80, 0.88];
  const fieldBlueGlow: RgbTriple = [0.88, 0.96, 1.0];
  const shieldAzure: RgbTriple = [0.40, 0.82, 1.0];

  out.weaponGlowHex = 0x3ab6ff;
  out.crystalHex = 0x52c8ff;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.56;
  out.headTopLocalY = 1.92;

  const yMid = 1.02;

  pushGeo(
    out.armor,
    out,
    new THREE.CylinderGeometry(0.32, 0.38, 0.48, 8),
    makeTransform(0, yMid - 0.34, 0, 0, Math.PI / 8, 0),
    navalBlue,
  );

  pushGeo(
    out.armor,
    out,
    new THREE.CylinderGeometry(0.34, 0.34, 0.58, 8),
    makeTransform(0, yMid + 0.04, 0, 0, Math.PI / 8, 0),
    slateArmor,
  );

  pushGeo(
    out.armor,
    out,
    new THREE.CylinderGeometry(0.24, 0.33, 0.34, 8),
    makeTransform(0, yMid + 0.42, 0, 0, Math.PI / 8, 0),
    navalBlue,
  );

  pushGeo(
    out.matte,
    out,
    new THREE.CylinderGeometry(0.37, 0.37, 0.14, 8),
    makeTransform(0, yMid - 0.14, 0, 0, Math.PI / 8, 0),
    charcoalCore,
  );

  pushGeo(
    out.matte,
    out,
    new THREE.CylinderGeometry(0.35, 0.35, 0.12, 8),
    makeTransform(0, yMid + 0.24, 0, 0, Math.PI / 8, 0),
    charcoalCore,
  );

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const bx = Math.cos(a) * 0.34;
    const bz = Math.sin(a) * 0.34;
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [-0.08, -0.34],
          [0.08, -0.34],
          [0.06, 0.32],
          [-0.06, 0.32],
        ],
        0.10,
        0.012,
        0.012,
        2,
        4,
      ),
      makeTransform(bx, yMid - 0.16, bz, 0, -a + Math.PI * 0.5, 0),
      navalBlue,
    );
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.022, 0.028, 0.44, 8),
      makeTransform(Math.cos(a) * 0.30, yMid + 0.38, Math.sin(a) * 0.30, 0, 0, 0),
      titaniumSilver,
    );
    pushStrut(
      out.trim,
      out,
      [Math.cos(a) * 0.32, yMid + 0.04, Math.sin(a) * 0.32],
      [Math.cos(a) * 0.52, yMid + 0.04, Math.sin(a) * 0.52],
      0.018,
      0.022,
      titaniumSilver,
      6,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [-0.10, -0.18],
          [0.10, -0.18],
          [0.08, 0.18],
          [-0.08, 0.18],
        ],
        0.064,
        0.010,
        0.010,
        2,
        4,
      ),
      makeTransform(side * 0.36, yMid + 0.06, 0, 0, Math.PI * 0.5, 0),
      slateArmor,
    );
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.072, 0.044, 0.008, 0.032),
      makeTransform(side * 0.39, yMid + 0.06, 0, 0, Math.PI * 0.5, 0),
      titaniumSilver,
    );
  }

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.24],
        [0.18, 0.10],
        [0.18, -0.18],
        [0, -0.26],
        [-0.18, -0.18],
        [-0.18, 0.10],
      ],
      0.16,
      0.014,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.06, 0.32, 0, 0, 0),
    slateArmor,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.15, 0.068, 0.12, 1.56, 0.94, 0.58, 12, 6),
    makeTransform(0, yMid + 0.12, 0.34, 0, 0, 0),
    shieldAzure,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.13, 0.044, 0.095, 1.42, 1.00, 0.42, 10, 4),
    makeTransform(0, yMid + 0.12, 0.35, 0, 0, 0),
    fieldBlueGlow,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.56, 0.044, 10, 36),
    makeTransform(0, yMid + 0.02, 0, Math.PI * 0.5 + 0.34, 0, 0.22),
    titaniumSilver,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.525, 0.014, 8, 36),
    makeTransform(0, yMid + 0.02, 0, Math.PI * 0.5 + 0.34, 0, 0.22),
    fieldBlueGlow,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.47, 0.038, 10, 32),
    makeTransform(0, yMid + 0.04, 0, Math.PI * 0.5 - 0.34, 0, -0.22),
    titaniumSilver,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.435, 0.013, 8, 32),
    makeTransform(0, yMid + 0.04, 0, Math.PI * 0.5 - 0.34, 0, -0.22),
    fieldBlueGlow,
  );

  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const nx = Math.cos(a) * 0.56;
    const nz = Math.sin(a) * 0.56;
    const ny = yMid + 0.02 - Math.sin(a) * 0.18 + Math.cos(a) * 0.10;
    pushGeo(
      out.armor,
      out,
      createChamferedHexPart(0.068, 0.056, 0.008, 0),
      makeTransform(nx, ny, nz, 0, -a, 0),
      navalBlue,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.SphereGeometry(0.026, 8, 6),
      makeTransform(nx, ny, nz, 0, 0, 0),
      fieldBlueGlow,
    );
  }

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.50, 0.44, 0.48, 1.38, 0.86, 1.32, 16, 8),
    makeTransform(0, yMid + 0.04, 0.10, 0, 0, 0),
    shieldAzure,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.18, 0],
        [0.14, 0.08],
        [0.09, 0.14],
        [0.12, 0.22],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.52, 0, 0, 0, 0),
    titaniumSilver,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.19, 0.016, 8, 24),
    makeTransform(0, yMid + 0.60, 0, Math.PI * 0.5, 0, 0),
    titaniumSilver,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.SphereGeometry(0.088, 12, 10),
    makeTransform(0, yMid + 0.64, 0, 0, 0, 0),
    fieldBlueGlow,
  );

  pushGeo(
    out.crystal,
    out,
    new THREE.IcosahedronGeometry(0.125, 1),
    makeTransform(0, yMid + 0.64, 0, 0, 0, 0),
    shieldAzure,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.018, 0.022, 0.36, 8),
      makeTransform(side * 0.14, yMid + 0.44, 0.28, Math.PI * 0.5, 0, 0),
      titaniumSilver,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.024, 0.007, 6, 14),
      makeTransform(side * 0.14, yMid + 0.44, 0.42, 0, 0, 0),
      fieldBlueGlow,
    );
    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.048, 0.072, 0.16, 12),
      makeTransform(side * 0.18, yMid - 0.58, -0.06, 0, 0, 0),
      charcoalCore,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.056, 0.14, 10),
      makeTransform(side * 0.18, yMid - 0.66, -0.06, Math.PI, 0, 0),
      fieldBlueGlow,
    );
  }

  pushGeo(
    out.trim,
    out,
    createThrusterBellGeo(0.078, 0.115, 0.20, 14),
    makeTransform(0, yMid - 0.60, 0.08, 0, 0, 0),
    titaniumSilver,
  );
  pushGeo(
    out.energy,
    out,
    new THREE.ConeGeometry(0.088, 0.16, 12),
    makeTransform(0, yMid - 0.69, 0.08, Math.PI, 0, 0),
    fieldBlueGlow,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createChamferedHexPart(0.24, 0.036, 0.008, 0.10),
      makeTransform(side * 0.56, yMid + 0.34, -0.26, 0.16, side * 0.32, -side * 0.24),
    );
    pushGeo(
      out.wingParts,
      out,
      createChamferedHexPart(0.20, 0.032, 0.008, 0.08),
      makeTransform(side * 0.52, yMid - 0.14, -0.28, -0.14, side * 0.34, -side * 0.36),
    );
  }
};

const buildS26Magellan: BespokeUnitBuilder = (_ctx, out) => {
  const emeraldHull: RgbTriple = [0.18, 0.54, 0.44];
  const jadePlate: RgbTriple = [0.26, 0.44, 0.42];
  const antiqueBronze: RgbTriple = [0.80, 0.62, 0.34];
  const carbonSteel: RgbTriple = [0.16, 0.22, 0.24];
  const photonEmerald: RgbTriple = [0.88, 1.0, 0.92];
  const sailBot: RgbTriple = [0.36, 0.88, 0.68];
  const sailTop: RgbTriple = [0.92, 0.82, 0.48];

  out.weaponGlowHex = 0x36f0a6;
  out.crystalHex = 0x58f2b8;
  out.crystalOpacity = 0.64;
  out.crystalIntensity = 0.56;
  out.headTopLocalY = 1.94;

  const yMid = 0.78;

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.66],
        [0.14, 0.34],
        [0.21, -0.06],
        [0.18, -0.44],
        [0.09, -0.60],
        [-0.09, -0.60],
        [-0.18, -0.44],
        [-0.21, -0.06],
        [-0.14, 0.34],
      ],
      0.16,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid, 0.02, Math.PI * 0.5, 0, 0),
    emeraldHull,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.48],
        [0.12, 0.18],
        [0.15, -0.32],
        [0.08, -0.50],
        [-0.08, -0.50],
        [-0.15, -0.32],
        [-0.12, 0.18],
      ],
      0.10,
      0.012,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.10, -0.04, Math.PI * 0.5, 0, 0),
    jadePlate,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0.54, 0],
        [0.26, -0.18],
        [-0.36, -0.16],
        [-0.56, 0],
      ],
      0.072,
      0.010,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.08, 0.02, 0, -Math.PI * 0.5, 0),
    carbonSteel,
  );

  for (const zRing of [-0.34, -0.06, 0.24] as const) {
    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.19, 0.036, 0.006, 0.13),
      makeTransform(0, yMid, zRing, 0, 0, 0),
      antiqueBronze,
    );
  }

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.085, 0],
        [0.068, 0.14],
        [0.036, 0.30],
        [0.010, 0.40],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.02, 0.52, Math.PI * 0.5, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.SphereGeometry(0.024, 10, 8),
    makeTransform(0, yMid + 0.02, 0.92, 0, 0, 0),
    photonEmerald,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.11, 0.056, 0.13, 1.56, 0.88, 0.68, 12, 6),
    makeTransform(0, yMid + 0.19, 0.14, -0.06, 0, 0),
    sailBot,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.088, 0.036, 0.10, 1.40, 0.96, 0.50, 10, 4),
    makeTransform(0, yMid + 0.19, 0.15, -0.06, 0, 0),
    photonEmerald,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.04, 0.24],
        [-0.12, 0.14],
        [-0.22, -0.26],
        [0.04, -0.18],
      ],
      0.030,
      0.006,
      0.006,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.02, -0.58, 0, -Math.PI * 0.5, 0),
    emeraldHull,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.016, 0.024, 0.96, 10),
    makeTransform(0, yMid + 0.56, -0.06, -0.08, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.012, 0.014, 0.64, 8),
    makeTransform(0, yMid + 0.96, -0.10, 0, 0, Math.PI * 0.5),
    antiqueBronze,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.010, 0.012, 0.44, 8),
    makeTransform(0, yMid + 0.56, -0.06, 0, 0, Math.PI * 0.5),
    antiqueBronze,
  );

  pushGeo(
    out.crystal,
    out,
    createBillowingSailGeometry(0.30, 0.62, 0.86, 0.16, 0, sailBot, sailTop),
    makeTransform(0, yMid + 0.18, -0.04, 0.06, 0, 0),
  );

  pushGeo(
    out.energy,
    out,
    createTaperedTubePart(
      [
        [0, yMid + 0.20, 0.04],
        [0, yMid + 0.62, 0.12],
        [0, yMid + 1.00, 0.02],
      ],
      0.010,
      0.007,
      10,
      6,
    ),
    undefined,
    photonEmerald,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.24],
        [0.09, 0.10],
        [0.09, -0.22],
        [0, -0.28],
        [-0.09, -0.22],
        [-0.09, 0.10],
      ],
      0.09,
      0.010,
      0.010,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.18, 0.08, Math.PI * 0.5, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.040, 0.009, 6, 16),
    makeTransform(0, yMid - 0.18, 0.34, 0, 0, 0),
    photonEmerald,
  );

  pushGeo(
    out.trim,
    out,
    createLathePart(
      [
        [0.010, 0],
        [0.056, 0.022],
        [0.062, 0.038],
      ],
      12,
    ),
    makeTransform(0, yMid + 0.24, 0.34, Math.PI * 0.42, 0, 0),
    antiqueBronze,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.TorusGeometry(0.11, 0.014, 8, 20),
    makeTransform(0, yMid + 0.02, 0.52, 0, 0, 0),
    antiqueBronze,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.26],
          [0.055, 0.12],
          [0.055, -0.24],
          [-0.025, -0.26],
          [-0.025, 0.18],
        ],
        0.046,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.21, yMid + 0.04, -0.06, Math.PI * 0.5, 0, 0),
      jadePlate,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.CylinderGeometry(0.010, 0.010, 0.42, 8),
      makeTransform(side * 0.23, yMid + 0.04, -0.04, Math.PI * 0.5, 0, 0),
      photonEmerald,
    );
  }

  for (const side of [-1, 1] as const) {
    pushStrut(
      out.trim,
      out,
      [side * 0.16, yMid + 0.08, -0.06],
      [side * 0.56, yMid + 0.42, -0.14],
      0.013,
      0.019,
      antiqueBronze,
      8,
    );

    pushGeo(
      out.crystal,
      out,
      createBillowingSailGeometry(0.22, 0.42, 0.48, 0.11, side * 0.06, sailBot, sailTop),
      makeTransform(side * 0.20, yMid + 0.08, -0.08, 0.14, side * 0.22, -side * 0.94),
    );

    pushStrut(
      out.energy,
      out,
      [side * 0.20, yMid + 0.12, -0.04],
      [side * 0.54, yMid + 0.40, -0.12],
      0.007,
      0.006,
      photonEmerald,
      6,
    );

    pushStrut(
      out.matte,
      out,
      [0, yMid + 0.04, 0.66],
      [side * 0.30, yMid + 0.96, -0.10],
      0.006,
      0.006,
      carbonSteel,
      6,
    );

    pushStrut(
      out.matte,
      out,
      [0, yMid + 0.04, 0.60],
      [side * 0.54, yMid + 0.40, -0.14],
      0.006,
      0.006,
      carbonSteel,
      6,
    );

    pushStrut(
      out.matte,
      out,
      [0, yMid + 0.10, -0.56],
      [side * 0.30, yMid + 0.96, -0.10],
      0.006,
      0.006,
      carbonSteel,
      6,
    );

    pushStrut(
      out.matte,
      out,
      [0, yMid + 0.08, -0.54],
      [side * 0.54, yMid + 0.40, -0.14],
      0.006,
      0.006,
      carbonSteel,
      6,
    );

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.22],
          [0.072, 0.10],
          [0.072, -0.18],
          [0, -0.24],
          [-0.072, -0.18],
          [-0.072, 0.10],
        ],
        0.10,
        0.010,
        0.010,
        2,
        4,
      ),
      makeTransform(side * 0.24, yMid - 0.10, 0.12, Math.PI * 0.5, 0, 0),
      antiqueBronze,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.020, 0.022, 0.28, 8),
      makeTransform(side * 0.24, yMid - 0.08, 0.24, Math.PI * 0.5, 0, 0),
      carbonSteel,
    );

    pushGeo(
      out.trim,
      out,
      new THREE.CylinderGeometry(0.018, 0.020, 0.24, 8),
      makeTransform(side * 0.24, yMid - 0.14, 0.22, Math.PI * 0.5, 0, 0),
      carbonSteel,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.023, 0.008, 6, 14),
      makeTransform(side * 0.24, yMid - 0.08, 0.38, 0, 0, 0),
      photonEmerald,
    );

    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.042, 0.064, 0.16, 12),
      makeTransform(side * 0.11, yMid - 0.02, -0.64, Math.PI * 0.5, 0, 0),
      antiqueBronze,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.048, 0.15, 10),
      makeTransform(side * 0.11, yMid - 0.02, -0.73, -Math.PI * 0.5, 0, 0),
      photonEmerald,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.66, 0.16, 0.024, side * 0.14, 0.05, 8),
      makeTransform(side * 0.32, yMid + 0.54, -0.22, -0.10, side * 0.20, -side * 0.72),
    );
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.54, 0.14, 0.022, side * 0.10, 0.04, 8),
      makeTransform(side * 0.30, yMid + 0.16, -0.26, 0.10, side * 0.24, -side * 1.10),
    );
  }
};

const buildS27Ring: BespokeUnitBuilder = (_ctx, out) => {
  const obsidianBlack: RgbTriple = [0.18, 0.14, 0.26];
  const royalAmethyst: RgbTriple = [0.34, 0.22, 0.48];
  const carbonFrame: RgbTriple = [0.13, 0.13, 0.18];
  const violetAlloy: RgbTriple = [0.66, 0.60, 0.78];
  const plasmaMagenta: RgbTriple = [1.0, 0.86, 1.0];
  const containmentViolet: RgbTriple = [0.80, 0.36, 1.0];

  out.weaponGlowHex = 0xf038e8;
  out.crystalHex = 0xd446ff;
  out.crystalOpacity = 0.54;
  out.crystalIntensity = 0.68;
  out.headTopLocalY = 1.99;

  const yMid = 1.12;
  const ringTiltX = Math.PI * 0.5 - 0.30;

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.44, 0.108, 14, 36),
    makeTransform(0, yMid + 0.06, 0, ringTiltX, 0, 0),
    plasmaMagenta,
  );

  pushGeo(
    out.crystal,
    out,
    new THREE.TorusGeometry(0.44, 0.145, 12, 36),
    makeTransform(0, yMid + 0.06, 0, ringTiltX, 0, 0),
    containmentViolet,
  );

  pushGeo(
    out.armor,
    out,
    new THREE.CylinderGeometry(0.22, 0.26, 0.46, 8),
    makeTransform(0, yMid, 0, -0.30, Math.PI / 8, 0),
    obsidianBlack,
  );

  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.25, 0.076, 0.012, 0.13),
    makeTransform(0, yMid + 0.23, -0.07, ringTiltX, 0, 0),
    violetAlloy,
  );

  pushGeo(
    out.trim,
    out,
    createChamferedHexPart(0.25, 0.076, 0.012, 0.13),
    makeTransform(0, yMid - 0.23, 0.07, ringTiltX, 0, 0),
    violetAlloy,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.OctahedronGeometry(0.14, 0),
    makeTransform(0, yMid + 0.36, -0.10, 0, 0, 0, 1, 1.35, 1),
    plasmaMagenta,
  );

  pushGeo(
    out.matte,
    out,
    new THREE.TorusGeometry(0.56, 0.062, 10, 32),
    makeTransform(0, yMid - 0.04, 0.01, ringTiltX, 0, 0),
    carbonFrame,
  );

  pushGeo(
    out.matte,
    out,
    new THREE.TorusGeometry(0.44, 0.052, 8, 28),
    makeTransform(0, yMid - 0.14, 0.04, ringTiltX, 0, 0),
    carbonFrame,
  );

  const tiltMat = makeTransform(0, yMid + 0.06, 0, -0.30, 0, 0);
  const skirtMat = makeTransform(0, yMid - 0.06, 0.02, -0.30, 0, 0);

  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    const localPos = new THREE.Vector3(Math.cos(a) * 0.44, 0, Math.sin(a) * 0.44).applyMatrix4(tiltMat);
    pushGeo(
      out.trim,
      out,
      new THREE.TorusGeometry(0.168, 0.028, 8, 18),
      makeTransform(localPos.x, localPos.y, localPos.z, -0.30, -a, 0),
      violetAlloy,
    );

    const armorPos = new THREE.Vector3(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56).applyMatrix4(skirtMat);
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [-0.14, -0.13],
          [0.14, -0.13],
          [0.11, 0.13],
          [-0.11, 0.13],
        ],
        0.10,
        0.014,
        0.014,
        2,
        4,
      ),
      makeTransform(armorPos.x, armorPos.y, armorPos.z, -0.30, -a + Math.PI * 0.5, 0),
      i % 2 === 0 ? obsidianBlack : royalAmethyst,
    );
  }

  for (let i = 0; i < 4; i += 1) {
    const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
    const basePos = new THREE.Vector3(Math.cos(a) * 0.58, 0.0, Math.sin(a) * 0.58).applyMatrix4(tiltMat);
    const tipPos = new THREE.Vector3(Math.cos(a) * 0.62, 0.46, Math.sin(a) * 0.62).applyMatrix4(tiltMat);
    const botPos = new THREE.Vector3(Math.cos(a) * 0.60, -0.38, Math.sin(a) * 0.60).applyMatrix4(tiltMat);

    pushStrut(out.armor, out, [botPos.x, botPos.y, botPos.z], [tipPos.x, tipPos.y, tipPos.z], 0.052, 0.072, obsidianBlack, 6);

    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.082, 0.060, 0.008, 0),
      makeTransform(basePos.x, basePos.y, basePos.z, ringTiltX, 0, 0),
      violetAlloy,
    );

    pushStrut(
      out.energy,
      out,
      [basePos.x * 0.96, basePos.y, basePos.z * 0.96],
      [tipPos.x * 0.96, tipPos.y, tipPos.z * 0.96],
      0.014,
      0.014,
      plasmaMagenta,
      6,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.OctahedronGeometry(0.056, 0),
      makeTransform(tipPos.x, tipPos.y + 0.04, tipPos.z, 0, 0, 0),
      plasmaMagenta,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.046, 0.13, 8),
      makeTransform(botPos.x, botPos.y - 0.05, botPos.z, Math.PI, 0, 0),
      plasmaMagenta,
    );
  }

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0, 0.30],
        [0.24, 0.06],
        [0.22, -0.18],
        [-0.22, -0.18],
        [-0.24, 0.06],
      ],
      0.20,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.12, 0.56, Math.PI * 0.5 - 0.30, 0, 0),
    royalAmethyst,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.18, 0.064, 0.13, 1.56, 0.94, 0.56, 12, 6),
    makeTransform(0, yMid - 0.05, 0.64, -0.12, 0, 0),
    containmentViolet,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.15, 0.038, 0.10, 1.44, 1.00, 0.42, 10, 4),
    makeTransform(0, yMid - 0.05, 0.65, -0.12, 0, 0),
    plasmaMagenta,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.crystal,
      out,
      createBevelExtrudePart(
        [
          [0, 0.32],
          [0.16, 0.16],
          [0.16, -0.20],
          [0, -0.28],
          [-0.12, -0.16],
          [-0.12, 0.16],
        ],
        0.022,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.38, yMid + 0.06, 0.52, 0.06, side * 0.46, 0),
      containmentViolet,
    );

    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.062, 0.094, 0.20, 12),
      makeTransform(side * 0.26, yMid + 0.12, -0.66, Math.PI * 0.5, 0, 0),
      violetAlloy,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.070, 0.18, 10),
      makeTransform(side * 0.26, yMid + 0.12, -0.76, -Math.PI * 0.5, 0, 0),
      plasmaMagenta,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createChamferedHexPart(0.28, 0.040, 0.010, 0.12),
      makeTransform(side * 0.62, yMid + 0.36, -0.28, 0.18, side * 0.32, -side * 0.28),
    );
    pushGeo(
      out.wingParts,
      out,
      createCurvedBladePart(0.62, 0.16, 0.026, side * 0.14, 0.04, 8),
      makeTransform(side * 0.54, yMid - 0.12, -0.32, 0.14, side * 0.26, -side * 1.16),
    );
  }
};

const buildS28Vulcan: BespokeUnitBuilder = (_ctx, out) => {
  const forgedGold: RgbTriple = [0.84, 0.66, 0.30];
  const volcanicBronze: RgbTriple = [0.58, 0.35, 0.19];
  const industrialIron: RgbTriple = [0.21, 0.20, 0.22];
  const brightBrass: RgbTriple = [0.92, 0.78, 0.44];
  const moltenAmber: RgbTriple = [1.0, 0.90, 0.72];
  const plasmaCrystal: RgbTriple = [1.0, 0.66, 0.24];

  out.weaponGlowHex = 0xff8a20;
  out.crystalHex = 0xffa634;
  out.crystalOpacity = 0.66;
  out.crystalIntensity = 0.64;
  out.headTopLocalY = 1.94;

  const yMid = 1.06;

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.24, 0.46],
        [0.36, 0.22],
        [0.38, -0.38],
        [0.28, -0.58],
        [-0.28, -0.58],
        [-0.38, -0.38],
        [-0.36, 0.22],
        [-0.24, 0.46],
      ],
      0.30,
      0.020,
      0.018,
      2,
      4,
    ),
    makeTransform(0, yMid, -0.08, Math.PI * 0.5, 0, 0),
    forgedGold,
  );

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.20, 0.34],
        [0.28, 0.12],
        [0.30, -0.34],
        [0.20, -0.52],
        [-0.20, -0.52],
        [-0.30, -0.34],
        [-0.28, 0.12],
        [-0.20, 0.34],
      ],
      0.17,
      0.016,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.19, -0.10, Math.PI * 0.5, 0, 0),
    volcanicBronze,
  );

  pushGeo(
    out.matte,
    out,
    createBevelExtrudePart(
      [
        [0.22, 0.42],
        [0.32, 0.16],
        [0.34, -0.42],
        [0.22, -0.56],
        [-0.22, -0.56],
        [-0.34, -0.42],
        [-0.32, 0.16],
        [-0.22, 0.42],
      ],
      0.16,
      0.014,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid - 0.19, -0.06, Math.PI * 0.5, 0, 0),
    industrialIron,
  );

  for (const zRib of [-0.38, -0.14, 0.10] as const) {
    pushGeo(
      out.matte,
      out,
      createChamferedHexPart(0.37, 0.058, 0.010, 0.27),
      makeTransform(0, yMid, zRib, 0, 0, 0),
      industrialIron,
    );
  }

  pushGeo(
    out.armor,
    out,
    createBevelExtrudePart(
      [
        [0.15, 0.20],
        [0.19, -0.18],
        [-0.19, -0.18],
        [-0.15, 0.20],
      ],
      0.24,
      0.014,
      0.014,
      2,
      4,
    ),
    makeTransform(0, yMid + 0.38, -0.18, Math.PI * 0.5, 0, 0),
    forgedGold,
  );

  pushGeo(
    out.crystal,
    out,
    createCurvedVisorPart(0.15, 0.060, 0.11, 1.56, 0.94, 0.56, 12, 6),
    makeTransform(0, yMid + 0.42, -0.03, -0.08, 0, 0),
    plasmaCrystal,
  );

  pushGeo(
    out.energy,
    out,
    createCurvedVisorPart(0.13, 0.038, 0.085, 1.44, 1.00, 0.42, 10, 4),
    makeTransform(0, yMid + 0.42, -0.02, -0.08, 0, 0),
    moltenAmber,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.016, 0.024, 0.24, 8),
    makeTransform(0, yMid + 0.60, -0.24, 0, 0, 0),
    brightBrass,
  );

  pushGeo(
    out.trim,
    out,
    new THREE.CylinderGeometry(0.24, 0.26, 0.16, 12),
    makeTransform(0, yMid, 0.40, Math.PI * 0.5, 0, 0),
    brightBrass,
  );

  pushGeo(
    out.energy,
    out,
    new THREE.TorusGeometry(0.22, 0.024, 8, 24),
    makeTransform(0, yMid, 0.46, 0, 0, 0),
    moltenAmber,
  );

  pushGeo(
    out.matte,
    out,
    createLathePart(
      [
        [0.22, 0],
        [0.19, 0.14],
        [0.13, 0.30],
        [0.06, 0.44],
        [0.014, 0.52],
      ],
      12,
    ),
    makeTransform(0, yMid, 0.44, Math.PI * 0.5, 0, 0),
    industrialIron,
  );

  for (let i = 0; i < 3; i += 1) {
    const a = (i / 3) * Math.PI * 2 + Math.PI * 0.5;
    const bladeGeo = createBevelExtrudePart(
      [
        [0.04, 0.0],
        [0.24, 0.02],
        [0.18, 0.22],
        [0.09, 0.40],
        [0.01, 0.48],
      ],
      0.044,
      0.008,
      0.008,
      2,
      4,
    );
    const bladeMat = new THREE.Matrix4()
      .makeTranslation(0, yMid, 0.44)
      .multiply(new THREE.Matrix4().makeRotationZ(a))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI * 0.5));
    pushGeo(out.armor, out, bladeGeo, bladeMat, forgedGold);

    const edgeGeo = createBevelExtrudePart(
      [
        [0.18, 0.04],
        [0.26, 0.04],
        [0.20, 0.24],
        [0.10, 0.42],
        [0.04, 0.42],
      ],
      0.024,
      0.005,
      0.005,
      1,
      2,
    );
    const edgeMat = new THREE.Matrix4()
      .makeTranslation(0, yMid, 0.44)
      .multiply(new THREE.Matrix4().makeRotationZ(a + 0.08))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI * 0.5));
    pushGeo(out.trim, out, edgeGeo, edgeMat, brightBrass);

    const glowVein = createBevelExtrudePart(
      [
        [0.13, 0.06],
        [0.17, 0.06],
        [0.11, 0.34],
        [0.06, 0.34],
      ],
      0.050,
      0.004,
      0.004,
      1,
      2,
    );
    pushGeo(out.energy, out, glowVein, bladeMat, moltenAmber);
  }

  pushGeo(
    out.crystal,
    out,
    createFacetedCrystalPart(0.18, 0.068, 6, 0.62, 0.38),
    makeTransform(0, yMid, 0.90, Math.PI * 0.5, 0, 0),
    plasmaCrystal,
  );

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.36],
          [0.12, 0.18],
          [0.14, -0.34],
          [-0.06, -0.38],
          [-0.10, 0.20],
        ],
        0.15,
        0.012,
        0.012,
        2,
        4,
      ),
      makeTransform(side * 0.48, yMid + 0.02, 0.10, Math.PI * 0.5, 0, -side * 0.10),
      volcanicBronze,
    );

    pushGeo(
      out.energy,
      out,
      createBevelExtrudePart(
        [
          [-0.018, -0.22],
          [0.018, -0.22],
          [0.018, 0.22],
          [-0.018, 0.22],
        ],
        0.036,
        0.003,
        0.003,
        1,
        2,
      ),
      makeTransform(side * 0.32, yMid + 0.26, -0.10, Math.PI * 0.5, 0, 0),
      moltenAmber,
    );

    pushStrut(
      out.matte,
      out,
      [side * 0.34, yMid + 0.04, 0.10],
      [side * 0.52, yMid + 0.02, 0.30],
      0.038,
      0.044,
      industrialIron,
      8,
    );

    pushStrut(
      out.trim,
      out,
      [side * 0.52, yMid + 0.02, 0.34],
      [side * 0.42, yMid + 0.02, 0.72],
      0.030,
      0.040,
      brightBrass,
      8,
    );

    pushGeo(
      out.armor,
      out,
      createBevelExtrudePart(
        [
          [0, 0.22],
          [0.10, 0.04],
          [0.08, -0.14],
          [-0.06, -0.10],
        ],
        0.088,
        0.008,
        0.008,
        2,
        4,
      ),
      makeTransform(side * 0.40, yMid + 0.02, 0.72, Math.PI * 0.5, 0, side * 0.34),
      forgedGold,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.SphereGeometry(0.040, 10, 8),
      makeTransform(side * 0.33, yMid + 0.02, 0.74, 0, 0, 0),
      moltenAmber,
    );

    pushGeo(
      out.trim,
      out,
      createChamferedHexPart(0.28, 0.072, 0.012, 0.10),
      makeTransform(side * 0.46, yMid + 0.44, -0.28, 0, Math.PI * 0.5 - side * 0.22, 0),
      brightBrass,
    );

    pushGeo(
      out.matte,
      out,
      new THREE.CylinderGeometry(0.12, 0.12, 0.13, 10),
      makeTransform(side * 0.46, yMid + 0.44, -0.28, 0, 0, Math.PI * 0.5 + side * 0.22),
      industrialIron,
    );

    pushGeo(
      out.energy,
      out,
      new THREE.TorusGeometry(0.19, 0.020, 8, 20),
      makeTransform(side * 0.46, yMid + 0.44, -0.28, 0, Math.PI * 0.5 - side * 0.22, 0),
      moltenAmber,
    );

    pushStrut(
      out.matte,
      out,
      [side * 0.26, yMid + 0.20, -0.26],
      [side * 0.44, yMid + 0.42, -0.28],
      0.034,
      0.038,
      industrialIron,
      8,
    );
  }

  const sternNozzles: readonly [number, number][] = [
    [-0.22, 0.10],
    [0, 0.12],
    [0.22, 0.10],
    [-0.22, -0.10],
    [0, -0.12],
    [0.22, -0.10],
  ];
  for (const [nx, ny] of sternNozzles) {
    pushGeo(
      out.trim,
      out,
      createThrusterBellGeo(0.050, 0.074, 0.18, 12),
      makeTransform(nx, yMid + ny, -0.70, Math.PI * 0.5, 0, 0),
      volcanicBronze,
    );
    pushGeo(
      out.energy,
      out,
      new THREE.ConeGeometry(0.058, 0.17, 10),
      makeTransform(nx, yMid + ny, -0.80, -Math.PI * 0.5, 0, 0),
      moltenAmber,
    );
  }

  for (const side of [-1, 1] as const) {
    pushGeo(
      out.wingParts,
      out,
      createHexMirrorTilePart(0.30, 0.042, 0.014, -0.02),
      makeTransform(side * 0.62, yMid + 0.46, -0.34, 0.16, side * 0.32, -side * 0.26),
    );
    pushGeo(
      out.wingParts,
      out,
      createBevelExtrudePart(
        [
          [0, 0.38],
          [0.14, 0.10],
          [0.12, -0.24],
          [-0.04, -0.18],
        ],
        0.028,
        0.006,
        0.006,
        2,
        4,
      ),
      makeTransform(side * 0.56, yMid - 0.12, -0.36, -0.14, side * 0.28, -side * 1.14),
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
