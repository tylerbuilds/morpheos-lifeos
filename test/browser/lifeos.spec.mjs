import { test, expect } from '@playwright/test';
test('phone setup, editor, search, persistent favourites, safe content and return navigation', async ({ page, browser }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  if (await page.getByRole('button', { name: 'Make it mine' }).isVisible()) {
    await page.getByLabel('What would you like to call it?').fill('My everyday'); await page.getByRole('button', { name: 'Make it mine' }).click();
  }
  await page.locator('.tabs').getByRole('link', { name: 'Apps' }).click(); await page.getByRole('button', { name: 'Organise', exact: true }).click(); await page.getByRole('button', { name: 'Add a link' }).click();
  const row = page.locator('fieldset').last(); const suffix = test.info().project.name;
  await row.getByLabel('Name', { exact: true }).fill(`Library ${suffix}`); await row.getByLabel('Address').fill(`https://example.com/${suffix}`); await row.getByLabel('Section').selectOption('Media'); await row.getByLabel('Note').fill('<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Save changes' }).click(); await expect(page.locator('dialog')).not.toBeVisible();
  await page.getByRole('searchbox', { name: 'Search apps' }).fill(suffix); await expect(page.locator('#app-results .tile')).toHaveCount(1); await expect(page.locator('#app-results img')).toHaveCount(0);
  await page.locator('.tabs').getByRole('link', { name: 'Home' }).click(); await expect(page.getByRole('link', { name: new RegExp(`Library ${suffix}`) })).toBeVisible();
  const other = await browser.newContext(); const second = await other.newPage(); await second.goto('/'); await expect(second.getByRole('link', { name: new RegExp(`Library ${suffix}`) })).toBeVisible(); await other.close();
  for (const width of [320, 390, 430, 820, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of ['home', 'apps', 'life', 'guide', 'more', 'journal']) {
      await page.goto('/#' + route); await expect(page.locator('h1')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const link of await page.locator('.tabs a').all()) expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.goto('/#guide'); await page.getByRole('searchbox', { name: 'Search guide' }).fill('iPhone'); await expect(page.locator('#guide-results details')).toHaveCount(1);
  await page.locator('#guide-results summary').click(); await expect(page.getByText(/Tap Share, then Add to Home Screen/)).toBeVisible();
  await page.goto('/#apps'); await page.goto('/#home'); await page.goBack(); await expect(page.getByRole('heading', { name: 'Your apps & projects.' })).toBeVisible();
  expect(errors).toEqual([]);
});
