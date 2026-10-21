import { test, expect } from '@playwright/test';
import { newDraft, fingerprint, makeJourney, draftFrom } from '../../src/lib/journeys.ts';
import { initialTrip, buildDay } from '../../src/lib/trip-planner.ts';
import { origins } from '../../src/lib/destinations.ts';

const trip = { ...initialTrip, origin: origins[0] };
const data = (actions = [], reply = 'Curated advice from Bilad.') => ({ success: true, data: { reply, placeIds: ['babylon'], serviceIds: [], actions } });
async function seed(page, { saved, dirty = false } = {}) {
  const draft = saved ? draftFrom(saved) : { ...newDraft(), trip };
  draft.baseline = fingerprint(draft);
  if (dirty) draft.notes = 'Unsaved private note';
  await page.addInitScript(({ draft, saved }) => {
    sessionStorage.setItem('bilad.draft.v1', JSON.stringify({ version: 1, draft }));
    localStorage.setItem('bilad.journeys.v1', JSON.stringify({ version: 1, journeys: saved ? [saved] : [] }));
  }, { draft, saved });
}
const stored = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('bilad.draft.v1')).draft);
const journeys = page => page.evaluate(() => JSON.parse(localStorage.getItem('bilad.journeys.v1')).journeys);
async function mock(page, handler) {
  await page.route('**/api/guide', async route => {
    const reply = await handler(route.request().postDataJSON());
    await route.fulfill({ status: reply.status || 200, headers: { 'Access-Control-Allow-Origin': '*' }, json: reply.body ?? reply });
  });
}
async function chat(page) { await page.goto('/ai/'); await page.getByRole('button', { name: 'Ask Milai', exact: true }).click(); }
async function ask(page, message) { await page.getByLabel('What would you like to discover in Iraq?').fill(message); await page.getByRole('button', { name: 'Begin conversation' }).click(); }
async function switchToChat(page) { await page.getByRole('button', { name: 'More options', exact: true }).click(); await page.locator('#discovery-options').getByRole('button', { name: 'Ask Milai', exact: true }).click(); }

