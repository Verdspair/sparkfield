import * as THREE from 'three';
import {
  BlendFunction,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  SMAAPreset,
  SelectiveBloomEffect,
} from 'postprocessing';
import { Easing, Group as TweenGroup, Tween } from '@tweenjs/tween.js';
import {
  NullAudioAdapter,
  AudioEventBus,
  type ArenaThemeId,
  type MatchPhaseKind,
  type UnitLocation,
  type UnitStar,
} from '@pkg/contracts';
import { PbrMaterialLibrary, buildProceduralStudioEnvMap } from './pbrMaterials.js';
import { ArenaStageAssembly } from './arenaBuilder.js';
import { UnitMeshFactory, type UnitActorRig } from './unitMeshFactory.js';
import { StageVfxManager } from './vfxManager.js';
import { StageHudOverlayProjector } from './hudOverlayProjector.js';
import {
  SELL_ZONE_Z_THRESHOLD,
  benchSlotToStageXZ,
  boardRowToDeployRow,
  deployRowToBoardRow,
  getSeatWorldOrigin,
  hexToStageXZ,
  stageXZToBenchSlot,
  stageXZToHex,
} from './spring.js';
import type {
  BoardStageEngineOptions,
  DamageFloatKind,
  StageDamageEvent,
  StageInteractionCallbacks,
  StageLootOrbState,
  StagePerfStats,
  StagePickResult,
  StageProjectileSpec,
  StageQualityTier,
  StageUnitPlacement,
  StageUnitState,
  UnitScreenProjection,
} from './types.js';

const CAMERA_FOV_DEG = 28;
const CAMERA_PITCH_RAD = THREE.MathUtils.degToRad(53);
const BASE_BOARD_LOOK_Z = 0.85;
const BASE_CAMERA_DISTANCE = 27.2;
const INTRO_DIVE_DURATION_MS = 1100;
const THEME_PULSE_DURATION_MS = 640;

export class BoardStageEngine {
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera;

  private container: HTMLElement | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private selectiveBloom: SelectiveBloomEffect | null = null;
  private envRenderTarget: THREE.WebGLRenderTarget | null = null;
  private resizeObserver: ResizeObserver | null = null;

  private readonly dirKeyLight: THREE.DirectionalLight;
  private readonly dirRimLight: THREE.DirectionalLight;
  private readonly lightGuidePulseGeo: THREE.RingGeometry;
  private readonly lightGuidePulseMat: THREE.MeshBasicMaterial;
  private readonly lightGuidePulseRing: THREE.Mesh;

  private readonly materials: PbrMaterialLibrary;
  private readonly arena: ArenaStageAssembly;
  private readonly unitFactory: UnitMeshFactory;
  private readonly tweenGroup = new TweenGroup();
  private readonly vfx: StageVfxManager;
  private hudOverlay: StageHudOverlayProjector | null = null;

  private readonly unitStates = new Map<string, StageUnitState>();
  private readonly unitRigs = new Map<string, UnitActorRig>();
  private readonly unitsGroup = new THREE.Group();

  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly raycaster = new THREE.Raycaster();
  private readonly scratchNdc = new THREE.Vector2();
  private readonly scratchHit = new THREE.Vector3();
  private readonly scratchLookAt = new THREE.Vector3();

  private qualityTier: StageQualityTier;
  private showBuiltInHudOverlay: boolean;
  private interactiveDeployEnabled: boolean;
  private currentPhase: MatchPhaseKind;
  private learningOverlayActive = false;
  private loopPaused = false;
  private webglAvailable = false;

  private activeSeatIndex = 0;
  private readonly cameraLookTarget = new THREE.Vector3(0, 0, BASE_BOARD_LOOK_Z);
  private cameraDistance = BASE_CAMERA_DISTANCE;
  private introDistanceOffset = 0;
  private introPitchOffsetRad = 0;
  private introLookZOffset = 0;
  private themePulseDistanceOffset = 0;
  private activeCameraTween: Tween<{ x: number; z: number }> | null = null;
  private activeIntroTween: Tween<{
    dist: number;
    pitch: number;
    lookZ: number;
    exposure: number;
    bloom: number;
  }> | null = null;
  private activeThemePulseTween: Tween<{ progress: number }> | null = null;
  private bootDivePlayed = false;
  private readonly motionPreference =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

  private audioBus: AudioEventBus;
  private callbacks: StageInteractionCallbacks;

  private selectedInstanceId: string | null = null;
  private draggingInstanceId: string | null = null;
  private pointerDownClient: { x: number; y: number } | null = null;
  private nudgedFriendlyId: string | null = null;
  private overSellZone = false;

  private lastFrameTimestampMs = 0;
  private elapsedSec = 0;
  private smoothedFps = 60;
  private readonly frameRenderStats = { drawCalls: 0, triangles: 0 };
  private clockMs = 0;
  private disposed = false;

  private readonly boundOnPointerDown = (e: PointerEvent) => this.handlePointerDown(e);
  private readonly boundOnPointerMove = (e: PointerEvent) => this.handlePointerMove(e);
  private readonly boundOnPointerUp = (e: PointerEvent) => this.handlePointerUp(e);
  private readonly boundOnWindowResize = () => this.handleResize();
  private readonly boundOnMotionPreferenceChange = () => {
    if (!this.motionPreference?.matches) return;
    this.resetVisualTransitions();
    if (this.activeCameraTween) {
      this.activeCameraTween.stop();
      this.tweenGroup.remove(this.activeCameraTween);
      this.activeCameraTween = null;
    }
    const origin = getSeatWorldOrigin(this.activeSeatIndex);
    this.cameraLookTarget.set(origin.x, 0, origin.z + BASE_BOARD_LOOK_Z);
    this.syncCameraFromLookTarget();
    if (this.loopPaused) this.renderSingleFrame();
  };
  private readonly boundOnContextRestored = () => {
    if (this.loopPaused) this.renderSingleFrame();
  };
  private readonly boundFrameLoop = (timestampMs: number) => this.onAnimationFrame(timestampMs);

