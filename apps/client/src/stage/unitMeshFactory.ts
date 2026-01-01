import * as THREE from 'three';
import { SEASON1_UNITS_BY_ID, type UnitDef, type UnitStar } from '@pkg/contracts';
import type { PbrMaterialLibrary } from './pbrMaterials.js';
import { SpringDamper, SpringDamper3D } from './spring.js';

const CAMERA_PITCH_COMPENSATION_RAD = -THREE.MathUtils.degToRad(10);

const FACTION_RGB: Readonly<Record<string, readonly [number, number, number]>> = {
  戴森工团: [0.92, 0.70, 0.30],
  云端星环: [0.45, 0.72, 0.98],
  钟慢远征: [0.55, 0.84, 0.98],
  木卫冰海: [0.24, 0.85, 0.76],
  深空阵列: [0.72, 0.58, 0.98],
  反物质院: [0.92, 0.48, 0.96],
  星门摆渡: [0.96, 0.68, 0.24],
  失控蜂群: [0.68, 0.74, 0.82],
};

interface GeometryPartSpec {
  readonly geo: THREE.BufferGeometry;
  readonly matrix?: THREE.Matrix4;
  readonly colorRgb?: readonly [number, number, number];
}

function makeTransform(
  px: number,
  py: number,
  pz: number,
  rx = 0,
  ry = 0,
  rz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
): THREE.Matrix4 {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  m.compose(new THREE.Vector3(px, py, pz), q, new THREE.Vector3(sx, sy, sz));
  return m;
}

