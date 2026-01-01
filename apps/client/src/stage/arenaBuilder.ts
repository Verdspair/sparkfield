import * as THREE from 'three';
import {
  BENCH_SLOTS,
  BOARD_COLS,
  BOARD_ROWS,
  CRYO_BENCH_SLOT,
  type ArenaThemeId,
  type HexCoord,
} from '@pkg/contracts';
import type { PbrMaterialLibrary } from './pbrMaterials.js';
import {
  BENCH_SLOT_SPACING,
  BENCH_Z_OFFSET,
  HEX_RADIUS,
  SpringDamper,
  benchSlotToStageXZ,
  getHexesWithinRange,
  getSeatWorldOrigin,
  hexToStageXZ,
} from './spring.js';

const TOTAL_HEXES = BOARD_ROWS * BOARD_COLS; 

function createPointyHexRingGeometry(outerR: number, innerR: number, height: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angle) * outerR;
    const y = Math.sin(angle) * outerR;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const hole = new THREE.Path();
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const x = Math.cos(angle) * innerR;
    const y = Math.sin(angle) * innerR;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  hole.closePath();
  shape.holes.push(hole);

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 1,
  });
  geom.rotateX(-Math.PI * 0.5);
  return geom;
}

export class ArenaStageAssembly {
  public readonly root = new THREE.Group();
  public readonly bloomTargets: THREE.Object3D[] = [];

  private readonly materials: PbrMaterialLibrary;
  private currentTheme: ArenaThemeId = 'orbital_elevator_port';

  private readonly hexBezelInstanced: THREE.InstancedMesh;
  private readonly hexPlateInstanced: THREE.InstancedMesh;
  private readonly hexHoverSprings: SpringDamper[] = [];
  private hoveredHexIndex = -1;
  private readonly hoverFresnelRing: THREE.Mesh;
  private readonly battleGridOpacitySpring = new SpringDamper(1.0, 14, 0.85);

  private readonly rangeDashedLines: THREE.LineSegments;
  private readonly swapArcGroup = new THREE.Group();
  private readonly swapArcMesh: THREE.Mesh;
  private readonly swapArrowStart: THREE.Mesh;
  private readonly swapArrowEnd: THREE.Mesh;
  private readonly swapArcCurve: THREE.QuadraticBezierCurve3;

  private readonly benchRingsInstanced: THREE.InstancedMesh;
  private readonly benchDepressSprings: SpringDamper[] = [];
  private readonly benchOccupied: boolean[] = new Array<boolean>(BENCH_SLOTS).fill(false);
  private readonly cryoCanopyMesh: THREE.Mesh;
  private readonly cryoLampMat: THREE.MeshStandardMaterial;
  private readonly cryoSlideSpring = new SpringDamper(0, 18, 0.78);
  private cryoEnabled = false;

  private readonly interestCollarsInstanced: THREE.InstancedMesh;
  private readonly interestPillarCoords: { x: number; z: number; tier: number }[] = [];
  private readonly interestLiftSprings: SpringDamper[] = [];
  private readonly interestTierMats: THREE.ShaderMaterial[] = [];
  private currentGold = 0;

  private readonly conduitShaderMat: THREE.ShaderMaterial;
  private conduitSweepProgress = 1.5;

