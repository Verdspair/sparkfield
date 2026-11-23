import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SEASON1_AUGMENTS,
  SEASON1_ITEMS,
  SEASON1_TRAITS,
  SEASON1_UNITS,
  type ClientQuestionView,
  type LearningArcMeta,
} from '@pkg/contracts';
import {
  COMPACT_AUGMENT_DESCRIPTIONS,
  COMPACT_ITEM_DESCRIPTIONS,
  COMPACT_TRAIT_DESCRIPTIONS,
  DESCRIPTION_DETAIL_MODE_STORAGE_KEY,
  DescriptionModeProvider,
  DescriptionModeToggle,
  GameEffectText,
  LEARNING_READING_THEME_STORAGE_KEY,
  LEARNING_UI_CSS,
  LoreArchiveReader,
  MarkdownKatexBlock,
  QuestionStepCard,
  RecommendedItemsTree,
  UnitLoreDrawer,
  getGlobalDescriptionMode,
  readStoredDescriptionMode,
  readStoredReadingTheme,
  renderMarkdownWithKatexToHtml,
  resetDescriptionModeForTests,
  setGlobalDescriptionMode,
  summarizeCompactGameText,
  writeStoredDescriptionMode,
  writeStoredReadingTheme,
} from '../src/index.js';

function makeBaseQuestion(overrides: Partial<ClientQuestionView>): ClientQuestionView {
  return {
    questionId: 'Q_TEST_01',
    familyId: 'FAM_TEST_01',
    subject: 'math',
    knowledgeNode: 'MATH_N1_QUADRATIC',
    stepRole: 'practice',
    questionType: 'single_choice',
    assessmentKind: 'application',
    allowMaterialReview: true,
    materialMd: '### 参考公式卡\n对称轴：$x = -\\frac{b}{2a}$',
    stemMd: '求二次函数 $f(x) = -2x^2 + 8x - 3$ 的对称轴：',
    options: [
      { key: 'A', text: '$x = -2$' },
      { key: 'B', text: '$x = 2$' },
    ],
    matchingLeft: [],
    matchingRight: [],
    stepsRubric: [],
    hintMd: '先确定 $a=-2, b=8$。',
    difficulty: 2,
    weight: 10,
    estSeconds: 30,
    sourceLicense: 'original_test',
    audioRefOptional: null,
    ...overrides,
  };
}

afterEach(() => {
  resetDescriptionModeForTests();
  if ('window' in globalThis) {
    delete (globalThis as { window?: unknown }).window;
  }
});

