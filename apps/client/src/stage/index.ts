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
  PbrMaterialLibrary,
  bakeBasaltTitaniumMaps,
  bakeBrushedChampagneGoldMaps,
  bakeRadialContactShadowTexture,
  bakeSapphirePhotonLatticeMaps,
  bakeWhitePorcelainArmorMaps,
  buildProceduralStudioEnvMap,
  type PbrFourMapSet,
} from './pbrMaterials.js';

export { ArenaStageAssembly } from './arenaBuilder.js';
export { SharedUnitGeometryPool, UnitMeshFactory, type UnitActorRig } from './unitMeshFactory.js';
export { StageVfxManager } from './vfxManager.js';
export { StageHudOverlayProjector } from './hudOverlayProjector.js';

export type {
  BoardStageEngineOptions,
  DamageFloatKind,
  StageDamageEvent,
  StageInteractionCallbacks,
  StageLootOrbState,
  StagePerfStats,
  StagePickResult,
  StageProjectileSpec,
  StageQualityTier,
  StageStatusFlags,
  StageUnitPlacement,
  StageUnitState,
  UnitScreenProjection,
} from './types.js';
