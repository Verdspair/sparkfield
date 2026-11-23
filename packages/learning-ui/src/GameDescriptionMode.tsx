import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { RichGameText } from './GameRichIcons.js';
import { ensureLearningUiStyles } from './learningUiStyles.js';

export type DescriptionDetailMode = 'compact' | 'detailed';

export const DESCRIPTION_DETAIL_MODE_STORAGE_KEY = 'sf_desc_detail_mode_v1';

export const COMPACT_ITEM_DESCRIPTIONS: Readonly<Record<string, string>> = {
  C_SWORD: '提升物理攻击力',
  C_BOW: '提升攻击速度',
  C_ROD: '提升技能效能',
  C_TEAR: '提升初始法力',
  C_VEST: '提升物理护甲',
  C_CLOAK: '提升魔法抗性',
  C_BELT: '提升最大生命',
  C_GLOVE: '提升暴击率',
  C_RUBBING: '合成派系纹章与远征战旗',
  C_SPATULA: '合成派系纹章与远征战旗',

  I_FUSION_BLADE: '纯物理基座，大幅提升攻击力',
  I_LORENTZ_RAIL: '普攻命中持续叠加攻速',
  I_MASS_CONVERTER: '技能伤害按比例转化为生命恢复',
  I_FUSION_IGNITER: '普攻命中额外回复法力，物理启动装',
  I_KEEL_FIELD: '低血触发强力护盾并加攻',
  I_HULL_BREAKER: '对高生命目标造成额外伤害',
  I_LIFE_AXE: '普攻与物理技能吸血，低血获短暂护盾',
  I_STRONG_CRIT_EDGE: '物理技能可暴击并提升暴伤',
  I_HYPER_SWARM: '大幅提升攻速并增加射程',
  I_PLASMA_SUBCANNON: '每第三次普攻附加额外魔法伤害',
  I_PULSE_ACCELERATOR: '每第三次普攻额外回复法力',
  I_ARMOR_PIERCER: '【物理破甲】普攻与物理技能降低目标护甲',
  I_SPECTRUM_MAG: '【双系破防】普攻降低目标魔抗',
  I_TACTICAL_EXO: '每第三次普攻恢复自身最大生命',
  I_LASER_SIGHT: '开战获伤害增幅，前几次普攻必暴击',
  I_STELLAR_CROWN: '纯法核基座，大幅提升技能效能',
  I_SUPERCOMP_ARRAY: '每次施法后额外回复法力',
  I_FARADAY_COAT: '受近身普攻时对邻格敌人反震魔法伤害',
  I_IONOSPHERE_RING: '【魔抗击碎】技能降低目标魔抗并震击施法敌军',
  I_FALLOUT_BRAND: '【法系重伤】技能施加持续灼烧与治疗削减',
  I_NON_EUCLID_LENS: '魔法技能可暴击并提升暴伤',
  I_ZERO_POINT_SPRING: '降低最大法力，参与击杀后获得增伤',
  I_POLAR_SHIELD_ARMOR: '开战及首次施法各获护盾，前排启动装',
  I_ZERO_STASIS_FILM: '【开场免控】开战免疫硬控并持续叠攻速',
  I_REVIVAL_PUMP: '施法后为自身与最近友军恢复生命',
  I_QUANTUM_TRIGGER: '获初始法力，低血时技能获得全能吸血',
  I_NEUTRON_PLATE: '高额护甲并降低所受普攻与暴击伤害',
  I_MAGNETOSPHERE_GARB: '受越多人锁定，叠加越多双抗',
  I_RED_GIANT_MAIL: '【前排重伤】周期灼烧邻格敌军并挂减疗',
  I_INERTIA_GAUNTLET: '普攻减缓目标攻速，半血以下获减伤',
  I_SLOW_FOG_CLOAK: '高额魔抗并降低所受技能魔法伤害',
  I_ECOSPHERE_FILM: '周期恢复自身生命，持盾时提升双抗',
  I_PHASE_TALISMAN: '【单次挡控】抵消首次硬控并立即回复法力',
  I_ONEILL_ARMOR: '大幅提升基础与百分比最大生命',
  I_DEADHAND_BELT: '低血时净化负面并获护盾与短暂免控',
  I_BLINDSPOT_LENS: '提升暴击率，溢出暴击率转为暴击伤害',

  E_DYSON: '佩戴者获得【戴森工团】派系羁绊',
  E_CLOUD: '佩戴者获得【云端星环】派系羁绊',
  E_DILATION: '佩戴者获得【钟慢远征】派系羁绊',
  E_EUROPA: '佩戴者获得【木卫冰海】派系羁绊',
  E_ARRAY: '佩戴者获得【深空阵列】派系羁绊',
  E_ANTIMATTER: '佩戴者获得【反物质院】派系羁绊',
  E_STARGATE: '佩戴者获得【星门摆渡】派系羁绊',
  E_SWARM: '佩戴者获得【失控蜂群】派系羁绊',

  I_MOTHERSHIP_FLAG: '提升上场人口上限',
  TOOL_MAGNETIC_REMOVER: '无损卸下棋子全部装备',
  TOOL_REFORGER: '将目标装备重铸为同阶其他装备',
  ANVIL_COMPONENT_3: '从三件基础散件中自选一件',
  ANVIL_COMPLETED_4: '从四件成装中自选一件',
};

