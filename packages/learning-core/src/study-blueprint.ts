import {
  type CoursePack, type DurationMode, type FsrsCardRecord, type KnowledgeNodeDef,
  type MatchStudyArcPlan, type MatchStudyBlueprint, type StudyArcSlots, type StudyDifficultyTier, type SubjectId,
} from '@pkg/contracts';
import { forgettingCurve, FSRS6_DEFAULT_WEIGHTS } from 'ts-fsrs/models/fsrs-6';
import { validDate } from './fsrs.js';
import { plannedArcStages, studyArcLayout } from './study-layout.js';
import type { CourseProgress, RecentLearningPerformance } from './personalization.js';

export interface MatchStudyBlueprintInput {
  packs: readonly CoursePack[];
  mode: DurationMode;
  subject: SubjectId;
  now: Date | string;
  cards?: readonly FsrsCardRecord[];
  progress?: readonly CourseProgress[];
  recentPerformance?: readonly RecentLearningPerformance[];
  seed?: number;
  arcSlots?: readonly StudyArcSlots[];
}

export interface FamilyStudyEvidence {
  familyId: string;
  due: boolean;
  retrievability: number | null;
  priority: number;
}

const mean = (xs: readonly number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;

export function activeStudyCatalog(input: MatchStudyBlueprintInput) {
  const packs = input.packs.filter(p => p.manifest.subject === input.subject);
  if (!packs.length) throw new Error(`No course pack for ${input.subject}`);
  const nodes = new Map(packs.flatMap(p => p.manifest.knowledgeGraph.map(n => [n.nodeId, n] as const)));
  const progress = input.progress?.find(p => p.subject === input.subject);
  const startId = progress?.knowledgeNode ?? packs[0]!.manifest.knowledgeGraph[0]!.nodeId;
  if (!nodes.has(startId)) throw new Error(`Unknown selected progress: ${startId}`);
  if (progress?.completedNodeIds?.some(id => !nodes.has(id))) throw new Error('Unknown completed knowledge node');
  const items = packs.flatMap(p => p.items);
  const seenIds = new Set<string>();
  const familyIds = new Set<string>();
  for (const item of items) {
    if (item.subject !== input.subject || !nodes.has(item.knowledgeNode)) throw new Error('Course item subject/node mismatch');
    if (seenIds.has(item.questionId)) throw new Error('Duplicate questionId across active packs');
    seenIds.add(item.questionId);
    familyIds.add(item.familyId);
  }
  if (!items.length) throw new Error(`No course items for ${input.subject}`);
  const cards = new Map((input.cards ?? []).map(card => [card.familyId, card]));
  if (cards.size !== (input.cards?.length ?? 0)) throw new Error('Duplicate FSRS familyId');
  const performance = new Map((input.recentPerformance ?? []).filter(perf => familyIds.has(perf.familyId)).map(perf => {
    for (const rate of [perf.independentAccuracy, perf.hintRate, perf.remediationAccuracy ?? 1]) {
      if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new RangeError('Learning rate must be in [0,1]');
    }
    return [perf.familyId, perf] as const;
  }));
  const now = validDate(input.now);
  const evidence = new Map<string, FamilyStudyEvidence>();
  for (const item of items) {
    const card = cards.get(item.familyId);
    if (card && (card.subject !== item.subject || card.knowledgeNode !== item.knowledgeNode)) throw new Error('FSRS family scope mismatch');
    if (evidence.has(item.familyId)) continue;
    const due = card ? validDate(card.dueIso, 'card due') <= now : false;
    const retrievability = card?.lastReviewIso && card.stability > 0
      ? forgettingCurve(FSRS6_DEFAULT_WEIGHTS, Math.max(0, (now.getTime() - validDate(card.lastReviewIso).getTime()) / 86_400_000), card.stability)
      : null;
    const perf = performance.get(item.familyId);
    const weakness = perf ? (1 - perf.independentAccuracy) * 3 + perf.hintRate * 2 + (1 - (perf.remediationAccuracy ?? 1)) : 0;
    const lapses = card?.reps ? 2 * Math.min(1, card.lapses / card.reps) : 0;
    const priority = (due ? 4 : 0) + (retrievability === null ? 0 : (1 - retrievability) * 3) + weakness + lapses;
    evidence.set(item.familyId, { familyId: item.familyId, due, retrievability, priority });
  }
  return { nodes, startId, items, evidence, cards, performance, familyIds };
}

type Catalog = ReturnType<typeof activeStudyCatalog>;

function studyDifficulty(catalog: Catalog): StudyDifficultyTier {
  const accuracy = [...catalog.performance.values()].map(p => p.independentAccuracy * (1 - 0.25 * p.hintRate));
  const mastery = [...catalog.familyIds].flatMap(family => {
    const card = catalog.cards.get(family);
    if (!card?.reps) return [];
    const retention = catalog.evidence.get(family)?.retrievability ?? (card.state === 2 ? 0.85 : 0.55);
    const stability = Math.min(1, Math.log1p(card.stability) / Math.log(15));
    return [retention * 0.5 + stability * 0.2 + (1 - Math.min(1, card.lapses / card.reps)) * 0.3];
  });
  const level = accuracy.length && mastery.length ? mean(accuracy) * 0.65 + mean(mastery) * 0.35
    : accuracy.length ? mean(accuracy) : mastery.length ? mean(mastery) : 0.75;
  return level < 0.65 ? 'foundational' : level >= 0.87 ? 'advanced' : 'standard';
}

function topoNodes(nodes: ReadonlyMap<string, KnowledgeNodeDef>): KnowledgeNodeDef[] {
  const remaining = new Map(nodes);
  const ordered: KnowledgeNodeDef[] = [];
  while (remaining.size) {
    const next = [...remaining.values()].find(node => node.prerequisites.every(id => !remaining.has(id)))
      ?? remaining.values().next().value!;
    ordered.push(next);
    remaining.delete(next.nodeId);
  }
  return ordered;
}

function seededUnit(seed: number, text: string): number {
  let h = 2166136261;
  for (const char of `${seed}/${text}`) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

function nodeStats(catalog: Catalog, nodeId: string) {
  const questions = catalog.items.filter(q => q.knowledgeNode === nodeId);
  const families = [...new Set(questions.map(q => q.familyId))];
  const priority = mean(families.map(id => catalog.evidence.get(id)!.priority).sort((a, b) => b - a).slice(0, 3));
  const load = mean(questions.map(q => Math.min(100, q.difficulty * 12 + q.estSeconds * 0.55)));
  return { families, priority, capacity: questions.length, load };
}

const skillSignals = [
  { label: '情景交际', pattern: /dialog|conversation|communicat|情景|交际|沟通/i },
  { label: '语法填空', pattern: /grammar|clause|syntax|nonfinite|语法|句法|非谓语/i },
  { label: '完形填空', pattern: /cloze|完形/i },
  { label: '应用表达与高频词块', pattern: /vocab|phrase|usage|expression|词块|词汇|表达/i },
  { label: '阅读推理', pattern: /reading|infer|comprehension|passage|阅读|推断|语篇|信息获取/i },
] as const;

function modularNodes(catalog: Catalog) {
  return [...catalog.nodes.values()].map((node, index) => {
    const { families, ...stats } = nodeStats(catalog, node.nodeId);
    let focus = 0;
    for (const family of families) {
      const evidence = catalog.evidence.get(family)!;
      const perf = catalog.performance.get(family);
      if (evidence.due || (perf && (perf.independentAccuracy < 0.65 || perf.hintRate > 0.5 || (perf.remediationAccuracy ?? 1) < 0.65))) {
        focus = Math.max(focus, evidence.priority);
      }
    }
    return { node, index, focus, ...stats,
      skill: skillSignals.find(skill => skill.pattern.test(`${node.nodeId} ${node.title}`)) };
  }).filter(entry => entry.capacity > 0);
}

function planModularArcs(nodes: ReturnType<typeof modularNodes>, arcSlots: readonly StudyArcSlots[], startId: string, seed: number, focused: boolean) {
  const rank = (entry: typeof nodes[number]) => entry.priority + (seed ? seededUnit(seed, entry.node.nodeId) : 0);
  const ranked = [...nodes].sort((a, b) => rank(b) - rank(a) || a.index - b.index);
  const byFocus = [...ranked].sort((a, b) => b.focus - a.focus);
  const first = focused ? byFocus[0] : nodes.find(entry => entry.node.nodeId === startId);
  const last = focused ? (byFocus[1] ?? byFocus[0]) : undefined;
  const used = new Set<typeof nodes[number]>();
  const covered = new Set<(typeof nodes[number])['skill']>();
  return arcSlots.map((_, index) => {
    const distinct = ranked.filter(entry => !used.has(entry) && entry !== last);
    const pool = distinct.length ? distinct : ranked.filter(entry => entry !== last);
    const next = (index === 0 ? first : index === arcSlots.length - 1 ? last : undefined)
      ?? skillSignals.filter(skill => !covered.has(skill)).map(skill => pool.find(entry => entry.skill === skill)).find(Boolean)
      ?? pool[0] ?? ranked[0]!;
    used.add(next);
    covered.add(next.skill);
    return next;
  });
}

export function buildMatchStudyBlueprint(input: MatchStudyBlueprintInput): MatchStudyBlueprint {
  const catalog = activeStudyCatalog(input);
  const modules = input.subject === 'english' ? modularNodes(catalog) : [];
  const focused = input.mode === 'deep' && !input.arcSlots && modules.some(entry => entry.focus > 0);
  const arcSlots = studyArcLayout(input.mode, input.arcSlots, input.subject, focused);
  const seed = input.seed ?? 0;
  if (!Number.isSafeInteger(seed)) throw new RangeError('Study seed must be a safe integer');
  const arcCount = arcSlots.length;
  const strategy = input.subject === 'math' ? 'structured_topic' : 'modular_pack';
  let topics: { node: KnowledgeNodeDef; load: number; skill?: { label: string } | undefined }[];
  if (input.subject === 'math') {
    const ordered = topoNodes(catalog.nodes).map(node => ({ node, ...nodeStats(catalog, node.nodeId) }));
    const next = ordered.slice(ordered.findIndex(n => n.node.nodeId === catalog.startId))
      .filter(n => n.node.nodeId === catalog.startId || n.capacity > 0);
    const review = ordered.filter(n => n.capacity > 0).sort((a, b) => b.priority - a.priority);
    topics = Array.from({ length: arcCount }, (_, index) => next[index] ?? review[(index - next.length) % review.length]!);
  } else {
    topics = planModularArcs(modules, arcSlots, catalog.startId, seed, focused);
  }
  const arcs: MatchStudyArcPlan[] = topics.map(({ node, load, skill }, arcIndex) => ({
    arcIndex,
    topicNodeIds: [node.nodeId],
    primaryNodeId: node.nodeId,
    title: node.title,
    subject: input.subject,
    strategy,
    tags: [skill?.label ?? node.title],
    loadScore: Math.round(load),
    slotsInArc: arcSlots[arcIndex]!,
    slotStages: plannedArcStages(arcSlots[arcIndex]!),
  }));
  return { mode: input.mode, subject: input.subject, arcCount, slotsPerArc: arcSlots.reduce((max, length) => max > length ? max : length, 2), difficultyTier: studyDifficulty(catalog), seed, arcs };
}
