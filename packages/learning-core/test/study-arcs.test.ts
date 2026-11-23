import { LearningArcMetaSchema, MatchStudyBlueprintSchema, MODE_BUDGETS, type CoursePack } from '@pkg/contracts';
import { describe, expect, it } from 'vitest';
import { activateLessonRemediation, buildMatchStudyBlueprint, buildPersonalizedLessonBundle, evaluateLearningBonusDrops, learningNodePolicy, locateMatchStudySlot, settleLearningNodeGold, type ArcAttempt } from '../src/index.js';
import { activeStudyCatalog } from '../src/study-blueprint.js';
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

  const english = () => pack('english', ['dialogue', 'grammar', 'cloze', 'usage', 'reading', 'syntax']);

  it.each([
    ['quick', [2, 2], [4]], ['standard', [2, 2, 2], [3, 3]], ['deep', [2, 2, 2, 2, 2, 2], [4, 4, 4]],
  ] as const)('gives %s mode independent English modules and preserves math topic lengths', (mode, englishSlots, mathSlots) => {
    const p = english();
    const study = buildMatchStudyBlueprint({ packs: [p], mode, subject: 'english', now: NOW });
    expect(MatchStudyBlueprintSchema.parse(study)).toEqual(study);
    expect(study.slotsPerArc).toBe(2);
    expect(study.arcs.map(a => a.slotsInArc)).toEqual(englishSlots);
    expect(study.arcs.map(a => a.primaryNodeId)).toEqual(['dialogue', 'grammar', 'cloze', 'usage', 'reading', 'syntax'].slice(0, englishSlots.length));
    for (const arc of study.arcs) {
      expect(arc).toMatchObject({ title: arc.primaryNodeId, strategy: 'modular_pack', topicNodeIds: [arc.primaryNodeId], slotStages: ['intro', 'mastery'] });
      expect(arc.tags).toHaveLength(1);
      expect(arc.loadScore).toBeGreaterThan(0);
    }
    expect(buildMatchStudyBlueprint({ packs: [math()], mode, subject: 'math', now: NOW }).arcs.map(a => a.slotsInArc)).toEqual(mathSlots);
  });

  it('reuses the same CoursePack knowledge cards and question units in all three mode layouts', () => {
    for (const course of [math(), english()]) {
      const subject = course.manifest.subject;
      const canonical = structuredClone(course);
      const items = new Map(course.items.map(q => [q.questionId, q]));
      const memory = card({ familyId: course.items[0]!.familyId, knowledgeNode: course.items[0]!.knowledgeNode, subject });
      const options = { packs: [course], subject, now: NOW, cards: [memory] } as const;
      const layouts = subject === 'math' ? [[4], [3, 3], [4, 4, 4]] : [[2, 2], [2, 2, 2], [3, 3, 2, 2, 2]];
      for (const [ordinal, mode] of (['quick', 'standard', 'deep'] as const).entries()) {
        const catalog = activeStudyCatalog({ ...options, mode });
        expect(catalog.items).toHaveLength(items.size);
        for (const unit of catalog.items) expect(unit).toBe(items.get(unit.questionId));
        for (const node of course.manifest.knowledgeGraph) expect(catalog.nodes.get(node.nodeId)).toBe(node);
        expect(catalog.cards.get(memory.familyId)).toBe(memory);

        const blueprint = buildMatchStudyBlueprint({ ...options, mode });
        expect(blueprint.arcs.map(arc => arc.slotsInArc)).toEqual(layouts[ordinal]);
        const slots = blueprint.arcs.reduce((sum, arc) => sum + arc.slotsInArc, 0);
        expect(slots).toBe([4, 6, 12][ordinal]);
        for (let nodeIndex = 0; nodeIndex < slots; nodeIndex++) {
          const lesson = buildPersonalizedLessonBundle({ ...options, mode, nodeIndex, queueType: 'solo',
            selectedSubjects: [subject], studyBlueprint: blueprint });
          expect(lesson.questions.length).toBeGreaterThan(0);
          for (const { stepRole, hintMd, allowMaterialReview, materialMd, assessmentKind, ...unit } of lesson.questions) {
            expect(items.get(unit.questionId)).toMatchObject(unit);
          }
          for (const material of lesson.steps.flatMap(step => step.materials)) {
            expect(course.items.some(unit => unit.familyId === material.familyId && unit.materialMd === material.materialMd)).toBe(true);
          }
        }
      }
      expect(course).toEqual(canonical);
    }
  });

  it('gives high-priority due and weak English modules longer deep-mode reviews without mixing nodes', () => {
    const opts = { packs: [english()], mode: 'deep', subject: 'english', now: NOW,
      cards: [card({ familyId: 'english_reading_f1', subject: 'english', knowledgeNode: 'reading', stability: 0.5 })],
      recentPerformance: [{ familyId: 'english_grammar_f2', independentAccuracy: 0.25, hintRate: 0.5 }],
    } as const;
    const study = buildMatchStudyBlueprint(opts);
    expect(buildMatchStudyBlueprint({ ...opts, seed: 0 })).toEqual(study);
    expect(study.arcs.map(a => a.slotsInArc)).toEqual([3, 3, 2, 2, 2]);
    expect([study.arcs[0]!.primaryNodeId, study.arcs[1]!.primaryNodeId]).toEqual(['reading', 'grammar']);
    expect(study.arcs[0]!.slotStages).toEqual(['intro', 'deepen', 'mastery']);
    expect(new Set(study.arcs.map(arc => arc.primaryNodeId)).size).toBe(5);
    expect(study.arcs.every(arc => arc.topicNodeIds.length === 1)).toBe(true);
    const fresh = { ...opts, cards: [], recentPerformance: [] };
    const ahead = buildMatchStudyBlueprint({ ...fresh, progress: [{ subject: 'english', knowledgeNode: 'usage' }] });
    expect(ahead.arcs[0]!.primaryNodeId).toBe('usage');
    const rerolls = Array.from({ length: 8 }, (_, i) => buildMatchStudyBlueprint({ ...fresh, seed: i + 1 }).arcs[1]!.primaryNodeId);
    expect(new Set(rerolls)).toEqual(new Set(['grammar', 'syntax']));
  });

  it('gives launch scaffolds in compact intro and retests the missed family closed-book before moving to the next topic', () => {
    const p = english();
    const expectedMiss = p.items.find(q => q.questionId === 'english_dialogue_f2_resource_check')!;
    expectedMiss.materialMd = '';
    expectedMiss.assessmentKind = 'retrieval';
    expectedMiss.allowMaterialReview = false;
    const familyCard = p.items.find(q => q.familyId === expectedMiss.familyId && q.stepRole === 'practice')!;
    familyCard.materialMd = 'Reference: choose a response that fits the setting.';
    const build = arcLessons(p);
    const intro = build(0);
    expect(LearningArcMetaSchema.parse(intro.arcMeta)).toEqual(intro.arcMeta);
    expect(intro.arcMeta).toMatchObject({ stageKind: 'intro', stageLabel: '熟悉与精讲', slotsPerArc: 2 });
    expect(activeKinds(intro)).toEqual(['material', 'resource_check']);
    expect(intro.verificationWeightPercent).toBe(0);
    expect(intro.clientQuestions[0]).toMatchObject({ questionId: expectedMiss.questionId, assessmentKind: 'application',
      allowMaterialReview: true, materialMd: familyCard.materialMd });
    const mastery = build(1, intro.questions.map(q => q.questionId), [{
      questionId: expectedMiss.questionId, familyId: expectedMiss.familyId, isCorrect: false, slotInArc: 0,
    }]);
    expect(LearningArcMetaSchema.parse(mastery.arcMeta)).toEqual(mastery.arcMeta);
    expect(mastery.arcMeta).toMatchObject({ stageKind: 'mastery', stageLabel: '综合终测验收', adaptiveBranch: 'standard' });
    expect(activeKinds(mastery)).toEqual(['verification']);
    expect(mastery.verificationWeightPercent).toBe(100);
    expect(mastery.clientQuestions[0]).toMatchObject({ familyId: expectedMiss.familyId, materialMd: '', allowMaterialReview: false });
    expect(mastery.clientQuestions[0]!.questionId).not.toBe(expectedMiss.questionId);
    expect(build(2).arcMeta).toMatchObject({ arcIndex: 1, stageKind: 'intro', topicTitle: 'grammar' });
  });

  it('keeps a nonempty intro scaffold with no authored study material and never exposes the answer explanation', () => {
    const p = english();
    for (const q of p.items) q.materialMd = ' ';
    const intro = arcLessons(p)(0);
    expect(intro.clientQuestions[0]!.materialMd.trim()).not.toEqual('');
    expect(intro.clientQuestions[0]!.materialMd).toContain('dialogue');
    expect(intro.clientQuestions[0]!.materialMd).not.toContain(intro.questions[0]!.explanationMd);
  });

  it.each([['quick', 42], ['standard', 54], ['deep', 78]] as const)('conserves %s match gold at %iG for both tracks', (mode, expectedGold) => {
    const due = card({ familyId: 'english_reading_f1', subject: 'english', knowledgeNode: 'reading' });
    for (const options of [{ subject: 'math', packs: [math()] }, { subject: 'english', packs: [english()] },
      { subject: 'english', packs: [english()], cards: [due] }] as const) {
      const blueprint = buildMatchStudyBlueprint({ ...options, mode, now: NOW });
      const otherPlayer = structuredClone(blueprint);
      otherPlayer.difficultyTier = 'advanced';
      let carryInCents = 0;
      let earnedGold = 0;
      let earnedCents = 0;
      for (let nodeIndex = 0; nodeIndex < MODE_BUDGETS.modes[mode].learning.length; nodeIndex++) {
        const { arc, slotInArc } = locateMatchStudySlot(blueprint, nodeIndex);
        const stage = arc.slotStages[slotInArc]!;
        const lesson = buildPersonalizedLessonBundle({ ...options, mode, now: NOW, nodeIndex, queueType: 'solo',
          selectedSubjects: [options.subject], studyBlueprint: blueprint });
        const policy = learningNodePolicy(mode, nodeIndex, blueprint);
        expect(policy).toEqual(learningNodePolicy(mode, nodeIndex, otherPlayer));
        const gold = settleLearningNodeGold({ mode, nodeIndex, studyBlueprint: blueprint, questions: lesson.questions, carryInCents,
          submissions: Object.fromEntries(lesson.questions.map(q => [q.questionId, 'A'])) });
        expect(gold.rawEarnedCents).toBe(policy.centBudget);
        expect(gold.centBudget).toBe(MODE_BUDGETS.modes[mode].learning_gold_cap_by_block_cents[nodeIndex]);
        if (arc.slotsInArc === 2) {
          expect(gold.verificationWeightPercent).toBe(stage === 'intro' ? 0 : 100);
          if (stage === 'mastery') {
            for (const [score, performanceTier] of [[gold.exactScore, 'perfect'], [{ numerator: '9', denominator: '10' }, 'excellent']] as const) {
              expect(evaluateLearningBonusDrops(score, stage)).toEqual({ performanceTier, bonusComponents: 1, bonusRerollVouchers: 2 });
            }
          }
        }
        earnedCents += gold.rawEarnedCents;
        earnedGold += gold.grantedIntegerGold;
        carryInCents = gold.carryOutCents;
      }
      expect(earnedCents).toBe(expectedGold * 100);
      expect(earnedGold).toBe(expectedGold);
      expect(carryInCents).toBe(0);
    }
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
      }).rawEarnedCents).toBe(1500);
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
    expect(remediate.clientQuestions.every(q => q.allowMaterialReview && q.materialMd.trim() && q.assessmentKind === 'application')).toBe(true);
    const correction = activateLessonRemediation(remediate, { [remediate.questions[0]!.questionId]: 'B' }, true);
    expect(correction.steps.find(s => s.kind === 'remediation')?.active).toBe(true);
    const stretch = build(2, used, evidence.map(q => ({ ...q, isCorrect: true })));
    expect(stretch.arcMeta).toMatchObject({ stageKind: 'stretch', adaptiveBranch: 'stretch_promoted' });
    expect(stretch.questions.every(q => q.difficulty >= 3 && !q.allowMaterialReview && q.materialMd === '')).toBe(true);
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
    const studyBlueprint = buildMatchStudyBlueprint({ ...common, arcSlots: [4, 3, 3, 2] });
    expect(studyBlueprint.arcs.map(arc => arc.slotsInArc)).toEqual([4, 3, 3, 2]);
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

  it('supports a mixed twelve-slot timeline and gives the five-slot arc a dedicated diagnostic', () => {
    const p = math();
    const common = { packs: [p], mode: 'deep', subject: 'math', now: NOW } as const;
    const studyBlueprint = buildMatchStudyBlueprint({ ...common, arcSlots: [3, 5, 2, 2] });
    expect(MatchStudyBlueprintSchema.parse(studyBlueprint)).toEqual(studyBlueprint);
    expect(() => buildMatchStudyBlueprint({ ...common, arcSlots: [3, 3] })).toThrow('timeline');
    const build = (nodeIndex: number, priorArcAttempts: readonly ArcAttempt[] = []) => buildPersonalizedLessonBundle({
      ...common, nodeIndex, queueType: 'solo', selectedSubjects: ['math'], studyBlueprint, priorArcAttempts,
      usedQuestionIds: priorArcAttempts.map(a => a.questionId),
    });
    const diagnostic = build(5);
    expect(diagnostic.arcMeta).toMatchObject({ arcIndex: 1, slotInArc: 2, slotsPerArc: 5, stageKind: 'diagnose' });
    expect(activeKinds(diagnostic)).toEqual(['resource_check']);
    expect(diagnostic.clientQuestions.every(q => !q.allowMaterialReview && !q.materialMd && !q.hintMd)).toBe(true);
    const q = diagnostic.questions[0]!;
    const challenge = build(6, [{ questionId: q.questionId, familyId: q.familyId, slotInArc: 2, isCorrect: true }]);
    expect(challenge.arcMeta).toMatchObject({ stageKind: 'stretch', adaptiveBranch: 'stretch_promoted' });
    expect(challenge.verificationWeightPercent).toBe(30);
    expect(settleLearningNodeGold({ mode: 'deep', nodeIndex: 6, questions: challenge.questions, studyBlueprint,
      submissions: Object.fromEntries(challenge.questions.map(q => [q.questionId, 'A'])),
    }).rawEarnedCents).toBe(650);
    expect(Array.from({ length: 12 }, (_, index) => learningNodePolicy('deep', index, studyBlueprint).centBudget))
      .toEqual([...MODE_BUDGETS.modes.deep.learning_gold_cap_by_block_cents]);
    expect(activeKinds(build(7))).toEqual(['verification']);
  });

  it('only reuses a question from an exhausted tiny bank and never duplicates it inside one bundle', () => {
    const p = pack();
    p.items = [p.items[0]!];
    const build = arcLessons(p);
    for (let slot = 0; slot < 4; slot++) expect(build(slot, [p.items[0]!.questionId]).questions).toHaveLength(1);
  });
});
