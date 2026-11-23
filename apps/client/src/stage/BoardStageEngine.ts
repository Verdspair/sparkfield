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
import { ArenaStageAssembly, getArenaThemeLightingPreset } from './arenaBuilder.js';
import { LobbyStageAssembly } from './lobbyStageBuilder.js';
import {
  DEFAULT_TACTICIAN_ID,
  createTacticianRig,
  type TacticianRig,
} from './tacticianMeshFactory.js';
import { UnitMeshFactory, type UnitActorRig } from './unitMeshFactory.js';
import { StageVfxManager } from './vfxManager.js';
import { StageHudOverlayProjector } from './hudOverlayProjector.js';
import { attachPortraitBakerRenderer } from './unitPortraitBaker.js';
import {
  SELL_ZONE_Z_THRESHOLD,
  SpringDamper3D,
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
  ShopCameraLayout,
  StageDamageEvent,
  StageInteractionCallbacks,
  StageLootOrbState,
  StagePerfStats,
  StagePickResult,
  StageProjectileSpec,
  StageQualityTier,
  StageSceneMode,
  StageUnitPlacement,
  StageUnitState,
  TacticianEmoteKind,
  TacticianId,
  UnitScreenProjection,
} from './types.js';

const CAMERA_FOV_DEG = 34;
const HALF_FOV_TAN = Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV_DEG * 0.5));
const BOTTOM_OPEN_PITCH_RAD = THREE.MathUtils.degToRad(46);
const BOTTOM_OPEN_LOOK_Z = 2.35;
const TOP_COLLAPSED_PITCH_RAD = THREE.MathUtils.degToRad(44);
const TOP_COLLAPSED_LOOK_Z = 0.85;
const CAMERA_LAYOUT_TRANSITION_MS = 420;
const INTRO_DIVE_DURATION_MS = 1100;
const THEME_PULSE_DURATION_MS = 640;
const BASE_BLOOM_INTENSITY = 0.36;
const BASE_EXPOSURE = 0.98;
const SUBPAGE_EXPOSURE = 0.66;
const SUBPAGE_FRAME_INTERVAL_MS = 50;
const MATCH_TACTICIAN_HOME = { x: -5.85, y: 0.08, z: 5.35 } as const;
const TACTICIAN_RUN_SPEED = 7.4;
const TACTICIAN_ORB_MAGNET_RADIUS = 0.95;
const TACTICIAN_DECK_X_LIMIT = 6.95;
const TACTICIAN_DECK_Z_MIN = -5.75;
const TACTICIAN_DECK_Z_MAX = 6.95;

