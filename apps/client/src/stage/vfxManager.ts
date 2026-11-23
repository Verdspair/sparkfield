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

interface LootOrbActor {
  readonly orbId: string;
  goldAmount: number;
  readonly group: THREE.Group;
  readonly coinGroup: THREE.Group;
  readonly shellMesh: THREE.Mesh;
  readonly beamMesh: THREE.Mesh;
  readonly haloRingA: THREE.Mesh;
  readonly baseHalo: THREE.Mesh;
  readonly labelSprite: THREE.Sprite;
  collecting: boolean;
}

function createLootOrbShellMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uCoreColor: { value: new THREE.Color(0xfff4c2) },
      uRimColor: { value: new THREE.Color(0xf2c97d) },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uCoreColor;
      uniform vec3 uRimColor;
      varying vec3 vNormalView;
      varying vec3 vViewDir;
      void main() {
        float ndv = clamp(abs(dot(normalize(vNormalView), normalize(vViewDir))), 0.0, 1.0);
        float fresnel = pow(1.0 - ndv, 2.1);
        vec3 col = mix(uCoreColor, uRimColor, fresnel);
        float alpha = 0.14 + fresnel * 0.64;
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
      uColor: { value: new THREE.Color(0xf6c96a) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float verticalFade = smoothstep(0.0, 0.14, vUv.y) * pow(1.0 - vUv.y, 1.85);
        gl_FragColor = vec4(uColor, verticalFade * 0.34);
      }
    `,
  });
}

function createGoldTagTexture(goldAmount: number): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const x = 10;
  const y = 10;
  const w = 140;
  const h = 44;
  const r = 22;

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, 'rgba(18, 28, 52, 0.92)');
  grad.addColorStop(1, 'rgba(9, 15, 30, 0.96)');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(246, 206, 122, 0.92)';
  ctx.stroke();

  const coinGrad = ctx.createRadialGradient(34, 29, 2, 36, 32, 11);
  coinGrad.addColorStop(0, '#fff7d6');
  coinGrad.addColorStop(0.55, '#f2c97d');
  coinGrad.addColorStop(1, '#b47d2a');
  ctx.beginPath();
  ctx.arc(36, 32, 10, 0, Math.PI * 2);
  ctx.fillStyle = coinGrad;
  ctx.fill();

  ctx.fillStyle = '#fff3c4';
  ctx.font = '800 25px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`+${goldAmount}G`, 54, 33);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const RIPPLE_POOL_SIZE = 8;
const PROJECTILE_POOL_SIZE = 24;
const PILLAR_POOL_SIZE = 4;
const RIPPLE_DURATION_SEC = 0.45;

export class StageVfxManager {
  public readonly root = new THREE.Group();
  public readonly bloomTargets: THREE.Object3D[] = [];

  private readonly materials: PbrMaterialLibrary;
  private readonly tweenGroup: TweenGroup;

  private readonly ripplePool: RippleSlot[] = [];
  private readonly projectilePool: ProjectileSlot[] = [];
  private readonly pillarPool: PillarSlot[] = [];
  private readonly lootOrbs = new Map<string, LootOrbActor>();

  private readonly orbShellGeo = new THREE.SphereGeometry(0.33, 28, 20);
  private readonly orbCoinGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.048, 32);
  private readonly orbCoinEmblemGeo = new THREE.OctahedronGeometry(0.085, 0);
  private readonly orbRingGeo = new THREE.TorusGeometry(0.37, 0.014, 12, 40);
  private readonly orbBeamGeo = new THREE.CylinderGeometry(0.24, 0.34, 1.45, 24, 1, true);
  private readonly orbBaseGeo = new THREE.RingGeometry(0.29, 0.43, 36);
  private readonly moteGeo = new THREE.OctahedronGeometry(0.18, 0);
  private readonly orbShellMat: THREE.ShaderMaterial;
  private readonly orbBeamMat: THREE.ShaderMaterial;
  private readonly orbCoinMat: THREE.MeshStandardMaterial;
  private readonly orbCoinGlowMat: THREE.MeshStandardMaterial;
  private readonly orbBaseMat: THREE.MeshBasicMaterial;
  private readonly goldTagMaterials = new Map<number, THREE.SpriteMaterial>();
  private readonly ownedTextures: THREE.Texture[] = [];

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];
  private elapsedSec = 0;

  constructor(materials: PbrMaterialLibrary, tweenGroup: TweenGroup) {
    this.materials = materials;
    this.tweenGroup = tweenGroup;

    this.orbCoinGeo.rotateX(Math.PI * 0.5);
    this.orbCoinEmblemGeo.scale(1, 1, 0.42);
    this.orbRingGeo.rotateX(Math.PI * 0.5);
    this.orbBeamGeo.translate(0, 0.36, 0);
    this.orbBaseGeo.rotateX(-Math.PI * 0.5);
    this.ownedGeometries.push(
      this.orbShellGeo,
      this.orbCoinGeo,
      this.orbCoinEmblemGeo,
      this.orbRingGeo,
      this.orbBeamGeo,
      this.orbBaseGeo,
      this.moteGeo,
    );

    this.orbShellMat = createLootOrbShellMaterial();
    this.orbBeamMat = createLootOrbBeamMaterial();
    this.orbCoinMat = new THREE.MeshStandardMaterial({
      color: 0xf7cf74,
      emissive: 0xd99b26,
      emissiveIntensity: 0.42,
      metalness: 0.84,
      roughness: 0.24,
    });
    this.orbCoinGlowMat = materials.createBloomEmissiveMaterial(0xfff0b3, 1.05);
    this.orbBaseMat = new THREE.MeshBasicMaterial({
      color: 0xf6cf74,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.ownedMaterials.push(
      this.orbShellMat,
      this.orbBeamMat,
      this.orbCoinMat,
      this.orbBaseMat,
    );

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

  public spawnGroundClickRipple(worldX: number, worldZ: number): void {
    const slot = this.ripplePool.find((r) => !r.active) ?? this.ripplePool[0]!;
    slot.active = true;
    slot.ageSec = 0;
    slot.outerRing.position.set(worldX, 0.022, worldZ);
    slot.innerRing.position.set(worldX, 0.020, worldZ);
    slot.outerRing.scale.setScalar(0.18);
    slot.innerRing.scale.setScalar(0.12);
    slot.outerRing.visible = true;
    slot.innerRing.visible = true;
  }

  public syncLootOrbs(orbs: readonly StageLootOrbState[]): THREE.Object3D[] {
    const incomingIds = new Set(orbs.map((o) => o.orbId));
    const newBloomMeshes: THREE.Object3D[] = [];

    for (const [id, actor] of this.lootOrbs.entries()) {
      if (!incomingIds.has(id) && !actor.collecting) {
        this.root.remove(actor.group);
        this.lootOrbs.delete(id);
      }
    }

    for (const orb of orbs) {
      const amount = Math.max(1, Math.floor(orb.goldAmount));
      const existing = this.lootOrbs.get(orb.orbId);
      const { x, z } = hexToStageXZ(orb.row, orb.col);
      if (existing) {
        if (existing.goldAmount !== amount) {
          existing.goldAmount = amount;
          existing.labelSprite.material = this.getGoldTagMaterial(amount);
        }
        if (!existing.collecting) {
          existing.group.position.set(x, 0.44, z);
        }
        continue;
      }

      const group = new THREE.Group();
      group.position.set(x, 0.44, z);

      const coinGroup = new THREE.Group();
      const coinDisc = new THREE.Mesh(this.orbCoinGeo, this.orbCoinMat);
      const coinEmblem = new THREE.Mesh(this.orbCoinEmblemGeo, this.orbCoinGlowMat);
      coinGroup.add(coinDisc, coinEmblem);

      const shellMesh = new THREE.Mesh(this.orbShellGeo, this.orbShellMat);
      const beamMesh = new THREE.Mesh(this.orbBeamGeo, this.orbBeamMat);
      beamMesh.position.set(0, -0.36, 0);
      const haloRingA = new THREE.Mesh(this.orbRingGeo, this.materials.brushedGoldMat);
      haloRingA.rotation.set(0.32, 0, 0.18);
      const baseHalo = new THREE.Mesh(this.orbBaseGeo, this.orbBaseMat);
      baseHalo.position.set(0, -0.41, 0);

      const labelSprite = new THREE.Sprite(this.getGoldTagMaterial(amount));
      labelSprite.position.set(0, 0.72, 0);
      labelSprite.scale.set(0.88, 0.35, 1);

      const scaleBoost = 1 + Math.min(3, Math.max(0, amount - 1)) * 0.1;
      group.scale.setScalar(scaleBoost);
      group.add(coinGroup, shellMesh, beamMesh, haloRingA, baseHalo, labelSprite);
      this.root.add(group);

      newBloomMeshes.push(coinEmblem);
      this.lootOrbs.set(orb.orbId, {
        orbId: orb.orbId,
        goldAmount: amount,
        group,
        coinGroup,
        shellMesh,
        beamMesh,
        haloRingA,
        baseHalo,
        labelSprite,
        collecting: false,
      });
    }

    return newBloomMeshes;
  }

  public getLootOrbWorldPos(orbId: string): { x: number; z: number } | null {
    const actor = this.lootOrbs.get(orbId);
    if (!actor) return null;
    return { x: actor.group.position.x, z: actor.group.position.z };
  }

  public findLootOrbNear(worldX: number, worldZ: number, radius = 0.72): LootOrbActor | null {
    for (const actor of this.lootOrbs.values()) {
      if (actor.collecting) continue;
      const dx = actor.group.position.x - worldX;
      const dz = actor.group.position.z - worldZ;
      if (dx * dx + dz * dz <= radius * radius) {
        return actor;
      }
    }
    return null;
  }

  public collectLootOrb(
    orbId: string,
    onArrived?: (orbId: string, goldAmount: number) => void,
    targetWorld?: { x: number; y: number; z: number },
  ): boolean {
    const actor = this.lootOrbs.get(orbId);
    if (!actor || actor.collecting) return false;
    actor.collecting = true;

    const startX = actor.group.position.x;
    const startY = actor.group.position.y;
    const startZ = actor.group.position.z;
    const targetX = targetWorld?.x ?? -5.6;
    const targetY = targetWorld?.y ?? 0.65;
    const targetZ = targetWorld?.z ?? 5.4;

    const state = { t: 0 };
    const tw = new Tween(state)
      .to({ t: 1 }, 420)
      .easing(Easing.Cubic.InOut)
      .onUpdate(({ t }) => {
        const arcY = Math.sin(t * Math.PI) * 1.65;
        actor.group.position.set(
          startX + (targetX - startX) * t,
          startY + (targetY - startY) * t + arcY,
          startZ + (targetZ - startZ) * t,
        );
        actor.group.scale.setScalar(Math.max(0.15, 1 - t * 0.75));
      })
      .onComplete(() => {
        this.root.remove(actor.group);
        this.lootOrbs.delete(orbId);
        onArrived?.(orbId, actor.goldAmount);
      });
    this.tweenGroup.add(tw);
    tw.start();
    return true;
  }

  public collectAllLootOrbs(
    onArrived?: (orbId: string, goldAmount: number) => void,
    targetWorld?: { x: number; y: number; z: number },
  ): void {
    for (const id of [...this.lootOrbs.keys()]) {
      this.collectLootOrb(id, onArrived, targetWorld);
    }
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
      r.outerRing.scale.setScalar(0.18 + easeOut * 0.92);
      r.innerRing.scale.setScalar(0.12 + easeOut * 0.68);
      r.outerMat.opacity = (1 - t) * 0.88;
      r.innerMat.opacity = (1 - t) * 0.62;
    }

    for (const actor of this.lootOrbs.values()) {
      actor.coinGroup.rotation.y = this.elapsedSec * 2.2;
      actor.haloRingA.rotation.y = this.elapsedSec * 1.1;
      actor.haloRingA.rotation.z = Math.sin(this.elapsedSec * 1.6) * 0.24;
      if (!actor.collecting) {
        const hover = Math.sin(this.elapsedSec * 3.0) * 0.06;
        actor.group.position.y = 0.44 + hover;
        actor.baseHalo.position.y = -0.41 - hover;
        actor.beamMesh.position.y = -0.36 - hover;
        actor.baseHalo.scale.setScalar(0.94 + Math.sin(this.elapsedSec * 3.0) * 0.1);
      }
    }

    const nextPos = new THREE.Vector3();
    for (const p of this.projectilePool) {
      if (!p.active) continue;
      p.elapsedSec += dt;
      const t = p.elapsedSec / p.durationSec;
      if (t >= 1) {
        p.active = false;
        p.group.visible = false;
        continue;
      }
      nextPos.lerpVectors(p.from, p.to, t);
      nextPos.y += Math.sin(t * Math.PI) * p.arcHeight;

      const dir = nextPos.clone().sub(p.group.position);
      if (dir.lengthSq() > 1e-6) {
        dir.normalize();
        p.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      }
      p.group.position.copy(nextPos);
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
      pil.shockRing.scale.setScalar(0.35 + (1 - Math.pow(1 - t, 3)) * (pil.star === 3 ? 2.4 : 1.7));

      if (pil.star === 3) {
        pil.collapseRing.position.y = 2.2 * (1 - t) + 0.08;
        pil.collapseRing.scale.setScalar(1.65 * (1 - t * 0.55));
      } else {
        pil.collapseRing.position.y = 0.12 + t * 1.4;
        pil.collapseRing.scale.setScalar(0.75 + t * 0.75);
      }
    }
  }

  private getGoldTagMaterial(goldAmount: number): THREE.SpriteMaterial {
    const existing = this.goldTagMaterials.get(goldAmount);
    if (existing) return existing;
    const texture = createGoldTagTexture(goldAmount);
    if (texture) this.ownedTextures.push(texture);
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.goldTagMaterials.set(goldAmount, mat);
    this.ownedMaterials.push(mat);
    return mat;
  }

  public dispose(): void {
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    for (const t of this.ownedTextures) t.dispose();
    this.goldTagMaterials.clear();
    this.lootOrbs.clear();
  }
}
