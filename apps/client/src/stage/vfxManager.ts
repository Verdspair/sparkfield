import * as THREE from 'three';
import { Easing, Group as TweenGroup, Tween } from '@tweenjs/tween.js';
import type { PbrMaterialLibrary } from './pbrMaterials.js';
import { hexToStageXZ } from './spring.js';
import type { DamageFloatKind, StageLootOrbState } from './types.js';

interface RippleSlot {
  readonly outerRing: THREE.Mesh;
  readonly innerRing: THREE.Mesh;
  readonly outerMat: THREE.MeshBasicMaterial;
  readonly innerMat: THREE.MeshBasicMaterial;
  active: boolean;
  ageSec: number;
}

interface ProjectileSlot {
  readonly group: THREE.Group;
  readonly headMesh: THREE.Mesh;
  readonly trailMesh: THREE.Mesh;
  readonly mat: THREE.MeshStandardMaterial;
  readonly trailMat: THREE.MeshBasicMaterial;
  active: boolean;
  elapsedSec: number;
  durationSec: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  arcHeight: number;
}

interface PillarSlot {
  readonly cylinder: THREE.Mesh;
  readonly collapseRing: THREE.Mesh;
  readonly shockRing: THREE.Mesh;
  readonly cylMat: THREE.MeshStandardMaterial;
  readonly ringMat: THREE.MeshStandardMaterial;
  active: boolean;
  ageSec: number;
  durationSec: number;
  star: 2 | 3;
}

interface SparkParticle {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  gravity: number;
  drag: number;
  ageSec: number;
  durationSec: number;
  baseScale: number;
  spinSpeed: number;
  rotY: number;
  rotZ: number;
  color: THREE.Color;
}

export interface LootOrbBurstCallback {
  (
    orbId: string,
    goldAmount: number,
    burstPos: { readonly x: number; readonly y: number; readonly z: number },
    removedBloomMesh?: THREE.Object3D,
  ): void;
}

export interface LootOrbActor {
  readonly orbId: string;
  goldAmount: number;
  x: number;
  y: number;
  z: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  rotY: number;
  showGroundAndBeam: boolean;
  groundPulse: number;
  targetX: number;
  targetZ: number;
  readonly baseScale: number;
  readonly phaseOffset: number;
  dropping: boolean;
  dropElapsed: number;
  dropDelay: number;
  bouncedOnce: boolean;
  readyToCollect: boolean;
  collecting: boolean;
  collectDelaySec: number;
  collectElapsedSec: number;
  collectDurationSec: number;
  collectStarted: boolean;
  collectStartX: number;
  collectStartY: number;
  collectStartZ: number;
  collectTargetResolver: (() => { x: number; y: number; z: number }) | null;
  onCollectBurst: LootOrbBurstCallback | null;
}

function createLootOrbVolumetricMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uHeartColor: { value: new THREE.Color(0xfffef2) },
      uGoldMidColor: { value: new THREE.Color(0xffc93c) },
      uAmberDeepColor: { value: new THREE.Color(0xc26508) },
      uRimColor: { value: new THREE.Color(0xffeaa0) },
      uSpecColor: { value: new THREE.Color(0xfffff6) },
    },
    vertexShader: `
      attribute float aPhase;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      varying float vPhase;
      void main() {
        vLocalPos = position;
        vPhase = aPhase;
        vec4 localPos = vec4(position, 1.0);
        vec3 transformedNormal = normal;
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
          transformedNormal = mat3(instanceMatrix) * transformedNormal;
        #endif
        vec4 mvPos = modelViewMatrix * localPos;
        vNormalView = normalize(normalMatrix * transformedNormal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uHeartColor;
      uniform vec3 uGoldMidColor;
      uniform vec3 uAmberDeepColor;
      uniform vec3 uRimColor;
      uniform vec3 uSpecColor;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying vec3 vLocalPos;
      varying float vPhase;
      void main() {
        vec3 N = normalize(vNormalView);
        vec3 V = normalize(vViewDir);
        float ndv = clamp(dot(N, V), 0.0, 1.0);
        float radial = sqrt(max(0.0, 1.0 - ndv * ndv));

        float heart = exp(-radial * radial * 5.6);
        float innerHalo = exp(-radial * radial * 2.05);
        float fresnel = pow(1.0 - ndv, 2.35);

        vec3 p = vLocalPos * 6.5;
        float t = uTime + vPhase;
        float swirlA = sin(p.x * 1.7 + p.y * 2.1 - t * 2.2 + cos(p.z * 1.5 + t * 1.3));
        float swirlB = sin(p.z * 2.0 - p.y * 1.8 + t * 1.65 + sin(p.x * 1.6 - t * 1.1));
        float energyBand = smoothstep(0.14, 0.92, 0.5 + 0.28 * swirlA + 0.24 * swirlB);

        float starSpark = pow(max(0.0, sin(p.x * 3.1 - t * 2.6) * cos(p.y * 2.9 + t * 2.1) * sin(p.z * 3.1 + t * 1.9)), 4.0);

        vec3 keyDir = normalize(vec3(-0.42, 0.78, 0.46));
        vec3 halfKey = normalize(keyDir + V);
        float spec = pow(max(dot(N, halfKey), 0.0), 54.0);

        vec3 bounceDir = normalize(vec3(0.48, -0.62, 0.34));
        float internalBounce = pow(max(dot(N, bounceDir), 0.0), 2.4) * 0.42;

        float pulse = 0.94 + 0.06 * sin(t * 2.9);

        vec3 col = mix(uAmberDeepColor, uGoldMidColor, clamp(innerHalo * 0.78 + energyBand * 0.36 + internalBounce, 0.0, 1.0));
        col = mix(col, uHeartColor, clamp(heart * 0.92 + starSpark * 0.35, 0.0, 1.0));
        col = mix(col, uRimColor, clamp(fresnel * 0.84, 0.0, 1.0));
        col += uSpecColor * spec * 1.15;
        col *= pulse;

        float alpha = clamp(0.76 + innerHalo * 0.16 + fresnel * 0.22 + spec * 0.2, 0.0, 0.98);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createLootOrbGroundGlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uShadowColor: { value: new THREE.Color(0x6e3a04) },
      uGoldGlowColor: { value: new THREE.Color(0xf7b933) },
      uRingBrightColor: { value: new THREE.Color(0xffe796) },
    },
    vertexShader: `
      attribute float aPhase;
      varying vec2 vUv;
      varying float vPhase;
      void main() {
        vUv = uv;
        vPhase = aPhase;
        vec4 localPos = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * localPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uShadowColor;
      uniform vec3 uGoldGlowColor;
      uniform vec3 uRingBrightColor;
      varying vec2 vUv;
      varying float vPhase;
      void main() {
        float r = length(vUv - vec2(0.5)) * 2.0;
        float shadow = exp(-r * r * 6.4) * 0.42;
        float warmPool = exp(-r * r * 3.1) * 0.34;
        float ringPos = 0.68 + 0.028 * sin(uTime * 2.8 + vPhase);
        float ring = exp(-pow((r - ringPos) * 10.5, 2.0)) * 0.56;
        float edgeMask = 1.0 - smoothstep(0.84, 1.0, r);
        vec3 col = mix(uShadowColor, uGoldGlowColor, clamp(warmPool * 1.8, 0.0, 1.0));
        col = mix(col, uRingBrightColor, clamp(ring * 1.35, 0.0, 1.0));
        float alpha = clamp((shadow + warmPool * 0.65 + ring) * edgeMask, 0.0, 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });
}

function createLootOrbBeamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xf6be44) },
    },
    vertexShader: `
      attribute float aPhase;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying float vPhase;
      void main() {
        vUv = uv;
        vPhase = aPhase;
        vec4 localPos = vec4(position, 1.0);
        vec3 transformedNormal = normal;
        #ifdef USE_INSTANCING
          localPos = instanceMatrix * localPos;
          transformedNormal = mat3(instanceMatrix) * transformedNormal;
        #endif
        vec4 mvPos = modelViewMatrix * localPos;
        vNormalView = normalize(normalMatrix * transformedNormal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      varying float vPhase;
      void main() {
        float verticalFade = smoothstep(0.0, 0.16, vUv.y) * pow(1.0 - vUv.y, 2.2);
        float edgeFade = pow(clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0), 1.6);
        float shimmer = 0.84 + 0.16 * sin(vUv.y * 12.0 - uTime * 3.5 + vPhase);
        gl_FragColor = vec4(uColor, verticalFade * edgeFade * shimmer * 0.28);
      }
    `,
  });
}

const RIPPLE_POOL_SIZE = 10;
const PROJECTILE_POOL_SIZE = 24;
const PILLAR_POOL_SIZE = 4;
const RIPPLE_DURATION_SEC = 0.46;
const MAX_LOOT_ORBS = 16;
const ORBIT_MOTES_PER_ORB = 3;
const MAX_ORBIT_MOTES = MAX_LOOT_ORBS * ORBIT_MOTES_PER_ORB;
const SPARK_POOL_SIZE = 96;

const BURST_PALETTE = [
  new THREE.Color(0xfff5c0),
  new THREE.Color(0xffcc29),
  new THREE.Color(0xf59e0b),
  new THREE.Color(0xffe07d),
] as const;

const TRAIL_PALETTE = [
  new THREE.Color(0xffd75e),
  new THREE.Color(0x38bdf8),
  new THREE.Color(0xfef08a),
] as const;

export class StageVfxManager {
  public readonly root = new THREE.Group();
  public readonly bloomTargets: THREE.Object3D[] = [];

  private readonly materials: PbrMaterialLibrary;
  private readonly tweenGroup: TweenGroup;

  private readonly ripplePool: RippleSlot[] = [];
  private readonly projectilePool: ProjectileSlot[] = [];
  private readonly pillarPool: PillarSlot[] = [];
  private readonly sparkPool: SparkParticle[] = [];
  private readonly lootOrbs = new Map<string, LootOrbActor>();

  private readonly orbBodyGeo = new THREE.SphereGeometry(0.36, 36, 28);
  private readonly orbBeamGeo = new THREE.CylinderGeometry(0.09, 0.27, 1.55, 24, 1, true);
  private readonly orbBaseGeo = new THREE.PlaneGeometry(1.36, 1.36);
  private readonly orbMoteGeo = new THREE.OctahedronGeometry(0.045, 0);
  private readonly sparkGeo = new THREE.OctahedronGeometry(0.064, 0);
  private readonly moteGeo = new THREE.OctahedronGeometry(0.18, 0);

  private readonly orbBodyPhaseArr = new Float32Array(MAX_LOOT_ORBS);
  private readonly orbBasePhaseArr = new Float32Array(MAX_LOOT_ORBS);
  private readonly orbBeamPhaseArr = new Float32Array(MAX_LOOT_ORBS);
  private readonly orbBodyPhaseAttr: THREE.InstancedBufferAttribute;
  private readonly orbBasePhaseAttr: THREE.InstancedBufferAttribute;
  private readonly orbBeamPhaseAttr: THREE.InstancedBufferAttribute;

  private readonly orbBodyMat: THREE.ShaderMaterial;
  private readonly orbBeamMat: THREE.ShaderMaterial;
  private readonly orbBaseMat: THREE.ShaderMaterial;
  private readonly orbMoteMat: THREE.MeshBasicMaterial;
  private readonly sparkMat: THREE.MeshBasicMaterial;

  private readonly orbBodyInstanced: THREE.InstancedMesh;
  private readonly orbBaseInstanced: THREE.InstancedMesh;
  private readonly orbBeamInstanced: THREE.InstancedMesh;
  private readonly orbMoteInstanced: THREE.InstancedMesh;
  private readonly sparkInstanced: THREE.InstancedMesh;

  private readonly scratchPos = new THREE.Vector3();
  private readonly scratchQuat = new THREE.Quaternion();
  private readonly scratchEuler = new THREE.Euler();
  private readonly scratchScale = new THREE.Vector3();
  private readonly scratchMatrix = new THREE.Matrix4();
  private readonly scratchVec = new THREE.Vector3();
  private readonly scratchDir = new THREE.Vector3();
  private readonly scratchAxisZ = new THREE.Vector3(0, 0, 1);

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private elapsedSec = 0;
  private sparkSeed = 1;
  private orbPhaseCounter = 0;

