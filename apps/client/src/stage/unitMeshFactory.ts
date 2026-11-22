import * as THREE from 'three';
import { SEASON1_UNITS_BY_ID, type UnitDef, type UnitStar } from '@pkg/contracts';
import type { PbrMaterialLibrary } from './pbrMaterials.js';
import { SpringDamper, SpringDamper3D } from './spring.js';
import {
  SharedUnitGeometryPool,
  appendRoleFallbackChassis,
  createBuilderContext,
  makeTransform,
  mergePartsWithVertexColor,
  type BespokeUnitBuilder,
  type GeometryPartSpec,
  type UnitBlueprintParts,
} from './unitBuilderCore.js';
import { UNIT_PACK_CORE_BUILDERS } from './unitPackCore.js';
import { UNIT_PACK_1_BUILDERS } from './unitPack1.js';
import { UNIT_PACK_2_BUILDERS } from './unitPack2.js';
import { UNIT_PACK_3_BUILDERS } from './unitPack3.js';
import { UNIT_PACK_4_BUILDERS } from './unitPack4.js';

export { SharedUnitGeometryPool } from './unitBuilderCore.js';

const CAMERA_PITCH_COMPENSATION_RAD = -THREE.MathUtils.degToRad(10);

const ALL_BESPOKE_UNIT_BUILDERS: Readonly<Record<string, BespokeUnitBuilder>> = {
  ...UNIT_PACK_CORE_BUILDERS,
  ...UNIT_PACK_1_BUILDERS,
  ...UNIT_PACK_2_BUILDERS,
  ...UNIT_PACK_3_BUILDERS,
  ...UNIT_PACK_4_BUILDERS,
};