export const COMPACT_AUGMENT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  AUG_S01: '立即获得金币与免费商店刷新',
  AUG_S02: '大幅提高休眠解冻属性加成并获二费弈子',
  AUG_S03: '立即获得重铸器与基础散件铁砧',
  AUG_S04: '后两排友军开战提升射程并获得增伤',
  AUG_S05: '前两排友军开战获得高额护盾',
  AUG_S06: '开战孤立站位的友军获得护盾与攻速',
  AUG_S07: '全队获得双抗与初始法力加成',
  AUG_S08: '每战首个低血友军立即恢复高额生命',
  AUG_G01: '获得队伍经验与散件铁砧，升级送免费刷新',
  AUG_G02: '获得整备金币，后续准备期获赠限时刷新',
  AUG_G03: '延长云端星环开战减伤，获星环弈子与防具',
  AUG_G04: '戴森工团回收护盾附带攻速并获工团弈子',
  AUG_G05: '钟慢远征孤立增伤对半孤立目标生效并获弈子',
  AUG_G06: '木卫冰海防辐射幕扩展至前排并获弈子与魔抗',
  AUG_G07: '扩大深空阵列焦点范围并获阵列弈子与法强',
  AUG_G08: '提前反物质院解限触发并获弈子与攻击散件',
  AUG_G09: '前排单坦获高额双抗，阵亡赋能全队攻速',
  AUG_G10: '立即获得成装铁砧与装备拆卸充能',
  AUG_P01: '获得星环拓片，每战定时降下全图伽马轰击',
  AUG_P02: '大幅提升购经验效率并立即获得金币',
  AUG_P03: '立即获得两座成装铁砧与重铸器',
  AUG_P04: '获得主派系纹章、契合成装与高费核心弈子',
  AUG_P05: '开战短暂缓速全场，己方获高额护盾与回蓝',
  AUG_P06: '友军阵亡时将部分攻击与效能平分给存活友军',
};

