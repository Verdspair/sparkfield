import { expect, test } from '@playwright/test';
import { QuestionItemSchema } from '@pkg/contracts';
import { toClientQuestionView } from '@pkg/learning-core';
import type { MatchLearningView } from '../src/api/matchSocket.js';
import { closeSettings, exitOfflineMatch, openSettings } from './support/flowHelpers.js';
import { exerciseShopDock, setShopDock, watchPageErrors } from './support/fullAcceptance.js';
import { baseSnapshot, home, mountHud, readHudEffects, rejectHudLearningSubmit, updateHud } from './support/hudHarness.js';
import { english } from './support/mockUi.js';

const question = toClientQuestionView(QuestionItemSchema.parse(
  english.items.find((item) => item.stepRole === 'practice' && item.questionType === 'single_choice'),
));
const feedback = '本题反馈已保留';
const practice: MatchLearningView = {
  nodeIndex: 0, currentStep: 'practice', complete: false, clientQuestions: [question],
  steps: (['practice', 'resource_check'] as const).map((kind) => ({
    kind, active: true, plannedSeconds: 60, questionIds: kind === 'practice' ? [question.questionId] : [], materials: [], corrections: [],
  })), submittedQuestionIds: [], feedback: {},
};

test('arming equipment does not target an old inspected unit or survive a phase change', async ({ page }) => {
  await mountHud(page);
  await page.getByTestId('hud-left-items-tab').click();
  await updateHud(page, {}, { inspectedUnitId: home.units[0]!.instanceId });
  await page.getByTestId('inventory-item-0').click();
  expect((await readHudEffects(page)).commands).toEqual([]);
  await updateHud(page, { phase: 'battle', phaseIndex: 4 });
  await updateHud(page, { phase: 'strategy', phaseIndex: 9 }, { inspectedUnitId: home.units[0]!.instanceId });
  expect((await readHudEffects(page)).commands).toEqual([]);
  await page.getByTestId('inventory-item-0').click();
  await page.locator('.blc-quick-target-box button').first().click();
  expect((await readHudEffects(page)).commands).toEqual([{ type: 'EQUIP_ITEM', inventoryItemIndex: 0, targetInstanceId: home.units[0]!.instanceId }]);
});

test('max level uses the mode cap and a pending action blocks old shop and planner clicks', async ({ page }) => {
  await mountHud(page, { self: { ...baseSnapshot.self, level: 8 } });
  await expect(page.getByTestId('buy-xp-btn')).toBeDisabled();
  await updateHud(page, {}, { matchActionPending: true });
  await expect(page.getByTestId('refresh-shop-btn')).toBeDisabled();
  await expect(page.getByTestId('shop-card-slot-0')).toBeDisabled();
  await updateHud(page, {}, { matchActionPending: false });
  await expect(page.getByTestId('refresh-shop-btn')).toBeEnabled();
});

test('iron anvil is hidden in strategy and augment events, but offered in anvil events', async ({ page }) => {
  const anvil = { instanceId: 'test-anvil', kind: 'component' as const, options: ['C_SWORD', 'C_BOW', 'C_ROD'] };
  await mountHud(page, { self: { ...baseSnapshot.self, anvils: [anvil] } });
  await expect(page.getByTestId('choice-event-modal')).toHaveCount(0);
  await updateHud(page, { phase: 'choice', phaseIndex: 8 });
  await expect(page.getByTestId('choice-event-modal')).toHaveCount(0);
  await updateHud(page, { phase: 'choice', phaseIndex: 17 });
  await expect(page.getByTestId('pick-anvil-0')).toBeVisible();
});

test('submitted feedback stays visible when the authoritative snapshot advances to the next step', async ({ page }) => {
  await mountHud(page, { phase: 'learning', phaseIndex: 1, learning: practice });
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await updateHud(page, { learning: { ...practice, currentStep: 'resource_check', clientQuestions: [],
    submittedQuestionIds: [question.questionId], feedback: { [question.questionId]: { isCorrect: false, explanationMd: feedback } } } });
  await expect(page.getByTestId('question-feedback-box')).toContainText(feedback);
  await page.getByTestId('advance-step-btn').click();
  await expect(page.getByTestId('question-step-card')).toHaveAttribute('data-step-kind', 'resource_check');
});

