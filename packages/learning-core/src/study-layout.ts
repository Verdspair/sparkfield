import { MODE_BUDGETS, StudyArcSlotsSchema, type ArcStageKind, type DurationMode, type MatchStudyBlueprint, type StudyArcSlots, type SubjectId } from '@pkg/contracts';

const stages: Readonly<Record<StudyArcSlots, readonly ArcStageKind[]>> = {
  2: ['intro', 'mastery'],
  3: ['intro', 'deepen', 'mastery'],
  4: ['intro', 'deepen', 'remediate', 'mastery'],
  5: ['intro', 'deepen', 'diagnose', 'remediate', 'mastery'],
};

const englishArcLayouts: Readonly<Record<DurationMode, readonly StudyArcSlots[]>> = {
  quick: [2, 2], standard: [2, 2, 2, 2], deep: [2, 2, 2, 2, 2],
};

export function studyArcLayout(mode: DurationMode, arcSlots?: readonly StudyArcSlots[], subject: SubjectId = 'math', focused = false): StudyArcSlots[] {
  const config = MODE_BUDGETS.modes[mode];
  const defaults = subject !== 'english' ? config.study_arc_slots
    : mode === 'deep' && focused ? [3, 2, 2, 3] : englishArcLayouts[mode];
  const layout = (arcSlots ?? defaults).map(slots => StudyArcSlotsSchema.parse(slots));
  if (layout.reduce((sum, slots) => sum + slots, 0) !== config.learning.length) throw new RangeError('Study arc layout must fill the shared mode timeline');
  return layout;
}

export function plannedArcStages(slotsInArc: StudyArcSlots): ArcStageKind[] {
  return [...stages[slotsInArc]];
}

export function roomSlotBonusStage(mode: DurationMode, nodeIndex: number): ArcStageKind {
  const layout = MODE_BUDGETS.modes[mode].study_arc_slots as readonly StudyArcSlots[];
  let rem = nodeIndex;
  for (const slotsInArc of layout) {
    if (rem < slotsInArc) {
      return stages[slotsInArc][rem] ?? 'deepen';
    }
    rem -= slotsInArc;
  }
  return 'mastery';
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