export const COMPACT_TRAIT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  戴森工团: '阵亡将护盾与法力传递给工团友军，高阶召唤日冕聚光镜',
  云端星环: '开战获高额减伤，单位低血触发全图过载脉冲并挂易伤',
  钟慢远征: '对孤立目标造成更高伤害，减员时吸收尾迹回血并叠攻速',
  木卫冰海: '后排降低暴击与范围伤害，周期为冰海单位提供护盾',
  深空阵列: '开战投射焦点削减高血区双抗，高阶降下伽马轰击并升法力',
  反物质院: '获得双穿，延迟解除磁约束净化控制并大幅增益至战末',
  星门摆渡: '开战获初始法力与移速，首次施法留下减速与灼烧航迹',
  失控蜂群: '开战抬升对位敌军法力上限，高阶免疫破防并斩杀残血',
  重装: '全队获双抗加成，重装单位大幅提升最大生命与开战减伤',
  矩阵: '开战获得护盾，大幅提升技能效能与护盾强度',
  磁轨: '获得高额攻速，连续普攻同一目标附带电磁穿甲弹片',
  光子: '全队提升技能效能，光子单位大幅增效并在施法后回蓝',
  维生: '提升治疗护盾效能，可将备战席弈子封入低温休眠舱养成',
  跃迁: '获得全能吸血且技能可暴击，对低血目标造成更高伤害',
  彭罗斯能层: '开战降低敌全体伤害，首次濒死锁血并引爆全图伽马射流',
  光锥错位: '前排激活近距重轰与吸血，后排无限射程狙杀敌最高伤主C',
  老舰不沉: '周期为最近友军主核校准火控，攻击与技能无视部分护盾双抗',
  事件视界: '战斗中段展开引力红移力场，削减敌军受到的治疗与护盾',
};

const TRAIT_ID_TO_NAME: Readonly<Record<string, string>> = {
  F_DYSON: '戴森工团',
  F_CLOUD: '云端星环',
  F_DILATION: '钟慢远征',
  F_EUROPA: '木卫冰海',
  F_ARRAY: '深空阵列',
  F_ANTIMATTER: '反物质院',
  F_STARGATE: '星门摆渡',
  F_SWARM: '失控蜂群',
  R_VANGUARD: '重装',
  R_MATRIX: '矩阵',
  R_RAILGUN: '磁轨',
  R_PHOTON: '光子',
  R_BIOCARE: '维生',
  R_WARP: '跃迁',
  U_PENROSE: '彭罗斯能层',
  U_LIGHTCONE: '光锥错位',
  U_OLD_SHIP: '老舰不沉',
  U_HORIZON: '事件视界',
};

export function readStoredDescriptionMode(): DescriptionDetailMode {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return 'compact';
  }
  try {
    const raw = window.localStorage.getItem(DESCRIPTION_DETAIL_MODE_STORAGE_KEY);
    return raw === 'detailed' ? 'detailed' : 'compact';
  } catch {
    return 'compact';
  }
}

export function writeStoredDescriptionMode(mode: DescriptionDetailMode): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(DESCRIPTION_DETAIL_MODE_STORAGE_KEY, mode);
  } catch {
    return;
  }
}

let memoryDescriptionMode: DescriptionDetailMode | null = null;
const descriptionModeListeners = new Set<() => void>();
let storageListenerAttached = false;

function ensureStorageListener(): void {
  if (storageListenerAttached || typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return;
  }
  storageListenerAttached = true;
  window.addEventListener('storage', (event) => {
    if (event.key !== DESCRIPTION_DETAIL_MODE_STORAGE_KEY) return;
    memoryDescriptionMode = event.newValue === 'detailed' ? 'detailed' : 'compact';
    for (const listener of descriptionModeListeners) {
      listener();
    }
  });
}

export function getGlobalDescriptionMode(): DescriptionDetailMode {
  if (memoryDescriptionMode !== null) {
    return memoryDescriptionMode;
  }
  return readStoredDescriptionMode();
}

export function setGlobalDescriptionMode(mode: DescriptionDetailMode): void {
  memoryDescriptionMode = mode;
  writeStoredDescriptionMode(mode);
  for (const listener of descriptionModeListeners) {
    listener();
  }
}

export function resetDescriptionModeForTests(): void {
  memoryDescriptionMode = null;
  for (const listener of descriptionModeListeners) {
    listener();
  }
}

function subscribeDescriptionMode(listener: () => void): () => void {
  ensureStorageListener();
  descriptionModeListeners.add(listener);
  return () => {
    descriptionModeListeners.delete(listener);
  };
}

