import type { ArcStageKind, LearningArcMeta, MatchStudyBlueprint, QuestionItem, StudyDifficultyTier } from '@pkg/contracts';
import { toClientQuestionView } from './client-view.js';
import type { ArcAttempt, LessonBundleStep, PersonalizedLessonBundle, PersonalizedLessonInput } from './personalization.js';
import { learningNodePolicy } from './settlement.js';
import { activeStudyCatalog } from './study-blueprint.js';
import { locateMatchStudySlot } from './study-layout.js';

const LABEL: Readonly<Record<ArcStageKind, string>> = {
  intro: '熟悉与精讲', deepen: '变式深入', diagnose: '独立诊断', remediate: '错题拆解与变式订正', stretch: '进阶拓展挑战', mastery: '综合终测验收',
};

function arcBranch(attempts: readonly ArcAttempt[], branchSlot: number, compact: boolean): LearningArcMeta['adaptiveBranch'] {
  const earlier = attempts.filter(a => a.slotInArc === undefined || a.slotInArc < branchSlot);
  if (!earlier.length) return 'standard';
  return earlier.some(a => !a.isCorrect) ? 'remediation_inserted' : compact ? 'standard' : 'stretch_promoted';
}

export function lessonArcMeta(blueprint: MatchStudyBlueprint, nodeIndex: number, attempts: readonly ArcAttempt[] = []): LearningArcMeta {
  const { arcIndex, slotInArc, slotsInArc, arc } = locateMatchStudySlot(blueprint, nodeIndex);
  const branchSlot = slotsInArc - 2;
  const compact = slotsInArc === 3;
  const branch = arcBranch(attempts, branchSlot, compact);
  const stageOutline: LearningArcMeta['stageOutline'] = arc.slotStages.map((planned, slot) => {
    const isBranch = slot === branchSlot;
    const kind = isBranch && slotInArc >= branchSlot
      ? branch === 'stretch_promoted' ? 'stretch' : branch === 'remediation_inserted' ? 'remediate' : planned : planned;
    const label = isBranch && (slotInArc < branchSlot || branch === 'standard')
      ? compact ? '变式深入与巩固' : '诊断与巩固' : LABEL[kind];
    return { slot, kind, label, status: slot === slotInArc ? 'active' : slot < slotInArc ? 'done' : 'upcoming' };
  });
  const current = stageOutline[slotInArc];
  if (!current) throw new RangeError('Study blueprint is missing the learning slot');
  return {
    arcIndex, arcCount: blueprint.arcCount, slotInArc, slotsPerArc: slotsInArc,
    stageKind: current.kind, stageLabel: current.label, topicTitle: arc.title, strategy: arc.strategy,
    blueprintTags: [...arc.tags], adaptiveBranch: slotInArc === branchSlot ? branch : 'standard', stageOutline,
  };
}

type TierBand = readonly [number, number];
const tiers: Readonly<Record<StudyDifficultyTier, TierBand>> = { foundational: [1, 2], standard: [2, 3], advanced: [3, 4] };

function difficultyFit(q: QuestionItem, stage: ArcStageKind, tier: StudyDifficultyTier) {
  const [low, high] = tiers[tier];
  const stageBand: TierBand = stage === 'intro' ? [1, 2] : stage === 'deepen' ? [2, 3] : stage === 'stretch' ? [3, 5] : [1, 5];
  const distance = (min: number, max: number) => Math.max(min - q.difficulty, 0, q.difficulty - max);
  return -8 * distance(...stageBand) - 4 * distance(low, high) - Math.abs(q.difficulty - (low + high) / 2);
}

