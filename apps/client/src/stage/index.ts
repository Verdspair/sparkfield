export { BoardStageEngine } from './BoardStageEngine.js';

export {
  BENCH_SLOT_SPACING,
  BENCH_Z_OFFSET,
  HEX_RADIUS,
  HEX_ROW_SPACING,
  HEX_WIDTH,
  SELL_ZONE_Z_THRESHOLD,
  SpringDamper,
  SpringDamper3D,
  benchSlotToStageXZ,
  boardRowToDeployRow,
  deployRowToBoardRow,
  getHexesWithinRange,
  getSeatWorldOrigin,
  hexDistance,
  hexToStageXZ,
  offsetToAxial,
  stageXZToBenchSlot,
  stageXZToHex,
} from './spring.js';

export {
  COST_TIER_COLORS,
  FACTION_PALETTES,
  PbrMaterialLibrary,
  bakeBasaltTitaniumMaps,
  bakeBrushedChampagneGoldMaps,
  bakeRadialContactShadowTexture,
  bakeSapphirePhotonLatticeMaps,
  bakeWhitePorcelainArmorMaps,
  buildProceduralStudioEnvMap,
  type FactionVisualPalette,
  type PbrFourMapSet,
} from './pbrMaterials.js';

export {
  ArenaStageAssembly,
  getArenaThemeLightingPreset,
  type ArenaThemeLightingPreset,
} from './arenaBuilder.js';

export { LobbyStageAssembly } from './lobbyStageBuilder.js';

export {
  DEFAULT_TACTICIAN_ID,
  TACTICIAN_CATALOG,
  TACTICIAN_IDS,
  createTacticianRig,
  type TacticianCatalogEntry,
  type TacticianRig,
} from './tacticianMeshFactory.js';

export {
  SharedUnitGeometryPool,
  UnitMeshFactory,
  type UnitActorRig,
} from './unitMeshFactory.js';

export {
  attachPortraitBakerRenderer,
  bakePortraitNow,
  clearPortraitCache,
  getArenaPreviewUrl,
  getTacticianPortraitUrl,
  getUnitPortraitUrl,
  prebakePortraitsAsync,
} from './unitPortraitBaker.js';

export { StageVfxManager } from './vfxManager.js';
export { StageHudOverlayProjector } from './hudOverlayProjector.js';

export type {
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
  StageStatusFlags,
  StageUnitPlacement,
  StageUnitState,
  TacticianEmoteKind,
  TacticianId,
  UnitScreenProjection,
} from './types.js';
