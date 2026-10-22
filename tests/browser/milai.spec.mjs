import { test, expect } from '@playwright/test';
import { newDraft, fingerprint, makeJourney, draftFrom } from '../../src/lib/journeys.ts';
import { initialTrip } from '../../src/lib/trip-planner.ts';
import { origins } from '../../src/lib/destinations.ts';
import { answerMilaiLocally } from '../../src/lib/milai-local.ts';

const trip = { ...initialTrip, origin: origins.find(origin => origin.id === 'baghdad') };

async function seed(page, journey = null) {
  const draft = journey ? draftFrom(journey) : { ...newDraft(), trip };
  if (!journey) draft.baseline = fingerprint(draft);
  await page.addInitScript(({ draft, journey }) => {
    sessionStorage.setItem('bilad.draft.v1', JSON.stringify({ version: 1, draft }));
    localStorage.setItem('bilad.journeys.v1', JSON.stringify({ version: 1, journeys: journey ? [journey] : [] }));
  }, { draft, journey });
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
    await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, data: { ...local.response, actions: local.changed ? [{ type: 'build_day' }] : [] } } });
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

test('planning creates a map route and a saved Idea after confirmation', async ({ page }) => {
  await seed(page);
  await chat(page);
  await ask(page, 'Plan 4 hours in Baghdad');

  await expect(page.getByRole('button', { name: 'Create route & save Idea' })).toBeVisible();
  expect(await storedTrip(page)).toEqual(trip);
  await page.getByRole('button', { name: 'Create route & save Idea' }).click();
  await expect(page.getByRole('button', { name: 'Collapse Your trip' })).toBeVisible();
  await expect.poll(() => storedTrip(page)).not.toEqual(trip);
  expect((await storedTrip(page)).origin.id).toBe('baghdad');
  expect((await storedTrip(page)).stopIds.length).toBeGreaterThan(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys)).toHaveLength(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys[0]);
  expect(saved.status).toBe('idea');
  expect(saved.trip.stopIds).toEqual((await storedTrip(page)).stopIds);
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

test('Gemini action can open and focus a known place on the map', async ({ page }) => {
  await seed(page);
  await page.route('**/api/guide', route => route.fulfill({ json: { success: true, data: { reply: 'I found Babylon.', placeIds: ['babylon'], serviceIds: [], actions: [{ type: 'focus_place', placeId: 'babylon' }] } } }));
  await chat(page);
  await ask(page, 'Show Babylon on the map');
  await expect(page.getByRole('heading', { name: /Babylon/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Plan a trip', exact: true })).toBeVisible();
  expect(await storedTrip(page)).toEqual(trip);
});

test('Milai opens the existing map on a direct request', async ({ page }) => {
  await seed(page);
  await page.route('**/api/guide', route => route.fulfill({ json: { success: true, data: { reply: 'Opening your map.', placeIds: [], serviceIds: [], actions: [{ type: 'open_map' }] } } }));
  await chat(page);
  await ask(page, 'Open the map');
  await expect(page.getByRole('button', { name: 'Plan a trip', exact: true })).toBeVisible();
  expect(await storedTrip(page)).toEqual(trip);
});

test('a named route is saved with its exact requested stops', async ({ page }) => {
  await seed(page);
  await page.route('**/api/guide', route => route.fulfill({ json: { success: true, data: { reply: 'A focused Baghdad visit.', placeIds: ['mustansiriya'], serviceIds: [], actions: [{ type: 'build_day', originId: 'baghdad', minutes: 240, maxStops: 1, stopIds: ['mustansiriya'] }] } } }));
  await chat(page);
  await ask(page, 'Plan 4 hours in Baghdad with 1 stop: Al-Mustansiriya');
  await expect(page.getByRole('region', { name: 'Milai action proposal' })).toContainText('Al-Mustansiriya');
  await page.getByRole('button', { name: 'Create route & save Idea' }).click();
  await expect.poll(() => storedTrip(page)).toMatchObject({ stopIds: ['mustansiriya'] });
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys[0]?.status)).toBe('idea');
});

test('invalid model IDs cause visible errors and no journey write', async ({ page }) => {
  await seed(page);
  await page.route('**/api/guide', route => route.fulfill({ json: { success: true, data: { reply: 'A route was created.', placeIds: [], serviceIds: [], actions: [{ type: 'build_day', stopIds: ['invented-place'] }] } } }));
  await chat(page);
  await ask(page, 'Plan a route in Baghdad');
  await expect(page.locator('.milai-chat-error')).toContainText('Unknown place ID');
  await expect(page.getByRole('button', { name: 'Retry question' })).toBeVisible();
  expect(await storedTrip(page)).toEqual(trip);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys)).toEqual([]);
});

test('a confirmed completion uses the saved journey and supports Undo', async ({ page }) => {
  const journey = makeJourney({ ...newDraft(), title: 'Baghdad day', status: 'planned', trip });
  await seed(page, journey);
  await page.route('**/api/guide', route => route.fulfill({ json: { success: true, data: { reply: 'Ready to mark it done.', placeIds: [], serviceIds: [], actions: [{ type: 'complete_journey', journeyId: journey.id }] } } }));
  await chat(page);
  await ask(page, 'Mark my journey done');
  await expect(page.getByRole('button', { name: 'Mark Done' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys[0].status)).toBe('planned');
  await page.getByRole('button', { name: 'Mark Done' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys[0].status)).toBe('done');
  await page.getByRole('button', { name: 'Undo status change' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys[0].status)).toBe('planned');
});

test('pending questions appear immediately, repeated messages stay distinct, and unsent text is preserved', async ({ page }) => {
  await seed(page);
  const release = [];
  await page.route('**/api/guide', route => new Promise(resolve => {
    release.push(async () => { await route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, data: { reply: 'A little hello from Milai.', placeIds: [], serviceIds: [], actions: [] } } }); resolve(); });
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
  await page.route('**/api/guide', route => route.fulfill({ headers: { 'access-control-allow-origin': '*' }, json: { success: true, data: { reply: '<img src=x onerror=alert(1)>\nA welcoming place to start.', placeIds: [], serviceIds: [], actions: [] } } }));
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