  private readonly themeGroups: Record<ArenaThemeId, THREE.Group>;
  private elapsedSec = 0;
  private readonly tempMatrix = new THREE.Matrix4();
  private readonly tempPos = new THREE.Vector3();
  private readonly tempQuat = new THREE.Quaternion();
  private readonly tempScale = new THREE.Vector3(1, 1, 1);
  private readonly tempColor = new THREE.Color();

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];

  constructor(materials: PbrMaterialLibrary, initialTheme: ArenaThemeId = 'orbital_elevator_port') {
    this.materials = materials;

    const mainDeckGeo = new THREE.BoxGeometry(15.8, 0.42, 16.4);
    this.ownedGeometries.push(mainDeckGeo);
    const mainDeck = new THREE.Mesh(mainDeckGeo, materials.deckArmorMat);
    mainDeck.position.set(0, -0.23, 0.85);
    this.root.add(mainDeck);

    const deckTrimGeo = new THREE.BoxGeometry(16.05, 0.12, 16.65);
    this.ownedGeometries.push(deckTrimGeo);
    const deckTrim = new THREE.Mesh(deckTrimGeo, materials.brushedGoldMat);
    deckTrim.position.set(0, -0.09, 0.85);
    this.root.add(deckTrim);

    const scoutPadGeo = new THREE.CylinderGeometry(7.8, 8.2, 0.36, 6);
    this.ownedGeometries.push(scoutPadGeo);
    const scoutPads = new THREE.InstancedMesh(scoutPadGeo, materials.deckArmorMat, 7);
    for (let s = 1; s < 8; s += 1) {
      const origin = getSeatWorldOrigin(s);
      this.tempMatrix.makeTranslation(origin.x, -0.20, origin.z + 0.6);
      scoutPads.setMatrixAt(s - 1, this.tempMatrix);
    }
    scoutPads.instanceMatrix.needsUpdate = true;
    this.root.add(scoutPads);

    const bezelGeo = createPointyHexRingGeometry(HEX_RADIUS * 0.965, HEX_RADIUS * 0.885, 0.028);
    const plateGeo = new THREE.CylinderGeometry(HEX_RADIUS * 0.88, HEX_RADIUS * 0.90, 0.045, 6);
    this.ownedGeometries.push(bezelGeo, plateGeo);

    this.hexBezelInstanced = new THREE.InstancedMesh(bezelGeo, materials.hexBezelGoldMat, TOTAL_HEXES);
    this.hexPlateInstanced = new THREE.InstancedMesh(plateGeo, materials.hexTileBasaltMat, TOTAL_HEXES);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const idx = row * BOARD_COLS + col;
        this.hexHoverSprings.push(new SpringDamper(0, 28, 0.68));
        this.writeHexInstanceTransform(idx, row, col, 0);
      }
    }
    this.root.add(this.hexPlateInstanced, this.hexBezelInstanced);

    const hoverRingGeo = createPointyHexRingGeometry(HEX_RADIUS * 0.875, HEX_RADIUS * 0.76, 0.014);
    const hoverRingMat = materials.createBloomEmissiveMaterial(0x5cc8d6, 1.9);
    hoverRingMat.transparent = true;
    hoverRingMat.opacity = 0.88;
    this.ownedGeometries.push(hoverRingGeo);
    this.hoverFresnelRing = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    this.hoverFresnelRing.visible = false;
    this.root.add(this.hoverFresnelRing);
    this.bloomTargets.push(this.hoverFresnelRing);

    const emptyLineGeo = new THREE.BufferGeometry();
    emptyLineGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const dashedMat = new THREE.LineDashedMaterial({
      color: 0xf0dcaa,
      dashSize: 0.22,
      gapSize: 0.13,
      transparent: true,
      opacity: 0.92,
    });
    this.ownedGeometries.push(emptyLineGeo);
    this.ownedMaterials.push(dashedMat);
    this.rangeDashedLines = new THREE.LineSegments(emptyLineGeo, dashedMat);
    this.rangeDashedLines.visible = false;
    this.root.add(this.rangeDashedLines);

    this.swapArcCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.2, 0),
      new THREE.Vector3(0, 1.2, 0),
      new THREE.Vector3(1, 0.2, 0),
    );
    const arcTubeGeo = new THREE.TubeGeometry(this.swapArcCurve, 20, 0.038, 6, false);
    const arrowGeo = new THREE.ConeGeometry(0.11, 0.28, 6);
    const swapMat = materials.createBloomEmissiveMaterial(0xf0dcaa, 1.75);
    this.ownedGeometries.push(arcTubeGeo, arrowGeo);

    this.swapArcMesh = new THREE.Mesh(arcTubeGeo, swapMat);
    this.swapArrowStart = new THREE.Mesh(arrowGeo, swapMat);
    this.swapArrowEnd = new THREE.Mesh(arrowGeo, swapMat);
    this.swapArcGroup.add(this.swapArcMesh, this.swapArrowStart, this.swapArrowEnd);
    this.swapArcGroup.visible = false;
    this.root.add(this.swapArcGroup);
    this.bloomTargets.push(this.swapArcMesh, this.swapArrowStart, this.swapArrowEnd);

    const benchBarGeo = new THREE.BoxGeometry(BENCH_SLOTS * BENCH_SLOT_SPACING + 0.9, 0.16, 1.48);
    const clawGeo = new THREE.BoxGeometry(0.10, 0.08, 0.16);
    const slotRingGeo = new THREE.TorusGeometry(0.48, 0.032, 6, 18);
    slotRingGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(benchBarGeo, clawGeo, slotRingGeo);

    const benchBar = new THREE.Mesh(benchBarGeo, materials.deckArmorMat);
    benchBar.position.set(0, -0.04, BENCH_Z_OFFSET);
    this.root.add(benchBar);

    const clawsInstanced = new THREE.InstancedMesh(clawGeo, materials.brushedGoldMat, BENCH_SLOTS * 4);
    const benchRingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.85,
      emissive: new THREE.Color(0x5c4822),
      emissiveIntensity: 0.45,
    });
    this.ownedMaterials.push(benchRingMat);
    this.benchRingsInstanced = new THREE.InstancedMesh(slotRingGeo, benchRingMat, BENCH_SLOTS);

    let clawIdx = 0;
    const cornerOffsets: readonly [number, number][] = [
      [-0.48, -0.48],
      [0.48, -0.48],
      [-0.48, 0.48],
      [0.48, 0.48],
    ];

    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const center = benchSlotToStageXZ(slot);
      for (const [ox, oz] of cornerOffsets) {
        this.tempPos.set(center.x + ox, 0.055, center.z + oz);
        this.tempQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(ox, oz));
        this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
        clawsInstanced.setMatrixAt(clawIdx, this.tempMatrix);
        clawIdx += 1;
      }

      this.tempMatrix.makeTranslation(center.x, 0.045, center.z);
      this.benchRingsInstanced.setMatrixAt(slot, this.tempMatrix);
      this.tempColor.setHex(slot === CRYO_BENCH_SLOT ? 0x67e8f9 : 0xc8aa6e);
      this.benchRingsInstanced.setColorAt(slot, this.tempColor);
      this.benchDepressSprings.push(new SpringDamper(0, 26, 0.72));
    }
    clawsInstanced.instanceMatrix.needsUpdate = true;
    this.benchRingsInstanced.instanceMatrix.needsUpdate = true;
    if (this.benchRingsInstanced.instanceColor) {
      this.benchRingsInstanced.instanceColor.needsUpdate = true;
    }
    this.root.add(clawsInstanced, this.benchRingsInstanced);

    const slot8Pos = benchSlotToStageXZ(CRYO_BENCH_SLOT);
    const canopyGeo = new THREE.CylinderGeometry(0.56, 0.62, 0.68, 8, 1, false, 0, Math.PI);
    canopyGeo.rotateZ(Math.PI * 0.5);
    canopyGeo.rotateY(Math.PI * 0.5);
    const lampGeo = new THREE.BoxGeometry(0.76, 0.04, 0.08);
    this.ownedGeometries.push(canopyGeo, lampGeo);

    this.cryoCanopyMesh = new THREE.Mesh(canopyGeo, materials.cryoGlassMat);
    this.cryoCanopyMesh.position.set(slot8Pos.x, 0.14, slot8Pos.z + 0.52);
    this.cryoLampMat = materials.createBloomEmissiveMaterial(0x38bdf8, 0.6);
    const cryoLamp = new THREE.Mesh(lampGeo, this.cryoLampMat);
    cryoLamp.position.set(slot8Pos.x, 0.07, slot8Pos.z + 0.64);
    this.root.add(this.cryoCanopyMesh, cryoLamp);
    this.bloomTargets.push(cryoLamp);

    const pillarBaseGeo = new THREE.CylinderGeometry(0.36, 0.42, 0.24, 8);
    const pillarCoreGeo = new THREE.CylinderGeometry(0.20, 0.20, 1.05, 10);
    const pillarCollarGeo = new THREE.TorusGeometry(0.30, 0.045, 6, 12);
    pillarCollarGeo.rotateX(Math.PI * 0.5);
    this.ownedGeometries.push(pillarBaseGeo, pillarCoreGeo, pillarCollarGeo);

    const basesInstanced = new THREE.InstancedMesh(pillarBaseGeo, materials.deckArmorMat, 6);
    this.interestCollarsInstanced = new THREE.InstancedMesh(pillarCollarGeo, materials.brushedGoldMat, 6);

    const zSegments = [2.6, 0.2, -2.2];
    const sides = [-7.35, 7.35];

    for (let tier = 0; tier < 3; tier += 1) {
      const liquidMat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uActive: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec4 localPosition = vec4(position, 1.0);
            #ifdef USE_INSTANCING
              localPosition = instanceMatrix * localPosition;
            #endif
            gl_Position = projectionMatrix * modelViewMatrix * localPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uActive;
          varying vec2 vUv;
          void main() {
            float wave = sin(vUv.y * 14.0 - uTime * 4.2) * 0.5 + 0.5;
            float wave2 = sin(vUv.y * 23.0 + vUv.x * 6.28 - uTime * 6.1) * 0.5 + 0.5;
            float glow = mix(0.08, 1.65 + wave * 0.75 + wave2 * 0.35, uActive);
            vec3 darkIdle = vec3(0.10, 0.13, 0.18);
            vec3 moltenGold = vec3(1.05, 0.84, 0.42) * glow;
            vec3 col = mix(darkIdle, moltenGold, uActive);
            float alpha = mix(0.32, 0.92, uActive);
            gl_FragColor = vec4(col, alpha);
          }
        `,
      });
      this.ownedMaterials.push(liquidMat);
      this.interestTierMats.push(liquidMat);

      const tierCores = new THREE.InstancedMesh(pillarCoreGeo, liquidMat, 2);
      for (let s = 0; s < 2; s += 1) {
        this.tempMatrix.makeTranslation(sides[s]!, 0.62, zSegments[tier]!);
        tierCores.setMatrixAt(s, this.tempMatrix);
      }
      tierCores.instanceMatrix.needsUpdate = true;
      this.root.add(tierCores);
      this.bloomTargets.push(tierCores);
    }

    let pIdx = 0;
    for (const sideX of sides) {
      for (let tier = 0; tier < 3; tier += 1) {
        const pz = zSegments[tier]!;
        this.interestPillarCoords.push({ x: sideX, z: pz, tier });
        this.interestLiftSprings.push(new SpringDamper(0, 20, 0.72));

        this.tempMatrix.makeTranslation(sideX, 0.10, pz);
        basesInstanced.setMatrixAt(pIdx, this.tempMatrix);

        this.tempMatrix.makeTranslation(sideX, 0.28, pz);
        this.interestCollarsInstanced.setMatrixAt(pIdx, this.tempMatrix);
        pIdx += 1;
      }
    }
    basesInstanced.instanceMatrix.needsUpdate = true;
    this.interestCollarsInstanced.instanceMatrix.needsUpdate = true;
    this.root.add(basesInstanced, this.interestCollarsInstanced);

    this.conduitShaderMat = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uSweep: { value: 1.5 },
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uSweep;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float dist = abs(vUv.y - uSweep);
          float pulse = smoothstep(0.24, 0.0, dist);
          float baseBreath = 0.22 + 0.08 * sin(uTime * 2.2 + vUv.y * 6.0);
          vec3 cyan = vec3(0.36, 0.82, 0.92);
          vec3 gold = vec3(1.45, 1.20, 0.72);
          vec3 col = mix(cyan * baseBreath, gold * 1.9, pulse);
          gl_FragColor = vec4(col, 0.88);
        }
      `,
    });
    this.ownedMaterials.push(this.conduitShaderMat);

    const conduitGeo = new THREE.PlaneGeometry(0.14, 13.6);
    conduitGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(conduitGeo);
    const conduitsInstanced = new THREE.InstancedMesh(conduitGeo, this.conduitShaderMat, 2);
    this.tempMatrix.makeTranslation(-6.55, 0.015, 0.4);
    conduitsInstanced.setMatrixAt(0, this.tempMatrix);
    this.tempMatrix.makeTranslation(6.55, 0.015, 0.4);
    conduitsInstanced.setMatrixAt(1, this.tempMatrix);
    conduitsInstanced.instanceMatrix.needsUpdate = true;
    this.root.add(conduitsInstanced);
    this.bloomTargets.push(conduitsInstanced);

    this.themeGroups = {
      orbital_elevator_port: this.buildOrbitalElevatorBackdrop(),
      mercury_dyson_forge: this.buildMercuryDysonBackdrop(),
      event_horizon_observatory: this.buildEventHorizonBackdrop(),
    };
    this.root.add(
      this.themeGroups.orbital_elevator_port,
      this.themeGroups.mercury_dyson_forge,
      this.themeGroups.event_horizon_observatory,
    );
    this.setTheme(initialTheme);
  }

  private buildOrbitalElevatorBackdrop(): THREE.Group {
    const g = new THREE.Group();
    const planetArcGeo = new THREE.SphereGeometry(28, 32, 20);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x1d4e78,
      emissive: new THREE.Color(0x1e6091),
      emissiveIntensity: 0.35,
      roughness: 0.65,
      metalness: 0.15,
    });
    const spireGeo = new THREE.CylinderGeometry(0.28, 0.52, 22, 6);
    this.ownedGeometries.push(planetArcGeo, spireGeo);
    this.ownedMaterials.push(planetMat);

    const planet = new THREE.Mesh(planetArcGeo, planetMat);
    planet.position.set(0, -24.5, -26);
    g.add(planet);

    const spires = new THREE.InstancedMesh(spireGeo, this.materials.deckArmorMat, 2);
    this.tempMatrix.makeTranslation(-11.5, 2, -13.5);
    spires.setMatrixAt(0, this.tempMatrix);
    this.tempMatrix.makeTranslation(11.5, 2, -13.5);
    spires.setMatrixAt(1, this.tempMatrix);
    spires.instanceMatrix.needsUpdate = true;
    g.add(spires);
    return g;
  }

  private buildMercuryDysonBackdrop(): THREE.Group {
    const g = new THREE.Group();
    const sunGeo = new THREE.SphereGeometry(19, 28, 18);
    const sunMat = this.materials.createBloomEmissiveMaterial(0xf59e0b, 1.35);
    const sailGeo = new THREE.CylinderGeometry(1.9, 1.9, 0.08, 6);
    sailGeo.rotateX(Math.PI * 0.42);
    this.ownedGeometries.push(sunGeo, sailGeo);

    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(0, -13, -30);
    g.add(sun);
    this.bloomTargets.push(sun);

    const sailPositions: readonly [number, number, number][] = [
      [-10.5, 4.2, -14],
      [-5.2, 5.6, -16.5],
      [5.2, 5.6, -16.5],
      [10.5, 4.2, -14],
    ];
    const sails = new THREE.InstancedMesh(sailGeo, this.materials.brushedGoldMat, sailPositions.length);
    const dummy = new THREE.Object3D();
    sailPositions.forEach(([x, y, z], idx) => {
      dummy.position.set(x, y, z);
      dummy.lookAt(0, -8, -28);
      dummy.updateMatrix();
      sails.setMatrixAt(idx, dummy.matrix);
    });
    sails.instanceMatrix.needsUpdate = true;
    g.add(sails);
    return g;
  }

  private buildEventHorizonBackdrop(): THREE.Group {
    const g = new THREE.Group();
    const bhGeo = new THREE.SphereGeometry(4.2, 24, 18);
    const bhMat = new THREE.MeshBasicMaterial({ color: 0x020306 });
    const ringGeo = new THREE.TorusGeometry(6.4, 0.34, 12, 48);
    const einsteinMat = this.materials.createBloomEmissiveMaterial(0xf0c45a, 1.85);
    this.ownedGeometries.push(bhGeo, ringGeo);
    this.ownedMaterials.push(bhMat);

    const bhCore = new THREE.Mesh(bhGeo, bhMat);
    bhCore.position.set(0, 4.6, -21);
    g.add(bhCore);

    const rings = new THREE.InstancedMesh(ringGeo, einsteinMat, 2);
    const d = new THREE.Object3D();
    d.position.copy(bhCore.position);
    d.rotation.set(Math.PI * 0.42, 0, 0);
    d.scale.setScalar(1);
    d.updateMatrix();
    rings.setMatrixAt(0, d.matrix);

    d.rotation.set(Math.PI * 0.08, 0, 0);
    d.scale.setScalar(0.92);
    d.updateMatrix();
    rings.setMatrixAt(1, d.matrix);
    rings.instanceMatrix.needsUpdate = true;

    g.add(rings);
    this.bloomTargets.push(rings);
    return g;
  }

  private writeHexInstanceTransform(idx: number, row: number, col: number, liftY: number): void {
    const { x, z } = hexToStageXZ(row, col);
    this.tempMatrix.makeTranslation(x, 0.004 + liftY, z);
    this.hexBezelInstanced.setMatrixAt(idx, this.tempMatrix);
    this.tempMatrix.makeTranslation(x, -0.020 + liftY, z);
    this.hexPlateInstanced.setMatrixAt(idx, this.tempMatrix);
  }

  public setTheme(theme: ArenaThemeId): void {
    this.currentTheme = theme;
    this.themeGroups.orbital_elevator_port.visible = theme === 'orbital_elevator_port';
    this.themeGroups.mercury_dyson_forge.visible = theme === 'mercury_dyson_forge';
    this.themeGroups.event_horizon_observatory.visible = theme === 'event_horizon_observatory';
    this.triggerConduitSweep();
  }

  public getTheme(): ArenaThemeId {
    return this.currentTheme;
  }

  public setBattleGridDimmed(inBattle: boolean): void {
    this.battleGridOpacitySpring.setTarget(inBattle ? 0.25 : 1.0);
  }

  public setHoveredHex(coord: HexCoord | null): void {
    const nextIdx = coord ? coord.row * BOARD_COLS + coord.col : -1;
    if (nextIdx === this.hoveredHexIndex) return;
    if (this.hoveredHexIndex >= 0) {
      this.hexHoverSprings[this.hoveredHexIndex]?.setTarget(0);
    }
    this.hoveredHexIndex = nextIdx;
    if (nextIdx >= 0 && coord) {
      this.hexHoverSprings[nextIdx]?.setTarget(0.04);
      const { x, z } = hexToStageXZ(coord.row, coord.col);
      this.hoverFresnelRing.position.set(x, 0.052, z);
      this.hoverFresnelRing.visible = true;
    } else {
      this.hoverFresnelRing.visible = false;
    }
  }

  public setRangeHighlight(origin: HexCoord | null, range: number | null): void {
    if (!origin || !range || range <= 0) {
      this.rangeDashedLines.visible = false;
      return;
    }
    const hexes = getHexesWithinRange(origin, range);
    const verts: number[] = [];
    const r = HEX_RADIUS * 0.94;
    for (const hc of hexes) {
      const center = hexToStageXZ(hc.row, hc.col);
      for (let i = 0; i < 6; i += 1) {
        const a0 = (Math.PI / 3) * i + Math.PI / 6;
        const a1 = (Math.PI / 3) * ((i + 1) % 6) + Math.PI / 6;
        verts.push(
          center.x + Math.cos(a0) * r,
          0.038,
          center.z + Math.sin(a0) * r,
          center.x + Math.cos(a1) * r,
          0.038,
          center.z + Math.sin(a1) * r,
        );
      }
    }
    const nextGeo = new THREE.BufferGeometry();
    nextGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.rangeDashedLines.geometry.dispose();
    this.rangeDashedLines.geometry = nextGeo;
    this.rangeDashedLines.computeLineDistances();
    this.rangeDashedLines.visible = verts.length > 0;
  }

  public setFriendlySwapArc(
    fromXZ: { x: number; z: number } | null,
    toXZ: { x: number; z: number } | null,
  ): void {
    if (!fromXZ || !toXZ) {
      this.swapArcGroup.visible = false;
      return;
    }
    const dist = Math.hypot(toXZ.x - fromXZ.x, toXZ.z - fromXZ.z);
    if (dist < 0.25) {
      this.swapArcGroup.visible = false;
      return;
    }
    const midX = (fromXZ.x + toXZ.x) * 0.5;
    const midZ = (fromXZ.z + toXZ.z) * 0.5;
    const archH = Math.min(2.4, 0.85 + dist * 0.24);

    this.swapArcCurve.v0.set(fromXZ.x, 0.22, fromXZ.z);
    this.swapArcCurve.v1.set(midX, archH, midZ);
    this.swapArcCurve.v2.set(toXZ.x, 0.22, toXZ.z);

    const newTube = new THREE.TubeGeometry(this.swapArcCurve, 20, 0.036, 6, false);
    this.swapArcMesh.geometry.dispose();
    this.swapArcMesh.geometry = newTube;

    const tStart = this.swapArcCurve.getTangent(0.05).negate();
    this.swapArrowStart.position.copy(this.swapArcCurve.getPoint(0.04));
    this.swapArrowStart.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tStart);

    const tEnd = this.swapArcCurve.getTangent(0.95);
    this.swapArrowEnd.position.copy(this.swapArcCurve.getPoint(0.96));
    this.swapArrowEnd.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tEnd);

    this.swapArcGroup.visible = true;
  }

  public setBenchOccupancy(occupiedSlots: ReadonlySet<number>): void {
    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const occ = occupiedSlots.has(slot);
      this.benchOccupied[slot] = occ;
      this.benchDepressSprings[slot]?.setTarget(occ ? -0.025 : 0);
    }
  }

  public setCryoPodEnabled(enabled: boolean): void {
    this.cryoEnabled = enabled;
    this.cryoSlideSpring.setTarget(enabled ? 1 : 0);
  }

  public setIntegerGold(gold: number): void {
    this.currentGold = Math.max(0, Math.floor(gold));
    for (let i = 0; i < 6; i += 1) {
      const info = this.interestPillarCoords[i]!;
      const threshold = (info.tier + 1) * 10;
      this.interestLiftSprings[i]?.setTarget(this.currentGold >= threshold ? 1 : 0);
    }
  }

  public triggerConduitSweep(): void {
    this.conduitSweepProgress = -0.25;
  }

  public update(dt: number): void {
    this.elapsedSec += dt;

    this.materials.hexBezelGoldMat.opacity = this.battleGridOpacitySpring.step(dt);

    let anyHexMoved = false;
    for (let i = 0; i < TOTAL_HEXES; i += 1) {
      const sp = this.hexHoverSprings[i]!;
      if (!sp.isSettled()) {
        const yLift = sp.step(dt);
        const row = Math.floor(i / BOARD_COLS);
        const col = i % BOARD_COLS;
        this.writeHexInstanceTransform(i, row, col, yLift);
        anyHexMoved = true;
      }
    }
    if (anyHexMoved) {
      this.hexBezelInstanced.instanceMatrix.needsUpdate = true;
      this.hexPlateInstanced.instanceMatrix.needsUpdate = true;
    }

    if (this.hoveredHexIndex >= 0) {
      const lift = this.hexHoverSprings[this.hoveredHexIndex]?.value ?? 0;
      this.hoverFresnelRing.position.y = 0.018 + lift;
    }

    const breath = 0.5 + 0.5 * Math.sin(this.elapsedSec * 3.1);
    let benchMoved = false;
    for (let slot = 0; slot < BENCH_SLOTS; slot += 1) {
      const sp = this.benchDepressSprings[slot]!;
      if (!sp.isSettled() || this.benchOccupied[slot]) {
        const dep = sp.step(dt);
        const center = benchSlotToStageXZ(slot);
        this.tempMatrix.makeTranslation(center.x, 0.045 + dep, center.z);
        this.benchRingsInstanced.setMatrixAt(slot, this.tempMatrix);
        if (this.benchOccupied[slot]) {
          const boost = 1.0 + breath * 0.35;
          this.tempColor.setRGB(0.95 * boost, 0.88 * boost, 0.72 * boost);
        } else {
          this.tempColor.setHex(slot === CRYO_BENCH_SLOT ? 0x67e8f9 : 0xc8aa6e);
        }
        this.benchRingsInstanced.setColorAt(slot, this.tempColor);
        benchMoved = true;
      }
    }
    if (benchMoved) {
      this.benchRingsInstanced.instanceMatrix.needsUpdate = true;
      if (this.benchRingsInstanced.instanceColor) {
        this.benchRingsInstanced.instanceColor.needsUpdate = true;
      }
    }

    const cryoT = this.cryoSlideSpring.step(dt);
    const slot8XZ = benchSlotToStageXZ(CRYO_BENCH_SLOT);
    this.cryoCanopyMesh.position.z = slot8XZ.z + 0.54 * (1 - cryoT);
    this.cryoCanopyMesh.position.y = 0.12 + cryoT * 0.24;
    this.cryoLampMat.emissiveIntensity = this.cryoEnabled ? 1.35 + breath * 0.85 : 0.35;

    const yAxis = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 6; i += 1) {
      const lift = this.interestLiftSprings[i]!.step(dt);
      const coord = this.interestPillarCoords[i]!;
      const rotY = lift * Math.PI * 0.65 + (lift > 0.5 ? this.elapsedSec * 0.5 : 0);
      this.tempPos.set(coord.x, 0.28 + lift * 0.64, coord.z);
      this.tempQuat.setFromAxisAngle(yAxis, rotY);
      this.tempMatrix.compose(this.tempPos, this.tempQuat, this.tempScale);
      this.interestCollarsInstanced.setMatrixAt(i, this.tempMatrix);
    }
    this.interestCollarsInstanced.instanceMatrix.needsUpdate = true;

    for (let tier = 0; tier < 3; tier += 1) {
      const mat = this.interestTierMats[tier]!;
      const liftVal = this.interestLiftSprings[tier]!.value;
      mat.uniforms['uTime']!.value = this.elapsedSec;
      mat.uniforms['uActive']!.value = liftVal;
    }

    if (this.conduitSweepProgress < 1.35) {
      this.conduitSweepProgress += dt * 1.65;
    }
    this.conduitShaderMat.uniforms['uSweep']!.value = this.conduitSweepProgress;
    this.conduitShaderMat.uniforms['uTime']!.value = this.elapsedSec;
  }

  public dispose(): void {
    this.rangeDashedLines.geometry.dispose();
    this.swapArcMesh.geometry.dispose();
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
  }
}