function computeMatchCameraMetrics(
  layout: ShopCameraLayout,
  aspect: number,
): { pitchRad: number; lookZ: number; distance: number } {
  const safeAspect = Math.max(0.6, aspect);
  if (layout === 'bottom_open') {
    return {
      pitchRad: BOTTOM_OPEN_PITCH_RAD,
      lookZ: BOTTOM_OPEN_LOOK_Z,
      distance: Math.max(23.6, 8.6 / (HALF_FOV_TAN * safeAspect)),
    };
  }
  return {
    pitchRad: TOP_COLLAPSED_PITCH_RAD,
    lookZ: TOP_COLLAPSED_LOOK_Z,
    distance: Math.max(22.0, 8.2 / (HALF_FOV_TAN * safeAspect)),
  };
}

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
  private readonly dirFillLight: THREE.DirectionalLight;
  private readonly hemiFillLight: THREE.HemisphereLight;
  private readonly lightGuidePulseGeo: THREE.RingGeometry;
  private readonly lightGuidePulseMat: THREE.MeshBasicMaterial;
  private readonly lightGuidePulseRing: THREE.Mesh;

  private readonly materials: PbrMaterialLibrary;
  private readonly arena: ArenaStageAssembly;
  private readonly lobbyStage: LobbyStageAssembly;
  private readonly unitFactory: UnitMeshFactory;
  private readonly tweenGroup = new TweenGroup();
  private readonly vfx: StageVfxManager;
  private hudOverlay: StageHudOverlayProjector | null = null;

  private readonly matchTacticianRigs = new Map<TacticianId, TacticianRig>();
  private matchTacticianRig: TacticianRig;
  private readonly matchTacticianPosSpring = new SpringDamper3D(
    MATCH_TACTICIAN_HOME.x,
    MATCH_TACTICIAN_HOME.y,
    MATCH_TACTICIAN_HOME.z,
    18,
    0.76,
  );
  private readonly tacticianOrbQueue: string[] = [];
  private tacticianMoveTarget: { x: number; z: number } | null = null;
  private tacticianVelX = 0;
  private tacticianVelZ = 0;
  private tacticianYaw = Math.PI * 0.28;
  private tacticianTrailTimerSec = 0;

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
  private sceneMode: StageSceneMode;
  private currentTacticianId: TacticianId;
  private shopCameraLayout: ShopCameraLayout;
  private learningOverlayActive = false;
  private loopPaused = false;
  private webglAvailable = false;

  private activeSeatIndex = 0;
  private viewportAspect = 16 / 9;
  private cameraPitchRad = BOTTOM_OPEN_PITCH_RAD;
  private cameraBaseLookZ = BOTTOM_OPEN_LOOK_Z;
  private cameraDistance = 23.6;
  private readonly cameraLookTarget = new THREE.Vector3(0, 0, BOTTOM_OPEN_LOOK_Z);
  private introDistanceOffset = 0;
  private introPitchOffsetRad = 0;
  private introLookZOffset = 0;

  private activeCameraTween: Tween<{ x: number; z: number }> | null = null;
  private activeLayoutTween: Tween<{ pitch: number; lookZ: number; dist: number }> | null = null;
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
  private lastLobbyPointerX = 0;
  private lobbyPointerDown = false;
  private nudgedFriendlyId: string | null = null;
  private overSellZone = false;

  private lastFrameTimestampMs = 0;
  private lastSubpageRenderMs = 0;
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
    if (this.activeLayoutTween) {
      this.activeLayoutTween.stop();
      this.tweenGroup.remove(this.activeLayoutTween);
      this.activeLayoutTween = null;
    }
    const metrics = computeMatchCameraMetrics(this.shopCameraLayout, this.viewportAspect);
    this.cameraPitchRad = metrics.pitchRad;
    this.cameraBaseLookZ = metrics.lookZ;
    this.cameraDistance = metrics.distance;
    const origin = getSeatWorldOrigin(this.activeSeatIndex);
    this.cameraLookTarget.set(origin.x, 0, origin.z + this.cameraBaseLookZ);
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
    this.sceneMode = options?.initialSceneMode ?? 'match';
    this.currentTacticianId = options?.initialTacticianId ?? DEFAULT_TACTICIAN_ID;
    this.shopCameraLayout = options?.initialShopCameraLayout ?? 'bottom_open';
    this.callbacks = options?.callbacks ?? {};

    if (options?.audioBus) {
      this.audioBus = options.audioBus;
    } else {
      this.audioBus = new AudioEventBus();
      this.audioBus.setAdapter(NullAudioAdapter);
    }

    const initialTheme = options?.initialTheme ?? 'orbital_elevator_port';
    const lightPreset = getArenaThemeLightingPreset(initialTheme);
    this.scene.background = new THREE.Color(lightPreset.fogColor);
    this.scene.fog = new THREE.FogExp2(lightPreset.fogColor, lightPreset.fogDensity);

    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, this.viewportAspect, 0.5, 180);
    const initialMetrics = computeMatchCameraMetrics(this.shopCameraLayout, this.viewportAspect);
    this.cameraPitchRad = initialMetrics.pitchRad;
    this.cameraBaseLookZ = initialMetrics.lookZ;
    this.cameraDistance = initialMetrics.distance;
    this.cameraLookTarget.set(0, 0, this.cameraBaseLookZ);
    this.syncCameraFromLookTarget();

    this.dirKeyLight = new THREE.DirectionalLight(lightPreset.keyColor, lightPreset.keyIntensity);
    this.dirKeyLight.position.set(lightPreset.keyPos[0], lightPreset.keyPos[1], lightPreset.keyPos[2]);
    this.dirRimLight = new THREE.DirectionalLight(lightPreset.rimColor, lightPreset.rimIntensity);
    this.dirRimLight.position.set(lightPreset.rimPos[0], lightPreset.rimPos[1], lightPreset.rimPos[2]);
    this.dirFillLight = new THREE.DirectionalLight(lightPreset.fillColor, lightPreset.fillIntensity);
    this.dirFillLight.position.set(lightPreset.fillPos[0], lightPreset.fillPos[1], lightPreset.fillPos[2]);
    this.hemiFillLight = new THREE.HemisphereLight(
      lightPreset.hemiSkyColor,
      lightPreset.hemiGroundColor,
      lightPreset.hemiIntensity,
    );
    this.scene.add(this.dirKeyLight, this.dirRimLight, this.dirFillLight, this.hemiFillLight);

    this.lightGuidePulseGeo = new THREE.RingGeometry(0.92, 1.0, 64);
    this.lightGuidePulseGeo.rotateX(-Math.PI * 0.5);
    this.lightGuidePulseMat = new THREE.MeshBasicMaterial({
      color: 0xf2c97d,
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
    this.arena = new ArenaStageAssembly(this.materials, initialTheme);
    this.lobbyStage = new LobbyStageAssembly(this.materials, this.currentTacticianId);
    this.lobbyStage.setMode(this.sceneMode, true);
    (this.lobbyStage as { setTheme?: (t: ArenaThemeId) => void }).setTheme?.(initialTheme);
    this.unitFactory = new UnitMeshFactory(this.materials);
    this.vfx = new StageVfxManager(this.materials, this.tweenGroup);

    this.matchTacticianRig = this.getOrCreateMatchTacticianRig(this.currentTacticianId);
    this.matchTacticianRig.root.visible = true;

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

  private getActiveScene(): THREE.Scene {
    return this.sceneMode === 'match' ? this.scene : this.lobbyStage.scene;
  }

  private getActiveCamera(): THREE.PerspectiveCamera {
    return this.sceneMode === 'match' ? this.camera : this.lobbyStage.camera;
  }

  private syncComposerSceneAndBloom(): void {
    if (!this.composer || !this.selectiveBloom) return;
    const activeScene = this.getActiveScene();
    const activeCamera = this.getActiveCamera();
    this.composer.setMainScene(activeScene);
    this.composer.setMainCamera(activeCamera);

    this.selectiveBloom.selection.clear();
    if (this.sceneMode === 'match') {
      for (const obj of this.arena.getActiveBloomTargets()) this.selectiveBloom.selection.add(obj);
      for (const obj of this.vfx.getActiveBloomTargets()) this.selectiveBloom.selection.add(obj);
      for (const obj of this.matchTacticianRig.bloomTargets) this.selectiveBloom.selection.add(obj);
      this.selectiveBloom.selection.add(this.lightGuidePulseRing);
      for (const rig of this.unitRigs.values()) {
        if (rig.manaRatio >= 0.85) this.selectiveBloom.selection.add(rig.weaponGlowMesh);
      }
    } else {
      for (const obj of this.lobbyStage.getActiveBloomTargets()) {
        this.selectiveBloom.selection.add(obj);
      }
    }
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
      renderer.toneMappingExposure = this.sceneMode === 'subpage' ? SUBPAGE_EXPOSURE : BASE_EXPOSURE;
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
      attachPortraitBakerRenderer(renderer);

      const env = buildProceduralStudioEnvMap(renderer);
      this.envRenderTarget = env.renderTarget;
      this.scene.environment = env.envTexture;
      this.scene.environmentIntensity = getArenaThemeLightingPreset(this.arena.getTheme()).envIntensity;
      this.lobbyStage.scene.environment = env.envTexture;
      this.lobbyStage.scene.environmentIntensity = 0.64;

      const composer = new EffectComposer(renderer, {
        frameBufferType: THREE.HalfFloatType,
        multisampling: 0,
      });
      const activeScene = this.getActiveScene();
      const activeCamera = this.getActiveCamera();
      const renderPass = new RenderPass(activeScene, activeCamera);
      const selectiveBloom = new SelectiveBloomEffect(activeScene, activeCamera, {
        blendFunction: BlendFunction.ADD,
        luminanceThreshold: 0.94,
        luminanceSmoothing: 0.26,
        mipmapBlur: true,
        intensity: BASE_BLOOM_INTENSITY,
        radius: 0.48,
      });
      selectiveBloom.ignoreBackground = true;

      const smaaEffect = new SMAAEffect({
        preset: this.qualityTier === 'high' ? SMAAPreset.HIGH : SMAAPreset.MEDIUM,
      });
      const compoundPass = new EffectPass(activeCamera, selectiveBloom, smaaEffect);

      composer.addPass(renderPass);
      composer.addPass(compoundPass);
      this.composer = composer;
      this.selectiveBloom = selectiveBloom;
      this.syncComposerSceneAndBloom();
    } catch {
      this.renderer = null;
      this.composer = null;
      this.selectiveBloom = null;
      this.webglAvailable = false;
    }

    this.hudOverlay = new StageHudOverlayProjector(
      container,
      this.showBuiltInHudOverlay && this.sceneMode === 'match',
    );

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
    if (this.webglAvailable && this.sceneMode === 'match' && !this.learningOverlayActive) {
      this.playBootDiveTransition();
    }
    if (!this.learningOverlayActive) {
      this.resumeLoop();
    }
  }

  public getRenderer(): THREE.WebGLRenderer | null {
    return this.renderer;
  }

  public setSceneMode(mode: StageSceneMode): void {
    const prevMode = this.sceneMode;
    if (prevMode === mode) return;
    this.sceneMode = mode;

    if (mode !== 'match') {
      this.cancelActiveInteraction();
      this.lobbyStage.setMode(mode, this.motionPreference?.matches ?? false);
      if (this.learningOverlayActive) {
        this.learningOverlayActive = false;
        this.resumeLoop();
      }
    } else {
      this.arena.triggerConduitSweep();
      if (this.webglAvailable && prevMode !== 'match') {
        this.bootDivePlayed = false;
        this.playBootDiveTransition();
      }
    }

    this.hudOverlay?.setEnabled(this.showBuiltInHudOverlay && mode === 'match');
    if (this.renderer && !this.activeIntroTween) {
      this.renderer.toneMappingExposure = mode === 'subpage' ? SUBPAGE_EXPOSURE : BASE_EXPOSURE;
    }
    this.syncComposerSceneAndBloom();
    if (this.loopPaused) {
      this.renderSingleFrame();
    }
  }

  public getSceneMode(): StageSceneMode {
    return this.sceneMode;
  }

  public skipSplashIntro(): void {
    this.lobbyStage.skipSplashIntro();
  }

  private getOrCreateMatchTacticianRig(tacticianId: TacticianId): TacticianRig {
    const cached = this.matchTacticianRigs.get(tacticianId);
    if (cached) return cached;
    const rig = createTacticianRig(tacticianId, this.materials);
    rig.root.scale.setScalar(0.86);
    rig.root.position.set(
      this.matchTacticianPosSpring.x.value,
      this.matchTacticianPosSpring.y.value,
      this.matchTacticianPosSpring.z.value,
    );
    rig.root.rotation.y = Math.PI * 0.28;
    rig.root.visible = false;
    this.scene.add(rig.root);
    this.matchTacticianRigs.set(tacticianId, rig);
    return rig;
  }

  public setTactician(tacticianId: TacticianId): void {
    if (this.currentTacticianId === tacticianId) return;
    this.currentTacticianId = tacticianId;
    this.lobbyStage.setTactician(tacticianId);

    const prevYaw = this.matchTacticianRig.root.rotation.y;
    this.matchTacticianRig.root.visible = false;
    const nextRig = this.getOrCreateMatchTacticianRig(tacticianId);
    nextRig.root.position.set(
      this.matchTacticianPosSpring.x.value,
      this.matchTacticianPosSpring.y.value,
      this.matchTacticianPosSpring.z.value,
    );
    nextRig.root.rotation.y = prevYaw;
    nextRig.root.visible = true;
    this.matchTacticianRig = nextRig;
    this.syncComposerSceneAndBloom();
    if (this.loopPaused) this.renderSingleFrame();
  }

  public getTacticianId(): TacticianId {
    return this.currentTacticianId;
  }

  public triggerTacticianEmote(kind: TacticianEmoteKind): number {
    if (this.sceneMode === 'match') {
      return this.matchTacticianRig.triggerEmote(kind);
    }
    return this.lobbyStage.triggerTacticianEmote(kind);
  }

  public setShopCameraLayout(layout: ShopCameraLayout, instant = false): void {
    const changed = this.shopCameraLayout !== layout;
    this.shopCameraLayout = layout;
    const target = computeMatchCameraMetrics(layout, this.viewportAspect);

    if (this.activeLayoutTween) {
      this.activeLayoutTween.stop();
      this.tweenGroup.remove(this.activeLayoutTween);
      this.activeLayoutTween = null;
    }

    const origin = getSeatWorldOrigin(this.activeSeatIndex);
    if (instant || !changed || this.motionPreference?.matches || this.loopPaused) {
      this.cameraPitchRad = target.pitchRad;
      this.cameraBaseLookZ = target.lookZ;
      this.cameraDistance = target.distance;
      this.cameraLookTarget.set(origin.x, 0, origin.z + this.cameraBaseLookZ);
      this.syncCameraFromLookTarget();
      if (this.loopPaused) this.renderSingleFrame();
      return;
    }

    const proxy = {
      pitch: this.cameraPitchRad,
      lookZ: this.cameraBaseLookZ,
      dist: this.cameraDistance,
    };
    const tw = new Tween(proxy)
      .to(
        { pitch: target.pitchRad, lookZ: target.lookZ, dist: target.distance },
        CAMERA_LAYOUT_TRANSITION_MS,
      )
      .easing(Easing.Cubic.Out)
      .onUpdate(({ pitch, lookZ, dist }) => {
        this.cameraPitchRad = pitch;
        this.cameraBaseLookZ = lookZ;
        this.cameraDistance = dist;
        const curOrigin = getSeatWorldOrigin(this.activeSeatIndex);
        this.cameraLookTarget.set(curOrigin.x, 0, curOrigin.z + lookZ);
        this.syncCameraFromLookTarget();
      })
      .onComplete(() => {
        this.cameraPitchRad = target.pitchRad;
        this.cameraBaseLookZ = target.lookZ;
        this.cameraDistance = target.distance;
        this.activeLayoutTween = null;
        this.syncCameraFromLookTarget();
      });

    this.activeLayoutTween = tw;
    this.tweenGroup.add(tw);
    tw.start(this.clockMs);
  }

  public getShopCameraLayout(): ShopCameraLayout {
    return this.shopCameraLayout;
  }

  public getLobbyStage(): LobbyStageAssembly {
    return this.lobbyStage;
  }

  private playBootDiveTransition(): void {
    if (this.bootDivePlayed || this.motionPreference?.matches) return;
    this.bootDivePlayed = true;
    if (this.activeIntroTween) {
      this.activeIntroTween.stop();
      this.tweenGroup.remove(this.activeIntroTween);
      this.activeIntroTween = null;
    }

    const startPitchOffset = THREE.MathUtils.degToRad(-12);
    const startDistOffset = 8.4;
    const startLookZOffset = -0.55;

    this.introDistanceOffset = startDistOffset;
    this.introPitchOffsetRad = startPitchOffset;
    this.introLookZOffset = startLookZOffset;
    if (this.renderer) this.renderer.toneMappingExposure = 0.9;
    if (this.selectiveBloom) this.selectiveBloom.intensity = BASE_BLOOM_INTENSITY * 0.78;
    this.arena.triggerConduitSweep();
    this.syncCameraFromLookTarget();

    const proxy = {
      dist: startDistOffset,
      pitch: startPitchOffset,
      lookZ: startLookZOffset,
      exposure: 0.9,
      bloom: BASE_BLOOM_INTENSITY * 0.78,
    };

    const tw = new Tween(proxy)
      .to(
        { dist: 0, pitch: 0, lookZ: 0, exposure: BASE_EXPOSURE, bloom: BASE_BLOOM_INTENSITY },
        INTRO_DIVE_DURATION_MS,
      )
      .easing(Easing.Cubic.Out)
      .onUpdate(({ dist, pitch, lookZ, exposure, bloom }) => {
        this.introDistanceOffset = dist;
        this.introPitchOffsetRad = pitch;
        this.introLookZOffset = lookZ;
        if (this.renderer && this.sceneMode === 'match') {
          this.renderer.toneMappingExposure = exposure;
        }
        if (this.selectiveBloom) this.selectiveBloom.intensity = bloom;
        this.syncCameraFromLookTarget();
      })
      .onComplete(() => {
        this.introDistanceOffset = 0;
        this.introPitchOffsetRad = 0;
        this.introLookZOffset = 0;
        if (this.renderer && this.sceneMode === 'match') {
          this.renderer.toneMappingExposure = BASE_EXPOSURE;
        }
        if (this.selectiveBloom) this.selectiveBloom.intensity = BASE_BLOOM_INTENSITY;
        this.activeIntroTween = null;
        this.syncCameraFromLookTarget();
      });

    this.activeIntroTween = tw;
    this.tweenGroup.add(tw);
    tw.start(this.clockMs);
  }

  private applyArenaThemeLighting(theme: ArenaThemeId): void {
    const preset = getArenaThemeLightingPreset(theme);
    this.dirKeyLight.color.setHex(preset.keyColor);
    this.dirKeyLight.intensity = preset.keyIntensity;
    this.dirKeyLight.position.set(preset.keyPos[0], preset.keyPos[1], preset.keyPos[2]);
    this.dirRimLight.color.setHex(preset.rimColor);
    this.dirRimLight.intensity = preset.rimIntensity;
    this.dirRimLight.position.set(preset.rimPos[0], preset.rimPos[1], preset.rimPos[2]);
    this.dirFillLight.color.setHex(preset.fillColor);
    this.dirFillLight.intensity = preset.fillIntensity;
    this.dirFillLight.position.set(preset.fillPos[0], preset.fillPos[1], preset.fillPos[2]);
    this.hemiFillLight.color.setHex(preset.hemiSkyColor);
    this.hemiFillLight.groundColor.setHex(preset.hemiGroundColor);
    this.hemiFillLight.intensity = preset.hemiIntensity;
    this.scene.environmentIntensity = preset.envIntensity;
    this.scene.background = new THREE.Color(preset.fogColor);
    this.scene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
  }

  private playThemePulseTransition(): void {
    if (!this.webglAvailable || this.loopPaused || this.motionPreference?.matches || this.sceneMode !== 'match') {
      return;
    }

    if (this.activeThemePulseTween) {
      this.activeThemePulseTween.stop();
      this.tweenGroup.remove(this.activeThemePulseTween);
      this.activeThemePulseTween = null;
    }

    const preset = getArenaThemeLightingPreset(this.arena.getTheme());
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
        this.lightGuidePulseMat.opacity = bell * 0.36;
        this.dirRimLight.intensity = preset.rimIntensity + bell * 0.22;
        this.dirKeyLight.intensity = preset.keyIntensity + bell * 0.10;
        if (this.renderer && !this.activeIntroTween) {
          this.renderer.toneMappingExposure = BASE_EXPOSURE + bell * 0.04;
        }
        if (this.selectiveBloom && !this.activeIntroTween) {
          this.selectiveBloom.intensity = BASE_BLOOM_INTENSITY + bell * 0.10;
        }
      })
      .onComplete(() => {
        this.lightGuidePulseRing.visible = false;
        this.lightGuidePulseMat.opacity = 0;
        this.dirRimLight.intensity = preset.rimIntensity;
        this.dirKeyLight.intensity = preset.keyIntensity;
        if (this.renderer && !this.activeIntroTween) {
          this.renderer.toneMappingExposure = BASE_EXPOSURE;
        }
        if (this.selectiveBloom && !this.activeIntroTween) {
          this.selectiveBloom.intensity = BASE_BLOOM_INTENSITY;
        }
        this.activeThemePulseTween = null;
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
    this.lightGuidePulseRing.visible = false;
    this.lightGuidePulseMat.opacity = 0;
    this.applyArenaThemeLighting(this.arena.getTheme());
    if (this.renderer) {
      this.renderer.toneMappingExposure =
        this.sceneMode === 'subpage' ? SUBPAGE_EXPOSURE : BASE_EXPOSURE;
    }
    if (this.selectiveBloom) this.selectiveBloom.intensity = BASE_BLOOM_INTENSITY;
    this.syncCameraFromLookTarget();
  }

  private syncCameraFromLookTarget(): void {
    const pitch = this.cameraPitchRad + this.introPitchOffsetRad;
    const distance = this.cameraDistance + this.introDistanceOffset;
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

    this.viewportAspect = aspect;
    this.camera.aspect = aspect;
    const metrics = computeMatchCameraMetrics(this.shopCameraLayout, aspect);
    this.cameraDistance = metrics.distance;
    if (!this.activeLayoutTween) {
      this.cameraPitchRad = metrics.pitchRad;
      this.cameraBaseLookZ = metrics.lookZ;
      const origin = getSeatWorldOrigin(this.activeSeatIndex);
      this.cameraLookTarget.set(origin.x, 0, origin.z + this.cameraBaseLookZ);
    }
    this.camera.updateProjectionMatrix();
    this.syncCameraFromLookTarget();

    this.lobbyStage.resize(width, height);

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
    (this.lobbyStage as { setTheme?: (t: ArenaThemeId) => void }).setTheme?.(theme);
    if (this.arena.getTheme() === theme) {
      if (this.loopPaused) this.renderSingleFrame();
      return;
    }
    this.arena.setTheme(theme);
    this.applyArenaThemeLighting(theme);
    this.syncComposerSceneAndBloom();
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
    if (phase === 'battle') {
      this.tacticianOrbQueue.length = 0;
      this.tacticianMoveTarget = { x: MATCH_TACTICIAN_HOME.x, z: MATCH_TACTICIAN_HOME.z };
      this.collectAllLootOrbs();
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
      this.cameraLookTarget.set(origin.x, 0, origin.z + this.cameraBaseLookZ);
      this.syncCameraFromLookTarget();
      if (this.loopPaused) this.renderSingleFrame();
      return;
    }

    const proxy = { x: this.cameraLookTarget.x, z: this.cameraLookTarget.z };
    const tw = new Tween(proxy)
      .to({ x: origin.x, z: origin.z + this.cameraBaseLookZ }, 300)
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
      if (this.selectiveBloom && this.sceneMode === 'match') {
        if (shouldBloomWeapon) this.selectiveBloom.selection.add(rig.weaponGlowMesh);
        else this.selectiveBloom.selection.delete(rig.weaponGlowMesh);
      }
    }

    this.arena.setBenchOccupancy(occupiedBenchSlots);
    this.unitFactory.syncGroundBatches(this.unitRigs.values());
  }

  public syncLootOrbs(orbs: readonly StageLootOrbState[]): void {
    const { addedBloom, removedBloom } = this.vfx.syncLootOrbs(orbs);
    if (this.selectiveBloom) {
      for (const m of removedBloom) this.selectiveBloom.selection.delete(m);
      if (this.sceneMode === 'match') {
        for (const m of addedBloom) this.selectiveBloom.selection.add(m);
      }
    }
    for (let i = this.tacticianOrbQueue.length - 1; i >= 0; i -= 1) {
      if (!this.vfx.getLootOrbTargetPos(this.tacticianOrbQueue[i]!)) {
        this.tacticianOrbQueue.splice(i, 1);
      }
    }
  }

  public getTacticianWorldPos(): { x: number; y: number; z: number } {
    return {
      x: this.matchTacticianRig.root.position.x,
      y: this.matchTacticianRig.root.position.y,
      z: this.matchTacticianRig.root.position.z,
    };
  }

  public getLootOrbWorldPos(orbId: string): { x: number; z: number } | null {
    return this.vfx.getLootOrbWorldPos(orbId);
  }

  public getActiveGoldFloatCount(): number {
    return this.hudOverlay?.getActiveGoldFloatCount() ?? 0;
  }

  private getTacticianChestPos(): { x: number; y: number; z: number } {
    return {
      x: this.matchTacticianRig.root.position.x,
      y: this.matchTacticianRig.root.position.y + 0.56,
      z: this.matchTacticianRig.root.position.z,
    };
  }

  public moveTacticianTo(worldX: number, worldZ: number): void {
    const clampedX = Math.max(-TACTICIAN_DECK_X_LIMIT, Math.min(TACTICIAN_DECK_X_LIMIT, worldX));
    const clampedZ = Math.max(TACTICIAN_DECK_Z_MIN, Math.min(TACTICIAN_DECK_Z_MAX, worldZ));
    this.tacticianOrbQueue.length = 0;
    this.tacticianMoveTarget = { x: clampedX, z: clampedZ };
  }

  public enqueueLootOrbPickup(orbId: string): boolean {
    const target = this.vfx.getLootOrbTargetPos(orbId);
    if (!target) return false;
    this.tacticianMoveTarget = null;
    if (!this.tacticianOrbQueue.includes(orbId)) {
      this.tacticianOrbQueue.push(orbId);
    }
    this.vfx.spawnGroundClickRipple(target.x, target.z, true);
    return true;
  }

  public collectLootOrb(orbId: string): boolean {
    return this.enqueueLootOrbPickup(orbId);
  }

  private handleLootOrbBurst(
    orbId: string,
    goldAmount: number,
    burstPos: { readonly x: number; readonly y: number; readonly z: number },
    removedBloomMesh?: THREE.Object3D,
  ): void {
    if (removedBloomMesh) {
      this.selectiveBloom?.selection.delete(removedBloomMesh);
    }
    this.hudOverlay?.spawnGoldFloat(
      { x: burstPos.x, y: burstPos.y + 0.36, z: burstPos.z },
      goldAmount,
    );
    this.matchTacticianRig.triggerEmote('collect_orb');
    this.callbacks.onCollectLootOrb?.(orbId, goldAmount);
  }

  private triggerOrbMagnetCollect(orbId: string): boolean {
    return this.vfx.magnetCollectLootOrb(
      orbId,
      () => this.getTacticianChestPos(),
      0.14,
      (id, gold, burstPos, removedBloom) => {
        this.handleLootOrbBurst(id, gold, burstPos, removedBloom);
      },
      0,
    );
  }

  public collectAllLootOrbs(): void {
    this.tacticianOrbQueue.length = 0;
    const count = this.vfx.collectAllLootOrbs(
      () => this.getTacticianChestPos(),
      (id, gold, burstPos, removedBloom) => {
        this.handleLootOrbBurst(id, gold, burstPos, removedBloom);
      },
    );
    if (count > 0) {
      this.matchTacticianRig.triggerEmote('collect_orb');
    }
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
      this.matchTacticianRig.triggerEmote('cheer');
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

    if (this.activeSeatIndex === 0) {
      const orb =
        this.vfx.findLootOrbByRay(this.raycaster.ray) ??
        this.vfx.findLootOrbNear(wx, wz, 0.78);
      if (orb) {
        return {
          kind: 'loot_orb',
          orbId: orb.orbId,
          goldAmount: orb.goldAmount,
          worldX: orb.targetX,
          worldZ: orb.targetZ,
        };
      }
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
      this.sceneMode === 'match' &&
      this.interactiveDeployEnabled &&
      this.currentPhase === 'strategy' &&
      this.activeSeatIndex === 0 &&
      !this.learningOverlayActive
    );
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;

    if (this.sceneMode === 'splash') {
      this.lobbyStage.skipSplashIntro();
      return;
    }

    if (this.sceneMode === 'lobby' || this.sceneMode === 'prep') {
      this.lobbyPointerDown = true;
      this.pointerDownClient = { x: e.clientX, y: e.clientY };
      this.lastLobbyPointerX = e.clientX;
      this.lobbyStage.beginTacticianDrag();
      return;
    }

    if (this.sceneMode !== 'match') return;

    const pick = this.pickAtClientPoint(e.clientX, e.clientY);
    if (!pick) return;

    this.pointerDownClient = { x: e.clientX, y: e.clientY };

    if (pick.kind === 'loot_orb') {
      this.clearSelectionAndHelpers();
      this.callbacks.onInspectUnit?.(null);
      this.enqueueLootOrbPickup(pick.orbId);
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
    if (
      this.activeSeatIndex === 0 &&
      !this.learningOverlayActive &&
      (this.currentPhase === 'strategy' || this.currentPhase === 'resource') &&
      pick.kind !== 'sell_zone'
    ) {
      this.moveTacticianTo(pick.worldX, pick.worldZ);
    }
  }

  private startDraggingUnit(instanceId: string): void {
    this.draggingInstanceId = instanceId;
    this.arena.setDeployHighlightActive(true);
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
    if (this.loopPaused) return;

    if (this.lobbyPointerDown && (this.sceneMode === 'lobby' || this.sceneMode === 'prep')) {
      const dx = e.clientX - this.lastLobbyPointerX;
      this.lastLobbyPointerX = e.clientX;
      this.lobbyStage.dragTacticianYaw(dx);
      return;
    }

    if (this.sceneMode !== 'match' || !this.container) return;

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
    if (this.lobbyPointerDown) {
      this.lobbyPointerDown = false;
      this.lobbyStage.endTacticianDrag();
      const dragDist = this.pointerDownClient
        ? Math.hypot(e.clientX - this.pointerDownClient.x, e.clientY - this.pointerDownClient.y)
        : 999;
      if (dragDist < 6) {
        const variant = this.lobbyStage.triggerTacticianEmote('tap');
        this.callbacks.onTacticianTap?.(this.currentTacticianId, variant);
      }
      return;
    }

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
    this.arena.setDeployHighlightActive(false);
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
    this.lobbyPointerDown = false;
    this.clearSelectionAndHelpers();
  }

  private onAnimationFrame(timestampMs: number): void {
    if (this.disposed || this.loopPaused) return;

    if (this.sceneMode === 'subpage') {
      if (timestampMs - this.lastSubpageRenderMs < SUBPAGE_FRAME_INTERVAL_MS) {
        return;
      }
      this.lastSubpageRenderMs = timestampMs;
    }

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
    if (this.sceneMode === 'match') {
      this.hudOverlay?.updateAndRender(dtSeconds, this.camera, this.unitStates, this.unitRigs);
    }
  }

  private stepSimulation(dt: number): void {
    this.elapsedSec += dt;
    this.clockMs += dt * 1000;
    this.tweenGroup.update(this.clockMs);

    if (this.sceneMode === 'match') {
      this.arena.update(dt);
      for (const rig of this.unitRigs.values()) {
        rig.update(dt, this.elapsedSec);
      }
      this.unitFactory.syncGroundBatches(this.unitRigs.values());
      this.vfx.update(dt);
      this.stepMatchTactician(dt);
    } else {
      this.lobbyStage.update(dt);
    }
  }

  private stepMatchTactician(dt: number): void {
    let curX = this.matchTacticianPosSpring.x.value;
    let curZ = this.matchTacticianPosSpring.z.value;

    while (this.tacticianOrbQueue.length > 0) {
      if (this.vfx.getLootOrbTargetPos(this.tacticianOrbQueue[0]!)) break;
      this.tacticianOrbQueue.shift();
    }

    const headOrbId = this.tacticianOrbQueue[0] ?? null;
    const orbTarget = headOrbId ? this.vfx.getLootOrbTargetPos(headOrbId) : null;
    const activeTarget = orbTarget ?? this.tacticianMoveTarget;
    const hasFollowUp = this.tacticianOrbQueue.length > 1;

    if (activeTarget) {
      const dx = activeTarget.x - curX;
      const dz = activeTarget.z - curZ;
      const dist = Math.hypot(dx, dz);
      if (dist > 0.05) {
        const desiredSpeed = hasFollowUp
          ? TACTICIAN_RUN_SPEED
          : Math.min(TACTICIAN_RUN_SPEED, dist * 10.5);
        const dvx = (dx / dist) * desiredSpeed;
        const dvz = (dz / dist) * desiredSpeed;
        const blend = 1 - Math.exp(-16 * dt);
        this.tacticianVelX += (dvx - this.tacticianVelX) * blend;
        this.tacticianVelZ += (dvz - this.tacticianVelZ) * blend;
      } else {
        if (!headOrbId) {
          this.tacticianMoveTarget = null;
        }
        const decay = Math.exp(-18 * dt);
        this.tacticianVelX *= decay;
        this.tacticianVelZ *= decay;
      }
    } else {
      const decay = Math.exp(-18 * dt);
      this.tacticianVelX *= decay;
      this.tacticianVelZ *= decay;
    }

    curX += this.tacticianVelX * dt;
    curZ += this.tacticianVelZ * dt;

    if (
      activeTarget &&
      !headOrbId &&
      Math.hypot(activeTarget.x - curX, activeTarget.z - curZ) < 0.08
    ) {
      curX = activeTarget.x;
      curZ = activeTarget.z;
      this.tacticianVelX = 0;
      this.tacticianVelZ = 0;
      this.tacticianMoveTarget = null;
    }

    const speed = Math.hypot(this.tacticianVelX, this.tacticianVelZ);
    const speedRatio = Math.min(1, speed / TACTICIAN_RUN_SPEED);

    if (speed > 0.18) {
      const desiredYaw = Math.atan2(this.tacticianVelX, this.tacticianVelZ);
      const yawDiff = Math.atan2(
        Math.sin(desiredYaw - this.tacticianYaw),
        Math.cos(desiredYaw - this.tacticianYaw),
      );
      this.tacticianYaw += yawDiff * (1 - Math.exp(-15 * dt));
    }

    const runHopY = Math.abs(Math.sin(this.elapsedSec * 14.5)) * 0.16 * speedRatio;
    const curY = MATCH_TACTICIAN_HOME.y + runHopY;

    this.matchTacticianPosSpring.snap(curX, curY, curZ);
    this.matchTacticianRig.root.position.set(curX, curY, curZ);
    this.matchTacticianRig.root.rotation.y = this.tacticianYaw;
    const leanBlend = 1 - Math.exp(-14 * dt);
    this.matchTacticianRig.root.rotation.x +=
      (speedRatio * 0.11 - this.matchTacticianRig.root.rotation.x) * leanBlend;

    if (speed > 1.2) {
      this.tacticianTrailTimerSec += dt;
      if (this.tacticianTrailTimerSec >= 0.042) {
        this.tacticianTrailTimerSec = 0;
        this.vfx.spawnTacticianTrailSpark(curX, curY + 0.12, curZ);
      }
    } else {
      this.tacticianTrailTimerSec = 0;
    }

    if (this.activeSeatIndex === 0 && !this.learningOverlayActive) {
      const nearby = this.vfx.findCollectibleLootOrbsNear(
        curX,
        curZ,
        TACTICIAN_ORB_MAGNET_RADIUS,
      );
      for (const orb of nearby) {
        const qIdx = this.tacticianOrbQueue.indexOf(orb.orbId);
        if (qIdx >= 0) {
          this.tacticianOrbQueue.splice(qIdx, 1);
        }
        this.triggerOrbMagnetCollect(orb.orbId);
      }
    }

    this.matchTacticianRig.update(dt, this.elapsedSec);
  }

  private renderFrameInternal(dt: number): void {
    this.renderer?.info.reset();
    if (this.composer && this.renderer) {
      this.composer.render(dt);
    } else if (this.renderer) {
      this.renderer.render(this.getActiveScene(), this.getActiveCamera());
    }
    const renderInfo = this.renderer?.info.render;
    this.frameRenderStats.drawCalls = renderInfo?.calls ?? 0;
    this.frameRenderStats.triangles = renderInfo?.triangles ?? 0;
    if (this.sceneMode === 'match') {
      this.hudOverlay?.updateAndRender(dt, this.camera, this.unitStates, this.unitRigs);
    }
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
      sceneMode: this.sceneMode,
    };
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    this.pauseLoop();
    this.tweenGroup.removeAll();
    this.resizeObserver?.disconnect();
    attachPortraitBakerRenderer(null);

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

    for (const rig of this.matchTacticianRigs.values()) rig.dispose();
    this.matchTacticianRigs.clear();
    this.lobbyStage.dispose();
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