  constructor(container?: HTMLElement | null, options?: BoardStageEngineOptions) {
    this.qualityTier = options?.qualityTier ?? this.detectDefaultQualityTier();
    this.showBuiltInHudOverlay = options?.showBuiltInHudOverlay ?? true;
    this.interactiveDeployEnabled = options?.interactiveDeployEnabled ?? true;
    this.currentPhase = options?.initialPhase ?? 'strategy';
    this.callbacks = options?.callbacks ?? {};

    if (options?.audioBus) {
      this.audioBus = options.audioBus;
    } else {
      this.audioBus = new AudioEventBus();
      this.audioBus.setAdapter(NullAudioAdapter);
    }

    this.scene.background = new THREE.Color(0x0b0e15);
    this.scene.fog = new THREE.FogExp2(0x0b0e15, 0.012);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 16 / 9, 0.5, 140);
    this.syncCameraFromLookTarget();

    this.dirKeyLight = new THREE.DirectionalLight(0xfff3db, 1.65);
    this.dirKeyLight.position.set(7.5, 16.5, 9.5);
    this.dirRimLight = new THREE.DirectionalLight(0x67e8f9, 0.72);
    this.dirRimLight.position.set(-9.5, 10.0, -11.0);
    const hemiFill = new THREE.HemisphereLight(0xdbeafe, 0x161b26, 0.58);
    this.scene.add(this.dirKeyLight, this.dirRimLight, hemiFill);

    this.lightGuidePulseGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    this.lightGuidePulseGeo.rotateX(-Math.PI * 0.5);
    this.lightGuidePulseMat = new THREE.MeshBasicMaterial({
      color: 0xf0dcaa,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.lightGuidePulseRing = new THREE.Mesh(this.lightGuidePulseGeo, this.lightGuidePulseMat);
    this.lightGuidePulseRing.position.set(0, 0.032, 0);
    this.lightGuidePulseRing.visible = false;

    this.materials = new PbrMaterialLibrary();
    this.arena = new ArenaStageAssembly(
      this.materials,
      options?.initialTheme ?? 'orbital_elevator_port',
    );
    this.unitFactory = new UnitMeshFactory(this.materials);
    this.vfx = new StageVfxManager(this.materials, this.tweenGroup);

    this.scene.add(
      this.arena.root,
      this.unitFactory.groundBatchGroup,
      this.unitsGroup,
      this.vfx.root,
      this.lightGuidePulseRing,
    );

    if (container) {
      this.mount(container);
    }
  }

  private detectDefaultQualityTier(): StageQualityTier {
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      return 'balanced';
    }
    return 'high';
  }

  private computeEffectiveDpr(): number {
    const raw = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return this.qualityTier === 'balanced' ? Math.min(raw, 1.25) : Math.min(raw, 2.0);
  }

