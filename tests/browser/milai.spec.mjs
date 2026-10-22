import { test, expect } from '@playwright/test';
import { newDraft, fingerprint } from '../../src/lib/journeys.ts';
import { initialTrip } from '../../src/lib/trip-planner.ts';
import { origins } from '../../src/lib/destinations.ts';

const trip = { ...initialTrip, origin: origins.find(origin => origin.id === 'baghdad') };

async function seed(page) {
  const draft = { ...newDraft(), trip };
  draft.baseline = fingerprint(draft);
  await page.addInitScript(draft => {
    sessionStorage.setItem('bilad.draft.v1', JSON.stringify({ version: 1, draft }));
    localStorage.setItem('bilad.journeys.v1', JSON.stringify({ version: 1, journeys: [] }));
  }, draft);
}

const storedTrip = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('bilad.draft.v1')).draft.trip);

async function chat(page) {
  await page.goto('/ai/');
  await page.getByRole('button', { name: 'Ask Milai', exact: true }).click();
}

async function ask(page, message) {
  await page.getByLabel('What would you like to discover in Iraq?').fill(message);
  await page.getByRole('button', { name: 'Begin conversation' }).click();
}

test('local guide answers from curated data without making API requests', async ({ page }) => {
  await seed(page);
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) apiRequests.push(request.url());
  });

  await chat(page);
  await ask(page, 'Tell me about Babylon');
  await expect(page.getByRole('log')).toContainText('Babylon in');
  await expect(page.getByRole('button', { name: 'Babylon ↗', exact: true })).toBeVisible();
  await expect(page.getByText('Milai · local Bilad guide · curated content')).toBeVisible();
  expect(apiRequests).toEqual([]);
  expect(await storedTrip(page)).toEqual(trip);
});

test('local itinerary commands update the shared draft and Undo restores it', async ({ page }) => {
  await seed(page);
  await chat(page);
  await ask(page, 'Plan 4 hours in Baghdad');

  await expect(page.getByRole('button', { name: 'Explore your trip on the map' })).toBeVisible();
  await expect.poll(() => storedTrip(page)).not.toEqual(trip);
  expect((await storedTrip(page)).origin.id).toBe('baghdad');
  expect((await storedTrip(page)).stopIds.length).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Undo last itinerary edit' }).click();
  await expect.poll(() => storedTrip(page)).toEqual(trip);
});

test('local culture recommendations can be selected in the map planner', async ({ page }) => {
  await seed(page);
  await chat(page);
  await ask(page, 'Tell me about Iraqi culture');

  await expect(page.getByRole('log')).toContainText('living culture');
  await page.locator('.reply-places button').first().click();
  await expect(page.getByRole('button', { name: 'Plan a trip', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bilad.journeys.v1'))).toContain('"journeys":[]');
});
