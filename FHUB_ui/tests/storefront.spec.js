import { test, expect } from '@playwright/test';

test('live storefront carousel and mobile layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.shop-hero')).toBeVisible();
  await expect(page.locator('.hero-image-badge')).toHaveCount(0);
  await expect(page.locator('.hero-offer-card')).toHaveCount(0);
  await expect(page.locator('.hero-controls')).toHaveCount(0);
  await expect.poll(() => page.locator('.hero-carousel-strip>img').first().evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  const startTransform = await page.locator('.hero-carousel-strip').evaluate(el => getComputedStyle(el).transform);
  const startHeading = await page.getByRole('heading', { level: 1 }).textContent();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('.hero-carousel-strip').evaluate(el => getComputedStyle(el).transform)).not.toBe(startTransform);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(startHeading);
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/live-store-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/live-store-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('navigation', { name: 'Mobile collections' }).getByRole('button', { name: 'Kids', exact: true }).click();
  await expect(page.locator('#catalogue .shop-tabs button.active')).toHaveText('Kids');
  expect(errors).toEqual([]);
});

test('shared account entry, search and empty bag', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.shop-hero')).toBeVisible();
  await page.getByRole('button', { name: 'Search articles', exact: true }).click();
  await page.getByLabel('Find clothing').fill('no-such-article-uniquetest');
  await expect(page.getByRole('heading', { name: 'No matches just yet.' })).toBeVisible();
  await page.getByRole('button', { name: 'Close search', exact: true }).click();
  await page.getByRole('button', { name: 'Shopping bag, 0 items', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Your bag is waiting for its first favourite.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});