  public mount(container: HTMLElement): void {
    if (this.disposed) return;
    this.container = container;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    try {
      const renderer = new THREE.WebGLRenderer({
        powerPreference: 'high-performance',
        antialias: false,
        stencil: false,
        depth: true,
      });
      renderer.info.autoReset = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = false;

      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.inset = '0';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.addEventListener('webglcontextrestored', this.boundOnContextRestored);

      container.appendChild(renderer.domElement);
      this.renderer = renderer;
      this.webglAvailable = true;

      const env = buildProceduralStudioEnvMap(renderer);
      this.envRenderTarget = env.renderTarget;
      this.scene.environment = env.envTexture;
      this.scene.environmentIntensity = 0.88;

      const composer = new EffectComposer(renderer, {
        frameBufferType: THREE.HalfFloatType,
        multisampling: 0,
      });
      const renderPass = new RenderPass(this.scene, this.camera);
      const selectiveBloom = new SelectiveBloomEffect(this.scene, this.camera, {
        blendFunction: BlendFunction.ADD,
        luminanceThreshold: 1.15,
        luminanceSmoothing: 0.08,
        mipmapBlur: true,
        intensity: 1.1,
        radius: 0.66,
      });
      selectiveBloom.ignoreBackground = true;
      for (const obj of this.arena.bloomTargets) selectiveBloom.selection.add(obj);
      for (const obj of this.vfx.bloomTargets) selectiveBloom.selection.add(obj);
      selectiveBloom.selection.add(this.lightGuidePulseRing);
      for (const rig of this.unitRigs.values()) {
        if (rig.manaRatio >= 0.85) selectiveBloom.selection.add(rig.weaponGlowMesh);
      }

      const smaaEffect = new SMAAEffect({
        preset: this.qualityTier === 'high' ? SMAAPreset.HIGH : SMAAPreset.MEDIUM,
      });
      const compoundPass = new EffectPass(this.camera, selectiveBloom, smaaEffect);

      composer.addPass(renderPass);
      composer.addPass(compoundPass);
      this.composer = composer;
      this.selectiveBloom = selectiveBloom;
    } catch {
      this.renderer = null;
      this.composer = null;
      this.selectiveBloom = null;
      this.webglAvailable = false;
    }

    this.hudOverlay = new StageHudOverlayProjector(container, this.showBuiltInHudOverlay);

    const eventSurface = this.renderer?.domElement ?? container;
    eventSurface.addEventListener('pointerdown', this.boundOnPointerDown);
    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', this.boundOnPointerMove);
      window.addEventListener('pointerup', this.boundOnPointerUp);
      window.addEventListener('resize', this.boundOnWindowResize);
      this.motionPreference?.addEventListener('change', this.boundOnMotionPreferenceChange);
    }

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(container);
    }

    this.handleResize();
    this.setPhase(this.currentPhase);
    if (this.webglAvailable && !this.learningOverlayActive) {
      this.playBootDiveTransition();
    }
    if (!this.learningOverlayActive) {
      this.resumeLoop();
    }
  }

  private playBootDiveTransition(): void {
    if (this.bootDivePlayed || this.motionPreference?.matches) return;
    this.bootDivePlayed = true;
    if (this.activeIntroTween) {
      this.activeIntroTween.stop();
      this.tweenGroup.remove(this.activeIntroTween);
      this.activeIntroTween = null;
    }

    const startPitchOffset = THREE.MathUtils.degToRad(5.6);
    const startDistOffset = 5.4;
    const startLookZOffset = -0.42;

    this.introDistanceOffset = startDistOffset;
    this.introPitchOffsetRad = startPitchOffset;
    this.introLookZOffset = startLookZOffset;
    if (this.renderer) this.renderer.toneMappingExposure = 0.9;
    if (this.selectiveBloom) this.selectiveBloom.intensity = 0.86;
    this.arena.triggerConduitSweep();
    this.syncCameraFromLookTarget();

    const proxy = {
      dist: startDistOffset,
      pitch: startPitchOffset,
      lookZ: startLookZOffset,
      exposure: 0.9,
      bloom: 0.86,
    };

    const tw = new Tween(proxy)
      .to({ dist: 0, pitch: 0, lookZ: 0, exposure: 1.05, bloom: 1.1 }, INTRO_DIVE_DURATION_MS)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ dist, pitch, lookZ, exposure, bloom }) => {
        this.introDistanceOffset = dist;
        this.introPitchOffsetRad = pitch;
        this.introLookZOffset = lookZ;
        if (this.renderer) this.renderer.toneMappingExposure = exposure;
        if (this.selectiveBloom) this.selectiveBloom.intensity = bloom;
        this.syncCameraFromLookTarget();
      })
      .onComplete(() => {
        this.introDistanceOffset = 0;
        this.introPitchOffsetRad = 0;
        this.introLookZOffset = 0;
        if (this.renderer) this.renderer.toneMappingExposure = 1.05;
        if (this.selectiveBloom) this.selectiveBloom.intensity = 1.1;
        this.activeIntroTween = null;
        this.syncCameraFromLookTarget();
      });

    this.activeIntroTween = tw;
    this.tweenGroup.add(tw);
    tw.start(this.clockMs);
  }

  private playThemePulseTransition(): void {
    if (!this.webglAvailable || this.loopPaused || this.motionPreference?.matches) return;

    if (this.activeThemePulseTween) {
      this.activeThemePulseTween.stop();
      this.tweenGroup.remove(this.activeThemePulseTween);
      this.activeThemePulseTween = null;
    }

    const centerOrigin = getSeatWorldOrigin(this.activeSeatIndex);
    this.lightGuidePulseRing.position.set(centerOrigin.x, 0.032, centerOrigin.z);
    this.lightGuidePulseRing.scale.setScalar(0.85);
    this.lightGuidePulseMat.opacity = 0;
    this.lightGuidePulseRing.visible = true;

    const proxy = { progress: 0 };
    const tw = new Tween(proxy)
      .to({ progress: 1 }, THEME_PULSE_DURATION_MS)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ progress }) => {
        const bell = Math.sin(progress * Math.PI);
        const scale = 0.85 + progress * 9.65;
        this.lightGuidePulseRing.scale.setScalar(scale);
        this.lightGuidePulseMat.opacity = bell * 0.42;
        this.dirRimLight.intensity = 0.72 + bell * 0.44;
        this.dirKeyLight.intensity = 1.65 + bell * 0.2;
        if (this.renderer && !this.activeIntroTween) {
          this.renderer.toneMappingExposure = 1.05 + bell * 0.09;
        }
        if (this.selectiveBloom && !this.activeIntroTween) {
          this.selectiveBloom.intensity = 1.1 + bell * 0.34;
        }
        this.themePulseDistanceOffset = -bell * 0.32;
        this.syncCameraFromLookTarget();
      })
      .onComplete(() => {
        this.lightGuidePulseRing.visible = false;
        this.lightGuidePulseMat.opacity = 0;
        this.dirRimLight.intensity = 0.72;
        this.dirKeyLight.intensity = 1.65;
        if (this.renderer && !this.activeIntroTween) {
          this.renderer.toneMappingExposure = 1.05;
        }
        if (this.selectiveBloom && !this.activeIntroTween) {
          this.selectiveBloom.intensity = 1.1;
        }
        this.themePulseDistanceOffset = 0;
        this.activeThemePulseTween = null;
        this.syncCameraFromLookTarget();
      });

    this.activeThemePulseTween = tw;
    this.tweenGroup.add(tw);
    tw.start(this.clockMs);
  }

  private resetVisualTransitions(): void {
    if (this.activeIntroTween) {
      this.activeIntroTween.stop();
      this.tweenGroup.remove(this.activeIntroTween);
      this.activeIntroTween = null;
    }
    if (this.activeThemePulseTween) {
      this.activeThemePulseTween.stop();
      this.tweenGroup.remove(this.activeThemePulseTween);
      this.activeThemePulseTween = null;
    }
    this.introDistanceOffset = 0;
    this.introPitchOffsetRad = 0;
    this.introLookZOffset = 0;
    this.themePulseDistanceOffset = 0;
    this.lightGuidePulseRing.visible = false;
    this.lightGuidePulseMat.opacity = 0;
    this.dirRimLight.intensity = 0.72;
    this.dirKeyLight.intensity = 1.65;
    if (this.renderer) this.renderer.toneMappingExposure = 1.05;
    if (this.selectiveBloom) this.selectiveBloom.intensity = 1.1;
    this.syncCameraFromLookTarget();
  }

  private syncCameraFromLookTarget(): void {
    const pitch = CAMERA_PITCH_RAD + this.introPitchOffsetRad;
    const distance =
      this.cameraDistance + this.introDistanceOffset + this.themePulseDistanceOffset;
    const lookX = this.cameraLookTarget.x;
    const lookZ = this.cameraLookTarget.z + this.introLookZOffset;
    const y = Math.sin(pitch) * distance;
    const zOffset = Math.cos(pitch) * distance;
    this.camera.position.set(lookX, y, lookZ + zOffset);
    this.scratchLookAt.set(lookX, 0, lookZ);
    this.camera.lookAt(this.scratchLookAt);
    this.camera.updateMatrixWorld();
  }

  public handleResize(): void {
    const width = Math.max(1, this.container?.clientWidth || 1280);
    const height = Math.max(1, this.container?.clientHeight || 720);
    const aspect = width / height;
    const dpr = this.computeEffectiveDpr();

    this.camera.aspect = aspect;
    const targetHalfWidth = 7.95;
    const vFovRad = THREE.MathUtils.degToRad(CAMERA_FOV_DEG);
    const hFovHalfTan = Math.tan(vFovRad * 0.5) * aspect;
    const distForWidth = targetHalfWidth / Math.max(0.25, hFovHalfTan);
    this.cameraDistance = Math.max(25.2, Math.min(36.0, distForWidth));
    this.camera.updateProjectionMatrix();
    this.syncCameraFromLookTarget();

    if (this.renderer) {
      this.renderer.setPixelRatio(dpr);
      this.renderer.setSize(width, height, false);
    }
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    this.hudOverlay?.resize(width, height, dpr);

    if (this.loopPaused) {
      this.renderSingleFrame();
    }
  }

  private pauseLoop(): void {
    this.loopPaused = true;
    this.renderer?.setAnimationLoop(null);
  }

  private resumeLoop(): void {
    this.loopPaused = false;
    this.lastFrameTimestampMs = 0;
    this.renderer?.setAnimationLoop(this.boundFrameLoop);
  }

  public setLearningOverlayActive(active: boolean): void {
    if (this.learningOverlayActive === active) return;
    this.learningOverlayActive = active;
    this.arena.triggerConduitSweep();
    if (active) {
      this.resetVisualTransitions();
      this.renderSingleFrame();
      this.pauseLoop();
    } else {
      this.resumeLoop();
    }
  }

  public isLearningOverlayActive(): boolean {
    return this.learningOverlayActive;
  }

  public setCallbacks(callbacks: StageInteractionCallbacks): void {
    this.callbacks = callbacks;
  }

  public setArenaTheme(theme: ArenaThemeId): void {
    if (this.arena.getTheme() === theme) return;
    this.arena.setTheme(theme);
    this.playThemePulseTransition();
    if (this.loopPaused) this.renderSingleFrame();
  }

  public getArenaTheme(): ArenaThemeId {
    return this.arena.getTheme();
  }

  public setPhase(phase: MatchPhaseKind): void {
    const changed = this.currentPhase !== phase;
    this.currentPhase = phase;
    this.arena.setBattleGridDimmed(phase === 'battle');
    if (changed) {
      this.arena.triggerConduitSweep();
      this.audioBus.emit('onPhaseChange', { phase, roundIndex: 0 });
    }
    if (phase !== 'strategy') {
      this.cancelActiveInteraction();
    }
    if (phase === 'learning') {
      this.setLearningOverlayActive(true);
    } else if (this.learningOverlayActive && phase === 'strategy') {
      this.setLearningOverlayActive(false);
    }
  }

  public scoutSeat(seatIndex: number): void {
    const normalized = ((Math.floor(seatIndex) % 8) + 8) % 8;
    if (normalized === this.activeSeatIndex) return;
    this.activeSeatIndex = normalized;
    const origin = getSeatWorldOrigin(normalized);
    this.arena.triggerConduitSweep();

    if (this.activeCameraTween) {
      this.activeCameraTween.stop();
      this.tweenGroup.remove(this.activeCameraTween);
      this.activeCameraTween = null;
    }

    if (this.motionPreference?.matches || this.loopPaused) {
      this.cameraLookTarget.set(origin.x, 0, origin.z + BASE_BOARD_LOOK_Z);
      this.syncCameraFromLookTarget();
      if (this.loopPaused) this.renderSingleFrame();
      return;
    }

    const proxy = { x: this.cameraLookTarget.x, z: this.cameraLookTarget.z };
    const tw = new Tween(proxy)
      .to({ x: origin.x, z: origin.z + BASE_BOARD_LOOK_Z }, 300)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ x, z }) => {
        this.cameraLookTarget.set(x, 0, z);
        this.syncCameraFromLookTarget();
      })
      .onComplete(() => {
        this.activeCameraTween = null;
      });
    this.activeCameraTween = tw;
    this.tweenGroup.add(tw);
    tw.start(this.clockMs);
  }

  public returnHome(): void {
    this.scoutSeat(0);
  }

  public getActiveSeatIndex(): number {
    return this.activeSeatIndex;
  }

  public setGoldAndCharge(integerGold: number): void {
    this.arena.setIntegerGold(integerGold);
  }

  public setCryoPodEnabled(enabled: boolean): void {
    this.arena.setCryoPodEnabled(enabled);
  }

  private resolvePlacementWorldXZ(
    placement: StageUnitPlacement,
    seatIndex = 0,
  ): { x: number; z: number; boardRow: number | null } {
    const seatOrigin = getSeatWorldOrigin(seatIndex);
    if (placement.zone === 'bench') {
      const local = benchSlotToStageXZ(placement.slot);
      return { x: seatOrigin.x + local.x, z: seatOrigin.z + local.z, boardRow: null };
    }
    const boardRow =
      placement.coordSpace === 'deploy4x7'
        ? deployRowToBoardRow(placement.row)
        : placement.row;
    const local = hexToStageXZ(boardRow, placement.col);
    return { x: seatOrigin.x + local.x, z: seatOrigin.z + local.z, boardRow };
  }

  public syncUnits(units: readonly StageUnitState[]): void {
    const incomingIds = new Set(units.map((u) => u.instanceId));
    const occupiedBenchSlots = new Set<number>();

    for (const [id, rig] of this.unitRigs.entries()) {
      if (!incomingIds.has(id)) {
        this.selectiveBloom?.selection.delete(rig.weaponGlowMesh);
        this.unitsGroup.remove(rig.root);
        rig.dispose();
        this.unitRigs.delete(id);
        this.unitStates.delete(id);
      }
    }

    for (const u of units) {
      this.unitStates.set(u.instanceId, u);
      if (u.location.zone === 'bench' && (u.seatIndex ?? 0) === 0) {
        occupiedBenchSlots.add(u.location.slot);
      }

      const resolved = u.worldOverride
        ? { x: u.worldOverride.x, z: u.worldOverride.z }
        : this.resolvePlacementWorldXZ(u.location, u.seatIndex ?? 0);
      const targetY = u.worldOverride?.y ?? 0;

      let rig = this.unitRigs.get(u.instanceId);
      if (!rig) {
        rig = this.unitFactory.createUnitRig(u.instanceId, u.unitId, u.star, u.allegiance);
        rig.posSpring.snap(resolved.x, targetY, resolved.z);
        rig.root.position.set(resolved.x, targetY, resolved.z);
        this.unitsGroup.add(rig.root);
        this.unitRigs.set(u.instanceId, rig);
      } else {
        if (rig.star !== u.star) rig.applyStarTier(u.star);
        if (rig.allegiance !== u.allegiance) rig.applyAllegiance(u.allegiance);
        if (this.draggingInstanceId !== u.instanceId) {
          rig.posSpring.setTarget(resolved.x, targetY, resolved.z);
        }
      }

      if (typeof u.facingRad === 'number') {
        rig.root.rotation.y = u.facingRad;
      } else if (u.allegiance === 'ally' && this.currentPhase !== 'battle') {
        rig.root.rotation.y = 0;
      } else if (u.allegiance === 'enemy' && this.currentPhase !== 'battle') {
        rig.root.rotation.y = 0;
      }

      const manaRatio = u.maxMana > 0 ? u.mana / u.maxMana : 0;
      const shouldBloomWeapon = rig.setManaRatio(manaRatio);
      if (this.selectiveBloom) {
        if (shouldBloomWeapon) this.selectiveBloom.selection.add(rig.weaponGlowMesh);
        else this.selectiveBloom.selection.delete(rig.weaponGlowMesh);
      }
    }

    this.arena.setBenchOccupancy(occupiedBenchSlots);
    this.unitFactory.syncGroundBatches(this.unitRigs.values());
  }

  public syncLootOrbs(orbs: readonly StageLootOrbState[]): void {
    const newBloom = this.vfx.syncLootOrbs(orbs);
    if (this.selectiveBloom) {
      for (const m of newBloom) this.selectiveBloom.selection.add(m);
    }
  }

  public collectLootOrb(orbId: string): boolean {
    return this.vfx.collectLootOrb(orbId, (id, gold) => {
      this.callbacks.onCollectLootOrb?.(id, gold);
    });
  }

  public collectAllLootOrbs(): void {
    this.vfx.collectAllLootOrbs((id, gold) => {
      this.callbacks.onCollectLootOrb?.(id, gold);
    });
  }

  public playStarUpConvergence(instanceId: string, newStar: 2 | 3): void {
    const rig = this.unitRigs.get(instanceId);
    const state = this.unitStates.get(instanceId);
    const targetXZ = rig
      ? { x: rig.root.position.x, z: rig.root.position.z }
      : { x: 0, z: 0 };

    if (state) {
      this.audioBus.emit('onUnitStarUp', { unitId: state.unitId, newStar });
    }

    this.vfx.playStarUpConvergence(targetXZ, newStar, () => {
      rig?.applyStarTier(newStar);
      if (state) {
        this.unitStates.set(instanceId, { ...state, star: newStar as UnitStar });
      }
    });
  }

  public triggerUnitHit(instanceId: string, dirX = 0, dirZ = 1): void {
    this.unitRigs.get(instanceId)?.triggerHit(dirX, dirZ);
  }

  public playUnitAttack(
    instanceId: string,
    targetInstanceIdOrPos?: string | { x: number; y?: number; z: number },
    projectileKind?: DamageFloatKind,
  ): void {
    const attacker = this.unitRigs.get(instanceId);
    if (!attacker) return;
    const targetPos = this.resolveTargetWorldPos(targetInstanceIdOrPos);
    attacker.playAction('attack', targetPos ?? undefined);

    if (targetPos && attacker.unitDef.stats.range > 1) {
      this.vfx.spawnProjectile(
        {
          x: attacker.root.position.x,
          y: attacker.root.position.y + 0.72,
          z: attacker.root.position.z,
        },
        targetPos,
        projectileKind ?? 'physical',
      );
    }
  }

  public playUnitSkillCast(
    instanceId: string,
    targetInstanceIdOrPos?: string | { x: number; y?: number; z: number },
  ): void {
    const caster = this.unitRigs.get(instanceId);
    if (!caster) return;
    const targetPos = this.resolveTargetWorldPos(targetInstanceIdOrPos);
    caster.playAction('cast', targetPos ?? undefined);
    this.audioBus.emit('onSkillCast', { unitId: caster.unitId, casterInstanceId: instanceId });

    if (targetPos) {
      this.vfx.spawnProjectile(
        {
          x: caster.root.position.x,
          y: caster.root.position.y + 0.88,
          z: caster.root.position.z,
        },
        targetPos,
        'magic',
        12,
        0.72,
      );
    }
  }

  public spawnProjectile(spec: StageProjectileSpec): void {
    const from =
      spec.fromWorld ??
      this.resolveTargetWorldPos(spec.fromInstanceId) ?? { x: 0, y: 0.75, z: 2 };
    const to =
      spec.toWorld ??
      this.resolveTargetWorldPos(spec.toInstanceId) ?? { x: 0, y: 0.75, z: -2 };
    this.vfx.spawnProjectile(
      from,
      to,
      spec.damageKind ?? 'magic',
      spec.speedUnitsPerSec ?? 14,
      spec.arcHeight ?? 0.42,
    );
  }

  public spawnDamageNumber(event: StageDamageEvent): void {
    this.hudOverlay?.spawnDamageFloat(event, this.unitRigs);
  }

  private resolveTargetWorldPos(
    ref?: string | { x: number; y?: number; z: number },
  ): { x: number; y: number; z: number } | null {
    if (!ref) return null;
    if (typeof ref === 'string') {
      const rig = this.unitRigs.get(ref);
      if (!rig) return null;
      return {
        x: rig.root.position.x,
        y: rig.root.position.y + 0.72,
        z: rig.root.position.z,
      };
    }
    return { x: ref.x, y: ref.y ?? 0.72, z: ref.z };
  }

  public pickAtNdc(ndcX: number, ndcY: number): StagePickResult {
    this.scratchNdc.set(ndcX, ndcY);
    this.raycaster.setFromCamera(this.scratchNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.scratchHit);
    const wx = hit ? hit.x : 0;
    const wz = hit ? hit.z : 0;

    const orb = this.vfx.findLootOrbNear(wx, wz);
    if (orb) {
      return {
        kind: 'loot_orb',
        orbId: orb.orbId,
        goldAmount: orb.goldAmount,
        worldX: wx,
        worldZ: wz,
      };
    }

    const origin = getSeatWorldOrigin(this.activeSeatIndex);
    const localX = wx - origin.x;
    const localZ = wz - origin.z;

    if (localZ >= SELL_ZONE_Z_THRESHOLD) {
      return { kind: 'sell_zone', worldX: wx, worldZ: wz };
    }

    const benchSlot = stageXZToBenchSlot(localX, localZ);
    if (benchSlot !== null) {
      const occupant = this.findViewedUnitAtBench(benchSlot);
      return {
        kind: 'bench_slot',
        slot: benchSlot,
        worldX: wx,
        worldZ: wz,
        unitInstanceId: occupant,
      };
    }

    const hex = stageXZToHex(localX, localZ);
    if (hex) {
      const occupant = this.findViewedUnitAtBoardHex(hex.row, hex.col);
      return {
        kind: 'board_hex',
        row: hex.row,
        col: hex.col,
        deployRow: boardRowToDeployRow(hex.row),
        worldX: wx,
        worldZ: wz,
        unitInstanceId: occupant,
      };
    }

    return { kind: 'deck_ground', worldX: wx, worldZ: wz };
  }

  public pickAtClientPoint(clientX: number, clientY: number): StagePickResult | null {
    const surface = this.renderer?.domElement ?? this.container;
    if (!surface) return null;
    const rect = surface.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this.pickAtNdc(ndcX, ndcY);
  }

  private findViewedUnitAtBoardHex(boardRow: number, col: number): string | null {
    for (const [id, st] of this.unitStates.entries()) {
      if ((st.seatIndex ?? 0) !== this.activeSeatIndex || st.location.zone !== 'board') continue;
      const r =
        st.location.coordSpace === 'deploy4x7'
          ? deployRowToBoardRow(st.location.row)
          : st.location.row;
      if (r === boardRow && st.location.col === col) return id;
    }
    return null;
  }

  private findViewedUnitAtBench(slot: number): string | null {
    for (const [id, st] of this.unitStates.entries()) {
      if ((st.seatIndex ?? 0) !== this.activeSeatIndex || st.location.zone !== 'bench') continue;
      if (st.location.slot === slot) return id;
    }
    return null;
  }

  private canControlUnitsNow(): boolean {
    return (
      this.interactiveDeployEnabled &&
      this.currentPhase === 'strategy' &&
      this.activeSeatIndex === 0 &&
      !this.learningOverlayActive
    );
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    const pick = this.pickAtClientPoint(e.clientX, e.clientY);
    if (!pick) return;

    this.pointerDownClient = { x: e.clientX, y: e.clientY };

    if (pick.kind === 'loot_orb') {
      this.collectLootOrb(pick.orbId);
      return;
    }

    const pickedUnitId =
      pick.kind === 'board_hex' || pick.kind === 'bench_slot' ? pick.unitInstanceId : null;

    if (this.selectedInstanceId && this.canControlUnitsNow()) {
      if (pickedUnitId === this.selectedInstanceId) {
        this.startDraggingUnit(this.selectedInstanceId);
        return;
      }
      if (pick.kind === 'board_hex' && pick.deployRow !== null) {
        this.emitUnifiedMove(
          this.selectedInstanceId,
          { zone: 'board', row: pick.deployRow, col: pick.col },
          { row: pick.row, col: pick.col },
        );
        this.clearSelectionAndHelpers();
        return;
      }
      if (pick.kind === 'bench_slot') {
        this.emitUnifiedMove(this.selectedInstanceId, { zone: 'bench', slot: pick.slot }, null);
        this.clearSelectionAndHelpers();
        return;
      }
    }

    if (pickedUnitId) {
      const st = this.unitStates.get(pickedUnitId);
      this.callbacks.onInspectUnit?.(pickedUnitId, { x: e.clientX, y: e.clientY });
      if (st && st.allegiance === 'ally' && this.canControlUnitsNow()) {
        this.selectedInstanceId = pickedUnitId;
        this.startDraggingUnit(pickedUnitId);
      }
      return;
    }

    this.clearSelectionAndHelpers();
    this.callbacks.onInspectUnit?.(null);
    this.vfx.spawnGroundClickRipple(pick.worldX, pick.worldZ);
  }

  private startDraggingUnit(instanceId: string): void {
    this.draggingInstanceId = instanceId;
    const rig = this.unitRigs.get(instanceId);
    const st = this.unitStates.get(instanceId);
    if (rig && st) {
      rig.scaleSpring.setTarget(rig.scaleSpring.target * 1.08);
      if (st.location.zone === 'board') {
        const bRow =
          st.location.coordSpace === 'deploy4x7'
            ? deployRowToBoardRow(st.location.row)
            : st.location.row;
        this.arena.setRangeHighlight({ row: bRow, col: st.location.col }, rig.unitDef.stats.range);
      }
    }
    this.callbacks.onDragStateChange?.(instanceId, false);
  }

  private handlePointerMove(e: PointerEvent): void {
    if (this.loopPaused || !this.container) return;
    const pick = this.pickAtClientPoint(e.clientX, e.clientY);
    if (!pick) return;

    if (pick.kind === 'board_hex') {
      this.arena.setHoveredHex({ row: pick.row, col: pick.col });
    } else {
      this.arena.setHoveredHex(null);
    }

    if (!this.draggingInstanceId) return;

    const dragRig = this.unitRigs.get(this.draggingInstanceId);
    const dragState = this.unitStates.get(this.draggingInstanceId);
    if (!dragRig || !dragState) return;

    dragRig.posSpring.setTarget(pick.worldX, 0.32, pick.worldZ);

    const nextOverSell = pick.kind === 'sell_zone';
    if (nextOverSell !== this.overSellZone) {
      this.overSellZone = nextOverSell;
      this.callbacks.onDragStateChange?.(this.draggingInstanceId, nextOverSell);
    }

    if (pick.kind === 'board_hex' && pick.deployRow !== null) {
      this.arena.setRangeHighlight({ row: pick.row, col: pick.col }, dragRig.unitDef.stats.range);

      if (pick.unitInstanceId && pick.unitInstanceId !== this.draggingInstanceId) {
        const originXZ = this.resolvePlacementWorldXZ(dragState.location, 0);
        const targetXZ = hexToStageXZ(pick.row, pick.col);
        this.arena.setFriendlySwapArc(originXZ, targetXZ);
        this.setNudgedFriendly(pick.unitInstanceId);
      } else {
        this.arena.setFriendlySwapArc(null, null);
        this.setNudgedFriendly(null);
      }
    } else {
      this.arena.setFriendlySwapArc(null, null);
      this.setNudgedFriendly(null);
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.draggingInstanceId) return;
    const instanceId = this.draggingInstanceId;
    const dragDist = this.pointerDownClient
      ? Math.hypot(e.clientX - this.pointerDownClient.x, e.clientY - this.pointerDownClient.y)
      : 999;

    const pick = this.pickAtClientPoint(e.clientX, e.clientY);
    this.draggingInstanceId = null;
    this.overSellZone = false;
    this.callbacks.onDragStateChange?.(null, false);
    this.setNudgedFriendly(null);
    this.arena.setFriendlySwapArc(null, null);

    const st = this.unitStates.get(instanceId);
    const rig = this.unitRigs.get(instanceId);
    if (st && rig) {
      const authXZ = this.resolvePlacementWorldXZ(st.location, st.seatIndex ?? 0);
      rig.posSpring.setTarget(authXZ.x, 0, authXZ.z);
      rig.applyStarTier(st.star);
    }

    if (dragDist < 6) {
      this.selectedInstanceId = instanceId;
      return;
    }

    if (pick && this.canControlUnitsNow()) {
      if (pick.kind === 'sell_zone') {
        this.callbacks.onSellUnitRequest?.(instanceId);
      } else if (pick.kind === 'board_hex' && pick.deployRow !== null) {
        this.emitUnifiedMove(
          instanceId,
          { zone: 'board', row: pick.deployRow, col: pick.col },
          { row: pick.row, col: pick.col },
        );
      } else if (pick.kind === 'bench_slot') {
        this.emitUnifiedMove(instanceId, { zone: 'bench', slot: pick.slot }, null);
      }
    }

    this.clearSelectionAndHelpers();
  }

  private setNudgedFriendly(friendlyId: string | null): void {
    if (this.nudgedFriendlyId === friendlyId) return;
    if (this.nudgedFriendlyId) {
      this.unitRigs.get(this.nudgedFriendlyId)?.nudgeOffsetX.setTarget(0);
    }
    this.nudgedFriendlyId = friendlyId;
    if (friendlyId) {
      this.unitRigs.get(friendlyId)?.nudgeOffsetX.setTarget(0.20);
    }
  }

  private emitUnifiedMove(
    instanceId: string,
    to: UnitLocation,
    resolvedBoardHex: { row: number; col: number } | null,
  ): void {
    this.callbacks.onMoveUnit?.(instanceId, to, resolvedBoardHex);
  }

  private clearSelectionAndHelpers(): void {
    this.selectedInstanceId = null;
    this.arena.setRangeHighlight(null, null);
    this.arena.setFriendlySwapArc(null, null);
    this.setNudgedFriendly(null);
  }

  public cancelActiveInteraction(): void {
    if (this.draggingInstanceId) {
      const st = this.unitStates.get(this.draggingInstanceId);
      const rig = this.unitRigs.get(this.draggingInstanceId);
      if (st && rig) {
        const auth = this.resolvePlacementWorldXZ(st.location, st.seatIndex ?? 0);
        rig.posSpring.setTarget(auth.x, 0, auth.z);
        rig.applyStarTier(st.star);
      }
      this.draggingInstanceId = null;
      this.overSellZone = false;
      this.callbacks.onDragStateChange?.(null, false);
    }
    this.clearSelectionAndHelpers();
  }

  private onAnimationFrame(timestampMs: number): void {
    if (this.disposed || this.loopPaused) return;
    const rawDt =
      this.lastFrameTimestampMs > 0 ? (timestampMs - this.lastFrameTimestampMs) / 1000 : 1 / 60;
    this.lastFrameTimestampMs = timestampMs;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    if (rawDt > 0.0005) {
      const instantFps = 1 / rawDt;
      this.smoothedFps = this.smoothedFps * 0.9 + instantFps * 0.1;
    }

    this.stepSimulation(dt);
    this.renderFrameInternal(dt);
  }

  public stepManual(dtSeconds: number): void {
    this.stepSimulation(dtSeconds);
    this.hudOverlay?.updateAndRender(dtSeconds, this.camera, this.unitStates, this.unitRigs);
  }

  private stepSimulation(dt: number): void {
    this.elapsedSec += dt;
    this.clockMs += dt * 1000;
    this.tweenGroup.update(this.clockMs);
    this.arena.update(dt);
    for (const rig of this.unitRigs.values()) {
      rig.update(dt, this.elapsedSec);
    }
    this.unitFactory.syncGroundBatches(this.unitRigs.values());
    this.vfx.update(dt);
  }

  private renderFrameInternal(dt: number): void {
    this.renderer?.info.reset();
    if (this.composer && this.renderer) {
      this.composer.render(dt);
    } else if (this.renderer) {
      this.renderer.render(this.scene, this.camera);
    }
    const renderInfo = this.renderer?.info.render;
    this.frameRenderStats.drawCalls = renderInfo?.calls ?? 0;
    this.frameRenderStats.triangles = renderInfo?.triangles ?? 0;
    this.hudOverlay?.updateAndRender(dt, this.camera, this.unitStates, this.unitRigs);
  }

  public renderSingleFrame(): void {
    if (this.disposed) return;
    this.renderFrameInternal(1 / 60);
  }

  public getUnitScreenProjections(): readonly UnitScreenProjection[] {
    return this.hudOverlay?.getProjections() ?? [];
  }

  public getPerfStats(): StagePerfStats {
    const info = this.renderer?.info;
    return {
      drawCalls: this.frameRenderStats.drawCalls,
      triangles: this.frameRenderStats.triangles,
      textures: info?.memory.textures ?? 0,
      geometries: info?.memory.geometries ?? 0,
      loopPaused: this.loopPaused,
      webglAvailable: this.webglAvailable,
      fpsEstimate: Math.round(this.smoothedFps),
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.pauseLoop();
    this.tweenGroup.removeAll();
    this.resizeObserver?.disconnect();

    const eventSurface = this.renderer?.domElement ?? this.container;
    eventSurface?.removeEventListener('pointerdown', this.boundOnPointerDown);
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointermove', this.boundOnPointerMove);
      window.removeEventListener('pointerup', this.boundOnPointerUp);
      window.removeEventListener('resize', this.boundOnWindowResize);
      this.motionPreference?.removeEventListener('change', this.boundOnMotionPreferenceChange);
    }

    if (this.renderer) {
      this.renderer.domElement.removeEventListener(
        'webglcontextrestored',
        this.boundOnContextRestored,
      );
      if (this.renderer.domElement.parentElement) {
        this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
      }
    }

    this.hudOverlay?.dispose();
    for (const rig of this.unitRigs.values()) rig.dispose();
    this.unitRigs.clear();
    this.unitStates.clear();

    this.lightGuidePulseGeo.dispose();
    this.lightGuidePulseMat.dispose();
    this.unitFactory.dispose();
    this.vfx.dispose();
    this.arena.dispose();
    this.materials.dispose();
    this.envRenderTarget?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
  }
}
