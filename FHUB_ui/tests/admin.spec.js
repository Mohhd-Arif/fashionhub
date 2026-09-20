import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const require = createRequire(new URL('../../FHUB_be/package.json', import.meta.url));
const testDatabase = `fhub_test_${randomBytes(8).toString('hex')}`;
process.env.MONGODB_DB = testDatabase;
const app = require('./index');
const { connectDatabase, closeDatabase } = require('./config/database');
const { ensureIndexes } = require('./config/indexes');
const { hashPassword } = require('./service/auth');
const { saveImages } = require('./service/images');
const { ObjectId, Decimal128 } = require('mongodb');
const sharp = require('sharp');
let db, server, backendUrl;
const password = `Browser-test-${randomBytes(12).toString('hex')}`;

test.beforeAll(async () => {
  db = await connectDatabase();
  expect(db.databaseName).toBe(testDatabase);
  await ensureIndexes(db);
  await db.collection('users').insertOne({ email: 'browser-admin@example.test', passwordHash: await hashPassword(password), usertype: 'admin', createdAt: new Date() });
  const buffer = readFileSync(new URL('../public/images/photo-1598554747436-c9293d6a588f.jpg', import.meta.url));
  for (const [i, name] of ['Everyday linen shirt', 'Weekend cotton tee', 'Relaxed denim', 'Summer essentials'].entries()) {
    const _id = new ObjectId();
    await db.collection('articles').insertOne({ _id, name, nameKey: name.toLowerCase(), size: ['M', 'L', '32', 'Free size'][i], category: ['ladies', 'gents', 'kids', 'ladies'][i], gender: i % 2 ? 'male' : 'female', quantity: [12, 4, 0, 8][i], price: Decimal128.fromString('1299.00'), discount: Decimal128.fromString('10.00'), version: 1, images: await saveImages([{ buffer }], _id), createdAt: new Date(), updatedAt: new Date() });
  }
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  backendUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  try {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db?.databaseName === testDatabase && /^fhub_test_[a-f\d]{16}$/.test(testDatabase)) {
      for (const name of ['users', 'sessions', 'articles', 'articleImages.files', 'articleImages.chunks', 'imageCleanup', 'storefront']) await db.collection(name).deleteMany({});
    }
  } finally { await closeDatabase(); }
});

test.beforeEach(async ({ page }) => {
  // Forward real HTTP requests to an isolated Express/MongoDB instance; no API responses are mocked.
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    try {
      const response = await route.fetch({ url: `${backendUrl}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    } catch (error) {
      if (!/already handled|Target page, context or browser has been closed/i.test(error.message)) throw error;
    }
  });
});

test.afterEach(async ({ page }) => {
  try { await page.unrouteAll({ behavior: 'ignoreErrors' }); }
  catch (error) {
    if (!/Target page, context or browser has been closed/i.test(error.message)) throw error;
  }
});

async function signIn(page) {
  await page.goto('/admin');
  await page.getByLabel('Email address').fill('browser-admin@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your collection, at a glance.' })).toBeVisible();
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(4);
}

test('admin login, image upload, edit, filters, persistent session and delete', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Add article', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/Article name/).fill('Browser test shirt');
  await dialog.getByLabel(/^Size/).fill('38 / custom');
  await dialog.getByLabel(/^Quantity/).fill('7');
  await dialog.getByLabel(/^Price/).fill('999.95');
  await dialog.getByLabel('Discount (%)').fill('12.5');
  const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#bbc5a5' } }).png().toBuffer();
  await dialog.getByLabel('Upload article images').setInputFiles({ name: 'shirt.png', mimeType: 'image/png', buffer: png });
  await expect(dialog.locator('.editor-image')).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Add article', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const row = page.getByRole('row').filter({ hasText: 'Browser test shirt' });
  await expect(row).toContainText('7 in stock');
  await expect(row).toContainText('38 / custom');
  await expect.poll(() => row.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await row.getByRole('button', { name: 'Edit Browser test shirt' }).click();
  await expect(dialog.locator('.editor-image')).toHaveCount(1);
  await dialog.getByLabel(/^Quantity/).fill('2');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('2 in stock');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your collection, at a glance.' })).toBeVisible();
  await page.getByLabel('Search articles').fill('Browser test shirt');
  await page.getByLabel('Filter by stock').selectOption('low');
  await expect(page.locator('.inventory-table tbody tr')).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  await row.getByRole('button', { name: 'Delete Browser test shirt' }).click();
  await dialog.getByRole('button', { name: 'Delete article', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No matching articles.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('same login routes a customer to the store without inventory access', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email address').fill('browser-user@example.test');
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.shop-hero')).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.shop-hero')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add article', exact: true })).toHaveCount(0);
});

test('admin publishes collection images and messages, customer sees live articles and manages bag', async ({ page }) => {
  test.setTimeout(90000);
  await signIn(page);
  await page.getByRole('button', { name: 'Storefront', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Make it feel like you.' })).toBeVisible();
  await page.getByLabel('Announcement bar').fill('Fresh fits. Save on our latest arrivals.');
  await page.getByLabel('Main heading', { exact: true }).fill('Little styles. Big adventures.');
  await page.getByLabel('Offer or discount message').fill('Discover our kids collection');
  const png = await sharp({ create: { width: 80, height: 100, channels: 3, background: '#9cac82' } }).png().toBuffer();
  await page.getByLabel('Kids showcase image', { exact: true }).setInputFiles({ name: 'kids.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Phone number').fill('+91 99999 99999');
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Storefront published');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/storefront-editor-mobile.png', fullPage: true });
  await page.goto('/');
  await expect(page.locator('.shop-announcement')).toContainText('Fresh fits. Save on our latest arrivals.');
  await expect(page.locator('.hero-image-badge')).toHaveCount(0);
  await expect(page.locator('.hero-offer-card')).toHaveCount(0);
  await expect(page.locator('.hero-controls')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Little styles. Big adventures.');
  await expect.poll(() => page.locator('.hero-carousel-strip>img').first().evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(page.locator('.hero-carousel-strip>img').first()).toHaveAttribute('src', /\/api\/images\//);
  await page.getByRole('button', { name: 'View Everyday linen shirt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('1,169.1');
  await dialog.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Shopping bag, 1 items', exact: true }).click();
  await expect(dialog).toContainText('Everyday linen shirt');
  await expect(dialog).toContainText('Call the store');
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 items', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save Everyday linen shirt', exact: true }).click();
  await page.getByRole('navigation', { name: 'Mobile shopping' }).getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.locator('#catalogue .shop-product')).toHaveCount(1);
  await expect(page.locator('#catalogue .shop-product')).toContainText('Everyday linen shirt');
});
