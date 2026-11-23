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
  C_RUBBING: '合成纹章与远征战旗',
  C_SPATULA: '合成纹章与远征战旗',
  I_FUSION_BLADE: '纯物理基座，大幅提升攻击力',
  I_LORENTZ_RAIL: '普攻命中持续叠加攻速',
  I_MASS_CONVERTER: '技能伤害按比例回血',
  I_FUSION_IGNITER: '普攻额外回蓝，物理启动装',
  I_KEEL_FIELD: '低血触发强力护盾并加攻',
  I_HULL_BREAKER: '对高生命目标造成额外伤害',
  I_LIFE_AXE: '物理吸血，低血获短暂护盾',
  I_STRONG_CRIT_EDGE: '物理技能可暴击并提暴伤',
  I_HYPER_SWARM: '大幅提升攻速并增加射程',
  I_PLASMA_SUBCANNON: '周期普攻附带额外魔法伤害',
  I_PULSE_ACCELERATOR: '周期普攻额外回复法力',
  I_ARMOR_PIERCER: '物理破甲：普攻与技能降护甲',
  I_SPECTRUM_MAG: '双系破防：普攻降敌魔抗',
  I_TACTICAL_EXO: '周期普攻按最大生命回血',
  I_LASER_SIGHT: '开战增伤，起手普攻必暴击',
  I_STELLAR_CROWN: '纯法核基座，大幅提技能效能',
  I_SUPERCOMP_ARRAY: '每次施法后额外回复法力',
  I_FARADAY_COAT: '受近身普攻反震魔法伤害',
  I_IONOSPHERE_RING: '魔抗击碎：降魔抗并震施法敌',
  I_FALLOUT_BRAND: '法系重伤：技能灼烧并减疗',
  I_NON_EUCLID_LENS: '魔法技能可暴击并提暴伤',
  I_ZERO_POINT_SPRING: '降最大法力，参与击杀增伤',
  I_POLAR_SHIELD_ARMOR: '开战与首施各获盾，前排装',
  I_ZERO_STASIS_FILM: '开场免控并持续叠加攻速',
  I_REVIVAL_PUMP: '施法治疗自身与最近友军',
  I_QUANTUM_TRIGGER: '初始法力，低血技能全能吸血',
  I_NEUTRON_PLATE: '高额护甲并减免普攻暴伤',
  I_MAGNETOSPHERE_GARB: '受越多敌人锁定，叠加双抗',
  I_RED_GIANT_MAIL: '前排重伤：周期灼烧邻敌减疗',
  I_INERTIA_GAUNTLET: '普攻降敌攻速，半血获减伤',
  I_SLOW_FOG_CLOAK: '高额魔抗并减免技能法伤',
  I_ECOSPHERE_FILM: '周期回血，持盾时提升双抗',
  I_PHASE_TALISMAN: '抵消首次硬控并立即回蓝',
  I_ONEILL_ARMOR: '大幅提升基础与百分比生命',
  I_DEADHAND_BELT: '低血净化负面并获盾免控',
  I_BLINDSPOT_LENS: '提暴击，溢出暴击转暴伤',
  E_DYSON: '获得【戴森工团】羁绊',
  E_CLOUD: '获得【云端星环】羁绊',
  E_DILATION: '获得【钟慢远征】羁绊',
  E_EUROPA: '获得【木卫冰海】羁绊',
  E_ARRAY: '获得【深空阵列】羁绊',
  E_ANTIMATTER: '获得【反物质院】羁绊',
  E_STARGATE: '获得【星门摆渡】羁绊',
  E_SWARM: '获得【失控蜂群】羁绊',
  I_MOTHERSHIP_FLAG: '提升上场人口上限',
  TOOL_MAGNETIC_REMOVER: '无损卸下棋子全部装备',
  TOOL_REFORGER: '将装备重铸为同阶其他装备',
  ANVIL_COMPONENT_3: '从散件中自选一件',
  ANVIL_COMPLETED_4: '从成装中自选一件',
};

export const COMPACT_AUGMENT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  AUG_S01: '立即获得金币与免费刷新',
  AUG_S02: '大幅强化休眠加成并获二费子',
  AUG_S03: '获得重铸器与散件铁砧',
  AUG_S04: '后两排开战增射程并获增伤',
  AUG_S05: '前两排友军开战获得高额护盾',
  AUG_S06: '孤立友军开战获护盾与攻速',
  AUG_S07: '全队获得双抗与初始法力',
  AUG_S08: '首个低血友军立即大额回血',
  AUG_G01: '获经验散件铁砧，升级送刷新',
  AUG_G02: '立即获金币并逐轮送限时刷新',
  AUG_G03: '延长星环减伤并获弈子防具',
  AUG_G04: '工团传盾附带攻速并获弈子',
  AUG_G05: '半孤立也触发远征增伤并获子',
  AUG_G06: '冰海护盾扩至前排并获子魔抗',
  AUG_G07: '扩大阵列焦点并获弈子法强',
  AUG_G08: '反物质提前解限并获子与攻装',
  AUG_G09: '单坦获高双抗，阵亡提全队攻速',
  AUG_G10: '获成装铁砧与装备拆卸充能',
  AUG_P01: '获星环拓片并定时全图轰击',
  AUG_P02: '大幅降经验成本并立即获金币',
  AUG_P03: '获两座成装铁砧与重铸器',
  AUG_P04: '获主派系纹章、成装与高费子',
  AUG_P05: '开战缓速全场，己方获盾回蓝',
  AUG_P06: '友军阵亡平分攻击效能给队友',
};

