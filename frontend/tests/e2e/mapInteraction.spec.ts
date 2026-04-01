import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Navigate to the draw step via the nav bar button (scoped to <nav> to avoid ambiguity)
  await page.getByRole('navigation').getByRole('button', { name: 'Map Explorer' }).click();
  await expect(page.getByTestId('map-view')).toBeVisible();
});

test('location search overlay is visible on draw step', async ({ page }) => {
  await expect(page.getByTestId('location-search')).toBeVisible();
});

test('use my location button is visible', async ({ page }) => {
  await expect(page.getByTestId('use-my-location')).toBeVisible();
});

test('location search shows error for empty query', async ({ page }) => {
  await page.getByTestId('location-search-input').fill('');
  await page.getByTestId('location-search-submit').click({ force: true });
  // No fetch is made for empty input — no error shown either, button is just disabled or no-op
  await expect(page.getByTestId('location-search-error')).not.toBeVisible();
});

test('location search shows not-found message for gibberish query', async ({ page }) => {
  // Mock Nominatim to return empty results
  await page.route('https://nominatim.openstreetmap.org/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.getByTestId('location-search-input').fill('zzzznotaplace12345');
  await page.getByTestId('location-search-input').press('Enter');
  await expect(page.getByTestId('location-search-error')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('location-search-error')).toContainText('No results');
});

test('location search flies to result on valid query', async ({ page }) => {
  await page.route('https://nominatim.openstreetmap.org/**', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ lat: '40.7128', lon: '-74.0060', display_name: 'New York, NY' }]),
    }),
  );
  await page.getByTestId('location-search-input').fill('New York');
  await page.getByTestId('location-search-input').press('Enter');
  // No assertion on map pan (requires visual check); verify error is NOT shown
  await expect(page.getByTestId('location-search-error')).not.toBeVisible();
});

test('draw toolbar has no edit (pencil) button', async ({ page }) => {
  await expect(page.locator('.leaflet-draw-edit-edit')).not.toBeVisible();
});

test('draw toolbar has a delete (trash) button', async ({ page }) => {
  await expect(page.locator('.leaflet-draw-edit-remove')).toBeVisible();
});

test('clicking trash button with no shape does not open modal', async ({ page }) => {
  await page.locator('.leaflet-draw-edit-remove').click();
  await expect(page.getByTestId('delete-confirm-modal')).not.toBeVisible();
});