export function selectArcLesson(input: PersonalizedLessonInput, blueprint: MatchStudyBlueprint): PersonalizedLessonBundle {
  const policy = learningNodePolicy(input.mode, input.nodeIndex, blueprint);
  if (blueprint.mode !== input.mode || !input.selectedSubjects.includes(blueprint.subject)
    || (input.queueType === 'ranked' && input.rankedSubject !== blueprint.subject)) throw new Error('Study blueprint scope mismatch');
  const catalog = activeStudyCatalog({ ...input, subject: blueprint.subject });
  const attempts = input.priorArcAttempts ?? [];
  const arcMeta = lessonArcMeta(blueprint, input.nodeIndex, attempts);
  const arc = blueprint.arcs[arcMeta.arcIndex]!;
  if (!arc.topicNodeIds.every(id => catalog.nodes.has(id))) throw new Error('Study blueprint contains unknown topic nodes');
  const stage = arcMeta.stageKind;
  const scoped = catalog.items.filter(q => arc.topicNodeIds.includes(q.knowledgeNode));
  const pool = scoped.length ? scoped : catalog.items;
  const used = new Set(input.usedQuestionIds ?? []);
  const wrongIds = new Set(attempts.filter(a => !a.isCorrect).map(a => a.questionId));
  const wrongFamilies = new Set(attempts.filter(a => !a.isCorrect).map(a => a.familyId));
  const selected: QuestionItem[] = [];
  const selectedFamilies = new Set<string>();
  const selectedNodes = new Set<string>();
  const retestedFamilies = new Set<string>();
  const chosenIds = new Set<string>();
  const phaseIndex = { resource_check: 2, verification: 4 } as const;

  function addQuestions(role: 'resource_check' | 'verification', count: number) {
    let seconds = 0;
    for (let index = 0; index < count; index++) {
      const available = pool.filter(q => !chosenIds.has(q.questionId)
        && (!index || seconds + q.estSeconds <= policy.phaseSeconds[phaseIndex[role]]!));
      const fresh = available.filter(q => !used.has(q.questionId));
      const ranked = fresh.length ? fresh : index === 0 ? available : [];
      const retest = (stage === 'remediate' && arcMeta.adaptiveBranch === 'remediation_inserted') || (stage === 'mastery' && (index < count - 1 || !retestedFamilies.size));
      const score = (q: QuestionItem) => difficultyFit(q, stage, blueprint.difficultyTier)
        + (q.stepRole === role ? 4 : q.stepRole === 'practice' ? 0 : -3)
        + (catalog.evidence.get(q.familyId)?.priority ?? 0) * 0.35
        + (q.knowledgeNode === arc.primaryNodeId ? 1.75 : 0)
        + (selectedNodes.has(q.knowledgeNode) ? 0 : 2.5)
        + (selectedFamilies.has(q.familyId) ? -3 : 0)
        + (retest && wrongFamilies.has(q.familyId) ? !retestedFamilies.has(q.familyId) ? 42 : stage === 'remediate' ? 20 : 0 : 0)
        - (wrongIds.has(q.questionId) ? 45 : 0);
      const chosen = ranked.sort((a, b) => score(b) - score(a) || (a.questionId < b.questionId ? -1 : a.questionId === b.questionId ? 0 : 1))[0];
      if (!chosen) break;
      const question = structuredClone(chosen);
      question.stepRole = role;
      question.hintMd = '';
      if (stage === 'mastery' || stage === 'diagnose') {
        question.allowMaterialReview = false;
        question.materialMd = '';
      }
      selected.push(question);
      chosenIds.add(question.questionId);
      selectedFamilies.add(question.familyId);
      selectedNodes.add(question.knowledgeNode);
      if (wrongFamilies.has(question.familyId)) retestedFamilies.add(question.familyId);
      seconds += question.estSeconds;
    }
  }

  if (stage === 'intro') addQuestions('resource_check', pool.length >= 10 ? 2 : 1);
  else if (stage === 'diagnose' || (stage === 'deepen' && policy.verificationWeightPercent === 0)) addQuestions('resource_check', pool.length >= 13 ? 3 : 2);
  else if (stage === 'mastery') addQuestions('verification', pool.length >= 10 ? 3 : 2);
  else if (pool.length === 1) addQuestions('resource_check', 1);
  else {
    addQuestions('resource_check', stage === 'deepen' ? 2 : 1);
    addQuestions('verification', 1);
  }

  const materials = new Map<string, LessonBundleStep['materials'][number]>();
  if (policy.phaseSeconds[0]! > 0) {
    const put = (familyId: string, materialMd: string) => {
      if (materialMd.trim()) materials.set(materialMd, { familyId, materialMd });
    };
    if (arcMeta.adaptiveBranch === 'remediation_inserted') {
      for (const { questionId } of attempts.filter(a => !a.isCorrect)) {
        const q = pool.find(q => q.questionId === questionId);
        if (!q || chosenIds.has(q.questionId) || [...materials.values()].some(m => m.familyId === q.familyId)) continue;
        put(q.familyId, [q.materialMd, q.explanationMd].filter(Boolean).join('\n\n'));
        if (materials.size === 2) break;
      }
    }
    if (stage === 'intro' && arc.strategy === 'modular_pack') {
      for (const nodeId of arc.topicNodeIds) {
        const q = selected.find(q => q.knowledgeNode === nodeId && q.materialMd.trim())
          ?? pool.find(q => q.knowledgeNode === nodeId && q.materialMd.trim());
        if (q) put(q.familyId, q.materialMd);
      }
    }
    for (const q of [...selected, ...pool]) {
      if (materials.size >= (stage === 'intro' && arc.strategy === 'structured_topic' ? 1 : 2)) break;
      put(q.familyId, q.materialMd);
    }
    if (!materials.size) put(selected[0]!.familyId, `本轮主题：${arc.title}`);
  }
  const steps: LessonBundleStep[] = (['material', 'practice', 'resource_check', 'remediation', 'verification'] as const).map((kind, i) => {
    const questionIds = selected.filter(q => q.stepRole === kind).map(q => q.questionId);
    const visibleMaterials = kind === 'material' ? [...materials.values()] : [];
    return { kind, plannedSeconds: policy.phaseSeconds[i]!, active: visibleMaterials.length > 0 || questionIds.length > 0,
      questionIds, materials: visibleMaterials, corrections: [] };
  });
  const weight = (role: QuestionItem['stepRole']) => selected.filter(q => q.stepRole === role).reduce((amount, q) => {
    if (!Number.isSafeInteger(q.weight) || q.weight <= 0) throw new Error('Invalid frozen question weight');
    return amount + BigInt(q.weight);
  }, 0n).toString();
  return {
    mode: input.mode, nodeIndex: input.nodeIndex, subjects: [blueprint.subject], plannedSeconds: policy.plannedSeconds,
    verificationWeightPercent: policy.verificationWeightPercent,
    questions: selected, clientQuestions: selected.map(toClientQuestionView), steps,
    frozenDenominators: { resourceCheckWeight: weight('resource_check'), verificationWeight: weight('verification') },
    selectionEvidence: [...selectedFamilies].map(id => catalog.evidence.get(id)!), arcMeta, blueprint: structuredClone(blueprint),
  };
}
