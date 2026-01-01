import type { ClientQuestionView, QuestionItem } from '@pkg/contracts';

export function toClientQuestionView(question: QuestionItem): ClientQuestionView {
  return {
    questionId: question.questionId,
    familyId: question.familyId,
    subject: question.subject,
    knowledgeNode: question.knowledgeNode,
    stepRole: question.stepRole,
    questionType: question.questionType,
    assessmentKind: question.assessmentKind,
    allowMaterialReview: question.assessmentKind !== 'retrieval' && question.allowMaterialReview,
    materialMd: question.assessmentKind !== 'retrieval' && question.allowMaterialReview ? question.materialMd : '',
    stemMd: question.stemMd,
    options: question.options.map(({ key, text }) => ({ key, text })),
    matchingLeft: question.matchingPairs.map(({ left }) => left),
    matchingRight: [...new Set(question.matchingPairs.map(({ right }) => right))].sort(),
    stepsRubric: question.stepsRubric.map(({ stepId, prompt, weightShare }) => ({ stepId, prompt, weightShare })),
    hintMd: question.stepRole === 'practice' ? question.hintMd : '',
    difficulty: question.difficulty,
    weight: question.weight,
    estSeconds: question.estSeconds,
    sourceLicense: question.sourceLicense,
    audioRefOptional: question.audioRefOptional,
  };
}
export type SafeClientQuestionView = ReturnType<typeof toClientQuestionView>;
