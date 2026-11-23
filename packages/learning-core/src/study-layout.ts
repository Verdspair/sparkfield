import { MODE_BUDGETS, StudyArcSlotsSchema, type ArcStageKind, type DurationMode, type MatchStudyBlueprint, type StudyArcSlots } from '@pkg/contracts';

const stages: Readonly<Record<StudyArcSlots, readonly ArcStageKind[]>> = {
  3: ['intro', 'deepen', 'mastery'],
  4: ['intro', 'deepen', 'remediate', 'mastery'],
  5: ['intro', 'deepen', 'diagnose', 'remediate', 'mastery'],
};

export function studyArcLayout(mode: DurationMode, arcSlots?: readonly StudyArcSlots[]): StudyArcSlots[] {
  const config = MODE_BUDGETS.modes[mode];
  const layout = (arcSlots ?? config.study_arc_slots).map(slots => StudyArcSlotsSchema.parse(slots));
  if (layout.reduce((sum, slots) => sum + slots, 0) !== config.learning.length) throw new RangeError('Study arc layout must fill the shared mode timeline');
  return layout;
}

export function plannedArcStages(slotsInArc: StudyArcSlots): ArcStageKind[] {
  return [...stages[slotsInArc]];
}

export function locateMatchStudySlot(blueprint: MatchStudyBlueprint, nodeIndex: number) {
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0) throw new RangeError('Invalid match study slot');
  let slotInArc = nodeIndex;
  for (const arc of blueprint.arcs) {
    if (slotInArc < arc.slotsInArc) return { arcIndex: arc.arcIndex, slotInArc, slotsInArc: arc.slotsInArc, arc };
    slotInArc -= arc.slotsInArc;
  }
  throw new RangeError('Study blueprint has no arc for the learning slot');
}

const arcGoldShares: Readonly<Record<StudyArcSlots, readonly number[]>> = {
  3: [20, 33, 47], 4: [15, 24, 26, 35], 5: [10, 16, 19, 23, 32],
};

export function studySlotGoldBudget(blueprint: MatchStudyBlueprint, nodeIndex: number, matchGoldCents: number): number {
  const { arcIndex, slotInArc, slotsInArc } = locateMatchStudySlot(blueprint, nodeIndex);
  const arcCents = Math.floor(matchGoldCents * (arcIndex + 1) / blueprint.arcCount)
    - Math.floor(matchGoldCents * arcIndex / blueprint.arcCount);
  const shares = arcGoldShares[slotsInArc];
  const earlier = shares.slice(0, slotInArc).reduce((sum, share) => sum + share, 0);
  return Math.floor(arcCents * (earlier + shares[slotInArc]!) / 100) - Math.floor(arcCents * earlier / 100);
}

export function phasePolicyForStudySlot(blueprint: MatchStudyBlueprint, nodeIndex: number, plannedSeconds: number) {
  const slot = locateMatchStudySlot(blueprint, nodeIndex);
  const stage = slot.arc.slotStages[slot.slotInArc];
  const mixed = (slot.slotsInArc === 3 && slot.slotInArc === 1) || stage === 'remediate' || stage === 'stretch';
  const verificationWeightPercent = stage === 'mastery' ? 100 : mixed ? 30 : 0;
  const percentages = verificationWeightPercent === 100 ? [0, 0, 0, 0, 100]
    : mixed ? [25, 0, 30, 15, 30] : stage === 'diagnose' ? [0, 0, 100, 0, 0] : [35, 0, 65, 0, 0];
  const phaseSeconds = percentages.map(percent => Math.floor(plannedSeconds * percent / 100));
  phaseSeconds[percentages[4] ? 4 : 2]! += plannedSeconds - phaseSeconds.reduce((a, b) => a + b, 0);
  return { phaseSeconds, verificationWeightPercent };
}
