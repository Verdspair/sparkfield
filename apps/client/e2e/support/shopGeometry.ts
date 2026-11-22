import { expect, type Locator, type Page } from '@playwright/test';

async function visibleBox(locator: Locator, label: string) {
  await expect(locator, `${label} is visible`).toBeVisible();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${label}`);
  return box;
}

export async function expectShopGeometry(page: Page, position: 'top' | 'bottom') {
  const dock = page.getByTestId('strategy-shop-dock');
  await expect(dock).toHaveAttribute('data-shop-dock-position', position);
  await expect(dock).toBeInViewport({ ratio: 1 });
  await dock.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {})));
  });

  const shop = await visibleBox(dock, `${position} shop`);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('Shop geometry requires a fixed viewport');
  if (position === 'top') {
    expect(shop.y + shop.height, 'top shop sits in the upper half').toBeLessThan(viewport.height / 2);
  } else {
    expect(shop.y, 'bottom shop sits in the lower half').toBeGreaterThan(viewport.height / 2);
  }

  for (const testId of ['hud-phase-capsule', 'open-inmatch-settings-btn', 'hud-left-rail', 'hud-right-rail']) {
    const other = await visibleBox(page.getByTestId(testId), testId);
    const overlapWidth = Math.min(shop.x + shop.width, other.x + other.width) - Math.max(shop.x, other.x);
    const overlapHeight = Math.min(shop.y + shop.height, other.y + other.height) - Math.max(shop.y, other.y);
    expect(overlapWidth <= 0 || overlapHeight <= 0, `${position} shop does not overlap ${testId}`).toBe(true);
  }
}
