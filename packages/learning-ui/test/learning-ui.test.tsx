import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ClientQuestionView } from '@pkg/contracts';
import {
  LoreArchiveReader,
  MarkdownKatexBlock,
  QuestionStepCard,
  RecommendedItemsTree,
  UnitLoreDrawer,
  renderMarkdownWithKatexToHtml,
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
    expect(treeHtml).toContain('聚变重型钨刃');
    expect(treeHtml).toContain('背包已有');
  });
});
