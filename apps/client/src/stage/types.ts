import type {
  ArenaThemeId,
  AudioEventBus,
  HexCoord,
  MatchPhaseKind,
  UnitLocation,
  UnitStar,
} from '@pkg/contracts';

export type StageQualityTier = 'high' | 'balanced';

export type StageSceneMode = 'splash' | 'lobby' | 'prep' | 'match' | 'subpage';

export type TacticianId =
  | 'tactician_lumina_bell'
  | 'tactician_europa_fin'
  | 'tactician_singularity_mew';

export type TacticianEmoteKind = 'tap' | 'cheer' | 'collect_orb';

export type ShopCameraLayout = 'bottom_open' | 'top_or_collapsed';

export type DamageFloatKind = 'physical' | 'magic' | 'true';

export interface StageStatusFlags {
  readonly antiHeal?: boolean;
  readonly armorShred?: boolean;
  readonly mrShred?: boolean;
  readonly ccImmune?: boolean;
}

export type StageUnitPlacement =
  | {
      readonly zone: 'board';
      readonly row: number;
      readonly col: number;
      readonly coordSpace?: 'full8x7' | 'deploy4x7';
    }
  | {
      readonly zone: 'bench';
      readonly slot: number;
    };

export interface StageUnitState {
  readonly instanceId: string;
  readonly unitId: string;
  readonly star: UnitStar;
  readonly allegiance: 'ally' | 'enemy';
  readonly seatIndex?: number;
  readonly location: StageUnitPlacement;
  readonly worldOverride?: { readonly x: number; readonly z: number; readonly y?: number };
  readonly facingRad?: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly shield?: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly items?: readonly string[];
  readonly statuses?: StageStatusFlags;
}

export interface StageLootOrbState {
  readonly orbId: string;
  readonly goldAmount: number;
  readonly row: number;
  readonly col: number;
}

export type StagePickResult =
  | {
      readonly kind: 'board_hex';
      readonly row: number;
      readonly col: number;
      readonly deployRow: number | null;
      readonly worldX: number;
      readonly worldZ: number;
      readonly unitInstanceId: string | null;
    }
  | {
      readonly kind: 'bench_slot';
      readonly slot: number;
      readonly worldX: number;
      readonly worldZ: number;
      readonly unitInstanceId: string | null;
    }
  | {
      readonly kind: 'loot_orb';
      readonly orbId: string;
      readonly goldAmount: number;
      readonly worldX: number;
      readonly worldZ: number;
    }
  | {
      readonly kind: 'sell_zone';
      readonly worldX: number;
      readonly worldZ: number;
    }
  | {
      readonly kind: 'deck_ground';
      readonly worldX: number;
      readonly worldZ: number;
    };

export interface StageDamageEvent {
  readonly targetInstanceId?: string;
  readonly worldPos?: { readonly x: number; readonly y: number; readonly z: number };
  readonly amount: number;
  readonly kind: DamageFloatKind;
  readonly isCrit?: boolean;
}

export interface StageProjectileSpec {
  readonly projectileId?: string;
  readonly fromInstanceId?: string;
  readonly toInstanceId?: string;
  readonly fromWorld?: { readonly x: number; readonly y: number; readonly z: number };
  readonly toWorld?: { readonly x: number; readonly y: number; readonly z: number };
  readonly damageKind?: DamageFloatKind;
  readonly speedUnitsPerSec?: number;
  readonly arcHeight?: number;
}

export interface UnitScreenProjection {
  readonly instanceId: string;
  readonly unitId: string;
  readonly allegiance: 'ally' | 'enemy';
  readonly star: UnitStar;
  readonly screenX: number;
  readonly screenY: number;
  readonly visible: boolean;
  readonly hp: number;
  readonly maxHp: number;
  readonly ghostHp: number;
  readonly shield: number;
  readonly mana: number;
  readonly maxMana: number;
  readonly statuses: Required<StageStatusFlags>;
}

export interface StagePerfStats {
  readonly drawCalls: number;
  readonly triangles: number;
  readonly textures: number;
  readonly geometries: number;
  readonly loopPaused: boolean;
  readonly webglAvailable: boolean;
  readonly fpsEstimate: number;
  readonly sceneMode?: StageSceneMode;
}

export interface StageInteractionCallbacks {
  readonly onMoveUnit?: (
    instanceId: string,
    to: UnitLocation,
    resolvedBoardHex: HexCoord | null,
  ) => void;
  readonly onSellUnitRequest?: (instanceId: string) => void;
  readonly onCollectLootOrb?: (orbId: string, goldAmount: number) => void;
  readonly onInspectUnit?: (
    instanceId: string | null,
    screenPos?: { readonly x: number; readonly y: number },
  ) => void;
  readonly onDragStateChange?: (draggingInstanceId: string | null, overSellZone: boolean) => void;
  readonly onTacticianTap?: (tacticianId: TacticianId, variant: number) => void;
}

export interface BoardStageEngineOptions {
  readonly initialTheme?: ArenaThemeId;
  readonly initialPhase?: MatchPhaseKind;
  readonly initialSceneMode?: StageSceneMode;
  readonly initialTacticianId?: TacticianId;
  readonly initialShopCameraLayout?: ShopCameraLayout;
  readonly qualityTier?: StageQualityTier;
  readonly showBuiltInHudOverlay?: boolean;
  readonly interactiveDeployEnabled?: boolean;
  readonly audioBus?: AudioEventBus | null;
  readonly callbacks?: StageInteractionCallbacks;
}