describe('@pkg/learning-ui', () => {
  it('renders headings, blockquotes, code blocks, and inline/display KaTeX safely', () => {
    const html = renderMarkdownWithKatexToHtml(
      '### 标题\n> **注意**\n```ts\nconst x = $notMath;\n```\n行内 $a_n = a_1 + (n-1)d$ 与块级：\n$$S_n = \\frac{n(a_1+a_n)}{2}$$',
    );
    expect(html).toContain('<h3>标题</h3>');
    expect(html).toContain('<blockquote><strong>注意</strong></blockquote>');
    expect(html).toContain('const x = $notMath;');
    expect(html).toContain('katex');
    expect(html).toContain('lui-katex-block');

    const markup = renderToStaticMarkup(<MarkdownKatexBlock content="向量 $\vec{a}\perp\vec{b}$" />);
    expect(markup).toContain('katex');
  });

  it('defaults to matte slate cosmos theme and supports warm parchment localStorage persistence', () => {
    expect(readStoredReadingTheme()).toBe('cosmos');

    const defaultHtml = renderToStaticMarkup(
      <QuestionStepCard
        stepKind="material"
        lessonTitle="核心概念导学"
        lessonMaterialMd="### 导学要点\n- 聚焦关键步骤"
        sharedRemainingSeconds={12}
        sharedTotalSeconds={60}
        variant="overlay"
      />,
    );
    expect(defaultHtml).toContain('data-reading-theme="cosmos"');
    expect(defaultHtml).toContain('lui-paper-shell--cosmos');
    expect(defaultHtml).toContain('data-testid="learning-theme-toggle"');
    expect(defaultHtml).toContain('切换至暖羊皮纸护眼态');
    expect(defaultHtml).toContain('lui-clock-box--urgent');
    expect(defaultHtml).toContain('lui-briefing-title');
    expect(defaultHtml).toContain('导学');
    expect(defaultHtml).toContain('练习');
    expect(defaultHtml).toContain('测验');
    expect(defaultHtml).toContain('订正');
    expect(defaultHtml).toContain('巩固');

    const storageMap = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        localStorage: {
          getItem: (k: string) => storageMap.get(k) ?? null,
          setItem: (k: string, v: string) => {
            storageMap.set(k, v);
          },
        },
      },
    });

    writeStoredReadingTheme('parchment');
    expect(storageMap.get(LEARNING_READING_THEME_STORAGE_KEY)).toBe('parchment');
    expect(readStoredReadingTheme()).toBe('parchment');

    const parchmentHtml = renderToStaticMarkup(
      <QuestionStepCard
        question={makeBaseQuestion({})}
        feedback={{ isCorrect: true, explanationMd: '对称轴公式计算无误。' }}
      />,
    );
    expect(parchmentHtml).toContain('data-reading-theme="parchment"');
    expect(parchmentHtml).toContain('lui-paper-shell--parchment');
    expect(parchmentHtml).toContain('切换至深空星图护眼态');
    expect(parchmentHtml).toContain('lui-option-diamond-frame');
    expect(parchmentHtml).toContain('回答正确');

    expect(LEARNING_UI_CSS).toContain('--lui-shell-bg: var(--sf-surface-elevated,');
    expect(LEARNING_UI_CSS).toContain('--lui-ink-primary: var(--text-primary, #f2f5fa);');
    expect(LEARNING_UI_CSS).toContain('#eae4d6');
    expect(LEARNING_UI_CSS).toContain('height: auto;');
    expect(LEARNING_UI_CSS).not.toContain('height: min(76vh');
  });

  it('enforces strict permission isolation across practice, resource_check, and verification', () => {
    const practiceHtml = renderToStaticMarkup(
      <QuestionStepCard
        question={makeBaseQuestion({
          stepRole: 'practice',
          allowMaterialReview: true,
          audioRefOptional: null,
        })}
        sharedRemainingSeconds={95}
      />,
    );
    expect(practiceHtml).toContain('data-testid="toggle-hint-btn"');
    expect(practiceHtml).not.toContain('data-testid="skip-question-btn"');
    expect(practiceHtml).toContain('data-testid="material-review-drawer"');
    expect(practiceHtml).not.toContain('data-testid="lesson-audio-btn"');
    expect(practiceHtml).toContain('01:35');
    expect(practiceHtml).not.toContain('MATH_N1_QUADRATIC');
    expect(practiceHtml).not.toContain('全房节点截止');
    expect(practiceHtml).not.toContain('[查看解题提示]');
    expect(practiceHtml).toContain('aria-label="学习进度"');

    const resourceRetrievalHtml = renderToStaticMarkup(
      <QuestionStepCard
        question={makeBaseQuestion({
          stepRole: 'resource_check',
          assessmentKind: 'retrieval',
          allowMaterialReview: false,
          hintMd: '即便残留提示文本也绝不可渲染按钮',
          audioRefOptional: 'audio/eng_q02.ogg',
        })}
      />,
    );
    expect(resourceRetrievalHtml).not.toContain('data-testid="toggle-hint-btn"');
    expect(resourceRetrievalHtml).toContain('data-testid="skip-question-btn"');
    expect(resourceRetrievalHtml).toContain('data-testid="material-locked-badge"');
    expect(resourceRetrievalHtml).not.toContain('data-testid="material-review-drawer"');
    expect(resourceRetrievalHtml).toContain('data-testid="lesson-audio-btn"');

    const waitingHtml = renderToStaticMarkup(
      <QuestionStepCard
        isWaitingForRoomDeadline
        sharedRemainingSeconds={42}
        variant="overlay"
      />,
    );
    expect(waitingHtml).toContain('全房统一截止后进入下一策略期');
  });

  it('renders all 6 interactive question types cleanly', () => {
    const types: ClientQuestionView[] = [
      makeBaseQuestion({ questionType: 'single_choice' }),
      makeBaseQuestion({ questionType: 'multi_choice' }),
      makeBaseQuestion({
        questionType: 'matching',
        matchingLeft: ['deadline', 'spare part'],
        matchingRight: ['备件', '截止时间'],
      }),
      makeBaseQuestion({ questionType: 'short_fill' }),
      makeBaseQuestion({ questionType: 'numeric' }),
      makeBaseQuestion({
        questionType: 'multi_step_numeric',
        stepsRubric: [
          { stepId: 'a7', prompt: '求 $a_7$', weightShare: 0.4 },
          { stepId: 's7', prompt: '求 $S_7$', weightShare: 0.6 },
        ],
      }),
    ];

    const combined = types.map((q) => renderToStaticMarkup(<QuestionStepCard question={q} />)).join('\n');
    expect(combined).toContain('data-testid="matching-board"');
    expect(combined).toContain('data-testid="short-fill-input"');
    expect(combined).toContain('data-testid="numeric-input"');
    expect(combined).toContain('data-testid="multistep-input-a7"');
    expect(combined).toContain('data-testid="multistep-input-s7"');
  });

  it('renders LoreArchiveReader chronicle, UnitLoreDrawer, and RecommendedItemsTree', () => {
    const loreHtml = renderToStaticMarkup(<LoreArchiveReader />);
    expect(loreHtml).toContain('光锥之外');
    expect(loreHtml).toContain('灰雪纪');
    expect(loreHtml).toContain('视界纪');

    const drawerOverviewHtml = renderToStaticMarkup(
      <UnitLoreDrawer unitId="S36" initialTab="overview" highestStarUnlocked={3} />,
    );
    expect(drawerOverviewHtml).toContain('data-cost-tier="5"');
    expect(drawerOverviewHtml).toContain('lui-cost-badge--5');
    expect(drawerOverviewHtml).toContain('lui-badge--stars');
    expect(drawerOverviewHtml).toContain('★★★');
    expect(drawerOverviewHtml).toContain('lui-stat-grid');

    const drawerVoicesHtml = renderToStaticMarkup(
      <UnitLoreDrawer unitId="S36" initialTab="voices" />,
    );
    expect(drawerVoicesHtml).toContain('召唤入列');
    expect(drawerVoicesHtml).toContain('凯旋胜利');
    expect(drawerVoicesHtml).toContain('三星升阶');

    const treeHtml = renderToStaticMarkup(
      <RecommendedItemsTree
        recommendedItemIds={['I_FUSION_BLADE', 'I_LORENTZ_RAIL']}
        ownedComponentIds={['C_SWORD']}
      />,
    );
    expect(treeHtml).toContain('lui-recipe-tree');
    expect(treeHtml).toContain('聚变重刃');
    expect(treeHtml).toContain('data-item-icon-id="C_SWORD"');
    expect(treeHtml).toContain('背包已有');
  });

  it('renders the top learning arc progress ribbon and adaptive branch badges when arcMeta is provided', () => {
    const baseArcMeta: LearningArcMeta = {
      arcIndex: 0,
      arcCount: 2,
      slotInArc: 2,
      slotsPerArc: 4,
      stageKind: 'remediate',
      stageLabel: '错题拆解与变式订正',
      topicTitle: '情景交际与日常高频词块 · 完形语境与信息推理',
      strategy: 'modular_pack',
      blueprintTags: ['情景交际', '阅读推理'],
      adaptiveBranch: 'remediation_inserted',
      stageOutline: [
        { slot: 0, kind: 'intro', label: '熟悉与精讲', status: 'done' },
        { slot: 1, kind: 'deepen', label: '变式深入', status: 'done' },
        { slot: 2, kind: 'remediate', label: '错题拆解与变式订正', status: 'active' },
        { slot: 3, kind: 'mastery', label: '综合终测验收', status: 'upcoming' },
      ],
    };

    const remediateHtml = renderToStaticMarkup(
      <QuestionStepCard arcMeta={baseArcMeta} question={makeBaseQuestion({})} variant="overlay" />,
    );
    expect(remediateHtml).toContain('data-testid="learning-arc-ribbon"');
    expect(remediateHtml).toContain('大轮次 1/2');
    expect(remediateHtml).toContain('情景交际与日常高频词块 · 完形语境与信息推理');
    expect(remediateHtml).toContain('情景交际');
    expect(remediateHtml).toContain('阅读推理');
    expect(remediateHtml).toContain('动态插入 · 错题靶向订正');
    expect(remediateHtml).toContain('lui-arc-node--done');
    expect(remediateHtml).toContain('lui-arc-node--active');
    expect(remediateHtml).toContain('lui-arc-node--upcoming');

    const stretchHtml = renderToStaticMarkup(
      <QuestionStepCard
        arcMeta={{
          ...baseArcMeta,
          stageKind: 'stretch',
          stageLabel: '进阶拓展挑战',
          strategy: 'structured_topic',
          blueprintTags: ['集合逻辑与函数性质'],
          adaptiveBranch: 'stretch_promoted',
          stageOutline: [
            { slot: 0, kind: 'intro', label: '熟悉与精讲', status: 'done' },
            { slot: 1, kind: 'deepen', label: '变式深入', status: 'done' },
            { slot: 2, kind: 'stretch', label: '进阶拓展挑战', status: 'active' },
            { slot: 3, kind: 'mastery', label: '综合终测验收', status: 'upcoming' },
          ],
        }}
        question={makeBaseQuestion({})}
      />,
    );
    expect(stretchHtml).toContain('高正确率 · 进阶挑战');
    expect(stretchHtml).toContain('进阶');
  });

  it('defaults to compact game descriptions and syncs global mode toggles across all views', () => {
    expect(readStoredDescriptionMode()).toBe('compact');
    expect(getGlobalDescriptionMode()).toBe('compact');

    for (const c of SEASON1_ITEMS.components) {
      expect(COMPACT_ITEM_DESCRIPTIONS[c.id]).toBeTruthy();
      expect(COMPACT_ITEM_DESCRIPTIONS[c.id]).not.toMatch(/\d/);
    }
    for (const it of SEASON1_ITEMS.completedItems) {
      expect(COMPACT_ITEM_DESCRIPTIONS[it.id]).toBeTruthy();
      expect(COMPACT_ITEM_DESCRIPTIONS[it.id]).not.toMatch(/\d/);
    }
    for (const em of SEASON1_ITEMS.emblems) {
      expect(COMPACT_ITEM_DESCRIPTIONS[em.id]).toBeTruthy();
    }
    expect(COMPACT_ITEM_DESCRIPTIONS[SEASON1_ITEMS.special.spatulaComponent.id]).toBeTruthy();
    expect(COMPACT_ITEM_DESCRIPTIONS[SEASON1_ITEMS.special.mothershipFlag.id]).toBeTruthy();
    for (const tool of SEASON1_ITEMS.special.consumables) {
      expect(COMPACT_ITEM_DESCRIPTIONS[tool.id]).toBeTruthy();
    }
    for (const aug of SEASON1_AUGMENTS) {
      expect(COMPACT_AUGMENT_DESCRIPTIONS[aug.id]).toBeTruthy();
      expect(COMPACT_AUGMENT_DESCRIPTIONS[aug.id]).not.toMatch(/\d/);
    }
    for (const tr of [
      ...SEASON1_TRAITS.factions,
      ...SEASON1_TRAITS.roles,
      ...SEASON1_TRAITS.uniques,
    ]) {
      expect(COMPACT_TRAIT_DESCRIPTIONS[tr.name]).toBeTruthy();
      expect(COMPACT_TRAIT_DESCRIPTIONS[tr.name]).not.toMatch(/\d/);
    }
    for (const u of SEASON1_UNITS) {
      const compactSkill = summarizeCompactGameText(u.skillSummary);
      expect(compactSkill.length).toBeGreaterThan(4);
      expect(compactSkill).not.toMatch(/\d/);
    }

    const storageMap = new Map<string, string>();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        localStorage: {
          getItem: (k: string) => storageMap.get(k) ?? null,
          setItem: (k: string, v: string) => {
            storageMap.set(k, v);
          },
        },
      },
    });

    const compactHtml = renderToStaticMarkup(
      <DescriptionModeProvider>
        <div>
          <DescriptionModeToggle />
          <GameEffectText itemId="I_FUSION_BLADE" fullText="额外提高 25% 攻击力（纯物理基座）。" />
          <GameEffectText augmentId="AUG_S05" fullText="前两排友军开战获得 16% 最大生命护盾5秒。" />
          <GameEffectText traitName="戴森工团" fullText="阵亡触发【质量投射回收】：最近存活工团友军获亡者最大生命 12%/18%/25%/35% 等离子盾(4秒)与12法力。" />
          <GameEffectText fullText="架起六角等离子磁盾获1.35P护盾4秒，期间受普攻伤害降低12%。" />
        </div>
      </DescriptionModeProvider>,
    );
    const compactText = compactHtml.replace(/<[^>]+>/g, '');
    expect(compactHtml).toContain('data-desc-mode="compact"');
    expect(compactHtml).toContain('详细');
    expect(compactText).toContain('纯物理基座，大幅提升攻击力');
    expect(compactText).toContain('前两排友军开战获得高额护盾');
    expect(compactText).not.toContain('25%');
    expect(compactText).not.toContain('1.35P');

    setGlobalDescriptionMode('detailed');
    expect(storageMap.get(DESCRIPTION_DETAIL_MODE_STORAGE_KEY)).toBe('detailed');
    expect(readStoredDescriptionMode()).toBe('detailed');

    const detailedHtml = renderToStaticMarkup(
      <DescriptionModeProvider>
        <div>
          <DescriptionModeToggle />
          <GameEffectText itemId="I_FUSION_BLADE" fullText="额外提高 25% 攻击力（纯物理基座）。" />
          <GameEffectText augmentId="AUG_S05" fullText="前两排友军开战获得 16% 最大生命护盾5秒。" />
          <GameEffectText fullText="架起六角等离子磁盾获1.35P护盾4秒，期间受普攻伤害降低12%。" />
        </div>
      </DescriptionModeProvider>,
    );
    const detailedText = detailedHtml.replace(/<[^>]+>/g, '');
    expect(detailedHtml).toContain('data-desc-mode="detailed"');
    expect(detailedHtml).toContain('简洁');
    expect(detailedText).toContain('25%');
    expect(detailedText).toContain('16%');
    expect(detailedText).toContain('1.35P');

    writeStoredDescriptionMode('compact');
    expect(readStoredDescriptionMode()).toBe('compact');
  });
});
