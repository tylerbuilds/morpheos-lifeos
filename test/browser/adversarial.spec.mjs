import { test, expect } from '@playwright/test';

const fixture = (revision = 'before', name = 'Private life') => ({
  state: { name, timezone: 'Europe/London', onboarded: true, links: [{ id: 'private-link', label: 'Private destination', url: 'https://example.com/private', detail: '', section: 'Life', favourite: true, hidden: false }] },
  revision, sections: ['Life', 'Other'], metrics: [], journal: [], notices: [], demo: false, passwordEnabled: true,
});

test('expired session clears cached private content and releases its modal', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/dashboard', route => route.fulfill({ status: route.request().method() === 'PUT' ? 401 : 200, json: route.request().method() === 'PUT' ? { error: 'Please sign in.' } : fixture() }));
  await page.goto('/#apps'); await page.getByRole('button', { name: 'Organise', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('dialog')).not.toBeVisible(); await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await page.locator('.tabs').getByRole('link', { name: 'Home' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Private destination/ })).toHaveCount(0);
  await expect(page.locator('#brand')).toHaveText('LifeOS'); expect(errors).toEqual([]);
});

test('a conflicting edit can load the latest revision and save again', async ({ page }) => {
  let reads = 0, writes = 0;
  await page.route('**/api/dashboard', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: fixture(++reads > 1 ? 'after' : 'before') });
    writes++;
    if (writes === 1) return route.fulfill({ status: 409, json: { error: 'Another device saved changes.' } });
    expect(route.request().headers()['if-match']).toBe('after');
    return route.fulfill({ json: { state: route.request().postDataJSON(), revision: 'saved' } });
  });
  await page.goto('/#apps'); await page.getByRole('button', { name: 'Organise', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Reload saved links' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reload saved links' }).click();
  await expect(page.getByRole('button', { name: 'Reload saved links' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.locator('dialog')).not.toBeVisible(); expect(writes).toBe(2);
});

test('logout network failure is visible and skip navigation keeps the current page', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/dashboard', route => route.fulfill({ json: fixture() }));
  await page.route('**/api/logout', route => route.abort('failed'));
  await page.goto('/#more'); await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('status')).not.toHaveText(''); expect(errors).toEqual([]);
  await page.goto('/#apps'); await page.locator('a.skip').focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Your apps & projects.' })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
});