function mergePartsWithVertexColor(parts: readonly GeometryPartSpec[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let vertexOffset = 0;
  const vPos = new THREE.Vector3();
  const vNorm = new THREE.Vector3();
  const normalMat = new THREE.Matrix3();

  for (const part of parts) {
    const srcPos = part.geo.getAttribute('position');
    if (!srcPos) continue;
    const srcNorm = part.geo.getAttribute('normal');
    const srcUv = part.geo.getAttribute('uv');
    const srcIdx = part.geo.getIndex();
    const mat = part.matrix;
    if (mat) normalMat.getNormalMatrix(mat);
    const [cr, cg, cb] = part.colorRgb ?? [1, 1, 1];

    for (let i = 0; i < srcPos.count; i += 1) {
      vPos.fromBufferAttribute(srcPos, i);
      if (mat) vPos.applyMatrix4(mat);
      positions.push(vPos.x, vPos.y, vPos.z);

      if (srcNorm) {
        vNorm.fromBufferAttribute(srcNorm, i);
        if (mat) vNorm.applyMatrix3(normalMat).normalize();
        normals.push(vNorm.x, vNorm.y, vNorm.z);
      } else {
        normals.push(0, 1, 0);
      }

      if (srcUv) {
        uvs.push(srcUv.getX(i), srcUv.getY(i));
      } else {
        uvs.push(0.5, 0.5);
      }

      colors.push(cr, cg, cb);
    }

    if (srcIdx) {
      for (let i = 0; i < srcIdx.count; i += 1) {
        indices.push(vertexOffset + srcIdx.getX(i));
      }
    } else {
      for (let i = 0; i < srcPos.count; i += 1) {
        indices.push(vertexOffset + i);
      }
    }

    vertexOffset += srcPos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  merged.setIndex(indices);
  merged.computeBoundingSphere();
  return merged;
}

interface CachedUnitBlueprint {
  readonly bodyAndTrimGeo: THREE.BufferGeometry;
  readonly weaponAndGlowGeo: THREE.BufferGeometry;
  readonly star3WingsGeo: THREE.BufferGeometry;
  readonly headTopLocalY: number;
}

function createFresnelHitRimMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uFlash: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position + normal * 0.015, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uFlash;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float fresnel = pow(1.0 - clamp(abs(dot(vNormalView, vViewDir)), 0.0, 1.0), 2.5);
        vec3 warmWhite = vec3(1.25, 1.18, 1.02);
        gl_FragColor = vec4(warmWhite * fresnel * uFlash, fresnel * uFlash * 0.95);
      }
    `,
  });
}

export class SharedUnitGeometryPool {
  public readonly shadowPlane = new THREE.PlaneGeometry(1.42, 1.42);
  public readonly allegianceRing = new THREE.RingGeometry(0.50, 0.57, 24);

  public readonly pedestal1Geo: THREE.BufferGeometry;
  public readonly pedestal2Geo: THREE.BufferGeometry;
  public readonly pedestal3Geo: THREE.BufferGeometry;

  public readonly headSphere = new THREE.OctahedronGeometry(0.21, 1);
  public readonly visorBox = new THREE.BoxGeometry(0.28, 0.09, 0.14);
  public readonly torsoChest = new THREE.CylinderGeometry(0.23, 0.18, 0.42, 6);
  public readonly pelvis = new THREE.CylinderGeometry(0.17, 0.15, 0.16, 6);
  public readonly shoulderPad = new THREE.BoxGeometry(0.16, 0.12, 0.18);
  public readonly limb = new THREE.CylinderGeometry(0.06, 0.05, 0.30, 6);
  public readonly hexShield = new THREE.CylinderGeometry(0.32, 0.32, 0.05, 6);
  public readonly blade = new THREE.BoxGeometry(0.05, 0.56, 0.10);
  public readonly staff = new THREE.CylinderGeometry(0.035, 0.035, 0.72, 6);
  public readonly wingFin = new THREE.BoxGeometry(0.06, 0.52, 0.18);

  public readonly octaPrism = new THREE.OctahedronGeometry(0.42, 0);
  public readonly icosaCore = new THREE.IcosahedronGeometry(0.30, 1);
  public readonly hullCruiser = new THREE.ConeGeometry(0.30, 0.96, 6);
  public readonly railBarrel = new THREE.BoxGeometry(0.08, 0.08, 0.88);
  public readonly torusMajor = new THREE.TorusGeometry(0.44, 0.075, 8, 24);
  public readonly torusEinstein = new THREE.TorusGeometry(0.50, 0.032, 8, 32);
  public readonly whaleBody = new THREE.CapsuleGeometry(0.24, 0.46, 4, 8);
  public readonly hexPanel = new THREE.CylinderGeometry(0.26, 0.26, 0.04, 6);
  public readonly funnelBit = new THREE.OctahedronGeometry(0.11, 0);

  private readonly rawRings: THREE.BufferGeometry[] = [];

  constructor() {
    this.shadowPlane.rotateX(-Math.PI * 0.5);
    this.allegianceRing.rotateX(-Math.PI * 0.5);
    this.hexShield.rotateX(Math.PI * 0.5);
    this.hullCruiser.rotateX(Math.PI * 0.5);
    this.whaleBody.rotateX(Math.PI * 0.5);
    this.hexPanel.rotateX(Math.PI * 0.5);

    const r1 = new THREE.TorusGeometry(0.42, 0.032, 6, 20);
    r1.rotateX(Math.PI * 0.5);
    const r2 = new THREE.TorusGeometry(0.52, 0.024, 6, 24);
    r2.rotateX(Math.PI * 0.5);
    const r3 = new THREE.TorusGeometry(0.62, 0.028, 6, 6);
    r3.rotateX(Math.PI * 0.5);
    this.rawRings.push(r1, r2, r3);

    this.pedestal1Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.035, 0) },
    ]);
    this.pedestal2Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.035, 0) },
      { geo: r2, matrix: makeTransform(0, 0.032, 0) },
    ]);
    this.pedestal3Geo = mergePartsWithVertexColor([
      { geo: r1, matrix: makeTransform(0, 0.035, 0) },
      { geo: r2, matrix: makeTransform(0, 0.032, 0) },
      { geo: r3, matrix: makeTransform(0, 0.028, 0) },
    ]);
  }

  public dispose(): void {
    const all: THREE.BufferGeometry[] = [
      this.shadowPlane,
      this.allegianceRing,
      this.pedestal1Geo,
      this.pedestal2Geo,
      this.pedestal3Geo,
      this.headSphere,
      this.visorBox,
      this.torsoChest,
      this.pelvis,
      this.shoulderPad,
      this.limb,
      this.hexShield,
      this.blade,
      this.staff,
      this.wingFin,
      this.octaPrism,
      this.icosaCore,
      this.hullCruiser,
      this.railBarrel,
      this.torusMajor,
      this.torusEinstein,
      this.whaleBody,
      this.hexPanel,
      this.funnelBit,
      ...this.rawRings,
    ];
    for (const g of all) g.dispose();
  }
}

export interface UnitActorRig {
  readonly instanceId: string;
  readonly unitId: string;
  readonly unitDef: UnitDef;
  readonly root: THREE.Group;
  readonly bodyTiltGroup: THREE.Group;
  readonly animatedCore: THREE.Group;
  readonly headTopLocalY: number;
  readonly weaponGlowMesh: THREE.Mesh;
  readonly weaponGlowMat: THREE.MeshStandardMaterial;
  readonly fresnelHitMat: THREE.ShaderMaterial;

  star: UnitStar;
  allegiance: 'ally' | 'enemy';
  posSpring: SpringDamper3D;
  scaleSpring: SpringDamper;
  recoilX: SpringDamper;
  recoilZ: SpringDamper;
  nudgeOffsetX: SpringDamper;
  hitFlashRemainingSec: number;
  actionTimerSec: number;
  actionTotalSec: number;
  actionKind: 'idle' | 'attack' | 'cast';
  manaRatio: number;

  applyStarTier(star: UnitStar): void;
  applyAllegiance(allegiance: 'ally' | 'enemy'): void;
  setManaRatio(ratio: number): boolean;
  triggerHit(dirX?: number, dirZ?: number): void;
  playAction(kind: 'attack' | 'cast', lookAtTarget?: { x: number; z: number }): void;
  update(dt: number, elapsedSec: number): void;
  dispose(): void;
}

const MAX_GROUND_RING_INSTANCES = 64;

export class UnitMeshFactory {
  public readonly pool = new SharedUnitGeometryPool();
  public readonly groundBatchGroup = new THREE.Group();

  private readonly shadowsInstanced: THREE.InstancedMesh;
  private readonly allyRingsInstanced: THREE.InstancedMesh;
  private readonly enemyRingsInstanced: THREE.InstancedMesh;
  private readonly vertexColorArmorMat: THREE.MeshStandardMaterial;

  private readonly materials: PbrMaterialLibrary;
  private readonly blueprintCache = new Map<string, CachedUnitBlueprint>();
  private readonly tempMatrix = new THREE.Matrix4();

  constructor(materials: PbrMaterialLibrary) {
    this.materials = materials;

    this.vertexColorArmorMat = materials.porcelainArmorMat.clone();
    this.vertexColorArmorMat.vertexColors = true;

    this.shadowsInstanced = new THREE.InstancedMesh(
      this.pool.shadowPlane,
      materials.contactShadowMat,
      MAX_GROUND_RING_INSTANCES,
    );
    this.allyRingsInstanced = new THREE.InstancedMesh(
      this.pool.allegianceRing,
      materials.allyRingMat,
      MAX_GROUND_RING_INSTANCES,
    );
    this.enemyRingsInstanced = new THREE.InstancedMesh(
      this.pool.allegianceRing,
      materials.enemyRingMat,
      MAX_GROUND_RING_INSTANCES,
    );
    this.shadowsInstanced.count = 0;
    this.allyRingsInstanced.count = 0;
    this.enemyRingsInstanced.count = 0;
    this.groundBatchGroup.add(
      this.shadowsInstanced,
      this.allyRingsInstanced,
      this.enemyRingsInstanced,
    );
  }

  public syncGroundBatches(rigs: Iterable<UnitActorRig>): void {
    let shadowIdx = 0;
    let allyIdx = 0;
    let enemyIdx = 0;

    for (const rig of rigs) {
      if (!rig.root.visible) continue;
      const x = rig.root.position.x;
      const y = rig.root.position.y;
      const z = rig.root.position.z;

      if (shadowIdx < MAX_GROUND_RING_INSTANCES) {
        this.tempMatrix.makeTranslation(x, y + 0.008, z);
        this.shadowsInstanced.setMatrixAt(shadowIdx, this.tempMatrix);
        shadowIdx += 1;
      }
      if (rig.allegiance === 'ally' && allyIdx < MAX_GROUND_RING_INSTANCES) {
        this.tempMatrix.makeTranslation(x, y + 0.014, z);
        this.allyRingsInstanced.setMatrixAt(allyIdx, this.tempMatrix);
        allyIdx += 1;
      } else if (rig.allegiance === 'enemy' && enemyIdx < MAX_GROUND_RING_INSTANCES) {
        this.tempMatrix.makeTranslation(x, y + 0.014, z);
        this.enemyRingsInstanced.setMatrixAt(enemyIdx, this.tempMatrix);
        enemyIdx += 1;
      }
    }

    this.shadowsInstanced.count = shadowIdx;
    this.allyRingsInstanced.count = allyIdx;
    this.enemyRingsInstanced.count = enemyIdx;
    this.shadowsInstanced.instanceMatrix.needsUpdate = true;
    this.allyRingsInstanced.instanceMatrix.needsUpdate = true;
    this.enemyRingsInstanced.instanceMatrix.needsUpdate = true;
  }

  private getOrBuildBlueprint(unitDef: UnitDef): CachedUnitBlueprint {
    const cached = this.blueprintCache.get(unitDef.id);
    if (cached) return cached;

    const factionRgb = FACTION_RGB[unitDef.faction] ?? [0.85, 0.72, 0.45];
    const porcelainRgb: readonly [number, number, number] = [0.98, 0.98, 1.0];
    const darkJointRgb: readonly [number, number, number] = [0.26, 0.30, 0.38];
    const sapphireRgb: readonly [number, number, number] = [0.22, 0.56, 0.96];
    const goldRgb: readonly [number, number, number] = [0.95, 0.82, 0.52];

    const bodyParts: GeometryPartSpec[] = [];
    const weaponParts: GeometryPartSpec[] = [];
    const wingParts: GeometryPartSpec[] = [];
    let headTopLocalY = 1.48;

    if (unitDef.modelProfile.archetype === 'humanoid_rig') {
      headTopLocalY = 1.56;
      bodyParts.push(
        { geo: this.pool.pelvis, matrix: makeTransform(0, 0.38, 0), colorRgb: darkJointRgb },
        { geo: this.pool.limb, matrix: makeTransform(-0.11, 0.19, 0), colorRgb: porcelainRgb },
        { geo: this.pool.limb, matrix: makeTransform(0.11, 0.19, 0), colorRgb: porcelainRgb },
        { geo: this.pool.torsoChest, matrix: makeTransform(0, 0.66, 0), colorRgb: porcelainRgb },
        { geo: this.pool.shoulderPad, matrix: makeTransform(-0.27, 0.80, 0), colorRgb: factionRgb },
        { geo: this.pool.shoulderPad, matrix: makeTransform(0.27, 0.80, 0), colorRgb: factionRgb },
        { geo: this.pool.headSphere, matrix: makeTransform(0, 1.08, 0), colorRgb: porcelainRgb },
        { geo: this.pool.visorBox, matrix: makeTransform(0, 1.08, 0.14), colorRgb: sapphireRgb },
      );

      if (unitDef.id === 'S01') {
        weaponParts.push({ geo: this.pool.hexShield, matrix: makeTransform(0.32, 0.66, 0.24) });
      } else if (unitDef.id === 'S14' || unitDef.id === 'S34') {
        weaponParts.push({ geo: this.pool.blade, matrix: makeTransform(0.34, 0.72, 0.20) });
        if (unitDef.id === 'S34') {
          bodyParts.push({
            geo: this.pool.torusEinstein,
            matrix: makeTransform(0, 0.12, 0, Math.PI * 0.42, 0, 0),
            colorRgb: goldRgb,
          });
        }
      } else if (unitDef.id === 'S20') {
        weaponParts.push({
          geo: this.pool.octaPrism,
          matrix: makeTransform(0, 0.78, 0.34, 0, 0, 0, 0.45, 0.45, 0.45),
        });
        bodyParts.push({
          geo: this.pool.torusMajor,
          matrix: makeTransform(0, 0.88, -0.22),
          colorRgb: factionRgb,
        });
      } else if (unitDef.id === 'S35') {
        weaponParts.push({
          geo: this.pool.torusMajor,
          matrix: makeTransform(0, 0.64, 0.30, 0, 0, 0, 0.62, 0.62, 0.62),
        });
      } else {
        weaponParts.push({ geo: this.pool.staff, matrix: makeTransform(0.32, 0.68, 0.16) });
      }

      wingParts.push(
        { geo: this.pool.wingFin, matrix: makeTransform(-0.36, 0.88, -0.20, 0, 0, 0.42) },
        { geo: this.pool.wingFin, matrix: makeTransform(0.36, 0.88, -0.20, 0, 0, -0.42) },
      );
    } else {
      headTopLocalY = 1.46;
      if (unitDef.id === 'S36' || unitDef.id === 'S33') {
        bodyParts.push(
          { geo: this.pool.icosaCore, matrix: makeTransform(0, 0.74, 0), colorRgb: [0.06, 0.07, 0.10] },
          {
            geo: this.pool.torusEinstein,
            matrix: makeTransform(0, 0.74, 0, Math.PI * 0.36, 0, 0),
            colorRgb: goldRgb,
          },
        );
        weaponParts.push({
          geo: this.pool.torusEinstein,
          matrix: makeTransform(0, 0.74, 0, 0, Math.PI * 0.25, 0, 0.86, 0.86, 0.86),
        });
      } else if (unitDef.id === 'S03' || unitDef.id === 'S32') {
        bodyParts.push({
          geo: this.pool.octaPrism,
          matrix: makeTransform(0, 0.72, 0),
          colorRgb: unitDef.id === 'S03' ? sapphireRgb : porcelainRgb,
        });
        weaponParts.push({ geo: this.pool.funnelBit, matrix: makeTransform(0, 1.18, 0) });
      } else if (unitDef.id === 'S06' || unitDef.id === 'S25' || unitDef.id === 'S27') {
        bodyParts.push({
          geo: this.pool.torusMajor,
          matrix: makeTransform(0, 0.70, 0),
          colorRgb: porcelainRgb,
        });
        weaponParts.push({
          geo: this.pool.icosaCore,
          matrix: makeTransform(0, 0.70, 0, 0, 0, 0, 0.45, 0.45, 0.45),
        });
      } else if (unitDef.id === 'S15') {
        bodyParts.push({
          geo: this.pool.whaleBody,
          matrix: makeTransform(0, 0.56, 0),
          colorRgb: porcelainRgb,
        });
        weaponParts.push({ geo: this.pool.headSphere, matrix: makeTransform(0, 0.56, 0.36) });
      } else if (unitDef.id === 'S11' || unitDef.id === 'S16' || unitDef.id === 'S22') {
        bodyParts.push(
          { geo: this.pool.hexPanel, matrix: makeTransform(0, 0.68, 0), colorRgb: factionRgb },
          { geo: this.pool.hexPanel, matrix: makeTransform(-0.34, 0.64, -0.06, 0, 0.35, 0), colorRgb: porcelainRgb },
          { geo: this.pool.hexPanel, matrix: makeTransform(0.34, 0.64, -0.06, 0, -0.35, 0), colorRgb: porcelainRgb },
        );
        weaponParts.push({ geo: this.pool.funnelBit, matrix: makeTransform(0, 0.98, 0.12) });
      } else {
        bodyParts.push(
          { geo: this.pool.hullCruiser, matrix: makeTransform(0, 0.58, 0), colorRgb: porcelainRgb },
          {
            geo: this.pool.visorBox,
            matrix: makeTransform(0, 0.66, -0.08, 0, 0, 0, 1.8, 0.9, 2.2),
            colorRgb: factionRgb,
          },
        );
        weaponParts.push({ geo: this.pool.railBarrel, matrix: makeTransform(0, 0.64, 0.32) });
      }

      wingParts.push(
        { geo: this.pool.funnelBit, matrix: makeTransform(-0.52, 0.96, -0.10) },
        { geo: this.pool.funnelBit, matrix: makeTransform(0.52, 0.96, -0.10) },
      );
    }

    const blueprint: CachedUnitBlueprint = {
      bodyAndTrimGeo: mergePartsWithVertexColor(bodyParts),
      weaponAndGlowGeo: mergePartsWithVertexColor(weaponParts),
      star3WingsGeo: mergePartsWithVertexColor(wingParts),
      headTopLocalY,
    };
    this.blueprintCache.set(unitDef.id, blueprint);
    return blueprint;
  }

  public createUnitRig(
    instanceId: string,
    unitId: string,
    initialStar: UnitStar = 1,
    initialAllegiance: 'ally' | 'enemy' = 'ally',
  ): UnitActorRig {
    const fallbackDef = SEASON1_UNITS_BY_ID.get('S01')!;
    const unitDef = SEASON1_UNITS_BY_ID.get(unitId) ?? fallbackDef;
    const blueprint = this.getOrBuildBlueprint(unitDef);

    const root = new THREE.Group();
    root.name = `unit_${instanceId}_${unitId}`;

    const pedestalMesh = new THREE.Mesh(this.pool.pedestal1Geo, this.materials.starPedestal1Mat);
    root.add(pedestalMesh);

    const bodyTiltGroup = new THREE.Group();
    bodyTiltGroup.rotation.x = CAMERA_PITCH_COMPENSATION_RAD;
    root.add(bodyTiltGroup);

    const animatedCore = new THREE.Group();
    bodyTiltGroup.add(animatedCore);

    const bodyMesh = new THREE.Mesh(blueprint.bodyAndTrimGeo, this.vertexColorArmorMat);
    animatedCore.add(bodyMesh);

    const weaponGlowMat = this.materials.createBloomEmissiveMaterial(0x5cc8d6, 0.25);
    const weaponGlowMesh = new THREE.Mesh(blueprint.weaponAndGlowGeo, weaponGlowMat);
    animatedCore.add(weaponGlowMesh);

    const star3WingsMesh = new THREE.Mesh(blueprint.star3WingsGeo, this.materials.brushedGoldMat);
    star3WingsMesh.visible = false;
    animatedCore.add(star3WingsMesh);

    const fresnelHitMat = createFresnelHitRimMaterial();
    const fresnelShellMesh = new THREE.Mesh(blueprint.bodyAndTrimGeo, fresnelHitMat);
    fresnelShellMesh.visible = false;
    animatedCore.add(fresnelShellMesh);

    const rig: UnitActorRig = {
      instanceId,
      unitId,
      unitDef,
      root,
      bodyTiltGroup,
      animatedCore,
      headTopLocalY: blueprint.headTopLocalY,
      weaponGlowMesh,
      weaponGlowMat,
      fresnelHitMat,
      star: initialStar,
      allegiance: initialAllegiance,
      posSpring: new SpringDamper3D(0, 0, 0, 26, 0.68),
      scaleSpring: new SpringDamper(1.0, 24, 0.66),
      recoilX: new SpringDamper(0, 32, 0.58),
      recoilZ: new SpringDamper(0, 32, 0.58),
      nudgeOffsetX: new SpringDamper(0, 22, 0.72),
      hitFlashRemainingSec: 0,
      actionTimerSec: 0,
      actionTotalSec: 0,
      actionKind: 'idle',
      manaRatio: 0,

      applyStarTier: (star: UnitStar) => {
        rig.star = star;
        const targetScale = star === 1 ? 1.0 : star === 2 ? 1.12 : 1.25;
        rig.scaleSpring.setTarget(targetScale);

        pedestalMesh.geometry =
          star === 1
            ? this.pool.pedestal1Geo
            : star === 2
              ? this.pool.pedestal2Geo
              : this.pool.pedestal3Geo;
        pedestalMesh.material =
          star === 1
            ? this.materials.starPedestal1Mat
            : star === 2
              ? this.materials.starPedestal2Mat
              : this.materials.starPedestal3Mat;
        star3WingsMesh.visible = star === 3;
      },

      applyAllegiance: (allegiance: 'ally' | 'enemy') => {
        rig.allegiance = allegiance;
      },

      setManaRatio: (ratio: number): boolean => {
        const clamped = Math.max(0, Math.min(1, ratio));
        rig.manaRatio = clamped;
        const fullGlow = clamped >= 0.85;
        weaponGlowMat.emissiveIntensity = fullGlow ? 2.25 : rig.star >= 2 ? 0.65 : 0.28;
        return fullGlow;
      },

      triggerHit: (dirX = 0, dirZ = 1) => {
        rig.hitFlashRemainingSec = 0.09;
        fresnelHitMat.uniforms['uFlash']!.value = 1.0;
        fresnelShellMesh.visible = true;
        const norm = Math.hypot(dirX, dirZ) || 1;
        rig.recoilX.impulse((dirX / norm) * 3.6);
        rig.recoilZ.impulse((dirZ / norm) * 3.6);
      },

      playAction: (kind: 'attack' | 'cast', lookAtTarget?: { x: number; z: number }) => {
        rig.actionKind = kind;
        rig.actionTimerSec = 0;
        rig.actionTotalSec = kind === 'cast' ? 0.56 : 0.36;
        if (lookAtTarget) {
          const dx = lookAtTarget.x - root.position.x;
          const dz = lookAtTarget.z - root.position.z;
          if (Math.hypot(dx, dz) > 0.05) {
            root.rotation.y = Math.atan2(dx, dz);
          }
        }
      },

      update: (dt: number, elapsedSec: number) => {
        const p = rig.posSpring.step(dt);
        const nudgeX = rig.nudgeOffsetX.step(dt);
        root.position.set(p.x + nudgeX, p.y, p.z);

        const sc = rig.scaleSpring.step(dt);
        bodyTiltGroup.scale.setScalar(sc);

        if (rig.hitFlashRemainingSec > 0) {
          rig.hitFlashRemainingSec = Math.max(0, rig.hitFlashRemainingSec - dt);
          fresnelHitMat.uniforms['uFlash']!.value = rig.hitFlashRemainingSec / 0.09;
          if (rig.hitFlashRemainingSec <= 0) {
            fresnelShellMesh.visible = false;
          }
        }

        const rx = rig.recoilX.step(dt);
        const rz = rig.recoilZ.step(dt);
        bodyTiltGroup.rotation.x = CAMERA_PITCH_COMPENSATION_RAD + rz * 0.22;
        bodyTiltGroup.rotation.z = -rx * 0.22;

        let actionOffsetY = 0;
        let actionPitch = 0;
        if (rig.actionKind !== 'idle') {
          rig.actionTimerSec += dt;
          const t = rig.actionTimerSec / rig.actionTotalSec;
          if (t >= 1) {
            rig.actionKind = 'idle';
          } else if (t < 0.32) {
            const w = t / 0.32;
            actionPitch = -0.26 * w;
            if (rig.actionKind === 'cast' && unitDef.stats.jumpOnSkill) {
              actionOffsetY = Math.sin(w * Math.PI * 0.5) * 0.65;
            }
          } else if (t < 0.48) {
            actionPitch = 0.34;
            if (rig.actionKind === 'cast') {
              actionOffsetY = unitDef.stats.jumpOnSkill ? 0.68 : 0.16;
            }
          } else {
            const r = 1 - (t - 0.48) / 0.52;
            actionPitch = 0.34 * r;
            actionOffsetY = (rig.actionKind === 'cast' ? 0.16 : 0) * r;
          }
        }

        const hoverAmp = unitDef.modelProfile.archetype === 'hard_surface_vessel' ? 0.045 : 0.018;
        const idleY = Math.sin(elapsedSec * 2.6 + unitDef.cost) * hoverAmp;
        animatedCore.position.y = idleY + actionOffsetY;
        animatedCore.rotation.x = actionPitch;

        if (rig.star === 3) {
          pedestalMesh.rotation.y = elapsedSec * 0.85;
        }
      },

      dispose: () => {
        fresnelHitMat.dispose();
      },
    };

    rig.applyStarTier(initialStar);
    rig.scaleSpring.snap(initialStar === 1 ? 1.0 : initialStar === 2 ? 1.12 : 1.25);
    bodyTiltGroup.scale.setScalar(rig.scaleSpring.value);

    return rig;
  }

  public dispose(): void {
    for (const bp of this.blueprintCache.values()) {
      bp.bodyAndTrimGeo.dispose();
      bp.weaponAndGlowGeo.dispose();
      bp.star3WingsGeo.dispose();
    }
    this.blueprintCache.clear();
    this.vertexColorArmorMat.dispose();
    this.pool.dispose();
  }
}