export function summarizeCompactGameText(fullText: string): string {
  let s = fullText.trim();
  if (!s) return s;

  s = s.replace(/[（(][^）)]*(?:上限|不递归|遵守|纯物理|反重装|超快|下限|零伤害|不改变)[^）)]*[）)]/g, '');
  s = s.replace(/物理\s*[+＋]\s*吸血/g, '物理伤害与吸血');
  s = s.replace(/前\d+排/g, '前排');
  s = s.replace(/后\d+排/g, '后排');
  s = s.replace(/每[第]?\d+次/g, '连续');
  s = s.replace(/第\d+秒/g, '定时');
  s = s.replace(/\d+(?:\.\d+)?秒后/g, '短暂延迟后');
  s = s.replace(/(?:持续|内置)?[+-]?\d+(?:\.\d+)?秒(?:内)?/g, '');
  s = s.replace(/及\d+名邻敌/g, '及邻敌');
  s = s.replace(/最密集敌群最多\d+人/g, '最密集敌群');
  s = s.replace(/(?:最多|至多|至少|相邻)?\d+(?:[/-]\d+)*名?(?=友军|敌军|敌人|不同敌人|敌|邻敌|目标|友)/g, '多名');
  s = s.replace(/\d+(?:\.\d+)?格(?:内)?/g, '');
  s = s.replace(/下次技能效能\s*[+＋]\d+(?:\.\d+)?%?/g, '下次技能效能提高');
  s = s.replace(/使其受伤害\s*[+＋]\d+(?:\.\d+)?%?/g, '使其受到伤害提高');
  s = s.replace(/伤害\s*[+＋]\d+(?:\.\d+)?%?/g, '伤害提高');
  s = s.replace(/单目标\s*[+＋]\d+(?:\.\d+)?%?/g, '单目标伤害提高');
  s = s.replace(/全队\s*[+＋]\d+(?:\.\d+)?%?\s*攻速与\s*\d+(?:\.\d+)?P?\s*盾/g, '全队提升攻速并获得护盾');
  s = s.replace(/击杀返\s*\d+(?:\.\d+)?\s*法力/g, '击杀返还法力');
  s = s.replace(/向锥形区倾泻\d+波弹幕/g, '向锥形区倾泻多波弹幕');
  s = s.replace(/高速连射\d+波/g, '高速连射多波');
  s = s.replace(
    /射出\d+枚光子鱼雷，每枚\s*\d+(?:\.\d+)?P?\s*物理\s*[+＋]\s*\d+(?:\.\d+)?P?\s*魔法溅射/g,
    '射出多枚光子鱼雷造成物理与魔法溅射伤害',
  );
  s = s.replace(/邻格溅射\s*\d+(?:\.\d+)?P?/g, '并对邻格造成溅射伤害');
  s = s.replace(/[+-]?\d+(?:\.\d+)?%?[PG]?(?:\/[+-]?\d+(?:\.\d+)?%?[PG]?)*/g, '');
  s = s.replace(/[（(]\s*[+＋、,，/]*\s*[）)]/g, '');
  s = s.replace(/[（(]\s*([^）)]+?)\s*[）)]/g, '，$1');
  s = s.replace(/恢复实际伤害的?/g, '按实际伤害恢复');
  s = s.replace(/治疗最近多名友军生命/g, '治疗最近多名友军');
  s = s.replace(/治疗最低血多名友军/g, '治疗最低血多名友军');
  s = s.replace(/恢复最低血友军生命/g, '恢复最低血友军生命');
  s = s.replace(/修复生命最低友军生命/g, '修复生命最低友军生命');
  s = s.replace(/使自身及身后友军获双抗/g, '为自身与身后友军提升双抗');
  s = s.replace(/并加双抗/g, '并提升双抗');
  s = s.replace(/获护盾量/g, '获盾量');
  s = s.replace(/获护盾/g, '获得护盾');
  s = s.replace(/获巨盾/g, '获得巨盾');
  s = s.replace(/获盾(?!量)/g, '获得护盾');
  s = s.replace(/获双抗/g, '获得双抗');
  s = s.replace(/获防辐射装甲盾/g, '获得防辐射装甲盾');
  s = s.replace(/对沿途多名敌依次造成/g, '对沿途多名敌军依次造成递减');
  s = s.replace(/对目标及邻格多名敌造成/g, '对目标及邻格多名敌军造成');
  s = s.replace(/轰击前中排多名敌/g, '轰击前中排多名敌军');
  s = s.replace(/共造成魔法伤害/g, '造成多段魔法伤害');
  s = s.replace(/每波物理伤害/g, '每波造成物理伤害');
  s = s.replace(/主目标物理伤害/g, '主目标造成物理伤害');
  s = s.replace(/点魔法伤害/g, '魔法伤害');
  s = s.replace(/各魔法伤害/g, '各造成魔法伤害');
  s = s.replace(/，物理伤害与吸血/g, '，造成物理伤害与吸血');
  s = s.replace(/\s*[+＋]\s*/g, '与');
  s = s.replace(/[、/]{2,}/g, '、');
  s = s.replace(/，+/g, '，');
  s = s.replace(/；+/g, '；');
  s = s.replace(/：+/g, '：');
  s = s.replace(/^[，；。、\s]+/g, '');
  s = s.replace(/([，；])\s*([。；])/g, '$2');
  s = s.replace(/：\s*。/g, '。');

  const trimmed = s.trim();
  return trimmed || fullText;
}