test('chat renders plain text safely and preserves the draft, prompt and place focus across map switching', async ({ page }) => {
  await seed(page);
  let request;
  await mock(page, body => { request = body; return data([], '<img src=x onerror=alert(1)> Babylon has a sourced story.'); });
  await chat(page); await ask(page, 'Tell me about Babylon');
  await expect(page.getByRole('log')).toContainText('<img src=x onerror=alert(1)>');
  expect(request.context).toEqual({});
  await expect(page.getByRole('log').locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Babylon ↗', exact: true }).click();
  await expect(page.locator('.place-spotlight')).toContainText('Babylon');
  expect((await stored(page)).trip).toEqual(trip);
  await switchToChat(page);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toHaveValue('Tell me about Babylon');
  await expect(page.getByRole('log')).toContainText('You: Tell me about Babylon');
  expect(await journeys(page)).toEqual([]);
});

test('itinerary proposals require a click, edit the shared draft, preserve settings and support Undo', async ({ page }) => {
  await seed(page); await mock(page, () => data([{ type: 'build_day' }]));
  await chat(page); await ask(page, 'Build my day');
  await expect(page.getByRole('button', { name: 'Apply itinerary change' })).toBeVisible();
  expect((await stored(page)).trip).toEqual(trip);
  await page.getByRole('button', { name: 'Cancel proposal' }).click();
  expect((await stored(page)).trip).toEqual(trip);
  await page.waitForTimeout(2100); await ask(page, 'Build my day');
  await page.getByRole('button', { name: 'Apply itinerary change' }).click();
  await expect.poll(async () => (await stored(page)).trip.stopIds).toEqual(buildDay(trip));
  expect({ ...(await stored(page)).trip, stopIds: [] }).toEqual(trip);
  await page.getByRole('button', { name: 'Undo last itinerary edit' }).click();
  await expect.poll(async () => (await stored(page)).trip).toEqual(trip);
  expect(await journeys(page)).toEqual([]);
});

test('save uses existing JourneyBar; a draft is not silently saved or completed', async ({ page }) => {
  await seed(page); await mock(page, () => data([{ type: 'save_trip' }]));
  await chat(page); await ask(page, 'Save my trip');
  await expect(page.getByRole('button', { name: 'Save as idea', exact: true })).toBeVisible();
  expect(await journeys(page)).toEqual([]);
  await page.getByLabel('Active trip title', { exact: true }).fill('Baghdad with Milai');
  await page.getByRole('button', { name: 'Save as idea', exact: true }).click();
  await expect.poll(async () => (await journeys(page)).length).toBe(1);
  const saved = (await journeys(page))[0]; expect(saved.title).toBe('Baghdad with Milai'); expect(saved.status).toBe('idea');
});

test('saved Planned completion is explicit, uses lifecycle persistence and Undo; private notes stay local', async ({ page }) => {
  const saved = makeJourney({ title: 'Baghdad day', trip, status: 'planned', travelDate: '2026-10-21', notes: 'PRIVATE NOTE' });
  await seed(page, { saved });
  let request;
  await mock(page, body => { request = body; return data([{ type: 'complete_journey', journeyId: saved.id }]); });
  await chat(page); await ask(page, 'Mark my current journey done');
  await expect(page.getByRole('button', { name: 'Mark saved journey done' })).toBeVisible();
  expect((await journeys(page))[0].status).toBe('planned');
  expect(JSON.stringify(request)).not.toContain('PRIVATE NOTE'); expect(JSON.stringify(request)).not.toContain('2026-10-21');
  await page.getByRole('button', { name: 'Mark saved journey done' }).click();
  await expect.poll(async () => (await journeys(page))[0].status).toBe('done');
  await expect(page.getByText('marked done.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Undo status change' }).click();
  await expect.poll(async () => (await journeys(page))[0].status).toBe('planned');
  expect((await journeys(page))[0].notes).toBe('PRIVATE NOTE');
});

test('dirty journey and inferred completion cannot bypass intent or save rules', async ({ page }) => {
  const saved = makeJourney({ title: 'Baghdad day', trip, status: 'planned', travelDate: '', notes: '' });
  await seed(page, { saved, dirty: true });
  await mock(page, () => data([{ type: 'complete_journey', journeyId: saved.id }]));
  await chat(page); await ask(page, 'I visited my journey today');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('existing saved journey');
  await expect(page.getByRole('button', { name: 'Mark saved journey done' })).toHaveCount(0);
  await page.waitForTimeout(2100); await ask(page, 'Mark my current journey done');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Save your active changes');
  expect((await journeys(page))[0].status).toBe('planned');
  expect((await stored(page)).notes).toBe('Unsaved private note');
});

test('backend failure is visible and can be retried; unknown actions are rejected in the browser', async ({ page }) => {
  await seed(page);
  let count = 0;
  await mock(page, () => ++count === 1 ? { status: 503, body: { success: false, error: { code: 'AI_NOT_CONFIGURED', message: 'Milai backend unavailable. Retry later.' } } } : data([{ type: 'delete_journey', journeyId: 'x' }]));
  await chat(page); await ask(page, 'Tell me about Iraq');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('backend unavailable');
  await page.waitForTimeout(2100); await page.getByRole('button', { name: 'Retry question' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('forbidden website action');
  expect((await stored(page)).trip).toEqual(trip); expect(await journeys(page)).toEqual([]);
});

test('a late response cannot overwrite a trip edited while the model is replying', async ({ page }) => {
  await seed(page);
  let release;
  const deferred = new Promise(resolve => { release = resolve; });
  let received = false;
  await mock(page, () => { received = true; return deferred; });
  await chat(page); await ask(page, 'Build my day');
  await expect.poll(() => received).toBe(true);
  await page.getByRole('button', { name: 'Explore your trip on the map' }).click();
  await page.getByRole('button', { name: 'Plan a trip', exact: true }).click();
  await page.getByLabel('Time available', { exact: true }).selectOption('360');
  await expect.poll(async () => (await stored(page)).trip.minutes).toBe(360);
  release(data([{ type: 'build_day' }]));
  await switchToChat(page);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('trip changed');
  await expect(page.getByRole('button', { name: 'Apply itinerary change' })).toHaveCount(0);
  expect((await stored(page)).trip.stopIds).toEqual([]);
});

test('another tab changing the saved revision prevents a pending completion', async ({ page, context }) => {
  const saved = makeJourney({ title: 'Baghdad day', trip, status: 'planned', travelDate: '', notes: '' });
  await seed(page, { saved });
  await mock(page, () => data([{ type: 'complete_journey', journeyId: saved.id }]));
  await chat(page); await ask(page, 'Mark my current journey done');
  await expect(page.getByRole('button', { name: 'Mark saved journey done' })).toBeVisible();
  const other = await context.newPage(); await other.goto('/services/');
  await other.evaluate(saved => localStorage.setItem('bilad.journeys.v1', JSON.stringify({ version: 1, journeys: [{ ...saved, revision: 'other-tab-revision', notes: 'Changed elsewhere' }] })), saved);
  await expect(page.getByText('Updated in another tab.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Mark saved journey done' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('changed in another tab');
  expect((await journeys(page))[0].status).toBe('planned'); expect((await journeys(page))[0].notes).toBe('Changed elsewhere');
  await other.close();
});

test('a failed persistence write cannot be reported as completed', async ({ page }) => {
  const saved = makeJourney({ title: 'Baghdad day', trip, status: 'planned', travelDate: '', notes: '' });
  await seed(page, { saved }); await mock(page, () => data([{ type: 'complete_journey', journeyId: saved.id }]));
  await chat(page); await ask(page, 'Mark my current journey done');
  await expect(page.getByRole('button', { name: 'Mark saved journey done' })).toBeVisible();
  await page.evaluate(() => {
    const write = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key === 'bilad.journeys.v1') throw new DOMException('Full', 'QuotaExceededError'); return write.call(this, key, value); };
  });
  await page.getByRole('button', { name: 'Mark saved journey done' }).click();
  await expect(page.getByText('The journey could not be completed.', { exact: false })).toBeVisible();
  await expect(page.getByRole('main').getByText('Device storage is unavailable or full.', { exact: false })).toBeVisible();
  expect((await journeys(page))[0].status).toBe('planned');
  await expect(page.getByText('marked done.', { exact: false })).toHaveCount(0);
});

test('mobile keyboard chat keeps focus behavior and shows service recommendations without navigation', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page); await mock(page, () => data([{ type: 'recommend_service', serviceId: 'baly' }], 'Baly is a listed taxi option.'));
  await chat(page);
  await expect(page.getByLabel('What would you like to discover in Iraq?')).toBeFocused();
  await page.getByLabel('What would you like to discover in Iraq?').fill('Recommend a taxi');
  await page.getByLabel('What would you like to discover in Iraq?').press('Enter');
  await expect(page.locator('.milai-service')).toContainText('Baly');
  await expect(page.getByRole('link', { name: 'Visit provider' })).toHaveAttribute('href', 'https://baly.iq/');
  expect(context.pages().length).toBe(1); expect(new URL(page.url()).pathname).toBe('/ai/');
  await page.getByLabel('What would you like to discover in Iraq?').press('Escape');
  await expect(page.getByRole('button', { name: 'Ask Milai', exact: true })).toBeFocused();
  expect((await stored(page)).trip).toEqual(trip);
});
