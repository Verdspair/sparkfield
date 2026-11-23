import { describe, expect, it } from 'vitest';
import {
  AudioEventBus,
  ConfigurableCommunicationPolicy,
  DEFAULT_TACTICIAN_ID,
  LearningArcMetaSchema,
  MatchStudyBlueprintSchema,
  MODE_BUDGETS,
  PrepRoomMemberSchema,
  QuestionIssueReportSchema,
  QuestionItemSchema,
  RegisterRequestSchema,
  SEASON1_AUGMENTS,
  SEASON1_ITEMS,
  SEASON1_LORE,
  SEASON1_TRAITS,
  SEASON1_UNITS,
  TACTICIAN_CATALOG,
  TacticianIdSchema,
  UserProfileSchema,
  computeEstimatedEndTimeHHMM,
  isV1SupportedDisplay,
  lookupCraftRecipe,
} from '../src/index.js';

describe('@pkg/contracts & canonical content invariants', () => {
  it('defaults legacy tactician fields and accepts exactly the three catalog IDs', () => {
    const legacyProfile = {
      userId: 'legacy', username: 'legacy_pilot', nickname: '领航员', emailMasked: null,
      role: 'player', sessionEpoch: 1, onboardingChoice: 'skipped',
      displaySettings: { fullscreen: false, orientation: 'landscape' }, avatarFrameId: 'owned-frame',
    };
    const legacyMember = { userId: 'legacy', nickname: '领航员', isHost: true, ready: true };
    expect(UserProfileSchema.parse(legacyProfile)).toMatchObject({ preferredTacticianId: DEFAULT_TACTICIAN_ID, avatarFrameId: 'owned-frame' });
    expect(PrepRoomMemberSchema.parse(legacyMember).tacticianId).toBe(DEFAULT_TACTICIAN_ID);
    expect(TACTICIAN_CATALOG.map(({ id }) => id)).toEqual(TacticianIdSchema.options);
    expect(TACTICIAN_CATALOG.map(({ name }) => name)).toEqual(['星汐 · 小铃', '冰核 · 小鲸', '奇点 · 小猫']);
    expect(TacticianIdSchema.safeParse('tactician_unknown').success).toBe(false);
    expect(UserProfileSchema.safeParse({ ...legacyProfile, preferredTacticianId: 'owned-frame' }).success).toBe(false);
    expect(PrepRoomMemberSchema.safeParse({ ...legacyMember, tacticianId: null }).success).toBe(false);
  });

  it('verifies 36 units, 748 card pool, 1-7 char names, and 100% unique (faction, role) bijection', () => {
    expect(SEASON1_UNITS).toHaveLength(36);
    const totalCopies = SEASON1_UNITS.reduce((acc, u) => acc + u.poolCopies, 0);
    expect(totalCopies).toBe(748);

    const pairSet = new Set(SEASON1_UNITS.map((u) => `${u.faction}::${u.role}`));
    expect(pairSet.size).toBe(36);

    const fourCostRoles = new Set(SEASON1_UNITS.filter((u) => u.cost === 4).map((u) => u.role));
    expect(fourCostRoles.size).toBe(6);

    const nameLengths = new Set(SEASON1_UNITS.map((u) => u.nameLength));
    expect([...nameLengths].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('verifies closed 900s / 1800s / 3600s mode timelines, 50s prep windows, and Lv3-Lv10 shop odds = 100%', () => {
    const expectedTotals = { quick: 900, standard: 1800, deep: 3600 } as const;
    for (const [modeKey, totalSec] of Object.entries(expectedTotals)) {
      const m = MODE_BUDGETS.modes[modeKey as keyof typeof expectedTotals];
      const timelineSum = m.timeline.reduce((s, seg) => s + seg.duration, 0);
      expect(timelineSum).toBe(totalSec);
      expect(m.total).toBe(totalSec);
      const prepSegments = m.timeline.filter((seg) => seg.kind === 'strategy');
      expect(prepSegments.every((seg) => seg.duration === 50)).toBe(true);
      for (const seg of m.timeline) {
        expect(['entry', 'learning', 'resource', 'choice', 'strategy', 'battle', 'settlement', 'rest', 'exit']).toContain(seg.kind);
      }
    }

    for (const [lvl, odds] of Object.entries(MODE_BUDGETS.shop_odds)) {
      const sum = odds.reduce((a, b) => a + b, 0);
      expect(sum, `Shop odds at ${lvl} must sum to 100`).toBe(100);
    }
  });

  it('validates adaptive arc dimensions and the active stage without requiring uniform arc lengths', () => {
    const blueprint = {
      mode: 'deep', subject: 'math', arcCount: 3, slotsPerArc: 4, difficultyTier: 'foundational', seed: 37,
      arcs: [4, 3, 3].map((slotsInArc, arcIndex) => ({
        arcIndex, subject: 'math', slotsInArc, topicNodeIds: [`n${arcIndex}`], primaryNodeId: `n${arcIndex}`,
        title: '核心专题', strategy: 'structured_topic', tags: ['核心'], loadScore: 36,
        slotStages: slotsInArc === 4 ? ['intro', 'deepen', 'remediate', 'mastery'] : ['intro', 'deepen', 'mastery'],
      })),
    };
    expect(MatchStudyBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(MatchStudyBlueprintSchema.safeParse({ ...blueprint, slotsPerArc: 3 }).success).toBe(false);
    expect(MatchStudyBlueprintSchema.safeParse({ ...blueprint, difficultyTier: 'uniform' }).success).toBe(false);
    expect(MatchStudyBlueprintSchema.safeParse({ ...blueprint, mode: 'quick' }).success).toBe(false);
    const meta = {
      arcIndex: 1, arcCount: 3, slotInArc: 1, slotsPerArc: 3, stageKind: 'remediate', stageLabel: '错题订正',
      topicTitle: '核心专题', strategy: 'structured_topic', blueprintTags: ['核心'], adaptiveBranch: 'remediation_inserted',
      stageOutline: [
        { slot: 0, kind: 'intro', label: '导入', status: 'done' },
        { slot: 1, kind: 'remediate', label: '错题订正', status: 'active' },
        { slot: 2, kind: 'mastery', label: '终测', status: 'upcoming' },
      ],
    };
    expect(LearningArcMetaSchema.parse(meta)).toEqual(meta);
    expect(LearningArcMetaSchema.safeParse({ ...meta, slotInArc: 3 }).success).toBe(false);
    expect(LearningArcMetaSchema.safeParse({ ...meta, stageKind: 'stretch' }).success).toBe(false);
  });

  it('accepts a two-slot outline and rejects mismatched stages or arc dimensions', () => {
    const blueprint = {
      mode: 'quick', subject: 'english', arcCount: 2, slotsPerArc: 2, difficultyTier: 'standard', seed: 0,
      arcs: [0, 1].map(arcIndex => ({ arcIndex, subject: 'english', slotsInArc: 2, topicNodeIds: [`n${arcIndex}`],
        primaryNodeId: `n${arcIndex}`, title: '语法填空', strategy: 'modular_pack', tags: ['语法'], loadScore: 36,
        slotStages: ['intro', 'mastery'] })),
    };
    expect(MatchStudyBlueprintSchema.parse(blueprint)).toEqual(blueprint);
    expect(MatchStudyBlueprintSchema.safeParse({ ...blueprint, arcs: [{ ...blueprint.arcs[0], slotStages: ['intro', 'stretch'] }, blueprint.arcs[1]] }).success).toBe(false);
    const meta = {
      arcIndex: 0, arcCount: 2, slotInArc: 1, slotsPerArc: 2, stageKind: 'mastery', stageLabel: '终测',
      topicTitle: '语法填空', strategy: 'modular_pack', blueprintTags: ['语法'], adaptiveBranch: 'standard',
      stageOutline: [{ slot: 0, kind: 'intro', label: '熟悉', status: 'done' }, { slot: 1, kind: 'mastery', label: '终测', status: 'active' }],
    };
    expect(LearningArcMetaSchema.parse(meta)).toEqual(meta);
    expect(LearningArcMetaSchema.safeParse({ ...meta, stageOutline: meta.stageOutline.slice(0, 1) }).success).toBe(false);
  });

  it('verifies 8 components -> 36 completed items + 8 faction emblems + mothership flag', () => {
    expect(SEASON1_ITEMS.components).toHaveLength(8);
    expect(SEASON1_ITEMS.completedItems).toHaveLength(36);
    expect(SEASON1_ITEMS.emblems).toHaveLength(8);
    expect(lookupCraftRecipe('C_SWORD', 'C_BOW')?.id).toBe('I_LORENTZ_RAIL');
    expect(lookupCraftRecipe('C_BOW', 'C_SWORD')?.id).toBe('I_LORENTZ_RAIL');
    expect(lookupCraftRecipe('C_RUBBING', 'C_RUBBING')?.id).toBe('I_MOTHERSHIP_FLAG');
  });

  it('verifies 24 augments (8 silver / 10 gold / 6 prismatic), 18 traits, and 190 lore voice lines', () => {
    expect(SEASON1_AUGMENTS).toHaveLength(24);
    expect(SEASON1_TRAITS.factions).toHaveLength(8);
    expect(SEASON1_TRAITS.roles).toHaveLength(6);
    expect(SEASON1_TRAITS.uniques).toHaveLength(4);
    expect(SEASON1_LORE.eras).toHaveLength(6);
    const totalVo = SEASON1_LORE.units.reduce((s, u) => s + u.voiceLines.length, 0);
    expect(totalVo).toBe(190);
  });

  it('enforces optional email without fake email, display orientation boundary, and learning hint/review isolation', () => {
    const regNoEmail = RegisterRequestSchema.parse({
      username: 'linxian_01',
      password: `cred_${Date.now()}`,
      nickname: '林弦',
      email: '',
    });
    expect(regNoEmail.email).toBeNull();

    expect(isV1SupportedDisplay({ fullscreen: true, orientation: 'landscape' })).toBe(true);
    expect(isV1SupportedDisplay({ fullscreen: false, orientation: 'landscape' })).toBe(true);
    expect(isV1SupportedDisplay({ fullscreen: true, orientation: 'portrait' })).toBe(false);
    expect(computeEstimatedEndTimeHHMM(new Date(2026, 10, 12, 14, 15, 0), 1800)).toBe('14:45');

    expect(() =>
      QuestionItemSchema.parse({
        questionId: 'BAD_1',
        familyId: 'F1',
        subject: 'english',
        knowledgeNode: 'N1',
        stepRole: 'resource_check',
        questionType: 'single_choice',
        assessmentKind: 'retrieval',
        allowMaterialReview: false,
        stemMd: 'Test',
        answerSpec: 'A',
        hintMd: 'Illegal hint on resource check!',
        explanationMd: 'Exp',
        sourceLicense: 'test',
      }),
    ).toThrow();
  });

  it('verifies reserved non-invasive extension contracts (CommunicationMessage text typing, AudioEventBus, QuestionIssueReport)', () => {
    const policy = new ConfigurableCommunicationPolicy({ allowTextChat: true });
    expect(policy.allowTextChat).toBe(true);
    expect(policy.filterTextPayload('  你好，第4轮准备升7人口  ')).toEqual({
      allowed: true,
      sanitized: '你好，第4轮准备升7人口',
    });
    policy.setBlock('u2', 'u1', true);
    expect(policy.isSenderBlocked('u2', 'u1')).toBe(true);

    const bus = new AudioEventBus();
    let starTriggered = 0;
    bus.setAdapter({
      onPhaseChange: () => {},
      onUnitPurchase: () => {},
      onUnitStarUp: ({ newStar }) => {
        starTriggered = newStar;
      },
      onBattleStart: () => {},
      onSkillCast: () => {},
      onUnitDeath: () => {},
      onRoundResult: () => {},
      onLessonAudioPlay: () => {},
    });
    bus.emit('onUnitStarUp', { unitId: 'S01', newStar: 3 });
    expect(starTriggered).toBe(3);

    const report = QuestionIssueReportSchema.parse({
      questionId: 'MATH_Q02',
      packVersion: '1.0.0',
      attemptRef: 'att_01',
      reasonCode: 'typo_or_formula',
    });
    expect(report.reasonCode).toBe('typo_or_formula');
  });
});