test('a rejected learning action restores answer controls and reports the failure once', async ({ page }) => {
  const errors = watchPageErrors(page);
  await mountHud(page, { phase: 'learning', phaseIndex: 1, learning: practice });
  await rejectHudLearningSubmit(page, 'AUDIT_LEARNING_REJECTED');
  await page.getByTestId('option-A').click();
  await page.getByTestId('submit-answer-btn').click();
  await expect(page.getByTestId('submit-answer-btn')).toBeEnabled();
  expect((await readHudEffects(page)).toasts).toEqual(['AUDIT_LEARNING_REJECTED']);
  expect(errors).toEqual([]);
});

test('local settings, codex, damage tab, and quit remain usable while disconnected or pending', async ({ page }) => {
  await mountHud(page);
  await updateHud(page, {}, { matchConnectionState: 'disconnected', matchActionPending: true });
  await expect(page.getByTestId('refresh-shop-btn')).toBeDisabled();
  await expect(page.getByTestId('shop-card-slot-0')).toBeDisabled();
  await page.getByTestId('hud-right-damage-tab').click();
  await expect(page.getByTestId('hud-damage-panel')).toBeVisible();
  await page.getByTestId('open-inmatch-codex-btn').click();
  await expect(page.getByTestId('inmatch-codex-modal')).toBeVisible();
  await page.getByTestId('inmatch-codex-modal').getByRole('button', { name: '关闭' }).click();
  for (const position of ['top', 'bottom'] as const) {
    await setShopDock(page, position, true);
    await exerciseShopDock(page, position);
    await expect(page.getByTestId('shop-card-slot-0')).toBeDisabled();
  }
  await exitOfflineMatch(page);
  await expect(page.getByTestId('match-hud-overlay')).toHaveCount(0);
  expect(await readHudEffects(page)).toMatchObject({ quitCount: 1, commands: [] });
});

test('global description mode defaults to compact and syncs choice modal, inspect card, and settings', async ({ page }) => {
  await mountHud(page, {
    phase: 'choice',
    phaseIndex: 8,
    self: {
      ...baseSnapshot.self,
      augmentOffer: {
        tier: 'gold',
        options: ['AUG_S05', 'AUG_G03', 'AUG_P01'],
        rerolls: [true, true, true],
        node: 1,
        finalStage: false,
        eligibleTraits: [],
      },
    },
  });
  const modal = page.getByTestId('choice-event-modal');
  await expect(modal).toBeVisible();
  const toggleBtn = modal.getByTestId('desc-mode-toggle-btn');
  await expect(toggleBtn).toHaveAttribute('data-desc-mode', 'compact');
  await expect(toggleBtn).toHaveAttribute('aria-checked', 'false');
  await expect(modal.getByTestId('augment-slot-0')).toContainText('前两排友军开战获得高额护盾');
  await expect(modal.getByTestId('augment-slot-0')).not.toContainText('16%');

  await toggleBtn.click();
  await expect(toggleBtn).toHaveAttribute('data-desc-mode', 'detailed');
  await expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
  await expect(modal.getByTestId('augment-slot-0')).toContainText('16%');
  await expect(modal.getByTestId('augment-slot-2')).toContainText('260');

  await updateHud(page, { phase: 'strategy', phaseIndex: 9 }, { inspectedUnitId: home.units[0]!.instanceId });
  const inspectCard = page.getByTestId('unit-inspect-card');
  await expect(inspectCard.getByTestId('desc-mode-toggle-btn')).toHaveAttribute('data-desc-mode', 'detailed');
  await expect(inspectCard.getByTestId('desc-mode-toggle-btn')).toHaveAttribute('aria-checked', 'true');

  const settings = await openSettings(page, 'match', true);
  await expect(settings.getByTestId('desc-mode-detailed-btn')).toHaveAttribute('aria-pressed', 'true');
  await settings.getByTestId('desc-mode-compact-btn').click();
  await expect(settings.getByTestId('desc-mode-compact-btn')).toHaveAttribute('aria-pressed', 'true');
  await closeSettings(page);

  await expect(inspectCard.getByTestId('desc-mode-toggle-btn')).toHaveAttribute('data-desc-mode', 'compact');
  await expect(inspectCard.getByTestId('desc-mode-toggle-btn')).toHaveText('详细');
});
