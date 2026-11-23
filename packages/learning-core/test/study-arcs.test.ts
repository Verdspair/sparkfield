import { LearningArcMetaSchema, MatchStudyBlueprintSchema, type CoursePack } from '@pkg/contracts';
import { describe, expect, it } from 'vitest';
import { activateLessonRemediation, buildMatchStudyBlueprint, buildPersonalizedLessonBundle, learningNodePolicy, locateMatchStudySlot, settleLearningNodeGold, type ArcAttempt } from '../src/index.js';
import { card, NOW, pack, question } from './fixtures.js';

const math = () => {
  const p = pack('math', ['n1', 'n2', 'n3'], ['f1', 'f2', 'f3']);
  p.items = p.items.flatMap(q => [q, ...[1, 2, 3, 4].map(difficulty => question({
    ...q, difficulty, questionId: `${q.questionId}_d${difficulty}`, explanationMd: `review ${q.questionId}_d${difficulty}`,
  }))]);
  return p;
};

function arcLessons(course: CoursePack = math()) {
  const options = { packs: [course], mode: 'quick', subject: course.manifest.subject, now: NOW } as const;
  const studyBlueprint = buildMatchStudyBlueprint(options);
  return (nodeIndex: number, usedQuestionIds: readonly string[] = [], priorArcAttempts: readonly ArcAttempt[] = []) => buildPersonalizedLessonBundle({
    ...options, nodeIndex, queueType: 'solo', selectedSubjects: [options.subject], studyBlueprint, usedQuestionIds, priorArcAttempts,
  });
}

const activeKinds = (lesson: ReturnType<ReturnType<typeof arcLessons>>) => lesson.steps.filter(s => s.active).map(s => s.kind);

