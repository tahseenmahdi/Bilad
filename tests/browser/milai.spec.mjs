import { test, expect } from '@playwright/test';
import { newDraft, fingerprint } from '../../src/lib/journeys.ts';
import { initialTrip } from '../../src/lib/trip-planner.ts';
import { origins } from '../../src/lib/destinations.ts';
import { answerMilaiLocally } from '../../src/lib/milai-local.ts';

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

// Keep UI checks deterministic and independent of API credentials or model quota.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/guide', async route => {
    const request = route.request().postDataJSON();
    const local = answerMilaiLocally(request.message, request.context.trip ?? trip);
    await route.fulfill({ json: { ...local.response, actions: local.changed ? [{ type: 'build_day' }] : [] } });
  });
});

test('chat separates right/left bubbles and clears the bottom input after sending', async ({ page }, testInfo) => {
  await seed(page);
  const apiRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/')) apiRequests.push(request.url());
  });

  await chat(page);
  await ask(page, 'Tell me about Babylon');
  await expect(page.getByRole('log')).toContainText('Babylon in');
  await expect(page.getByRole('button', { name: 'Babylon ↗', exact: true })).toBeVisible();
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('');
  await expect(page.locator('.milai-message-user .milai-text')).toHaveText('Tell me about Babylon');
  await expect(page.getByRole('log')).not.toContainText('You:');
  const user = await page.locator('.milai-message-user .milai-bubble').boundingBox();
  const assistant = await page.locator('.milai-message-assistant .milai-bubble').boundingBox();
  expect(user.x).toBeGreaterThan(assistant.x);
  const composer = await page.locator('#guide-composer').boundingBox();
  expect(composer.y).toBeGreaterThan(assistant.y + assistant.height);
  expect(apiRequests.length).toBe(1);
  expect(await storedTrip(page)).toEqual(trip);
  await page.screenshot({ path: testInfo.outputPath('milai-chat-desktop.png') });
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

test('pending questions appear immediately, repeated messages stay distinct, and unsent text is preserved', async ({ page }) => {
  await seed(page);
  const release = [];
  await page.route('**/api/guide', route => new Promise(resolve => {
    release.push(async () => { await route.fulfill({ json: { reply: 'A little hello from Milai.', placeIds: [], serviceIds: [], actions: [] } }); resolve(); });
  }));
  await chat(page);
  await ask(page, 'Hello');
  await expect(page.locator('.milai-message-user')).toHaveCount(1);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('');
  await expect(page.getByRole('status')).toContainText('Milai is thinking');
  await page.getByLabel('What would you like to discover in Iraq?').fill('My next question');
  await page.getByLabel('What would you like to discover in Iraq?').press('Enter');
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('My next question');
  await expect.poll(() => release.length).toBe(1);
  await release[0]();
  await expect(page.locator('.milai-message-assistant')).toHaveCount(1);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('My next question');
  await ask(page, 'Hello');
  await expect(page.locator('.milai-message-user')).toHaveCount(2);
  await expect.poll(() => release.length).toBe(2);
  await release[1]();
  await expect(page.locator('.milai-message-user')).toHaveCount(2);
  await expect(page.locator('.milai-message-assistant')).toHaveCount(2);
});

test('mobile chat keeps the composer visible, safe text, keyboard focus and reduced-motion behavior', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.route('**/api/guide', route => route.fulfill({ json: { reply: '<img src=x onerror=alert(1)>\nA welcoming place to start.', placeIds: [], serviceIds: [], actions: [] } }));
  await chat(page);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toBeFocused();
  await ask(page, 'Hi Milai');
  await expect(page.getByRole('log')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.getByRole('log').locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('');
  await expect(page.locator('.milai-chat-header')).toBeInViewport();
  await expect(page.locator('.ai-header')).toBeInViewport();
  const composer = await page.locator('#guide-composer').boundingBox();
  expect(composer.y + composer.height).toBeLessThan(844);
  expect(await page.locator('.milai-message-user').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('milai-chat-mobile.png') });
  await page.getByLabel('What would you like to discover in Iraq?').press('Escape');
  await expect(page.getByRole('button', { name: 'Ask Milai', exact: true })).toBeFocused();
});

test('new bubbles animate when motion is enabled', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await seed(page); await chat(page); await ask(page, 'Tell me about Babylon');
  await expect(page.locator('.milai-message-user')).toHaveCount(1);
  expect(await page.locator('.milai-message-user').evaluate(el => getComputedStyle(el).animationName)).toBe('milai-message-arrive');
});