export interface ResolveGameEffectTextInput {
  readonly itemId?: string;
  readonly augmentId?: string;
  readonly traitName?: string;
  readonly fullText: string;
  readonly shortText?: string;
  readonly mode: DescriptionDetailMode;
}

export function resolveGameEffectText({
  itemId,
  augmentId,
  traitName,
  fullText,
  shortText,
  mode,
}: ResolveGameEffectTextInput): string {
  if (mode === 'detailed') {
    return fullText;
  }
  if (shortText) {
    return shortText;
  }
  if (itemId) {
    const normalizedItemId = itemId === 'C_SPATULA' ? 'C_RUBBING' : itemId;
    const itemCompact = COMPACT_ITEM_DESCRIPTIONS[normalizedItemId];
    if (itemCompact) return itemCompact;
  }
  if (augmentId) {
    const augCompact = COMPACT_AUGMENT_DESCRIPTIONS[augmentId];
    if (augCompact) return augCompact;
  }
  if (traitName) {
    const resolvedTraitName = TRAIT_ID_TO_NAME[traitName] ?? traitName;
    const traitCompact = COMPACT_TRAIT_DESCRIPTIONS[resolvedTraitName];
    if (traitCompact) return traitCompact;
  }
  return summarizeCompactGameText(fullText);
}

export interface DescriptionModeContextValue {
  readonly mode: DescriptionDetailMode;
  readonly isDetailed: boolean;
  readonly setMode: (mode: DescriptionDetailMode) => void;
  readonly toggleMode: () => void;
}

const DescriptionModeContext = createContext<DescriptionModeContextValue | null>(null);

export interface DescriptionModeProviderProps {
  readonly children: React.ReactNode;
  readonly initialMode?: DescriptionDetailMode;
}