  constructor(materials: PbrMaterialLibrary, tweenGroup: TweenGroup) {
    this.materials = materials;
    this.tweenGroup = tweenGroup;

    this.orbBeamGeo.translate(0, 0.775, 0);
    this.orbBaseGeo.rotateX(-Math.PI * 0.5);
    this.orbMoteGeo.scale(0.72, 1.55, 0.72);
    this.sparkGeo.scale(0.74, 1.45, 0.74);

    this.orbBodyPhaseAttr = new THREE.InstancedBufferAttribute(this.orbBodyPhaseArr, 1);
    this.orbBasePhaseAttr = new THREE.InstancedBufferAttribute(this.orbBasePhaseArr, 1);
    this.orbBeamPhaseAttr = new THREE.InstancedBufferAttribute(this.orbBeamPhaseArr, 1);
    this.orbBodyGeo.setAttribute('aPhase', this.orbBodyPhaseAttr);
    this.orbBaseGeo.setAttribute('aPhase', this.orbBasePhaseAttr);
    this.orbBeamGeo.setAttribute('aPhase', this.orbBeamPhaseAttr);

    this.ownedGeometries.push(
      this.orbBodyGeo,
      this.orbBeamGeo,
      this.orbBaseGeo,
      this.orbMoteGeo,
      this.sparkGeo,
      this.moteGeo,
    );

    this.orbBodyMat = createLootOrbVolumetricMaterial();
    this.orbBeamMat = createLootOrbBeamMaterial();
    this.orbBaseMat = createLootOrbGroundGlowMaterial();
    this.orbMoteMat = new THREE.MeshBasicMaterial({
      color: 0xffd24c,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
    });
    this.sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    this.ownedMaterials.push(
      this.orbBodyMat,
      this.orbBeamMat,
      this.orbBaseMat,
      this.orbMoteMat,
      this.sparkMat,
    );

    this.orbBaseInstanced = new THREE.InstancedMesh(
      this.orbBaseGeo,
      this.orbBaseMat,
      MAX_LOOT_ORBS,
    );
    this.orbBaseInstanced.count = 0;
    this.orbBaseInstanced.visible = false;
    this.orbBaseInstanced.frustumCulled = false;
    this.orbBaseInstanced.renderOrder = 1;
    this.root.add(this.orbBaseInstanced);

    this.orbBeamInstanced = new THREE.InstancedMesh(
      this.orbBeamGeo,
      this.orbBeamMat,
      MAX_LOOT_ORBS,
    );
    this.orbBeamInstanced.count = 0;
    this.orbBeamInstanced.visible = false;
    this.orbBeamInstanced.frustumCulled = false;
    this.orbBeamInstanced.renderOrder = 2;
    this.root.add(this.orbBeamInstanced);

    this.orbBodyInstanced = new THREE.InstancedMesh(
      this.orbBodyGeo,
      this.orbBodyMat,
      MAX_LOOT_ORBS,
    );
    this.orbBodyInstanced.count = 0;
    this.orbBodyInstanced.visible = false;
    this.orbBodyInstanced.frustumCulled = false;
    this.orbBodyInstanced.renderOrder = 3;
    this.root.add(this.orbBodyInstanced);
    this.bloomTargets.push(this.orbBodyInstanced);

    this.orbMoteInstanced = new THREE.InstancedMesh(
      this.orbMoteGeo,
      this.orbMoteMat,
      MAX_ORBIT_MOTES,
    );
    this.orbMoteInstanced.count = 0;
    this.orbMoteInstanced.visible = false;
    this.orbMoteInstanced.frustumCulled = false;
    this.orbMoteInstanced.renderOrder = 4;
    this.root.add(this.orbMoteInstanced);
    this.bloomTargets.push(this.orbMoteInstanced);

    this.sparkInstanced = new THREE.InstancedMesh(
      this.sparkGeo,
      this.sparkMat,
      SPARK_POOL_SIZE,
    );
    this.sparkInstanced.count = 0;
    this.sparkInstanced.visible = false;
    this.sparkInstanced.frustumCulled = false;
    this.sparkInstanced.renderOrder = 4;
    for (let i = 0; i < SPARK_POOL_SIZE; i += 1) {
      this.sparkInstanced.setColorAt(i, BURST_PALETTE[0]!);
      this.sparkPool.push({
        active: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        gravity: -7.2,
        drag: 1.8,
        ageSec: 0,
        durationSec: 0.5,
        baseScale: 1,
        spinSpeed: 4,
        rotY: 0,
        rotZ: 0,
        color: new THREE.Color(0xffcc29),
      });
    }
    if (this.sparkInstanced.instanceColor) {
      this.sparkInstanced.instanceColor.needsUpdate = true;
    }
    this.root.add(this.sparkInstanced);
    this.bloomTargets.push(this.sparkInstanced);

    const outerGeo = new THREE.RingGeometry(0.84, 0.92, 28);
    outerGeo.rotateX(-Math.PI * 0.5);
    const innerGeo = new THREE.RingGeometry(0.45, 0.72, 24);
    innerGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(outerGeo, innerGeo);

    for (let i = 0; i < RIPPLE_POOL_SIZE; i += 1) {
      const outerMat = new THREE.MeshBasicMaterial({
        color: 0xf2c97d,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x4fd1ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.ownedMaterials.push(outerMat, innerMat);

      const outerRing = new THREE.Mesh(outerGeo, outerMat);
      const innerRing = new THREE.Mesh(innerGeo, innerMat);
      outerRing.visible = false;
      innerRing.visible = false;
      this.root.add(outerRing, innerRing);
      this.ripplePool.push({
        outerRing,
        innerRing,
        outerMat,
        innerMat,
        active: false,
        ageSec: 0,
      });
    }

    const projGeo = new THREE.ConeGeometry(0.088, 0.44, 6);
    projGeo.rotateX(Math.PI * 0.5);
    const trailGeo = new THREE.ConeGeometry(0.068, 0.72, 6);
    trailGeo.rotateX(-Math.PI * 0.5);
    trailGeo.translate(0, 0, -0.44);
    this.ownedGeometries.push(projGeo, trailGeo);

    for (let i = 0; i < PROJECTILE_POOL_SIZE; i += 1) {
      const mat = materials.createBloomEmissiveMaterial(0x38bdf8, 1.25);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.ownedMaterials.push(trailMat);

      const group = new THREE.Group();
      const headMesh = new THREE.Mesh(projGeo, mat);
      const trailMesh = new THREE.Mesh(trailGeo, trailMat);
      group.add(headMesh, trailMesh);
      group.visible = false;
      this.root.add(group);
      this.bloomTargets.push(headMesh);
      this.projectilePool.push({
        group,
        headMesh,
        trailMesh,
        mat,
        trailMat,
        active: false,
        elapsedSec: 0,
        durationSec: 0.35,
        from: new THREE.Vector3(),
        to: new THREE.Vector3(),
        arcHeight: 0.4,
      });
    }

    const cylGeo = new THREE.CylinderGeometry(0.42, 0.58, 5.4, 18, 1, true);
    cylGeo.translate(0, 2.7, 0);
    const collapseGeo = new THREE.TorusGeometry(1.12, 0.052, 8, 28);
    collapseGeo.rotateX(Math.PI * 0.5);
    const shockGeo = new THREE.RingGeometry(0.55, 0.92, 28);
    shockGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(cylGeo, collapseGeo, shockGeo);

    for (let i = 0; i < PILLAR_POOL_SIZE; i += 1) {
      const cylMat = materials.createBloomEmissiveMaterial(0xf2c97d, 1.28);
      cylMat.transparent = true;
      cylMat.opacity = 0;
      cylMat.side = THREE.DoubleSide;
      cylMat.depthWrite = false;

      const ringMat = materials.createBloomEmissiveMaterial(0xf2c97d, 1.32);
      ringMat.transparent = true;
      ringMat.opacity = 0;
      ringMat.depthWrite = false;

      const cylinder = new THREE.Mesh(cylGeo, cylMat);
      const collapseRing = new THREE.Mesh(collapseGeo, ringMat);
      const shockRing = new THREE.Mesh(shockGeo, ringMat);
      cylinder.visible = false;
      collapseRing.visible = false;
      shockRing.visible = false;
      this.root.add(cylinder, collapseRing, shockRing);
      this.bloomTargets.push(cylinder, collapseRing, shockRing);

      this.pillarPool.push({
        cylinder,
        collapseRing,
        shockRing,
        cylMat,
        ringMat,
        active: false,
        ageSec: 0,
        durationSec: 0.78,
        star: 2,
      });
    }
  }

  private nextRand(): number {
    this.sparkSeed = (Math.imul(this.sparkSeed, 1664525) + 1013904223) >>> 0;
    return this.sparkSeed / 4294967296;
  }

  public getActiveBloomTargets(): THREE.Object3D[] {
    return [...this.bloomTargets];
  }

  public spawnGroundClickRipple(worldX: number, worldZ: number, goldAccent = false): void {
    const slot = this.ripplePool.find((r) => !r.active) ?? this.ripplePool[0]!;
    slot.active = true;
    slot.ageSec = 0;
    slot.outerMat.color.setHex(goldAccent ? 0xf5b935 : 0xf2c97d);
    slot.innerMat.color.setHex(goldAccent ? 0xd97706 : 0x4fd1ff);
    slot.outerRing.position.set(worldX, 0.024, worldZ);
    slot.innerRing.position.set(worldX, 0.022, worldZ);
    slot.outerRing.scale.setScalar(0.18);
    slot.innerRing.scale.setScalar(0.12);
    slot.outerRing.visible = true;
    slot.innerRing.visible = true;
  }

  public spawnOrbPickupBurst(worldX: number, worldY: number, worldZ: number): void {
    this.spawnGroundClickRipple(worldX, worldZ, true);
    const sparkCount = 13;
    for (let i = 0; i < sparkCount; i += 1) {
      const slot = this.sparkPool.find((p) => !p.active) ?? this.sparkPool[i % SPARK_POOL_SIZE]!;
      const angle = (i / sparkCount) * Math.PI * 2 + (this.nextRand() - 0.5) * 0.36;
      const horizSpeed = 1.65 + this.nextRand() * 1.95;
      const upSpeed = 1.85 + this.nextRand() * 2.15;
      slot.active = true;
      slot.x = worldX + (this.nextRand() - 0.5) * 0.14;
      slot.y = worldY + (this.nextRand() - 0.5) * 0.12;
      slot.z = worldZ + (this.nextRand() - 0.5) * 0.14;
      slot.vx = Math.cos(angle) * horizSpeed;
      slot.vy = upSpeed;
      slot.vz = Math.sin(angle) * horizSpeed;
      slot.gravity = -7.8;
      slot.drag = 2.1;
      slot.ageSec = 0;
      slot.durationSec = 0.42 + this.nextRand() * 0.24;
      slot.baseScale = 0.85 + this.nextRand() * 0.65;
      slot.spinSpeed = 5.5 + this.nextRand() * 6.5;
      slot.rotY = this.nextRand() * Math.PI * 2;
      slot.rotZ = this.nextRand() * Math.PI * 2;
      slot.color.copy(BURST_PALETTE[i % BURST_PALETTE.length]!);
    }
  }

  public spawnTacticianTrailSpark(worldX: number, worldY: number, worldZ: number): void {
    const slot = this.sparkPool.find((p) => !p.active);
    if (!slot) return;
    const angle = this.nextRand() * Math.PI * 2;
    slot.active = true;
    slot.x = worldX + (this.nextRand() - 0.5) * 0.22;
    slot.y = worldY + this.nextRand() * 0.14;
    slot.z = worldZ + (this.nextRand() - 0.5) * 0.22;
    slot.vx = Math.cos(angle) * 0.28;
    slot.vy = 0.42 + this.nextRand() * 0.35;
    slot.vz = Math.sin(angle) * 0.28;
    slot.gravity = -0.6;
    slot.drag = 2.4;
    slot.ageSec = 0;
    slot.durationSec = 0.28 + this.nextRand() * 0.14;
    slot.baseScale = 0.48 + this.nextRand() * 0.24;
    slot.spinSpeed = 4.2 + this.nextRand() * 3.0;
    slot.rotY = this.nextRand() * Math.PI * 2;
    slot.rotZ = this.nextRand() * Math.PI * 2;
    slot.color.copy(TRAIL_PALETTE[Math.floor(this.nextRand() * TRAIL_PALETTE.length)]!);
  }

  public syncLootOrbs(
    orbs: readonly StageLootOrbState[],
  ): { readonly addedBloom: THREE.Object3D[]; readonly removedBloom: THREE.Object3D[] } {
    const incomingIds = new Set(orbs.map((o) => o.orbId));

    for (const [id, actor] of this.lootOrbs.entries()) {
      if (!incomingIds.has(id) && !actor.collecting) {
        this.lootOrbs.delete(id);
      }
    }

    let spawnOrder = 0;
    for (const orb of orbs) {
      const amount = Math.max(1, Math.floor(orb.goldAmount));
      const existing = this.lootOrbs.get(orb.orbId);
      const { x, z } = hexToStageXZ(orb.row, orb.col);
      if (existing) {
        existing.goldAmount = amount;
        existing.targetX = x;
        existing.targetZ = z;
        if (!existing.collecting && !existing.dropping) {
          existing.x = x;
          existing.z = z;
        }
        continue;
      }

      const scaleBoost = 1 + Math.min(3, Math.max(0, amount - 1)) * 0.08;
      const dropDelay = spawnOrder * 0.13;
      spawnOrder += 1;
      const phaseOffset = this.orbPhaseCounter * 1.37;
      this.orbPhaseCounter += 1;

      this.lootOrbs.set(orb.orbId, {
        orbId: orb.orbId,
        goldAmount: amount,
        x: 0,
        y: 3.4,
        z: 0.15,
        scaleX: 0.01,
        scaleY: 0.01,
        scaleZ: 0.01,
        rotY: phaseOffset,
        showGroundAndBeam: false,
        groundPulse: 1,
        targetX: x,
        targetZ: z,
        baseScale: scaleBoost,
        phaseOffset,
        dropping: true,
        dropElapsed: 0,
        dropDelay,
        bouncedOnce: false,
        readyToCollect: false,
        collecting: false,
        collectDelaySec: 0,
        collectElapsedSec: 0,
        collectDurationSec: 0.14,
        collectStarted: false,
        collectStartX: x,
        collectStartY: 0.44,
        collectStartZ: z,
        collectTargetResolver: null,
        onCollectBurst: null,
      });
    }

    return { addedBloom: [], removedBloom: [] };
  }

  public getLootOrbWorldPos(orbId: string): { x: number; z: number } | null {
    const actor = this.lootOrbs.get(orbId);
    if (!actor) return null;
    return { x: actor.x, z: actor.z };
  }

  public getLootOrbTargetPos(orbId: string): { x: number; z: number } | null {
    const actor = this.lootOrbs.get(orbId);
    if (!actor || actor.collecting) return null;
    return { x: actor.targetX, z: actor.targetZ };
  }

  public hasUncollectedLootOrbs(): boolean {
    for (const actor of this.lootOrbs.values()) {
      if (!actor.collecting) return true;
    }
    return false;
  }

  public getUncollectedLootOrbIds(): string[] {
    const ids: string[] = [];
    for (const actor of this.lootOrbs.values()) {
      if (!actor.collecting) ids.push(actor.orbId);
    }
    return ids;
  }

  public findLootOrbNear(worldX: number, worldZ: number, radius = 0.78): LootOrbActor | null {
    let best: LootOrbActor | null = null;
    let bestDistSq = radius * radius;
    for (const actor of this.lootOrbs.values()) {
      if (actor.collecting) continue;
      const ax = actor.dropping ? actor.targetX : actor.x;
      const az = actor.dropping ? actor.targetZ : actor.z;
      const dx = ax - worldX;
      const dz = az - worldZ;
      const distSq = dx * dx + dz * dz;
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = actor;
      }
    }
    return best;
  }

  public findLootOrbByRay(ray: THREE.Ray, hitRadius = 0.62): LootOrbActor | null {
    let best: LootOrbActor | null = null;
    let bestDistSq = hitRadius * hitRadius;
    for (const actor of this.lootOrbs.values()) {
      if (actor.collecting) continue;
      const cx = actor.dropping && actor.dropElapsed < actor.dropDelay ? actor.targetX : actor.x;
      const cy = actor.dropping && actor.dropElapsed < actor.dropDelay ? 0.44 : actor.y;
      const cz = actor.dropping && actor.dropElapsed < actor.dropDelay ? actor.targetZ : actor.z;
      this.scratchVec.set(cx, cy, cz);
      const radiusScale = Math.max(1, actor.baseScale);
      const distSq = ray.distanceSqToPoint(this.scratchVec) / (radiusScale * radiusScale);
      if (distSq <= bestDistSq) {
        bestDistSq = distSq;
        best = actor;
      }
    }
    return best;
  }

  public findCollectibleLootOrbsNear(
    worldX: number,
    worldZ: number,
    radius = 0.95,
  ): LootOrbActor[] {
    const out: LootOrbActor[] = [];
    const rSq = radius * radius;
    for (const actor of this.lootOrbs.values()) {
      if (actor.collecting || !actor.readyToCollect) continue;
      const dx = actor.targetX - worldX;
      const dz = actor.targetZ - worldZ;
      if (dx * dx + dz * dz <= rSq) {
        out.push(actor);
      }
    }
    return out;
  }

  public magnetCollectLootOrb(
    orbId: string,
    targetResolver: () => { x: number; y: number; z: number },
    durationSec = 0.14,
    onBurst?: LootOrbBurstCallback,
    delaySec = 0,
  ): boolean {
    const actor = this.lootOrbs.get(orbId);
    if (!actor || actor.collecting) return false;
    actor.collecting = true;
    actor.dropping = false;
    actor.readyToCollect = true;
    actor.collectDelaySec = Math.max(0, delaySec);
    actor.collectElapsedSec = 0;
    actor.collectDurationSec = Math.max(0.06, durationSec);
    actor.collectStarted = false;
    actor.collectStartX = actor.x;
    actor.collectStartY = actor.y;
    actor.collectStartZ = actor.z;
    actor.collectTargetResolver = targetResolver;
    actor.onCollectBurst = onBurst ?? null;
    if (actor.collectDelaySec === 0) {
      actor.showGroundAndBeam = false;
      actor.collectStarted = true;
    }
    return true;
  }

  public collectLootOrb(
    orbId: string,
    onArrived?: LootOrbBurstCallback,
    targetWorld?: { x: number; y: number; z: number },
  ): boolean {
    const fixedTarget = {
      x: targetWorld?.x ?? -5.6,
      y: targetWorld?.y ?? 0.65,
      z: targetWorld?.z ?? 5.4,
    };
    return this.magnetCollectLootOrb(orbId, () => fixedTarget, 0.16, onArrived, 0);
  }

  public collectAllLootOrbs(
    targetResolver: () => { x: number; y: number; z: number },
    onBurst?: LootOrbBurstCallback,
  ): number {
    let count = 0;
    for (const actor of this.lootOrbs.values()) {
      if (actor.collecting) continue;
      if (actor.scaleX < 0.1) {
        actor.x = actor.targetX;
        actor.y = 0.44;
        actor.z = actor.targetZ;
        actor.scaleX = actor.baseScale;
        actor.scaleY = actor.baseScale;
        actor.scaleZ = actor.baseScale;
      }
      this.magnetCollectLootOrb(actor.orbId, targetResolver, 0.22, onBurst, count * 0.055);
      count += 1;
    }
    return count;
  }

  public playStarUpConvergence(
    targetWorld: { x: number; z: number },
    newStar: 2 | 3,
    onConvergenceHit?: () => void,
  ): void {
    const colorHex = newStar === 3 ? 0xf5c451 : 0xe2e8f0;
    const moteMat = this.materials.createBloomEmissiveMaterial(colorHex, 1.32);

    const offsets: readonly [number, number][] = [
      [-1.55, 0.95],
      [1.55, 0.95],
      [0, -1.35],
    ];

    let completedMotes = 0;
    for (const [ox, oz] of offsets) {
      const mote = new THREE.Mesh(this.moteGeo, moteMat);
      mote.position.set(targetWorld.x + ox, 0.55, targetWorld.z + oz);
      this.root.add(mote);

      const anim = { t: 0 };
      const tw = new Tween(anim)
        .to({ t: 1 }, 260)
        .easing(Easing.Cubic.In)
        .onUpdate(({ t }) => {
          const swirl = (1 - t) * 0.55;
          mote.position.set(
            targetWorld.x + ox * (1 - t) + Math.sin(t * Math.PI) * swirl,
            0.55 + Math.sin(t * Math.PI) * 0.95,
            targetWorld.z + oz * (1 - t),
          );
          mote.rotation.y += 0.25;
        })
        .onComplete(() => {
          this.root.remove(mote);
          completedMotes += 1;
          if (completedMotes === offsets.length) {
            this.eruptStarPillar(targetWorld.x, targetWorld.z, newStar);
            onConvergenceHit?.();
          }
        });
      this.tweenGroup.add(tw);
      tw.start();
    }
  }

  private eruptStarPillar(worldX: number, worldZ: number, star: 2 | 3): void {
    const slot = this.pillarPool.find((p) => !p.active) ?? this.pillarPool[0]!;
    slot.active = true;
    slot.ageSec = 0;
    slot.durationSec = star === 3 ? 0.92 : 0.72;
    slot.star = star;

    const color = new THREE.Color(star === 3 ? 0xf5c451 : 0xe2e8f0);
    slot.cylMat.color.copy(color);
    slot.cylMat.emissive.copy(color);
    slot.ringMat.color.copy(color);
    slot.ringMat.emissive.copy(color);

    slot.cylinder.position.set(worldX, 0.02, worldZ);
    slot.cylinder.scale.set(star === 3 ? 1.28 : 0.92, 1, star === 3 ? 1.28 : 0.92);
    slot.cylinder.visible = true;

    slot.collapseRing.position.set(worldX, star === 3 ? 2.2 : 0.45, worldZ);
    slot.collapseRing.scale.setScalar(star === 3 ? 1.65 : 0.85);
    slot.collapseRing.visible = true;

    slot.shockRing.position.set(worldX, 0.03, worldZ);
    slot.shockRing.scale.setScalar(0.35);
    slot.shockRing.visible = true;
  }

  public spawnProjectile(
    from: { x: number; y: number; z: number },
    to: { x: number; y: number; z: number },
    damageKind: DamageFloatKind = 'magic',
    speedUnitsPerSec = 14,
    arcHeight = 0.42,
  ): void {
    const slot = this.projectilePool.find((p) => !p.active) ?? this.projectilePool[0]!;
    slot.active = true;
    slot.elapsedSec = 0;
    slot.from.set(from.x, from.y, from.z);
    slot.to.set(to.x, to.y, to.z);
    const dist = slot.from.distanceTo(slot.to);
    slot.durationSec = Math.max(0.12, dist / Math.max(2, speedUnitsPerSec));
    slot.arcHeight = arcHeight;

    const hex =
      damageKind === 'physical'
        ? 0xf59e0b
        : damageKind === 'true'
          ? 0xffffff
          : 0x38bdf8;
    slot.mat.color.setHex(hex);
    slot.mat.emissive.setHex(hex);
    slot.trailMat.color.setHex(hex);

    slot.group.position.copy(slot.from);
    slot.group.visible = true;
  }

  public update(dt: number): void {
    this.elapsedSec += dt;
    this.orbBodyMat.uniforms['uTime']!.value = this.elapsedSec;
    this.orbBeamMat.uniforms['uTime']!.value = this.elapsedSec;
    this.orbBaseMat.uniforms['uTime']!.value = this.elapsedSec;

    for (const r of this.ripplePool) {
      if (!r.active) continue;
      r.ageSec += dt;
      const t = r.ageSec / RIPPLE_DURATION_SEC;
      if (t >= 1) {
        r.active = false;
        r.outerRing.visible = false;
        r.innerRing.visible = false;
        continue;
      }
      const easeOut = 1 - Math.pow(1 - t, 3);
      r.outerRing.scale.setScalar(0.18 + easeOut * 0.96);
      r.innerRing.scale.setScalar(0.12 + easeOut * 0.72);
      r.outerMat.opacity = (1 - t) * 0.88;
      r.innerMat.opacity = (1 - t) * 0.62;
    }

    const completedOrbs: LootOrbActor[] = [];
    let bodyCount = 0;
    let groundBeamCount = 0;
    let orbitMoteCount = 0;

    for (const actor of this.lootOrbs.values()) {
      actor.rotY = this.elapsedSec * 0.65 + actor.phaseOffset;
      let isVisible = true;

      if (actor.collecting) {
        if (actor.collectDelaySec > 0) {
          actor.collectDelaySec = Math.max(0, actor.collectDelaySec - dt);
          const hover = Math.sin(this.elapsedSec * 2.8 + actor.phaseOffset) * 0.055;
          actor.x = actor.targetX;
          actor.y = 0.44 + hover;
          actor.z = actor.targetZ;
        } else {
          if (!actor.collectStarted) {
            actor.collectStarted = true;
            actor.collectStartX = actor.x;
            actor.collectStartY = actor.y;
            actor.collectStartZ = actor.z;
            actor.showGroundAndBeam = false;
          }
          actor.collectElapsedSec += dt;
          const t = Math.min(1, actor.collectElapsedSec / actor.collectDurationSec);
          const ease = t * t * (1.25 - 0.25 * t);
          const target = actor.collectTargetResolver?.() ?? {
            x: actor.targetX,
            y: 0.62,
            z: actor.targetZ,
          };
          const lift = Math.sin(t * Math.PI) * 0.36;
          actor.x = actor.collectStartX + (target.x - actor.collectStartX) * ease;
          actor.y = actor.collectStartY + (target.y - actor.collectStartY) * ease + lift;
          actor.z = actor.collectStartZ + (target.z - actor.collectStartZ) * ease;
          const pullScale = Math.max(
            0.28,
            actor.baseScale * (1 + Math.sin(t * Math.PI) * 0.14 - t * 0.42),
          );
          actor.scaleX = pullScale;
          actor.scaleY = pullScale;
          actor.scaleZ = pullScale;
          if (t >= 1) {
            completedOrbs.push(actor);
            isVisible = false;
          }
        }
      } else if (actor.dropping) {
        actor.dropElapsed += dt;
        const localT = actor.dropElapsed - actor.dropDelay;
        if (localT < 0) {
          isVisible = false;
        } else {
          const flightDur = 0.46;
          const bounce1Dur = 0.26;
          const bounce2Dur = 0.18;
          const totalDur = flightDur + bounce1Dur + bounce2Dur;

          if (localT < flightDur) {
            const p = localT / flightDur;
            const easeP = 1 - Math.pow(1 - p, 2);
            actor.x = actor.targetX * easeP;
            actor.z = 0.15 + (actor.targetZ - 0.15) * easeP;
            actor.y = 3.4 * (1 - p) + Math.sin(p * Math.PI) * 1.55 + 0.34 * p;
            const grow = 0.42 + 0.58 * Math.min(1, p * 1.55);
            const stretch = p > 0.65 ? 1 + (p - 0.65) * 0.28 : 1;
            actor.scaleX = (actor.baseScale * grow) / Math.sqrt(stretch);
            actor.scaleY = actor.baseScale * grow * stretch;
            actor.scaleZ = (actor.baseScale * grow) / Math.sqrt(stretch);
          } else if (localT < flightDur + bounce1Dur) {
            if (!actor.bouncedOnce) {
              actor.bouncedOnce = true;
              actor.readyToCollect = true;
              actor.showGroundAndBeam = true;
              this.spawnGroundClickRipple(actor.targetX, actor.targetZ, true);
            }
            const b = (localT - flightDur) / bounce1Dur;
            const bounceY = 0.36 + Math.sin(b * Math.PI) * 0.54;
            const squash = b < 0.22 ? 1 + 0.26 * (1 - b / 0.22) : 1;
            actor.x = actor.targetX;
            actor.y = bounceY;
            actor.z = actor.targetZ;
            actor.scaleX = actor.baseScale * squash;
            actor.scaleY = actor.baseScale / (squash * squash);
            actor.scaleZ = actor.baseScale * squash;
            actor.groundPulse = 0.92 + (1 - Math.sin(b * Math.PI)) * 0.16;
          } else if (localT < totalDur) {
            const b2 = (localT - flightDur - bounce1Dur) / bounce2Dur;
            const bounceY = 0.42 + Math.sin(b2 * Math.PI) * 0.2;
            const squash2 = b2 < 0.2 ? 1 + 0.1 * (1 - b2 / 0.2) : 1;
            actor.x = actor.targetX;
            actor.y = bounceY;
            actor.z = actor.targetZ;
            actor.scaleX = actor.baseScale * squash2;
            actor.scaleY = actor.baseScale / (squash2 * squash2);
            actor.scaleZ = actor.baseScale * squash2;
            actor.groundPulse = 0.96 + (1 - Math.sin(b2 * Math.PI)) * 0.08;
          } else {
            actor.dropping = false;
            actor.readyToCollect = true;
            actor.showGroundAndBeam = true;
            actor.x = actor.targetX;
            actor.y = 0.44;
            actor.z = actor.targetZ;
            actor.scaleX = actor.baseScale;
            actor.scaleY = actor.baseScale;
            actor.scaleZ = actor.baseScale;
            actor.groundPulse = 1;
          }
        }
      } else {
        const hover = Math.sin(this.elapsedSec * 2.8 + actor.phaseOffset) * 0.055;
        const breath = 1 + Math.sin(this.elapsedSec * 2.8 + actor.phaseOffset) * 0.026;
        actor.x = actor.targetX;
        actor.y = 0.44 + hover;
        actor.z = actor.targetZ;
        actor.scaleX = actor.baseScale * breath;
        actor.scaleY = actor.baseScale * breath;
        actor.scaleZ = actor.baseScale * breath;
        actor.groundPulse = 0.95 + Math.sin(this.elapsedSec * 2.8 + actor.phaseOffset) * 0.08;
      }

      if (isVisible && bodyCount < MAX_LOOT_ORBS) {
        this.scratchPos.set(actor.x, actor.y, actor.z);
        this.scratchEuler.set(0, actor.rotY, 0);
        this.scratchQuat.setFromEuler(this.scratchEuler);
        this.scratchScale.set(actor.scaleX, actor.scaleY, actor.scaleZ);
        this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
        this.orbBodyInstanced.setMatrixAt(bodyCount, this.scratchMatrix);
        this.orbBodyPhaseArr[bodyCount] = actor.phaseOffset;
        bodyCount += 1;

        if (actor.showGroundAndBeam && groundBeamCount < MAX_LOOT_ORBS) {
          this.scratchPos.set(actor.targetX, 0.026, actor.targetZ);
          this.scratchQuat.identity();
          this.scratchScale.setScalar(actor.baseScale * actor.groundPulse);
          this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
          this.orbBaseInstanced.setMatrixAt(groundBeamCount, this.scratchMatrix);
          this.orbBasePhaseArr[groundBeamCount] = actor.phaseOffset;

          this.scratchPos.set(actor.targetX, 0.02, actor.targetZ);
          this.scratchScale.set(actor.baseScale, actor.baseScale, actor.baseScale);
          this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
          this.orbBeamInstanced.setMatrixAt(groundBeamCount, this.scratchMatrix);
          this.orbBeamPhaseArr[groundBeamCount] = actor.phaseOffset;
          groundBeamCount += 1;
        }

        const showMotes = !actor.dropping || actor.bouncedOnce;
        if (showMotes && orbitMoteCount + ORBIT_MOTES_PER_ORB <= MAX_ORBIT_MOTES) {
          const orbScale = Math.max(0.45, actor.scaleX);
          for (let m = 0; m < ORBIT_MOTES_PER_ORB; m += 1) {
            const speed = 1.45 + m * 0.42;
            const ang =
              this.elapsedSec * speed + actor.phaseOffset + (m * Math.PI * 2) / ORBIT_MOTES_PER_ORB;
            const rx = (0.46 + m * 0.045) * orbScale;
            const rz = (0.39 + m * 0.04) * orbScale;
            const tiltY = Math.sin(ang + m * 1.1) * (0.16 + m * 0.05) * orbScale;
            this.scratchPos.set(actor.x + Math.cos(ang) * rx, actor.y + tiltY, actor.z + Math.sin(ang) * rz);
            this.scratchEuler.set(ang * 0.6, ang * 1.4, m * 0.8);
            this.scratchQuat.setFromEuler(this.scratchEuler);
            const twinkle =
              (0.75 + 0.34 * Math.sin(this.elapsedSec * 4.2 + m * 2.1 + actor.phaseOffset)) * orbScale;
            this.scratchScale.setScalar(twinkle);
            this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
            this.orbMoteInstanced.setMatrixAt(orbitMoteCount, this.scratchMatrix);
            orbitMoteCount += 1;
          }
        }
      }
    }

    for (const done of completedOrbs) {
      const burstPos = { x: done.x, y: done.y, z: done.z };
      this.lootOrbs.delete(done.orbId);
      this.spawnOrbPickupBurst(burstPos.x, burstPos.y, burstPos.z);
      done.onCollectBurst?.(done.orbId, done.goldAmount, burstPos);
    }

    this.orbBodyInstanced.count = bodyCount;
    this.orbBodyInstanced.visible = bodyCount > 0;
    if (bodyCount > 0) {
      this.orbBodyInstanced.instanceMatrix.needsUpdate = true;
      this.orbBodyPhaseAttr.needsUpdate = true;
    }

    this.orbBaseInstanced.count = groundBeamCount;
    this.orbBaseInstanced.visible = groundBeamCount > 0;
    this.orbBeamInstanced.count = groundBeamCount;
    this.orbBeamInstanced.visible = groundBeamCount > 0;
    if (groundBeamCount > 0) {
      this.orbBaseInstanced.instanceMatrix.needsUpdate = true;
      this.orbBasePhaseAttr.needsUpdate = true;
      this.orbBeamInstanced.instanceMatrix.needsUpdate = true;
      this.orbBeamPhaseAttr.needsUpdate = true;
    }

    this.orbMoteInstanced.count = orbitMoteCount;
    this.orbMoteInstanced.visible = orbitMoteCount > 0;
    if (orbitMoteCount > 0) {
      this.orbMoteInstanced.instanceMatrix.needsUpdate = true;
    }

    let activeSparkCount = 0;
    for (const sp of this.sparkPool) {
      if (!sp.active) continue;
      sp.ageSec += dt;
      const t = sp.ageSec / sp.durationSec;
      if (t >= 1) {
        sp.active = false;
        continue;
      }
      const damp = Math.exp(-sp.drag * dt);
      sp.vx *= damp;
      sp.vz *= damp;
      sp.vy += sp.gravity * dt;
      sp.x += sp.vx * dt;
      sp.y = Math.max(0.03, sp.y + sp.vy * dt);
      sp.z += sp.vz * dt;
      sp.rotY += sp.spinSpeed * dt;
      sp.rotZ += sp.spinSpeed * 0.7 * dt;

      const fade = t < 0.16 ? t / 0.16 : 1 - (t - 0.16) / 0.84;
      const sc = Math.max(0.02, sp.baseScale * fade);
      this.scratchPos.set(sp.x, sp.y, sp.z);
      this.scratchEuler.set(0, sp.rotY, sp.rotZ);
      this.scratchQuat.setFromEuler(this.scratchEuler);
      this.scratchScale.setScalar(sc);
      this.scratchMatrix.compose(this.scratchPos, this.scratchQuat, this.scratchScale);
      this.sparkInstanced.setMatrixAt(activeSparkCount, this.scratchMatrix);
      this.sparkInstanced.setColorAt(activeSparkCount, sp.color);
      activeSparkCount += 1;
    }

    this.sparkInstanced.count = activeSparkCount;
    this.sparkInstanced.visible = activeSparkCount > 0;
    if (activeSparkCount > 0) {
      this.sparkInstanced.instanceMatrix.needsUpdate = true;
      if (this.sparkInstanced.instanceColor) {
        this.sparkInstanced.instanceColor.needsUpdate = true;
      }
    }

    for (const p of this.projectilePool) {
      if (!p.active) continue;
      p.elapsedSec += dt;
      const t = p.elapsedSec / p.durationSec;
      if (t >= 1) {
        p.active = false;
        p.group.visible = false;
        continue;
      }
      this.scratchVec.lerpVectors(p.from, p.to, t);
      this.scratchVec.y += Math.sin(t * Math.PI) * p.arcHeight;

      this.scratchDir.copy(this.scratchVec).sub(p.group.position);
      if (this.scratchDir.lengthSq() > 1e-6) {
        this.scratchDir.normalize();
        p.group.quaternion.setFromUnitVectors(this.scratchAxisZ, this.scratchDir);
      }
      p.group.position.copy(this.scratchVec);
    }

    for (const pil of this.pillarPool) {
      if (!pil.active) continue;
      pil.ageSec += dt;
      const t = pil.ageSec / pil.durationSec;
      if (t >= 1) {
        pil.active = false;
        pil.cylinder.visible = false;
        pil.collapseRing.visible = false;
        pil.shockRing.visible = false;
        continue;
      }
      const fade = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      pil.cylMat.opacity = fade * 0.82;
      pil.ringMat.opacity = fade * 0.92;

      const widthFactor = pil.star === 3 ? 1.35 * (1 - t * 0.55) : 0.95 * (1 - t * 0.45);
      pil.cylinder.scale.set(widthFactor, 1 + t * 0.35, widthFactor);
      pil.shockRing.scale.setScalar(
        0.35 + (1 - Math.pow(1 - t, 3)) * (pil.star === 3 ? 2.4 : 1.7),
      );

      if (pil.star === 3) {
        pil.collapseRing.position.y = 2.2 * (1 - t) + 0.08;
        pil.collapseRing.scale.setScalar(1.65 * (1 - t * 0.55));
      } else {
        pil.collapseRing.position.y = 0.12 + t * 1.4;
        pil.collapseRing.scale.setScalar(0.75 + t * 0.75);
      }
    }
  }

  public dispose(): void {
    this.orbBodyInstanced.dispose();
    this.orbBaseInstanced.dispose();
    this.orbBeamInstanced.dispose();
    this.orbMoteInstanced.dispose();
    this.sparkInstanced.dispose();
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.lootOrbs.clear();
  }
}
