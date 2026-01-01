import { QuestionItemSchema, type CoursePack, type FsrsCardRecord, type QuestionItem, type SubjectId } from '@pkg/contracts';
export const NOW = new Date('2026-05-10T12:00:00.000Z');
export function question(overrides: Partial<QuestionItem> = {}): QuestionItem {
  return QuestionItemSchema.parse({
    questionId: 'q1', familyId: 'family1', subject: 'math', knowledgeNode: 'n1',
    stepRole: 'resource_check', questionType: 'single_choice', assessmentKind: 'application',
    allowMaterialReview: true, materialMd: 'Reference formula', stemMd: 'Choose a value.',
    options: [{ key: 'A', text: 'first' }, { key: 'B', text: 'second' }, { key: 'C', text: 'third' }],
    answerSpec: 'A', explanationMd: 'HIDDEN_KEY_EXPLANATION', sourceLicense: 'original',
    ...overrides,
  });
}
export function card(overrides: Partial<FsrsCardRecord> = {}): FsrsCardRecord {
  return { familyId: 'family1', subject: 'math', knowledgeNode: 'n1', dueIso: NOW.toISOString(),
    stability: 3, difficulty: 5, reps: 3, lapses: 0, state: 2,
    lastReviewIso: '2026-05-07T12:00:00.000Z', ...overrides };
}
export function pack(subject: SubjectId = 'math', nodeIds = ['n1'], familyIds = ['f1', 'f2']): CoursePack {
  const items = nodeIds.flatMap((node, ni) => familyIds.flatMap((family, fi) =>
    (['practice', 'resource_check', 'verification'] as const).map((role) => question({
      questionId: `${subject}_${node}_${family}_${role}`, familyId: `${subject}_${node}_${family}`, subject,
      knowledgeNode: node, stepRole: role, estSeconds: 10, difficulty: fi + 1, hintMd: role === 'practice' ? 'A permitted hint' : '',
      materialMd: `Material for ${subject} ${node} ${family}`,
    })),
  ));
  return { manifest: { packId: subject, subject, coursePackVersion: '1.0.0', title: subject, syllabusTag: 'original_sample',
    contentSha256: '0'.repeat(64), itemCount: items.length, createdAtIso: NOW.toISOString(),
    knowledgeGraph: nodeIds.map((nodeId, i) => ({ nodeId, title: nodeId, prerequisites: i ? [nodeIds[i - 1]!] : [] })),
  }, items };
}
