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
const stableIdOrder = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

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
  return { priority, capacity: questions.length, load };
}

const skillSignals = [
  { axis: 'communication', label: '情景交际', weight: 0.2, pattern: /dialog|conversation|communicat|情景|交际|沟通/i },
  { axis: 'communication', label: '应用表达与高频词块', weight: 0.2, pattern: /vocab|phrase|usage|expression|词块|词汇|表达/i },
  { axis: 'grammar', label: '语法填空', weight: 0.1, pattern: /grammar|clause|syntax|nonfinite|语法|句法|非谓语/i },
  { axis: 'reading', label: '阅读推理', weight: 0.4, pattern: /reading|infer|comprehension|passage|阅读|推断|语篇|信息获取/i },
  { axis: 'reading', label: '完形填空', weight: 0.1, pattern: /cloze|完形/i },
] as const;

function nodeSkills(node: KnowledgeNodeDef) {
  return skillSignals.filter(skill => skill.pattern.test(`${node.nodeId} ${node.title}`));
}

function modularNodePacks(catalog: Catalog, arcSlots: readonly StudyArcSlots[], seed: number): KnowledgeNodeDef[][] {
  const nodes = [...catalog.nodes.values()].map(node => ({ node, skills: nodeSkills(node), ...nodeStats(catalog, node.nodeId) })).filter(n => n.capacity > 0);
  const usage = new Map<string, number>();
  const primaryUsage = new Map<string, number>();
  const priorPacks = new Set<string>();
  const result: KnowledgeNodeDef[][] = [];
  for (let arcIndex = 0; arcIndex < arcSlots.length; arcIndex++) {
    const score = (entry: typeof nodes[number]) => {
      const id = entry.node.nodeId;
      return entry.priority * 0.8 + (id === catalog.startId && arcIndex === 0 ? 2.5 : 0)
        - (usage.get(id) ?? 0) * 1.5 + seededUnit(seed, `${arcIndex}/${id}`) * 2;
    };
    const pool = [...nodes].sort((a, b) => score(b) - score(a) || stableIdOrder(a.node.nodeId, b.node.nodeId)).slice(0, 16);
    const key = (members: readonly typeof nodes[number][]) => members.map(n => n.node.nodeId).sort(stableIdOrder).join('\n');
    const rank = (members: readonly typeof nodes[number][]) => {
      const capacity = members.reduce((sum, n) => sum + n.capacity, 0);
      const load = mean(members.map(n => n.load)) + Math.max(0, members.length - 2) * 9;
      const uniqueSkills = new Set(members.flatMap(n => n.skills));
      const coveredAxes = new Set(members.flatMap(n => n.skills.length ? [n.skills[0]!.axis] : []));
      const scoringCoverage = [...uniqueSkills].reduce((total, skill) => total + skill.weight, 0);
      const span = arcSlots[arcIndex]!;
      const targetLoad = 38 + (span - 3) * 8;
      const allComplementary = coveredAxes.size === 3;
      return mean(members.map(score)) + 1.6 * coveredAxes.size + 4 * scoringCoverage + (allComplementary && span >= 4 ? 2 : 0)
        - Math.abs(load - targetLoad) / 16 - Math.max(0, span * 2 - capacity) * 0.85
        - (priorPacks.has(key(members)) ? 7 : 0) - (coveredAxes.size < members.length && members.length > 2 ? 2.5 : 0);
    };
    let best = pool.slice(0, Math.min(2, pool.length));
    for (let a = 0; a < pool.length; a++) for (let b = a + 1; b < pool.length; b++) {
      const pair = [pool[a]!, pool[b]!];
      if (rank(pair) > rank(best)) best = pair;
      for (let c = b + 1; c < pool.length; c++) {
        const trio = [...pair, pool[c]!];
        if (rank(trio) > rank(best)) best = trio;
      }
    }
    priorPacks.add(key(best));
    best.sort((a, b) => score(b) - score(a) + 4 * ((primaryUsage.get(a.node.nodeId) ?? 0) - (primaryUsage.get(b.node.nodeId) ?? 0)));
    const primary = best[0]!.node.nodeId;
    primaryUsage.set(primary, (primaryUsage.get(primary) ?? 0) + 1);
    for (const { node } of best) usage.set(node.nodeId, (usage.get(node.nodeId) ?? 0) + 1);
    result.push(best.map(n => n.node));
  }
  return result;
}

export function buildMatchStudyBlueprint(input: MatchStudyBlueprintInput): MatchStudyBlueprint {
  const catalog = activeStudyCatalog(input);
  const arcSlots = studyArcLayout(input.mode, input.arcSlots);
  const arcCount = arcSlots.length;
  const seed = input.seed ?? 0;
  if (!Number.isSafeInteger(seed)) throw new RangeError('Study seed must be a safe integer');
  let groups: KnowledgeNodeDef[][];
  if (input.subject === 'math') {
    const ordered = topoNodes(catalog.nodes);
    const next = ordered.slice(ordered.findIndex(n => n.nodeId === catalog.startId))
      .filter(n => n.nodeId === catalog.startId || nodeStats(catalog, n.nodeId).capacity > 0);
    const review = ordered.map((node, i) => ({ node, i, ...nodeStats(catalog, node.nodeId) }))
      .filter(n => n.capacity > 0).sort((a, b) => b.priority - a.priority || a.i - b.i);
    groups = Array.from({ length: arcCount }, (_, index) => [next[index] ?? review[(index - next.length) % review.length]!.node]);
  } else {
    groups = modularNodePacks(catalog, arcSlots, seed);
  }
  const arcs: MatchStudyArcPlan[] = groups.map((nodes, arcIndex) => ({
    arcIndex,
    topicNodeIds: nodes.map(n => n.nodeId),
    primaryNodeId: nodes[0]!.nodeId,
    title: nodes.map(n => n.title).join(' · '),
    subject: input.subject,
    strategy: input.subject === 'math' ? 'structured_topic' : 'modular_pack',
    tags: input.subject === 'math' ? nodes.map(n => n.title) : [...new Set(nodes.map(n => nodeSkills(n)[0]?.label ?? n.title))],
    loadScore: Math.min(100, Math.round(mean(nodes.map(n => nodeStats(catalog, n.nodeId).load)) + Math.max(0, nodes.length - 2) * 9)),
    slotsInArc: arcSlots[arcIndex]!,
    slotStages: plannedArcStages(arcSlots[arcIndex]!),
  }));
  return { mode: input.mode, subject: input.subject, arcCount, slotsPerArc: arcSlots.reduce((max, length) => max > length ? max : length, 3 as StudyArcSlots), difficultyTier: studyDifficulty(catalog), seed, arcs };
}