export function DescriptionModeProvider({
  children,
  initialMode,
}: DescriptionModeProviderProps): React.JSX.Element {
  const globalMode = useSyncExternalStore(
    subscribeDescriptionMode,
    getGlobalDescriptionMode,
    readStoredDescriptionMode,
  );
  const [isolatedMode, setIsolatedMode] = useState<DescriptionDetailMode | undefined>(initialMode);

  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  useEffect(() => {
    if (initialMode !== undefined) {
      setIsolatedMode(initialMode);
    }
  }, [initialMode]);

  const mode = initialMode !== undefined ? (isolatedMode ?? initialMode) : globalMode;

  const setMode = useCallback(
    (next: DescriptionDetailMode) => {
      if (initialMode !== undefined) {
        setIsolatedMode(next);
        writeStoredDescriptionMode(next);
        return;
      }
      setGlobalDescriptionMode(next);
    },
    [initialMode],
  );

  const toggleMode = useCallback(() => {
    setMode(mode === 'compact' ? 'detailed' : 'compact');
  }, [mode, setMode]);

  const value = useMemo<DescriptionModeContextValue>(
    () => ({
      mode,
      isDetailed: mode === 'detailed',
      setMode,
      toggleMode,
    }),
    [mode, setMode, toggleMode],
  );

  return (
    <DescriptionModeContext.Provider value={value}>
      {children}
    </DescriptionModeContext.Provider>
  );
}

export function useDescriptionMode(): DescriptionModeContextValue {
  const ctx = useContext(DescriptionModeContext);
  const globalMode = useSyncExternalStore(
    subscribeDescriptionMode,
    getGlobalDescriptionMode,
    readStoredDescriptionMode,
  );

  const setMode = useCallback((next: DescriptionDetailMode) => {
    setGlobalDescriptionMode(next);
  }, []);

  const toggleMode = useCallback(() => {
    setGlobalDescriptionMode(getGlobalDescriptionMode() === 'compact' ? 'detailed' : 'compact');
  }, []);

  return useMemo<DescriptionModeContextValue>(() => {
    if (ctx) return ctx;
    return {
      mode: globalMode,
      isDetailed: globalMode === 'detailed',
      setMode,
      toggleMode,
    };
  }, [ctx, globalMode, setMode, toggleMode]);
}

export interface DescriptionModeToggleProps {
  readonly size?: 'xs' | 'sm';
  readonly className?: string;
}

export function DescriptionModeToggle({
  size = 'sm',
  className = '',
}: DescriptionModeToggleProps): React.JSX.Element {
  useEffect(() => {
    ensureLearningUiStyles();
  }, []);

  const { mode, isDetailed, toggleMode } = useDescriptionMode();

  return (
    <button
      type="button"
      className={`lui-desc-toggle lui-desc-toggle--${size} ${
        isDetailed ? 'lui-desc-toggle--detailed' : ''
      } ${className}`.trim()}
      data-testid="desc-mode-toggle-btn"
      data-desc-mode={mode}
      aria-pressed={isDetailed}
      aria-label={isDetailed ? '切换为简洁缩略描述' : '切换为详细数值描述'}
      title={isDetailed ? '当前：详细数值（点击全局切换简洁）' : '当前：简洁缩略（点击全局切换详细）'}
      onClick={(e) => {
        e.stopPropagation();
        toggleMode();
      }}
    >
      <svg
        className="lui-desc-toggle__icon"
        width={size === 'xs' ? 11 : 12}
        height={size === 'xs' ? 11 : 12}
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        {isDetailed ? (
          <path
            d="M3.5 6L8 10.5L12.5 6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M6 3.5L10.5 8L6 12.5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span>{isDetailed ? '简洁' : '详细'}</span>
    </button>
  );
}

export interface GameEffectTextProps {
  readonly itemId?: string;
  readonly augmentId?: string;
  readonly traitName?: string;
  readonly fullText: string;
  readonly shortText?: string;
  readonly className?: string;
}

export function GameEffectText({
  itemId,
  augmentId,
  traitName,
  fullText,
  shortText,
  className = '',
}: GameEffectTextProps): React.JSX.Element {
  const { mode } = useDescriptionMode();
  const resolved = useMemo(
    () =>
      resolveGameEffectText({
        itemId,
        augmentId,
        traitName,
        fullText,
        shortText,
        mode,
      }),
    [augmentId, fullText, itemId, mode, shortText, traitName],
  );

  return <RichGameText text={resolved} className={className} />;
}