interface CachedUnitBlueprint {
  readonly armorGeo: THREE.BufferGeometry;
  readonly matteGeo: THREE.BufferGeometry;
  readonly trimGeo: THREE.BufferGeometry;
  readonly energyGeo: THREE.BufferGeometry;
  readonly crystalGeo: THREE.BufferGeometry;
  readonly star3WingsGeo: THREE.BufferGeometry;
  readonly headTopLocalY: number;
  readonly weaponGlowHex: number;
  readonly crystalHex: number;
  readonly crystalOpacity: number;
  readonly crystalIntensity: number;
  readonly hasMatte: boolean;
  readonly hasTrim: boolean;
  readonly hasEnergy: boolean;
  readonly hasCrystal: boolean;
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
        vec3 warmWhite = vec3(1.22, 1.16, 1.02);
        gl_FragColor = vec4(warmWhite * fresnel * uFlash, fresnel * uFlash * 0.92);
      }
    `,
  });
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

function starTargetScale(star: UnitStar): number {
  return star === 1 ? 1.0 : star === 2 ? 1.14 : 1.30;
}

export class UnitMeshFactory {
  public readonly pool = new SharedUnitGeometryPool();
  public readonly groundBatchGroup = new THREE.Group();

  private readonly shadowsInstanced: THREE.InstancedMesh;
  private readonly allyRingsInstanced: THREE.InstancedMesh;
  private readonly enemyRingsInstanced: THREE.InstancedMesh;
  private readonly starCrownMat: THREE.MeshStandardMaterial;

  private readonly materials: PbrMaterialLibrary;
  private readonly blueprintCache = new Map<string, CachedUnitBlueprint>();
  private readonly tempMatrix = new THREE.Matrix4();

  constructor(materials: PbrMaterialLibrary) {
    this.materials = materials;

    this.starCrownMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.16,
      metalness: 0.94,
      emissive: new THREE.Color(0xf59e0b),
      emissiveIntensity: 0.52,
    });

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

  public getRegisteredBespokeUnitIds(): readonly string[] {
    return Object.keys(ALL_BESPOKE_UNIT_BUILDERS);
  }

  private getOrBuildBlueprint(unitDef: UnitDef): CachedUnitBlueprint {
    const cached = this.blueprintCache.get(unitDef.id);
    if (cached) return cached;

    const ctx = createBuilderContext(this.pool, unitDef);
    const out: UnitBlueprintParts = {
      armor: [],
      matte: [],
      trim: [],
      energy: [],
      crystal: [],
      bodyParts: [],
      weaponParts: [],
      wingParts: [],
      disposables: [],
      headTopLocalY: 1.56,
      weaponGlowHex: ctx.palette.accentHex,
      crystalHex: ctx.palette.accentHex,
      crystalOpacity: 0.52,
      crystalIntensity: 0.42,
    };

    const bespoke = ALL_BESPOKE_UNIT_BUILDERS[unitDef.id];
    if (bespoke) {
      bespoke(ctx, out);
    } else {
      appendRoleFallbackChassis(ctx, out);
    }

    if (out.wingParts.length === 0) {
      const defaultWings: GeometryPartSpec[] =
        unitDef.modelProfile.archetype === 'humanoid_rig'
          ? [
              { geo: this.pool.wingFin, matrix: makeTransform(-0.42, 0.94, -0.22, 0, 0.24, 0.44) },
              { geo: this.pool.wingFin, matrix: makeTransform(0.42, 0.94, -0.22, 0, -0.24, -0.44) },
              { geo: this.pool.wingFin, matrix: makeTransform(-0.56, 0.78, -0.26, 0, 0.32, 0.78, 0.8, 0.8, 0.8) },
              { geo: this.pool.wingFin, matrix: makeTransform(0.56, 0.78, -0.26, 0, -0.32, -0.78, 0.8, 0.8, 0.8) },
            ]
          : [
              { geo: this.pool.funnelBit, matrix: makeTransform(-0.62, 1.04, -0.10, 0, 0, 0, 1.25, 1.25, 1.25) },
              { geo: this.pool.funnelBit, matrix: makeTransform(0.62, 1.04, -0.10, 0, 0, 0, 1.25, 1.25, 1.25) },
              { geo: this.pool.torusSlim, matrix: makeTransform(0, 0.92, -0.22, 0.2, 0, 0, 1.22, 1.22, 1.22) },
            ];
      out.wingParts.push(...defaultWings);
    }

    const armorCombined = out.bodyParts.length > 0 ? [...out.armor, ...out.bodyParts] : out.armor;
    const energyCombined = out.weaponParts.length > 0 ? [...out.energy, ...out.weaponParts] : out.energy;

    const blueprint: CachedUnitBlueprint = {
      armorGeo: mergePartsWithVertexColor(armorCombined),
      matteGeo: mergePartsWithVertexColor(out.matte),
      trimGeo: mergePartsWithVertexColor(out.trim),
      energyGeo: mergePartsWithVertexColor(energyCombined),
      crystalGeo: mergePartsWithVertexColor(out.crystal),
      star3WingsGeo: mergePartsWithVertexColor(out.wingParts),
      headTopLocalY: out.headTopLocalY,
      weaponGlowHex: out.weaponGlowHex,
      crystalHex: out.crystalHex,
      crystalOpacity: out.crystalOpacity,
      crystalIntensity: out.crystalIntensity,
      hasMatte: out.matte.length > 0,
      hasTrim: out.trim.length > 0,
      hasEnergy: energyCombined.length > 0,
      hasCrystal: out.crystal.length > 0,
    };

    for (const d of out.disposables) {
      d.dispose();
    }

    this.blueprintCache.set(unitDef.id, blueprint);
    return blueprint;
  }

  public getUnitTriangleStats(unitId: string): {
    readonly armorTris: number;
    readonly matteTris: number;
    readonly trimTris: number;
    readonly energyTris: number;
    readonly totalTris: number;
  } {
    const fallbackDef = SEASON1_UNITS_BY_ID.get('S01')!;
    const unitDef = SEASON1_UNITS_BY_ID.get(unitId) ?? fallbackDef;
    const bp = this.getOrBuildBlueprint(unitDef);
    const countTris = (g: THREE.BufferGeometry): number => {
      const idx = g.getIndex();
      if (idx) return Math.floor(idx.count / 3);
      const pos = g.getAttribute('position');
      return pos ? Math.floor(pos.count / 3) : 0;
    };
    const armorTris = countTris(bp.armorGeo);
    const matteTris = countTris(bp.matteGeo);
    const trimTris = countTris(bp.trimGeo);
    const energyTris = countTris(bp.energyGeo);
    return {
      armorTris,
      matteTris,
      trimTris,
      energyTris,
      totalTris: armorTris + matteTris + trimTris + energyTris,
    };
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

    const costRingMesh = new THREE.Mesh(
      this.pool.costGlowRing,
      this.materials.getCostRingMaterial(unitDef.cost),
    );
    costRingMesh.position.y = 0.022;
    root.add(costRingMesh);

    const bodyTiltGroup = new THREE.Group();
    bodyTiltGroup.rotation.x = CAMERA_PITCH_COMPENSATION_RAD;
    root.add(bodyTiltGroup);

    const animatedCore = new THREE.Group();
    bodyTiltGroup.add(animatedCore);

    const armorMesh = new THREE.Mesh(blueprint.armorGeo, this.materials.unitArmorMat);
    animatedCore.add(armorMesh);

    if (blueprint.hasMatte) {
      const matteMesh = new THREE.Mesh(blueprint.matteGeo, this.materials.unitMatteMat);
      animatedCore.add(matteMesh);
    }

    if (blueprint.hasTrim) {
      const trimMesh = new THREE.Mesh(blueprint.trimGeo, this.materials.unitTrimMat);
      animatedCore.add(trimMesh);
    }

    const weaponGlowMat = this.materials.createUnitEnergyMaterial(blueprint.weaponGlowHex, 0.62);
    const weaponGlowMesh = new THREE.Mesh(blueprint.energyGeo, weaponGlowMat);
    weaponGlowMesh.visible = blueprint.hasEnergy;
    animatedCore.add(weaponGlowMesh);

    let crystalMat: THREE.MeshPhysicalMaterial | null = null;
    if (blueprint.hasCrystal) {
      crystalMat = this.materials.createUnitCrystalMaterial(
        blueprint.crystalHex,
        blueprint.crystalIntensity,
        blueprint.crystalOpacity,
      );
      const crystalMesh = new THREE.Mesh(blueprint.crystalGeo, crystalMat);
      crystalMesh.renderOrder = 2;
      animatedCore.add(crystalMesh);
    }

    const star3WingsMesh = new THREE.Mesh(blueprint.star3WingsGeo, this.materials.brushedGoldMat);
    star3WingsMesh.visible = false;
    animatedCore.add(star3WingsMesh);

    const star3CrownMesh = new THREE.Mesh(this.pool.star3CrownGeo, this.starCrownMat);
    star3CrownMesh.position.set(0, blueprint.headTopLocalY - 0.14, 0);
    star3CrownMesh.visible = false;
    animatedCore.add(star3CrownMesh);

    const fresnelHitMat = createFresnelHitRimMaterial();
    const fresnelShellMesh = new THREE.Mesh(blueprint.armorGeo, fresnelHitMat);
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
      scaleSpring: new SpringDamper(starTargetScale(initialStar), 24, 0.66),
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
        rig.scaleSpring.setTarget(starTargetScale(star));

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
        star3CrownMesh.visible = star === 3;
      },

      applyAllegiance: (allegiance: 'ally' | 'enemy') => {
        rig.allegiance = allegiance;
      },

      setManaRatio: (ratio: number): boolean => {
        const clamped = Math.max(0, Math.min(1, ratio));
        rig.manaRatio = clamped;
        const fullGlow = clamped >= 0.85;
        weaponGlowMat.emissiveIntensity = fullGlow ? 1.38 : rig.star >= 2 ? 0.82 : 0.62;
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

        const hoverAmp = unitDef.modelProfile.archetype === 'hard_surface_vessel' ? 0.048 : 0.020;
        const idleY = Math.sin(elapsedSec * 2.6 + unitDef.cost) * hoverAmp;
        animatedCore.position.y = idleY + actionOffsetY;
        animatedCore.rotation.x = actionPitch;

        if (rig.star === 3) {
          pedestalMesh.rotation.y = elapsedSec * 0.95;
          star3CrownMesh.rotation.y = elapsedSec * 1.4;
          star3CrownMesh.position.y = blueprint.headTopLocalY - 0.12 + Math.sin(elapsedSec * 3.4) * 0.035;
        }
        if (unitDef.cost >= 4) {
          costRingMesh.rotation.z = elapsedSec * 0.7;
        }
      },

      dispose: () => {
        fresnelHitMat.dispose();
        weaponGlowMat.dispose();
        crystalMat?.dispose();
      },
    };

    rig.applyStarTier(initialStar);
    rig.scaleSpring.snap(starTargetScale(initialStar));
    bodyTiltGroup.scale.setScalar(rig.scaleSpring.value);

    return rig;
  }

  public buildPortraitPreviewGroup(unitId: string, star: UnitStar = 1): {
    readonly group: THREE.Group;
    readonly headTopLocalY: number;
    dispose(): void;
  } {
    const rig = this.createUnitRig(`portrait_${unitId}`, unitId, star, 'ally');
    rig.bodyTiltGroup.rotation.x = 0;
    return {
      group: rig.root,
      headTopLocalY: rig.headTopLocalY,
      dispose: () => rig.dispose(),
    };
  }

  public dispose(): void {
    for (const bp of this.blueprintCache.values()) {
      bp.armorGeo.dispose();
      bp.matteGeo.dispose();
      bp.trimGeo.dispose();
      bp.energyGeo.dispose();
      bp.crystalGeo.dispose();
      bp.star3WingsGeo.dispose();
    }
    this.blueprintCache.clear();
    this.starCrownMat.dispose();
    this.pool.dispose();
  }
}
