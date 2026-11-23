import { ArcStageKindSchema, DivmodGoldSettlementSchema, MODE_BUDGETS } from '@pkg/contracts';
import { describe, expect, it } from 'vitest';
import { evaluateLearningBonusDrops, finalizeLearningGoldCarry, gradeFrozenLearningUnits, settleLearningNodeGold, type GradedLearningUnit } from '../src/index.js';
import { question } from './fixtures.js';

const unit = (stepRole: GradedLearningUnit['stepRole'], n = '1', d = '1', weight = 10): GradedLearningUnit => ({ stepRole, weight, quality: { numerator: n, denominator: d } });
describe('learning budget settlement', () => {
  it.each(['quick', 'standard', 'deep'] as const)('reads every %s budget/verification weight and carries exactly to the match cap', (mode) => {
    let carry = 0; let gold = 0;
    const config = MODE_BUDGETS.modes[mode];
    for (const [blockIndex, budget] of config.learning_gold_cap_by_block_cents.entries()) {
      const result = settleLearningNodeGold({ mode, blockIndex, gradedUnits: [unit('resource_check'), unit('verification')], carryInCents: carry });
      expect(result.centBudget).toBe(budget);
      expect(result.verificationWeightPercent).toBe(config.verification_weight_percent_by_block[blockIndex]);
      expect(result.rawEarnedCents).toBe(budget);
      expect(result.orbSplits.reduce((sum, n) => sum + n, 0)).toBe(result.grantedIntegerGold);
      expect(result.orbSplits.every((n) => n === 1 || n === 2)).toBe(true);
      carry = result.carryOutCents; gold += result.grantedIntegerGold;
    }
    expect(gold * 100 + carry).toBe(config.learning_gold_total_max_cents);
    expect(carry).toBe(0);
  });
  it('normalizes weights within phase before applying the configured verification proportion', () => {
    const result = settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [
      unit('resource_check', '1', '1', 1), unit('resource_check', '0', '1', 3), unit('verification'),
    ] });
    expect(result.exactScore).toEqual({ numerator: '19', denominator: '40' });
    expect(result.rawEarnedCents).toBe(498);
  });
  it('freezes the denominator for skip and timeout; practice/remediation have no economic effect', () => {
    const units = [unit('resource_check'), { ...unit('resource_check'), status: 'timed_out' as const },
      { ...unit('resource_check'), status: 'skipped' as const }, unit('verification', '0'), unit('practice'), unit('remediation')];
    const result = settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: units });
    expect(result.exactScore).toEqual({ numerator: '7', denominator: '30' });
    expect(result.rawEarnedCents).toBe(245);
    expect(settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [unit('practice'), unit('remediation')] }).rawEarnedCents).toBe(0);
  });
  it('treats missing frozen answers as zero without dropping their weights', () => {
    const qs = [question(), question({ questionId: 'q2' }), question({ questionId: 'q3', stepRole: 'verification' })];
    const result = settleLearningNodeGold({ mode: 'quick', nodeIndex: 2, questions: qs, submissions: { q1: 'A', q3: 'A' } });
    expect(gradeFrozenLearningUnits(qs, { q1: 'A' })[1]!.isSkipped).toBe(true);
    expect(result.exactScore).toEqual({ numerator: '13', denominator: '20' });
    expect(result.rawEarnedCents).toBe(682);
  });
  it('does not renormalize a missing whole phase into full marks', () => {
    expect(settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [unit('resource_check')] }).rawEarnedCents).toBe(735);
    expect(settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [unit('verification')] }).rawEarnedCents).toBe(315);
  });
  it('does exact BigInt sums beyond Number safe integer during intermediate arithmetic', () => {
    const large = Number.MAX_SAFE_INTEGER;
    const result = settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [
      unit('resource_check', '1', '3', large), unit('resource_check', '2', '3', large), unit('verification', '1', '3'),
    ] });
    expect(result.exactScore).toEqual({ numerator: '9', denominator: '20' });
    expect(result.rawEarnedCents).toBe(472);
  });
  it('floors before divmod, splits integer gold into 2G/1G orbs, and clears terminal carry without reward', () => {
    const result = settleLearningNodeGold({ mode: 'quick', blockIndex: 3, gradedUnits: [unit('resource_check'), unit('verification')], carryInCents: 99 });
    expect(result).toMatchObject({ grantedIntegerGold: 15, orbSplits: [2, 2, 2, 2, 2, 2, 2, 1], carryOutCents: 99 });
    expect(finalizeLearningGoldCarry(99)).toEqual({ discardedCarryCents: 99, carryOutCents: 0, grantedIntegerGold: 0 });
  });
  it('returns exact decimal strings for huge score fractions without blocking valid settlement', () => {
    const result = settleLearningNodeGold({ mode: 'quick', blockIndex: 2, gradedUnits: [unit('resource_check', '1', '100000000000000000000')] });
    expect(result.scoreNumerator).toBe(7);
    expect(result.scoreDenominator).toBe('1000000000000000000000');
    expect(result.exactScore).toEqual({ numerator: '7', denominator: '1000000000000000000000' });
    expect(result.rawEarnedCents).toBe(0);
    const tiny = question({ questionType: 'multi_step_numeric', stepsRubric: [
      { stepId: 'middle', prompt: 'Middle', expected: 1, tolerance: 0, weightShare: 0.0000000000000001 },
      { stepId: 'final', prompt: 'Final', expected: 2, tolerance: 0, weightShare: 0.9999999999999999 },
    ], answerSpec: 'middle=1;final=2' });
    const valid = settleLearningNodeGold({ mode: 'quick', nodeIndex: 2, questions: [tiny], submissions: { q1: 'middle=1' } });
    expect(valid.scoreNumerator).toBe(7);
    expect(valid.scoreDenominator).toBe('100000000000000000');
  });
  it('fully credits the only available assessed role in a single-role slot', () => {
    for (const stepRole of ['resource_check', 'verification'] as const) {
      for (const [index, cents] of [[0, 700], [1, 950], [3, 1500]] as const) {
        const result = settleLearningNodeGold({ mode: 'quick', blockIndex: index, gradedUnits: [unit(stepRole)] });
        expect(result.rawEarnedCents).toBe(cents);
      }
    }
    expect(settleLearningNodeGold({ mode: 'quick', blockIndex: 0, gradedUnits: [unit('resource_check', '0'), unit('verification')] }).rawEarnedCents).toBe(0);
    expect(settleLearningNodeGold({ mode: 'quick', blockIndex: 3, gradedUnits: [unit('resource_check'), unit('verification', '0')] }).rawEarnedCents).toBe(0);
  });
  it('rejects invalid settlement input instead of silently rounding it', () => {
    for (const carry of [-1, 100, 0.5]) expect(() => settleLearningNodeGold({ mode: 'quick', blockIndex: 0, gradedUnits: [], carryInCents: carry })).toThrow();
    expect(() => settleLearningNodeGold({ mode: 'quick', blockIndex: 4, gradedUnits: [] })).toThrow();
    expect(() => settleLearningNodeGold({ mode: 'quick', blockIndex: 0, gradedUnits: [unit('resource_check', '2')] })).toThrow();
    expect(() => settleLearningNodeGold({ mode: 'quick', blockIndex: 0, gradedUnits: [unit('resource_check', '1', '0')] })).toThrow();
    expect(() => settleLearningNodeGold({ mode: 'quick', nodeIndex: 0, questions: [question(), question()], submissions: {} })).toThrow('Duplicate');
  });
});