export const COMPACT_TRAIT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  戴森工团: '阵亡传盾回蓝，高阶招聚光镜',
  云端星环: '开战减伤，低血触发全图脉冲',
  钟慢远征: '打孤立增伤，减员吸尾迹回血',
  木卫冰海: '后排抗爆伤，周期全员获护盾',
  深空阵列: '聚焦削减双抗，高阶伽马轰击',
  反物质院: '双穿，延迟净化控制并大幅增益',
  星门摆渡: '开战回蓝加速，首施留灼烧带',
  失控蜂群: '抬敌法力上限，高阶免破斩杀',
  重装: '全队加双抗，重装高血并减伤',
  矩阵: '开战获护盾，大幅提效能与盾量',
  磁轨: '高额攻速，连击附带破甲弹片',
  光子: '提技能效能，光子施法后回蓝',
  维生: '提治疗护盾，可低温休眠养成',
  跃迁: '全能吸血与技能暴击，斩低血',
  彭罗斯能层: '降敌全伤，濒死锁血引爆射流',
  光锥错位: '前排重轰吸血，后排无限狙杀',
  老舰不沉: '周期校准主核，无视部分护盾',
  事件视界: '展开红移力场，削减敌军治疗',
};

export const COMPACT_UNIT_SKILL_DESCRIPTIONS: Readonly<Record<string, string>> = {
  S01: '自获护盾并减免普攻',
  S02: '治疗低血友军并加双抗',
  S03: '切入侧翼物理伤害并削盾',
  S04: '电浆弹连击双敌魔法伤害',
  S05: '治疗双友军并提技能效能',
  S06: '范围魔法伤害并减攻速',
  S07: '治疗低血友军并解减速',
  S08: '横扫双敌物理伤害并重伤',
  S09: '直线穿透，造成物理伤害',
  S10: '单体物理重击并自获护盾',
  S11: '自身与相邻友军获护盾',
  S12: '前排友军获护盾并提攻速',
  S13: '切入物理伤害并击碎护盾',
  S14: '切入物理斩击并吸血回复',
  S15: '自疗并提升自身后排双抗',
  S16: '范围魔法灼烧并削减魔抗',
  S17: '范围魔法轰击，单敌增伤',
  S18: '标记敌易伤并助友军回蓝',
  S19: '电浆束连跳三敌魔法伤害',
  S20: '单体物理重创并溅射邻敌',
  S21: '光子脉冲弹射三敌法伤',
  S22: '虫群范围物理伤害并减速',
  S23: '浮游炮物理齐射，孤立增伤',
  S24: '多波物理连射并叠攻速',
  S25: '自获护盾并震击前方敌军',
  S26: '安全滑步并连射双鱼雷',
  S27: '获巨盾嘲讽邻敌并震击',
  S28: '重锤物理眩晕并击碎护甲',
  S29: '锥形物理连射，击杀回蓝',
  S30: '双区范围魔法伤害轰击',
  S31: '群疗三友，全队获盾提速',
  S32: '连续折线贯穿物理并获盾',
  S33: '延迟全图法伤并挂易伤',
  S34: '前排物理重击，后排狙杀',
  S35: '前排获盾并降下物理重炮',
  S36: '范围法伤，持续百分比灼烧',
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
  readonly unitId?: string;
  readonly itemId?: string;
  readonly augmentId?: string;
  readonly traitName?: string;
  readonly fullText: string;
  readonly shortText?: string;
  readonly mode: DescriptionDetailMode;
}

export function resolveGameEffectText({
  unitId,
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
  if (unitId) {
    const unitCompact = COMPACT_UNIT_SKILL_DESCRIPTIONS[unitId];
    if (unitCompact) return unitCompact;
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
      role="switch"
      className={`lui-desc-toggle lui-desc-toggle--${size} ${
        isDetailed ? 'lui-desc-toggle--detailed' : ''
      } ${className}`.trim()}
      data-testid="desc-mode-toggle-btn"
      data-desc-mode={mode}
      aria-checked={isDetailed}
      aria-label={isDetailed ? '切换为简洁缩略描述' : '切换为详细数值描述'}
      title={isDetailed ? '当前：详细数值（点击全局切换简洁）' : '当前：简洁缩略（点击全局切换详细）'}
      onClick={(e) => {
        e.stopPropagation();
        toggleMode();
      }}
    >
      <span className="lui-desc-toggle__label">{size === 'sm' ? '详细说明' : '详细'}</span>
      <span className="lui-desc-toggle__track" aria-hidden="true">
        <span className="lui-desc-toggle__thumb" />
      </span>
    </button>
  );
}

export interface GameEffectTextProps {
  readonly unitId?: string;
  readonly itemId?: string;
  readonly augmentId?: string;
  readonly traitName?: string;
  readonly fullText: string;
  readonly shortText?: string;
  readonly className?: string;
}

export function GameEffectText({
  unitId,
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
        unitId,
        itemId,
        augmentId,
        traitName,
        fullText,
        shortText,
        mode,
      }),
    [augmentId, fullText, itemId, mode, shortText, traitName, unitId],
  );

  return <RichGameText text={resolved} className={className} />;
}
