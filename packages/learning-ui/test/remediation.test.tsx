import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ClientQuestionView } from '@pkg/contracts';
import { QuestionStepCard } from '../src/QuestionStepCard.js';

const original: ClientQuestionView = {
  questionId: 'frozen-resource', familyId: 'family', subject: 'english', knowledgeNode: 'node',
  stepRole: 'resource_check', questionType: 'single_choice', assessmentKind: 'application',
  allowMaterialReview: false, materialMd: '', stemMd: 'OLD_SCORED_QUESTION',
  options: [{ key: 'A', text: 'Original answer' }], matchingLeft: [], matchingRight: [], stepsRubric: [],
  hintMd: '', difficulty: 1, weight: 1, estSeconds: 10, sourceLicense: 'test', audioRefOptional: null,
};

describe('shared review-only remediation semantics', () => {
  for (const variant of ['overlay', 'standalone', 'sandbox', 'compact'] as const) {
    it(`renders corrections over a referenced resource question in ${variant}`, () => {
      const html = renderToStaticMarkup(<QuestionStepCard stepKind="remediation" variant={variant}
        question={original} remediationItems={[{ questionId: original.questionId, stemMd: '订正回顾', explanationMd: '保持原检验评分' }]}
        onAdvanceStep={() => undefined} />);
      expect(html).toContain('保持原检验评分');
      expect(html).not.toContain('OLD_SCORED_QUESTION');
      expect(html).not.toContain('submit-answer-btn');
      expect(html).not.toContain('skip-question-btn');
      expect(html).toContain('advance-step-btn');
      expect(html).toContain('data-question-id=""');
    });
  }
});