describe('adaptive match study arcs', () => {
  it('starts math at the chosen topic, follows graph order and cycles through weak review topics without crashing', () => {
    const p = math();
    p.manifest.knowledgeGraph.reverse();
    const study = buildMatchStudyBlueprint({ packs: [p], mode: 'deep', subject: 'math', now: NOW,
      progress: [{ subject: 'math', knowledgeNode: 'n2' }],
      cards: [card({ familyId: 'math_n1_f1', knowledgeNode: 'n1', lapses: 3, stability: 0.4 })],
    });
    expect(MatchStudyBlueprintSchema.parse(study)).toEqual(study);
    expect(study.arcs.map(a => a.primaryNodeId)).toEqual(['n2', 'n3', 'n1']);
    expect(study.arcs.every(a => a.topicNodeIds.length === 1 && a.strategy === 'structured_topic')).toBe(true);
    const single = buildMatchStudyBlueprint({ packs: [pack()], mode: 'deep', subject: 'math', now: NOW });
    expect(single.arcs.map(a => a.primaryNodeId)).toEqual(['n1', 'n1', 'n1']);
  });

  it('assembles deterministic, bounded, complementary English packs and uses progress, due cards, weak families and seed', () => {
    const p = pack('english', ['phrases', 'grammar', 'cloze', 'reading', 'usage']);
    const opts = { packs: [p], mode: 'deep', subject: 'english', now: NOW,
      progress: [{ subject: 'english', knowledgeNode: 'grammar' }],
      cards: [card({ familyId: 'english_reading_f1', subject: 'english', knowledgeNode: 'reading', stability: 0.5 })],
      recentPerformance: [{ familyId: 'english_reading_f2', independentAccuracy: 0.25, hintRate: 0.5 }],
    } as const;
    const study = buildMatchStudyBlueprint(opts);
    expect(buildMatchStudyBlueprint({ ...opts, seed: 0 })).toEqual(study);
    expect(study.arcs[0]!.topicNodeIds).toEqual(expect.arrayContaining(['grammar', 'reading']));
    expect(new Set(study.arcs.map(arc => [...arc.topicNodeIds].sort().join(','))).size).toBe(3);
    for (const arc of study.arcs) {
      expect(arc.strategy).toBe('modular_pack');
      expect(arc.topicNodeIds.length).toBeGreaterThanOrEqual(2);
      expect(arc.topicNodeIds.length).toBeLessThanOrEqual(3);
      expect(arc.loadScore).toBeGreaterThan(0);
      expect(arc.loadScore).toBeLessThanOrEqual(65);
      expect(arc.tags).toHaveLength(arc.topicNodeIds.length);
    }
    const rerolls = Array.from({ length: 8 }, (_, i) => buildMatchStudyBlueprint({ ...opts, seed: i + 1 }).arcs.map(a => a.topicNodeIds));
    expect(rerolls.some(plan => JSON.stringify(plan) !== JSON.stringify(study.arcs.map(a => a.topicNodeIds)))).toBe(true);
  });

  it('keeps the same budget across personal difficulty tiers while preferring their difficulty bands', () => {
    const p = math();
    const common = { packs: [p], mode: 'quick', subject: 'math', now: NOW } as const;
    const weak = buildMatchStudyBlueprint({ ...common,
      cards: [card({ familyId: 'math_n1_f1', stability: 0.2, lapses: 3 })],
      recentPerformance: [{ familyId: 'math_n1_f1', independentAccuracy: 0.45, hintRate: 0.3 }],
    });
    const strong = buildMatchStudyBlueprint({ ...common,
      cards: [card({ familyId: 'math_n1_f1', stability: 30, dueIso: '2026-06-01T12:00:00.000Z' })],
      recentPerformance: [{ familyId: 'math_n1_f1', independentAccuracy: 0.98, hintRate: 0 }],
    });
    expect(weak.difficultyTier).toBe('foundational');
    expect(strong.difficultyTier).toBe('advanced');
    for (const studyBlueprint of [weak, strong]) {
      const lesson = buildPersonalizedLessonBundle({ ...common, nodeIndex: 3, queueType: 'solo', selectedSubjects: ['math'], studyBlueprint });
      expect(lesson.questions.every(q => studyBlueprint === weak ? q.difficulty <= 2 : q.difficulty >= 3 && q.difficulty <= 4)).toBe(true);
      expect(settleLearningNodeGold({ mode: 'quick', nodeIndex: 3, questions: lesson.questions,
        submissions: Object.fromEntries(lesson.questions.map(q => [q.questionId, 'A'])),
      }).rawEarnedCents).toBe(1300);
    }
  });

  it('runs intro and deepen without sandwiching unnecessary steps, then branches on actual prior answers', () => {
    const build = arcLessons();
    const intro = build(0);
    expect(activeKinds(intro)).toEqual(['material', 'resource_check']);
    expect(intro.questions).toHaveLength(2);
    expect(intro.questions.every(q => q.difficulty <= 2)).toBe(true);
    const used = intro.questions.map(q => q.questionId);
    const deepen = build(1, used);
    expect(activeKinds(deepen)).toEqual(['material', 'resource_check']);
    expect(deepen.questions).toHaveLength(3);
    expect(deepen.questions.every(q => q.difficulty >= 2 && q.difficulty <= 3)).toBe(true);
    used.push(...deepen.questions.map(q => q.questionId));
    const wrong = intro.questions[0]!;
    const evidence = [...intro.questions.map(q => ({ ...q, slotInArc: 0 })), ...deepen.questions.map(q => ({ ...q, slotInArc: 1 }))]
      .map(q => ({ questionId: q.questionId, familyId: q.familyId, slotInArc: q.slotInArc, isCorrect: q.questionId !== wrong.questionId }));
    const remediate = build(2, used, evidence);
    expect(remediate.arcMeta).toMatchObject({ stageKind: 'remediate', adaptiveBranch: 'remediation_inserted' });
    expect(remediate.steps[0]!.materials[0]).toMatchObject({ familyId: wrong.familyId, materialMd: expect.stringContaining(wrong.explanationMd) });
    expect(remediate.questions.some(q => q.familyId === wrong.familyId && q.questionId !== wrong.questionId)).toBe(true);
    const correction = activateLessonRemediation(remediate, { [remediate.questions[0]!.questionId]: 'B' }, true);
    expect(correction.steps.find(s => s.kind === 'remediation')?.active).toBe(true);
    const stretch = build(2, used, evidence.map(q => ({ ...q, isCorrect: true })));
    expect(stretch.arcMeta).toMatchObject({ stageKind: 'stretch', adaptiveBranch: 'stretch_promoted' });
    expect(stretch.questions.every(q => q.difficulty >= 3)).toBe(true);
    expect(build(2).arcMeta).toMatchObject({ stageKind: 'remediate', stageLabel: '诊断与巩固', adaptiveBranch: 'standard' });
    expect(LearningArcMetaSchema.parse(stretch.arcMeta)).toEqual(stretch.arcMeta);
  });

  it('retests an unused variant of a wrong family in closed-book mastery, even if the error first happened on stretch', () => {
    const build = arcLessons();
    const intro = build(0);
    const deepen = build(1, intro.questions.map(q => q.questionId));
    const used = [...intro.questions, ...deepen.questions].map(q => q.questionId);
    const earlier = intro.questions.map(q => ({ questionId: q.questionId, familyId: q.familyId, isCorrect: true, slotInArc: 0 }));
    const stretch = build(2, used, earlier);
    used.push(...stretch.questions.map(q => q.questionId));
    const miss = stretch.questions[0]!;
    const mastery = build(3, used, [...earlier, { questionId: miss.questionId, familyId: miss.familyId, isCorrect: false, slotInArc: 2 }]);
    expect(mastery.arcMeta.stageOutline[2]).toMatchObject({ kind: 'stretch', status: 'done' });
    expect(mastery.arcMeta.stageOutline[3]).toMatchObject({ kind: 'mastery', status: 'active' });
    expect(activeKinds(mastery)).toEqual(['verification']);
    expect(mastery.questions[0]).toMatchObject({ familyId: miss.familyId, allowMaterialReview: false, materialMd: '' });
    expect(mastery.clientQuestions.every(q => !q.allowMaterialReview && !q.materialMd && !q.hintMd)).toBe(true);
    expect(mastery.questions.every(q => !used.includes(q.questionId))).toBe(true);
  });

  it('merges first-round errors into a compact arc without leaking attempts to another arc', () => {
    const p = math();
    const common = { packs: [p], mode: 'deep', subject: 'math', now: NOW } as const;
    const studyBlueprint = buildMatchStudyBlueprint(common);
    expect(studyBlueprint.arcs.map(arc => arc.slotsInArc)).toEqual([4, 3, 3]);
    const build = (nodeIndex: number, priorArcAttempts: readonly ArcAttempt[] = []) => buildPersonalizedLessonBundle({
      ...common, nodeIndex, queueType: 'solo', selectedSubjects: ['math'], studyBlueprint, priorArcAttempts,
      usedQuestionIds: priorArcAttempts.map(a => a.questionId),
    });
    const intro = build(4);
    expect(intro.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 0, slotsPerArc: 3, stageKind: 'intro' });
    const q = intro.questions[0]!;
    const incorrect = { questionId: q.questionId, familyId: q.familyId, isCorrect: false, slotInArc: 0 };
    expect(build(5, [incorrect]).arcMeta).toMatchObject({ stageKind: 'remediate', adaptiveBranch: 'remediation_inserted' });
    expect(build(5, [{ ...incorrect, isCorrect: true }]).arcMeta).toMatchObject({ stageKind: 'deepen', adaptiveBranch: 'standard' });
    expect(build(6, [incorrect]).arcMeta).toMatchObject({ stageKind: 'mastery', slotsPerArc: 3 });
    expect(locateMatchStudySlot(studyBlueprint, 7)).toMatchObject({ arcIndex: 2, slotInArc: 0, slotsInArc: 3 });
  });

  it('supports a shared three-plus-five-slot timeline and gives the longer arc a dedicated diagnostic', () => {
    const p = math();
    const common = { packs: [p], mode: 'standard', subject: 'math', now: NOW } as const;
    const studyBlueprint = buildMatchStudyBlueprint({ ...common, arcSlots: [3, 5] });
    expect(MatchStudyBlueprintSchema.parse(studyBlueprint)).toEqual(studyBlueprint);
    expect(() => buildMatchStudyBlueprint({ ...common, arcSlots: [3, 3] })).toThrow('timeline');
    const build = (nodeIndex: number, priorArcAttempts: readonly ArcAttempt[] = []) => buildPersonalizedLessonBundle({
      ...common, nodeIndex, queueType: 'solo', selectedSubjects: ['math'], studyBlueprint, priorArcAttempts,
      usedQuestionIds: priorArcAttempts.map(a => a.questionId),
    });
    const diagnostic = build(5);
    expect(diagnostic.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 2, slotsPerArc: 5, stageKind: 'diagnose' });
    expect(activeKinds(diagnostic)).toEqual(['resource_check']);
    const q = diagnostic.questions[0]!;
    const challenge = build(6, [{ questionId: q.questionId, familyId: q.familyId, slotInArc: 2, isCorrect: true }]);
    expect(challenge.arcMeta).toMatchObject({ stageKind: 'stretch', adaptiveBranch: 'stretch_promoted' });
    expect(challenge.verificationWeightPercent).toBe(30);
    expect(settleLearningNodeGold({ mode: 'standard', nodeIndex: 6, questions: challenge.questions, studyBlueprint,
      submissions: Object.fromEntries(challenge.questions.map(q => [q.questionId, 'A'])),
    }).rawEarnedCents).toBe(575);
    expect(Array.from({ length: 8 }, (_, index) => learningNodePolicy('standard', index, studyBlueprint).centBudget))
      .toEqual([500, 825, 1175, 250, 400, 475, 575, 800]);
    expect(activeKinds(build(7))).toEqual(['verification']);
  });

  it('defaults to complementary scoring skills without embedding an exam name', () => {
    const p = pack('english', ['dialogue', 'grammar', 'reading', 'usage', 'cloze', 'syntax']);
    const study = buildMatchStudyBlueprint({ packs: [p], subject: 'english', mode: 'quick', now: NOW });
    expect(study.arcs[0]!.tags).toEqual(expect.arrayContaining(['情景交际', '语法填空', '阅读推理']));
  });

  it('only reuses a question from an exhausted tiny bank and never duplicates it inside one bundle', () => {
    const p = pack();
    p.items = [p.items[0]!];
    const build = arcLessons(p);
    for (let slot = 0; slot < 4; slot++) expect(build(slot, [p.items[0]!.questionId]).questions).toHaveLength(1);
  });
});