describe('learning bonus drops', () => {
  it.each(ArcStageKindSchema.options)('applies the score tiers for %s', (stageKind) => {
    const high = { bonusComponents: stageKind === 'intro' ? 0 : 1, bonusRerollVouchers: stageKind === 'mastery' ? 2 : 1 };
    const good = { bonusComponents: stageKind === 'mastery' ? 1 : 0, bonusRerollVouchers: stageKind === 'mastery' ? 0 : 1 };
    expect(evaluateLearningBonusDrops({ n: 100n, d: 100n }, stageKind)).toEqual({ performanceTier: 'perfect', ...high });
    expect(evaluateLearningBonusDrops({ n: 90n, d: 100n }, stageKind)).toEqual({ performanceTier: 'excellent', ...high });
    expect(evaluateLearningBonusDrops({ n: 75n, d: 100n }, stageKind)).toEqual({ performanceTier: 'good', ...good });
    expect(evaluateLearningBonusDrops({ n: 40n, d: 100n }, stageKind)).toEqual({ performanceTier: 'base', bonusComponents: 0, bonusRerollVouchers: 0 });
  });

  it('uses exact cutoffs even when the last digit cannot be represented by a Number', () => {
    const d = 100n * 10n ** 30n;
    const tier = (n: bigint) => evaluateLearningBonusDrops({ numerator: String(n), denominator: String(d) }, 'mastery').performanceTier;
    const excellent = d * 90n / 100n;
    const good = d * 65n / 100n;
    expect(tier(d - 1n)).toBe('excellent');
    expect(tier(excellent)).toBe('excellent');
    expect(tier(excellent - 1n)).toBe('good');
    expect(tier(good)).toBe('good');
    expect(tier(good - 1n)).toBe('base');
    expect(tier(0n)).toBe('base');
  });

  it.each([
    { n: '1', d: '1', gold: 15, carry: 0, tier: 'perfect', components: 1, vouchers: 2 },
    { n: '3', d: '4', gold: 11, carry: 25, tier: 'good', components: 1, vouchers: 0 },
    { n: '2', d: '5', gold: 6, carry: 0, tier: 'base', components: 0, vouchers: 0 },
  ])('pairs $n/$d assessment with $gold gold and $tier mastery drops', ({ n, d, gold, carry, tier, components, vouchers }) => {
    const settlement = settleLearningNodeGold({ mode: 'quick', blockIndex: 3, gradedUnits: [unit('verification', n, d)] });
    expect(settlement).toMatchObject({ grantedIntegerGold: gold, carryOutCents: carry });
    expect(evaluateLearningBonusDrops(settlement.exactScore, 'mastery')).toEqual({ performanceTier: tier, bonusComponents: components, bonusRerollVouchers: vouchers });
  });

  it('keeps the settlement contract compatible with old payloads and preserves granted bonus fields', () => {
    const gold = settleLearningNodeGold({ mode: 'quick', blockIndex: 0, gradedUnits: [unit('resource_check')] });
    expect(DivmodGoldSettlementSchema.parse(gold)).not.toHaveProperty('performanceTier');
    expect(DivmodGoldSettlementSchema.parse({ ...gold, bonusItemIds: ['C_SWORD'], bonusRerollVouchers: 1, performanceTier: 'perfect' }))
      .toMatchObject({ bonusItemIds: ['C_SWORD'], bonusRerollVouchers: 1, performanceTier: 'perfect' });
  });
});
